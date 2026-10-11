/**
 * Arayüz için türetilmiş görünüm. Hem yerel hem Supabase modunda aynı veriden üretilir.
 */
import {
  ABILITIES, ABILITY_NAMES_TR, type Ability, abilityModifier, ARMOR, attitudeFromScore, ATTITUDE_TR, CLASS_ABILITY_TR,
  CLASSES, CONDITION_NAMES_TR, type Creature, currentTurnId, DEFAULT_CATALOG, effectiveAc, type GameState, isHostileTo,
  ITEMS, passiveScore, priceFor, proficiencyBonus, RACES, relKey, saveModifier, SKILL_LIST, SKILL_NAMES_TR, SKILLS,
  skillModifier, SPELLS, XP_THRESHOLDS, formatCp,
} from "@kader/engine";
import { healthBand } from "@kader/llm";
import { type Campaign, currentExits, currentLocation } from "./campaign.ts";

export interface SheetView {
  id: string;
  name: string;
  race: string;
  className: string;
  level: number;
  xp: number;
  xpNext: number | null;
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
  speed: number;
  proficiency: number;
  initiative: number;
  passivePerception: number;
  abilities: { key: Ability; name: string; score: number; mod: number; save: number; proficient: boolean }[];
  skills: { key: string; name: string; ability: string; mod: number; proficient: boolean; expertise: boolean }[];
  conditions: string[];
  buffs: string[];
  exhaustion: number;
  deathSaves: Creature["deathSaves"];
  resources: { key: string; name: string; current: number; max: number; recharge: string }[];
  spellcasting: null | {
    ability: string;
    dc: number;
    attack: number;
    slots: { level: number; current: number; max: number }[];
    concentratingOn: string | null;
    spells: { key: string; name: string; level: number; summary: string; castingTime: string; concentration: boolean }[];
  };
  inventory: { key: string; name: string; type: string; qty: number; equipped: boolean; valueCp: number; weightLb: number; description: string }[];
  carried: number;
  capacity: number;
  wallet: string;
  walletCp: number;
  isAlive: boolean;
}

export interface EntityView {
  id: string;
  name: string;
  kind: string;
  health: string;
  hpPct: number;
  conditions: string[];
  attitude: string;
  hostile: boolean;
  alive: boolean;
  looted: boolean;
  merchant: boolean;
}

export interface GameView {
  campaignId: string;
  title: string;
  turn: number;
  clock: string;
  location: { id: string; name: string; description: string; danger: number; safeRest: boolean };
  exits: { id: string; name: string; minutes: number; locked: boolean }[];
  sheet: SheetView;
  entities: EntityView[];
  shops: { merchantId: string; name: string; items: { key: string; name: string; qty: number; priceCp: number; price: string }[]; buys: { key: string; price: string; priceCp: number }[] }[];
  quests: { id: string; title: string; description: string; status: string; giver: string | null; objectives: { text: string; done: boolean; progress: string | null }[]; rewards: string }[];
  encounter: null | { round: number; current: string; currentName: string; myTurn: boolean; order: { id: string; name: string; initiative: number; health: string; alive: boolean; pc: boolean }[]; economy: { action: boolean; bonusAction: boolean; reaction: boolean; movement: number } | null };
  factions: { id: string; name: string; treasury: number; military: number; stability: number; population: number; atWar: string[]; allies: string[]; relationToPlayer: number | null }[];
}

export function clock(minutes: number): string {
  const day = Math.floor(minutes / 1440) + 1;
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  const part = h < 6 ? "gece" : h < 12 ? "sabah" : h < 18 ? "öğleden sonra" : h < 22 ? "akşam" : "gece";
  return `${day}. gün · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} (${part})`;
}

