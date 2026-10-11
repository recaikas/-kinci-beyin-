/**
 * SRD 5.1 silah ve zırh tabloları (CC-BY-4.0).
 * Değerler bakır para (cp) cinsinden: 1 gp = 100 cp, 1 sp = 10 cp.
 */
import type { Weapon } from "../types.ts";

const gp = (n: number) => n * 100;
const sp = (n: number) => n * 10;

type W = Omit<Weapon, "key">;
const simple = (w: W): W => ({ ...w, category: "simple" });
const martial = (w: W): W => ({ ...w, category: "martial" });

const RAW_WEAPONS: Record<string, W> = {
  // Basit yakın dövüş
  club: simple({ name: "Sopa", damage: "1d4", damageType: "bludgeoning", light: true, valueCp: sp(1), weightLb: 2 }),
  dagger: simple({ name: "Hançer", damage: "1d4", damageType: "piercing", finesse: true, light: true, thrown: true, range: [20, 60], valueCp: gp(2), weightLb: 1 }),
  greatclub: simple({ name: "Kalın Sopa", damage: "1d8", damageType: "bludgeoning", twoHanded: true, valueCp: sp(2), weightLb: 10 }),
  handaxe: simple({ name: "El Baltası", damage: "1d6", damageType: "slashing", light: true, thrown: true, range: [20, 60], valueCp: gp(5), weightLb: 2 }),
  javelin: simple({ name: "Cirit", damage: "1d6", damageType: "piercing", thrown: true, range: [30, 120], valueCp: sp(5), weightLb: 2 }),
  light_hammer: simple({ name: "Hafif Çekiç", damage: "1d4", damageType: "bludgeoning", light: true, thrown: true, range: [20, 60], valueCp: gp(2), weightLb: 2 }),
  mace: simple({ name: "Gürz", damage: "1d6", damageType: "bludgeoning", valueCp: gp(5), weightLb: 4 }),
  quarterstaff: simple({ name: "Asa", damage: "1d6", damageType: "bludgeoning", versatile: "1d8", valueCp: sp(2), weightLb: 4 }),
  sickle: simple({ name: "Orak", damage: "1d4", damageType: "slashing", light: true, valueCp: gp(1), weightLb: 2 }),
  spear: simple({ name: "Mızrak", damage: "1d6", damageType: "piercing", thrown: true, range: [20, 60], versatile: "1d8", valueCp: gp(1), weightLb: 3 }),
  // Basit menzilli
  light_crossbow: simple({ name: "Hafif Arbalet", damage: "1d8", damageType: "piercing", ranged: true, range: [80, 320], loading: true, twoHanded: true, valueCp: gp(25), weightLb: 5 }),
  dart: simple({ name: "Dart", damage: "1d4", damageType: "piercing", ranged: true, finesse: true, thrown: true, range: [20, 60], valueCp: 5, weightLb: 0.25 }),
  shortbow: simple({ name: "Kısa Yay", damage: "1d6", damageType: "piercing", ranged: true, range: [80, 320], twoHanded: true, valueCp: gp(25), weightLb: 2 }),
  sling: simple({ name: "Sapan", damage: "1d4", damageType: "bludgeoning", ranged: true, range: [30, 120], valueCp: sp(1), weightLb: 0 }),
  // Savaş yakın dövüş
  battleaxe: martial({ name: "Savaş Baltası", damage: "1d8", damageType: "slashing", versatile: "1d10", valueCp: gp(10), weightLb: 4 }),
  flail: martial({ name: "Döven", damage: "1d8", damageType: "bludgeoning", valueCp: gp(10), weightLb: 2 }),
  glaive: martial({ name: "Teber", damage: "1d10", damageType: "slashing", heavy: true, reach: true, twoHanded: true, valueCp: gp(20), weightLb: 6 }),
  greataxe: martial({ name: "Büyük Balta", damage: "1d12", damageType: "slashing", heavy: true, twoHanded: true, valueCp: gp(30), weightLb: 7 }),
  greatsword: martial({ name: "Büyük Kılıç", damage: "2d6", damageType: "slashing", heavy: true, twoHanded: true, valueCp: gp(50), weightLb: 6 }),
  halberd: martial({ name: "Kargı Balta", damage: "1d10", damageType: "slashing", heavy: true, reach: true, twoHanded: true, valueCp: gp(20), weightLb: 6 }),
  lance: martial({ name: "Kargı", damage: "1d12", damageType: "piercing", reach: true, valueCp: gp(10), weightLb: 6 }),
  longsword: martial({ name: "Uzun Kılıç", damage: "1d8", damageType: "slashing", versatile: "1d10", valueCp: gp(15), weightLb: 3 }),
  maul: martial({ name: "Balyoz", damage: "2d6", damageType: "bludgeoning", heavy: true, twoHanded: true, valueCp: gp(10), weightLb: 10 }),
  morningstar: martial({ name: "Gürz-Yıldız", damage: "1d8", damageType: "piercing", valueCp: gp(15), weightLb: 4 }),
  pike: martial({ name: "Uzun Mızrak", damage: "1d10", damageType: "piercing", heavy: true, reach: true, twoHanded: true, valueCp: gp(5), weightLb: 18 }),
  rapier: martial({ name: "Meç", damage: "1d8", damageType: "piercing", finesse: true, valueCp: gp(25), weightLb: 2 }),
  scimitar: martial({ name: "Pala", damage: "1d6", damageType: "slashing", finesse: true, light: true, valueCp: gp(25), weightLb: 3 }),
  shortsword: martial({ name: "Kısa Kılıç", damage: "1d6", damageType: "piercing", finesse: true, light: true, valueCp: gp(10), weightLb: 2 }),
  trident: martial({ name: "Üç Dişli Mızrak", damage: "1d6", damageType: "piercing", thrown: true, range: [20, 60], versatile: "1d8", valueCp: gp(5), weightLb: 4 }),
  war_pick: martial({ name: "Savaş Kazması", damage: "1d8", damageType: "piercing", valueCp: gp(5), weightLb: 2 }),
  warhammer: martial({ name: "Savaş Çekici", damage: "1d8", damageType: "bludgeoning", versatile: "1d10", valueCp: gp(15), weightLb: 2 }),
  whip: martial({ name: "Kırbaç", damage: "1d4", damageType: "slashing", finesse: true, reach: true, valueCp: gp(2), weightLb: 3 }),
  // Savaş menzilli
  blowgun: martial({ name: "Üfleme Borusu", damage: "1", damageType: "piercing", ranged: true, range: [25, 100], loading: true, valueCp: gp(10), weightLb: 1 }),
  hand_crossbow: martial({ name: "El Arbaleti", damage: "1d6", damageType: "piercing", ranged: true, light: true, range: [30, 120], loading: true, valueCp: gp(75), weightLb: 3 }),
  heavy_crossbow: martial({ name: "Ağır Arbalet", damage: "1d10", damageType: "piercing", ranged: true, heavy: true, range: [100, 400], loading: true, twoHanded: true, valueCp: gp(50), weightLb: 18 }),
  longbow: martial({ name: "Uzun Yay", damage: "1d8", damageType: "piercing", ranged: true, heavy: true, range: [150, 600], twoHanded: true, valueCp: gp(50), weightLb: 2 }),
  // Tarihî (SRD dışı; DMG'deki Rönesans ateşli silahlarına benzer değerler, ev kuralı)
  yatagan: martial({ name: "Yatağan", damage: "1d6", damageType: "slashing", finesse: true, light: true, valueCp: gp(15), weightLb: 2 }),
  kilic: martial({ name: "Kılıç", damage: "1d8", damageType: "slashing", versatile: "1d10", valueCp: gp(20), weightLb: 3 }),
  arquebus: martial({ name: "Fitilli Tüfek", damage: "1d12", damageType: "piercing", ranged: true, range: [40, 120], loading: true, twoHanded: true, valueCp: gp(250), weightLb: 10 }),
  pistol: martial({ name: "Çarklı Tabanca", damage: "1d10", damageType: "piercing", ranged: true, range: [30, 90], loading: true, valueCp: gp(300), weightLb: 3 }),
  belaying_pin: simple({ name: "Armadora Çivisi", damage: "1d4", damageType: "bludgeoning", light: true, valueCp: 5, weightLb: 1 }),
  // Silahsız
  unarmed: { name: "Silahsız Vuruş", damage: "1", damageType: "bludgeoning", category: "simple", valueCp: 0, weightLb: 0 },
};

