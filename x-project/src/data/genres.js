// Konu D: türler, alt türler, kombinasyon kademeleri, kurucu geçmişi ve tür yaşam döngüsü (P, içerik).
// Eski altı tür "eksen" olarak kalır (AXES); platform, bölge ve konsol verisi 6 eksenli dizilerle durur,
// yeni türler bu eksenlerin karışımıyla (axes) ve türe özel düzeltmelerle (platAdj, regAdj) hesaplanır.

export const AXES = ['aksiyon', 'macera', 'rpg', 'simulasyon', 'strateji', 'casual'];

// Kademeler: v = uyum değeri (kalite çarpanına v/10 girer), sub = ana tür × alt tür puanı, ts = konu × alt tür puanı,
// subF = kötü alt türün kalite çarpanına etkisi (İğrenç bir alt tür iyi bir konuyu da batırır).
export const TIERS = [
  { id: 'S', name: 'Süper', icon: '★★', v: 10, sub: 0, ts: 0, subF: 1, tone: 'good' },
  { id: 'I', name: 'İyi', icon: '★', v: 9, sub: -0.5, ts: 0, subF: 1, tone: 'good' },
  { id: 'G', name: 'Geçerli', icon: '●', v: 8, sub: -1.5, ts: 0, subF: 1, tone: 'info' },
  { id: 'B', name: 'Başarısız', icon: '▽', v: 7, sub: -3, ts: -1, subF: 0.95, tone: 'bad' },
  { id: 'K', name: 'Kötü', icon: '✖', v: 6, sub: -5, ts: -2, subF: 0.85, tone: 'bad' },
  { id: 'X', name: 'İğrenç', icon: '☠', v: 4, sub: -9, ts: -5, subF: 0.7, tone: 'bad' },
];
export const TIER = Object.fromEntries(TIERS.map((t) => [t.id, t]));
export const ORDER = TIERS.map((t) => t.id); // iyiden kötüye
export const tierOfValue = (v) => (v >= 9.5 ? 'S' : v >= 8.5 ? 'I' : v >= 7.5 ? 'G' : v >= 6.5 ? 'B' : v >= 5 ? 'K' : 'X');

// --- Ana türler (13). İlk altısı eski türler ve aynı sırada kalır (eski 6'lı diziler bu indeksleri kullanır).
// disc: ideal disiplin dağılımı; mission: 9 görevin önemi; hint: sihirbazın önerdiği kaydırıcılar.
export const GENRES = [
  { id: 'aksiyon', name: 'Aksiyon', icon: '💥', year: 1976, research: 'tur_aks', near: ['nisanci', 'dovus', 'platform'], axes: { aksiyon: 1 },
    disc: { oyn: 0.397, gfx: 0.231, ses: 0.115, tek: 0.256 }, mission: [1, 0.9, 0.7, 0.6, 0.9, 1, 0.8, 1, 0.9], hint: [100, 80, 0, 0, 80, 100, 0, 100, 80],
    soul: 'Önce vur, sonra sor, sonra yine vur.' },
  { id: 'macera', name: 'Macera', icon: '🗺️', year: 1976, research: 'tur_mac', near: ['rpg', 'bulmaca'], axes: { macera: 1 },
    disc: { oyn: 0.468, gfx: 0.247, ses: 0.104, tek: 0.182 }, mission: [0.7, 0.8, 1, 1, 0.8, 0.7, 1, 0.9, 0.8], hint: [0, 0, 100, 100, 0, 0, 100, 80, 0],
    soul: 'Her şeyi al, her şeyi her şeyle birleştir.' },
  { id: 'rpg', name: 'RPG', icon: '🐉', year: 1977, research: 'tur_rpg', near: ['macera', 'strateji'], axes: { rpg: 1 },
    disc: { oyn: 0.468, gfx: 0.247, ses: 0.104, tek: 0.182 }, mission: [0.7, 0.8, 1, 1, 0.8, 0.7, 1, 0.9, 0.8], hint: [0, 80, 100, 100, 80, 0, 100, 80, 0],
    soul: 'Seviye 1 fare, seviye 99 fare. Fare hep fare.' },
  { id: 'simulasyon', name: 'Simülasyon', icon: '🏙️', year: 1980, research: 'tur_sim', near: ['strateji', 'spor', 'yaris'], axes: { simulasyon: 1 },
    disc: { oyn: 0.425, gfx: 0.225, ses: 0.113, tek: 0.237 }, mission: [0.9, 1, 0.8, 0.7, 0.9, 1, 0.8, 1, 0.9], hint: [80, 100, 0, 0, 80, 100, 0, 100, 80],
    soul: 'Hayatın sıkıcı kısmı, ama senin kontrolünde.' },
  { id: 'strateji', name: 'Strateji', icon: '♟️', year: 1979, research: 'tur_str', near: ['simulasyon', 'bulmaca', 'rpg'], axes: { strateji: 1 },
    disc: { oyn: 0.438, gfx: 0.225, ses: 0.113, tek: 0.225 }, mission: [0.9, 1, 0.8, 0.7, 1, 0.9, 1, 0.8, 0.9], hint: [80, 100, 0, 0, 100, 80, 100, 0, 80],
    soul: 'Bir turluk hamle, üç saatlik düşünme.' },
  { id: 'casual', name: 'Casual', icon: '🎈', year: 1976, research: 'tur_cas', near: ['bulmaca', 'ritim', 'platform'], axes: { casual: 1 },
    disc: { oyn: 0.472, gfx: 0.236, ses: 0.125, tek: 0.167 }, mission: [0.6, 1, 0.7, 0.7, 1, 0.6, 0.7, 1, 0.9], hint: [0, 100, 0, 0, 100, 0, 0, 100, 80],
    soul: 'Annen de oynar, annenin annesi de.' },
  { id: 'nisanci', name: 'Nişancı', icon: '🎯', year: 1978, research: 'tur_nis', near: ['aksiyon'], axes: { aksiyon: 0.85, strateji: 0.15 },
    disc: { oyn: 0.38, gfx: 0.25, ses: 0.12, tek: 0.25 }, mission: [1, 1, 0.6, 0.6, 0.9, 1, 0.8, 1, 0.9], hint: [100, 100, 0, 0, 80, 100, 0, 100, 80],
    platAdj: { pc: 0.5, el: -1, mobil: -1 }, regAdj: { na: 1.1, eu: 1.05, jp: 0.9 }, soul: 'Ekranda ne varsa vurulur; ne yoksa o da vurulur.' },
  { id: 'platform', name: 'Platform', icon: '🍄', year: 1981, research: 'tur_pla', near: ['aksiyon', 'casual'], axes: { aksiyon: 0.6, casual: 0.4 },
    disc: { oyn: 0.45, gfx: 0.25, ses: 0.12, tek: 0.18 }, mission: [0.8, 1, 0.6, 0.6, 1, 0.7, 0.9, 1, 1], hint: [80, 100, 0, 0, 100, 0, 80, 100, 100],
    platAdj: { konsol: 1, el: 1, pc: -1 }, regAdj: { jp: 1.15 }, soul: 'Zıpla, düş, tekrar zıpla. Prenses yine başka kalede.' },
  { id: 'dovus', name: 'Dövüş', icon: '🥊', year: 1984, research: 'tur_dov', near: ['aksiyon'], axes: { aksiyon: 0.9, casual: 0.1 },
    disc: { oyn: 0.42, gfx: 0.26, ses: 0.12, tek: 0.2 }, mission: [0.9, 1, 0.6, 0.6, 0.7, 1, 0.7, 1, 0.9], hint: [80, 100, 0, 0, 0, 100, 0, 100, 80],
    platAdj: { konsol: 1, pc: -1, mobil: -2 }, regAdj: { jp: 1.15, latam: 1.15, asya: 1.1 }, soul: 'İki kişi, bir ekran, otuz yıllık küslük.' },
  { id: 'spor', name: 'Spor', icon: '⚽', year: 1976, research: 'tur_spo', near: ['yaris', 'simulasyon'], axes: { simulasyon: 0.5, aksiyon: 0.3, casual: 0.2 },
    disc: { oyn: 0.42, gfx: 0.24, ses: 0.12, tek: 0.22 }, mission: [0.9, 1, 0.6, 0.7, 0.8, 1, 0.8, 1, 0.9], hint: [80, 100, 0, 0, 80, 100, 0, 100, 80],
    platAdj: { konsol: 0.5 }, regAdj: { na: 1.1, eu: 1.1, latam: 1.2, tr: 1.15, jp: 0.85 }, soul: 'Her yıl aynı oyun, her yıl yeni forma.' },
  { id: 'yaris', name: 'Yarış', icon: '🏎️', year: 1976, research: 'tur_yar', near: ['spor', 'aksiyon'], axes: { aksiyon: 0.5, simulasyon: 0.5 },
    disc: { oyn: 0.38, gfx: 0.26, ses: 0.12, tek: 0.24 }, mission: [1, 1, 0.6, 0.6, 1, 0.9, 0.8, 1, 0.9], hint: [100, 100, 0, 0, 100, 80, 0, 100, 80],
    platAdj: { konsol: 0.5, mobil: -0.5 }, regAdj: { eu: 1.05, jp: 1.05 }, soul: 'Fren pedalı süs içindir.' },
  { id: 'bulmaca', name: 'Bulmaca', icon: '🧩', year: 1980, research: 'tur_bul', near: ['casual', 'strateji', 'macera'], axes: { casual: 0.6, strateji: 0.4 },
    disc: { oyn: 0.52, gfx: 0.22, ses: 0.12, tek: 0.14 }, mission: [0.6, 1, 0.6, 0.6, 1, 0.8, 0.6, 0.9, 0.9], hint: [0, 100, 0, 0, 100, 80, 0, 80, 80],
    platAdj: { el: 1, mobil: 1 }, regAdj: { asya: 1.15, eu: 1.05 }, soul: 'Uyumadan önce bir el. Saat 04.00.' },
  { id: 'ritim', name: 'Ritim', icon: '🎵', year: 1996, research: 'tur_rit', near: ['casual'], axes: { casual: 0.6, aksiyon: 0.4 },
    disc: { oyn: 0.4, gfx: 0.2, ses: 0.28, tek: 0.12 }, mission: [0.7, 1, 0.6, 0.6, 0.9, 0.6, 0.7, 0.9, 1], hint: [0, 100, 0, 0, 80, 0, 0, 80, 100],
    platAdj: { konsol: 1, el: 0.5, pc: -1 }, regAdj: { jp: 1.25, asya: 1.1 }, soul: 'Ayak, tuş ve komşu şikâyeti uyum içinde.' },
];
export const GENRE_IDS = GENRES.map((g) => g.id);
// Sihirbaz ve pencerelerde gösterim sırası (aileler yan yana)
export const DISPLAY = ['aksiyon', 'nisanci', 'platform', 'dovus', 'macera', 'rpg', 'strateji', 'simulasyon', 'spor', 'yaris', 'bulmaca', 'casual', 'ritim'];

