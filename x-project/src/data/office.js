// Oyun dengesi değerleri; fiyatlar tarihî satış fiyatları değildir.
export const FURNITURE = {
  desk: { name: 'Masa', w: 2, h: 1, usable: true },
  chair: { name: 'Sandalye', w: 1, h: 1, walkable: true },
  plant: { name: 'Bitki', w: 1, h: 1 }, shelf: { name: 'Kitaplık', w: 2, h: 1 },
  sofa: { name: 'Dinlenme koltuğu', w: 2, h: 1, usable: true },
  tea: { name: 'Çay köşesi', w: 1, h: 1, usable: true }, coffee: { name: 'Kahve makinesi', w: 1, h: 1, usable: true },
  fan: { name: 'Pervane', w: 1, h: 1 }, ac: { name: 'Klima', w: 2, h: 1 },
  toilet: { name: 'Tuvalet', w: 1, h: 1, usable: true }, sink: { name: 'Lavabo', w: 1, h: 1, usable: true },
  equipment: { name: 'Departman ekipmanı', w: 2, h: 1 },
};
const item = (id, type, name, year, cost, extra = {}) => ({ id, type, name, year, cost, group: 'konfor', ...extra });
const pc = (id, name, year, generation, grade, cost, tech, extra = {}) => item(id, 'computer', name, year, cost, { group: 'bilgisayar', generation, grade, tech, power: [0.88, 1, 1.16][grade], heat: 1 + generation * 0.35 + grade * 0.35, running: 4 + generation * 3 + grade * 2, ...extra });
export const CATALOG = [
  item('desk-basic', 'desk', 'Ahşap çalışma masası', 1976, 180, { group: 'calisma', quality: 1 }),
  item('desk-wide', 'desk', 'Geniş ofis masası', 1976, 420, { group: 'calisma', quality: 1.03 }),
  item('desk-modular', 'desk', 'Modüler çalışma masası', 1990, 900, { group: 'calisma', quality: 1.06 }),
  item('chair-basic', 'chair', 'Ahşap sandalye', 1976, 65, { group: 'calisma', quality: 1 }),
  item('chair-padded', 'chair', 'Minderli ofis sandalyesi', 1976, 180, { group: 'calisma', quality: 1.05 }),
  item('chair-ergo', 'chair', 'Ergonomik sandalye', 1990, 650, { group: 'calisma', quality: 1.1 }),
  pc('pc-used-76', 'İkinci el mikro bilgisayar', 1976, 0, 0, 450, 2, { reliability: 0.96 }),
  pc('pc-kit-76', '8 bit geliştirme bilgisayarı', 1976, 0, 1, 1100, 2),
  pc('pc-pro-76', 'Profesyonel geliştirme terminali', 1976, 0, 2, 2600, 2),
  pc('pc-pet-77', 'Commodore PET', 1977, 0, 1, 1250, 2, { power: 1.06 }),
  pc('pc-c64-82', 'Commodore 64', 1982, 1, 0, 700, 4, { power: 1 }),
  pc('pc-office-82', '16 bit ofis bilgisayarı', 1982, 1, 1, 2100, 4),
  pc('pc-pro-82', 'Profesyonel 16 bit istasyon', 1982, 1, 2, 4300, 4),
  ...[[1990, 2, 6], [2000, 3, 7], [2012, 4, 7], [2020, 5, 7]].flatMap(([year, generation, tech]) => [0, 1, 2].map((grade) =>
    pc(`pc-${year}-${grade}`, `${year < 2000 ? 'PC' : 'İstasyon'} ${year} · ${['Ekonomik', 'Standart', 'Profesyonel'][grade]}`, year, generation, grade, [1800, 3600, 7600][grade], tech))),
  item('plant-basic', 'plant', 'Saksı bitkisi', 1976, 60, { comfort: 0.01 }),
  item('shelf-basic', 'shelf', 'Teknik kitaplık', 1976, 320, { bonus: 0.03 }),
  item('sofa-basic', 'sofa', 'İkili dinlenme koltuğu', 1976, 350, { seats: 2 }),
  item('sofa-comfort', 'sofa', 'Rahat dinlenme kanepesi', 1985, 850, { seats: 3 }),
  item('tea-basic', 'tea', 'Çaydanlık ve tezgâh', 1976, 130, { service: 5, running: 5 }),
  item('coffee-basic', 'coffee', 'Filtre kahve makinesi', 1976, 300, { service: 6, running: 10 }),
  item('coffee-auto', 'coffee', 'Otomatik kahve istasyonu', 1990, 1600, { service: 14, running: 25 }),
  item('fan-basic', 'fan', 'Ayaklı pervane', 1976, 120, { cooling: 2, running: 4 }),
  item('ac-window', 'ac', 'Pencere tipi klima', 1976, 1400, { cooling: 7, running: 30 }),
  item('ac-split', 'ac', 'Verimli split klima', 1990, 2600, { cooling: 10, running: 22 }),
  item('toilet-basic', 'toilet', 'Klozet', 1976, 450, { group: 'hizmet', service: 6, rooms: ['tuvalet'], running: 4 }),
  item('sink-basic', 'sink', 'Lavabo', 1976, 180, { group: 'hizmet', service: 10, rooms: ['tuvalet'], running: 3 }),
  item('eq-art-76', 'equipment', 'Çizim masası ve araçları', 1976, 800, { group: 'departman', roles: ['grafik'], bonus: 0.12 }),
  item('eq-audio-76', 'equipment', 'Analog ses çalışma seti', 1976, 1000, { group: 'departman', roles: ['ses'], bonus: 0.12 }),
  item('eq-test-76', 'equipment', 'Test cihazı tezgâhı', 1976, 750, { group: 'departman', roles: ['qa'], bonus: 0.12 }),
  item('eq-research-76', 'equipment', 'Araştırma ve referans arşivi', 1976, 850, { group: 'departman', roles: ['arastirma'], bonus: 0.12 }),
  item('eq-hardware-76', 'equipment', 'Elektronik çalışma tezgâhı', 1976, 1400, { group: 'departman', roles: ['donanim'], bonus: 0.12 }),
  item('eq-digital-90', 'equipment', 'Dijital üretim ekipmanı', 1990, 3200, { group: 'departman', roles: ['grafik', 'ses', 'qa', 'arastirma', 'donanim'], bonus: 0.2 }),
];
export const SKU = Object.fromEntries(CATALOG.map((x) => [x.id, x]));
export const GROUPS = { calisma: 'Masa ve sandalye', bilgisayar: 'Bilgisayar', konfor: 'Konfor ve mola', hizmet: 'Tuvalet', departman: 'Departman ekipmanı' };
export const expectedGeneration = (year) => year >= 2020 ? 5 : year >= 2012 ? 4 : year >= 2000 ? 3 : year >= 1990 ? 2 : year >= 1982 ? 1 : 0;
