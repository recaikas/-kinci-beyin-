import type { Creature, GameState } from "../src/index.ts";

export function pc(id: string, overrides: Partial<Creature> = {}): Creature {
  return {
    id,
    name: id[0]!.toUpperCase() + id.slice(1),
    kind: "pc",
    level: 1,
    size: "medium",
    abilities: { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 14 },
    saveProficiencies: ["str", "con"],
    skillProficiencies: ["athletics", "persuasion"],
    expertise: [],
    hp: 12,
    maxHp: 12,
    tempHp: 0,
    ac: 15,
    speed: 30,
    conditions: [],
    exhaustion: 0,
    resistances: [],
    immunities: [],
    vulnerabilities: [],
    conditionImmunities: [],
    deathSaves: { successes: 0, failures: 0, stable: false },
    hitDice: { 10: 1 },
    hitDiceMax: { 10: 1 },
    inspiration: false,
    features: {},
    xp: 0,
    isAlive: true,
    locationId: "town",
    ...overrides,
  };
}

export function world(creatures: Creature[], extra: Partial<GameState> = {}): GameState {
  return {
    campaignId: "test",
    gameTime: 0,
    sceneLocationId: "town",
    creatures: Object.fromEntries(creatures.map((c) => [c.id, c])),
    inventories: {},
    wallets: {},
    relationships: {},
    factions: {},
    encounter: null,
    ...extra,
  };
}
