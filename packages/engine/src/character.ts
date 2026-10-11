/**
 * Karakter oluşturma, ekipman/AC ve seviye atlama.
 */
import { type Rng, roll } from "@kader/dice";
import {
  ABILITIES, type Ability, type AbilityScores, abilityModifier, isValidPointBuy, SKILL_LIST, type Skill, STANDARD_ARRAY,
} from "./core.ts";
import { slotsFor } from "./spells.ts";
import { StateError, type StateWriter } from "./state.ts";
import type { Creature, InventoryEntry, Resource } from "./types.ts";
import { ARMOR } from "./srd/equipment.ts";
import { CLASSES, classFeaturesAt, isAsiLevel } from "./srd/classes.ts";
import { RACES } from "./srd/races.ts";
import { spellsForClass } from "./srd/spells.ts";
import { ITEMS } from "./srd/items.ts";

/* ------------------------------------------------------------------ */
/* AC ve ekipman                                                       */
/* ------------------------------------------------------------------ */

/** Kuşanılmış zırh/kalkan ve sınıf özelliklerinden AC. Canavarlar sabit AC kullanır. */
export function computeAc(c: Creature, inventory: InventoryEntry[]): number {
  const dex = abilityModifier(c.abilities.dex);
  const equipped = inventory.filter((i) => i.equipped && ARMOR[i.itemKey]);
  const body = equipped.map((i) => ARMOR[i.itemKey]!).find((a) => a.category !== "shield");
  const shield = equipped.some((i) => ARMOR[i.itemKey]!.category === "shield");
  let ac: number;
  if (body) {
    const capped = body.dexCap === null ? dex : Math.min(dex, body.dexCap);
    ac = body.ac + capped;
    if (c.features.fightingStyle === "defense") ac += 1;
  } else if (c.features.unarmoredDefense === "con") {
    ac = 10 + dex + abilityModifier(c.abilities.con);
  } else if (c.features.unarmoredDefense === "wis" && !shield) {
    ac = 10 + dex + abilityModifier(c.abilities.wis);
  } else {
    ac = 10 + dex;
  }
  if (shield) ac += 2;
  return ac;
}

export function canWearArmor(c: Creature, armorKey: string): boolean {
  const a = ARMOR[armorKey];
  if (!a) return false;
  const p = c.armorProficiencies;
  return !p || p.includes(a.category);
}

/** Kuşan / çıkar; AC ve gizlilik dezavantajı yeniden hesaplanır. */
export function setEquipped(w: StateWriter, ownerId: string, itemKey: string, equipped: boolean): void {
  const c = w.creature(ownerId);
  const inv = w.state.inventories[ownerId] ?? [];
  const entry = inv.find((i) => i.itemKey === itemKey);
  if (!entry) throw new StateError(`${c.name} envanterinde ${ITEMS[itemKey]?.name ?? itemKey} yok`);
  const armor = ARMOR[itemKey];
  if (equipped && armor && !canWearArmor(c, itemKey)) {
    throw new StateError(`${c.name} ${armor.name} kullanmayı bilmiyor`);
  }
  const next = inv.map((i) => {
    if (i.itemKey === itemKey) return { ...i, equipped };
    // Aynı türden ikinci gövde zırhı/kalkan çıkarılır.
    if (equipped && armor && i.equipped && ARMOR[i.itemKey]) {
      const other = ARMOR[i.itemKey]!;
      if ((other.category === "shield") === (armor.category === "shield")) return { ...i, equipped: false };
    }
    return i;
  });
  w.state.inventories[ownerId] = next;
  w.effects.push({ op: "inventory.equip", ownerId, itemKey, equipped });
  refreshDerived(w, ownerId);
}

/** Envantere bağlı türetilmiş alanları güncelle (AC, gizlilik dezavantajı, hız). */
export function refreshDerived(w: StateWriter, id: string): void {
  const c = w.creature(id);
  if (c.kind !== "pc") return;
  const inv = w.state.inventories[id] ?? [];
  const body = inv.filter((i) => i.equipped).map((i) => ARMOR[i.itemKey]).find((a) => a && a.category !== "shield");
  const race = c.raceKey ? RACES[c.raceKey] : undefined;
  const baseSpeed = race?.speed ?? 30;
  const heavyPenalty = body?.strRequirement && c.abilities.str < body.strRequirement ? 10 : 0;
  w.updateCreature(id, {
    ac: computeAc(c, inv),
    stealthDisadvantage: !!body?.stealthDisadvantage,
    speed: baseSpeed - heavyPenalty,
  });
}

