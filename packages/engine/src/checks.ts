/**
 * Yetenek kontrolleri, beceri kontrolleri, kurtarma atışları,
 * karşılıklı / grup kontrolleri, pasif değerler ve sonuç kademeleri.
 */
import { type Ability, SKILLS, type Skill, abilityModifier, proficiencyBonus } from "./core.ts";
import { conditionEffects } from "./conditions.ts";
import { type D20Result, type EngineContext, d20Test } from "./context.ts";
import type { RuleOptions } from "./rules.ts";
import type { Creature, ResultTier } from "./types.ts";

export interface CheckSituation {
  advantage?: boolean;
  disadvantage?: boolean;
  /** Durumsal sabit modlar (ör. alet takımı, ortam). */
  extraModifier?: number;
  bonusDice?: string[];
  /** Görme/duymaya dayalı mı (kör/sağır otomatik başarısız). */
  sense?: "sight" | "hearing";
  reason?: string;
  targetId?: string;
}

export interface CheckResult {
  roll: D20Result;
  dc: number;
  success: boolean;
  tier: ResultTier;
  margin: number;
  autoFailed: boolean;
}

const TIERS: ResultTier[] = ["critical_failure", "failure", "partial", "success", "critical_success"];

/**
 * Sonuç kademesi. RAW'da kontrol sadece başarı/başarısızlıktır;
 * kural seçenekleriyle kısmi başarı ve kritik kademeler açılır.
 */
export function tierFor(total: number, dc: number, natural: number, rules: RuleOptions): ResultTier {
  const margin = total - dc;
  let tier: ResultTier;
  if (margin >= 0) {
    tier = rules.degreesOfSuccess && margin >= 10 ? "critical_success" : "success";
  } else if (rules.partialSuccessMargin > 0 && -margin <= rules.partialSuccessMargin) {
    tier = "partial";
  } else {
    tier = rules.degreesOfSuccess && margin <= -10 ? "critical_failure" : "failure";
  }
  if (rules.naturalStepsOnChecks) {
    const i = TIERS.indexOf(tier);
    if (natural === 20) tier = TIERS[Math.min(i + 1, 4)]!;
    if (natural === 1) tier = TIERS[Math.max(i - 1, 0)]!;
  }
  return tier;
}

export function isSuccessTier(t: ResultTier): boolean {
  return t === "success" || t === "critical_success";
}

export function skillModifier(c: Creature, skill: Skill, abilityOverride?: Ability): number {
  const ability = abilityOverride ?? SKILLS[skill];
  const pb = proficiencyBonus(c.level);
  let mod = abilityModifier(c.abilities[ability]);
  if (c.expertise.includes(skill)) mod += pb * 2;
  else if (c.skillProficiencies.includes(skill)) mod += pb;
  else if (c.features.jackOfAllTrades) mod += Math.floor(pb / 2);
  return mod;
}

export function saveModifier(c: Creature, ability: Ability): number {
  let mod = abilityModifier(c.abilities[ability]);
  if (c.saveProficiencies.includes(ability)) mod += proficiencyBonus(c.level);
  return mod;
}

function finish(
  ctx: EngineContext,
  roll: D20Result,
  dc: number,
  autoFailed: boolean,
): CheckResult {
  const tier: ResultTier = autoFailed ? "failure" : tierFor(roll.total, dc, roll.natural, ctx.rules);
  roll.record.tier = tier;
  return { roll, dc, success: isSuccessTier(tier), tier, margin: roll.total - dc, autoFailed };
}

/** Beceri kontrolü (ör. İkna DC 15). */
export function skillCheck(
  ctx: EngineContext,
  c: Creature,
  skill: Skill,
  dc: number,
  s: CheckSituation = {},
  abilityOverride?: Ability,
): CheckResult {
  const fx = conditionEffects(c.conditions, c.exhaustion);
  const proficient = c.skillProficiencies.includes(skill) || c.expertise.includes(skill);
  const roll = d20Test(ctx, {
    modifier: skillModifier(c, skill, abilityOverride) + (s.extraModifier ?? 0),
    advantage: s.advantage,
    disadvantage: s.disadvantage || fx.abilityCheckDisadvantage || (skill === "stealth" && !!c.stealthDisadvantage),
    lucky: c.features.lucky,
    ...(c.features.reliableTalent && proficient ? { minimum: 10 } : {}),
    bonusDice: s.bonusDice,
    reason: s.reason ?? `${skill} kontrolü`,
    actorId: c.id,
    targetId: s.targetId,
    dc,
  });
  const autoFail = (s.sense === "sight" && fx.autoFailSightChecks) ||
    (s.sense === "hearing" && fx.autoFailHearingChecks);
  return finish(ctx, roll, dc, autoFail);
}

