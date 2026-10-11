import { describe, expect, it } from "vitest";
import { SeededRng } from "@kader/dice";
import {
  buildCharacter, type CharacterInput, CLASSES, computeAc, levelUp, RACES, rollAbilityScores, setEquipped, SPELLS,
  StateWriter, validateCharacter,
} from "../src/index.ts";
import { world } from "./helpers.ts";

const base = (o: Partial<CharacterInput> = {}): CharacterInput => ({
  name: "Arda",
  raceKey: "human",
  classKey: "fighter",
  method: "standard_array",
  abilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
  skills: ["athletics", "perception"],
  ...o,
});

describe("karakter oluşturma", () => {
  it("insan savaşçı: ırk bonusu, HP, AC (zincir+kalkan+savunma stili), ekipman", () => {
    const { creature: c, inventory, walletCp } = buildCharacter(base(), "pc1", "kapi");
    expect(c.abilities).toEqual({ str: 16, dex: 14, con: 15, int: 9, wis: 13, cha: 11 });
    expect(c.maxHp).toBe(10 + 2);
    expect(c.ac).toBe(16 + 2 + 1);
    expect(c.stealthDisadvantage).toBe(true);
    expect(c.resources?.second_wind).toEqual({ current: 1, max: 1, recharge: "short" });
    expect(inventory.find((i) => i.itemKey === "longsword")?.equipped).toBe(true);
    expect(walletCp).toBe(1500);
    expect(c.spellcasting).toBeUndefined();
  });

  it("tüm ırk × sınıf kombinasyonları geçerli karakter üretir", () => {
    for (const race of Object.values(RACES)) {
      for (const cls of Object.values(CLASSES)) {
        const pool = cls.skillChoices === "any" ? ["athletics", "acrobatics", "stealth", "arcana", "history", "insight", "medicine"] : cls.skillChoices;
        const raceSkills = race.skillProficiencies ?? [];
        const pickable = pool.filter((s) => !raceSkills.includes(s as never));
        const skills = pickable.slice(0, cls.skillCount) as CharacterInput["skills"];
        if (race.chooseSkills) {
          const extra = ["survival", "nature", "religion", "performance", "investigation"].filter((s) => !skills.includes(s as never)).slice(0, race.chooseSkills);
          skills.push(...(extra as CharacterInput["skills"]));
        }
        const input = base({
          raceKey: race.key, classKey: cls.key, skills,
          ...(race.chooseAbilityBonuses ? { bonusAbilities: ["str", "con"] } : {}),
          ...(cls.key === "rogue" ? { expertise: skills.slice(0, 2) } : {}),
        });
        expect(validateCharacter(input), `${race.key}/${cls.key}`).toEqual([]);
        const { creature } = buildCharacter(input, "x", "kapi");
        expect(creature.maxHp).toBeGreaterThan(0);
        expect(creature.ac).toBeGreaterThanOrEqual(10);
        if (["wizard", "cleric", "bard", "druid", "sorcerer", "warlock"].includes(cls.key)) {
          expect(creature.spellcasting?.known.length, cls.key).toBeGreaterThan(0);
        }
      }
    }
  });

  it("geçersiz girdileri yakalar", () => {
    expect(validateCharacter(base({ abilities: { str: 15, dex: 15, con: 14, int: 8, wis: 12, cha: 10 } }))).toContain("Standart dizi 15, 14, 13, 12, 10, 8 olmalı");
    expect(validateCharacter(base({ method: "point_buy", abilities: { str: 15, dex: 15, con: 15, int: 15, wis: 8, cha: 8 } }))[0]).toMatch(/Puan/);
    expect(validateCharacter(base({ skills: ["arcana", "perception"] }))[0]).toMatch(/Savaşçı/);
    expect(validateCharacter(base({ raceKey: "half_elf" })).some((e) => e.includes("Yarı Elf"))).toBe(true);
    expect(validateCharacter(base({ classKey: "rogue", skills: ["stealth", "acrobatics", "deception", "insight"], expertise: ["arcana", "stealth"] })).some((e) => e.includes("uzmanlık"))).toBe(true);
  });

  it("zarla değerler doğrulanır", () => {
    const rolled = rollAbilityScores(new SeededRng("r"));
    expect(rolled).toHaveLength(6);
    const [a, b, c, d, e, f] = rolled as [number, number, number, number, number, number];
    const ok = base({ method: "rolled", rolledValues: rolled, abilities: { str: a, dex: b, con: c, int: d, wis: e, cha: f } });
    expect(validateCharacter(ok)).toEqual([]);
    const bad = base({ method: "rolled", rolledValues: rolled, abilities: { str: 18, dex: b, con: c, int: d, wis: e, cha: f } });
    expect(validateCharacter(bad).length > 0 || a === 18).toBe(true);
  });

  it("büyücü: büyü yuvaları ve sınıf listesi; yüksek elf ek cantrip", () => {
    const { creature } = buildCharacter(base({ raceKey: "high_elf", classKey: "wizard", skills: ["arcana", "history"],
      abilities: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 } }), "w", "kapi");
    expect(creature.spellcasting!.slots).toEqual({ 1: 2 });
    expect(creature.spellcasting!.known).toContain("magic_missile");
    expect(creature.spellcasting!.known).not.toContain("fireball");
    expect(creature.spellcasting!.known.every((k) => SPELLS[k]!.level <= 1)).toBe(true);
    expect(creature.ac).toBe(10 + 3);
  });

  it("barbar zırhsız savunma, keşiş bilgelik", () => {
    const barb = buildCharacter(base({ classKey: "barbarian", skills: ["athletics", "survival"] }), "b", "k").creature;
    expect(barb.ac).toBe(10 + 2 + 2);
    const monk = buildCharacter(base({ classKey: "monk", skills: ["acrobatics", "stealth"], abilities: { str: 10, dex: 15, con: 13, int: 8, wis: 14, cha: 12 } }), "m", "k").creature;
    expect(monk.ac).toBe(10 + 3 + 2);
    expect(monk.features.martialArtsDie).toBe(4);
  });
});

