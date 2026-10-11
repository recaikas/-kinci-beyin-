# Kader Zarı — geliştirici notları

- Temel ilke: motor (packages/engine) tüm kuralları ve sayıları belirler; LLM (packages/llm, yalnızca `claude-haiku-5-5`) sadece niyet çözer ve anlatır. LLM çıktısı asla doğrudan duruma yazılmaz.
- Paketler `.ts` uzantılı göreli importlarla yazılır; aynı kaynak hem Node (vitest/tsx) hem Deno (Edge Function) altında çalışır; Edge Function'lar `npm run bundle:functions` ile `supabase/functions/dist/` altına esbuild paketi olarak üretilir ve commit'lenir (deploy edilen giriş dosyası jsDelivr'dan commit'e sabitlenmiş paketi import eder). Node'a özgü API kullanma (`crypto` global'i kullan).
- Motor fonksiyonları `StateWriter` üzerinden değişiklik yapar; her değişiklik bir `Effect` üretir. Yeni bir durum alanı eklersen: `types.ts` → `store/rows.ts` (to/from) → migration + `apply_turn` güncellemesi.
- Rastgelelik yalnızca `EngineContext`/`Rng` üzerinden; testlerde `FixedRng` ile yüzleri sırayla ver.
- Dünyalar `packages/game/src/templates/` altında; `TEMPLATES`'e kaydedilir. `setting` ile dönem, büyü açık/kapalı, izinli ırk/sınıf, sınıf adları ve başlangıç donanımı belirlenir (ör. `akdeniz1570` büyüsüz tarihî dünya). Şablon bütünlüğü testi tüm anahtarları denetler.
- Kontroller: `npm run check`; DB testleri `KZ_TEST_DATABASE_URL` ile; web: `npm run build` ve `npm run e2e`; motor/oyun kodu değişince `npm run bundle:functions` çalıştırıp `dist/`'i commit'le.
- Kullanıcıya dönük metinler Türkçe; özel isim ekleri için `engine/src/tr.ts` (`genitive`, `dative`, `accusative`, `locative`).
