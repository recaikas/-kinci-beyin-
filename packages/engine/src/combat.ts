/**
 * Savaş: inisiyatif, eylem ekonomisi, saldırı atışı, hasar, direnç/zafiyet,
 * geçici HP, 0 HP, ölüm kurtarma atışları, anlık ölüm, konsantrasyon, iyileşme.
 */
import { abilityModifier, type DamageType, proficiencyBonus } from "./core.ts";
import { conditionEffects } from "./conditions.ts";
import { type D20Result, type EngineContext, d20Test } from "./context.ts";
import { type CheckResult, savingThrow } from "./checks.ts";
import { type Encounter, StateError, type StateWriter, type TurnEconomy, type TurnTag } from "./state.ts";
import type { Cover, Creature, Weapon } from "./types.ts";

export const COVER_AC: Record<Cover, number> = { none: 0, half: 2, three_quarters: 5, total: 0 };

/* ------------------------------------------------------------------ */
/* İnisiyatif ve eylem ekonomisi                                       */
/* ------------------------------------------------------------------ */

export function freshEconomy(c: Creature): TurnEconomy {
  const fx = conditionEffects(c.conditions, c.exhaustion);
  const speed = fx.speedZero ? 0 : fx.speedHalved ? Math.floor(c.speed / 2) : c.speed;
  return { action: true, bonusAction: true, reaction: true, movement: speed, tags: [] };
}

export function rollInitiative(ctx: EngineContext, creatures: Creature[]): Encounter["order"] {
  const rows = creatures.map((c) => {
    const r = d20Test(ctx, {
      modifier: abilityModifier(c.abilities.dex),
      lucky: c.features.lucky,
      reason: "inisiyatif",
      actorId: c.id,
    });
    return { id: c.id, initiative: r.total, dex: c.abilities.dex, tie: ctx.die(1000) };
  });
  rows.sort((a, b) => b.initiative - a.initiative || b.dex - a.dex || b.tie - a.tie);
  return rows.map(({ id, initiative }) => ({ id, initiative }));
}

export function startEncounter(ctx: EngineContext, w: StateWriter, ids: string[], encounterId: string): Encounter {
  const creatures = ids.map((id) => w.creature(id)).filter((c) => c.isAlive);
  const order = rollInitiative(ctx, creatures);
  const economy: Record<string, TurnEconomy> = {};
  for (const c of creatures) economy[c.id] = freshEconomy(c);
  const enc: Encounter = { id: encounterId, round: 1, order, turnIndex: 0, active: true, economy };
  w.setEncounter(enc);
  w.event("combat.started", { encounterId, order });
  return enc;
}

/** Sıradaki canlı yaratığa geç; tur başa sararsa raunt artar. */
export function nextTurn(w: StateWriter): string {
  const enc = w.state.encounter;
  if (!enc || !enc.active) throw new StateError("Aktif karşılaşma yok");
  const n = enc.order.length;
  for (let step = 1; step <= n; step++) {
    const idx = (enc.turnIndex + step) % n;
    const id = enc.order[idx]!.id;
    const c = w.state.creatures[id];
    if (!c || !c.isAlive) continue;
    const next: Encounter = structuredClone(enc);
    if (idx <= enc.turnIndex) next.round += 1;
    next.turnIndex = idx;
    next.economy[id] = freshEconomy(c);
    w.setEncounter(next);
    w.event("turn.started", { id, round: next.round });
    return id;
  }
  throw new StateError("Karşılaşmada canlı yaratık kalmadı");
}

export function currentTurnId(enc: Encounter): string {
  return enc.order[enc.turnIndex]!.id;
}

export type EconomySlot = "action" | "bonusAction" | "reaction";

