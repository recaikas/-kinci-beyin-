/**
 * NPC / canavar taktik yapay zekâsı — KURAL TABANLI, LLM değil.
 * Savaşta oyuncu olmayanların sırası geldiğinde deterministik olarak eylem seçer,
 * böylece savaş LLM'e bağımlı olmadan akar. LLM sadece sonucu betimler.
 */
import type { Rng } from "@kader/dice";
import { conditionEffects } from "./conditions.ts";
import { isHostileTo } from "./hostility.ts";
import type { GameState } from "./state.ts";
import type { Creature } from "./types.ts";
import { type Catalog, DEFAULT_CATALOG, type GameAction, resolveAction, type TurnResolution } from "./actions.ts";
import type { RuleOptions } from "./rules.ts";

/** a, b'ye düşman mı? (hostility.ts'deki kuralın kısayolu) */
export function isHostile(s: GameState, a: Creature, b: Creature): boolean {
  return isHostileTo(s, a, b);
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

  // Büyücü NPC: yaralı müttefiki iyileştir, kontrol büyüsü, sonra hasar büyüsü.
  const spell = chooseNpcSpell(s, me, target, catalog);
  if (spell) return spell;

  const attacks = (me.attacks ?? []).filter((k) => catalog.weapons[k]);
  const melee = attacks.find((k) => !catalog.weapons[k]!.ranged);
  const weaponKey = melee ?? attacks[0] ?? "unarmed";
  return { type: "attack", actorId: id, targetId: target.id, weaponKey, distance: catalog.weapons[weaponKey]?.ranged ? 30 : 5 };
}

function chooseNpcSpell(s: GameState, me: Creature, target: Creature, catalog: Catalog): GameAction | null {
  const sc = me.spellcasting;
  if (!sc) return null;
  const known = sc.known.map((k) => catalog.spells[k]).filter((x): x is NonNullable<typeof x> => !!x && !x.utility);
  const slotFor = (lv: number): number | null => {
    if (lv === 0) return 0;
    for (let l = lv; l <= 9; l++) if ((sc.slots[l] ?? 0) > 0) return l;
    return null;
  };
  const allies = Object.values(s.creatures).filter((c) => c.isAlive && c.locationId === me.locationId && c.kind !== "pc" && !isHostileTo(s, c, me));
  const hurt = allies.filter((c) => c.hp > 0 && c.hp < c.maxHp / 2).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const healer = known.find((x) => x.heal && x.level > 0 && slotFor(x.level) !== null);
  if (hurt && healer) return { type: "cast_spell", actorId: me.id, spellKey: healer.key, slotLevel: slotFor(healer.level)!, targetIds: [hurt.id] };
  const control = known.find((x) => x.conditionsOnFail?.length && x.concentration && slotFor(x.level) !== null);
  if (control && !sc.concentratingOn && target.kind === "pc" && !target.conditions.includes("paralyzed")) {
    return { type: "cast_spell", actorId: me.id, spellKey: control.key, slotLevel: slotFor(control.level)!, targetIds: [target.id] };
  }
  const damaging = known
    .filter((x) => (x.damage || x.autoHitDarts || x.rays) && slotFor(x.level) !== null)
    .sort((a, b) => b.level - a.level)[0];
  if (damaging) return { type: "cast_spell", actorId: me.id, spellKey: damaging.key, slotLevel: slotFor(damaging.level)!, targetIds: [target.id] };
  return null;
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
