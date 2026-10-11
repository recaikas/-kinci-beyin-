import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Bulut geliştirme ortamında önceden kurulu Chromium; CI'da Playwright'ın kendi tarayıcısı.
const local = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:4173",
    launchOptions: local && existsSync(local) ? { executablePath: local } : {},
    viewport: { width: 1360, height: 860 },
  },
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: true,
  },
});
