/**
 * Claude Haiku 5.5 çağrı katmanı. Tüm LLM çağrıları yapılandırılmış JSON çıktı
 * (structured outputs) ile yapılır; serbest metin ayrıştırılmaz.
 *
 * `StructuredCaller` arayüzü sayesinde testler gerçek API'ye gitmeden sahte
 * çağırıcıyla çalışır.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type * as z from "zod/v4";

/** Oyunun kullandığı tek model. */
export const MODEL = "claude-haiku-5-5";

export type Effort = "low" | "medium" | "high";

export interface StructuredRequest<S extends z.ZodType> {
  /** Kararlı sistem metni (önbelleğe alınır). Zaman damgası vb. değişken içerik koyma. */
  system: string;
  /** Sistemden sonra gelen, kampanya boyunca sabit blok (dünya öncülü). Önbelleğe alınır. */
  stablePrefix?: string;
  /** Her tur değişen içerik. */
  user: string;
  schema: S;
  effort?: Effort;
  maxTokens?: number;
  /** Telemetri etiketi: "intent", "narrate", "summarize" … */
  label: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface StructuredResponse<T> {
  data: T;
  usage: Usage;
  model: string;
  latencyMs: number;
}

export class LlmError extends Error {
  constructor(message: string, readonly kind: "refusal" | "truncated" | "parse" | "api", override readonly cause?: unknown) {
    super(message);
    this.name = "LlmError";
  }
}

export interface StructuredCaller {
  call<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResponse<z.infer<S>>>;
}

export class AnthropicCaller implements StructuredCaller {
  constructor(private readonly client: Anthropic, private readonly model: string = MODEL) {}

  async call<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResponse<z.infer<S>>> {
    const started = Date.now();
    const system: Anthropic.TextBlockParam[] = [{ type: "text", text: req.system }];
    if (req.stablePrefix) system.push({ type: "text", text: req.stablePrefix });
    // Önbellek kırılım noktası: kararlı bloğun sonu. Değişken içerik user mesajında.
    system[system.length - 1]!.cache_control = { type: "ephemeral" };

    let response;
    try {
      response = await this.client.messages.parse({
        model: this.model,
        max_tokens: req.maxTokens ?? 4000,
        system,
        messages: [{ role: "user", content: req.user }],
        output_config: {
          effort: req.effort ?? "low",
          format: zodOutputFormat(req.schema),
        },
      });
    } catch (e) {
      if (e instanceof Anthropic.APIError) {
        throw new LlmError(`API hatası (${e.status ?? "?"}): ${e.message}`, "api", e);
      }
      throw e;
    }

    if (response.stop_reason === "refusal") {
      throw new LlmError("Model isteği reddetti", "refusal");
    }
    if (response.stop_reason === "max_tokens") {
      throw new LlmError("Yanıt max_tokens sınırında kesildi", "truncated");
    }
    if (response.parsed_output === null || response.parsed_output === undefined) {
      throw new LlmError("Yapılandırılmış çıktı ayrıştırılamadı", "parse");
    }
    const u = response.usage;
    return {
      data: response.parsed_output as z.infer<S>,
      usage: {
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
        cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      },
      model: response.model,
      latencyMs: Date.now() - started,
    };
  }
}

/** Ortam değişkeninden istemci kur (ANTHROPIC_API_KEY). */
export function createCaller(apiKey?: string): AnthropicCaller {
  return new AnthropicCaller(new Anthropic(apiKey ? { apiKey } : {}));
}
