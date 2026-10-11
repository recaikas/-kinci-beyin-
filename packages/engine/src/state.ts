/**
 * GameState: bir turu çözmek için gereken dünya dilimi (Supabase'den yüklenir).
 * StateWriter: durumu kopya üzerinde değiştirir ve her değişikliği Effect olarak
 * kaydeder. Effect listesi hem veritabanına yazılır (state_deltas) hem de
 * anlatıcıya "değişmez gerçekler" olarak verilir.
 */
import type { Condition } from "./conditions.ts";
import type { Creature, InventoryEntry } from "./types.ts";
import type { Quest, WorldState } from "./world.ts";

export type TurnTag = "dodging" | "disengaged" | "hidden" | "helped" | "sneak_used" | "action_surged";

export interface TurnEconomy {
  action: boolean;
  bonusAction: boolean;
  reaction: boolean;
  /** Kalan hareket (fit). */
  movement: number;
  /** Tur boyunca geçerli durumlar (Kaçın, Saklan, Yardım …). */
  tags: TurnTag[];
}

export interface Encounter {
  id: string;
  round: number;
  /** İnisiyatif sırası (yüksekten düşüğe). */
  order: { id: string; initiative: number }[];
  turnIndex: number;
  active: boolean;
  economy: Record<string, TurnEconomy>;
}

export interface Faction {
  id: string;
  name: string;
  /** Altın (gp). */
  treasury: number;
  /** Asker sayısı. */
  military: number;
  /** 0–100 */
  stability: number;
  population: number;
  /** 0–10 teknoloji / gelişmişlik. */
  tech: number;
  /** 0–100 casusluk ağı. */
  intelligence: number;
  /** Fraksiyon "yetenek" puanları (SRD yetenekleri gibi 1–30). */
  traits: Partial<Record<"diplomacy" | "martial" | "stewardship" | "intrigue" | "learning", number>>;
  regionIds: string[];
  atWarWith: string[];
  alliances: string[];
}

export interface GameState {
  campaignId: string;
  /** Kampanya başlangıcından bu yana geçen dakika. */
  gameTime: number;
  sceneLocationId: string | null;
  creatures: Record<string, Creature>;
  inventories: Record<string, InventoryEntry[]>;
  /** Bakır para (cp) cinsinden cüzdan; 1 gp = 100 cp. */
  wallets: Record<string, number>;
  /** "a|b" anahtarı (sıralı) → −100..+100 */
  relationships: Record<string, number>;
  factions: Record<string, Faction>;
  encounter: Encounter | null;
  /** Mekânlar, çıkışlar, dükkânlar, görevler (yoksa serbest hareket). */
  world?: WorldState;
}

export type Effect =
  | { op: "creature.update"; id: string; before: Partial<Creature>; after: Partial<Creature> }
  | { op: "inventory.add"; ownerId: string; itemKey: string; qty: number }
  | { op: "inventory.remove"; ownerId: string; itemKey: string; qty: number }
  | { op: "inventory.equip"; ownerId: string; itemKey: string; equipped: boolean }
  | { op: "wallet"; ownerId: string; deltaCp: number; afterCp: number }
  | { op: "relationship"; a: string; b: string; delta: number; after: number }
  | { op: "time"; minutes: number; after: number }
  | { op: "move"; id: string; from: string | null; to: string }
  | { op: "faction.update"; id: string; before: Partial<Faction>; after: Partial<Faction> }
  | { op: "encounter"; encounter: Encounter | null }
  | { op: "creature.spawn"; creature: Creature }
  | { op: "quest.update"; quest: Quest }
  | { op: "event"; type: GameEventType; payload: Record<string, unknown> };

/** Anlatıcı ve hafıza sistemi için önemli olaylar. */
export type GameEventType =
  | "creature.died"
  | "creature.dropped"
  | "creature.stabilized"
  | "creature.revived"
  | "condition.added"
  | "condition.removed"
  | "concentration.broken"
  | "spell.cast"
  | "level.up"
  | "attitude.changed"
  | "combat.started"
  | "combat.ended"
  | "turn.started"
  | "rest.short"
  | "rest.long"
  | "faction.war"
  | "faction.treaty"
  | "faction.event"
  | "creature.spawned"
  | "quest.accepted"
  | "quest.completed"
  | "social.success"
  | "talked"
  | "travel.ambush";

export class StateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateError";
  }
}

