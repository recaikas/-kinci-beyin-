/**
 * Anlatıcı (Claude Haiku 5.5) + Doğrulayıcı.
 *
 * Anlatıcı motorun sonucunu betimler. Doğrulayıcı çıktıyı kodla denetler:
 * sayı uydurma, ölüleri konuşturma, sahnede olmayanlara replik, kilitli gerçek
 * çiğneme. Ciddi ihlalde bir kez yeniden üretilir; yine olmazsa şablon anlatıya
 * düşülür. Oyun hiçbir koşulda AI yüzünden durmaz.
 */
import * as z from "zod/v4";
import type { GameState, Outcome } from "@kader/engine";
import { type StructuredCaller, type Usage, LlmError } from "./caller.ts";
import { NARRATOR_SYSTEM } from "./prompts.ts";
import type { CanonFact, WorldBible } from "./packet.ts";

export const NarrationSchema = z.object({
  narration: z.string(),
  npc_dialogue: z.array(z.object({ speaker_id: z.string(), line: z.string() })),
  suggested_hooks: z.array(z.object({
    type: z.enum(["rumor", "quest", "complication", "discovery"]),
    text: z.string(),
  })),
  new_fact_candidates: z.array(z.object({
    subject_id: z.string(),
    predicate: z.string(),
    value: z.string(),
  })),
  mood: z.enum(["calm", "tense", "triumphant", "grim", "mysterious", "humorous", "tragic"]),
});
export type Narration = z.infer<typeof NarrationSchema>;

/** Yumuşak gerçeklerin asla dokunamayacağı mekanik yüklemler. */
const HARD_PREDICATES = /\b(hp|can|sağlık|altın|gümüş|bakır|para|gold|seviye|level|xp|ölü|dead|alive|hayatta|envanter|inventory|sahip|owns|ac|zırh sınıfı|büyü yuvası|slot)\b/i;

export interface ValidationIssue {
  severity: "error" | "warning";
  code: "number_not_in_facts" | "dead_speaker" | "speaker_not_in_scene" | "hard_fact" | "locked_conflict" | "empty";
  detail: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  sanitized: Narration;
}

/** Sayıları anahtar sözcüklere yakın geçenleri çıkar ("12 HP", "20 altın"). */
function mechanicalNumbers(text: string): number[] {
  const re = /(\d+)\s*(hp|can puanı|altın|gümüş|bakır|gp|sp|cp|hasar)/gi;
  const out: number[] = [];
  for (const m of text.matchAll(re)) out.push(Number(m[1]));
  return out;
}

export function validateNarration(
  n: Narration,
  ctx: { outcome: Outcome; state: GameState; sceneIds: string[]; facts: CanonFact[] },
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!n.narration.trim()) issues.push({ severity: "error", code: "empty", detail: "Anlatı boş" });

  // 1) Mekanik sayılar yalnızca gerçeklerde geçiyorsa kullanılabilir.
  const allowed = new Set<number>();
  for (const f of ctx.outcome.facts) for (const m of f.matchAll(/\d+/g)) allowed.add(Number(m[0]));
  const fullText = [n.narration, ...n.npc_dialogue.map((d) => d.line)].join("\n");
  for (const v of mechanicalNumbers(fullText)) {
    if (!allowed.has(v)) issues.push({ severity: "error", code: "number_not_in_facts", detail: `Gerçeklerde olmayan sayı: ${v}` });
  }

  // 2) Konuşanlar sahnede, canlı ve bilinçli olmalı.
  const dialogue = n.npc_dialogue.filter((d) => {
    const c = ctx.state.creatures[d.speaker_id];
    if (!c || !ctx.sceneIds.includes(d.speaker_id)) {
      issues.push({ severity: "error", code: "speaker_not_in_scene", detail: `Sahnede olmayan konuşmacı: ${d.speaker_id}` });
      return false;
    }
    if (!c.isAlive || c.hp <= 0) {
      issues.push({ severity: "error", code: "dead_speaker", detail: `${c.name} konuşamaz (ölü/baygın)` });
      return false;
    }
    return true;
  });

  // 3) Gerçek adayları: mekanik yüklem yok, kilitli gerçekle çelişki yok.
  const locked = new Map(ctx.facts.filter((f) => f.locked).map((f) => [`${f.subject}|${f.predicate.toLowerCase()}`, f.value]));
  const candidates = n.new_fact_candidates.filter((f) => {
    if (HARD_PREDICATES.test(f.predicate) || HARD_PREDICATES.test(f.value)) {
      issues.push({ severity: "warning", code: "hard_fact", detail: `Mekanik gerçek reddedildi: ${f.predicate}` });
      return false;
    }
    const lk = locked.get(`${f.subject_id}|${f.predicate.toLowerCase()}`);
    if (lk !== undefined && lk !== f.value) {
      issues.push({ severity: "warning", code: "locked_conflict", detail: `Kilitli gerçekle çelişki: ${f.subject_id} · ${f.predicate}` });
      return false;
    }
    return true;
  });

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
    sanitized: { ...n, npc_dialogue: dialogue, new_fact_candidates: candidates, suggested_hooks: n.suggested_hooks.slice(0, 3) },
  };
}

