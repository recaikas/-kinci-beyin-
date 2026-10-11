# Kader Zarı

AI anlatıcılı, **D&D 5e (SRD 5.1) zar mekanikli** RPG / strateji oyunu.
Pax Historia ve Davia'nın "AI'ın her şeyi yönettiği" yaklaşımının tersine:

> **Motor kural koyar, Supabase hatırlar, Claude Haiku 5.5 yalnızca anlatır.**

LLM hiçbir sayıya, envantere, HP'ye, sınıra ya da ilişkiye dokunmaz. Oyunun tüm
durumu Postgres'te (Supabase) tutulur; LLM'e her tur sadece o sahne için gereken
**sabit boyutlu** bir bağlam paketi gider. Bu yüzden hikâye ne kadar uzarsa uzasın
AI "unutmaz" ve maliyet büyümez.

## Bir tur nasıl işler

```
oyuncu metni
   │
   ▼
[1] Niyet Çözümleyici (Haiku 5.5, yapılandırılmış JSON)
       metni SABİT eylem kataloğundan TEK eyleme çevirir; hedefler yalnızca sahnedeki id'ler
   │
   ▼
[2] Kural Motoru (saf TypeScript, deterministik)
       DC, avantaj/dezavantaj, koşullar → zar (sunucuda, tohumlu, loglu) → sonuç kademesi
       StateWriter durumu kopya üzerinde değiştirir, her değişikliği Effect olarak kaydeder
   │
   ▼
[3] Savaş otopilotu (kural tabanlı NPC AI)  — savaştaysa NPC'ler sıralarını oynar
   │
   ▼
[4] Anlatıcı (Haiku 5.5) — "değişmez gerçekler" + sahne + kanon + özet → betimleme
   │
   ▼
[5] Doğrulayıcı (kod) — uydurma sayı, ölü konuşmacı, kilitli kanon ihlali → 1 kez yeniden dene → şablon anlatı
   │
   ▼
[6] apply_turn() — tüm sonuç TEK transaction'da, iyimser eşzamanlılıkla Postgres'e
   │
   ▼
[7] Arka plan — anlatı gömülür (pgvector), her 10 turda bölüm özeti + kalıcı gerçekler
```

## Depo yapısı

| Yol | İçerik |
|---|---|
| `packages/dice` | Zar notasyonu ayrıştırıcı (`4d6kh3`, `2d20kl1`, `1d6!`, `2d6ro<3`, `1d20min10`, `10d6>=5`, `4dF`, aritmetik), kripto/tohumlu RNG, kayıt |
| `packages/engine` | SRD 5.1 kural motoru: yetenekler, 18 beceri, kurtarma, avantaj/dezavantaj, kısmi başarı, karşılıklı/grup kontrolleri, pasif değerler, 14 koşul + bitkinlik, inisiyatif, eylem ekonomisi, saldırı/kritik/siper/menzil, 13 hasar türü + direnç/zafiyet/bağışıklık, geçici HP, 0 HP, ölüm kurtarma, anlık ölüm, konsantrasyon, büyü yuvaları (tam/yarım/pakt), cantrip ölçekleme, üst yuva, dinlenmeler, XP/seviye, karşılaşma zorluğu, sosyal mekanik + rüşvet, fraksiyon/strateji katmanı (diplomasi, ticaret, casusluk, reform, askere alma, zar havuzlu muharebe, zaman atlama ekonomisi), NPC taktik AI, Türkçe ek yardımcıları |
| `packages/llm` | Haiku 5.5 katmanı: niyet çözümleyici, anlatıcı, doğrulayıcı, özetleyici, bağlam paketi, `playTurn` orkestrasyonu |
| `packages/store` | Supabase satırları ↔ motor tipleri, `apply_turn` yükü |
| `supabase/migrations` | Şema (21 tablo), `apply_turn`, `relevant_facts`, `match_memories`, RLS |
| `supabase/functions/turn` | Edge Function (Deno): yetki → yükle → oyna → yaz |
| `supabase/seed.sql` | SRD kataloğu + demo dünyası + `start_demo_campaign()` (üretilir: `npm run gen:seed`) |
| `scripts/play.ts` | Terminal demosu (Haiku ile ya da AI'sız) |
| `docs/PLAN.md` | Pax Historia / Davia analizi ve tam çalışma planı |

## Çalıştırma

```bash
npm install
npm run check                 # tip kontrolü + tüm testler

npm run play                  # AI'sız terminal demosu (komutlar: bak, rüşvet kerem 10, git orman, savaş gob1 gob2, saldır gob1 …)
ANTHROPIC_API_KEY=... npm run play   # Claude Haiku 5.5 anlatıcıyla serbest metin
```

Veritabanı entegrasyon testleri (pgvector'lü PostgreSQL 16 gerekir):

```bash
KZ_TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
```

### Supabase'e kurulum

```bash
supabase link --project-ref <proje>
supabase db push                                   # migration'lar
psql "$DATABASE_URL" -f supabase/seed.sql          # SRD kataloğu + demo dünyası
supabase secrets set ANTHROPIC_API_KEY=...
supabase functions deploy turn
```

İstemci akışı:

```ts
const { data: campaignId } = await supabase.rpc("start_demo_campaign");
const { data } = await supabase.functions.invoke("turn", {
  body: { campaign_id: campaignId, text: "Muhafıza 10 altın uzatıp geçmeye çalışıyorum" },
});
// data.narration.narration, data.rolls, data.outcome, data.player …
```

## Tasarım kararları

- **AI'ın yetki sınırı:** Niyet çözümleyici yalnızca katalogdan eylem seçer; zorluk etiketi
  sınırlı bir ölçekten (5–30) gelir. Anlatıcı sayıları sadece motorun gerçeklerinden kullanabilir;
  önerdiği kancalar ve "yumuşak gerçekler" doğrulanmadan dünyaya yazılmaz, mekanik yüklemler reddedilir.
- **Zar güvenliği:** Zarlar sunucuda atılır; tohum = `kampanya_tohumu:tur:nonce`. Her atış `rolls`
  tablosunda; tur tamamen yeniden üretilebilir.
- **Yarış koruması:** `apply_turn` kampanya satırını kilitler ve beklenen tur numarasını doğrular.
- **RLS:** Oyuncu yalnızca kendi kampanyasını okur; hiçbir tabloya doğrudan yazamaz. NPC sırları
  (`personas.secrets`), kanon gerçekleri ve hafıza istemciye kapalıdır.
- **Önbellek:** Sistem promptu + dünya öncülü kararlı tutulur ve önbelleğe alınır; tur başına
  değişen içerik yalnızca kullanıcı mesajındaki JSON pakettir.
- **Kurallar seçilebilir:** `RAW_RULES` (kitaptaki saf kurallar) veya `DEFAULT_RULES`
  (kısmi başarı, kritik kademeler — anlatıcıya daha çok malzeme).

## Lisans notu

Oyun kuralları ve örnek içerik System Reference Document 5.1'den alınmıştır:

> This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by
> Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document.
> The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License.

"Dungeons & Dragons" markası ve SRD dışı içerik kullanılmaz.
