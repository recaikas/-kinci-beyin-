/**
 * SRD 5.1 içerik örnekleri (CC-BY-4.0). Tam içerik `content/srd` altındaki
 * dönüştürme betiğiyle veritabanına (spells, items, monsters tabloları) yüklenir;
 * buradakiler motor testleri ve demo için çekirdek settir.
 *
 * This work includes material taken from the System Reference Document 5.1
 * ("SRD 5.1") by Wizards of the Coast LLC, licensed under CC-BY-4.0.
 */
import type { SpellDef } from "../spells.ts";
import type { Creature, Weapon } from "../types.ts";

export const WEAPONS: Record<string, Weapon> = {
  dagger: { key: "dagger", name: "Hançer", damage: "1d4", damageType: "piercing", finesse: true, range: [20, 60] },
  shortsword: { key: "shortsword", name: "Kısa Kılıç", damage: "1d6", damageType: "piercing", finesse: true },
  longsword: { key: "longsword", name: "Uzun Kılıç", damage: "1d8", damageType: "slashing", versatile: "1d10" },
  greatsword: { key: "greatsword", name: "Büyük Kılıç", damage: "2d6", damageType: "slashing", twoHanded: true },
  greataxe: { key: "greataxe", name: "Büyük Balta", damage: "1d12", damageType: "slashing", twoHanded: true },
  mace: { key: "mace", name: "Gürz", damage: "1d6", damageType: "bludgeoning" },
  quarterstaff: { key: "quarterstaff", name: "Asa", damage: "1d6", damageType: "bludgeoning", versatile: "1d8" },
  rapier: { key: "rapier", name: "Meç", damage: "1d8", damageType: "piercing", finesse: true },
  scimitar: { key: "scimitar", name: "Pala", damage: "1d6", damageType: "slashing", finesse: true },
  spear: { key: "spear", name: "Mızrak", damage: "1d6", damageType: "piercing", versatile: "1d8", range: [20, 60] },
  shortbow: { key: "shortbow", name: "Kısa Yay", damage: "1d6", damageType: "piercing", ranged: true, range: [80, 320], twoHanded: true },
  longbow: { key: "longbow", name: "Uzun Yay", damage: "1d8", damageType: "piercing", ranged: true, range: [150, 600], twoHanded: true },
  light_crossbow: { key: "light_crossbow", name: "Hafif Arbalet", damage: "1d8", damageType: "piercing", ranged: true, range: [80, 320], twoHanded: true },
  unarmed: { key: "unarmed", name: "Silahsız Vuruş", damage: "1", damageType: "bludgeoning" },
};

export const SPELLS: Record<string, SpellDef> = {
  fire_bolt: {
    key: "fire_bolt", name: "Ateş Oku", level: 0, school: "evocation", castingTime: "action",
    rangeFt: 120, concentration: false, attack: "ranged", damage: "1d10", damageType: "fire",
    summary: "Menzilli büyü saldırısı; isabette 1d10 ateş hasarı, yanıcı nesneleri tutuşturur.",
  },
  sacred_flame: {
    key: "sacred_flame", name: "Kutsal Alev", level: 0, school: "evocation", castingTime: "action",
    rangeFt: 60, concentration: false, save: "dex", damage: "1d8", damageType: "radiant", halfOnSave: false,
    summary: "Hedef DEX kurtarması yapar; başarısızsa 1d8 ışıltı hasarı. Siper fayda etmez.",
  },
  magic_missile: {
    key: "magic_missile", name: "Büyülü Füze", level: 1, school: "evocation", castingTime: "action",
    rangeFt: 120, concentration: false, damageType: "force", autoHitDarts: { count: 3, damage: "1d4+1" },
    summary: "Üç parlayan ok otomatik isabet eder; her biri 1d4+1 güç hasarı. Üst yuvada +1 ok.",
  },
  burning_hands: {
    key: "burning_hands", name: "Yakan Eller", level: 1, school: "evocation", castingTime: "action",
    rangeFt: 15, concentration: false, save: "dex", damage: "3d6", damageType: "fire", halfOnSave: true,
    upcastDice: "1d6", maxTargets: 6,
    summary: "4,5 m'lik koni; DEX kurtarması, 3d6 ateş (başarıda yarı).",
  },
  cure_wounds: {
    key: "cure_wounds", name: "Yara İyileştir", level: 1, school: "evocation", castingTime: "action",
    rangeFt: 5, concentration: false, heal: "1d8", addAbilityMod: true, upcastDice: "1d8",
    summary: "Dokunulan yaratık 1d8 + büyü yeteneği modu kadar iyileşir.",
  },
  healing_word: {
    key: "healing_word", name: "Şifa Sözü", level: 1, school: "evocation", castingTime: "bonus_action",
    rangeFt: 60, concentration: false, heal: "1d4", addAbilityMod: true, upcastDice: "1d4",
    summary: "Bonus eylemle uzaktan 1d4 + mod iyileştirme.",
  },
  hold_person: {
    key: "hold_person", name: "Kişiyi Tut", level: 2, school: "enchantment", castingTime: "action",
    rangeFt: 60, concentration: true, save: "wis", conditionsOnFail: ["paralyzed"], upcastTargets: 1,
    summary: "İnsansı hedef WIS kurtarmasında başarısızsa felç olur (konsantrasyon).",
  },
  fireball: {
    key: "fireball", name: "Ateş Topu", level: 3, school: "evocation", castingTime: "action",
    rangeFt: 150, concentration: false, save: "dex", damage: "8d6", damageType: "fire", halfOnSave: true,
    upcastDice: "1d6", maxTargets: 20,
    summary: "6 m yarıçaplı patlama; DEX kurtarması, 8d6 ateş (başarıda yarı).",
  },
  false_life: {
    key: "false_life", name: "Sahte Yaşam", level: 1, school: "necromancy", castingTime: "action",
    rangeFt: 0, concentration: false, tempHp: "1d4+4",
    summary: "Kendine 1d4+4 geçici HP.",
  },
};

