import { describe, expect, it } from "vitest";
import { IntentSchema, LlmError, NarrationSchema, partialJsonString, PromptCaller, repairToSchema } from "../src/index.ts";
import * as z from "zod/v4";

describe("PromptCaller (anahtarsız, istem tabanlı Claude)", () => {
  it("istem şemayı ve girdiyi içerir; doğru JSON aynen döner", async () => {
    let seen = "";
    const caller = new PromptCaller(async (prompt) => {
      seen = prompt;
      return { narration: "Rüzgâr katran kokuyor.", npc_dialogue: [], suggested_hooks: [], new_fact_candidates: [], mood: "calm" };
    });
    const r = await caller.call({ label: "narrate", system: "SİSTEM", stablePrefix: "DÜNYA", user: '{"x":1}', schema: NarrationSchema });
    expect(r.data.narration).toBe("Rüzgâr katran kokuyor.");
    expect(seen).toContain("SİSTEM");
    expect(seen).toContain("DÜNYA");
    expect(seen).toContain('{"x":1}');
    expect(seen).toContain('"narration"');
  });

  it("modelin atladığı nullable alanları onarır (niyet şeması)", async () => {
    const caller = new PromptCaller(async () => ({ kind: "action", summary: "ambara iner", action: { type: "move", location_id: "ambar", target_ids: [] } }));
    const r = await caller.call({ label: "intent", system: "", user: "", schema: IntentSchema });
    expect(r.data.action?.type).toBe("move");
    expect(r.data.action?.target_id).toBeNull();
    expect(r.data.clarification_question).toBeNull();
  });

  it("izin verilmezse kalıcı olarak kapanır; reddetme ve bozuk JSON doğru türde hata", async () => {
    const denied = new PromptCaller(async () => { throw { code: "not_granted", message: "no" }; });
    await expect(denied.call({ label: "x", system: "", user: "", schema: z.object({ a: z.string() }) })).rejects.toBeInstanceOf(LlmError);
    expect(denied.unavailable).toContain("not_granted");
    const refused = new PromptCaller(async () => { throw { code: "refused", message: "no" }; });
    await expect(refused.call({ label: "x", system: "", user: "", schema: z.object({ a: z.string() }) })).rejects.toMatchObject({ kind: "refusal" });
    const bad = new PromptCaller(async () => ({ a: 5 }));
    await expect(bad.call({ label: "x", system: "", user: "", schema: z.object({ a: z.string() }) })).rejects.toMatchObject({ kind: "parse" });
  });

  it("akış: ham JSON'dan yazılmakta olan anlatı çıkarılır", async () => {
    const seen: string[] = [];
    const caller = new PromptCaller(async (_p, o) => {
      o.onText?.('{"narration":"Kapı gıcır');
      o.onText?.('{"narration":"Kapı gıcırdayarak açılıyor.\\n\\nİçeride');
      return { narration: "Kapı gıcırdayarak açılıyor.\n\nİçeride kimse yok.", npc_dialogue: [], suggested_hooks: [], new_fact_candidates: [], mood: "tense" };
    }, { onStream: (label, raw) => seen.push(`${label}:${partialJsonString(raw, "narration")}`) });
    await caller.call({ label: "narrate", system: "", user: "", schema: NarrationSchema });
    expect(seen).toEqual(["narrate:Kapı gıcır", "narrate:Kapı gıcırdayarak açılıyor.\n\nİçeride"]);
  });

  it("partialJsonString kaçışları ve yarım unicode'u güvenle işler", () => {
    expect(partialJsonString('{"a":1,"narration":"Say \\"evet\\" \\u00e7', "narration")).toBe('Say "evet" ç');
    expect(partialJsonString('{"narration":"yarım \\u00', "narration")).toBe("yarım ");
    expect(partialJsonString('{"other":"x"}', "narration")).toBeNull();
    expect(repairToSchema({ a: { } }, { type: "object", properties: { a: { type: "object", properties: { b: { type: "array" } } } } })).toEqual({ a: { b: [] } });
  });
});
