# AI Anlatıcılı Zar Tabanlı RPG/Strateji Oyunu — Çalışma Planı

> Temel ilke: **Motor kural koyar, veritabanı hatırlar, AI sadece anlatır.**
> LLM (Claude Haiku veya başka bir model) hiçbir sayıya, envantere, HP'ye, sınıra, ilişkiye doğrudan dokunmaz.
> Tüm oyun durumu Supabase'de tutulur; AI'ya her tur yalnızca o sahne için gereken "gerçekler paketi" verilir.

---

## 1. Rakip analizi: Pax Historia ve Davia nasıl çalışıyor?

### 1.1 Pax Historia
- Tarayıcıda çalışan alternatif tarih / büyük strateji oyunu. **Motorun kendisi bir LLM**: Civilization veya EU gibi
  sabit kural motoru yok, sonuçları model üretiyor.
- **Döngü:** Oyuncu düz metinle bir eylem yazar → zaman atlar (1 hafta–1 yıl) → AI sonuçları bir "rapor" olarak anlatır.
- **Chat:** Devlet başkanları, generaller, danışmanlarla serbest diplomatik konuşma (AI karakterler).
- **Create modu:** Harita editörü — bölge çiz, ülkeye ata, tarihsel bağlam, diplomatik ilişkiler, başlangıç koşulları.
  Binlerce topluluk senaryosu.
- **Model:** OpenRouter üzerinden 28+ model seçilebiliyor; günlük ücretsiz token + ücretli token/abonelik.
- **Zayıf noktası (bizim fırsatımız):** Resmi wiki bile modelin "tutarlılığının" (geçmişi, diplomasiyi, simülasyon
  kurallarını hatırlama) modele göre değiştiğini, bazı modellerin "uzun vadeli hafızasının zayıf" olduğunu kabul ediyor.
  Topluluk klonları tüm dünya durumunu her tur prompt'a gömüyor → token maliyeti oyunla büyüyor, model yine de unutuyor
  ve kendi kendisiyle çelişiyor.

### 1.2 Davia
- "Karakter odaklı sandbox RPG". Oyuncu, dünyaya zaten yerleşmiş bir karakteri oynar (ordusu olan komutan,
  rakipleri olan senatör, borçlu tüccar…).
- **Dünya dosyaları:** premise (öncül), rules (kurallar), stats (istatistikler), characters, places, placements
  (kim nerede). Yaratıcılar bunları düzenliyor.
- **Kalıcı sonuçlar:** "Dünya karşılık verir ve hatırlar" — değişen sadakatler, kayan sınırlar anlık değil, kalıcı.
- Hazır dünyalar: Modern World, Turkey Simulation, Cold War 1961 vb. (harita + karakter listesi).

### 1.3 Çıkarılan mantık
| Katman | Pax Historia | Davia | **Bizim oyun** |
|---|---|---|---|
| Kural motoru | LLM | Yarı yapılandırılmış (stats/rules dosyaları) + LLM | **Deterministik kod (TS)** |
| Durum | Büyük ölçüde prompt bağlamında | Dünya dosyaları + AI | **Supabase (Postgres) — tek doğruluk kaynağı** |
| Rastgelelik | Modelin "keyfi" | Belirsiz | **Sunucuda atılan, loglanan D&D zarları** |
| Hafıza | Model bağlamı → unutma | Kalıcı tutma iddiası | **Olay günlüğü + kanon gerçekler + özet + vektör arama** |
| AI'ın işi | Her şey | Simülasyon + anlatım | **Niyet çözümleme + betimleme + hikâye önerisi** |

---

## 2. Mimari

```
[İstemci: Next.js / React (mobil uyumlu)]
        │  oyuncu metni / buton eylemi
        ▼
[Supabase Edge Function: /turn]  ← tüm oyun mantığı burada, istemcide değil
   1. Niyet Çözümleyici (LLM, JSON çıktı)  ──► EylemPlanı
   2. Kural Motoru (saf TS, deterministik) ──► Zar + Sonuç + StateDelta
   3. Delta Uygulayıcı (Postgres transaction) ──► yeni durum
   4. Bağlam Derleyici (SQL + pgvector)      ──► "Gerçekler Paketi"
   5. Anlatıcı (LLM, JSON çıktı)             ──► betimleme + öneriler
   6. Doğrulayıcı (kod)                      ──► önerileri kabul/ret
   7. Kayıt + Realtime yayın
        ▼
[Arka plan işleri: hafıza çıkarımı, bölüm özeti, embedding]
```

