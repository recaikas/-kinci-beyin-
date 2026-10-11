import { describe, expect, it } from "vitest";
import type * as z from "zod/v4";
import { FixedRng } from "@kader/dice";
import { spawnMonster, type Creature, type GameState } from "@kader/engine";
import {
  type Intent, type Narration, playTurn, type StructuredCaller, type StructuredRequest,
  type StructuredResponse, toGameAction, type TurnPacketInput, validateNarration, LlmError, narratorPacket,
  healthBand, gameClock, blankIntentAction,
} from "../src/index.ts";

/** Sırayla hazır yanıt döndüren sahte çağırıcı; gelen istekleri kaydeder. */
class FakeCaller implements StructuredCaller {
  readonly requests: StructuredRequest<z.ZodType>[] = [];
  constructor(private readonly replies: (unknown | Error)[]) {}
  async call<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResponse<z.infer<S>>> {
    this.requests.push(req);
    const r = this.replies.shift();
    if (r === undefined) throw new Error("FakeCaller: yanıt kalmadı");
    if (r instanceof Error) throw r;
    return { data: req.schema.parse(r) as z.infer<S>, usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: "fake", latencyMs: 1 };
  }
}

const hero: Creature = {
  ...spawnMonster("bandit", "arda"), kind: "pc", name: "Arda", locationId: "kapi",
  skillProficiencies: ["persuasion"],
};

function ctx(state: Partial<GameState> = {}): TurnPacketInput {
  return {
    state: {
      campaignId: "c1", gameTime: 600, sceneLocationId: "kapi",
      creatures: { arda: hero, kerem: spawnMonster("guard", "kerem", { name: "Muhafız Kerem", locationId: "kapi" }) },
      inventories: {}, wallets: { arda: 5000 }, relationships: {}, factions: {}, encounter: null, ...state,
    },
    playerId: "arda",
    location: { id: "kapi", name: "Şehir Kapısı", description: "Taş kemerli, meşaleli kuzey kapısı." },
    personas: { kerem: { id: "kerem", personality: "Yorgun, açgözlü ama korkak", goals: "Nöbetini sorunsuz bitirmek" } },
    recentTurns: [],
    facts: [{ subject: "kerem", predicate: "kızının adı", value: "Elif", locked: true }],
    chapterSummary: "Arda şehre gizlice girmeye çalışıyor.",
    campaignSummary: "",
    openQuests: [],
  };
}

const world = { title: "Test", premise: "Orta çağ fantastik", tone: "karanlık", rules: ["Büyü nadirdir"], language: "tr" as const };

const intent = (action: Partial<NonNullable<Intent["action"]>> | null, kind: Intent["kind"] = "action"): Intent => ({
  kind, summary: "özet", clarification_question: kind === "clarify" ? "Kime?" : null,
  action: action && { ...blankIntentAction("talk"), ...action },
});

const narration = (o: Partial<Narration> = {}): Narration => ({
  narration: "Kerem altınları tartıyor, sonra kenara çekiliyor.", npc_dialogue: [{ speaker_id: "kerem", line: "Geç bakalım." }],
  suggested_hooks: [], new_fact_candidates: [], mood: "tense", ...o,
});

const scene = { playerId: "arda", entityIds: ["arda", "kerem"], exits: [{ id: "pazar", minutes: 10 }], weapons: ["scimitar"], spells: ["fire_bolt"], items: ["potion_of_healing"] };

describe("toGameAction", () => {
  it("uydurulmuş hedefi reddeder", () => {
    const r = toGameAction(intent({ type: "attack", target_id: "ejderha" }), scene);
    expect(r.kind).toBe("invalid");
  });
  it("rüşveti bakıra çevirir", () => {
    const r = toGameAction(intent({ type: "social", target_id: "kerem", approach: "bribe", risk: "significant", bribe_gp: 20 }), scene);
    expect(r).toMatchObject({ kind: "action", action: { type: "social", bribeCp: 2000 } });
  });
  it("bilinmeyen çıkışı reddeder, bilineni kabul eder", () => {
    expect(toGameAction(intent({ type: "move", location_id: "saray" }), scene).kind).toBe("invalid");
    expect(toGameAction(intent({ type: "move", location_id: "pazar" }), scene)).toMatchObject({ action: { minutes: 10 } });
  });
  it("katalog dışı silah silahsız vuruşa düşer", () => {
    expect(toGameAction(intent({ type: "attack", target_id: "kerem", weapon_key: "lazer" }), scene)).toMatchObject({ action: { weaponKey: "unarmed" } });
  });
  it("netleştirme", () => {
    expect(toGameAction(intent(null, "clarify"), scene)).toMatchObject({ kind: "clarify", question: "Kime?" });
  });
});