describe("ekipman", () => {
  it("kuşan/çıkar AC'yi günceller; yeterlilik yoksa reddedilir", () => {
    const built = buildCharacter(base({ classKey: "wizard", skills: ["arcana", "history"] }), "w", "k");
    const w = new StateWriter(world([built.creature], { inventories: { w: [...built.inventory, { itemKey: "plate", qty: 1 }, { itemKey: "leather", qty: 1 }] } }));
    expect(() => setEquipped(w, "w", "plate", true)).toThrow(/kullanmayı bilmiyor/);
    const f = buildCharacter(base(), "f", "k");
    const w2 = new StateWriter(world([f.creature], { inventories: { f: [...f.inventory, { itemKey: "plate", qty: 1 }] } }));
    setEquipped(w2, "f", "plate", true);
    expect(w2.creature("f").ac).toBe(18 + 2 + 1);
    expect(w2.state.inventories.f!.find((i) => i.itemKey === "chain_mail")!.equipped).toBe(false);
    setEquipped(w2, "f", "shield", false);
    expect(w2.creature("f").ac).toBe(18 + 1);
    expect(computeAc(w2.creature("f"), w2.state.inventories.f!)).toBe(19);
  });
});

describe("seviye atlama", () => {
  it("savaşçı 1→5: HP, Eylem Atılımı, kritik aralığı, ASI, ek saldırı", () => {
    const f = buildCharacter(base(), "f", "k");
    const w = new StateWriter(world([f.creature], { inventories: { f: f.inventory } }));
    const gained: string[] = [];
    for (let i = 0; i < 4; i++) gained.push(...levelUp(w, "f").gained);
    const c = w.creature("f");
    expect(c.level).toBe(5);
    expect(c.maxHp).toBe(12 + 4 * (6 + 2));
    expect(c.resources?.action_surge?.max).toBe(1);
    expect(c.features.critRange).toBe(19);
    expect(c.features.extraAttacks).toBe(1);
    expect(c.abilities.str).toBe(18);
    expect(gained).toContain("Ek Saldırı");
    expect(c.hitDiceMax[10]).toBe(5);
  });

  it("büyücü seviye atlayınca yeni yuvalar ve büyüler", () => {
    const wz = buildCharacter(base({ classKey: "wizard", skills: ["arcana", "history"] }), "w", "k");
    const w = new StateWriter(world([wz.creature], { inventories: { w: wz.inventory } }));
    levelUp(w, "w");
    levelUp(w, "w");
    levelUp(w, "w");
    levelUp(w, "w");
    const sc = w.creature("w").spellcasting!;
    expect(sc.maxSlots).toEqual({ 1: 4, 2: 3, 3: 2 });
    expect(sc.slots).toEqual({ 1: 4, 2: 3, 3: 2 });
    expect(sc.known).toContain("fireball");
  });

  it("paladin 2. seviyede büyüye başlar", () => {
    const p = buildCharacter(base({ classKey: "paladin", skills: ["athletics", "religion"] }), "p", "k");
    expect(p.creature.spellcasting).toBeUndefined();
    const w = new StateWriter(world([p.creature], { inventories: { p: p.inventory } }));
    levelUp(w, "p");
    expect(w.creature("p").spellcasting!.slots).toEqual({ 1: 2 });
    expect(w.creature("p").features.fightingStyle).toBe("dueling");
  });
});
