/**
 * Sosyal mekanik: NPC tutumu, ilişki puanı, ikna/aldatma/gözdağı DC'si,
 * rüşvet etkisi. (Kendi tablomuz; SRD'nin sosyal kuralları sınırlı.)
 */
import type { Skill } from "./core.ts";
import { type CheckResult, skillCheck } from "./checks.ts";
import type { EngineContext } from "./context.ts";
import type { StateWriter } from "./state.ts";
import type { Attitude, ResultTier } from "./types.ts";

export function attitudeFromScore(score: number): Attitude {
  if (score <= -25) return "hostile";
  if (score >= 25) return "friendly";
  return "indifferent";
}

/** İsteğin NPC için riski. */
export type RequestRisk = "trivial" | "minor" | "significant" | "dangerous" | "unthinkable";

const BASE_DC: Record<Attitude, Record<RequestRisk, number>> = {
  friendly:    { trivial: 0,  minor: 5,  significant: 10, dangerous: 18, unthinkable: 25 },
  indifferent: { trivial: 5,  minor: 10, significant: 15, dangerous: 22, unthinkable: 30 },
  hostile:     { trivial: 10, minor: 15, significant: 22, dangerous: 28, unthinkable: 99 },
};

export type SocialApproach = "persuade" | "deceive" | "intimidate" | "bribe" | "perform";

export const APPROACH_TR: Record<SocialApproach, string> = {
  persuade: "ikna",
  deceive: "aldatma",
  intimidate: "gözdağı",
  bribe: "rüşvet",
  perform: "gösteri",
};

export const ATTITUDE_TR: Record<Attitude, string> = {
  hostile: "düşmanca",
  indifferent: "kayıtsız",
  friendly: "dostça",
};

export const APPROACH_SKILL: Record<SocialApproach, Skill> = {
  persuade: "persuasion",
  deceive: "deception",
  intimidate: "intimidation",
  bribe: "persuasion",
  perform: "performance",
};

export interface SocialInput {
  actorId: string;
  targetId: string;
  approach: SocialApproach;
  risk: RequestRisk;
  /** Rüşvet miktarı (bakır para). */
  bribeCp?: number;
  /** NPC'nin rüşvet hassasiyeti: kaç cp DC'yi 1 düşürür (varsayılan 200 = 2 gp). */
  bribeCpPerPoint?: number;
  /** NPC'nin karakterine göre ek mod (açgözlü, sadık …). */
  npcModifier?: number;
  advantage?: boolean;
  disadvantage?: boolean;
}

export interface SocialResult {
  dc: number;
  attitude: Attitude;
  check: CheckResult | null;
  tier: ResultTier;
  relationshipDelta: number;
  newAttitude: Attitude;
  bribeSpentCp: number;
}

const REL_DELTA: Record<SocialApproach, Record<ResultTier, number>> = {
  persuade:   { critical_failure: -15, failure: -5,  partial: 0,   success: 8,  critical_success: 15 },
  deceive:    { critical_failure: -30, failure: -12, partial: -2,  success: 3,  critical_success: 6 },
  intimidate: { critical_failure: -20, failure: -10, partial: -8,  success: -6, critical_success: -3 },
  bribe:      { critical_failure: -20, failure: -6,  partial: 2,   success: 6,  critical_success: 10 },
  perform:    { critical_failure: -8,  failure: -2,  partial: 2,   success: 6,  critical_success: 12 },
};

export function socialDC(attitude: Attitude, risk: RequestRisk, npcModifier = 0, bribeReduction = 0): number {
  return Math.max(0, BASE_DC[attitude][risk] + npcModifier - bribeReduction);
}

/** Sosyal etkileşimi çöz; rüşvet parası her durumda el değiştirir (başarısızsa da). */
export function resolveSocial(ctx: EngineContext, w: StateWriter, i: SocialInput): SocialResult {
  const actor = w.creature(i.actorId);
  const before = w.relationship(i.actorId, i.targetId);
  const attitude = attitudeFromScore(before);

  let bribeSpentCp = 0;
  let reduction = 0;
  if (i.approach === "bribe" && i.bribeCp && i.bribeCp > 0) {
    w.adjustWallet(i.actorId, -i.bribeCp);
    w.adjustWallet(i.targetId, i.bribeCp);
    bribeSpentCp = i.bribeCp;
    reduction = Math.min(10, Math.floor(i.bribeCp / (i.bribeCpPerPoint ?? 200)));
  }

  const dc = socialDC(attitude, i.risk, i.npcModifier ?? 0, reduction);
  let check: CheckResult | null = null;
  let tier: ResultTier;
  if (dc <= 0) {
    tier = "success";
  } else if (dc >= 99) {
    tier = "failure";
  } else {
    check = skillCheck(ctx, actor, APPROACH_SKILL[i.approach], dc, {
      advantage: i.advantage,
      disadvantage: i.disadvantage,
      reason: `sosyal: ${i.approach}`,
      targetId: i.targetId,
    });
    tier = check.tier;
  }

  const delta = REL_DELTA[i.approach][tier];
  const after = w.adjustRelationship(i.actorId, i.targetId, delta);
  const newAttitude = attitudeFromScore(after);
  if (newAttitude !== attitude) {
    w.event("attitude.changed", { a: i.actorId, b: i.targetId, from: attitude, to: newAttitude });
  }
  return { dc, attitude, check, tier, relationshipDelta: after - before, newAttitude, bribeSpentCp };
}
