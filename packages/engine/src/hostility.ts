/**
 * Düşmanlık kuralı (AI ve Sinsi Saldırı'nın "yanında müttefik" kontrolü paylaşır).
 */
import { relKey, type GameState } from "./state.ts";
import type { Creature } from "./types.ts";

/** a, b'ye düşman mı? Canavarlar varsayılan düşman; NPC'ler ilişki −25 ve altındaysa. */
export function isHostileTo(s: GameState, a: Creature, b: Creature): boolean {
  if (a.id === b.id) return false;
  if (a.kind === "pc" && b.kind === "pc") return false;
  if (a.kind !== "pc" && b.kind !== "pc") return false;
  const npc = a.kind === "pc" ? b : a;
  const pc = a.kind === "pc" ? a : b;
  const r = s.relationships[relKey(npc.id, pc.id)] ?? 0;
  return npc.kind === "monster" ? r < 25 : r <= -25;
}
