import { describe, expect, it } from "vitest";
import { fold, ruleIntent, type RuleScene } from "../src/index.ts";

const scene: RuleScene = {
  playerId: "pc",
  inCombat: false,
  entities: [
    { id: "kerem", name: "Muhafız Kerem", alive: true, hp: 11, kind: "npc", hostile: false },
    { id: "selin", name: "Tüccar Selin", alive: true, hp: 4, kind: "npc", hostile: false, merchant: true },
    { id: "gob", name: "Goblin Izgir", alive: true, hp: 7, kind: "monster", hostile: true },
    { id: "dead", name: "Haydut", alive: false, hp: 0, kind: "npc", hostile: false },
  ],
  exits: [{ id: "pazar", name: "Karaçam Pazarı", minutes: 5 }, { id: "orman", name: "Kuzey Çam Ormanı", minutes: 30 }],
  inventory: [
    { key: "longsword", name: "Uzun Kılıç", type: "weapon", equipped: true, qty: 1 },
    { key: "light_crossbow", name: "Hafif Arbalet", type: "weapon", qty: 1 },
    { key: "potion_of_healing", name: "İyileştirme İksiri", type: "potion", qty: 1 },
    { key: "chain_mail", name: "Zincir Zırh", type: "armor", equipped: true, qty: 1 },
    { key: "sealed_letter", name: "Mühürlü Mektup", type: "key", qty: 1 },
  ],
  spells: [{ key: "fire_bolt", name: "Ateş Oku", level: 0, harmful: true }, { key: "cure_wounds", name: "Yara İyileştir", level: 1, heal: true }],
  shopItems: { selin: [{ key: "rations", name: "Erzak (1 gün)" }, { key: "torch", name: "Meşale" }] },
  quests: [{ id: "q1", title: "Kızılbalta Tehdidi", status: "available" }],
  abilities: ["second_wind"],
  classKey: "fighter",
};

const a = (text: string, s: Partial<RuleScene> = {}) => {
  const r = ruleIntent(text, { ...scene, ...s });
  return r && r.kind === "action" ? r.action : r;
};

describe("kural tabanlı Türkçe niyet", () => {
  it("fold", () => {
    expect(fold("İyileştirme İKSİRİ, Kerem'e!")).toBe("iyilestirme iksiri kerem e");
  });
  it.each([
    ["Goblin'e saldırıyorum", { type: "attack", targetId: "gob", weaponKey: "longsword" }],
    ["goblini arbaletle vur", { type: "attack", targetId: "gob", weaponKey: "light_crossbow" }],
    ["ok at", { type: "attack", targetId: "gob", weaponKey: "light_crossbow" }],
    ["Kerem'e 10 altın rüşvet ver", { type: "social", targetId: "kerem", approach: "bribe", bribeCp: 1000 }],
    ["muhafızı ikna etmeye çalışıyorum", { type: "social", targetId: "kerem", approach: "persuade" }],
    ["kerem'i tehdit et", { type: "social", targetId: "kerem", approach: "intimidate" }],
    ["pazara git", { type: "move", toLocationId: "pazar" }],
    ["ormana doğru yola çıkıyorum", { type: "move", toLocationId: "orman" }],
    ["iksir iç", { type: "use_item", itemKey: "potion_of_healing" }],
    ["etrafa bakıyorum", { type: "look" }],
    ["saklan", { type: "hide" }],
    ["uzun dinlen", { type: "rest", kind: "long" }],
    ["kısa bir dinlenme", { type: "rest", kind: "short" }],
    ["cesedi ara", { type: "loot", targetId: "dead" }],
    ["selin'den 3 meşale satın al", { type: "buy", merchantId: "selin", itemKey: "torch", qty: 3 }],
    ["mektubu kerem'e ver", { type: "give_item", targetId: "kerem", itemKey: "sealed_letter" }],
    ["görevi kabul ediyorum", { type: "accept_quest", questId: "q1" }],
    ["ateş oku at goblin'e", { type: "cast_spell", spellKey: "fire_bolt", slotLevel: 0, targetIds: ["gob"] }],
    ["yara iyileştir büyüsü yap", { type: "cast_spell", spellKey: "cure_wounds", slotLevel: 1, targetIds: ["pc"] }],
    ["ikinci soluk kullan", { type: "class_ability", ability: "second_wind" }],
    ["zincir zırhı çıkar", { type: "equip", itemKey: "chain_mail", equipped: false }],
    ["kilidi açmaya çalışıyorum", { type: "skill_check", skill: "sleight_of_hand" }],
    ["duvara tırmanıyorum", { type: "skill_check", skill: "athletics" }],
    ["kerem ile konuş", { type: "talk", targetId: "kerem" }],
  ])("%s", (text, expected) => {
    expect(a(text)).toMatchObject(expected);
  });

  it("savaşta kaçınma ve tur bitirme", () => {
    expect(a("kaçınıyorum", { inCombat: true })).toMatchObject({ type: "dodge" });
    expect(a("turu bitir", { inCombat: true })).toMatchObject({ type: "end_turn" });
  });

  it("eksik hedefte soru sorar", () => {
    expect(a("saldırıyorum", { entities: scene.entities.filter((e) => !e.hostile) })).toMatchObject({ kind: "clarify" });
    expect(a("rüşvet ver")).toMatchObject({ kind: "clarify" });
  });

  it("'kesinlikle' kelimesi saldırı sayılmaz; anlamsız girdi null", () => {
    expect((a("kesinlikle hayır diyorum") as { type?: string } | null)?.type).not.toBe("attack");
    expect(ruleIntent("asdf qwer", scene)).toBeNull();
  });
});
