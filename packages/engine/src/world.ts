/**
 * Dünya sistemleri: mekânlar ve çıkışlar, seyahat karşılaşmaları, dükkânlar, görevler.
 * Hepsi deterministik; LLM yalnızca sonucu anlatır.
 */
import type { EngineContext } from "./context.ts";
import { type Effect, type GameState, StateError, type StateWriter } from "./state.ts";
import { MONSTERS, spawnMonster } from "./srd/monsters.ts";
import { ITEMS } from "./srd/items.ts";

export interface PlaceInfo {
  id: string;
  name: string;
  description: string;
  /** 0 = güvenli; seyahatte d20 ≤ danger ise karşılaşma. */
  danger: number;
  /** Rastgele karşılaşma tablosu. */
  encounters: { templateKey: string; count: string; weight?: number }[];
  /** Güvenli dinlenme yeri mi (han, ev). */
  safeRest?: boolean;
}

export interface ExitInfo {
  to: string;
  minutes: number;
  /** Bu çıkışı kullanmak için gereken eşya (anahtar, harita). */
  requiresItem?: string;
  description?: string;
}

export interface ShopInfo {
  /** Satış fiyat çarpanı (oyuncu alırken). */
  sellFactor: number;
  /** Alış fiyat çarpanı (oyuncu satarken). */
  buyFactor: number;
}

export type ObjectiveKind = "reach" | "kill" | "give" | "persuade" | "collect" | "talk" | "kill_template";

export interface Objective {
  id: string;
  text: string;
  kind: ObjectiveKind;
  /** reach: konum; kill/give/persuade/talk: yaratık. */
  targetId?: string;
  /** give/collect: eşya; kill_template: canavar şablonu. */
  itemKey?: string;
  templateKey?: string;
  qty?: number;
  /** kill_template sayacı. */
  progress?: number;
  done: boolean;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  status: "available" | "open" | "completed" | "failed";
  giverId?: string;
  objectives: Objective[];
  rewards: { xp?: number; cp?: number; items?: { key: string; qty: number }[] };
}

export interface WorldState {
  places: Record<string, PlaceInfo>;
  exits: Record<string, ExitInfo[]>;
  shops: Record<string, ShopInfo>;
  quests: Record<string, Quest>;
}

export function emptyWorld(): WorldState {
  return { places: {}, exits: {}, shops: {}, quests: {} };
}

/* ------------------------------------------------------------------ */
/* Seyahat                                                             */
/* ------------------------------------------------------------------ */

export function findExit(s: GameState, from: string, to: string): ExitInfo | undefined {
  return s.world?.exits[from]?.find((e) => e.to === to);
}

export interface TravelEncounter {
  templateKey: string;
  ids: string[];
}

/** Varışta karşılaşma zarı: d20 ≤ tehlike → tablodan ağırlıklı seçim, sayı zarı. */
export function rollTravelEncounter(ctx: EngineContext, w: StateWriter, placeId: string, newId: () => string): TravelEncounter | null {
  const place = w.state.world?.places[placeId];
  if (!place || place.danger <= 0 || !place.encounters.length) return null;
  const check = ctx.roll("1d20", `${place.name}: karşılaşma zarı`).total;
  if (check > place.danger) return null;
  const total = place.encounters.reduce((s, e) => s + (e.weight ?? 1), 0);
  let pick = ctx.die(total);
  const entry = place.encounters.find((e) => (pick -= e.weight ?? 1) <= 0) ?? place.encounters[0]!;
  const n = Math.max(1, Math.min(8, ctx.roll(entry.count, "karşılaşma sayısı").total));
  const ids: string[] = [];
  const tmpl = MONSTERS[entry.templateKey];
  if (!tmpl) throw new StateError(`Bilinmeyen canavar: ${entry.templateKey}`);
  for (let i = 0; i < n; i++) {
    const id = newId();
    // Yol karşılaşmaları her zaman düşmandır (insansı NPC şablonları dahil).
    const c = spawnMonster(entry.templateKey, id, { locationId: placeId, name: n > 1 ? `${tmpl.name} ${i + 1}` : tmpl.name, kind: "monster" });
    spawnCreature(w, c);
    ids.push(id);
  }
  return { templateKey: entry.templateKey, ids };
}

export function spawnCreature(w: StateWriter, c: GameState["creatures"][string]): void {
  if (w.state.creatures[c.id]) throw new StateError(`Yaratık zaten var: ${c.id}`);
  w.state.creatures[c.id] = structuredClone(c);
  w.effects.push({ op: "creature.spawn", creature: structuredClone(c) });
  w.event("creature.spawned", { id: c.id, name: c.name, templateKey: c.templateKey ?? null });
}

