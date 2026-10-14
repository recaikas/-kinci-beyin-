// Yayıncı profilleri (Konu B). Tarihî şirketlerin gücü history.js'teki itibardan gelir; burada yalnız kimlik:
// bölge (na, eu, jp, row), platform odağı (salon, konsol, pc, el, mobil, vr, bulut) ve huy.
// Tür zevki tarihî hit oyunlardan hesaplanır (publishers.js sistem dosyası); yenilerde elle verilir.
// Tüm adlar oyunun kendi parodi ya da kurgusal adlarıdır.
export const TRAITS = {
  cimri: { name: 'Cimri', pay: -2, adv: 0.5, ceil: -2, desc: 'Pay az, avans yarı yarıya; sözünden dönmez.' },
  comert: { name: 'Cömert', pay: 2, adv: 1.1, decay: 4, ceil: 2, desc: 'Pay iyi; ilişki bozulunca çabuk soğur.' },
  burokratik: { name: 'Bürokratik', need: 4, slow: 2, lateK: 2, desc: 'Karar yavaş, kurul oybirliği ister, gecikmeyi affetmez.' },
  kumarbaz: { name: 'Kumarbaz', need: 2, adv: 1.5, flopK: 2, e: -10, desc: 'Herkese şans verir, büyük avans; batan oyunu unutmaz.' },
  seri: { name: 'Seri avcısı', rights: true, desc: 'Seri haklarını ister; verirsen pay +3.' },
  sadik: { name: 'Sadık', decay: 1, loyal: 2, desc: 'İlişki yavaş düşer; başka yayıncıya gitmeni sevmez.' },
  kaprisli: { name: 'Kaprisli', jitter: 5, withdraw: 0.3, desc: 'Teklifleri oynar, son dakika istekleri olur.' },
  vizyoner: { name: 'Vizyoner', novel: 10, desc: 'Yeni ve cesur tür–konu eşleşmelerine bayılır.' },
};

// Tarihî yayıncılar (history.js'te kind içinde 'pub' olanlar)
export const HIST_PROFILES = {
  ataro: { region: ['na'], focus: ['salon', 'konsol', 'pc'], trait: 'cimri' },
  yariyol: { region: ['na'], focus: ['salon', 'pc'], trait: 'sadik' },
  namko: { region: ['jp'], focus: ['salon', 'konsol'], trait: 'sadik' },
  bandajnamko: { region: ['jp'], focus: ['konsol', 'el', 'mobil'], trait: 'seri', tasteFrom: 'namko' },
  segga: { region: ['jp', 'eu'], focus: ['salon', 'konsol'], trait: 'kaprisli' },
  pandando: { region: ['jp', 'na'], focus: ['konsol', 'el'], trait: 'burokratik' },
  aktivasyon: { region: ['na'], focus: ['konsol', 'pc'], trait: 'seri' },
  siradag: { region: ['na'], focus: ['pc'], trait: 'vizyoner' },
  kapkom: { region: ['jp'], focus: ['salon', 'konsol'], trait: 'seri' },
  konamii: { region: ['jp'], focus: ['konsol', 'salon'], trait: 'burokratik' },
  elektronik: { region: ['na', 'eu'], focus: ['pc', 'konsol'], trait: 'burokratik' },
  mikroduzyazi: { region: ['na'], focus: ['pc'], trait: 'vizyoner' },
  eniks: { region: ['jp'], focus: ['konsol', 'pc'], trait: 'sadik' },
  psiknoz: { region: ['eu'], focus: ['pc', 'konsol'], trait: 'kumarbaz' },
  kare: { region: ['jp'], focus: ['konsol'], trait: 'burokratik' },
  kareeniks: { region: ['jp'], focus: ['konsol', 'el', 'mobil'], trait: 'burokratik', tasteFrom: 'kare' },
  ubisof: { region: ['eu'], focus: ['konsol', 'pc'], trait: 'seri' },
  kodustalari: { region: ['na'], focus: ['pc'], trait: 'comert' },
  betesta: { region: ['na'], focus: ['pc', 'konsol'], trait: 'vizyoner' },
  alkis: { region: ['na'], focus: ['konsol', 'pc'], trait: 'kumarbaz' },
  tehaku: { region: ['jp', 'na'], focus: ['konsol', 'el'], trait: 'cimri' },
  eidoz: { region: ['eu'], focus: ['pc', 'konsol'], trait: 'kaprisli' },
  destan: { region: ['na'], focus: ['pc'], trait: 'comert' },
  soni: { region: ['jp', 'na', 'eu'], focus: ['konsol', 'el'], trait: 'burokratik' },
  vana: { region: ['row', 'na', 'eu'], focus: ['pc'], trait: 'comert' },
  kayastar: { region: ['na', 'eu'], focus: ['konsol', 'pc'], trait: 'kaprisli' },
  mikroyumusak: { region: ['na'], focus: ['pc', 'konsol'], trait: 'burokratik' },
};

