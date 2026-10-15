# X Project

Pixel art bir oyun stüdyosu tycoon'u. Dışı tatlı, içi vahşi: 1976'da bir garajda başlarsın, kaos arttıkça ofisin de, çalışanların da dağılır.

Mekanikler `Hibrit Yönetim Oyunu — Mekanik Çözümleme Derlemesi` (Mad Games Tycoon 1–2, Game Dev Tycoon, Game Dev Story) belgesinin **Bölüm V: Hibrit Oyun Çekirdeği** şartnamesine göre kuruldu. Kısa özeti `docs/PDF-OZET.md` dosyasında.

## Çalıştırma

```bash
npm ci                     # sabitlenmiş Phaser ve geliştirme bağımlılıkları
npm start                  # http://localhost:8080 (başlangıçta derler)
npm run build              # statik yayın çıktısı: dist/
npm run test:office        # yerleşim + gerçek Phaser Canvas/DOM entegrasyon kontrolleri (Node)
node test/validate.mjs      # genel ekonomi kontrolleri; güncel sonuç docs/OFFICE-VALIDATION.md içinde
node tools/balance.mjs 8 --md docs/DENGE.md   # tam denge raporu
```

Node 18+ gerekir. Ofis sahnesi Phaser 3.90.0 kullanır; esbuild tüm oyun kodunu ve motoru `dist/app.js` içine paketler. Oyun açılırken motor CDN'den indirilmez. `dist/` klasörü statik sunucuya bütünüyle konabilir; çift tıklayarak `file://` üzerinden açmak desteklenen çalıştırma yöntemi değildir. Kaynak değişikliklerinden sonra `npm start` yeniden başlatılmalıdır.

Bu dalda odalar taşınır ve boyutlandırılır; masa, sandalye ve dönemine uygun bilgisayar ayrı alınır. Fiziksel donanım, ısı ve ihtiyaç alanları üretimi etkiler. Başlangıç mobilyaları, dört animasyonlu karakter ve açılış illüstrasyonu yeniden çizildi. Arayüz; görselli mağaza, ayrı yerleştirme çubuğu ve mobil çekmece kullanır. Sanat kaynakları ve sınırlar [ART-DIRECTION.md](docs/ART-DIRECTION.md) içinde.

Kapsam ve doğrulama sınırları: [Phaser geçiş notları](docs/PHASER-MIGRATION.md).

## Mimari (şartnameye göre)

| Katman | Dosya | Ne yapar |
|---|---|---|
| Veri | `src/data/pack.js`, `src/data/office.js` | Tüm sayılar. Her blok `_tag` taşır: V doğrulanmış, L sınırlı, P bizim önerimiz |
| Çekirdek servisler | `src/kernel.js` | Takvim (y/m/w, 48 hafta/yıl), olay veriyolu, tohumlu RNG, defter |
| Modeller | `src/models.js` | Üretim, değerlendirme (`T_d = H·D·τ·1,11^P`), satış (`zirve = B·Pz·Z·S(n)·…`) |
| Sistemler | `src/systems/*.js` | Kadro, üretim, pazar, ekonomi, olaylar |
| Oyun | `src/game.js` | Haftalık tik ve oyuncu eylemleri |
| Ofis dünyası | `src/systems/office.js` | Oda geometrisi, dönemsel mağaza, gerçek istasyon kapasitesi, çalışma koşulları ve yol bulma |
| Ofis sahnesi | `src/office/renderer.js`, `assets.js` | Phaser sahnesi, kamera, çalışan hareketi, sprite atlası ve yerleşim önizlemesi |
| Arayüz | `src/ui/ui.js`, `win_*.js`, `dialogs.js`, `chart.js`, `util.js`, `icons.js`, `index.html` | HTML/CSS yönetim pencereleri ve sahne bağlantısı |

Kurallar: kodda sayı yok; her para hareketi `ledger.post` üzerinden; `Math.random` yok; sistemler olay veriyoluyla haberleşir.

## Arayüz

Game Dev Tycoon ve Kairosoft oyunlarından esinli: ekranın tamamı ofis sahnesi. Üstte HUD ve proje sayacı, altta menü var. Yönetim pencereleri açıkken oyun durur. Yeni oyun adım adım bir sihirbazla başlar (fikir → platform → teknoloji → onay; seçilecek motor yokken teknoloji adımı atlanır), her fazın başında zaman dağılımı sorulur, yayında eleştirmen ekranı gelir. Bu dalda ofisi Phaser çizer; dünya ekran boyutundan bağımsızdır. Karakterler masalarına ve aynı odadaki kahve noktasına yürür. Yürüyüş ve durum simgeleri görseldir; haftalık üretim/maaş hesabının sahibi mevcut oyun çekirdeğidir.

