/**
 * SRD 5.1 sınıfları (CC-BY-4.0) — seviye 1–20 çekirdek ilerleme.
 * Not (ev kuralı "geniş büyü erişimi"): hazırlayan/bilen ayrımı yerine büyücüler
 * sınıf listesindeki, yuvası olan seviyeye kadarki tüm büyüleri bilir.
 */
import type { Ability, Skill } from "../core.ts";
import type { CasterType } from "../spells.ts";
import type { Features } from "../types.ts";

export interface ClassDef {
  key: string;
  name: string;
  hitDie: number;
  primary: Ability;
  saves: [Ability, Ability];
  skillChoices: Skill[] | "any";
  skillCount: number;
  armor: string[];
  weapons: string[];
  caster: CasterType;
  spellAbility?: Ability;
  /** Büyü kullanmaya başladığı seviye (yarım büyücüler 2). */
  spellsFrom?: number;
  /** Başlangıç ekipmanı: [anahtar, adet, kuşanılmış mı]. */
  equipment: [string, number, boolean?][];
  description: string;
}

const ALL_SKILLS = "any" as const;

export const CLASSES: Record<string, ClassDef> = {
  barbarian: {
    key: "barbarian", name: "Barbar", hitDie: 12, primary: "str", saves: ["str", "con"],
    skillChoices: ["animal_handling", "athletics", "intimidation", "nature", "perception", "survival"], skillCount: 2,
    armor: ["light", "medium", "shield"], weapons: ["simple", "martial"], caster: "none",
    equipment: [["greataxe", 1, true], ["handaxe", 2], ["javelin", 4]],
    description: "Öfkesini silaha çeviren vahşi savaşçı. Öfke: ek hasar ve fiziksel hasara direnç.",
  },
  bard: {
    key: "bard", name: "Ozan", hitDie: 8, primary: "cha", saves: ["dex", "cha"], skillChoices: ALL_SKILLS, skillCount: 3,
    armor: ["light"], weapons: ["simple", "hand_crossbow", "longsword", "rapier", "shortsword"], caster: "full", spellAbility: "cha",
    equipment: [["rapier", 1, true], ["leather", 1, true], ["dagger", 1], ["lute", 1]],
    description: "Sözün ve müziğin büyüsünü kullanan, her işten anlayan maceracı. Ozan İlhamı ile müttefiklerini güçlendirir.",
  },
  cleric: {
    key: "cleric", name: "Rahip", hitDie: 8, primary: "wis", saves: ["wis", "cha"],
    skillChoices: ["history", "insight", "medicine", "persuasion", "religion"], skillCount: 2,
    armor: ["light", "medium", "shield"], weapons: ["simple"], caster: "full", spellAbility: "wis",
    equipment: [["mace", 1, true], ["scale_mail", 1, true], ["shield", 1, true], ["light_crossbow", 1], ["holy_symbol", 1]],
    description: "Tanrısının gücünü taşıyan şifacı ve savaşçı.",
  },
  druid: {
    key: "druid", name: "Druid", hitDie: 8, primary: "wis", saves: ["int", "wis"],
    skillChoices: ["arcana", "animal_handling", "insight", "medicine", "nature", "perception", "religion", "survival"], skillCount: 2,
    armor: ["light", "medium", "shield"], weapons: ["club", "dagger", "dart", "javelin", "mace", "quarterstaff", "scimitar", "sickle", "sling", "spear"],
    caster: "full", spellAbility: "wis",
    equipment: [["scimitar", 1, true], ["leather", 1, true], ["shield", 1, true]],
    description: "Doğanın gücünü çağıran eski düzenin bekçisi.",
  },
  fighter: {
    key: "fighter", name: "Savaşçı", hitDie: 10, primary: "str", saves: ["str", "con"],
    skillChoices: ["acrobatics", "animal_handling", "athletics", "history", "insight", "intimidation", "perception", "survival"], skillCount: 2,
    armor: ["light", "medium", "heavy", "shield"], weapons: ["simple", "martial"], caster: "none",
    equipment: [["chain_mail", 1, true], ["longsword", 1, true], ["shield", 1, true], ["light_crossbow", 1], ["handaxe", 2]],
    description: "Her silahta usta, zırhın efendisi. İkinci Soluk ve Eylem Atılımı ile savaşı çevirir.",
  },
  monk: {
    key: "monk", name: "Keşiş", hitDie: 8, primary: "dex", saves: ["str", "dex"],
    skillChoices: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"], skillCount: 2,
    armor: [], weapons: ["simple", "shortsword"], caster: "none",
    equipment: [["shortsword", 1, true], ["dart", 10]],
    description: "Bedenini silaha çeviren disiplinli dövüş ustası. Zırhsız savunma ve dövüş sanatları.",
  },
  paladin: {
    key: "paladin", name: "Paladin", hitDie: 10, primary: "str", saves: ["wis", "cha"],
    skillChoices: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"], skillCount: 2,
    armor: ["light", "medium", "heavy", "shield"], weapons: ["simple", "martial"], caster: "half", spellAbility: "cha", spellsFrom: 2,
    equipment: [["chain_mail", 1, true], ["longsword", 1, true], ["shield", 1, true], ["javelin", 5], ["holy_symbol", 1]],
    description: "Yemine bağlı kutsal savaşçı. Şifa Eli ve Kutsal Darbe.",
  },
  ranger: {
    key: "ranger", name: "Korucu", hitDie: 10, primary: "dex", saves: ["str", "dex"],
    skillChoices: ["animal_handling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"], skillCount: 3,
    armor: ["light", "medium", "shield"], weapons: ["simple", "martial"], caster: "half", spellAbility: "wis", spellsFrom: 2,
    equipment: [["scale_mail", 1, true], ["shortsword", 2, true], ["longbow", 1], ["arrows", 1]],
    description: "Vahşi doğanın avcısı ve izcisi.",
  },
  rogue: {
    key: "rogue", name: "Düzenbaz", hitDie: 8, primary: "dex", saves: ["dex", "int"],
    skillChoices: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight_of_hand", "stealth"],
    skillCount: 4, armor: ["light"], weapons: ["simple", "hand_crossbow", "longsword", "rapier", "shortsword"], caster: "none",
    equipment: [["rapier", 1, true], ["leather", 1, true], ["shortbow", 1], ["dagger", 2], ["thieves_tools", 1]],
    description: "Gölgelerin ustası. Sinsi Saldırı, uzmanlık ve Kurnaz Eylem.",
  },
  sorcerer: {
    key: "sorcerer", name: "Sihirbaz", hitDie: 6, primary: "cha", saves: ["con", "cha"],
    skillChoices: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"], skillCount: 2,
    armor: [], weapons: ["dagger", "dart", "sling", "quarterstaff", "light_crossbow"], caster: "full", spellAbility: "cha",
    equipment: [["light_crossbow", 1], ["dagger", 2, true], ["arcane_focus", 1]],
    description: "Büyüyü kanında taşıyan doğuştan büyücü.",
  },
  warlock: {
    key: "warlock", name: "Cadı", hitDie: 8, primary: "cha", saves: ["wis", "cha"],
    skillChoices: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"], skillCount: 2,
    armor: ["light"], weapons: ["simple"], caster: "pact", spellAbility: "cha",
    equipment: [["leather", 1, true], ["quarterstaff", 1, true], ["light_crossbow", 1], ["dagger", 2], ["arcane_focus", 1]],
    description: "Kadim bir varlıkla pakt yapmış büyücü. Kadim Patlama.",
  },
  wizard: {
    key: "wizard", name: "Büyücü", hitDie: 6, primary: "int", saves: ["int", "wis"],
    skillChoices: ["arcana", "history", "insight", "investigation", "medicine", "religion"], skillCount: 2,
    armor: [], weapons: ["dagger", "dart", "sling", "quarterstaff", "light_crossbow"], caster: "full", spellAbility: "int",
    equipment: [["quarterstaff", 1, true], ["arcane_focus", 1], ["spellbook", 1]],
    description: "Büyüyü kitaplardan öğrenen bilgin.",
  },
};

