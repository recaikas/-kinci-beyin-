/**
 * Demo dünyası: "Karaçam Sınır Kasabası". Hem terminal demosu hem seed üretimi kullanır.
 */
import { type Creature, type GameState, spawnMonster } from "@kader/engine";
import type { Persona, WorldBible } from "@kader/llm";

export const DEMO_WORLD: WorldBible = {
  title: "Karaçam Sınırı",
  premise:
    "Çökmekte olan Varna Krallığı'nın kuzey sınırında, çam ormanlarıyla çevrili Karaçam kasabası. Krallık ordusu çekildi; " +
    "kasabayı gönülsüz bir muhafız birliği, açgözlü bir tüccar loncası ve ormandan inen goblin akınları arasında kalan halk ayakta tutuyor. " +
    "Oyuncu, kasabaya bir mektup teslim etmek için gelen ama kapıda durdurulan bir gezgindir.",
  tone: "Karanlık ama umutlu; kirli çamur, soğuk sis, küçük insanların büyük cesaretleri.",
  rules: [
    "Büyü nadirdir ve halk büyücülerden çekinir.",
    "Krallık parası: 1 altın = 10 gümüş = 100 bakır.",
    "Goblinler insan dilini kırık dökük konuşur ve ateşten korkar.",
    "Ölüler geri gelmez; diriltme büyüsü bu dünyada bilinmez.",
  ],
  language: "tr",
};

export const PLACES = {
  gate: { id: "kapi", name: "Karaçam Kuzey Kapısı", description: "Meşalelerle aydınlatılmış ahşap kapı; çamurlu yolda tek bir nöbetçi kulübesi." },
  market: { id: "pazar", name: "Karaçam Pazarı", description: "Islak tahta tezgâhlar, tütsülenmiş balık kokusu, tüccar loncasının mühürlü sandıkları." },
  forest: { id: "orman", name: "Kuzey Çam Ormanı", description: "Sisli, sık çamlar; yerde taze goblin ayak izleri." },
} as const;

export const EXITS: Record<string, { id: string; name: string; minutes: number }[]> = {
  kapi: [
    { id: "pazar", name: PLACES.market.name, minutes: 10 },
    { id: "orman", name: PLACES.forest.name, minutes: 30 },
  ],
  pazar: [{ id: "kapi", name: PLACES.gate.name, minutes: 10 }],
  orman: [{ id: "kapi", name: PLACES.gate.name, minutes: 30 }],
};

export const HERO: Creature = {
  id: "arda",
  name: "Arda",
  kind: "pc",
  level: 3,
  size: "medium",
  abilities: { str: 10, dex: 16, con: 14, int: 12, wis: 12, cha: 14 },
  saveProficiencies: ["dex", "int"],
  skillProficiencies: ["stealth", "persuasion", "deception", "perception", "sleight_of_hand"],
  expertise: ["stealth", "persuasion"],
  hp: 21,
  maxHp: 21,
  tempHp: 0,
  ac: 14,
  speed: 30,
  conditions: [],
  exhaustion: 0,
  resistances: [],
  immunities: [],
  vulnerabilities: [],
  conditionImmunities: [],
  deathSaves: { successes: 0, failures: 0, stable: false },
  hitDice: { 8: 3 },
  hitDiceMax: { 8: 3 },
  inspiration: false,
  features: {},
  xp: 900,
  isAlive: true,
  locationId: "kapi",
};

export function demoState(): GameState {
  const creatures: Creature[] = [
    HERO,
    spawnMonster("guard", "kerem", { name: "Muhafız Kerem", locationId: "kapi" }),
    spawnMonster("bandit", "selin", { name: "Tüccar Selin", kind: "npc", locationId: "pazar" }),
    spawnMonster("goblin", "gob1", { name: "Goblin Izgir", locationId: "orman" }),
    spawnMonster("goblin", "gob2", { name: "Goblin Pıtpıt", locationId: "orman" }),
  ];
  return {
    campaignId: "demo",
    gameTime: 18 * 60 + 30,
    sceneLocationId: "kapi",
    creatures: Object.fromEntries(creatures.map((c) => [c.id, c])),
    inventories: {
      arda: [
        { itemKey: "rapier", qty: 1 },
        { itemKey: "shortbow", qty: 1 },
        { itemKey: "potion_of_healing", qty: 2 },
        { itemKey: "thieves_tools", qty: 1 },
        { itemKey: "torch", qty: 3 },
      ],
      selin: [{ itemKey: "potion_of_healing", qty: 5 }, { itemKey: "rations", qty: 20 }],
    },
    wallets: { arda: 4500, selin: 20000 },
    relationships: { "arda|kerem": -10, "arda|selin": 0 },
    factions: {},
    encounter: null,
  };
}

export const PERSONAS: Record<string, Persona> = {
  kerem: { id: "kerem", personality: "Yorgun, açgözlü ama korkak; maaşı üç aydır ödenmedi.", goals: "Nöbeti olaysız bitirip meyhaneye gitmek.", speechStyle: "Kısa, homurtulu cümleler; 'yabancı' diye hitap eder." },
  selin: { id: "selin", personality: "Kurnaz, hesapçı, gizlice kasabayı seviyor.", goals: "Goblin akınlarının ticareti öldürmesini engellemek.", speechStyle: "Tatlı dilli, pazarlıkta acımasız." },
  gob1: { id: "gob1", personality: "Sinsi ve korkak; çetenin keşifçisi.", goals: "Yiyecek çalmak.", speechStyle: "Kırık Türkçe, kendinden üçüncü şahısla bahseder." },
  gob2: { id: "gob2", personality: "Saldırgan, çabuk öfkelenir.", goals: "Izgir'i korumak, parlak şeyler toplamak.", speechStyle: "Bağırarak, tek kelimelik cümleler." },
};
