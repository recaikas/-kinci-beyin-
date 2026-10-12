import { expect, test } from "@playwright/test";

test("yerel mod: karakter yarat, Karaçam'da oyna", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kader Zarı" })).toBeVisible();
  await page.getByRole("button", { name: "+ Yeni kampanya" }).click();

  // Dünya (varsayılan: Karaçam)
  await expect(page.getByRole("button", { name: /Karaçam Sınırı/ })).toBeVisible();
  await page.getByRole("button", { name: "İleri →" }).click();
  // Irk ve sınıf
  await page.getByRole("button", { name: /Tepe Cücesi/ }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByRole("button", { name: /Savaşçı/ }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  // Standart dizi önerisiyle devam
  await page.getByRole("button", { name: "İleri →" }).click();
  // Beceriler
  await page.getByRole("checkbox", { name: /Atletizm/ }).click();
  await page.getByRole("checkbox", { name: /Algı/ }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByLabel("Karakterin adı").fill("Bora");
  await page.getByRole("button", { name: "İleri →" }).click();
  await expect(page.getByText("Tepe Cücesi Savaşçı, 1. seviye")).toBeVisible();
  await page.screenshot({ path: "e2e/out/01-ozet.png" });
  await page.getByRole("button", { name: "Maceraya başla" }).click();

  // Oyun ekranı
  await expect(page.locator(".topbar")).toContainText("Karaçam Kuzey Kapısı");
  await expect(page.locator(".entry").first()).toContainText("Karaçam");
  await page.getByRole("button", { name: "👁 Etrafa bak" }).click();
  await expect(page.locator(".entry")).toHaveCount(2);

  // Serbest metinle hareket
  await page.getByLabel("Eylem").fill("pazara git");
  await page.getByLabel("Eylem").press("Enter");
  await expect(page.locator(".topbar")).toContainText("Karaçam Pazarı");

  // Dükkân
  await page.getByRole("button", { name: "Dükkân" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: "e2e/out/02-dukkan.png" });
  await page.getByRole("dialog").getByRole("button", { name: "Al", exact: true }).nth(1).click();
  await expect(page.locator(".entry").last()).toContainText("satın aldı");
  await page.getByRole("dialog").getByRole("button", { name: "Kapat" }).click();

  // Muhtar ve mektup
  await page.getByRole("button", { name: /Muhtar Konağı/ }).click();
  await expect(page.locator(".topbar")).toContainText("Muhtar Konağı");
  await page.getByLabel("Eylem").fill("mühürlü mektubu muhtar davut'a veriyorum");
  await page.getByLabel("Eylem").press("Enter");
  await expect(page.locator(".entry").last()).toContainText("GÖREV TAMAMLANDI", { timeout: 10_000 }).catch(async () => {
    await page.locator(".entry").last().locator("details summary").click();
    await expect(page.locator(".entry").last()).toContainText("GÖREV TAMAMLANDI");
  });
  await page.getByRole("tab", { name: /Görevler/ }).click();
  await page.getByRole("button", { name: "Görevi kabul et" }).first().click();
  await expect(page.locator(".entry").last()).toContainText("Yeni görev");
  await page.screenshot({ path: "e2e/out/03-gorev.png" });

  // Karakter sayfası
  await page.getByRole("tab", { name: "Karakter" }).click();
  await expect(page.locator(".panel")).toContainText("Bora");
  await page.screenshot({ path: "e2e/out/04-karakter.png" });

  // Yeniden yükle: kayıt localStorage'dan gelir
  await page.reload();
  await expect(page.getByText(/Bora — Karaçam Sınırı/)).toBeVisible();
  await page.getByRole("button", { name: "Devam et" }).click();
  await expect(page.locator(".topbar")).toContainText("Muhtar Konağı");
  expect(errors).toEqual([]);
});

test("yerel mod: savaş akışı", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Yeni kampanya" }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByRole("button", { name: /Barbar/ }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByRole("checkbox", { name: /Atletizm/ }).click();
  await page.getByRole("checkbox", { name: /Hayatta Kalma/ }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByLabel("Karakterin adı").fill("Kurt");
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByRole("button", { name: "Maceraya başla" }).click();
  await expect(page.locator(".topbar")).toContainText("Kuzey Kapısı");
  // Muhafıza saldır → savaş başlar
  await page.getByRole("button", { name: "Saldır", exact: true }).first().click();
  await expect(page.locator(".entry").last()).toContainText(/inisiyatif|İnisiyatif/i);
  await page.screenshot({ path: "e2e/out/05-savas.png" });
  for (let i = 0; i < 15; i++) {
    const combat = await page.locator(".combat").count();
    if (!combat) break;
    const attack = page.locator(".quick button", { hasText: "⚔" }).first();
    if (await attack.count()) await attack.click();
    else {
      const ds = page.locator(".quick button", { hasText: "Ölüm" });
      if (await ds.count()) await ds.click();
      else break;
    }
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: "e2e/out/06-savas-sonu.png" });
});

test("yerel mod: tarihî dünya — Rodos 1570, gemi kâtibi (büyüsüz)", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "+ Yeni kampanya" }).click();
  await page.getByRole("button", { name: /Rodos, 1570/ }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  // Yalnızca insan seçilebilir
  await expect(page.getByRole("button", { name: /Tepe Cücesi/ })).toHaveCount(0);
  await page.getByRole("button", { name: "İleri →" }).click();
  // Büyücü sınıflar yok; tarihî adlar var
  await expect(page.getByRole("button", { name: /Büyücü/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Levent/ }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByRole("checkbox", { name: /Atletizm/ }).click();
  await page.getByRole("checkbox", { name: /Algı/ }).click();
  await page.getByRole("button", { name: "İleri →" }).click();
  await page.getByLabel("Karakterin adı").fill("Piri");
  await page.getByRole("button", { name: "İleri →" }).click();
  await expect(page.getByText(/Levent, 1\. seviye · Gemi Kâtibi/)).toBeVisible();
  await expect(page.getByText(/Fitilli Tüfek/)).toBeVisible();
  await page.screenshot({ path: "e2e/out/07-tarihi-ozet.png" });
  await page.getByRole("button", { name: "Maceraya başla" }).click();

  await expect(page.locator(".topbar")).toContainText("Yeşil Yılan Kadırgası");
  await expect(page.locator(".topbar")).toContainText("Akdeniz, 1570");
  await expect(page.locator(".entry").first()).toContainText("yeni kâtibisin");
  await expect(page.getByRole("tab", { name: "Büyü" })).toHaveCount(0);
  await page.getByLabel("Eylem").fill("ambara in");
  await page.getByLabel("Eylem").press("Enter");
  await expect(page.locator(".topbar")).toContainText("Kadırga Ambarı");
  await page.getByRole("tab", { name: "Karakter" }).click();
  await expect(page.locator(".panel")).toContainText("Levent");
  await page.screenshot({ path: "e2e/out/08-tarihi-ambar.png" });
  expect(errors).toEqual([]);
});