/** AI tamamen başarısız olursa oyunun akması için şablon anlatı. */
export function templateNarration(outcome: Outcome): Narration {
  const body = outcome.facts.length ? `\n\n${outcome.facts.map((f) => `• ${f}`).join("\n")}` : "";
  return {
    narration: `${outcome.headline}.${body}`,
    npc_dialogue: [],
    suggested_hooks: [],
    new_fact_candidates: [],
    mood: outcome.tier === "critical_failure" || outcome.tier === "failure" ? "tense" : "calm",
  };
}

export interface NarrateInput {
  caller: StructuredCaller;
  world: WorldBible;
  packet: string;
  outcome: Outcome;
  state: GameState;
  sceneIds: string[];
  facts: CanonFact[];
}

export interface NarrateResult {
  narration: Narration;
  source: "model" | "model_retry" | "template";
  issues: ValidationIssue[];
  usage: Usage[];
}

export function worldPrefix(world: WorldBible): string {
  return `DÜNYA: ${world.title}\nÖNCÜL: ${world.premise}\nTON: ${world.tone}\nDÜNYA KURALLARI:\n${world.rules.map((r) => `- ${r}`).join("\n")}`;
}

export async function narrate(i: NarrateInput): Promise<NarrateResult> {
  const usage: Usage[] = [];
  const ctx = { outcome: i.outcome, state: i.state, sceneIds: i.sceneIds, facts: i.facts };
  let lastIssues: ValidationIssue[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const user = attempt === 0 ? i.packet
      : `${i.packet}\n\nÖNCEKİ DENEMENİN SORUNLARI (düzelt):\n${lastIssues.filter((x) => x.severity === "error").map((x) => `- ${x.detail}`).join("\n")}`;
    try {
      const res = await i.caller.call({
        label: attempt === 0 ? "narrate" : "narrate_retry",
        system: NARRATOR_SYSTEM,
        stablePrefix: worldPrefix(i.world),
        user,
        schema: NarrationSchema,
        effort: "low",
        maxTokens: 6000,
      });
      usage.push(res.usage);
      const v = validateNarration(res.data, ctx);
      if (v.ok) {
        return { narration: v.sanitized, source: attempt === 0 ? "model" : "model_retry", issues: v.issues, usage };
      }
      lastIssues = v.issues;
    } catch (e) {
      if (!(e instanceof LlmError)) throw e;
      lastIssues = [{ severity: "error", code: "empty", detail: e.message }];
      if (e.kind === "refusal") break;
    }
  }
  return { narration: templateNarration(i.outcome), source: "template", issues: lastIssues, usage };
}
