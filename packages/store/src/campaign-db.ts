/**
 * Kampanya paketi (packages/game) ↔ Supabase satırları.
 * Tur yükü, önceki ve sonraki durumların FARKINDAN üretilir: veritabanı her zaman
 * motorun ürettiği durumun birebir aynısı olur.
 */
import { type GameState, relKey, type RollRecord, type Effect, type Quest } from "@kader/engine";
import type { Campaign, JournalEntry } from "@kader/game";
import type { CanonFact } from "@kader/llm";
import { type CreatureRow, type FactionRow, fromCreature, fromFaction, toCreature, toFaction } from "./rows.ts";

export interface CampaignRow {
  id: string;
  owner_id: string;
  title: string;
  template_key: string;
  seed: string;
  turn_count: number;
  game_time: number;
  player_character_id: string;
  rules: Campaign["rules"];
  bible: Campaign["bible"];
  world: Pick<NonNullable<GameState["world"]>, "places" | "exits" | "shops">;
  encounter: GameState["encounter"];
  chapter_summary: string;
  campaign_summary: string;
  created_at?: string;
  updated_at?: string;
}

export interface CampaignRows {
  campaign: CampaignRow;
  creatures: CreatureRow[];
  personas: { creature_id: string; personality: string; goals: string; speech_style: string; secrets?: string }[];
  inventory: { owner_id: string; item_key: string; qty: number; equipped: boolean; attuned: boolean }[];
  wallets: { owner_id: string; cp: number | string }[];
  relationships: { a: string; b: string; score: number }[];
  factions: FactionRow[];
  quests: { id: string; status: string; data: Quest }[];
  facts: { subject: string; predicate: string; value: string; locked: boolean }[];
  /** Son günlük kayıtları (n artan), giriş (n=0) dahil olabilir. */
  turns: { n: number; entry: JournalEntry }[];
  memories?: string[];
}

export function campaignFromRows(r: CampaignRows): Campaign {
  const c = r.campaign;
  const inventories: GameState["inventories"] = {};
  for (const i of r.inventory) {
    (inventories[i.owner_id] ??= []).push({ itemKey: i.item_key, qty: i.qty, ...(i.equipped ? { equipped: true } : {}), ...(i.attuned ? { attuned: true } : {}) });
  }
  for (const list of Object.values(inventories)) list.sort((a, b) => a.itemKey.localeCompare(b.itemKey));
  const state: GameState = {
    campaignId: c.id,
    gameTime: c.game_time,
    sceneLocationId: null,
    creatures: Object.fromEntries(r.creatures.map((x) => [x.id, toCreature(x)])),
    inventories,
    wallets: Object.fromEntries(r.wallets.map((w) => [w.owner_id, Number(w.cp)])),
    relationships: Object.fromEntries(r.relationships.map((x) => [relKey(x.a, x.b), x.score])),
    factions: Object.fromEntries(r.factions.map((f) => [f.id, toFaction(f)])),
    encounter: c.encounter,
    world: { ...c.world, quests: Object.fromEntries(r.quests.map((q) => [q.id, q.data])) },
  };
  state.sceneLocationId = state.creatures[c.player_character_id]?.locationId ?? null;
  return {
    version: 1,
    id: c.id,
    title: c.title,
    templateKey: c.template_key,
    createdAt: c.created_at ?? new Date(0).toISOString(),
    seed: c.seed,
    turnCount: c.turn_count,
    playerId: c.player_character_id,
    rules: c.rules,
    bible: c.bible,
    state,
    personas: Object.fromEntries(r.personas.map((p) => [p.creature_id, {
      id: p.creature_id, personality: p.personality, goals: p.goals, speechStyle: p.speech_style,
    }])),
    facts: r.facts.map((f) => ({ subject: f.subject, predicate: f.predicate, value: f.value, locked: f.locked })),
    journal: [...r.turns].sort((a, b) => a.n - b.n).map((t) => t.entry),
    chapterSummary: c.chapter_summary,
    campaignSummary: c.campaign_summary,
    ...(r.memories ? { memories: r.memories } : {}),
  };
}

const inventoryRows = (s: GameState, owner: string) =>
  (s.inventories[owner] ?? []).map((i) => ({ item_key: i.itemKey, qty: i.qty, equipped: !!i.equipped, attuned: !!i.attuned }));

