# X Project

Pixel art bir oyun stüdyosu tycoon'u. Dışı tatlı, içi vahşi: 1976'da bir garajda başlarsın, kaos arttıkça ofisin de, çalışanların da dağılır.

Mekanikler `Hibrit Yönetim Oyunu — Mekanik Çözümleme Derlemesi` (Mad Games Tycoon 1–2, Game Dev Tycoon, Game Dev Story) belgesinin **Bölüm V: Hibrit Oyun Çekirdeği** şartnamesine göre kuruldu. Kısa özeti `docs/PDF-OZET.md` dosyasında.

## Çalıştırma

```bash
node tools/serve.mjs        # http://localhost:8080
node test/validate.mjs      # 199 kalibrasyon ve tutarlılık kontrolü (50 yıllık bot dumanı dahil, ~17 sn)
node tools/balance.mjs 8 --md docs/DENGE.md   # tam denge raporu
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
| Arayüz | `src/ui/ui.js` (çekirdek: HUD, satış paneli, menü, olay dinleyicileri), `win_*.js` (pencere grupları), `dialogs.js`, `chart.js`, `util.js`, `render.js` (piksel sahne), `index.html` | Her pencere grubu ortak bağlam nesnesini alan bir fabrika |

Kurallar: kodda sayı yok; her para hareketi `ledger.post` üzerinden; `Math.random` yok; sistemler olay veriyoluyla haberleşir.

## Arayüz

Game Dev Tycoon ve Kairosoft oyunlarından esinli: ekranın tamamı ofis sahnesi. Üstte ince bir HUD ve GDT tarzı proje sayacı (disiplin puanları + hata), altta ikonlu menü var. Yönetim panelleri sahnenin üstünde pencere olarak açılır; pencere açıkken oyun durur. Yeni oyun 3 adımlı bir sihirbazla başlar (fikir → platform → onay), her fazın başında zaman dağılımı sorulur, yayında eleştirmen ekranı gelir. Sahne 3/4 perspektifle çizilir: duvar kalınlıkları, gölgeler, gün-gece ışığı, oda tipine göre mobilya, çalışanların kafasından yükselen puan baloncukları.

### Kontroller (MGT/GDT tarzı)

Alt menüde yalnızca **Bilgisayar** ve **Günlük** var. Yeni oyun, ek iş, personel, reklam, araştırma, satışlar ve finans patronun bilgisayarından (taçlı kurucuya dokun ya da Bilgisayar düğmesi) açılır. Sahnede bir odaya dokunmak o odanın penceresini açar: görev, hedef proje, çalışanlar, odaya işe alım. Boş alana dokunmak oda kurar, kilitli alana dokunmak taşınma seçeneklerini açar. Binalar (Ana ofis, Stüdyolar, Ar-Ge, Yayın ve destek) arasında sahneyi yatay kaydırarak ya da oklarla geçilir.

## İçerik

- 6 tür, 38 konu, 40 platform (1976–2035, bilgisayar, konsol, el konsolu, mobil), tarihten gelen yayıncılar, 6 oyun boyutu (Mini'den MMO'ya)
- 9 görevli 3 fazlı geliştirme, kaydırıcı hizası, uyum katsayısı, hata ayıklama
- Araştırma ağacı ve GDT v tablosuyla motor yapımı, motor lisanslama
- Kadro: beceri, moral, stres, tükenmişlik, istifa, rakibe transfer, 12 kişilik özellik, eğitim, zam
- Ofis kademeleri (garaj → ArGe kampüsü + katlar), iş istasyonu kademeleri ve platform kapısı
- Sözleşme işleri, kredi ve iflas, rakip stüdyolar ve satın alma, fuar, Yılın Oyunu ve Yılın En Kötü Oyunu
- **Odalar (MGT2)**: geliştirme, grafik ve ses stüdyosu, kalite güvence, araştırma, mola, donanım laboratuvarı. Koltuklar odalardan gelir; geliştirme odası oyun yokken sözleşme yapar
- **Kariyerler (Game Dev Story)**: 8 kariyer × 5 seviye, RP ile seviye, ön koşullu ileri kariyerler (Yönetmen, Yapımcı, Donanım Mühendisi, Hacker), seviye başına maaş ×1,2
- **Dış kaynak**: 20 dış çalışan, ücret arttıkça getirisi azalan kalite eğrisi
- **Kendi donanımın**: 8 cihaz tipi (salon makinesi/arcade, ev bilgisayarı, ev konsolu, el konsolu, VR başlığı, melez konsol, retro mini, bulut servisi), her biri kendi dönemiyle ve yıllara göre değişen pazar ilgisiyle (arcade 80'lerde zirve, sonra söner)
- **Dönemsel bileşenler**: işlemci (TTL → 8-bit → 16-bit → 32-bit RISC → 64-bit → 128-bit → çok çekirdekli → APU → SoC), grafik (karakter jeneratörü → sprite → 3D → gölgelendirici → HD → 4K → ışın izleme), oyun ortamı (kartuş → kaset → disket → CD-ROM → DVD → Blu-ray → dijital → bulut akışı), ekran, kontrol (joystick → d-pad → analog → hareket algılama → adaptif tetik), bağlantı (modem → çevrimiçi → dijital mağaza → abonelik). 48 "Donanım:" araştırmasıyla açılır; her parça teknoloji, tür uyumu, çekicilik, kâr ve korsan riskini değiştirir
- **Konsol aileleri ve nesiller**: "X Kutu", "X Kutu 2", "X Kutu 3"… Önceki nesillerin satışı yeni nesli destekler, geriye uyumluluk kurulu tabanı taşır, eski nesil bir yıl daha satılıp emekli olur. Fiyat stratejisi: zararına sat / normal / premium. Salon makineleri jeton, bulut servisi abonelik geliri getirir
- **Çoklu proje (MGT)**: her geliştirme odası kendi oyununu yapar; bir oda "Destek" moduyla başka projeye katılabilir. Uzman odalar ve QA projelere bölünür
- **Oyun raporu ve bilgi (GDT)**: her yayından sonra konu×tür, konu×kitle, platform×tür uyumu ve zaman dağılımı dersleri; sihirbazda rozet olarak görünür
- **Yayın sonrası**: güncelleme, fiyat indirimi, başka platforma uyarlama (port), ek paket
- **Satış listesi ve pazar (Konu A)**: her oyun yayılma (Bass) eğrisiyle satar: merak (hype, reklam, yayıncı, seri, hayran) ile ağızdan ağıza (inceleme puanı, hatalar, tür) arasındaki denge hype patlamasını, yavaş yanan sürpriz hiti ve uzun soluklu oyunu kendiliğinden doğurur; ömür boyu satış eski eğriyle aynı tutulur. Aynı türde aynı haftalarda çıkan oyunlar birbirinin talebini böler; Kasım–Aralık talebi ×1,45–1,7 ama rakipler de oraya yığılır. Görünmeyen küçük stüdyolar (1976'da ~40, 2025'te ~30.000 oyun) listeyi doldurur, gerçek sıra "#412 / 1.540" gibi gösterilir. Liste etkisi (üst sıradakiler daha çok duyulur), fiziksel dönemde raf (listede kalamayan oyun raftan iner; Ucuz Raf Serisi ve raf parası), dijital dönemde mağaza vitrini ve Haziran/Aralık indirim festivali, kendi yayınında basım adedi ve "tükendi", riskli hamleler (toplu alım, dergi kapağı), oyun başına bir kez verilen liste ödülleri. Liste ailesi: genel, tür, platform, bölge, en çok oynanan, yıl sonu, tüm zamanlar ve yaklaşan büyük çıkışlar (bazıları ertelenir); çıkış tarihi duyurusu geri sayımla hype verir, kaçırılırsa hayran kaybettirir
- **Grafikler**: stüdyonun haftalık geliri, oyun başına haftalık satış, aylık kasa, yıllık kâr/zarar
- **Oda görevleri (MGT)**: grafik, ses, QA ve pazarlama odaları belirli bir projeye atanır ya da tüm projelere bölünür. Yeni odalar: Pazarlama ve yayın (her hafta hype, kendi yayında güç), Müşteri destek (hayran, bedava oyuncu raporu)
- **Oyuncu raporu (GDT)**: satıştan 4 hafta sonra; oyuncuların hangi görevi sevip sevmediği, kitle, fiyat, hata, motor ve beklenti yorumu. Görev önemleri faz pencerelerinde rozet olur
- **Kaos ölçeri**: kadro, yıl, crunch, borç, stres ve skandallarla yükselir. Olaylar sıklaşır, ofis görsel olarak bozulur
- 81 rastgele olay (dava, sızıntı, korsan, inceleme bombardımanı, sendika, yatırımcı baskısı, NFT, YZ ile işten çıkarma…)
- **Modern dönem**: ücretsiz oyun + oyun içi satış (hafif/dengeli/agresif; agresif not ve hayran kaybettirir, ganimet kutusu yasağında geliri düşer), indirilebilir içerik ve sezon kartı (söz verilen içerik gelmezse öfke), erken erişim (geliştirirken satış ve geri bildirim), abonelik servisi anlaşmaları (önden ödeme, düşük satış), fenomen kampanyaları (viral olabilir ya da geri teper), yayıncılara anahtar dağıtma, kitle fonlama (2012–2022). Dijital dağıtımla kopya maliyeti düşer, mobilde yoktur
- **Ses**: tarayıcının kendi ses motoruyla chiptune efektler ve döneme göre değişen prosedürel müzik (70'lerin kare dalgalarından 2010'ların yumuşak döngülerine; kaos arttıkça hızlanır). Üst çubukta ses düğmesi, ayarlarda ses seviyeleri
- **Öğretici**: ilk oyunda 9 adımlık kısa tur (atlanabilir, ayarlardan yeniden açılır)
- **Kayıt**: aylık otomatik kayıt + 3 yuva, dosyaya aktarma ve dosyadan yükleme, ana menüde kayıt özetleri
- **Bölgesel pazarlar**: Kuzey Amerika, Avrupa, Japonya ve Dünya; payları yıllara göre değişir (Dünya 2000'lerden sonra büyür), her bölgenin türlere ilgisi (Japonya RPG sever, Avrupa strateji/simülasyon) ve platformlara eğilimi (X-Kutu Japonya'da zayıf, bilgisayar Avrupa'da güçlü) farklı. İngilizce sürüm K. Amerika + Avrupa'yı kapsar; Japonya ve Dünya için araştırma ve yerelleştirme bedeli. Oyun ayrıntısında bölge satışları
- **Konsol savaşı**: konsolların aynı segmentteki rakip platformlardan oyuncu çalar; pay büyüdükçe rakipler fiyat kırar, özel oyun kapar, reklam savaşı açar; zayıf rakip donanımdan çekilip yayıncıya döner. Üçüncü parti yayıncılar payın kadar senin konsoluna oyun çıkarır (lisans ücreti + kütüphane); büyük yayıncılarla özel oyun anlaşması
- **Tarihsel oyun dünyası (1976–2025)**: 50+ parodi şirket (Ataro, Pandando, Segga, Soni, MikroYumuşak, Kapkom, Konamii…) yıllara göre kurulur, güçlenir, zayıflar, birleşir ya da piyasadan çekilir. Her yılın 10 popüler oyunu (Süper Tesisatçı Kardeşler, Zelma Efsanesi, Hızlı Kirpi…) yıl içine dağılıp satış listesine girer; her ay bir tarihî olay haber olur. "50 yıl · tam tarih" modu 1976'dan 2025'e kadar oynanır. Tüm adlar telife takılmamak için parodi
- **Yayıncılar tarihten**: güçleri o yılki şirket gücünden gelir (Ataro 1980'lerde dev, sonra yok olur); pay ve hayran şartı güce göre
- **Oyun dünyası penceresi**: yılın oyunları ve olayları, şirket sıralaması, platform pazar payları, olay arşivi
- **MGT yan satış paneli**: sahnenin sağ kenarında satıştaki her oyunun sırası, maliyeti (lisans + maaş payı + reklam + dış kaynak + güncelleme), geliri, kârı ve haftalık kâr eğrisi; geliştirilen projelerin şimdiye kadarki maliyeti
- **MGT personel**: 8 yetenek (tasarım, programlama, grafik, ses, test, pazarlama, araştırma, donanım), iki huy, 23 huy (Hızlı öğrenir, Tatil hastası, Doğal lider, Yalnız kurt, Kıskanç…). İşe uygun yetenek verimi belirler
- **Tatil**: izin hakkı birikir, yorulan izin ister; Serbest / Planlı / Yasak politikası. Planlıda aynı odadan iki kişi aynı anda gidemez, çakışan istek reddedilir ve ikisi arasında gerginlik olur
- **Çalışan ilişkileri**: aynı odada çalışanlar dost ya da düşman olur (kavga, kahve ısmarlama…). Ortalama ilişki verimi ±%10, morali ±8 etkiler; düşmanlık stres biriktirir
- **Ofis tasarımı**: her binaya 5 dekor (Standart, Ucuz plastik, Ergonomik verim, Konfor köşesi, Lüks tasarım); hız, moral, stres, kira ve prestij etkisi, sahnede görünür
- **Şirket değeri ve halka arz**: değerleme, %10/25/40 hisse satışı, hisse fiyatı, çeyreklik büyüme hedefi, yönetim kurulu baskısı ve olağanüstü kurul kararları, temettü, geri alım. Baskı %100'e ulaşırsa görevden alınırsın
- **Ödüller**: Yılın Oyunu artık tarihî hitlerle yarışır; olamazsan "türünün en iyisi" ödülü
- 10 tarihî dönem: 1983 çöküşü, dot-com, 2008 krizi, mobil furyası, ganimet kutusu skandalı, pandemi, işten çıkarma dalgası…

## Denge (akıllı bot, 50 yıl)

`test/smartbot.mjs` oyunun tüm sistemlerini kullanan bir bottur. `node tools/balance.mjs 8 --md docs/DENGE.md` her zorlukta 8 tohumla 1976–2025 oynatıp `docs/DENGE.md` raporunu üretir (yaklaşık 1,5 dakika). Özet:

| Zorluk | 2025'e ulaşan | Medyan kasa |
|---|---|---|
| Çok kolay | 8/8 | ~2,4 milyar $ |
| Kolay | 8/8 | ~510 M $ |
| Orta | 8/8 | ~310 M $ |
| Zor | 6/8 | ~90 M $ |
| Çok zor | 1/8 | — |
| Efsanevi | 4/8 | küçük sözleşme stüdyosu |

Bu ölçümle bulunan ve düzeltilen 10 sorun raporun sonunda listelidir.

Satış ölçeği (B ve Pz) PDF'teki değerlerden yeniden kalibre edildi; gerekçe `pack.js` içinde yazılı.
