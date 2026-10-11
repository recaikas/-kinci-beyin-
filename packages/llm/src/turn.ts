/**
 * Tur orkestrasyonu (veritabanından bağımsız):
 *   oyuncu metni → niyet (kural tabanlı ya da Haiku) → motor (zar + durum)
 *   → savaş otopilotu (NPC'ler) → anlatı (Haiku ya da şablon) → doğrulama
 *
 * Edge Function ve tarayıcıdaki yerel oyun bu fonksiyonu kullanır.
 */
import type { Rng } from "@kader/dice";
import {
  type Catalog, CLASS_ABILITIES, combatAutopilot, type Creature, DEFAULT_CATALOG, type GameAction, type GameState,
  isHostileTo, type RuleOptions, resolveAction, type TurnResolution,
} from "@kader/engine";
import type { StructuredCaller, Usage } from "./caller.ts";
import { type IntentResult, type IntentScene, parseIntent } from "./intent.ts";
import { type Narration, narrate, type NarrateResult, templateNarration } from "./narrator.ts";
import { intentPacket, narratorPacket, sceneEntities, type TurnPacketInput, type WorldBible } from "./packet.ts";
import { type RuleScene, ruleIntent } from "./rule-intent.ts";

export interface PlayTurnInput {
  /** null → AI'sız mod: kural tabanlı niyet + şablon anlatı. */
  caller: StructuredCaller | null;
  world: WorldBible;
  context: TurnPacketInput;
  /** Serbest metin ya da (butonla seçilen) doğrudan eylem. */
  input: { text: string } | { action: GameAction; text?: string };
  exits: { id: string; name: string; minutes: number }[];
  rng: Rng;
  rules?: RuleOptions;
  catalog?: Catalog;
  newId?: () => string;
}

export type PlayTurnResult =
  | { status: "resolved"; intent: IntentResult | null; resolution: TurnResolution; narration: Narration; narrationSource: NarrateResult["source"]; issues: NarrateResult["issues"]; usage: Usage[] }
  | { status: "clarify"; question: string; usage: Usage[] }
  | { status: "out_of_character"; summary: string; usage: Usage[] }
  | { status: "rejected"; reason: string; usage: Usage[] };

/** Oyuncunun sahnesinden kural tabanlı çözümleyicinin ihtiyaç duyduğu özet. */
export function buildRuleScene(state: GameState, playerId: string, exits: RuleScene["exits"], catalog: Catalog = DEFAULT_CATALOG): RuleScene {
  const me = state.creatures[playerId]!;
  const here = Object.values(state.creatures).filter((c) => c.locationId === me.locationId && c.id !== playerId);
  const shops = state.world?.shops ?? {};
  const abilities = Object.keys(me.resources ?? {}).filter((k) => (CLASS_ABILITIES as readonly string[]).includes(k) && (me.resources![k]!.current > 0));
  if (me.resources?.ki?.current) abilities.push("flurry_of_blows");
  if (me.classKey === "rogue" && me.level >= 2) abilities.push("cunning_action");
  if (me.buffs?.some((b) => b.key === "rage")) abilities.push("end_rage");
  return {
    playerId,
    inCombat: !!state.encounter?.active,
    entities: here.map((c) => ({
      id: c.id, name: c.name, alive: c.isAlive, hp: c.hp, kind: c.kind,
      hostile: c.isAlive && isHostileTo(state, c, me), ...(shops[c.id] ? { merchant: true } : {}),
    })),
    exits,
    inventory: (state.inventories[playerId] ?? []).map((i) => {
      const item = catalog.items[i.itemKey];
      return { key: i.itemKey, name: item?.name ?? i.itemKey, type: item?.type ?? "gear", qty: i.qty, ...(i.equipped ? { equipped: true } : {}) };
    }),
    spells: (me.spellcasting?.known ?? []).map((k) => catalog.spells[k]).filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({ key: s.key, name: s.name, level: s.level, heal: !!s.heal || !!s.buff || !!s.cures, harmful: !!(s.damage || s.autoHitDarts || s.rays || s.conditionsOnFail) })),
    shopItems: Object.fromEntries(here.filter((c) => shops[c.id]).map((c) => [c.id, (state.inventories[c.id] ?? [])
      .map((i) => ({ key: i.itemKey, name: catalog.items[i.itemKey]?.name ?? i.itemKey }))])),
    quests: Object.values(state.world?.quests ?? {}).map((q) => ({ id: q.id, title: q.title, status: q.status })),
    abilities,
    ...(me.classKey ? { classKey: me.classKey } : {}),
  };
}

