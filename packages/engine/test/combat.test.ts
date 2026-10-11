import { describe, expect, it } from "vitest";
import { FixedRng } from "@kader/dice";
import {
  applyDamage, attack, castSpell, deathSave, doubleDice, EngineContext, heal, maxPlusRoll, nextTurn,
  RAW_RULES, slotsFor, spawnMonster, SPELLS, spellSaveDC, startEncounter, StateWriter, weaponProfile,
  WEAPONS,
} from "../src/index.ts";
import { pc, world } from "./helpers.ts";

describe("saldırı", () => {
  it("silah profili: finesse en yüksek modu kullanır", () => {
    const p = weaponProfile(pc("a", { abilities: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 } }), WEAPONS.rapier!);
    expect(p.attackBonus).toBe(3 + 2);
    expect(p.damage).toBe("1d8+3");
  });

  it("isabet, hasar ve 0 HP'de canavar ölür", () => {
    const w = new StateWriter(world([pc("arda"), spawnMonster("goblin", "gob")]));
    const ctx = new EngineContext(new FixedRng([15, 8]));
    const r = attack(ctx, w, "arda", "gob", weaponProfile(w.creature("arda"), WEAPONS.longsword!));
    expect(r.hit).toBe(true);
    expect(r.damage!.final).toBe(10);
    expect(w.creature("gob").isAlive).toBe(false);
    expect(w.effects.some((e) => e.op === "event" && e.type === "creature.died")).toBe(true);
  });

  it("doğal 1 her zaman ıska, doğal 20 kritik", () => {
    const w = new StateWriter(world([pc("arda"), spawnMonster("ogre", "ogre")]));
    const miss = attack(new EngineContext(new FixedRng([1])), w, "arda", "ogre", { name: "x", attackBonus: 50, damage: "1d8", damageType: "slashing", ranged: false });
    expect(miss.hit).toBe(false);
    const crit = attack(new EngineContext(new FixedRng([20, 5, 6])), w, "arda", "ogre", { name: "x", attackBonus: -50, damage: "1d8+2", damageType: "slashing", ranged: false });
    expect(crit.crit).toBe(true);
    expect(crit.damage!.final).toBe(5 + 6 + 2);
  });

  it("felçli hedefe yakın isabet kritik olur ve avantajlıdır", () => {
    const w = new StateWriter(world([pc("arda"), spawnMonster("ogre", "ogre", { conditions: ["paralyzed"] })]));
    const r = attack(new EngineContext(new FixedRng([3, 12, 1, 1])), w, "arda", "ogre", weaponProfile(w.creature("arda"), WEAPONS.mace!));
    expect(r.roll.mode).toBe("advantage");
    expect(r.crit).toBe(true);
  });

  it("siper AC'yi artırır; uzun menzil dezavantaj", () => {
    const w = new StateWriter(world([pc("arda"), spawnMonster("goblin", "gob")]));
    const r = attack(new EngineContext(new FixedRng([14, 10])), w, "arda", "gob", weaponProfile(w.creature("arda"), WEAPONS.longbow!), { cover: "half", distance: 200 });
    expect(r.targetAc).toBe(17);
    expect(r.roll.mode).toBe("disadvantage");
    expect(r.disadvantageSources).toContain("uzun menzil");
  });

  it("kritik notasyonları", () => {
    expect(doubleDice("2d6+3")).toBe("4d6+3");
    expect(doubleDice("d8+1d4")).toBe("2d8+2d4");
    expect(maxPlusRoll("2d6+3")).toBe("2d6+12+3");
  });
});

