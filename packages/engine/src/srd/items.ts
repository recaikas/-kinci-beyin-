/**
 * Eşya kataloğu: silahlar ve zırhlar da eşyadır (envanterde taşınır, alınıp satılır).
 */
import { ARMOR, WEAPONS } from "./equipment.ts";

export type ItemType = "weapon" | "armor" | "potion" | "gear" | "treasure" | "tool" | "key" | "food" | "scroll";

export interface ItemDef {
  key: string;
  name: string;
  type: ItemType;
  valueCp: number;
  weightLb: number;
  /** Kullanımda iyileştirme notasyonu. */
  heal?: string;
  /** Kullanımda verilen geçici HP. */
  tempHp?: string;
  /** Kullanımda kaldırılan koşullar. */
  cures?: string[];
  /** Tüketilir mi. */
  consumable?: boolean;
  /** Parşömen: içindeki büyü. */
  spellKey?: string;
  /** Satıcılar bunu satar mı (nadir eşyalar satılmaz). */
  rare?: boolean;
  description: string;
}

const gp = (n: number) => n * 100;

const GEAR: Record<string, Omit<ItemDef, "key">> = {
  potion_of_healing: { name: "İyileştirme İksiri", type: "potion", valueCp: gp(50), weightLb: 0.5, heal: "2d4+2", consumable: true, description: "Kırmızı, ışıldayan sıvı. 2d4+2 HP iyileştirir." },
  potion_of_greater_healing: { name: "Büyük İyileştirme İksiri", type: "potion", valueCp: gp(150), weightLb: 0.5, heal: "4d4+4", consumable: true, rare: true, description: "Koyu kızıl, sıcak. 4d4+4 HP iyileştirir." },
  antitoxin: { name: "Panzehir", type: "potion", valueCp: gp(50), weightLb: 0, cures: ["poisoned"], consumable: true, description: "Zehirlenmeyi giderir." },
  potion_of_heroism: { name: "Kahramanlık İksiri", type: "potion", valueCp: gp(180), weightLb: 0.5, tempHp: "10", consumable: true, rare: true, description: "Damarlarına cesaret yayılır: 10 geçici HP." },
  healers_kit: { name: "Şifacı Seti", type: "tool", valueCp: gp(5), weightLb: 3, consumable: true, description: "0 HP'deki yaratığı kontrol gerektirmeden stabilize eder." },
  thieves_tools: { name: "Hırsız Aletleri", type: "tool", valueCp: gp(25), weightLb: 1, description: "Kilit açma ve tuzak etkisizleştirme (El Çabukluğu kontrollerinde avantaj)." },
  rope_hempen: { name: "Kenevir Halat (15 m)", type: "gear", valueCp: gp(1), weightLb: 10, description: "Tırmanma ve bağlama için." },
  torch: { name: "Meşale", type: "gear", valueCp: 1, weightLb: 1, consumable: true, description: "1 saat yanar; 6 m parlak, 6 m loş ışık." },
  lantern: { name: "Kandil", type: "gear", valueCp: gp(5), weightLb: 2, description: "Kapalı fener; 9 m parlak ışık." },
  rations: { name: "Erzak (1 gün)", type: "food", valueCp: 50, weightLb: 2, consumable: true, description: "Kurutulmuş et, peksimet, kuruyemiş." },
  waterskin: { name: "Su Tulumu", type: "gear", valueCp: 20, weightLb: 5, description: "Bir günlük su." },
  bedroll: { name: "Uyku Tulumu", type: "gear", valueCp: gp(1), weightLb: 7, description: "Açık havada uyumak için." },
  crowbar: { name: "Levye", type: "tool", valueCp: gp(2), weightLb: 5, description: "Kaldıraç gereken Güç kontrollerinde avantaj." },
  holy_symbol: { name: "Kutsal Sembol", type: "gear", valueCp: gp(5), weightLb: 1, description: "Rahiplerin büyü odağı." },
  arcane_focus: { name: "Büyü Odağı (Kristal)", type: "gear", valueCp: gp(10), weightLb: 1, description: "Büyücülerin odak kristali." },
  spellbook: { name: "Büyü Kitabı", type: "gear", valueCp: gp(50), weightLb: 3, description: "Büyücünün bildiği büyüler." },
  lute: { name: "Ut", type: "tool", valueCp: gp(35), weightLb: 2, description: "Ozanın sazı." },
  arrows: { name: "Ok (20)", type: "gear", valueCp: gp(1), weightLb: 1, description: "Yay için 20 ok." },
  bolts: { name: "Arbalet Oku (20)", type: "gear", valueCp: gp(1), weightLb: 1.5, description: "Arbalet için 20 ok." },
  scroll_cure_wounds: { name: "Parşömen: Yara İyileştir", type: "scroll", valueCp: gp(75), weightLb: 0, consumable: true, spellKey: "cure_wounds", rare: true, description: "Okunduğunda Yara İyileştir büyüsü etkinleşir." },
  scroll_fireball: { name: "Parşömen: Ateş Topu", type: "scroll", valueCp: gp(300), weightLb: 0, consumable: true, spellKey: "fireball", rare: true, description: "Okunduğunda Ateş Topu patlar." },
  gem_agate: { name: "Akik Taşı", type: "treasure", valueCp: gp(10), weightLb: 0, description: "Bantlı, kırmızımsı yarı değerli taş." },
  gem_garnet: { name: "Lal Taşı", type: "treasure", valueCp: gp(100), weightLb: 0, description: "Koyu kırmızı, parlak." },
  silver_ring: { name: "Gümüş Yüzük", type: "treasure", valueCp: gp(25), weightLb: 0, description: "Üzerinde silik bir arma." },
  goblin_totem: { name: "Goblin Totemi", type: "treasure", valueCp: gp(2), weightLb: 1, description: "Kemik ve tüyden kaba bir muska." },
  wolf_pelt: { name: "Kurt Postu", type: "treasure", valueCp: gp(3), weightLb: 5, description: "Tabaklanmamış gri post." },
  sealed_letter: { name: "Mühürlü Mektup", type: "key", valueCp: 0, weightLb: 0, rare: true, description: "Karaçam muhtarına hitaben, mumla mühürlenmiş." },
  bandit_map: { name: "Haydut Haritası", type: "key", valueCp: 0, weightLb: 0, rare: true, description: "Ormandaki gizli bir ini gösteren kaba çizim." },
};

export const ITEMS: Record<string, ItemDef> = {
  ...Object.fromEntries(Object.values(WEAPONS).filter((w) => w.key !== "unarmed").map((w) => [w.key, {
    key: w.key, name: w.name, type: "weapon" as const, valueCp: w.valueCp ?? 0, weightLb: w.weightLb ?? 0,
    description: `${w.category === "martial" ? "Savaş" : "Basit"} silahı, ${w.damage} ${w.damageType}.`,
  }])),
  ...Object.fromEntries(Object.values(ARMOR).map((a) => [a.key, {
    key: a.key, name: a.name, type: "armor" as const, valueCp: a.valueCp, weightLb: a.weightLb,
    description: a.category === "shield" ? "AC +2." : `${a.category} zırh, AC ${a.ac}${a.dexCap === null ? " + DEX" : a.dexCap > 0 ? ` + DEX (en çok ${a.dexCap})` : ""}.`,
  }])),
  ...Object.fromEntries(Object.entries(GEAR).map(([key, i]) => [key, { key, ...i }])),
};
