// Bölgeler (Konu C): altı pazar, her birinin karakteri, takvimi, bayramları, diyalogları ve dönem olayları.
// Tüm kişi, kurum ve dergi adları kurgusaldır. Ay indeksi 0 = Ocak; hafta 0–3.
// Etki anahtarları events.js'teki genel anahtarlardır; bölgeye özel olanlar: regMod {rid, demand, rev, weeks},
// regFans {rid, v}, regFair {rid}, regRel {rid, v} (o bölgenin yayıncılarıyla ilişki).

// Bölgeler. weight: dünya pazarındaki ağırlık (yıla göre), pref: tür ilgisi [aksiyon, macera, rpg, simülasyon, strateji, casual],
// topics: konu ilgisi çarpanı, price: fiyat endeksi, piracy: korsanlık oranı (yıla göre), season: 12 ayın talep çarpanı,
// lang: dil, eng: ingilizce sürümün yerelleştirmesiz erişimi (yıla göre), locBase: yerelleştirme taban bedeli.
export const REGIONS = [
  { id: 'na', name: 'Kuzey Amerika', short: 'K.Amerika', flag: '🗽', lang: 'en', langName: 'İngilizce',
    weight: [[1976, 0.55], [1985, 0.46], [1990, 0.41], [2000, 0.375], [2010, 0.31], [2025, 0.265]],
    pref: [1.2, 1.0, 0.9, 1.0, 0.85, 1.05], topics: { askeri: 1.2, uzay: 1.15, kahraman: 1.25, spor: 1.15, zombi: 1.1, yaris: 1.1, mafya: 1.1 },
    price: 1.0, piracy: [[1976, 0.12], [1990, 0.15], [2025, 0.06]], eng: [[1976, 1], [2025, 1]], locBase: 0,
    season: [0.8, 0.85, 0.85, 0.85, 0.85, 0.9, 0.85, 0.9, 0.95, 1.05, 1.55, 1.75],
    pay: [[1976, 1], [2025, 1]], rent: 1, skills: { pazar: 1.15 },
    host: 'Radyo DJ\'i Büyük Bob', press: 'Joystick Haftalık',
    soul: 'Her şey büyük: bütçeler, hamburgerler, beklentiler. Salon makinesinden konsola, oradan dev çıkışlara uzanan pazar. Kasım sonunda Kara Cuma, Aralık\'ta Noel; yılın satışının yarısı son altı haftada.' },
  { id: 'eu', name: 'Avrupa', short: 'Avrupa', flag: '🏰', lang: 'eu', langName: 'Avrupa dilleri',
    weight: [[1976, 0.28], [1985, 0.28], [1990, 0.27], [2000, 0.28], [2010, 0.26], [2025, 0.235]],
    pref: [1.0, 1.1, 0.9, 1.15, 1.25, 0.95], topics: { tarih: 1.25, futbol: 1.35, dedektif: 1.15, sehir: 1.15, is: 1.1, siberpunk: 1.05 },
    price: 0.95, piracy: [[1976, 0.2], [1986, 0.35], [2000, 0.2], [2025, 0.08]], eng: [[1976, 0.55], [1995, 0.7], [2015, 0.85]], locBase: 9000,
    season: [0.85, 0.85, 0.9, 0.95, 0.9, 0.85, 0.75, 0.7, 1.0, 1.05, 1.3, 1.65],
    pay: [[1976, 0.85], [2025, 0.9]], rent: 0.8, skills: { tek: 1.15 },
    host: 'Dağıtıcı Klaus Amca', press: 'Disket Gazetesi',
    soul: 'Yirmi dil, otuz zevk, tek ortak nokta: futbol. Ev bilgisayarının ve stratejinin vatanı. Ağustos\'ta herkes tatilde, Aralık\'ta herkes Noel pazarında.' },
  { id: 'jp', name: 'Japonya', short: 'Japonya', flag: '🗾', lang: 'ja', langName: 'Japonca',
    weight: [[1976, 0.15], [1985, 0.2], [1990, 0.24], [2000, 0.18], [2010, 0.12], [2025, 0.08]],
    pref: [0.9, 1.0, 1.45, 0.85, 0.8, 1.1], topics: { fantezi: 1.25, robot: 1.3, ninja: 1.25, hayvan: 1.3, okul: 1.2, kedi: 1.2, muzik: 1.15 },
    price: 1.1, piracy: [[1976, 0.05], [2025, 0.03]], eng: [[1976, 0.08], [2000, 0.1], [2025, 0.15]], locBase: 9000,
    season: [1.6, 0.8, 0.85, 0.9, 1.15, 0.85, 0.9, 1.0, 0.95, 0.9, 1.0, 1.5],
    pay: [[1976, 1.0], [2025, 1.0]], rent: 1.3, skills: { grafik: 1.15, ses: 1.1 },
    host: 'Editör Tanaka-san', press: 'Haftalık Piko Piko',
    soul: 'Kalite takıntısı, kuyruklar, el konsolu trenlerde. Yeni yılda çocuklar harçlıklarıyla oyun alır; yabancı oyuna kibar ama mesafeli. Korsan neredeyse yok, sabır çok.' },
  { id: 'tr', name: 'Türkiye', short: 'Türkiye', flag: '🧿', lang: 'tr', langName: 'Türkçe',
    weight: [[1976, 0.002], [1985, 0.006], [1990, 0.008], [2000, 0.01], [2010, 0.015], [2025, 0.02]],
    pref: [1.15, 0.95, 0.95, 0.95, 1.1, 1.1], topics: { futbol: 1.5, tarih: 1.25, mafya: 1.15, spor: 1.15, yaris: 1.1, askeri: 1.05 },
    price: 0.45, piracy: [[1976, 0.6], [1986, 0.8], [2000, 0.6], [2012, 0.35], [2025, 0.2]], eng: [[1976, 0.35], [2000, 0.5], [2025, 0.65]], locBase: 3000,
    season: [1.2, 0.85, 0.85, 1.0, 0.95, 1.15, 1.0, 0.95, 0.9, 0.95, 0.95, 1.05],
    pay: [[1976, 0.35], [2000, 0.45], [2025, 0.55]], rent: 0.35, skills: { oyn: 1.1 },
    host: 'Kasetçi Cemil Abi', press: 'Kaset & Disket Dergisi',
    soul: 'Küçük ama sadık, gürültülü ve esprili. Atari salonları, kaset takası, dergi ekleri, internet kafeler, sonra cepler. Bayram harçlığı oyuna gider; kur dalgalanınca herkes dolar konuşur.' },
  { id: 'latam', name: 'Latin Amerika', short: 'Latin Am.', flag: '🌵', lang: 'es', langName: 'İspanyolca/Portekizce',
    weight: [[1976, 0.01], [1985, 0.02], [1990, 0.03], [2000, 0.05], [2010, 0.07], [2025, 0.09]],
    pref: [1.15, 1.0, 0.95, 0.9, 0.9, 1.15], topics: { futbol: 1.5, yaris: 1.2, korku: 1.1, muzik: 1.15, dans: 1.15 },
    price: 0.5, piracy: [[1976, 0.5], [1995, 0.7], [2010, 0.45], [2025, 0.2]], eng: [[1976, 0.35], [2025, 0.55]], locBase: 5000,
    season: [1.0, 0.75, 0.9, 0.9, 0.9, 1.05, 1.0, 0.9, 0.9, 0.95, 1.05, 1.5],
    pay: [[1976, 0.5], [2025, 0.6]], rent: 0.5, skills: { ses: 1.1 },
    host: 'Dağıtıcı Don Ramón', press: 'Píxel Semanal',
    soul: 'Eski konsollar burada bir nesil daha yaşar. Futbol bir dindir, karnaval bir haftadır, ölüler bile bayram yapar. Korsan tezgâhı her köşede ama hayran sadakati efsane.' },
  { id: 'asya', name: 'Asya-Pasifik', short: 'Asya', flag: '🐉', lang: 'as', langName: 'Asya dilleri',
    weight: [[1976, 0.008], [1985, 0.034], [1990, 0.042], [2000, 0.105], [2010, 0.225], [2025, 0.31]],
    pref: [1.05, 0.85, 1.15, 0.85, 1.2, 1.15], topics: { fantezi: 1.2, ninja: 1.15, sosyal: 1.2, hayatta: 1.1, startup: 1.1, kripto: 1.1 },
    price: 0.4, piracy: [[1976, 0.7], [1998, 0.8], [2010, 0.45], [2025, 0.15]], eng: [[1976, 0.15], [2025, 0.35]], locBase: 8000,
    season: [1.0, 1.35, 0.85, 0.85, 0.9, 0.9, 1.0, 1.05, 0.9, 1.0, 1.45, 1.05],
    pay: [[1976, 0.45], [2025, 0.6]], rent: 0.55, skills: { tek: 1.1 },
    host: 'PC kafe zinciri sahibi Min-jun', press: 'Turnuva Gazetesi',
    soul: 'PC kafede sabaha kadar turnuva, cepte bedava oyun, 11.11\'de dünyanın en büyük indirimi. Konsol bir dönem yasak, oyun süresi bir dönem sınırlı; ama 2010\'larda dünyanın merkezi burası.' },
];