export interface ClassLevelFeatures {
  features: Features;
  resources: Record<string, { max: number; recharge: "short" | "long" }>;
  /** Bu seviyede kazanılan yeteneklerin adları (anlatı ve UI için). */
  gained: string[];
}

const rageUses = (lv: number) => (lv >= 20 ? 99 : lv >= 17 ? 6 : lv >= 12 ? 5 : lv >= 6 ? 4 : lv >= 3 ? 3 : 2);
const rageDamage = (lv: number) => (lv >= 16 ? 4 : lv >= 9 ? 3 : 2);
const martialArts = (lv: number) => (lv >= 17 ? 10 : lv >= 11 ? 8 : lv >= 5 ? 6 : 4);
const inspirationDie = (lv: number) => (lv >= 15 ? 12 : lv >= 10 ? 10 : lv >= 5 ? 8 : 6);

/** Sınıfın verilen seviyedeki mekanik özellikleri (kümülatif). */
export function classFeaturesAt(classKey: string, level: number, chaMod = 0): ClassLevelFeatures {
  const f: Features = {};
  const r: ClassLevelFeatures["resources"] = {};
  const gained: string[] = [];
  const at = (lv: number, name: string) => { if (level === lv) gained.push(name); return level >= lv; };
  switch (classKey) {
    case "barbarian":
      at(1, "Öfke"); at(1, "Zırhsız Savunma");
      r.rage = { max: rageUses(level), recharge: "long" };
      f.rageDamage = rageDamage(level);
      f.unarmoredDefense = "con";
      if (at(5, "Ek Saldırı")) f.extraAttacks = 1;
      if (at(9, "Acımasız Kritik")) f.extraCritDice = level >= 17 ? 3 : level >= 13 ? 2 : 1;
      break;
    case "bard":
      at(1, "Ozan İlhamı");
      r.bardic_inspiration = { max: Math.max(1, chaMod), recharge: level >= 5 ? "short" : "long" };
      f.bardicInspirationDie = inspirationDie(level);
      if (at(2, "Her İşin Ustası")) f.jackOfAllTrades = true;
      break;
    case "fighter":
      at(1, "Savaş Stili: Savunma"); at(1, "İkinci Soluk");
      f.fightingStyle = "defense";
      r.second_wind = { max: 1, recharge: "short" };
      if (at(2, "Eylem Atılımı")) r.action_surge = { max: level >= 17 ? 2 : 1, recharge: "short" };
      if (at(3, "Gelişmiş Kritik")) f.critRange = level >= 15 ? 18 : 19;
      if (at(5, "Ek Saldırı")) f.extraAttacks = level >= 20 ? 3 : level >= 11 ? 2 : 1;
      break;
    case "monk":
      at(1, "Dövüş Sanatları"); at(1, "Zırhsız Savunma");
      f.martialArtsDie = martialArts(level);
      f.unarmoredDefense = "wis";
      if (at(2, "Ki")) r.ki = { max: level, recharge: "short" };
      if (at(5, "Ek Saldırı")) f.extraAttacks = 1;
      break;
    case "paladin":
      at(1, "Şifa Eli");
      r.lay_on_hands = { max: 5 * level, recharge: "long" };
      if (at(2, "Savaş Stili: Düello")) f.fightingStyle = "dueling";
      at(2, "Kutsal Darbe");
      if (at(5, "Ek Saldırı")) f.extraAttacks = 1;
      break;
    case "ranger":
      if (at(2, "Savaş Stili: Okçuluk")) f.fightingStyle = "archery";
      if (at(5, "Ek Saldırı")) f.extraAttacks = 1;
      break;
    case "rogue":
      at(1, "Sinsi Saldırı"); at(1, "Uzmanlık");
      f.sneakAttackDice = Math.ceil(level / 2);
      at(2, "Kurnaz Eylem");
      if (at(11, "Güvenilir Yetenek")) f.reliableTalent = true;
      break;
    case "cleric":
    case "druid":
    case "sorcerer":
    case "warlock":
    case "wizard":
      at(1, "Büyü");
      break;
  }
  return { features: f, resources: r, gained };
}

/** Yetenek puanı artışı seviyeleri (savaşçı ve düzenbazın ekleri dahil). */
export function isAsiLevel(classKey: string, level: number): boolean {
  const base = [4, 8, 12, 16, 19];
  if (classKey === "fighter") base.push(6, 14);
  if (classKey === "rogue") base.push(10);
  return base.includes(level);
}
