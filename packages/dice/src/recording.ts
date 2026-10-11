import type { Rng } from "./rng.ts";

export interface RecordedDraw {
  sides: number;
  face: number;
}

/**
 * Bir RNG'yi sarar ve her çekilişi kaydeder. Tur sonunda `draws`
 * veritabanındaki `rolls` tablosuna denetim kaydı olarak yazılır.
 */
export class RecordingRng implements Rng {
  readonly draws: RecordedDraw[] = [];

  constructor(private readonly inner: Rng) {}

  int(maxExclusive: number): number {
    const v = this.inner.int(maxExclusive);
    this.draws.push({ sides: maxExclusive, face: v + 1 });
    return v;
  }
}
