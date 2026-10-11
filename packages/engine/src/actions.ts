/**
 * Eylem kataloğu ve tur çözücü.
 *
 * LLM niyet çözümleyicisi oyuncu metnini YALNIZCA bu katalogdaki bir eyleme
 * çevirebilir. Çözücü eylemi doğrular, zarları atar, durumu günceller ve
 * anlatıcıya verilecek değişmez gerçekleri (facts) üretir.
 */
import { type Ability, DC, type Skill, SKILL_NAMES_TR, ABILITY_NAMES_TR } from "./core.ts";
import { conditionEffects } from "./conditions.ts";
import { EngineContext, type RollRecord } from "./context.ts";
import { abilityCheck, type CheckResult, passiveScore, skillCheck } from "./checks.ts";
import {
  attack, currentTurnId, deathSave, endEncounter, heal, nextTurn, setTag, spend, stabilize,
  startEncounter, weaponProfile,
} from "./combat.ts";
import { castSpell } from "./spells.ts";
import { longRest, shortRest } from "./progression.ts";
import { APPROACH_TR, ATTITUDE_TR, type RequestRisk, resolveSocial, type SocialApproach } from "./social.ts";
import { type FactionAction, factionTick, resolveFactionAction } from "./faction.ts";
import { type Effect, type GameState, StateError, StateWriter } from "./state.ts";
import { ITEMS, type ItemDef, NATURAL_WEAPONS, SPELLS, WEAPONS } from "./srd/content.ts";
import type { SpellDef } from "./spells.ts";
import type { Cover, ResultTier, Weapon } from "./types.ts";
import type { Rng } from "@kader/dice";
import { DEFAULT_RULES, type RuleOptions } from "./rules.ts";
import { describeEffects } from "./facts.ts";
import { accusative, dative, genitive, locative } from "./tr.ts";

