// Konu E: motor ve teknoloji (P, içerik). Oyuna giren her teknik özellik bir motordan gelir.
// 7 kategori, 50 özellik (6'sı 1976'da herkesin elinde), lisanslı motorlar ve ara yazılımlar.
// Motor adları parodi ya da kurgusal.

// disc: kategorinin çarptığı puan (grafik → gfx, ses → ses, diğerleri → teknik)
export const CATS = [
  { id: 'gfx', name: 'Grafik', icon: '🖼️', disc: 'gfx' },
  { id: 'ses', name: 'Ses', icon: '🎵', disc: 'ses' },
  { id: 'kon', name: 'Kontrol', icon: '🕹️', disc: 'tek' },
  { id: 'yz', name: 'Yapay zekâ', icon: '🧠', disc: 'tek' },
  { id: 'kay', name: 'Kayıt ve içerik', icon: '💾', disc: 'tek' },
  { id: 'cok', name: 'Çok oyunculu', icon: '👥', disc: 'tek' },
  { id: 'fiz', name: 'Fizik', icon: '🧱', disc: 'tek' },
];

// need.tech: konsol ve el konsolunun en az bu kademede olması; need.kinds: yalnız bu platform türlerinde.
// Bilgisayar ve telefon yılın teknolojisini her zaman kaldırır.
const F = (id, cat, name, year, v, o = {}) => ({ id, cat, name, year, v, ...o });
export const FEATURES = [
  // Grafik
  F('g_metin', 'gfx', 'Metin ekran', 1976, 1, { base: true }),
  F('g_blok', 'gfx', 'Blok grafik', 1977, 1),
  F('g_sprite', 'gfx', 'Sprite', 1979, 2),
  F('g_kaydir', 'gfx', 'Kaydırmalı arka plan', 1982, 4),
  F('g_paralaks', 'gfx', 'Paralaks', 1987, 4, { need: { tech: 2 } }),
  F('g_mode7', 'gfx', 'Döndür-ölçekle', 1990, 6, { need: { tech: 3 } }),
  F('g_poligon', 'gfx', 'Poligon 3D', 1993, 6, { need: { tech: 4 } }),
  F('g_doku', 'gfx', 'Doku kaplama', 1995, 8, { need: { tech: 4 } }),
  F('g_golge', 'gfx', 'Gölgelendirici', 2001, 10, { need: { tech: 5 } }),
  F('g_hd', 'gfx', 'HD grafik', 2006, 10, { need: { tech: 6 } }),
  F('g_pbr', 'gfx', 'Fiziksel malzeme', 2013, 12, { need: { tech: 7 } }),
  F('g_isin', 'gfx', 'Işın izleme', 2019, 14, { need: { tech: 7 } }),
  // Ses
  F('s_bip', 'ses', 'Bip', 1976, 1, { base: true }),
  F('s_cip', 'ses', 'Üç kanallı ses çipi', 1979, 2),
  F('s_fm', 'ses', 'FM sentez', 1985, 4, { need: { tech: 2 } }),
  F('s_ornek', 'ses', 'Örneklenmiş ses', 1988, 4, { need: { tech: 3 } }),
  F('s_cd', 'ses', 'CD müzik', 1993, 6, { need: { tech: 4 } }),
  F('s_ses', 'ses', 'Seslendirme', 1995, 8, { need: { tech: 4 } }),
  F('s_cevre', 'ses', 'Çevresel ses', 2000, 8, { need: { tech: 5 } }),
  F('s_dinamik', 'ses', 'Dinamik müzik', 2005, 10, { need: { tech: 5 } }),
  F('s_uzam', 'ses', 'Uzamsal ses', 2016, 12, { need: { tech: 7 } }),
  // Kontrol
  F('k_tek', 'kon', 'Tek tuş', 1976, 1, { base: true }),
  F('k_klavye', 'kon', 'Klavye menüleri', 1979, 2),
  F('k_fare', 'kon', 'Fare arayüzü', 1985, 4, { need: { kinds: ['pc'] } }),
  F('k_analog', 'kon', 'Analog kontrol', 1996, 6, { need: { kinds: ['konsol', 'el'], tech: 4 } }),
  F('k_titresim', 'kon', 'Titreşim', 1997, 6, { need: { kinds: ['konsol', 'el'], tech: 4 } }),
  F('k_hareket', 'kon', 'Hareket algılama', 2006, 8, { need: { kinds: ['konsol', 'el', 'mobil'], tech: 5 } }),
  F('k_dokun', 'kon', 'Dokunmatik', 2008, 8, { need: { kinds: ['mobil', 'el'], tech: 5 } }),
  // Yapay zekâ
  F('y_desen', 'yz', 'Desenli hareket', 1976, 1, { base: true }),
  F('y_durum', 'yz', 'Durum makinesi', 1984, 4),
  F('y_yol', 'yz', 'Yol bulma', 1990, 6),
  F('y_agac', 'yz', 'Davranış ağacı', 2004, 10, { need: { tech: 5 } }),
  F('y_ogren', 'yz', 'Öğrenen rakip', 2020, 14, { need: { tech: 7 } }),
  // Kayıt ve içerik
  F('c_sifre', 'kay', 'Şifreyle devam', 1980, 2),
  F('c_prosedur', 'kay', 'Prosedürel harita', 1984, 4),
  F('c_pil', 'kay', 'Pilli kayıt', 1986, 4, { need: { tech: 2 } }),
  F('c_editor', 'kay', 'Seviye editörü', 1990, 6),
  F('c_kart', 'kay', 'Hafıza kartı', 1995, 6, { need: { tech: 4 } }),
  F('c_acik', 'kay', 'Açık dünya akışı', 2005, 12, { need: { tech: 5 } }),
  F('c_bulut', 'kay', 'Bulut kayıt', 2011, 10, { need: { tech: 6 } }),
  // Çok oyunculu
  F('m_ekran', 'cok', 'Aynı ekranda iki kişi', 1976, 1, { base: true }),
  F('m_modem', 'cok', 'Modem ve yerel ağ', 1993, 6, { need: { kinds: ['pc'] } }),
  F('m_internet', 'cok', 'İnternet üzerinden', 1998, 8, { need: { tech: 5 } }),
  F('m_eslesme', 'cok', 'Eşleştirme', 2005, 10, { need: { tech: 5 } }),
  F('m_capraz', 'cok', 'Platformlar arası', 2018, 12, { need: { tech: 7 } }),
  // Fizik
  F('p_carpisma', 'fiz', 'Basit çarpışma', 1976, 1, { base: true }),
  F('p_sicrama', 'fiz', 'Gerçekçi sıçrama', 1990, 4),
  F('p_bezbebek', 'fiz', 'Bez bebek fiziği', 2001, 8, { need: { tech: 5 } }),
  F('p_tam', 'fiz', 'Tam fizik', 2004, 10, { need: { tech: 5 } }),
  F('p_yikim', 'fiz', 'Yıkılabilir çevre', 2008, 12, { need: { tech: 6 } }),
];
export const FEAT = Object.fromEntries(FEATURES.map((f) => [f.id, f]));
export const BASE = FEATURES.filter((f) => f.base).map((f) => f.id);

