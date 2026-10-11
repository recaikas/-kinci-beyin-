import { describe, expect, it } from "vitest";
import {
  CryptoRng,
  DiceSyntaxError,
  FixedRng,
  RecordingRng,
  SeededRng,
  fixedAverage,
  parseDice,
  roll,
  stats,
} from "../src/index.ts";

describe("parseDice", () => {
  it("temel ifadeleri ayrıştırır", () => {
    expect(parseDice("d20")).toMatchObject({ kind: "dice", count: 1, sides: 20 });
    expect(parseDice("2D6 + 3")).toMatchObject({ kind: "bin", op: "+" });
    expect(parseDice("d%")).toMatchObject({ sides: 100 });
    expect(parseDice("4dF")).toMatchObject({ sides: "F", count: 4 });
  });

  it("değiştiricileri ayrıştırır", () => {
    expect(parseDice("4d6kh3")).toMatchObject({ mods: [{ type: "keep", which: "h", n: 3 }] });
    expect(parseDice("4d6k3")).toMatchObject({ mods: [{ type: "keep", which: "h", n: 3 }] });
    expect(parseDice("2d20kl1")).toMatchObject({ mods: [{ type: "keep", which: "l", n: 1 }] });
    expect(parseDice("5d10dl2")).toMatchObject({ mods: [{ type: "drop", which: "l", n: 2 }] });
    expect(parseDice("1d6!")).toMatchObject({ mods: [{ type: "explode", cmp: null }] });
    expect(parseDice("1d10!>=9")).toMatchObject({ mods: [{ type: "explode", cmp: { op: ">=", value: 9 } }] });
    expect(parseDice("2d6r1")).toMatchObject({ mods: [{ type: "reroll", once: false, cmp: { op: "=", value: 1 } }] });
    expect(parseDice("2d6ro<3")).toMatchObject({ mods: [{ type: "reroll", once: true, cmp: { op: "<", value: 3 } }] });
    expect(parseDice("1d20min10")).toMatchObject({ mods: [{ type: "min", n: 10 }] });
    expect(parseDice("10d6>=5")).toMatchObject({ mods: [{ type: "success", cmp: { op: ">=", value: 5 } }] });
  });

  it("hatalı notasyonu reddeder", () => {
    for (const bad of ["", "d", "2d", "1d6+", "(1d6", "1d6)", "0d6", "1d0", "1001d6", "1d6!>=1", "1d6r<7", "2d6kh3", "abc", "1d6kh1kl1"]) {
      expect(() => parseDice(bad), bad).toThrow(DiceSyntaxError);
    }
  });
});

