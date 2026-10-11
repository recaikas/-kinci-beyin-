/**
 * POST /functions/v1/turn
 * Gövde: { campaign_id: string, text?: string, action?: GameAction }
 *
 * Akış: yetki → durumu yükle → playTurn (Haiku niyet → motor → Haiku anlatı)
 *       → apply_turn() ile tek transaction'da yaz → arka planda hafıza işleri.
 * LLM hiçbir tabloya doğrudan yazmaz.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SeededRng } from "@kader/dice";
import type { GameAction } from "@kader/engine";
import {
  type CanonFact, createCaller, type Persona, playTurn, type RecentTurn, summarizeTurns,
  type TurnPacketInput, type WorldBible,
} from "@kader/llm";
import { buildApplyPayload, buildGameState, type LoadedRows } from "@kader/store";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUMMARY_EVERY = 10;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function must<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new HttpError(500, `${what}: ${r.error.message}`);
  if (r.data === null) throw new HttpError(404, `${what} bulunamadı`);
  return r.data;
}

interface Body {
  campaign_id?: string;
  text?: string;
  action?: GameAction;
}

// deno-lint-ignore no-explicit-any
type Db = SupabaseClient<any, "public", any>;

async function loadRows(db: Db, campaignId: string): Promise<LoadedRows> {
  const [campaign, creatures, inventory, wallets, relationships, factions] = await Promise.all([
    db.from("campaigns").select("*").eq("id", campaignId).single(),
    db.from("creatures").select("*").eq("campaign_id", campaignId),
    db.from("inventory").select("*").eq("campaign_id", campaignId),
    db.from("wallets").select("*").eq("campaign_id", campaignId),
    db.from("relationships").select("*").eq("campaign_id", campaignId),
    db.from("factions").select("*").eq("campaign_id", campaignId),
  ]);
  return {
    campaign: must(campaign, "Kampanya"),
    creatures: must(creatures, "Yaratıklar"),
    inventory: must(inventory, "Envanter"),
    wallets: must(wallets, "Cüzdanlar"),
    relationships: must(relationships, "İlişkiler"),
    factions: must(factions, "Fraksiyonlar"),
  };
}

async function embed(text: string): Promise<number[] | null> {
  try {
    // Supabase Edge Runtime'ın yerleşik gömme modeli (384 boyut).
    // deno-lint-ignore no-explicit-any
    const ai = (globalThis as any).Supabase?.ai;
    if (!ai) return null;
    const session = new ai.Session("gte-small");
    return (await session.run(text, { mean_pool: true, normalize: true })) as number[];
  } catch {
    return null;
  }
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") throw new HttpError(405, "Yalnızca POST");

  // 1) Kimlik
  const auth = req.headers.get("Authorization");
  if (!auth) throw new HttpError(401, "Oturum gerekli");
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) throw new HttpError(401, "Geçersiz oturum");

  const body = (await req.json()) as Body;
  if (!body.campaign_id) throw new HttpError(400, "campaign_id gerekli");
  const text = (body.text ?? "").trim();
  if (!text && !body.action) throw new HttpError(400, "text veya action gerekli");
  if (text.length > 2000) throw new HttpError(400, "Mesaj çok uzun (en fazla 2000 karakter)");

  const db: Db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 2) Durum
  const rows = await loadRows(db, body.campaign_id);
  if (rows.campaign.owner_id !== userData.user.id) throw new HttpError(403, "Bu kampanya senin değil");
  const playerId = rows.campaign.player_character_id;
  if (!playerId) throw new HttpError(409, "Kampanyada oyuncu karakteri yok");
  const { state, rules } = buildGameState(rows);
  const player = state.creatures[playerId];
  if (!player) throw new HttpError(409, "Oyuncu karakteri bulunamadı");
  const locationId = player.locationId ?? rows.campaign.scene_location_id;
  if (!locationId) throw new HttpError(409, "Oyuncu bir konumda değil");

  const sceneIds = Object.values(state.creatures).filter((c) => c.locationId === locationId).map((c) => c.id);
  const queryEmbedding = text ? await embed(text) : null;

  const [world, place, exits, personas, recent, facts, quests, memories] = await Promise.all([
    db.from("worlds").select("*").eq("id", rows.campaign.world_id).single(),
    db.from("places").select("id, name, description").eq("id", locationId).single(),
    db.from("place_exits").select("to_id, travel_minutes, places!place_exits_to_id_fkey(name)").eq("from_id", locationId).eq("hidden", false),
    db.from("personas").select("creature_id, personality, goals, speech_style").in("creature_id", sceneIds),
    db.from("turns").select("n, player_input, outcome, narration").eq("campaign_id", body.campaign_id).order("n", { ascending: false }).limit(6),
    db.rpc("relevant_facts", { p_campaign_id: body.campaign_id, p_subjects: sceneIds, p_limit: 25 }),
    db.from("quests").select("title").eq("campaign_id", body.campaign_id).eq("status", "open"),
    queryEmbedding
      ? db.rpc("match_memories", { p_campaign_id: body.campaign_id, p_embedding: queryEmbedding, p_limit: 4 })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const w = must(world, "Dünya");
  const worldBible: WorldBible = { title: w.title, premise: w.premise, tone: w.tone, rules: w.rules ?? [], language: "tr" };
  const loc = must(place, "Konum");
  const exitList = (must(exits, "Çıkışlar") as unknown as { to_id: string; travel_minutes: number; places: { name: string } | null }[])
    .map((e) => ({ id: e.to_id, name: e.places?.name ?? e.to_id, minutes: e.travel_minutes }));
  const personaMap: Record<string, Persona> = {};
  for (const p of must(personas, "Kişilikler") as { creature_id: string; personality: string; goals: string; speech_style: string }[]) {
    personaMap[p.creature_id] = { id: p.creature_id, personality: p.personality, goals: p.goals, speechStyle: p.speech_style };
  }
  const recentTurns: RecentTurn[] = (must(recent, "Son turlar") as { n: number; player_input: string; outcome: { headline: string }; narration: { narration?: string } }[])
    .reverse()
    .map((t) => ({ n: t.n, playerInput: t.player_input, headline: t.outcome.headline, narration: t.narration.narration ?? "" }));
  const canon: CanonFact[] = (must(facts, "Gerçekler") as { subject: string; predicate: string; value: string; locked: boolean }[])
    .map((f) => ({ subject: f.subject, predicate: f.predicate, value: f.value, locked: f.locked }));

  const context: TurnPacketInput = {
    state,
    playerId,
    location: { id: loc.id, name: loc.name, description: loc.description },
    personas: personaMap,
    recentTurns,
    facts: canon,
    chapterSummary: rows.campaign.chapter_summary,
    campaignSummary: rows.campaign.campaign_summary,
    openQuests: (must(quests, "Görevler") as { title: string }[]).map((q) => q.title),
    memories: ((memories.data ?? []) as { content: string }[]).map((m) => m.content),
  };

  // 3) Tur — zar tohumu: kampanya tohumu + tur + tek kullanımlık nonce (tekrar üretilebilir, tahmin edilemez)
  const nonce = crypto.randomUUID();
  const turnN = rows.campaign.turn_count + 1;
  const caller = createCaller(Deno.env.get("ANTHROPIC_API_KEY"));
  const result = await playTurn({
    caller,
    world: worldBible,
    context,
    input: body.action ? { action: body.action, ...(text ? { text } : {}) } : { text },
    exits: exitList,
    rng: new SeededRng(`${rows.campaign.seed}:${turnN}:${nonce}`),
    rules,
  });

  if (result.status !== "resolved") {
    return json({ status: result.status, ...("question" in result ? { question: result.question } : {}), ...("reason" in result ? { reason: result.reason } : {}) });
  }

  // 4) Yaz — tek transaction, iyimser eşzamanlılık
  const r = result.resolution;
  const payload = buildApplyPayload(state, r.state, r.effects, r.rolls, {
    playerInput: text || r.outcome.headline,
    intent: result.intent,
    action: r.action,
    outcome: r.outcome,
    narration: result.narration,
    narrationSource: result.narrationSource,
    validation: result.issues,
    rngNonce: nonce,
    usage: result.usage,
    hooks: result.narration.suggested_hooks,
    facts: result.narration.new_fact_candidates.map((f) => ({ subject: f.subject_id, predicate: f.predicate, value: f.value })),
  });
  const applied = await db.rpc("apply_turn", { p_campaign_id: body.campaign_id, p_expected_turn: rows.campaign.turn_count, p: payload });
  if (applied.error) {
    if (applied.error.message.includes("turn_conflict")) throw new HttpError(409, "Aynı anda başka bir tur işlendi; tekrar dene");
    throw new HttpError(500, `Tur yazılamadı: ${applied.error.message}`);
  }

  // 5) Arka plan: anlatıyı gömüp hafızaya ekle; her N turda bölüm özeti
  const campaignId = body.campaign_id;
  const background = (async () => {
    const vec = await embed(result.narration.narration);
    await db.from("memory_chunks").insert({
      campaign_id: campaignId,
      turn_n: turnN,
      subjects: sceneIds,
      content: `[Tur ${turnN}] ${r.outcome.headline}. ${result.narration.narration}`.slice(0, 4000),
      embedding: vec,
    });
    if (turnN % SUMMARY_EVERY === 0) {
      const { data: last } = await db.from("turns").select("n, player_input, outcome, narration")
        .eq("campaign_id", campaignId).gt("n", turnN - SUMMARY_EVERY).order("n");
      const turns: RecentTurn[] = (last ?? []).map((t: { n: number; player_input: string; outcome: { headline: string }; narration: { narration?: string } }) =>
        ({ n: t.n, playerInput: t.player_input, headline: t.outcome.headline, narration: t.narration.narration ?? "" }));
      const { summary } = await summarizeTurns(caller, turns, rows.campaign.chapter_summary);
      await db.from("summaries").insert({
        campaign_id: campaignId, level: "chapter", from_turn: turnN - SUMMARY_EVERY + 1, to_turn: turnN,
        text: summary.summary, open_threads: summary.open_threads,
      });
      await db.from("campaigns").update({ chapter_summary: summary.summary }).eq("id", campaignId);
      if (summary.facts.length) {
        await db.from("facts").upsert(
          summary.facts.map((f) => ({ campaign_id: campaignId, subject: f.subject, predicate: f.predicate, value: f.value, source: "summarizer", source_turn: turnN, confidence: 0.8 })),
          { ignoreDuplicates: true },
        );
      }
    }
  })().catch((e) => console.error("hafıza işi başarısız", e));
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil?.(background);

  const p = r.state.creatures[playerId]!;
  return json({
    status: "resolved",
    turn: turnN,
    narration: result.narration,
    narration_source: result.narrationSource,
    outcome: r.outcome,
    rolls: r.rolls.map((x) => ({ reason: x.reason, breakdown: x.breakdown, tier: x.tier ?? null })),
    player: { hp: p.hp, max_hp: p.maxHp, conditions: p.conditions, cp: r.state.wallets[playerId] ?? 0 },
    encounter: r.state.encounter,
  });
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Beklenmeyen hata" }, 500);
  }
});