/** Eylem ekonomisinden harca; savaş dışıysa serbest. */
export function spend(w: StateWriter, id: string, slot: EconomySlot, movement = 0): void {
  const enc = w.state.encounter;
  if (!enc || !enc.active) return;
  const eco = enc.economy[id];
  if (!eco) throw new StateError(`${id} bu karşılaşmada değil`);
  if (slot !== "reaction" && currentTurnId(enc) !== id) {
    throw new StateError("Sıra bu yaratıkta değil");
  }
  if (!eco[slot]) throw new StateError(`${slot} bu tur zaten kullanıldı`);
  if (movement > eco.movement) throw new StateError("Yeterli hareket kalmadı");
  const next = structuredClone(enc);
  next.economy[id] = { ...eco, [slot]: false, movement: eco.movement - movement };
  w.setEncounter(next);
}

export function hasTag(w: StateWriter, id: string, tag: TurnTag): boolean {
  return w.state.encounter?.economy[id]?.tags.includes(tag) ?? false;
}

export function setTag(w: StateWriter, id: string, tag: TurnTag, on: boolean): void {
  const enc = w.state.encounter;
  const eco = enc?.economy[id];
  if (!enc || !eco || eco.tags.includes(tag) === on) return;
  const next = structuredClone(enc);
  const tags = on ? [...eco.tags, tag] : eco.tags.filter((t) => t !== tag);
  next.economy[id] = { ...eco, tags };
  w.setEncounter(next);
}

export function endEncounter(w: StateWriter): void {
  const enc = w.state.encounter;
  if (!enc) return;
  w.setEncounter(null);
  w.event("combat.ended", { encounterId: enc.id, rounds: enc.round });
}

/* ------------------------------------------------------------------ */
/* Saldırı                                                             */
/* ------------------------------------------------------------------ */

export interface AttackProfile {
  name: string;
  attackBonus: number;
  /** Hasar notasyonu, değiştirici dahil: "1d8+3". */
  damage: string;
  damageType: DamageType;
  ranged: boolean;
  /** [normal, uzun] menzil (fit). */
  range?: [number, number];
  /** Sinsi Saldırı için: finesse ya da menzilli silah. */
  finesse?: boolean;
  /** Silah saldırısı mı (büyü değil) — Öfke, Sinsi Saldırı, Kutsal Darbe için. */
  weapon?: boolean;
  /** Güç tabanlı yakın dövüş mü (Öfke hasar bonusu). */
  strengthBased?: boolean;
}

/** Yaratık bu silahta yeterli mi? Tanımsız liste = her silahta yeterli (NPC/canavar). */
export function isWeaponProficient(c: Creature, wpn: Weapon): boolean {
  const p = c.weaponProficiencies;
  if (!p || wpn.category === "natural" || wpn.key === "unarmed") return true;
  return p.includes(wpn.key) || (wpn.category !== undefined && p.includes(wpn.category));
}

/** Silah + yaratıktan saldırı profili. thrown: yakın dövüş silahını fırlatma. */
export function weaponProfile(c: Creature, wpn: Weapon, twoHanded = false, thrown = false): AttackProfile {
  const str = abilityModifier(c.abilities.str);
  const dex = abilityModifier(c.abilities.dex);
  const monk = wpn.key === "unarmed" && c.features.martialArtsDie;
  const mod = wpn.ranged && !wpn.thrown ? dex : wpn.finesse || monk ? Math.max(str, dex) : str;
  const magic = wpn.magicBonus ?? 0;
  let dice = twoHanded && wpn.versatile ? wpn.versatile : wpn.damage;
  if (monk) dice = `1d${c.features.martialArtsDie}`;
  // Silahsız vuruş: 1 + GÜÇ (SRD)
  let flat = mod + magic;
  const style = c.features.fightingStyle;
  if (style === "dueling" && !wpn.ranged && !wpn.twoHanded && !twoHanded) flat += 2;
  const prof = isWeaponProficient(c, wpn) ? proficiencyBonus(c.level) : 0;
  const archery = style === "archery" && wpn.ranged && !wpn.thrown ? 2 : 0;
  const ranged = !!wpn.ranged || (thrown && !!wpn.thrown);
  if (thrown && !wpn.thrown) throw new StateError(`${wpn.name} fırlatılamaz`);
  return {
    name: wpn.name,
    attackBonus: mod + prof + magic + archery,
    damage: flat === 0 ? dice : `${dice}${flat > 0 ? "+" : "-"}${Math.abs(flat)}`,
    damageType: wpn.damageType,
    ranged,
    ...(wpn.range && ranged ? { range: wpn.range } : {}),
    finesse: !!wpn.finesse || (!!wpn.ranged && !wpn.thrown),
    weapon: true,
    strengthBased: !ranged && !(wpn.finesse && dex > str) && !monk,
  };
}

