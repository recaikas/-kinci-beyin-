import { describe, expect, it } from "vitest";
import { FixedRng } from "@kader/dice";
import { buildCharacter, combatAutopilot, type GameState, resolveAction, spawnMonster, type WorldState } from "../src/index.ts";
import { world } from "./helpers.ts";

function setup(): GameState {
  const hero = buildCharacter({
    name: "Arda", raceKey: "human", classKey: "fighter", method: "standard_array",
    abilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 }, skills: ["athletics", "perception"],
  }, "pc", "town");
  const w: WorldState = {
    places: {
      town: { id: "town", name: "Kasaba", description: "", danger: 0, encounters: [] },
      forest: { id: "forest", name: "Orman", description: "", danger: 20, encounters: [{ templateKey: "wolf", count: "2" }] },
      cave: { id: "cave", name: "Mağara", description: "", danger: 0, encounters: [] },
    },
    exits: {
      town: [{ to: "forest", minutes: 30 }],
      forest: [{ to: "town", minutes: 30 }, { to: "cave", minutes: 10, requiresItem: "bandit_map" }],
    },
    shops: { selin: { sellFactor: 1, buyFactor: 0.5 } },
    quests: {
      q1: {
        id: "q1", title: "Mektup", description: "Mektubu muhtara ver", status: "available", giverId: "selin",
        objectives: [{ id: "o1", text: "Muhtara mektubu ver", kind: "give", targetId: "muhtar", itemKey: "sealed_letter", done: false }],
        rewards: { xp: 300, cp: 5000, items: [{ key: "potion_of_healing", qty: 2 }] },
      },
      q2: {
        id: "q2", title: "Kurt avı", description: "İki kurt öldür", status: "open",
        objectives: [{ id: "o1", text: "2 kurt öldür", kind: "kill_template", templateKey: "wolf", qty: 2, done: false }],
        rewards: { xp: 100 },
      },
    },
  };
  return world([
    hero.creature,
    spawnMonster("commoner", "selin", { name: "Tüccar Selin", kind: "npc", locationId: "town" }),
    spawnMonster("noble", "muhtar", { name: "Muhtar", locationId: "town" }),
  ], {
    inventories: { pc: [...hero.inventory, { itemKey: "sealed_letter", qty: 1 }], selin: [{ itemKey: "potion_of_healing", qty: 5 }] },
    wallets: { pc: 10000, selin: 50000 },
    world: w,
  });
}

let ids = 0;
const opts = (faces: number[]) => ({ rng: new FixedRng(faces), newId: () => `id${++ids}` });

describe("seyahat", () => {
  it("olmayan yol ve eşya gerektiren yol reddedilir", () => {
    const s = setup();
    expect(resolveAction(s, { type: "move", actorId: "pc", toLocationId: "cave", minutes: 1 }, opts([])).ok).toBe(false);
  });

  it("tehlikeli bölgede pusu: canavarlar doğar ve savaş başlar", () => {
    const s = setup();
    // karşılaşma d20=5 (≤20), tablo seçimi d1, sayı "2"; inisiyatif 3 kişi
    const r = resolveAction(s, { type: "move", actorId: "pc", toLocationId: "forest", minutes: 1 }, opts([5, 1, 10, 1, 5, 1, 4, 1]));
    expect(r.ok, r.error).toBe(true);
    expect(r.outcome.details.ambush).toHaveLength(2);
    expect(r.state.encounter?.active).toBe(true);
    expect(r.effects.filter((e) => e.op === "creature.spawn")).toHaveLength(2);
    expect(r.state.gameTime).toBe(30);
  });
});

describe("dükkân", () => {
  it("satın alma, satma ve pazarlık", () => {
    const s = setup();
    const buy = resolveAction(s, { type: "buy", actorId: "pc", merchantId: "selin", itemKey: "potion_of_healing", qty: 2 }, opts([]));
    expect(buy.ok, buy.error).toBe(true);
    expect(buy.state.wallets.pc).toBe(10000 - 10000);
    const haggled = resolveAction(s, { type: "buy", actorId: "pc", merchantId: "selin", itemKey: "potion_of_healing", qty: 1, haggle: true }, opts([18]));
    expect(haggled.outcome.details.unitCp).toBe(4500);
    const sell = resolveAction(s, { type: "sell", actorId: "pc", merchantId: "selin", itemKey: "longsword", qty: 1 }, opts([]));
    expect(sell.outcome.details.totalCp).toBe(750);
    expect(resolveAction(s, { type: "sell", actorId: "pc", merchantId: "selin", itemKey: "sealed_letter", qty: 1 }, opts([])).ok).toBe(false);
    expect(resolveAction(s, { type: "buy", actorId: "pc", merchantId: "muhtar", itemKey: "potion_of_healing", qty: 1 }, opts([])).ok).toBe(false);
  });
});

describe("görevler", () => {
  it("görev al → mektubu ver → ödül", () => {
    let s = setup();
    const acc = resolveAction(s, { type: "accept_quest", actorId: "pc", questId: "q1" }, opts([]));
    expect(acc.ok, acc.error).toBe(true);
    s = acc.state;
    const give = resolveAction(s, { type: "give_item", actorId: "pc", targetId: "muhtar", itemKey: "sealed_letter", qty: 1 }, opts([]));
    expect(give.state.world!.quests.q1!.status).toBe("completed");
    expect(give.state.wallets.pc).toBe(15000);
    expect(give.state.creatures.pc!.xp).toBe(300);
    expect(give.state.creatures.pc!.level).toBe(2);
    expect(give.outcome.facts.some((f) => f.includes("GÖREV TAMAMLANDI"))).toBe(true);
    expect(give.effects.some((e) => e.op === "quest.update")).toBe(true);
  });

  it("canavar öldürme sayacı", () => {
    let s = setup();
    s = { ...s, creatures: { ...s.creatures,
      w1: spawnMonster("wolf", "w1", { locationId: "town", hp: 1 }), w2: spawnMonster("wolf", "w2", { locationId: "town", hp: 1 }) } };
    s = resolveAction(s, { type: "attack", actorId: "pc", targetId: "w1", weaponKey: "longsword" }, opts([15, 5])).state;
    expect(s.world!.quests.q2!.objectives[0]!.progress).toBe(1);
    expect(s.world!.quests.q2!.status).toBe("open");
    s = resolveAction(s, { type: "attack", actorId: "pc", targetId: "w2", weaponKey: "longsword" }, opts([15, 5])).state;
    expect(s.world!.quests.q2!.status).toBe("completed");
    const auto = combatAutopilot(s, "pc", opts([]));
    expect(auto.steps).toHaveLength(0);
  });
});
