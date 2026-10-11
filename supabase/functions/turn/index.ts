/**
 * POST /functions/v1/turn
 * Gövde: { campaign_id: string, text?: string, action?: GameAction }
 *
 * yetki → kampanyayı yükle → playCampaignTurn (kural/Haiku niyet → motor → Haiku/şablon anlatı)
 *       → apply_turn() ile tek transaction'da yaz → arka planda anlatıyı gömerek hafızaya ekle.
 * LLM hiçbir tabloya doğrudan yazmaz.
 */
import { SeededRng } from "@kader/dice";
import type { GameAction } from "@kader/engine";
import { buildView, playCampaignTurn } from "@kader/game";
import { createCaller } from "@kader/llm";
import { campaignFromRows, turnPayload } from "@kader/store";
import { admin, embed, loadCampaignRows, requireUser } from "../_shared/db.ts";
import { HttpError, json, serve } from "../_shared/http.ts";

const API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

serve(async (req) => {
  const userId = await requireUser(req);
  const body = (await req.json()) as { campaign_id?: string; text?: string; action?: GameAction };
  if (!body.campaign_id) throw new HttpError(400, "campaign_id gerekli");
  const text = (body.text ?? "").trim();
  if (!text && !body.action) throw new HttpError(400, "text veya action gerekli");
  if (text.length > 1000) throw new HttpError(400, "Mesaj çok uzun (en fazla 1000 karakter)");

  const db = admin();
  const rows = await loadCampaignRows(db, body.campaign_id, userId);
  // Vektör hafızası: oyuncunun metnine benzeyen eski anlatı parçaları
  if (text) {
    const vec = await embed(text);
    if (vec) {
      const { data } = await db.rpc("match_memories", { p_campaign_id: body.campaign_id, p_embedding: vec, p_limit: 4 });
      rows.memories = ((data ?? []) as { content: string }[]).map((m) => m.content);
    }
  }
  const before = campaignFromRows(rows);
  const nonce = crypto.randomUUID();
  const out = await playCampaignTurn(before, body.action ? { action: body.action, ...(text ? { text } : {}) } : { text }, {
    caller: API_KEY ? createCaller(API_KEY) : null,
    rng: new SeededRng(`${before.seed}:${before.turnCount + 1}:${nonce}`),
    newId: () => crypto.randomUUID(),
  });
  const r = out.result;
  if (r.status !== "resolved") {
    return json({
      status: r.status,
      ...("question" in r ? { question: r.question } : {}),
      ...("reason" in r ? { reason: r.reason } : {}),
      ...("summary" in r ? { summary: r.summary } : {}),
    });
  }

  const res = r.resolution;
  const payload = turnPayload(before, out.campaign, {
    playerInput: text || res.outcome.headline,
    action: res.action,
    outcome: res.outcome,
    entry: out.entry!,
    narrationSource: out.entry!.source,
    rngNonce: nonce,
    usage: r.usage,
    rolls: res.rolls,
    effects: res.effects,
  });
  const applied = await db.rpc("apply_turn", { p_campaign_id: before.id, p_expected_turn: before.turnCount, p: payload });
  if (applied.error) {
    if (applied.error.message.includes("turn_conflict")) throw new HttpError(409, "Aynı anda başka bir tur işlendi; sayfayı yenile");
    throw new HttpError(500, `Tur yazılamadı: ${applied.error.message}`);
  }

  const entry = out.entry!;
  const background = (async () => {
    const vec = await embed(entry.narration);
    await db.from("memory_chunks").insert({
      campaign_id: before.id,
      turn_n: entry.n,
      content: `[Tur ${entry.n}] ${entry.headline}. ${entry.narration}`.slice(0, 4000),
      embedding: vec,
    });
  })().catch((e) => console.error("hafıza işi başarısız", e));
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil?.(background);

  return json({ status: "resolved", entry, view: buildView(out.campaign), ai: !!API_KEY });
});