describe("hasar ve ölüm", () => {
  it("direnç, zafiyet, bağışıklık", () => {
    const w = new StateWriter(world([spawnMonster("skeleton", "sk")]));
    const ctx = new EngineContext(new FixedRng([]));
    expect(applyDamage(ctx, w, "sk", 5, "poison").final).toBe(0);
    expect(applyDamage(ctx, w, "sk", 5, "bludgeoning").final).toBe(10);
  });

  it("geçici HP önce emilir", () => {
    const w = new StateWriter(world([pc("arda", { tempHp: 5 })]));
    const r = applyDamage(new EngineContext(new FixedRng([])), w, "arda", 8, "fire");
    expect(r.tempAbsorbed).toBe(5);
    expect(w.creature("arda").hp).toBe(9);
    expect(w.creature("arda").tempHp).toBe(0);
  });

  it("oyuncu 0 HP'de bilinçsiz kalır, taşan hasar maks HP'ye ulaşırsa anlık ölüm", () => {
    const w = new StateWriter(world([pc("arda"), pc("berk")]));
    const ctx = new EngineContext(new FixedRng([]));
    const down = applyDamage(ctx, w, "arda", 15, "slashing");
    expect(down.droppedToZero).toBe(true);
    expect(w.creature("arda").conditions).toContain("unconscious");
    expect(w.creature("arda").isAlive).toBe(true);
    const dead = applyDamage(ctx, w, "berk", 24, "slashing");
    expect(dead.instantDeath).toBe(true);
    expect(w.creature("berk").isAlive).toBe(false);
  });

  it("ölüm kurtarma atışları: 3 başarı → stabil, doğal 20 → 1 HP", () => {
    const w = new StateWriter(world([pc("arda", { hp: 0, conditions: ["unconscious"] }), pc("berk", { hp: 0, conditions: ["unconscious"] })]));
    const ctx = new EngineContext(new FixedRng([12, 15, 10, 20]));
    deathSave(ctx, w, "arda");
    deathSave(ctx, w, "arda");
    expect(deathSave(ctx, w, "arda").outcome).toBe("stable");
    expect(deathSave(ctx, w, "berk").outcome).toBe("revived");
    expect(w.creature("berk").hp).toBe(1);
    expect(w.creature("berk").conditions).not.toContain("unconscious");
  });

  it("0 HP'de hasar başarısızlık ekler; kritikte iki", () => {
    const w = new StateWriter(world([pc("arda", { hp: 0, conditions: ["unconscious"] })]));
    const ctx = new EngineContext(new FixedRng([]));
    applyDamage(ctx, w, "arda", 2, "piercing", { crit: true });
    expect(w.creature("arda").deathSaves.failures).toBe(2);
    applyDamage(ctx, w, "arda", 2, "piercing");
    expect(w.creature("arda").isAlive).toBe(false);
  });

  it("iyileşme bilinci geri getirir ve maks HP'yi aşmaz", () => {
    const w = new StateWriter(world([pc("arda", { hp: 0, conditions: ["unconscious"] })]));
    expect(heal(w, "arda", 100)).toBe(12);
    expect(w.creature("arda").conditions).not.toContain("unconscious");
  });

  it("konsantrasyon kurtarması başarısızsa büyü düşer", () => {
    const caster = pc("mage", {
      spellcasting: { ability: "int", slots: {}, maxSlots: {}, known: [], concentratingOn: "hold_person" },
      saveProficiencies: [],
    });
    const w = new StateWriter(world([caster]));
    const r = applyDamage(new EngineContext(new FixedRng([3])), w, "mage", 6, "fire");
    expect(r.concentration!.dc).toBe(10);
    expect(w.creature("mage").spellcasting!.concentratingOn).toBeNull();
  });
});

describe("inisiyatif ve tur", () => {
  it("sıralama ve tur ilerletme, ölüler atlanır", () => {
    const w = new StateWriter(world([pc("a"), pc("b"), pc("c", { isAlive: false })]));
    const ctx = new EngineContext(new FixedRng([5, 500, 18, 500]));
    const enc = startEncounter(ctx, w, ["a", "b", "c"], "enc1");
    expect(enc.order.map((o) => o.id)).toEqual(["b", "a"]);
    expect(nextTurn(w)).toBe("a");
    expect(nextTurn(w)).toBe("b");
    expect(w.state.encounter!.round).toBe(2);
  });
});

