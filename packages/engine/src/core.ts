/**
 * SRD 5.1 çekirdek tanımları: yetenekler, beceriler, yeterlilik, zorluk dereceleri.
 * Kaynak: System Reference Document 5.1 (CC-BY-4.0, Wizards of the Coast).
 */

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_NAMES_TR: Record<Ability, string> = {
  str: "Güç",
  dex: "Çeviklik",
  con: "Dayanıklılık",
  int: "Zekâ",
  wis: "Bilgelik",
  cha: "Karizma",
};

export type AbilityScores = Record<Ability, number>;

export const SKILLS = {
  athletics: "str",
  acrobatics: "dex",
  sleight_of_hand: "dex",
  stealth: "dex",
  arcana: "int",
  history: "int",
  investigation: "int",
  nature: "int",
  religion: "int",
  animal_handling: "wis",
  insight: "wis",
  medicine: "wis",
  perception: "wis",
  survival: "wis",
  deception: "cha",
  intimidation: "cha",
  performance: "cha",
  persuasion: "cha",
} as const satisfies Record<string, Ability>;

export type Skill = keyof typeof SKILLS;
export const SKILL_LIST = Object.keys(SKILLS) as Skill[];

export const SKILL_NAMES_TR: Record<Skill, string> = {
  athletics: "Atletizm",
  acrobatics: "Akrobasi",
  sleight_of_hand: "El Çabukluğu",
  stealth: "Gizlilik",
  arcana: "Gizem Bilgisi",
  history: "Tarih",
  investigation: "Araştırma",
  nature: "Doğa",
  religion: "Din",
  animal_handling: "Hayvan Terbiyesi",
  insight: "Sezgi",
  medicine: "Tıp",
  perception: "Algı",
  survival: "Hayatta Kalma",
  deception: "Aldatma",
  intimidation: "Gözdağı",
  performance: "Gösteri",
  persuasion: "İkna",
};

/** Yetenek değiştiricisi: ⌊(skor − 10) / 2⌋ */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Yeterlilik bonusu: seviye 1–4 → +2 … 17–20 → +6 */
export function proficiencyBonus(level: number): number {
  if (level < 1) return 2;
  return 2 + Math.floor((Math.min(level, 20) - 1) / 4);
}

/** Canavarlar için meydan okuma derecesine (CR) göre yeterlilik. */
export function proficiencyByCR(cr: number): number {
  if (cr < 5) return 2;
  return 2 + Math.floor((Math.min(cr, 30) - 1) / 4);
}

/** Zorluk dereceleri (DC). */
export const DC = {
  VERY_EASY: 5,
  EASY: 10,
  MEDIUM: 15,
  HARD: 20,
  VERY_HARD: 25,
  NEARLY_IMPOSSIBLE: 30,
} as const;

export const DAMAGE_TYPES = [
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;
export type Size = (typeof SIZES)[number];

/** Karakter puan alımı (point buy) maliyetleri, 27 puan bütçe. */
export const POINT_BUY_COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};
export const POINT_BUY_BUDGET = 27;
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

export function pointBuyCost(scores: AbilityScores): number {
  let total = 0;
  for (const a of ABILITIES) {
    const c = POINT_BUY_COST[scores[a]];
    if (c === undefined) throw new RangeError(`Puan alımında ${a}=${scores[a]} geçersiz (8–15)`);
    total += c;
  }
  return total;
}

export function isValidPointBuy(scores: AbilityScores): boolean {
  try {
    return pointBuyCost(scores) <= POINT_BUY_BUDGET;
  } catch {
    return false;
  }
}