### 2.1 Tur akışı (tek tur, adım adım)
1. **Oyuncu yazar:** "Muhafızı rüşvetle ikna edip kapıdan geçmeye çalışıyorum."
2. **Niyet Çözümleyici (küçük/ucuz model, yapılandırılmış çıktı):**
   ```json
   { "action": "skill_check", "skill": "persuasion", "approach": "bribe",
     "target_id": "npc_guard_07", "offer": {"item": "gold", "amount": 20} }
   ```
   - Sadece **sabit eylem kataloğundan** seçebilir (saldır, büyü, yetenek kontrolü, konuş, hareket, kullan, dinlen,
     ticaret, diplomasi, sefer…). Belirsizse oyuncuya soru döner, tahmin etmez.
   - Kod doğrular: hedef bu sahnede mi? 20 altın var mı? Yoksa eylem reddedilir — AI'ya hiç gitmez.
3. **Kural Motoru:** DC'yi hesaplar (NPC tavrı, rüşvet miktarı, itibar → modifiye), avantaj/dezavantajı belirler,
   `d20 + CHA mod + yeterlilik` atar. Sonuç kademesi: kritik başarısızlık / başarısızlık / kısmi başarı / başarı / kritik.
4. **StateDelta:** `gold -20`, `npc_guard_07.attitude: hostile→friendly`, `player.location: gate→city`, `time +10dk`.
   Tek transaction'da uygulanır.
5. **Bağlam Derleyici:** Sahne, ilgili varlıkların kartları, son N tur, ilgili kanon gerçekler (vektör + etiket araması),
   açık görevler, bölüm özeti → küçük, odaklı bir paket.
6. **Anlatıcı (Haiku):** "Şu oldu: zar 17, DC 13, başarı. Şunlar değişti: … Bunu betimle." Çıktı:
   ```json
   { "narration": "...", "npc_dialogue": [...],
     "suggested_hooks": [{"type":"rumor","text":"Muhafız kuzeydeki kaçakçılardan bahsetti"}],
     "new_fact_candidates": [{"subject":"npc_guard_07","fact":"Kızının adı Elif"}] }
   ```
7. **Doğrulayıcı:** Anlatı motorun sonucuyla çelişiyor mu (ör. başarısız denemeyi başarılı anlatma, olmayan eşya
   verme)? Basit kurallar + gerekirse ikinci kısa kontrol çağrısı. `new_fact_candidates` yalnızca **yumuşak alanlara**
   (geçmiş, kişilik, söylenti) yazılabilir; sert alanlara (HP, altın, sınır, ilişki puanı) asla.
8. **Kayıt:** `turns`, `rolls`, `events`, `state_snapshots` tabloları + istemciye Realtime.

