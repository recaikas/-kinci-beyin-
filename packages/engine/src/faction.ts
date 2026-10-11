/**
 * Strateji katmanı (Pax Historia tarzı makro oyun) — ama deterministik:
 * fraksiyon istatistikleri tabloda, makro eylemler zarla, zaman atlama formülle.
 * LLM yalnızca fraksiyon niyetini katalogdan önerir ve sonucu "rapor" olarak anlatır.
 */
import { abilityModifier } from "./core.ts";
import type { EngineContext } from "./context.ts";
import { d20Test } from "./context.ts";
import { tierFor } from "./checks.ts";
import { type Faction, StateError, type StateWriter } from "./state.ts";
import type { ResultTier } from "./types.ts";

export type FactionTrait = keyof Faction["traits"];

export function traitMod(f: Faction, t: FactionTrait): number {
  return abilityModifier(f.traits[t] ?? 10);
}

export type FactionActionType = "diplomacy" | "trade" | "espionage" | "reform" | "war" | "fortify" | "recruit";

export const FACTION_ACTION_TR: Record<FactionActionType, string> = {
  diplomacy: "diplomasi", trade: "ticaret", espionage: "casusluk", reform: "reform", war: "savaş", fortify: "tahkimat", recruit: "askere alma",
};

export interface FactionAction {
  type: FactionActionType;
  actorId: string;
  targetId?: string;
  /** Harcanan altın (recruit, fortify, reform). */
  investment?: number;
}

export interface FactionActionResult {
  type: FactionActionType;
  tier: ResultTier;
  success: boolean;
  details: Record<string, unknown>;
}

const SOLDIER_COST_GP = 10;
const TROOPS_PER_DIE = 1000;
const CASUALTIES_PER_HIT = 250;

function requireTarget(a: FactionAction): string {
  if (!a.targetId) throw new StateError(`${a.type} eylemi hedef fraksiyon gerektirir`);
  if (a.targetId === a.actorId) throw new StateError("Fraksiyon kendini hedef alamaz");
  return a.targetId;
}

function check(ctx: EngineContext, f: Faction, trait: FactionTrait, dc: number, extra: number, reason: string, targetId?: string) {
  const roll = d20Test(ctx, {
    modifier: traitMod(f, trait) + extra,
    reason,
    actorId: f.id,
    dc,
    ...(targetId ? { targetId } : {}),
  });
  const tier = tierFor(roll.total, dc, roll.natural, ctx.rules);
  roll.record.tier = tier;
  return { roll, tier, success: tier === "success" || tier === "critical_success" };
}

