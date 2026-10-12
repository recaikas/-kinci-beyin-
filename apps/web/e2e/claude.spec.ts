import { expect, type Page, test } from "@playwright/test";

/**
 * claude.ai çalışma zamanının taklidi: `sample` (Haiku 5.5, oyuncunun hesabı),
 * `db` (hesaba bağlı bulut) ve `user`. Bulut verisi sessionStorage'da durur;
 * localStorage silinince "başka bir cihaz" gibi davranır.
 */
async function mockClaude(page: Page) {
  await page.addInitScript(() => {
    const store: Record<string, Record<string, unknown>> = JSON.parse(sessionStorage.getItem("mockdb") ?? "{}");
    const persist = () => sessionStorage.setItem("mockdb", JSON.stringify(store));
    const calls: { model?: string; kind: string }[] = [];
    (window as unknown as { __calls: typeof calls }).__calls = calls;
    const db = {
      collection(path: string) {
        return {
          doc(id: string) {
            const key = `${path}/${id}`;
            return {
              async get() { return { exists: key in store, data: () => store[key] }; },
              async set(d: Record<string, unknown>) { store[key] = JSON.parse(JSON.stringify(d)); persist(); },
              async delete() { delete store[key]; persist(); },
            };
          },
        };
      },
    };
    const sample = {
      async json(prompt: string, o: { model?: string; onText?: (u: { text: string; delta: string }) => void }) {
        if (prompt.includes("niyet çözümleyici")) {
          calls.push({ model: o.model, kind: "intent" });
          return { kind: "action", summary: "etrafa bakar", action: { type: "look", target_ids: [] } };
        }
        calls.push({ model: o.model, kind: "narrate" });
        const part = '{"narration":"Haiku anlatısı: Martılar kadırganın direklerinde çığlık atıyor';
        o.onText?.({ text: part, delta: part });
        await new Promise((r) => setTimeout(r, 400));
        return {
          narration: "Haiku anlatısı: Martılar kadırganın direklerinde çığlık atıyor; katran ve tuz kokusu ciğerlerine doluyor.",
          npc_dialogue: [],
          suggested_hooks: [{ type: "discovery", text: "Ambara iniyorum" }],
          new_fact_candidates: [],
          mood: "calm",
        };
      },
    };
    (window as unknown as { claude: unknown }).claude = {
      use: async (name: string) => (name === "sample" ? sample : name === "db" ? db : name === "user" ? { id: async () => "u1" } : null),
    };
  });
}

test("claude.ai: Haiku hesapla anlatır, öneriye dokunulur, kayıt başka cihazdan açılır", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockClaude(page);
  await page.goto("/");
  await expect(page.getByText(/Claude hesabınla çalışır/)).toBeVisible();
  await expect(page.getByText("Çevrimiçi (Supabase)")).toHaveCount(0);
  await expect(page.getByLabel("Anthropic API anahtarı")).toHaveCount(0);

  await page.getByRole("button", { name: "+ Yeni kampanya" }).click();
  await page.getByRole("button", { name: /Rodos, 1570/ }).click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByRole("checkbox", { name: /Atletizm/ }).click();
  await page.getByRole("checkbox", { name: /Algı/ }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByLabel("Karakterin adı").fill("Piri");
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByRole("button", { name: "Maceraya başla" }).click();
  await expect(page.locator(".topbar")).toContainText("Claude Haiku 5.5");

  // Uzun serbest metin → niyet ve anlatı Haiku'dan; anlatı yazıldıkça görünür.
  await page.getByLabel("Eylem").fill("Güvertede durup limanı ve kadırgaları dikkatlice izliyorum");
  await page.getByLabel("Eylem").press("Enter");
  await expect(page.locator(".entry.pending")).toContainText("Martılar kadırganın direklerinde");
  await expect(page.locator(".entry").last()).toContainText("katran ve tuz kokusu");
  await expect(page.locator(".entry").last()).toContainText("✦ Haiku");
  const calls = await page.evaluate(() => (window as unknown as { __calls: { model?: string; kind: string }[] }).__calls);
  expect(calls.map((c) => c.kind)).toEqual(["intent", "narrate"]);
  expect(calls.every((c) => c.model === "claude-haiku-5-5")).toBe(true);
  await page.screenshot({ path: "e2e/out/09-claude-anlati.png" });

  // Öneriye dokun → hamle olarak gider.
  await page.getByRole("button", { name: "➜ Ambara iniyorum" }).click();
  await expect(page.locator(".topbar")).toContainText("Kadırga Ambarı");

  // Başka cihaz: tarayıcı deposu boş, bulut kaydı duruyor.
  await page.waitForTimeout(300);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText(/Piri — Rodos, 1570/)).toBeVisible();
  await page.getByRole("button", { name: "Devam et" }).click();
  await expect(page.locator(".topbar")).toContainText("Kadırga Ambarı");
  await expect(page.locator(".entry")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("telefon ekranı: hikâye öne çıkar, yan panel kapalı başlar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockClaude(page);
  await page.goto("/");
  await page.getByRole("button", { name: "+ Yeni kampanya" }).click();
  await page.getByRole("button", { name: /Rodos, 1570/ }).click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByRole("checkbox", { name: /Atletizm/ }).click();
  await page.getByRole("checkbox", { name: /Algı/ }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByLabel("Karakterin adı").fill("Piri");
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByRole("button", { name: "Maceraya başla" }).click();
  await expect(page.locator(".side")).toHaveClass(/collapsed/);
  await expect(page.locator(".panel")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "e2e/out/10-telefon.png" });
});