// --- Ana tür × alt türün ana türü (satır: seçilen ana tür, sütun: alt türün kendi ana türü; GENRE_IDS sırası)
export const REL = {
  aksiyon: 'SIIBBGIIIBGBG', macera: 'ISIBBGBGKKKIB', rpg: 'IISBIBGBBKKGB', simulasyon: 'BBBSIGKKXIIGK',
  strateji: 'KBIISBBXXBKIX', casual: 'GGBGBSBIBGGII', nisanci: 'IBGBBBSGBKGKG', platform: 'IGBKXIGSBKGIG',
  dovus: 'IKBXKGBBSGKKG', spor: 'BKKIBGKKGSGBG', yaris: 'GKKIBGGBKGSKB', bulmaca: 'BIGGIIKGKBKSG', ritim: 'GBBKXIGGGGBGS',
};

// --- Konu × ana tür (GENRE_IDS sırası: aks mac rpg sim str cas | nis pla dov spo yar bul rit)
export const TOPIC_FIT = {
  uzay: 'SIGIGBSIGBIGG', fantezi: 'GSSKIBBIIKKGB', spor: 'GKKSBSKBGSGBG', futbol: 'BXKSIIXBKSBBB', yaris: 'SKKSKIGGKISBB',
  zindan: 'ISSKGBGIGXXIB', korsan: 'SSGBGGGIGKGGB', askeri: 'SBBISKSGBKGBX', dedektif: 'KSGBBGKBKXKSX', hayvan: 'KBKSKSXIBBGIG',
  ninja: 'SGGKGGISSKBBG', robot: 'SGGIIGSISBGGB', kiyamet: 'SISGGKSGGXIBX', korku: 'SSGKKBIBBXKGK', sehir: 'KBBSSGBBKBGGB',
  is: 'KBKSSGXKXKKGX', tarih: 'BIIISKGBGKKGB', muzik: 'BBKGKSGGBBGGS', kahraman: 'SGIKKGISSBBBB', okul: 'KSIBXIKBBIBIG',
  ofis: 'KIBSBSKBBKKIG', zombi: 'SIGGGGSGBXGBB', siberpunk: 'SISBGKSGGKIGG', casus: 'SSBBGKIGBXGGX', sualti: 'ISGGKIGGKBBIB',
  hastane: 'KBKSIGXKKXXGX', oyungelistirme: 'KBKSKIKBXKKGB', hukumet: 'KBBSSKKXBXXGX', kedi: 'BGBIKSKSBBBII', zaman: 'ISSBGBGIGKGSG',
  kurtadam: 'IISKBBGGIXKBK', mafya: 'SIGGIKIBGKIBX', moda: 'KBKIBSXBXKKGI', dans: 'BKKIXSKGGGBBS', startup: 'KBBSIIXKXKKGX',
  hayatta: 'SIIIGKIGBXBBX', sosyal: 'KBKIBSKKXKKIG', yapayzeka: 'GSIIIBGBBKGIB', kripto: 'KBKSGIXKXXKGX', pandemi: 'BGBSIGKKXXXGX',
};