### Kontroller (MGT/GDT tarzı)

Alt çubukta Kaydet, Günlük ve Menü var. Taçlı kurucu veya Menü kurucu menüsünü; çalışan veya oda departman menüsünü açar. Binalar alt oklarla değiştirilir. Boş zemini sürüklemek kamerayı taşır; +/−, fare tekerleği ve Sığdır kamerayı ayarlar. Oda kurmak için sahnedeki + ODA KUR yazısı veya mevcut yönetim menüsü kullanılır.

**Ofisi düzenle:** eşya seç, sürükle, gerekirse Döndür, sonra Yerleştir. Yeşil önizleme uygundur; kırmızı önizleme kaydedilmez. İptal taslağı siler. Yeni dekor ekledikten sonra boş zeminde konum seçilebilir. R döndürür, Enter onaylar, Escape düzenlemeyi bitirir. Kapı ve bütün kullanılabilir masa/oturma noktaları erişilebilir kalmalıdır. Çalışma masaları ve mola odasının koltukları kaldırılamaz. Dekorlar ücretsiz görsel yerleşimdir; oda kapasitesini değiştirmez. Onaylı konumlar otomatik kayda ve kayıt dosyasına dahildir.

## İçerik

- 6 tür, 38 konu, 40 platform (1976–2035, bilgisayar, konsol, el konsolu, mobil), tarihten gelen yayıncılar, 6 oyun boyutu (Mini'den MMO'ya)
- 9 görevli 3 fazlı geliştirme, kaydırıcı hizası, uyum katsayısı, hata ayıklama
- Araştırma ağacı (iş bilgisi), ayrı teknoloji hattı ve donanım: üç katman
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
- **Yayıncılar (Konu B)**: her yıl o dönemde faaliyette olan tüm yayıncılar üç kademede (büyük, orta, küçük); tarihî şirketlerin yanında 22 kurgusal yayıncı. Her birinin gücü, tür zevki (tarihî hitlerinden), bölgesi, platform odağı ve huyu (cimri, cömert, bürokratik, kumarbaz, seri avcısı, sadık, kaprisli, vizyoner) var. Kapı kuralı: güç 60 altı herkese açık, 60–74 en az bir oyun ve eksi olmayan itibar, 75+ yalnız tanıştığı stüdyo. Oyun bitince (ya da Ortak bir yayıncıyla konsept bitince, erken anlaşma ve kilometre taşı finansmanı) en çok 3 yayıncıya sunulur; dosya (tasarım belgesi, pazar notu), büyük yayıncıda toplantı sınavı (blöf yakalanabilir), dört kişilik kurul (Ürün, Pazar, Finans, Hukuk) ve oyların göründüğü cevap mektubu: tam teklif, tek seferlik satış (garajın ilk oyunu çoğunlukla böyle), değişiklik isteği ya da en zayıf üyeden ipucu veren ret. Pay yayıncı netinin yüzdesi (yeni stüdyoya %14–17, yani fiyatın ~%8–9'u; Tanıdık/Ortak/Stratejik +2/+4/+6; hit kademesi +4), avans telifle geri ödenir. Pazarlık tek ekranda olasılıkları görünen hamlelerle (pay, avans, seri hakları, tarih, dağıtım anlaşması, rakip teklif), iki teklifte açık artırma. İlişki −50…100, yıllık soğuma, hafıza (son 5 olay) ve olaylar (çıkış, hit, avans kapanışı, gecikme, başka yayıncıya gitmek, skandal). Tanışma: deneme işi (sözleşmeli iş olarak sınav), dergi yarışması, demo partisi, mod sahnesi, bağımsız festival, oyun maratonu (temalı), ödül ve ilk 10 mektupları, 12 tavsiye kaynağı (eski çalışan, platform sahibi, eleştirmen, fuar, halka arz…), ajan. Yayın sonrası: çeyrek raporu, yayıncı siparişleri, fiyat indirimi isteği, Kasım'a kaydırma isteği, seri hakları (geri satın alınabilir), üç oyunluk anlaşma, birleşme ve iflas. Kendi yayınının erişimi güçle dikleşir (0,05 + 0,95 × (güç/100)^1,5): garajda yayıncının altında, büyüyünce çok üstünde
- **Bölgeler (Konu C)**: altı bölge (Kuzey Amerika, Avrupa, Japonya, Türkiye, Latin Amerika, Asya-Pasifik), her birinin sesi (Büyük Bob, Klaus Amca, Tanaka-san, Kasetçi Cemil Abi, Don Ramón, Min-jun), dergisi, zevki (tür ve konu), platform kültürü, fiyat endeksi, korsanlığı ve takvimi. Kuruluşta ana bölge seçilir (Türkiye: ucuz maaş ama minik pazar, ithal kit ve kur krizleri); garaj yalnız orada satar, diğer bölgelere yayıncıyla, posta siparişiyle, distribütörle ya da bölge ofisiyle girilir. Hayranlar bölgelere bölünür, ün kısmen sınır tanımaz. Dört seviyeli yerelleştirme (çeviri, tam, kültürelleştirme; komik çeviri hataları), yayından sonra kademeli çıkış, bölgesel yayın hakları. 33 bayram ve özel gün (29 Ekim, 23 Nisan, Nevruz, Ramazan ve Kurban Bayramı kayar; 4 Temmuz, Kara Cuma, Cadılar Bayramı; Noel, Ağustos tatili; Oshōgatsu, Altın Hafta, Tanabata; Ay Yeni Yılı, 11.11; Karnaval; Dünya Kupası) satışı değiştirir ve ofis kültürü ya da pazar fırsatı diyalogları açar; bölge fuarları. 22 bölgesel dönem olayı (ev bilgisayarı patlaması, yen yükselişi, kur krizleri, internet kafe çağı, Asya konsol yasağı…), yaş kurulları ve şiddet listesi, bölge ofisinden yerel adaylar
- **Türler ve bilgi ağacı (Konu D)**: 13 ana tür (Aksiyon, Nişancı, Platform, Dövüş, Macera, RPG, Strateji, Simülasyon, Spor, Yarış, Bulmaca, Casual, Ritim) ve 115 alt tür (labirent kovalamacadan son kalana, metin macerasından otomatik savaşçıya); her alt türün doğuş yılı, altın çağı ve esprisi var, balon türler çöker, retro dalgası eskileri kurtarır. Kombinasyonlar altı kademe alır: Süper, İyi, Geçerli, Başarısız, Kötü, İğrenç (konu × tür, tür × alt tür, konu × alt tür, kitle ve platform tavanları); İğrenç bir fikir iyi bir oyunu vasata indirir. 12 gizli efsane kombinasyon (Ambulans Çılgınlığı, Bulmaca Destanı, Zindanda Dans…) ve %3 kült klasik ihtimali. Kurucu geçmişi (salon makinesi tamircisi, masa oyunu meraklısı, kitap kurdu, zindan efendisi, mahalle maçının kaptanı, okul bilgisayar kulübü) iki türü açar; diğerleri araştırmayla. Stüdyonun her türde 0–100 bilgisi (Acemi → Efsane), paslanma, usta olunan türde alt türü zamanından önce icat etme ve "türün babası" unvanı. Çalışanların sevdiği ve sevmediği türler, tür deneyimi, fikir getiren çalışanlar; ekip sezgisi, odak grubu ve Piksel Dergisi'nin yıllık tür rehberi. Ar-Ge › Türler penceresinde tür ağacı
- **Motor ve teknoloji (Konu E)**: oyuna giren her teknik özellik bir motordan gelir. 7 kategoride 50 özellik (grafik, ses, kontrol, yapay zekâ, kayıt ve içerik, çok oyunculu, fizik; metin ekrandan ışık izlemeye), her kategori bir merdiven ve genel araştırmadan ayrı bir teknoloji hattında araştırılır. Kendi motorun aile ve sürüm olur (Garaj Motoru 1, 2, 3…; yeni sürüm eski özellikleri %20 bedelle taşır), ekip motora alışır, 5 yıl yenilenmeyen motor eskir, motoru rakiplere lisanslarsın (lisansçı rakip +1, senin motorunla yılın oyunu). Motor pazarında 13 parodi motor ve 3 ara yazılım: peşin lisans, satıştan yüzde (Gerçeksiz Motor 2014'te %5'e, 2022'de ilk 1 milyonu bedava bırakır) ya da koltuk ücreti (Birlik Motoru, 2023 kurulum ücreti skandalı); Çizim Yazılımı 2004'te satın alınıp kapanır. Sihirbazda Teknoloji adımı: motor seçimi, platformun kaldırdığı özellikler, kategori çubukları (seninki · dönemin beklentisi), alt türün şartı (FPS için poligon 3D…) ve türün olmazsa olmazı
- **Menüler ve kilitler (Konu F)**: Kairosoft gibi iç içe menü. Alt çubukta 7 başlık (İş, Ekip, Ar-Ge, Tanıtım, Pazar, Şirket, Sistem), içinde 31 seçenek, seçeneğin içinde ekran; yol çubuğu (İş › Yeni oyun) ve geri ok. Araştırılmamış ya da zamanı gelmemiş seçenekler, başlıklar ve pencere sekmeleri saklı; en çok iki kapalı seçenek "?" ile ipucu verir. Açılan seçenek YENİ rozeti ve günlükte 🆕 haberi alır, her ekran ilk açılışta tek satırlık açıklama gösterir; öğretici 4 adım. Masadaki bilgisayar bütün menüyü tek ekranda açar
- **Konsol anlaşmaları, hisseler ve tekel (Konu G)**: kendi konsolunda platform oranını sen seçersin (%15–40; düşük oran stüdyo çeker, yüksek oran para getirir, %35 üstü boykot riski), başka stüdyoların oyunları konsolunda gerçek satışla 26 hafta satar ve satıştan pay alırsın; kartuşlu konsolda kartuş basım tekeli. Özel anlaşmalar tarihî hit oyunlar ve güçlü stüdyoların sıradaki oyunu için yapılır: pazarlama, süreli özel, tam özel, ikinci parti; fiyat beklenen not, şirket gücü, ilişki ve konsol payına göre; rakip konsoldan karşı teklif, konsol çakarsa anlaşma bozulur. Şirket hissesi kademeli: %10 temettü, %25 kurul koltuğu (anlaşmada indirim, karşı teklif yok), %51 kontrol (bağlı stüdyo: oyun siparişi, "yalnız benim konsolum" politikası, güçlendirme, özerklik ve yıldız yapımcı istifası), %100 birleştirme; en çok 5 bağlı stüdyo, donanımdan çekilen devin stüdyoları satılık. Tekel ısısı hayranları kaçırır, Rekabet Kurumu ceza, anlaşmaları açma ya da şirket satışı ister
- **Karakterler, departmanlar ve Kairosoft menüsü (Konu H)**: taçlı kurucuya (ana karakter) ya da alttaki Menü'ye dokununca solda küçük bir menü açılır: başlık (Geliştir, Personel, Eylem, Bilgi, Ar-Ge, Departmanlar, Sistem) → seçenek → ekran; hiçbir içerik basmadan açılmaz, açılan ekranda sekme şeridi yok. Bir odadaki çalışana dokunmak o departmanın menüsünü açar: müdürün (yoksa en kıdemlinin) karakter kartı ve odanın işleri. Her iş yerine bağlı: Ar-Ge araştırma odası kurulunca oraya taşınır, TV ve fenomen kampanyaları ile çıkış tarihi duyurusu pazarlama departmanı ister, raporlar kurucunun masasında. Her çalışanın bir kişiliği (12 tip, söz ve liderlik) var; küçük ofisten sonra her odaya müdür atanır (verim +%10'a kadar, stres −%20'ye kadar, %15 prim) ve müdürlü oda bazı işleri kendisi yapar (araştırma, kampanya, faz dağılımı, oyuncu raporu). Sade başlangıç: platformlara Kairosoft gibi bir kez lisans alınır (başta yalnız Kişisel Bilgisayar), sihirbaz yalnız işe yarayan adımları ve bilinen türleri gösterir
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

## Önceki denge ölçümü (ofis mağazası öncesi)

`test/smartbot.mjs` oyunun tüm sistemlerini kullanan bir bottur. `node tools/balance.mjs 8 --md docs/DENGE.md` her zorlukta 8 tohumla 1976–2025 oynatıp `docs/DENGE.md` raporunu üretir (yaklaşık 1,5 dakika). Özet:

| Zorluk | 2025'e ulaşan | Medyan kasa |
|---|---|---|
| Çok kolay | 8/8 | ~2,4 milyar $ |
| Kolay | 8/8 | ~510 M $ |
| Orta | 8/8 | ~310 M $ |
| Zor | 6/8 | ~90 M $ |
| Çok zor | 1/8 | — |
| Efsanevi | 4/8 | küçük sözleşme stüdyosu |

Bu tablo ofis mağazası öncesindeki ölçümdür; yeni donanım ve hizmet maliyetleriyle yeniden kalibrasyon gerekir. Önceki ölçümle bulunan ve düzeltilen 10 sorun raporun sonunda listelidir.

Satış ölçeği (B ve Pz) PDF'teki değerlerden yeniden kalibre edildi; gerekçe `pack.js` içinde yazılı.
