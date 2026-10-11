/**
 * Gerçek PostgreSQL'e karşı entegrasyon testi (migration + apply_turn + RLS).
 * Çalıştırmak için: KZ_TEST_DATABASE_URL=postgres://postgres@localhost:54329/postgres npm test
 * Değişken yoksa atlanır.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FixedRng } from "@kader/dice";
import { resolveAction, spawnMonster } from "@kader/engine";
import { buildApplyPayload, buildGameState, type LoadedRows } from "../src/index.ts";
import { blankIntentAction, playTurn, type StructuredCaller } from "@kader/llm";

const DB_URL = process.env.KZ_TEST_DATABASE_URL;
const root = join(fileURLToPath(new URL("../../..", import.meta.url)));
const DB = "kz_integration";

const OWNER = "00000000-0000-0000-0000-000000000001";
const OTHER = "00000000-0000-0000-0000-000000000002";
const WORLD = "00000000-0000-0000-0000-0000000000a1";
const GATE = "00000000-0000-0000-0000-0000000000b1";
const MARKET = "00000000-0000-0000-0000-0000000000b2";
const CAMPAIGN = "00000000-0000-0000-0000-0000000000c1";
const HERO = "00000000-0000-0000-0000-0000000000d1";
const GUARD = "00000000-0000-0000-0000-0000000000d2";

describe.skipIf(!DB_URL)("Supabase şeması (gerçek PostgreSQL)", () => {
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
    await db.query(readFileSync(join(root, "supabase/seed.sql"), "utf8"));
    // Tohum veri
    const hero = { ...spawnMonster("bandit", HERO), kind: "pc" as const, name: "Arda", skillProficiencies: ["persuasion" as const] };
    const guard = spawnMonster("guard", GUARD, { name: "Muhafız Kerem" });
    await db.query(`insert into auth.users (id) values ($1), ($2)`, [OWNER, OTHER]);
    await db.query(`insert into public.worlds (id, owner_id, title, premise) values ($1, $2, 'Test', 'Orta çağ')`, [WORLD, OWNER]);
    await db.query(`insert into public.places (id, world_id, name) values ($1, $3, 'Kapı'), ($2, $3, 'Pazar')`, [GATE, MARKET, WORLD]);
    await db.query(`insert into public.place_exits (from_id, to_id, travel_minutes) values ($1, $2, 10)`, [GATE, MARKET]);
    await db.query(`insert into public.campaigns (id, owner_id, world_id, title, scene_location_id) values ($1, $2, $3, 'K1', $4)`, [CAMPAIGN, OWNER, WORLD, GATE]);
    for (const c of [hero, guard]) {
      await db.query(
        `insert into public.creatures (id, campaign_id, kind, name, level, size, abilities, skill_proficiencies, hp, max_hp, ac, speed, hit_dice, hit_dice_max, location_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [c.id, CAMPAIGN, c.kind, c.name, c.level, c.size, c.abilities, c.skillProficiencies, c.hp, c.maxHp, c.ac, c.speed, c.hitDice, c.hitDiceMax, GATE],
      );
    }
    await db.query(`update public.campaigns set player_character_id = $1 where id = $2`, [HERO, CAMPAIGN]);
    await db.query(`insert into public.personas (creature_id, personality, secrets) values ($1, 'açgözlü', 'kaçakçılarla iş birliği yapıyor')`, [GUARD]);
    await db.query(`insert into public.wallets (campaign_id, owner_id, cp) values ($1, $2, 5000)`, [CAMPAIGN, HERO]);
    await db.query(`insert into public.inventory (campaign_id, owner_id, item_key, qty) values ($1, $2, 'potion_of_healing', 1)`, [CAMPAIGN, HERO]);
  });

  afterAll(async () => {
    await db?.end();
  });

  async function load(campaignId = CAMPAIGN): Promise<LoadedRows> {
    const one = async (sql: string) => (await db.query(sql, [campaignId])).rows;
    return {
      campaign: (await one(`select * from public.campaigns where id = $1`))[0],
      creatures: await one(`select * from public.creatures where campaign_id = $1`),
      inventory: await one(`select * from public.inventory where campaign_id = $1`),
      wallets: await one(`select * from public.wallets where campaign_id = $1`),
      relationships: await one(`select * from public.relationships where campaign_id = $1`),
      factions: await one(`select * from public.factions where campaign_id = $1`),
    } as LoadedRows;
  }

  it("motor sonucunu tek transaction'da yazar", async () => {
    const { state } = buildGameState(await load());
    expect(state.creatures[HERO]!.name).toBe("Arda");
    const res = resolveAction(state, {
      type: "social", actorId: HERO, targetId: GUARD, approach: "bribe", risk: "significant", bribeCp: 2000,
    }, { rng: new FixedRng([15]) });
    expect(res.ok).toBe(true);

    const payload = buildApplyPayload(state, res.state, res.effects, res.rolls, {
      playerInput: "Muhafıza 20 altın veriyorum", intent: null, action: res.action, outcome: res.outcome,
      narration: { narration: "..." }, narrationSource: "template", validation: [], rngNonce: "n1", usage: [],
      hooks: [{ type: "rumor", text: "Kuzeyde kaçakçılar var" }],
      facts: [{ subject: GUARD, predicate: "kızının adı", value: "Elif" }],
    });
    const out = await db.query(`select * from public.apply_turn($1, $2, $3)`, [CAMPAIGN, 0, payload]);
    expect(out.rows[0].turn_n).toBe(1);

    const after = await load();
    const wallets = Object.fromEntries(after.wallets.map((w) => [w.owner_id, Number(w.cp)]));
    expect(wallets[HERO]).toBe(3000);
    expect(wallets[GUARD]).toBe(2000);
    expect(after.relationships[0]!.score).toBeGreaterThan(0);
    expect(after.campaign.turn_count).toBe(1);
    expect(after.campaign.game_time).toBe(5);

    const rolls = (await db.query(`select * from public.rolls where campaign_id = $1`, [CAMPAIGN])).rows;
    expect(rolls).toHaveLength(1);
    expect(rolls[0].natural_roll).toBe(15);
    expect(rolls[0].dc).toBe(15 - 10);
    const facts = (await db.query(`select * from public.facts where campaign_id = $1`, [CAMPAIGN])).rows;
    expect(facts[0].value).toBe("Elif");
  });

  it("eski tur numarasıyla yazma reddedilir (yarış durumu)", async () => {
    const { state } = buildGameState(await load());
    const res = resolveAction(state, { type: "look", actorId: HERO }, { rng: new FixedRng([]) });
    const payload = buildApplyPayload(state, res.state, res.effects, res.rolls, {
      playerInput: "bak", intent: null, action: res.action, outcome: res.outcome, narration: {},
      narrationSource: "template", validation: [], rngNonce: "n2", usage: [], hooks: [], facts: [],
    });
    await expect(db.query(`select * from public.apply_turn($1, $2, $3)`, [CAMPAIGN, 0, payload])).rejects.toThrow(/turn_conflict/);
    const turns = (await db.query(`select count(*)::int as n from public.turns where campaign_id = $1`, [CAMPAIGN])).rows[0].n;
    expect(turns).toBe(1);
  });

  it("aynı konu+yüklem için ikinci gerçek mevcut kanonu ezmez", async () => {
    const { state } = buildGameState(await load());
    const res = resolveAction(state, { type: "look", actorId: HERO }, { rng: new FixedRng([]) });
    const payload = buildApplyPayload(state, res.state, res.effects, res.rolls, {
      playerInput: "bak", intent: null, action: res.action, outcome: res.outcome, narration: {},
      narrationSource: "template", validation: [], rngNonce: "n3", usage: [], hooks: [],
      facts: [{ subject: GUARD, predicate: "Kızının Adı", value: "Ayşe" }],
    });
    await db.query(`select * from public.apply_turn($1, $2, $3)`, [CAMPAIGN, 1, payload]);
    const facts = (await db.query(`select value from public.facts where campaign_id = $1`, [CAMPAIGN])).rows;
    expect(facts.map((f) => f.value)).toEqual(["Elif"]);
  });

  it("taşınma sahne konumunu ve yaratık konumunu günceller", async () => {
    const { state } = buildGameState(await load());
    const res = resolveAction(state, { type: "move", actorId: HERO, toLocationId: MARKET, minutes: 10 }, { rng: new FixedRng([]) });
    const payload = buildApplyPayload(state, res.state, res.effects, res.rolls, {
      playerInput: "pazara git", intent: null, action: res.action, outcome: res.outcome, narration: {},
      narrationSource: "template", validation: [], rngNonce: "n4", usage: [], hooks: [], facts: [],
    });
    await db.query(`select * from public.apply_turn($1, $2, $3)`, [CAMPAIGN, 2, payload]);
    const after = await load();
    expect(after.campaign.scene_location_id).toBe(MARKET);
    expect(after.creatures.find((c) => c.id === HERO)!.location_id).toBe(MARKET);
  });

  it("RLS: oyuncu kendi kampanyasını okur, başkası okuyamaz, kimse doğrudan yazamaz", async () => {
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
    const mine = await as(OWNER, async () => (await db.query(`select count(*)::int n from public.creatures`)).rows[0].n);
    expect(mine).toBe(2);
    const theirs = await as(OTHER, async () => (await db.query(`select count(*)::int n from public.creatures`)).rows[0].n);
    expect(theirs).toBe(0);
    const secrets = await as(OWNER, async () => (await db.query(`select count(*)::int n from public.personas`)).rows[0].n);
    expect(secrets).toBe(0);
    await expect(as(OWNER, () => db.query(`update public.creatures set hp = 999`))).rejects.toThrow();
    await expect(as(OWNER, () => db.query(`select * from public.apply_turn($1, 3, '{}'::jsonb)`, [CAMPAIGN]))).rejects.toThrow(/permission denied/);
  });

  it("uçtan uca: demo kampanyası → playTurn → apply_turn", async () => {
    await db.query("begin");
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [OTHER]);
    await db.query("set local role authenticated");
    const cid = (await db.query(`select public.start_demo_campaign() as id`)).rows[0].id as string;
    await db.query("commit");

    const rows = await load(cid);
    const { state, rules } = buildGameState(rows);
    const pcId = rows.campaign.player_character_id!;
    const guard = rows.creatures.find((c) => c.name === "Muhafız Kerem")!;
    const replies: unknown[] = [
      { kind: "action", summary: "rüşvet", clarification_question: null, action: {
        ...blankIntentAction("social"), target_id: guard.id, approach: "bribe", risk: "significant", bribe_gp: 10 } },
      { narration: "Kerem sikkeleri dişliyor.", npc_dialogue: [], suggested_hooks: [], new_fact_candidates: [], mood: "tense" },
    ];
    const caller: StructuredCaller = {
      call: async (req) => ({ data: req.schema.parse(replies.shift()), usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: "fake", latencyMs: 0 }),
    };
    const r = await playTurn({
      caller, rules, rng: new FixedRng([18]), exits: [],
      world: { title: "t", premise: "p", tone: "", rules: [], language: "tr" },
      context: { state, playerId: pcId, location: { id: rows.campaign.scene_location_id!, name: "Kapı", description: "" }, personas: {}, recentTurns: [], facts: [], chapterSummary: "", campaignSummary: "", openQuests: [] },
      input: { text: "Muhafıza 10 altın uzatıyorum" },
    });
    if (r.status !== "resolved") throw new Error(r.status);
    const payload = buildApplyPayload(state, r.resolution.state, r.resolution.effects, r.resolution.rolls, {
      playerInput: "Muhafıza 10 altın uzatıyorum", intent: r.intent, action: r.resolution.action, outcome: r.resolution.outcome,
      narration: r.narration, narrationSource: r.narrationSource, validation: r.issues, rngNonce: "e2e", usage: r.usage, hooks: [], facts: [],
    });
    await db.query(`select * from public.apply_turn($1, 0, $2)`, [cid, payload]);
    const after = await load(cid);
    expect(Number(after.wallets.find((w) => w.owner_id === pcId)!.cp)).toBe(4500 - 1000);
    expect(after.campaign.turn_count).toBe(1);
    const turn = (await db.query(`select narration->>'narration' as n, outcome->>'tier' as t from public.turns where campaign_id = $1`, [cid])).rows[0];
    expect(turn.n).toBe("Kerem sikkeleri dişliyor.");
    expect(turn.t).toBe("critical_success");
  });
});