// Bölgeye göre platform gücü (bugünkü ownerBias'ın altı bölgelik hâli)
export const OWNER_BIAS = {
  pandando: { na: 1.1, eu: 0.9, jp: 1.45, tr: 0.7, latam: 1.0, asya: 0.9 }, segga: { na: 1.0, eu: 1.2, jp: 0.9, tr: 1.2, latam: 1.5, asya: 1.0 },
  soni: { na: 1.0, eu: 1.1, jp: 1.1, tr: 1.2, latam: 1.0, asya: 1.0 }, mikroyumusak: { na: 1.35, eu: 1.0, jp: 0.3, tr: 0.9, latam: 0.9, asya: 0.7 },
  ataro: { na: 1.3, eu: 0.9, jp: 0.4, tr: 1.2, latam: 0.9, asya: 0.7 }, hadson: { na: 0.6, eu: 0.5, jp: 1.8, tr: 0.4, latam: 0.4, asya: 0.6 },
  vana: { na: 1.1, eu: 1.1, jp: 0.6, tr: 1.2, latam: 1.0, asya: 1.0 }, pc: { na: 1.0, eu: 1.3, jp: 0.6, tr: 1.35, latam: 1.1, asya: 1.3 },
  mobil: { na: 0.9, eu: 0.9, jp: 1.2, tr: 1.3, latam: 1.4, asya: 1.4 }, sen: { na: 1.0, eu: 1.15, jp: 0.7, tr: 1.2, latam: 1.0, asya: 1.0 },
};