describe("büyü", () => {
  it("yuva tabloları", () => {
    expect(slotsFor("full", 5)).toEqual({ 1: 4, 2: 3, 3: 2 });
    expect(slotsFor("half", 1)).toEqual({});
    expect(slotsFor("pact", 5)).toEqual({ 3: 2 });
  });

  const wizard = () => pc("mage", {
    level: 5,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
    spellcasting: { ability: "int", slots: { 1: 4, 2: 3, 3: 2 }, maxSlots: { 1: 4, 2: 3, 3: 2 }, known: ["fire_bolt", "fireball", "magic_missile", "hold_person"], concentratingOn: null },
  });

  it("büyü DC'si", () => {
    expect(spellSaveDC(wizard(), "int")).toBe(8 + 3 + 4);
  });

  it("Ateş Topu: tek hasar atışı, kurtarana yarı, yuva harcanır", () => {
    const w = new StateWriter(world([wizard(), spawnMonster("ogre", "o1"), spawnMonster("ogre", "o2")]));
    const ctx = new EngineContext(new FixedRng([6, 6, 6, 6, 6, 6, 6, 6, 2, 20]), RAW_RULES);
    const r = castSpell(ctx, w, { casterId: "mage", spell: SPELLS.fireball!, slotLevel: 3, targetIds: ["o1", "o2"] });
    expect(r.targets[0]!.damage!.final).toBe(48);
    expect(r.targets[1]!.damage!.final).toBe(24);
    expect(w.creature("mage").spellcasting!.slots[3]).toBe(1);
  });

  it("cantrip 5. seviyede 2 zar", () => {
    const w = new StateWriter(world([wizard(), spawnMonster("ogre", "o1")]));
    const r = castSpell(new EngineContext(new FixedRng([15, 4, 7])), w, { casterId: "mage", spell: SPELLS.fire_bolt!, slotLevel: 0, targetIds: ["o1"] });
    expect(r.targets[0]!.damage!.final).toBe(11);
  });

  it("Büyülü Füze üst yuvada +1 ok", () => {
    const w = new StateWriter(world([wizard(), spawnMonster("ogre", "o1")]));
    const r = castSpell(new EngineContext(new FixedRng([1, 1, 1, 1])), w, { casterId: "mage", spell: SPELLS.magic_missile!, slotLevel: 2, targetIds: ["o1"] });
    expect(r.targets).toHaveLength(4);
    expect(w.creature("o1").hp).toBe(59 - 8);
  });

  it("Kişiyi Tut: başarısız kurtarmada felç ve konsantrasyon", () => {
    const w = new StateWriter(world([wizard(), spawnMonster("bandit", "b1")]));
    castSpell(new EngineContext(new FixedRng([2])), w, { casterId: "mage", spell: SPELLS.hold_person!, slotLevel: 2, targetIds: ["b1"] });
    expect(w.creature("b1").conditions).toContain("paralyzed");
    expect(w.creature("mage").spellcasting!.concentratingOn).toBe("hold_person");
  });

  it("bilinmeyen büyü / yuva yoksa hata", () => {
    const w = new StateWriter(world([wizard(), spawnMonster("ogre", "o1")]));
    expect(() => castSpell(new EngineContext(new FixedRng([])), w, { casterId: "mage", spell: SPELLS.cure_wounds!, slotLevel: 1, targetIds: ["o1"] })).toThrow();
    expect(() => castSpell(new EngineContext(new FixedRng([])), w, { casterId: "mage", spell: SPELLS.fireball!, slotLevel: 4, targetIds: ["o1"] })).toThrow();
  });
});

import { chooseNpcAction, combatAutopilot, isHostile, resolveAction } from "../src/index.ts";
import { SeededRng } from "@kader/dice";