/** Saf yetenek kontrolü (ör. kapıyı kırmak için Güç). */
export function abilityCheck(
  ctx: EngineContext,
  c: Creature,
  ability: Ability,
  dc: number,
  s: CheckSituation = {},
): CheckResult {
  const fx = conditionEffects(c.conditions, c.exhaustion);
  let mod = abilityModifier(c.abilities[ability]) + (s.extraModifier ?? 0);
  if (c.features.jackOfAllTrades) mod += Math.floor(proficiencyBonus(c.level) / 2);
  const roll = d20Test(ctx, {
    modifier: mod,
    advantage: s.advantage,
    disadvantage: s.disadvantage || fx.abilityCheckDisadvantage,
    lucky: c.features.lucky,
    bonusDice: s.bonusDice,
    reason: s.reason ?? `${ability} kontrolü`,
    actorId: c.id,
    targetId: s.targetId,
    dc,
  });
  const autoFail = (s.sense === "sight" && fx.autoFailSightChecks) ||
    (s.sense === "hearing" && fx.autoFailHearingChecks);
  return finish(ctx, roll, dc, autoFail);
}

/** Kurtarma atışı. Koşullar otomatik başarısızlık / dezavantaj getirebilir. */
export function savingThrow(
  ctx: EngineContext,
  c: Creature,
  ability: Ability,
  dc: number,
  s: CheckSituation = {},
): CheckResult {
  const fx = conditionEffects(c.conditions, c.exhaustion);
  const buffDice = (c.buffs ?? []).filter((b) => b.saveDice).map((b) => b.saveDice!);
  const roll = d20Test(ctx, {
    modifier: saveModifier(c, ability) + (s.extraModifier ?? 0),
    advantage: s.advantage,
    disadvantage: s.disadvantage || fx.saveDisadvantage.has(ability),
    lucky: c.features.lucky,
    bonusDice: [...(s.bonusDice ?? []), ...buffDice],
    reason: s.reason ?? `${ability} kurtarma atışı`,
    actorId: c.id,
    targetId: s.targetId,
    dc,
  });
  // Kurtarma atışlarında kademe RAW: başarı/başarısızlık (kısmi yok).
  const auto = fx.autoFailSaves.has(ability);
  const success = !auto && roll.total >= dc;
  const tier: ResultTier = success ? "success" : "failure";
  roll.record.tier = tier;
  return { roll, dc, success, tier, margin: roll.total - dc, autoFailed: auto };
}

export interface ContestSide {
  creature: Creature;
  skill?: Skill;
  ability?: Ability;
  situation?: CheckSituation;
}

export interface ContestResult {
  a: D20Result;
  b: D20Result;
  /** Kazanan taraf; eşitlikte durum değişmez ("tie"). */
  winner: "a" | "b" | "tie";
}

function contestRoll(ctx: EngineContext, side: ContestSide, reason: string): D20Result {
  const c = side.creature;
  const fx = conditionEffects(c.conditions, c.exhaustion);
  const s = side.situation ?? {};
  const mod = side.skill
    ? skillModifier(c, side.skill, side.ability)
    : abilityModifier(c.abilities[side.ability ?? "str"]);
  return d20Test(ctx, {
    modifier: mod + (s.extraModifier ?? 0),
    advantage: s.advantage,
    disadvantage: s.disadvantage || fx.abilityCheckDisadvantage,
    lucky: c.features.lucky,
    bonusDice: s.bonusDice,
    reason,
    actorId: c.id,
  });
}

/** Karşılıklı kontrol (Gizlilik vs Algı, Atletizm vs Akrobasi …). */
export function contest(ctx: EngineContext, a: ContestSide, b: ContestSide, reason = "karşılıklı kontrol"): ContestResult {
  const ra = contestRoll(ctx, a, `${reason} (saldıran)`);
  const rb = contestRoll(ctx, b, `${reason} (karşı koyan)`);
  const winner = ra.total > rb.total ? "a" : rb.total > ra.total ? "b" : "tie";
  return { a: ra, b: rb, winner };
}

export interface GroupCheckResult {
  results: CheckResult[];
  success: boolean;
  successes: number;
}

/** Grup kontrolü: en az yarısı başarılıysa grup başarılı (SRD). */
export function groupCheck(
  ctx: EngineContext,
  members: Creature[],
  skill: Skill,
  dc: number,
  s: CheckSituation = {},
): GroupCheckResult {
  const results = members.map((m) => skillCheck(ctx, m, skill, dc, s));
  const successes = results.filter((r) => r.success).length;
  const need = ctx.rules.groupCheckHalf ? Math.ceil(members.length / 2) : members.length;
  return { results, success: successes >= need, successes };
}

/** Pasif değer: 10 + mod (avantaj +5, dezavantaj −5). */
export function passiveScore(c: Creature, skill: Skill, advantage = false, disadvantage = false): number {
  const fx = conditionEffects(c.conditions, c.exhaustion);
  let v = 10 + skillModifier(c, skill);
  const adv = advantage && !(disadvantage || fx.abilityCheckDisadvantage);
  const dis = (disadvantage || fx.abilityCheckDisadvantage) && !advantage;
  if (adv) v += 5;
  if (dis) v -= 5;
  return v;
}
