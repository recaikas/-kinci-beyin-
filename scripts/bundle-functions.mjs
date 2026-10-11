// Edge Function'ları kendi kendine yeten tek dosyalara paketler (npm bağımlılıkları dahil).
// Çıktı: supabase/functions/dist/{turn,campaign}.js — giriş dosyaları bunları CDN'den içe aktarır.
import { build } from "esbuild";

for (const fn of ["turn", "campaign"]) {
  const r = await build({
    entryPoints: [`supabase/functions/${fn}/index.ts`],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    legalComments: "none",
    conditions: ["deno", "worker", "browser"],
    outfile: `supabase/functions/dist/${fn}.js`,
    logLevel: "warning",
    metafile: true,
  });
  const bytes = Object.values(r.metafile.outputs)[0].bytes;
  console.log(`${fn}.js ${(bytes / 1024).toFixed(0)} KB`);
}
