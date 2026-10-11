import { type Rng, rollDie } from "./rng.ts";
import {
  type Compare,
  type DiceModifier,
  type DiceNode,
  type DiceSides,
  faces,
  matches,
  parseDice,
} from "./notation.ts";

export interface DieResult {
  /** Son (geçerli) değer — min/max uygulanmış hâli. */
  value: number;
  /** Sonuca dahil mi (kh/kl/dh/dl ile atılmadıysa true). */
  kept: boolean;
  /** Bu zar bir patlamadan doğduysa true. */
  exploded: boolean;
  /** Yeniden atma ile çöpe giden eski değerler. */
  rerolled: number[];
  /** Başarı sayımında eşiği geçtiyse true. */
  success?: boolean;
}

export interface DiceGroupResult {
  text: string;
  count: number;
  sides: DiceSides;
  dice: DieResult[];
  /** Toplam (başarı modunda: başarı sayısı). */
  total: number;
  successMode: boolean;
}

export interface RollResult {
  notation: string;
  total: number;
  groups: DiceGroupResult[];
  /** İnsan okunur döküm: "4d6kh3 [6, 5, 3, (2)] = 14" */
  breakdown: string;
}

const MAX_CHAIN = 100;

export class DiceEvalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiceEvalError";
  }
}

function rollFace(rng: Rng, sides: DiceSides): number {
  if (sides === "F") return rollDie(rng, 3) - 2;
  return rollDie(rng, sides);
}

function find<T extends DiceModifier["type"]>(
  mods: DiceModifier[],
  type: T,
): Extract<DiceModifier, { type: T }> | undefined {
  return mods.find((m) => m.type === type) as Extract<DiceModifier, { type: T }> | undefined;
}

function rollGroup(
  node: Extract<DiceNode, { kind: "dice" }>,
  rng: Rng,
): DiceGroupResult {
  const { count, sides, mods } = node;
  const reroll = find(mods, "reroll");
  const explode = find(mods, "explode");
  const min = find(mods, "min");
  const max = find(mods, "max");
  const keep = find(mods, "keep");
  const drop = find(mods, "drop");
  const success = find(mods, "success");

  const explodeCmp: Compare | null = explode
    ? explode.cmp ?? { op: "=", value: Math.max(...faces(sides)) }
    : null;

  const clamp = (v: number): number => {
    let out = v;
    if (min && out < min.n) out = min.n;
    if (max && out > max.n) out = max.n;
    return out;
  };

  const dice: DieResult[] = [];
  const rollOne = (isExplosion: boolean): number => {
    let raw = rollFace(rng, sides);
    const rerolled: number[] = [];
    if (reroll && !isExplosion) {
      let guard = 0;
      while (matches(raw, reroll.cmp) && guard < MAX_CHAIN) {
        rerolled.push(raw);
        raw = rollFace(rng, sides);
        guard++;
        if (reroll.once) break;
      }
    }
    dice.push({ value: clamp(raw), kept: true, exploded: isExplosion, rerolled });
    return raw;
  };

  for (let i = 0; i < count; i++) {
    let raw = rollOne(false);
    if (explodeCmp) {
      let chain = 0;
      while (matches(raw, explodeCmp)) {
        if (++chain > MAX_CHAIN) throw new DiceEvalError("Patlama zinciri sınırı aşıldı");
        raw = rollOne(true);
      }
    }
  }

  // Tut / at: değere göre sırala, sabit sıralama için indeksi kullan.
  if (keep || drop) {
    const order = dice
      .map((d, i) => ({ v: d.value, i }))
      .sort((a, b) => a.v - b.v || a.i - b.i);
    let dropIdx: number[] = [];
    const n = dice.length;
    if (keep) {
      const k = Math.min(keep.n, n);
      dropIdx = keep.which === "h"
        ? order.slice(0, n - k).map((o) => o.i)
        : order.slice(k).map((o) => o.i);
    } else if (drop) {
      const k = Math.min(drop.n, n);
      dropIdx = drop.which === "l"
        ? order.slice(0, k).map((o) => o.i)
        : order.slice(n - k).map((o) => o.i);
    }
    for (const i of dropIdx) dice[i]!.kept = false;
  }

  let total = 0;
  for (const d of dice) {
    if (!d.kept) continue;
    if (success) {
      d.success = matches(d.value, success.cmp);
      if (d.success) total++;
    } else {
      total += d.value;
    }
  }

  return { text: node.text, count, sides, dice, total, successMode: !!success };
}