/** Yaratığın aktif buff'ları (süresi dolmamış). */
export function activeBuffs(c: Creature, now: number): NonNullable<Creature["buffs"]> {
  return (c.buffs ?? []).filter((b) => b.expiresAt > now);
}

/** Buff'lar dahil etkin AC. */
export function effectiveAc(c: Creature, now: number): number {
  return c.ac + activeBuffs(c, now).reduce((s, b) => s + (b.acBonus ?? 0), 0);
}

export interface AttackSituation {
  advantage?: boolean;
  disadvantage?: boolean;
  cover?: Cover;
  /** Hedefe uzaklık (fit). */
  distance?: number;
  /** Menzilli saldırıda 5 ft içinde düşman var mı. */
  hostileAdjacent?: boolean;
  /** Hedefin yanında saldıranın müttefiki var mı (Sinsi Saldırı). */
  allyAdjacent?: boolean;
  bonusDice?: string[];
  /** İsabette eklenen hasar (Kutsal Darbe). Aynı hasar türüne eklenir. */
  extraDamage?: { dice: string; reason: string }[];
}

export interface AttackResult {
  roll: D20Result;
  targetAc: number;
  hit: boolean;
  crit: boolean;
  damage?: DamageApplied;
  advantageSources: string[];
  disadvantageSources: string[];
  /** Ek hasar kaynakları açıklamaları. */
  extras: string[];
}