// --- Alt türler (115). p: ana tür, y: doğuş, peak: altın çağ [baş, son], bubble: altın çağdan sonra çöker,
// rel: ana tür kademesi istisnaları, aud / plat: kitle ve platform türü için tavan kademe.
const S = (id, name, p, y, peak, joke, o = {}) => ({ id, name, parent: p, year: y, peak, joke, ...o });
export const SUBGENRES = [
  // Aksiyon
  S('labirent', 'Labirent kovalamaca', 'aksiyon', 1980, [1980, 1984], 'Dört hayalet, bir aç ağız, sonsuz koridor.', { rel: { casual: 'I', bulmaca: 'I', platform: 'G' } }),
  S('yurudov', 'Yürü-döv', 'aksiyon', 1984, [1987, 1994], 'Sokaktaki herkes sana kızgın; nedenini kimse bilmiyor.', { rel: { dovus: 'S', platform: 'I' } }),
  S('kesbic', 'Kes-biç', 'aksiyon', 1986, [2001, 2010], 'Kılıcı salla, kombo sayacı dönsün.', { rel: { rpg: 'I', dovus: 'I' } }),
  S('gizlilik', 'Gizlilik', 'aksiyon', 1981, [1998, 2008], 'Karton kutu en iyi kamuflajdır.', { rel: { macera: 'I', nisanci: 'I', strateji: 'G' } }),
  S('aksiyonmacera', 'Aksiyon-macera', 'aksiyon', 1979, [1998, 2015], 'Kılıç da var bulmaca da; ikisi de yarım.', { rel: { macera: 'S', rpg: 'I' } }),
  S('hayattakorku', 'Hayatta kalma korkusu', 'aksiyon', 1992, [1996, 2005], 'Mermi az, kapı gıcırtılı, kayıt daktiloda.', { rel: { macera: 'I', nisanci: 'I', casual: 'X', spor: 'X', ritim: 'X', yaris: 'X' }, aud: { genc: 'K' } }),
  S('metroidvania', 'Labirent-keşif (metroidvania)', 'aksiyon', 1986, [2015, 2022], 'Bu kapıyı altı saat sonra açacaksın. Şimdilik bak.', { rel: { platform: 'S', macera: 'I', rpg: 'I' } }),
  S('acikdunyaaksiyon', 'Açık dünya suç', 'aksiyon', 1997, [2001, 2015], 'Görev var, ama önce üç saat taksi çaldık.', { rel: { macera: 'I', yaris: 'I', rpg: 'I', nisanci: 'I', bulmaca: 'X', ritim: 'X' }, aud: { genc: 'K' } }),
  S('ruhlar', 'Zorlu aksiyon (ruhlar-benzeri)', 'aksiyon', 2009, [2011, 2022], 'Öldün, öldün, öldün. Patron öldü. Ağladın.', { rel: { rpg: 'S', platform: 'I', casual: 'X' }, aud: { genc: 'B' } }),
  // Nişancı
  S('uzaynisanci', 'Sabit ekran nişancı', 'nisanci', 1978, [1978, 1983], 'Uzaylılar sırayla iner; kibar bir istila.', { rel: { aksiyon: 'S', casual: 'I' } }),
  S('kaydirmali', 'Kaydırmalı nişancı', 'nisanci', 1981, [1985, 1995], 'Gemin bir piksel, düşman mermisi bin piksel.', { rel: { aksiyon: 'S', platform: 'I' } }),
  S('ikicubuk', 'Çift çubuk nişancı', 'nisanci', 1982, [2005, 2012], 'Sol çubuk kaç, sağ çubuk vur, beyin pes.', { rel: { aksiyon: 'S', casual: 'G' }, plat: { mobil: 'B' } }),
  S('isiktabancasi', 'Işık tabancası', 'nisanci', 1984, [1987, 2000], 'Şarjör için ekranın dışına ateş et. Mantıklı.', { rel: { aksiyon: 'I' }, plat: { mobil: 'X', el: 'X', pc: 'B' } }),
  S('fps', 'Birinci şahıs nişancı', 'nisanci', 1992, [1996, 2015], 'Yalnız eller ve silah. Ayak yok. Hiç ayak yok.', { rel: { aksiyon: 'S', rpg: 'I', macera: 'G', platform: 'K' }, plat: { el: 'K', mobil: 'B' } }),
  S('mermicehennemi', 'Mermi cehennemi', 'nisanci', 1995, [1997, 2008], 'Ekranın %90\'ı mermi, %10\'u umut.', { rel: { aksiyon: 'I', bulmaca: 'K', casual: 'K' }, aud: { herkes: 'B' }, plat: { mobil: 'B' } }),
  S('arenanisanci', 'Arena nişancı', 'nisanci', 1996, [1997, 2004], 'Roketle zıplamak bir yaşam biçimidir.', { rel: { aksiyon: 'I', spor: 'G' } }),
  S('taktiknisanci', 'Taktik nişancı', 'nisanci', 1998, [1999, 2012], 'Tek mermide ölürsün; nefes bile planlı.', { rel: { strateji: 'I' } }),
  S('siper', 'Siper nişancı', 'nisanci', 2003, [2006, 2013], 'Bel hizasında duvar gördüysen savaş başlıyor.', { rel: { aksiyon: 'S' } }),
  S('kahramannisanci', 'Kahraman nişancı', 'nisanci', 2007, [2016, 2021], 'Herkesin kendine has bir çığlığı ve şikâyeti var.', { rel: { aksiyon: 'I', dovus: 'G', strateji: 'G' } }),
  S('yagmaci', 'Yağmacı nişancı', 'nisanci', 2009, [2012, 2020], 'Mor silah, turuncu silah, biraz daha turuncu silah.', { rel: { rpg: 'S', aksiyon: 'I' } }),
  S('cikarma', 'Çıkarma nişancı', 'nisanci', 2016, [2022, 2025], 'Ganimeti al, helikoptere koş, helikopter gitmiş.', { rel: { aksiyon: 'I', simulasyon: 'G' } }),
  S('battleroyale', 'Son kalan (battle royale)', 'nisanci', 2017, [2017, 2022], 'Yüz kişi atlar, biri sevinir, doksan dokuzu "lag" der.', { rel: { aksiyon: 'I', yaris: 'G', bulmaca: 'X', ritim: 'X', macera: 'K' } }),
  // Platform
  S('tekekran', 'Tek ekran platform', 'platform', 1981, [1981, 1985], 'Varil yuvarlanıyor, sen merdiven tırmanıyorsun.', { rel: { aksiyon: 'I', casual: 'I', bulmaca: 'G' } }),
  S('yankaydirma', 'Yan kaydırmalı platform', 'platform', 1985, [1985, 1995], 'Sağa git. Hep sağa. Sol yasak.', { rel: { aksiyon: 'I', macera: 'G' } }),
  S('maskot', 'Maskot platform', 'platform', 1990, [1991, 1998], 'Tavırlı bir hayvan + hız = pazarlama.', { rel: { aksiyon: 'I', yaris: 'I', casual: 'G' } }),
  S('platform3b', '3B platform', 'platform', 1996, [1996, 2002], 'Kamera düşmandır.', { rel: { aksiyon: 'I', macera: 'I' }, plat: { mobil: 'B' } }),
  S('toplama', 'Toplama oyunu', 'platform', 1997, [1997, 2002], '748 nota, 101 yıldız, sıfır sosyal hayat.', { rel: { macera: 'I', casual: 'G' } }),
  S('bulmacaplatform', 'Bulmacalı platform', 'platform', 2008, [2008, 2016], 'Zamanı geri sar; hayatı geri saramazsın.', { rel: { bulmaca: 'S', macera: 'I' } }),
  S('hassas', 'Hassas platform', 'platform', 2008, [2010, 2020], 'Ölüm sayacı 1.432. Hâlâ eğlenceli.', { rel: { aksiyon: 'I', bulmaca: 'G' } }),
  // Dövüş
  S('birebir', 'Bire bir dövüş', 'dovus', 1984, [1991, 1999], 'Aşağı, ileri, yumruk. Ya da her tuşa bas, o da olur.', { rel: { aksiyon: 'I' }, plat: { mobil: 'K' } }),
  S('dovus3b', '3B arena dövüş', 'dovus', 1993, [1995, 2003], 'Yana adım at; yetmiş hareketin onu bu.', { rel: { aksiyon: 'I', spor: 'G' } }),
  S('silahlidovus', 'Silahlı dövüş', 'dovus', 1995, [1998, 2008], 'Kılıç da yumruk sayılır.', { rel: { aksiyon: 'I', rpg: 'G' } }),
  S('partidovus', 'Platform dövüş (parti)', 'dovus', 1999, [2001, 2019], '%300 hasar aldın ama hâlâ ayaktasın.', { rel: { casual: 'S', platform: 'I' }, aud: { yetiskin: 'G' } }),
  // Macera
  S('metinmacera', 'Metin macerası', 'macera', 1976, [1977, 1985], '> KUZEYE GİT. Kuzeye gidemezsin. > NEDEN. Anlamadım.', { rel: { rpg: 'I', bulmaca: 'I', nisanci: 'X', dovus: 'X', ritim: 'X' }, plat: { konsol: 'K', el: 'K' } }),
  S('grafikmacera', 'Tıkla-gez (grafik macera)', 'macera', 1980, [1987, 1997], 'Lastik tavuğu makaraya tak, kapı açılsın. Mantık bu.', { rel: { bulmaca: 'I' }, plat: { konsol: 'B', el: 'B' } }),
  S('gorselroman', 'Görsel roman', 'macera', 1983, [2000, 2012], 'Oku, oku, seç: "Evet" ya da "Elbette".', { rel: { simulasyon: 'I', rpg: 'G', nisanci: 'X', yaris: 'X', spor: 'X' } }),
  S('etkilesimlifilm', 'Etkileşimli film', 'macera', 1983, [1993, 1996], 'Gerçek oyuncular, gerçek peruklar, gerçek pişmanlık.', { bubble: true, rel: { aksiyon: 'G', nisanci: 'I' } }),
  S('dedektifmacera', 'Dedektif ve sorgu', 'macera', 1984, [2011, 2021], 'Yalan söylediğini biliyorum; kanıtım bir şemsiye.', { rel: { bulmaca: 'S', rpg: 'G' } }),
  S('kacisodasi', 'Kaçış odası', 'macera', 2004, [2010, 2016], 'Anahtar vazonun içinde. Her zaman vazonun içinde.', { rel: { bulmaca: 'S', casual: 'I' } }),
  S('secimli', 'Seçimli anlatı', 'macera', 2012, [2012, 2018], '"Bu karakter bunu hatırlayacak." Hatırlamadı.', { rel: { rpg: 'I', simulasyon: 'G' } }),
  S('yuruyus', 'Yürüyüş simülatörü', 'macera', 2012, [2013, 2019], 'Yürüdük, mektup okuduk, ağladık.', { rel: { simulasyon: 'I', bulmaca: 'G', nisanci: 'X', dovus: 'X', spor: 'X', yaris: 'X' }, aud: { genc: 'B' } }),
  // RPG
  S('zindangezgini', 'Zindan gezgini', 'rpg', 1976, [1981, 1992], 'Kare kare ilerle, kareli kâğıda harita çiz.', { rel: { macera: 'I', aksiyon: 'G', strateji: 'G' } }),
  S('bilgisayarrpg', 'Bilgisayar RPG (parti)', 'rpg', 1979, [1985, 2001], 'Altı kişilik parti, 400 sayfalık kılavuz, bir zar.', { rel: { strateji: 'I', macera: 'I' }, plat: { el: 'B' } }),
  S('roguelike', 'Roguelike', 'rpg', 1980, [1980, 1990], 'Öldün mü? Her şey baştan. Güzel değil mi?', { rel: { aksiyon: 'I', strateji: 'I', platform: 'I', nisanci: 'I', bulmaca: 'I', ritim: 'I' } }),
  S('aksiyonrpg', 'Aksiyon RPG', 'rpg', 1984, [1996, 2015], 'Tıkla, tıkla, ganimet, tıkla.', { rel: { aksiyon: 'S', nisanci: 'I' } }),
  S('jrpg', 'Japon RPG', 'rpg', 1986, [1990, 2005], 'Saçı dik bir genç tanrıyı öldürür. Sonra balık tutar.', { rel: { macera: 'I' } }),
  S('taktikrpg', 'Taktik RPG', 'rpg', 1990, [1994, 2005], '%95 isabet. Iskaladı. Tabii ki ıskaladı.', { rel: { strateji: 'S' } }),
  S('acikdunyarpg', 'Açık dünya RPG', 'rpg', 1994, [2002, 2020], 'Ana görevi 200 saattir erteliyorsun.', { rel: { aksiyon: 'I', macera: 'I' }, plat: { el: 'B', mobil: 'K' } }),
  S('canavartoplama', 'Canavar toplama', 'rpg', 1996, [1996, 2005], 'Hepsini topla. Hepsini. Evet, o da.', { rel: { casual: 'I', simulasyon: 'I', strateji: 'G' } }),
  S('mmorpg', 'MMORPG', 'rpg', 1997, [2004, 2012], 'Bin kişiyle aynı ejderhayı bekliyorsun; sırada 47.\'sin.', { rel: { aksiyon: 'G', strateji: 'G', simulasyon: 'G', casual: 'K', bulmaca: 'K', ritim: 'X', yaris: 'K' }, plat: { el: 'K', konsol: 'B' } }),
  S('roguelite', 'Roguelite', 'rpg', 2011, [2014, 2025], 'Öldün ama 3 altın kalıcı. Bu bir ilerleme.', { rel: { aksiyon: 'I', platform: 'I', nisanci: 'I', strateji: 'I', bulmaca: 'G', casual: 'G', ritim: 'I' } }),
  S('gacharpg', 'Şans kutulu RPG (gacha)', 'rpg', 2012, [2014, 2025], '%0,6 şans. Annen kartı kesti.', { rel: { casual: 'I', strateji: 'G', ritim: 'G' }, aud: { genc: 'K' } }),
  // Strateji
  S('savasoyunu', 'Savaş oyunu (altıgen)', 'strateji', 1976, [1977, 1990], 'Altıgen, sayı, bir tank sembolü. Bu bir savaş.', { rel: { simulasyon: 'I' }, aud: { genc: 'B', herkes: 'B' }, plat: { konsol: 'K', el: 'B' } }),
  S('siratabanli', 'Sıra tabanlı strateji', 'strateji', 1979, [1990, 2005], 'Bir tur daha. Sabah oldu.', { rel: { rpg: 'I', bulmaca: 'G' } }),
  S('4x', '4X', 'strateji', 1991, [1991, 2005], 'Barışçıl bir medeniyetiz. Nükleer silahla.', { rel: { simulasyon: 'I' }, plat: { konsol: 'B', el: 'B' } }),
  S('rts', 'Gerçek zamanlı strateji', 'strateji', 1992, [1995, 2005], 'Daha çok odun lazım. Hep daha çok odun.', { rel: { simulasyon: 'G', aksiyon: 'B' }, plat: { konsol: 'B', el: 'K' } }),
  S('koleksiyonkart', 'Koleksiyon kart', 'strateji', 1997, [2014, 2019], 'Paket aç, ortak kart, paket aç.', { rel: { casual: 'I', rpg: 'G' } }),
  S('buyukstrateji', 'Büyük strateji', 'strateji', 2000, [2012, 2022], 'Avrupa\'yı evlilik politikasıyla ele geçir.', { rel: { simulasyon: 'I', rpg: 'G' }, aud: { genc: 'B' }, plat: { konsol: 'K', el: 'X', mobil: 'K' } }),
  S('moba', 'MOBA', 'strateji', 2003, [2009, 2016], 'Takım arkadaşın "kolay" yazdı. Kaybettiniz.', { rel: { aksiyon: 'I', rpg: 'I', nisanci: 'I', casual: 'G', spor: 'B' }, plat: { konsol: 'K', el: 'K' } }),
  S('kulesavunma', 'Kule savunma', 'strateji', 2007, [2008, 2014], 'Düşman hep aynı yoldan gelir; kimse ders almaz.', { rel: { casual: 'S', bulmaca: 'I', aksiyon: 'B' } }),
  S('destekurma', 'Deste kurma', 'strateji', 2014, [2017, 2024], 'Bu kartla şu kartı oynarsan sonsuz hasar. Bulduk.', { rel: { rpg: 'I', bulmaca: 'I', casual: 'I' } }),
  S('otosavas', 'Otomatik savaşçı', 'strateji', 2019, [2019, 2020], 'Dizersin, izlersin, kaybedersin, yine dizersin.', { bubble: true, rel: { casual: 'I', rpg: 'G' } }),
  // Simülasyon
  S('ucus', 'Uçuş simülatörü', 'simulasyon', 1979, [1982, 2004], 'Kalkış 12 dakika, kontrol listesi 40 madde.', { rel: { nisanci: 'I', yaris: 'I', strateji: 'G' }, aud: { genc: 'B' }, plat: { el: 'K', konsol: 'B', mobil: 'K' } }),
  S('uzayticaret', 'Uzay ticareti', 'simulasyon', 1984, [1984, 1995], 'Ucuza al, uzayda pahalıya sat, korsana yakalan.', { rel: { rpg: 'I', strateji: 'I', nisanci: 'I' } }),
  S('hayatsim', 'Hayat simülasyonu', 'simulasyon', 1985, [2000, 2014], 'Havuz merdivenini silme. Hayır, yapma!', { rel: { casual: 'S', macera: 'I' } }),
  S('sehirkurma', 'Şehir kurma', 'simulasyon', 1989, [1989, 2003], 'Belediye başkanısın; her şey trafik.', { rel: { strateji: 'S' }, plat: { konsol: 'B', el: 'B' } }),
  S('tanrioyunu', 'Tanrı oyunu', 'simulasyon', 1989, [1989, 2001], 'Halk dua ediyor, sen yanlışlıkla deprem attın.', { rel: { strateji: 'S' }, plat: { konsol: 'B' } }),
  S('tycoon', 'İşletme (tycoon)', 'simulasyon', 1990, [1994, 2004], 'Lunapark tuvaletine 3 dolar koy; ziyaretçiler ağlasın.', { rel: { strateji: 'I', casual: 'I' }, aud: { genc: 'G' }, plat: { konsol: 'B' } }),
  S('flort', 'Flört simülasyonu', 'simulasyon', 1992, [1994, 2002], 'Yanlış çiçek, sonsuz yalnızlık.', { rel: { macera: 'I', yaris: 'X', dovus: 'X', nisanci: 'X', spor: 'K' }, aud: { genc: 'B' } }),
  S('sanalevcil', 'Sanal evcil', 'simulasyon', 1996, [1996, 1999], 'Okul saatinde acıktı, öldü, ağladık.', { bubble: true, rel: { casual: 'S', rpg: 'G' }, aud: { yetiskin: 'B' } }),
  S('ciftlik', 'Çiftlik ve kasaba', 'simulasyon', 1996, [2016, 2025], 'Turp ek, köylüyle evlen, borcunu öde.', { rel: { rpg: 'I', casual: 'I' } }),
  S('arac', 'Araç simülasyonu', 'simulasyon', 1999, [2012, 2020], 'Dört saat otoyol. En rahatlatıcı oyun.', { rel: { yaris: 'S' }, aud: { genc: 'B' }, plat: { el: 'K', mobil: 'B' } }),
  S('hayattakalma', 'Hayatta kalma ve zanaat', 'simulasyon', 2009, [2013, 2020], 'Odun yığ, gece gelmeden kulübe yap.', { rel: { aksiyon: 'I', rpg: 'I', strateji: 'G' } }),
  S('kumhavuzu', 'Kum havuzu', 'simulasyon', 2009, [2011, 2020], 'Hedef yok. Dünyayı kare kare yeniden yap.', { rel: { aksiyon: 'G', macera: 'G', casual: 'G', bulmaca: 'I', rpg: 'G' } }),
  S('koloni', 'Koloni yönetimi', 'simulasyon', 2013, [2016, 2023], 'Kolonist ağaca sarılıp ağladı. Yine.', { rel: { strateji: 'S' }, plat: { konsol: 'B', mobil: 'B' } }),
  S('otomasyon', 'Fabrika otomasyonu', 'simulasyon', 2016, [2016, 2025], 'Konveyör bant beynine yerleşti.', { rel: { strateji: 'I', bulmaca: 'I' }, plat: { konsol: 'B', el: 'K', mobil: 'K' } }),
  // Spor
  S('arcadespor', 'Salon sporu', 'spor', 1976, [1976, 1995], 'Kaleci bir piksel, top bir kare.', { rel: { casual: 'I', aksiyon: 'G' } }),
  S('rahatspor', 'Rahat spor (golf, bowling)', 'spor', 1978, [1985, 2000], 'Rüzgâr 3 km/s. Babaannen birinci.', { rel: { casual: 'S' } }),
  S('menajerlik', 'Spor menajerliği', 'spor', 1982, [1992, 2012], 'Maç izlemiyorsun, puan tablosu izliyorsun.', { rel: { simulasyon: 'S', strateji: 'I' }, aud: { genc: 'G' }, plat: { konsol: 'B' } }),
  S('coklu', 'Çoklu spor (olimpiyat)', 'spor', 1983, [1983, 1990], 'Tuşa olabildiğince hızlı bas. Bilek sakatlığı dahil.', { rel: { casual: 'I', ritim: 'G', aksiyon: 'G' } }),
  S('gures', 'Güreş şovu', 'spor', 1985, [1998, 2003], 'Senaryolu ama sandalye gerçek.', { rel: { dovus: 'S', aksiyon: 'I' } }),
  S('balik', 'Balık tutma', 'spor', 1985, [1997, 2002], 'Bekle. Bekle. Bekle. Çizme yakaladın.', { rel: { simulasyon: 'I', casual: 'I' } }),
  S('ekstrem', 'Ekstrem spor', 'spor', 1986, [1999, 2004], 'Kaykay, çift takla, hastane faturası.', { rel: { yaris: 'I', aksiyon: 'I', platform: 'G' } }),
  S('gercekcispor', 'Gerçekçi spor simülasyonu', 'spor', 1990, [1995, 2025], 'Bu yıl yeni: forma kıvrımları.', { rel: { simulasyon: 'I' }, aud: { genc: 'G' } }),
  S('fantastikspor', 'Fantastik spor', 'spor', 2008, [2015, 2020], 'Arabalarla futbol. Kimse nedenini sormadı.', { rel: { yaris: 'I', aksiyon: 'G', dovus: 'G' } }),
  // Yarış
  S('arcadeyaris', 'Salon yarışı', 'yaris', 1976, [1976, 2000], 'Kontrol noktasına 3 saniye. Jeton at.', { rel: { aksiyon: 'I', casual: 'G' } }),
  S('savasyarisi', 'Savaşlı yarış', 'yaris', 1987, [1995, 2005], 'Rakibi geçmek yerine havaya uçur.', { rel: { aksiyon: 'S', nisanci: 'I' } }),
  S('simyaris', 'Yarış simülasyonu', 'yaris', 1989, [1997, 2015], 'Lastik sıcaklığı 2 derece düştü; sezon bitti.', { rel: { simulasyon: 'S', spor: 'I' }, aud: { genc: 'G', herkes: 'G' }, plat: { el: 'B', mobil: 'K' } }),
  S('gelecekyarisi', 'Gelecek yarışı', 'yaris', 1990, [1995, 2002], 'Saatte 900 km, tekno müzik, sıfır fren.', { rel: { aksiyon: 'I', nisanci: 'G' } }),
  S('kartyaris', 'Kart yarışı', 'yaris', 1992, [1992, 2012], 'Lider oldun. Mavi kabuk geliyor.', { rel: { casual: 'S', platform: 'G', dovus: 'G' }, aud: { yetiskin: 'G' } }),
  S('sokakyarisi', 'Sokak yarışı ve modifiye', 'yaris', 1999, [2003, 2010], 'Neon alt aydınlatma 40 beygir ekler. Bilimsel.', { rel: { aksiyon: 'I', simulasyon: 'G' } }),
  S('acikdunyayaris', 'Açık dünya yarış', 'yaris', 2004, [2012, 2022], 'Bin araba, bir festival, bir garaj dolusu borç.', { rel: { aksiyon: 'I', simulasyon: 'I' } }),
  // Bulmaca
  S('kelime', 'Kelime oyunu', 'bulmaca', 1978, [2009, 2016], 'Beş harf, altı hak, bir paylaşım.', { rel: { casual: 'S', macera: 'I' } }),
  S('bilgiyarismasi', 'Bilgi yarışması', 'bulmaca', 1981, [1998, 2005], 'Hangisi kuş değildir? Seyirciye sor.', { rel: { casual: 'S', spor: 'G', macera: 'G' } }),
  S('mantik', 'Mantık bulmacası (kutu itme)', 'bulmaca', 1982, [1982, 1992], 'Kutuyu duvara ittin. Baştan.', { rel: { casual: 'I', strateji: 'I' } }),
  S('dusenblok', 'Düşen blok', 'bulmaca', 1984, [1989, 1996], 'Uzun parça hiç gelmiyor. Hiç.', { rel: { casual: 'I', aksiyon: 'G' } }),
  S('sayibulmaca', 'Sayı bulmacası', 'bulmaca', 1985, [2005, 2010], 'Dokuz kare, dokuz rakam, sıfır arkadaş.', { rel: { casual: 'S' } }),
  S('eslestir3', 'Eşleştir-3', 'bulmaca', 1994, [2012, 2020], 'Şekeri patlat, can bitti, 99 kuruş.', { rel: { casual: 'S', rpg: 'G', strateji: 'B' }, plat: { konsol: 'B' } }),
  S('gizlinesne', 'Gizli nesne', 'bulmaca', 2005, [2008, 2013], 'Odada üç makas var. Hep üç makas.', { rel: { casual: 'S', macera: 'I' }, plat: { konsol: 'B' } }),
  S('fizikbulmaca', 'Fizik bulmacası', 'bulmaca', 2005, [2009, 2014], 'Kızgın kuşlar değil; öfkeli kanatlılar.', { rel: { casual: 'S', aksiyon: 'G' } }),
  // Casual
  S('kartmasa', 'Kart ve masa oyunu', 'casual', 1978, [1990, 2005], 'Ofiste herkesin ekranında pasyans var.', { rel: { strateji: 'I', bulmaca: 'I' } }),
  S('egitsel', 'Eğitsel', 'casual', 1978, [1985, 2000], 'Matematik öğrenirken yılan avlayalım.', { rel: { bulmaca: 'S', simulasyon: 'I', macera: 'I', dovus: 'X', nisanci: 'X' }, aud: { yetiskin: 'B' } }),
  S('parti', 'Parti oyunu', 'casual', 1998, [1999, 2010], 'Dostluklar biter, zar atılır.', { rel: { spor: 'I', ritim: 'I', dovus: 'I' }, aud: { yetiskin: 'G' } }),
  S('hareket', 'Hareket ve fitness', 'casual', 2006, [2007, 2011], 'Kumandayı bileğine bağla; televizyon sağ kalsın.', { bubble: true, rel: { spor: 'S', ritim: 'S', dovus: 'G' }, plat: { pc: 'K', mobil: 'B', el: 'B' } }),
  S('sosyalciftlik', 'Sosyal ağ oyunu', 'casual', 2007, [2009, 2012], 'Komşunun ineğini sağ, bildirim yolla, arkadaş kaybet.', { bubble: true, rel: { simulasyon: 'S' }, plat: { konsol: 'X', el: 'K' } }),
  S('sonsuzkosu', 'Sonsuz koşu', 'casual', 2009, [2011, 2015], 'Koş. Tren geliyor. Koş.', { rel: { platform: 'S', aksiyon: 'I', yaris: 'G' } }),
  S('tiklama', 'Boşta ve tıklama', 'casual', 2013, [2013, 2018], 'Hiçbir şey yapma; sayı büyüyor, mutlusun.', { rel: { simulasyon: 'I', rpg: 'G', strateji: 'G' }, plat: { konsol: 'K' } }),
  S('hipergundelik', 'Hiper gündelik', 'casual', 2017, [2017, 2021], 'Tek parmak, üç saniye, reklam.', { rel: { bulmaca: 'I', yaris: 'I', platform: 'I', aksiyon: 'G' }, plat: { konsol: 'B', pc: 'B' } }),
  S('sosyalcikarim', 'Sosyal çıkarım (içimizdeki hain)', 'casual', 2018, [2020, 2021], 'Kırmızı şüpheli. Herkes kırmızı.', { rel: { macera: 'I', strateji: 'G' } }),
  // Ritim
  S('tusritmi', 'Tuş ritmi', 'ritim', 1996, [1996, 2005], 'Usta "sağ, sol, sağ" dedi. Sen "ne?" dedin.', { rel: { casual: 'I' } }),
  S('dans', 'Dans', 'ritim', 1998, [1999, 2004], 'Ok tuşuna ayakla bas; alt komşu tavana sopayla vurur.', { rel: { casual: 'S', spor: 'I' }, plat: { el: 'K', mobil: 'B' } }),
  S('karaoke', 'Karaoke', 'ritim', 2003, [2004, 2010], 'Doğru notayı bul. Bulamıyorsun.', { rel: { casual: 'S' }, plat: { el: 'B' } }),
  S('enstruman', 'Plastik enstrüman', 'ritim', 2005, [2007, 2009], 'Bodrumda plastik davul seti, yarım kira.', { bubble: true, rel: { casual: 'I' }, plat: { el: 'X', mobil: 'X', pc: 'B' } }),
  S('ritimaksiyon', 'Ritim aksiyon', 'ritim', 2015, [2016, 2025], 'Düşmana ritimle vur; ritimsiz vurursan kendine.', { rel: { aksiyon: 'S', rpg: 'I', platform: 'I', nisanci: 'I' } }),
  S('vrritim', 'Sanal gerçeklik ritmi', 'ritim', 2018, [2018, 2023], 'Işın kılıcıyla küp kes; kollar kopar.', { rel: { aksiyon: 'I', spor: 'I' }, plat: { el: 'X', mobil: 'X' } }),
];
export const SUB = Object.fromEntries(SUBGENRES.map((s) => [s.id, s]));

