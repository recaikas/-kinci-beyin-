/**
 * Tur orkestrasyonu (veritabanından bağımsız):
 *   oyuncu metni → niyet (Haiku) → motor (zar + durum) → anlatı (Haiku) → doğrulama
 *
 * Edge Function bu fonksiyonu çağırır; öncesinde durumu Supabase'den yükler,
 * sonrasında sonucu tek transaction'da yazar.
 */
import type { Rng } from "@kader/dice";
import {
  type Catalog, combatAutopilot, DEFAULT_CATALOG, type GameAction, type RuleOptions, type TurnResolution, resolveAction,
} from "@kader/engine";
import type { StructuredCaller, Usage } from "./caller.ts";
import { type IntentResult, type IntentScene, parseIntent } from "./intent.ts";
import { type Narration, narrate, type NarrateResult, templateNarration } from "./narrator.ts";
import { intentPacket, narratorPacket, sceneEntities, type TurnPacketInput, type WorldBible } from "./packet.ts";

export interface PlayTurnInput {
  caller: StructuredCaller;
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

export async function playTurn(p: PlayTurnInput): Promise<PlayTurnResult> {
  const catalog = p.catalog ?? DEFAULT_CATALOG;
  const usage: Usage[] = [];
  const state = p.context.state;
  const scene: IntentScene = {
    playerId: p.context.playerId,
    entityIds: sceneEntities(p.context).map((e) => e.id),
    exits: p.exits,
    weapons: Object.keys(catalog.weapons),
    spells: Object.keys(catalog.spells),
    items: Object.keys(catalog.items),
  };

  let action: GameAction;
  let intent: IntentResult | null = null;
  const text = "text" in p.input && p.input.text ? p.input.text : "";

  if ("action" in p.input) {
    // Butonla seçilen eylem: niyet çağrısı atlanır (gecikme ve maliyet yok).
    action = p.input.action;
    if (action.actorId !== p.context.playerId) return { status: "rejected", reason: "Başka bir karakter adına eylem yapılamaz", usage };
  } else {
    const r = await parseIntent(p.caller, intentPacket(p.context, text, {
      weapons: scene.weapons,
      spells: scene.spells,
      items: scene.items,
      exits: p.exits,
      inCombat: !!state.encounter?.active,
    }), scene);
    usage.push(r.usage);
    intent = r.result;
    if (r.result.kind === "clarify") return { status: "clarify", question: r.result.question, usage };
    if (r.result.kind === "out_of_character") return { status: "out_of_character", summary: r.result.summary, usage };
    if (r.result.kind === "invalid") return { status: "rejected", reason: r.result.reason, usage };
    action = r.result.action;
  }

  const first = resolveAction(state, action, {
    rng: p.rng,
    ...(p.rules ? { rules: p.rules } : {}),
    catalog,
    ...(p.newId ? { newId: p.newId } : {}),
  });
  if (!first.ok) return { status: "rejected", reason: first.error ?? "Geçersiz eylem", usage };

  // Savaştaysa NPC'ler kural tabanlı AI ile sıralarını oynar; tek tur kaydında birleşir.
  const auto = combatAutopilot(first.state, p.context.playerId, { rng: p.rng, ...(p.rules ? { rules: p.rules } : {}), catalog });
  const resolution = mergeResolutions(first, auto.steps);

  // Anlatıcı, eylem SONRASI durumu görür (yaralar, ölümler, yeni konum).
  const after: TurnPacketInput = { ...p.context, state: resolution.state };
  const sceneIds = sceneEntities(after).map((e) => e.id);
  let narrated: NarrateResult;
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

/** Oyuncu eylemi + otomatik NPC adımlarını tek çözüme birleştir. */
export function mergeResolutions(first: TurnResolution, steps: TurnResolution[]): TurnResolution {
  if (steps.length === 0) return first;
  const last = steps[steps.length - 1]!;
  const npcFacts = steps
    .filter((s) => s.action.type !== "end_turn")
    .flatMap((s) => [`[Sonra] ${s.outcome.headline}`, ...s.outcome.facts]);
  return {
    ...first,
    outcome: {
      ...first.outcome,
      facts: [...first.outcome.facts, ...npcFacts],
      details: { ...first.outcome.details, followUps: steps.map((s) => s.action) },
    },
    rolls: [...first.rolls, ...steps.flatMap((s) => s.rolls)],
    effects: [...first.effects, ...steps.flatMap((s) => s.effects)],
    state: last.state,
  };
}
