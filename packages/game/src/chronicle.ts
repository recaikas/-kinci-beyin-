/**
 * Tarih akışı: dünya oyuncudan bağımsız ilerler, ama oyuncunun başardıkları
 * olayların hangi daldan gerçekleşeceğini belirler ("ikisi bir arada": kişisel
 * hikâye + büyük resim).
 *
 * Olaylar oyun saatine bağlıdır ve kalıcı bir "ateşlendi" listesi gerektirmez:
 * bir olay, saati önceki ile yeni oyun zamanı arasında kalan turda tam bir kez
 * gerçekleşir. Etkiler (güç değerleri, ilişkiler) motor durumuna yazılır ve
 * normal tur farkıyla saklanır; olayın metni o turun günlük kaydına eklenir.
 */
import { type GameState, relKey } from "@kader/engine";
import type { WorldTemplate } from "./template.ts";

export interface ChronicleVariant {
  /** Hepsi sağlanmalı: listelenen görevler tamamlanmış / tamamlanmamış. */
  when?: { questDone?: string[]; questNotDone?: string[] };
  title: string;
  text: string;
  /** Şablondaki güç anahtarıyla değer değişimleri. */
  factions?: { key: string; treasury?: number; military?: number; stability?: number; intelligence?: number; population?: number }[];
  /** İki güç arasındaki ilişki değişimi (şablon anahtarları). */
  relations?: [string, string, number][];
  /** Oyuncu ile NPC (şablon anahtarı) arasındaki ilişki değişimi. */
  npcRelations?: [string, number][];
}

export interface ChronicleEvent {
  id: string;
  /** Oyun dakikası (0 = 1. gün 00:00). */
  atMinute: number;
  /** Olay gerçekleşmeden önce gösterilen ipucu. */
  teaser: string;
  /** Koşulu sağlanan İLK dal gerçekleşir; hiçbiri sağlanmazsa olay sessizce geçer. */
  variants: ChronicleVariant[];
}

export interface ChronicleEntry {
  id: string;
  title: string;
  text: string;
  gameTime: number;
}

const clamp = (v: number, lo: number, hi = Number.POSITIVE_INFINITY) => Math.max(lo, Math.min(hi, v));

function questDone(s: GameState, id: string): boolean {
  return s.world?.quests[id]?.status === "completed";
}

function matches(s: GameState, v: ChronicleVariant): boolean {
  return (v.when?.questDone ?? []).every((q) => questDone(s, q))
    && (v.when?.questNotDone ?? []).every((q) => !questDone(s, q));
}

/** Önceki zamandan (hariç) yeni zamana (dahil) kadar düşen olayları uygula. */
export function advanceChronicle(
  t: WorldTemplate,
  state: GameState,
  playerId: string,
  fromMinute: number,
): { state: GameState; entries: ChronicleEntry[] } {
  const due = (t.chronicle ?? [])
    .filter((e) => e.atMinute > fromMinute && e.atMinute <= state.gameTime)
    .sort((a, b) => a.atMinute - b.atMinute);
  if (!due.length) return { state, entries: [] };

  const s: GameState = structuredClone(state);
  const factionId = (key: string) => {
    const name = t.factions.find((f) => f.key === key)?.name;
    return Object.values(s.factions).find((f) => f.name === name)?.id;
  };
  const npcId = (key: string) => {
    const name = t.npcs.find((n) => n.key === key)?.name;
    return Object.values(s.creatures).find((c) => c.name === name)?.id;
  };
  const entries: ChronicleEntry[] = [];
  for (const e of due) {
    const v = e.variants.find((x) => matches(s, x));
    if (!v) continue;
    for (const d of v.factions ?? []) {
      const f = s.factions[factionId(d.key) ?? ""];
      if (!f) continue;
      if (d.treasury) f.treasury = clamp(f.treasury + d.treasury, 0);
      if (d.military) f.military = clamp(f.military + d.military, 0);
      if (d.stability) f.stability = clamp(f.stability + d.stability, 0, 100);
      if (d.intelligence) f.intelligence = clamp(f.intelligence + d.intelligence, 0, 100);
      if (d.population) f.population = clamp(f.population + d.population, 0);
    }
    for (const [a, b, delta] of v.relations ?? []) {
      const ia = factionId(a);
      const ib = factionId(b);
      if (!ia || !ib) continue;
      const k = relKey(ia, ib);
      s.relationships[k] = clamp((s.relationships[k] ?? 0) + delta, -100, 100);
    }
    for (const [key, delta] of v.npcRelations ?? []) {
      const id = npcId(key);
      if (!id || !s.creatures[id]?.isAlive) continue;
      const k = relKey(playerId, id);
      s.relationships[k] = clamp((s.relationships[k] ?? 0) + delta, -100, 100);
    }
    entries.push({ id: e.id, title: v.title, text: v.text, gameTime: e.atMinute });
  }
  return { state: s, entries };
}

/** Henüz gerçekleşmemiş en yakın olayın ipucu. */
export function nextChronicle(t: WorldTemplate | undefined, gameTime: number): { teaser: string; atMinute: number } | null {
  const e = (t?.chronicle ?? []).filter((x) => x.atMinute > gameTime).sort((a, b) => a.atMinute - b.atMinute)[0];
  return e ? { teaser: e.teaser, atMinute: e.atMinute } : null;
}
