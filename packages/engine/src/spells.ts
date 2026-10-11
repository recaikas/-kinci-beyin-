/**
 * Büyü sistemi: yuva tabloları (tam / yarım / pakt), büyü DC'si ve saldırı bonusu,
 * yuva harcama, üst seviyeden atma, cantrip ölçekleme, konsantrasyon ve
 * veri tabanlı büyü çözümü.
 */
import { type Ability, abilityModifier, type DamageType, proficiencyBonus } from "./core.ts";
import type { Condition } from "./conditions.ts";
import type { EngineContext } from "./context.ts";
import { savingThrow } from "./checks.ts";
import {
  applyDamage, attack, type AttackResult, type DamageApplied, endConcentration, grantTempHp,
  heal, rollDamage,
} from "./combat.ts";
import { StateError, type StateWriter } from "./state.ts";
import type { Buff, Creature } from "./types.ts";

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
  /** Bu büyüyü öğrenebilen sınıflar. */
  classes: string[];
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
  /** Koşullu hedef her turunun sonunda kurtarmayı tekrarlar (Kişiyi Tut). */
  repeatSaveEachTurn?: boolean;
  /** Kurtarma olmadan hedefe uygulanan koşullar (Görünmezlik). */
  conditionsApply?: Condition[];
  /** Otomatik isabet eden oklar (Magic Missile). */
  autoHitDarts?: { count: number; damage: string };
  /** Birden çok saldırı ışını (Scorching Ray). Üst yuvada +1 ışın. */
  rays?: { count: number; damage: string };
  tempHp?: string;
  maxTargets?: number;
  /** Hedeflere verilen süreli etki. */
  buff?: Omit<Buff, "sourceId" | "expiresAt" | "key" | "name">;
  /** Başarısız kurtarmada hedefe verilen süreli etki (Bane, Faerie Fire). */
  debuffOnFail?: Omit<Buff, "sourceId" | "expiresAt" | "key" | "name">;
  /** Etki süresi (dakika). */
  durationMin?: number;
  /** Kaldırdığı koşullar (Lesser Restoration). */
  cures?: Condition[];
  /** Uyku havuzu (Sleep): en düşük HP'lilerden başlayarak bilinçsiz eder. */
  sleepPool?: { dice: string; upcastDice: string };
  /** Son 1 dakikada ölen yaratığı 1 HP ile diriltir (Revivify). */
  revive?: boolean;
  /** Büyü Zırhı: zırhsız hedefin AC'si 13 + DEX olur. */
  mageArmor?: boolean;
  /** Mekanik etkisi yok; anlatısal (Light, Mage Hand, Detect Magic …). */
  utility?: boolean;
  /** Anlatıcı için kısa açıklama. */
  summary: string;
}

export interface CastRequest {
  casterId: string;
  spell: SpellDef;
  /** Cantrip için 0; diğerleri için ≥ spell.level. */
  slotLevel: number;
  targetIds: string[];
  /** Parşömenden atılıyorsa yuva harcanmaz ve bilmek gerekmez. */
  fromScroll?: boolean;
}

