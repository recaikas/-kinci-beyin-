/**
 * Gerçek PostgreSQL'e karşı entegrasyon testi: kampanya oluştur → oyna → her turdan
 * sonra veritabanındaki durum, motorun bellekteki durumuyla birebir aynı mı?
 * Çalıştırmak için: KZ_TEST_DATABASE_URL=postgres://... npm run test:db (yoksa atlanır)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SeededRng } from "@kader/dice";
import type { GameState } from "@kader/engine";
import { type Campaign, createCampaign, playCampaignTurn } from "@kader/game";
import { campaignFromRows, type CampaignRows, createPayload, turnPayload } from "../src/index.ts";

const DB_URL = process.env.KZ_TEST_DATABASE_URL;
const root = join(fileURLToPath(new URL("../../..", import.meta.url)));
const DB = "kz_integration";
const OWNER = "00000000-0000-0000-0000-0000000000a1";
const OTHER = "00000000-0000-0000-0000-0000000000a2";

let seq = 0;
const newId = () => `00000000-0000-4000-9000-${String(++seq).padStart(12, "0")}`;

function normalize(s: GameState): unknown {
  const inv = Object.fromEntries(Object.entries(s.inventories).filter(([, v]) => v.length)
    .map(([k, v]) => [k, [...v].sort((a, b) => a.itemKey.localeCompare(b.itemKey)).map((i) => ({ ...i, equipped: !!i.equipped, attuned: !!i.attuned }))]));
  const creatures = Object.fromEntries(Object.entries(s.creatures).map(([k, c]) => [k, { ...c, buffs: c.buffs?.length ? c.buffs : undefined }]));
  return JSON.parse(JSON.stringify({ ...s, inventories: inv, creatures, sceneLocationId: null }));
}

describe.skipIf(!DB_URL)("Supabase v1 şeması (gerçek PostgreSQL)", () => {
  let db: pg.Client;

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: DB_URL });
    await admin.connect();
    await admin.query(`drop database if exists ${DB}`);
    await admin.query(`create database ${DB}`);
    await admin.end();
    const u = new URL(DB_URL!);
    u.pathname = `/${DB}`;
    db = new pg.Client({ connectionString: u.toString() });
    await db.connect();
    await db.query(readFileSync(join(root, "supabase/tests/supabase_stub.sql"), "utf8"));
    const dir = join(root, "supabase/migrations");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
      await db.query(readFileSync(join(dir, f), "utf8"));
    }
    await db.query(`insert into auth.users (id) values ($1), ($2)`, [OWNER, OTHER]);
  });

  afterAll(async () => {
    await db?.end();
  });

  async function load(id: string): Promise<Campaign> {
    const q = async (sql: string) => (await db.query(sql, [id])).rows;
    const rows: CampaignRows = {
      campaign: (await q(`select * from public.campaigns where id = $1`))[0],
      creatures: await q(`select * from public.creatures where campaign_id = $1`),
      personas: await q(`select * from public.personas where campaign_id = $1`),
      inventory: await q(`select * from public.inventory where campaign_id = $1`),
      wallets: await q(`select * from public.wallets where campaign_id = $1`),
      relationships: await q(`select * from public.relationships where campaign_id = $1`),
      factions: await q(`select * from public.factions where campaign_id = $1`),
      quests: await q(`select * from public.quests where campaign_id = $1`),
      facts: await q(`select * from public.facts where campaign_id = $1`),
      turns: await q(`select n, entry from public.turns where campaign_id = $1 order by n desc limit 12`),
    };
    return campaignFromRows(rows);
  }

  async function play(c: Campaign, text: string, seed: string): Promise<Campaign> {
    const r = await playCampaignTurn(c, { text }, { caller: null, rng: new SeededRng(seed), newId });
    if (r.result.status !== "resolved") throw new Error(`${text}: ${JSON.stringify(r.result)}`);
    const res = r.result.resolution;
    const payload = turnPayload(c, r.campaign, {
      playerInput: text, action: res.action, outcome: res.outcome, entry: r.entry!, narrationSource: r.entry!.source,
      rngNonce: seed, usage: [], rolls: res.rolls, effects: res.effects,
    });
    await db.query(`select public.apply_turn($1, $2, $3)`, [c.id, c.turnCount, payload]);
    const reloaded = await load(c.id);
    expect(normalize(reloaded.state), `tur sonrası durum: ${text}`).toEqual(normalize(r.campaign.state));
    expect(reloaded.turnCount).toBe(r.campaign.turnCount);
    return r.campaign;
  }

  let campaign: Campaign;

  it("kampanya oluşturulur ve veritabanından birebir geri yüklenir", async () => {
    campaign = createCampaign({
      templateKey: "karacam",
      character: {
        name: "Arda", raceKey: "human", classKey: "fighter", method: "standard_array",
        abilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 }, skills: ["athletics", "perception"],
      },
    }, newId);
    await db.query(`select public.create_campaign($1, $2)`, [OWNER, createPayload(campaign)]);
    const loaded = await load(campaign.id);
    expect(normalize(loaded.state)).toEqual(normalize(campaign.state));
    expect(loaded.journal).toHaveLength(1);
    expect(loaded.facts).toHaveLength(campaign.facts.length);
    expect(Object.keys(loaded.personas).length).toBe(Object.keys(campaign.personas).length);
  });

  it("çok turlu oyun: her tur sonrası DB == motor", async () => {
    let c = campaign;
    c = await play(c, "pazara git", "t1");
    c = await play(c, "selin'den 2 erzak satın al", "t2");
    c = await play(c, "muhtar konağına yürüyorum", "t3");
    c = await play(c, "mühürlü mektubu muhtar davut'a ver", "t4");
    expect(c.state.world!.quests.q_mektup!.status).toBe("completed");
    c = await play(c, "görevi kabul ediyorum", "t5");
    c = await play(c, "zincir zırhı çıkar", "t6");
    c = await play(c, "zincir zırhı kuşan", "t7");
    campaign = c;
    const rolls = (await db.query(`select count(*)::int n from public.rolls where campaign_id = $1`, [c.id])).rows[0].n;
    expect(rolls).toBeGreaterThanOrEqual(0);
    const events = (await db.query(`select type from public.events where campaign_id = $1`, [c.id])).rows.map((r) => r.type);
    expect(events).toContain("quest.completed");
  });

  it("pusu: doğan canavarlar veritabanına eklenir", async () => {
    let c = campaign;
    c = await play(c, "pazara git", "p1");
    c = await play(c, "kapıya git", "p2");
    for (let i = 0; i < 40 && !c.state.encounter; i++) {
      const r = await playCampaignTurn(c, { text: "ormana git" }, { caller: null, rng: new SeededRng(`amb${i}`), newId });
      if (r.result.status === "resolved" && r.campaign.state.encounter) c = await play(c, "ormana git", `amb${i}`);
    }
    expect(c.state.encounter?.active).toBe(true);
    const spawned = (await db.query(`select count(*)::int n from public.creatures where campaign_id = $1 and location_id = 'orman' and kind = 'monster'`, [c.id])).rows[0].n;
    expect(spawned).toBeGreaterThan(0);
    campaign = c;
  });

  it("eski tur numarasıyla yazma reddedilir", async () => {
    await expect(db.query(`select public.apply_turn($1, $2, $3)`, [campaign.id, 0, { turn: {}, game_time: 0 }])).rejects.toThrow(/turn_conflict/);
  });

  it("RLS: sahibi okur, başkası okuyamaz, kimse doğrudan yazamaz, sırlar gizli", async () => {
    const as = async <T>(user: string, fn: () => Promise<T>): Promise<T> => {
      await db.query("begin");
      try {
        await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user]);
        await db.query("set local role authenticated");
        return await fn();
      } finally {
        await db.query("rollback");
      }
    };
    const count = (sql: string) => async () => (await db.query(sql)).rows[0].n as number;
    expect(await as(OWNER, count(`select count(*)::int n from public.creatures`))).toBeGreaterThan(10);
    expect(await as(OTHER, count(`select count(*)::int n from public.creatures`))).toBe(0);
    expect(await as(OWNER, count(`select count(*)::int n from public.personas`))).toBe(0);
    expect(await as(OWNER, count(`select count(*)::int n from public.facts`))).toBe(0);
    await expect(as(OWNER, () => db.query(`update public.creatures set hp = 999`))).rejects.toThrow();
    await expect(as(OWNER, () => db.query(`select public.apply_turn($1, 3, '{}'::jsonb)`, [campaign.id]))).rejects.toThrow(/permission denied/);
    await expect(as(OWNER, () => db.query(`select public.create_campaign($1, '{}'::jsonb)`, [OWNER]))).rejects.toThrow(/permission denied/);
  });
});