/* ------------------------------------------------------------------ */
/* Karakter oluşturma                                                  */
/* ------------------------------------------------------------------ */

export type AbilityMethod = "standard_array" | "point_buy" | "rolled";

export interface CharacterInput {
  name: string;
  raceKey: string;
  classKey: string;
  method: AbilityMethod;
  /** Irk bonuslarından ÖNCEKİ değerler. "rolled" yönteminde atılan değerler bu sıraya dağıtılmış olmalı. */
  abilities: AbilityScores;
  /** Yarı-elf: +1 alacak iki yetenek. */
  bonusAbilities?: Ability[];
  skills: Skill[];
  /** Düzenbaz: uzmanlık seçilen 2 beceri. */
  expertise?: Skill[];
  background?: string;
  /** "rolled" yönteminde sunucunun attığı değerler (doğrulama için). */
  rolledValues?: number[];
}

export interface BuiltCharacter {
  creature: Creature;
  inventory: InventoryEntry[];
  walletCp: number;
}

export class CharacterError extends Error {
  constructor(readonly errors: string[]) {
    super(errors.join("; "));
    this.name = "CharacterError";
  }
}

/** Zarla yetenek değerleri: 6 kez 4d6, en düşüğü at. */
export function rollAbilityScores(rng: Rng): number[] {
  return Array.from({ length: 6 }, () => roll("4d6kh3", rng).total);
}

export function validateCharacter(input: CharacterInput): string[] {
  const errors: string[] = [];
  const race = RACES[input.raceKey];
  const cls = CLASSES[input.classKey];
  if (!input.name.trim() || input.name.length > 40) errors.push("İsim 1–40 karakter olmalı");
  if (!race) errors.push("Geçersiz ırk");
  if (!cls) errors.push("Geçersiz sınıf");
  const values = ABILITIES.map((a) => input.abilities[a]);
  if (values.some((v) => !Number.isInteger(v) || v < 3 || v > 18)) errors.push("Yetenek değerleri 3–18 olmalı");
  if (input.method === "standard_array") {
    const sorted = [...values].sort((a, b) => b - a);
    if (sorted.join() !== [...STANDARD_ARRAY].join()) errors.push("Standart dizi 15, 14, 13, 12, 10, 8 olmalı");
  } else if (input.method === "point_buy") {
    if (!isValidPointBuy(input.abilities)) errors.push("Puan alımı 27 puanı aşıyor ya da 8–15 dışında");
  } else if (input.method === "rolled") {
    const rolled = [...(input.rolledValues ?? [])].sort((a, b) => b - a).join();
    if (rolled !== [...values].sort((a, b) => b - a).join()) errors.push("Dağıtılan değerler atılan zarlarla eşleşmiyor");
  }
  if (race?.chooseAbilityBonuses) {
    const b = input.bonusAbilities ?? [];
    if (b.length !== race.chooseAbilityBonuses || new Set(b).size !== b.length || b.includes("cha")) {
      errors.push(`${race.name}: Karizma dışında ${race.chooseAbilityBonuses} farklı yetenek seç`);
    }
  }
  if (cls) {
    const raceSkills = race?.skillProficiencies ?? [];
    const allowed = cls.skillChoices === "any" ? SKILL_LIST : cls.skillChoices;
    const extra = race?.chooseSkills ?? 0;
    const chosen = input.skills.filter((s) => !raceSkills.includes(s));
    if (new Set(input.skills).size !== input.skills.length) errors.push("Aynı beceri iki kez seçilemez");
    const fromClass = chosen.filter((s) => allowed.includes(s));
    const fromOther = chosen.filter((s) => !allowed.includes(s));
    if (fromClass.length + Math.min(fromOther.length, extra) < chosen.length || chosen.length !== cls.skillCount + extra) {
      errors.push(`${cls.name}: ${cls.skillCount} sınıf becerisi${extra ? ` + ${extra} serbest beceri` : ""} seçilmeli`);
    }
    if (cls.key === "rogue") {
      const ex = input.expertise ?? [];
      const prof = [...input.skills, ...raceSkills];
      if (ex.length !== 2 || ex.some((s) => !prof.includes(s))) errors.push("Düzenbaz: yeterli olduğun 2 beceride uzmanlık seç");
    }
  }
  return errors;
}

