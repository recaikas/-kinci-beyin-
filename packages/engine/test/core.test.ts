import { describe, expect, it } from "vitest";
import { FixedRng } from "@kader/dice";
import {
  abilityModifier, conditionEffects, contest, d20Test, DEFAULT_RULES, EngineContext, expandConditions,
  groupCheck, isValidPointBuy, passiveScore, proficiencyBonus, RAW_RULES, resolveMode, savingThrow,
  skillCheck, skillModifier, tierFor,
} from "../src/index.ts";
import { pc } from "./helpers.ts";

describe("çekirdek", () => {
  it("yetenek modu", () => {
    expect([1, 8, 9, 10, 11, 12, 15, 20, 30].map(abilityModifier)).toEqual([-5, -1, -1, 0, 0, 1, 2, 5, 10]);
  });
  it("yeterlilik bonusu", () => {
    expect([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(proficiencyBonus)).toEqual([2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  });
  it("puan alımı", () => {
    expect(isValidPointBuy({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 })).toBe(true);
    expect(isValidPointBuy({ str: 15, dex: 15, con: 15, int: 15, wis: 8, cha: 8 })).toBe(false);
    expect(isValidPointBuy({ str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBe(false);
  });
});

describe("d20 testi", () => {
  it("avantaj/dezavantaj birbirini iptal eder", () => {
    expect(resolveMode(true, true)).toBe("normal");
    expect(resolveMode(true, false)).toBe("advantage");
  });
  it("avantajda yüksek, dezavantajda düşük", () => {
    const ctx = new EngineContext(new FixedRng([4, 17, 4, 17]));
    expect(d20Test(ctx, { modifier: 2, advantage: true, reason: "t" }).total).toBe(19);
    expect(d20Test(ctx, { modifier: 2, disadvantage: true, reason: "t" }).total).toBe(6);
    expect(ctx.rolls).toHaveLength(2);
  });
  it("Halfling Lucky doğal 1'i yeniden atar", () => {
    const ctx = new EngineContext(new FixedRng([1, 12]));
    expect(d20Test(ctx, { modifier: 0, lucky: true, reason: "t" }).natural).toBe(12);
  });
  it("Reliable Talent alt sınırı ama doğal değer korunur", () => {
    const ctx = new EngineContext(new FixedRng([3]));
    const r = d20Test(ctx, { modifier: 5, minimum: 10, reason: "t" });
    expect(r.total).toBe(15);
    expect(r.natural).toBe(3);
  });
  it("Bless gibi ek zarlar", () => {
    const ctx = new EngineContext(new FixedRng([10, 3]));
    expect(d20Test(ctx, { modifier: 1, bonusDice: ["1d4"], reason: "t" }).total).toBe(14);
  });
});

describe("sonuç kademeleri", () => {
  it("RAW: yalnızca başarı/başarısızlık", () => {
    expect(tierFor(15, 15, 10, RAW_RULES)).toBe("success");
    expect(tierFor(14, 15, 10, RAW_RULES)).toBe("failure");
    expect(tierFor(30, 15, 20, RAW_RULES)).toBe("success");
  });
  it("sinematik: kısmi ve kritik kademeler", () => {
    expect(tierFor(13, 15, 8, DEFAULT_RULES)).toBe("partial");
    expect(tierFor(11, 15, 8, DEFAULT_RULES)).toBe("failure");
    expect(tierFor(25, 15, 15, DEFAULT_RULES)).toBe("critical_success");
    expect(tierFor(4, 15, 3, DEFAULT_RULES)).toBe("critical_failure");
    expect(tierFor(16, 15, 20, DEFAULT_RULES)).toBe("critical_success");
    expect(tierFor(15, 15, 1, DEFAULT_RULES)).toBe("partial");
  });
});

describe("kontroller", () => {
  it("beceri modu: yeterlilik, uzmanlık, jack of all trades", () => {
    const c = pc("arda", { expertise: ["stealth"], features: { jackOfAllTrades: true } });
    expect(skillModifier(c, "persuasion")).toBe(2 + 2);
    expect(skillModifier(c, "stealth")).toBe(2 + 4);
    expect(skillModifier(c, "arcana")).toBe(0 + 1);
  });
  it("korkmuş karakter kontrolde dezavantajlı", () => {
    const ctx = new EngineContext(new FixedRng([18, 5]));
    const r = skillCheck(ctx, pc("arda", { conditions: ["frightened"] }), "athletics", 10);
    expect(r.roll.mode).toBe("disadvantage");
    expect(r.roll.total).toBe(5 + 4);
  });
  it("kör karakter görmeye dayalı kontrolde otomatik başarısız", () => {
    const ctx = new EngineContext(new FixedRng([20]));
    const r = skillCheck(ctx, pc("arda", { conditions: ["blinded"] }), "perception", 5, { sense: "sight" });
    expect(r.success).toBe(false);
    expect(r.autoFailed).toBe(true);
  });
  it("felçli karakter DEX kurtarmasında otomatik başarısız", () => {
    const ctx = new EngineContext(new FixedRng([20]));
    const r = savingThrow(ctx, pc("arda", { conditions: ["paralyzed"] }), "dex", 5);
    expect(r.success).toBe(false);
  });
  it("bilinçsiz → etkisiz + yerde", () => {
    const s = expandConditions(["unconscious"]);
    expect(s.has("incapacitated") && s.has("prone")).toBe(true);
  });
  it("bitkinlik seviyeleri", () => {
    expect(conditionEffects([], 1).abilityCheckDisadvantage).toBe(true);
    expect(conditionEffects([], 2).speedHalved).toBe(true);
    expect(conditionEffects([], 3).attackDisadvantage).toBe(true);
    expect(conditionEffects([], 4).maxHpHalved).toBe(true);
    expect(conditionEffects([], 5).speedZero).toBe(true);
    expect(conditionEffects([], 6).dead).toBe(true);
  });
  it("karşılıklı kontrol ve eşitlik", () => {
    const ctx = new EngineContext(new FixedRng([10, 10]));
    const a = pc("a");
    const b = pc("b");
    expect(contest(ctx, { creature: a, skill: "athletics" }, { creature: b, skill: "athletics" }).winner).toBe("tie");
  });
  it("grup kontrolü yarısı başarılıysa başarılı", () => {
    const ctx = new EngineContext(new FixedRng([15, 2, 14, 1]), RAW_RULES);
    const r = groupCheck(ctx, [pc("a"), pc("b"), pc("c"), pc("d")], "athletics", 12);
    expect(r.successes).toBe(2);
    expect(r.success).toBe(true);
  });
  it("pasif algı", () => {
    expect(passiveScore(pc("a"), "perception")).toBe(11);
    expect(passiveScore(pc("a", { conditions: ["poisoned"] }), "perception")).toBe(6);
  });
});

import { accusative, dative, genitive, locative } from "../src/index.ts";

describe("Türkçe ekler", () => {
  it("ünlü uyumu ve kaynaştırma", () => {
    expect(genitive("Arda")).toBe("Arda'nın");
    expect(genitive("Kerem")).toBe("Kerem'in");
    expect(genitive("Muhafız Kerem")).toBe("Muhafız Kerem'in");
    expect(genitive("Goblin Izgir")).toBe("Goblin Izgir'in");
    expect(genitive("Oğuz")).toBe("Oğuz'un");
    expect(dative("Arda")).toBe("Arda'ya");
    expect(dative("Selin")).toBe("Selin'e");
    expect(accusative("Arda")).toBe("Arda'yı");
    expect(accusative("Ümit")).toBe("Ümit'i");
    expect(locative("Arda")).toBe("Arda'da");
    expect(locative("Ahmet")).toBe("Ahmet'te");
    expect(locative("Pıtpıt")).toBe("Pıtpıt'ta");
  });
});
