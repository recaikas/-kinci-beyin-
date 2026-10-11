/**
 * Çevrimiçi arka uç: Supabase Auth + Edge Functions. Tüm durum Postgres'te.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type Backend, BackendError, type CampaignData, type CampaignSummary, type NewCampaign, type TurnResponse } from "./types.ts";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!URL || !ANON) return null;
  client ??= createClient(URL, ANON, { auth: { persistSession: true, storageKey: "kz-auth" } });
  return client;
}

async function call<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const sb = supabase();
  if (!sb) throw new BackendError("Çevrimiçi mod yapılandırılmamış");
  const { data, error } = await sb.functions.invoke(fn, { body });
  if (error) {
    let message = error.message;
    let details: unknown;
    // FunctionsHttpError: gövdede { error, details } var
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const j = await ctx.json();
        message = j.error ?? message;
        details = j.details;
      } catch {
        // gövde JSON değil
      }
    }
    throw new BackendError(message, details);
  }
  return data as T;
}

export class OnlineBackend implements Backend {
  mode = "online" as const;
  private ai = true;

  aiLabel(): string {
    return this.ai ? "Claude Haiku 5.5 (sunucu)" : "Kural tabanlı anlatıcı (sunucuda AI anahtarı yok)";
  }

  async listCampaigns(): Promise<CampaignSummary[]> {
    const r = await call<{ campaigns: { id: string; title: string; template_key: string | null; turn_count: number; updated_at: string; player: { name: string; level: number; class_key: string | null; race_key: string | null; is_alive: boolean } | null }[] }>("campaign", { op: "list" });
    return r.campaigns.map((c) => ({
      id: c.id, title: c.title, turnCount: c.turn_count, updatedAt: c.updated_at, ...(c.template_key ? { templateKey: c.template_key } : {}),
      player: c.player ? { name: c.player.name, level: c.player.level, classKey: c.player.class_key, raceKey: c.player.race_key, alive: c.player.is_alive } : null,
    }));
  }

  rollAbilities() {
    return call<{ values: number[]; token: string }>("campaign", { op: "roll_abilities" });
  }

  createCampaign(input: NewCampaign): Promise<CampaignData> {
    return call<CampaignData>("campaign", { op: "create", ...input } as Record<string, unknown>);
  }

  getCampaign(id: string): Promise<CampaignData> {
    return call<CampaignData>("campaign", { op: "get", id, journal: 60 });
  }

  async playTurn(id: string, input: Parameters<Backend["playTurn"]>[1]): Promise<TurnResponse> {
    const r = await call<TurnResponse>("turn", { campaign_id: id, ...input } as Record<string, unknown>);
    if (r.status === "resolved") this.ai = r.ai;
    return r;
  }

  async deleteCampaign(id: string): Promise<void> {
    await call("campaign", { op: "delete", id });
  }
}