export interface ItemDef {
  key: string;
  name: string;
  type: "weapon" | "armor" | "potion" | "gear" | "treasure" | "tool" | "key";
  valueCp: number;
  weightLb: number;
  /** Kullanımda iyileştirme notasyonu. */
  heal?: string;
  /** Tüketilir mi. */
  consumable?: boolean;
  /** Kilit/tuzak DC'si gibi dünya değerleri. */
  dc?: number;
  description: string;
}

export const ITEMS: Record<string, ItemDef> = {
  potion_of_healing: {
    key: "potion_of_healing", name: "İyileştirme İksiri", type: "potion", valueCp: 5000, weightLb: 0.5,
    heal: "2d4+2", consumable: true, description: "Kırmızı, ışıldayan sıvı. 2d4+2 HP iyileştirir.",
  },
  healers_kit: {
    key: "healers_kit", name: "Şifacı Seti", type: "tool", valueCp: 500, weightLb: 3,
    consumable: true, description: "10 kullanımlık; 0 HP'deki yaratığı kontrol gerektirmeden stabilize eder.",
  },
  thieves_tools: {
    key: "thieves_tools", name: "Hırsız Aletleri", type: "tool", valueCp: 2500, weightLb: 1,
    description: "Kilit açma ve tuzak etkisizleştirme.",
  },
  rope_hempen: {
    key: "rope_hempen", name: "Kenevir Halat (15 m)", type: "gear", valueCp: 100, weightLb: 10,
    description: "DC 17 Güç kontrolüyle koparılabilir.",
  },
  torch: {
    key: "torch", name: "Meşale", type: "gear", valueCp: 1, weightLb: 1, consumable: true,
    description: "1 saat yanar; 6 m parlak, 6 m loş ışık.",
  },
  rations: {
    key: "rations", name: "Erzak (1 gün)", type: "gear", valueCp: 50, weightLb: 2, consumable: true,
    description: "Kurutulmuş et, peksimet, kuruyemiş.",
  },
};

type CreatureTemplate = Omit<Creature, "id" | "locationId" | "factionId">;

const base = {
  saveProficiencies: [], skillProficiencies: [], expertise: [], tempHp: 0, conditions: [],
  exhaustion: 0, resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [],
  deathSaves: { successes: 0, failures: 0, stable: false }, inspiration: false, features: {},
  xp: 0, isAlive: true, size: "medium",
} satisfies Partial<CreatureTemplate>;

export const MONSTERS: Record<string, CreatureTemplate & { attacks: string[] }> = {
  goblin: {
    ...base, name: "Goblin", kind: "monster", level: 1, cr: 0.25, size: "small",
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    skillProficiencies: ["stealth"], expertise: ["stealth"],
    hp: 7, maxHp: 7, ac: 15, speed: 30, hitDice: { 6: 2 }, hitDiceMax: { 6: 2 },
    attacks: ["scimitar", "shortbow"],
  },
  guard: {
    ...base, name: "Muhafız", kind: "npc", level: 1, cr: 0.125,
    abilities: { str: 13, dex: 12, con: 12, int: 10, wis: 11, cha: 10 },
    skillProficiencies: ["perception"],
    hp: 11, maxHp: 11, ac: 16, speed: 30, hitDice: { 8: 2 }, hitDiceMax: { 8: 2 },
    attacks: ["spear"],
  },
  bandit: {
    ...base, name: "Haydut", kind: "npc", level: 1, cr: 0.125,
    abilities: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    hp: 11, maxHp: 11, ac: 12, speed: 30, hitDice: { 8: 2 }, hitDiceMax: { 8: 2 },
    attacks: ["scimitar", "light_crossbow"],
  },
  skeleton: {
    ...base, name: "İskelet", kind: "monster", level: 1, cr: 0.25,
    abilities: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
    vulnerabilities: ["bludgeoning"], immunities: ["poison"], conditionImmunities: ["poisoned"],
    hp: 13, maxHp: 13, ac: 13, speed: 30, hitDice: { 8: 2 }, hitDiceMax: { 8: 2 },
    attacks: ["shortsword", "shortbow"],
  },
  wolf: {
    ...base, name: "Kurt", kind: "monster", level: 1, cr: 0.25,
    abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    skillProficiencies: ["perception", "stealth"],
    hp: 11, maxHp: 11, ac: 13, speed: 40, hitDice: { 8: 2 }, hitDiceMax: { 8: 2 },
    attacks: ["bite"],
  },
  ogre: {
    ...base, name: "Ogre", kind: "monster", level: 5, cr: 2, size: "large",
    abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
    hp: 59, maxHp: 59, ac: 11, speed: 40, hitDice: { 10: 7 }, hitDiceMax: { 10: 7 },
    attacks: ["greatclub"],
  },
};

/** Canavara özel doğal saldırılar (silah tablosunda olmayanlar). */
export const NATURAL_WEAPONS: Record<string, Weapon> = {
  bite: { key: "bite", name: "Isırık", damage: "2d4", damageType: "piercing", finesse: true },
  greatclub: { key: "greatclub", name: "Dev Sopa", damage: "2d8", damageType: "bludgeoning" },
};

export function spawnMonster(key: string, id: string, overrides: Partial<Creature> = {}): Creature {
  const t = MONSTERS[key];
  if (!t) throw new Error(`Bilinmeyen canavar: ${key}`);
  return { ...structuredClone(t), id, ...overrides };
}
