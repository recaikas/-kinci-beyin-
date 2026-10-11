# Kader Zarı — geliştirici notları

- Temel ilke: motor (packages/engine) tüm kuralları ve sayıları belirler; LLM (packages/llm, yalnızca `claude-haiku-5-5`) sadece niyet çözer ve anlatır. LLM çıktısı asla doğrudan duruma yazılmaz.
- Paketler `.ts` uzantılı göreli importlarla yazılır; aynı kaynak hem Node (vitest/tsx) hem Deno (Edge Function, `supabase/functions/turn/deno.json` import map) altında çalışır. Node'a özgü API kullanma (`crypto` global'i kullan).
- Motor fonksiyonları `StateWriter` üzerinden değişiklik yapar; her değişiklik bir `Effect` üretir. Yeni bir durum alanı eklersen: `types.ts` → `store/rows.ts` (to/from) → migration + `apply_turn` güncellemesi.
- Rastgelelik yalnızca `EngineContext`/`Rng` üzerinden; testlerde `FixedRng` ile yüzleri sırayla ver.
- `supabase/seed.sql` üretilen dosyadır: `npm run gen:seed`.
- Kontroller: `npm run check`; DB testleri `KZ_TEST_DATABASE_URL` ile; Edge Function: `cd supabase/functions/turn && deno check index.ts`.
- Kullanıcıya dönük metinler Türkçe; özel isim ekleri için `engine/src/tr.ts` (`genitive`, `dative`, `accusative`, `locative`).