export function resolveFactionAction(ctx: EngineContext, w: StateWriter, a: FactionAction): FactionActionResult {
  const actor = w.faction(a.actorId);
  switch (a.type) {
    case "diplomacy": {
      const tid = requireTarget(a);
      const target = w.faction(tid);
      const rel = w.relationship(actor.id, tid);
      if (actor.atWarWith.includes(tid)) {
        // Barış teklifi
        const dc = 15 - Math.floor(rel / 10) + Math.floor((target.military - actor.military) / 5000);
        const r = check(ctx, actor, "diplomacy", dc, 0, "barış teklifi", tid);
        if (r.success) {
          w.updateFaction(actor.id, { atWarWith: actor.atWarWith.filter((x) => x !== tid) });
          w.updateFaction(tid, { atWarWith: target.atWarWith.filter((x) => x !== actor.id) });
          w.adjustRelationship(actor.id, tid, 15);
          w.event("faction.treaty", { a: actor.id, b: tid, kind: "peace" });
        } else {
          w.adjustRelationship(actor.id, tid, -5);
        }
        return { type: a.type, tier: r.tier, success: r.success, details: { kind: "peace", dc, roll: r.roll.total } };
      }
      const dc = 18 - Math.floor(rel / 8);
      const r = check(ctx, actor, "diplomacy", dc, 0, "ittifak teklifi", tid);
      if (r.success && !actor.alliances.includes(tid)) {
        w.updateFaction(actor.id, { alliances: [...actor.alliances, tid] });
        w.updateFaction(tid, { alliances: [...target.alliances, actor.id] });
        w.event("faction.treaty", { a: actor.id, b: tid, kind: "alliance" });
      }
      w.adjustRelationship(actor.id, tid, r.success ? 10 : r.tier === "critical_failure" ? -15 : -3);
      return { type: a.type, tier: r.tier, success: r.success, details: { kind: "alliance", dc, roll: r.roll.total } };
    }

    case "trade": {
      const tid = requireTarget(a);
      const target = w.faction(tid);
      if (actor.atWarWith.includes(tid)) throw new StateError("Savaştaki fraksiyonla ticaret yapılamaz");
      const rel = w.relationship(actor.id, tid);
      const dc = 13 - Math.floor(rel / 10);
      const r = check(ctx, actor, "stewardship", dc, 0, "ticaret anlaşması", tid);
      let gain = 0;
      if (r.success) {
        gain = Math.floor(Math.min(actor.population, target.population) * 0.002 * (r.tier === "critical_success" ? 2 : 1));
        w.updateFaction(actor.id, { treasury: actor.treasury + gain });
        w.updateFaction(tid, { treasury: target.treasury + Math.floor(gain / 2) });
        w.adjustRelationship(actor.id, tid, 5);
      }
      return { type: a.type, tier: r.tier, success: r.success, details: { dc, gain } };
    }

    case "espionage": {
      const tid = requireTarget(a);
      const target = w.faction(tid);
      const dc = 10 + traitMod(target, "intrigue") + Math.floor(target.intelligence / 20);
      const r = check(ctx, actor, "intrigue", dc, Math.floor(actor.intelligence / 20), "casusluk", tid);
      const discovered = r.tier === "critical_failure" || r.tier === "failure";
      if (discovered) w.adjustRelationship(actor.id, tid, r.tier === "critical_failure" ? -25 : -8);
      const revealed = r.success
        ? { treasury: target.treasury, military: target.military, stability: target.stability, alliances: target.alliances }
        : null;
      return { type: a.type, tier: r.tier, success: r.success, details: { dc, discovered, revealed } };
    }

    case "reform": {
      const cost = a.investment ?? 0;
      if (cost > actor.treasury) throw new StateError("Hazinede yeterli altın yok");
      const dc = 15 + Math.floor((50 - actor.stability) / 10) - Math.floor(cost / 1000);
      const r = check(ctx, actor, "stewardship", dc, 0, "reform");
      const delta = r.tier === "critical_success" ? 10 : r.success ? 5 : r.tier === "partial" ? 1 : r.tier === "critical_failure" ? -10 : -4;
      w.updateFaction(actor.id, {
        treasury: actor.treasury - cost,
        stability: clamp(actor.stability + delta, 0, 100),
      });
      return { type: a.type, tier: r.tier, success: r.success, details: { dc, stabilityDelta: delta, cost } };
    }

    case "recruit": {
      const cost = a.investment ?? 0;
      if (cost <= 0 || cost > actor.treasury) throw new StateError("Geçersiz askerlik yatırımı");
      const recruits = Math.min(Math.floor(cost / SOLDIER_COST_GP), Math.floor(actor.population * 0.05));
      w.updateFaction(actor.id, {
        treasury: actor.treasury - recruits * SOLDIER_COST_GP,
        military: actor.military + recruits,
        population: actor.population - recruits,
      });
      return { type: a.type, tier: "success", success: true, details: { recruits } };
    }

    case "fortify": {
      const cost = a.investment ?? 0;
      if (cost <= 0 || cost > actor.treasury) throw new StateError("Geçersiz tahkimat yatırımı");
      const tech = Math.min(10, actor.tech + cost / 20000);
      w.updateFaction(actor.id, { treasury: actor.treasury - cost, tech: Math.round(tech * 100) / 100 });
      return { type: a.type, tier: "success", success: true, details: { tech } };
    }

    case "war":
      return resolveBattle(ctx, w, actor.id, requireTarget(a));
  }
}

/**
 * Meydan muharebesi — zar havuzu. Her 1000 asker 1d6; askerî yetenek modu ek zar;
 * teknoloji üstünlüğü başarı eşiğini 5'ten 4'e indirir. Savunan +2 zar.
 * Her başarı karşı tarafa 250 kayıp verdirir. Eşitlikte savunan kazanır.
 */