export function sheetOf(state: GameState, id: string): SheetView {
  const c = state.creatures[id]!;
  const inv = state.inventories[id] ?? [];
  const pb = proficiencyBonus(c.level);
  const nextXp = c.level >= 20 ? null : XP_THRESHOLDS[c.level + 1] ?? null;
  const sc = c.spellcasting;
  const scAbility = sc?.ability;
  const items = inv.map((i) => {
    const d = ITEMS[i.itemKey];
    return {
      key: i.itemKey, name: d?.name ?? i.itemKey, type: d?.type ?? "gear", qty: i.qty, equipped: !!i.equipped,
      valueCp: d?.valueCp ?? 0, weightLb: d?.weightLb ?? 0, description: d?.description ?? "",
    };
  });
  return {
    id: c.id,
    name: c.name,
    race: c.raceKey ? RACES[c.raceKey]?.name ?? c.raceKey : "",
    className: c.classKey ? CLASSES[c.classKey]?.name ?? c.classKey : "",
    level: c.level,
    xp: c.xp,
    xpNext: nextXp,
    hp: c.hp,
    maxHp: c.maxHp,
    tempHp: c.tempHp,
    ac: effectiveAc(c, state.gameTime),
    speed: c.speed,
    proficiency: pb,
    initiative: abilityModifier(c.abilities.dex),
    passivePerception: passiveScore(c, "perception"),
    abilities: ABILITIES.map((a) => ({
      key: a, name: ABILITY_NAMES_TR[a], score: c.abilities[a], mod: abilityModifier(c.abilities[a]),
      save: saveModifier(c, a), proficient: c.saveProficiencies.includes(a),
    })),
    skills: SKILL_LIST.map((s) => ({
      key: s, name: SKILL_NAMES_TR[s], ability: ABILITY_NAMES_TR[SKILLS[s]], mod: skillModifier(c, s),
      proficient: c.skillProficiencies.includes(s) || c.expertise.includes(s), expertise: c.expertise.includes(s),
    })),
    conditions: c.conditions.map((x) => CONDITION_NAMES_TR[x]),
    buffs: (c.buffs ?? []).filter((b) => b.expiresAt > state.gameTime).map((b) => b.name),
    exhaustion: c.exhaustion,
    deathSaves: c.deathSaves,
    resources: Object.entries(c.resources ?? {}).map(([k, r]) => ({
      key: k, name: (CLASS_ABILITY_TR as Record<string, string>)[k] ?? RESOURCE_NAMES[k] ?? k, current: r.current, max: r.max,
      recharge: r.recharge === "short" ? "kısa dinlenme" : "uzun dinlenme",
    })),
    spellcasting: sc && scAbility ? {
      ability: ABILITY_NAMES_TR[scAbility],
      dc: 8 + pb + abilityModifier(c.abilities[scAbility]),
      attack: pb + abilityModifier(c.abilities[scAbility]),
      slots: Object.entries(sc.maxSlots).map(([lv, max]) => ({ level: Number(lv), current: sc.slots[Number(lv)] ?? 0, max: max ?? 0 })),
      concentratingOn: sc.concentratingOn ? SPELLS[sc.concentratingOn]?.name ?? sc.concentratingOn : null,
      spells: sc.known.map((k) => SPELLS[k]).filter((s): s is NonNullable<typeof s> => !!s)
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "tr"))
        .map((s) => ({ key: s.key, name: s.name, level: s.level, summary: s.summary, castingTime: s.castingTime, concentration: s.concentration })),
    } : null,
    inventory: items,
    carried: Math.round(items.reduce((s, i) => s + i.weightLb * i.qty, 0) * 10) / 10,
    capacity: c.abilities.str * 15,
    wallet: formatCp(state.wallets[id] ?? 0),
    walletCp: state.wallets[id] ?? 0,
    isAlive: c.isAlive,
  };
}

const RESOURCE_NAMES: Record<string, string> = {
  relentless_endurance: "Amansız Dayanıklılık",
  ki: "Ki",
};

