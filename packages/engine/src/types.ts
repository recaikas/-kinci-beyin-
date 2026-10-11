/**
 * Oyun durumu tipleri. Bunlar Supabase tablolarının bellekteki yansımasıdır;
 * motor saf fonksiyonlarla bu yapıyı okur ve Effect listesi üretir.
 */
import type { Ability, AbilityScores, DamageType, Size, Skill } from "./core.ts";
import type { Condition } from "./conditions.ts";

export type CreatureKind = "pc" | "npc" | "monster";

export interface DeathSaves {
  successes: number;
  failures: number;
  stable: boolean;
}

export interface Spellcasting {
  ability: Ability;
  /** Seviye → kalan yuva sayısı (1..9). */
  slots: Partial<Record<number, number>>;
  /** Seviye → azami yuva sayısı. */
  maxSlots: Partial<Record<number, number>>;
  /** Hazırlanmış/bilinen büyü anahtarları. */
  known: string[];
  /** Konsantrasyon sürdürülen büyü. */
  concentratingOn: string | null;
}

export interface Features {
  /** Rogue 11: yeterli beceri kontrollerinde d20 en az 10 sayılır. */
  reliableTalent?: boolean;
  /** Halfling Lucky: d20'de doğal 1 bir kez yeniden atılır. */
  lucky?: boolean;
  /** Bard: yeterli olmadığı kontrollere yarım yeterlilik eklenir. */
  jackOfAllTrades?: boolean;
  /** Kritik vuruş aralığının alt sınırı (Champion: 19, üst seviye: 18). */
  critRange?: number;
  /** Ek kritik hasar zarı sayısı (Brutal Critical). */
  extraCritDice?: number;
  /** Savage Attacker vb. — hasar zarlarını bir kez yeniden at, yükseği al. */
  savageAttacker?: boolean;
  /** Hayatta kalma için ek: ölüm kurtarma atışlarına bonus. */
  deathSaveBonus?: number;
}

export interface Creature {
  id: string;
  name: string;
  kind: CreatureKind;
  level: number;
  /** Canavarlar için meydan okuma derecesi. */
  cr?: number;
  size: Size;
  abilities: AbilityScores;
  /** Yeterli olunan kurtarma atışları. */
  saveProficiencies: Ability[];
  skillProficiencies: Skill[];
  /** Uzmanlık (yeterlilik ×2). */
  expertise: Skill[];
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
  /** Fit cinsinden (SRD), 30 = 9 m. */
  speed: number;
  conditions: Condition[];
  exhaustion: number;
  resistances: DamageType[];
  immunities: DamageType[];
  vulnerabilities: DamageType[];
  conditionImmunities: Condition[];
  deathSaves: DeathSaves;
  /** Zar tipi → kalan sayı, ör. { 10: 3 } = 3×d10. */
  hitDice: Partial<Record<number, number>>;
  hitDiceMax: Partial<Record<number, number>>;
  inspiration: boolean;
  spellcasting?: Spellcasting;
  features: Features;
  xp: number;
  isAlive: boolean;
  /** NPC/canavarların kullandığı saldırı anahtarları (silah/doğal silah). */
  attacks?: string[];
  /** Konumu (places.id). */
  locationId?: string;
  factionId?: string;
}

export interface Weapon {
  key: string;
  name: string;
  /** "1d8" gibi. */
  damage: string;
  damageType: DamageType;
  /** Finesse: STR veya DEX'ten yüksek olan. */
  finesse?: boolean;
  ranged?: boolean;
  /** Fit cinsinden normal / uzun menzil. */
  range?: [number, number];
  versatile?: string;
  twoHanded?: boolean;
  /** Büyülü bonus (+1 silah). */
  magicBonus?: number;
}

export type Cover = "none" | "half" | "three_quarters" | "total";

export type Attitude = "hostile" | "indifferent" | "friendly";

export type ResultTier =
  | "critical_failure"
  | "failure"
  | "partial"
  | "success"
  | "critical_success";

export interface InventoryEntry {
  itemKey: string;
  qty: number;
  equipped?: boolean;
  attuned?: boolean;
}