function isHarmful(a: GameAction, catalog: Catalog): boolean {
  if (a.type === "attack") return true;
  if (a.type === "cast_spell") {
    const s = catalog.spells[a.spellKey];
    return !!s && !!(s.damage || s.autoHitDarts || s.rays || s.conditionsOnFail || s.debuffOnFail || s.sleepPool);
  }
  if (a.type === "class_ability") return a.ability === "breath_weapon" || a.ability === "flurry_of_blows";
  return false;
}

function targetsOf(a: GameAction): string[] {
  if (a.type === "attack") return [a.targetId];
  if (a.type === "cast_spell") return a.targetIds;
  if (a.type === "class_ability") return [...(a.targetIds ?? []), ...(a.targetId ? [a.targetId] : [])];
  return [];
}

/** Oyuncu eylemi + otomatik adımları tek çözüme birleştir. */
export function mergeResolutions(first: TurnResolution, steps: TurnResolution[], before: TurnResolution[] = []): TurnResolution {
  if (steps.length === 0 && before.length === 0) return first;
  const all = [...before, first, ...steps];
  const last = all[all.length - 1]!;
  const pre = before.filter((s) => s.action.type !== "end_turn").flatMap((s) => [`[Önce] ${s.outcome.headline}`, ...s.outcome.facts]);
  const post = steps.filter((s) => s.action.type !== "end_turn").flatMap((s) => [`[Sonra] ${s.outcome.headline}`, ...s.outcome.facts]);
  return {
    ...first,
    outcome: {
      ...first.outcome,
      facts: [...pre, ...first.outcome.facts, ...post],
      details: { ...first.outcome.details, followUps: steps.map((s) => s.action), preludes: before.map((s) => s.action) },
    },
    rolls: all.flatMap((s) => s.rolls),
    effects: all.flatMap((s) => s.effects),
    state: last.state,
  };
}