// Ana bölge seçenekleri (kuruluş ekranı)
export const HOMES = [
  { id: 'na', title: 'Kuzey Amerika · garaj', feel: 'Kolay başlangıç', text: 'En büyük pazar evinin önünde. Salon makineleri, Kırmızı Mantar mahallede. 1983 çöküşü en sert burada vurur.' },
  { id: 'eu', title: 'Avrupa · çatı katı', feel: 'Orta', text: 'Maaşlar biraz ucuz, ev bilgisayarı patlaması 1982\'de kapında. 1976\'da yerel yayıncı az; posta siparişi erken açılır, İngilizce sürüm Amerika\'ya da gider.' },
  { id: 'jp', title: 'Japonya · apartman dairesi', feel: 'Zorca', text: '1990\'larda dünyanın merkezi olacak bir pazar ama dışarı açılmak zor: Japonca oyun dışarıda yalnız ithal hayranlara satar. Kira pahalı, kalite çıtası yüksek.' },
  { id: 'tr', title: 'Türkiye · dükkân arkası', feel: 'En zor, en ucuz', text: 'İç pazar minicik, korsan her yerde; ama maaş ve kira çok ucuz. İhracat şart: posta siparişi, Avrupalı dağıtıcılar ve bol çay. Kur krizleri hem kurtarır hem batırır.' },
];

// Dağıtım ağı seviyeleri (kendi yayınında bir bölgeye erişim)
export const NET_LEVELS = [
  { lv: 0, name: 'Yok', reach: 0.03, desc: 'Satış yok; yalnız ithal eden birkaç meraklı.' },
  { lv: 1, name: 'Posta siparişi', reach: 0.25, desc: 'Dergiye ilan, kargo kutusu, uzun bekleyiş.', cost: 6000, research: 'ihracat' },
  { lv: 2, name: 'Distribütör', reach: 0.65, desc: 'Yerel bir dağıtıcı oyunu rafa koyar, %15 alır.', cost: 40000, cut: 0.15, fans: 15000 },
  { lv: 3, name: 'Bölge ofisi', reach: 1.0, desc: 'Kendi rafın, kendi pazarlaman, yerel ekip.', cost: 400000, rent: 9000, office: 2 },
];

// Yerelleştirme seviyeleri
export const LOC_LEVELS = [
  { lv: 0, name: 'Yok', desc: 'Yalnız stüdyonun dili.' },
  { lv: 1, name: 'Çeviri', k: 1.0, mult: 1.0, desc: 'Metin çevirisi. %15 ihtimalle komik bir çeviri hatası.' },
  { lv: 2, name: 'Tam yerelleştirme', k: 2.2, mult: 1.08, desc: 'Metin, seslendirme, kültürel uyarlama: o bölgede daha çok sevilir.' },
  { lv: 3, name: 'Kültürelleştirme', k: 3.0, mult: 1.05, desc: 'İçerik uyarlanır (kan rengi, semboller); sansürü aşar ama yetişkin hayran biraz küser.' },
];
// Türün metin yükü (çeviri bedeli çarpanı)
export const TEXT_LOAD = { aksiyon: 0.6, macera: 1.4, rpg: 2.0, simulasyon: 1.0, strateji: 1.2, casual: 0.6 };

// Kötü çeviri şakaları (özgün)
export const BAD_LOC = [
  '"Prenses başka şatoda" cümlesi "Prenses başka bir pastada" diye çevrildi. Hayranlar pastayı arıyor.',
  'Ana menüdeki "Devam et" düğmesi "Vazgeçmeyin hayatta" olmuş. Motivasyon posteri gibi bir oyun.',
  'Kötü adamın tehdidi "Seni ezeceğim!" yerine "Seni ütüleyeceğim!" çıktı. Kötü adam artık sevimli.',
  'Oyunun adı "Gölge Savaşçısı" yerine "Gölgede Oturan Savaşçı" olarak basıldı. Herkes dinlenmeyi seviyor.',
  'Ölüm ekranı "Oyun bitti" yerine "Maç bitti, çay demleyin" diyor. Kimse şikâyetçi değil.',
];

