# Phaser ofis geçişi

Çalışma dalı: `codex/x-project-office-ui`. Yedek dal: `claude/x-project`.
Geçiş başlangıcı: `4c75c317acdf7dbaa5d0a6e256305abb0d555ba6`.

## Değişen katmanlar

- Eski Canvas ofis çizicisi kaldırıldı. Menü simgeleri `ui/icons.js` içinde korundu.
- Sahne, kamera, girdi ve görsel saat Phaser 3.90.0 tarafından yönetilir. WebGL destekleniyorsa WebGL, aksi halde Canvas seçilir. Haftalık simülasyonun zamanlayıcısı `ui.js`/`game.js` içinde kalır; Phaser ikinci bir ekonomi saati başlatmaz.
- `officeWorld.version:1` kayıt alanı oda yuvalarını, eşya kimliklerini, hücre konumlarını ve yönlerini tutar. Oda koordinatları kamera ve ekran boyutundan bağımsızdır. Ana kayıt sürümü ve kayıt anahtarı değiştirilmedi; eski kariyerler yüklenirken yeni alan oluşturulur.
- Oda kurma/yıkma ve ofis yükseltme eylemleri yerleşimi eşitler. Mevcut eşyaların konumları korunur; yeni kapasite için varsayılan iş istasyonları eklenir. Aşırı sıkıştırılmış kişisel yerleşimde yeni masa için yer yoksa mevcut eşyalar zorla taşınmaz.
- Eşya sürükleme, döndürme, onay/iptal, dekor ekleme/kaldırma, zemin çakışması ve kapıdan kullanım noktalarına erişim kontrolü eklendi.
- Dört yönlü hücre yol bulma kullanılır. Çalışanların fiziksel konumları görsel sahneye aittir; üretim kapasitesi, çalışan oda ataması ve maaşlar mevcut sistemde hesaplanır. Çalışanlar masasına ve odasında varsa kahve noktasına yürür.
- Konum onaylanana kadar yalnızca sahne taslağı değişir. Onaydan sonra mevcut kayıt mekanizması kullanılır. Düzenleme ve yönetim pencereleri görsel hareketi durdurur. Görsel saat ekranın Hz değerine değil geçen süreye ve oyun hızına bağlıdır.
- Motor ve oyun kodu esbuild ile yerel bağımlılıklardan derlenir. Çalıştırma için `npm ci && npm start`; statik yayın için `npm run build` ve `dist/` gerekir.

## Bilerek kapsam dışında kalanlar

- Yeni karakter ve eşya çizimleri için nihai sanat çalışması yapılmadı. Şu anki sprite atlası kodla üretilmiş geçici görsellerdir; aynı anahtarlarla sonradan hazırlanacak çizimler takılabilir.
- Oda duvarlarını çizme/boyutlandırma ve odaları serbestçe taşıma yok; oda yuvaları sabittir. Eşyalar kendi odalarında taşınır.
- Eşyalar itilip devrilmez; fizik, kaplanan zemin ve geçiş açısından ele alınır. Çalışanların birbirinden kaçınması/kalabalık simülasyonu ve odalar arası mola yolculuğu bu geçişte yok.
- Yerleşim iş istasyonu kapasitesini değiştirmez. Ekonomiye bağlı mobilya mağazası eklenmedi.
- Önceki çizicinin bütün dekoratif efektleri taşınmadı: eski kaos yangını, kedi ve bağımsız gece karartması bu ilk Phaser sahnesinde yok. Sayısal kaos ve ilgili oyun kuralları korunur.
- Diğer ekonomi hataları ve eski test beklentileri bu motor geçişine karıştırılmadı.

## Doğrulama

`npm run test:office` şu kontrolleri çalıştırır:

1. Eski kayıt dönüşümü ve tekrar yükleme kararlılığı.
2. Tüm ofis kademeleri/oda türlerinde varsayılan eşya erişimi.
3. Çakışma, duvar, kapı ve kapatılan kullanım yolu reddi.
4. Taşıma/döndürme, dekor ekleme/kaldırma ve kayıt bütünlüğü.
5. Ofis yükseltme, oda yıkma ve diğer odaların konumlarını koruma.
6. Yerleşim değiştirildiğinde 16 haftalık ekonomi/üretim sonucunun aynı kalması.
7. Gerçek Phaser CanvasRenderer ile sahne açılışı, çalışan yürüyüşü/duraklatma, yerleşim onayı, dikey/yatay boyut değişimi ve dolu raster çıktı.
8. HTML menülerle Phaser'ın birlikte açılması; yeni kariyer → sihirbaz → üretime başlama → ofis düzenleme → kayıt akışı.

Son iki test **Node + jsdom + yerel Canvas ortamında** çalışır. Gerçek Chrome/Safari, WebGL, dokunmatik cihaz veya oynanış denemesi değildir. Tarayıcı testinin yapıldığı iddia edilmez. Küçük telefonlarda dokunma hissi, GPU çizimi ve görsel yerleşim hâlâ gerçek cihazda değerlendirilmelidir.

Mevcut `node test/validate.mjs` sonucu geçişten önce ve sonra **411 geçti / 11 başarısız**. Aynı başarısızlıklar: dört puan/hedef kalibrasyonu, iki satış aralığı, üç eski pazarlama departmanı senaryosu ve iki yayıncı eşiği/anlaşma beklentisi. Yeni ofis testleri bunları sessizce geçilmiş saymaz; ana test komutunun başarısız çıkışı korunur.
