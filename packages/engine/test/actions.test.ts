import { describe, expect, it } from "vitest";
import { FixedRng, SeededRng } from "@kader/dice";
import {
  awardXp, encounterDifficulty, type Faction, levelForXp, longRest, resolveAction, shortRest,
  EngineContext, spawnMonster, StateWriter, RAW_RULES,
} from "../src/index.ts";
import { pc, world } from "./helpers.ts";

const faction = (id: string, o: Partial<Faction> = {}): Faction => ({
  id, name: id.toUpperCase(), treasury: 10000, military: 5000, stability: 60, population: 100000,
  tech: 3, intelligence: 30, traits: { diplomacy: 14, martial: 12, stewardship: 12, intrigue: 10 },
  regionIds: [`${id}-r1`, `${id}-r2`], atWarWith: [], alliances: [], ...o,
});

describe("resolveAction", () => {
  it("beceri kontrolü zaman ilerletir ve gerçek üretir", () => {
    const s = world([pc("arda")]);
    const r = resolveAction(s, { type: "skill_check", actorId: "arda", skill: "athletics", difficulty: "medium" }, { rng: new FixedRng([13]) });
    expect(r.ok).toBe(true);
    expect(r.outcome.tier).toBe("success");
    expect(r.outcome.facts[0]).toContain("DC 15");
    expect(r.state.gameTime).toBe(1);
    expect(s.gameTime).toBe(0); // girdi durumu değişmez
  });

  it("geçersiz eylem durumu değiştirmez", () => {
    const s = world([pc("arda")]);
    const r = resolveAction(s, { type: "use_item", actorId: "arda", itemKey: "potion_of_healing" }, { rng: new FixedRng([]) });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("İyileştirme İksiri");
    expect(r.effects).toHaveLength(0);
  });

  it("iksir içmek HP verir ve envanterden düşer", () => {
    const s = world([pc("arda", { hp: 3 })], { inventories: { arda: [{ itemKey: "potion_of_healing", qty: 2 }] } });
    const r = resolveAction(s, { type: "use_item", actorId: "arda", itemKey: "potion_of_healing" }, { rng: new FixedRng([2, 3]) });
    expect(r.state.creatures.arda!.hp).toBe(10);
    expect(r.state.inventories.arda).toEqual([{ itemKey: "potion_of_healing", qty: 1 }]);
  });

  it("rüşvetli ikna: para el değiştirir, tutum değişir", () => {
    const s = world([pc("arda"), spawnMonster("guard", "kerem", { locationId: "town" })], {
      wallets: { arda: 5000 },
      relationships: { "arda|kerem": 20 },
    });
    const r = resolveAction(s, { type: "social", actorId: "arda", targetId: "kerem", approach: "bribe", risk: "significant", bribeCp: 2000 }, { rng: new FixedRng([12]) });
    expect(r.ok).toBe(true);
    expect(r.state.wallets.arda).toBe(3000);
    expect(r.state.wallets.kerem).toBe(2000);
    expect(r.outcome.details.dc).toBe(15 - 10);
    expect(r.state.relationships["arda|kerem"]).toBeGreaterThan(20);
    expect(r.outcome.facts.some((f) => f.includes("dostça"))).toBe(true);
  });

  it("yetersiz parayla rüşvet reddedilir", () => {
    const s = world([pc("arda"), spawnMonster("guard", "kerem")], { wallets: { arda: 100 } });
    const r = resolveAction(s, { type: "social", actorId: "arda", targetId: "kerem", approach: "bribe", risk: "minor", bribeCp: 2000 }, { rng: new FixedRng([]) });
    expect(r.ok).toBe(false);
  });

  it("PC elinde olmayan silahla saldıramaz", () => {
    const s = world([pc("arda"), spawnMonster("goblin", "gob")]);
    const r = resolveAction(s, { type: "attack", actorId: "arda", targetId: "gob", weaponKey: "greatsword" }, { rng: new FixedRng([]) });
    expect(r.ok).toBe(false);
  });

  it("tam savaş akışı: başlat, sıra, saldırı, eylem ekonomisi, bitir", () => {
    let s = world([pc("arda"), spawnMonster("goblin", "gob")], { inventories: { arda: [{ itemKey: "longsword", qty: 1 }] } });
    const rng = new FixedRng([20, 1, 2, 1, 15, 8, 9]);
    let ids = 0;
    const opts = { rng, newId: () => `enc-${++ids}` };
    let r = resolveAction(s, { type: "start_combat", actorId: "arda", participantIds: ["gob"] }, opts);
    expect(r.ok).toBe(true);
    s = r.state;
    expect(s.encounter!.order[0]!.id).toBe("arda");
    r = resolveAction(s, { type: "attack", actorId: "arda", targetId: "gob", weaponKey: "longsword" }, opts);
    expect(r.outcome.details.hit).toBe(true);
    s = r.state;
    // Aynı turda ikinci eylem reddedilir.
    const again = resolveAction(s, { type: "dodge", actorId: "arda" }, opts);
    expect(again.ok).toBe(false);
    r = resolveAction(s, { type: "end_combat", actorId: "arda" }, opts);
    expect(r.state.encounter).toBeNull();
  });

  it("tohumlu RNG ile aynı tur aynı sonucu verir (replay)", () => {
    const s = world([pc("arda")]);
    const a = resolveAction(s, { type: "skill_check", actorId: "arda", skill: "athletics", difficulty: "hard" }, { rng: new SeededRng("c1:t9") });
    const b = resolveAction(s, { type: "skill_check", actorId: "arda", skill: "athletics", difficulty: "hard" }, { rng: new SeededRng("c1:t9") });
    expect(a.rolls).toEqual(b.rolls);
    expect(a.outcome).toEqual(b.outcome);
  });

  it("saklanma pasif algıya karşı", () => {
    const s = world([pc("arda", { skillProficiencies: ["stealth"] }), spawnMonster("guard", "kerem", { locationId: "town" })], {
      relationships: { "arda|kerem": -50 },
    });
    const r = resolveAction(s, { type: "hide", actorId: "arda" }, { rng: new FixedRng([10]) });
    expect(r.outcome.details.dc).toBe(10 + 2);
    expect(r.outcome.tier).toBe("success");
  });
});

