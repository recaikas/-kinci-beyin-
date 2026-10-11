/**
 * SRD 5.1 büyüleri (CC-BY-4.0) — motorun çalıştırabildiği alt küme.
 * Süreler dakika cinsinden; savaşta oyun zamanı ilerlemediği için savaş boyu sürerler.
 */
import type { SpellDef } from "../spells.ts";

const ARCANE = ["sorcerer", "wizard"];
const S = (s: SpellDef): [string, SpellDef] => [s.key, s];

export const SPELLS: Record<string, SpellDef> = Object.fromEntries([
  // ---------------- Cantrip'ler
  S({ key: "fire_bolt", name: "Ateş Oku", level: 0, school: "evocation", castingTime: "action", rangeFt: 120, concentration: false, classes: ARCANE,
    attack: "ranged", damage: "1d10", damageType: "fire", summary: "Menzilli büyü saldırısı; 1d10 ateş, yanıcı nesneleri tutuşturur." }),
  S({ key: "ray_of_frost", name: "Ayaz Işını", level: 0, school: "evocation", castingTime: "action", rangeFt: 60, concentration: false, classes: ARCANE,
    attack: "ranged", damage: "1d8", damageType: "cold", summary: "Buz mavisi ışın; 1d8 soğuk, hedefi yavaşlatır." }),
  S({ key: "shocking_grasp", name: "Şok Edici Dokunuş", level: 0, school: "evocation", castingTime: "action", rangeFt: 5, concentration: false, classes: ARCANE,
    attack: "melee", damage: "1d8", damageType: "lightning", summary: "Dokunuşla 1d8 yıldırım; hedef reaksiyon yapamaz." }),
  S({ key: "chill_touch", name: "Ölüm Dokunuşu", level: 0, school: "necromancy", castingTime: "action", rangeFt: 120, concentration: false, classes: ["sorcerer", "warlock", "wizard"],
    attack: "ranged", damage: "1d8", damageType: "necrotic", summary: "Hayaletimsi el; 1d8 nekrotik, hedef HP kazanamaz." }),
  S({ key: "poison_spray", name: "Zehir Püskürtme", level: 0, school: "conjuration", castingTime: "action", rangeFt: 10, concentration: false, classes: ["druid", "sorcerer", "warlock", "wizard"],
    save: "con", damage: "1d12", damageType: "poison", summary: "Zehirli bulut; CON kurtarması, 1d12 zehir." }),
  S({ key: "sacred_flame", name: "Kutsal Alev", level: 0, school: "evocation", castingTime: "action", rangeFt: 60, concentration: false, classes: ["cleric"],
    save: "dex", damage: "1d8", damageType: "radiant", summary: "Gökten inen ışıltı; DEX kurtarması, 1d8 ışıltı. Siper işe yaramaz." }),
  S({ key: "eldritch_blast", name: "Kadim Patlama", level: 0, school: "evocation", castingTime: "action", rangeFt: 120, concentration: false, classes: ["warlock"],
    attack: "ranged", damage: "1d10", damageType: "force", summary: "Çatırdayan enerji huzmesi; 1d10 güç." }),
  S({ key: "vicious_mockery", name: "Acımasız Alay", level: 0, school: "enchantment", castingTime: "action", rangeFt: 60, concentration: false, classes: ["bard"],
    save: "wis", damage: "1d4", damageType: "psychic", debuffOnFail: { attackDice: "-1d4" }, durationMin: 1,
    summary: "Büyülü hakaretler; WIS kurtarması, 1d4 psişik ve sonraki saldırısı zayıflar." }),
  S({ key: "produce_flame", name: "Alev Yarat", level: 0, school: "conjuration", castingTime: "action", rangeFt: 30, concentration: false, classes: ["druid"],
    attack: "ranged", damage: "1d8", damageType: "fire", summary: "Avuçta beliren alev fırlatılır; 1d8 ateş." }),
  S({ key: "light", name: "Işık", level: 0, school: "evocation", castingTime: "action", rangeFt: 5, concentration: false, classes: ["bard", "cleric", "sorcerer", "wizard"],
    utility: true, summary: "Bir nesne bir saat boyunca meşale gibi parlar." }),
  S({ key: "mage_hand", name: "Büyülü El", level: 0, school: "conjuration", castingTime: "action", rangeFt: 30, concentration: false, classes: ["bard", "sorcerer", "warlock", "wizard"],
    utility: true, summary: "Hayaletimsi bir el uzaktaki hafif nesneleri hareket ettirir." }),
  S({ key: "guidance", name: "Rehberlik", level: 0, school: "divination", castingTime: "action", rangeFt: 5, concentration: true, classes: ["cleric", "druid"],
    utility: true, summary: "Dokunulan yaratık bir yetenek kontrolüne 1d4 ekleyebilir." }),

  // ---------------- 1. seviye
  S({ key: "magic_missile", name: "Büyülü Füze", level: 1, school: "evocation", castingTime: "action", rangeFt: 120, concentration: false, classes: ARCANE,
    damageType: "force", autoHitDarts: { count: 3, damage: "1d4+1" }, summary: "Üç parlayan ok otomatik isabet eder; her biri 1d4+1 güç." }),
  S({ key: "burning_hands", name: "Yakan Eller", level: 1, school: "evocation", castingTime: "action", rangeFt: 15, concentration: false, classes: ARCANE,
    save: "dex", damage: "3d6", damageType: "fire", halfOnSave: true, upcastDice: "1d6", maxTargets: 6, summary: "4,5 m koni; DEX kurtarması, 3d6 ateş." }),
  S({ key: "thunderwave", name: "Gök Gürültüsü Dalgası", level: 1, school: "evocation", castingTime: "action", rangeFt: 15, concentration: false, classes: ["bard", "druid", "sorcerer", "wizard"],
    save: "con", damage: "2d8", damageType: "thunder", halfOnSave: true, upcastDice: "1d8", maxTargets: 6, summary: "Sarsıcı ses dalgası; CON kurtarması, 2d8 gök gürültüsü, itme." }),
  S({ key: "cure_wounds", name: "Yara İyileştir", level: 1, school: "evocation", castingTime: "action", rangeFt: 5, concentration: false, classes: ["bard", "cleric", "druid", "paladin", "ranger"],
    heal: "1d8", addAbilityMod: true, upcastDice: "1d8", summary: "Dokunulan yaratık 1d8 + mod iyileşir." }),
  S({ key: "healing_word", name: "Şifa Sözü", level: 1, school: "evocation", castingTime: "bonus_action", rangeFt: 60, concentration: false, classes: ["bard", "cleric", "druid"],
    heal: "1d4", addAbilityMod: true, upcastDice: "1d4", summary: "Bonus eylemle uzaktan 1d4 + mod iyileştirme." }),
  S({ key: "guiding_bolt", name: "Yol Gösteren Şimşek", level: 1, school: "evocation", castingTime: "action", rangeFt: 120, concentration: false, classes: ["cleric"],
    attack: "ranged", damage: "4d6", damageType: "radiant", upcastDice: "1d6", summary: "Işık huzmesi; 4d6 ışıltı." }),
  S({ key: "inflict_wounds", name: "Yara Aç", level: 1, school: "necromancy", castingTime: "action", rangeFt: 5, concentration: false, classes: ["cleric"],
    attack: "melee", damage: "3d10", damageType: "necrotic", upcastDice: "1d10", summary: "Çürüten dokunuş; 3d10 nekrotik." }),
  S({ key: "bless", name: "Kutsama", level: 1, school: "enchantment", castingTime: "action", rangeFt: 30, concentration: true, classes: ["cleric", "paladin"],
    buff: { attackDice: "1d4", saveDice: "1d4" }, maxTargets: 3, upcastTargets: 1, durationMin: 1, summary: "Üç yaratık saldırı ve kurtarmalarına 1d4 ekler (konsantrasyon)." }),
  S({ key: "bane", name: "Lanet", level: 1, school: "enchantment", castingTime: "action", rangeFt: 30, concentration: true, classes: ["bard", "cleric"],
    save: "cha", debuffOnFail: { attackDice: "-1d4", saveDice: "-1d4" }, maxTargets: 3, upcastTargets: 1, durationMin: 1, summary: "CHA kurtarmasında başarısız olanlar saldırı ve kurtarmalardan 1d4 düşer." }),
  S({ key: "shield_of_faith", name: "İnanç Kalkanı", level: 1, school: "abjuration", castingTime: "bonus_action", rangeFt: 60, concentration: true, classes: ["cleric", "paladin"],
    buff: { acBonus: 2 }, durationMin: 10, summary: "Parıldayan alan; hedefe +2 AC (konsantrasyon)." }),
  S({ key: "mage_armor", name: "Büyü Zırhı", level: 1, school: "abjuration", castingTime: "action", rangeFt: 5, concentration: false, classes: ARCANE,
    mageArmor: true, durationMin: 480, summary: "Zırhsız hedefin AC'si 13 + DEX olur (8 saat)." }),
  S({ key: "sleep", name: "Uyku", level: 1, school: "enchantment", castingTime: "action", rangeFt: 90, concentration: false, classes: ["bard", "sorcerer", "wizard"],
    sleepPool: { dice: "5d8", upcastDice: "2d8" }, maxTargets: 10, summary: "5d8 HP'lik havuz; en zayıflardan başlayarak yaratıklar uyur." }),
  S({ key: "charm_person", name: "Kişiyi Büyüle", level: 1, school: "enchantment", castingTime: "action", rangeFt: 30, concentration: false, classes: ["bard", "druid", "sorcerer", "warlock", "wizard"],
    save: "wis", conditionsOnFail: ["charmed"], durationMin: 60, upcastTargets: 1, summary: "İnsansı WIS kurtarmasında başarısızsa seni dost bilir (1 saat)." }),
  S({ key: "faerie_fire", name: "Peri Ateşi", level: 1, school: "evocation", castingTime: "action", rangeFt: 60, concentration: true, classes: ["bard", "druid"],
    save: "dex", debuffOnFail: { revealed: true }, maxTargets: 8, durationMin: 1, summary: "Mor ışıltı; DEX kurtarmasında başarısız olana saldırılar avantajlı." }),
  S({ key: "entangle", name: "Dolaştır", level: 1, school: "conjuration", castingTime: "action", rangeFt: 90, concentration: true, classes: ["druid"],
    save: "str", conditionsOnFail: ["restrained"], repeatSaveEachTurn: true, maxTargets: 6, durationMin: 1, summary: "Sarmaşıklar fışkırır; STR kurtarmasında başarısız olan kısıtlanır." }),
  S({ key: "arms_of_hadar", name: "Hadar'ın Kolları", level: 1, school: "conjuration", castingTime: "action", rangeFt: 10, concentration: false, classes: ["warlock"],
    save: "str", damage: "2d6", damageType: "necrotic", halfOnSave: true, upcastDice: "1d6", maxTargets: 6, summary: "Karanlık dokunaçlar; STR kurtarması, 2d6 nekrotik." }),
  S({ key: "false_life", name: "Sahte Yaşam", level: 1, school: "necromancy", castingTime: "action", rangeFt: 0, concentration: false, classes: ["sorcerer", "wizard"],
    tempHp: "1d4+4", summary: "Kendine 1d4+4 geçici HP." }),
  S({ key: "detect_magic", name: "Büyü Algıla", level: 1, school: "divination", castingTime: "action", rangeFt: 0, concentration: true, ritual: true,
    classes: ["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "wizard"], utility: true, summary: "9 m içindeki büyünün varlığını sezersin." }),

  // ---------------- 2. seviye
  S({ key: "hold_person", name: "Kişiyi Tut", level: 2, school: "enchantment", castingTime: "action", rangeFt: 60, concentration: true,
    classes: ["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"], save: "wis", conditionsOnFail: ["paralyzed"], repeatSaveEachTurn: true, upcastTargets: 1, durationMin: 1,
    summary: "İnsansı WIS kurtarmasında başarısızsa felç olur; her turunun sonunda yeniden dener." }),
  S({ key: "scorching_ray", name: "Kavurucu Işın", level: 2, school: "evocation", castingTime: "action", rangeFt: 120, concentration: false, classes: ARCANE,
    damageType: "fire", rays: { count: 3, damage: "2d6" }, summary: "Üç ateş ışını; her biri ayrı saldırı, 2d6 ateş." }),
  S({ key: "shatter", name: "Parçala", level: 2, school: "evocation", castingTime: "action", rangeFt: 60, concentration: false, classes: ["bard", "sorcerer", "warlock", "wizard"],
    save: "con", damage: "3d8", damageType: "thunder", halfOnSave: true, upcastDice: "1d8", maxTargets: 6, summary: "Kulak tırmalayan çınlama; CON kurtarması, 3d8 gök gürültüsü." }),
  S({ key: "lesser_restoration", name: "Küçük Onarım", level: 2, school: "abjuration", castingTime: "action", rangeFt: 5, concentration: false, classes: ["bard", "cleric", "druid", "paladin", "ranger"],
    cures: ["blinded", "deafened", "paralyzed", "poisoned"], summary: "Körlük, sağırlık, felç ya da zehirlenmeyi kaldırır." }),
  S({ key: "invisibility", name: "Görünmezlik", level: 2, school: "illusion", castingTime: "action", rangeFt: 5, concentration: true, classes: ["bard", "sorcerer", "warlock", "wizard"],
    conditionsApply: ["invisible"], upcastTargets: 1, durationMin: 60, summary: "Dokunulan yaratık görünmez olur (konsantrasyon)." }),
  S({ key: "aid", name: "Destek", level: 2, school: "abjuration", castingTime: "action", rangeFt: 30, concentration: false, classes: ["cleric", "paladin"],
    tempHp: "5", maxTargets: 3, summary: "Üç müttefik yiğitlikle dolar: 5 geçici HP." }),
  S({ key: "misty_step", name: "Sisli Adım", level: 2, school: "conjuration", castingTime: "bonus_action", rangeFt: 0, concentration: false, classes: ["sorcerer", "warlock", "wizard"],
    utility: true, summary: "Gümüşi sisle 9 m ötedeki görebildiğin bir noktaya ışınlanırsın." }),

  // ---------------- 3. seviye
  S({ key: "fireball", name: "Ateş Topu", level: 3, school: "evocation", castingTime: "action", rangeFt: 150, concentration: false, classes: ARCANE,
    save: "dex", damage: "8d6", damageType: "fire", halfOnSave: true, upcastDice: "1d6", maxTargets: 20, summary: "6 m yarıçaplı patlama; DEX kurtarması, 8d6 ateş." }),
  S({ key: "lightning_bolt", name: "Yıldırım", level: 3, school: "evocation", castingTime: "action", rangeFt: 100, concentration: false, classes: ARCANE,
    save: "dex", damage: "8d6", damageType: "lightning", halfOnSave: true, upcastDice: "1d6", maxTargets: 10, summary: "30 m'lik şimşek hattı; DEX kurtarması, 8d6 yıldırım." }),
  S({ key: "mass_healing_word", name: "Toplu Şifa Sözü", level: 3, school: "evocation", castingTime: "bonus_action", rangeFt: 60, concentration: false, classes: ["cleric"],
    heal: "1d4", addAbilityMod: true, upcastDice: "1d4", maxTargets: 6, summary: "Altı yaratık 1d4 + mod iyileşir." }),
  S({ key: "revivify", name: "Dirilt", level: 3, school: "necromancy", castingTime: "action", rangeFt: 5, concentration: false, classes: ["cleric", "paladin"],
    revive: true, summary: "Son bir dakikada ölmüş yaratık 1 HP ile hayata döner (300 altınlık elmas tüketir)." }),
  S({ key: "hypnotic_pattern", name: "Hipnotik Desen", level: 3, school: "illusion", castingTime: "action", rangeFt: 120, concentration: true, classes: ["bard", "sorcerer", "warlock", "wizard"],
    save: "wis", conditionsOnFail: ["charmed", "incapacitated"], maxTargets: 8, durationMin: 1, summary: "Renkli desen; WIS kurtarmasında başarısız olanlar büyülenir ve donakalır." }),
]);

/** Sınıfın öğrenebileceği büyüler, seviyeye göre. */
export function spellsForClass(classKey: string, maxLevel: number): SpellDef[] {
  return Object.values(SPELLS).filter((s) => s.classes.includes(classKey) && s.level <= maxLevel);
}