// Eski kayıtlarda alt tür ikinci bir ana türdü; en yakın alt türe çevrilir.
export const LEGACY_SUB = { aksiyon: 'aksiyonmacera', macera: 'grafikmacera', rpg: 'aksiyonrpg', simulasyon: 'tycoon', strateji: 'siratabanli', casual: 'parti' };

// --- Konu × alt tür: yalnız akılda kalan özel durumlar (gerisi Geçerli)
export const TOPIC_SUB = {
  'futbol|menajerlik': 'S', 'spor|menajerlik': 'I', 'futbol|gercekcispor': 'S', 'spor|gercekcispor': 'I', 'futbol|arcadespor': 'I', 'spor|coklu': 'S',
  'kedi|hayattakorku': 'X', 'hayvan|hayattakorku': 'X', 'dans|otosavas': 'X', 'moda|savasoyunu': 'X', 'hastane|battleroyale': 'X', 'okul|battleroyale': 'X',
  'okul|fps': 'X', 'pandemi|parti': 'X', 'dans|savasoyunu': 'X', 'oyungelistirme|gures': 'X', 'hukumet|dans': 'X', 'kripto|egitsel': 'X', 'kedi|battleroyale': 'K',
  'korku|hayattakorku': 'S', 'zombi|hayattakorku': 'S', 'uzay|kaydirmali': 'S', 'uzay|uzaynisanci': 'S', 'uzay|uzayticaret': 'S', 'uzay|4x': 'S',
  'zindan|roguelike': 'S', 'zindan|zindangezgini': 'S', 'zindan|roguelite': 'I', 'sehir|sehirkurma': 'S', 'is|tycoon': 'S', 'startup|tycoon': 'S', 'hastane|tycoon': 'I',
  'oyungelistirme|tycoon': 'S', 'muzik|enstruman': 'S', 'muzik|tusritmi': 'S', 'dans|dans': 'S', 'muzik|karaoke': 'S', 'yaris|simyaris': 'S', 'yaris|arcadeyaris': 'I',
  'tarih|buyukstrateji': 'S', 'tarih|4x': 'I', 'askeri|savasoyunu': 'S', 'askeri|rts': 'S', 'askeri|taktiknisanci': 'S', 'mafya|acikdunyaaksiyon': 'S',
  'siberpunk|acikdunyarpg': 'I', 'kiyamet|acikdunyarpg': 'S', 'kiyamet|cikarma': 'I', 'hayatta|hayattakalma': 'S', 'hayatta|battleroyale': 'S',
  'dedektif|dedektifmacera': 'S', 'dedektif|gorselroman': 'I', 'okul|gorselroman': 'S', 'okul|flort': 'I', 'okul|egitsel': 'I', 'ninja|gizlilik': 'S', 'casus|gizlilik': 'S',
  'casus|fps': 'I', 'fantezi|jrpg': 'S', 'fantezi|mmorpg': 'S', 'fantezi|acikdunyarpg': 'S', 'fantezi|koleksiyonkart': 'I', 'kripto|tiklama': 'I', 'startup|tiklama': 'I',
  'sosyal|sosyalciftlik': 'S', 'sosyal|sosyalcikarim': 'I', 'pandemi|buyukstrateji': 'I', 'hayvan|sanalevcil': 'S', 'hayvan|canavartoplama': 'S', 'kedi|sanalevcil': 'S',
  'robot|otomasyon': 'S', 'sualti|hayattakalma': 'I', 'kahraman|yurudov': 'I', 'korsan|acikdunyaaksiyon': 'I', 'yapayzeka|otomasyon': 'I', 'yapayzeka|dedektifmacera': 'I',
  'hukumet|buyukstrateji': 'S', 'hukumet|sehirkurma': 'I', 'ofis|hayatsim': 'I', 'ofis|tiklama': 'I', 'moda|hayatsim': 'S', 'moda|gorselroman': 'I', 'kurtadam|sosyalcikarim': 'S',
  'zaman|bulmacaplatform': 'S', 'zaman|roguelite': 'I', 'kahraman|kahramannisanci': 'S', 'futbol|fantastikspor': 'I', 'yaris|kartyaris': 'S', 'ninja|hassas': 'I',
};

