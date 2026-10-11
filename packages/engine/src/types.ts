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

/** Süreli büyü etkisi (Kutsama, İnanç Kalkanı, Peri Ateşi …). */
export interface Buff {
  key: string;
  name: string;
  sourceId: string;
  /** Oyun zamanı (dakika) — bu ana gelince kalkar. Savaşta zaman ilerlemez; savaş boyu sürer. */
  expiresAt: number;
  /** Konsantrasyon gerektiriyorsa: büyücü konsantrasyonu kaybedince kalkar. */
  concentration?: boolean;
  /** Saldırı atışlarına eklenen zar ("1d4", "-1d4"). */
  attackDice?: string;
  /** Kurtarma atışlarına eklenen zar. */
  saveDice?: string;
  /** AC bonusu. */
  acBonus?: number;
  /** Bu yaratığa yapılan saldırılar avantajlı (Peri Ateşi). */
  revealed?: boolean;
  /** Hasar zarı bonusu (Öfke vb. sabit değer). */
  damageBonus?: number;
  /** Bu hasar türlerine direnç (Öfke). */
  resist?: string[];
  /** Bu etkiye bağlı koşullar: etki kalkınca koşullar da kalkar (Kişiyi Tut → felç). */
  conditions?: Condition[];
  /** İlk kullanımda tükenir (Ozan İlhamı). */
  consumeOnUse?: boolean;
  /** Hedef her turunun sonunda bu kurtarmayı tekrarlar; başarırsa etki biter. */
  repeatSave?: { ability: Ability; dc: number };
}

export interface Resource {
  current: number;
  max: number;
  recharge: "short" | "long";
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
  /** Rogue: Sinsi Saldırı zar sayısı (d6). */
  sneakAttackDice?: number;
  /** Barbar: öfke hasar bonusu. */
  rageDamage?: number;
  /** Zırhsız savunma: 10 + DEX + bu yetenek (barbar: con, keşiş: wis). */
  unarmoredDefense?: "con" | "wis";
  /** Keşiş: dövüş sanatları zarı (silahsız vuruş). */
  martialArtsDie?: number;
  /** Savaş stili: savunma (+1 AC zırhlıyken). */
  fightingStyle?: "defense" | "dueling" | "archery" | "great_weapon";
  /** Hill dwarf / draconic resilience vb. — seviye başına ek HP. */
  hpPerLevelBonus?: number;
  /** Half-orc: Amansız Dayanıklılık (0 yerine 1 HP'de kalma). */
  relentlessEndurance?: boolean;
  /** Ozan: ilham zarı yüzü. */
  bardicInspirationDie?: number;
  /** Saldırı eyleminde ek saldırı sayısı (Extra Attack / canavar çoklu saldırısı). */
  extraAttacks?: number;
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
  /** Canavar şablonu (ganimet tablosu için). */
  templateKey?: string;
  /** Oyuncu karakteri: ırk ve sınıf anahtarları. */
  raceKey?: string;
  classKey?: string;
  subclassKey?: string;
  /** Silah yeterlilikleri: "simple", "martial" ya da silah anahtarları. Tanımsız → hepsi. */
  weaponProficiencies?: string[];
  /** Zırh yeterlilikleri: "light", "medium", "heavy", "shield". Tanımsız → hepsi. */
  armorProficiencies?: string[];
  /** Kısa/uzun dinlenmede yenilenen sınıf/ırk kaynakları. */
  resources?: Record<string, Resource>;
  /** Kuşanılmış zırh Gizlilik'te dezavantaj veriyor mu (türetilmiş). */
  stealthDisadvantage?: boolean;
  /** Karanlıkta görüş (fit). */
  darkvision?: number;
  /** Bilinen diller. */
  languages?: string[];
  /** Kısa geçmiş / görünüm (anlatıcı için). */
  background?: string;
  /** Ganimeti alındı mı (cesetler için). */
  looted?: boolean;
  /** Aktif süreli etkiler. */
  buffs?: Buff[];
  /** Konumu (places.id). */
  locationId?: string;
  factionId?: string;
}

export type WeaponCategory = "simple" | "martial" | "natural";

export interface Weapon {
  key: string;
  name: string;
  category?: WeaponCategory;
  /** "1d8" gibi. */
  damage: string;
  damageType: DamageType;
  light?: boolean;
  heavy?: boolean;
  reach?: boolean;
  thrown?: boolean;
  loading?: boolean;
  valueCp?: number;
  weightLb?: number;
  /** Finesse: STR veya DEX'ten yüksek olan. */
  finesse?: boolean;
  ranged?: boolean;
  /** Fit cinsinden normal / uzun menzil. */
  range?: [number, number];
  versatile?: string;
  twoHanded?: boolean;
  /** Büyülü bonus (+1 silah). */
  magicBonus?: number;
  /** İsabette hedefin yaptığı ek kurtarma (zehir, felç, yere düşme). */
  onHit?: {
    ability: Ability;
    dc: number;
    damage?: string;
    damageType?: DamageType;
    halfOnSave?: boolean;
    condition?: Condition;
    /** Koşulun süresi (dakika) ve her tur tekrar kurtarma. */
    durationMin?: number;
    repeatSave?: boolean;
  };
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