/** Doğrulanmış girdiden 1. seviye karakter kur. */
export function buildCharacter(input: CharacterInput, id: string, locationId: string): BuiltCharacter {
  const errors = validateCharacter(input);
  if (errors.length) throw new CharacterError(errors);
  const race = RACES[input.raceKey]!;
  const cls = CLASSES[input.classKey]!;

  const abilities = { ...input.abilities };
  for (const [a, v] of Object.entries(race.abilityBonuses)) abilities[a as Ability] += v!;
  for (const a of input.bonusAbilities ?? []) abilities[a] += 1;

  const con = abilityModifier(abilities.con);
  const level = 1;
  const lf = classFeaturesAt(cls.key, level, abilityModifier(abilities.cha));
  const features = { ...(race.features ?? {}), ...lf.features };
  const maxHp = cls.hitDie + con + (features.hpPerLevelBonus ?? 0);
  const resources: Record<string, Resource> = {};
  for (const [k, v] of Object.entries({ ...(race.resources ?? {}), ...lf.resources })) resources[k] = { current: v.max, max: v.max, recharge: v.recharge };

  const creature: Creature = {
    id,
    name: input.name.trim(),
    kind: "pc",
    level,
    size: race.size,
    abilities,
    saveProficiencies: [...cls.saves],
    skillProficiencies: Array.from(new Set([...(race.skillProficiencies ?? []), ...input.skills])),
    expertise: cls.key === "rogue" ? [...(input.expertise ?? [])] : [],
    hp: Math.max(1, maxHp),
    maxHp: Math.max(1, maxHp),
    tempHp: 0,
    ac: 10,
    speed: race.speed,
    conditions: [],
    exhaustion: 0,
    resistances: [...(race.resistances ?? [])],
    immunities: [],
    vulnerabilities: [],
    conditionImmunities: [],
    deathSaves: { successes: 0, failures: 0, stable: false },
    hitDice: { [cls.hitDie]: 1 },
    hitDiceMax: { [cls.hitDie]: 1 },
    inspiration: false,
    features,
    xp: 0,
    isAlive: true,
    locationId,
    raceKey: race.key,
    classKey: cls.key,
    weaponProficiencies: Array.from(new Set([...cls.weapons, ...(race.weaponProficiencies ?? [])])),
    armorProficiencies: [...cls.armor],
    resources,
    languages: race.languages,
    ...(race.darkvision ? { darkvision: race.darkvision } : {}),
    ...(input.background ? { background: input.background } : {}),
  };
  applySpellcasting(creature);

  const inventory: InventoryEntry[] = [];
  const add = (key: string, qty: number, equipped = false) => {
    const e = inventory.find((i) => i.itemKey === key);
    if (e) e.qty += qty;
    else inventory.push({ itemKey: key, qty, ...(equipped ? { equipped: true } : {}) });
  };
  for (const [key, qty, eq] of cls.equipment) add(key, qty, !!eq);
  add("potion_of_healing", 1);
  add("rations", 5);
  add("torch", 3);
  add("waterskin", 1);
  add("bedroll", 1);
  creature.ac = computeAc(creature, inventory);
  const body = inventory.filter((i) => i.equipped).map((i) => ARMOR[i.itemKey]).find((a) => a && a.category !== "shield");
  if (body?.stealthDisadvantage) creature.stealthDisadvantage = true;
  if (body?.strRequirement && abilities.str < body.strRequirement) creature.speed -= 10;

  return { creature, inventory, walletCp: 1500 };
}

