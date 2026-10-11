import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Küçültücünün çıplak yazdığı U+FFFD'yi kaçış dizisine çevir (bazı barındırıcılar ham U+FFFD'yi reddeder). */
const escapeReplacementChar = (): Plugin => ({
  name: "kz-escape-fffd",
  generateBundle(_opts, bundle) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type === "chunk") chunk.code = chunk.code.replaceAll("\uFFFD", "\\uFFFD");
    }
  },
});

export default defineConfig({
  plugins: [react(), escapeReplacementChar()],
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 2000 },
  server: { port: 5173, host: true },
});
