# X Project

Pixel art bir oyun stüdyosu tycoon'u. Dışı tatlı, içi vahşi: 1976'da bir garajda başlarsın, kaos arttıkça ofisin de, çalışanların da dağılır.

Mekanikler `Hibrit Yönetim Oyunu — Mekanik Çözümleme Derlemesi` (Mad Games Tycoon 1–2, Game Dev Tycoon, Game Dev Story) belgesinin **Bölüm V: Hibrit Oyun Çekirdeği** şartnamesine göre kuruldu. Kısa özeti `docs/PDF-OZET.md` dosyasında.

## Çalıştırma

```bash
node tools/serve.mjs        # http://localhost:8080
node test/validate.mjs      # 101 kalibrasyon ve tutarlılık kontrolü
```

Node 18+ gerekir. Derleme adımı ve bağımlılık yok.

## Mimari (şartnameye göre)

| Katman | Dosya | Ne yapar |
|---|---|---|
| Veri | `src/data/pack.js` | Tüm sayılar. Her blok `_tag` taşır: V doğrulanmış, L sınırlı, P bizim önerimiz |
| Çekirdek servisler | `src/kernel.js` | Takvim (y/m/w, 48 hafta/yıl), olay veriyolu, tohumlu RNG, defter |
| Modeller | `src/models.js` | Üretim, değerlendirme (`T_d = H·D·τ·1,11^P`), satış (`zirve = B·Pz·Z·S(n)·…`) |
| Sistemler | `src/systems/*.js` | Kadro, üretim, pazar, ekonomi, olaylar |
| Oyun | `src/game.js` | Haftalık tik ve oyuncu eylemleri |
| Arayüz | `src/ui/*.js`, `index.html` | Piksel ofis sahnesi ve paneller |

Kurallar: kodda sayı yok; her para hareketi `ledger.post` üzerinden; `Math.random` yok; sistemler olay veriyoluyla haberleşir.

## Arayüz

Game Dev Tycoon ve Kairosoft oyunlarından esinli: ekranın tamamı ofis sahnesi. Üstte ince bir HUD ve GDT tarzı proje sayacı (disiplin puanları + hata), altta ikonlu menü var. Yönetim panelleri sahnenin üstünde pencere olarak açılır; pencere açıkken oyun durur. Yeni oyun 3 adımlı bir sihirbazla başlar (fikir → platform → onay), her fazın başında zaman dağılımı sorulur, yayında eleştirmen ekranı gelir. Sahne 3/4 perspektifle çizilir: duvar kalınlıkları, gölgeler, gün-gece ışığı, oda tipine göre mobilya, çalışanların kafasından yükselen puan baloncukları.

### Kontroller (MGT/GDT tarzı)

Alt menüde yalnızca **Bilgisayar** ve **Günlük** var. Yeni oyun, ek iş, personel, reklam, araştırma, satışlar ve finans patronun bilgisayarından (taçlı kurucuya dokun ya da Bilgisayar düğmesi) açılır. Sahnede bir odaya dokunmak o odanın penceresini açar: görev, hedef proje, çalışanlar, odaya işe alım. Boş alana dokunmak oda kurar, kilitli alana dokunmak taşınma seçeneklerini açar. Binalar (Ana ofis, Stüdyolar, Ar-Ge, Yayın ve destek) arasında sahneyi yatay kaydırarak ya da oklarla geçilir.

## İçerik

- 6 tür, 38 konu, 20 platform (1976–2032), 8 yayıncı, 5 oyun boyutu (MMO dahil)
- 9 görevli 3 fazlı geliştirme, kaydırıcı hizası, uyum katsayısı, hata ayıklama
- Araştırma ağacı ve GDT v tablosuyla motor yapımı, motor lisanslama
- Kadro: beceri, moral, stres, tükenmişlik, istifa, rakibe transfer, 12 kişilik özellik, eğitim, zam
- Ofis kademeleri (garaj → ArGe kampüsü + katlar), iş istasyonu kademeleri ve platform kapısı
- Sözleşme işleri, kredi ve iflas, rakip stüdyolar ve satın alma, fuar, Yılın Oyunu ve Yılın En Kötü Oyunu
- **Odalar (MGT2)**: geliştirme, grafik ve ses stüdyosu, kalite güvence, araştırma, mola, donanım laboratuvarı. Koltuklar odalardan gelir; geliştirme odası oyun yokken sözleşme yapar
- **Kariyerler (Game Dev Story)**: 8 kariyer × 5 seviye, RP ile seviye, ön koşullu ileri kariyerler (Yönetmen, Yapımcı, Donanım Mühendisi, Hacker), seviye başına maaş ×1,2
- **Dış kaynak**: 20 dış çalışan, ücret arttıkça getirisi azalan kalite eğrisi
- **Kendi konsolun**: tip, işlemci ve medya seç; iki aşamada üret, piyasaya çıkar, donanım ve lisans geliri topla. Yeni konsol eskisini emekli eder
- **Çoklu proje (MGT)**: her geliştirme odası kendi oyununu yapar; bir oda "Destek" moduyla başka projeye katılabilir. Uzman odalar ve QA projelere bölünür
- **Oyun raporu ve bilgi (GDT)**: her yayından sonra konu×tür, konu×kitle, platform×tür uyumu ve zaman dağılımı dersleri; sihirbazda rozet olarak görünür
- **Yayın sonrası**: güncelleme, fiyat indirimi, başka platforma uyarlama (port), ek paket
- **Satış listesi (MGT)**: rakip oyunlar da satar; her hafta en çok satan 10 oyun, sıra değişimi ▲▼, en iyi sıra. Sahnede satıştaki oyunların kartları, üst çubukta en çok satan oyun
- **Grafikler**: stüdyonun haftalık geliri, oyun başına haftalık satış, aylık kasa, yıllık kâr/zarar
- **Oda görevleri (MGT)**: grafik, ses, QA ve pazarlama odaları belirli bir projeye atanır ya da tüm projelere bölünür. Yeni odalar: Pazarlama ve yayın (her hafta hype, kendi yayında güç), Müşteri destek (hayran, bedava oyuncu raporu)
- **Oyuncu raporu (GDT)**: satıştan 4 hafta sonra; oyuncuların hangi görevi sevip sevmediği, kitle, fiyat, hata, motor ve beklenti yorumu. Görev önemleri faz pencerelerinde rozet olur
- **Kaos ölçeri**: kadro, yıl, crunch, borç, stres ve skandallarla yükselir. Olaylar sıklaşır, ofis görsel olarak bozulur
- 40 rastgele olay (dava, sızıntı, korsan, inceleme bombardımanı, sendika, yatırımcı baskısı, NFT, YZ ile işten çıkarma…)
- 10 tarihî dönem: 1983 çöküşü, dot-com, 2008 krizi, mobil furyası, ganimet kutusu skandalı, pandemi, işten çıkarma dalgası…

## Denge (basit bot, 20 yıl)

| Zorluk | Sonuç |
|---|---|
| Kolay | 73–94 M $, 30 kişi |
| Orta | 12–26 M $, 20 yılda 4–8 Yılın Oyunu |
| Zor / Efsanevi | Bot garajdan çıkamadan batıyor |

Satış ölçeği (B ve Pz) PDF'teki değerlerden yeniden kalibre edildi; gerekçe `pack.js` içinde yazılı.
