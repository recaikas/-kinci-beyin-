/**
 * Kampanya oturumu: tüm hikâye ve durum bu nesnede (yerel modda tarayıcıda,
 * çevrimiçi modda Supabase'de) tutulur. LLM'e her tur yalnızca dilim gider.
 */
import type { Rng } from "@kader/dice";
import {
  buildCharacter, type CharacterInput, DEFAULT_RULES, type GameAction, type GameState, type RuleOptions,
} from "@kader/engine";
import {
  type CanonFact, type Persona, playTurn, type PlayTurnResult, type RecentTurn, type StructuredCaller,
  summarizeTurns, type TurnPacketInput, type WorldBible, fold,
} from "@kader/llm";
import { advanceChronicle, type ChronicleEntry } from "./chronicle.ts";
import { FANTASY_SETTING, instantiateWorld, type WorldSetting, type WorldTemplate } from "./template.ts";
import { AKDENIZ } from "./templates/akdeniz.ts";
import { KARACAM } from "./templates/karacam.ts";

KARACAM.setting ??= {
  ...FANTASY_SETTING,
  period: "Fantastik sınır diyarı",
  tagline: "Kılıç ve büyü. Çöken bir krallığın sınır kasabasında goblinler, haydutlar ve huzursuz ölüler.",
};

export const TEMPLATES: Record<string, WorldTemplate> = { [KARACAM.key]: KARACAM, [AKDENIZ.key]: AKDENIZ };

/** Şablonun dünya ayarı (eski şablonlar için fantastik varsayılan). */
export function settingOf(templateKey: string | undefined): WorldSetting {
  return (templateKey ? TEMPLATES[templateKey]?.setting : undefined) ?? FANTASY_SETTING;
}

/** Sınıfın bu dünyadaki görünen adı (ör. tarihî dünyada Savaşçı → Levent). */
export function classNameIn(templateKey: string | undefined, classKey: string | undefined, fallback: string): string {
  return (classKey && settingOf(templateKey).classNames?.[classKey]?.name) || fallback;
}

export interface JournalEntry {
  n: number;
  input: string;
  headline: string;
  tier: string;
  narration: string;
  dialogue: { speaker: string; line: string }[];
  rolls: { reason: string; breakdown: string; tier: string | null }[];
  facts: string[];
  gameTime: number;
  locationId: string;
  mood: string;
  source: "model" | "model_retry" | "template";
  hooks: { type: string; text: string }[];
  /** Bu turda gerçekleşen tarih olayları. */
  chronicle?: ChronicleEntry[];
}

export interface Campaign {
  version: 1;
  id: string;
  title: string;
  templateKey: string;
  createdAt: string;
  seed: string;
  turnCount: number;
  playerId: string;
  rules: RuleOptions;
  bible: WorldBible;
  state: GameState;
  personas: Record<string, Persona & { secrets?: string }>;
  facts: CanonFact[];
  journal: JournalEntry[];
  chapterSummary: string;
  campaignSummary: string;
  /** Çevrimiçi modda vektör aramasıyla gelen eski anlatı parçaları (yoksa günlükten anahtar kelime). */
  memories?: string[];
}

export interface NewCampaignInput {
  templateKey: string;
  title?: string;
  character: CharacterInput;
  rules?: Partial<RuleOptions>;
}

export function createCampaign(input: NewCampaignInput, newId: () => string, now = new Date()): Campaign {
  const t = TEMPLATES[input.templateKey];
  if (!t) throw new Error(`Bilinmeyen dünya: ${input.templateKey}`);
  const id = newId();
  const playerId = newId();
  const setting = t.setting ?? FANTASY_SETTING;
  const character: CharacterInput = setting.role && !input.character.background?.trim()
    ? { ...input.character, background: setting.role.name }
    : input.character;
  const built = buildCharacter(character, playerId, t.start.locationId, setting.kit, setting.limits);
  const w = instantiateWorld(t, id, built, newId);
  const roleLine = setting.role ? `Rolün — ${setting.role.name}: ${setting.role.description}\n\n` : "";
  const intro: JournalEntry = {
    n: 0,
    input: "",
    headline: "Yolculuk başlıyor",
    tier: "success",
    narration: t.start.intro
      ?? `${t.bible.premise}\n\n${roleLine}${w.state.world!.places[t.start.locationId]!.name}: ${w.state.world!.places[t.start.locationId]!.description}`,
    dialogue: [],
    rolls: [],
    facts: [],
    gameTime: t.start.gameTime,
    locationId: t.start.locationId,
    mood: "mysterious",
    source: "template",
    hooks: [],
  };
  return {
    version: 1,
    id,
    title: input.title?.trim() || `${built.creature.name} — ${t.bible.title}`,
    templateKey: t.key,
    createdAt: now.toISOString(),
    seed: newId(),
    turnCount: 0,
    playerId,
    rules: { ...DEFAULT_RULES, ...(input.rules ?? {}) },
    bible: t.bible,
    state: w.state,
    personas: w.personas,
    facts: w.facts,
    journal: [intro],
    chapterSummary: "",
    campaignSummary: "",
  };
}

export function currentLocation(c: Campaign) {
  const me = c.state.creatures[c.playerId]!;
  return c.state.world!.places[me.locationId!]!;
}

export function currentExits(c: Campaign) {
  const loc = currentLocation(c);
  return (c.state.world!.exits[loc.id] ?? []).map((e) => ({
    id: e.to,
    name: c.state.world!.places[e.to]?.name ?? e.to,
    minutes: e.minutes,
    ...(e.requiresItem ? { requiresItem: e.requiresItem } : {}),
  }));
}