export const WEAPONS: Record<string, Weapon> = Object.fromEntries(
  Object.entries(RAW_WEAPONS).map(([key, w]) => [key, { key, ...w }]),
);

/** Canavarların doğal saldırıları. */
export const NATURAL_WEAPONS: Record<string, Weapon> = Object.fromEntries(Object.entries({
  bite: { name: "Isırık", damage: "2d4", damageType: "piercing", finesse: true },
  bite_small: { name: "Isırık", damage: "1d4", damageType: "piercing", finesse: true },
  wolf_bite: { name: "Isırık", damage: "2d4", damageType: "piercing", finesse: true, onHit: { ability: "str", dc: 11, condition: "prone" } },
  dire_wolf_bite: { name: "Isırık", damage: "2d6", damageType: "piercing", onHit: { ability: "str", dc: 13, condition: "prone" } },
  bear_bite: { name: "Isırık", damage: "1d8", damageType: "piercing" },
  bear_claws: { name: "Pençeler", damage: "2d6", damageType: "slashing" },
  owlbear_beak: { name: "Gaga", damage: "1d10", damageType: "piercing" },
  owlbear_claws: { name: "Pençeler", damage: "2d8", damageType: "slashing" },
  spider_bite: { name: "Zehirli Isırık", damage: "1d8", damageType: "piercing", finesse: true, onHit: { ability: "con", dc: 11, damage: "2d8", damageType: "poison", halfOnSave: true } },
  ghoul_claws: { name: "Felç Eden Pençeler", damage: "2d4", damageType: "slashing", finesse: true, onHit: { ability: "con", dc: 10, condition: "paralyzed", durationMin: 1, repeatSave: true } },
  gnoll_bite: { name: "Isırık", damage: "1d4", damageType: "piercing" },
  greatclub_ogre: { name: "Dev Sopa", damage: "2d8", damageType: "bludgeoning" },
  morningstar_brute: { name: "Ağır Gürz-Yıldız", damage: "2d8", damageType: "piercing" },
  slam: { name: "Darbe", damage: "1d6", damageType: "bludgeoning" },
  claw: { name: "Pençe", damage: "1d6", damageType: "slashing" },
} as Record<string, W>).map(([key, w]) => [key, { key, category: "natural" as const, ...w }]));

