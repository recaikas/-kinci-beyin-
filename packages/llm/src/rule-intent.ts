/**
 * Kural tabanlı Türkçe niyet çözümleyici (LLM'siz).
 *
 * - API anahtarı yoksa oyunun tek niyet kaynağıdır.
 * - Anahtar varsa kısa ve net komutlarda LLM çağrısını atlar (maliyet ve gecikme sıfır).
 */
import { type GameAction, SKILL_LIST } from "@kader/engine";
import type { IntentResult } from "./intent.ts";

export interface RuleScene {
  playerId: string;
  inCombat: boolean;
  entities: { id: string; name: string; alive: boolean; hp: number; kind: string; hostile: boolean; merchant?: boolean }[];
  exits: { id: string; name: string; minutes: number }[];
  inventory: { key: string; name: string; type: string; equipped?: boolean; qty: number }[];
  spells: { key: string; name: string; level: number; heal?: boolean; harmful?: boolean }[];
  /** Tüccar stokları: tüccar id → eşyalar. */
  shopItems: Record<string, { key: string; name: string }[]>;
  quests: { id: string; title: string; status: string }[];
  abilities: string[];
  /** Oyuncu sınıfı: paladin smite vb. için. */
  classKey?: string;
}

export type RuleIntent = IntentResult & { confidence: "high" | "low" };