/* ------------------------------------------------------------------ */
/* Dükkân                                                              */
/* ------------------------------------------------------------------ */

/** Eşyanın bu dükkândaki fiyatı (cp). Pazarlık başarısı %10–20 indirim/artış. */
export function priceFor(shop: ShopInfo, itemKey: string, direction: "buy" | "sell", haggleBonus = 0): number {
  const item = ITEMS[itemKey];
  if (!item) throw new StateError(`Bilinmeyen eşya: ${itemKey}`);
  const base = item.valueCp;
  if (direction === "buy") return Math.max(1, Math.round(base * shop.sellFactor * (1 - haggleBonus)));
  return Math.max(0, Math.floor(base * shop.buyFactor * (1 + haggleBonus)));
}

/* ------------------------------------------------------------------ */
/* Görevler                                                            */
/* ------------------------------------------------------------------ */

export function setQuest(w: StateWriter, q: Quest): void {
  if (!w.state.world) throw new StateError("Dünya durumu yok");
  w.state.world.quests[q.id] = structuredClone(q);
  w.effects.push({ op: "quest.update", quest: structuredClone(q) });
}

/** Bu eylemin etkilerine bakarak açık görev hedeflerini işaretle; tamamlananları ödüllendir. */
export function evaluateQuests(w: StateWriter, effects: Effect[], playerIds: string[]): { completed: Quest[]; progressed: string[] } {
  const world = w.state.world;
  const completed: Quest[] = [];
  const progressed: string[] = [];
  if (!world) return { completed, progressed };
  const pcs = playerIds.map((id) => w.state.creatures[id]).filter((c): c is NonNullable<typeof c> => !!c && c.isAlive);
  for (const quest of Object.values(world.quests)) {
    if (quest.status !== "open") continue;
    const q = structuredClone(quest);
    let changed = false;
    for (const o of q.objectives) {
      if (o.done) continue;
      let done = false;
      switch (o.kind) {
        case "reach":
          done = pcs.some((p) => p.locationId === o.targetId);
          break;
        case "kill":
          done = !!o.targetId && w.state.creatures[o.targetId]?.isAlive === false;
          break;
        case "kill_template": {
          const kills = effects.filter((e) => e.op === "event" && e.type === "creature.died"
            && w.state.creatures[String(e.payload.id)]?.templateKey === o.templateKey).length;
          if (kills) {
            o.progress = (o.progress ?? 0) + kills;
            changed = true;
          }
          done = (o.progress ?? 0) >= (o.qty ?? 1);
          break;
        }
        case "give":
          done = effects.some((e) => e.op === "inventory.add" && e.ownerId === o.targetId && e.itemKey === o.itemKey)
            && effects.some((e) => e.op === "inventory.remove" && playerIds.includes(e.ownerId) && e.itemKey === o.itemKey);
          break;
        case "persuade":
          done = effects.some((e) => e.op === "event" && e.type === "social.success" && e.payload.targetId === o.targetId);
          break;
        case "talk":
          done = effects.some((e) => e.op === "event" && e.type === "talked" && e.payload.targetId === o.targetId);
          break;
        case "collect":
          done = pcs.some((p) => (w.state.inventories[p.id] ?? []).filter((i) => i.itemKey === o.itemKey).reduce((s, i) => s + i.qty, 0) >= (o.qty ?? 1));
          break;
      }
      if (done) {
        o.done = true;
        changed = true;
        progressed.push(`Görev hedefi tamamlandı: ${o.text}`);
      }
    }
    if (q.objectives.every((o) => o.done)) {
      q.status = "completed";
      changed = true;
      completed.push(q);
    }
    if (changed) setQuest(w, q);
  }
  return { completed, progressed };
}

/** Görev ödüllerini ilk canlı PC'ye ver (XP tüm PC'lere bölünür). */
export function grantQuestRewards(w: StateWriter, q: Quest, playerIds: string[], award: (id: string, xp: number) => void): string[] {
  const facts: string[] = [];
  const pcs = playerIds.filter((id) => w.state.creatures[id]?.isAlive);
  const main = pcs[0];
  if (!main) return facts;
  if (q.rewards.cp) {
    w.adjustWallet(main, q.rewards.cp);
  }
  for (const it of q.rewards.items ?? []) w.addItem(main, it.key, it.qty);
  if (q.rewards.xp) {
    const share = Math.floor(q.rewards.xp / pcs.length);
    for (const id of pcs) award(id, share);
    facts.push(`Görev ödülü: ${share} XP`);
  }
  w.event("quest.completed", { questId: q.id, title: q.title });
  return facts;
}