const ALL = ['salon', 'konsol', 'pc', 'el', 'mobil', 'vr', 'bulut'];
// Sabit ve yeni (kurgusal) yayıncılar: güç yıla göre [[yıl, güç]].
export const EXTRA_PUBS = [
  { id: 'mantar', name: 'Kırmızı Mantar', from: 1976, to: 2200, power: [[1976, 55]], region: ['na'], focus: ALL, trait: 'kumarbaz', likes: [], dislike: null, fixed: true },
  { id: 'morayi', name: 'Mor Ayı Indie', from: 2008, to: 2200, power: [[2008, 60]], region: ['row'], focus: ['pc', 'mobil'], trait: 'comert', likes: ['casual', 'macera'], dislike: null, fixed: true },
  { id: 'postakutusu', name: 'Posta Kutusu Yazılım', from: 1977, to: 1992, power: [[1977, 38], [1984, 50], [1992, 40]], region: ['na'], focus: ['pc'], trait: 'sadik', likes: ['macera'], dislike: 'aksiyon' },
  { id: 'tektus', name: 'Tek Tuş Yapım', from: 1978, to: 1989, power: [[1978, 42], [1983, 52], [1989, 38]], region: ['na'], focus: ['salon', 'pc'], trait: 'kumarbaz', likes: ['aksiyon'], dislike: 'strateji' },
  { id: 'kasetpazari', name: 'Kaset Pazarı', from: 1980, to: 1994, power: [[1980, 45], [1986, 56], [1994, 42]], region: ['eu'], focus: ['pc'], trait: 'cimri', likes: ['aksiyon', 'casual'], dislike: 'rpg' },
  { id: 'sakura', name: 'Sakura Disket', from: 1981, to: 1998, power: [[1981, 40], [1990, 55], [1998, 45]], region: ['jp'], focus: ['pc', 'konsol'], trait: 'vizyoner', likes: ['rpg', 'macera'], dislike: 'simulasyon' },
  { id: 'kuzeyruzgari', name: 'Kuzey Rüzgârı Yazılım', from: 1983, to: 2003, power: [[1983, 42], [1993, 58], [2003, 48]], region: ['eu'], focus: ['pc'], trait: 'burokratik', likes: ['strateji', 'simulasyon'], dislike: 'casual' },
  { id: 'atlas', name: 'Atlas Etkileşim', from: 1983, to: 2010, power: [[1983, 55], [1997, 74], [2010, 60]], region: ['na'], focus: ['pc', 'konsol'], trait: 'burokratik', likes: ['simulasyon'], dislike: 'macera' },
  { id: 'gumusdisket', name: 'Gümüş Disket', from: 1984, to: 1999, power: [[1984, 44], [1991, 57], [1999, 45]], region: ['eu'], focus: ['pc'], trait: 'kaprisli', likes: ['aksiyon'], dislike: 'simulasyon' },
  { id: 'anadolukartus', name: 'Anadolu Kartuş', from: 1985, to: 1996, power: [[1985, 36], [1990, 44], [1996, 34]], region: ['row'], focus: ['konsol', 'pc'], trait: 'kumarbaz', likes: [], dislike: null },
  { id: 'maviay', name: 'Mavi Ay Eğlence', from: 1986, to: 2012, power: [[1986, 58], [1998, 72], [2012, 60]], region: ['jp'], focus: ['konsol', 'el'], trait: 'kaprisli', likes: ['aksiyon', 'casual'], dislike: 'strateji' },
  { id: 'kale', name: 'Kale Yazılım', from: 1987, to: 2008, power: [[1987, 56], [1997, 70], [2008, 58]], region: ['eu'], focus: ['pc'], trait: 'seri', likes: ['strateji', 'rpg'], dislike: 'casual' },
  { id: 'dergiekleri', name: 'Dergi Ekleri', from: 1988, to: 2002, power: [[1988, 40], [1995, 48], [2002, 38]], region: ['eu'], focus: ['pc'], trait: 'cimri', likes: [], dislike: null },
  { id: 'disketkulubu', name: 'Disket Kulübü', from: 1990, to: 2006, power: [[1990, 42], [1997, 55], [2006, 40]], region: ['row', 'na'], focus: ['pc'], trait: 'comert', likes: ['aksiyon', 'macera'], dislike: 'simulasyon' },
  { id: 'bolumbir', name: 'Bölüm Bir Yazılım', from: 1991, to: 2004, power: [[1991, 45], [1996, 56], [2004, 42]], region: ['na'], focus: ['pc'], trait: 'kumarbaz', likes: ['aksiyon'], dislike: 'strateji' },
  { id: 'geceyarisi', name: 'Gece Yarısı Yayınları', from: 1993, to: 2009, power: [[1993, 44], [2001, 54], [2009, 42]], region: ['eu'], focus: ['pc', 'konsol'], trait: 'vizyoner', likes: ['macera'], dislike: 'casual' },
  { id: 'turuncukutu', name: 'Turuncu Kutu', from: 1995, to: 2015, power: [[1995, 60], [2005, 72], [2015, 58]], region: ['na'], focus: ['konsol', 'pc'], trait: 'cimri', likes: ['aksiyon'], dislike: 'strateji' },
  { id: 'yuksekskor', name: 'Yüksek Skor Dağıtım', from: 1998, to: 2020, power: [[1998, 60], [2008, 70], [2020, 58]], region: ['row', 'na', 'eu'], focus: ['konsol', 'el'], trait: 'cimri', likes: ['casual', 'aksiyon'], dislike: 'rpg' },
  { id: 'sehirisiklari', name: 'Şehir Işıkları Dağıtım', from: 2002, to: 2200, power: [[2002, 42], [2015, 55], [2025, 52]], region: ['jp'], focus: ['pc', 'konsol'], trait: 'sadik', likes: ['rpg'], dislike: 'simulasyon' },
  { id: 'nordik', name: 'Nordik Oyun Evi', from: 2005, to: 2200, power: [[2005, 58], [2015, 70], [2025, 68]], region: ['eu'], focus: ['pc', 'konsol'], trait: 'sadik', likes: ['strateji', 'macera'], dislike: 'casual' },
  { id: 'cepyayin', name: 'Cep Yayın', from: 2009, to: 2200, power: [[2009, 60], [2015, 74], [2025, 66]], region: ['row'], focus: ['mobil'], trait: 'kaprisli', likes: ['casual'], dislike: 'rpg' },
  { id: 'kirikpiksel', name: 'Kırık Piksel Yayıncılık', from: 2012, to: 2200, power: [[2012, 45], [2020, 58], [2025, 56]], region: ['row'], focus: ['pc'], trait: 'vizyoner', likes: ['macera'], dislike: 'aksiyon' },
  { id: 'yenidalga', name: 'Yeni Dalga Etkileşim', from: 2015, to: 2200, power: [[2015, 60], [2025, 79]], region: ['row', 'na'], focus: ['pc', 'konsol'], trait: 'seri', likes: ['macera', 'strateji'], dislike: null },
  { id: 'bulutabone', name: 'Bulut Abone Yayın', from: 2018, to: 2200, power: [[2018, 66], [2025, 76]], region: ['row', 'na', 'eu'], focus: ['pc', 'konsol', 'bulut'], trait: 'burokratik', likes: ['casual', 'aksiyon'], dislike: null },
];

