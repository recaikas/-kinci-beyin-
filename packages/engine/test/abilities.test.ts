import { describe, expect, it } from "vitest";
import { FixedRng, SeededRng } from "@kader/dice";
import { buildCharacter, chooseNpcAction, type CharacterInput, resolveAction, spawnMonster } from "../src/index.ts";
import { world } from "./helpers.ts";

const make = (o: Partial<CharacterInput>, id = "pc") => buildCharacter({
  name: "Kahraman", raceKey: "human", classKey: "fighter", method: "standard_array",
  abilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 }, skills: ["athletics", "perception"], ...o,
}, id, "town");

describe("sınıf yetenekleri", () => {
  it("İkinci Soluk iyileştirir ve hakkı harcar", () => {
    const f = make({});
    const s = world([{ ...f.creature, hp: 3 }], { inventories: { pc: f.inventory } });
    const r = resolveAction(s, { type: "class_ability", actorId: "pc", ability: "second_wind" }, { rng: new FixedRng([6]) });
    expect(r.state.creatures.pc!.hp).toBe(3 + 6 + 1);
    expect(r.state.creatures.pc!.resources!.second_wind!.current).toBe(0);
    const again = resolveAction(r.state, { type: "class_ability", actorId: "pc", ability: "second_wind" }, { rng: new FixedRng([6]) });
    expect(again.ok).toBe(false);
  });

  it("Öfke: hasar bonusu ve fiziksel direnç; kısa dinlenme yenilemez, uzun yeniler", () => {
    const b = make({ classKey: "barbarian", skills: ["athletics", "survival"] });
    let s = world([b.creature, spawnMonster("ogre", "ogre", { locationId: "town" })], { inventories: { pc: b.inventory } });
    s = resolveAction(s, { type: "class_ability", actorId: "pc", ability: "rage" }, { rng: new FixedRng([]) }).state;
    // saldırı 15 isabet, greataxe 1d12=6 +3 STR +2 öfke
    const hit = resolveAction(s, { type: "attack", actorId: "pc", targetId: "ogre", weaponKey: "greataxe" }, { rng: new FixedRng([15, 6]) });
    expect(hit.outcome.details.damage).toBe(6 + 3 + 2);
    const hurt = resolveAction(hit.state, { type: "faction_action", actorId: "x", action: { type: "reform", actorId: "none" } }, { rng: new FixedRng([]) });
    expect(hurt.ok).toBe(false);
    expect(hit.state.creatures.pc!.resources!.rage!.current).toBe(1);
    const rested = resolveAction(hit.state, { type: "rest", actorId: "pc", kind: "long" }, { rng: new FixedRng([]) });
    expect(rested.state.creatures.pc!.resources!.rage!.current).toBe(2);
    expect(rested.state.creatures.pc!.buffs ?? []).toEqual([]);
  });

  it("Sinsi Saldırı: avantajla ya da yanında müttefikle, turda bir kez", () => {
    const r = make({ classKey: "rogue", skills: ["stealth", "acrobatics", "deception", "insight"], expertise: ["stealth", "deception"],
      abilities: { str: 8, dex: 15, con: 14, int: 12, wis: 10, cha: 13 } });
    const s = world([r.creature, spawnMonster("ogre", "ogre", { locationId: "town" }), spawnMonster("guard", "ally", { locationId: "town" })],
      { inventories: { pc: r.inventory } });
    // müttefik muhafız yanında → sinsi saldırı 1d6
    const hit = resolveAction(s, { type: "attack", actorId: "pc", targetId: "ogre", weaponKey: "rapier" }, { rng: new FixedRng([15, 5, 4]) });
    expect(hit.outcome.facts.some((f) => f.includes("Sinsi Saldırı +4"))).toBe(true);
    expect(hit.outcome.details.damage).toBe(5 + 3 + 4);
  });

  it("Kutsal Darbe yuva harcar ve 2d8 ekler", () => {
    const p = make({ classKey: "paladin", skills: ["athletics", "religion"] });
    const s0 = world([{ ...p.creature, level: 2, spellcasting: { ability: "cha", slots: { 1: 2 }, maxSlots: { 1: 2 }, known: [], concentratingOn: null } },
      spawnMonster("ogre", "ogre", { locationId: "town" })], { inventories: { pc: p.inventory } });
    const r = resolveAction(s0, { type: "attack", actorId: "pc", targetId: "ogre", weaponKey: "longsword", smiteSlot: 1 }, { rng: new FixedRng([15, 5, 3, 4]) });
    expect(r.ok, r.error).toBe(true);
    expect(r.state.creatures.pc!.spellcasting!.slots[1]).toBe(1);
    expect(r.outcome.details.damage).toBe(5 + 3 + 3 + 4);
  });

  it("Ozan İlhamı sonraki saldırıda tükenir", () => {
    const bard = make({ classKey: "bard", skills: ["persuasion", "performance", "insight"], abilities: { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 } });
    const fighter = make({}, "f");
    let s = world([bard.creature, fighter.creature, spawnMonster("ogre", "ogre", { locationId: "town" })], { inventories: { pc: bard.inventory, f: fighter.inventory } });
    s = resolveAction(s, { type: "class_ability", actorId: "pc", ability: "bardic_inspiration", targetId: "f" }, { rng: new FixedRng([]) }).state;
    expect(s.creatures.f!.buffs!.length).toBe(1);
    const a = resolveAction(s, { type: "attack", actorId: "f", targetId: "ogre", weaponKey: "longsword" }, { rng: new FixedRng([5, 6, 2]) });
    expect(a.rolls[0]!.breakdown).toContain("1d6");
    expect(a.state.creatures.f!.buffs ?? []).toEqual([]);
  });
});

