/**
 * Niyet Çözümleyici: oyuncunun serbest metnini motorun eylem kataloğundan
 * TEK bir eyleme çevirir. Model sayı/sonuç belirleyemez; yalnızca eylem türü,
 * hedef kimliği ve (yetenek kontrollerinde) sınırlı bir zorluk etiketi seçer.
 */
import * as z from "zod/v4";
import { ABILITIES, CLASS_ABILITIES, DIFFICULTIES, type GameAction, type Skill, SKILL_LIST } from "@kader/engine";
import { LlmError, type StructuredCaller, type Usage } from "./caller.ts";
import { INTENT_SYSTEM } from "./prompts.ts";

export const ACTION_TYPES = [
  "skill_check", "ability_check", "attack", "cast_spell", "social", "move", "use_item",
  "give_item", "rest", "death_save", "stabilize", "start_combat", "end_turn",
  "end_combat", "dodge", "dash", "disengage", "help", "hide", "look", "talk", "wait",
  "class_ability", "equip", "unequip", "loot", "buy", "sell", "accept_quest",
] as const;

const n = <T extends z.ZodType>(t: T) => t.nullable();

export const IntentSchema = z.object({
  kind: z.enum(["action", "clarify", "out_of_character"]),
  summary: z.string().describe("Oyuncunun niyetinin tek cümlelik Türkçe özeti"),
  clarification_question: n(z.string()),
  action: n(z.object({
    type: z.enum(ACTION_TYPES),
    skill: n(z.enum(SKILL_LIST as [string, ...string[]])),
    ability: n(z.enum(ABILITIES)),
    difficulty: n(z.enum(DIFFICULTIES)),
    target_id: n(z.string()),
    target_ids: z.array(z.string()),
    weapon_key: n(z.string()),
    spell_key: n(z.string()),
    slot_level: n(z.int()),
    approach: n(z.enum(["persuade", "deceive", "intimidate", "bribe", "perform"])),
    risk: n(z.enum(["trivial", "minor", "significant", "dangerous", "unthinkable"])),
    bribe_gp: n(z.number()),
    item_key: n(z.string()),
    qty: n(z.int()),
    price_gp: n(z.number()),
    direction: n(z.enum(["buy", "sell"])),
    location_id: n(z.string()),
    minutes: n(z.int()),
    rest_kind: n(z.enum(["short", "long"])),
    sense: n(z.enum(["sight", "hearing"])),
    two_handed: n(z.boolean()),
    thrown: n(z.boolean()),
    smite_slot: n(z.int()),
    class_ability: n(z.enum(CLASS_ABILITIES)),
    ability_mode: n(z.enum(["dash", "disengage", "hide"])),
    amount: n(z.int()),
    quest_id: n(z.string()),
    haggle: n(z.boolean()),
  })),
});
export type Intent = z.infer<typeof IntentSchema>;

export type IntentAction = NonNullable<Intent["action"]>;

/** Tüm alanları null olan eylem iskeleti (testler ve kural tabanlı çözümleyici için). */
export function blankIntentAction(type: IntentAction["type"]): IntentAction {
  return {
    type, skill: null, ability: null, difficulty: null, target_id: null, target_ids: [], weapon_key: null,
    spell_key: null, slot_level: null, approach: null, risk: null, bribe_gp: null, item_key: null, qty: null,
    price_gp: null, direction: null, location_id: null, minutes: null, rest_kind: null, sense: null, two_handed: null,
    thrown: null, smite_slot: null, class_ability: null, ability_mode: null, amount: null, quest_id: null, haggle: null,
  };
}

export interface IntentScene {
  playerId: string;
  entityIds: string[];
  questIds?: string[];
  exits: { id: string; minutes: number }[];
  weapons: string[];
  spells: string[];
  items: string[];
}

export type IntentResult =
  | { kind: "action"; action: GameAction; summary: string }
  | { kind: "clarify"; question: string; summary: string }
  | { kind: "out_of_character"; summary: string }
  | { kind: "invalid"; reason: string; summary: string };

const gpToCp = (gp: number | null) => (gp === null ? undefined : Math.max(0, Math.round(gp * 100)));

/**
 * Model çıktısını motor eylemine çevir ve sahneye göre doğrula.
 * Uydurulmuş kimlikler, katalog dışı eşya/büyü reddedilir.
 */
