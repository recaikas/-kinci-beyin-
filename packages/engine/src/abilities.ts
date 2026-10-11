/**
 * Sınıf ve ırk yetenekleri (kaynak harcayan eylemler).
 */
import { abilityModifier, proficiencyBonus } from "./core.ts";
import type { EngineContext } from "./context.ts";
import { savingThrow } from "./checks.ts";
import { applyDamage, attack, heal, removeBuffs, setTag, spend, weaponProfile } from "./combat.ts";
import { StateError, type StateWriter } from "./state.ts";
import type { Buff, Creature, Resource } from "./types.ts";
import { WEAPONS } from "./srd/equipment.ts";
import { dative } from "./tr.ts";

export const CLASS_ABILITIES = [
  "second_wind", "action_surge", "rage", "end_rage", "lay_on_hands", "bardic_inspiration",
  "cunning_action", "flurry_of_blows", "breath_weapon",
] as const;
export type ClassAbility = (typeof CLASS_ABILITIES)[number];

export const CLASS_ABILITY_TR: Record<ClassAbility, string> = {
  second_wind: "İkinci Soluk",
  action_surge: "Eylem Atılımı",
  rage: "Öfke",
  end_rage: "Öfkeyi Bitir",
  lay_on_hands: "Şifa Eli",
  bardic_inspiration: "Ozan İlhamı",
  cunning_action: "Kurnaz Eylem",
  flurry_of_blows: "Darbe Yağmuru",
  breath_weapon: "Nefes Silahı",
};

export interface ClassAbilityInput {
  actorId: string;
  ability: ClassAbility;
  targetId?: string;
  targetIds?: string[];
  /** Şifa Eli: harcanacak puan. */
  amount?: number;
  /** Kurnaz Eylem: dash | disengage | hide. */
  mode?: "dash" | "disengage" | "hide";
}

export interface ClassAbilityResult {
  facts: string[];
  details: Record<string, unknown>;
}

function useResource(w: StateWriter, id: string, key: string, amount = 1): Resource {
  const c = w.creature(id);
  const r = c.resources?.[key];
  if (!r) throw new StateError(`${c.name} bu yeteneğe sahip değil`);
  if (r.current < amount) throw new StateError(`${c.name} için ${key} hakkı kalmadı`);
  const next = { ...r, current: r.current - amount };
  w.updateCreature(id, { resources: { ...c.resources, [key]: next } });
  return next;
}

function addBuff(w: StateWriter, id: string, b: Buff): void {
  const c = w.creature(id);
  w.updateCreature(id, { buffs: [...(c.buffs ?? []).filter((x) => x.key !== b.key), b] });
}

