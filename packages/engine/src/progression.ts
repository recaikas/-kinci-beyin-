/**
 * İlerleme ve dinlenme: XP eşikleri, seviye atlama, CR → XP, karşılaşma zorluğu,
 * kısa/uzun dinlenme, hit dice harcama.
 */
import { abilityModifier } from "./core.ts";
import type { EngineContext } from "./context.ts";
import { heal } from "./combat.ts";
import { type StateWriter } from "./state.ts";
import type { Creature } from "./types.ts";

/** Seviye için gereken toplam XP (indeks = seviye). */
export const XP_THRESHOLDS = [
  0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

export function levelForXp(xp: number): number {
  let lv = 1;
  for (let i = 2; i <= 20; i++) if (xp >= XP_THRESHOLDS[i]!) lv = i;
  return lv;
}

/** CR → XP ödülü (SRD canavar tablosu). */
export const CR_XP: Record<string, number> = {
  "0": 10, "0.125": 25, "0.25": 50, "0.5": 100, "1": 200, "2": 450, "3": 700, "4": 1100,
  "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200,
  "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000, "17": 18000,
  "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000,
  "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000,
};

export function xpForCR(cr: number): number {
  const v = CR_XP[String(cr)];
  if (v === undefined) throw new RangeError(`Bilinmeyen CR: ${cr}`);
  return v;
}

/** Karakter seviyesi → [kolay, orta, zor, ölümcül] XP eşiği (karakter başına). */
export const ENCOUNTER_THRESHOLDS: [number, number, number, number][] = [
  [0, 0, 0, 0],
  [25, 50, 75, 100], [50, 100, 150, 200], [75, 150, 225, 400], [125, 250, 375, 500],
  [250, 500, 750, 1100], [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100],
  [550, 1100, 1600, 2400], [600, 1200, 1900, 2800], [800, 1600, 2400, 3600], [1000, 2000, 3000, 4500],
  [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700], [1400, 2800, 4300, 6400], [1600, 3200, 4800, 7200],
  [2000, 3900, 5900, 8800], [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700],
];

export function encounterMultiplier(monsterCount: number): number {
  if (monsterCount <= 1) return 1;
  if (monsterCount === 2) return 1.5;
  if (monsterCount <= 6) return 2;
  if (monsterCount <= 10) return 2.5;
  if (monsterCount <= 14) return 3;
  return 4;
}

export type EncounterDifficulty = "trivial" | "easy" | "medium" | "hard" | "deadly";

export function encounterDifficulty(partyLevels: number[], monsterCRs: number[]): {
  difficulty: EncounterDifficulty;
  adjustedXp: number;
  baseXp: number;
} {
  const baseXp = monsterCRs.reduce((s, cr) => s + xpForCR(cr), 0);
  const adjustedXp = Math.floor(baseXp * encounterMultiplier(monsterCRs.length));
  const t = [0, 0, 0, 0];
  for (const lv of partyLevels) {
    const row = ENCOUNTER_THRESHOLDS[Math.max(1, Math.min(20, lv))]!;
    for (let i = 0; i < 4; i++) t[i]! += row[i]!;
  }
  const difficulty: EncounterDifficulty = adjustedXp >= t[3]! ? "deadly"
    : adjustedXp >= t[2]! ? "hard"
    : adjustedXp >= t[1]! ? "medium"
    : adjustedXp >= t[0]! ? "easy"
    : "trivial";
  return { difficulty, adjustedXp, baseXp };
}

/** XP ver; seviye eşiği geçilirse olay üret (sınıf seçimleri ayrı akışta yapılır). */
export function awardXp(w: StateWriter, id: string, amount: number): { level: number; leveledUp: boolean } {
  const c = w.creature(id);
  const xp = c.xp + Math.max(0, amount);
  const level = levelForXp(xp);
  w.updateCreature(id, { xp });
  const leveledUp = level > c.level;
  if (leveledUp) w.event("level.up", { id, from: c.level, to: level, pending: "sınıf seçimi ve HP artışı" });
  return { level, leveledUp };
}

/** Seviye atlarken HP artışı: zar ya da sabit ortalama + CON modu (en az 1). */
export function levelUpHp(ctx: EngineContext | null, c: Creature, hitDie: number): number {
  const con = abilityModifier(c.abilities.con);
  const base = ctx ? ctx.roll(`1d${hitDie}`, "seviye HP", { actorId: c.id }).total : Math.floor(hitDie / 2) + 1;
  return Math.max(1, base + con);
}

/** Kısa dinlenme: istenen hit dice'ları harca (her zar + CON modu, en az 0). */
export function shortRest(
  ctx: EngineContext,
  w: StateWriter,
  id: string,
  spend: Partial<Record<number, number>>,
  options: { pactSlots?: Partial<Record<number, number>> } = {},
): number {
  const c = w.creature(id);
  if (!c.isAlive) return 0;
  const con = abilityModifier(c.abilities.con);
  const hd = { ...c.hitDice };
  let total = 0;
  for (const [sidesStr, count] of Object.entries(spend)) {
    const sides = Number(sidesStr);
    const n = Math.min(count ?? 0, hd[sides] ?? 0);
    for (let i = 0; i < n; i++) {
      total += Math.max(0, ctx.roll(`1d${sides}`, "kısa dinlenme hit die", { actorId: id }).total + con);
    }
    hd[sides] = (hd[sides] ?? 0) - n;
  }
  w.updateCreature(id, { hitDice: hd });
  const gained = heal(w, id, total);
  if (options.pactSlots && c.spellcasting) {
    const sc = w.creature(id).spellcasting!;
    w.updateCreature(id, { spellcasting: { ...sc, slots: { ...sc.slots, ...options.pactSlots } } });
  }
  w.advanceTime(60);
  w.event("rest.short", { id, healed: gained });
  return gained;
}

/** Uzun dinlenme: tam HP, yuvalar, maks hit dice'ın yarısı (en az 1), bitkinlik −1. */
export function longRest(ctx: EngineContext, w: StateWriter, id: string): void {
  const c = w.creature(id);
  if (!c.isAlive) return;
  const patch: Partial<Creature> = {
    hp: c.maxHp,
    tempHp: 0,
    deathSaves: { successes: 0, failures: 0, stable: false },
  };
  const hd = { ...c.hitDice };
  for (const [sidesStr, max] of Object.entries(c.hitDiceMax)) {
    const sides = Number(sidesStr);
    const regain = Math.max(1, Math.floor((max ?? 0) / 2));
    hd[sides] = Math.min(max ?? 0, (hd[sides] ?? 0) + regain);
  }
  patch.hitDice = hd;
  if (c.spellcasting) {
    patch.spellcasting = { ...c.spellcasting, slots: { ...c.spellcasting.maxSlots }, concentratingOn: null };
  }
  if (ctx.rules.longRestReducesExhaustion && c.exhaustion > 0) patch.exhaustion = c.exhaustion - 1;
  w.updateCreature(id, patch);
  if (c.conditions.includes("unconscious") && c.hp === 0) w.removeCondition(id, "unconscious");
  w.advanceTime(8 * 60);
  w.event("rest.long", { id });
}
