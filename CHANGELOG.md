# Değişiklik günlüğü

## 1.1.0 — 2026-10-12

- **Anahtarsız Haiku:** Oyun claude.ai'de açıldığında Claude Haiku 5.5 oyuncunun kendi Claude hesabıyla
  anlatır; API anahtarı ya da sunucu gerekmez. Anlatı yazıldıkça ekrana akar.
- **Tarih akışı:** Dünya kendi başına ilerler; görevlerdeki başarıların tarihî olayların dalını seçer
  (Rodos 1570: sefer ilanı, Venedik istihbaratı, erzak yolu, donanmanın çıkışı, Kıbrıs çıkarması).
- **Hikâye odaklı arayüz:** Daha uzun ve döneme sadık anlatı, dokunulabilir hamle önerileri, Dünya sekmesi,
  telefona uygun düzen.
- **Cihazlar arası kayıt:** Kampanyalar Claude hesabına bağlı; telefonda başladığın oyuna bilgisayardan devam edersin.

## 1.0.0 — 2026-10-11

İlk tam sürüm.

### Oyun
- SRD 5.1 tabanlı kural motoru: 12 sınıf (1–20. seviye), 9 ırk, 18 beceri, 14 koşul + bitkinlik,
  inisiyatif ve eylem ekonomisi, saldırı/kritik/siper/menzil, hasar türleri ve dirençler, ölüm kurtarma,
  konsantrasyon, büyü yuvaları, sınıf yetenekleri (Öfke, İkinci Soluk, Eylem Atılımı, Sinsi Saldırı,
  Kurnaz Eylem, Şifa Eli, Kutsal Darbe, Ozan İlhamı, Darbe Yağmuru, Nefes Silahı), dinlenmeler, XP ve seviye.
- Görevler, dükkânlar ve pazarlık, yol karşılaşmaları, ganimet, sosyal eylemler ve rüşvet, fraksiyonlar.
- NPC taktik yapay zekâsı ve savaş otopilotu.
- İki dünya: **Karaçam Sınırı** (fantastik) ve **Rodos, 1570 — Kadırga Kâtibi** (tarihî, büyüsüz;
  oyuncu bir Osmanlı kadırgasının kâtibi olarak başlar).

### Yapay zekâ
- Yalnızca Claude Haiku 5.5: niyet çözümleme ve anlatı. LLM durumu asla doğrudan değiştirmez.
- Anlatı doğrulayıcı (uydurma sayı, ölü konuşmacı, kilitli kanon), şablon anlatıya güvenli düşüş.
- AI'sız mod: kural tabanlı Türkçe niyet çözümleyici ve şablon anlatıcı.
- Her 10 turda bölüm özeti; pgvector hafızası ile uzun kampanyalarda tutarlılık.

### Altyapı
- Supabase: şema, `create_campaign`, iyimser eşzamanlılıklı `apply_turn`, RLS, `campaign` ve `turn` Edge Function'ları.
- Web istemcisi: karakter sihirbazı (dünya, ırk, sınıf, yetenek, beceri), oyun ekranı, zar bildirimleri,
  karakter/envanter/büyü/görev/güç panelleri, dükkân; yerel ve çevrimiçi mod.
- Testler: birim, gerçek PostgreSQL entegrasyon ve Playwright uçtan uca testleri; CI.
