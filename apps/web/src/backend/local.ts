/**
 * Yerel arka uç: oyun tamamen tarayıcıda çalışır.
 * - Anlatıcı: claude.ai'de açıldıysa Haiku 5.5 oyuncunun Claude hesabıyla; değilse
 *   isteğe bağlı kendi Anthropic anahtarıyla; ikisi de yoksa kural tabanlı mod.
 * - Kayıt: tarayıcı deposu (hızlı kopya) + claude.ai'de hesaba bağlı bulut (cihazlar arası).
 */
import { CryptoRng, SeededRng } from "@kader/dice";
import { CharacterError, rollAbilityScores } from "@kader/engine";
import { buildView, type Campaign, createCampaign, playCampaignTurn } from "@kader/game";
import { createCaller, LlmError, type StructuredCaller } from "@kader/llm";
import { inClaude, sampleCaller, sampleState } from "./claude.ts";
import { CloudStore } from "./cloud.ts";
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

function summary(c: Campaign, updatedAt = new Date().toISOString()): CampaignSummary {
  const pc = c.state.creatures[c.playerId];
  return {
    id: c.id,
    title: c.title,
    turnCount: c.turnCount,
    updatedAt,
    templateKey: c.templateKey,
    player: pc ? { name: pc.name, level: pc.level, classKey: pc.classKey ?? null, raceKey: pc.raceKey ?? null, alive: pc.isAlive } : null,
  };
}

function save(c: Campaign, updatedAt?: string): CampaignSummary {
  // Uzun kampanyalarda günlüğün tamamı tutulur; çok büyürse eski kayıtların anlatısı kısaltılır.
  let toSave = c;
  const size = JSON.stringify(c).length;
  if (size > 3_500_000) {
    toSave = { ...c, journal: c.journal.map((e, i) => (i < c.journal.length - 100 ? { ...e, narration: e.narration.slice(0, 300), facts: [] } : e)) };
  }
  write(KEY(c.id), toSave);
  const idx = read<CampaignSummary[]>(INDEX, []).filter((x) => x.id !== c.id);
  const sum = summary(c, updatedAt);
  write(INDEX, [sum, ...idx]);
  return sum;
}

function load(id: string): Campaign {
  const c = read<Campaign | null>(KEY(id), null);
  if (!c) throw new BackendError("Kampanya bulunamadı");
  return c;
}

let cloudPromise: Promise<CloudStore | null> | null = null;
/** Bulut deposu (claude.ai dışında ya da izin yoksa null). */
export function cloud(): Promise<CloudStore | null> {
  return (cloudPromise ??= inClaude() ? CloudStore.connect() : Promise.resolve(null));
}

export class LocalBackend implements Backend {
  mode = "local" as const;
  private aiOk = true;

  aiLabel(): string {
    const st = sampleState();
    if (st === "ready" && this.aiOk) return "Claude Haiku 5.5";
    if (st === "connecting") return "Claude'a bağlanıyor…";
    if (getLocalApiKey()) return this.aiOk ? "Claude Haiku 5.5 (kendi anahtarın)" : "Anlatıcı hatası: kural tabanlı";
    return st === "denied" ? "Claude izni yok: kural tabanlı anlatıcı" : "Kural tabanlı anlatıcı (AI kapalı)";
  }

  private async caller(): Promise<StructuredCaller | null> {
    const s = await sampleCaller();
    if (s && !s.unavailable) return s;
    const key = getLocalApiKey();
    return key ? createCaller(key, { browser: true }) : null;
  }

  async listCampaigns(): Promise<CampaignSummary[]> {
    const local = read<CampaignSummary[]>(INDEX, []);
    const store = await cloud();
    if (!store) return local;
    const remote = await store.index();
    const byId = new Map(local.map((x) => [x.id, x]));
    for (const r of remote) {
      const l = byId.get(r.id);
      if (!l || r.updatedAt > l.updatedAt) byId.set(r.id, r);
    }
    return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async rollAbilities() {
    return { values: rollAbilityScores(new CryptoRng()) };
  }

  async createCampaign(input: NewCampaign): Promise<CampaignData> {
    try {
      const c = createCampaign({ templateKey: input.templateKey, character: input.character, ...(input.title ? { title: input.title } : {}) }, () => crypto.randomUUID());
      this.persist(c);
      return { id: c.id, view: buildView(c), journal: c.journal };
    } catch (e) {
      if (e instanceof CharacterError) throw new BackendError("Karakter geçersiz", e.errors);
      throw e;
    }
  }

  /** Tarayıcıya yaz, bulutu arka planda güncelle. */
  private persist(c: Campaign): void {
    const sum = save(c);
    void cloud().then((store) => store?.save(c, sum));
  }

  /** Bulutta daha yeni bir sürüm varsa (başka cihazda oynandıysa) onu indir. */
  private async fresh(id: string): Promise<Campaign> {
    const local = read<Campaign | null>(KEY(id), null);
    const localAt = read<CampaignSummary[]>(INDEX, []).find((x) => x.id === id)?.updatedAt ?? "";
    const store = await cloud();
    if (store) {
      const remoteAt = await store.updatedAt(id);
      if (remoteAt && (!local || remoteAt > localAt)) {
        const c = await store.load(id);
        if (c) {
          save(c, remoteAt);
          return c;
        }
      }
    }
    if (!local) throw new BackendError("Kampanya bulunamadı");
    return local;
  }

  async getCampaign(id: string): Promise<CampaignData> {
    const c = await this.fresh(id);
    return { id, view: buildView(c), journal: c.journal };
  }

  async playTurn(id: string, input: Parameters<Backend["playTurn"]>[1]): Promise<TurnResponse> {
    const c = load(id);
    const caller = await this.caller();
    const opts = (cl: StructuredCaller | null) => ({
      caller: cl,
      rng: new SeededRng(`${c.seed}:${c.turnCount + 1}:${crypto.randomUUID()}`),
      newId: () => crypto.randomUUID(),
    });
    let out;
    try {
      out = await playCampaignTurn(c, input, opts(caller));
      this.aiOk = !!caller;
    } catch (e) {
      // Claude'a ulaşılamadıysa (izin, limit, bağlantı) tur kural tabanlı modda yine oynanır.
      if (!caller || !(e instanceof LlmError)) throw e;
      this.aiOk = false;
      out = await playCampaignTurn(c, input, opts(null));
    }
    const r = out.result;
    if (r.status === "resolved") {
      this.persist(out.campaign);
      return { status: "resolved", entry: out.entry!, view: buildView(out.campaign), ai: out.entry!.source !== "template" };
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
    await (await cloud())?.remove(id);
  }

  /** Kampanyayı JSON olarak dışa aktar (yedek). */
  exportCampaign(id: string): string {
    return JSON.stringify(load(id));
  }

  importCampaign(json: string): string {
    const c = JSON.parse(json) as Campaign;
    if (c.version !== 1 || !c.id || !c.state) throw new BackendError("Geçersiz kampanya dosyası");
    this.persist(c);
    return c.id;
  }
}