// --- Efsane kombinasyonlar: ilk deneyen "efsane keşif" yapar. any: eşleşme kurallarından biri yeterli.
export const LEGENDS = [
  { id: 'bulmacadestani', name: 'Bulmaca Destanı', year: 2007, any: [{ genre: 'rpg', sub: ['eslestir3'] }], press: 'Şeker patlatarak ejderha öldürdük. Kimse bize inanmıyor.' },
  { id: 'kuletirmanisi', name: 'Kule Tırmanışı', year: 2017, any: [{ genre: 'strateji', sub: ['roguelike', 'roguelite'] }, { genre: 'rpg', sub: ['destekurma'] }], press: 'Bir el daha. Bir el daha. Güneş doğdu.' },
  { id: 'edebiyat', name: 'Edebiyat Kulübü', year: 2017, any: [{ topic: 'korku', genre: 'macera', sub: ['gorselroman'] }], press: 'Sevimli bir okul hikâyesi sanıyorduk. Uyuyamıyoruz.' },
  { id: 'zindandadans', name: 'Zindanda Dans', year: 2015, any: [{ topic: 'zindan', genre: 'ritim' }], press: 'İskeletler bile tempoya uyuyor.' },
  { id: 'roketlig', name: 'Roket Lig', year: 2015, any: [{ topic: 'futbol', genre: 'yaris', sub: ['fantastikspor'] }], press: 'Arabalarla futbol. Neden daha önce kimse yapmadı?' },
  { id: 'ambulans', name: 'Ambulans Çılgınlığı', year: 1999, any: [{ topic: 'hastane', genre: 'yaris' }], press: 'Hasta uçtu ama zamanında yetişti.' },
  { id: 'kecikaosu', name: 'Keçi Kaosu', year: 2014, any: [{ topic: 'hayvan', genre: 'simulasyon', sub: ['kumhavuzu'] }], press: 'Hataları özellik ilan etmişler. Dahice.' },
  { id: 'oyunicinde', name: 'Oyun içinde oyun', year: 2012, any: [{ topic: 'oyungelistirme', genre: 'simulasyon', sub: ['tycoon'] }], press: 'Bir stüdyo, stüdyo yönetme oyunu yapmış. Çok tanıdık.' },
  { id: 'okulruhlari', name: 'Okul Ruhları', year: 2006, any: [{ topic: 'okul', genre: 'rpg', sub: ['jrpg'] }], press: 'Gündüz sınav, gece şeytan avı. Okul böyle olmalı.' },
  { id: 'bahcesavunma', name: 'Bahçe Savunması', year: 2009, any: [{ topic: 'zombi', genre: 'strateji', sub: ['kulesavunma'] }], press: 'Bezelyeyle zombi vurduk. Annemiz gururlu.' },
  { id: 'ritimisini', name: 'Ritim Işını', year: 2001, any: [{ topic: 'muzik', genre: 'nisanci', sub: ['kaydirmali'] }], press: 'Her ateş bir nota, her patlama bir davul.' },
  { id: 'unicorn', name: 'Unicorn Tıklayıcı', year: 2013, any: [{ topic: 'startup', genre: 'casual', sub: ['tiklama'] }], press: 'Hiçbir şey yapmadan milyar dolar. Gerçekçi.' },
];