// Tarihî birleşmeler: ilişki puanları birleşen şirkete taşınır.
export const MERGERS = [
  { from: ['eniks', 'kare'], to: 'kareeniks' },
  { from: ['namko'], to: 'bandajnamko' },
];

// Toplantı soruları (B3). Her seçenek kurul üyelerine puan ekler; bluff: gerçeğe uymayan cevap.
export const MEETING_QUESTIONS = [
  { id: 'kitle', q: 'Oyununuz kime hitap ediyor?', who: 'pazar' },
  { id: 'butce', q: 'Bütçe aşılırsa ne yaparsınız?', who: 'finans', traits: ['burokratik', 'cimri'] },
  { id: 'tarih', q: 'Oyun ne zaman biter?', who: 'finans', traits: ['burokratik'] },
  { id: 'neden', q: 'Bu türde neden sizi seçelim?', who: 'urun', traits: ['vizyoner', 'kumarbaz'] },
  { id: 'rakip', q: 'Aynı ay büyük bir oyun çıkıyor. Ne düşünüyorsunuz?', who: 'pazar', traits: ['kaprisli', 'seri'] },
  { id: 'yangin', q: 'Ofisinizde işlerin biraz… karıştığı doğru mu?', who: 'finans', chaos: true },
];

// Vitrin etkinlikleri (B5): ay indeksi 0–11
export const SHOWCASES = [
  { id: 'dergi', name: 'Dergi programlama yarışması', from: 1977, to: 1990, month: 2, people: 1, weeks: 2, skill: 'oyn', entrants: [[1977, 60], [1990, 300]] },
  { id: 'demo', name: 'Demo partisi', from: 1987, to: 2000, month: 7, people: 2, weeks: 1, skill: 'tek', entrants: [[1987, 40], [2000, 200]], focus: 'pc' },
  { id: 'mod', name: 'Mod sahnesi', from: 1996, to: 2010, month: 5, people: 1, weeks: 3, skill: 'oyn', entrants: [[1996, 100], [2010, 2000]] },
  { id: 'festival', name: 'Bağımsız oyun festivali', from: 1999, to: 2200, month: 2, people: 0, weeks: 0, skill: null, entrants: [[1999, 150], [2025, 1500]] },
  { id: 'maraton', name: 'Oyun maratonu', from: 2002, to: 2200, month: 0, people: 3, weeks: 1, skill: null, entrants: [[2002, 100], [2009, 1000], [2020, 30000]] },
];
export const JAM_THEMES = ['Tek tuş', 'Zaman tersine akar', 'Kedi', 'Her şey bağlantılı', 'Küçük bir dünya', 'Kayıp', 'Ayna', 'Sonsuz döngü', 'Yalnız değilsin', 'Kontrol sende değil', 'Düşmek', 'Ses'];