export function relKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export class StateWriter {
  readonly state: GameState;
  readonly effects: Effect[] = [];

  constructor(initial: GameState) {
    this.state = structuredClone(initial);
  }

  creature(id: string): Creature {
    const c = this.state.creatures[id];
    if (!c) throw new StateError(`Yaratık bulunamadı: ${id}`);
    return c;
  }

  updateCreature(id: string, patch: Partial<Creature>): void {
    const c = this.creature(id);
    const before: Partial<Creature> = {};
    const after: Partial<Creature> = {};
    let changed = false;
    for (const k of Object.keys(patch) as (keyof Creature)[]) {
      const next = patch[k];
      if (JSON.stringify(c[k]) === JSON.stringify(next)) continue;
      (before as Record<string, unknown>)[k] = structuredClone(c[k]);
      (after as Record<string, unknown>)[k] = structuredClone(next);
      (c as unknown as Record<string, unknown>)[k] = structuredClone(next);
      changed = true;
    }
    if (changed) this.effects.push({ op: "creature.update", id, before, after });
  }

  addCondition(id: string, cond: Condition): boolean {
    const c = this.creature(id);
    if (c.conditions.includes(cond) || c.conditionImmunities.includes(cond)) return false;
    this.updateCreature(id, { conditions: [...c.conditions, cond] });
    this.event("condition.added", { id, condition: cond });
    return true;
  }

  removeCondition(id: string, cond: Condition): boolean {
    const c = this.creature(id);
    if (!c.conditions.includes(cond)) return false;
    this.updateCreature(id, { conditions: c.conditions.filter((x) => x !== cond) });
    this.event("condition.removed", { id, condition: cond });
    return true;
  }

  itemQty(ownerId: string, itemKey: string): number {
    return (this.state.inventories[ownerId] ?? [])
      .filter((e) => e.itemKey === itemKey)
      .reduce((s, e) => s + e.qty, 0);
  }

  addItem(ownerId: string, itemKey: string, qty = 1): void {
    if (qty <= 0) throw new StateError("Miktar pozitif olmalı");
    const inv = (this.state.inventories[ownerId] ??= []);
    const e = inv.find((x) => x.itemKey === itemKey);
    if (e) e.qty += qty;
    else inv.push({ itemKey, qty });
    this.effects.push({ op: "inventory.add", ownerId, itemKey, qty });
  }

  removeItem(ownerId: string, itemKey: string, qty = 1): void {
    if (qty <= 0) throw new StateError("Miktar pozitif olmalı");
    if (this.itemQty(ownerId, itemKey) < qty) {
      throw new StateError(`${this.state.creatures[ownerId]?.name ?? ownerId} envanterinde yeterli ${itemKey} yok`);
    }
    const inv = this.state.inventories[ownerId]!;
    let left = qty;
    for (const e of inv) {
      if (e.itemKey !== itemKey || left === 0) continue;
      const take = Math.min(e.qty, left);
      e.qty -= take;
      left -= take;
    }
    this.state.inventories[ownerId] = inv.filter((e) => e.qty > 0);
    this.effects.push({ op: "inventory.remove", ownerId, itemKey, qty });
  }

  walletCp(ownerId: string): number {
    return this.state.wallets[ownerId] ?? 0;
  }

  adjustWallet(ownerId: string, deltaCp: number): void {
    const next = this.walletCp(ownerId) + deltaCp;
    if (next < 0) {
      const who = this.state.creatures[ownerId]?.name ?? this.state.factions[ownerId]?.name ?? ownerId;
      throw new StateError(`${who} için yetersiz para (gereken ${-deltaCp} bakır, mevcut ${this.walletCp(ownerId)})`);
    }
    this.state.wallets[ownerId] = next;
    this.effects.push({ op: "wallet", ownerId, deltaCp, afterCp: next });
  }

  relationship(a: string, b: string): number {
    return this.state.relationships[relKey(a, b)] ?? 0;
  }

  adjustRelationship(a: string, b: string, delta: number): number {
    const k = relKey(a, b);
    const before = this.state.relationships[k] ?? 0;
    const after = Math.max(-100, Math.min(100, before + delta));
    this.state.relationships[k] = after;
    if (after !== before) this.effects.push({ op: "relationship", a, b, delta: after - before, after });
    return after;
  }

  advanceTime(minutes: number): void {
    if (minutes <= 0) return;
    this.state.gameTime += minutes;
    this.effects.push({ op: "time", minutes, after: this.state.gameTime });
  }

  move(id: string, to: string): void {
    const c = this.creature(id);
    const from = c.locationId ?? null;
    if (from === to) return;
    c.locationId = to;
    this.effects.push({ op: "move", id, from, to });
  }

  faction(id: string): Faction {
    const f = this.state.factions[id];
    if (!f) throw new StateError(`Fraksiyon bulunamadı: ${id}`);
    return f;
  }

  updateFaction(id: string, patch: Partial<Faction>): void {
    const f = this.faction(id);
    const before: Partial<Faction> = {};
    const after: Partial<Faction> = {};
    for (const k of Object.keys(patch) as (keyof Faction)[]) {
      (before as Record<string, unknown>)[k] = structuredClone(f[k]);
      (after as Record<string, unknown>)[k] = structuredClone(patch[k]);
      (f as unknown as Record<string, unknown>)[k] = structuredClone(patch[k]);
    }
    this.effects.push({ op: "faction.update", id, before, after });
  }

  setEncounter(e: Encounter | null): void {
    this.state.encounter = e ? structuredClone(e) : null;
    this.effects.push({ op: "encounter", encounter: e ? structuredClone(e) : null });
  }

  event(type: GameEventType, payload: Record<string, unknown>): void {
    this.effects.push({ op: "event", type, payload });
  }
}