### 2.2 AI'ın yetki sınırı (en kritik kural)
| AI **yapabilir** | AI **yapamaz** |
|---|---|
| Sahneyi, NPC'yi, sonucu betimlemek | Zar atmak / sonucu değiştirmek |
| Diyalog yazmak (NPC'nin kayıtlı kişiliğine göre) | HP, altın, envanter, XP, sınır, ilişki puanı değiştirmek |
| Kanca/söylenti/görev **önermek** | Önerisini doğrudan dünyaya yazmak (motor onaylar) |
| Yeni yumuşak detay önermek (isim, görünüm) | Kanon gerçekle çelişmek |
| Oyuncu metnini eyleme çevirmek | Katalog dışı eylem uydurmak |

### 2.3 Model katmanı
- `LLMProvider` arayüzü: `parseIntent()`, `narrate()`, `summarize()`, `extractFacts()`. Haiku, başka bir Claude
  modeli veya OpenRouter üzerinden başka modeller takılabilir (Pax Historia gibi oyuncuya model seçimi de sonradan
  eklenebilir).
- Varsayılan: niyet + özet + çıkarım için en ucuz model, anlatım için Haiku (kalite yetmezse Sonnet'e yükseltme opsiyonu).
- **Prompt caching:** Dünya öncülü + kural özeti + anlatım stili sabit blok olarak önbelleğe alınır; her tur sadece
  değişen paket gönderilir → maliyet oyun uzadıkça **sabit kalır** (Pax Historia'nın tersine).
- Tüm çağrılar yapılandırılmış JSON çıktı; şema dışı cevap → tekrar dene → yedek şablon anlatım.

---

## 3. Hafıza sistemi ("AI unutur, Supabase unutmaz")

| Katman | Tablo | Ne tutar | AI'ya nasıl gider |
|---|---|---|---|
| Sert durum | `characters`, `inventory`, `factions`, `regions`… | Sayılar, sahiplik, konum | Sadece sahnedeki varlıkların kartı |
| Olay günlüğü | `events` | Her turun ne olduğu (yapılandırılmış) | Son N olay |
| Kanon gerçekler | `facts` (subject, predicate, value, kaynak tur, güven) | "Kral öldü", "Elif muhafızın kızı" | Etiket + pgvector ile ilgili 10–20 gerçek |
| Özetler | `summaries` (sahne → bölüm → sefer) | Hiyerarşik özet | Mevcut bölüm özeti + sefer özeti |
| İlişkiler | `relationships` (a, b, puan, etiketler) | Tutum, borç, kin | Sahnedekiler arası |
| Embedding | `memory_chunks` (vector) | Anlatı parçaları | Semantik arama |

- Her N turda (veya sahne bitince) arka plan işi: olayları özetler, yeni gerçek adaylarını çıkarır, çelişki kontrolü yapar.
- **Kanon kilidi:** Bir gerçek "kilitli" ise sonraki hiçbir anlatı/öneri onu değiştiremez; sadece motor olayı
  (ör. "kral öldürüldü" eylemi) değiştirebilir.

---

## 4. D&D zar mekaniği (geniş kapsam)

> Hukuki not: Kurallar **SRD 5.1 / SRD 5.2 (CC-BY-4.0)** üzerinden alınmalı; "Dungeons & Dragons" markası,
> Beholder/Mind Flayer gibi korumalı içerik kullanılmamalı. Atıf metni oyuna eklenir.

### 4.1 Zar altyapısı
- Notasyon ayrıştırıcı: `d20`, `2d6+3`, `4d6kh3` (en yüksek 3), `2d20kl1` (dezavantaj), `1d6!` (patlayan),
  `r1` (1'leri tekrar at), `d%`.
- **Sunucu tarafında** kriptografik RNG; her atış `rolls` tablosuna: ifade, tekil sonuçlar, toplam, sebep, tur, seed.
  İstemci zar atmaz (hile önleme). İsteğe bağlı "tekrarlanabilir seed" ile replay/hata ayıklama.
- Zar animasyonu istemcide, sonuç sunucudan.

### 4.2 Karakter çekirdeği
- 6 yetenek (STR, DEX, CON, INT, WIS, CHA), modifiye = ⌊(skor−10)/2⌋; karakter yaratma: standart dizi / puan alımı /
  `4d6kh3`.
- Yeterlilik bonusu (seviyeye göre +2…+6), 18 beceri, uzmanlık (expertise), 6 kurtarma atışı.
- Irk/köken, sınıf, alt sınıf, geçmiş (background), yetenek (feat), seviye 1–20, XP veya kilometre taşı ile seviye.
- AC, HP, Hit Dice, hız, inisiyatif, pasif Algı/Araştırma/Sezgi.

### 4.3 Kontroller
- Yetenek/beceri kontrolü, DC ölçeği 5/10/15/20/25/30.
- Avantaj/dezavantaj (birbirini iptal eder, yığılmaz).
- Karşılıklı kontrol (Gizlilik vs Algı, Atletizm vs Akrobasi).
- Grup kontrolü (yarısı başarılıysa başarı), yardım (Help → avantaj).
- İlham (Inspiration), şans/yeniden atma yetenekleri.
- Kısmi başarı kademesi ("başarı ama bedeli var") — anlatıya malzeme verir; DC−5 ile DC arası.

### 4.4 Savaş
- İnisiyatif sırası, tur yapısı: Eylem / Bonus Eylem / Reaksiyon / Hareket.
- Saldırı atışı vs AC, kritik vuruş (nat 20 → zarlar 2x), nat 1 otomatik ıska.
- Hasar türleri (13 tür), direnç / bağışıklık / zafiyet.
- Fırsat saldırısı, siper (yarım +2, ¾ +5), menzil ve uzun menzil dezavantajı.
- Koşullar: Kör, Büyülenmiş, Sağır, Korkmuş, Yakalanmış, Etkisiz, Görünmez, Felçli, Taşlaşmış, Zehirlenmiş, Yerde,
  Kısıtlanmış, Sersemlemiş, Bilinçsiz + Bitkinlik seviyeleri.
- Ölüm kurtarma atışları (3 başarı/3 başarısızlık, nat 20 → 1 HP), anlık ölüm.
- Savaş ızgarası opsiyonel: ilk sürümde "teatral" (bölge/mesafe bandı: yakın/orta/uzak), sonra kare ızgara.

### 4.5 Büyü
- Büyü yuvaları (seviye tablosu), hazırlanan/bilinen büyüler, ritüel, konsantrasyon (hasar alınca CON kurtarma,
  DC = max(10, hasar/2)).
- Büyü saldırısı / kurtarma DC'si = 8 + yeterlilik + mod.
- Büyüler **veri** olarak tanımlanır (JSON): menzil, alan, kurtarma, hasar ifadesi, ölçekleme, süre. Motor bunları
  çalıştırır; AI sadece görsel betimlemeyi yapar.

### 4.6 Keşif ve dinlenme
- Kısa dinlenme (Hit Dice harca), uzun dinlenme; zaman takibi (oyun içi saat/gün), seyahat hızı, rastgele karşılaşma
  tabloları (zarla), yiyecek/su, taşıma kapasitesi, ışık/görüş.
- Tuzaklar (algı DC + kurtarma), kilit açma (alet yeterliliği).

### 4.7 Sosyal mekanik
- NPC tutumu: Düşman / Kayıtsız / Dost (+ sayısal ilişki puanı), ikna/aldatma/gözdağı DC'si tutuma göre.
- İtibar (fraksiyon başına), borç ve iyilik kayıtları.

### 4.8 Strateji katmanı (Pax Historia tarzı makro oyun, zarla)
Davia/Pax Historia'nın "ülke/fraksiyon" boyutunu zarlarla ve sayılarla deterministik hale getiriyoruz:
- Fraksiyon kartı: hazine, asker gücü, istikrar, nüfus, teknoloji, ilişkiler matrisi — **tümü tabloda**.
- Makro eylemler: diplomasi teklifi, ticaret anlaşması, casusluk, sefer, reform, inşaat.
- Çözüm: `d20 + ilgili istatistik modu + durumsal modlar` vs DC veya karşı fraksiyonun atışı; savaşlar için
  güç oranına göre zar havuzu (ör. her 1000 asker = 1d6, sur = +AC benzeri savunma).
- **Zaman atlama (1 hafta–1 yıl):** Motor, ekonomi/nüfus/ordu tick'lerini formülle hesaplar, AI fraksiyonların
  "niyetini" seçmesi için yalnızca katalogdan öneri yapar; sonra AI gelişmeleri **rapor** olarak anlatır.
- AI liderlerle diplomatik sohbet: Sohbet serbest, ama anlaşma ancak motorun "kabul atışı" ve ilişki puanı
  eşiği tutarsa imzalanır.

---

## 5. Supabase veri modeli (ilk taslak)

```
users (auth)              campaigns(id, owner_id, world_id, settings, seed, current_turn, game_time)
worlds(id, premise, rules_json, style_guide, srd_version, is_public)   -- Davia'daki "dünya dosyaları"
places(id, world_id, parent_id, name, description, tags, coords)
characters(id, campaign_id, kind[pc|npc], name, race, class, level, xp,
           abilities jsonb, hp, max_hp, temp_hp, ac, speed, conditions jsonb,
           spell_slots jsonb, location_id, faction_id, personality jsonb, is_alive)
items(id, world_id, name, type, properties jsonb, weight, value)
inventory(character_id, item_id, qty, equipped, attuned)
spells(id, srd_key, data jsonb)          abilities_catalog(id, data jsonb)
factions(id, campaign_id, name, treasury, military, stability, population, tech, traits jsonb)
regions(id, campaign_id, owner_faction_id, geometry, resources jsonb)
relationships(campaign_id, a_id, b_id, score, tags)
quests(id, campaign_id, status, giver_id, objectives jsonb, rewards jsonb)
encounters(id, campaign_id, initiative_order jsonb, round, active_index, state)
turns(id, campaign_id, n, player_input, intent jsonb, outcome jsonb, narration, model, tokens, latency)
rolls(id, turn_id, expr, dice int[], total, reason, actor_id, target_id, dc, result_tier)
events(id, campaign_id, turn_id, type, payload jsonb, game_time)          -- değişmez günlük
state_deltas(id, turn_id, table_name, row_id, before jsonb, after jsonb) -- geri alma/denetim
facts(id, campaign_id, subject_id, predicate, value, locked, source_turn, confidence)
summaries(id, campaign_id, level[scene|chapter|campaign], range, text)
memory_chunks(id, campaign_id, content, embedding vector(…), refs)
```
- **RLS:** Oyuncu sadece kendi kampanyasını okur; **yazma yalnızca Edge Function'dan (service role)**.
- `pgvector` eklentisi, `pg_cron` (özet/bakım işleri), Realtime (çok oyunculu masa için).
- `state_deltas` sayesinde "son turu geri al" ve hata ayıklama mümkün.

---

## 6. Teknoloji yığını
- **Frontend:** Next.js + TypeScript + Tailwind, mobil öncelikli; zar animasyonu (ör. 3D dice kütüphanesi),
  harita için SVG/Leaflet (strateji katmanı).
- **Backend:** Supabase (Postgres, Auth, Edge Functions/Deno, Realtime, Storage).
- **Kural motoru:** Ayrı, saf TypeScript paketi (`/packages/engine`) — hem Edge Function'da hem testlerde çalışır,
  hiçbir ağ/AI bağımlılığı yok. %90+ birim test kapsamı.
- **LLM:** Anthropic API (Haiku varsayılan) + sağlayıcı adaptörü.
- **Monorepo:** `apps/web`, `packages/engine`, `packages/dice`, `packages/llm`, `supabase/migrations`,
  `supabase/functions`, `content/srd`.

---

## 7. Fazlar ve teslimatlar

### Faz 0 — Kurulum (1 hafta)
- Yeni repo, monorepo iskeleti, Supabase projesi, CI (lint + test), ortam değişkenleri.
- SRD içeriğini JSON'a dönüştürme betiği (ırklar, sınıflar, büyüler, eşyalar, canavarlar).
- **Çıktı:** Boş ama deploy edilen uygulama + migration'lar.

### Faz 1 — Zar ve kural motoru (2 hafta)
- Zar notasyon ayrıştırıcı + RNG + loglama.
- Karakter yaratma, yetenek/beceri/kurtarma kontrolleri, avantaj/dezavantaj, DC, kısmi başarı.
- Saf fonksiyon: `resolve(action, state) → {rolls, outcome, delta}`.
- **Çıktı:** AI olmadan, terminalden/testten oynanabilen kontrol sistemi.

### Faz 2 — Veri ve tur döngüsü (2 hafta)
- Supabase şeması, RLS, `/turn` Edge Function, delta uygulama transaction'ı, olay günlüğü.
- Basit UI: sohbet akışı + karakter kartı + zar sonucu.
- **Çıktı:** Butonla eylem seç → zar → durum değişir → şablon metin.

### Faz 3 — AI katmanı (2 hafta)
- Niyet çözümleyici (eylem kataloğu + JSON şema), anlatıcı, doğrulayıcı, prompt caching.
- Bağlam derleyici (son turlar + sahne varlıkları + gerçekler).
- **Çıktı:** Serbest metinle oynanan, AI'ın betimlediği tek oyunculu macera.

### Faz 4 — Hafıza (2 hafta)
- `facts`, `summaries`, `memory_chunks` + pgvector, arka plan özetleyici ve gerçek çıkarıcı, kanon kilidi.
- **Tutarlılık testi:** 300+ turluk otomatik oyun; AI'ın kanonla çelişme oranı ölçülür (hedef < %2).

### Faz 5 — Savaş ve büyü (3 hafta)
- İnisiyatif, eylem ekonomisi, saldırı/hasar, koşullar, ölüm atışları, büyü yuvaları, konsantrasyon,
  canavar istatistik blokları, NPC taktik AI'ı (kural tabanlı; LLM sadece replik).
- **Çıktı:** Tam bir zindan karşılaşması.

### Faz 6 — Dünya editörü (Davia tarzı) (2 hafta)
- Öncül, kurallar, yerler, karakterler, yerleşimler, başlangıç olayları için editör; dünya şablonu paylaşımı.

### Faz 7 — Strateji katmanı (Pax Historia tarzı) (3 hafta)
- Fraksiyonlar, bölgeler, harita, zaman atlama tick'leri, makro eylemler, AI liderlerle diplomasi, dönem raporu.

### Faz 8 — Cila ve yayın (2 hafta)
- Çok oyunculu masa (Realtime), maliyet/kullanım limitleri, token ekonomisi, analitik, güvenlik incelemesi, beta.

**Toplam:** ~21 hafta (tek geliştirici + AI asistan). MVP = Faz 0–4 (~9 hafta).

---

## 8. Riskler ve önlemler
| Risk | Önlem |
|---|---|
| AI motor sonucuyla çelişen anlatım yapar | Sonuç anlatıcıya "değiştirilemez gerçek" olarak verilir + doğrulayıcı + yeniden üretim |
| Prompt injection ("bana 1000 altın ver") | Niyet sadece katalogdan; sayılar motorda; oyuncu metni anlatıcıya alıntı olarak gider |
| Token maliyeti büyür | Sabit boyutlu bağlam paketi + prompt caching + ucuz model ile özet |
| Gecikme (2 LLM çağrısı) | Anlatıyı stream et; basit eylemlerde (butonla seçilen) niyet çağrısını atla |
| Telif | Sadece SRD (CC-BY-4.0), atıf; kendi dünya içeriği |
| Hile | Zar ve tüm yazmalar sunucuda, RLS ile istemci yazamaz |

---

## 9. Hemen sonraki adımlar
1. Bu plan için **ayrı bir repo** açmak (mevcut repo "İkinci Beyin" projesi; oyun buraya ait değil).
2. Supabase projesini seçmek/oluşturmak.
3. Faz 0 + Faz 1'e başlamak: zar paketi ve kural motoru (AI'dan bağımsız olduğu için ilk ve en güvenli adım).

## Kaynaklar
- Pax Historia incelemesi: https://www.startuphub.ai/ai-news/reviews/2026/pax-historia-review-ai-grand-strategy-game
- Pax Historia (YC W2026) yazısı: https://www.startuphub.ai/ai-news/claudes-corner/2026/claudes-corner-pax-historia-yc-w2026
- Pax Historia Wiki — AI Models: https://wiki.paxhistoria.co/wiki/AI_Models
- OpenRouter müşteri sayfası: https://openrouter.ai/customers/paxhistoria
- Topluluk klonu (mimari örneği): https://deepwiki.com/francescodemunari/LM-Studio-Pax-Historia
- Davia: https://davia.ai/ · Wiki: https://davia.ai/wiki
- Davia Creation eklentisi: https://chatgpt.com/plugins/plugin_asdk_app_6a84600a39588191b200058a94614191