export function resolveBattle(ctx: EngineContext, w: StateWriter, attackerId: string, defenderId: string): FactionActionResult {
  const att = w.faction(attackerId);
  const def = w.faction(defenderId);
  if (att.military <= 0) throw new StateError(`${att.name} ordusu yok`);

  if (!att.atWarWith.includes(defenderId)) {
    w.updateFaction(attackerId, { atWarWith: [...att.atWarWith, defenderId] });
    w.updateFaction(defenderId, { atWarWith: [...def.atWarWith, attackerId] });
    w.adjustRelationship(attackerId, defenderId, -40);
    w.event("faction.war", { attacker: attackerId, defender: defenderId });
  }

  const pool = (f: Faction, bonus: number) =>
    Math.max(1, Math.min(200, Math.ceil(f.military / TROOPS_PER_DIE) + Math.max(0, traitMod(f, "martial")) + bonus));
  const attPool = pool(att, 0);
  const defPool = pool(def, 2);
  const attTarget = att.tech - def.tech >= 2 ? 4 : 5;
  const defTarget = def.tech - att.tech >= 2 ? 4 : 5;

  const attRoll = ctx.roll(`${attPool}d6>=${attTarget}`, "savaş: saldıran havuzu", { actorId: attackerId, targetId: defenderId });
  const defRoll = def.military > 0
    ? ctx.roll(`${defPool}d6>=${defTarget}`, "savaş: savunan havuzu", { actorId: defenderId, targetId: attackerId })
    : null;
  const attHits = attRoll.total;
  const defHits = defRoll?.total ?? 0;

  const attLoss = Math.min(att.military, defHits * CASUALTIES_PER_HIT);
  const defLoss = Math.min(def.military, attHits * CASUALTIES_PER_HIT);
  const attackerWins = attHits > defHits;
  const margin = attHits - defHits;

  // Fraksiyon nesneleri yukarıdaki updateFaction'larla değişmiş olabilir: güncelini oku.
  const att2 = w.faction(attackerId);
  const def2 = w.faction(defenderId);
  const patchAtt: Partial<Faction> = {
    military: att2.military - attLoss,
    stability: clamp(att2.stability + (attackerWins ? 3 : -5), 0, 100),
  };
  const patchDef: Partial<Faction> = {
    military: def2.military - defLoss,
    stability: clamp(def2.stability + (attackerWins ? -6 : 3), 0, 100),
  };
  let capturedRegion: string | null = null;
  if (attackerWins && margin >= 3 && def2.regionIds.length > 0) {
    capturedRegion = def2.regionIds[def2.regionIds.length - 1]!;
    patchDef.regionIds = def2.regionIds.slice(0, -1);
    patchAtt.regionIds = [...att2.regionIds, capturedRegion];
  }
  w.updateFaction(attackerId, patchAtt);
  w.updateFaction(defenderId, patchDef);

  const tier: ResultTier = attackerWins ? (margin >= 5 ? "critical_success" : "success")
    : margin <= -5 ? "critical_failure" : "failure";
  w.event("faction.event", { kind: "battle", attackerId, defenderId, attHits, defHits, attLoss, defLoss, capturedRegion });
  return {
    type: "war",
    tier,
    success: attackerWins,
    details: { attPool, defPool, attHits, defHits, attLoss, defLoss, capturedRegion },
  };
}

export interface TickReport {
  factionId: string;
  days: number;
  income: number;
  upkeep: number;
  populationDelta: number;
  stabilityDelta: number;
  deserters: number;
}

/**
 * Zaman atlama (1 gün – 1 yıl): ekonomi, nüfus, istikrar formülle ilerler.
 * Rastgelelik yok; olaylar ayrı "olay tablosu" zarlarıyla üretilir.
 */
export function factionTick(w: StateWriter, factionId: string, days: number): TickReport {
  if (days <= 0) throw new RangeError("Gün sayısı pozitif olmalı");
  const f = w.faction(factionId);
  const stabilityFactor = f.stability / 100;
  const income = Math.floor(f.population * 0.01 * days * stabilityFactor * (1 + f.tech * 0.05) * (1 + traitMod(f, "stewardship") * 0.05));
  const upkeep = Math.floor(f.military * 0.02 * days);
  let treasury = f.treasury + income - upkeep;
  let military = f.military;
  let deserters = 0;
  let stability = f.stability;
  if (treasury < 0) {
    deserters = Math.min(military, Math.ceil(-treasury / (0.02 * days || 1)));
    military -= deserters;
    treasury = 0;
    stability -= Math.min(20, Math.ceil(days / 10));
  }
  // İstikrar 50'ye doğru yavaşça kayar; savaş aşındırır.
  const drift = Math.sign(50 - stability) * Math.min(Math.abs(50 - stability), Math.floor(days / 30));
  stability += drift - Math.floor(f.atWarWith.length * days / 15);
  stability = clamp(stability, 0, 100);
  const growthRate = 0.00005 * (stability / 50) - (f.atWarWith.length > 0 ? 0.00002 : 0);
  const populationDelta = Math.floor(f.population * growthRate * days);

  w.updateFaction(factionId, {
    treasury,
    military,
    stability,
    population: Math.max(0, f.population + populationDelta),
  });
  return { factionId, days, income, upkeep, populationDelta, stabilityDelta: stability - f.stability, deserters };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