export function toGameAction(intent: Intent, scene: IntentScene): IntentResult {
  const summary = intent.summary;
  if (intent.kind === "clarify") {
    return { kind: "clarify", question: intent.clarification_question ?? "Ne yapmak istediğini biraz açar mısın?", summary };
  }
  if (intent.kind === "out_of_character") return { kind: "out_of_character", summary };
  const a = intent.action;
  if (!a) return { kind: "invalid", reason: "Eylem boş", summary };

  const me = scene.playerId;
  const bad = (reason: string): IntentResult => ({ kind: "invalid", reason, summary });
  const target = (id: string | null): string | null => (id && scene.entityIds.includes(id) ? id : null);
  const need = <T>(v: T | null | undefined, what: string): T => {
    if (v === null || v === undefined) throw new Error(what);
    return v;
  };

  try {
    switch (a.type) {
      case "skill_check":
        return {
          kind: "action", summary, action: {
            type: "skill_check", actorId: me,
            skill: need(a.skill, "beceri") as Skill,
            difficulty: a.difficulty ?? "medium",
            ...(target(a.target_id) ? { targetId: target(a.target_id)! } : {}),
            ...(a.sense ? { sense: a.sense } : {}),
            ...(a.minutes ? { minutes: Math.min(a.minutes, 480) } : {}),
          },
        };
      case "ability_check":
        return { kind: "action", summary, action: { type: "ability_check", actorId: me, ability: need(a.ability, "yetenek"), difficulty: a.difficulty ?? "medium" } };
      case "attack": {
        const t = target(a.target_id);
        if (!t || t === me) return bad("Saldırı hedefi sahnede yok");
        const weaponKey = a.weapon_key && scene.weapons.includes(a.weapon_key) ? a.weapon_key : "unarmed";
        return {
          kind: "action", summary, action: {
            type: "attack", actorId: me, targetId: t, weaponKey,
            ...(a.two_handed ? { twoHanded: true } : {}),
            ...(a.thrown ? { thrown: true } : {}),
            ...(a.smite_slot ? { smiteSlot: a.smite_slot } : {}),
          },
        };
      }
      case "cast_spell": {
        const key = need(a.spell_key, "büyü");
        if (!scene.spells.includes(key)) return bad(`Bilinmeyen büyü: ${key}`);
        const ids = (a.target_ids.length ? a.target_ids : a.target_id ? [a.target_id] : [me]).map(target).filter((x): x is string => !!x);
        if (!ids.length) return bad("Büyü hedefi sahnede yok");
        return { kind: "action", summary, action: { type: "cast_spell", actorId: me, spellKey: key, slotLevel: a.slot_level ?? 0, targetIds: ids } };
      }
      case "social": {
        const t = target(a.target_id);
        if (!t || t === me) return bad("Konuşulacak kişi sahnede yok");
        const bribeCp = gpToCp(a.bribe_gp);
        return {
          kind: "action", summary, action: {
            type: "social", actorId: me, targetId: t, approach: a.approach ?? "persuade", risk: a.risk ?? "minor",
            ...(bribeCp ? { bribeCp } : {}),
          },
        };
      }
      case "move": {
        const exit = scene.exits.find((e) => e.id === a.location_id);
        if (!exit) return bad("Bu yönde bilinen bir çıkış yok");
        return { kind: "action", summary, action: { type: "move", actorId: me, toLocationId: exit.id, minutes: exit.minutes } };
      }
      case "use_item": {
        const key = need(a.item_key, "eşya");
        if (!scene.items.includes(key)) return bad(`Bilinmeyen eşya: ${key}`);
        const t = target(a.target_id);
        return { kind: "action", summary, action: { type: "use_item", actorId: me, itemKey: key, ...(t ? { targetId: t } : {}) } };
      }
      case "give_item": {
        const t = target(a.target_id);
        if (!t) return bad("Alıcı sahnede yok");
        return { kind: "action", summary, action: { type: "give_item", actorId: me, targetId: t, itemKey: need(a.item_key, "eşya"), qty: Math.max(1, a.qty ?? 1) } };
      }
      case "buy":
      case "sell": {
        const t = target(a.target_id);
        if (!t) return bad("Tüccar sahnede yok");
        const key = need(a.item_key, "eşya");
        if (!scene.items.includes(key)) return bad(`Bilinmeyen eşya: ${key}`);
        return { kind: "action", summary, action: { type: a.type, actorId: me, merchantId: t, itemKey: key, qty: Math.max(1, Math.min(99, a.qty ?? 1)), ...(a.haggle ? { haggle: true } : {}) } };
      }
      case "class_ability": {
        const ability = need(a.class_ability, "yetenek");
        const ids = a.target_ids.map(target).filter((x): x is string => !!x);
        const t = target(a.target_id);
        return {
          kind: "action", summary, action: {
            type: "class_ability", actorId: me, ability,
            ...(t ? { targetId: t } : {}),
            ...(ids.length ? { targetIds: ids } : {}),
            ...(a.amount ? { amount: a.amount } : {}),
            ...(a.ability_mode ? { mode: a.ability_mode } : {}),
          },
        };
      }
      case "equip":
      case "unequip": {
        const key = need(a.item_key, "eşya");
        if (!scene.items.includes(key)) return bad(`Bilinmeyen eşya: ${key}`);
        return { kind: "action", summary, action: { type: "equip", actorId: me, itemKey: key, equipped: a.type === "equip" } };
      }
      case "loot": {
        const t = target(a.target_id);
        if (!t) return bad("Aranacak ceset sahnede yok");
        return { kind: "action", summary, action: { type: "loot", actorId: me, targetId: t } };
      }
      case "accept_quest": {
        const qid = need(a.quest_id, "görev");
        if (scene.questIds && !scene.questIds.includes(qid)) return bad("Böyle bir görev yok");
        return { kind: "action", summary, action: { type: "accept_quest", actorId: me, questId: qid } };
      }
      case "rest":
        return { kind: "action", summary, action: { type: "rest", actorId: me, kind: a.rest_kind ?? "short" } };
      case "death_save":
        return { kind: "action", summary, action: { type: "death_save", actorId: me } };
      case "stabilize": {
        const t = target(a.target_id);
        if (!t) return bad("Stabilize edilecek kişi sahnede yok");
        return { kind: "action", summary, action: { type: "stabilize", actorId: me, targetId: t, useKit: a.item_key === "healers_kit" } };
      }
      case "start_combat": {
        const ids = (a.target_ids.length ? a.target_ids : a.target_id ? [a.target_id] : []).map(target).filter((x): x is string => !!x);
        if (!ids.length) return bad("Savaşılacak kimse yok");
        return { kind: "action", summary, action: { type: "start_combat", actorId: me, participantIds: ids } };
      }
      case "help": {
        const t = target(a.target_id);
        if (!t) return bad("Yardım edilecek kişi sahnede yok");
        return { kind: "action", summary, action: { type: "help", actorId: me, allyId: t } };
      }
      case "talk": {
        const t = target(a.target_id);
        return { kind: "action", summary, action: { type: "talk", actorId: me, ...(t ? { targetId: t } : {}), minutes: Math.min(a.minutes ?? 2, 60) } };
      }
      case "wait":
        return { kind: "action", summary, action: { type: "wait", actorId: me, minutes: Math.min(Math.max(1, a.minutes ?? 10), 1440) } };
      case "end_turn":
      case "end_combat":
      case "dodge":
      case "dash":
      case "disengage":
      case "hide":
      case "look":
        return { kind: "action", summary, action: { type: a.type, actorId: me } };
    }
  } catch (e) {
    return bad(`Eksik alan: ${(e as Error).message}`);
  }
}

export interface ParseIntentResult {
  result: IntentResult;
  raw: Intent;
  usage: Usage;
  latencyMs: number;
}

export async function parseIntent(caller: StructuredCaller, packet: string, scene: IntentScene): Promise<ParseIntentResult> {
  const request = {
    label: "intent",
    system: INTENT_SYSTEM,
    user: packet,
    schema: IntentSchema,
    effort: "low" as const,
    maxTokens: 2000,
  };
  let res;
  try {
    res = await caller.call(request);
  } catch (e) {
    // Şema dışı çıktıda bir kez yeniden dene; ret/API hatası yukarı çıkar.
    if (!(e instanceof LlmError) || e.kind !== "parse") throw e;
    res = await caller.call({ ...request, label: "intent_retry" });
  }
  return { result: toGameAction(res.data, scene), raw: res.data, usage: res.usage, latencyMs: res.latencyMs };
}
