/**
 * POST /functions/v1/campaign
 *   { op: "list" }
 *   { op: "roll_abilities" }                       → sunucuda 4d6kh3 ×6 + imza
 *   { op: "create", templateKey, character, title?, rollToken? }
 *   { op: "get", id, journal?: number }
 *   { op: "delete", id }
 */
import { CryptoRng } from "@kader/dice";
import { CharacterError, rollAbilityScores } from "@kader/engine";
import { buildView, createCampaign, TEMPLATES } from "@kader/game";
import { campaignFromRows, createPayload } from "@kader/store";
import { admin, hmac, loadCampaignRows, requireUser } from "../_shared/db.ts";
import { HttpError, json, serve } from "../_shared/http.ts";

serve(async (req) => {
  const userId = await requireUser(req);
  // deno-lint-ignore no-explicit-any
  const body = (await req.json()) as any;
  const db = admin();

  switch (body.op) {
    case "list": {
      const { data, error } = await db.from("campaigns")
        .select("id, title, template_key, turn_count, updated_at, player_character_id")
        .eq("owner_id", userId).order("updated_at", { ascending: false }).limit(50);
      if (error) throw new HttpError(500, error.message);
      const pcIds = (data ?? []).map((c) => c.player_character_id);
      const { data: pcs } = pcIds.length
        ? await db.from("creatures").select("id, name, level, class_key, race_key, is_alive, location_id").in("id", pcIds)
        : { data: [] };
      return json({
        campaigns: (data ?? []).map((c) => ({ ...c, player: (pcs ?? []).find((p) => p.id === c.player_character_id) ?? null })),
        templates: Object.values(TEMPLATES).map((t) => ({ key: t.key, title: t.bible.title, premise: t.bible.premise })),
      });
    }

    case "roll_abilities": {
      const values = rollAbilityScores(new CryptoRng());
      return json({ values, token: await hmac(`${userId}:${values.join(",")}`) });
    }

    case "create": {
      const character = body.character;
      if (!character || typeof character !== "object") throw new HttpError(400, "character gerekli");
      if (character.method === "rolled") {
        const values = (character.rolledValues ?? []) as number[];
        if (!body.rollToken || body.rollToken !== await hmac(`${userId}:${values.join(",")}`)) {
          throw new HttpError(400, "Zar değerleri doğrulanamadı; yeniden at");
        }
      }
      const count = await db.from("campaigns").select("id", { count: "exact", head: true }).eq("owner_id", userId);
      if ((count.count ?? 0) >= 20) throw new HttpError(429, "En fazla 20 kampanya");
      let campaign;
      try {
        campaign = createCampaign({ templateKey: body.templateKey ?? "karacam", character, ...(body.title ? { title: String(body.title).slice(0, 120) } : {}) }, () => crypto.randomUUID());
      } catch (e) {
        if (e instanceof CharacterError) throw new HttpError(400, "Karakter geçersiz", e.errors);
        throw new HttpError(400, (e as Error).message);
      }
      const { error } = await db.rpc("create_campaign", { p_owner: userId, p: createPayload(campaign) });
      if (error) throw new HttpError(500, `Kampanya kaydedilemedi: ${error.message}`);
      return json({ id: campaign.id, view: buildView(campaign), journal: campaign.journal });
    }

    case "get": {
      if (!body.id) throw new HttpError(400, "id gerekli");
      const rows = await loadCampaignRows(db, body.id, userId, Math.min(200, Number(body.journal ?? 40)));
      const c = campaignFromRows(rows);
      return json({ id: c.id, view: buildView(c), journal: c.journal });
    }

    case "delete": {
      if (!body.id) throw new HttpError(400, "id gerekli");
      const { error } = await db.from("campaigns").delete().eq("id", body.id).eq("owner_id", userId);
      if (error) throw new HttpError(500, error.message);
      return json({ ok: true });
    }

    default:
      throw new HttpError(400, "Bilinmeyen işlem");
  }
});