export function useClassAbility(ctx: EngineContext, w: StateWriter, i: ClassAbilityInput): ClassAbilityResult {
  const c: Creature = w.creature(i.actorId);
  const now = w.state.gameTime;
  switch (i.ability) {
    case "second_wind": {
      spend(w, c.id, "bonusAction");
      useResource(w, c.id, "second_wind");
      const amt = ctx.roll(`1d10+${c.level}`, "İkinci Soluk", { actorId: c.id }).total;
      const gained = heal(w, c.id, amt);
      return { facts: [`${c.name} İkinci Soluk ile ${gained} HP kazandı`], details: { healed: gained } };
    }
    case "action_surge": {
      const enc = w.state.encounter;
      if (!enc?.active) throw new StateError("Eylem Atılımı yalnızca savaşta kullanılır");
      useResource(w, c.id, "action_surge");
      const eco = enc.economy[c.id];
      if (!eco) throw new StateError("Savaşta değilsin");
      const next = structuredClone(enc);
      next.economy[c.id] = { ...eco, action: true };
      w.setEncounter(next);
      return { facts: [`${c.name} Eylem Atılımı kullandı: bu tur bir eylem daha`], details: {} };
    }
    case "rage": {
      if ((c.buffs ?? []).some((b) => b.key === "rage")) throw new StateError("Zaten öfkelisin");
      spend(w, c.id, "bonusAction");
      useResource(w, c.id, "rage");
      addBuff(w, c.id, {
        key: "rage", name: "Öfke", sourceId: c.id, expiresAt: now + 1,
        damageBonus: c.features.rageDamage ?? 2, resist: ["bludgeoning", "piercing", "slashing"],
      });
      return { facts: [`${c.name} ÖFKELENDİ: Güç saldırılarına +${c.features.rageDamage ?? 2} hasar, fiziksel hasara direnç`], details: {} };
    }
    case "end_rage": {
      removeBuffs(w, c.id, (b) => b.key === "rage");
      return { facts: [`${c.name} öfkesini dindirdi`], details: {} };
    }
    case "lay_on_hands": {
      const target = i.targetId ?? c.id;
      const pool = c.resources?.lay_on_hands?.current ?? 0;
      const amount = Math.min(pool, Math.max(1, i.amount ?? Math.min(pool, w.creature(target).maxHp - w.creature(target).hp)));
      if (amount <= 0) throw new StateError("Şifa Eli havuzu boş");
      spend(w, c.id, "action");
      useResource(w, c.id, "lay_on_hands", amount);
      const gained = heal(w, target, amount);
      return { facts: [`${c.name} Şifa Eli ile ${dative(w.creature(target).name)} ${gained} HP verdi (havuzdan ${amount})`], details: { healed: gained } };
    }
    case "bardic_inspiration": {
      if (!i.targetId || i.targetId === c.id) throw new StateError("Ozan İlhamı başka bir yaratığa verilir");
      spend(w, c.id, "bonusAction");
      useResource(w, c.id, "bardic_inspiration");
      const die = `1d${c.features.bardicInspirationDie ?? 6}`;
      addBuff(w, i.targetId, { key: "bardic_inspiration", name: "Ozan İlhamı", sourceId: c.id, expiresAt: now + 10, attackDice: die, saveDice: die, consumeOnUse: true });
      return { facts: [`${w.creature(i.targetId).name} Ozan İlhamı aldı (+${die} sonraki saldırı/kurtarma)`], details: {} };
    }
    case "cunning_action": {
      if (c.classKey !== "rogue" || c.level < 2) throw new StateError("Kurnaz Eylem 2. seviye düzenbazlara özgü");
      const mode = i.mode ?? "dash";
      spend(w, c.id, "bonusAction");
      if (mode === "disengage") setTag(w, c.id, "disengaged", true);
      if (mode === "dash") {
        const enc = w.state.encounter;
        if (enc?.active) {
          const eco = enc.economy[c.id]!;
          const next = structuredClone(enc);
          next.economy[c.id] = { ...eco, movement: eco.movement + c.speed };
          w.setEncounter(next);
        }
      }
      return { facts: [`${c.name} Kurnaz Eylem: ${mode === "dash" ? "koştu" : mode === "disengage" ? "geri çekildi" : "saklanmaya hazırlandı"}`], details: { mode } };
    }
    case "flurry_of_blows": {
      if (!i.targetId) throw new StateError("Hedef gerekli");
      spend(w, c.id, "bonusAction");
      useResource(w, c.id, "ki");
      const facts: string[] = [];
      for (let k = 0; k < 2; k++) {
        if (!w.creature(i.targetId).isAlive) break;
        const r = attack(ctx, w, c.id, i.targetId, weaponProfile(w.creature(c.id), WEAPONS.unarmed!));
        facts.push(`Darbe ${k + 1}: ${r.roll.record.breakdown} vs AC ${r.targetAc} → ${r.hit ? `isabet, ${r.damage?.final ?? 0} hasar` : "ıska"}`);
      }
      return { facts, details: {} };
    }
    case "breath_weapon": {
      const targets = i.targetIds ?? (i.targetId ? [i.targetId] : []);
      if (!targets.length) throw new StateError("Hedef gerekli");
      spend(w, c.id, "action");
      useResource(w, c.id, "breath_weapon");
      const dice = c.level >= 16 ? 5 : c.level >= 11 ? 4 : c.level >= 6 ? 3 : 2;
      const dc = 8 + abilityModifier(c.abilities.con) + proficiencyBonus(c.level);
      const dmg = ctx.roll(`${dice}d6`, "Nefes Silahı", { actorId: c.id }).total;
      const facts: string[] = [];
      for (const tid of targets.slice(0, 4)) {
        const t = w.creature(tid);
        const save = savingThrow(ctx, t, "dex", dc, { reason: "Nefes Silahı kurtarma" });
        const amount = save.success ? Math.floor(dmg / 2) : dmg;
        const d = applyDamage(ctx, w, tid, amount, "fire");
        facts.push(`${t.name}: kurtarma ${save.success ? "başarılı" : "başarısız"}, ${d.final} ateş (HP ${d.hpBefore} → ${d.hpAfter})`);
      }
      return { facts, details: { dc } };
    }
  }
}
