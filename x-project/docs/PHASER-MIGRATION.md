# Düzenlenebilir ofis: ilk işlevsel bölüm

Çalışma dalı `codex/x-project-office-ui`; yedek `claude/x-project` korunur.
Başlangıç yedeği: `4c75c317acdf7dbaa5d0a6e256305abb0d555ba6`.

## Oyuncunun akışı

1. Garaj tek hazır masa, sandalye ve 1976 bilgisayarıyla açılır. Kurucu yalnızken temel ihtiyaçlar ortak tesislerden karşılanmış sayılır.
2. **Yerleşim ve mağaza → Yeni oda kur** ile tür ve ölçü seçilir. Oda sahnede yeşil/kırmızı taslak olarak taşınır; **Onayla** ile bedeli ödenir. Yeni oda boştur.
3. Mağazadan masa alınır. Sandalye masanın yeşil işaretli kullanım hücresine, masayla aynı yönde yerleştirilir. Masaya dokunulup bilgisayar kategorisinden model seçilir ve onaylanır. Ancak üçü tamamlandığında işe alım kapasitesi oluşur.
4. Mevcut eşyaya dokunmak taşıma/döndürme, aynı türden modelle değiştirme veya satış taslağı açar. İptal ücretsizdir. Her onay kaydedilir.
5. Oda panelinden konum, genişlik/derinlik, alt duvardaki kapı sütunu ve zemin değişir; oda bütün olarak da sürüklenebilir. Küçültmek içerideki eşyalara veya erişime zarar veriyorsa reddedilir.
6. Mola odasına koltuk ve çay/kahve, tuvalete klozet **ve lavabo** konur. Çalışanlar aynı binadaki erişilebilir hizmetlere kendileri yürür. Oda adı tek başına fayda sağlamaz.

## Mekanik ve veri

| Parça | Uygulanan davranış |
|---|---|
| Oda alanı | 6–20 hücrelik dikdörtgenler; bir hücre ara koridor; bina sınırı ve oda çakışması kontrolü |
| İş istasyonu | Ayrı ücretli masa, sandalye ve masaya takılan bilgisayar; bir sandalye tek istasyona aittir |
| Teknoloji | Her model kendi yılında açılır; PET 1977, Commodore 64 1982; sonraki dönemlerde üç bilgisayar sınıfı |
| Üretim | Kişinin gerçek istasyonu, cihazın gücü ve eskimesi, masa/sandalye kalitesi, sıcaklık, hizmet kapasitesi ve yürüme payı |
| Eksik eşya | Çalışma yeri yoksa kişinin üretimi sıfır; geliştirme ekibinin çıktısı yoksa proje haftası ilerlemez |
| Isı ve hizmet | Pervane/klima oda sıcaklığını düşürür; koltuk, içecek, klozet/lavabo hizmet kapasitesi sağlar |
| Dekor/uzmanlık | Bitki en çok +%3; kitaplık en çok +%3; uygun departman ekipmanı en çok +%25 |
| Para | Yerleştirme ve yükseltme ücretli; eski parçanın ödenmiş bedelinin %35'i geri alınır; elektrik/su/içecek aylık giderdir |
| Ofis büyütme | Alan açar; ücretsiz masa veya bilgisayar eklemez |
| Eski kayıt | v1 veya yerleşimsiz kayıtlara mevcut kapasiteyi koruyan geçiş yapılır; v2 yeni odalara eşya doldurmaz |

Fiyatlar ve katsayılar **oyun dengesi değerleridir**, tarihî satış fiyatı veya gerçek termodinamik model değildir. Sıcaklık mevsim, cihaz ısısı ve oda içindeki soğutma toplamıyla hesaplanır. Bekleme süresi hizmet kapasitesinden tahmin edilir; çalışanlar için tek tek kuyruk rezervasyonu henüz yoktur. Farklı binalar arasındaki hizmet erişimi sabit yol maliyetiyle modellenir; görsel yürüyüş aynı bina içindedir.

## Katman sınırları

- `src/data/office.js`: ürünler, dönemler, fiyatlar ve etkiler.
- `src/systems/office.js`: yerleşim, satın alma, kapasite, erişim, yol ve çalışma koşulları. DOM/Phaser bağımlılığı yoktur.
- `src/models.js` ve `src/systems/staff.js`: gerçek donanımı haftalık üretim ve personel kapasitesine bağlar.
- `src/office/renderer.js`: Phaser 3.90.0 sahnesi, kamera, hareket ve taslaklar. Görsel hareket ekonomiyi ilerletmez.
- `officeWorld.version:2`: bina, oda ölçüsü/konumu, kapı, zemin, ürün ve ödenen bedelleri saklar. Ana kayıt anahtarı değişmedi.
- WebGL desteklenirse WebGL, aksi halde Canvas kullanılır. Motor esbuild ile paketlenir; CDN gerektirmez.

## Sonraki bölümler

Nihai izometrik çizimler ve yeni karakter sanatları, bakım/arızanın ayrıntılı döngüsü, ikinci el pazarı, birden çok eşya seçimi ve taşıması, elle duvar parçaları çizme, çarpışan kalabalık ve gerçek hizmet kuyrukları henüz tamamlanmadı. Başlangıç karakter ve mobilya seti yeniden çizildi; kaynaklar, yeni arayüz ve kalan açı/model çeşitliliği sınırları `ART-DIRECTION.md` içinde. Bu set bütün dönemlerin son sanat kapsamı değildir.

## Doğrulama sınırı

`npm run test:office`: 14 test; gerçek satın alma API'si, kayıt dönüşümü, boş odalar, üretim, dönem kilitleri, ısı ve ihtiyaçlar; ayrıca Node ortamında gerçek Phaser CanvasRenderer ile sürükleme, taslak/onay, odalar arası hizmet yürüyüşü, tuvalette gizlenme ve 390×620/844×300 sahne boyutlandırması. HTML menüleri jsdom'da yeni kariyer/proje, mağaza ve oda kurma akışıyla kontrol edilir.

Bu kontroller gerçek tarayıcı, WebGL, iOS/Android veya dokunmatik cihazda oynama doğrulaması değildir. Bu ortamda gerçek telefon/tarayıcı oturumu yapılamadı.

Genel `npm test` sonucu ve başarısız beklentiler ayrı doğrulama notunda tutulur. Eski ekonomi senaryolarının hazır ofis varsayımı yalnız test fikstüründe eski kayıt dönüşümüyle korunur; yeni oyun davranışına otomatik eşya eklenmez. Bot gerçek mağaza API'siyle satın alır.
