import { type Rng, type RollResult, roll as rollNotation, rollDie } from "@kader/dice";
import { DEFAULT_RULES, type RuleOptions } from "./rules.ts";
import type { ResultTier } from "./types.ts";

export type RollMode = "normal" | "advantage" | "disadvantage";

/** Veritabanındaki `rolls` tablosunun bir satırı. */
export interface RollRecord {
  reason: string;
  notation: string;
  dice: number[];
  total: number;
  natural?: number;
  mode?: RollMode;
  actorId?: string;
  targetId?: string;
  dc?: number;
  tier?: ResultTier;
  breakdown: string;
}

/**
 * Motorun tüm rastgelelik ve kayıt ihtiyacı bu bağlamdan geçer.
 * Böylece bir turdaki her zar loglanır ve tohumla yeniden üretilebilir.
 */
export class EngineContext {
  readonly rolls: RollRecord[] = [];

  constructor(
    readonly rng: Rng,
    readonly rules: RuleOptions = DEFAULT_RULES,
  ) {}

  /** Serbest notasyon at ve kaydet. */
  roll(notation: string, reason: string, meta: Partial<RollRecord> = {}): RollResult {
    const r = rollNotation(notation, this.rng);
    this.rolls.push({
      reason,
      notation,
      dice: r.groups.flatMap((g) => g.dice.filter((d) => d.kept).map((d) => d.value)),
      total: r.total,
      breakdown: r.breakdown,
      ...meta,
    });
    return r;
  }

  /** Tek ham zar (kayıt yapmaz — çağıran kaydeder). */
  die(sides: number): number {
    return rollDie(this.rng, sides);
  }

  record(rec: RollRecord): void {
    this.rolls.push(rec);
  }
}

export interface D20Options {
  modifier: number;
  advantage?: boolean;
  disadvantage?: boolean;
  /** d20'nin en az sayılacağı değer (Reliable Talent: 10). */
  minimum?: number;
  /** Halfling Lucky: doğal 1 bir kez yeniden atılır. */
  lucky?: boolean;
  /** Ek zarlar: Bless "1d4", Guidance "1d4", Bane "-1d4". */
  bonusDice?: string[];
  reason: string;
  actorId?: string;
  targetId?: string;
  dc?: number;
}

export interface D20Result {
  /** Seçilen zarın ham değeri (kritik tespiti için). */
  natural: number;
  /** Atılan tüm d20'ler (avantajda 2). */
  rolls: number[];
  mode: RollMode;
  modifier: number;
  bonus: number;
  total: number;
  record: RollRecord;
}

/** Avantaj ve dezavantaj birbirini iptal eder; yığılmaz (SRD). */
export function resolveMode(advantage?: boolean, disadvantage?: boolean): RollMode {
  if (advantage && !disadvantage) return "advantage";
  if (disadvantage && !advantage) return "disadvantage";
  return "normal";
}

export function d20Test(ctx: EngineContext, o: D20Options): D20Result {
  const mode = resolveMode(o.advantage, o.disadvantage);
  const count = mode === "normal" ? 1 : 2;
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    let v = ctx.die(20);
    if (o.lucky && v === 1) v = ctx.die(20);
    rolls.push(v);
  }
  const natural = mode === "advantage" ? Math.max(...rolls)
    : mode === "disadvantage" ? Math.min(...rolls)
    : rolls[0]!;
  const effective = o.minimum ? Math.max(natural, o.minimum) : natural;

  let bonus = 0;
  const bonusText: string[] = [];
  for (const b of o.bonusDice ?? []) {
    const r = rollNotation(b, ctx.rng);
    bonus += r.total;
    bonusText.push(r.breakdown);
  }
  const total = effective + o.modifier + bonus;

  const modeText = mode === "normal" ? "" : mode === "advantage" ? " (avantaj)" : " (dezavantaj)";
  const sign = o.modifier >= 0 ? "+" : "-";
  const record: RollRecord = {
    reason: o.reason,
    notation: `${count === 1 ? "1d20" : mode === "advantage" ? "2d20kh1" : "2d20kl1"}${sign}${Math.abs(o.modifier)}`,
    dice: rolls,
    natural,
    total,
    mode,
    breakdown: `d20[${rolls.join(", ")}]${modeText}${effective !== natural ? ` →min ${effective}` : ""} ${sign} ${Math.abs(o.modifier)}${bonusText.length ? ` + ${bonusText.join(" + ")}` : ""} = ${total}`,
    ...(o.actorId !== undefined && { actorId: o.actorId }),
    ...(o.targetId !== undefined && { targetId: o.targetId }),
    ...(o.dc !== undefined && { dc: o.dc }),
  };
  ctx.record(record);
  return { natural, rolls, mode, modifier: o.modifier, bonus, total, record };
}
