/**
 * Yerel arka uç: oyun tamamen tarayıcıda çalışır, kampanya localStorage'da tutulur.
 * Anthropic anahtarı girilirse anlatıcı Claude Haiku 5.5 olur; yoksa kural tabanlı mod.
 */
import { CryptoRng, SeededRng } from "@kader/dice";
import { CharacterError, rollAbilityScores } from "@kader/engine";
import { buildView, type Campaign, createCampaign, playCampaignTurn } from "@kader/game";
import { createCaller } from "@kader/llm";
import { type Backend, BackendError, type CampaignData, type CampaignSummary, type NewCampaign, type TurnResponse } from "./types.ts";

const INDEX = "kz:index";
const KEY = (id: string) => `kz:campaign:${id}`;
const API_KEY = "kz:anthropic-key";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    throw new BackendError(`Tarayıcı depolaması dolu ya da kapalı: ${(e as Error).message}`);
  }
}

export function getLocalApiKey(): string {
  try {
    return localStorage.getItem(API_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setLocalApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(API_KEY, key.trim());
    else localStorage.removeItem(API_KEY);
  } catch {
    // depolama kapalıysa anahtar yalnızca bu oturumda yok sayılır
  }
}

function summary(c: Campaign): CampaignSummary {
  const pc = c.state.creatures[c.playerId];
  return {
    id: c.id,
    title: c.title,
    turnCount: c.turnCount,
    updatedAt: new Date().toISOString(),
    player: pc ? { name: pc.name, level: pc.level, classKey: pc.classKey ?? null, raceKey: pc.raceKey ?? null, alive: pc.isAlive } : null,
  };
}

function save(c: Campaign): void {
  // Uzun kampanyalarda günlüğün tamamı tutulur; çok büyürse eski kayıtların anlatısı kısaltılır.
  let toSave = c;
  const size = JSON.stringify(c).length;
  if (size > 3_500_000) {
    toSave = { ...c, journal: c.journal.map((e, i) => (i < c.journal.length - 100 ? { ...e, narration: e.narration.slice(0, 300), facts: [] } : e)) };
  }
  write(KEY(c.id), toSave);
  const idx = read<CampaignSummary[]>(INDEX, []).filter((x) => x.id !== c.id);
  write(INDEX, [summary(c), ...idx]);
}

function load(id: string): Campaign {
  const c = read<Campaign | null>(KEY(id), null);
  if (!c) throw new BackendError("Kampanya bulunamadı");
  return c;
}

export class LocalBackend implements Backend {
  mode = "local" as const;

  aiLabel(): string {
    return getLocalApiKey() ? "Claude Haiku 5.5 (kendi anahtarın)" : "Kural tabanlı anlatıcı (AI kapalı)";
  }

  async listCampaigns(): Promise<CampaignSummary[]> {
    return read<CampaignSummary[]>(INDEX, []);
  }

  async rollAbilities() {
    return { values: rollAbilityScores(new CryptoRng()) };
  }

  async createCampaign(input: NewCampaign): Promise<CampaignData> {
    try {
      const c = createCampaign({ templateKey: input.templateKey, character: input.character, ...(input.title ? { title: input.title } : {}) }, () => crypto.randomUUID());
      save(c);
      return { id: c.id, view: buildView(c), journal: c.journal };
    } catch (e) {
      if (e instanceof CharacterError) throw new BackendError("Karakter geçersiz", e.errors);
      throw e;
    }
  }

  async getCampaign(id: string): Promise<CampaignData> {
    const c = load(id);
    return { id, view: buildView(c), journal: c.journal };
  }

  async playTurn(id: string, input: Parameters<Backend["playTurn"]>[1]): Promise<TurnResponse> {
    const c = load(id);
    const key = getLocalApiKey();
    const out = await playCampaignTurn(c, input, {
      caller: key ? createCaller(key, { browser: true }) : null,
      rng: new SeededRng(`${c.seed}:${c.turnCount + 1}:${crypto.randomUUID()}`),
      newId: () => crypto.randomUUID(),
    });
    const r = out.result;
    if (r.status === "resolved") {
      save(out.campaign);
      return { status: "resolved", entry: out.entry!, view: buildView(out.campaign), ai: !!key };
    }
    if (r.status === "clarify") return { status: "clarify", question: r.question };
    if (r.status === "rejected") return { status: "rejected", reason: r.reason };
    return { status: "out_of_character", summary: r.summary };
  }

  async deleteCampaign(id: string): Promise<void> {
    try {
      localStorage.removeItem(KEY(id));
    } catch {
      // yok say
    }
    write(INDEX, read<CampaignSummary[]>(INDEX, []).filter((x) => x.id !== id));
  }

  /** Kampanyayı JSON olarak dışa aktar (yedek). */
  exportCampaign(id: string): string {
    return JSON.stringify(load(id));
  }

  importCampaign(json: string): string {
    const c = JSON.parse(json) as Campaign;
    if (c.version !== 1 || !c.id || !c.state) throw new BackendError("Geçersiz kampanya dosyası");
    save(c);
    return c.id;
  }
}
