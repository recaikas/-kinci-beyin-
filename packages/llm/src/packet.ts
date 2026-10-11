/**
 * Bağlam paketi: her tur LLM'e giden SABİT BOYUTLU bilgi. Hikâye ne kadar uzarsa
 * uzasın paket büyümez — geçmiş Supabase'de durur, buraya yalnızca ilgili dilim
 * (sahne varlıkları, son turlar, ilgili kanon gerçekler, özetler) gelir.
 */
import type { Creature, GameState, Outcome } from "@kader/engine";
import { attitudeFromScore, CONDITION_NAMES_TR, relKey } from "@kader/engine";

export interface WorldBible {
  title: string;
  premise: string;
  tone: string;
  /** Dünya kuralları (büyü var mı, teknoloji düzeyi …) — anlatı tutarlılığı için. */
  rules: string[];
  language: "tr";
}

export interface CanonFact {
  subject: string;
  predicate: string;
  value: string;
  locked: boolean;
}

export interface RecentTurn {
  n: number;
  playerInput: string;
  headline: string;
  narration: string;
}

export interface Persona {
  id: string;
  personality?: string;
  goals?: string;
  speechStyle?: string;
}

export interface TurnPacketInput {
  state: GameState;
  playerId: string;
  location: { id: string; name: string; description: string };
  personas: Record<string, Persona>;
  recentTurns: RecentTurn[];
  facts: CanonFact[];
  chapterSummary: string;
  campaignSummary: string;
  openQuests: string[];
  /** Vektör aramasıyla bulunan, şu anki durumla ilgili eski anlatı parçaları. */
  memories?: string[];
}

export type HealthBand = "sağlam" | "hafif yaralı" | "ağır yaralı" | "baygın" | "ölü";

export function healthBand(c: Creature): HealthBand {
  if (!c.isAlive) return "ölü";
  if (c.hp <= 0) return "baygın";
  const r = c.hp / c.maxHp;
  if (r > 0.75) return "sağlam";
  if (r > 0.35) return "hafif yaralı";
  return "ağır yaralı";
}

export interface SceneEntity {
  id: string;
  name: string;
  kind: Creature["kind"];
  health: HealthBand;
  conditions: string[];
  attitudeToPlayer: string;
  personality?: string;
  goals?: string;
  speechStyle?: string;
}

export function sceneEntities(input: TurnPacketInput): SceneEntity[] {
  const { state, playerId, location } = input;
  return Object.values(state.creatures)
    .filter((c) => c.locationId === location.id || c.id === playerId)
    .map((c) => {
      const p = input.personas[c.id];
      const rel = c.id === playerId ? 0 : state.relationships[relKey(playerId, c.id)] ?? 0;
      return {
        id: c.id,
        name: c.name,
        kind: c.kind,
        health: healthBand(c),
        conditions: c.conditions.map((x) => CONDITION_NAMES_TR[x]),
        attitudeToPlayer: c.id === playerId ? "—" : attitudeFromScore(rel),
        ...(p?.personality ? { personality: p.personality } : {}),
        ...(p?.goals ? { goals: p.goals } : {}),
        ...(p?.speechStyle ? { speechStyle: p.speechStyle } : {}),
      };
    });
}

export function gameClock(minutes: number): string {
  const day = Math.floor(minutes / 1440) + 1;
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  const part = h < 6 ? "gece" : h < 12 ? "sabah" : h < 18 ? "öğleden sonra" : "akşam";
  return `${day}. gün, ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} (${part})`;
}

/** Niyet çözümleyiciye giden paket (anlatıcıdan daha küçük). */
export function intentPacket(input: TurnPacketInput, playerText: string, catalog: {
  weapons: string[];
  spells: string[];
  items: string[];
  exits: { id: string; name: string; minutes: number }[];
  inCombat: boolean;
}): string {
  return JSON.stringify({
    player_id: input.playerId,
    location: input.location.name,
    in_combat: catalog.inCombat,
    entities: sceneEntities(input).map((e) => ({ id: e.id, name: e.name, kind: e.kind, health: e.health, attitude: e.attitudeToPlayer })),
    player_inventory: (input.state.inventories[input.playerId] ?? []).map((i) => `${i.itemKey}×${i.qty}`),
    player_spells: input.state.creatures[input.playerId]?.spellcasting?.known ?? [],
    known_weapons: catalog.weapons,
    known_items: catalog.items,
    exits: catalog.exits,
    recent: input.recentTurns.slice(-3).map((t) => t.headline),
    player_text: playerText,
  });
}

/** Anlatıcıya giden paket. */
export function narratorPacket(input: TurnPacketInput, playerText: string, outcome: Outcome): string {
  return JSON.stringify({
    time: gameClock(input.state.gameTime),
    location: input.location,
    campaign_summary: input.campaignSummary,
    chapter_summary: input.chapterSummary,
    canon_facts: input.facts.map((f) => `${f.subject} · ${f.predicate}: ${f.value}${f.locked ? " [KİLİTLİ]" : ""}`),
    open_quests: input.openQuests,
    related_memories: input.memories ?? [],
    scene_entities: sceneEntities(input),
    recent_turns: input.recentTurns.slice(-6).map((t) => ({ n: t.n, player: t.playerInput, what_happened: t.narration })),
    player_text: playerText,
    resolved_outcome: {
      tier: outcome.tier,
      headline: outcome.headline,
      immutable_facts: outcome.facts,
    },
  });
}
