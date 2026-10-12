/**
 * Dünya şablonu → oynanabilir kampanya durumu.
 */
import {
  type BuiltCharacter, type CharacterLimits, type StartingKit, type Creature, type Faction, type GameState, type InventoryEntry, type ObjectiveKind,
  type PlaceInfo, type Quest, relKey, type ShopInfo, spawnMonster, type WorldState,
} from "@kader/engine";
import type { CanonFact, Persona, WorldBible } from "@kader/llm";
import type { ChronicleEvent } from "./chronicle.ts";

export interface NpcPersona {
  personality: string;
  goals: string;
  speechStyle: string;
  /** Anlatıcıya gönderilmez. */
  secrets?: string;
}

export interface NpcTemplate {
  key: string;
  template: string;
  name: string;
  kind?: Creature["kind"];
  locationId: string;
  relationship?: number;
  hp?: number;
  persona?: NpcPersona;
  shop?: ShopInfo;
  walletCp?: number;
  inventory?: [string, number][];
}

export interface QuestTemplate {
  id: string;
  title: string;
  description: string;
  status: Quest["status"];
  giverKey?: string;
  objectives: { id: string; text: string; kind: ObjectiveKind; targetKey?: string; itemKey?: string; templateKey?: string; qty?: number }[];
  rewards: Quest["rewards"];
}

export interface FactionTemplate extends Omit<Faction, "id" | "regionIds" | "atWarWith" | "alliances"> {
  key: string;
}

/** Dünyanın türü ve kural sınırları (fantastik / büyüsüz tarihî). */
export interface WorldSetting {
  era: "fantasy" | "historical";
  /** Seçim ekranında gösterilen kısa tanıtım. */
  tagline: string;
  /** Örn. "Akdeniz, 1570". */
  period?: string;
  /** false: büyü yok; büyü sekmesi gizlenir, büyücü sınıflar seçilemez. */
  magic: boolean;
  limits?: CharacterLimits;
  /** Sınıfların bu dünyadaki adları/açıklamaları (ör. Savaşçı → Levent). */
  classNames?: Record<string, { name: string; description: string }>;
  kit?: StartingKit;
  /** Oyuncunun başlangıç rolü (ör. "Gemi Kâtibi"); kökeni boşsa bu yazılır. */
  role?: { name: string; description: string };
}

export const FANTASY_SETTING: WorldSetting = { era: "fantasy", tagline: "", magic: true };

export interface WorldTemplate {
  key: string;
  setting?: WorldSetting;
  bible: WorldBible;
  start: {
    locationId: string;
    gameTime: number;
    playerItems: { key: string; qty: number }[];
    /** İkinci şahısla yazılmış açılış sahnesi (yoksa öncül + rol + mekândan kurulur). */
    intro?: string;
  };
  places: PlaceInfo[];
  exits: WorldState["exits"];
  npcs: NpcTemplate[];
  quests: QuestTemplate[];
  factions: FactionTemplate[];
  factionRelations: [string, string, number][];
  playerFaction?: string;
  facts: { subjectKey: string; predicate: string; value: string; locked: boolean }[];
  /** Zamanlı tarih olayları; oyuncunun başarıları dalı seçer. */
  chronicle?: ChronicleEvent[];
}

export interface InstantiatedWorld {
  state: GameState;
  personas: Record<string, Persona & { secrets?: string }>;
  facts: CanonFact[];
  /** Şablon anahtarı → oluşturulan kimlik. */
  ids: Record<string, string>;
}