describe("ilerleme ve dinlenme", () => {
  it("XP ve seviye", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
    expect(levelForXp(355000)).toBe(20);
    const w = new StateWriter(world([pc("arda")]));
    expect(awardXp(w, "arda", 900).leveledUp).toBe(true);
  });

  it("karşılaşma zorluğu", () => {
    expect(encounterDifficulty([1, 1, 1, 1], [0.25, 0.25, 0.25, 0.25]).difficulty).toBe("deadly");
    expect(encounterDifficulty([3, 3, 3, 3], [0.25, 0.25]).difficulty).toBe("trivial");
    expect(encounterDifficulty([3, 3, 3, 3], [0.25, 0.25, 0.25, 0.25]).difficulty).toBe("easy");
  });

  it("kısa dinlenme hit die harcar, uzun dinlenme yeniler", () => {
    const w = new StateWriter(world([pc("arda", { hp: 1, level: 4, hitDice: { 10: 4 }, hitDiceMax: { 10: 4 }, exhaustion: 2 })]));
    const ctx = new EngineContext(new FixedRng([6, 1]), RAW_RULES);
    expect(shortRest(ctx, w, "arda", { 10: 2 })).toBe(6 + 2 + 1 + 2);
    expect(w.creature("arda").hitDice[10]).toBe(2);
    longRest(ctx, w, "arda");
    expect(w.creature("arda").hp).toBe(12);
    expect(w.creature("arda").hitDice[10]).toBe(4);
    expect(w.creature("arda").exhaustion).toBe(1);
    expect(w.state.gameTime).toBe(60 + 480);
  });
});

describe("strateji katmanı", () => {
  const base = () => world([], { factions: { ana: faction("ana"), bey: faction("bey", { military: 2000 }) } });

  it("savaş: zar havuzu, kayıplar, bölge ele geçirme", () => {
    // Saldıran 5 zar + 1 (martial 12 → +1) = 6 zar; savunan 2 + 1 + 2 = 5 zar.
    const rng = new FixedRng([6, 6, 6, 6, 5, 5, 1, 1, 1, 1, 1]);
    const r = resolveAction(base(), { type: "faction_action", actorId: "ana", action: { type: "war", actorId: "ana", targetId: "bey" } }, { rng });
    expect(r.ok).toBe(true);
    expect(r.outcome.details).toMatchObject({ attPool: 6, defPool: 5, attHits: 6, defHits: 0, defLoss: 1500, capturedRegion: "bey-r2" });
    expect(r.state.factions.bey!.military).toBe(500);
    expect(r.state.factions.ana!.atWarWith).toContain("bey");
    expect(r.state.factions.ana!.regionIds).toContain("bey-r2");
    expect(r.outcome.facts.some((f) => f.includes("SAVAŞ"))).toBe(true);
  });

  it("zaman atlama ekonomiyi deterministik ilerletir", () => {
    const r = resolveAction(base(), { type: "time_skip", actorId: "gm", days: 30, factionIds: ["ana"] }, { rng: new FixedRng([]) });
    const f = r.state.factions.ana!;
    // gelir = 100000 * 0.01 * 30 * 0.6 * 1.15 * 1.05 = 21735; gider = 5000 * 0.02 * 30 = 3000
    expect(f.treasury).toBe(10000 + 21735 - 3000);
    expect(r.state.gameTime).toBe(30 * 24 * 60);
  });

  it("hazine eksiye düşerse firar ve istikrar kaybı", () => {
    const s = world([], { factions: { ana: faction("ana", { treasury: 0, population: 0, military: 10000 }) } });
    const r = resolveAction(s, { type: "time_skip", actorId: "gm", days: 10, factionIds: ["ana"] }, { rng: new FixedRng([]) });
    expect(r.state.factions.ana!.military).toBe(0);
    expect(r.state.factions.ana!.stability).toBeLessThan(60);
  });

  it("savaştaki fraksiyonla ticaret yapılamaz", () => {
    const s = world([], { factions: { ana: faction("ana", { atWarWith: ["bey"] }), bey: faction("bey") } });
    const r = resolveAction(s, { type: "faction_action", actorId: "ana", action: { type: "trade", actorId: "ana", targetId: "bey" } }, { rng: new FixedRng([]) });
    expect(r.ok).toBe(false);
  });
});
