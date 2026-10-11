/**
 * Zar notasyonu ayrıştırıcı.
 *
 * Desteklenen sözdizimi (büyük/küçük harf duyarsız, boşluklar serbest):
 *   sayılar              7, 12
 *   zar                  d20, 2d6, d%, 4dF (Fate: -1/0/+1)
 *   tut / at             4d6kh3, 2d20kl1, 4d6k3 (=kh), 5d10dl2, 5d10dh1
 *   patlayan             1d6!  (maks yüzde tekrar at)  1d10!>=9
 *   yeniden at           2d6r1 (1 geldikçe)  2d6ro<3 (bir kez)
 *   sınırla              1d20min10 (Güvenilir Yetenek), 1d8max6
 *   başarı say           10d6>=5  (zar havuzu: kaç zar 5+ geldi)
 *   aritmetik            + - * /  ve parantez: (1d8+3)*2, 2d6+1d4-1
 *
 * Bölme aşağı yuvarlar (SRD kuralı).
 */

export type CompareOp = ">" | ">=" | "<" | "<=" | "=";

export interface Compare {
  op: CompareOp;
  value: number;
}

export type DiceModifier =
  | { type: "keep"; which: "h" | "l"; n: number }
  | { type: "drop"; which: "h" | "l"; n: number }
  | { type: "explode"; cmp: Compare | null }
  | { type: "reroll"; once: boolean; cmp: Compare }
  | { type: "min"; n: number }
  | { type: "max"; n: number }
  | { type: "success"; cmp: Compare };

export type DiceSides = number | "F";

export type DiceNode =
  | { kind: "num"; value: number }
  | { kind: "dice"; count: number; sides: DiceSides; mods: DiceModifier[]; text: string }
  | { kind: "neg"; expr: DiceNode }
  | { kind: "group"; expr: DiceNode }
  | { kind: "bin"; op: "+" | "-" | "*" | "/"; left: DiceNode; right: DiceNode };

export class DiceSyntaxError extends Error {
  constructor(message: string, readonly notation: string, readonly position: number) {
    super(`${message} (konum ${position}: "${notation}")`);
    this.name = "DiceSyntaxError";
  }
}

export const LIMITS = {
  maxCount: 1000,
  maxSides: 10000,
  maxLength: 256,
} as const;

class Parser {
  private pos = 0;
  private readonly src: string;

  constructor(private readonly original: string) {
    this.src = original.toLowerCase().replace(/\s+/g, "");
  }

  parse(): DiceNode {
    if (this.original.length > LIMITS.maxLength) {
      throw new DiceSyntaxError("Notasyon çok uzun", this.original, 0);
    }
    if (this.src.length === 0) {
      throw new DiceSyntaxError("Boş notasyon", this.original, 0);
    }
    const node = this.expr();
    if (this.pos < this.src.length) {
      this.fail(`Beklenmeyen karakter '${this.src[this.pos]}'`);
    }
    return node;
  }

  private fail(msg: string): never {
    throw new DiceSyntaxError(msg, this.original, this.pos);
  }

  private peek(offset = 0): string | undefined {
    return this.src[this.pos + offset];
  }

  private eat(s: string): boolean {
    if (this.src.startsWith(s, this.pos)) {
      this.pos += s.length;
      return true;
    }
    return false;
  }

  private expr(): DiceNode {
    let left = this.term();
    for (;;) {
      const c = this.peek();
      if (c === "+" || c === "-") {
        this.pos++;
        left = { kind: "bin", op: c, left, right: this.term() };
      } else {
        return left;
      }
    }
  }

  private term(): DiceNode {
    let left = this.factor();
    for (;;) {
      const c = this.peek();
      if (c === "*" || c === "/") {
        this.pos++;
        left = { kind: "bin", op: c, left, right: this.factor() };
      } else {
        return left;
      }
    }
  }

  private factor(): DiceNode {
    const c = this.peek();
    if (c === "-") {
      this.pos++;
      return { kind: "neg", expr: this.factor() };
    }
    if (c === "+") {
      this.pos++;
      return this.factor();
    }
    if (c === "(") {
      this.pos++;
      const inner = this.expr();
      if (!this.eat(")")) this.fail("Kapanış parantezi bekleniyordu");
      return { kind: "group", expr: inner };
    }
    const start = this.pos;
    const num = this.integer();
    if (this.peek() === "d") {
      return this.dice(num ?? 1, start);
    }
    if (num === null) this.fail("Sayı veya zar bekleniyordu");
    return { kind: "num", value: num };
  }

  private integer(): number | null {
    const start = this.pos;
    while (this.pos < this.src.length && /[0-9]/.test(this.src[this.pos]!)) this.pos++;
    if (this.pos === start) return null;
    const v = Number(this.src.slice(start, this.pos));
    if (!Number.isSafeInteger(v)) this.fail("Sayı çok büyük");
    return v;
  }