export function attack(
  ctx: EngineContext,
  w: StateWriter,
  attackerId: string,
  targetId: string,
  profile: AttackProfile,
  s: AttackSituation = {},
): AttackResult {
  const attacker = w.creature(attackerId);
  const target = w.creature(targetId);
  if (!target.isAlive) throw new StateError(`${target.name} zaten ölü`);
  const cover = s.cover ?? "none";
  if (cover === "total") throw new StateError("Tam siperdeki hedef doğrudan hedeflenemez");

  const af = conditionEffects(attacker.conditions, attacker.exhaustion);
  if (af.incapacitated) throw new StateError(`${attacker.name} eylem yapamaz`);
  const tf = conditionEffects(target.conditions, target.exhaustion);
  const distance = s.distance ?? 5;
  const melee = !profile.ranged;
  const within5 = distance <= 5;

  const adv: string[] = [];
  const dis: string[] = [];
  if (s.advantage) adv.push("durum");
  if (s.disadvantage) dis.push("durum");
  if (af.attackAdvantage) adv.push("saldıran görünmez");
  if (af.attackDisadvantage) dis.push("saldıranın koşulu");
  if (tf.attackedWithAdvantage) adv.push("hedefin koşulu");
  if (tf.attackedWithDisadvantage) dis.push("hedef görünmez");
  if (tf.prone) (within5 ? adv : dis).push("hedef yerde");
  if (profile.ranged && profile.range) {
    if (distance > profile.range[1]) throw new StateError("Hedef azami menzilin dışında");
    if (distance > profile.range[0]) dis.push("uzun menzil");
  }
  if (profile.ranged && s.hostileAdjacent) dis.push("yakında düşman");
  if (hasTag(w, targetId, "dodging")) dis.push("hedef kaçınıyor");
  if (hasTag(w, attackerId, "hidden")) {
    adv.push("saklı saldıran");
    setTag(w, attackerId, "hidden", false);
  }
  if (hasTag(w, attackerId, "helped")) {
    adv.push("yardım");
    setTag(w, attackerId, "helped", false);
  }
  const now = w.state.gameTime;
  const aBuffs = activeBuffs(attacker, now);
  const tBuffs = activeBuffs(target, now);
  if (tBuffs.some((b) => b.revealed)) adv.push("hedef ışıldıyor");
  const bonusDice = [...(s.bonusDice ?? []), ...aBuffs.flatMap((b) => (b.attackDice ? [b.attackDice] : []))];

  const roll = d20Test(ctx, {
    modifier: profile.attackBonus,
    advantage: adv.length > 0,
    disadvantage: dis.length > 0,
    lucky: attacker.features.lucky,
    bonusDice,
    reason: `saldırı: ${profile.name}`,
    actorId: attackerId,
    targetId,
  });
  if (aBuffs.some((b) => b.consumeOnUse && b.attackDice)) {
    removeBuffs(w, attackerId, (b) => !!b.consumeOnUse && !!b.attackDice);
  }
  const targetAc = effectiveAc(target, now) + COVER_AC[cover];
  const critMin = attacker.features.critRange ?? 20;
  const natCrit = roll.natural >= critMin;
  const hit = roll.natural !== 1 && (natCrit || roll.total >= targetAc);
  const crit = hit && (natCrit || (melee && within5 && tf.meleeHitsAreCrits));
  roll.record.tier = !hit ? (roll.natural === 1 ? "critical_failure" : "failure")
    : crit ? "critical_success" : "success";
  roll.record.dc = targetAc;

  const result: AttackResult = { roll, targetAc, hit, crit, advantageSources: adv, disadvantageSources: dis, extras: [] };
  if (hit) {
    let dmg = rollDamage(ctx, profile.damage, crit, {
      extraCritDice: attacker.features.extraCritDice ?? 0,
      savage: attacker.features.savageAttacker ?? false,
      reason: `hasar: ${profile.name}`,
      actorId: attackerId,
      targetId,
    });
    // Öfke vb. sabit hasar bonusu: Güç tabanlı yakın dövüş silah saldırıları.
    if (profile.weapon && profile.strengthBased) {
      const bonus = aBuffs.reduce((sum, b) => sum + (b.damageBonus ?? 0), 0);
      if (bonus) {
        dmg += bonus;
        result.extras.push(`Öfke +${bonus} hasar`);
      }
    }
    // Sinsi Saldırı: finesse/menzilli, avantajlı (ya da hedefin yanında müttefik), turda bir kez.
    const sneak = attacker.features.sneakAttackDice ?? 0;
    const allyAdjacent = s.allyAdjacent ?? false;
    if (sneak > 0 && profile.weapon && profile.finesse && (roll.mode === "advantage" || (allyAdjacent && roll.mode !== "disadvantage"))
      && !hasTag(w, attackerId, "sneak_used")) {
      const extra = rollDamage(ctx, `${sneak}d6`, crit, { reason: "Sinsi Saldırı", actorId: attackerId, targetId });
      dmg += extra;
      result.extras.push(`Sinsi Saldırı +${extra}`);
      setTag(w, attackerId, "sneak_used", true);
    }
    for (const x of s.extraDamage ?? []) {
      const extra = rollDamage(ctx, x.dice, crit, { reason: x.reason, actorId: attackerId, targetId });
      dmg += extra;
      result.extras.push(`${x.reason} +${extra}`);
    }
    result.damage = applyDamage(ctx, w, targetId, dmg, profile.damageType, { crit });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Hasar                                                               */
/* ------------------------------------------------------------------ */

/** Kritikte zar sayılarını ikiye katla: "2d6+3" → "4d6+3". */
export function doubleDice(notation: string): string {
  return notation.replace(/(\d*)d(\d+|%|f)/gi, (_m, n: string, s: string) => `${(n ? Number(n) : 1) * 2}d${s}`);
}

/** Kritik (maks + atış) varyantı: "2d6+3" → "2d6+12+3". */
export function maxPlusRoll(notation: string): string {
  return notation.replace(/(\d*)d(\d+)([a-z!<>=0-9]*)/gi, (m, n: string, s: string) => {
    const count = n ? Number(n) : 1;
    return `${m}+${count * Number(s)}`;
  });
}

function firstDieSides(notation: string): number | null {
  const m = /d(\d+)/i.exec(notation);
  return m ? Number(m[1]) : null;
}

export interface DamageRollOptions {
  extraCritDice?: number;
  savage?: boolean;
  reason?: string;
  actorId?: string;
  targetId?: string;
}

export function rollDamage(ctx: EngineContext, notation: string, crit: boolean, o: DamageRollOptions = {}): number {
  let expr = notation;
  if (crit) {
    expr = ctx.rules.critMaxPlusRoll ? maxPlusRoll(notation) : doubleDice(notation);
    const sides = firstDieSides(notation);
    if (o.extraCritDice && sides) expr += `+${o.extraCritDice}d${sides}`;
  }
  const meta = {
    ...(o.actorId !== undefined && { actorId: o.actorId }),
    ...(o.targetId !== undefined && { targetId: o.targetId }),
  };
  const reason = `${o.reason ?? "hasar"}${crit ? " (kritik)" : ""}`;
  let total = ctx.roll(expr, reason, meta).total;
  if (o.savage) total = Math.max(total, ctx.roll(expr, `${reason} (vahşi saldırgan)`, meta).total);
  return Math.max(0, total);
}

export interface DamageApplied {
  raw: number;
  final: number;
  type: DamageType;
  modifier: "immune" | "resistant" | "vulnerable" | "normal";
  tempAbsorbed: number;
  hpBefore: number;
  hpAfter: number;
  droppedToZero: boolean;
  instantDeath: boolean;
  died: boolean;
  concentration?: CheckResult;
}

export function adjustForType(c: Creature, amount: number, type: DamageType): { final: number; modifier: DamageApplied["modifier"] } {
  const fx = conditionEffects(c.conditions, c.exhaustion);
  if (c.immunities.includes(type)) return { final: 0, modifier: "immune" };
  let final = amount;
  let modifier: DamageApplied["modifier"] = "normal";
  const buffResist = (c.buffs ?? []).some((b) => b.resist?.includes(type));
  if (c.resistances.includes(type) || fx.resistAllDamage || buffResist) {
    final = Math.floor(final / 2);
    modifier = "resistant";
  }
  if (c.vulnerabilities.includes(type)) {
    final *= 2;
    modifier = modifier === "resistant" ? "normal" : "vulnerable";
  }
  return { final, modifier };
}

export function endConcentration(w: StateWriter, id: string, reason: string): void {
  const c = w.creature(id);
  if (!c.spellcasting?.concentratingOn) return;
  const spell = c.spellcasting.concentratingOn;
  w.updateCreature(id, { spellcasting: { ...c.spellcasting, concentratingOn: null } });
  removeConcentrationEffects(w, id, spell);
  w.event("concentration.broken", { id, spell, reason });
}

/** Bir buff'ı kaldır; ona bağlı koşulları da kaldır (başka bir buff aynı koşulu tutmuyorsa). */
export function removeBuffs(w: StateWriter, id: string, pred: (b: NonNullable<Creature["buffs"]>[number]) => boolean): void {
  const c = w.creature(id);
  const buffs = c.buffs ?? [];
  const gone = buffs.filter(pred);
  if (!gone.length) return;
  const keep = buffs.filter((b) => !pred(b));
  w.updateCreature(id, { buffs: keep });
  const stillHeld = new Set(keep.flatMap((b) => b.conditions ?? []));
  for (const cond of gone.flatMap((b) => b.conditions ?? [])) {
    if (!stillHeld.has(cond)) w.removeCondition(id, cond);
  }
}

/** Konsantrasyon bitince o büyünün etkileri (ve bağlı koşulları) kalkar. */
export function removeConcentrationEffects(w: StateWriter, casterId: string, spellKey: string): void {
  for (const other of Object.values(w.state.creatures)) {
    removeBuffs(w, other.id, (b) => b.sourceId === casterId && b.key === spellKey && !!b.concentration);
  }
}

/** Süresi dolan tüm buff'ları kaldır (zaman ilerledikten sonra çağrılır). */
export function pruneExpiredBuffs(w: StateWriter): void {
  const now = w.state.gameTime;
  for (const c of Object.values(w.state.creatures)) {
    if (c.buffs?.some((b) => b.expiresAt <= now)) removeBuffs(w, c.id, (b) => b.expiresAt <= now);
  }
}

function killCreature(w: StateWriter, id: string, cause: string): void {
  const c = w.creature(id);
  endConcentration(w, id, "ölüm");
  w.updateCreature(id, { hp: 0, isAlive: false, deathSaves: { successes: 0, failures: 3, stable: false } });
  w.event("creature.died", { id, name: c.name, cause });
}

export function applyDamage(
  ctx: EngineContext,
  w: StateWriter,
  targetId: string,
  amount: number,
  type: DamageType,
  o: { crit?: boolean } = {},
): DamageApplied {
  const c = w.creature(targetId);
  const { final, modifier } = adjustForType(c, Math.max(0, amount), type);
  const out: DamageApplied = {
    raw: amount, final, type, modifier, tempAbsorbed: 0,
    hpBefore: c.hp, hpAfter: c.hp, droppedToZero: false, instantDeath: false, died: false,
  };
  if (!c.isAlive || final === 0) return out;

  // Zaten 0 HP'de (ölüm atışı yapan oyuncu karakteri).
  if (c.hp === 0) {
    if (final >= c.maxHp) {
      out.instantDeath = out.died = true;
      killCreature(w, targetId, "0 HP'de ağır hasar");
      return out;
    }
    const failures = c.deathSaves.failures + (o.crit ? 2 : 1);
    if (failures >= 3) {
      out.died = true;
      killCreature(w, targetId, "ölüm kurtarma başarısızlıkları");
    } else {
      w.updateCreature(targetId, { deathSaves: { ...c.deathSaves, failures, stable: false } });
    }
    return out;
  }

  let remaining = final;
  if (c.tempHp > 0) {
    out.tempAbsorbed = Math.min(c.tempHp, remaining);
    remaining -= out.tempAbsorbed;
  }
  const hpAfterRaw = c.hp - remaining;
  const tempAfter = c.tempHp - out.tempAbsorbed;

  if (hpAfterRaw > 0) {
    w.updateCreature(targetId, { hp: hpAfterRaw, tempHp: tempAfter });
    out.hpAfter = hpAfterRaw;
    // Konsantrasyon: DC = max(10, hasarın yarısı).
    const fresh = w.creature(targetId);
    if (fresh.spellcasting?.concentratingOn) {
      const dc = Math.max(10, Math.floor(final / 2));
      const save = savingThrow(ctx, fresh, "con", dc, { reason: "konsantrasyon" });
      out.concentration = save;
      if (!save.success) endConcentration(w, targetId, "konsantrasyon kaybı");
    }
    return out;
  }

  // 0 HP'ye düştü.
  const overflow = -hpAfterRaw;
  out.hpAfter = 0;
  out.droppedToZero = true;
  w.updateCreature(targetId, { hp: 0, tempHp: tempAfter });
  if (overflow >= c.maxHp) {
    out.instantDeath = out.died = true;
    killCreature(w, targetId, "anlık ölüm (taşan hasar)");
    return out;
  }
  const relentless = c.resources?.relentless_endurance;
  if (relentless && relentless.current > 0) {
    w.updateCreature(targetId, {
      hp: 1,
      resources: { ...c.resources, relentless_endurance: { ...relentless, current: relentless.current - 1 } },
    });
    out.hpAfter = 1;
    out.droppedToZero = false;
    w.event("creature.revived", { id: targetId, hp: 1, by: "Amansız Dayanıklılık" });
    return out;
  }
  if (c.kind !== "pc" && ctx.rules.monstersDieAtZero) {
    out.died = true;
    killCreature(w, targetId, "0 HP");
    return out;
  }
  endConcentration(w, targetId, "bilinç kaybı");
  w.addCondition(targetId, "unconscious");
  w.updateCreature(targetId, { deathSaves: { successes: 0, failures: 0, stable: false } });
  w.event("creature.dropped", { id: targetId, name: c.name });
  return out;
}

/** İyileştirme: ölüleri diriltmez; 0 HP'den kalkanı uyandırır. */
export function heal(w: StateWriter, id: string, amount: number): number {
  const c = w.creature(id);
  if (!c.isAlive || amount <= 0) return 0;
  const fx = conditionEffects(c.conditions, c.exhaustion);
  const cap = fx.maxHpHalved ? Math.floor(c.maxHp / 2) : c.maxHp;
  const next = Math.min(cap, c.hp + amount);
  const gained = Math.max(0, next - c.hp);
  const wasDown = c.hp === 0;
  w.updateCreature(id, { hp: next });
  if (wasDown && next > 0) {
    w.removeCondition(id, "unconscious");
    w.updateCreature(id, { deathSaves: { successes: 0, failures: 0, stable: false } });
    w.event("creature.revived", { id, hp: next });
  }
  return gained;
}

/** Geçici HP yığılmaz: yüksek olan kalır. */
export function grantTempHp(w: StateWriter, id: string, amount: number): void {
  const c = w.creature(id);
  if (amount > c.tempHp) w.updateCreature(id, { tempHp: amount });
}

export interface DeathSaveResult {
  roll: D20Result;
  outcome: "success" | "failure" | "revived" | "stable" | "dead";
}

export function deathSave(ctx: EngineContext, w: StateWriter, id: string): DeathSaveResult {
  const c = w.creature(id);
  if (!c.isAlive || c.hp > 0 || c.deathSaves.stable) {
    throw new StateError(`${c.name} ölüm kurtarma atışı yapamaz`);
  }
  const roll = d20Test(ctx, {
    modifier: c.features.deathSaveBonus ?? 0,
    lucky: c.features.lucky,
    reason: "ölüm kurtarma atışı",
    actorId: id,
    dc: 10,
  });
  const ds = { ...c.deathSaves };
  if (roll.natural === 20) {
    roll.record.tier = "critical_success";
    heal(w, id, 1);
    return { roll, outcome: "revived" };
  }
  if (roll.natural === 1) ds.failures += 2;
  else if (roll.total >= 10) ds.successes += 1;
  else ds.failures += 1;

  if (ds.failures >= 3) {
    roll.record.tier = "critical_failure";
    killCreature(w, id, "ölüm kurtarma başarısızlıkları");
    return { roll, outcome: "dead" };
  }
  if (ds.successes >= 3) {
    roll.record.tier = "success";
    w.updateCreature(id, { deathSaves: { successes: 0, failures: 0, stable: true } });
    w.event("creature.stabilized", { id });
    return { roll, outcome: "stable" };
  }
  const ok = roll.total >= 10 && roll.natural !== 1;
  roll.record.tier = ok ? "success" : "failure";
  w.updateCreature(id, { deathSaves: ds });
  return { roll, outcome: ok ? "success" : "failure" };
}

/** Stabilize et (Tıp DC 10 başarıyla veya iyileştirici setiyle). */
export function stabilize(w: StateWriter, id: string): void {
  const c = w.creature(id);
  if (!c.isAlive || c.hp > 0) return;
  w.updateCreature(id, { deathSaves: { successes: 0, failures: 0, stable: true } });
  w.event("creature.stabilized", { id });
}