const factRow = (f: CanonFact, source: string) => ({ subject: f.subject, predicate: f.predicate, value: f.value, locked: f.locked, source });

/** create_campaign(owner, payload) yükü. */
export function createPayload(c: Campaign): Record<string, unknown> {
  const s = c.state;
  const { quests, ...world } = s.world!;
  const owners = new Set([...Object.keys(s.inventories)]);
  return {
    campaign: {
      id: c.id, title: c.title, template_key: c.templateKey, seed: c.seed, game_time: s.gameTime,
      player_character_id: c.playerId, rules: c.rules, bible: c.bible, world,
    },
    creatures: Object.values(s.creatures).map((x) => fromCreature(x, c.id)),
    personas: Object.entries(c.personas).map(([id, p]) => ({
      creature_id: id, personality: p.personality ?? "", goals: p.goals ?? "", speech_style: p.speechStyle ?? "", secrets: p.secrets ?? "",
    })),
    inventory: [...owners].map((o) => ({ owner_id: o, items: inventoryRows(s, o) })),
    wallets: Object.entries(s.wallets).map(([owner_id, cp]) => ({ owner_id, cp })),
    relationships: Object.entries(s.relationships).map(([k, score]) => {
      const [a, b] = k.split("|") as [string, string];
      return { a, b, score };
    }),
    factions: Object.values(s.factions).map((f) => fromFaction(f, c.id)),
    quests: Object.values(quests),
    facts: c.facts.map((f) => factRow(f, "author")),
    intro: c.journal[0],
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface TurnRecord {
  playerInput: string;
  action: unknown;
  outcome: unknown;
  entry: JournalEntry;
  narrationSource: JournalEntry["source"];
  rngNonce: string;
  usage: unknown[];
  rolls: RollRecord[];
  effects: Effect[];
}

/** apply_turn yükü: önceki → sonraki kampanya farkı. */
export function turnPayload(before: Campaign, after: Campaign, rec: TurnRecord): Record<string, unknown> {
  const a = before.state;
  const b = after.state;
  const creatures = Object.values(b.creatures).filter((c) => !same(a.creatures[c.id], c)).map((c) => fromCreature(c, after.id));
  const owners = new Set([...Object.keys(a.inventories), ...Object.keys(b.inventories)]);
  const inventory = [...owners].filter((o) => !same(a.inventories[o] ?? [], b.inventories[o] ?? []))
    .map((o) => ({ owner_id: o, items: inventoryRows(b, o) }));
  const wallets = Object.entries(b.wallets).filter(([o, cp]) => a.wallets[o] !== cp).map(([owner_id, cp]) => ({ owner_id, cp }));
  const relationships = Object.entries(b.relationships).filter(([k, v]) => a.relationships[k] !== v).map(([k, score]) => {
    const [x, y] = k.split("|") as [string, string];
    return { a: x, b: y, score };
  });
  const factions = Object.values(b.factions).filter((f) => !same(a.factions[f.id], f)).map((f) => fromFaction(f, after.id));
  const quests = Object.values(b.world?.quests ?? {}).filter((q) => !same(a.world?.quests[q.id], q));
  const key = (f: CanonFact) => `${f.subject}|${f.predicate.toLocaleLowerCase("tr")}`;
  const known = new Set(before.facts.map(key));
  const facts = after.facts.filter((f) => !known.has(key(f))).map((f) => factRow(f, "narrator"));
  const payload: Record<string, unknown> = {
    turn: {
      player_input: rec.playerInput,
      action: rec.action,
      outcome: rec.outcome,
      entry: rec.entry,
      narration_source: rec.narrationSource,
      rng_nonce: rec.rngNonce,
      usage: rec.usage,
    },
    game_time: b.gameTime,
    encounter: b.encounter,
    creatures,
    inventory,
    wallets,
    relationships,
    factions,
    quests,
    facts,
    rolls: rec.rolls,
    effects: rec.effects,
    hooks: rec.entry.hooks,
  };
  if (after.chapterSummary !== before.chapterSummary) payload.chapter_summary = after.chapterSummary;
  if (after.campaignSummary !== before.campaignSummary) payload.campaign_summary = after.campaignSummary;
  return payload;
}