export const DIFFICULTIES = ["very_easy", "easy", "medium", "hard", "very_hard", "nearly_impossible"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_DC: Record<Difficulty, number> = {
  very_easy: DC.VERY_EASY,
  easy: DC.EASY,
  medium: DC.MEDIUM,
  hard: DC.HARD,
  very_hard: DC.VERY_HARD,
  nearly_impossible: DC.NEARLY_IMPOSSIBLE,
};

export type GameAction =
  | { type: "skill_check"; actorId: string; skill: Skill; difficulty: Difficulty; dc?: number; targetId?: string; sense?: "sight" | "hearing"; ability?: Ability; minutes?: number }
  | { type: "ability_check"; actorId: string; ability: Ability; difficulty: Difficulty; dc?: number; minutes?: number }
  | { type: "attack"; actorId: string; targetId: string; weaponKey: string; distance?: number; cover?: Cover; twoHanded?: boolean }
  | { type: "cast_spell"; actorId: string; spellKey: string; slotLevel: number; targetIds: string[] }
  | { type: "social"; actorId: string; targetId: string; approach: SocialApproach; risk: RequestRisk; bribeCp?: number }
  | { type: "move"; actorId: string; toLocationId: string; minutes: number }
  | { type: "use_item"; actorId: string; itemKey: string; targetId?: string }
  | { type: "give_item"; actorId: string; targetId: string; itemKey: string; qty: number }
  | { type: "trade"; actorId: string; targetId: string; itemKey: string; qty: number; priceCp: number; direction: "buy" | "sell" }
  | { type: "rest"; actorId: string; kind: "short" | "long"; hitDice?: Partial<Record<number, number>> }
  | { type: "death_save"; actorId: string }
  | { type: "stabilize"; actorId: string; targetId: string; useKit?: boolean }
  | { type: "start_combat"; actorId: string; participantIds: string[] }
  | { type: "end_turn"; actorId: string }
  | { type: "end_combat"; actorId: string }
  | { type: "dodge"; actorId: string }
  | { type: "dash"; actorId: string }
  | { type: "disengage"; actorId: string }
  | { type: "help"; actorId: string; allyId: string }
  | { type: "hide"; actorId: string }
  | { type: "look"; actorId: string }
  | { type: "talk"; actorId: string; targetId?: string; minutes?: number }
  | { type: "wait"; actorId: string; minutes: number }
  | { type: "faction_action"; actorId: string; action: FactionAction }
  | { type: "time_skip"; actorId: string; days: number; factionIds: string[] };

export type ActionType = GameAction["type"];

export interface Catalog {
  weapons: Record<string, Weapon>;
  spells: Record<string, SpellDef>;
  items: Record<string, ItemDef>;
}

export const DEFAULT_CATALOG: Catalog = {
  weapons: { ...WEAPONS, ...NATURAL_WEAPONS },
  spells: SPELLS,
  items: ITEMS,
};

/** Anlatıcıya giden yapılandırılmış sonuç. */
export interface Outcome {
  /** Eylemin genel kademesi (zar yoksa "success"). */
  tier: ResultTier;
  /** Tek cümlelik mekanik özet. */
  headline: string;
  /** Değişmez gerçekler: anlatıcı bunlarla çelişemez. */
  facts: string[];
  /** Eyleme özgü ayrıntılar (UI ve hafıza için). */
  details: Record<string, unknown>;
}

export interface TurnResolution {
  ok: boolean;
  action: GameAction;
  error?: string;
  outcome: Outcome;
  rolls: RollRecord[];
  effects: Effect[];
  state: GameState;
}

export interface ResolveOptions {
  rng: Rng;
  rules?: RuleOptions;
  catalog?: Catalog;
  /** Karşılaşma kimliği üretimi (DB'de uuid). */
  newId?: () => string;
}

const name = (w: StateWriter, id: string) => w.state.creatures[id]?.name ?? id;

function tierHeadline(t: ResultTier): string {
  return {
    critical_failure: "kritik başarısızlık",
    failure: "başarısızlık",
    partial: "kısmi başarı (bedeli var)",
    success: "başarı",
    critical_success: "kritik başarı",
  }[t];
}

function checkFact(label: string, r: CheckResult): string {
  return `${label}: ${r.roll.record.breakdown} vs DC ${r.dc} → ${tierHeadline(r.tier)}${r.autoFailed ? " (otomatik başarısız)" : ""}`;
}

function requireActorCanAct(w: StateWriter, id: string): void {
  const c = w.creature(id);
  if (!c.isAlive) throw new StateError(`${c.name} ölü`);
  const fx = conditionEffects(c.conditions, c.exhaustion);
  if (fx.incapacitated) throw new StateError(`${c.name} şu an eylem yapamaz`);
}

function inCombat(w: StateWriter): boolean {
  return !!w.state.encounter?.active;
}

/** Tek bir eylemi çöz. Hata olursa durum değişmez, ok=false döner. */
export function resolveAction(state: GameState, action: GameAction, o: ResolveOptions): TurnResolution {
  const ctx = new EngineContext(o.rng, o.rules ?? DEFAULT_RULES);
  const w = new StateWriter(state);
  const catalog = o.catalog ?? DEFAULT_CATALOG;
  const newId = o.newId ?? (() => crypto.randomUUID());
  try {
    const outcome = run(ctx, w, action, catalog, newId);
    outcome.facts.push(...describeEffects(w.effects, w.state));
    return { ok: true, action, outcome, rolls: ctx.rolls, effects: w.effects, state: w.state };
  } catch (e) {
    if (e instanceof StateError) {
      return {
        ok: false,
        action,
        error: e.message,
        outcome: { tier: "failure", headline: `Eylem geçersiz: ${e.message}`, facts: [], details: {} },
        rolls: [],
        effects: [],
        state,
      };
    }
    throw e;
  }
}

function run(ctx: EngineContext, w: StateWriter, a: GameAction, cat: Catalog, newId: () => string): Outcome {
  switch (a.type) {
    case "skill_check": {
      requireActorCanAct(w, a.actorId);
      spend(w, a.actorId, "action");
      const dc = a.dc ?? DIFFICULTY_DC[a.difficulty];
      const r = skillCheck(ctx, w.creature(a.actorId), a.skill, dc, {
        ...(a.sense ? { sense: a.sense } : {}),
        ...(a.targetId ? { targetId: a.targetId } : {}),
        reason: `${SKILL_NAMES_TR[a.skill]} kontrolü`,
      }, a.ability);
      if (!inCombat(w)) w.advanceTime(a.minutes ?? 1);
      return {
        tier: r.tier,
        headline: `${name(w, a.actorId)} — ${SKILL_NAMES_TR[a.skill]}: ${tierHeadline(r.tier)}`,
        facts: [checkFact(`${name(w, a.actorId)} ${SKILL_NAMES_TR[a.skill]}`, r)],
        details: { dc, total: r.roll.total, natural: r.roll.natural, margin: r.margin },
      };
    }

    case "ability_check": {
      requireActorCanAct(w, a.actorId);
      spend(w, a.actorId, "action");
      const dc = a.dc ?? DIFFICULTY_DC[a.difficulty];
      const r = abilityCheck(ctx, w.creature(a.actorId), a.ability, dc, { reason: `${ABILITY_NAMES_TR[a.ability]} kontrolü` });
      if (!inCombat(w)) w.advanceTime(a.minutes ?? 1);
      return {
        tier: r.tier,
        headline: `${name(w, a.actorId)} — ${ABILITY_NAMES_TR[a.ability]}: ${tierHeadline(r.tier)}`,
        facts: [checkFact(`${name(w, a.actorId)} ${ABILITY_NAMES_TR[a.ability]}`, r)],
        details: { dc, total: r.roll.total, natural: r.roll.natural, margin: r.margin },
      };
    }

    case "attack": {
      requireActorCanAct(w, a.actorId);
      const wpn = cat.weapons[a.weaponKey];
      if (!wpn) throw new StateError(`Bilinmeyen silah: ${a.weaponKey}`);
      const attacker = w.creature(a.actorId);
      const carries = attacker.kind !== "pc" || a.weaponKey === "unarmed" || w.itemQty(a.actorId, a.weaponKey) > 0;
      if (!carries) throw new StateError(`${attacker.name} elinde ${wpn.name} yok`);
      spend(w, a.actorId, "action");
      const r = attack(ctx, w, a.actorId, a.targetId, weaponProfile(attacker, wpn, a.twoHanded), {
        ...(a.distance !== undefined ? { distance: a.distance } : {}),
        ...(a.cover ? { cover: a.cover } : {}),
      });
      const tier: ResultTier = !r.hit ? (r.roll.natural === 1 ? "critical_failure" : "failure") : r.crit ? "critical_success" : "success";
      const facts = [
        `${attacker.name} → ${name(w, a.targetId)} (${wpn.name}): ${r.roll.record.breakdown} vs AC ${r.targetAc} → ${r.crit ? "KRİTİK İSABET" : r.hit ? "isabet" : "ıska"}`,
      ];
      if (r.advantageSources.length) facts.push(`Avantaj kaynakları: ${r.advantageSources.join(", ")}`);
      if (r.disadvantageSources.length) facts.push(`Dezavantaj kaynakları: ${r.disadvantageSources.join(", ")}`);
      if (r.damage) {
        const d = r.damage;
        facts.push(`Hasar: ${d.final} ${d.type}${d.modifier !== "normal" ? ` (${d.modifier})` : ""}; HP ${d.hpBefore} → ${d.hpAfter}`);
        if (d.concentration) facts.push(checkFact("Konsantrasyon kurtarması", d.concentration));
      }
      return {
        tier,
        headline: `${attacker.name} ${name(w, a.targetId)} hedefine saldırdı: ${r.crit ? "kritik isabet" : r.hit ? "isabet" : "ıska"}`,
        facts,
        details: { hit: r.hit, crit: r.crit, damage: r.damage?.final ?? 0, died: r.damage?.died ?? false },
      };
    }

    case "cast_spell": {
      requireActorCanAct(w, a.actorId);
      const spell = cat.spells[a.spellKey];
      if (!spell) throw new StateError(`Bilinmeyen büyü: ${a.spellKey}`);
      const slot = spell.castingTime === "bonus_action" ? "bonusAction" : spell.castingTime === "reaction" ? "reaction" : "action";
      spend(w, a.actorId, slot);
      const r = castSpell(ctx, w, { casterId: a.actorId, spell, slotLevel: a.slotLevel, targetIds: a.targetIds });
      const facts = [`${name(w, a.actorId)} ${spell.name} büyüsünü ${a.slotLevel > 0 ? `${a.slotLevel}. seviye yuvayla ` : ""}yaptı. (${spell.summary})`];
      let anySuccess = false;
      for (const t of r.targets) {
        const parts: string[] = [];
        if (t.attack) parts.push(`${t.attack.roll.record.breakdown} vs AC ${t.attack.targetAc} → ${t.attack.crit ? "kritik" : t.attack.hit ? "isabet" : "ıska"}`);
        if (t.saveSuccess !== undefined) parts.push(`kurtarma ${t.saveSuccess ? "başarılı" : "başarısız"}`);
        if (t.damage) parts.push(`${t.damage.final} ${t.damage.type} hasar (HP ${t.damage.hpBefore} → ${t.damage.hpAfter})`);
        if (t.healed !== undefined) parts.push(`${t.healed} HP iyileşti`);
        if (t.conditionsApplied?.length) parts.push(`koşul: ${t.conditionsApplied.join(", ")}`);
        facts.push(`${name(w, t.targetId)}: ${parts.join("; ") || "etkilendi"}`);
        if (t.damage?.final || t.healed || t.conditionsApplied?.length || t.attack?.hit) anySuccess = true;
      }
      return {
        tier: anySuccess ? "success" : "failure",
        headline: `${name(w, a.actorId)}: ${spell.name}`,
        facts,
        details: { spell: spell.key, slotLevel: a.slotLevel, targets: r.targets.length },
      };
    }

    case "social": {
      requireActorCanAct(w, a.actorId);
      const target = w.creature(a.targetId);
      if (!target.isAlive) throw new StateError(`${target.name} ölü`);
      const r = resolveSocial(ctx, w, {
        actorId: a.actorId, targetId: a.targetId, approach: a.approach, risk: a.risk,
        ...(a.bribeCp ? { bribeCp: a.bribeCp } : {}),
      });
      if (!inCombat(w)) w.advanceTime(5);
      const facts = [
        r.check ? checkFact(`${name(w, a.actorId)} → ${target.name} (${APPROACH_TR[a.approach]})`, r.check)
          : `${target.name} isteği zar gerektirmeden ${r.tier === "success" ? "kabul etti" : "kesinlikle reddetti"} (DC ${r.dc})`,
        `${genitive(target.name)} tutumu: ${ATTITUDE_TR[r.attitude]}${r.newAttitude !== r.attitude ? ` → ${ATTITUDE_TR[r.newAttitude]}` : " (değişmedi)"}`,
      ];
      return {
        tier: r.tier,
        headline: `${name(w, a.actorId)} → ${target.name} (${APPROACH_TR[a.approach]}): ${tierHeadline(r.tier)}`,
        facts,
        details: { dc: r.dc, relationshipDelta: r.relationshipDelta, bribeSpentCp: r.bribeSpentCp },
      };
    }

    case "move": {
      requireActorCanAct(w, a.actorId);
      if (inCombat(w)) throw new StateError("Savaş sırasında bölge değiştirilemez; önce savaşı bitir veya kaç");
      w.move(a.actorId, a.toLocationId);
      w.advanceTime(Math.max(1, a.minutes));
      return { tier: "success", headline: `${name(w, a.actorId)} yeni konuma geçti`, facts: [], details: { to: a.toLocationId } };
    }

    case "use_item": {
      requireActorCanAct(w, a.actorId);
      const item = cat.items[a.itemKey];
      if (!item) throw new StateError(`Bilinmeyen eşya: ${a.itemKey}`);
      if (w.itemQty(a.actorId, a.itemKey) < 1) throw new StateError(`${name(w, a.actorId)} envanterinde ${item.name} yok`);
      spend(w, a.actorId, "action");
      const target = a.targetId ?? a.actorId;
      const facts: string[] = [];
      if (item.heal) {
        const amt = ctx.roll(item.heal, `${item.name}`, { actorId: a.actorId, targetId: target }).total;
        const gained = heal(w, target, amt);
        facts.push(`${item.name}: ${name(w, target)} ${gained} HP iyileşti`);
      } else {
        facts.push(`${item.name} kullanıldı (mekanik etkisi yok; anlatısal kullanım)`);
      }
      if (item.consumable) w.removeItem(a.actorId, a.itemKey, 1);
      return { tier: "success", headline: `${name(w, a.actorId)} ${item.name} kullandı`, facts, details: { item: item.key } };
    }

    case "give_item": {
      if (a.qty <= 0) throw new StateError("Miktar pozitif olmalı");
      w.removeItem(a.actorId, a.itemKey, a.qty);
      w.addItem(a.targetId, a.itemKey, a.qty);
      return { tier: "success", headline: `${name(w, a.actorId)} ${dative(name(w, a.targetId))} eşya verdi`, facts: [], details: {} };
    }

    case "trade": {
      if (a.qty <= 0 || a.priceCp < 0) throw new StateError("Geçersiz ticaret");
      const [buyer, seller] = a.direction === "buy" ? [a.actorId, a.targetId] : [a.targetId, a.actorId];
      w.removeItem(seller, a.itemKey, a.qty);
      w.adjustWallet(buyer, -a.priceCp);
      w.adjustWallet(seller, a.priceCp);
      w.addItem(buyer, a.itemKey, a.qty);
      w.advanceTime(10);
      return { tier: "success", headline: `Ticaret tamamlandı`, facts: [], details: { priceCp: a.priceCp } };
    }

    case "rest": {
      if (inCombat(w)) throw new StateError("Savaş sırasında dinlenilemez");
      if (a.kind === "short") {
        const healed = shortRest(ctx, w, a.actorId, a.hitDice ?? {});
        return { tier: "success", headline: `${name(w, a.actorId)} kısa dinlendi`, facts: [`Kısa dinlenmede ${healed} HP iyileşti`], details: { healed } };
      }
      longRest(ctx, w, a.actorId);
      return { tier: "success", headline: `${name(w, a.actorId)} uzun dinlendi`, facts: ["Uzun dinlenme: HP, büyü yuvaları ve hit dice'ların yarısı yenilendi"], details: {} };
    }

    case "death_save": {
      const r = deathSave(ctx, w, a.actorId);
      const tr: Record<typeof r.outcome, ResultTier> = {
        success: "success", failure: "failure", revived: "critical_success", stable: "success", dead: "critical_failure",
      };
      return {
        tier: tr[r.outcome],
        headline: `${name(w, a.actorId)} ölüm kurtarma atışı: ${r.outcome}`,
        facts: [`Ölüm kurtarma atışı: ${r.roll.record.breakdown} → ${r.outcome}`],
        details: { outcome: r.outcome },
      };
    }

    case "stabilize": {
      requireActorCanAct(w, a.actorId);
      spend(w, a.actorId, "action");
      const t = w.creature(a.targetId);
      if (t.hp > 0 || !t.isAlive) throw new StateError(`${t.name} stabilize edilmeye ihtiyaç duymuyor`);
      if (a.useKit) {
        w.removeItem(a.actorId, "healers_kit", 1);
        stabilize(w, a.targetId);
        return { tier: "success", headline: `${t.name} şifacı setiyle stabilize edildi`, facts: [], details: {} };
      }
      const r = skillCheck(ctx, w.creature(a.actorId), "medicine", 10, { reason: "stabilize", targetId: a.targetId });
      if (r.success) stabilize(w, a.targetId);
      return { tier: r.tier, headline: `${name(w, a.actorId)} ${accusative(t.name)} stabilize etmeye çalıştı`, facts: [checkFact("Tıp (stabilize)", r)], details: {} };
    }

    case "start_combat": {
      if (inCombat(w)) throw new StateError("Zaten savaş var");
      const ids = Array.from(new Set([a.actorId, ...a.participantIds]));
      const enc = startEncounter(ctx, w, ids, newId());
      const order = enc.order.map((o) => `${name(w, o.id)} (${o.initiative})`).join(", ");
      return { tier: "success", headline: "Savaş başladı", facts: [`İnisiyatif sırası: ${order}`, `İlk sıra: ${name(w, currentTurnId(enc))}`], details: { order: enc.order } };
    }

    case "end_turn": {
      const enc = w.state.encounter;
      if (!enc?.active) throw new StateError("Aktif savaş yok");
      if (currentTurnId(enc) !== a.actorId) throw new StateError("Sıra bu yaratıkta değil");
      const next = nextTurn(w);
      return { tier: "success", headline: `Sıra ${locative(name(w, next))}`, facts: [`Raunt ${w.state.encounter!.round}, sıra: ${name(w, next)}`], details: { next } };
    }

    case "end_combat": {
      const enc = w.state.encounter;
      if (!enc?.active) throw new StateError("Aktif savaş yok");
      endEncounter(w);
      w.advanceTime(Math.max(1, Math.ceil(enc.round / 10)));
      return { tier: "success", headline: "Savaş sona erdi", facts: [`Savaş ${enc.round} raunt sürdü`], details: {} };
    }

    case "dodge":
    case "disengage": {
      requireActorCanAct(w, a.actorId);
      spend(w, a.actorId, "action");
      setTag(w, a.actorId, a.type === "dodge" ? "dodging" : "disengaged", true);
      return { tier: "success", headline: `${name(w, a.actorId)} ${a.type === "dodge" ? "kaçınmaya odaklandı" : "geri çekildi"}`, facts: [], details: {} };
    }

    case "dash": {
      requireActorCanAct(w, a.actorId);
      spend(w, a.actorId, "action");
      const enc = w.state.encounter;
      if (enc?.active) {
        const eco = enc.economy[a.actorId]!;
        const next = structuredClone(enc);
        next.economy[a.actorId] = { ...eco, movement: eco.movement + w.creature(a.actorId).speed };
        w.setEncounter(next);
      }
      return { tier: "success", headline: `${name(w, a.actorId)} koştu`, facts: [], details: {} };
    }

    case "help": {
      requireActorCanAct(w, a.actorId);
      spend(w, a.actorId, "action");
      setTag(w, a.allyId, "helped", true);
      return { tier: "success", headline: `${name(w, a.actorId)} ${dative(name(w, a.allyId))} yardım ediyor`, facts: [`${name(w, a.allyId)} sonraki saldırısında avantajlı`], details: {} };
    }

    case "hide": {
      requireActorCanAct(w, a.actorId);
      spend(w, a.actorId, "action");
      const watchers = Object.values(w.state.creatures).filter((c) =>
        c.isAlive && c.id !== a.actorId && c.locationId === w.creature(a.actorId).locationId &&
        w.relationship(a.actorId, c.id) < 0);
      const dc = watchers.length ? Math.max(...watchers.map((c) => passiveScore(c, "perception"))) : DC.VERY_EASY;
      const r = skillCheck(ctx, w.creature(a.actorId), "stealth", dc, { reason: "saklanma" });
      if (r.success) setTag(w, a.actorId, "hidden", true);
      return { tier: r.tier, headline: `${name(w, a.actorId)} saklanmaya çalıştı`, facts: [checkFact("Gizlilik vs pasif Algı", r)], details: { dc } };
    }

    case "look": {
      const me = w.creature(a.actorId);
      const pp = passiveScore(me, "perception");
      return {
        tier: "success",
        headline: `${me.name} çevreyi inceliyor`,
        facts: [`${genitive(me.name)} pasif Algısı ${pp}; bu değerin altındaki gizli şeyler fark edilir`],
        details: { passivePerception: pp },
      };
    }

    case "talk": {
      w.advanceTime(a.minutes ?? 2);
      return { tier: "success", headline: "Konuşma", facts: [], details: {} };
    }

    case "wait": {
      if (inCombat(w)) throw new StateError("Savaşta beklemek için turu bitir");
      w.advanceTime(Math.max(1, a.minutes));
      return { tier: "success", headline: `${a.minutes} dakika geçti`, facts: [], details: {} };
    }

    case "faction_action": {
      const r = resolveFactionAction(ctx, w, a.action);
      return {
        tier: r.tier,
        headline: `${w.faction(a.action.actorId).name}: ${a.action.type} → ${tierHeadline(r.tier)}`,
        facts: [`Fraksiyon eylemi ${a.action.type}: ${tierHeadline(r.tier)}`],
        details: r.details,
      };
    }

    case "time_skip": {
      if (inCombat(w)) throw new StateError("Savaş sırasında zaman atlanamaz");
      if (a.days < 1 || a.days > 366) throw new StateError("Zaman atlama 1–366 gün olmalı");
      const reports = a.factionIds.map((id) => factionTick(w, id, a.days));
      w.advanceTime(a.days * 24 * 60);
      const facts = reports.map((r) =>
        `${w.faction(r.factionId).name}: gelir ${r.income} gp, gider ${r.upkeep} gp, nüfus ${r.populationDelta >= 0 ? "+" : ""}${r.populationDelta}, istikrar ${r.stabilityDelta >= 0 ? "+" : ""}${r.stabilityDelta}${r.deserters ? `, ${r.deserters} asker firar etti` : ""}`);
      return { tier: "success", headline: `${a.days} gün geçti`, facts, details: { reports } };
    }
  }
}