// Eski 15 motor özelliği → yeni ağaçtaki karşılığı (eski kayıtlar için)
export const LEGACY_FEATURES = {
  f_metin: 'g_metin', f_sprite: 'g_sprite', f_renk: 'g_blok', f_kaydirma: 'g_kaydir', f_sescip: 's_cip', f_kayit: 'c_pil', f_256: 'g_paralaks',
  f_3d: 'g_poligon', f_cd: 's_cd', f_fizik: 'p_sicrama', f_online: 'm_internet', f_shader: 'g_golge', f_acik: 'c_acik', f_ray: 'g_isin', f_ainpc: 'y_ogren',
};

// Türlerin kategori ağırlıkları (teknik çarpanında) ve olmazsa olmazları
export const GENRE_WANTS = {
  aksiyon: { gfx: 1.2, fiz: 1.1 }, nisanci: { gfx: 1.3, cok: 1.2 }, platform: { kon: 1.2, gfx: 1.1 }, dovus: { kon: 1.3, cok: 1.1 },
  macera: { kay: 1.2, ses: 1.1 }, rpg: { kay: 1.4, yz: 1.1 }, strateji: { yz: 1.4, kay: 1.1 }, simulasyon: { yz: 1.2, fiz: 1.1 },
  spor: { fiz: 1.2, yz: 1.1 }, yaris: { fiz: 1.4, gfx: 1.1 }, bulmaca: { kon: 1.1 }, casual: { kon: 1.2 }, ritim: { ses: 1.5, kon: 1.2 },
};
export const GENRE_MUST = [
  { genre: 'rpg', from: 1980, any: ['c_sifre', 'c_pil', 'c_kart', 'c_bulut'], line: 'Kayıt sistemi yoktu, 40 saatlik RPG\'yi tek oturumda bitirmemizi mi bekliyordunuz?' },
  { genre: 'strateji', from: 1986, any: ['y_durum', 'y_yol', 'y_agac', 'y_ogren'], line: 'Rakip ordu duvara yürüyor. Sonra yine duvara.' },
  { genre: 'yaris', from: 1995, any: ['p_sicrama', 'p_tam', 'p_yikim', 'p_bezbebek'], line: 'Arabalar karton kutu gibi sekiyor.' },
  { genre: 'spor', from: 1995, any: ['p_sicrama', 'p_tam', 'p_yikim', 'p_bezbebek'], line: 'Top, fizik kurallarından habersiz.' },
];
// Alt türlerin şartı (Konu D'ye bağlanır): eksikse not −5
export const SUB_NEEDS = {
  fps: 'g_poligon', platform3b: 'g_poligon', dovus3b: 'g_poligon',
  mmorpg: 'm_internet', moba: 'm_internet', kahramannisanci: 'm_internet',
  battleroyale: 'm_eslesme', cikarma: 'm_eslesme',
  acikdunyaaksiyon: 'c_acik', acikdunyarpg: 'c_acik', acikdunyayaris: 'c_acik',
  roguelike: 'c_prosedur', roguelite: 'c_prosedur', kumhavuzu: 'c_prosedur',
  etkilesimlifilm: 's_cd', fizikbulmaca: 'p_sicrama', simyaris: 'p_tam',
  hareket: 'k_hareket', vrritim: 'k_hareket', hipergundelik: 'k_dokun', sonsuzkosu: 'k_dokun',
};

