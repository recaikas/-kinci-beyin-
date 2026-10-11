/**
 * NPC / canavar taktik yapay zekâsı — KURAL TABANLI, LLM değil.
 * Savaşta oyuncu olmayanların sırası geldiğinde deterministik olarak eylem seçer,
 * böylece savaş LLM'e bağımlı olmadan akar. LLM sadece sonucu betimler.
 */
import type { Rng } from "@kader/dice";
import { conditionEffects } from "./conditions.ts";
import { relKey } from "./state.ts";
import type { GameState } from "./state.ts";
import type { Creature } from "./types.ts";
import { type Catalog, DEFAULT_CATALOG, type GameAction, resolveAction, type TurnResolution } from "./actions.ts";
import type { RuleOptions } from "./rules.ts";

function rel(s: GameState, a: string, b: string): number {
  return s.relationships[relKey(a, b)] ?? 0;
}

/** a, b'ye düşman mı? Canavarlar varsayılan düşman; NPC'ler ilişki −25 ve altındaysa. */
export function isHostile(s: GameState, a: Creature, b: Creature): boolean {
  if (a.id === b.id) return false;
  if (a.kind === "pc" && b.kind === "pc") return false;
  if (a.kind !== "pc" && b.kind !== "pc") return false;
  const npc = a.kind === "pc" ? b : a;
  const pc = a.kind === "pc" ? a : b;
  const r = rel(s, npc.id, pc.id);
  return npc.kind === "monster" ? r < 25 : r <= -25;
}

/** Karşılaşmadaki düşman tarafların hâlâ ayakta olup olmadığı. */
export function combatOver(s: GameState): boolean {
  const enc = s.encounter;
  if (!enc?.active) return true;
  const fighters = enc.order.map((o) => s.creatures[o.id]).filter((c): c is Creature => !!c && c.isAlive && c.hp > 0);
  const pcs = fighters.filter((c) => c.kind === "pc");
  const foes = fighters.filter((c) => c.kind !== "pc" && pcs.some((p) => isHostile(s, c, p)));
  return pcs.length === 0 || foes.length === 0;
}

/** Sırası gelen NPC için eylem seç; yapacak bir şey yoksa null (turu bitirir). */
export function chooseNpcAction(s: GameState, id: string, catalog: Catalog = DEFAULT_CATALOG): GameAction | null {
  const me = s.creatures[id];
  if (!me || !me.isAlive || me.hp <= 0) return null;
  const fx = conditionEffects(me.conditions, me.exhaustion);
  if (fx.incapacitated) return null;

  const foes = Object.values(s.creatures).filter((c) =>
    c.isAlive && c.locationId === me.locationId && isHostile(s, me, c));
  const standing = foes.filter((c) => c.hp > 0).sort((a, b) => a.hp - b.hp || a.ac - b.ac);
  const target = standing[0];
  if (!target) return null;

  // Moral: zeki canavar ağır yaralıysa kaçınmaya geçer.
  if (me.kind === "monster" && me.abilities.int >= 6 && me.hp <= me.maxHp / 4) {
    return { type: "dodge", actorId: id };
  }

  const attacks = (me.attacks ?? []).filter((k) => catalog.weapons[k]);
  const melee = attacks.find((k) => !catalog.weapons[k]!.ranged);
  const weaponKey = melee ?? attacks[0] ?? "unarmed";
  return { type: "attack", actorId: id, targetId: target.id, weaponKey, distance: catalog.weapons[weaponKey]?.ranged ? 30 : 5 };
}

export interface AutopilotOptions {
  rng: Rng;
  rules?: RuleOptions;
  catalog?: Catalog;
  /** Sonsuz döngü koruması. */
  maxSteps?: number;
}

/**
 * Oyuncunun eyleminden sonra savaşı ilerlet: oyuncunun turunu kapat, NPC'leri
 * oynat, sıra tekrar oyuncuya gelince (ya da savaş bitince) dur.
 * Bayılan oyuncu karakteri için ölüm kurtarma atışı otomatik atılır.
 */
export function combatAutopilot(state: GameState, playerId: string, o: AutopilotOptions): { state: GameState; steps: TurnResolution[] } {
  const steps: TurnResolution[] = [];
  const opts = { rng: o.rng, ...(o.rules ? { rules: o.rules } : {}), ...(o.catalog ? { catalog: o.catalog } : {}) };
  let s = state;
  const run = (a: GameAction): boolean => {
    const r = resolveAction(s, a, opts);
    if (!r.ok) return false;
    steps.push(r);
    s = r.state;
    return true;
  };
  const current = () => s.encounter!.order[s.encounter!.turnIndex]!.id;

  if (!s.encounter?.active) return { state: s, steps };
  // Oyuncu eylemini kullandıysa turunu kapat.
  if (current() === playerId && s.encounter.economy[playerId]?.action === false) {
    run({ type: "end_turn", actorId: playerId });
  }

  for (let i = 0; i < (o.maxSteps ?? 60) && s.encounter?.active; i++) {
    if (combatOver(s)) {
      run({ type: "end_combat", actorId: playerId });
      break;
    }
    const id = current();
    const c = s.creatures[id]!;
    if (id === playerId) {
      if (c.isAlive && c.hp === 0 && !c.deathSaves.stable) {
        run({ type: "death_save", actorId: id });
        if (!s.creatures[id]!.isAlive) {
          run({ type: "end_combat", actorId: playerId });
          break;
        }
        if (s.creatures[id]!.hp > 0) break; // doğal 20: oyuncu kalktı, sıra onda
        run({ type: "end_turn", actorId: id });
        continue;
      }
      if (c.isAlive && c.hp > 0) break; // oyuncunun sırası
      run({ type: "end_turn", actorId: id });
      continue;
    }
    const action = chooseNpcAction(s, id, o.catalog);
    if (action) run(action);
    if (s.encounter?.active) run({ type: "end_turn", actorId: id });
  }
  return { state: s, steps };
}