export async function playTurn(p: PlayTurnInput): Promise<PlayTurnResult> {
  const catalog = p.catalog ?? DEFAULT_CATALOG;
  const usage: Usage[] = [];
  const state = p.context.state;
  const playerId = p.context.playerId;
  const ruleScene = buildRuleScene(state, playerId, p.exits, catalog);
  const scene: IntentScene = {
    playerId,
    entityIds: [playerId, ...ruleScene.entities.map((e) => e.id)],
    questIds: ruleScene.quests.map((q) => q.id),
    exits: p.exits,
    weapons: Object.keys(catalog.weapons),
    spells: Object.keys(catalog.spells),
    items: Object.keys(catalog.items),
  };

  let action: GameAction;
  let intent: IntentResult | null = null;
  const text = "text" in p.input && p.input.text ? p.input.text : "";

  if ("action" in p.input) {
    action = p.input.action;
    if (action.actorId !== playerId) return { status: "rejected", reason: "Başka bir karakter adına eylem yapılamaz", usage };
  } else {
    const rule = ruleIntent(text, ruleScene);
    const short = text.trim().split(/\s+/).length <= 5;
    if (rule && rule.confidence === "high" && (!p.caller || short)) {
      intent = rule;
    } else if (p.caller) {
      const r = await parseIntent(p.caller, intentPacket(p.context, text, {
        exits: p.exits,
        inCombat: ruleScene.inCombat,
        inventory: ruleScene.inventory,
        spells: ruleScene.spells,
        abilities: ruleScene.abilities,
        merchants: ruleScene.entities.filter((e) => e.merchant).map((e) => ({ id: e.id, name: e.name, stock: (ruleScene.shopItems[e.id] ?? []).map((i) => i.key) })),
        quests: ruleScene.quests,
        corpses: ruleScene.entities.filter((e) => !e.alive).map((e) => ({ id: e.id, name: e.name })),
      }), scene);
      usage.push(r.usage);
      intent = r.result;
    } else if (rule) {
      intent = rule;
    } else {
      const hints = ["bak", "saldır <hedef>", "<kişi> ile konuş", "git <yer>", "rüşvet ver <kişi> 10 altın", "iksir iç", "dinlen", "cesedi ara"];
      return { status: "clarify", question: `Ne yapmak istediğini anlayamadım. Örnekler: ${hints.join(" · ")}`, usage };
    }
    if (intent.kind === "clarify") return { status: "clarify", question: intent.question, usage };
    if (intent.kind === "out_of_character") return { status: "out_of_character", summary: intent.summary, usage };
    if (intent.kind === "invalid") return { status: "rejected", reason: intent.reason, usage };
    action = intent.action;
  }

  const opts = { rng: p.rng, ...(p.rules ? { rules: p.rules } : {}), catalog, ...(p.newId ? { newId: p.newId } : {}) };

  // Savaş dışında zarar verici eylem → önce savaş başlar (inisiyatif), sıra oyuncuya gelene dek NPC'ler oynar.
  const prelude: TurnResolution[] = [];
  let current = state;
  if (!current.encounter?.active && isHarmful(action, catalog)) {
    const me = current.creatures[playerId]!;
    const targets = targetsOf(action).filter((id) => id !== playerId && current.creatures[id]?.isAlive);
    const hostiles = Object.values(current.creatures).filter((c: Creature) =>
      c.isAlive && c.locationId === me.locationId && isHostileTo(current, c, me)).map((c) => c.id);
    const participants = Array.from(new Set([...targets, ...hostiles]));
    if (participants.length) {
      const start = resolveAction(current, { type: "start_combat", actorId: playerId, participantIds: participants }, opts);
      if (start.ok) {
        prelude.push(start);
        const auto = combatAutopilot(start.state, playerId, opts);
        prelude.push(...auto.steps);
        current = auto.state;
      }
    }
  }

  const playerNow = current.creatures[playerId]!;
  let resolution: TurnResolution;
  if (prelude.length && (!current.encounter?.active || !playerNow.isAlive || playerNow.hp <= 0
    || targetsOf(action).every((id) => !current.creatures[id]?.isAlive))) {
    // Sıra gelmeden savaş bitti ya da oyuncu düştü: oyuncunun eylemi gerçekleşmez.
    const last = prelude[prelude.length - 1]!;
    resolution = mergeResolutions({ ...last, outcome: { ...last.outcome, facts: [] } }, [], prelude.slice(0, -1));
  } else {
    const first = resolveAction(current, action, opts);
    if (!first.ok) {
      if (!prelude.length) return { status: "rejected", reason: first.error ?? "Geçersiz eylem", usage };
      resolution = mergeResolutions({ ...prelude[prelude.length - 1]! }, [], prelude.slice(0, -1));
    } else {
      const auto = combatAutopilot(first.state, playerId, opts);
      resolution = mergeResolutions(first, auto.steps, prelude);
    }
  }

  // Anlatıcı, eylem SONRASI durumu görür (yaralar, ölümler, yeni konum).
  const after: TurnPacketInput = { ...p.context, state: resolution.state };
  if (resolution.state.world && resolution.state.creatures[playerId]?.locationId !== p.context.location.id) {
    const loc = resolution.state.world.places[resolution.state.creatures[playerId]!.locationId!];
    if (loc) after.location = { id: loc.id, name: loc.name, description: loc.description };
  }
  const sceneIds = sceneEntities(after).map((e) => e.id);
  let narrated: NarrateResult;
  if (!p.caller) {
    narrated = { narration: templateNarration(resolution.outcome, resolution.rolls[0]?.total ?? 0), source: "template", issues: [], usage: [] };
  } else {
    try {
      narrated = await narrate({
        caller: p.caller,
        world: p.world,
        packet: narratorPacket(after, text || resolution.outcome.headline, resolution.outcome),
        outcome: resolution.outcome,
        state: resolution.state,
        sceneIds,
        facts: p.context.facts,
      });
    } catch {
      narrated = { narration: templateNarration(resolution.outcome), source: "template", issues: [], usage: [] };
    }
  }
  usage.push(...narrated.usage);
  return {
    status: "resolved",
    intent,
    resolution,
    narration: narrated.narration,
    narrationSource: narrated.source,
    issues: narrated.issues,
    usage,
  };
}
