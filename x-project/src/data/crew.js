// Konu H: çalışan kişilikleri. Kişilik konuşma balonlarını ve müdürlükteki liderliği belirler; oyun etkileri özelliklerde (traits).
export const PERSONAS = [
  { id: 'lider', name: 'Doğal lider', lead: 90, lines: ['Hadi ekip, bu hafta bitiriyoruz!', 'Herkes bir adım öne.', 'Plan hazır, kahve hazır.'] },
  { id: 'anne', name: 'Ekibin annesi', lead: 75, lines: ['Kek getirdim, önce bir mola.', 'Uyudun mu sen dün?', 'Kimse aç çalışmasın.'] },
  { id: 'pratik', name: 'Pratik', lead: 65, lines: ['Önce çalışsın, sonra güzelleşsin.', 'Bunu iki satırda çözeriz.', 'Toplantı mı? E-posta yeter.'] },
  { id: 'rekabet', name: 'Rekabetçi', lead: 60, lines: ['Rakibin notunu geçeceğiz.', 'Listenin tepesi bizim.', 'İkincilik kaybetmektir.'] },
  { id: 'mukemmel', name: 'Mükemmeliyetçi', lead: 55, lines: ['Bir piksel kaymış.', 'Bir kez daha baştan.', 'Bu yazı tipi olmaz.'] },
  { id: 'filozof', name: 'Kahve filozofu', lead: 50, lines: ['Kod da hayat gibi: derlenmez.', 'Hata mı, kader mi?', 'Üçüncü kahve, ilk fikir.'] },
  { id: 'sakaci', name: 'Şakacı', lead: 45, lines: ['Bu bir hata değil, özellik!', 'Patron geliyor, oyun açık mı?', 'Kediye ses verdim.'] },
  { id: 'hayal', name: 'Hayalperest', lead: 40, lines: ['Ya oyun aslında bir rüyaysa?', 'Uzayda bir balık çiftliği…', 'Aklımda bir dünya var.'] },
  { id: 'tekno', name: 'Teknoloji meraklısı', lead: 40, lines: ['Yeni ekran kartını gördün mü?', 'Bunu motora ekleyelim.', 'Lehim kokusu güzeldir.'] },
  { id: 'dedikodu', name: 'Dedikoducu', lead: 35, lines: ['Duydun mu, rakip stüdyo…', 'Kimseye söyleme ama…', 'Muhasebe yine kızgın.'] },
  { id: 'sanatci', name: 'Sanatçı ruhlu', lead: 35, lines: ['Paletim bugün mor.', 'Bu sahne nefes almalı.', 'Ilham bekliyorum.'] },
  { id: 'sessiz', name: 'Sessiz deha', lead: 25, lines: ['…', '(klavye sesi)', 'Bitti.'] },
];
export const PERSONA = Object.fromEntries(PERSONAS.map((p) => [p.id, p]));
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// Rastgele sayı üretecini tüketmez: kişilik addan ve kimlikten gelir (eski kayıtlar da aynı kişiliği alır)
export const personaOf = (p) => PERSONA[p.persona] || PERSONAS[hash(`${p.id}|${p.name}`) % PERSONAS.length];
export const leadOf = (p) => Math.round(personaOf(p).lead * 0.7 + (p.skill || 0) * 0.3);
