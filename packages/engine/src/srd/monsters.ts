/**
 * SRD 5.1 canavar ve NPC istatistik blokları (CC-BY-4.0), motorun kullandığı biçimde.
 */
import type { Creature } from "../types.ts";

export interface LootTable {
  /** Bakır para notasyonu: "2d6*10" = 2d6 gümüş. */
  goldCp?: string;
  items?: { key: string; chance: number; qty?: number }[];
}

export type MonsterTemplate = Omit<Creature, "id" | "locationId" | "factionId"> & {
  attacks: string[];
  loot?: LootTable;
  /** Türü: insansı, ölümsüz, hayvan … (Kişiyi Tut vb. için). */
  type: "humanoid" | "undead" | "beast" | "monstrosity" | "giant" | "fiend";
  description: string;
};

type BaseKeys = "saveProficiencies" | "skillProficiencies" | "expertise" | "tempHp" | "conditions" | "exhaustion"
  | "resistances" | "immunities" | "vulnerabilities" | "conditionImmunities" | "deathSaves" | "inspiration"
  | "features" | "xp" | "isAlive" | "size" | "kind";
const base: Pick<MonsterTemplate, BaseKeys> = {
  saveProficiencies: [], skillProficiencies: [], expertise: [], tempHp: 0, conditions: [],
  exhaustion: 0, resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [],
  deathSaves: { successes: 0, failures: 0, stable: false }, inspiration: false, features: {},
  xp: 0, isAlive: true, size: "medium", kind: "monster",
};

type M = Omit<MonsterTemplate, BaseKeys> & Partial<Pick<MonsterTemplate, BaseKeys>>;
const m = (x: M): MonsterTemplate => ({ ...base, ...x } as MonsterTemplate);
const ab = (str: number, dex: number, con: number, int: number, wis: number, cha: number) => ({ str, dex, con, int, wis, cha });