// Lisanslı motorlar. lag: dönemin kaç yıl gerisinden özellik taşır; cap: tavan yılı; cats: yalnız bu kategoriler (yoksa hepsi);
// pay: ödeme dönemleri [{from, fee, royalty, threshold, seat}]; speed: geliştirme hızı (speedKinds: yalnız bu platformlarda); genres / subs: uzmanlık ya da kısıt.
export const LICENSED = [
  { id: 'kartus', name: 'Kartuş Kiti', from: 1979, to: 1990, lag: 1, cap: 1984, pay: [{ from: 1979, fee: 5000 }], speed: 1, joke: 'Kutudan çıktığı gibi zıplar.' },
  { id: 'senaryo', name: 'Senaryo Kazanı', from: 1987, to: 1998, lag: 1, cap: 1993, cats: ['gfx', 'ses', 'kon', 'kay'], pay: [{ from: 1987, fee: 20000, royalty: 0.03 }], speed: 1, genres: { macera: 1.15 }, joke: 'Lastik tavuğu biz programladık.' },
  { id: 'rpgustasi', name: 'RPG Ustası', from: 1992, to: 2200, lag: 0, cap: 1990, pay: [{ from: 1992, fee: 300 }], speed: 1, genres: { rpg: 1.15 }, joke: 'Her köyde aynı kuyu.' },
  { id: 'kiyamet', name: 'Kıyamet Motoru', from: 1993, to: 1999, lag: 0, cap: 1994, pay: [{ from: 1993, fee: 150000 }], speed: 1, genres: { nisanci: 1.1 }, joke: 'Koridor, kapı, canavar, tekrar.' },
  { id: 'deprem', name: 'Deprem Motoru', from: 1996, to: 2004, lag: 0, cap: 1999, pay: [{ from: 1996, fee: 400000 }], speed: 1.05, joke: 'Başka stüdyolar bunun üstüne imparatorluk kurdu.' },
  { id: 'gercekdisi', name: 'Gerçeksiz Motor', from: 1998, to: 2200, lag: 1, pay: [{ from: 1998, fee: 350000 }, { from: 2006, fee: 750000 }, { from: 2014, fee: 0, royalty: 0.05 }, { from: 2022, fee: 0, royalty: 0.05, threshold: 1000000 }], speed: 1.05, genres: { nisanci: 1.1 }, joke: 'Gerçekten daha gerçek. Gerçeksiz.' },
  { id: 'oyunyapici', name: 'Oyun Yapıcı', from: 1999, to: 2200, lag: 3, capCats: { gfx: 1990 }, pay: [{ from: 1999, fee: 500 }], speed: 1, genres: { casual: 1.15, platform: 1.15 }, joke: 'İlk oyunun bir hafta sonunda bitti.' },
  { id: 'cizim', name: 'Çizim Yazılımı', from: 2000, to: 2004, lag: 1, pay: [{ from: 2000, fee: 200000 }], speed: 1.08, joke: 'Herkes kullanıyor. Şimdilik.' },
  { id: 'kaynak', name: 'Kaynak Motoru', from: 2004, to: 2016, lag: 1, cap: 2010, pay: [{ from: 2004, fee: 300000 }], speed: 1.03, strong: ['fiz', 'yz'], joke: 'Levyeyle kapı açmak serbest.' },
  { id: 'birlik', name: 'Birlik Motoru', from: 2005, to: 2200, lag: 2, pay: [{ from: 2005, seat: 150 }], speed: 1.1, speedKinds: ['mobil', 'el'], joke: 'Her şey bir varlık mağazasında.' },
  { id: 'kriz', name: 'Kriz Motoru', from: 2007, to: 2200, lag: 2, pay: [{ from: 2007, fee: 1000000 }, { from: 2016, fee: 0, royalty: 0.05 }], speed: 1, strong: ['gfx'], joke: 'Bilgisayarın çalıştırır mı? Hayır.' },
  { id: 'gorselkit', name: 'Görsel Roman Kiti', from: 2004, to: 2200, lag: 2, pay: [{ from: 2004, fee: 0 }], speed: 1.1, subs: ['gorselroman', 'secimli'], joke: 'Satır satır aşk itirafı.' },
  { id: 'bekleyis', name: 'Bekleyiş Motoru', from: 2014, to: 2200, lag: 6, pay: [{ from: 2014, fee: 0 }], speed: 1, grows: true, joke: 'Herkes onu bekliyor. Geldi.' },
];
// Ara yazılımlar: tek kategori ekler (lag yıl gerisinden), peşin ödenir
export const MIDDLEWARE = [
  { id: 'milses', name: 'Mil Ses Sistemi', cat: 'ses', from: 1991, to: 2015, lag: 1, fee: 30000 },
  { id: 'havuk', name: 'Havuk Fizik', cat: 'fiz', from: 2000, to: 2200, lag: 0, fee: 50000 },
  { id: 'fmod', name: 'F-Mod', cat: 'ses', from: 2002, to: 2200, lag: 0, fee: 20000 },
];