// Bayramlar ve özel günler. when: {m, w} sabit; move: 'ramazan' | 'kurban' | 'ayyili' kayan tarih.
// demand: o bölgede satış çarpanı (haftalar boyunca), topics/aud: konu ve kitle bonusu, every/from: kaç yılda bir.
// dialog: 'home' = yalnız ana bölgen buysa (ofis kültürü), 'market' = o bölgede varlığın varsa. Her birinin 1–2 çeşidi var.
export const HOLIDAYS = [
  // --- Türkiye
  { id: 'tr_yilbasi', region: 'tr', name: 'Yılbaşı', icon: '🎄', when: { m: 0, w: 0 }, demand: 1.2, weeks: 1, dialog: 'home', variants: [
    { title: '🎟️ Milli Piyango heyecanı', text: 'Ekip ortak bir yılbaşı bileti almak istiyor. Kasetçi Cemil Abi "Bu sefer kesin çıkar" diyor; geçen yıl da öyle demişti.',
      choices: [{ label: 'Bilete ortak ol', effects: { cashRaw: -200, morale: 4, chance: { p: 0.08, yes: { cash: 30000, morale: 10, news: '🎉 Amorti değil, gerçek ikramiye! Ofiste göbek atıldı.' }, no: { news: '🎟️ Amorti bile çıkmadı. Herkes "seneye" diyor.' } } } },
        { label: 'Ben piyangoya inanmam', effects: { morale: -2 } }] }] },
  { id: 'tr_nevruz', region: 'tr', name: 'Nevruz', icon: '🔥', when: { m: 2, w: 3 }, from: 1990, demand: 1.05, weeks: 1, dialog: 'home', variants: [
    { title: '🔥 Nevruz ateşi', text: 'Bahar geldi. Ekip otoparkta küçük bir ateş yakıp üstünden atlamak istiyor. Güvenlik görevlisi sabahtan beri terliyor.',
      choices: [{ label: 'Kutlayalım, ama itfaiye tüpü yanımızda', effects: { morale: 6, stress: -5, kaos: 2 } }, { label: 'Ateşsiz kutlama: pastaya mum', effects: { morale: 3 } }] }] },
  { id: 'tr_23nisan', region: 'tr', name: '23 Nisan Ulusal Egemenlik ve Çocuk Bayramı', icon: '🎈', when: { m: 3, w: 3 }, demand: 1.25, weeks: 1, aud: { genc: 1.3 }, topics: { hayvan: 1.2, kedi: 1.2 }, dialog: 'home', variants: [
    { title: '🎈 Koltuğu çocuklara devret', text: 'Gelenek: bir günlüğüne şirketi bir çocuk yönetecek. Muhasebecinin 9 yaşındaki kızı CEO koltuğuna oturdu ve ilk kararını açıkladı: "Bütün oyunlarda kedi olsun."',
      choices: [{ label: 'Karar karardır: bir sonraki oyuna kedi', effects: { morale: 8, hype: 8, fans: 800 } }, { label: 'Teşekkür et, kedili bir afiş as', effects: { morale: 4 } }] },
    { title: '🎈 Okullar oyun istiyor', text: 'İlkokullar 23 Nisan şenliği için ücretsiz bir mini oyun istedi. Çocuklar oynarsa anne babalar da duyar.',
      choices: [{ label: 'Bedava sürüm hazırlayalım', effects: { cashRaw: -1500, fans: 2500, morale: 5 } }, { label: 'Bu yıl olmaz', effects: {} }] }] },
  { id: 'tr_19mayis', region: 'tr', name: '19 Mayıs Gençlik ve Spor Bayramı', icon: '⚽', when: { m: 4, w: 2 }, demand: 1.1, weeks: 1, topics: { spor: 1.3, futbol: 1.3 }, dialog: 'home', variants: [
    { title: '⚽ Ofis maçı', text: 'Gençlik ve Spor Bayramı: kodcular ile grafikçiler halı sahada karşılaşacak. Ses ekibi hakem olmak istiyor ama düdük yerine synthesizer getirmiş.',
      choices: [{ label: 'Maç yapılsın!', effects: { morale: 7, stress: -8, chance: { p: 0.15, yes: { sick: 1, news: '🤕 Bir kodcu kaleye çarptı. Bir hafta istirahat.' }, no: {} } } }, { label: 'Ekranda maç izleyelim', effects: { morale: 3 } }] }] },
  { id: 'tr_karne', region: 'tr', name: 'Karne günü ve yaz tatili', icon: '📒', when: { m: 5, w: 2 }, demand: 1.3, weeks: 2, aud: { genc: 1.2 } },
  { id: 'tr_ramazan', region: 'tr', name: 'Ramazan Bayramı', icon: '🍬', move: 'ramazan', demand: 1.3, weeks: 1, aud: { genc: 1.2 }, dialog: 'home', variants: [
    { title: '🍬 Bayram şekeri ve harçlık', text: 'Bayram geliyor. Çocuklar harçlıklarını oyuna yatıracak. Ekip de bayram ikramiyesi soruyor; muhasebe şeker kâsesine sarılmış.',
      choices: [{ label: 'İkramiye ver, şeker kâsesi dolsun', effects: { cash: -4000, morale: 10 } }, { label: 'Şeker yeter', effects: { morale: 2 } }] },
    { title: '🍽️ Ofiste iftar', text: 'Ekip ofiste ortak bir iftar sofrası kurmak istiyor. Grafikçiler pideyi piksel piksel çizmiş bile.',
      choices: [{ label: 'Sofra benden', effects: { cashRaw: -800, morale: 8, stress: -4 } }, { label: 'Herkes bir şey getirsin', effects: { morale: 4 } }] }] },
  { id: 'tr_kurban', region: 'tr', name: 'Kurban Bayramı', icon: '🧳', move: 'kurban', demand: 1.25, weeks: 1, dialog: 'home', variants: [
    { title: '🧳 Dokuz günlük tatil', text: 'Bayram köprüyle birleşti: dokuz gün tatil! Ekip memlekete gitmek istiyor. Proje takvimi ise yüzüne bakıyor.',
      choices: [{ label: 'Herkes memlekete (1 hafta proje durur)', effects: { morale: 12, stress: -15, progress: -1 } }, { label: 'Yarım ekip nöbette', effects: { morale: -3 } }] }] },
  { id: 'tr_29ekim', region: 'tr', name: '29 Ekim Cumhuriyet Bayramı', icon: '🇹🇷', when: { m: 9, w: 3 }, demand: 1.1, weeks: 1, topics: { tarih: 1.3 }, dialog: 'home', variants: [
    { title: '🇹🇷 Cumhuriyet Bayramı', text: 'Ofis bayraklarla süslendi, ses ekibi Onuncu Yıl Marşı\'nın 8-bit düzenlemesini yaptı ve kimse susturamıyor. Akşam fener alayı var.',
      choices: [{ label: 'Yarım gün tatil, fener alayına!', effects: { morale: 10, stress: -6 } }, { label: 'Marşı dinleyerek çalışalım', effects: { morale: 5, progress: 0.3 } }] }] },
  { id: 'tr_fuar', region: 'tr', name: 'Bilişim Fuarı (İstanbul)', icon: '🎪', when: { m: 10, w: 1 }, from: 1990, fair: true, dialog: 'market', variants: [
    { title: '🎪 İstanbul Bilişim Fuarı', text: 'Fuar alanında simitçiler, korsan CD tezgâhları ve bütün yerli yayıncılar. Bir stant kurarsan ilk kez seni görecekler.',
      choices: [{ label: 'Stant kur', effects: { cash: -5000, hype: 8, regFans: { rid: 'tr', v: 6000 }, regRel: { rid: 'tr', v: 8 } } }, { label: 'Gezip simit yiyelim', effects: { morale: 2 } }] }] },

  // --- Kuzey Amerika
  { id: 'na_superkase', region: 'na', name: 'Süper Kase Pazarı', icon: '🏈', when: { m: 1, w: 0 }, demand: 0.95, weeks: 1, topics: { spor: 1.3 }, dialog: 'home', variants: [
    { title: '🏈 Süper Kase partisi', text: 'Büyük Bob radyoda "Bu pazar kimse oyun oynamayacak" dedi. Ekip ofise dev ekran istiyor; kanepe, cips ve kanatlar dahil.',
      choices: [{ label: 'Dev ekran kiralansın', effects: { cashRaw: -600, morale: 6 } }, { label: 'Herkes evinde izlesin', effects: {} }] }] },
  { id: 'na_4temmuz', region: 'na', name: '4 Temmuz Bağımsızlık Günü', icon: '🎆', when: { m: 6, w: 0 }, demand: 1.1, weeks: 1, topics: { askeri: 1.25, kahraman: 1.2 }, dialog: 'home', variants: [
    { title: '🎆 Havai fişek gösterisi', text: 'Ekip ofisin çatısında havai fişek patlatmak istiyor. Komşu dişçi şimdiden polisi aradı.',
      choices: [{ label: 'Gösteri olsun (biraz kaos)', effects: { cashRaw: -500, morale: 8, kaos: 4 } }, { label: 'Mangal yeter', effects: { morale: 4, cashRaw: -200 } }] }] },
  { id: 'na_cadilar', region: 'na', name: 'Cadılar Bayramı', icon: '🎃', when: { m: 9, w: 3 }, demand: 1.05, weeks: 1, topics: { korku: 1.4, zombi: 1.35, kurtadam: 1.35 }, dialog: 'home', variants: [
    { title: '🎃 Kostüm partisi', text: 'Herkes kostümle gelmiş. Baş programcı "kod hatası" olarak gelmiş: üstünde sadece kırmızı alt çizgiler var.',
      choices: [{ label: 'En iyi kostüme ikramiye', effects: { cash: -1500, morale: 7 } }, { label: 'Kostümler güzel, çalışmaya', effects: { morale: 2 } }] }] },
  { id: 'na_karacuma', region: 'na', name: 'Şükran Günü ve Kara Cuma', icon: '🦃', when: { m: 10, w: 3 }, demand: 1.35, weeks: 1, dialog: 'market', variants: [
    { title: '🦃 Kara Cuma indirimi', text: 'Mağazalar gece yarısı açılacak, kuyruklar şimdiden köşeyi döndü. Kuzey Amerika\'daki oyunlarında bir haftalık %30 indirim yapalım mı?',
      choices: [{ label: 'İndirim: satış ×1,6, kopya başı gelir ×0,7', effects: { regMod: { rid: 'na', demand: 1.6, rev: 0.7, weeks: 1 } } }, { label: 'Fiyat aynı kalsın', effects: {} }] }] },
  { id: 'na_gamecon', region: 'na', name: 'GameCon haftası', icon: '🎪', when: { m: 5, w: 1 }, fairNote: true },

  // --- Avrupa
  { id: 'eu_paskalya', region: 'eu', name: 'Paskalya', icon: '🥚', when: { m: 3, w: 0 }, demand: 1.1, weeks: 1, aud: { genc: 1.1 }, dialog: 'home', variants: [
    { title: '🥚 Yumurta avı', text: 'Biri ofise çikolata yumurtalar saklamış. Üç gündür bulunamayan bir tanesi sunucu odasında eriyor.',
      choices: [{ label: 'Resmî yumurta avı düzenle', effects: { morale: 5, progress: -0.3 } }, { label: 'Erimiş yumurtayı temizle, işe dön', effects: { stress: 2 } }] }] },
  { id: 'eu_futbol', region: 'eu', name: 'Avrupa Futbol Şampiyonası', icon: '⚽', when: { m: 5, w: 1 }, every: 4, from: 1976, demand: 0.95, weeks: 3, topics: { futbol: 1.5, spor: 1.25 }, also: { tr: 1 }, dialog: 'home', variants: [
    { title: '⚽ Kupa ateşi', text: 'Ofiste herkes başka bir takımı tutuyor. Klaus Amca da arayıp "Futbol oyunun yok mu?" diye sordu. Maç saatlerinde verim düşecek.',
      choices: [{ label: 'Maç saatlerinde mola', effects: { morale: 6, progress: -0.5 } }, { label: 'Maçlar akşam izlensin', effects: { morale: -2 } }] }] },
  { id: 'eu_agustos', region: 'eu', name: 'Ağustos tatili', icon: '🏖️', when: { m: 7, w: 0 }, demand: 0.85, weeks: 3, dialog: 'home', variants: [
    { title: '🏖️ Herkes sahilde', text: 'Avrupa\'da Ağustos: şehir boş, dağıtıcı telefon açmıyor, matbaa kapalı. Ekip de tatile çıkmak istiyor.',
      choices: [{ label: 'İki hafta toplu tatil', effects: { morale: 10, stress: -15, progress: -1 } }, { label: 'Nöbetleşe tatil', effects: { morale: 2, stress: -4 } }] }] },
  { id: 'eu_fuar', region: 'eu', name: 'Avrupa Oyun Fuarı', icon: '🎪', when: { m: 7, w: 2 }, from: 1985, fair: true, dialog: 'market', variants: [
    { title: '🎪 Avrupa Oyun Fuarı', text: 'Dev salonlar, kostümlü hayranlar, her köşede bir dağıtıcı. Klaus Amca "Stant kurmazsan kimse seni bilmez" diyor.',
      choices: [{ label: 'Stant kur', effects: { cash: -12000, hype: 10, regFans: { rid: 'eu', v: 9000 }, regRel: { rid: 'eu', v: 8 } } }, { label: 'Bu yıl pas', effects: {} }] }] },
  { id: 'eu_noel', region: 'eu', name: 'Noel pazarları', icon: '🎄', when: { m: 11, w: 2 }, demand: 1.15, weeks: 2, aud: { herkes: 1.15 }, dialog: 'home', variants: [
    { title: '🎄 Gizli Noel Baba', text: 'Ekip gizli Noel Baba çekilişi yapıyor. Muhasebeci kurucunun adını çekti ve şimdiden terliyor. Ofise sıcak şarap kokusu yayıldı.',
      choices: [{ label: 'Noel partisi (herkese hediye)', effects: { cash: -3000, morale: 10 } }, { label: 'Sade bir kutlama', effects: { morale: 4 } }] },
    { title: '🎁 Noel kataloğu', text: 'Büyük bir mağaza zinciri Noel kataloğunda oyunlarına sayfa ayırmak istiyor. Bedeli ağır, raf garantili.',
      choices: [{ label: 'Kataloğa gir (Avrupa satışı ×1,4, 2 hafta)', effects: { cash: -9000, regMod: { rid: 'eu', demand: 1.4, rev: 1, weeks: 2 } } }, { label: 'Gerek yok', effects: {} }] }] },

  // --- Japonya
  { id: 'jp_oshogatsu', region: 'jp', name: 'Oshōgatsu (Yeni Yıl) ve yılbaşı harçlığı', icon: '🎍', when: { m: 0, w: 0 }, demand: 1.45, weeks: 1, aud: { genc: 1.3 }, dialog: 'market', variants: [
    { title: '🎍 Otoshidama: çocukların harçlığı', text: 'Japonya\'da yeni yılda çocuklara harçlık zarfı verilir ve zarflar oyun dükkânına koşar. Tanaka-san dükkânlara afiş asmayı öneriyor.',
      choices: [{ label: 'Afiş ve vitrin (Japonya satışı ×1,3, 1 hafta)', effects: { cash: -5000, regMod: { rid: 'jp', demand: 1.3, rev: 1, weeks: 1 } } }, { label: 'Zarflar zaten gelir', effects: {} }] }] },
  { id: 'jp_hanami', region: 'jp', name: 'Hanami (kiraz çiçeği)', icon: '🌸', when: { m: 3, w: 0 }, demand: 1.0, weeks: 1, dialog: 'home', variants: [
    { title: '🌸 Kiraz ağacının altında', text: 'Stajyer sabah 5\'te parka gidip en iyi kiraz ağacının altına örtü serdi. Bütün ekip öğle yemeğini orada yemek istiyor.',
      choices: [{ label: 'Hanami pikniği', effects: { morale: 8, stress: -6, cashRaw: -400 } }, { label: 'Pencereden bakmak yeter', effects: { morale: 1 } }] }] },
  { id: 'jp_altinhafta', region: 'jp', name: 'Altın Hafta', icon: '🎏', when: { m: 4, w: 0 }, demand: 1.25, weeks: 1, aud: { genc: 1.15 } },
  { id: 'jp_tanabata', region: 'jp', name: 'Tanabata (Yıldız Festivali)', icon: '🎋', when: { m: 6, w: 1 }, demand: 1.0, weeks: 1, dialog: 'home', variants: [
    { title: '🎋 Dilek kâğıtları', text: 'Ofisteki bambuya dilekler asıldı: "Hatasız bir derleme", "Crunch olmasın", "Kedi". Biri kurucunun adını yazıp yanına "zam" demiş.',
      choices: [{ label: 'Bir dileği gerçekleştir: küçük zam', effects: { salaryPct: 0.02, morale: 8 } }, { label: 'Dilekler yıldızlara kalsın', effects: { morale: 2 } }] }] },
  { id: 'jp_obon', region: 'jp', name: 'Obon', icon: '🏮', when: { m: 7, w: 2 }, demand: 1.1, weeks: 1 },
  { id: 'jp_sov', region: 'jp', name: 'Tokyo Oyun Şovu', icon: '🎪', when: { m: 8, w: 2 }, from: 1996, fair: true, dialog: 'market', variants: [
    { title: '🎪 Tokyo Oyun Şovu', text: 'Kuyruklar istasyona kadar uzanıyor. Tanaka-san kibarca "Stantınız olursa yazmak isterim" dedi; bu Japonca\'da "gel" demektir.',
      choices: [{ label: 'Stant kur', effects: { cash: -15000, hype: 10, regFans: { rid: 'jp', v: 9000 }, regRel: { rid: 'jp', v: 10 } } }, { label: 'Bu yıl pas', effects: {} }] }] },

  // --- Latin Amerika
  { id: 'la_karnaval', region: 'latam', name: 'Karnaval', icon: '🎭', when: { m: 1, w: 2 }, demand: 0.85, weeks: 1, topics: { muzik: 1.3, dans: 1.4 }, dialog: 'market', variants: [
    { title: '🎭 Karnaval haftası', text: 'Don Ramón telefonda bağırıyor; arkada davullar. "Bu hafta kimse oyun almaz ama dans oyunun varsa bir bakarım!"',
      choices: [{ label: 'Karnaval temalı reklam', effects: { cash: -3000, regFans: { rid: 'latam', v: 3000 } } }, { label: 'Karnaval bitsin, sonra', effects: {} }] }] },
  { id: 'la_olulergunu', region: 'latam', name: 'Ölüler Günü', icon: '💀', when: { m: 10, w: 0 }, demand: 1.05, weeks: 1, topics: { korku: 1.3, fantezi: 1.15 } },
  { id: 'la_noel', region: 'latam', name: 'Noel', icon: '🎁', when: { m: 11, w: 3 }, demand: 1.15, weeks: 1 },

  // --- Asya-Pasifik
  { id: 'as_ayyili', region: 'asya', name: 'Ay Yeni Yılı', icon: '🧧', move: 'ayyili', demand: 1.4, weeks: 1, dialog: 'market', variants: [
    { title: '🧧 Kırmızı zarflar', text: 'Asya\'da Ay Yeni Yılı: kırmızı zarflar dağıtılıyor, aileler toplanıyor, oyun satışları patlıyor. Min-jun yeni yıla özel bir ejderha kostümü (kozmetik) yapmayı öneriyor.',
      choices: [{ label: 'Ejderha paketi (Asya satışı ×1,3, 2 hafta)', effects: { cash: -6000, regMod: { rid: 'asya', demand: 1.3, rev: 1, weeks: 2 } } }, { label: 'Kutlama mesajı yeter', effects: { regFans: { rid: 'asya', v: 1000 } } }] }] },
  { id: 'as_1111', region: 'asya', name: '11.11 Bekârlar Günü indirimi', icon: '🛍️', when: { m: 10, w: 1 }, from: 2009, demand: 1.45, weeks: 1, dialog: 'market', variants: [
    { title: '🛍️ 11.11: dünyanın en büyük indirimi', text: 'Bir günde milyarlarca sepet. Min-jun "Fiyatı yarıya indirmezsen listede görünmezsin" diyor.',
      choices: [{ label: '%50 indirim (satış ×2, kopya başı ×0,5)', effects: { regMod: { rid: 'asya', demand: 2, rev: 0.5, weeks: 1 } } }, { label: 'Tam fiyat, gururlu duruş', effects: {} }] }] },
  { id: 'as_fuar', region: 'asya', name: 'Asya Oyun Fuarı', icon: '🎪', when: { m: 7, w: 0 }, from: 2004, fair: true, dialog: 'market', variants: [
    { title: '🎪 Asya Oyun Fuarı', text: 'Turnuva sahneleri, ışıklı klavyeler, on binlerce genç. Min-jun bütün PC kafelerine posterini asabilir.',
      choices: [{ label: 'Stant ve turnuva sponsorluğu', effects: { cash: -14000, hype: 8, regFans: { rid: 'asya', v: 12000 }, regRel: { rid: 'asya', v: 8 } } }, { label: 'Bu yıl pas', effects: {} }] }] },

  // --- Dünya
  { id: 'dunya_kupa', region: 'all', name: 'Dünya Kupası', icon: '🏆', when: { m: 5, w: 2 }, every: 4, from: 1978, demand: 0.95, weeks: 3, topics: { futbol: 1.6, spor: 1.3 }, dialog: 'home', variants: [
    { title: '🏆 Dünya Kupası', text: 'Dünya Kupası başladı. Ofiste bayraklar, tahmin tablosu ve bir kodcunun "maç sırasında derleme bitmez" teorisi var.',
      choices: [{ label: 'Tahmin turnuvası (ödül benden)', effects: { cashRaw: -500, morale: 7 } }, { label: 'Ekran yok, odaklanalım', effects: { morale: -3, progress: 0.3 } }] }] },
  { id: 'dunya_olimpiyat', region: 'all', name: 'Yaz Olimpiyatları', icon: '🥇', when: { m: 6, w: 3 }, every: 4, from: 1976, demand: 1.0, weeks: 2, topics: { spor: 1.35 } },
];

