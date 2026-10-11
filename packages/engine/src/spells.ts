/**
 * Büyü sistemi: yuva tabloları (tam / yarım / pakt), büyü DC'si ve saldırı bonusu,
 * yuva harcama, üst seviyeden atma, cantrip ölçekleme, konsantrasyon ve
 * veri tabanlı büyü çözümü.
 */
import { type Ability, abilityModifier, type DamageType, proficiencyBonus } from "./core.ts";
import type { Condition } from "./conditions.ts";
import type { EngineContext } from "./context.ts";
import { savingThrow } from "./checks.ts";
import { applyDamage, attack, type AttackResult, type DamageApplied, grantTempHp, heal, rollDamage } from "./combat.ts";
import { StateError, type StateWriter } from "./state.ts";
import type { Creature } from "./types.ts";

/** SRD tam büyücü (bard, cleric, druid, sorcerer, wizard) yuva tablosu: seviye → [1..9]. */
export const FULL_CASTER_SLOTS: number[][] = [
  [],
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Yarım büyücü (paladin, ranger): seviye 2'den başlar. */
export const HALF_CASTER_SLOTS: number[][] = [
  [], [], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
  [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
];

/** Warlock pakt büyüsü: seviye → [yuva sayısı, yuva seviyesi]. Kısa dinlenmede yenilenir. */
export const PACT_SLOTS: [number, number][] = [
  [0, 0], [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5],
  [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5],
];

export type CasterType = "full" | "half" | "pact" | "none";

export function slotsFor(type: CasterType, level: number): Partial<Record<number, number>> {
  const lv = Math.max(0, Math.min(20, level));
  const out: Partial<Record<number, number>> = {};
  if (type === "full" || type === "half") {
    const row = (type === "full" ? FULL_CASTER_SLOTS : HALF_CASTER_SLOTS)[lv] ?? [];
    row.forEach((n, i) => { out[i + 1] = n; });
  } else if (type === "pact") {
    const [n, sl] = PACT_SLOTS[lv]!;
    if (n > 0) out[sl] = n;
  }
  return out;
}

export function spellSaveDC(c: Creature, ability: Ability): number {
  return 8 + proficiencyBonus(c.level) + abilityModifier(c.abilities[ability]);
}

export function spellAttackBonus(c: Creature, ability: Ability): number {
  return proficiencyBonus(c.level) + abilityModifier(c.abilities[ability]);
}

/** Cantrip hasar zarı çarpanı: 1 / 2 (5.sv) / 3 (11.sv) / 4 (17.sv). */
export function cantripMultiplier(level: number): number {
  return level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
}

function multiplyDice(notation: string, factor: number): string {
  if (factor === 1) return notation;
  return notation.replace(/(\d*)d(\d+)/gi, (_m, n: string, s: string) => `${(n ? Number(n) : 1) * factor}d${s}`);
}

export interface SpellDef {
  key: string;
  name: string;
  level: number;
  school: string;
  castingTime: "action" | "bonus_action" | "reaction" | "minute" | "ritual";
  rangeFt: number;
  concentration: boolean;
  ritual?: boolean;
  /** Saldırı büyüsü. */
  attack?: "melee" | "ranged";
  /** Kurtarma atışı büyüsü. */
  save?: Ability;
  /** Hasar notasyonu (yetenek modu eklenmez; addAbilityMod ile eklenir). */
  damage?: string;
  damageType?: DamageType;
  halfOnSave?: boolean;
  /** Her üst yuva seviyesi için ek zar: "1d6". */
  upcastDice?: string;
  /** Her üst yuva seviyesi için ek hedef. */
  upcastTargets?: number;
  /** İyileştirme notasyonu. */
  heal?: string;
  /** İyileştirme/hasara büyü yeteneği modunu ekle. */
  addAbilityMod?: boolean;
  /** Başarısız kurtarmada uygulanan koşullar. */
  conditionsOnFail?: Condition[];
  /** Otomatik isabet eden oklar (Magic Missile). */
  autoHitDarts?: { count: number; damage: string };
  tempHp?: string;
  maxTargets?: number;
  /** Anlatıcı için kısa açıklama. */
  summary: string;
}

export interface CastRequest {
  casterId: string;
  spell: SpellDef;
  /** Cantrip için 0; diğerleri için ≥ spell.level. */
  slotLevel: number;
  targetIds: string[];
}

export interface SpellTargetResult {
  targetId: string;
  attack?: AttackResult;
  saveSuccess?: boolean;
  damage?: DamageApplied;
  healed?: number;
  conditionsApplied?: Condition[];
}

export interface CastResult {
  spell: string;
  slotLevel: number;
  targets: SpellTargetResult[];
}

export function expendSlot(w: StateWriter, casterId: string, slotLevel: number): void {
  const c = w.creature(casterId);
  const sc = c.spellcasting;
  if (!sc) throw new StateError(`${c.name} büyü yapamaz`);
  const left = sc.slots[slotLevel] ?? 0;
  if (left <= 0) throw new StateError(`${slotLevel}. seviye büyü yuvası kalmadı`);
  w.updateCreature(casterId, { spellcasting: { ...sc, slots: { ...sc.slots, [slotLevel]: left - 1 } } });
}

export function castSpell(ctx: EngineContext, w: StateWriter, req: CastRequest): CastResult {
  const { spell } = req;
  const caster = w.creature(req.casterId);
  const sc = caster.spellcasting;
  if (!sc) throw new StateError(`${caster.name} büyü yapamaz`);
  if (!sc.known.includes(spell.key)) throw new StateError(`${caster.name} ${spell.name} büyüsünü bilmiyor`);
  if (spell.level > 0 && req.slotLevel < spell.level) throw new StateError("Yuva seviyesi büyüden düşük olamaz");
  if (spell.level === 0 && req.slotLevel !== 0) throw new StateError("Cantrip yuva kullanmaz");

  const upcast = spell.level > 0 ? req.slotLevel - spell.level : 0;
  const maxTargets = (spell.maxTargets ?? 1) + upcast * (spell.upcastTargets ?? 0);
  if (req.targetIds.length > maxTargets && !spell.autoHitDarts) {
    throw new StateError(`En fazla ${maxTargets} hedef seçilebilir`);
  }

  if (spell.level > 0) expendSlot(w, caster.id, req.slotLevel);
  if (spell.concentration) {
    const cur = w.creature(caster.id).spellcasting!;
    if (cur.concentratingOn) w.event("concentration.broken", { id: caster.id, spell: cur.concentratingOn, reason: "yeni büyü" });
    w.updateCreature(caster.id, { spellcasting: { ...cur, concentratingOn: spell.key } });
  }
  w.event("spell.cast", { casterId: caster.id, spell: spell.key, slotLevel: req.slotLevel, targets: req.targetIds });

  const mod = abilityModifier(caster.abilities[sc.ability]);
  const scaleDice = (base: string): string => {
    let n = spell.level === 0 ? multiplyDice(base, cantripMultiplier(caster.level)) : base;
    if (upcast > 0 && spell.upcastDice) n += `+${multiplyDice(spell.upcastDice, upcast)}`;
    if (spell.addAbilityMod && mod !== 0) n += mod > 0 ? `+${mod}` : `-${-mod}`;
    return n;
  };

  const results: SpellTargetResult[] = [];

  // Magic Missile: oklar hedeflere dağıtılır, her ok ayrı hasar.
  if (spell.autoHitDarts) {
    const darts = spell.autoHitDarts.count + upcast;
    for (let i = 0; i < darts; i++) {
      const tid = req.targetIds[i % req.targetIds.length]!;
      const dmg = ctx.roll(spell.autoHitDarts.damage, `${spell.name} ok ${i + 1}`, { actorId: caster.id, targetId: tid }).total;
      const applied = applyDamage(ctx, w, tid, dmg, spell.damageType ?? "force");
      results.push({ targetId: tid, damage: applied });
    }
    return { spell: spell.key, slotLevel: req.slotLevel, targets: results };
  }

  // Alan büyülerinde hasar bir kez atılır, tüm hedeflere uygulanır (SRD).
  const sharedDamage = spell.save && spell.damage
    ? rollDamage(ctx, scaleDice(spell.damage), false, { reason: spell.name, actorId: caster.id })
    : null;

  for (const tid of req.targetIds) {
    const r: SpellTargetResult = { targetId: tid };
    if (spell.attack && spell.damage && spell.damageType) {
      r.attack = attack(ctx, w, caster.id, tid, {
        name: spell.name,
        attackBonus: spellAttackBonus(caster, sc.ability),
        damage: scaleDice(spell.damage),
        damageType: spell.damageType,
        ranged: spell.attack === "ranged",
        range: [spell.rangeFt, spell.rangeFt],
      }, { distance: 5 });
      if (r.attack.damage) r.damage = r.attack.damage;
    } else if (spell.save) {
      const target = w.creature(tid);
      const save = savingThrow(ctx, target, spell.save, spellSaveDC(caster, sc.ability), {
        reason: `${spell.name} kurtarma`,
      });
      r.saveSuccess = save.success;
      if (sharedDamage !== null && spell.damageType) {
        const amount = save.success ? (spell.halfOnSave ? Math.floor(sharedDamage / 2) : 0) : sharedDamage;
        if (amount > 0) r.damage = applyDamage(ctx, w, tid, amount, spell.damageType);
      }
      if (!save.success && spell.conditionsOnFail?.length) {
        r.conditionsApplied = spell.conditionsOnFail.filter((c) => w.addCondition(tid, c));
      }
    }
    if (spell.heal) {
      const amount = ctx.roll(scaleDice(spell.heal), `${spell.name} iyileştirme`, { actorId: caster.id, targetId: tid }).total;
      r.healed = heal(w, tid, amount);
    }
    if (spell.tempHp) {
      const amount = ctx.roll(scaleDice(spell.tempHp), `${spell.name} geçici HP`, { actorId: caster.id, targetId: tid }).total;
      grantTempHp(w, tid, amount);
    }
    results.push(r);
  }
  return { spell: spell.key, slotLevel: req.slotLevel, targets: results };
}
