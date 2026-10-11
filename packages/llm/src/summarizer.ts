/**
 * Hafıza işleri (arka plan): tur kayıtlarını bölüm özetine ve kalıcı
 * gerçek adaylarına dönüştürür. Sonuçlar `summaries` ve `facts` tablolarına yazılır.
 */
import * as z from "zod/v4";
import type { StructuredCaller, Usage } from "./caller.ts";
import { SUMMARIZER_SYSTEM } from "./prompts.ts";
import type { RecentTurn } from "./packet.ts";

export const SummarySchema = z.object({
  summary: z.string(),
  facts: z.array(z.object({ subject: z.string(), predicate: z.string(), value: z.string() })),
  open_threads: z.array(z.string()),
});
export type Summary = z.infer<typeof SummarySchema>;

export async function summarizeTurns(
  caller: StructuredCaller,
  turns: RecentTurn[],
  previousSummary: string,
): Promise<{ summary: Summary; usage: Usage }> {
  const res = await caller.call({
    label: "summarize",
    system: SUMMARIZER_SYSTEM,
    user: JSON.stringify({
      previous_summary: previousSummary,
      turns: turns.map((t) => ({ n: t.n, player: t.playerInput, result: t.headline, narration: t.narration })),
    }),
    schema: SummarySchema,
    effort: "low",
    maxTokens: 3000,
  });
  return { summary: res.data, usage: res.usage };
}
