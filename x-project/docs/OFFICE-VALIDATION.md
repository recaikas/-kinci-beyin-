# Ofis sistemi doğrulaması

Çalışma dalı: `codex/x-project-office-ui`. Yedek dal değiştirilmedi.

| Kontrol | Sonuç |
|---|---|
| `npm run test:office` | 14 geçti, 0 başarısız |
| `npm run build` | Başarılı |
| `npm test` | 411 geçti, 11 başarısız |
| Orta zorluk, üç tohum, 50 yıl bot | 3/3 tamamladı; medyan kasa 390 M $ |
| Gerçek tarayıcı/telefon/WebGL | Yapılmadı |

Phaser CanvasRenderer Node altında gerçek sprite/display listesiyle çalıştırıldı. HTML menüleri jsdom ortamında kontrol edildi. 390×620 ve 844×300 boyutlarında sahne boyutlandırması, dokunmatik cihaz testi değildir.

Eski ekonomi senaryoları hazır döşenmiş ofis varsayar; yalnız test fikstürlerinde eski kayıt geçişiyle bu varsayım korunur. Yeni ofis testleri gerçek boş oda ve satın alma kurallarını kullanır. Denge botu mağaza üzerinden ücret ödeyerek döşer.

Önceki sürümle ortak 11 başarısız beklenti aşağıdadır. Bunların giderildiği iddia edilmiyor:

- [MGT2 yapısı] Hedefin %100ü → ~98 — 83.2
- [MGT2 yapısı] Hedefin %50si → ~49 — 41.6
- [Tasarım davranışı (P)] P=3 → ~72 — 60.8
- [Kalibrasyon] 22 kişi Oca 1976 Efsanevi hedefi yakalar — 495 / 1485
- [Kalibrasyon] 1992 yerleşik hit 20–60 bin/hafta — 117333
- [Kalibrasyon] 1977 garaj iyi oyun 100–800/hafta — 3897
- [Tutarlılık] Yayıncı anahtarları yalnız o oyunu etkiler
- [Tutarlılık] Tarih duyurusu kabul edilir, ikinci kez edilmez
- [Tutarlılık] Geri sayım hype verir — undefined
- [Tutarlılık] Eşikler: Mantar ~40 (kumarbaz), Ataro ~68
- [Tutarlılık] Garajın ilk oyunu: Finans hayır, tek seferlik satış — tam finans 0.8

Görsel yenileme sonrası genel paket yeniden çalıştırıldı: **411 geçti, 11 başarısız**. Yukarıdaki 11 beklenti önceki sürümle ortaktır. Orta zorluk üç tohumda 50 yılı tamamladı; Efsanevi denemelerinden biri de 2025'e ulaştı. Bu sonuç kusursuz denge anlamına gelmez.

14 ofis testi yeni PNG atlaslarını gerçekten yükler. Ürün görselleri, açılış illüstrasyonu bağlantısı, katlanmış kariyer ayarları, gelecek dönem cihaz kilidi, Donat/Oda/Durum sekmeleri, yerleştirme ve oda kurma akışları doğrulanır. Phaser kamerasının sağ katalog ve alt mobil çekmece için alan bırakması kontrol edilir. Gerçek tarayıcı ve telefon denemesi yapılmadı.
