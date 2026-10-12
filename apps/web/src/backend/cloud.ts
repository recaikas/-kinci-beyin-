/**
 * Cihazlar arası kayıt: claude.ai'de açılan oyun, kampanyaları oyuncunun Claude
 * hesabına bağlı özel veritabanında (data/users/<id>/…) tutar. Telefonda başlanan
 * kampanya bilgisayarda kaldığı yerden sürer. Tarayıcı deposu hızlı çalışma kopyasıdır.
 *
 * Belge düzeni (hepsi kullanıcının özel koleksiyonunda):
 *   index            → { list: CampaignSummary[] }
 *   c_<id>           → { json: <günlüksüz kampanya>, journalLen, updatedAt }
 *   j_<id>_<k>       → { json: <k. günlük parçası, CHUNK kayıt> }
 */
import type { Campaign, JournalEntry } from "@kader/game";
import type { CampaignSummary } from "./types.ts";
import { useCapability } from "./claude.ts";

const CHUNK = 20;

type DocSnap = { exists: boolean; data(): Record<string, unknown> | undefined };
type DocRef = { get(): Promise<DocSnap>; set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> };
type Col = { doc(id: string): DocRef };
type Db = { collection(path: string): Col };
type User = { id(): Promise<string | null> };

export class CloudStore {
  private queue: Promise<unknown> = Promise.resolve();
  /** Buluttaki günlük uzunluğu (kampanya başına, bu oturumda öğrenilen). */
  private remoteLen = new Map<string, number>();

  private constructor(private readonly col: Col) {}

  static async connect(): Promise<CloudStore | null> {
    const [db, user] = await Promise.all([useCapability<Db>("db"), useCapability<User>("user")]);
    if (!db || !user) return null;
    try {
      const uid = await user.id();
      return uid ? new CloudStore(db.collection(`data/users/${uid}`)) : null;
    } catch {
      return null;
    }
  }

  /** Yazmaları sıraya koy: aynı belgeye aynı anda bir yazma. Hata oyunu durdurmaz. */
  private enqueue(fn: () => Promise<unknown>): Promise<void> {
    const next = this.queue.then(fn).catch((e) => console.warn("Bulut kaydı başarısız:", e));
    this.queue = next;
    return next.then(() => undefined);
  }

  async index(): Promise<CampaignSummary[]> {
    try {
      const d = await this.col.doc("index").get();
      return d.exists ? ((d.data()!.list as CampaignSummary[]) ?? []) : [];
    } catch {
      return [];
    }
  }

  /** Buluttaki kampanyanın son güncellenme zamanı (yoksa null). */
  async updatedAt(id: string): Promise<string | null> {
    try {
      const d = await this.col.doc(`c_${id}`).get();
      return d.exists ? String(d.data()!.updatedAt) : null;
    } catch {
      return null;
    }
  }

  async load(id: string): Promise<Campaign | null> {
    const core = await this.col.doc(`c_${id}`).get();
    if (!core.exists) return null;
    const data = core.data()!;
    const c = JSON.parse(String(data.json)) as Omit<Campaign, "journal">;
    const len = Number(data.journalLen) || 0;
    const chunks = await Promise.all(
      Array.from({ length: Math.ceil(len / CHUNK) }, (_, k) => this.col.doc(`j_${id}_${k}`).get()),
    );
    const journal = chunks.flatMap((s) => (s.exists ? (JSON.parse(String(s.data()!.json)) as JournalEntry[]) : []));
    this.remoteLen.set(id, journal.length);
    return { ...c, journal } as Campaign;
  }

  save(c: Campaign, summary: CampaignSummary): Promise<void> {
    return this.enqueue(async () => {
      const { journal, memories: _m, ...core } = c;
      let known = this.remoteLen.get(c.id);
      if (known === undefined) {
        const d = await this.col.doc(`c_${c.id}`).get();
        known = d.exists ? Number(d.data()!.journalLen) || 0 : 0;
      }
      // Yeni kayıtların düştüğü parçaları yaz (son parça her seferinde güncellenir).
      const from = Math.floor(Math.min(known, journal.length - 1) / CHUNK);
      const to = Math.floor((journal.length - 1) / CHUNK);
      for (let k = Math.max(0, from); k <= to; k++) {
        await this.col.doc(`j_${c.id}_${k}`).set({ json: JSON.stringify(journal.slice(k * CHUNK, (k + 1) * CHUNK)) });
      }
      await this.col.doc(`c_${c.id}`).set({ json: JSON.stringify(core), journalLen: journal.length, updatedAt: summary.updatedAt });
      this.remoteLen.set(c.id, journal.length);
      const list = (await this.index()).filter((x) => x.id !== c.id);
      await this.col.doc("index").set({ list: [summary, ...list].slice(0, 100) });
    });
  }

  remove(id: string): Promise<void> {
    return this.enqueue(async () => {
      const d = await this.col.doc(`c_${id}`).get();
      const len = d.exists ? Number(d.data()!.journalLen) || 0 : 0;
      for (let k = 0; k < Math.ceil(len / CHUNK); k++) await this.col.doc(`j_${id}_${k}`).delete();
      await this.col.doc(`c_${id}`).delete();
      const list = (await this.index()).filter((x) => x.id !== id);
      await this.col.doc("index").set({ list });
      this.remoteLen.delete(id);
    });
  }
}