export type ArmorCategory = "light" | "medium" | "heavy" | "shield";

export interface Armor {
  key: string;
  name: string;
  category: ArmorCategory;
  /** Temel AC (kalkan için eklenen bonus). */
  ac: number;
  /** DEX üst sınırı: null = sınırsız, 0 = DEX eklenmez. */
  dexCap: number | null;
  strRequirement?: number;
  stealthDisadvantage?: boolean;
  valueCp: number;
  weightLb: number;
}

export const ARMOR: Record<string, Armor> = Object.fromEntries(Object.entries({
  padded: { name: "Dolgulu Zırh", category: "light", ac: 11, dexCap: null, stealthDisadvantage: true, valueCp: gp(5), weightLb: 8 },
  leather: { name: "Deri Zırh", category: "light", ac: 11, dexCap: null, valueCp: gp(10), weightLb: 10 },
  studded_leather: { name: "Çivili Deri Zırh", category: "light", ac: 12, dexCap: null, valueCp: gp(45), weightLb: 13 },
  hide: { name: "Post Zırh", category: "medium", ac: 12, dexCap: 2, valueCp: gp(10), weightLb: 12 },
  chain_shirt: { name: "Zincir Gömlek", category: "medium", ac: 13, dexCap: 2, valueCp: gp(50), weightLb: 20 },
  scale_mail: { name: "Pullu Zırh", category: "medium", ac: 14, dexCap: 2, stealthDisadvantage: true, valueCp: gp(50), weightLb: 45 },
  breastplate: { name: "Göğüslük", category: "medium", ac: 14, dexCap: 2, valueCp: gp(400), weightLb: 20 },
  half_plate: { name: "Yarım Plaka", category: "medium", ac: 15, dexCap: 2, stealthDisadvantage: true, valueCp: gp(750), weightLb: 40 },
  ring_mail: { name: "Halkalı Zırh", category: "heavy", ac: 14, dexCap: 0, stealthDisadvantage: true, valueCp: gp(30), weightLb: 40 },
  chain_mail: { name: "Zincir Zırh", category: "heavy", ac: 16, dexCap: 0, strRequirement: 13, stealthDisadvantage: true, valueCp: gp(75), weightLb: 55 },
  splint: { name: "Lameli Zırh", category: "heavy", ac: 17, dexCap: 0, strRequirement: 15, stealthDisadvantage: true, valueCp: gp(200), weightLb: 60 },
  plate: { name: "Plaka Zırh", category: "heavy", ac: 18, dexCap: 0, strRequirement: 15, stealthDisadvantage: true, valueCp: gp(1500), weightLb: 65 },
  shield: { name: "Kalkan", category: "shield", ac: 2, dexCap: null, valueCp: gp(10), weightLb: 6 },
} as Record<string, Omit<Armor, "key">>).map(([key, a]) => [key, { key, ...a }]));