describe("validateNarration", () => {
  const outcome = { tier: "success" as const, headline: "x", facts: ["Arda harcadı: 20 altın"], details: {} };
  it("gerçeklerde olmayan sayıyı yakalar", () => {
    const v = validateNarration(narration({ narration: "Kerem 50 altın istiyor." }), { outcome, state: ctx().state, sceneIds: ["arda", "kerem"], facts: [] });
    expect(v.ok).toBe(false);
    expect(v.issues[0]!.code).toBe("number_not_in_facts");
  });
  it("gerçekteki sayıya izin verir", () => {
    expect(validateNarration(narration({ narration: "20 altın el değiştirdi." }), { outcome, state: ctx().state, sceneIds: ["arda", "kerem"], facts: [] }).ok).toBe(true);
  });
  it("ölü konuşmacıyı yakalar", () => {
    const s = ctx().state;
    s.creatures.kerem = { ...s.creatures.kerem!, isAlive: false, hp: 0 };
    expect(validateNarration(narration(), { outcome, state: s, sceneIds: ["arda", "kerem"], facts: [] }).issues[0]!.code).toBe("dead_speaker");
  });
  it("mekanik ve kilitli gerçek adaylarını ayıklar (uyarı)", () => {
    const v = validateNarration(narration({ new_fact_candidates: [
      { subject_id: "kerem", predicate: "altın", value: "500" },
      { subject_id: "kerem", predicate: "kızının adı", value: "Ayşe" },
      { subject_id: "kerem", predicate: "memleketi", value: "Kuzey köyleri" },
    ] }), { outcome, state: ctx().state, sceneIds: ["arda", "kerem"], facts: ctx().facts });
    expect(v.ok).toBe(true);
    expect(v.sanitized.new_fact_candidates).toEqual([{ subject_id: "kerem", predicate: "memleketi", value: "Kuzey köyleri" }]);
  });
});

