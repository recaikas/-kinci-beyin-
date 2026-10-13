# PDF özeti — Hibrit Yönetim Oyunu Mekanik Çözümleme Derlemesi

Kaynak: `Hibrit_Oyun_Mekanik_Cozumleme_Derlemesi.pdf` (79 sayfa, 13 Ekim 2026).
Bu dosya, PDF'i tekrar okumadan çalışabilmek için çıkarılmış kısa nottur.
Etiketler: **V** doğrulanmış · **L** sınırlı (oyuncu/rehber) · **P** bizim önerimiz.

## Çekirdek ilkeler (Bölüm V)
- Kod kural taşır, veri sayı taşır. Tüm sabitler `pack` içinde, `_tag` ile.
- Her para hareketi defterden (ledger) geçer; `cash +=` yok.
- Sistemler olay veriyolu ile konuşur (`on/off/fire`).
- Tohumlu RNG; `Math.random` yok.
- Sistem sırası her hafta: takvim → personel/üretim → araştırma → satış → ekonomi → olaylar.
- 1 ay = 4 hafta, 1 yıl = 48 hafta. Oyun uzunluğu 30/35/42 yıl → çarpan 1 / 1,16667 / 1,4 (V).
  `tablo yılı = başlangıç + (yıl − başlangıç) / çarpan`.

## Mekân
Kademeler: Garaj (1 koltuk) → Küçük ofis (4) → Büyük ofis (6) → ArGe kampüsü (12+). Garajdan çıkış ~1M (L), kampüs ~5M (L).
İş istasyonu T0..T4 (≤1980, 1980–90, 1990–2000, 2000–12, 2012+), açtığı platform techLevel ≤2/≤4/≤6/7/7.
`istasyonKatkısı = clamp(1 + 0.15 × (kademe − beklenenKademe(yıl)), 0.7, 1.5)`; maliyet `6 × aylık maaş × 2^kademe`.

## Üretim
- 9 görev (GDT): Motor, Oynanış, Hikaye | Diyalog, Seviye, YZ | Dünya, Grafik, Ses.
  Disiplin eşlemesi: Motor+YZ→Teknik; Oynanış/Hikaye/Diyalog/Seviye→Oynanış; Dünya/Grafik→Grafik; Ses→Ses.
- `kişi_hafta = K × beceri × m(yıl) × η(n) × istasyon / 4`, K = 0,784, beceri 35'ten +2,7/yıl, tavan 75.
- `m(yıl)`: 1976 1,0 · 1980 1,65 · 1985 2,4 · 1990 2,6 · 2000 2,85 · 2010 3,6 · 2020 5,6.
- `η(n) = max(0,7; 1 − 0,015 × (n − 10))`.
- Kaydırıcı hizası `hiza = max(0,5; 1 − 0,5 × Σ|payA − payW|)`.
- Uyum `F = √(konu×tür · konu×kitle · platform×tür · platform×kitle)`; ağırlıklar 0,6–1,0 (V).
- Hata cezası `min(10; 20 × hataOranı)`; alt tür yoksa −3 (V).

## Değerlendirme
`T_d = H(y) × D × τ_d(y) × 1,11^P`
`not = F × Σ w_d × 98 × min(1; puan_d × hiza / T_d) − 3[alt tür yok] − min(10; 20 × hata)`
- H (Kolay hedef): 40 (1976) → 80 (1979) → 363 (1985) → 889 (1990) → 1334 (1994) → 3700 → 11000 (log).
- D: 0,7 / 1 / 1,5 / 1,8 / 2,2 / 3 (V). τ teknik: 1,125 (1976–78) → 1,25 → 1,0 (1994).
- Prestij P: 90+ not → +1, yılda −0,5, en fazla 5.
- w_d (Oynanış/Grafik/Ses/Teknik): Aksiyon .397/.231/.115/.256 · Macera,RPG .468/.247/.104/.182 ·
  Simülasyon .425/.225/.113/.237 · Strateji .438/.225/.113/.225 · Casual .472/.236/.125/.167.
- Oyun boyutu cezası (MGT2, V): 1983+ B −1; 1988+ B −2, B+ −1; 1995+ −3/−2/−1; 2004+ −4..−1; 2020+ −5..−1.

## Satış
`zirve = B · Pz(y) · Z · S(n) · (1 + 0,2·IP·d) · F_hayran · H_hype · (35/fiyat)^1,5 · Y · St · I`
- B 57000; Pz 1976 0,02 → 1992 1 → 2025 8; Z 1/0,5/0,25/0,15/0,10/0,07.
- S(n) = e^(0,09(n−90)); n<60 iken e^(−2,7)·e^(0,2(n−60)).
- d (IP): 0,70/0,45/0,38/0,36/0,34/0,30 (V). F = 1 + 0,5·log10(hayran/10k). H = 1 + 0,15·hype/100.
- Y = 0,15 + 0,85·güç/100; St = 0,3 + 0,7·min(stüdyo,5)/5; I = 0,5 + 0,5·min(IP,1).
- Hafta eğrisi: %60, %85, %100, sonra 0,85·0,95^(h−4), zirvenin %2'sine kadar.
- Pazar tavanı: toplam satış platform kurulu tabanının %35'ini aşamaz.
- Noel ayı ×1,5 (L); fiyat tatlı noktası 30–39 $ (L).

## Ekonomi
- Hayran: 60 üstü her not puanı başına +400; kötü not kaybettirir (P).
- ~100k hayrandan sonra kendi yayının mantıklı (L). IP: yeni oyun 12 ay bekler, tavan 5 (L).
- Şirket satın alma: `max(2M; 8 × 3 yıllık ort. kâr)`, aylık gider %0,4 (P/L).
- Rastgele olay aralığı: 36 + 48 × rng hafta (V, GDT).

## Araştırma (GDT v tablosu)
v: 1/2/4/6/8/10/12/14 → RP 10/15/40/80/100/150/250/300, süre 8..30 hf,
geliştirme 20k..1,6M, motor puanı 10..300, motor maliyeti 10k..500k.