// --- Kurucu geçmişi
export const BACKGROUNDS = [
  { id: 'salon', icon: '🕹️', name: 'Salon makinesi tamircisi', genres: ['aksiyon', 'yaris'], subs: ['arcadeyaris'], bonus: { disc: { tek: 1.05 } }, desc: 'Teknoloji görevleri +%5', quote: 'Jeton kutusundan çıkan her bozukluğu tanırım.' },
  { id: 'masa', icon: '♟️', name: 'Masa oyunu meraklısı', genres: ['strateji', 'bulmaca'], subs: ['savasoyunu'], bonus: { disc: { oyn: 1.05 } }, desc: 'Tasarım görevleri +%5', quote: 'Kural kitabı 80 sayfa mı? Isınma turu.' },
  { id: 'kitap', icon: '📚', name: 'Kitap kurdu', genres: ['macera', 'casual'], subs: ['metinmacera'], bonus: { missions: { hikaye: 1.1, diyalog: 1.1 } }, desc: 'Hikâye ve diyalog görevleri +%10', quote: 'Kuzeye gidemezsin, ama ben bir yol bulurum.' },
  { id: 'zindan', icon: '🐉', name: 'Zindan efendisi', genres: ['rpg', 'macera'], subs: ['zindangezgini'], bonus: { xp: { rpg: 50 } }, desc: 'RPG bilgisi 40 yerine 50', quote: 'Zarı at. Hayır, tekrar atamazsın.' },
  { id: 'mahalle', icon: '⚽', name: 'Mahalle maçının kaptanı', genres: ['spor', 'yaris'], subs: ['arcadespor'], bonus: { fans: 300 }, desc: 'Başlangıçta 300 hayran (mahalle)', quote: 'Top benim, kural da benim.' },
  { id: 'kulup', icon: '🧮', name: 'Okul bilgisayar kulübü', genres: ['casual', 'bulmaca'], subs: ['egitsel'], bonus: { research: 1.1 }, desc: 'Araştırma +%10', quote: 'Öğretmen çıkınca bilgisayar bizimdi.' },
];

