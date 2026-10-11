/** Supabase erişimi: kimlik doğrulama, kampanya yükleme. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CampaignRow, CampaignRows } from "@kader/store";
import { HttpError } from "./http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// deno-lint-ignore no-explicit-any
export type Db = SupabaseClient<any, "public", any>;

export function admin(): Db {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export async function requireUser(req: Request): Promise<string> {
  const auth = req.headers.get("Authorization");
  if (!auth) throw new HttpError(401, "Oturum gerekli");
  const client = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Geçersiz oturum");
  return data.user.id;
}

function must<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new HttpError(500, `${what}: ${r.error.message}`);
  if (r.data === null) throw new HttpError(404, `${what} bulunamadı`);
  return r.data;
}

/** Kampanyanın tüm durumunu yükle; sahiplik denetlenir. */
export async function loadCampaignRows(db: Db, id: string, userId: string, journalLimit = 12): Promise<CampaignRows> {
  const campaign = must(await db.from("campaigns").select("*").eq("id", id).maybeSingle(), "Kampanya") as unknown as CampaignRow;
  if (campaign.owner_id !== userId) throw new HttpError(403, "Bu kampanya senin değil");
  const [creatures, personas, inventory, wallets, relationships, factions, quests, facts, turns] = await Promise.all([
    db.from("creatures").select("*").eq("campaign_id", id),
    db.from("personas").select("creature_id, personality, goals, speech_style").eq("campaign_id", id),
    db.from("inventory").select("owner_id, item_key, qty, equipped, attuned").eq("campaign_id", id),
    db.from("wallets").select("owner_id, cp").eq("campaign_id", id),
    db.from("relationships").select("a, b, score").eq("campaign_id", id),
    db.from("factions").select("*").eq("campaign_id", id),
    db.from("quests").select("id, status, data").eq("campaign_id", id),
    db.from("facts").select("subject, predicate, value, locked").eq("campaign_id", id).order("locked", { ascending: false }).limit(300),
    db.from("turns").select("n, entry").eq("campaign_id", id).order("n", { ascending: false }).limit(journalLimit),
  ]);
  return {
    campaign,
    creatures: must(creatures, "Yaratıklar"),
    personas: must(personas, "Kişilikler"),
    inventory: must(inventory, "Envanter"),
    wallets: must(wallets, "Cüzdanlar"),
    relationships: must(relationships, "İlişkiler"),
    factions: must(factions, "Fraksiyonlar"),
    quests: must(quests, "Görevler"),
    facts: must(facts, "Gerçekler"),
    turns: must(turns, "Günlük"),
  } as unknown as CampaignRows;
}

/** Supabase Edge Runtime'ın yerleşik gömme modeli (384 boyut). */
export async function embed(text: string): Promise<number[] | null> {
  try {
    // deno-lint-ignore no-explicit-any
    const ai = (globalThis as any).Supabase?.ai;
    if (!ai) return null;
    const session = new ai.Session("gte-small");
    return (await session.run(text.slice(0, 2000), { mean_pool: true, normalize: true })) as number[];
  } catch {
    return null;
  }
}

export async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