describe("NPC taktik AI ve savaş otopilotu", () => {
  it("canavar varsayılan düşman; NPC ilişkiye bağlı", () => {
    const s = world([pc("arda"), spawnMonster("goblin", "gob"), spawnMonster("guard", "kerem")]);
    expect(isHostile(s, s.creatures.gob!, s.creatures.arda!)).toBe(true);
    expect(isHostile(s, s.creatures.kerem!, s.creatures.arda!)).toBe(false);
    s.relationships["arda|kerem"] = -40;
    expect(isHostile(s, s.creatures.kerem!, s.creatures.arda!)).toBe(true);
  });

  it("en zayıf ayakta hedefi yakın dövüş silahıyla seçer", () => {
    const s = world([pc("arda", { hp: 3 }), pc("berk"), spawnMonster("goblin", "gob", { locationId: "town" })]);
    expect(chooseNpcAction(s, "gob")).toMatchObject({ type: "attack", targetId: "arda", weaponKey: "scimitar" });
  });

  it("oyuncu eyleminden sonra NPC'ler oynar ve sıra oyuncuya döner", () => {
    let s = world([pc("arda"), spawnMonster("goblin", "gob", { locationId: "town" })], { inventories: { arda: [{ itemKey: "longsword", qty: 1 }] } });
    // arda inisiyatif 20 (ilk), goblin 2
    const start = resolveAction(s, { type: "start_combat", actorId: "arda", participantIds: ["gob"] }, { rng: new FixedRng([20, 1, 2, 1]) });
    s = start.state;
    const hit = resolveAction(s, { type: "attack", actorId: "arda", targetId: "gob", weaponKey: "longsword" }, { rng: new FixedRng([2]) });
    expect(hit.outcome.details.hit).toBe(false);
    // goblin saldırısı: d20=15 → isabet, 1d6+2 = 4+2
    const auto = combatAutopilot(hit.state, "arda", { rng: new FixedRng([15, 4]) });
    expect(auto.steps.map((x) => x.action.type)).toEqual(["end_turn", "attack", "end_turn"]);
    expect(auto.state.creatures.arda!.hp).toBe(12 - 6);
    const enc = auto.state.encounter!;
    expect(enc.order[enc.turnIndex]!.id).toBe("arda");
    expect(enc.round).toBe(2);
  });

  it("son düşman ölünce savaş kendiliğinden biter", () => {
    let s = world([pc("arda"), spawnMonster("goblin", "gob", { locationId: "town" })], { inventories: { arda: [{ itemKey: "longsword", qty: 1 }] } });
    s = resolveAction(s, { type: "start_combat", actorId: "arda", participantIds: ["gob"] }, { rng: new FixedRng([20, 1, 2, 1]) }).state;
    const kill = resolveAction(s, { type: "attack", actorId: "arda", targetId: "gob", weaponKey: "longsword" }, { rng: new FixedRng([18, 8]) });
    const auto = combatAutopilot(kill.state, "arda", { rng: new FixedRng([]) });
    expect(auto.state.encounter).toBeNull();
    expect(auto.steps.at(-1)!.action.type).toBe("end_combat");
  });

  it("uzun bir savaş simülasyonu tutarlı biter (özellik testi)", () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = new SeededRng(`sim-${seed}`);
      let s = world([pc("arda", { hp: 30, maxHp: 30 }), spawnMonster("goblin", "g1", { locationId: "town" }), spawnMonster("goblin", "g2", { locationId: "town" })], {
        inventories: { arda: [{ itemKey: "longsword", qty: 1 }] },
      });
      s = resolveAction(s, { type: "start_combat", actorId: "arda", participantIds: ["g1", "g2"] }, { rng }).state;
      s = combatAutopilot(s, "arda", { rng }).state;
      for (let i = 0; i < 100 && s.encounter; i++) {
        const target = ["g1", "g2"].find((id) => s.creatures[id]!.isAlive);
        const me = s.creatures.arda!;
        const action = me.hp > 0 && target
          ? { type: "attack" as const, actorId: "arda", targetId: target, weaponKey: "longsword" }
          : { type: "end_turn" as const, actorId: "arda" };
        const r = resolveAction(s, action, { rng });
        expect(r.ok, r.error).toBe(true);
        s = combatAutopilot(r.state, "arda", { rng }).state;
        for (const c of Object.values(s.creatures)) {
          expect(c.hp).toBeGreaterThanOrEqual(0);
          expect(c.hp).toBeLessThanOrEqual(c.maxHp);
        }
      }
      expect(s.encounter).toBeNull();
    }
  });
});