/** Yerel hafıza: sahnedeki isimleri anan eski günlük kayıtları (basit anahtar kelime erişimi). */
function recallMemories(c: Campaign, sceneNames: string[], skipLast: number): string[] {
  const keys = sceneNames.flatMap((n) => fold(n).split(" ").filter((x) => x.length >= 4));
  if (!keys.length) return [];
  const old = c.journal.slice(1, Math.max(1, c.journal.length - skipLast));
  return old
    .map((e) => ({ e, score: keys.filter((k) => fold(e.narration).includes(k)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.e.n - a.e.n)
    .slice(0, 3)
    .map((x) => `[Tur ${x.e.n}] ${x.e.headline}. ${x.e.narration.slice(0, 400)}`);
}

export function buildContext(c: Campaign): TurnPacketInput {
  const loc = currentLocation(c);
  const here = Object.values(c.state.creatures).filter((x) => x.locationId === loc.id);
  const sceneIds = new Set(here.map((x) => x.id));
  const personas: Record<string, Persona> = {};
  for (const [id, p] of Object.entries(c.personas)) {
    if (sceneIds.has(id)) personas[id] = { id, personality: p.personality ?? "", goals: p.goals ?? "", speechStyle: p.speechStyle ?? "" };
  }
  const recent: RecentTurn[] = c.journal.slice(-6).filter((e) => e.n > 0).map((e) => ({ n: e.n, playerInput: e.input, headline: e.headline, narration: e.narration }));
  const facts = c.facts.filter((f) => f.locked || sceneIds.has(f.subject)).slice(0, 25);
  return {
    state: c.state,
    playerId: c.playerId,
    location: { id: loc.id, name: loc.name, description: loc.description },
    personas,
    recentTurns: recent,
    facts,
    chapterSummary: c.chapterSummary,
    campaignSummary: c.campaignSummary,
    openQuests: Object.values(c.state.world?.quests ?? {}).filter((q) => q.status === "open").map((q) => q.title),
    memories: c.memories ?? recallMemories(c, here.filter((x) => x.id !== c.playerId).map((x) => x.name), 6),
    worldEvents: c.journal.flatMap((e) => e.chronicle ?? []).slice(-4).map((x) => `${x.title}: ${x.text}`),
  };
}

export interface PlayOptions {
  caller: StructuredCaller | null;
  rng: Rng;
  newId: () => string;
}

export interface PlayOutcome {
  campaign: Campaign;
  result: PlayTurnResult;
  entry?: JournalEntry;
}

const SUMMARY_EVERY = 10;

export async function playCampaignTurn(
  c: Campaign,
  input: { text: string } | { action: GameAction; text?: string },
  o: PlayOptions,
): Promise<PlayOutcome> {
  const context = buildContext(c);
  const result = await playTurn({
    caller: o.caller,
    world: c.bible,
    context,
    input,
    exits: currentExits(c),
    rng: o.rng,
    rules: c.rules,
    newId: o.newId,
  });
  if (result.status !== "resolved") return { campaign: c, result };

  const r = result.resolution;
  const n = c.turnCount + 1;
  const me = r.state.creatures[c.playerId]!;
  const nameOf = (id: string) => r.state.creatures[id]?.name ?? id;
  const entry: JournalEntry = {
    n,
    input: "text" in input && input.text ? input.text : r.outcome.headline,
    headline: r.outcome.headline,
    tier: r.outcome.tier,
    narration: result.narration.narration,
    dialogue: result.narration.npc_dialogue.map((d) => ({ speaker: nameOf(d.speaker_id), line: d.line })),
    rolls: r.rolls.map((x) => ({ reason: x.reason, breakdown: x.breakdown, tier: x.tier ?? null })),
    facts: r.outcome.facts,
    gameTime: r.state.gameTime,
    locationId: me.locationId ?? "",
    mood: result.narration.mood,
    source: result.narrationSource,
    hooks: result.narration.suggested_hooks,
  };
  // Yumuşak gerçekler: yalnızca var olan konular, kilitli/aktif gerçekleri ezmeden.
  const facts = [...c.facts];
  for (const f of result.narration.new_fact_candidates) {
    if (!r.state.creatures[f.subject_id]) continue;
    const exists = facts.some((x) => x.subject === f.subject_id && fold(x.predicate) === fold(f.predicate));
    if (!exists) facts.push({ subject: f.subject_id, predicate: f.predicate, value: f.value, locked: false });
  }
  // Dünya kendi başına ilerler: bu turda saati gelen tarih olayları (oyuncunun başarılarına göre dallanır).
  let state = r.state;
  const tmpl = TEMPLATES[c.templateKey];
  if (tmpl?.chronicle?.length) {
    const ch = advanceChronicle(tmpl, r.state, c.playerId, c.state.gameTime);
    state = ch.state;
    if (ch.entries.length) entry.chronicle = ch.entries;
  }
  let next: Campaign = { ...c, state, turnCount: n, journal: [...c.journal, entry], facts };

  if (o.caller && n % SUMMARY_EVERY === 0) {
    try {
      const turns = next.journal.slice(-SUMMARY_EVERY).map((e) => ({ n: e.n, playerInput: e.input, headline: e.headline, narration: e.narration }));
      const { summary } = await summarizeTurns(o.caller, turns, next.chapterSummary);
      const more = summary.facts
        .filter((f) => !next.facts.some((x) => x.subject === f.subject && fold(x.predicate) === fold(f.predicate)))
        .map((f) => ({ subject: f.subject, predicate: f.predicate, value: f.value, locked: false }));
      next = {
        ...next,
        campaignSummary: [next.campaignSummary, next.chapterSummary].filter(Boolean).join("\n").slice(-4000),
        chapterSummary: summary.summary,
        facts: [...next.facts, ...more],
      };
    } catch {
      // Özet başarısızsa oyun etkilenmez.
    }
  }
  return { campaign: next, result, entry };
}
