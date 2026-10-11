/**
 * SRD 5.1 Ek A: Koşullar ve mekanik etkileri.
 * Koşullar veridir; etkileri burada tek yerde hesaplanır, anlatıcı sadece betimler.
 */
import type { Ability } from "./core.ts";

export const CONDITIONS = [
  "blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated",
  "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained",
  "stunned", "unconscious",
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_NAMES_TR: Record<Condition, string> = {
  blinded: "Kör",
  charmed: "Büyülenmiş",
  deafened: "Sağır",
  frightened: "Korkmuş",
  grappled: "Yakalanmış",
  incapacitated: "Etkisiz",
  invisible: "Görünmez",
  paralyzed: "Felçli",
  petrified: "Taşlaşmış",
  poisoned: "Zehirlenmiş",
  prone: "Yerde",
  restrained: "Kısıtlanmış",
  stunned: "Sersemlemiş",
  unconscious: "Bilinçsiz",
};

/** Koşulların ima ettiği koşullar (ör. felçli → etkisiz). */
const IMPLIES: Partial<Record<Condition, Condition[]>> = {
  paralyzed: ["incapacitated"],
  petrified: ["incapacitated"],
  stunned: ["incapacitated"],
  unconscious: ["incapacitated", "prone"],
};

export function expandConditions(list: Iterable<Condition>): Set<Condition> {
  const out = new Set<Condition>();
  const visit = (c: Condition) => {
    if (out.has(c)) return;
    out.add(c);
    for (const i of IMPLIES[c] ?? []) visit(i);
  };
  for (const c of list) visit(c);
  return out;
}

export interface ConditionEffects {
  /** Eylem / reaksiyon yapamaz. */
  incapacitated: boolean;
  /** Hız 0. */
  speedZero: boolean;
  /** Hız yarıya iner (bitkinlik 2). */
  speedHalved: boolean;
  /** Kendi saldırı atışlarında dezavantaj. */
  attackDisadvantage: boolean;
  /** Kendi saldırı atışlarında avantaj. */
  attackAdvantage: boolean;
  /** Ona yapılan saldırılarda avantaj. */
  attackedWithAdvantage: boolean;
  /** Ona yapılan saldırılarda dezavantaj. */
  attackedWithDisadvantage: boolean;
  /** 1,5 m (5 ft) içinden isabet eden saldırılar kritik olur. */
  meleeHitsAreCrits: boolean;
  /** Yerde: yakından saldırı avantajlı, uzaktan dezavantajlı. */
  prone: boolean;
  /** Bu yeteneklerdeki kurtarma atışları otomatik başarısız. */
  autoFailSaves: Set<Ability>;
  /** Bu yeteneklerdeki kurtarma atışlarında dezavantaj. */
  saveDisadvantage: Set<Ability>;
  /** Tüm yetenek kontrollerinde dezavantaj. */
  abilityCheckDisadvantage: boolean;
  /** Görmeye dayalı kontroller otomatik başarısız. */
  autoFailSightChecks: boolean;
  /** Duymaya dayalı kontroller otomatik başarısız. */
  autoFailHearingChecks: boolean;
  /** Tüm hasara direnç (taşlaşmış). */
  resistAllDamage: boolean;
  /** Konuşamaz. */
  cannotSpeak: boolean;
  /** Maks HP yarıya iner (bitkinlik 4). */
  maxHpHalved: boolean;
  /** Bitkinlik 6: ölüm. */
  dead: boolean;
}

/**
 * Koşul + bitkinlik seviyesi → birleşik mekanik etkiler.
 * Bitkinlik SRD 5.1 tablosunu izler (1: kontrollerde dezavantaj … 6: ölüm).
 */
export function conditionEffects(conditions: Iterable<Condition>, exhaustion = 0): ConditionEffects {
  const c = expandConditions(conditions);
  const has = (x: Condition) => c.has(x);
  const e: ConditionEffects = {
    incapacitated: has("incapacitated"),
    speedZero: has("grappled") || has("restrained") || has("paralyzed") || has("petrified") ||
      has("stunned") || has("unconscious") || exhaustion >= 5,
    speedHalved: exhaustion >= 2,
    attackDisadvantage: has("blinded") || has("frightened") || has("poisoned") || has("prone") ||
      has("restrained") || exhaustion >= 3,
    attackAdvantage: has("invisible"),
    attackedWithAdvantage: has("blinded") || has("paralyzed") || has("petrified") ||
      has("restrained") || has("stunned") || has("unconscious"),
    attackedWithDisadvantage: has("invisible"),
    meleeHitsAreCrits: has("paralyzed") || has("unconscious"),
    prone: has("prone"),
    autoFailSaves: new Set(),
    saveDisadvantage: new Set(),
    abilityCheckDisadvantage: has("frightened") || has("poisoned") || exhaustion >= 1,
    autoFailSightChecks: has("blinded"),
    autoFailHearingChecks: has("deafened"),
    resistAllDamage: has("petrified"),
    cannotSpeak: has("paralyzed") || has("petrified") || has("stunned") || has("unconscious"),
    maxHpHalved: exhaustion >= 4,
    dead: exhaustion >= 6,
  };
  if (has("paralyzed") || has("petrified") || has("stunned") || has("unconscious")) {
    e.autoFailSaves.add("str");
    e.autoFailSaves.add("dex");
  }
  if (has("restrained")) e.saveDisadvantage.add("dex");
  if (exhaustion >= 3) {
    for (const a of ["str", "dex", "con", "int", "wis", "cha"] as Ability[]) e.saveDisadvantage.add(a);
  }
  return e;
}