describe("roll", () => {
  it("sabit RNG ile toplar", () => {
    const r = roll("2d6+3", new FixedRng([4, 5]));
    expect(r.total).toBe(12);
    expect(r.breakdown).toBe("2d6 [4, 5] + 3 = 12");
  });

  it("kh3 en düşüğü atar", () => {
    const r = roll("4d6kh3", new FixedRng([6, 2, 5, 3]));
    expect(r.total).toBe(14);
    expect(r.groups[0]!.dice.map((d) => d.kept)).toEqual([true, false, true, true]);
    expect(r.breakdown).toContain("(2)");
  });

  it("avantaj ve dezavantaj", () => {
    expect(roll("2d20kh1", new FixedRng([7, 15])).total).toBe(15);
    expect(roll("2d20kl1", new FixedRng([7, 15])).total).toBe(7);
  });

  it("eşit değerlerde tut/at deterministiktir", () => {
    const r = roll("3d6kh2", new FixedRng([4, 4, 4]));
    expect(r.total).toBe(8);
    expect(r.groups[0]!.dice.filter((d) => !d.kept)).toHaveLength(1);
  });

  it("dl ve dh", () => {
    expect(roll("4d6dl1", new FixedRng([1, 6, 6, 6])).total).toBe(18);
    expect(roll("4d6dh1", new FixedRng([1, 6, 2, 3])).total).toBe(6);
  });

  it("patlayan zar zinciri", () => {
    const r = roll("1d6!", new FixedRng([6, 6, 2]));
    expect(r.total).toBe(14);
    expect(r.groups[0]!.dice.map((d) => d.exploded)).toEqual([false, true, true]);
  });

  it("yeniden atma (sürekli ve bir kez)", () => {
    expect(roll("1d6r1", new FixedRng([1, 1, 4])).total).toBe(4);
    const once = roll("1d6ro1", new FixedRng([1, 1]));
    expect(once.total).toBe(1);
    expect(once.groups[0]!.dice[0]!.rerolled).toEqual([1]);
  });

  it("Great Weapon Fighting: 2d6ro<3", () => {
    const r = roll("2d6ro<3", new FixedRng([2, 1, 6]));
    expect(r.total).toBe(1 + 6); // 2→1 (bir kez, kalır), 6
  });

  it("min / max sınırı", () => {
    expect(roll("1d20min10", new FixedRng([3])).total).toBe(10);
    expect(roll("1d8max6", new FixedRng([8])).total).toBe(6);
  });

  it("başarı sayan zar havuzu", () => {
    const r = roll("6d6>=5", new FixedRng([1, 5, 6, 4, 5, 2]));
    expect(r.total).toBe(3);
    expect(r.groups[0]!.successMode).toBe(true);
  });

  it("Fate zarları -1..+1", () => {
    const r = roll("4dF", new FixedRng([1, 2, 3, 3]));
    expect(r.total).toBe(-1 + 0 + 1 + 1);
  });

  it("aritmetik öncelik ve parantez, aşağı yuvarlayan bölme", () => {
    expect(roll("2+3*4", new FixedRng([])).total).toBe(14);
    expect(roll("(2+3)*4", new FixedRng([])).total).toBe(20);
    expect(roll("7/2", new FixedRng([])).total).toBe(3);
    expect(roll("-1d4", new FixedRng([3])).total).toBe(-3);
    expect(roll("1d8+1d6-2", new FixedRng([8, 6])).total).toBe(12);
  });

  it("tohumlu RNG tekrarlanabilir", () => {
    const a = roll("10d20", new SeededRng("kampanya-1:tur-5"));
    const b = roll("10d20", new SeededRng("kampanya-1:tur-5"));
    const c = roll("10d20", new SeededRng("kampanya-1:tur-6"));
    expect(a.total).toBe(b.total);
    expect(a.groups[0]!.dice).toEqual(b.groups[0]!.dice);
    expect(a.groups[0]!.dice).not.toEqual(c.groups[0]!.dice);
  });

  it("RNG dağılımı makul ve aralık içinde (kripto + tohumlu)", () => {
    for (const rng of [new CryptoRng(), new SeededRng("dagilim")]) {
      const counts = new Array(20).fill(0);
      const N = 40000;
      for (let i = 0; i < N; i++) {
        const v = roll("d20", rng).total;
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(20);
        counts[v - 1]++;
      }
      // Her yüz beklenen 2000'in ±%15'i içinde olmalı.
      for (const c of counts) {
        expect(c).toBeGreaterThan(1700);
        expect(c).toBeLessThan(2300);
      }
    }
  });

  it("RecordingRng çekilişleri kaydeder", () => {
    const rec = new RecordingRng(new FixedRng([3, 4]));
    roll("2d6", rec);
    expect(rec.draws).toEqual([{ sides: 6, face: 3 }, { sides: 6, face: 4 }]);
  });
});

describe("stats", () => {
  it("ortalama / min / maks", () => {
    expect(stats("2d6+3")).toEqual({ min: 5, max: 15, average: 10 });
    expect(stats("1d8-1d4")).toEqual({ min: -3, max: 7, average: 2 });
    expect(fixedAverage("2d6")).toBe(7);
    expect(fixedAverage("1d10")).toBe(5);
  });
});