export interface SpellTargetResult {
  targetId: string;
  attack?: AttackResult;
  saveSuccess?: boolean;
  damage?: DamageApplied;
  healed?: number;
  conditionsApplied?: Condition[];
  conditionsRemoved?: Condition[];
  buffed?: string;
  revived?: boolean;
  slept?: boolean;
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

function addBuff(w: StateWriter, targetId: string, buff: Buff): void {
  const t = w.creature(targetId);
  const others = (t.buffs ?? []).filter((b) => !(b.key === buff.key && b.sourceId === buff.sourceId));
  w.updateCreature(targetId, { buffs: [...others, buff] });
}

export function castSpell(ctx: EngineContext, w: StateWriter, req: CastRequest): CastResult {
  const { spell } = req;
  const caster = w.creature(req.casterId);
  const sc = caster.spellcasting;
  if (!sc && !req.fromScroll) throw new StateError(`${caster.name} büyü yapamaz`);
  if (!req.fromScroll && !sc!.known.includes(spell.key)) throw new StateError(`${caster.name} ${spell.name} büyüsünü bilmiyor`);
  if (spell.level > 0 && req.slotLevel < spell.level) throw new StateError("Yuva seviyesi büyüden düşük olamaz");
  if (spell.level === 0 && req.slotLevel !== 0) throw new StateError("Cantrip yuva kullanmaz");
  if (req.targetIds.length === 0 && !spell.utility) throw new StateError("Büyü için hedef gerekli");
  for (const id of req.targetIds) {
    const t = w.creature(id);
    if (!t.isAlive && !spell.revive) throw new StateError(`${t.name} ölü`);
  }

  const upcast = spell.level > 0 ? req.slotLevel - spell.level : 0;
  const maxTargets = (spell.maxTargets ?? 1) + upcast * (spell.upcastTargets ?? 0);
  if (req.targetIds.length > maxTargets && !spell.autoHitDarts && !spell.rays) {
    throw new StateError(`En fazla ${maxTargets} hedef seçilebilir`);
  }

  if (spell.level > 0 && !req.fromScroll) expendSlot(w, caster.id, req.slotLevel);
  if (spell.concentration) {
    if (w.creature(caster.id).spellcasting?.concentratingOn) endConcentration(w, caster.id, "yeni büyü");
    const cur = w.creature(caster.id).spellcasting;
    if (cur) w.updateCreature(caster.id, { spellcasting: { ...cur, concentratingOn: spell.key } });
  }
  w.event("spell.cast", { casterId: caster.id, spell: spell.key, slotLevel: req.slotLevel, targets: req.targetIds });

  // Parşömende büyü yeteneği yoksa INT kullanılır (basitleştirme).
  const ability: Ability = sc?.ability ?? "int";
  const mod = abilityModifier(caster.abilities[ability]);
  const scaleDice = (base: string): string => {
    let n = spell.level === 0 ? multiplyDice(base, cantripMultiplier(caster.level)) : base;
    if (upcast > 0 && spell.upcastDice) n += `+${multiplyDice(spell.upcastDice, upcast)}`;
    if (spell.addAbilityMod && mod !== 0) n += mod > 0 ? `+${mod}` : `-${-mod}`;
    return n;
  };
  const now = w.state.gameTime;
  const expiresAt = now + (spell.durationMin ?? 1);
  const results: SpellTargetResult[] = [];

  if (spell.utility) {
    return { spell: spell.key, slotLevel: req.slotLevel, targets: req.targetIds.map((targetId) => ({ targetId })) };
  }

  // Magic Missile: oklar hedeflere dağıtılır, her ok ayrı hasar.
  if (spell.autoHitDarts) {
    const darts = spell.autoHitDarts.count + upcast;
    for (let i = 0; i < darts; i++) {
      const tid = req.targetIds[i % req.targetIds.length]!;
      if (!w.creature(tid).isAlive) continue;
      const dmg = ctx.roll(spell.autoHitDarts.damage, `${spell.name} ok ${i + 1}`, { actorId: caster.id, targetId: tid }).total;
      results.push({ targetId: tid, damage: applyDamage(ctx, w, tid, dmg, spell.damageType ?? "force") });
    }
    return { spell: spell.key, slotLevel: req.slotLevel, targets: results };
  }

  // Scorching Ray: her ışın ayrı saldırı atışı.
  if (spell.rays) {
    const rays = spell.rays.count + upcast;
    for (let i = 0; i < rays; i++) {
      const tid = req.targetIds[i % req.targetIds.length]!;
      if (!w.creature(tid).isAlive) continue;
      const a = attack(ctx, w, caster.id, tid, {
        name: `${spell.name} ışını ${i + 1}`,
        attackBonus: spellAttackBonus(caster, ability),
        damage: spell.rays.damage,
        damageType: spell.damageType ?? "fire",
        ranged: true,
        range: [spell.rangeFt, spell.rangeFt],
      }, { distance: 5 });
      results.push({ targetId: tid, attack: a, ...(a.damage ? { damage: a.damage } : {}) });
    }
    return { spell: spell.key, slotLevel: req.slotLevel, targets: results };
  }

  // Sleep: HP havuzu, en düşük HP'liden başlayarak.
  if (spell.sleepPool) {
    let pool = ctx.roll(`${spell.sleepPool.dice}${upcast > 0 ? `+${multiplyDice(spell.sleepPool.upcastDice, upcast)}` : ""}`, spell.name, { actorId: caster.id }).total;
    const targets = req.targetIds.map((id) => w.creature(id))
      .filter((t) => t.isAlive && t.hp > 0 && !t.conditions.includes("unconscious"))
      .sort((a, b) => a.hp - b.hp);
    for (const t of targets) {
      if (t.hp > pool) { results.push({ targetId: t.id, slept: false }); continue; }
      pool -= t.hp;
      w.addCondition(t.id, "unconscious");
      results.push({ targetId: t.id, slept: true, conditionsApplied: ["unconscious"] });
    }
    return { spell: spell.key, slotLevel: req.slotLevel, targets: results };
  }

  // Alan büyülerinde hasar bir kez atılır, tüm hedeflere uygulanır (SRD).
  const sharedDamage = spell.save && spell.damage
    ? rollDamage(ctx, scaleDice(spell.damage), false, { reason: spell.name, actorId: caster.id })
    : null;

  for (const tid of req.targetIds) {
    const r: SpellTargetResult = { targetId: tid };
    if (spell.revive) {
      const t = w.creature(tid);
      if (t.isAlive) throw new StateError(`${t.name} zaten yaşıyor`);
      w.updateCreature(tid, { isAlive: true, hp: 1, deathSaves: { successes: 0, failures: 0, stable: false } });
      w.removeCondition(tid, "unconscious");
      w.event("creature.revived", { id: tid, hp: 1, by: spell.key });
      r.revived = true;
      results.push(r);
      continue;
    }
    if (spell.attack && spell.damage && spell.damageType) {
      r.attack = attack(ctx, w, caster.id, tid, {
        name: spell.name,
        attackBonus: spellAttackBonus(caster, ability),
        damage: scaleDice(spell.damage),
        damageType: spell.damageType,
        ranged: spell.attack === "ranged",
        range: [spell.rangeFt, spell.rangeFt],
      }, { distance: 5 });
      if (r.attack.damage) r.damage = r.attack.damage;
    } else if (spell.save) {
      const target = w.creature(tid);
      const save = savingThrow(ctx, target, spell.save, spellSaveDC(caster, ability), {
        reason: `${spell.name} kurtarma`,
      });
      r.saveSuccess = save.success;
      if (sharedDamage !== null && spell.damageType) {
        const amount = save.success ? (spell.halfOnSave ? Math.floor(sharedDamage / 2) : 0) : sharedDamage;
        if (amount > 0 && w.creature(tid).isAlive) r.damage = applyDamage(ctx, w, tid, amount, spell.damageType);
      }
      if (!save.success && spell.conditionsOnFail?.length && w.creature(tid).isAlive) {
        r.conditionsApplied = spell.conditionsOnFail.filter((c) => w.addCondition(tid, c));
        if (r.conditionsApplied.length) {
          addBuff(w, tid, {
            key: spell.key, name: spell.name, sourceId: caster.id, expiresAt, concentration: spell.concentration,
            conditions: r.conditionsApplied,
            ...(spell.repeatSaveEachTurn ? { repeatSave: { ability: spell.save, dc: spellSaveDC(caster, ability) } } : {}),
          });
        }
      }
      if (!save.success && spell.debuffOnFail) {
        addBuff(w, tid, { ...spell.debuffOnFail, key: spell.key, name: spell.name, sourceId: caster.id, expiresAt, concentration: spell.concentration });
        r.buffed = spell.name;
      }
    }
    if (spell.conditionsApply?.length) {
      r.conditionsApplied = spell.conditionsApply.filter((c) => w.addCondition(tid, c));
      addBuff(w, tid, { key: spell.key, name: spell.name, sourceId: caster.id, expiresAt, concentration: spell.concentration, conditions: r.conditionsApplied });
    }
    if (spell.heal) {
      const amount = ctx.roll(scaleDice(spell.heal), `${spell.name} iyileştirme`, { actorId: caster.id, targetId: tid }).total;
      r.healed = heal(w, tid, amount);
    }
    if (spell.tempHp) {
      const amount = ctx.roll(scaleDice(spell.tempHp), `${spell.name} geçici HP`, { actorId: caster.id, targetId: tid }).total;
      grantTempHp(w, tid, amount);
    }
    if (spell.cures?.length) {
      r.conditionsRemoved = spell.cures.filter((c) => w.removeCondition(tid, c));
    }
    if (spell.buff) {
      addBuff(w, tid, { ...spell.buff, key: spell.key, name: spell.name, sourceId: caster.id, expiresAt, concentration: spell.concentration });
      r.buffed = spell.name;
    }
    if (spell.mageArmor) {
      const t = w.creature(tid);
      const target = 13 + abilityModifier(t.abilities.dex);
      const bonus = Math.max(0, target - t.ac);
      addBuff(w, tid, { key: spell.key, name: spell.name, sourceId: caster.id, expiresAt, acBonus: bonus });
      r.buffed = spell.name;
    }
    results.push(r);
  }
  return { spell: spell.key, slotLevel: req.slotLevel, targets: results };
}