/** Şablonu verilen oyuncu karakteriyle yeni bir oyun durumuna dönüştür. */
export function instantiateWorld(
  t: WorldTemplate,
  campaignId: string,
  player: BuiltCharacter,
  newId: () => string,
): InstantiatedWorld {
  const ids: Record<string, string> = {};
  const idOf = (key: string): string => (ids[key] ??= newId());
  // Mekânlar şablondaki kimliklerini korur (okunabilir; DB'de text anahtar olarak tutulur).
  const creatures: Record<string, Creature> = {};
  const inventories: Record<string, InventoryEntry[]> = {};
  const wallets: Record<string, number> = {};
  const relationships: Record<string, number> = {};
  const personas: InstantiatedWorld["personas"] = {};
  const shops: Record<string, ShopInfo> = {};

  const pc = { ...player.creature, locationId: t.start.locationId };
  creatures[pc.id] = pc;
  inventories[pc.id] = [...player.inventory];
  for (const it of t.start.playerItems) {
    const e = inventories[pc.id]!.find((i) => i.itemKey === it.key);
    if (e) e.qty += it.qty;
    else inventories[pc.id]!.push({ itemKey: it.key, qty: it.qty });
  }
  wallets[pc.id] = player.walletCp;

  for (const n of t.npcs) {
    const id = idOf(n.key);
    const c = spawnMonster(n.template, id, {
      name: n.name,
      locationId: n.locationId,
      ...(n.kind ? { kind: n.kind } : {}),
      ...(n.hp !== undefined ? { hp: n.hp } : {}),
    });
    creatures[id] = c;
    if (n.inventory?.length) inventories[id] = n.inventory.map(([itemKey, qty]) => ({ itemKey, qty }));
    if (n.walletCp) wallets[id] = n.walletCp;
    if (n.relationship) relationships[relKey(pc.id, id)] = n.relationship;
    if (n.persona) personas[id] = { id, ...n.persona };
    if (n.shop) shops[id] = n.shop;
  }

  const factions: Record<string, Faction> = {};
  for (const f of t.factions) {
    const id = idOf(`faction:${f.key}`);
    const { key: _key, ...rest } = f;
    factions[id] = { ...rest, id, regionIds: [], atWarWith: [], alliances: [] };
  }
  for (const [a, b, score] of t.factionRelations) {
    relationships[relKey(idOf(`faction:${a}`), idOf(`faction:${b}`))] = score;
    if (score <= -50) {
      factions[idOf(`faction:${a}`)]!.atWarWith.push(idOf(`faction:${b}`));
      factions[idOf(`faction:${b}`)]!.atWarWith.push(idOf(`faction:${a}`));
    }
  }
  if (t.playerFaction) pc.factionId = idOf(`faction:${t.playerFaction}`);

  const resolveTarget = (key?: string) => (key === undefined ? undefined : t.places.some((p) => p.id === key) ? key : idOf(key));
  const quests: Record<string, Quest> = {};
  for (const q of t.quests) {
    quests[q.id] = {
      id: q.id,
      title: q.title,
      description: q.description,
      status: q.status,
      ...(q.giverKey ? { giverId: idOf(q.giverKey) } : {}),
      objectives: q.objectives.map((o) => {
        const targetId = resolveTarget(o.targetKey);
        return {
          id: o.id, text: o.text, kind: o.kind, done: false,
          ...(targetId ? { targetId } : {}),
          ...(o.itemKey ? { itemKey: o.itemKey } : {}),
          ...(o.templateKey ? { templateKey: o.templateKey } : {}),
          ...(o.qty ? { qty: o.qty } : {}),
        };
      }),
      rewards: q.rewards,
    };
  }

  const state: GameState = {
    campaignId,
    gameTime: t.start.gameTime,
    sceneLocationId: t.start.locationId,
    creatures,
    inventories,
    wallets,
    relationships,
    factions,
    encounter: null,
    world: {
      places: Object.fromEntries(t.places.map((p) => [p.id, p])),
      exits: t.exits,
      shops,
      quests,
    },
  };
  const facts: CanonFact[] = t.facts.map((f) => ({ subject: idOf(f.subjectKey), predicate: f.predicate, value: f.value, locked: f.locked }));
  return { state, personas, facts, ids };
}