function formatGroup(g: DiceGroupResult): string {
  const parts = g.dice.map((d) => {
    let s = String(d.value);
    if (d.exploded) s += "!";
    if (d.rerolled.length) s = `${d.rerolled.map((r) => `~${r}~`).join(" ")} ${s}`;
    if (g.successMode && d.kept) s += d.success ? "✓" : "✗";
    return d.kept ? s : `(${s})`;
  });
  return `${g.text} [${parts.join(", ")}]`;
}

function evalNode(node: DiceNode, rng: Rng, groups: DiceGroupResult[]): { value: number; text: string } {
  switch (node.kind) {
    case "num":
      return { value: node.value, text: String(node.value) };
    case "dice": {
      const g = rollGroup(node, rng);
      groups.push(g);
      return { value: g.total, text: formatGroup(g) };
    }
    case "neg": {
      const r = evalNode(node.expr, rng, groups);
      return { value: -r.value, text: `-${r.text}` };
    }
    case "group": {
      const r = evalNode(node.expr, rng, groups);
      return { value: r.value, text: `(${r.text})` };
    }
    case "bin": {
      const l = evalNode(node.left, rng, groups);
      const r = evalNode(node.right, rng, groups);
      let value: number;
      switch (node.op) {
        case "+": value = l.value + r.value; break;
        case "-": value = l.value - r.value; break;
        case "*": value = l.value * r.value; break;
        case "/":
          if (r.value === 0) throw new DiceEvalError("Sıfıra bölme");
          value = Math.floor(l.value / r.value);
          break;
      }
      return { value, text: `${l.text} ${node.op} ${r.text}` };
    }
  }
}

/** Ayrıştırılmış ifadeyi atar. */
export function evaluate(node: DiceNode, rng: Rng, notation = ""): RollResult {
  const groups: DiceGroupResult[] = [];
  const { value, text } = evalNode(node, rng, groups);
  return { notation, total: value, groups, breakdown: `${text} = ${value}` };
}

/** Notasyonu ayrıştırıp atar: roll("4d6kh3", rng). */
export function roll(notation: string, rng: Rng): RollResult {
  return evaluate(parseDice(notation), rng, notation);
}

export interface DiceStats {
  min: number;
  max: number;
  average: number;
}

/**
 * Basit ifadeler için (değiştiricisiz zar + sabitler, + ve -) min/maks/ortalama.
 * SRD canavar blokları "7 (2d6)" gibi sabit ortalama hasar kullanır.
 */
export function stats(notation: string): DiceStats {
  const walk = (n: DiceNode, sign: 1 | -1): DiceStats => {
    switch (n.kind) {
      case "num": {
        const v = sign * n.value;
        return { min: v, max: v, average: v };
      }
      case "dice": {
        if (n.mods.length) throw new DiceEvalError("stats(): değiştiricili zar desteklenmez");
        const f = faces(n.sides);
        const lo = n.count * Math.min(...f);
        const hi = n.count * Math.max(...f);
        const avg = (n.count * f.reduce((a, b) => a + b, 0)) / f.length;
        return sign === 1
          ? { min: lo, max: hi, average: avg }
          : { min: -hi, max: -lo, average: -avg };
      }
      case "neg":
        return walk(n.expr, sign === 1 ? -1 : 1);
      case "group":
        return walk(n.expr, sign);
      case "bin": {
        if (n.op !== "+" && n.op !== "-") {
          throw new DiceEvalError("stats(): yalnızca + ve - desteklenir");
        }
        const l = walk(n.left, sign);
        const r = walk(n.right, n.op === "+" ? sign : (sign === 1 ? -1 : 1));
        return { min: l.min + r.min, max: l.max + r.max, average: l.average + r.average };
      }
    }
  };
  return walk(parseDice(notation), 1);
}

/** SRD tarzı sabit ortalama: aşağı yuvarlanmış ortalama. "2d6+3" → 10 */
export function fixedAverage(notation: string): number {
  return Math.floor(stats(notation).average);
}
