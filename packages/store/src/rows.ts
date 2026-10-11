/**
 * Supabase satırları ↔ motor tipleri. Saf fonksiyonlar: hem Edge Function
 * (Deno) hem Node testleri kullanır.
 */
import type {
  Creature, Effect, Encounter, Faction, GameState, InventoryEntry, RollRecord, RuleOptions,
} from "@kader/engine";
import { DEFAULT_RULES, relKey } from "@kader/engine";

export interface CreatureRow {
  id: string;
  campaign_id: string;
  kind: Creature["kind"];
  name: string;
  template_key: string | null;
  level: number;
  cr: number | string | null;
  size: Creature["size"];
  abilities: Creature["abilities"];
  save_proficiencies: Creature["saveProficiencies"];
  skill_proficiencies: Creature["skillProficiencies"];
  expertise: Creature["expertise"];
  hp: number;
  max_hp: number;
  temp_hp: number;
  ac: number;
  speed: number;
  conditions: Creature["conditions"];
  exhaustion: number;
  resistances: Creature["resistances"];
  immunities: Creature["immunities"];
  vulnerabilities: Creature["vulnerabilities"];
  condition_immunities: Creature["conditionImmunities"];
  death_saves: Creature["deathSaves"];
  hit_dice: Creature["hitDice"];
  hit_dice_max: Creature["hitDiceMax"];
  inspiration: boolean;
  spellcasting: Creature["spellcasting"] | null;
  features: Creature["features"];
  xp: number;
  is_alive: boolean;
  attacks: string[];
  location_id: string | null;
  faction_id: string | null;
}

export interface FactionRow {
  id: string;
  campaign_id: string;
  name: string;
  treasury: number | string;
  military: number;
  stability: number;
  population: number | string;
  tech: number | string;
  intelligence: number;
  traits: Faction["traits"];
  region_ids: string[];
  at_war_with: string[];
  alliances: string[];
}

export interface CampaignRow {
  id: string;
  owner_id: string;
  world_id: string;
  title: string;
  settings: Partial<RuleOptions>;
  seed: string;
  turn_count: number;
  game_time: number;
  player_character_id: string | null;
  scene_location_id: string | null;
  encounter: Encounter | null;
  chapter_summary: string;
  campaign_summary: string;
}

export interface InventoryRow { owner_id: string; item_key: string; qty: number; equipped: boolean; attuned: boolean }
export interface WalletRow { owner_id: string; cp: number | string }
export interface RelationshipRow { a: string; b: string; score: number }

export function toCreature(r: CreatureRow): Creature {
  const c: Creature = {
    id: r.id,
    name: r.name,
    kind: r.kind,
    level: r.level,
    size: r.size,
    abilities: r.abilities,
    saveProficiencies: r.save_proficiencies ?? [],
    skillProficiencies: r.skill_proficiencies ?? [],
    expertise: r.expertise ?? [],
    hp: r.hp,
    maxHp: r.max_hp,
    tempHp: r.temp_hp,
    ac: r.ac,
    speed: r.speed,
    conditions: r.conditions ?? [],
    exhaustion: r.exhaustion,
    resistances: r.resistances ?? [],
    immunities: r.immunities ?? [],
    vulnerabilities: r.vulnerabilities ?? [],
    conditionImmunities: r.condition_immunities ?? [],
    deathSaves: r.death_saves,
    hitDice: r.hit_dice ?? {},
    hitDiceMax: r.hit_dice_max ?? {},
    inspiration: r.inspiration,
    features: r.features ?? {},
    xp: r.xp,
    isAlive: r.is_alive,
  };
  if (r.cr !== null && r.cr !== undefined) c.cr = Number(r.cr);
  if (r.spellcasting) c.spellcasting = r.spellcasting;
  if (r.location_id) c.locationId = r.location_id;
  if (r.faction_id) c.factionId = r.faction_id;
  if (r.attacks?.length) c.attacks = r.attacks;
  return c;
}

export function fromCreature(c: Creature, campaignId: string, templateKey: string | null = null): CreatureRow {
  return {
    id: c.id,
    campaign_id: campaignId,
    kind: c.kind,
    name: c.name,
    template_key: templateKey,
    level: c.level,
    cr: c.cr ?? null,
    size: c.size,
    abilities: c.abilities,
    save_proficiencies: c.saveProficiencies,
    skill_proficiencies: c.skillProficiencies,
    expertise: c.expertise,
    hp: c.hp,
    max_hp: c.maxHp,
    temp_hp: c.tempHp,
    ac: c.ac,
    speed: c.speed,
    conditions: c.conditions,
    exhaustion: c.exhaustion,
    resistances: c.resistances,
    immunities: c.immunities,
    vulnerabilities: c.vulnerabilities,
    condition_immunities: c.conditionImmunities,
    death_saves: c.deathSaves,
    hit_dice: c.hitDice,
    hit_dice_max: c.hitDiceMax,
    inspiration: c.inspiration,
    spellcasting: c.spellcasting ?? null,
    features: c.features,
    xp: c.xp,
    is_alive: c.isAlive,
    attacks: c.attacks ?? [],
    location_id: c.locationId ?? null,
    faction_id: c.factionId ?? null,
  };
}

