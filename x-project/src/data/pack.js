// X Project — içerik paketi.
// Kural: kod kural taşır, veri sayı taşır. Her blok _tag ile kaynağını söyler:
//   V = doğrulanmış (PDF), L = sınırlı (oyuncu/rehber), P = bizim önerimiz / kalibrasyon.

import { REGIONS, OWNER_BIAS } from './regions.js';
import { GENRES } from './genres.js';

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
    { id: 'cok_kolay', name: 'Çok kolay', D: 0.7, Z: 0.5, ipD: 0.70, startCash: 300000 },
    { id: 'kolay', name: 'Kolay', D: 1.0, Z: 0.3, ipD: 0.45, startCash: 200000 },
    { id: 'orta', name: 'Orta', D: 1.5, Z: 0.25, ipD: 0.38, startCash: 120000 },
    { id: 'zor', name: 'Zor', D: 1.8, Z: 0.2, ipD: 0.36, startCash: 80000 },
    { id: 'cok_zor', name: 'Çok zor', D: 2.2, Z: 0.16, ipD: 0.34, startCash: 60000 },
    { id: 'efsanevi', name: 'Efsanevi', D: 3.0, Z: 0.13, ipD: 0.30, startCash: 45000 },
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

  // Konu D: tür sistemi (P). Kademeler, alt türler ve sözler data/genres.js'te.
  genreSys: {
    _tag: 'P',
    startXp: 40, researchXp: 20, xpCap: 100,
    gain: { kucuk: 8, orta: 12, buyuk: 16, aaa: 20, mmo: 20 }, gainScoreA: 0.5, gainDecay: 110, crossShare: 0.4,
    rustYears: 8, rustPerYear: 1, rustFloor: 20,
    nearDiscount: 0.7,
    // Yaşam döngüsü: yükselen → altın çağ → doygun → niş; balon türler çöker; retro dalgası eski türleri kurtarır
    life: { rise: 0.03, peak: 1.05, satFrom: 1.0, satTo: 0.9, satYears: 5, niche: 0.85, crash: 0.6, retro: [2014, 2022], retroBorn: 1990, retroK: 1.0 },
    legend: { hype: 20, fans: 0.05, copyYears: 2 },
    cult: { chance: 0.03, score: 10, fans: 0.02, earlyK: 3 },
    invent: { yearsEarly: 6, minXp: 60, rpBase: 40, rpPerYear: 15, cost: 20000, costPerYear: 10000, weeks: 6, hype: 15, fans: 0.03, misfire: 0.3, misfireK: 0.8 },
    staff: { likeK: 1.03, dislikeK: 0.94, likeMorale: 1, dislikeMorale: -1, likeTwo: 0.25, dislikeChance: 0.33, exp1: 3, exp1K: 1.02, exp2: 6, exp2K: 1.03 },
    idea: { monthly: 0.02, morale: 10 },
    focus: { share: 0.03, min: 1000 },
    guide: { count: 3 },
    pubXpK: 3, // yayıncı kurulu: uzman stüdyo +3, acemi −3
  },

  production: {
    _tag: 'P',
    K: 0.784,
    skillStart: 35, skillPerYear: 2.7, skillCap: 75,
    etaFree: 10, etaLoss: 0.015, etaFloor: 0.7,
    mCurve: [[1976, 1.0], [1980, 1.65], [1985, 2.4], [1990, 2.9], [1995, 3.4], [2000, 3.85], [2005, 4.2], [2010, 4.6], [2020, 6.2]], // 1985–2010 araç ve yöntem iyileşmesi; hedef eğrisinin koşu bandını yumuşatır (P)
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
    // Kopya başı fiziksel maliyet çarpanı (kutu, disk, kartuş): mobilde yok; dijital dağıtım yaygınlaştıkça düşer (P)
    unitCostK: { mobil: [[1976, 0], [2030, 0]], pc: [[1976, 1], [2004, 1], [2010, 0.25], [2020, 0.1]], konsol: [[1976, 1], [2008, 1], [2015, 0.6], [2022, 0.35]], el: [[1976, 1], [2011, 1], [2018, 0.5]] },
    _tag: 'P',
    // PDF: B 57000, Pz 0,02→1→8. Bu uygulamada stüdyo çarpanları (Y·St·I) erken dönemi zaten ~×0,1'e indirdiği için
    // yeniden kalibre edildi: garaj 1977 iyi oyun ≈ 300/hafta, 1992 yerleşik hit ≈ 40 bin/hafta (P).
    B: 145000,
    pzCurve: [[1976, 0.5], [1985, 0.7], [1992, 1], [2025, 8]],
    sA: 0.09, sCenter: 90, sCut: 60, sLow: -2.7, sLowK: 0.2,
    fanRef: 10000, fanK: 0.5, hypeK: 0.15,
    priceRef: 35, priceExp: 1.5,
    yA: 0.15, yB: 0.85, stA: 0.3, stB: 0.7, stCap: 5, iA: 0.5, iB: 0.5, ipK: 0.2,
    curve: [0.6, 0.85, 1.0], tailA: 0.85, tailB: 0.95, tailBPirated: 0.91, stopAt: 0.02,
    capShare: 0.35, // V/P pazar tavanı
    sequelOverlapMult: 0.8, trendMult: 1.25, overusedMult: 0.85, // mevsim ve rekabet: charts
    selfPublishPowerBase: 10, selfPublishFansPerPower: 3500, selfPublishPowerCap: 95,
    selfA: 0.05, selfB: 0.95, selfExp: 1.5, pubReach: 1.4, // kendi yayınının erişimi: 0,05 + 0,95 × (güç/100)^üs; yayıncının dağıtım gücü çarpanı (Konu B)
    retailCut: 0.45, unitCost: 2,
  },

  // Satış listesi ve pazar dinamiği (Konu A, P). Yayılma (Bass) eğrisi: p merak, q ağızdan ağıza.
  // lifeWeeks: ömür boyu satış, zirve haftası cinsinden (eski tek eğrinin toplamı: 19,07; korsanlıkta 11,68).
  charts: {
    _tag: 'P',
    diffusion: {
      pBase: 0.008, pHype: 0.07, pPub: 0.025, pIp: 0.03, pFans: 0.015, pMin: 0.004, pMax: 0.3,
      qBase: 0.03, qScore: 0.3, qScoreFrom: 40, qScoreSpan: 55, qBug: 1.5, qBugMax: 0.4, qSocial: { casual: 0.03 }, qMin: 0.02, qMax: 0.42,
      piracyQ: 0.85, lifeWeeks: 19.07, lifeWeeksPirated: 11.68, kickDecay: 0.75, reviveWeek: 0.025, reviveKick: 0.02,
      ageWeeks: 110, ageWeeksDigital: 200, stopAt: 0.02, stopDigitalK: 0.25, minWeeks: 4,
      rivalP: [0.03, 0.12], histP: [0.1, 0.2],
    },
    season: [0.8, 0.8, 0.9, 0.85, 0.85, 0.9, 0.85, 0.9, 1.0, 1.1, 1.45, 1.7], // Oca..Ara, ortalama ≈ 1
    seasonTopic: { spor: [8, 1.15], korku: [9, 1.15] }, // [ay indeksi, çarpan]
    rivalSeasonK: 0.5, // sakin aylarda rakibin çıkışı erteleme olasılığı ölçeği
    competition: { segW: 0.7, allW: 0.3, min: 0.55, max: 1.35, ema: 0.02 },
    filler: [[1976, 40], [1980, 120], [1983, 400], [1985, 150], [1990, 500], [1995, 900], [2000, 1200], [2005, 1500], [2010, 4000], [2015, 10000], [2020, 20000], [2025, 30000]],
    rivalScale: 2.5, // rakiplerin liste satışı ölçeği (yalnız sırayı etkiler; oyuncunun gelirini değiştirmez)
    zipf: 1.0, fillerAnchor: 2, fillerTopK: 0.95, discoverRef: 2000, discoverExp: 0.3, // en iyi dolgu oyun ≈ 3. rakip kadar satar; k'ıncı dolgu bunun 1/k'sı
    visibility: [[1, 1.25], [3, 1.15], [10, 1.08]], showcase: { rank: 20, mult: 1.15 },
    digitalYear: 2008,
    shelf: { size: [[1976, 40], [1980, 80], [1985, 120], [1990, 250], [2000, 500], [2007, 700]], missWeeks: 4, offMult: 0.7, fee: 1500, budgetPrice: 0.5, budgetRevive: 0.1, budgetKick: 0.04, budgetCost: 4000, budgetMinWeeks: 30 },
    festival: { months: [5, 11], minWeeks: 26, price: 0.6, weeks: 2, revive: 0.08, kick: 0.05 },
    bulk: { share: 0.5, minCopies: 100, costK: 0.6, scandal: 0.15, scandalFans: 0.05, scandalKaos: 8, maxWeeks: 2 },
    cover: { cost: 12000, weeks: 4, mult: 1.3, scandal: 0.1, scandalFans: 0.02, scandalKaos: 4 },
    print: { runs: { temkinli: 4, normal: 8, cesur: 16 }, reprintWeeks: 4, delay: 2, lostShare: 0.3, sellOutKick: 0.02 },
    announce: { options: [8, 12, 24], hypePerWeek: 0.5, hypeCap: 15, missFans: 0.03, missKaos: 3, dodge: 0.5, dodgeWeeks: 3 },
    calendar: { aheadMonths: 3, slip: 0.25, slipMonths: [1, 2], slipNotice: 2, slipTopRanks: 5 },
    rewards: {
      // fansOfUnits: o ana kadar satılan kopyaların bu kadarı hayrana dönüşür (yüzde değil, birikmez)
      top40: { morale: 3 }, top10: { fansOfUnits: 0.008, morale: 5, pubRel: 5, memo: '"#" ilk 10\'a girdi' }, no1: { fansOfUnits: 0.015, hypeBank: 10, pubRel: 5, memo: '"#" listenin zirvesine çıktı' }, genre1: { fansOfUnits: 0.004, genreRep: 5 },
      classicRun: 10, classicQ: 0.03, yearTop: { prestige: 0.5 }, allTime: { ip: 0.1 },
    },
    lists: { top: 10, show: 40, playDecay: 0.94, allTimeMax: 100 },
  },

  // Oyun boyutları. weeks/target/sales: P · MGT2 boyut cezası: V
  sizes: [
    // Mini (P): shareware, bağımsız ya da mobil ölçekli iş. Küçük ekiplerin koşu bandından düştüğünde toparlanma yolu.
    { id: 'mini', name: 'Mini', mgt: 'C', weeks: 6, target: 0.14, sales: 0.22, research: null, office: 1, devCost: 0.12 },
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

  // Türler (Konu D): 13 ana tür data/genres.js'te. İlk altısı eski türler; platform/bölge dizileri bu altı eksene göre.
  // disc = w_d (V ağırlık, P türetme). hint = GDT kaydırıcı önerisi (L), mission = GDT görev ağırlıkları (V).
  genres: GENRES,

  // Konular: [id, ad, tür ağırlıkları ×10 (aks,mac,rpg,sim,str,cas), kitle ×10 (genç,herkes,yetişkin), açılış yılı]. P (GDT ölçeği V)
  topics: [
    ['uzay', 'Uzay', [10, 9, 8, 9, 8, 7], [10, 10, 8], 1976],
    ['fantezi', 'Fantezi', [8, 10, 10, 6, 9, 7], [9, 9, 10], 1976],
    ['spor', 'Spor', [8, 6, 6, 10, 7, 10], [10, 10, 7], 1976],
    ['futbol', 'Futbol', [7, 3, 4, 10, 9, 9], [10, 10, 7], 1976],
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
    ['okul', 'Okul Hayatı', [6, 9, 8, 7, 4, 9], [10, 8, 5], 1985],
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
  // Kurulu taban ömrün %75'inde zirveye çıkar; son %20'de oyun alan aktif kullanıcı zirvenin %25'ine kadar düşer (yeni nesil gelince eski konsolda satış söner).
  platformGrowth: { _tag: 'P', peakAt: 0.75, declineFrom: 0.8, declineTo: 0.25 },

  // Yayıncılar. power: MGT2 gizli güç (V örnekleri), diğerleri P.
  // Yayıncılar: sabit küçükler + tarihten gelen büyükler (history.js 'pub' şirketleri; gücü yıllara göre değişir).
  publishers: [
    { id: 'mantar', name: 'Kırmızı Mantar', power: 55, royalty: 0.40, from: 1976, to: 2200, minFans: 0 },
    { id: 'morayi', name: 'Mor Ayı Indie', power: 60, royalty: 0.45, from: 2008, to: 2200, minFans: 0 },
  ],
  // Bölgesel pazarlar (P). weight: oyun pazarındaki pay (yıllara göre, normalize edilir); pref: türlere ilgi
  // (aksiyon, macera, rpg, simülasyon, strateji, casual); locCost: yerelleştirme bedeli (boyutun devCost'uyla çarpılır).
  // İngilizce sürüm Kuzey Amerika ve Avrupa'yı kapsar; Japonya ve Dünya için araştırma + yerelleştirme gerekir.
  regions: {
    _tag: 'P',
    // Konu C: altı bölge ve tüm karakterleri data/regions.js'te
    list: REGIONS.map((r) => ({ ...r, locCost: r.locBase })),
    ownerBias: OWNER_BIAS,
    norm: 1.0,
  },

  // Konsol savaşı (P): oyuncunun konsolu aynı segmentteki tarihsel platformlardan oyuncu çalar; rakipler tepki verir.
  war: {
    _tag: 'P',
    steal: 0.7, // payın bu kadarı rakip platformların oyun satışı tabanından düşer
    reactAt: [[0.12, 'fiyat', 0.08], [0.2, 'ozel', 0.05], [0.3, 'reklam', 0.04]], // [pay eşiği, tepki, aylık olasılık]
    exitAt: 0.4, exitRepBelow: 75, exitChance: 0.04,
    priceCut: { mult: 0.85, weeks: 16 }, exclusive: { mult: 0.9, weeks: 30 }, adWar: { mult: 0.92, weeks: 20 },
    newGenRival: 0.85, // aynı segmentte son 48 haftada yeni rakip konsol çıktıysa
    thirdPartyK: 0.6, thirdPartyFee: 40000, thirdPartyBoost: 0.02, thirdPartyCap: 40,
    dealCost: 600000, dealMult: 1.35, dealWeeks: 30, dealThirdParty: 3, dealCooldown: 48,
  },

  // Konu H: müdürler, otomasyon, platform lisansları (P). dept: true kampanyalar pazarlama departmanı ister.
  crew: {
    _tag: 'P',
    managerTier: 2, outK: 0.1, stressK: 0.2, premium: 0.15,
    autoResearchCashK: 10, autoAdHype: 30, autoAdWeeks: 8, autoAdCashK: 20,
    licenseDevK: 2,
  },

  // Konu G: platform payı, özel oyun anlaşmaları, hisse kademeleri, bağlı stüdyolar, tekelin bedeli (P).
  platform: {
    _tag: 'P',
    rateMin: 0.15, rateMax: 0.4, rateStd: 0.3, attractK: 3, attractMin: 0.4, attractMax: 1.5, // oran ↓ → stüdyo çekiciliği ↑
    cartMedia: ['kartus', 'oyunkarti'], cartAttract: 0.15, cartFee: 4, // kartuş tekeli: adet başı basım ücreti (1976 $)
    tpUnits: 7000, tpDecay: 0.85, tpWeeks: 26, tpBigK: 3, tpBaseRef: 5, priceRef: 20, // başka stüdyo oyununun konsolundaki satışı
    deal: {
      base: 600000, scoreRef: 70, scoreExp: 3, shareK: 1.6, seatDiscount: 0.25, offers: 6, horizon: 1, rivalOffers: 3,
      types: {
        pazarlama: { name: 'Pazarlama', k: 0.25, mult: 1.08, weeks: 12, tp: 1, heat: 0, rel: 5 },
        sureli: { name: 'Süreli özel', k: 1, mult: 1.25, weeks: 30, tp: 3, heat: 3, rel: 10, scale: true },
        tam: { name: 'Tam özel', k: 2.2, mult: 1.4, weeks: 48, tp: 5, heat: 6, rel: 15, scale: true, steal: 0.5 },
        ikinci: { name: 'İkinci parti', k: 4, mult: 1.4, weeks: 48, tp: 5, heat: 6, rel: 25, scale: true, steal: 0.5, partner: { mult: 1.1, weeks: 20 } },
      },
      counterK: 0.35, counterRaise: 0.4, withdrawRefund: 0.9, flopShare: 0.05, flopRefund: 0.5,
    },
    stake: {
      tiers: [10, 25, 51, 100], friendly: 1.1, hostile: 1.35, control: 0.2, sellK: 0.9, maxControlled: 5, dividendK: 0.3, seatRel: 10,
      autonomyStart: 70, orderAutonomy: -12, policyAutonomy: -1, recover: 1, boostAutonomy: 1, quitBelow: 30, quitChance: 0.05, quitRep: 10,
      boostCost: 150000, policyProfit: 0.75, policyMod: { mult: 1.06, weeks: 16 }, exitDiscount: 0.7,
      orderBase: 200000, orderWeeksK: 1.3, budgets: { dusuk: { name: 'Düşük', cost: 0.6, q: 0.85 }, normal: { name: 'Normal', cost: 1, q: 1 }, yuksek: { name: 'Yüksek', cost: 1.6, q: 1.12 } },
      mergeStaff: 3, mergeFansPerRep: 100,
    },
    antitrust: { shareAt: 0.4, controlledAt: 4, chance: 0.03, cooldownYears: 3, finePct: 0.04, sellK: 0.7, rel: -10 },
    heat: { shareK: 60, perDeal: 5, perSub: 4, rateAt: 0.35, rate: 10, smooth: 0.2, fansAt: 50, fansK: 0.003 },
    boycott: { rateAt: 0.35, chance: 0.05, attract: 0.3, weeks: 48 },
  },

  // Modern dönem iş modelleri (P).
  modern: {
    _tag: 'P',
    // Ücretsiz oyun: yeni oyuncu = satış eğrisinin playerK katı; gelir = aktif oyuncu × haftalık harcama × seviye
    f2p: { year: 2008, research: 'ia_satis', playerK: 7, churnWeekly: 0.05, arpuWeek: 0.045, serverPerPlayer: 0.004, minPlayers: 5000, minWeeks: 20, banMult: 0.6,
      kindK: { mobil: { players: 1, arpu: 1 }, pc: { players: 1.6, arpu: 1.5 }, konsol: { players: 1.2, arpu: 1.3 }, el: { players: 1, arpu: 1 } },
      monet: [
        { id: 'hafif', name: 'Hafif (yalnızca kozmetik)', k: 0.55, fansWeekly: 0.6, score: 0 },
        { id: 'dengeli', name: 'Dengeli', k: 1, fansWeekly: 0, score: 0 },
        { id: 'agresif', name: 'Agresif (ganimet kutusu, enerji)', k: 1.9, fansWeekly: -0.8, score: -4, fansRelease: -0.03 },
      ] },
    // İndirilebilir içerik ve sezon kartı
    dlc: { year: 2005, research: 'dlc', cost: 60000, attach: 0.14, attachDecay: 0.8, priceShare: 0.3, weeks: 8, weeksBack: 2, f2pAttach: 0.05, f2pPrice: 4,
      passYear: 2011, passResearch: 'sezon_karti', passAttach: 1.5, passPriceShare: 0.5, passDlcs: 2, passWeeks: 48, passKeptFans: 0.02, passBrokenFans: 0.06 },
    // Satıştaki oyunun anahtarlarını yayıncılara dağıtmak
    stream: { year: 2010, cost: 15000, cooldown: 24, baseChance: 0.55, goodMult: 1.35, badMult: 0.9, weeks: 6, fans: 4000 },
    // Erken erişim
    ea: { year: 2013, research: 'erken_erisim', minProgress: 0.33, priceShare: 0.7, unitsK: 0.5, bugFix: 0.03, polishWeeks: 8, polishBonus: 2, peakCut: 0.18 },
    // Kitle fonlama
    crowd: { from: 2012, to: 2023, minFans: 5000, perFan: 0.8, cap: 2000000, hype: 15, angryBelow: 70, angryFans: 0.08, happyAt: 85, happyFans: 0.05 },
    // Abonelik servisleri: önden ödeme; satış ×salesMult, hayran +fans
    services: { salesMult: 0.6, fans: 15000, list: [
      { id: 'pasos', name: 'X-Kutu Oyun Pasosu', owner: 'mikroyumusak', year: 2017, base: 900000 },
      { id: 'arti', name: 'Oyunİstasyonu Artı', owner: 'soni', year: 2018, base: 700000 },
      { id: 'buharpas', name: 'Buhar Arşivi', owner: 'vana', year: 2021, base: 500000 },
    ] },
  },

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

  // Yayıncılar (Konu B, P). Pay yayıncı netinin yüzdesi (net = perakendenin %55'i); avans telifle geri ödenir.
  publishing: {
    _tag: 'P',
    net: 0.55, payBase: 20, payPowerK: 0.06, payMin: 5, payMax: 30, earlyPay: -4, tierPay: [0, 2, 4, 6],
    hitPay: 4, hitAt: 1.5, kozMax: 3, rightsPay: 3, distPay: 70, distPower: 0.6, multiPay: 1,
    buyoutShare: 0.6, advWeeks: 12, lifeWeeks: 100, fund: [1.0, 1.1], milestones: [0.3, 0.3, 0.4], dueSlack: 6, lateWithdraw: 8, withdrawRepay: 0.5,
    thresholdA: 20, thresholdK: 0.55, need: 3, jitter: 3,
    err: { finished: 6, early: 12, doc: 2, relMin: 0.4 },
    tiers: { big: 80, mid: 60 },
    door: { open: 60, known: 75, knownRel: 20 },
    rel: { min: -50, max: 100, black: -30, tiers: [20, 40, 70], decay: 2, release: 5, hit: 10, top10: 5, no1: 5, recouped: 5, notRecouped: -8,
      latePerWeek: -2, lateMax: -15, broken: -15, otherPub: -3, auctionLoss: -1, negFail: -2, scandal: -10, decline: -1, thirdReject: -5, dateRefuse: -3 },
    respWeeks: [1, 4], cooldown: 12, resubmitGain: 5, maxPitches: 3, offerWeeks: 4, finishedDue: 8,
    slotsPer: 20, slotsMin: 2, slotsFull: -10,
    prepCost: 1500, prepWeeks: 1,
    bargain: { power: 30, share: 0.3 },
    promo: { base: 4, k: 10, like: 3, partner: 1.5, max: 20 },
    neg: { base: 50, kE: 2, koz: 5, min: 10, max: 90, withdraw: 0.15, rounds: 2, rightsBase: 40, dateBase: 60, rival: 0.5 },
    meet: { big: 2, mid: 1, catchBase: 0.2, catchRel: 0.005, catchMin: 0.15, catchMax: 0.7, caught: -10, caughtRel: -5 },
    reputation: { base: -60, top10: 2, fansK: 5, fansMax: 15, min: -10, max: 30, none: -10 },
    orders: { chance: 0.25, minGames: 2, scoreA: 55, scoreK: 0.2, scoreMin: 60, scoreMax: 80, slackWeeks: 12, penalty: 0.5 },
    trial: { minGames: 2, minAvg: 60, rel: 25, relFast: 35, fastShare: 0.7, failRel: -20, banWeeks: 96, payK: 0.85 },
    agent: { good: { fee: 0.10, retainer: 3000, doors: 2 }, cheap: { fee: 0.05, retainer: 800, doors: 1, scamKaos: 0.004 } },
    showcase: { fans: 3000, morale: 5, skill: 1, top3Rel: 10, onePctRel: 5, modRel: 15, festPrize: 15000, jamHype: 10 },
    referral: { partner: 15, staff: 10, staffBad: -10, devFriend: 10, platform: 10, critic: 10, fair: 8, ipo: 10, fanCampaign: 10, jury: 15, award: 20, course: 5, jamFriend: 8, social: -5 },
  },

  // Ofis kademeleri (V: 4 kademe). Koltuklar artık odalardan gelir (MGT2 oda motoru): slot × oda başına koltuk.
  offices: [
    { tier: 1, name: 'Garaj', slots: 1, roomSeats: 1, cost: 0, rent: 300 },
    { tier: 2, name: 'Küçük ofis', slots: 3, roomSeats: 3, cost: 120000, rent: 900 },
    { tier: 3, name: 'Büyük ofis', slots: 4, roomSeats: 4, cost: 600000, rent: 2500 },
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
    // Konsol tipleri (P): yıl ve araştırmayla açılır. demand: tipin yıllara göre pazar ilgisi; units: satış ölçeği;
    // margin: adet başı kâr ($); monthly/churn: kurulu birim başına aylık gelir (salon jetonu, bulut aboneliği) ve aylık kayıp;
    // players: birim başına oyuncu (salon makinesini çok kişi oynar); parts: tasarlanan bileşen kategorileri.
    types: [
      { id: 'salon', name: 'Salon makinesi (arcade)', kind: 'salon', year: 1976, research: null, cost: 1500000, work: 0.5, units: 0.025, margin: 120, monthly: 4, churn: 0.04, players: 120, techOffset: 0,
        demand: [[1976, 0.8], [1980, 1.5], [1984, 1.2], [1990, 1], [1996, 0.6], [2002, 0.25], [2010, 0.1], [2030, 0.06]], parts: ['cpu', 'gpu', 'media', 'ctrl'], genre: [10, 6, 5, 7, 5, 9], aud: [10, 9, 8] },
      { id: 'bilgisayar', name: 'Ev bilgisayarı', kind: 'pc', year: 1977, research: 'hw_ev_pc', cost: 4000000, work: 0.9, units: 0.7, margin: 15, techOffset: 0,
        demand: [[1977, 0.5], [1983, 1.3], [1990, 0.8], [1996, 0.25], [2001, 0.03], [2030, 0.01]], parts: ['cpu', 'gpu', 'media', 'ctrl'], genre: [8, 10, 10, 10, 10, 7], aud: [8, 9, 10] },
      { id: 'konsol', name: 'Ev konsolu', kind: 'konsol', year: 1977, research: null, cost: 6000000, work: 1, units: 1, margin: 2, techOffset: 0,
        demand: [[1977, 0.7], [1983, 0.35], [1986, 1], [2000, 1.1], [2030, 1.1]], parts: ['cpu', 'gpu', 'media', 'ctrl', 'net'], genre: [10, 9, 10, 9, 8, 8], aud: [9, 10, 10] },
      { id: 'tasinabilir', name: 'El konsolu', kind: 'el', year: 1989, research: 'hw_el', cost: 4000000, work: 0.8, units: 1.1, margin: 2, techOffset: -1,
        demand: [[1989, 1], [2004, 1.2], [2014, 0.6], [2030, 0.4]], parts: ['cpu', 'gpu', 'media', 'screen', 'ctrl', 'net'], genre: [8, 8, 9, 8, 7, 10], aud: [10, 10, 8] },
      { id: 'vr', name: 'VR başlığı', kind: 'vr', year: 2014, research: 'hw_vr', cost: 5000000, work: 0.9, units: 0.22, margin: 20, techOffset: 0,
        demand: [[2014, 0.3], [2016, 0.8], [2020, 0.6], [2030, 0.7]], parts: ['cpu', 'gpu', 'screen', 'ctrl', 'net'], genre: [10, 9, 6, 10, 5, 8], aud: [8, 9, 10] },
      { id: 'melez', name: 'Melez konsol (ev + el)', kind: 'konsol', year: 2016, research: 'hw_melez', cost: 9000000, work: 1.2, units: 1.25, margin: 3, techOffset: -1,
        demand: [[2016, 1], [2030, 1.2]], parts: ['cpu', 'gpu', 'media', 'screen', 'ctrl', 'net'], genre: [9, 9, 10, 9, 8, 10], aud: [10, 10, 9] },
      { id: 'mini', name: 'Retro mini konsol', kind: 'konsol', year: 2016, research: 'hw_mini', cost: 800000, work: 0.3, units: 0.6, margin: 8, techOffset: -5,
        demand: [[2016, 1], [2019, 0.6], [2030, 0.4]], parts: ['cpu', 'ctrl'], genre: [10, 8, 9, 6, 6, 10], aud: [9, 9, 10] },
      { id: 'bulut', name: 'Bulut oyun servisi', kind: 'bulut', year: 2019, research: 'hw_bulut', cost: 15000000, work: 1, units: 0.15, margin: 0, monthly: 0.6, churn: 0.05, techOffset: 0,
        demand: [[2019, 0.3], [2022, 0.6], [2030, 0.9]], parts: ['gpu', 'net'], genre: [10, 9, 10, 8, 8, 9], aud: [8, 9, 10] },
    ],
    // Bileşenler (P, adlar dönemine göre). tech: teknoloji katkısı; g: türlere uyum (+/−); appeal: satış çarpanı;
    // margin: adet başı kâra etkisi ($); piracy: korsan riski (lisans gelirini azaltır). Kartuş → kaset/disket → CD → DVD → Blu-ray → dijital → bulut.
    parts: {
      cpu: { name: 'İşlemci', w: 0.35, list: [
        { id: 'c_ttl', name: 'TTL mantık devresi', year: 1976, tech: 1, cost: 300000 },
        { id: 'c_8', name: '8-bit işlemci', year: 1977, tech: 1.5, cost: 600000 },
        { id: 'c_16', name: '16-bit işlemci', year: 1985, research: 'hw_16bit', tech: 3, cost: 1000000 },
        { id: 'c_32', name: '32-bit RISC işlemci', year: 1993, research: 'hw_32bit', tech: 4.5, cost: 10000000 },
        { id: 'c_64', name: '64-bit işlemci', year: 1996, research: 'hw_64bit', tech: 5.3, cost: 30000000 },
        { id: 'c_128', name: '128-bit "Duygu" çipi', year: 2000, research: 'hw_128bit', tech: 6, cost: 45000000 },
        { id: 'c_cok', name: 'Çok çekirdekli "Hücre" işlemci', year: 2005, research: 'hw_cok', tech: 6.5, cost: 60000000 },
        { id: 'c_apu', name: 'x86 birleşik çip (APU)', year: 2013, research: 'hw_apu', tech: 7, cost: 70000000 },
        { id: 'c_soc', name: 'Özel SoC + hızlı SSD', year: 2020, research: 'hw_soc', tech: 7.6, cost: 90000000 },
        { id: 'c_yz', name: 'Yapay zekâ hızlandırıcılı SoC', year: 2024, research: 'hw_yz', tech: 8, cost: 110000000 },
        { id: 'patates', name: 'Patates çip', year: 2005, hwEng: 4, tech: 7, cost: 90000000 },
      ] },
      gpu: { name: 'Grafik', w: 0.35, list: [
        { id: 'g_karakter', name: 'Karakter jeneratörü', year: 1976, tech: 1, cost: 200000 },
        { id: 'g_sprite', name: 'Sprite çipi', year: 1980, tech: 2, cost: 500000, g: [1, 0, 0, 0, 0, 1] },
        { id: 'g_paralaks', name: 'Paralaks kaydırma çipi', year: 1987, research: 'hw_paralaks', tech: 3, cost: 2000000, g: [1, 1, 0, 0, 0, 0] },
        { id: 'g_mod7', name: 'Döndür-ölçekle çipi', year: 1990, research: 'hw_mod7', tech: 3.5, cost: 4000000, g: [1, 0, 1, 0, 0, 0] },
        { id: 'g_3d', name: '3D poligon motoru', year: 1994, research: 'hw_3d', tech: 4.8, cost: 12000000, g: [1, 1, 0, 1, 0, -1], appeal: 1.1 },
        { id: 'g_shader', name: 'Programlanabilir gölgelendirici', year: 2001, research: 'hw_shader', tech: 6, cost: 35000000, g: [1, 1, 1, 0, 0, 0] },
        { id: 'g_hd', name: 'HD birleşik gölgelendirici', year: 2005, research: 'hw_hd', tech: 6.6, cost: 50000000, appeal: 1.05 },
        { id: 'g_4k', name: '4K grafik birimi', year: 2016, research: 'hw_4k', tech: 7.2, cost: 70000000 },
        { id: 'g_isin', name: 'Işın izleme birimi', year: 2020, research: 'hw_isin', tech: 7.8, cost: 90000000, appeal: 1.05 },
      ] },
      media: { name: 'Oyun ortamı', w: 0.15, list: [
        { id: 'kartus', name: 'Kartuş', year: 1976, tech: 1.5, cost: 1500000, margin: -1, piracy: 0 },
        { id: 'kaset', name: 'Manyetik kaset', year: 1978, tech: 1, cost: 300000, margin: 1, piracy: 0.35, appeal: 0.95 },
        { id: 'disket', name: 'Disket', year: 1982, research: 'hw_disket', tech: 2, cost: 1000000, margin: 1, piracy: 0.3, g: [0, 1, 1, 1, 1, 0] },
        { id: 'cd', name: 'CD-ROM', year: 1992, research: 'hw_cd', tech: 4, cost: 5000000, margin: 2, piracy: 0.25, g: [0, 1, 1, 0, 0, 0], appeal: 1.08 },
        { id: 'minidisk', name: 'Mini optik disk', year: 2004, research: 'hw_minidisk', tech: 4.5, cost: 6000000, margin: 1, piracy: 0.15, only: ['tasinabilir'] },
        { id: 'dvd', name: 'DVD-ROM', year: 1999, research: 'hw_dvd', tech: 5.5, cost: 15000000, margin: 2, piracy: 0.15, appeal: 1.1 },
        { id: 'bd', name: 'Blu-ray', year: 2006, research: 'hw_bd', tech: 6.5, cost: 35000000, margin: 0, piracy: 0.05, appeal: 1.05 },
        { id: 'oyunkarti', name: 'Hızlı oyun kartı', year: 2011, research: 'hw_kart', tech: 6, cost: 20000000, margin: 1, piracy: 0.05, only: ['tasinabilir', 'melez'] },
        { id: 'dijital', name: 'Yalnız dijital indirme', year: 2009, research: 'hw_dijital', tech: 6, cost: 8000000, margin: 3, piracy: 0.02, appeal: 0.92, needNet: 2 },
        { id: 'akis', name: 'Bulut akışı', year: 2019, research: 'hw_bulut', tech: 7, cost: 25000000, margin: 2, piracy: 0, needNet: 3 },
        { id: 'delikli', name: 'Delikli kart', year: 1976, hwEng: 6, tech: 7, cost: 93999900 },
      ] },
      screen: { name: 'Ekran', w: 0.15, list: [
        { id: 's_mono', name: 'Siyah-beyaz LCD', year: 1989, research: 'hw_el', tech: 1.5, cost: 500000, appeal: 0.95 },
        { id: 's_renk', name: 'Renkli LCD', year: 1994, research: 'hw_renkli_lcd', tech: 3, cost: 2000000 },
        { id: 's_isik', name: 'Arka ışıklı ekran', year: 2003, research: 'hw_isikli', tech: 4.5, cost: 5000000, appeal: 1.05 },
        { id: 's_cift', name: 'Çift ekran (biri dokunmatik)', year: 2004, research: 'hw_cift', tech: 5, cost: 8000000, g: [0, 1, 1, 1, 0, 2], appeal: 1.12 },
        { id: 's_3d', name: 'Gözlüksüz 3D ekran', year: 2011, research: 'hw_3dekran', tech: 5.5, cost: 12000000, appeal: 1.03 },
        { id: 's_hd', name: 'HD dokunmatik ekran', year: 2012, research: 'hw_hdekran', tech: 6, cost: 15000000, g: [0, 0, 0, 1, 1, 1] },
        { id: 's_vr', name: 'Yüksek tazelemeli VR paneli', year: 2016, research: 'hw_vr', tech: 6.5, cost: 25000000 },
        { id: 's_oled', name: 'OLED ekran', year: 2021, research: 'hw_oled', tech: 7, cost: 20000000, appeal: 1.06 },
      ] },
      ctrl: { name: 'Kontrol', w: 0, list: [
        { id: 'k_joy', name: 'Joystick ve tek tuş', year: 1976, cost: 50000, g: [1, 0, -1, 0, -1, 1] },
        { id: 'k_cevir', name: 'Çevirmeli kol (paddle)', year: 1976, cost: 40000, g: [1, -1, -1, 0, -1, 1] },
        { id: 'k_klavye', name: 'Klavye', year: 1977, cost: 150000, g: [-1, 1, 1, 1, 2, -1], only: ['bilgisayar'] },
        { id: 'k_dpad', name: 'Yön haçı (d-pad)', year: 1983, research: 'hw_dpad', cost: 200000, g: [1, 1, 1, 0, 0, 1], appeal: 1.06 },
        { id: 'k_fare', name: 'Klavye + fare', year: 1985, research: 'hw_fare', cost: 300000, g: [0, 2, 1, 2, 2, 0], only: ['bilgisayar'] },
        { id: 'k_omuz', name: 'Omuz tuşları', year: 1990, research: 'hw_omuz', cost: 300000, g: [1, 0, 1, 0, 0, 0] },
        { id: 'k_analog', name: 'Analog çubuk', year: 1996, research: 'hw_analog', cost: 800000, g: [2, 1, 0, 0, 0, 0], appeal: 1.06 },
        { id: 'k_titresim', name: 'Çift analog + titreşim', year: 1997, research: 'hw_titresim', cost: 1000000, g: [2, 1, 1, 0, 0, 0], appeal: 1.08 },
        { id: 'k_kablosuz', name: 'Kablosuz kumanda', year: 2005, research: 'hw_kablosuz', cost: 1500000, appeal: 1.06 },
        { id: 'k_hareket', name: 'Hareket algılayan kumanda', year: 2006, research: 'hw_hareket', cost: 3000000, g: [-1, 0, -1, 1, -1, 3], appeal: 1.2 },
        { id: 'k_kamera', name: 'Vücut takip kamerası', year: 2010, research: 'hw_kamera', cost: 5000000, g: [-1, -1, -1, 1, -1, 2], appeal: 1.04 },
        { id: 'k_takip', name: 'El takipli VR kolları', year: 2016, research: 'hw_vr', cost: 4000000, g: [2, 1, 0, 1, 0, 1], only: ['vr'] },
        { id: 'k_tetik', name: 'Adaptif tetik + HD titreşim', year: 2020, research: 'hw_tetik', cost: 4000000, g: [2, 1, 1, 0, 0, 0], appeal: 1.06 },
      ] },
      net: { name: 'Bağlantı', w: 0, list: [
        { id: 'n_yok', name: 'Bağlantı yok', year: 1976, lvl: 0, cost: 0 },
        { id: 'n_modem', name: 'Modem', year: 1995, research: 'hw_modem', lvl: 1, cost: 1000000, g: [0, 0, 1, 0, 1, 0] },
        { id: 'n_online', name: 'Çevrimiçi oyun servisi', year: 2002, research: 'hw_online', lvl: 2, cost: 5000000, g: [1, 0, 1, 0, 1, 0], appeal: 1.08 },
        { id: 'n_magaza', name: 'Dijital mağaza + başarımlar', year: 2006, research: 'hw_magaza', lvl: 2, cost: 8000000, appeal: 1.1, margin: 1 },
        { id: 'n_abone', name: 'Bulut kayıt + abonelik', year: 2013, research: 'hw_abone', lvl: 3, cost: 12000000, appeal: 1.08, margin: 2 },
      ] },
    },
    // Fiyat stratejisi: zararına satış kurulu tabanı büyütür (lisans geliri), premium az satar ama kârlıdır.
    prices: [
      { id: 'zarar', name: 'Zararına sat', units: 1.5, marginAdd: -8, marginMult: 1 },
      { id: 'normal', name: 'Normal fiyat', units: 1, marginAdd: 0, marginMult: 1 },
      { id: 'premium', name: 'Premium', units: 0.62, marginAdd: 0, marginMult: 2.2 },
    ],
    expectedTech: [[1976, 1], [1980, 1.5], [1985, 2.5], [1990, 3.2], [1994, 4.5], [1998, 5.2], [2001, 5.8], [2006, 6.5], [2013, 7], [2020, 7.6], [2025, 8]],
    teamWeeks: 35, phases: ['Tasarım', 'Prototip', 'Seri üretim'], // aşama başına iş: dönemin ortalama çalışanının 35 haftası × (1 + tech/7) × tip
    fanLossWeeks: 12, fanLossPct: 0.03,
    B: 25000, decay: 0.985, qualityK: 0.25, qualityMin: 0.4, qualityMax: 1.6, ownGameBoost: 0.05,
    marginPerUnit: 5, licencePerMillion: 5000, ownDevCost: 5000, stopBelow: 200,
    // Konsol aileleri (nesiller): seri ünü sonraki nesli satar; geriye uyumluluk kurulu tabanın bir kısmını taşır; eski nesil bir süre birlikte satılır.
    seriesK: 0.12, backCompat: 0.3, overlapWeeks: 48, sunsetDecay: 0.95, hwSkillMin: 65,
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
    step: 0.15, min: 0.7, max: 1.5, costSalaryMonths: 1.5, costTierK: 0.5, // koltuk başı 2,25 (kademe 1) – 4,5 (kademe 4) aylık maaş
  },

  economy: {
    creditStep: 0.03, // kredi limiti çarpanının haftalık en fazla değişimi (dönem krizleri ~4 ayda oturur)
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
      { id: 'tv', name: 'TV kampanyası', cost: 150000, hype: 35, research: 'pazarlama_buyuk', dept: true },
      { id: 'yayinci_k', name: 'Küçük yayıncılar', cost: 8000, hype: 8, research: null, minYear: 2009 },
      { id: 'yayinci_o', name: 'Orta ölçekli fenomenler', cost: 40000, hype: 18, research: 'pazarlama_kucuk', minYear: 2011, dept: true },
      { id: 'influencer', name: 'Mega fenomen turu', cost: 200000, hype: 30, research: 'pazarlama_buyuk', minYear: 2014, dept: true, viral: { p: 0.25, hype: 30, fans: 20000 }, flop: { p: 0.15, hype: -15 } },
    ],
  },

  contracts: {
    _tag: 'P',
    // GDS (V): süre 6–13 hafta, 1–2 kategori şartı, zor sözleşme daha çok öder ama daha çok ister,
    // başarı para + RP + itibar, başarısızlık ceza + itibar kaybı. Yük ve ödeme katsayıları P.
    weeksMin: 6, weeksMax: 13, offers: 3,
    rewardPerPoint: 260, rewardExp: 0.5, penaltyShare: 0.6, twoDiscChance: 0.65, // 260: Konu B ile yayıncı payı düştü; ilk yılların geliri sözleşmelerden
    // ödeme ∝ (enflasyon·40/H)^rewardExp × lateK(yıl): erken dönemde can simidi, sonra azalır ama 2020'lerde de maaşı karşılar
    lateK: [[1976, 1], [1995, 1.1], [2010, 1.7], [2025, 2.5]],
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
    { id: 'tur_aks', name: 'Tür: Aksiyon', rp: 10, cost: 3000, weeks: 2, year: 1976, genre: 'aksiyon' },
    { id: 'tur_mac', name: 'Tür: Macera', rp: 10, cost: 3000, weeks: 2, year: 1976, genre: 'macera' },
    { id: 'tur_cas', name: 'Tür: Casual', rp: 10, cost: 3000, weeks: 2, year: 1976, genre: 'casual' },
    { id: 'tur_spo', name: 'Tür: Spor', rp: 10, cost: 3000, weeks: 2, year: 1976, genre: 'spor' },
    { id: 'tur_yar', name: 'Tür: Yarış', rp: 10, cost: 3000, weeks: 2, year: 1976, genre: 'yaris' },
    { id: 'tur_rpg', name: 'Tür: RPG', rp: 25, cost: 10000, weeks: 4, year: 1977, genre: 'rpg' },
    { id: 'tur_nis', name: 'Tür: Nişancı', rp: 20, cost: 6000, weeks: 3, year: 1978, genre: 'nisanci' },
    { id: 'tur_bul', name: 'Tür: Bulmaca', rp: 20, cost: 6000, weeks: 3, year: 1980, genre: 'bulmaca' },
    { id: 'tur_pla', name: 'Tür: Platform', rp: 25, cost: 8000, weeks: 4, year: 1981, genre: 'platform' },
    { id: 'tur_dov', name: 'Tür: Dövüş', rp: 30, cost: 12000, weeks: 4, year: 1984, genre: 'dovus' },
    { id: 'tur_rit', name: 'Tür: Ritim', rp: 60, cost: 80000, weeks: 6, year: 1996, genre: 'ritim' },
    { id: 'pazarlama_kucuk', name: 'Dergi reklamı', rp: 15, cost: 5000, weeks: 3, year: 1977 },
    { id: 'motor_ozel', name: 'Kendi motorunu yap', rp: 20, cost: 8000, weeks: 4, year: 1977 },
    { id: 'boyut_orta', name: 'Orta boy oyun', rp: 35, cost: 20000, weeks: 6, year: 1978 },
    { id: 'tur_sim', name: 'Tür: Simülasyon', rp: 40, cost: 15000, weeks: 6, year: 1980, genre: 'simulasyon' },
    { id: 'oz_yayin', name: 'Kendi yayınını yap', rp: 60, cost: 40000, weeks: 8, year: 1980 },
    { id: 'tur_str', name: 'Tür: Strateji', rp: 40, cost: 15000, weeks: 6, year: 1979, genre: 'strateji' },
    { id: 'kopya_koruma', name: 'Kopya koruması', rp: 40, cost: 20000, weeks: 6, year: 1981 },
    { id: 'motor_lisans', name: 'Motor lisanslama', rp: 50, cost: 30000, weeks: 6, year: 1983, requires: 'motor_ozel' },
    { id: 'pazarlama_buyuk', name: 'TV kampanyası', rp: 100, cost: 80000, weeks: 8, year: 1985 },
    { id: 'boyut_buyuk', name: 'Büyük oyun', rp: 120, cost: 120000, weeks: 10, year: 1985, requires: 'boyut_orta' },
    { id: 'boyut_aaa', name: 'AAA oyun', rp: 300, cost: 600000, weeks: 16, year: 1995, requires: 'boyut_buyuk' },
    { id: 'boyut_mmo', name: 'MMO', rp: 500, cost: 1000000, weeks: 20, year: 1998, requires: 'boyut_aaa' }, // L (500 RP)
    { id: 'oda_qa', name: 'Kalite güvence odası', rp: 30, cost: 20000, weeks: 4, year: 1979 },
    { id: 'oda_uzman', name: 'Uzman odalar (grafik, ses)', rp: 50, cost: 40000, weeks: 6, year: 1980 },
    { id: 'donanim_lab', name: 'Donanım laboratuvarı', rp: 200, cost: 1500000, weeks: 12, year: 1978 }, // GDT rehberi 800 RP/5M; salon makinesi döneminden açılsın diye erkene çekildi (P)
    // Donanım araştırmaları (konsol bileşenleri, dönemine göre açılır)
    { id: 'hw_ev_pc', name: 'Donanım: Ev bilgisayarı', rp: 60, cost: 300000, weeks: 6, year: 1977, requires: 'donanim_lab', hw: true },
    { id: 'hw_disket', name: 'Donanım: Disket sürücü', rp: 40, cost: 150000, weeks: 4, year: 1982, requires: 'donanim_lab', hw: true },
    { id: 'hw_dpad', name: 'Donanım: Yön haçı', rp: 40, cost: 150000, weeks: 4, year: 1983, requires: 'donanim_lab', hw: true },
    { id: 'hw_16bit', name: 'Donanım: 16-bit işlemci', rp: 80, cost: 600000, weeks: 8, year: 1985, requires: 'donanim_lab', hw: true },
    { id: 'hw_fare', name: 'Donanım: Fare', rp: 40, cost: 200000, weeks: 4, year: 1985, requires: 'hw_ev_pc', hw: true },
    { id: 'hw_paralaks', name: 'Donanım: Paralaks kaydırma', rp: 60, cost: 500000, weeks: 6, year: 1987, requires: 'donanim_lab', hw: true },
    { id: 'hw_el', name: 'Donanım: El konsolu + LCD', rp: 120, cost: 1500000, weeks: 10, year: 1989, requires: 'donanim_lab', hw: true },
    { id: 'hw_mod7', name: 'Donanım: Döndür-ölçekle çipi', rp: 80, cost: 1000000, weeks: 8, year: 1990, requires: 'hw_paralaks', hw: true },
    { id: 'hw_omuz', name: 'Donanım: Omuz tuşları', rp: 40, cost: 300000, weeks: 4, year: 1990, requires: 'hw_dpad', hw: true },
    { id: 'hw_cd', name: 'Donanım: CD-ROM sürücü', rp: 150, cost: 3000000, weeks: 12, year: 1992, requires: 'donanim_lab', hw: true },
    { id: 'hw_32bit', name: 'Donanım: 32-bit RISC', rp: 160, cost: 4000000, weeks: 12, year: 1993, requires: 'hw_16bit', hw: true },
    { id: 'hw_renkli_lcd', name: 'Donanım: Renkli LCD', rp: 80, cost: 1500000, weeks: 8, year: 1994, requires: 'hw_el', hw: true },
    { id: 'hw_3d', name: 'Donanım: 3D poligon motoru', rp: 200, cost: 6000000, weeks: 14, year: 1994, requires: 'hw_mod7', hw: true },
    { id: 'hw_modem', name: 'Donanım: Modem', rp: 80, cost: 1000000, weeks: 6, year: 1995, requires: 'donanim_lab', hw: true },
    { id: 'hw_64bit', name: 'Donanım: 64-bit işlemci', rp: 220, cost: 8000000, weeks: 14, year: 1996, requires: 'hw_32bit', hw: true },
    { id: 'hw_analog', name: 'Donanım: Analog çubuk', rp: 80, cost: 1000000, weeks: 6, year: 1996, requires: 'hw_omuz', hw: true },
    { id: 'hw_titresim', name: 'Donanım: Titreşimli kumanda', rp: 60, cost: 800000, weeks: 5, year: 1997, requires: 'hw_analog', hw: true },
    { id: 'hw_dvd', name: 'Donanım: DVD sürücü', rp: 220, cost: 9000000, weeks: 14, year: 1999, requires: 'hw_cd', hw: true },
    { id: 'hw_128bit', name: 'Donanım: 128-bit çip', rp: 260, cost: 12000000, weeks: 16, year: 2000, requires: 'hw_64bit', hw: true },
    { id: 'hw_geri_uyum', name: 'Donanım: Geriye uyumluluk', rp: 120, cost: 3000000, weeks: 8, year: 2000, requires: 'donanim_lab', hw: true },
    { id: 'hw_shader', name: 'Donanım: Programlanabilir gölgelendirici', rp: 260, cost: 12000000, weeks: 16, year: 2001, requires: 'hw_3d', hw: true },
    { id: 'hw_online', name: 'Donanım: Çevrimiçi servis', rp: 200, cost: 8000000, weeks: 12, year: 2002, requires: 'hw_modem', hw: true },
    { id: 'hw_isikli', name: 'Donanım: Arka ışıklı ekran', rp: 100, cost: 2000000, weeks: 8, year: 2003, requires: 'hw_renkli_lcd', hw: true },
    { id: 'hw_cift', name: 'Donanım: Çift ve dokunmatik ekran', rp: 160, cost: 5000000, weeks: 10, year: 2004, requires: 'hw_isikli', hw: true },
    { id: 'hw_minidisk', name: 'Donanım: Mini optik disk', rp: 120, cost: 4000000, weeks: 8, year: 2004, requires: 'hw_dvd', hw: true },
    { id: 'hw_cok', name: 'Donanım: Çok çekirdekli işlemci', rp: 320, cost: 18000000, weeks: 18, year: 2005, requires: 'hw_128bit', hw: true },
    { id: 'hw_hd', name: 'Donanım: HD grafik', rp: 300, cost: 16000000, weeks: 16, year: 2005, requires: 'hw_shader', hw: true },
    { id: 'hw_kablosuz', name: 'Donanım: Kablosuz kumanda', rp: 80, cost: 1500000, weeks: 6, year: 2005, requires: 'hw_titresim', hw: true },
    { id: 'hw_bd', name: 'Donanım: Blu-ray sürücü', rp: 300, cost: 16000000, weeks: 16, year: 2006, requires: 'hw_dvd', hw: true },
    { id: 'hw_hareket', name: 'Donanım: Hareket algılama', rp: 220, cost: 9000000, weeks: 14, year: 2006, requires: 'hw_kablosuz', hw: true },
    { id: 'hw_magaza', name: 'Donanım: Dijital mağaza', rp: 180, cost: 6000000, weeks: 10, year: 2006, requires: 'hw_online', hw: true },
    { id: 'hw_dijital', name: 'Donanım: Yalnız dijital konsol', rp: 160, cost: 5000000, weeks: 10, year: 2009, requires: 'hw_magaza', hw: true },
    { id: 'hw_kamera', name: 'Donanım: Vücut takip kamerası', rp: 200, cost: 9000000, weeks: 12, year: 2010, requires: 'hw_hareket', hw: true },
    { id: 'hw_kart', name: 'Donanım: Hızlı oyun kartı', rp: 140, cost: 5000000, weeks: 8, year: 2011, requires: 'hw_el', hw: true },
    { id: 'hw_3dekran', name: 'Donanım: Gözlüksüz 3D ekran', rp: 160, cost: 6000000, weeks: 10, year: 2011, requires: 'hw_cift', hw: true },
    { id: 'hw_hdekran', name: 'Donanım: HD dokunmatik ekran', rp: 160, cost: 6000000, weeks: 10, year: 2012, requires: 'hw_cift', hw: true },
    { id: 'hw_apu', name: 'Donanım: x86 birleşik çip', rp: 360, cost: 22000000, weeks: 18, year: 2013, requires: 'hw_cok', hw: true },
    { id: 'hw_abone', name: 'Donanım: Abonelik ve bulut kayıt', rp: 200, cost: 8000000, weeks: 10, year: 2013, requires: 'hw_magaza', hw: true },
    { id: 'hw_vr', name: 'Donanım: Sanal gerçeklik', rp: 400, cost: 25000000, weeks: 20, year: 2014, requires: 'hw_hd', hw: true },
    { id: 'hw_4k', name: 'Donanım: 4K grafik', rp: 360, cost: 22000000, weeks: 18, year: 2016, requires: 'hw_hd', hw: true },
    { id: 'hw_melez', name: 'Donanım: Melez (ev + el) konsol', rp: 400, cost: 25000000, weeks: 20, year: 2016, requires: 'hw_kart', hw: true },
    { id: 'hw_mini', name: 'Donanım: Retro mini konsol', rp: 60, cost: 1000000, weeks: 4, year: 2016, requires: 'donanim_lab', hw: true },
    { id: 'hw_bulut', name: 'Donanım: Bulut oyun akışı', rp: 450, cost: 30000000, weeks: 20, year: 2019, requires: 'hw_abone', hw: true },
    { id: 'hw_soc', name: 'Donanım: Özel SoC + SSD', rp: 420, cost: 30000000, weeks: 20, year: 2020, requires: 'hw_apu', hw: true },
    { id: 'hw_isin', name: 'Donanım: Işın izleme birimi', rp: 400, cost: 28000000, weeks: 18, year: 2020, requires: 'hw_4k', hw: true },
    { id: 'hw_tetik', name: 'Donanım: Adaptif tetik', rp: 160, cost: 6000000, weeks: 10, year: 2020, requires: 'hw_kablosuz', hw: true },
    { id: 'hw_oled', name: 'Donanım: OLED ekran', rp: 200, cost: 10000000, weeks: 12, year: 2021, requires: 'hw_hdekran', hw: true },
    { id: 'hw_yz', name: 'Donanım: Yapay zekâ hızlandırıcı', rp: 480, cost: 35000000, weeks: 22, year: 2024, requires: 'hw_soc', hw: true },
    { id: 'ihracat', name: 'İhracat ve posta siparişi', rp: 8, cost: 3000, weeks: 2, year: 1977 },
    { id: 'yerel_jp', name: 'Japonca yerelleştirme', rp: 30, cost: 30000, weeks: 4, year: 1981 },
    { id: 'yerel_dunya', name: 'Dünya pazarları (çok dilli sürüm)', rp: 60, cost: 80000, weeks: 6, year: 1993 },
    { id: 'dlc', name: 'İndirilebilir içerik', rp: 60, cost: 80000, weeks: 6, year: 2005 },
    { id: 'ia_satis', name: 'Ücretsiz oyun ve oyun içi satış', rp: 120, cost: 200000, weeks: 8, year: 2008 },
    { id: 'sezon_karti', name: 'Sezon kartı', rp: 60, cost: 100000, weeks: 5, year: 2011, requires: 'dlc' },
    { id: 'erken_erisim', name: 'Erken erişim', rp: 80, cost: 120000, weeks: 6, year: 2013 },
    { id: 'uzaktan', name: 'Uzaktan çalışma altyapısı', rp: 50, cost: 30000, weeks: 4, year: 2019 },
  ],
  // Konu E: motor ve teknoloji. Özellikler src/data/engines.js'te; v seviyesi → RP/süre/maliyet/motor puanı researchV'den.
  engine: {
    _tag: 'P',
    expectLag: 3, // dönemin beklentisi 3 yıl geriden gelir
    factorBase: 0.85, factorK: 0.3, factorMin: 0.8, factorMax: 1.12, rCap: 1.5, // teknik puan çarpanı (5 kategori)
    avBase: 0.8, avK: 0.2, avMin: 0.85, avMax: 1.02, // grafik ve ses puanı çarpanı
    featLoad: 0.01, featLoadMax: 0.15, // temel dışı her özellik geliştirmeyi %1 uzatır (en çok %15)
    techRpK: 1, techCostK: 1, techWeeksK: 1, techAgeK: 0.07, techAgeMin: 0.3, // teknoloji hattı; eski basamak ucuzlar
    buildWeeksBase: 3, buildWeeksPerFeature: 1, carryK: 0.2, // yeni sürüm eski özellikleri %20'ye taşır
    famFirstSpeed: 0.95, famFirstBugs: 1.15, famUsedGames: 3, famUsedSpeed: 1.03, // ekip alışkanlığı
    licSpeedK: 0.5, // lisanslı motorun hız ve tür uzmanlığı etkisi (denge ayarı)
    subNeedPenalty: 5, mustPenalty: 2,
    licenseeMax: 6, licenceMinRatio: 0.8, licenceIncomePerPoint: 3, rivalBonus: 1, gotyRep: 5, gotyFans: 2000, // dışarıya lisans
    quitYears: 8, birlikFee: 0.03,
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
    // MGT esinli yeni huylar: öğrenme, tatil isteği, ilişki eğilimi
    { id: 'hizli', name: 'Hızlı öğrenir', learn: 1.6 },
    { id: 'tatilci', name: 'Tatil hastası', vacation: 1.8, moraleSelf: 0.4 },
    { id: 'lider', name: 'Doğal lider', moraleTeam: 0.7, social: 1.3 },
    { id: 'yalniz', name: 'Yalnız kurt', out: 1.05, social: 0.4 },
    { id: 'sosyal', name: 'Sosyal kelebek', social: 1.8, out: 0.97 },
    { id: 'mukemmel', name: 'Mükemmeliyetçi', bugs: 0.7, stress: 1.2 },
    { id: 'tembel', name: 'Tembel', out: 0.85, stress: 0.6 },
    { id: 'sadik', name: 'Sadık', quit: 0.3 },
    { id: 'hirsli', name: 'Hırslı', out: 1.1, quit: 1.4, moraleSelf: -0.3 },
    { id: 'meraki', name: 'Teknoloji meraklısı', research: 1.4 },
    { id: 'kiskanc', name: 'Kıskanç', social: 0.6, rival: true },
  ],
  traitChance2: 0.35, // ikinci huy olasılığı (MGT: iki özellik)

  // Yetenek setleri (MGT esinli, P): genel beceri + 8 yetenek. Uzmanlık alanı yüksek, diğerleri düşük.
  // Çıktı çarpanı = (yetenek / geliştirme yeteneklerinin ortalaması)^kExp → ortalama aynı, uzmanlık dağılımı önemli.
  skills: {
    _tag: 'P',
    keys: [['tasarim', 'Oyun tasarımı', 'oyn'], ['program', 'Programlama', 'tek'], ['grafik', 'Grafik', 'gfx'], ['ses', 'Ses', 'ses'],
      ['test', 'Test'], ['pazar', 'Pazarlama'], ['arge', 'Araştırma'], ['donanim', 'Donanım']],
    specHi: [1.05, 1.3], secondary: [0.85, 1.05], other: [0.5, 0.9], kExp: 0.8, kMin: 0.5, kMax: 1.6,
  },

  // Tatil (GDT/GDS esinli, P): yıllık izin hakkı birikir; aynı anda izne çıkanlar sınırlıdır, çakışınca biri reddedilir.
  vacation: {
    _tag: 'P',
    perYear: 3, stressWant: 58, dueWant: 2, askChance: 0.3, weeks: [1, 2],
    policies: {
      serbest: { name: 'Serbest', cap: 0.34, perRoom: false, desc: 'İsteyen gider. Üretim dalgalanır ama herkes dinç.' },
      planli: { name: 'Planlı', cap: 0.2, perRoom: true, desc: 'Aynı odadan aynı anda tek kişi. Çakışan istek reddedilir.' },
      yasak: { name: 'Yasak', cap: 0, perRoom: true, desc: 'Kimse tatile çıkamaz. Stres ve tükenmişlik artar.' },
    },
    deniedMorale: -5, deniedStress: 3, backMorale: 10, backStress: -40, banBurnout: 1.8, banMorale: -4, conflictRel: -8,
  },

  // Çalışan ilişkileri (derin mekanik 1, P): aynı odada çalışanlar arasında dostluk/rekabet; verim ve morale yansır.
  relations: {
    _tag: 'P',
    drift: 0.35, crunchDrift: -0.5, toxicDrift: -1.6, rivalDrift: -0.8, outK: 0.1, moraleK: 8,
    eventChance: 0.05, fight: -25, friend: 18, enemyAt: -45, friendAt: 45, enemyStress: 1.5,
  },

  // Ofis tasarımları (P): her binanın kendi tasarımı; ucuz olan verimi düşürür, konforlu olan morali yükseltir.
  designs: [
    { id: 'standart', name: 'Standart', cost: 0, rentMult: 1, speed: 1, morale: 0, stress: 1, wall: null, floor: null, desc: 'Gri halı, gri masa, gri hayaller.' },
    { id: 'plastik', name: 'Ucuz plastik', cost: 0, rentMult: 0.85, speed: 0.9, morale: -6, stress: 1.1, wall: '#5a5148', floor: '#4b4a3e', desc: 'Sallanan masalar, cızırtılı floresan. Kira düşük, verim de.' },
    { id: 'ergonomik', name: 'Ergonomik verim', cost: 20000, rentMult: 1.1, speed: 1.12, morale: -1, stress: 1.05, wall: '#3e5a66', floor: '#33505c', desc: 'Ayarlı masalar, çift monitör, sessiz klavye. Hız odaklı.' },
    { id: 'konfor', name: 'Konfor köşesi', cost: 25000, rentMult: 1.15, speed: 1, morale: 8, stress: 0.85, wall: '#6b4f5e', floor: '#5c4452', desc: 'Puf, bitki, kahve makinesi. Moral yüksek, stres düşük.' },
    { id: 'luks', name: 'Lüks tasarım', cost: 60000, rentMult: 1.4, speed: 1.07, morale: 12, stress: 0.8, wall: '#6b5a2e', floor: '#4c4128', prestige: 0.05, desc: 'Mermer, neon tabela, meyve barı. Ziyaretçiler etkilenir.' },
  ],

  // Şirket değeri ve halka arz (derin mekanik 2, P): değerleme, hisse, çeyreklik hedefler, yönetim kurulu baskısı.
  ipo: {
    _tag: 'P',
    minValuation: 4000000, minTier: 3, minWeeks: 240, profitMult: 7, fanValue: 2.5, ipK: 300000, prestigeK: 400000,
    sellPcts: [0.1, 0.25, 0.4], discount: 0.9, shares: 1000000, quarterWeeks: 12, growthTarget: 0.025, pressureDecay: 4,
    beatSent: 1.06, missSent: 0.93, pressureMissK: 40, pressureBeat: -12, boardAt: 60, fireAt: 100,
    dividendShare: 0.1, dividendSent: 1.04, dividendPressure: -15, buybackPremium: 1.1, sentMin: 0.4, sentMax: 2.5,
    excluded: ['sermaye', 'kredi', 'halka_arz', 'temettu', 'geri_alim'],
  },
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
    // --- 80'ler ve 90'lar
    { id: 'salon_siparis', title: 'Oyun Salonu Siparişi', text: 'Mahalledeki oyun salonunun sahibi, kabinlerine özel bir oyun istiyor. Peşin ödüyor, jeton kokulu banknotlarla.', when: { minYear: 1978, maxYear: 1996, minStaff: 1 },
      choices: [{ label: 'Kabul, iki haftada yaparız', effects: { cash: 6000, progress: -1, stress: 6 } }, { label: 'Kendi oyunumuza odaklanalım', effects: { morale: 3 } }] },
    { id: 'kaset_kopya', title: 'Kaset Kopyalama Furyası', text: 'Okul bahçelerinde çift kasetçalarlarla oyunun kopyalanıyor. Teyp başına bir çocuk.', when: { minYear: 1980, maxYear: 1992, hasActiveGame: true },
      choices: [{ label: 'Kopyaya karşı ses koruması ekle', effects: { cash: -4000, salesMult: { mult: 0.95, weeks: 8 } } }, { label: 'Hiç değilse bilinirlik', effects: { salesMult: { mult: 0.8, weeks: 8 }, fans: 2500 } }] },
    { id: 'dergi_kapak', title: 'Dergi Kapağı', text: 'Bir oyun dergisi son oyununu kapağa taşımak istiyor. Fotoğraf için ekibin "havalı" görünmesi lazım.', when: { minYear: 1982, maxYear: 2006, hasReleased: true },
      choices: [{ label: 'Güneş gözlükleriyle poz ver', effects: { hype: 12, fans: 4000, morale: 5 } }, { label: 'Kapağa ilan parası öde', effects: { cash: -8000, hype: 20 } }] },
    { id: 'demo_sahne', title: 'Demo Sahnesinden Bir Dâhi', text: '16 yaşında bir demo sahnesi kodcusu 4 KB\'lık efektini gösterdi. Ekibin ağzı açık kaldı.', when: { minYear: 1985, maxYear: 2002, minStaff: 2 },
      choices: [{ label: 'Ona akıl hocalığı yap', effects: { skillTop: 4, rp: 15 } }, { label: 'Motorumuza efekt satın al', effects: { cash: -6000, rp: 30 } }] },
    { id: 'bbs', title: 'BBS Hayran Kulübü', text: 'Modemle bağlanılan bir ilan tahtasında oyunun için hayran kulübü kurulmuş. Gece 2\'de 14 kişi çevrimiçi.', when: { minYear: 1986, maxYear: 1999, hasReleased: true },
      choices: [{ label: 'Gizli kimlikle katıl', effects: { fans: 3000, morale: 4 } }, { label: 'Resmî duyuru yap', effects: { fans: 5000, kaos: 3 } }] },
    { id: 'cd_kapak', title: 'Kapakta Yazım Hatası', text: 'CD kutularının 50.000 tanesinde oyunun adı yanlış basıldı. Koleksiyoncular bayram ediyor.', when: { minYear: 1993, maxYear: 2010, hasActiveGame: true },
      choices: [{ label: 'Hepsini yeniden bas', effects: { cash: -20000 } }, { label: 'Koleksiyon sürümü de', effects: { fans: 3000, prestige: -0.2 } }] },
    { id: 'y2k', title: '2000 Yılı Böceği', text: 'Muhasebe yazılımı 1 Ocak 2000\'de 1900 yılına dönebilir. Danışman korkunç bir fatura kesti.', when: { minYear: 1998, maxYear: 2000 },
      choices: [{ label: 'Danışmana öde', effects: { cash: -15000 } }, { label: 'Ekip düzeltir', effects: { progress: -1, rp: 10 } }, { label: 'Risk al', effects: { chance: { p: 0.6, yes: { news: 'Hiçbir şey olmadı. Danışman da şaşırdı.' }, no: { cash: -40000, kaos: 8, news: 'Maaş bordrosu 100 yıllık kıdem tazminatı hesapladı.' } } } }] },
    { id: 'lan_parti', title: 'LAN Partisi', text: 'Ekip hafta sonu ofiste LAN partisi istiyor. 40 bilgisayar, 4 sigorta, 1 cesur elektrikçi.', when: { minYear: 1996, maxYear: 2012, minStaff: 4 },
      choices: [{ label: 'Pizza benden!', effects: { cash: -3000, morale: 10, relPair: 20 } }, { label: 'Sigortalar dayanmaz', effects: { morale: -4 } }] },
    { id: 'demo_disk', title: 'Dergi Demo Diski', text: 'Bir dergi bir sonraki sayısının CD\'sine oyununun demosunu koymak istiyor.', when: { minYear: 1994, maxYear: 2009, hasProject: true },
      choices: [{ label: 'Demo hazırla', effects: { progress: -1, hype: 18 } }, { label: 'Erken, hazır değil', effects: {} }] },
    { id: 'emulator', title: 'Emülatör Çıktı', text: 'Biri konsolunun emülatörünü yazdı. Oyunlar bilgisayarda bedava dönüyor.', when: { minYear: 1997, hasConsole: true },
      choices: [{ label: 'Dava aç', effects: { cash: -30000, chance: { p: 0.5, yes: { news: 'Emülatör kapandı.' }, no: { consoleMult: { mult: 0.85, weeks: 24 }, news: 'Mahkeme "tersine mühendislik serbest" dedi.' } } } }, { label: 'Sessiz kal', effects: { consoleMult: { mult: 0.9, weeks: 24 }, fans: 3000 } }] },
    // --- 2000'ler ve sonrası
    { id: 'mod_topluluk', title: 'Mod Topluluğu', text: 'Hayranlar oyununa 200 yeni bölüm ve bir de dans eden at ekledi.', when: { minYear: 2000, hasReleased: true },
      choices: [{ label: 'Mod araçlarını yayınla', effects: { progress: -1, fansPct: 0.04, salesMult: { mult: 1.15, weeks: 12 } } }, { label: 'Telif uyarısı gönder', effects: { fansPct: -0.03, kaos: 4 } }] },
    { id: 'hizkosu', title: 'Hız Koşucuları', text: 'Bir hız koşucusu oyununu duvarın içinden geçerek 4 dakikada bitirdi. Hata mı, özellik mi?', when: { minYear: 2005, hasReleased: true },
      choices: [{ label: 'Hatayı yamala', effects: { cash: -5000, fans: -1000 } }, { label: '"Özellik" de', effects: { fans: 4000, hype: 6 } }] },
    { id: 'gun1_yama', title: 'İlk Gün Yaması', text: 'Oyun 18 GB\'lık bir ilk gün yamasıyla çıkacak. Forumlarda öfke var.', when: { minYear: 2009, hasProject: true },
      choices: [{ label: 'Yamayı yayın tarihinden önce bitir', effects: { progress: -1, stress: 8 } }, { label: 'Umursama', effects: { fansPct: -0.02, kaos: 4 } }] },
    { id: 'kitle_fonlama', title: 'Kitle Fonlama Kampanyası', text: 'Ekip bir sonraki oyunu için kitle fonlama kampanyası açmayı öneriyor. Ödül kademelerinden biri "geliştiricilerle pizza".', when: { minYear: 2012, maxYear: 2022, minFans: 10000 },
      choices: [{ label: 'Kampanyayı aç', effects: { chance: { p: 0.65, yes: { cash: 120000, hype: 15, news: 'Hedef ilk 3 günde aşıldı!' }, no: { fansPct: -0.03, news: 'Kampanya hedefin %40\'ında kaldı.' } } } }, { label: 'Kendi paramızla yaparız', effects: {} }] },
    { id: 'erken_erisim', title: 'Erken Erişim', text: 'Bitmemiş oyunu erken erişimde satmak hem para hem geri bildirim getirebilir. Ya da hayal kırıklığı.', when: { minYear: 2013, hasProject: true },
      choices: [{ label: 'Erken erişime aç', effects: { cash: 30000, bugsPct: -0.1, chance: { p: 0.7, yes: { hype: 10 }, no: { fansPct: -0.04, news: 'Oyuncular "yarım oyun" yorumları yazdı.' } } } }, { label: 'Bitince çıksın', effects: {} }] },
    { id: 'fenomen_sponsor', title: 'Sponsorlu Yayın Teklifi', text: 'Milyonlarca takipçisi olan bir yayıncı, oyununu sponsorlu yayında oynamak için ücret istiyor.', when: { minYear: 2012, hasActiveGame: true },
      choices: [{ label: 'Öde', effects: { cash: -25000, salesMult: { mult: 1.3, weeks: 6 } } }, { label: 'Organik büyüme', effects: {} }] },
    { id: 'espor', title: 'E-spor Turnuvası', text: 'Bir organizasyon oyununla ödüllü turnuva yapmak istiyor. Ödül havuzunu sen koyacaksın.', when: { minYear: 2008, hasActiveGame: true },
      choices: [{ label: 'Ödül havuzunu koy', effects: { cash: -30000, fans: 12000, hype: 10 } }, { label: 'Bu bir parti oyunu, hayır', effects: {} }] },
    { id: 'meme', title: 'Oyunun Meme Oldu', text: 'Bir karakterin garip yüz ifadesi internetin en çok paylaşılan görseli oldu.', when: { minYear: 2008, hasReleased: true },
      choices: [{ label: 'Tişörtünü bas', effects: { cash: 12000, fans: 5000 } }, { label: 'Yüzü düzelt', effects: { cash: -3000, fans: -2000 } }] },
    { id: 'seslendirme_grev', title: 'Seslendirme Grevi', text: 'Seslendirme sanatçıları sendikası, yapay zekâ ile ses kopyalamaya karşı greve gitti.', when: { minYear: 2016, hasProject: true },
      choices: [{ label: 'Sözleşmeye YZ yasağı koy', effects: { cash: -10000, prestige: 0.3 } }, { label: 'Grev bitene kadar bekle', effects: { progress: -2 } }, { label: 'Sentetik sesle devam', effects: { fansPct: -0.06, kaos: 8 } }] },
    { id: 'yz_asistan', title: 'Kod Asistanı', text: 'Ekipten biri yapay zekâ kod asistanı lisansı istiyor. "Testleri o yazsın, ben düşüneyim."', when: { minYear: 2022, minStaff: 3 },
      choices: [{ label: 'Lisansları al', effects: { cash: -8000, progress: 1, bugsPct: 0.05 } }, { label: 'El yapımı kod', effects: { morale: 3 } }] },
    // --- tatil
    { id: 'tatil_cakisma', title: 'Tatil Çakışması', text: 'Aynı odadan iki kişi aynı haftaya bilet almış. İkisi de "İptal edilemez" diyor.', when: { vacPolicy: 'planli', minStaff: 4 },
      choices: [{ label: 'İkisi de gitsin', effects: { vacOne: 2, progress: -1, morale: 4 } }, { label: 'Kıdemli olan gitsin', effects: { relPair: -25, morale: -3 } }, { label: 'Yazı tura at', effects: { relPair: -10 } }] },
    { id: 'tatil_protesto', title: 'Tatil Yasağı Protestosu', text: 'Ekip kafeteryaya "Biz de insanız" pankartı astı. Kahve makinesinin üstünde bile var.', when: { vacPolicy: 'yasak', minStaff: 4 },
      choices: [{ label: 'Yasağı kaldır', effects: { morale: 12, stress: -10 } }, { label: 'Bonus öde, yasak sürsün', effects: { cash: -15000, morale: 4 } }, { label: 'Pankartları indir', effects: { morale: -15, quit: 1, kaos: 8 } }] },
    { id: 'tatil_kartpostal', title: 'Tatilden Kartpostal', text: 'Tatildeki çalışanın kartpostal yolladı: "Deniz piksel gibi değil, gerçekmiş!"', when: { onVacation: true },
      choices: [{ label: 'Panoya as', effects: { morale: 4 } }] },
    // --- ilişkiler
    { id: 'ofis_ask', title: 'Ofis Aşkı', text: 'İki çalışanın kod incelemesi yorumları şüpheli derecede kalpli emojili.', when: { hasFriends: true, minStaff: 4 },
      choices: [{ label: 'Mutlu olsunlar', effects: { morale: 5, relPair: 15 } }, { label: 'Kurallar kurallardır', effects: { morale: -6, relPair: -20 } }] },
    { id: 'kavga_mudahale', title: 'Ofiste Soğuk Savaş', text: 'İki çalışan birbirine yalnızca resmî e-postayla yazıyor, hepsinde "saygılarımla" ve üç ünlem var.', when: { hasEnemies: true },
      choices: [{ label: 'Arabulucu tut', effects: { cash: -6000, relPair: 40 } }, { label: 'Kendi aralarında çözsünler', effects: { stress: 4, kaos: 4 } }] },
    { id: 'dedikodu', title: 'Dedikodu Kanalı', text: 'Biri gizli bir sohbet kanalı açmış: #maaşlar. Herkes herkesin maaşını öğrendi.', when: { minStaff: 6 },
      choices: [{ label: 'Maaşları şeffaflaştır, eşitle', effects: { salaryPct: 0.04, morale: 8 } }, { label: 'Kanalı kapat', effects: { morale: -10, kaos: 6 } }] },
    // --- ofis tasarımı
    { id: 'plastik_sandalye', title: 'Sandalye Kırıldı', text: 'Ucuz plastik sandalye, toplantının ortasında yönetmenin altında un ufak oldu.', when: { design: 'plastik' },
      choices: [{ label: 'Hepsini yenile', effects: { cash: -5000, morale: 4 } }, { label: 'Gülüp geç', effects: { morale: -4, stress: 3 } }] },
    { id: 'luks_ziyaret', title: 'Yatırımcı Gezisi', text: 'Lüks ofisini gören yatırımcılar neon tabelanın önünde fotoğraf çektirdi.', when: { design: 'luks' },
      choices: [{ label: 'Gezdir, etkile', effects: { prestige: 0.3, sent: 0.05, hype: 5 } }] },
    { id: 'bitki', title: 'Bitkiler Konuşuyor', text: 'Konfor köşesindeki bitkiler o kadar büyüdü ki birinin masasını yuttu. Adı artık "Orman".', when: { design: 'konfor' },
      choices: [{ label: 'Bahçıvan tut', effects: { cash: -2000, stress: -6 } }, { label: 'Orman kalsın', effects: { morale: 6 } }] },
    // --- odalar
    { id: 'qa_bulgu', title: 'Kalite Güvenceden Alarm', text: 'Test ekibi, oyunun kaydederken kaydı sildiği ölümcül bir hata buldu.', when: { hasRoom: 'qa', hasProject: true },
      choices: [{ label: 'Hemen düzelt', effects: { progress: -1, bugsPct: -0.15 } }, { label: 'Sonra bakarız', effects: { bugsPct: 0.1 } }] },
    { id: 'musteri_cagri', title: 'Destek Hattı Taştı', text: 'Müşteri destek ekibi günde 2.000 çağrı alıyor. Çoğu "nasıl atlarım?" diye soruyor.', when: { hasRoom: 'musteri', hasActiveGame: true },
      choices: [{ label: 'Yardım sayfası hazırla', effects: { cash: -4000, fans: 3000 } }, { label: 'Telesekreter', effects: { fansPct: -0.02 } }] },
    { id: 'pazarlama_fikir', title: 'Pazarlamanın Çılgın Fikri', text: 'Pazarlama ekibi oyunun maskotunu dev bir balonla şehrin üstünde uçurmak istiyor.', when: { hasRoom: 'pazarlama', hasProject: true },
      choices: [{ label: 'Uçur!', effects: { cash: -20000, chance: { p: 0.7, yes: { hype: 30, news: 'Balon her yerde konuşuldu.' }, no: { kaos: 10, hype: 10, news: 'Balon havaalanına sürüklendi. Yine de konuşuldu.' } } } }, { label: 'Afiş yeter', effects: { hype: 4 } }] },
    { id: 'arastirma_atilim', title: 'Araştırmada Atılım', text: 'Araştırma odası gece yarısı "Buldum!" diye bağırdı. Ne bulduklarını kimse anlamadı ama heyecanlılar.', when: { hasRoom: 'arastirma' },
      choices: [{ label: 'Ödül ver', effects: { cash: -5000, rp: 40, morale: 5 } }, { label: 'Raporunu bekle', effects: { rp: 20 } }] },
    { id: 'mola_turnuva', title: 'Mola Odası Turnuvası', text: 'Mola odasındaki dövüş oyunu turnuvası gerçek bir rekabete dönüştü.', when: { hasRoom: 'mola', minStaff: 4 },
      choices: [{ label: 'Kupa al', effects: { cash: -500, morale: 6, relPair: 15 } }, { label: 'Mesai saatinde yasak', effects: { morale: -5 } }] },
    // --- donanım
    { id: 'konsol_ariza', title: 'Kırmızı Işık Arızası', text: 'Konsolların bir kısmında aşırı ısınma var. Forumlarda "havluya sar" önerileri dolaşıyor.', when: { hasConsole: true },
      choices: [{ label: 'Garantiyi uzat, geri çağır', effects: { cash: -120000, prestige: 0.2 } }, { label: 'Kullanıcı hatası de', effects: { consoleMult: { mult: 0.7, weeks: 20 }, fansPct: -0.06, kaos: 10 } }] },
    { id: 'konsol_ozel', title: 'Özel Oyun Teklifi', text: 'Büyük bir yayıncı, yeni oyununu yalnızca senin konsoluna çıkarmak için pazarlık yapıyor.', when: { hasConsole: true, minYear: 1985 },
      choices: [{ label: 'Pazarlık parasını öde', effects: { cash: -80000, consoleMult: { mult: 1.4, weeks: 24 } } }, { label: 'Gerek yok', effects: {} }] },
    { id: 'konsol_stok', title: 'Stok Krizi', text: 'Çip tedarikçisi teslimatları erteledi. Mağazalarda konsol bulunmuyor, karaborsada iki katına satılıyor.', when: { hasConsole: true },
      choices: [{ label: 'Hava kargo öde', effects: { cash: -60000 } }, { label: 'Kıtlık da reklam', effects: { consoleMult: { mult: 0.6, weeks: 8 }, hype: 12 } }] },
    { id: 'konsol_fiyat', title: 'Rakip Fiyat Kırdı', text: 'Rakip konsol fiyatını %30 indirdi. Mağaza vitrinleri değişti.', when: { hasConsole: 'konsol' },
      choices: [{ label: 'Biz de indirelim', effects: { cash: -50000, consoleMult: { mult: 1.1, weeks: 20 } } }, { label: 'Kaliteye güveniyoruz', effects: { consoleMult: { mult: 0.8, weeks: 20 } } }] },
    { id: 'salon_ariza', title: 'Kabinler Arızalandı', text: 'Salon makinelerinin jeton haznesi tıkandı. Çocuklar makineyi tekmeliyor.', when: { hasConsole: 'salon' },
      choices: [{ label: 'Servis ekibi gönder', effects: { cash: -15000 } }, { label: 'Tekme de bir çözüm', effects: { consoleMult: { mult: 0.8, weeks: 12 }, kaos: 4 } }] },
    // --- borsa
    { id: 'aktivist', title: 'Aktivist Yatırımcı', text: 'Bir yatırım fonu hisselerin %5\'ini topladı ve yönetim kurulunda koltuk istiyor.', when: { listed: true },
      choices: [{ label: 'Koltuk ver', effects: { board: 15, sent: 0.06 } }, { label: 'Reddet', effects: { board: 8, sent: -0.08 } }] },
    { id: 'hisse_forum', title: 'Forum Coşkusu', text: 'Bir yatırım forumu hisseni "aya gidecek" ilan etti. Kimse nedenini bilmiyor.', when: { listed: true },
      choices: [{ label: 'Keyfini çıkar', effects: { sent: 0.2, kaos: 4 } }, { label: 'Temkinli açıklama yap', effects: { sent: 0.05 } }] },
    { id: 'satin_alma_teklif', title: 'Devralma Teklifi', text: 'Dev bir yayıncı şirketini satın almak istiyor. Kurul heyecanlı, ekip tedirgin.', when: { listed: true, minStaff: 10 },
      choices: [{ label: 'Bağımsızız', effects: { board: 12, morale: 10 } }, { label: 'Pazarlık süsü ver', effects: { sent: 0.15, morale: -6 } }] },

  ],
};