// Bölgesel dönem olayları: bölgenin pazarını, kurunu ya da kurallarını yıllarca değiştirir.
// mod: {demand, weeks} talep; fx: {v, weeks} kur (gelirin dolar karşılığı); ban: {kind, until} platform yasağı; pirate: korsanlık +.
export const REGION_EVENTS = [
  { id: 'na_salon', region: 'na', year: 1978.5, title: '🕹️ Salon çılgınlığı', text: 'Büyük Bob: "Her pizzacıda bir salon makinesi var! Çocuklar jeton için harçlık biriktiriyor." Kuzey Amerika\'da salon oyunları uçuşta.', mod: { demand: 1.15, weeks: 144 } },
  { id: 'eu_evpc', region: 'eu', year: 1982.3, title: '💾 Ev bilgisayarı patlaması', text: 'Klaus Amca: "Her evde bir bilgisayar, her çocukta bir kaset kutusu!" Avrupa\'da ev bilgisayarı pazarı patladı.', mod: { demand: 1.25, weeks: 192 }, pirate: 0.1 },
  { id: 'eu_siddet', region: 'eu', year: 1985.2, title: '🚫 Şiddet listesi', text: 'Avrupa\'da bir ülke şiddet içeren oyunları "gençlere zararlı" listesine almaya başladı. Yetişkinlere yönelik aksiyon oyunları o ülkede rafa giremeyecek.', rule: 'siddet' },
  { id: 'jp_aile', region: 'jp', year: 1983.6, title: '🎮 Aile konsolu çılgınlığı', text: 'Tanaka-san: "Her evde aynı gri kutu var. Okul çıkışı herkes aynı oyunu konuşuyor." Japonya\'da konsol pazarı uçtu.', mod: { demand: 1.2, weeks: 240 } },
  { id: 'jp_yen', region: 'jp', year: 1985.75, title: '💴 Yen şahlandı', text: 'Kurlar anlaşması sonrası yen değer kazandı. Japonya\'dan gelen her kuruş artık daha çok dolar ediyor.', fx: { v: 1.4, weeks: 240 } },
  { id: 'jp_balon', region: 'jp', year: 1991.3, title: '🎈 Balon patladı', text: 'Japonya\'da emlak ve borsa balonu patladı. Tanaka-san: "Şirketler kemer sıkıyor ama çocuklar hâlâ oyun oynuyor."', mod: { demand: 0.88, weeks: 144 } },
  { id: 'jp_cep', region: 'jp', year: 1996.2, title: '🐾 Cep canavarı çılgınlığı', text: 'Takas edilebilen cep canavarları Japonya\'yı sardı. El konsolları ve sevimli yaratıklar her yerde.', mod: { demand: 1.15, weeks: 144 } },
  { id: 'tr_salon', region: 'tr', year: 1984.4, title: '🕹️ Atari salonları her mahallede', text: 'Kasetçi Cemil Abi: "Okul çıkışı herkes salonda, jeton bitince bakkaldan bozdurup geliyorlar." Türkiye\'de oyun bir mahalle kültürü oldu.', mod: { demand: 1.2, weeks: 192 } },
  { id: 'tr_kaset', region: 'tr', year: 1986.5, title: '📼 Kaset takas pazarı', text: 'Pazar sabahları kaset takas tezgâhları kuruluyor. Senin oyununun bir kopyası on kişiden geçti, hiçbiri para ödemedi; ama herkes adını biliyor.', pirate: 0.1, fans: 3000 },
  { id: 'tr_kur94', region: 'tr', year: 1994.3, title: '📉 Kur krizi', text: 'Lira bir gecede değer kaybetti. Türkiye satışlarının dolar karşılığı eridi; ama Türkiye\'deki maaşlar da dolar olarak ucuzladı.', fx: { v: 0.6, weeks: 96 }, payFx: true },
  { id: 'tr_kafe', region: 'tr', year: 1998.5, title: '🖥️ İnternet kafe çağı', text: 'Her sokakta bir internet kafe, her kafede strateji ve nişancı turnuvası. Ağ oyunları Türkiye\'de patladı.', mod: { demand: 1.25, weeks: 240 } },
  { id: 'tr_kur01', region: 'tr', year: 2001.2, title: '📉 Büyük kriz', text: 'Bankalar sallandı, kur uçtu. Kasetçi Cemil Abi dükkânı kapatıp bir internet kafe açtı.', fx: { v: 0.55, weeks: 144 }, payFx: true },
  { id: 'tr_mobil', region: 'tr', year: 2010.5, title: '📱 Cepler oyunla doldu', text: 'Türkiye\'de herkesin cebinde akıllı telefon. Okey, tavla ve futbol menajerliği otobüslerde oynanıyor.', mod: { demand: 1.3, weeks: 480 } },
  { id: 'tr_kur18', region: 'tr', year: 2018.6, title: '📉 Kur dalgalanması', text: 'Kur yine dalgalandı. Dijital mağazalar Türkiye fiyatlarını yeniden ayarladı; bölgesel fiyat farkı açıldı.', fx: { v: 0.65, weeks: 144 }, payFx: true },
  { id: 'la_ithal', region: 'latam', year: 1990.4, title: '🚢 İthalat vergileri', text: 'Don Ramón: "Konsol gümrükte üç kat pahalı! Herkes kaçak alıyor." Latin Amerika\'da gri pazar ve korsanlık arttı.', pirate: 0.1 },
  { id: 'la_kriz', region: 'latam', year: 2002.1, title: '📉 Peso krizi', text: 'Bölgede para birimleri çöktü; satışların dolar karşılığı düştü.', fx: { v: 0.6, weeks: 96 } },
  { id: 'la_mobil', region: 'latam', year: 2011.5, title: '📱 Mobil patlama', text: 'Latin Amerika ilk kez konsolu atlayıp doğrudan cebe geçti.', mod: { demand: 1.25, weeks: 480 } },
  { id: 'as_kriz', region: 'asya', year: 1997.6, title: '📉 Asya krizi', text: 'Bölge para birimleri birer birer düştü. Min-jun: "Dükkânlar kapanıyor ama PC kafeler doluyor; insanlar evde bilgisayar alamıyor."', fx: { v: 0.65, weeks: 96 } },
  { id: 'as_pckafe', region: 'asya', year: 1998.8, title: '🖥️ PC kafe devrimi', text: 'Strateji oyunları milli spor oldu; turnuvalar televizyonda. Asya\'da PC ve çevrimiçi oyun uçuşta.', mod: { demand: 1.3, weeks: 480 } },
  { id: 'as_yasak', region: 'asya', year: 2000.4, title: '🚫 Konsol yasağı', text: 'Bölgenin en büyük ülkesi oyun konsollarının satışını yasakladı. Asya\'da konsol ve el konsolu satışı neredeyse durdu.', ban: { kinds: ['konsol', 'el'], until: 2015.5 } },
  { id: 'as_yasakbitti', region: 'asya', year: 2015.5, title: '✅ Konsol yasağı kalktı', text: 'On beş yıl sonra konsollar raflara döndü. Min-jun: "Kimse fark etmedi bile, herkes telefonda."' },
  { id: 'as_sure', region: 'asya', year: 2021.6, title: '⏰ Gençlere oyun süresi sınırı', text: 'Asya\'da gençlerin çevrimiçi oyun süresi haftada birkaç saatle sınırlandı.', mod: { demand: 0.9, weeks: 480 } },
];

// Yaş ve sansür kurulları (kurgusal)
export const BOARDS = [
  { region: 'na', name: 'Eğlence Derecelendirme Kurulu', year: 1994 },
  { region: 'eu', name: 'Avrupa Oyun Etiketi', year: 2003 },
  { region: 'jp', name: 'Japonya Eğlence Derecelendirme', year: 2002 },
  { region: 'asya', name: 'Çevrimiçi Oyun Onay Dairesi', year: 2004 },
];
