/**
 * Rastgele sayı kaynakları.
 *
 * Oyundaki her zar sunucuda bir Rng üzerinden atılır. Üretimde CryptoRng,
 * testlerde ve "tekrar oynatma" (replay) için SeededRng kullanılır.
 */
export interface Rng {
  /** [0, maxExclusive) aralığında tam sayı döndürür. */
  int(maxExclusive: number): number;
}

const UINT32_RANGE = 0x1_0000_0000;

/** Modulo yanlılığı olmadan [0, max) aralığına indirger. */
function unbiased(next: () => number, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
    throw new RangeError(`Geçersiz aralık: ${maxExclusive}`);
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  for (;;) {
    const x = next();
    if (x < limit) return x % maxExclusive;
  }
}

/** Kriptografik RNG — üretim ortamı. Node 22+ ve Deno'da global `crypto` vardır. */
export class CryptoRng implements Rng {
  private readonly buf = new Uint32Array(64);
  private idx = 64;

  int(maxExclusive: number): number {
    return unbiased(() => this.nextUint32(), maxExclusive);
  }

  private nextUint32(): number {
    if (this.idx >= this.buf.length) {
      crypto.getRandomValues(this.buf);
      this.idx = 0;
    }
    return this.buf[this.idx++]!;
  }
}

/** cyrb128: string tohumu 4×32 bit duruma çevirir. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * Tohumlu RNG (xoshiro128**). Aynı tohum → aynı zar dizisi.
 * Kampanya tohumu + tur numarası ile her tur tekrar üretilebilir.
 */
export class SeededRng implements Rng {
  private s: [number, number, number, number];

  constructor(seed: string) {
    this.s = cyrb128(seed);
    if (this.s.every((v) => v === 0)) this.s = [1, 2, 3, 4];
  }

  int(maxExclusive: number): number {
    return unbiased(() => this.nextUint32(), maxExclusive);
  }

  private nextUint32(): number {
    const s = this.s;
    const result = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
    const t = s[1] << 9;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return result;
  }
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

/** Testler için: verilen değerleri sırayla döndürür (zar yüzü olarak, 1 tabanlı). */
export class FixedRng implements Rng {
  private i = 0;
  constructor(private readonly faces: readonly number[]) {}

  int(maxExclusive: number): number {
    if (this.i >= this.faces.length) {
      throw new Error("FixedRng: değer kalmadı");
    }
    const face = this.faces[this.i++]!;
    if (face < 1 || face > maxExclusive) {
      throw new RangeError(`FixedRng: ${face} değeri d${maxExclusive} için geçersiz`);
    }
    return face - 1;
  }

  get remaining(): number {
    return this.faces.length - this.i;
  }
}

/** Tek zar at: 1..sides. */
export function rollDie(rng: Rng, sides: number): number {
  return rng.int(sides) + 1;
}