// --- Ustalık kademeleri (stüdyo tür bilgisi)
export const MASTERY = [
  { id: 'acemi', name: 'Acemi', min: 0, score: -3, bugs: 1.25, noise: 1 },
  { id: 'cirak', name: 'Çırak', min: 20, score: -1, bugs: 1, noise: 0.5 },
  { id: 'kalfa', name: 'Kalfa', min: 40, score: 0, bugs: 1, noise: 0.25 },
  { id: 'usta', name: 'Usta', min: 60, score: 0, bugs: 1, noise: 0 },
  { id: 'uzman', name: 'Uzman', min: 80, score: 0, bugs: 1, noise: 0, speed: 1.03 },
  { id: 'efsane', name: 'Efsane', min: 95, score: 0.5, bugs: 1, noise: 0, speed: 1.03 },
];

// --- Sözler
export const TEAM_LINES = {
  S: ['Programcı kahvesini döktü ve fark etmedi bile. Herkes çoktan çizmeye başladı.', 'Ses tasarımcısı daha toplantı bitmeden ana temayı mırıldanıyor.', 'Stajyer "bunu ben de oynarım" dedi ve ilk kez ciddiydi.'],
  I: ['Ekip başını salladı. Biri "güzel" dedi; bu ekipte bu çok büyük bir söz.', 'Tasarımcı not defterine üç sayfa yazdı, hepsi olumlu.', 'Kimse itiraz etmedi; iki kişi gülümsedi.'],
  G: ['Kimse itiraz etmedi. Kimse heyecanlanmadı da.', 'Ekip "olur" dedi. Sadece "olur".', 'Toplantı beş dakikada bitti; herkes öğle yemeğine gitti.'],
  B: ['Tasarımcı "emin misin?" diye iki kez sordu.', 'Grafiker kalemini masaya bıraktı ve tavana baktı.', 'Biri "belki alt türü değiştirsek?" diye fısıldadı.'],
  K: ['Ses tasarımcısı kulağını tıkadı. Grafikerin gözü seğiriyor.', 'Programcı "teknik olarak mümkün" dedi, yüzü başka bir şey söylüyor.', 'Toplantı odasında rahatsız edici bir sessizlik var.'],
  X: ['Ekip bu fikre bakarken birbirine bakıyor. Stajyer özgeçmişini güncelliyor.', 'Biri pencereyi açtı, sanki fikir koku yapıyormuş gibi.', 'Kahve makinesi bile bu fikirden sonra bozuldu.'],
  L: ['Ekip sessiz. Sonra biri "dur, bu... çalışabilir" dedi. Herkes aynı anda konuşmaya başladı.'],
};
export const PRESS_LINES = {
  S: 'Bu kombinasyonu kim düşündüyse maaşına zam.', I: 'Doğru malzemeler, doğru tencere.', G: 'Fikir güvenli. Biraz fazla güvenli.',
  B: 'İki güzel fikir, bir kötü evlilik.', K: 'Neden? Gerçekten, neden?', X: 'Bu kombinasyonu düşünen kişi lütfen kendini ihbar etsin.',
};
export const PLAYER_LINES = {
  S: 'Bu oyunun var olduğu bir evrende yaşadığım için mutluyum.', I: 'Tam beklenen şey, ama çok iyi yapılmış.', G: 'Fena değil. Adını hatırlamıyorum ama fena değil.',
  B: 'Hangi oyunu oynadığımı bir türlü anlayamadım.', K: 'Kutudaki resim ile oyun arasında hiçbir ilişki yok.', X: 'Kutuyu çöpe attım, çöp geri attı.',
};
export const FOCUS_LINES = {
  S: ['Katılımcı 2 oyunu bırakmak istemedi; güvenlik çağrıldı.', 'Katılımcılar odak grubundan sonra kendi aralarında oynamaya devam etti.'],
  I: ['Katılımcı 4: "Bunu alırım." Katılımcı 6: "Ben iki tane alırım."', 'Genel izlenim olumlu; biri kurabiyeleri de övdü.'],
  G: ['Katılımcı 1: "Fena değil." Katılımcı 2: "Evet, fena değil." Kurabiyeler bitti.', 'Kimse şikâyet etmedi, kimse bir daha sormadı.'],
  B: ['Katılımcı 3 sordu: "Bu ne tür bir oyun?" Kimse cevap veremedi.', 'Katılımcıların yarısı formu doldurmadan çıktı.'],
  K: ['Katılımcı 3 sordu: "Bunu kim oynayacak?" Katılımcı 5 uyuyordu.', 'Bir katılımcı ücretini iade etmeyi teklif etti; yeter ki gitsin.'],
  X: ['Katılımcı 1 ağladı. Mutluluktan değil.', 'Odak grubu yarıda kesildi; moderatör istifa etti.'],
};
export const GENRE_CRITICS = {
  nisanci: ['Nişan alma rüzgârda sallanan bir ağaç gibi.', 'Silahlar var ama tetikte his yok.', 'Çatışmalar sağlam, haritalar unutulabilir.', 'Her atış tatmin edici, her harita bir oyun alanı.', 'Türünün yeni ölçütü: tetik parmağımız hâlâ titriyor!'],
  platform: ['Zıplama tuşu bir öneri gibi çalışıyor.', 'Bölümler var, ritim yok.', 'Kontroller oturmuş, tasarım biraz tanıdık.', 'Her zıplama bir zevk, her bölüm bir sürpriz.', 'Bölüm tasarımında ders kitabı!'],
  dovus: ['Kombo yok, sadece tuş ezmek var.', 'Karakterler birbirine benziyor, dövüş de.', 'Sağlam bir kadro, dengesi biraz şüpheli.', 'Her maç bir satranç partisi, yumrukla.', 'Turnuva salonlarının yeni kralı!'],
  spor: ['Top fizik kurallarından habersiz.', 'Lisanslı formalar, lisanssız eğlence.', 'Saha üstünde akıcı, menüler hantal.', 'Maç havası iliklerimize işledi.', 'Stadyumun uğultusunu evine getiriyor!'],
  yaris: ['Arabalar karton kutu gibi sürülüyor.', 'Pistler var, heyecan yok.', 'Hız hissi iyi, yapay zekâ biraz hile yapıyor.', 'Her viraj adrenalin, her tur yeni bir rekor.', 'Direksiyonu bırakamıyoruz!'],
  bulmaca: ['Bulmacalar mantık değil şans istiyor.', 'Basit, hatta fazla basit.', 'Akıllı fikirler, tekrar eden bölümler.', 'Her çözüm bir aydınlanma anı.', 'Beynimiz teşekkür etti, uykumuz etmedi.'],
  ritim: ['Ritim nerede? Biz de bulamadık.', 'Şarkı listesi kısa, gecikme uzun.', 'Tempo yerinde, zorluk dengesiz.', 'Ayaklarımız kendi kendine dans ediyor.', 'Kulaklarımız ve parmaklarımız aşık oldu!'],
};
export const IDEA_LINES = ['{n} masaya bir fikir koydu: {c}. Gözleri parlıyor.', '{n} öğle arasında peçeteye bir şey çizdi: {c}.', '{n} sabah erkenden geldi, tahtaya yazmış: {c}.', '{n}: "Gece rüyamda gördüm: {c}. Yapalım mı?"'];