export const MONSTERS: Record<string, MonsterTemplate> = {
  // -------- insansılar
  commoner: m({ name: "Köylü", kind: "npc", type: "humanoid", level: 1, cr: 0, abilities: ab(10, 10, 10, 10, 10, 10), hp: 4, maxHp: 4, ac: 10, speed: 30,
    hitDice: { 8: 1 }, hitDiceMax: { 8: 1 }, attacks: ["club"], loot: { goldCp: "1d10" }, description: "Sıradan bir kasabalı." }),
  noble: m({ name: "Soylu", kind: "npc", type: "humanoid", level: 2, cr: 0.125, abilities: ab(11, 12, 11, 12, 14, 16), skillProficiencies: ["deception", "insight", "persuasion"],
    hp: 9, maxHp: 9, ac: 15, speed: 30, hitDice: { 8: 2 }, hitDiceMax: { 8: 2 }, attacks: ["rapier"], loot: { goldCp: "5d6*100", items: [{ key: "silver_ring", chance: 0.5 }] }, description: "Kibirli, ipek giysili bir aristokrat." }),
  guard: m({ name: "Muhafız", kind: "npc", type: "humanoid", level: 1, cr: 0.125, abilities: ab(13, 12, 12, 10, 11, 10), skillProficiencies: ["perception"],
    hp: 11, maxHp: 11, ac: 16, speed: 30, hitDice: { 8: 2 }, hitDiceMax: { 8: 2 }, attacks: ["spear"], loot: { goldCp: "2d6*10", items: [{ key: "spear", chance: 0.5 }] }, description: "Zincir gömlekli, kalkanlı kasaba muhafızı." }),
  bandit: m({ name: "Haydut", kind: "npc", type: "humanoid", level: 1, cr: 0.125, abilities: ab(11, 12, 12, 10, 10, 10),
    hp: 11, maxHp: 11, ac: 12, speed: 30, hitDice: { 8: 2 }, hitDiceMax: { 8: 2 }, attacks: ["scimitar", "light_crossbow"],
    loot: { goldCp: "3d6*10", items: [{ key: "scimitar", chance: 0.4 }, { key: "rations", chance: 0.5, qty: 2 }] }, description: "Yırtık pelerinli, kurnaz yol kesici." }),
  bandit_captain: m({ name: "Haydut Reisi", kind: "npc", type: "humanoid", level: 5, cr: 2, abilities: ab(15, 16, 14, 14, 11, 14),
    saveProficiencies: ["str", "dex", "wis"], skillProficiencies: ["athletics", "deception"], hp: 65, maxHp: 65, ac: 15, speed: 30,
    hitDice: { 8: 10 }, hitDiceMax: { 8: 10 }, features: { extraAttacks: 2 }, attacks: ["scimitar", "dagger"],
    loot: { goldCp: "4d6*100", items: [{ key: "bandit_map", chance: 1 }, { key: "potion_of_healing", chance: 0.6 }, { key: "gem_garnet", chance: 0.3 }] },
    description: "Yaralı yüzlü, keskin zekâlı çete lideri." }),
  thug: m({ name: "Kabadayı", kind: "npc", type: "humanoid", level: 3, cr: 0.5, abilities: ab(15, 11, 14, 10, 10, 11), skillProficiencies: ["intimidation"],
    hp: 32, maxHp: 32, ac: 11, speed: 30, hitDice: { 8: 5 }, hitDiceMax: { 8: 5 }, features: { extraAttacks: 1 }, attacks: ["mace", "heavy_crossbow"],
    loot: { goldCp: "2d6*100" }, description: "Kalın enseli, yumruklarını kullanmaya hazır tehditkâr adam." }),
  veteran: m({ name: "Kıdemli Asker", kind: "npc", type: "humanoid", level: 5, cr: 3, abilities: ab(16, 13, 14, 10, 11, 10), skillProficiencies: ["athletics", "perception"],
    hp: 58, maxHp: 58, ac: 17, speed: 30, hitDice: { 8: 9 }, hitDiceMax: { 8: 9 }, features: { extraAttacks: 1 }, attacks: ["longsword", "heavy_crossbow"],
    loot: { goldCp: "3d6*100", items: [{ key: "longsword", chance: 0.6 }] }, description: "Sayısız savaştan sağ çıkmış, sakin ve tehlikeli." }),
  cultist: m({ name: "Tarikatçı", kind: "npc", type: "humanoid", level: 1, cr: 0.125, abilities: ab(11, 12, 10, 10, 11, 10), skillProficiencies: ["deception", "religion"],
    hp: 9, maxHp: 9, ac: 12, speed: 30, hitDice: { 8: 2 }, hitDiceMax: { 8: 2 }, attacks: ["scimitar"], loot: { goldCp: "2d6*10" }, description: "Kapüşonlu, gözleri fanatizmle parlayan mürit." }),
  acolyte: m({ name: "Rahip Adayı", kind: "npc", type: "humanoid", level: 1, cr: 0.25, abilities: ab(10, 10, 10, 10, 14, 11), skillProficiencies: ["medicine", "religion"],
    hp: 9, maxHp: 9, ac: 10, speed: 30, hitDice: { 8: 2 }, hitDiceMax: { 8: 2 }, attacks: ["club"],
    spellcasting: { ability: "wis", slots: { 1: 3 }, maxSlots: { 1: 3 }, known: ["sacred_flame", "light", "bless", "cure_wounds"], concentratingOn: null },
    loot: { goldCp: "1d6*100", items: [{ key: "holy_symbol", chance: 0.8 }] }, description: "Tapınağın genç hizmetkârı." }),
  cult_fanatic: m({ name: "Tarikat Fanatiği", kind: "npc", type: "humanoid", level: 4, cr: 2, abilities: ab(11, 14, 12, 10, 13, 14), skillProficiencies: ["deception", "persuasion", "religion"],
    hp: 33, maxHp: 33, ac: 13, speed: 30, hitDice: { 8: 6 }, hitDiceMax: { 8: 6 }, features: { extraAttacks: 1 }, attacks: ["dagger"],
    spellcasting: { ability: "wis", slots: { 1: 4, 2: 3 }, maxSlots: { 1: 4, 2: 3 }, known: ["sacred_flame", "light", "inflict_wounds", "shield_of_faith", "hold_person"], concentratingOn: null },
    loot: { goldCp: "3d6*100", items: [{ key: "scroll_cure_wounds", chance: 0.3 }] }, description: "Karanlık bir tanrıya adanmış vaiz." }),
  // -------- goblinoidler ve benzerleri
  kobold: m({ name: "Kobold", type: "humanoid", level: 1, cr: 0.125, size: "small", abilities: ab(7, 15, 9, 8, 7, 8),
    hp: 5, maxHp: 5, ac: 12, speed: 30, hitDice: { 6: 2 }, hitDiceMax: { 6: 2 }, attacks: ["dagger", "sling"], loot: { goldCp: "2d6" }, description: "Pullu, köpeksi, sinsi küçük yaratık." }),
  goblin: m({ name: "Goblin", type: "humanoid", level: 1, cr: 0.25, size: "small", abilities: ab(8, 14, 10, 10, 8, 8), skillProficiencies: ["stealth"], expertise: ["stealth"],
    hp: 7, maxHp: 7, ac: 15, speed: 30, hitDice: { 6: 2 }, hitDiceMax: { 6: 2 }, attacks: ["scimitar", "shortbow"],
    loot: { goldCp: "2d6*5", items: [{ key: "goblin_totem", chance: 0.3 }, { key: "rations", chance: 0.3 }] }, description: "Yeşil derili, sivri kulaklı, kıkırdayan yağmacı." }),
  goblin_boss: m({ name: "Goblin Şefi", type: "humanoid", level: 3, cr: 1, size: "small", abilities: ab(10, 14, 10, 10, 8, 10), skillProficiencies: ["stealth"], expertise: ["stealth"],
    hp: 21, maxHp: 21, ac: 17, speed: 30, hitDice: { 6: 6 }, hitDiceMax: { 6: 6 }, features: { extraAttacks: 1 }, attacks: ["scimitar", "javelin"],
    loot: { goldCp: "3d6*50", items: [{ key: "potion_of_healing", chance: 0.5 }, { key: "gem_agate", chance: 0.5 }] }, description: "Zincir zırhlı, kurnaz goblin çetebaşı." }),
  hobgoblin: m({ name: "Hobgoblin", type: "humanoid", level: 2, cr: 0.5, abilities: ab(13, 12, 12, 10, 10, 9),
    hp: 11, maxHp: 11, ac: 18, speed: 30, hitDice: { 8: 2 }, hitDiceMax: { 8: 2 }, attacks: ["longsword", "longbow"], loot: { goldCp: "2d6*20" }, description: "Disiplinli, askerî düzende savaşan goblinoid." }),
  bugbear: m({ name: "Bugbear", type: "humanoid", level: 3, cr: 1, abilities: ab(15, 14, 13, 8, 11, 9), skillProficiencies: ["stealth", "survival"],
    hp: 27, maxHp: 27, ac: 16, speed: 30, hitDice: { 8: 5 }, hitDiceMax: { 8: 5 }, attacks: ["morningstar_brute", "javelin"], loot: { goldCp: "2d6*50" }, description: "Kıllı, iri, sessiz pusucu." }),
  orc: m({ name: "Ork", type: "humanoid", level: 2, cr: 0.5, abilities: ab(16, 12, 16, 7, 11, 10), skillProficiencies: ["intimidation"],
    hp: 15, maxHp: 15, ac: 13, speed: 30, hitDice: { 8: 2 }, hitDiceMax: { 8: 2 }, attacks: ["greataxe", "javelin"], loot: { goldCp: "2d6*20", items: [{ key: "greataxe", chance: 0.2 }] }, description: "Gri tenli, dişleri fırlamış vahşi savaşçı." }),
  gnoll: m({ name: "Gnoll", type: "humanoid", level: 2, cr: 0.5, abilities: ab(14, 12, 11, 6, 10, 7),
    hp: 22, maxHp: 22, ac: 15, speed: 30, hitDice: { 8: 5 }, hitDiceMax: { 8: 5 }, attacks: ["spear", "longbow"], loot: { goldCp: "2d6*10" }, description: "Sırtlan başlı, kahkahayla avlanan yamyam." }),
  // -------- ölümsüzler
  skeleton: m({ name: "İskelet", type: "undead", level: 1, cr: 0.25, abilities: ab(10, 14, 15, 6, 8, 5),
    vulnerabilities: ["bludgeoning"], immunities: ["poison"], conditionImmunities: ["poisoned"],
    hp: 13, maxHp: 13, ac: 13, speed: 30, hitDice: { 8: 2 }, hitDiceMax: { 8: 2 }, attacks: ["shortsword", "shortbow"], loot: { goldCp: "1d6*10" }, description: "Takırdayan kemikler, boş göz çukurlarında soluk ışık." }),
  zombie: m({ name: "Zombi", type: "undead", level: 1, cr: 0.25, abilities: ab(13, 6, 16, 3, 6, 5), saveProficiencies: ["wis"],
    immunities: ["poison"], conditionImmunities: ["poisoned"], hp: 22, maxHp: 22, ac: 8, speed: 20, hitDice: { 8: 3 }, hitDiceMax: { 8: 3 },
    attacks: ["slam"], description: "Çürüyen etiyle sürüklenen ceset." }),
  ghoul: m({ name: "Gul", type: "undead", level: 3, cr: 1, abilities: ab(13, 15, 10, 7, 10, 6), immunities: ["poison"], conditionImmunities: ["charmed", "poisoned"],
    hp: 22, maxHp: 22, ac: 12, speed: 30, hitDice: { 8: 5 }, hitDiceMax: { 8: 5 }, attacks: ["ghoul_claws"], loot: { goldCp: "1d6*10" }, description: "Uzun dilli, pençeleri felç eden leş yiyici." }),
  // -------- hayvanlar ve canavarlar
  giant_rat: m({ name: "Dev Sıçan", type: "beast", level: 1, cr: 0.125, size: "small", abilities: ab(7, 15, 11, 2, 10, 4),
    hp: 7, maxHp: 7, ac: 12, speed: 30, hitDice: { 6: 2 }, hitDiceMax: { 6: 2 }, attacks: ["bite_small"], description: "Köpek büyüklüğünde, hastalıklı sıçan." }),
  wolf: m({ name: "Kurt", type: "beast", level: 1, cr: 0.25, abilities: ab(12, 15, 12, 3, 12, 6), skillProficiencies: ["perception", "stealth"],
    hp: 11, maxHp: 11, ac: 13, speed: 40, hitDice: { 8: 2 }, hitDiceMax: { 8: 2 }, attacks: ["wolf_bite"], loot: { items: [{ key: "wolf_pelt", chance: 0.7 }] }, description: "Sürüyle avlanan gri kurt; ısırığı yere devirir." }),
  dire_wolf: m({ name: "Dev Kurt", type: "beast", level: 3, cr: 1, size: "large", abilities: ab(17, 15, 15, 3, 12, 7), skillProficiencies: ["perception", "stealth"],
    hp: 37, maxHp: 37, ac: 14, speed: 50, hitDice: { 10: 5 }, hitDiceMax: { 10: 5 }, attacks: ["dire_wolf_bite"], loot: { items: [{ key: "wolf_pelt", chance: 1, qty: 2 }] }, description: "At büyüklüğünde, kara tüylü kurt." }),
  giant_spider: m({ name: "Dev Örümcek", type: "beast", level: 3, cr: 1, size: "large", abilities: ab(14, 16, 12, 2, 11, 4), skillProficiencies: ["stealth"], expertise: ["stealth"],
    hp: 26, maxHp: 26, ac: 14, speed: 30, hitDice: { 10: 4 }, hitDiceMax: { 10: 4 }, attacks: ["spider_bite"], loot: { items: [{ key: "gem_agate", chance: 0.2 }] }, description: "Ağlarında bekleyen, zehirli iri örümcek." }),
  brown_bear: m({ name: "Boz Ayı", type: "beast", level: 3, cr: 1, size: "large", abilities: ab(19, 10, 16, 2, 13, 7), skillProficiencies: ["perception"],
    hp: 34, maxHp: 34, ac: 11, speed: 40, hitDice: { 10: 4 }, hitDiceMax: { 10: 4 }, features: { extraAttacks: 1 }, attacks: ["bear_bite", "bear_claws"], description: "Kükreyen dev ayı." }),
  owlbear: m({ name: "Baykuşayı", type: "monstrosity", level: 5, cr: 3, size: "large", abilities: ab(20, 12, 17, 3, 12, 7), skillProficiencies: ["perception"],
    hp: 59, maxHp: 59, ac: 13, speed: 40, hitDice: { 10: 7 }, hitDiceMax: { 10: 7 }, features: { extraAttacks: 1 }, attacks: ["owlbear_beak", "owlbear_claws"],
    loot: { items: [{ key: "gem_garnet", chance: 0.3 }] }, description: "Baykuş başlı, ayı gövdeli öfke yığını." }),
  ogre: m({ name: "Ogre", type: "giant", level: 5, cr: 2, size: "large", abilities: ab(19, 8, 16, 5, 7, 7),
    hp: 59, maxHp: 59, ac: 11, speed: 40, hitDice: { 10: 7 }, hitDiceMax: { 10: 7 }, attacks: ["greatclub_ogre", "javelin"],
    loot: { goldCp: "2d6*100", items: [{ key: "gem_garnet", chance: 0.4 }] }, description: "Aptal, aç ve son derece güçlü dev." }),
};

export function spawnMonster(key: string, id: string, overrides: Partial<Creature> = {}): Creature {
  const t = MONSTERS[key];
  if (!t) throw new Error(`Bilinmeyen canavar: ${key}`);
  const { loot: _loot, type: _type, description: _d, ...rest } = structuredClone(t);
  return { ...rest, id, templateKey: key, ...overrides };
}