/** Sınıf ve seviyeye göre büyü yuvalarını ve bilinen büyüleri ayarla. */
function applySpellcasting(c: Creature): void {
  const cls = c.classKey ? CLASSES[c.classKey] : undefined;
  if (!cls || cls.caster === "none" || !cls.spellAbility) return;
  if (c.level < (cls.spellsFrom ?? 1)) return;
  const slots = slotsFor(cls.caster, c.level);
  const maxSpellLevel = Math.max(0, ...Object.keys(slots).map(Number));
  const known = spellsForClass(cls.key, maxSpellLevel).map((s) => s.key);
  const race = c.raceKey ? RACES[c.raceKey] : undefined;
  if (race?.bonusCantrip && !known.includes(race.bonusCantrip)) known.push(race.bonusCantrip);
  const prev = c.spellcasting;
  c.spellcasting = {
    ability: cls.spellAbility,
    slots: prev ? { ...slots, ...Object.fromEntries(Object.entries(prev.slots).filter(([k]) => slots[Number(k)] !== undefined).map(([k, v]) => [k, Math.min(v ?? 0, slots[Number(k)]!)])) } : slots,
    maxSlots: slots,
    known,
    concentratingOn: prev?.concentratingOn ?? null,
  };
  // Yeni seviye ile gelen yuvalar dolu gelir.
  for (const [k, max] of Object.entries(slots)) {
    const prevMax = prev?.maxSlots[Number(k)] ?? 0;
    const cur = c.spellcasting.slots[Number(k)] ?? 0;
    c.spellcasting.slots[Number(k)] = Math.min(max ?? 0, cur + Math.max(0, (max ?? 0) - prevMax));
  }
}

/* ------------------------------------------------------------------ */
/* Seviye atlama                                                       */
/* ------------------------------------------------------------------ */

export interface LevelUpResult {
  from: number;
  to: number;
  hpGain: number;
  gained: string[];
  asi?: Ability[];
}

/**
 * Bir seviye atla: ortalama HP (hit die/2 + 1 + CON), sınıf özellikleri, yuvalar,
 * kaynaklar; ASI seviyesinde birincil yeteneğe +2 (ya da seçilenlere).
 */
export function levelUp(w: StateWriter, id: string, asiChoice?: Ability[]): LevelUpResult {
  const c = structuredClone(w.creature(id));
  const cls = c.classKey ? CLASSES[c.classKey] : undefined;
  if (!cls) throw new StateError(`${c.name} sınıfsız; seviye atlayamaz`);
  if (c.level >= 20) throw new StateError("Azami seviye 20");
  const from = c.level;
  c.level += 1;
  const gainedNames: string[] = [];
  let asi: Ability[] | undefined;
  if (isAsiLevel(cls.key, c.level)) {
    asi = asiChoice && asiChoice.length ? asiChoice.slice(0, 2) : [cls.primary, cls.primary];
    for (const a of asi) c.abilities[a] = Math.min(20, c.abilities[a] + 1);
    gainedNames.push("Yetenek Puanı Artışı");
  }
  const con = abilityModifier(c.abilities.con);
  const lf = classFeaturesAt(cls.key, c.level, abilityModifier(c.abilities.cha));
  const raceFeatures = c.raceKey ? RACES[c.raceKey]?.features ?? {} : {};
  c.features = { ...c.features, ...raceFeatures, ...lf.features };
  const hpGain = Math.max(1, Math.floor(cls.hitDie / 2) + 1 + con + (c.features.hpPerLevelBonus ?? 0));
  c.maxHp += hpGain;
  c.hp = Math.min(c.maxHp, c.hp + hpGain);
  c.hitDiceMax = { ...c.hitDiceMax, [cls.hitDie]: (c.hitDiceMax[cls.hitDie] ?? 0) + 1 };
  c.hitDice = { ...c.hitDice, [cls.hitDie]: (c.hitDice[cls.hitDie] ?? 0) + 1 };
  const res = { ...(c.resources ?? {}) };
  for (const [k, v] of Object.entries(lf.resources)) {
    const prev = res[k];
    res[k] = { max: v.max, recharge: v.recharge, current: prev ? Math.min(v.max, prev.current + Math.max(0, v.max - prev.max)) : v.max };
  }
  c.resources = res;
  applySpellcasting(c);
  gainedNames.push(...lf.gained);

  w.updateCreature(id, {
    level: c.level, abilities: c.abilities, features: c.features, maxHp: c.maxHp, hp: c.hp,
    hitDice: c.hitDice, hitDiceMax: c.hitDiceMax, resources: c.resources,
    ...(c.spellcasting ? { spellcasting: c.spellcasting } : {}),
  });
  refreshDerived(w, id);
  w.event("level.up", { id, from, to: c.level, hpGain, gained: gainedNames });
  return { from, to: c.level, hpGain, gained: gainedNames, ...(asi ? { asi } : {}) };
}

export { ABILITIES };
