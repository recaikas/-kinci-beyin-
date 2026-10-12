/**
 * claude.ai sayfa çalışma zamanı: oyun claude.ai'de açıldığında Haiku 5.5'i
 * oyuncunun KENDİ Claude hesabıyla çağırır (API anahtarı gerekmez) ve kayıtları
 * hesaba bağlı veritabanında tutar. claude.ai dışında hepsi `null` döner.
 */
import { PromptCaller } from "@kader/llm";

type Runtime = { use(name: string): Promise<unknown> };

// Sayfanın çalışma zamanı türleri burada yalnızca kullandığımız kadarıyla tanımlı.
export type SampleFn = {
  json(input: string, options?: Record<string, unknown>): Promise<unknown>;
};

function runtime(): Runtime | null {
  const c = (globalThis as { claude?: Runtime }).claude;
  return c && typeof c.use === "function" ? c : null;
}

export function inClaude(): boolean {
  return runtime() !== null;
}

const cache = new Map<string, Promise<unknown>>();
export function useCapability<T>(name: string): Promise<T | null> {
  const r = runtime();
  if (!r) return Promise.resolve(null);
  if (!cache.has(name)) cache.set(name, r.use(name).catch(() => null));
  return cache.get(name)! as Promise<T | null>;
}

/** Anlatı akışı dinleyicileri: ham JSON metni gelir, arayüz anlatıyı çıkarır. */
type StreamListener = (label: string, raw: string) => void;
const listeners = new Set<StreamListener>();
export function onStream(fn: StreamListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const HAIKU = "claude-haiku-5-5";

let caller: PromptCaller | null | undefined;
let pending: Promise<PromptCaller | null> | null = null;

/** Haiku 5.5'e oyuncunun Claude hesabından bağlanan çağırıcı (yoksa null). */
export function sampleCaller(): Promise<PromptCaller | null> {
  if (caller !== undefined) return Promise.resolve(caller);
  pending ??= useCapability<SampleFn>("sample").then((sample) => {
    caller = sample
      ? new PromptCaller(
        (prompt, o) => sample.json(prompt, {
          model: HAIKU,
          modelTier: "quick",
          cache: false,
          ...(o.onText ? { onText: ({ text }: { text: string }) => o.onText!(text) } : {}),
        }),
        { model: HAIKU, onStream: (label, raw) => listeners.forEach((fn) => fn(label, raw)) },
      )
      : null;
    return caller;
  });
  return pending;
}

/** Şu anki durum (senkron; arayüz etiketi için). */
export function sampleState(): "none" | "connecting" | "ready" | "denied" {
  if (!inClaude()) return "none";
  if (caller === undefined) return "connecting";
  if (!caller) return "none";
  return caller.unavailable ? "denied" : "ready";
}