/** Türkçe karakterleri ASCII'ye katla ve küçült. */
export function fold(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[âà]/g, "a").replace(/[îì]/g, "i").replace(/[ûù]/g, "u")
    .replace(/['’`".,;:!?()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const has = (t: string, ...words: string[]) => words.some((w) => new RegExp(`(^|\\s)${w}`).test(t));

/** Metinde geçen en iyi isim eşleşmesi (kelime başı önek eşleşmesi, en uzun kazanır). */
function matchName<T extends { name: string; id?: string; key?: string }>(t: string, items: T[]): T | undefined {
  let best: { item: T; score: number } | undefined;
  for (const item of items) {
    const tokens = fold(item.name).split(" ").filter((x) => x.length >= 3);
    const ids = [item.id, item.key].filter((x): x is string => !!x).map((x) => fold(x.replace(/_/g, " ")));
    let score = 0;
    const full = fold(item.name);
    if (full.length >= 3 && t.includes(full)) score = full.length + 10;
    for (const tok of tokens) {
      const stem = tok.length > 5 ? tok.slice(0, tok.length - 1) : tok;
      if (new RegExp(`(^|\\s)${stem}`).test(t)) score = Math.max(score, tok.length);
    }
    for (const id of ids) if (id.length >= 3 && new RegExp(`(^|\\s)${id}`).test(t)) score = Math.max(score, id.length);
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item;
}

function number(t: string): number | null {
  const m = /(\d+)/.exec(t);
  return m ? Number(m[1]) : null;
}

const SKILL_WORDS: [RegExp, (typeof SKILL_LIST)[number]][] = [
  [/(kilid|maymuncuk|cebinden|cebini|yankesic|el cabuklug)/, "sleight_of_hand"],
  [/(tirman|zipla|atla|yuz|it(er|iyorum)|kaldir|kir(ar|iyorum)|zorla)/, "athletics"],
  [/(denge|takla|kayarak)/, "acrobatics"],
  [/(iz sur|izleri|avlan|yol bul)/, "survival"],
  [/(arastir|incele(r|yorum)? .*(iz|ipuc|kapi|duvar|sandik)|ipucu)/, "investigation"],
  [/(hatirla.*(tarih|efsane)|tarih)/, "history"],
  [/(buyu(yu)? tani|gizem|runler)/, "arcana"],
  [/(yarasini sar|tedavi|teshis)/, "medicine"],
  [/(yalan mi|niyetini|sezgi|guvenebilir)/, "insight"],
  [/(hayvani sakinlestir|ati|evcil)/, "animal_handling"],
  [/(dua|tanri|kutsal)/, "religion"],
  [/(bitki|dogay|mantar)/, "nature"],
  [/(dinle|kulak ver|etrafi tara|gozcu)/, "perception"],
];

const ABILITY_WORDS: [RegExp, string][] = [
  [/ikinci soluk/, "second_wind"],
  [/eylem atilim/, "action_surge"],
  [/(ofkelen|ofke)/, "rage"],
  [/sifa el/, "lay_on_hands"],
  [/(ilham ver|ozan ilham)/, "bardic_inspiration"],
  [/(darbe yagmur|yumruk yagmur)/, "flurry_of_blows"],
  [/(nefes|ates puskurt)/, "breath_weapon"],
];

export function ruleIntent(text: string, scene: RuleScene): RuleIntent | null {
  const t = fold(text);
  if (!t) return null;
  const me = scene.playerId;
  const living = scene.entities.filter((e) => e.alive && e.id !== me);
  const corpses = scene.entities.filter((e) => !e.alive);
  const summary = text.trim().slice(0, 120);
  const act = (action: GameAction, confidence: "high" | "low" = "high"): RuleIntent => ({ kind: "action", action, summary, confidence });
  const ask = (question: string): RuleIntent => ({ kind: "clarify", question, summary, confidence: "high" });
  const target = matchName(t, living);

  // ---- Savaş yönetimi
  if (has(t, "turu bitir", "tur bitir", "pas gec", "bekliyorum") && scene.inCombat) return act({ type: "end_turn", actorId: me });
  if (has(t, "olum kurtarma", "olum zari")) return act({ type: "death_save", actorId: me });

  // ---- Sınıf yetenekleri
  for (const [re, key] of ABILITY_WORDS) {
    if (re.test(t) && scene.abilities.includes(key)) {
      const ab = key as Extract<GameAction, { type: "class_ability" }>["ability"];
      return act({ type: "class_ability", actorId: me, ability: ab, ...(target ? { targetId: target.id } : {}), ...(ab === "breath_weapon" ? { targetIds: living.filter((e) => e.hostile).slice(0, 4).map((e) => e.id) } : {}) });
    }
  }
  if (/kurnaz eylem/.test(t) && scene.abilities.includes("cunning_action")) {
    const mode = has(t, "geri cekil", "kac") ? "disengage" : has(t, "saklan", "gizlen") ? "hide" : "dash";
    return act({ type: "class_ability", actorId: me, ability: "cunning_action", mode });
  }

  // ---- Büyü
  const spell = matchName(t, scene.spells);
  if (spell && (has(t, "buyu", "yap", "at", "kullan", "oku", "cagir", "firlat") || t.split(" ").length <= 4)) {
    const lvl = /(\d)\s*\.?\s*(seviye|sv)/.exec(t);
    const slot = spell.level === 0 ? 0 : Math.max(spell.level, lvl ? Number(lvl[1]) : spell.level);
    const targets = spell.heal ? [target?.id ?? me] : target ? [target.id] : living.filter((e) => e.hostile).slice(0, 1).map((e) => e.id);
    if (!targets.length) return ask(`${spell.name} büyüsünü kime yapmak istiyorsun?`);
    return act({ type: "cast_spell", actorId: me, spellKey: spell.key, slotLevel: slot, targetIds: targets });
  }

  // ---- Saldırı
  if (has(t, "saldir", "vur", "kesiyor", "keserim", "bicakla", "oldur", "ates et", "ok at", "nisan al", "hucum", "gebert", "dov")) {
    const tg = target ?? (living.filter((e) => e.hostile).length === 1 ? living.find((e) => e.hostile) : undefined);
    if (!tg) return ask("Kime saldırıyorsun?");
    const weapons = scene.inventory.filter((i) => i.type === "weapon");
    const named = matchName(t, weapons);
    const ranged = has(t, "ok", "yay", "arbalet", "nisan", "ates et");
    const weapon = named ?? (ranged ? weapons.find((w) => /bow|crossbow|sling|dart/.test(w.key)) : undefined)
      ?? weapons.find((w) => w.equipped) ?? weapons[0];
    const smite = scene.classKey === "paladin" && has(t, "kutsal darbe", "smite") ? { smiteSlot: Math.max(1, Number(/(\d)\s*\.?\s*(seviye|sv)/.exec(t)?.[1] ?? 1)) } : {};
    return act({ type: "attack", actorId: me, targetId: tg.id, weaponKey: weapon?.key ?? "unarmed", ...(has(t, "firlat") ? { thrown: true } : {}), ...smite });
  }
  if (has(t, "savasa gir", "savasi baslat", "saldiriya gec") ) {
    const foes = living.filter((e) => e.hostile).map((e) => e.id);
    if (!foes.length && !target) return ask("Kiminle savaşmak istiyorsun?");
    return act({ type: "start_combat", actorId: me, participantIds: target ? [target.id] : foes });
  }

  // ---- Ganimet
  if (has(t, "yagmala", "cesedi ara", "cesetleri ara", "ustunu ara", "ganimet", "ceplerini ara", "ustunu yokla")) {
    const c = matchName(t, corpses) ?? corpses.find((x) => x.kind !== "pc");
    if (!c) return ask("Aranacak bir ceset göremiyorum. Kimi arıyorsun?");
    return act({ type: "loot", actorId: me, targetId: c.id });
  }

  // ---- Alışveriş
  if (has(t, "satin al", "almak istiyorum", "alayim", "al ", "satin")) {
    const merchant = (target?.merchant ? target : undefined) ?? living.find((e) => e.merchant);
    if (merchant) {
      const stock = scene.shopItems[merchant.id] ?? [];
      const item = matchName(t, stock);
      if (!item) return ask(`${merchant.name}'dan ne almak istiyorsun? (${stock.map((s) => s.name).slice(0, 6).join(", ")})`);
      return act({ type: "buy", actorId: me, merchantId: merchant.id, itemKey: item.key, qty: number(t) ?? 1, ...(has(t, "pazarlik", "indirim") ? { haggle: true } : {}) });
    }
  }
  if (has(t, "sat")) {
    const merchant = (target?.merchant ? target : undefined) ?? living.find((e) => e.merchant);
    const item = matchName(t, scene.inventory);
    if (merchant && item) return act({ type: "sell", actorId: me, merchantId: merchant.id, itemKey: item.key, qty: number(t) ?? 1, ...(has(t, "pazarlik") ? { haggle: true } : {}) });
  }

  // ---- Sosyal
  if (has(t, "rusvet")) {
    if (!target) return ask("Kime rüşvet vermek istiyorsun?");
    const gp = number(t) ?? 5;
    return act({ type: "social", actorId: me, targetId: target.id, approach: "bribe", risk: "significant", bribeCp: gp * 100 });
  }
  if (has(t, "ikna", "inandir", "rica", "yalvar", "kandir", "yalan", "aldat", "tehdit", "gozdagi", "korkut", "sarki", "calgi", "performans", "eglendir")) {
    if (!target) return ask("Kiminle konuşuyorsun?");
    const approach = has(t, "kandir", "yalan", "aldat") ? "deceive" : has(t, "tehdit", "gozdagi", "korkut") ? "intimidate"
      : has(t, "sarki", "calgi", "performans", "eglendir") ? "perform" : "persuade";
    return act({ type: "social", actorId: me, targetId: target.id, approach, risk: has(t, "gecmek", "izin", "sir", "yardim") ? "significant" : "minor" });
  }

  // ---- Görev
  if (has(t, "gorev") && has(t, "kabul", "ustlen", "alirim", "yaparim", "tamam")) {
    const q = matchName(t, scene.quests.filter((x) => x.status === "available").map((x) => ({ ...x, name: x.title })))
      ?? scene.quests.find((x) => x.status === "available");
    if (!q) return ask("Şu an alınabilecek bir görev görünmüyor.");
    return act({ type: "accept_quest", actorId: me, questId: q.id });
  }

  // ---- Eşyalar
  if (has(t, "iksir")) {
    const potion = matchName(t, scene.inventory.filter((i) => i.type === "potion")) ?? scene.inventory.find((i) => i.type === "potion");
    if (potion) return act({ type: "use_item", actorId: me, itemKey: potion.key, ...(target ? { targetId: target.id } : {}) });
  }
  if (has(t, "parsomen")) {
    const scroll = matchName(t, scene.inventory.filter((i) => i.type === "scroll")) ?? scene.inventory.find((i) => i.type === "scroll");
    if (scroll) return act({ type: "use_item", actorId: me, itemKey: scroll.key, ...(target ? { targetId: target.id, targetIds: [target.id] } : {}) });
  }
  if (has(t, "kusan", "giy", "takiyor", "takar", "eline al")) {
    const item = matchName(t, scene.inventory.filter((i) => i.type === "armor" || i.type === "weapon"));
    if (!item) return ask("Neyi kuşanmak istiyorsun?");
    return act({ type: "equip", actorId: me, itemKey: item.key, equipped: true });
  }
  if (has(t, "cikar") && !has(t, "cikis")) {
    const item = matchName(t, scene.inventory.filter((i) => i.equipped));
    if (item) return act({ type: "equip", actorId: me, itemKey: item.key, equipped: false });
  }
  if (has(t, "ver") && target) {
    const item = matchName(t, scene.inventory);
    if (item) return act({ type: "give_item", actorId: me, targetId: target.id, itemKey: item.key, qty: number(t) ?? 1 });
  }

  // ---- Hareket
  const exit = matchName(t, scene.exits);
  if (exit && (has(t, "git", "gid", "yuru", "ilerle", "don", "gec", "gir", "cik", "yonel", "yola") || t.split(" ").length <= 3)) {
    return act({ type: "move", actorId: me, toLocationId: exit.id, minutes: exit.minutes });
  }
  if (has(t, "git", "gidiyorum", "yuru") && !exit) return ask(`Nereye? (${scene.exits.map((e) => e.name).join(", ") || "çıkış yok"})`);

  // ---- Savaş eylemleri
  if (scene.inCombat) {
    if (has(t, "kacin", "savun", "korun")) return act({ type: "dodge", actorId: me });
    if (has(t, "geri cekil", "uzaklas", "kac")) return act({ type: "disengage", actorId: me });
    if (has(t, "kos")) return act({ type: "dash", actorId: me });
    if (has(t, "yardim") && target) return act({ type: "help", actorId: me, allyId: target.id });
  }

  // ---- Keşif ve dinlenme
  if (has(t, "saklan", "gizlen", "golgelere")) return act({ type: "hide", actorId: me });
  if (has(t, "uzun dinlen", "uyu", "kamp kur", "geceyi gecir")) return act({ type: "rest", actorId: me, kind: "long" });
  if (has(t, "dinlen", "soluklan", "nefeslen")) return act({ type: "rest", actorId: me, kind: "short", hitDice: {} });
  if (has(t, "stabilize", "yarasini sar") && target) return act({ type: "stabilize", actorId: me, targetId: target.id, useKit: scene.inventory.some((i) => i.key === "healers_kit") });
  for (const [re, skill] of SKILL_WORDS) {
    if (re.test(t)) {
      const difficulty = has(t, "kolay") ? "easy" : has(t, "zor") ? "hard" : "medium";
      return act({ type: "skill_check", actorId: me, skill, difficulty, ...(target ? { targetId: target.id } : {}) }, "low");
    }
  }
  if (has(t, "bak", "incele", "etrafa", "gozlemle", "nerede")) return act({ type: "look", actorId: me });
  if (has(t, "bekle")) return act({ type: "wait", actorId: me, minutes: Math.min(480, number(t) ?? 10) });
  if (has(t, "konus", "selam", "sor", "merhaba", "anlat", "soyle", "de ki")) {
    return act({ type: "talk", actorId: me, ...(target ? { targetId: target.id } : {}), minutes: 2 }, "low");
  }
  if (target) return act({ type: "talk", actorId: me, targetId: target.id, minutes: 2 }, "low");
  return null;
}
