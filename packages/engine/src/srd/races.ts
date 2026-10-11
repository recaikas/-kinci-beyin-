/**
 * SRD 5.1 ırkları (CC-BY-4.0).
 */
import type { Ability, DamageType, Size, Skill } from "../core.ts";
import type { Features } from "../types.ts";

export interface RaceDef {
  key: string;
  name: string;
  abilityBonuses: Partial<Record<Ability, number>>;
  /** Yarı-elf: seçilecek ek +1'lerin sayısı. */
  chooseAbilityBonuses?: number;
  size: Size;
  speed: number;
  darkvision?: number;
  skillProficiencies?: Skill[];
  /** Seçilecek ek beceri sayısı (yarı-elf: 2). */
  chooseSkills?: number;
  weaponProficiencies?: string[];
  armorProficiencies?: string[];
  resistances?: DamageType[];
  features?: Features;
  /** Ek kaynaklar (Ejder nefesi, Amansız Dayanıklılık). */
  resources?: Record<string, { max: number; recharge: "short" | "long" }>;
  /** Ek cantrip (yüksek elf: büyücü listesinden). */
  bonusCantrip?: string;
  languages: string[];
  traits: string[];
}

export const RACES: Record<string, RaceDef> = {
  human: {
    key: "human", name: "İnsan", abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, size: "medium", speed: 30,
    languages: ["Ortak dil", "bir ek dil"], traits: ["Tüm yeteneklere +1"],
  },
  high_elf: {
    key: "high_elf", name: "Yüksek Elf", abilityBonuses: { dex: 2, int: 1 }, size: "medium", speed: 30, darkvision: 60,
    skillProficiencies: ["perception"], weaponProficiencies: ["longsword", "shortsword", "shortbow", "longbow"], bonusCantrip: "fire_bolt",
    languages: ["Ortak dil", "Elfçe"], traits: ["Karanlık görüş", "Keskin duyular", "Peri soyu", "Trans", "Büyücü cantrip'i"],
  },
  hill_dwarf: {
    key: "hill_dwarf", name: "Tepe Cücesi", abilityBonuses: { con: 2, wis: 1 }, size: "medium", speed: 25, darkvision: 60,
    resistances: ["poison"], weaponProficiencies: ["battleaxe", "handaxe", "light_hammer", "warhammer"], features: { hpPerLevelBonus: 1 },
    languages: ["Ortak dil", "Cüce dili"], traits: ["Karanlık görüş", "Cüce dayanıklılığı (zehre direnç)", "Cüce sağlamlığı (+1 HP/seviye)"],
  },
  lightfoot_halfling: {
    key: "lightfoot_halfling", name: "Hafifayak Buçukluk", abilityBonuses: { dex: 2, cha: 1 }, size: "small", speed: 25,
    features: { lucky: true }, languages: ["Ortak dil", "Buçukluk dili"], traits: ["Şanslı (doğal 1'i yeniden at)", "Cesur", "Buçukluk çevikliği", "Doğuştan gizli"],
  },
  dragonborn: {
    key: "dragonborn", name: "Ejderdoğan (Kızıl)", abilityBonuses: { str: 2, cha: 1 }, size: "medium", speed: 30,
    resistances: ["fire"], resources: { breath_weapon: { max: 1, recharge: "short" } },
    languages: ["Ortak dil", "Ejder dili"], traits: ["Ejder soyu: kızıl (ateş)", "Nefes silahı (2d6 ateş, DEX kurtarma)", "Ateşe direnç"],
  },
  rock_gnome: {
    key: "rock_gnome", name: "Kaya Gnomu", abilityBonuses: { int: 2, con: 1 }, size: "small", speed: 25, darkvision: 60,
    languages: ["Ortak dil", "Gnom dili"], traits: ["Karanlık görüş", "Gnom kurnazlığı", "Mucit"],
  },
  half_elf: {
    key: "half_elf", name: "Yarı Elf", abilityBonuses: { cha: 2 }, chooseAbilityBonuses: 2, chooseSkills: 2, size: "medium", speed: 30, darkvision: 60,
    languages: ["Ortak dil", "Elfçe", "bir ek dil"], traits: ["Karanlık görüş", "Peri soyu", "Çok yönlülük (2 beceri)"],
  },
  half_orc: {
    key: "half_orc", name: "Yarı Ork", abilityBonuses: { str: 2, con: 1 }, size: "medium", speed: 30, darkvision: 60,
    skillProficiencies: ["intimidation"], features: { extraCritDice: 1 }, resources: { relentless_endurance: { max: 1, recharge: "long" } },
    languages: ["Ortak dil", "Orkça"], traits: ["Karanlık görüş", "Tehditkâr", "Amansız dayanıklılık", "Vahşi saldırılar"],
  },
  tiefling: {
    key: "tiefling", name: "Tiefling", abilityBonuses: { cha: 2, int: 1 }, size: "medium", speed: 30, darkvision: 60,
    resistances: ["fire"], languages: ["Ortak dil", "İnfernal"], traits: ["Karanlık görüş", "Cehennem direnci (ateş)", "Cehennem mirası"],
  },
};