  private requireInt(what: string): number {
    const v = this.integer();
    if (v === null) this.fail(`${what} için sayı bekleniyordu`);
    return v;
  }

  private dice(count: number, start: number): DiceNode {
    this.pos++; // 'd'
    let sides: DiceSides;
    if (this.eat("%")) sides = 100;
    else if (this.eat("f")) sides = "F";
    else sides = this.requireInt("Zar yüzü");

    if (count < 1 || count > LIMITS.maxCount) this.fail(`Zar sayısı 1–${LIMITS.maxCount} olmalı`);
    if (sides !== "F" && (sides < 1 || sides > LIMITS.maxSides)) {
      this.fail(`Zar yüzü 1–${LIMITS.maxSides} olmalı`);
    }

    const mods: DiceModifier[] = [];
    for (;;) {
      const m = this.modifier();
      if (!m) break;
      mods.push(m);
    }
    validateMods(mods, count, sides, (msg) => this.fail(msg));
    return { kind: "dice", count, sides, mods, text: this.src.slice(start, this.pos) };
  }

  private compare(defaultOp: CompareOp | null): Compare | null {
    let op: CompareOp | null = null;
    if (this.eat(">=")) op = ">=";
    else if (this.eat("<=")) op = "<=";
    else if (this.eat(">")) op = ">";
    else if (this.eat("<")) op = "<";
    else if (this.eat("=")) op = "=";
    if (op === null) {
      if (defaultOp === null) return null;
      const v = this.integer();
      return v === null ? null : { op: defaultOp, value: v };
    }
    return { op, value: this.requireInt("Karşılaştırma") };
  }

  private modifier(): DiceModifier | null {
    if (this.eat("kh")) return { type: "keep", which: "h", n: this.requireInt("kh") };
    if (this.eat("kl")) return { type: "keep", which: "l", n: this.requireInt("kl") };
    if (this.eat("dh")) return { type: "drop", which: "h", n: this.requireInt("dh") };
    if (this.eat("dl")) return { type: "drop", which: "l", n: this.requireInt("dl") };
    if (this.eat("min")) return { type: "min", n: this.requireInt("min") };
    if (this.eat("max")) return { type: "max", n: this.requireInt("max") };
    if (this.peek() === "k" && /[0-9]/.test(this.peek(1) ?? "")) {
      this.pos++;
      return { type: "keep", which: "h", n: this.requireInt("k") };
    }
    if (this.eat("!")) return { type: "explode", cmp: this.compare("=") };
    if (this.eat("ro")) {
      const cmp = this.compare("=");
      if (!cmp) this.fail("ro sonrası değer bekleniyordu");
      return { type: "reroll", once: true, cmp };
    }
    if (this.peek() === "r") {
      this.pos++;
      const cmp = this.compare("=");
      if (!cmp) this.fail("r sonrası değer bekleniyordu");
      return { type: "reroll", once: false, cmp };
    }
    const c = this.peek();
    if (c === ">" || c === "<" || c === "=") {
      const cmp = this.compare(null);
      if (!cmp) this.fail("Başarı eşiği bekleniyordu");
      return { type: "success", cmp };
    }
    return null;
  }
}

export function faces(sides: DiceSides): number[] {
  if (sides === "F") return [-1, 0, 1];
  return Array.from({ length: sides }, (_, i) => i + 1);
}

export function matches(value: number, cmp: Compare): boolean {
  switch (cmp.op) {
    case ">": return value > cmp.value;
    case ">=": return value >= cmp.value;
    case "<": return value < cmp.value;
    case "<=": return value <= cmp.value;
    case "=": return value === cmp.value;
  }
}

function validateMods(
  mods: DiceModifier[],
  count: number,
  sides: DiceSides,
  fail: (msg: string) => never,
): void {
  const all = faces(sides);
  const seen = new Set<string>();
  for (const m of mods) {
    const key = m.type === "keep" || m.type === "drop" ? "keepdrop" : m.type;
    if (seen.has(key)) fail(`'${m.type}' değiştiricisi bir kez kullanılabilir`);
    seen.add(key);
    switch (m.type) {
      case "keep":
      case "drop":
        if (m.n < 0 || m.n > count) fail(`Tut/at sayısı 0–${count} olmalı`);
        break;
      case "explode": {
        const cmp = m.cmp ?? { op: "=", value: Math.max(...all) };
        if (all.every((f) => matches(f, cmp))) fail("Her yüzde patlayan zar sonsuza gider");
        break;
      }
      case "reroll":
        if (all.every((f) => matches(f, m.cmp))) fail("Her yüzü yeniden atmak imkânsız");
        break;
      case "min":
      case "max":
        if (sides === "F") fail("Fate zarında min/max kullanılamaz");
        break;
      case "success":
        break;
    }
  }
}

export function parseDice(notation: string): DiceNode {
  return new Parser(notation).parse();
}
