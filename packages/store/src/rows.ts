/**
 * Supabase satırları ↔ motor tipleri. Saf fonksiyonlar: hem Edge Function
 * (Deno) hem Node testleri kullanır.
 */
import type { Creature, Faction } from "@kader/engine";

export interface CreatureRow {
  id: string;
  campaign_id: string;
  kind: Creature["kind"];
  name: string;
  template_key: string | null;
  race_key: string | null;
  class_key: string | null;
  level: number;
  cr: number | string | null;
  size: Creature["size"];
  abilities: Creature["abilities"];
  save_proficiencies: Creature["saveProficiencies"];
  skill_proficiencies: Creature["skillProficiencies"];
  expertise: Creature["expertise"];
  weapon_proficiencies: string[] | null;
  armor_proficiencies: string[] | null;
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
  resources: Creature["resources"] | null;
  buffs: Creature["buffs"] | null;
  attacks: string[] | null;
  xp: number;
  is_alive: boolean;
  looted: boolean;
  stealth_disadvantage: boolean;
  darkvision: number | null;
  languages: string[] | null;
  background: string | null;
  location_id: string | null;
  faction_id: string | null;
}

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
  if (r.template_key) c.templateKey = r.template_key;
  if (r.race_key) c.raceKey = r.race_key;
  if (r.class_key) c.classKey = r.class_key;
  if (r.weapon_proficiencies) c.weaponProficiencies = r.weapon_proficiencies;
  if (r.armor_proficiencies) c.armorProficiencies = r.armor_proficiencies;
  if (r.resources) c.resources = r.resources;
  if (r.buffs && r.buffs.length) c.buffs = r.buffs;
  if (r.attacks) c.attacks = r.attacks;
  if (r.looted) c.looted = true;
  if (r.stealth_disadvantage) c.stealthDisadvantage = true;
  if (r.darkvision) c.darkvision = r.darkvision;
  if (r.languages) c.languages = r.languages;
  if (r.background) c.background = r.background;
  return c;
}

export function fromCreature(c: Creature, campaignId: string): CreatureRow {
  return {
    id: c.id,
    campaign_id: campaignId,
    kind: c.kind,
    name: c.name,
    template_key: c.templateKey ?? null,
    race_key: c.raceKey ?? null,
    class_key: c.classKey ?? null,
    level: c.level,
    cr: c.cr ?? null,
    size: c.size,
    abilities: c.abilities,
    save_proficiencies: c.saveProficiencies,
    skill_proficiencies: c.skillProficiencies,
    expertise: c.expertise,
    weapon_proficiencies: c.weaponProficiencies ?? null,
    armor_proficiencies: c.armorProficiencies ?? null,
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
    resources: c.resources ?? null,
    buffs: c.buffs ?? null,
    attacks: c.attacks ?? null,
    xp: c.xp,
    is_alive: c.isAlive,
    looted: !!c.looted,
    stealth_disadvantage: !!c.stealthDisadvantage,
    darkvision: c.darkvision ?? null,
    languages: c.languages ?? null,
    background: c.background ?? null,
    location_id: c.locationId ?? null,
    faction_id: c.factionId ?? null,
  };
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
