// X Project — içerik paketi.
// Kural: kod kural taşır, veri sayı taşır. Her blok _tag ile kaynağını söyler:
//   V = doğrulanmış (PDF), L = sınırlı (oyuncu/rehber), P = bizim önerimiz / kalibrasyon.

export const PACK = {
  meta: {
    _tag: 'V/P',
    name: 'X Project',
    startYear: 1976,
    weeksPerMonth: 4,
    monthsPerYear: 12,
    gameLengths: { 30: 1, 35: 1.16667, 42: 1.4, 50: 1 }, // V (GDT); 50 = tam tarih 1976–2025
    defaultLength: 35,
    msPerWeek: { 1: 1400, 2: 700, 4: 320, 8: 140 }, // P (arayüz hızı)
  },

  difficulties: [
    // D, ipD: V (MGT2) · Z, startCash: P
    { id: 'cok_kolay', name: 'Çok kolay', D: 0.7, Z: 1.0, ipD: 0.70, startCash: 300000 },
    { id: 'kolay', name: 'Kolay', D: 1.0, Z: 0.3, ipD: 0.45, startCash: 200000 },
    { id: 'orta', name: 'Orta', D: 1.5, Z: 0.25, ipD: 0.38, startCash: 120000 },
    { id: 'zor', name: 'Zor', D: 1.8, Z: 0.15, ipD: 0.36, startCash: 80000 },
    { id: 'cok_zor', name: 'Çok zor', D: 2.2, Z: 0.10, ipD: 0.34, startCash: 60000 },
    { id: 'efsanevi', name: 'Efsanevi', D: 3.0, Z: 0.07, ipD: 0.30, startCash: 45000 },
  ],

  // H(y): Kolay oyun hedefi, logaritmik ara değer. Sayılar V, ara yıllar P.
  targetCurve: { _tag: 'V/P', points: [[1976, 40], [1979.25, 80], [1985, 363], [1990.6, 889], [1994, 1334], [2009, 3700], [2025, 11000]] },
  // τ teknik çarpanı (V); diğer üç disiplin 1.
  techTargetMult: { _tag: 'V', points: [[1976, 1.125], [1978.99, 1.125], [1979, 1.25], [1990, 1.25], [1994, 1.0]] },

  prestige: { _tag: 'P', base: 1.11, scoreForUp: 90, decayPerYear: 0.5, max: 5 },

  review: {
    _tag: 'V/P',
    cap: 98, // V
    noSubgenrePenalty: 3, // V
    badPairPenalty: 2, // P
    bugMult: 20, bugCap: 10, // P
    randTop: 2, // V (tavanda 0–2 rastgele)
    alignFloor: 0.5, alignK: 0.5, // P
    oldEngineYears: 5, oldEnginePenalty: 2, // P
    repeatComboPenalty: 3, // L (aynı konu×tür art arda)
    newFeatureBonus: 1, // L
  },

  production: {
    _tag: 'P',
    K: 0.784,
    skillStart: 35, skillPerYear: 2.7, skillCap: 75,
    etaFree: 10, etaLoss: 0.015, etaFloor: 0.7,
    mCurve: [[1976, 1.0], [1980, 1.65], [1985, 2.4], [1990, 2.6], [2000, 2.85], [2010, 3.6], [2020, 5.6]],
    specBonus: 1.3,
    rpShare: 0.15, // herkesin üretiminin araştırma puanına giden payı
    researchRoomRp: 0.6, // araştırmaya atanmış kişinin puanı → RP
    crunchOut: 1.4,
    missionFloor: 0.7, // görev ağırlığının etkisi: 0,7 + 0,3·w (P)
    moraleFloor: 0.6,
    bugPerPoint: 0.08, crunchBugMult: 1.8, debugPerPointK: 1.2,
    expGainPerProject: 2.5, founderSkill: 50,
    phaseNames: ['Faz 1: Çekirdek', 'Faz 2: İçerik', 'Faz 3: Cila'],
  },

  sales: {
    _tag: 'P',
    // PDF: B 57000, Pz 0,02→1→8. Bu uygulamada stüdyo çarpanları (Y·St·I) erken dönemi zaten ~×0,1'e indirdiği için
    // yeniden kalibre edildi: garaj 1977 iyi oyun ≈ 300/hafta, 1992 yerleşik hit ≈ 40 bin/hafta (P).
    B: 140000,
    pzCurve: [[1976, 0.5], [1985, 0.7], [1992, 1], [2025, 8]],
    sA: 0.09, sCenter: 90, sCut: 60, sLow: -2.7, sLowK: 0.2,
    fanRef: 10000, fanK: 0.5, hypeK: 0.15,
    priceRef: 35, priceExp: 1.5,
    yA: 0.15, yB: 0.85, stA: 0.3, stB: 0.7, stCap: 5, iA: 0.5, iB: 0.5, ipK: 0.2,
    curve: [0.6, 0.85, 1.0], tailA: 0.85, tailB: 0.95, tailBPirated: 0.91, stopAt: 0.02,
    capShare: 0.35, // V/P pazar tavanı
    christmasMonth: 12, christmasMult: 1.5, // L
    sequelOverlapMult: 0.8, trendMult: 1.25, rivalSameGenreMult: 0.88, overusedMult: 0.85,
    selfPublishPowerBase: 10, selfPublishFansPerPower: 5000, selfPublishPowerCap: 95,
    retailCut: 0.45, unitCost: 2,
  },

  // Oyun boyutları. weeks/target/sales: P · MGT2 boyut cezası: V
  sizes: [
    { id: 'kucuk', name: 'Küçük', mgt: 'B', weeks: 10, target: 0.35, sales: 0.55, research: null, office: 1, devCost: 0.3 },
    { id: 'orta', name: 'Orta', mgt: 'B+', weeks: 16, target: 1.0, sales: 1.0, research: 'boyut_orta', office: 2, devCost: 1 },
    { id: 'buyuk', name: 'Büyük', mgt: 'A', weeks: 28, target: 1.8, sales: 1.7, research: 'boyut_buyuk', office: 3, devCost: 2.5 },
    { id: 'aaa', name: 'AAA', mgt: 'AA', weeks: 44, target: 3.0, sales: 2.6, research: 'boyut_aaa', office: 4, devCost: 5 },
    { id: 'mmo', name: 'MMO', mgt: 'AAA', weeks: 56, target: 3.5, sales: 1.2, research: 'boyut_mmo', office: 4, devCost: 7, mmo: true },
  ],
  sizePenalty: {
    _tag: 'V',
    rows: [
      [1983, { B: -1 }],
      [1988, { B: -2, 'B+': -1 }],
      [1995, { B: -3, 'B+': -2, A: -1 }],
      [2004, { B: -4, 'B+': -3, A: -2, AA: -1 }],
      [2020, { B: -5, 'B+': -4, A: -3, AA: -2, AAA: -1 }],
    ],
  },
  mmo: { _tag: 'P', subPerUnit: 0.6, monthlyFee: 12, churn: 0.06, serverCostPerSub: 1.2, minSubs: 500 },

  disciplines: [
    { id: 'oyn', name: 'Oynanış' }, { id: 'gfx', name: 'Grafik' }, { id: 'ses', name: 'Ses' }, { id: 'tek', name: 'Teknik' },
  ],
  missions: [
    { id: 'motor', name: 'Motor', phase: 0, disc: 'tek' },
    { id: 'oynanis', name: 'Oynanış', phase: 0, disc: 'oyn' },
    { id: 'hikaye', name: 'Hikâye', phase: 0, disc: 'oyn' },
    { id: 'diyalog', name: 'Diyalog', phase: 1, disc: 'oyn' },
    { id: 'seviye', name: 'Seviye tasarımı', phase: 1, disc: 'oyn' },
    { id: 'yz', name: 'Yapay zekâ', phase: 1, disc: 'tek' },
    { id: 'dunya', name: 'Dünya tasarımı', phase: 2, disc: 'gfx' },
    { id: 'grafik', name: 'Grafik', phase: 2, disc: 'gfx' },
    { id: 'ses', name: 'Ses', phase: 2, disc: 'ses' },
  ],
  audiences: [{ id: 'genc', name: 'Genç' }, { id: 'herkes', name: 'Herkes' }, { id: 'yetiskin', name: 'Yetişkin' }],

  // Türler. disc = w_d (V ağırlık, P türetme). hint = GDT kaydırıcı önerisi (L), mission = GDT görev ağırlıkları (V).
  genres: [
    { id: 'aksiyon', name: 'Aksiyon', research: null, disc: { oyn: 0.397, gfx: 0.231, ses: 0.115, tek: 0.256 },
      mission: [1, 0.9, 0.7, 0.6, 0.9, 1, 0.8, 1, 0.9], hint: [100, 80, 0, 0, 80, 100, 0, 100, 80], good: ['macera', 'rpg', 'casual'] },
    { id: 'macera', name: 'Macera', research: null, disc: { oyn: 0.468, gfx: 0.247, ses: 0.104, tek: 0.182 },
      mission: [0.7, 0.8, 1, 1, 0.8, 0.7, 1, 0.9, 0.8], hint: [0, 0, 100, 100, 0, 0, 100, 80, 0], good: ['rpg', 'aksiyon', 'casual'] },
    { id: 'rpg', name: 'RPG', research: 'tur_rpg', disc: { oyn: 0.468, gfx: 0.247, ses: 0.104, tek: 0.182 },
      mission: [0.7, 0.8, 1, 1, 0.8, 0.7, 1, 0.9, 0.8], hint: [0, 80, 100, 100, 80, 0, 100, 80, 0], good: ['aksiyon', 'macera', 'strateji'] },
    { id: 'simulasyon', name: 'Simülasyon', research: 'tur_sim', disc: { oyn: 0.425, gfx: 0.225, ses: 0.113, tek: 0.237 },
      mission: [0.9, 1, 0.8, 0.7, 0.9, 1, 0.8, 1, 0.9], hint: [80, 100, 0, 0, 80, 100, 0, 100, 80], good: ['strateji', 'casual'] },
    { id: 'strateji', name: 'Strateji', research: 'tur_str', disc: { oyn: 0.438, gfx: 0.225, ses: 0.113, tek: 0.225 },
      mission: [0.9, 1, 0.8, 0.7, 1, 0.9, 1, 0.8, 0.9], hint: [80, 100, 0, 0, 100, 80, 100, 0, 80], good: ['simulasyon', 'rpg'] },
    { id: 'casual', name: 'Casual', research: null, disc: { oyn: 0.472, gfx: 0.236, ses: 0.125, tek: 0.167 },
      mission: [0.6, 1, 0.7, 0.7, 1, 0.6, 0.7, 1, 0.9], hint: [0, 100, 0, 0, 100, 0, 0, 100, 80], good: ['aksiyon', 'simulasyon', 'macera'] },
  ],

  // Konular: [id, ad, tür ağırlıkları ×10 (aks,mac,rpg,sim,str,cas), kitle ×10 (genç,herkes,yetişkin), açılış yılı]. P (GDT ölçeği V)
  topics: [
    ['uzay', 'Uzay', [10, 9, 8, 9, 8, 7], [10, 10, 8], 1976],
    ['fantezi', 'Fantezi', [8, 10, 10, 6, 9, 7], [9, 9, 10], 1976],
    ['spor', 'Spor', [8, 6, 6, 10, 7, 10], [10, 10, 7], 1976],
    ['yaris', 'Yarış', [10, 6, 6, 10, 6, 9], [10, 10, 8], 1976],
    ['zindan', 'Zindan', [9, 9, 10, 6, 8, 7], [8, 9, 10], 1976],
    ['korsan', 'Korsan', [9, 10, 8, 7, 8, 8], [10, 9, 8], 1976],
    ['askeri', 'Askerî', [10, 7, 7, 9, 10, 6], [8, 8, 10], 1976],
    ['dedektif', 'Dedektif', [6, 10, 8, 7, 7, 8], [7, 9, 10], 1976],
    ['hayvan', 'Sanal Evcil Hayvan', [6, 7, 6, 10, 6, 10], [10, 10, 6], 1978],
    ['ninja', 'Ninja', [10, 8, 8, 6, 8, 8], [10, 9, 8], 1978],
    ['robot', 'Robotlar', [10, 8, 8, 9, 9, 8], [10, 9, 8], 1979],
    ['kiyamet', 'Kıyamet Sonrası', [10, 9, 10, 8, 8, 6], [8, 8, 10], 1980],
    ['korku', 'Korku', [10, 10, 8, 6, 6, 7], [7, 8, 10], 1980],
    ['sehir', 'Şehir', [6, 7, 7, 10, 10, 8], [8, 10, 9], 1981],
    ['is', 'İş Dünyası', [6, 7, 6, 10, 9, 8], [6, 9, 10], 1981],
    ['tarih', 'Tarih', [7, 9, 9, 9, 10, 6], [7, 9, 10], 1982],
    ['muzik', 'Müzik', [7, 7, 6, 8, 6, 10], [10, 10, 7], 1983],
    ['kahraman', 'Süper Kahraman', [10, 8, 9, 6, 6, 8], [10, 10, 8], 1984],
    ['ofis', 'Ofis Hayatı', [6, 9, 7, 10, 7, 10], [7, 10, 9], 1985],
    ['zombi', 'Zombi', [10, 9, 8, 8, 8, 8], [9, 9, 10], 1985],
    ['siberpunk', 'Siberpunk', [10, 9, 10, 7, 8, 6], [8, 8, 10], 1986],
    ['casus', 'Casus', [10, 9, 7, 7, 8, 6], [9, 9, 10], 1986],
    ['sualti', 'Sualtı', [9, 10, 8, 8, 6, 9], [10, 10, 8], 1987],
    ['hastane', 'Hastane', [6, 7, 6, 10, 9, 8], [7, 9, 9], 1988],
    ['oyungelistirme', 'Oyun Geliştirme', [6, 7, 6, 10, 6, 8], [9, 10, 7], 1990], // V (GDT örneği)
    ['hukumet', 'Hükümet', [6, 7, 7, 10, 10, 6], [6, 8, 10], 1990],
    ['kedi', 'Kediler', [7, 8, 7, 9, 6, 10], [10, 10, 9], 1990],
    ['zaman', 'Zaman Yolculuğu', [9, 10, 10, 7, 8, 7], [9, 9, 9], 1991],
    ['kurtadam', 'Kurt Adam', [9, 9, 9, 6, 7, 7], [8, 8, 10], 1992],
    ['mafya', 'Mafya', [10, 9, 8, 8, 9, 6], [7, 8, 10], 1993],
    ['moda', 'Moda', [6, 7, 6, 9, 6, 10], [10, 10, 7], 1995],
    ['dans', 'Dans', [7, 6, 6, 9, 6, 10], [10, 10, 7], 1998],
    ['startup', 'Startup', [6, 7, 7, 10, 9, 9], [7, 9, 10], 2000],
    ['hayatta', 'Hayatta Kalma', [10, 9, 9, 9, 8, 6], [9, 9, 10], 2005],
    ['sosyal', 'Sosyal Medya', [6, 7, 6, 9, 7, 10], [10, 10, 7], 2007],
    ['yapayzeka', 'Yapay Zekâ', [8, 10, 9, 9, 9, 7], [8, 9, 10], 2015],
    ['kripto', 'Kripto Çılgınlığı', [6, 7, 6, 9, 8, 9], [8, 8, 9], 2018],
    ['pandemi', 'Pandemi', [7, 8, 7, 10, 9, 8], [7, 9, 10], 2020],
  ],

  // Platformlar (parodi adlar). GDT alanları (V); değerler P.
  // base: milyon kurulu taban; key: doğrusal olmayan büyüme (marketKeyPoints).
  platforms: [
    // Bilgisayarlar
    { id: 'pc', name: 'Kişisel Bilgisayar', kind: 'pc', owner: null, from: 1976, to: 2200, start: 0.05, units: 250, licence: 0, devCost: 800, tech: 1,
      genre: [9, 9, 10, 10, 10, 8], aud: [8, 9, 10], key: [[1976, 0.05], [1985, 10], [1995, 40], [2005, 90], [2015, 150], [2030, 250]] },
    { id: 'elma2', name: 'Elma II', kind: 'pc', owner: null, from: 1977, to: 1993, start: 0.05, units: 5, licence: 0, devCost: 1200, tech: 1, genre: [8, 10, 10, 9, 9, 7], aud: [8, 9, 10] },
    { id: 'zx', name: 'ZX Tayfı', kind: 'pc', owner: null, from: 1982, to: 1992, start: 0.3, units: 5, licence: 0, devCost: 1500, tech: 1, genre: [9, 10, 8, 8, 8, 9], aud: [10, 9, 8] },
    { id: 'komodor', name: 'Komodor 64', kind: 'pc', owner: null, from: 1982, to: 1994, start: 0.5, units: 17, licence: 3000, devCost: 3000, tech: 2, genre: [9, 10, 9, 9, 9, 8], aud: [10, 9, 9] },
    { id: 'amigo', name: 'Amigo 500', kind: 'pc', owner: null, from: 1985, to: 1996, start: 0.2, units: 6, licence: 2000, devCost: 8000, tech: 3, genre: [9, 10, 9, 10, 10, 8], aud: [9, 9, 10] },
    // Konsollar
    { id: 'ataro', name: 'Ataro 2600', kind: 'konsol', owner: 'ataro', from: 1977, to: 1991, start: 0.4, units: 30, licence: 1500, devCost: 2000, tech: 1, genre: [10, 7, 6, 8, 6, 10], aud: [10, 10, 7] },
    { id: 'zekavizyon', name: 'Zekâvizyon', kind: 'konsol', owner: null, from: 1980, to: 1985, start: 0.2, units: 3, licence: 2000, devCost: 3000, tech: 1, genre: [9, 7, 7, 9, 8, 9], aud: [9, 10, 8] },
    { id: 'kolekovizyon', name: 'Kolekovizyon', kind: 'konsol', owner: null, from: 1982, to: 1986, start: 0.3, units: 2, licence: 2500, devCost: 3500, tech: 2, genre: [10, 7, 7, 7, 6, 9], aud: [10, 9, 7] },
    { id: 'nfc', name: 'Pandando Aile Bilgisayarı', kind: 'konsol', owner: 'pandando', from: 1983, to: 1995, start: 0.5, units: 62, licence: 25000, devCost: 15000, tech: 2, genre: [10, 9, 10, 7, 7, 10], aud: [10, 10, 7] },
    { id: 'seggams', name: 'Segga Usta Sistem', kind: 'konsol', owner: 'segga', from: 1986, to: 1993, start: 0.3, units: 13, licence: 15000, devCost: 12000, tech: 2, genre: [10, 8, 8, 7, 6, 9], aud: [10, 9, 8] },
    { id: 'turbo', name: 'Turbo Grafik 16', kind: 'konsol', owner: 'hadson', from: 1988, to: 1994, start: 0.3, units: 10, licence: 20000, devCost: 15000, tech: 3, genre: [10, 7, 9, 6, 6, 8], aud: [9, 9, 8] },
    { id: 'segga', name: 'Segga Mega', kind: 'konsol', owner: 'segga', from: 1988, to: 1998, start: 0.4, units: 35, licence: 40000, devCost: 25000, tech: 3, genre: [10, 8, 9, 7, 7, 9], aud: [10, 9, 8] },
    { id: 'oyunboi', name: 'Oyun Boi', kind: 'el', owner: 'pandando', from: 1989, to: 2003, start: 1, units: 118, licence: 30000, devCost: 15000, tech: 2, genre: [8, 8, 10, 7, 7, 10], aud: [10, 10, 7] },
    { id: 'links', name: 'Ataro Links', kind: 'el', owner: 'ataro', from: 1989, to: 1995, start: 0.2, units: 3, licence: 15000, devCost: 10000, tech: 2, genre: [9, 7, 7, 6, 6, 9], aud: [10, 9, 7] },
    { id: 'snes', name: 'Süper Pandando', kind: 'konsol', owner: 'pandando', from: 1990, to: 2000, start: 0.8, units: 49, licence: 60000, devCost: 40000, tech: 3, genre: [10, 9, 10, 8, 8, 10], aud: [10, 10, 8] },
    { id: 'jagar', name: 'Ataro Jagar', kind: 'konsol', owner: 'ataro', from: 1993, to: 1997, start: 0.1, units: 0.3, licence: 50000, devCost: 60000, tech: 4, genre: [9, 6, 6, 6, 6, 7], aud: [8, 8, 9] },
    { id: 'saturn', name: 'Segga Satürn', kind: 'konsol', owner: 'segga', from: 1994, to: 2000, start: 0.5, units: 9, licence: 80000, devCost: 70000, tech: 4, genre: [10, 8, 9, 7, 7, 7], aud: [8, 9, 10] },
    { id: 'oi1', name: 'Oyunİstasyonu', kind: 'konsol', owner: 'soni', from: 1994, to: 2006, start: 1, units: 102, licence: 100000, devCost: 80000, tech: 4, genre: [10, 9, 10, 9, 7, 9], aud: [9, 10, 10] },
    { id: 'n64', name: 'Pandando 64', kind: 'konsol', owner: 'pandando', from: 1996, to: 2002, start: 1, units: 33, licence: 120000, devCost: 100000, tech: 4, genre: [10, 10, 8, 7, 6, 10], aud: [10, 10, 7] },
    { id: 'ruya', name: 'Segga Rüyayayın', kind: 'konsol', owner: 'segga', from: 1998, to: 2002, start: 0.6, units: 9, licence: 120000, devCost: 90000, tech: 5, genre: [10, 9, 9, 8, 7, 9], aud: [9, 9, 9] },
    { id: 'oi2', name: 'Oyunİstasyonu 2', kind: 'konsol', owner: 'soni', from: 2000, to: 2013, start: 1.5, units: 155, licence: 200000, devCost: 150000, tech: 5, genre: [10, 9, 10, 9, 7, 9], aud: [9, 10, 10] },
    { id: 'xkutu', name: 'X-Kutu', kind: 'konsol', owner: 'mikroyumusak', from: 2001, to: 2009, start: 1, units: 24, licence: 200000, devCost: 150000, tech: 5, genre: [10, 8, 9, 8, 8, 7], aud: [8, 9, 10] },
    { id: 'kup', name: 'Pandando KüpOyun', kind: 'konsol', owner: 'pandando', from: 2001, to: 2007, start: 0.8, units: 22, licence: 150000, devCost: 110000, tech: 5, genre: [10, 10, 8, 7, 6, 10], aud: [10, 10, 7] },
    { id: 'oboileri', name: 'Oyun Boi İleri', kind: 'el', owner: 'pandando', from: 2001, to: 2008, start: 1, units: 81, licence: 60000, devCost: 30000, tech: 3, genre: [9, 9, 10, 8, 8, 10], aud: [10, 10, 7] },
    { id: 'ndz', name: 'Pandando ÇE', kind: 'el', owner: 'pandando', from: 2004, to: 2014, start: 1, units: 154, licence: 150000, devCost: 80000, tech: 5, genre: [8, 9, 9, 9, 8, 10], aud: [10, 10, 7] },
    { id: 'oicep', name: 'Oyunİstasyonu Cep', kind: 'el', owner: 'soni', from: 2004, to: 2014, start: 1, units: 80, licence: 150000, devCost: 100000, tech: 5, genre: [10, 8, 10, 7, 7, 8], aud: [8, 9, 10] },
    { id: 'x360', name: 'X-Kutu 360', kind: 'konsol', owner: 'mikroyumusak', from: 2005, to: 2016, start: 1.5, units: 84, licence: 400000, devCost: 400000, tech: 6, genre: [10, 8, 9, 8, 8, 8], aud: [8, 9, 10] },
    { id: 'viivii', name: 'Vii-Vii', kind: 'konsol', owner: 'pandando', from: 2006, to: 2014, start: 2, units: 101, licence: 200000, devCost: 120000, tech: 5, genre: [8, 7, 7, 10, 6, 10], aud: [10, 10, 7] },
    { id: 'oi3', name: 'Oyunİstasyonu 3', kind: 'konsol', owner: 'soni', from: 2006, to: 2017, start: 1, units: 87, licence: 450000, devCost: 450000, tech: 6, genre: [10, 9, 10, 8, 8, 7], aud: [8, 9, 10] },
    { id: 'afon', name: 'aFon (mobil)', kind: 'mobil', owner: null, from: 2008, to: 2200, start: 5, units: 800, licence: 100, devCost: 20000, tech: 5, priceRef: 5,
      genre: [8, 7, 7, 9, 8, 10], aud: [10, 10, 8], key: [[2008, 5], [2012, 150], [2018, 500], [2030, 800]] },
    { id: 'p3ce', name: 'Pandando 3ÇE', kind: 'el', owner: 'pandando', from: 2011, to: 2020, start: 1, units: 75, licence: 200000, devCost: 120000, tech: 5, genre: [9, 9, 10, 9, 8, 10], aud: [10, 10, 7] },
    { id: 'vita', name: 'Oyunİstasyonu Vita', kind: 'el', owner: 'soni', from: 2011, to: 2019, start: 0.5, units: 15, licence: 250000, devCost: 200000, tech: 6, genre: [10, 8, 10, 7, 7, 8], aud: [8, 9, 10] },
    { id: 'viiu', name: 'Vii U', kind: 'konsol', owner: 'pandando', from: 2012, to: 2017, start: 0.5, units: 13, licence: 300000, devCost: 250000, tech: 6, genre: [9, 9, 8, 8, 7, 10], aud: [10, 10, 7] },
    { id: 'oi4', name: 'Oyunİstasyonu 4', kind: 'konsol', owner: 'soni', from: 2013, to: 2025, start: 2, units: 117, licence: 800000, devCost: 700000, tech: 7, genre: [10, 10, 10, 8, 8, 7], aud: [8, 9, 10] },
    { id: 'xbir', name: 'X-Kutu Bir', kind: 'konsol', owner: 'mikroyumusak', from: 2013, to: 2022, start: 1, units: 50, licence: 700000, devCost: 700000, tech: 7, genre: [10, 8, 9, 8, 8, 7], aud: [8, 9, 10] },
    { id: 'svic', name: 'Pandando Sviç', kind: 'konsol', owner: 'pandando', from: 2017, to: 2028, start: 2, units: 145, licence: 500000, devCost: 400000, tech: 7, genre: [9, 9, 10, 9, 8, 10], aud: [10, 10, 8] },
    { id: 'oi5', name: 'Oyunİstasyonu 5', kind: 'konsol', owner: 'soni', from: 2020, to: 2032, start: 4, units: 100, licence: 1200000, devCost: 1000000, tech: 7, genre: [10, 10, 10, 8, 8, 7], aud: [8, 9, 10] },
    { id: 'xseri', name: 'X-Kutu Seri X', kind: 'konsol', owner: 'mikroyumusak', from: 2020, to: 2032, start: 2, units: 33, licence: 1100000, devCost: 1000000, tech: 7, genre: [10, 8, 9, 8, 8, 7], aud: [8, 9, 10] },
    { id: 'guverte', name: 'Buhar Güvertesi', kind: 'el', owner: 'vana', from: 2022, to: 2032, start: 1, units: 8, licence: 0, devCost: 50000, tech: 7, genre: [10, 9, 10, 9, 9, 8], aud: [8, 9, 10] },
    { id: 'svic2', name: 'Pandando Sviç 2', kind: 'konsol', owner: 'pandando', from: 2025, to: 2035, start: 3, units: 120, licence: 900000, devCost: 600000, tech: 7, genre: [9, 9, 10, 9, 8, 10], aud: [10, 10, 8] },
  ],
  platformGrowth: { _tag: 'P', peakAt: 0.75 },

  // Yayıncılar. power: MGT2 gizli güç (V örnekleri), diğerleri P.
  // Yayıncılar: sabit küçükler + tarihten gelen büyükler (history.js 'pub' şirketleri; gücü yıllara göre değişir).
  publishers: [
    { id: 'mantar', name: 'Kırmızı Mantar', power: 55, royalty: 0.40, from: 1976, to: 2200, minFans: 0 },
    { id: 'morayi', name: 'Mor Ayı Indie', power: 60, royalty: 0.45, from: 2008, to: 2200, minFans: 0 },
  ],
  // Tarihsel dünya (P): rakipler ve yayıncılar history.js'ten; her yıl 10 hit, her ay bir olay.
  world: {
    _tag: 'P',
    pubMinRep: 55, pubMax: 8, royaltyA: 0.52, royaltyK: 0.003, royaltyMin: 0.2, minFansK: 36,
    activeRivals: 14, // en güçlü N şirket düzenli oyun çıkarır
    hitPeakK: 1.5, hitRankDecay: 0.06, hitPower: 80,
    histScoreK: { cok_kolay: 0.86, kolay: 0.9, orta: 0.95, zor: 0.98, cok_zor: 1, efsanevi: 1 },
    genreAward: { prestige: 0.5, fans: 8000, cash: 20000 },
    logMax: 120,
  },
  publisherAdvance: { _tag: 'P', base: 8000 },

  // Ofis kademeleri (V: 4 kademe). Koltuklar artık odalardan gelir (MGT2 oda motoru): slot × oda başına koltuk.
  offices: [
    { tier: 1, name: 'Garaj', slots: 1, roomSeats: 1, cost: 0, rent: 300 },
    { tier: 2, name: 'Küçük ofis', slots: 2, roomSeats: 3, cost: 120000, rent: 800 },
    { tier: 3, name: 'Büyük ofis', slots: 4, roomSeats: 4, cost: 900000, rent: 2500 },
    { tier: 4, name: 'ArGe kampüsü', slots: 6, roomSeats: 6, cost: 5000000, rent: 8000, floorCost: 1500000, floorSlots: 2, maxFloors: 8, floorRent: 3000 },
  ],

  // Odalar (MGT2, L/P). Geliştirme odası kendi oyunu yokken sözleşme yapar (MGT, L).
  rooms: {
    _tag: 'L/P',
    types: [
      { id: 'gelistirme', name: 'Geliştirme odası', cost: 15000, floor: '#5b4a73', desc: 'Oyunu ve sözleşmeleri yapar. Kaydırıcılar burada işler.' },
      { id: 'grafik', name: 'Grafik stüdyosu', cost: 40000, research: 'oda_uzman', disc: 'gfx', floor: '#3f5f73', desc: 'Tüm proje boyunca yalnızca grafik puanı üretir, hızlı.' },
      { id: 'ses', name: 'Ses stüdyosu', cost: 40000, research: 'oda_uzman', disc: 'ses', floor: '#5a3f73', desc: 'Tüm proje boyunca yalnızca ses puanı üretir, hızlı.' },
      { id: 'qa', name: 'Kalite güvence', cost: 30000, research: 'oda_qa', floor: '#3f7360', desc: 'Geliştirme sırasında hata ayıklar, oynanışı cilalar.' },
      { id: 'arastirma', name: 'Araştırma odası', cost: 30000, floor: '#73653f', desc: 'Araştırma puanı üretir.' },
      { id: 'mola', name: 'Mola odası', cost: 15000, floor: '#734a5a', desc: 'Buradakiler hızla dinlenir; varlığı herkesin stresini azaltır.' },
      { id: 'donanim', name: 'Donanım laboratuvarı', cost: 500000, research: 'donanim_lab', office: 3, floor: '#4a4a5a', desc: 'Kendi konsolunu yapar. Donanım mühendisi gerekir.' },
      { id: 'pazarlama', name: 'Pazarlama ve yayın', cost: 35000, office: 2, floor: '#735a3f', desc: 'Projelere her hafta hype üretir; kendi yayınında oyunun gücünü artırır.' },
      { id: 'musteri', name: 'Müşteri destek', cost: 25000, office: 2, floor: '#3f6773', desc: 'Satıştaki oyunlar için hayran kazandırır, kötü not ve hata kaynaklı hayran kaybını azaltır, oyuncu raporlarını bedavaya çıkarır.' },
    ],
    modes: { otomatik: 'Kendi oyunu, yoksa sözleşme', oyun: 'Yalnızca kendi oyunu', sozlesme: 'Yalnızca sözleşme', destek: 'Başka projeye destek' },
    expertMult: 2.4, // P (şartname: uzman odada çarpan 2,4)
    // Destek odaları belirli bir projeye atanabilir (MGT), atanmamışsa tüm projelere bölünür.
    targetable: ['grafik', 'ses', 'qa', 'pazarlama'],
    marketingHypeK: 0.12, selfPublishBonus: 15, // P
    supportFansK: 6, supportLossCut: 0.5, // P: kişi-hafta üretimi başına hayran, kötü not kaybını yarıya indirir
    qaBugK: 0.9, qaPolish: 0.2,
    restRoomStress: -0.6, restRoomMorale: 0.05,
    demolishRefund: 0.25,
  },

  // Binalar (MGT esinli): odalar türüne göre ayrı binalarda durur; sahnede kaydırarak geçilir.
  buildings: [
    { id: 'ana', name: 'Ana ofis', types: ['gelistirme', 'mola'] },
    { id: 'studyo', name: 'Stüdyolar', types: ['grafik', 'ses'], minTier: 2 },
    { id: 'arge', name: 'Ar-Ge binası', types: ['arastirma', 'donanim'], minTier: 2 },
    { id: 'yayin', name: 'Yayın ve destek', types: ['qa', 'pazarlama', 'musteri'], minTier: 2 },
  ],

  // Oyuncu raporu (GDT esinli): oyuncular neyi beğendi; görev önemleri bilgi olarak birikir (P).
  playerReport: { _tag: 'P', cost: 6000, minWeeks: 4, highAlloc: 0.4, lowAlloc: 0.22, priceHigh: 1.3, priceLow: 0.6, hypeGap: 25 },

  // Kariyerler (Game Dev Story, V yapısı; çarpanlar P). + = 1,0 · ++ = 1,2 · +++ = 1,4
  careers: [
    { id: 'kodcu', name: 'Kodcu', tier: 1, disc: 'tek', aff: { oyn: 1.0, gfx: 1.0, ses: 1.0, tek: 1.2 }, debug: 1.2, hw: 0.5, req: [] },
    { id: 'yazar', name: 'Yazar', tier: 1, disc: 'oyn', aff: { oyn: 1.2, gfx: 1.0, ses: 1.0, tek: 1.0 }, debug: 1.0, hw: 0.5, req: [] },
    { id: 'tasarimci', name: 'Tasarımcı', tier: 1, disc: 'gfx', aff: { oyn: 1.2, gfx: 1.2, ses: 1.0, tek: 1.0 }, debug: 1.0, hw: 0.5, req: [] },
    { id: 'sesmuh', name: 'Ses Mühendisi', tier: 1, disc: 'ses', aff: { oyn: 1.2, gfx: 1.0, ses: 1.2, tek: 1.0 }, debug: 1.0, hw: 0.5, req: [] },
    { id: 'yonetmen', name: 'Yönetmen', tier: 2, disc: 'oyn', aff: { oyn: 1.4, gfx: 1.0, ses: 1.0, tek: 1.2 }, debug: 1.4, hw: 0.5, req: ['kodcu', 'yazar'] },
    { id: 'yapimci', name: 'Yapımcı', tier: 2, disc: 'gfx', aff: { oyn: 1.4, gfx: 1.4, ses: 1.4, tek: 1.0 }, debug: 1.0, hw: 0.5, req: ['tasarimci', 'sesmuh'] },
    { id: 'donanimci', name: 'Donanım Mühendisi', tier: 3, disc: 'tek', aff: { oyn: 1.4, gfx: 1.0, ses: 1.0, tek: 1.2 }, debug: 1.4, hw: 1.6, req: ['yonetmen', 'yapimci'] },
    { id: 'hacker', name: 'Hacker', tier: 4, disc: 'tek', aff: { oyn: 1.4, gfx: 1.4, ses: 1.4, tek: 1.4 }, debug: 1.4, hw: 0.3, req: ['donanimci'] },
  ],
  careerRules: {
    _tag: 'V/P',
    maxLevel: 5, salaryPerLevel: 1.2, // V
    rpPerLevel: [8, 16, 28, 45, 70], tierRpMult: [1, 1, 2, 3, 4], // P
    outPerLevel: 0.05, // P
    changeCost: 20000, // P (Kariyer Değiştirme Kılavuzu)
    founderCareer: { oyn: 'yazar', gfx: 'tasarimci', ses: 'sesmuh', tek: 'kodcu' },
    hireMaxLevel: 2,
  },

  // Dış çalışanlar (GDS outsourcing; fiyatlar V ×0,5 ölçek, kalite eğrisi P: q = (ücret/10K)^0,45)
  outsource: {
    _tag: 'V/P',
    feeScale: 500, qualityExp: 0.45, pointsPerQuality: 0.1, bugShare: 0.05,
    rows: [
      ['Kalemşor Kemal', 10, 'oyn', 1], ['Senarist Sevgi', 100, 'oyn', 1], ['Romancı Rıza', 350, 'oyn', 2], ['Ödüllü Ödül', 1000, 'oyn', 3], ['Hollywood Hüsnü', 2400, 'oyn', 4],
      ['Fırça Fikret', 10, 'gfx', 1], ['Piksel Pınar', 95, 'gfx', 1], ['Sprite Selim', 320, 'gfx', 2], ['Konsept Kader', 950, 'gfx', 3], ['Usta Ustaoğlu', 2050, 'gfx', 4],
      ['Bip Bülent', 10, 'ses', 1], ['Synth Sinan', 90, 'ses', 1], ['Orkestra Oya', 300, 'ses', 2], ['Bestekâr Bora', 1100, 'ses', 3], ['Maestro Melis', 2800, 'ses', 4],
      ['Stajyer Sarp', 10, 'tek', 1], ['Freelance Ferda', 100, 'tek', 1], ['Assembly Asım', 350, 'tek', 2], ['Çekirdek Cemre', 1000, 'tek', 3], ['Efsane Ertan', 2500, 'tek', 4],
    ],
  },

  // Yayın sonrası (MGT/GDT esinli, sayılar P)
  post: {
    _tag: 'P',
    patchCost: 12000, patchMax: 3, patchWeeksBack: 6, patchFansPct: 0.02,
    priceDropPct: 0.25, priceFloor: 5, priceDropWeeksBack: 2,
    portCostMult: 0.6, portScorePenalty: 3, portSales: 0.6, portHype: 10,
    expansionWeeks: 0.5, expansionCost: 0.4, expansionSales: 0.45, expansionMaxAgeWeeks: 96,
  },

  // Özel konsol (GDS, V parça ve bedelleri ×0,3 ölçek; yıllar, teknoloji ve satış P)
  console: {
    _tag: 'V/P',
    costScale: 0.3,
    types: [
      { id: 'konsol', name: 'Ev konsolu', cost: 6000000, genre: [10, 9, 10, 9, 8, 8], aud: [9, 10, 10] },
      { id: 'tasinabilir', name: 'Taşınabilir', cost: 4000000, genre: [8, 8, 9, 8, 7, 10], aud: [10, 10, 8] },
    ],
    cpus: [
      { id: 'b16', name: '16-bit çip', cost: 1000000, tech: 3, year: 1980 },
      { id: 'b32', name: '32-bit çip', cost: 10000000, tech: 5, year: 1993 },
      { id: 'b64', name: '64-bit çip', cost: 50000000, tech: 6, year: 1996 },
      { id: 'patates', name: 'Patates çip', cost: 90000000, tech: 7, year: 2005, hwEng: 4 },
    ],
    media: [
      { id: 'kartus', name: 'Kartuş', cost: 3000000, tech: 2, year: 1977 },
      { id: 'cd', name: 'CD-ROM', cost: 5000000, tech: 4, year: 1992 },
      { id: 'dvd', name: 'DVD-ROM', cost: 15000000, tech: 6, year: 1999 },
      { id: 'bd', name: 'BD-ROM', cost: 35000000, tech: 7, year: 2006 },
      { id: 'delikli', name: 'Delikli kart', cost: 93999900, tech: 7, year: 1976, hwEng: 6 },
    ],
    expectedTech: [[1977, 1], [1985, 2], [1990, 3], [1994, 4], [2000, 5], [2005, 6], [2013, 7]],
    pointsK: 1.2, phases: ['Prototip', 'Seri üretim'],
    fanLossWeeks: 12, fanLossPct: 0.03,
    B: 60000, decay: 0.985, qualityK: 0.25, qualityMin: 0.4, qualityMax: 1.6, ownGameBoost: 0.05,
    marginPerUnit: 15, licencePerMillion: 20000, ownDevCost: 5000, stopBelow: 200,
  },

  workstations: {
    _tag: 'P',
    tiers: [
      { tier: 0, name: 'İkinci el masaüstü', expectedFrom: 1976, maxTech: 2 },
      { tier: 1, name: 'Ofis bilgisayarı', expectedFrom: 1980, maxTech: 4 },
      { tier: 2, name: 'Çalışma istasyonu', expectedFrom: 1990, maxTech: 6 },
      { tier: 3, name: 'Sunucu destekli istasyon', expectedFrom: 2000, maxTech: 7 },
      { tier: 4, name: 'ArGe kümesi', expectedFrom: 2012, maxTech: 7 },
    ],
    step: 0.15, min: 0.7, max: 1.5, costSalaryMonths: 6,
  },

  economy: {
    _tag: 'P',
    inflation: 1.045, salaryPerSkill: 30, salaryJitter: [0.9, 1.25],
    hireFeeMonths: 1, severanceMonths: 1,
    creditBase: 30000, creditPerFan: 0.5, creditInflation: true,
    loanRateYear: 0.14, loanMonths: 24,
    bankruptWeeks: 12,
    raiseOnDemand: 0.12,
  },

  fans: { _tag: 'P', threshold: 60, perPointAbove: 400, lossBelow: 50, lossPerPoint: 300, scaleByMarket: true },
  ip: { _tag: 'L', waitWeeks: 48, max: 5, gainScoreRef: 70, gainK: 0.05, minGain: -0.5 },

  hype: {
    _tag: 'P',
    max: 100, decayAfterRelease: 4, decayDev: 0.3,
    campaigns: [
      { id: 'flyer', name: 'Fotokopi el ilanı', cost: 2000, hype: 6, research: null },
      { id: 'dergi', name: 'Dergi reklamı', cost: 15000, hype: 14, research: 'pazarlama_kucuk' },
      { id: 'tv', name: 'TV kampanyası', cost: 150000, hype: 35, research: 'pazarlama_buyuk' },
      { id: 'influencer', name: 'Influencer turu', cost: 90000, hype: 28, research: 'pazarlama_buyuk', minYear: 2010 },
    ],
  },

  contracts: {
    _tag: 'P',
    // GDS (V): süre 6–13 hafta, 1–2 kategori şartı, zor sözleşme daha çok öder ama daha çok ister,
    // başarı para + RP + itibar, başarısızlık ceza + itibar kaybı. Yük ve ödeme katsayıları P.
    weeksMin: 6, weeksMax: 13, offers: 3,
    rewardPerPoint: 260, penaltyShare: 0.6, twoDiscChance: 0.65,
    minLoadH: 0.05, // stüdyo kapasitesi bilinmezse alt sınır: H(y) × bu × hafta
    tiers: [
      { id: 'kolay', name: 'Kolay', load: 0.65, pay: 1.0, rep: 1, repLoss: 1, rp: 4 },
      { id: 'orta', name: 'Orta', load: 0.85, pay: 1.35, rep: 1, repLoss: 2, rp: 10 },
      { id: 'zor', name: 'Zor', load: 1.1, pay: 1.8, rep: 2, repLoss: 3, rp: 22 },
    ],
    clients: ['Belediye Bilgi İşlem', 'Kasap Mehmet Usta', 'Gizemli Holding', 'Tekstil Fabrikası', 'Okul Kantini Derneği', 'Kuzen Tuncay', 'Bakanlık (bir tanesi)', 'Halı Sahacı Cemil', 'Uzay Ajansı (hayal)'],
    jobs: ['muhasebe programı', 'reklam oyunu', 'eğitim yazılımı', 'menü otomasyonu', 'kiosk demosu', 'kurumsal ekran koruyucu', 'gizli bir şey (sormayın)'],
  },

  // GDT araştırma v tablosu (V) ve bizim kalemlerimiz (P).
  researchV: { _tag: 'V', rows: [[1, 10, 8, 20000, 10, 10000], [2, 15, 10, 40000, 15, 30000], [4, 40, 12, 120000, 30, 50000], [6, 80, 14, 180000, 40, 100000], [8, 100, 16, 400000, 80, 140000], [10, 150, 20, 600000, 120, 180000], [12, 250, 25, 1200000, 200, 350000], [14, 300, 30, 1600000, 300, 500000]] },
  research: [
    { id: 'alt_tur', name: 'Alt tür (çok türlü oyun)', rp: 15, cost: 4000, weeks: 3, year: 1976 },
    { id: 'tur_rpg', name: 'Tür: RPG', rp: 25, cost: 10000, weeks: 4, year: 1977 },
    { id: 'pazarlama_kucuk', name: 'Dergi reklamı', rp: 15, cost: 5000, weeks: 3, year: 1977 },
    { id: 'motor_ozel', name: 'Kendi motorunu yap', rp: 20, cost: 8000, weeks: 4, year: 1977 },
    { id: 'boyut_orta', name: 'Orta boy oyun', rp: 35, cost: 20000, weeks: 6, year: 1978 },
    { id: 'tur_sim', name: 'Tür: Simülasyon', rp: 40, cost: 15000, weeks: 6, year: 1980 },
    { id: 'oz_yayin', name: 'Kendi yayınını yap', rp: 60, cost: 40000, weeks: 8, year: 1980 },
    { id: 'tur_str', name: 'Tür: Strateji', rp: 40, cost: 15000, weeks: 6, year: 1981 },
    { id: 'kopya_koruma', name: 'Kopya koruması', rp: 40, cost: 20000, weeks: 6, year: 1981 },
    { id: 'motor_lisans', name: 'Motor lisanslama', rp: 50, cost: 30000, weeks: 6, year: 1983, requires: 'motor_ozel' },
    { id: 'pazarlama_buyuk', name: 'TV kampanyası', rp: 100, cost: 80000, weeks: 8, year: 1985 },
    { id: 'boyut_buyuk', name: 'Büyük oyun', rp: 120, cost: 120000, weeks: 10, year: 1985, requires: 'boyut_orta' },
    { id: 'boyut_aaa', name: 'AAA oyun', rp: 300, cost: 600000, weeks: 16, year: 1995, requires: 'boyut_buyuk' },
    { id: 'boyut_mmo', name: 'MMO', rp: 500, cost: 1000000, weeks: 20, year: 1998, requires: 'boyut_aaa' }, // L (500 RP)
    { id: 'oda_qa', name: 'Kalite güvence odası', rp: 30, cost: 20000, weeks: 4, year: 1979 },
    { id: 'oda_uzman', name: 'Uzman odalar (grafik, ses)', rp: 50, cost: 40000, weeks: 6, year: 1980 },
    { id: 'donanim_lab', name: 'Donanım laboratuvarı', rp: 800, cost: 5000000, weeks: 20, year: 1988 }, // L (GDT rehberi: 800 RP, 5M)
    { id: 'uzaktan', name: 'Uzaktan çalışma altyapısı', rp: 50, cost: 30000, weeks: 4, year: 2019 },
    // Motor özellikleri: v seviyesi → RP/süre/maliyet/motor puanı researchV'den gelir.
    { id: 'f_metin', name: 'Motor: Metin arayüzü', v: 1, year: 1976, engine: true },
    { id: 'f_sprite', name: 'Motor: 2D sprite', v: 2, year: 1977, engine: true },
    { id: 'f_renk', name: 'Motor: 16 renk', v: 2, year: 1978, engine: true },
    { id: 'f_kaydirma', name: 'Motor: Kaydırma', v: 4, year: 1980, engine: true },
    { id: 'f_sescip', name: 'Motor: Ses çipi', v: 4, year: 1982, engine: true },
    { id: 'f_kayit', name: 'Motor: Kayıt sistemi', v: 4, year: 1983, engine: true },
    { id: 'f_256', name: 'Motor: 256 renk', v: 6, year: 1987, engine: true },
    { id: 'f_3d', name: 'Motor: 3D grafik', v: 6, year: 1992, engine: true },
    { id: 'f_cd', name: 'Motor: CD ses', v: 8, year: 1994, engine: true },
    { id: 'f_fizik', name: 'Motor: Fizik', v: 8, year: 1998, engine: true },
    { id: 'f_online', name: 'Motor: Çevrimiçi', v: 10, year: 2000, engine: true },
    { id: 'f_shader', name: 'Motor: Gölgelendiriciler', v: 10, year: 2004, engine: true },
    { id: 'f_acik', name: 'Motor: Açık dünya akışı', v: 12, year: 2009, engine: true },
    { id: 'f_ray', name: 'Motor: Işın izleme', v: 14, year: 2019, engine: true },
    { id: 'f_ainpc', name: 'Motor: YZ destekli NPC', v: 14, year: 2023, engine: true },
  ],
  engine: {
    _tag: 'P',
    expected: [[1976, 0], [1978, 20], [1982, 50], [1986, 110], [1992, 200], [1998, 380], [2005, 600], [2012, 900], [2020, 1400], [2030, 2000]],
    factorBase: 0.85, factorK: 0.3, factorMin: 0.8, factorMax: 1.25, noEngine: 0.8,
    buildWeeksBase: 3, buildWeeksPerFeature: 1,
    licenceIncomePerPoint: 25, licenceMinRatio: 0.8,
  },

  training: [
    { id: 'kurs', name: 'Gece kursu', cost: 3000, weeks: 2, gain: 5 },
    { id: 'seminer', name: 'Uzman semineri', cost: 12000, weeks: 3, gain: 10 },
    { id: 'kamp', name: 'Kod kampı', cost: 35000, weeks: 4, gain: 16 },
  ],
  trainingRules: { _tag: 'P', diminish: 120, skillMax: 100, salaryRaisePerPoint: 0.006 },

  staffGen: {
    _tag: 'P',
    first: ['Ayşe', 'Mehmet', 'Zeynep', 'Can', 'Elif', 'Burak', 'Deniz', 'Ece', 'Kaan', 'Selin', 'Mert', 'Defne', 'Emre', 'Ceren', 'Onur', 'İpek', 'Barış', 'Nazlı', 'Tolga', 'Gizem', 'Ozan', 'Melis', 'Kerem', 'Aslı', 'Umut', 'Pelin', 'Arda', 'Damla', 'Serkan', 'Yağmur', 'Hakan', 'Bade', 'Efe', 'Su', 'Alp', 'Irmak'],
    last: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Öztürk', 'Aydın', 'Arslan', 'Doğan', 'Kılıç', 'Koç', 'Kurt', 'Polat', 'Aksoy', 'Bulut', 'Erdem', 'Tekin', 'Kalkan', 'Bitlik', 'Pikselci', 'Bugsever', 'Kodoğlu'],
    skillSpread: 12, applicantsBase: 3, applicantsPerTier: 1,
    specs: ['oyn', 'gfx', 'ses', 'tek'],
    hair: ['#3b2a20', '#8a4b2a', '#e8c26a', '#1d1d2b', '#c0392b', '#7b5ea7', '#2a6f97', '#f2f2f2'],
    skin: ['#f5d0b5', '#e0ac85', '#b9805a', '#8d5a3b', '#f1c27d'],
    shirt: { oyn: '#f28fb1', gfx: '#8fd3f2', ses: '#c3a6ff', tek: '#9be59b' },
  },
  traits: [
    { id: 'kafein', name: 'Kafein bağımlısı', out: 1.1, stress: 1.3 },
    { id: 'gecekusu', name: 'Gece kuşu', out: 1.05, moraleSelf: -0.5 },
    { id: 'drama', name: 'Drama kraliçesi', chaos: 3, moraleTeam: -0.3 },
    { id: 'deha', name: 'Sessiz deha', out: 1.15, quit: 1.8 },
    { id: 'iskolik', name: 'İşkolik', out: 1.2, stress: 1.5 },
    { id: 'toksik', name: 'Toksik', out: 1.1, moraleTeam: -1.2, chaos: 4 },
    { id: 'kedici', name: 'Ofise kedi getirir', moraleTeam: 0.8 },
    { id: 'hatamakinesi', name: 'Hata makinesi', bugs: 1.6 },
    { id: 'titiz', name: 'Titiz', bugs: 0.6, out: 0.9 },
    { id: 'sendikaci', name: 'Sendikacı', chaos: 2, union: true },
    { id: 'neseli', name: 'Neşe kaynağı', moraleTeam: 0.6, stress: 0.8 },
    { id: 'evrak', name: 'Evrak canavarı', out: 0.95, stress: 0.7 },
  ],
  traitChance: 0.6,

  wellbeing: {
    _tag: 'P',
    stressWork: 1.0, stressIdle: -4, stressRest: -8, stressCrunch: 5.5, stressPerExtraStaff: 0.03,
    burnoutAt: 85, burnoutChance: 0.07, burnoutWeeks: [3, 8],
    quitStress: 95, quitMoraleBelow: 22, quitChance: 0.04,
    moraleStressK: 0.06, moraleTarget: 70, moraleRecovery: 0.04, moraleUnderpaidK: 0.5,
    sickChance: 0.004, sickWeeks: [1, 3],
    poachBase: 0.0006, poachSkillK: 0.00003,
  },

  chaos: {
    _tag: 'P',
    eventScaleBase: 0.2, eventScalePerStaff: 0.12, eventScaleMin: 0.3, eventScaleMax: 5,
    base: 5, perStaff: 0.55, perYear: 0.55, crunch: 15, debt: 12, stressK: 0.18, heatDecay: 1.2, max: 100,
    eventBase: 36, eventRand: 48, eventKaosDiv: 45, eventMinGap: 8, // V (36+48r) / P (kaosla sıklaşma)
    visualThresholds: [30, 55, 80],
  },

  fair: { _tag: 'L', month: 7, week: 1, boothCost: 25000, hype: 20, fans: 3000 },
  awards: { _tag: 'P', month: 12, week: 1, goty: { prestige: 1, fans: 15000, cash: 50000 }, worstBelow: 40, worst: { fans: -5000, morale: -10 } },
  trends: { _tag: 'P', minWeeks: 24, maxWeeks: 48 },

  rivals: {
    _tag: 'P',
    names: ['Kodzilla Games', 'Pikselhane', 'Bit Kafe Stüdyo', 'Ejderha Yazılım', 'Mavi Kutu Interactive', 'Gece Kuşu Oyun', 'Kuantum Patates', 'Sarı Ördek Labs'],
    count: 8, repRange: [30, 70], releaseWeeks: [14, 40], scoreSpread: 9, scoreBias: 4, repScoreK: 0.72,
    acquireMin: 2000000, acquireYears: 8, monthlyCostShare: 0.004, profitPerRep: 12000,
    // Rakip oyun satışı (MGT satış listesi için, P): stüdyo gücü ve nota göre zirve, oyuncuyla aynı hafta eğrisi
    salesPeakK: 0.7, sizePick: [0.55, 1.0, 1.7], topN: 10, rankHistMax: 104,
    gameNamesA: ['Süper', 'Mega', 'Karanlık', 'Neon', 'Ölümsüz', 'Küçük', 'Kayıp', 'Çılgın', 'Son', 'Gizli'],
    gameNamesB: ['Macera', 'Savaşçı', 'Krallık', 'Galaksi', 'Rüya', 'Ejderha', 'Robot', 'Şehir', 'Labirent', 'Efsane'],
  },

  score: { _tag: 'P', cashDiv: 100000, fansDiv: 10000, gameScoreDiv: 10, prestigeMult: 50 },

  // Tarihî makro olaylar (tablo yılına göre). salesMult etkisi süre boyunca tüm satışlara uygulanır. P (tarih: gerçek olaylardan esinli)
  eras: [
    { id: 'crash83', year: 1983.4, weeks: 96, salesMult: 0.45, title: '1983 Video Oyunu Çöküşü', text: 'Raflar kötü oyunlarla doldu, mağazalar kartuşları çöpe gömüyor. Pazar yarı yarıya çöktü.', kaos: 15 },
    { id: 'satanist', year: 1985, weeks: 40, salesMult: 0.95, title: 'Ahlak Paniği', text: 'Sabah programları RPG oyunlarının gençleri "karanlığa" sürüklediğini iddia ediyor. Tuhaf ama hype artıyor.', hype: 10, kaos: 6 },
    { id: 'senato', year: 1993.9, weeks: 48, salesMult: 0.92, title: 'Şiddet Oturumları', text: 'Meclis video oyunlarındaki şiddeti tartışıyor. Yaş derecelendirmesi kapıda.', kaos: 8 },
    { id: 'dotcom', year: 2000.3, weeks: 72, salesMult: 0.8, title: 'Dot-com Balonu Patladı', text: 'Yatırımcılar kaçıyor, kredi musluğu kapandı.', kaos: 12, creditMult: 0.5 },
    { id: 'kriz08', year: 2008.7, weeks: 96, salesMult: 0.75, title: 'Küresel Finans Krizi', text: 'Bankalar batıyor. Herkes bütçeyi kısıyor ama ucuz oyunlara rağbet var.', kaos: 15, creditMult: 0.4 },
    { id: 'f2p', year: 2012, weeks: 120, salesMult: 1.1, title: 'Mobil Altına Hücum', text: 'Herkesin cebinde bir oyun makinesi var. Pazar patlıyor, kalite tartışılıyor.', kaos: 5 },
    { id: 'lootbox', year: 2017.8, weeks: 60, salesMult: 0.95, title: 'Ganimet Kutusu Skandalı', text: 'Bir yayıncının ganimet kutuları ülkeleri ayağa kaldırdı. Regülasyon geliyor.', kaos: 10, flag: 'lootboxBan' },
    { id: 'pandemi', year: 2020.2, weeks: 96, salesMult: 1.35, title: 'Pandemi', text: 'Herkes evde. Oyun satışları patlıyor ama ofis boş, ekip dağınık.', kaos: 20, flag: 'pandemic', prodMult: 0.85 },
    { id: 'layoffs', year: 2023, weeks: 72, salesMult: 0.9, title: 'Büyük İşten Çıkarma Dalgası', text: 'Sektör devleri binlerce kişiyi kapı dışarı ediyor. Yatırımcılar "verimlilik" diye bağırıyor.', kaos: 18 },
    { id: 'aihype', year: 2023.5, weeks: 120, salesMult: 1.0, title: 'Yapay Zekâ Furyası', text: 'Herkes YZ ile oyun yapacağını söylüyor. Çalışanlar tedirgin.', kaos: 12, flag: 'aiHype' },
  ],

  // Olaylar: koşullar ve etkiler tamamen veri. Kod yalnızca yorumlar.
  // Etki anahtarları: cash (enflasyonla ölçeklenir), cashPct, morale, stress, hype, fans, fansPct, prestige, kaos,
  //   quit, sick, progress (hafta), bugsPct, salesMult{mult,weeks}, salaryPct, rentPct, rp, skill, flag, unflag,
  //   poach, chance{p, yes, no}, news
  events: [
    { id: 'aile', title: 'Aile Telefonu', text: 'Annen arıyor: "Oğlum/kızım bu bilgisayar işi ne zaman para getirecek? Kuzenin bankada müdür oldu."', when: { officeTier: 1, hasProject: true }, maxTriggers: 1,
      choices: [{ label: 'Gece boyu çalış, kanıtla!', effects: { progress: 1, stress: 15, hype: 5 } }, { label: 'Sınava girerim deyip kapat', effects: { morale: -5 } }, { label: 'Borç iste', effects: { cash: 3000, morale: -10 } }] },
    { id: 'kahve', title: 'Kahve Makinesi Patladı', text: 'Ofisin kalbi durdu. Biri ağlıyor, biri makineyi tamire çalışıyor ve elektrik çarpıyor.', when: { minStaff: 2 },
      choices: [{ label: 'Endüstriyel espresso al', effects: { cash: -4000, morale: 8 } }, { label: 'Çay demleriz', effects: { morale: -8, stress: 5 } }] },
    { id: 'kedi', title: 'Ofise Bir Kedi Girdi', text: 'Turuncu, şişman ve klavyenin üstüne yatıyor. Ekip ona "Kernel" adını verdi.', when: { minStaff: 1 }, maxTriggers: 1,
      choices: [{ label: 'Kernel artık çalışan', effects: { morale: 12, stress: -10, bugsPct: 0.03, flag: 'kedi' } }, { label: 'Kapıya koy', effects: { morale: -12 } }] },
    { id: 'troll', title: 'Patent Trolü', text: '"Ekranın kayması" fikrinin patentini aldığını iddia eden bir şirket dava açtı.', when: { minYear: 1981, hasReleased: true },
      choices: [{ label: 'Uzlaş, öde', effects: { cash: -25000 } }, { label: 'Mahkemede gör beni', effects: { chance: { p: 0.5, yes: { news: 'Davayı kazandın! Avukatlar yine de pahalıydı.', cash: -8000, prestige: 0.3 }, no: { news: 'Davayı kaybettin. Tazminat ağır.', cash: -90000, morale: -10 } } } }] },
    { id: 'sizinti', title: 'Oyun Sızdırıldı', text: 'Bir test sürümü forumlara düştü. Herkes konuşuyor; bir kısmı bedavaya oynuyor.', when: { hasProject: true, minYear: 1995 },
      choices: [{ label: 'Bunu pazarlamaya çevir', effects: { hype: 20, salesMult: { mult: 0.9, weeks: 12 } } }, { label: 'Avukatları sal', effects: { cash: -15000, hype: -5, kaos: 5 } }] },
    { id: 'korsan', title: 'Korsan Kopyalar', text: 'Pazar tezgâhlarında oyununun kopyaları 1 liraya satılıyor. Kapakta yanlış yazılmış adın bile var.', when: { hasReleased: true, noResearch: 'kopya_koruma' },
      choices: [{ label: 'Of...', effects: { salesMult: { mult: 0.7, weeks: 10 }, morale: -5 } }] },
    { id: 'bomba', title: 'İnceleme Bombardımanı', text: 'Son oyunun bir karakterinin saç rengi yüzünden binlerce sıfır puan geldi.', when: { minYear: 2008, hasReleased: true },
      choices: [{ label: 'Açıklama yap', effects: { chance: { p: 0.5, yes: { fansPct: 0.03, news: 'Açıklama tuttu, hayranlar arkanda.' }, no: { fansPct: -0.08, kaos: 8, news: 'Açıklama yangına benzin döktü.' } } } }, { label: 'Sessiz kal', effects: { fansPct: -0.04, morale: -6 } }] },
    { id: 'taciz', title: 'Toksik Hayranlar', text: 'Bir grup "hayran", ekibindeki bir sanatçıyı internette hedef aldı. Sanatçı ağlayarak ofisten çıktı.', when: { minYear: 2005, minStaff: 3, minFans: 20000 },
      choices: [{ label: 'Çalışanını koru, hesapları engelle', effects: { morale: 10, fansPct: -0.03, cash: -5000 } }, { label: 'Görmezden gel', effects: { morale: -18, quit: 1, kaos: 6 } }] },
    { id: 'tweet', title: 'Gece 03.00 Paylaşımı', text: 'Uykusuz bir anında rakip stüdyoyu "piksel hırsızları" diye andın. Paylaşım viral oldu.', when: { minYear: 2008 },
      choices: [{ label: 'Arkasında dur', effects: { hype: 25, prestige: -0.5, kaos: 10 } }, { label: 'Sil ve özür dile', effects: { hype: -5, morale: -3 } }] },
    { id: 'vergi', title: 'Vergi Denetimi', text: 'Takım elbiseli iki kişi kapıda. "Fişleriniz nerede?"', when: { minYear: 1978, minCash: 50000 },
      choices: [{ label: 'Ceza öde', effects: { cashPct: -0.08 } }, { label: 'Muhasebeciyi suçla', effects: { chance: { p: 0.4, yes: { cashPct: -0.02 }, no: { cashPct: -0.14, kaos: 5 } } } }] },
    { id: 'kira', title: 'Ev Sahibi Uyanıklığı', text: 'Ev sahibi kirayı artırıyor: "Piyasa böyle, istemeyen çıkar."', when: { minYear: 1979 },
      choices: [{ label: 'Kabul', effects: { rentPct: 0.25 } }, { label: 'Pazarlık et', effects: { chance: { p: 0.5, yes: { rentPct: 0.08 }, no: { rentPct: 0.4, morale: -4 } } } }] },
    { id: 'sel', title: 'Su Baskını', text: 'Üst kattaki komşunun çamaşır makinesi patladı. Masalarında akvaryum var.', when: { minYear: 1978 },
      choices: [{ label: 'Tamir ettir', effects: { cash: -12000, progress: -1 } }, { label: 'Kovalarla idare et', effects: { progress: -2, stress: 10, sick: 1 } }] },
    { id: 'elektrik', title: 'Elektrik Kesintisi', text: 'Kayıt almadan çalışan biri vardı. Hep biri vardır.', when: { hasProject: true },
      choices: [{ label: 'Kayıp hafta', effects: { progress: -1, morale: -4 } }] },
    { id: 'sunucu', title: 'Sunucular Çöktü', text: 'MMO sunucuların 3 gündür kapalı. Forumlar yanıyor.', when: { hasMmo: true },
      choices: [{ label: 'Acil donanım al', effects: { cash: -60000, fansPct: -0.02 } }, { label: 'Bekle, düzelir', effects: { fansPct: -0.08, kaos: 8 } }] },
    { id: 'veri', title: 'Veri İhlali', text: 'Hayran kulübü veritabanın sızdırıldı. Şifreler düz metindi. Neden?', when: { minYear: 2005, minFans: 30000 },
      choices: [{ label: 'Açıkla ve tazminat öde', effects: { cash: -40000, fansPct: -0.03 } }, { label: 'Örtbas et', effects: { chance: { p: 0.4, yes: { news: 'Kimse fark etmedi... şimdilik.' }, no: { cash: -150000, fansPct: -0.15, prestige: -1, kaos: 15, news: 'Örtbas ortaya çıktı. Manşetlerdesin.' } } } }] },
    { id: 'sendika', title: 'Sendika Talebi', text: 'Ekip toplu sözleşme istiyor: fazla mesai ücreti, crunch yasağı.', when: { minStaff: 12, minYear: 1995 },
      choices: [{ label: 'Kabul et', effects: { salaryPct: 0.1, morale: 20, flag: 'union' } }, { label: 'Reddet', effects: { morale: -25, progress: -2, kaos: 12, quit: 1 } }] },
    { id: 'sendika2', title: 'Sendikacı Çalışan', text: 'Ekibindeki sendikacı, kafeteryada bildiri dağıtıyor.', when: { trait: 'sendikaci', minStaff: 5 },
      choices: [{ label: 'Masaya otur', effects: { salaryPct: 0.05, morale: 10 } }, { label: 'Onu kovmak için bahane ara', effects: { morale: -15, kaos: 10, fireTrait: 'sendikaci', cash: -20000 } }] },
    { id: 'yatirimci', title: 'Yatırımcı Baskısı', text: 'Kredi verdiğin banka danışmanı: "Oyuna ganimet kutusu ekleyin, rakamlar öyle diyor."', when: { hasLoan: true, minYear: 2008, hasProject: true, notFlag: 'lootboxBan' },
      choices: [{ label: 'Ekle', effects: { salesMult: { mult: 1.3, weeks: 20 }, fansPct: -0.06, flag: 'lootbox', kaos: 8 } }, { label: 'Asla', effects: { morale: 6, fansPct: 0.01 } }] },
    { id: 'yayinci_batti', title: 'Yayıncı İflas Etti', text: 'Yayıncın batmış. Telif ödemeleri buhar oldu.', when: { hasPublisherGame: true },
      choices: [{ label: 'Lanet olsun', effects: { salesMult: { mult: 0.5, weeks: 8 }, morale: -8 } }] },
    { id: 'zimmet', title: 'Kasa Açığı', text: 'Muhasebe defterinde "pizza" diye geçen 40 kalem var. Pizza değilmiş.', when: { minStaff: 8, minCash: 100000 },
      choices: [{ label: 'Polise git', effects: { cashPct: -0.05, morale: -5, quit: 1 } }, { label: 'Sessizce kov', effects: { cashPct: -0.08, quit: 1 } }] },
    { id: 'kodsil', title: 'Öfkeli Ayrılış', text: 'Kovulmaktan korkan bir çalışan son commit\'inde ana dalı sildi ve ayrıldı.', when: { minStaff: 5, hasProject: true, maxMorale: 45 },
      choices: [{ label: 'Yedekten dön', effects: { progress: -3, quit: 1, morale: -6 } }] },
    { id: 'yayinci_ovgu', title: 'Ünlü Yayıncı Övdü', text: 'Popüler bir yayıncı canlı yayında oyununu 6 saat oynadı ve ağladı.', when: { minYear: 2011, hasReleased: true },
      choices: [{ label: 'Harika!', effects: { salesMult: { mult: 1.5, weeks: 6 }, fans: 8000 } }] },
    { id: 'yayinci_gom', title: 'Ünlü Yayıncı Gömdü', text: 'Popüler bir yayıncı oyununu açtı, 4 dakika oynadı ve "çöp" dedi.', when: { minYear: 2011, hasReleased: true },
      choices: [{ label: 'Of...', effects: { salesMult: { mult: 0.7, weeks: 6 }, morale: -6 } }] },
    { id: 'klon', title: 'Klonlandın', text: 'Bir rakip son oyununun birebir kopyasını yarı fiyatına çıkardı.', when: { hasReleased: true, minYear: 1982 },
      choices: [{ label: 'Dava aç', effects: { cash: -20000, chance: { p: 0.45, yes: { cash: 60000, news: 'Klon toplatıldı, tazminat aldın.' }, no: { news: 'Mahkeme "fikirler korunmaz" dedi.' } } } }, { label: 'Daha iyisini yaparız', effects: { morale: 5, hype: 5 } }] },
    { id: 'nft', title: 'NFT Danışmanı', text: 'Parlak ayakkabılı biri oyununu "blokzincire taşımayı" öneriyor. Gözleri garip parlıyor.', when: { minYear: 2021, maxYear: 2023 },
      choices: [{ label: 'Yatırım yap', effects: { cash: -50000, chance: { p: 0.3, yes: { cash: 220000, news: 'Bir koleksiyoncu çılgına döndü, para yağdı.' }, no: { fansPct: -0.12, kaos: 12, news: 'Hayranlar ayaklandı, token çöptü.' } } } }, { label: 'Kapıyı göster', effects: { morale: 4 } }] },
    { id: 'yzsanat', title: 'YZ ile Sanatçı Değiştirme', text: 'Yönetim kurulu "grafik ekibini YZ ile değiştirelim" diyor.', when: { flag: 'aiHype', minStaff: 6 },
      choices: [{ label: 'Değiştir', effects: { fireSpec: 'gfx', fansPct: -0.1, morale: -25, kaos: 15 } }, { label: 'Ekibe dokunma', effects: { morale: 12 } }] },
    { id: 'salgin', title: 'Ofis Gribi', text: 'Biri hasta hasta işe geldi. Şimdi herkes hasta.', when: { minStaff: 4 },
      choices: [{ label: 'Herkesi eve gönder', effects: { progress: -1, stress: -10 } }, { label: 'Maske dağıt, devam', effects: { sick: 3, stress: 8 } }] },
    { id: 'hackathon', title: 'Hafta Sonu Hackathon', text: 'Ekip bir hafta sonu hackathon önerdi. Pizza senden.', when: { minStaff: 3 },
      choices: [{ label: 'Tamam!', effects: { cash: -3000, rp: 20, morale: 6, stress: 6 } }, { label: 'Hafta sonu dinlenin', effects: { stress: -8 } }] },
    { id: 'tesvik', title: 'Devlet Teşviki', text: 'Kültür bakanlığı yerli oyun stüdyolarına hibe veriyor.', when: { minYear: 1990 },
      choices: [{ label: 'Başvur', effects: { chance: { p: 0.5, yes: { cash: 80000, news: 'Hibe çıktı!' }, no: { news: 'Formun 47. sayfasında imza eksik dediler.' } } } }] },
    { id: 'kitap', title: 'İfşa Kitabı', text: 'Eski bir çalışanın "Piksellerin Arkasındaki Cehennem" adlı kitabı çok satanlarda.', when: { minStaff: 6, minKaos: 40 },
      choices: [{ label: 'Yorum yok', effects: { fansPct: -0.05, prestige: -0.5, kaos: 8 } }, { label: 'Çalışma koşullarını düzelt', effects: { cash: -30000, morale: 15, stress: -15 } }] },
    { id: 'crunch_basin', title: 'Crunch Haberi', text: 'Bir gazeteci stüdyondaki 80 saatlik haftaları yazdı. Fotoğrafta uyuyan biri var. Masanın altında.', when: { crunch: true, minYear: 2004 },
      choices: [{ label: 'Crunch\'ı bitir', effects: { endCrunch: true, morale: 10, fansPct: -0.02 } }, { label: '"Tutkulu ekip"', effects: { fansPct: -0.08, prestige: -1, kaos: 15 } }] },
    { id: 'yangin', title: 'Ofiste Yangın', text: 'Biri sunucu odasında tost yaptı. Tost makinesi değil, sunucu.', when: { minStaff: 6, minKaos: 50 },
      choices: [{ label: 'Sigorta dosyası aç', effects: { cash: -60000, progress: -3, stationDown: true } }] },
    { id: 'transfer', title: 'Transfer Teklifi', text: 'Bir rakip stüdyo en iyi çalışanına iki katı maaş teklif etti.', when: { minStaff: 3 },
      choices: [{ label: 'Maaşını %30 artır', effects: { topRaise: 0.3 } }, { label: 'Gitsin', effects: { poach: true, morale: -6 } }] },
    { id: 'odul_gaf', title: 'Tören Gafı', text: 'Ödül töreninde mikrofona yanlış oyunun adını söyledin. Kendi oyununun.', when: { minYear: 1990, hasReleased: true },
      choices: [{ label: 'Gül geç', effects: { hype: 8, prestige: -0.2 } }] },
    { id: 'ahlak', title: 'Ahlak Bekçileri', text: 'Bir dernek oyununun "ruhları zehirlediğini" söyleyip boykot başlattı.', when: { minYear: 1984, hasReleased: true },
      choices: [{ label: 'Tartışmaya gir', effects: { hype: 15, fansPct: 0.02, kaos: 6 } }, { label: 'Sansürlü sürüm çıkar', effects: { cash: -10000, fansPct: -0.04 } }] },
    { id: 'tukenmis_lider', title: 'Kurucu Tükenmişliği', text: 'Aynaya baktın. Göz altların piksel piksel morardı.', when: { minKaos: 60 },
      choices: [{ label: 'Bir hafta tatil', effects: { progress: -1, stress: -20, morale: 5 } }, { label: 'Kahve, daha çok kahve', effects: { stress: 15, kaos: 5 } }] },
    { id: 'maas_gecik', title: 'Maaşlar Gecikti', text: 'Bu ay maaşlar 10 gün gecikti. Slack kanalı alev alev.', when: { maxCash: 0, minStaff: 2 },
      choices: [{ label: 'Özür dile ve söz ver', effects: { morale: -15, stress: 10 } }, { label: 'Kendi arabanı sat', effects: { cash: 15000, morale: 5 } }] },
    { id: 'yatirim_teklif', title: 'Melek Yatırımcı', text: 'Bir yatırımcı %20 hisse karşılığında para teklif ediyor. "Büyüme, büyüme, büyüme."', when: { minYear: 1995, minStaff: 4 }, maxTriggers: 2,
      choices: [{ label: 'Al', effects: { cash: 400000, kaos: 10, flag: 'investor' } }, { label: 'Bağımsız kal', effects: { morale: 5 } }] },
    { id: 'yatirimci_baski2', title: 'Yatırımcı Toplantısı', text: '"Çeyreklik büyüme hedefini tutturamadınız. Kadro %20 küçülecek."', when: { flag: 'investor', minStaff: 6 },
      choices: [{ label: 'İşten çıkar', effects: { layoffPct: 0.2, morale: -25, kaos: 15 } }, { label: 'Kendi maaşını kes, direnin', effects: { cashPct: -0.1, morale: 10 } }] },
  ],
};