describe("playTurn", () => {
  it("metin → niyet → zar → anlatı; motor sonucu belirler", async () => {
    const caller = new FakeCaller([
      intent({ type: "social", target_id: "kerem", approach: "bribe", risk: "significant", bribe_gp: 20 }),
      narration({ narration: "20 altın avucuna düşünce Kerem'in gözleri parlıyor." }),
    ]);
    const r = await playTurn({ caller, world, context: ctx(), input: { text: "Muhafıza 20 altın verip geçmeye çalışıyorum" }, exits: [], rng: new FixedRng([14]) });
    expect(r.status).toBe("resolved");
    if (r.status !== "resolved") return;
    expect(r.resolution.state.wallets.arda).toBe(3000);
    expect(r.narrationSource).toBe("model");
    // Anlatıcı sistem önbelleği + dünya öncülü aldı.
    expect(caller.requests[1]!.stablePrefix).toContain("Orta çağ fantastik");
    expect(caller.requests[1]!.user).toContain("immutable_facts");
  });

  it("anlatıcı sayı uydurursa bir kez yeniden dener (kısa komut LLM niyetini atlar)", async () => {
    const caller = new FakeCaller([
      narration({ narration: "Yerde 999 altın parlıyor!" }),
      narration({ narration: "Kapının gölgeleri uzuyor." }),
    ]);
    const r = await playTurn({ caller, world, context: ctx(), input: { text: "etrafa bakıyorum" }, exits: [], rng: new FixedRng([]) });
    expect(r.status === "resolved" && r.narrationSource).toBe("model_retry");
    expect(caller.requests[0]!.label).toBe("narrate");
    expect(caller.requests[1]!.user).toContain("999");
  });

  it("uzun, karmaşık metin LLM niyet çözümleyicisine gider", async () => {
    const caller = new FakeCaller([intent({ type: "look" }), narration()]);
    const r = await playTurn({ caller, world, context: ctx(), input: { text: "kapının çevresindeki taşlara, meşalelere ve nöbetçinin yüzüne dikkatle bakıyorum" }, exits: [], rng: new FixedRng([]) });
    expect(r.status).toBe("resolved");
    expect(caller.requests[0]!.label).toBe("intent");
  });

  it("AI'sız mod: kural tabanlı niyet ve şablon anlatı", async () => {
    const r = await playTurn({ caller: null, world, context: ctx(), input: { text: "Kerem'e 20 altın rüşvet veriyorum" }, exits: [], rng: new FixedRng([14]) });
    expect(r.status).toBe("resolved");
    if (r.status !== "resolved") return;
    expect(r.narrationSource).toBe("template");
    expect(r.resolution.state.wallets.arda).toBe(3000);
    const unknown = await playTurn({ caller: null, world, context: ctx(), input: { text: "qwerty zzz" }, exits: [], rng: new FixedRng([]) });
    expect(unknown.status).toBe("clarify");
  });

  it("AI tamamen çökerse şablon anlatıyla oyun akar", async () => {
    const caller = new FakeCaller([new LlmError("x", "api"), new LlmError("x", "api")]);
    const r = await playTurn({ caller, world, context: ctx(), input: { text: "bak" }, exits: [], rng: new FixedRng([]) });
    expect(r.status === "resolved" && r.narrationSource).toBe("template");
  });

  it("butonla gelen eylem niyet çağrısını atlar; başkası adına eylem reddedilir", async () => {
    const caller = new FakeCaller([narration()]);
    const ok = await playTurn({ caller, world, context: ctx(), input: { action: { type: "look", actorId: "arda" } }, exits: [], rng: new FixedRng([]) });
    expect(ok.status).toBe("resolved");
    expect(caller.requests).toHaveLength(1);
    const bad = await playTurn({ caller, world, context: ctx(), input: { action: { type: "look", actorId: "kerem" } }, exits: [], rng: new FixedRng([]) });
    expect(bad.status).toBe("rejected");
  });

  it("motorun reddettiği eylem anlatıcıya gitmez", async () => {
    const caller = new FakeCaller([intent({ type: "use_item", item_key: "potion_of_healing" })]);
    const r = await playTurn({ caller, world, context: ctx(), input: { text: "iksir içiyorum" }, exits: [], rng: new FixedRng([]) });
    expect(r.status).toBe("rejected");
    expect(caller.requests).toHaveLength(1);
  });
});

describe("paket", () => {
  it("anlatıcı paketi kilitli gerçekleri ve sağlık bantlarını taşır", () => {
    const p = JSON.parse(narratorPacket(ctx(), "x", { tier: "success", headline: "h", facts: ["f"], details: {} }));
    expect(p.canon_facts[0]).toContain("[KİLİTLİ]");
    expect(p.scene_entities.find((e: { id: string }) => e.id === "kerem").attitudeToPlayer).toBe("indifferent");
    expect(healthBand({ ...hero, hp: 2, maxHp: 11 })).toBe("ağır yaralı");
    expect(gameClock(600)).toBe("1. gün, 10:00 (sabah)");
  });
});

describe("playTurn savaş", () => {
  it("savaş dışında saldırı savaşı başlatır; NPC sırası aynı tura birleşir", async () => {
    const goblin = spawnMonster("goblin", "gob", { name: "Goblin", locationId: "kapi" });
    const c = ctx({ creatures: { arda: { ...hero, hp: 11 }, gob: goblin }, inventories: { arda: [{ itemKey: "scimitar", qty: 1 }] } });
    // inisiyatif: arda 20 (+eşitlik), goblin 1 (+eşitlik); arda ıskalar (2); goblin vurur (15) 1d6+2=3+2
    const r = await playTurn({ caller: null, world, context: c, input: { text: "goblini saldırıyorum!" }, exits: [], rng: new FixedRng([20, 1, 1, 1, 2, 15, 3]) });
    if (r.status !== "resolved") throw new Error(r.status);
    expect(r.resolution.state.encounter?.active).toBe(true);
    expect(r.resolution.state.creatures.arda!.hp).toBe(6);
    expect(r.resolution.rolls.map((x) => x.reason)).toEqual(["inisiyatif", "inisiyatif", "saldırı: Pala", "saldırı: Pala", "hasar: Pala"]);
    expect(r.resolution.outcome.facts.some((f) => f.startsWith("[Önce]"))).toBe(true);
    expect(r.resolution.outcome.facts.some((f) => f.startsWith("[Sonra]"))).toBe(true);
  });
});
