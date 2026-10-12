/**
 * İstem tabanlı yapılandırılmış çağırıcı: API anahtarı olmadan, "metin ver → JSON
 * al" biçiminde çalışan bir Claude kaynağını (ör. claude.ai sayfasındaki `sample`
 * yeteneği, oyuncunun kendi Claude hesabıyla) `StructuredCaller`'a uyarlar.
 *
 * Yapılandırılmış çıktı garantisi olmadığından istem JSON şemasını içerir ve
 * yanıt şemaya göre doğrulanır; eksik null/dizi alanları onarılır. Model yine
 * yalnızca niyet ve anlatı üretir; durum motorda kalır.
 */
import * as z from "zod/v4";
import { LlmError, MODEL, type StructuredCaller, type StructuredRequest, type StructuredResponse } from "./caller.ts";

/** İstemi gönderip ayrıştırılmış JSON'u döndüren kaynak. `onText`: o ana kadarki ham yanıt. */
export type AskJson = (prompt: string, o: { onText?: (raw: string) => void }) => Promise<unknown>;

export interface PromptCallerOptions {
  /** Akış: etiket ("narrate", "intent" …) ve o ana kadarki ham JSON metni. */
  onStream?: (label: string, raw: string) => void;
  model?: string;
}

/** Kaynağın kalıcı olarak kullanılamadığını bildiren hata kodları (izin yok, kapalı …). */
const FATAL = new Set(["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed", "session_expired"]);

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
};

const allowsNull = (s: JsonSchema | undefined): boolean =>
  !!s && (s.type === "null" || (Array.isArray(s.type) && s.type.includes("null")) || !!(s.anyOf ?? s.oneOf)?.some(allowsNull));

const nonNull = (s: JsonSchema): JsonSchema => (s.anyOf ?? s.oneOf)?.find((x) => x.type !== "null") ?? s;

/** Modelin atladığı alanları şemaya göre tamamla: nullable → null, dizi → []. */
export function repairToSchema(value: unknown, schema: JsonSchema): unknown {
  const s = nonNull(schema);
  if (s.type === "object" && s.properties && value && typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const [k, ps] of Object.entries(s.properties)) {
      if (out[k] === undefined) {
        if (allowsNull(ps)) out[k] = null;
        else if (nonNull(ps).type === "array") out[k] = [];
      } else if (out[k] !== null) {
        out[k] = repairToSchema(out[k], ps);
      }
    }
    return out;
  }
  if (s.type === "array" && s.items && Array.isArray(value)) return value.map((v) => repairToSchema(v, s.items!));
  return value;
}

/**
 * Akış hâlindeki (henüz bitmemiş) JSON metninden bir dize alanının o ana kadarki
 * değerini çıkar. Anlatıyı yazıldıkça göstermek için.
 */
export function partialJsonString(raw: string, key: string): string | null {
  const m = new RegExp(`"${key}"\\s*:\\s*"`).exec(raw);
  if (!m) return null;
  let out = "";
  for (let i = m.index + m[0].length; i < raw.length; i++) {
    const ch = raw[i]!;
    if (ch === '"') return out;
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const nx = raw[i + 1];
    if (nx === undefined) return out;
    if (nx === "u") {
      const hex = raw.slice(i + 2, i + 6);
      if (hex.length < 4) return out;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
      continue;
    }
    out += ({ n: "\n", t: "\t", r: "", b: "", f: "" } as Record<string, string>)[nx] ?? nx;
    i += 1;
  }
  return out;
}

export class PromptCaller implements StructuredCaller {
  /** Kaynak kalıcı olarak kullanılamaz hâle geldiyse nedeni (ör. izin verilmedi). */
  unavailable: string | null = null;

  constructor(private readonly ask: AskJson, private readonly o: PromptCallerOptions = {}) {}

  async call<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResponse<z.infer<S>>> {
    if (this.unavailable) throw new LlmError(this.unavailable, "api");
    const started = Date.now();
    const schema = z.toJSONSchema(req.schema) as JsonSchema;
    const prompt = [
      req.system,
      req.stablePrefix ?? "",
      `GİRDİ (JSON):\n${req.user}`,
      "YANIT BİÇİMİ: Yalnızca aşağıdaki JSON şemasına uyan TEK bir JSON nesnesi yaz. Markdown, açıklama ya da kod bloğu ekleme. "
        + "Şemadaki her alanı yaz; değeri olmayan alanlara null, boş listelere [] yaz.",
      JSON.stringify(schema),
    ].filter(Boolean).join("\n\n");

    let raw: unknown;
    try {
      const onStream = this.o.onStream;
      raw = await this.ask(prompt, onStream ? { onText: (t) => onStream(req.label, t) } : {});
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      const message = (e as { message?: string })?.message ?? String(e);
      if (FATAL.has(code)) {
        this.unavailable = `Claude kullanılamıyor (${code})`;
        throw new LlmError(this.unavailable, "api", e);
      }
      if (code === "refused") throw new LlmError("Model isteği reddetti", "refusal", e);
      if (code === "invalid_json" || code === "empty_completion") throw new LlmError("JSON ayrıştırılamadı", "parse", e);
      throw new LlmError(`Claude hatası (${code || "bilinmiyor"}): ${message}`, "api", e);
    }

    let parsed = req.schema.safeParse(raw);
    if (!parsed.success) parsed = req.schema.safeParse(repairToSchema(raw, schema));
    if (!parsed.success) throw new LlmError(`Şemaya uymayan yanıt: ${parsed.error.message.slice(0, 200)}`, "parse");
    return {
      data: parsed.data,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      model: this.o.model ?? MODEL,
      latencyMs: Date.now() - started,
    };
  }
}