export function buildView(c: Campaign): GameView {
  const s = c.state;
  const me = s.creatures[c.playerId]!;
  const loc = currentLocation(c);
  const shops = s.world?.shops ?? {};
  const here = Object.values(s.creatures).filter((x) => x.locationId === loc.id && x.id !== c.playerId);
  const entities: EntityView[] = here.map((x) => ({
    id: x.id,
    name: x.name,
    kind: x.kind,
    health: healthBand(x),
    hpPct: x.isAlive ? Math.round((x.hp / x.maxHp) * 100) : 0,
    conditions: x.conditions.map((k) => CONDITION_NAMES_TR[k]),
    attitude: ATTITUDE_TR[attitudeFromScore(s.relationships[relKey(c.playerId, x.id)] ?? 0)],
    hostile: x.isAlive && isHostileTo(s, x, me),
    alive: x.isAlive,
    looted: !!x.looted,
    merchant: !!shops[x.id] && x.isAlive,
  }));
  const myInv = s.inventories[c.playerId] ?? [];
  const enc = s.encounter;
  return {
    campaignId: c.id,
    title: c.title,
    turn: c.turnCount,
    clock: clock(s.gameTime),
    location: { id: loc.id, name: loc.name, description: loc.description, danger: loc.danger, safeRest: !!loc.safeRest },
    exits: currentExits(c).map((e) => ({ id: e.id, name: e.name, minutes: e.minutes, locked: !!e.requiresItem && !myInv.some((i) => i.itemKey === e.requiresItem) })),
    sheet: sheetOf(s, c.playerId),
    entities,
    shops: here.filter((x) => shops[x.id] && x.isAlive).map((x) => ({
      merchantId: x.id,
      name: x.name,
      items: (s.inventories[x.id] ?? []).map((i) => {
        const p = priceFor(shops[x.id]!, i.itemKey, "buy");
        return { key: i.itemKey, name: ITEMS[i.itemKey]?.name ?? i.itemKey, qty: i.qty, priceCp: p, price: formatCp(p) };
      }),
      buys: myInv.filter((i) => ITEMS[i.itemKey] && ITEMS[i.itemKey]!.type !== "key").map((i) => {
        const p = priceFor(shops[x.id]!, i.itemKey, "sell");
        return { key: i.itemKey, priceCp: p, price: formatCp(p) };
      }),
    })),
    quests: Object.values(s.world?.quests ?? {}).filter((q) => q.status !== "available" || (q.giverId && s.creatures[q.giverId]?.locationId === loc.id && s.creatures[q.giverId]?.isAlive))
      .map((q) => ({
        id: q.id, title: q.title, description: q.description, status: q.status,
        giver: q.giverId ? s.creatures[q.giverId]?.name ?? null : null,
        objectives: q.objectives.map((o) => ({ text: o.text, done: o.done, progress: o.kind === "kill_template" ? `${o.progress ?? 0}/${o.qty ?? 1}` : null })),
        rewards: [q.rewards.xp ? `${q.rewards.xp} XP` : "", q.rewards.cp ? formatCp(q.rewards.cp) : "",
          ...(q.rewards.items ?? []).map((i) => `${ITEMS[i.key]?.name ?? i.key} ×${i.qty}`)].filter(Boolean).join(", "),
      })),
    encounter: enc?.active ? {
      round: enc.round,
      current: currentTurnId(enc),
      currentName: s.creatures[currentTurnId(enc)]?.name ?? "",
      myTurn: currentTurnId(enc) === c.playerId,
      order: enc.order.map((o) => {
        const x = s.creatures[o.id]!;
        return { id: o.id, name: x.name, initiative: o.initiative, health: healthBand(x), alive: x.isAlive, pc: x.kind === "pc" };
      }),
      economy: enc.economy[c.playerId] ? {
        action: enc.economy[c.playerId]!.action, bonusAction: enc.economy[c.playerId]!.bonusAction,
        reaction: enc.economy[c.playerId]!.reaction, movement: enc.economy[c.playerId]!.movement,
      } : null,
    } : null,
    factions: Object.values(s.factions).map((f) => ({
      id: f.id, name: f.name, treasury: f.treasury, military: f.military, stability: f.stability, population: f.population,
      atWar: f.atWarWith.map((x) => s.factions[x]?.name ?? x), allies: f.alliances.map((x) => s.factions[x]?.name ?? x),
      relationToPlayer: me.factionId && me.factionId !== f.id ? s.relationships[relKey(me.factionId, f.id)] ?? 0 : null,
    })),
  };
}

export const ARMOR_KEYS = Object.keys(ARMOR);
export { DEFAULT_CATALOG };