describe("canavar özellikleri", () => {
  it("boz ayı iki farklı saldırı yapar", () => {
    const f = make({});
    const s = world([f.creature, spawnMonster("brown_bear", "bear", { locationId: "town" })], { inventories: { pc: f.inventory } });
    const action = chooseNpcAction(s, "bear")!;
    const r = resolveAction(s, action, { rng: new FixedRng([15, 4, 15, 3, 3]) });
    expect(r.outcome.details.attacks).toBe(2);
    expect(r.outcome.facts.some((x) => x.includes("Pençeler"))).toBe(true);
  });

  it("kurt ısırığı başarısız STR kurtarmasında yere düşürür", () => {
    const f = make({});
    const s = world([f.creature, spawnMonster("wolf", "wolf", { locationId: "town" })], { inventories: { pc: f.inventory } });
    const r = resolveAction(s, { type: "attack", actorId: "wolf", targetId: "pc", weaponKey: "wolf_bite" }, { rng: new FixedRng([19, 2, 2, 1]) });
    expect(r.state.creatures.pc!.conditions).toContain("prone");
  });

  it("gul felci her tur sonunda tekrar kurtarmayla kalkar", () => {
    const f = make({});
    let s = world([f.creature, spawnMonster("ghoul", "ghoul", { locationId: "town" })], { inventories: { pc: f.inventory } });
    s = resolveAction(s, { type: "start_combat", actorId: "pc", participantIds: ["ghoul"] }, { rng: new FixedRng([20, 1, 1, 1]) }).state;
    s = resolveAction(s, { type: "end_turn", actorId: "pc" }, { rng: new FixedRng([]) }).state;
    const bite = resolveAction(s, { type: "attack", actorId: "ghoul", targetId: "pc", weaponKey: "ghoul_claws" }, { rng: new FixedRng([19, 2, 2, 1]) });
    expect(bite.state.creatures.pc!.conditions).toContain("paralyzed");
    s = resolveAction(bite.state, { type: "end_turn", actorId: "ghoul" }, { rng: new FixedRng([]) }).state;
    const free = resolveAction(s, { type: "end_turn", actorId: "pc" }, { rng: new FixedRng([15]) });
    expect(free.state.creatures.pc!.conditions).not.toContain("paralyzed");
  });

  it("tarikat fanatiği kontrol büyüsü yapar", () => {
    const f = make({});
    const s = world([f.creature, spawnMonster("cult_fanatic", "cf", { locationId: "town" })], { inventories: { pc: f.inventory }, relationships: { "cf|pc": -60 } });
    expect(chooseNpcAction(s, "cf")).toMatchObject({ type: "cast_spell", spellKey: "hold_person" });
  });
});

describe("XP ve seviye", () => {
  it("ogre öldürmek 450 XP verir ve savaşçıyı 2. seviyeye çıkarır", () => {
    const f = make({});
    const s = world([f.creature, spawnMonster("ogre", "ogre", { locationId: "town", hp: 1 })], { inventories: { pc: f.inventory } });
    const r = resolveAction(s, { type: "attack", actorId: "pc", targetId: "ogre", weaponKey: "longsword" }, { rng: new FixedRng([15, 5]) });
    expect(r.state.creatures.pc!.xp).toBe(450);
    expect(r.state.creatures.pc!.level).toBe(2);
    expect(r.state.creatures.pc!.resources!.action_surge).toBeDefined();
    expect(r.outcome.facts.some((x) => x.includes("SEVİYEYE YÜKSELDİ"))).toBe(true);
  });

  it("ganimet: ceset bir kez aranır", () => {
    const f = make({});
    const s = world([f.creature, spawnMonster("bandit_captain", "cap", { locationId: "town", isAlive: false, hp: 0 })], { inventories: { pc: f.inventory } });
    const r = resolveAction(s, { type: "loot", actorId: "pc", targetId: "cap" }, { rng: new SeededRng("loot") });
    expect(r.ok, r.error).toBe(true);
    expect(r.state.inventories.pc!.some((i) => i.itemKey === "bandit_map")).toBe(true);
    expect((r.state.wallets.pc ?? 0)).toBeGreaterThan(0);
    expect(resolveAction(r.state, { type: "loot", actorId: "pc", targetId: "cap" }, { rng: new SeededRng("x") }).ok).toBe(false);
  });

  it("parşömen yuva harcamadan büyü yapar", () => {
    const f = make({});
    const s = world([{ ...f.creature, hp: 2 }], { inventories: { pc: [...f.inventory, { itemKey: "scroll_cure_wounds", qty: 1 }] } });
    const r = resolveAction(s, { type: "use_item", actorId: "pc", itemKey: "scroll_cure_wounds" }, { rng: new FixedRng([5]) });
    expect(r.ok, r.error).toBe(true);
    expect(r.state.creatures.pc!.hp).toBe(2 + 5 - 1);
  });
});