export function toFaction(r: FactionRow): Faction {
  return {
    id: r.id,
    name: r.name,
    treasury: Number(r.treasury),
    military: r.military,
    stability: r.stability,
    population: Number(r.population),
    tech: Number(r.tech),
    intelligence: r.intelligence,
    traits: r.traits ?? {},
    regionIds: r.region_ids ?? [],
    atWarWith: r.at_war_with ?? [],
    alliances: r.alliances ?? [],
  };
}

export function fromFaction(f: Faction, campaignId: string): FactionRow {
  return {
    id: f.id,
    campaign_id: campaignId,
    name: f.name,
    treasury: f.treasury,
    military: f.military,
    stability: f.stability,
    population: f.population,
    tech: f.tech,
    intelligence: f.intelligence,
    traits: f.traits,
    region_ids: f.regionIds,
    at_war_with: f.atWarWith,
    alliances: f.alliances,
  };
}

export interface LoadedRows {
  campaign: CampaignRow;
  creatures: CreatureRow[];
  inventory: InventoryRow[];
  wallets: WalletRow[];
  relationships: RelationshipRow[];
  factions: FactionRow[];
}

export function buildGameState(rows: LoadedRows): { state: GameState; rules: RuleOptions } {
  const inventories: Record<string, InventoryEntry[]> = {};
  for (const i of rows.inventory) {
    (inventories[i.owner_id] ??= []).push({ itemKey: i.item_key, qty: i.qty, equipped: i.equipped, attuned: i.attuned });
  }
  return {
    state: {
      campaignId: rows.campaign.id,
      gameTime: rows.campaign.game_time,
      sceneLocationId: rows.campaign.scene_location_id,
      creatures: Object.fromEntries(rows.creatures.map((r) => [r.id, toCreature(r)])),
      inventories,
      wallets: Object.fromEntries(rows.wallets.map((w) => [w.owner_id, Number(w.cp)])),
      relationships: Object.fromEntries(rows.relationships.map((r) => [relKey(r.a, r.b), r.score])),
      factions: Object.fromEntries(rows.factions.map((r) => [r.id, toFaction(r)])),
      encounter: rows.campaign.encounter,
    },
    rules: { ...DEFAULT_RULES, ...(rows.campaign.settings ?? {}) },
  };
}

export interface TurnRecordInput {
  playerInput: string;
  intent: unknown;
  action: unknown;
  outcome: unknown;
  narration: unknown;
  narrationSource: "model" | "model_retry" | "template";
  validation: unknown[];
  rngNonce: string;
  usage: unknown[];
  hooks: { type: string; text: string }[];
  facts: { subject: string; predicate: string; value: string }[];
}

/**
 * Turun yan etkilerinden apply_turn() yükünü üret. Yalnızca DOKUNULAN
 * varlıklar gönderilir; son hâlleri motorun ürettiği durumdan alınır.
 */
export function buildApplyPayload(
  before: GameState,
  after: GameState,
  effects: Effect[],
  rolls: RollRecord[],
  rec: TurnRecordInput,
): Record<string, unknown> {
  const creatureIds = new Set<string>();
  const inventoryOwners = new Set<string>();
  const walletOwners = new Set<string>();
  const relPairs = new Set<string>();
  const factionIds = new Set<string>();
  const regionOwners = new Map<string, string>();

  for (const e of effects) {
    switch (e.op) {
      case "creature.update": creatureIds.add(e.id); break;
      case "move": creatureIds.add(e.id); break;
      case "inventory.add":
      case "inventory.remove": inventoryOwners.add(e.ownerId); break;
      case "wallet": walletOwners.add(e.ownerId); break;
      case "relationship": relPairs.add(relKey(e.a, e.b)); break;
      case "faction.update": {
        factionIds.add(e.id);
        const ids = e.after.regionIds;
        if (ids) for (const r of ids) regionOwners.set(r, e.id);
        break;
      }
      default: break;
    }
  }

  const playerMoved = effects.find((e): e is Extract<Effect, { op: "move" }> => e.op === "move");

  return {
    turn: {
      player_input: rec.playerInput,
      intent: rec.intent ?? null,
      action: rec.action,
      outcome: rec.outcome,
      narration: rec.narration,
      narration_source: rec.narrationSource,
      validation: rec.validation,
      rng_nonce: rec.rngNonce,
      usage: rec.usage,
      game_time_before: before.gameTime,
      game_time_after: after.gameTime,
    },
    game_time: after.gameTime,
    encounter: after.encounter,
    scene_location_id: playerMoved?.to ?? null,
    creatures: [...creatureIds].map((id) => fromCreature(after.creatures[id]!, after.campaignId)),
    inventory: [...inventoryOwners].map((owner) => ({
      owner_id: owner,
      items: (after.inventories[owner] ?? []).map((i) => ({
        item_key: i.itemKey, qty: i.qty, equipped: !!i.equipped, attuned: !!i.attuned,
      })),
    })),
    wallets: [...walletOwners].map((o) => ({ owner_id: o, cp: after.wallets[o] ?? 0 })),
    relationships: [...relPairs].map((k) => {
      const [a, b] = k.split("|") as [string, string];
      return { a, b, score: after.relationships[k] ?? 0 };
    }),
    factions: [...factionIds].map((id) => fromFaction(after.factions[id]!, after.campaignId)),
    regions: [...regionOwners].map(([id, owner]) => ({ id, owner_faction_id: owner })),
    rolls,
    effects,
    hooks: rec.hooks,
    facts: rec.facts,
  };
}
