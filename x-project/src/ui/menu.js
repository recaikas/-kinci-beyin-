// Konu F + H: Kairosoft tarzı menü. Kurucuya (ana karaktere) ya da alttaki "Menü"ye dokununca solda küçük bir menü açılır:
// başlık → seçenek → ekran. Departman işleri kendi odasından açılır (odadaki çalışana dokun); oda yokken kurucu yapar
// (fallback). Araştırılmamış, öğrenilmemiş ya da zamanı gelmemiş her şey saklıdır.
import { M, Staff, Genres } from '../game.js';

// Kurucunun başlıkları (Kairosoft: Geliştir, Personel, Eylem, Bilgi, Sistem)
export const CATS = [
  { id: 'gelistir', name: 'Geliştir', icon: 'gelistir' },
  { id: 'personel', name: 'Personel', icon: 'personel' },
  { id: 'eylem', name: 'Eylem', icon: 'finans' },
  { id: 'bilgi', name: 'Bilgi', icon: 'pazar' },
  { id: 'arge', name: 'Ar-Ge', icon: 'arge' },
  { id: 'departman', name: 'Departmanlar', icon: 'ofis' },
  { id: 'sistem', name: 'Sistem', icon: 'gunluk' },
];

const released = (c, s) => s.games.length > 0;
const year = (c) => M.tableYear(c);
const always = () => true;
// open(c, s): açık mı · hint: kapalıyken "?" kutusunda · first: ilk açılışta tek satırlık açıklama
export const ITEMS = [
  // İş
  { id: 'yeni', cat: 'gelistir', also: ['gelistirme'], name: 'Yeni oyun', icon: '🎮', win: 'gelistir', sub: 'oyun', wizard: true, open: always, first: 'Konu, tür, platform ve motoru seç; ekibin zamanını dağıt. İlk yıllarda küçük oyunlar can simidi.' },
  { id: 'sozlesme', cat: 'gelistir', also: ['gelistirme'], name: 'Sözleşme işleri', icon: '📝', win: 'gelistir', sub: 'sozlesme', open: always, first: 'Paralı sözleşme: başkası için iş yap, ödülü ve RP\'yi al. Geç kalırsan ceza.' },
  { id: 'projeler', cat: 'gelistir', also: ['gelistirme'], name: 'Projeler', icon: '🛠️', win: 'gelistir', sub: 'oyun', open: (c, s) => s.projects.length > 0, hint: 'Bir proje başlayınca açılır.' },
  { id: 'yayincilar', cat: 'gelistir', name: 'Yayıncılar', icon: '🤝', win: 'pazar', sub: 'yayincilar', open: (c, s) => released(c, s) || s.projects.some((p) => p.status === 'debug'), hint: 'İlk oyunun bitince açılır.', first: 'Oyununu yayıncılara sun: avans ve satıştan pay. Ya da kendi yayınını yap.' },
  { id: 'ekpaket', cat: 'gelistir', name: 'Ek paket', icon: '🧩', win: 'pazar', sub: 'oyunlar', open: (c, s) => s.games.some((g) => !g.expansion && g.score >= 60), hint: 'Sevilen bir oyunun olunca açılır.', first: 'Satıştaki oyununa dokun: ek paket, yama, fiyat indirimi ve port oyun ayrıntısında.' },
  { id: 'platform', cat: 'eylem', owner: 'donanim', fallback: true, name: 'Platform payı', icon: '💽', win: 'platform', sub: 'oran', open: (c, s) => s.consoles.some((k) => k.launched), hint: 'İlk konsolun piyasaya çıkınca açılır.', first: 'Konsolunda satılan başka stüdyo oyunlarından yüzde alırsın. Düşük oran stüdyo çeker, yüksek oran para getirir.' },
  { id: 'anlasma', cat: 'eylem', owner: 'donanim', fallback: true, name: 'Özel anlaşmalar', icon: '✍️', win: 'platform', sub: 'anlasma', open: (c, s) => s.consoles.some((k) => k.launched), hint: 'İlk konsolun piyasaya çıkınca açılır.', first: 'Büyük oyunları konsoluna özel yaptır: pazarlama, süreli özel, tam özel ya da ikinci parti.' },
  { id: 'lisans', cat: 'gelistir', name: 'Platform lisansları', icon: '📜', win: 'gelistir', sub: 'lisans', open: always, first: 'Kairosoft gibi: bir platforma oyun yapmak için önce geliştirici lisansı alırsın. Başta yalnız Kişisel Bilgisayar lisanslı.' },
  { id: 'konsolyap', cat: 'dept', owner: 'donanim', name: 'Konsol yap', icon: '🕹️', win: 'arge', sub: 'konsol', open: (c, s) => !!s.research.done.donanim_lab, hint: '"Donanım laboratuvarı" araştırmasıyla açılır.' },
  // Ekip
  { id: 'isealim', cat: 'personel', name: 'İşe al', icon: '🧑‍💻', win: 'personel', sub: 'ise_al', open: always, first: 'Başvurular her ay yenilenir. Koltuk yoksa önce oda kur.' },
  { id: 'kadro', cat: 'personel', name: 'Kadro', icon: '👥', win: 'personel', sub: 'kadro', open: always },
  { id: 'egitim', cat: 'personel', name: 'Eğitim', icon: '🎓', win: 'personel', sub: 'kadro', open: (c, s) => s.staff.length >= 2, hint: 'Kadroda 2 kişi olunca açılır.', first: 'Bir çalışanın satırındaki menüden kurs seç: beceri artar, maaş biraz artar.' },
  { id: 'mudurler', cat: 'personel', name: 'Müdürler', icon: '🎖️', win: 'personel', sub: 'mudur', open: (c) => Staff.managersOpen(c), hint: 'Küçük ofise taşınınca açılır.', first: 'Her odaya bir müdür ata: oda daha verimli ve sakin çalışır; müdürlü oda bazı işleri kendisi yapar.' },
  { id: 'tatil', cat: 'personel', name: 'Tatil politikası', icon: '🏖️', win: 'personel', sub: 'tatil', open: (c, s) => s.staff.length >= 4, hint: 'Kadroda 4 kişi olunca açılır.' },
  // Ar-Ge
  { id: 'arastirma', cat: 'arge', owner: 'arastirma', fallback: true, name: 'Araştırma', icon: '🔬', win: 'arge', sub: 'arastirma', open: always, first: 'Türler, boyutlar, odalar ve iş modelleri buradan açılır. Herkes biraz RP üretir.' },
  { id: 'teknoloji', cat: 'arge', owner: 'arastirma', fallback: true, name: 'Teknoloji', icon: '🔧', win: 'arge', sub: 'teknoloji', open: (c, s) => !!s.research.done.motor_ozel, hint: '"Kendi motorunu yap" araştırmasıyla açılır.', first: 'Teknoloji hattı: 7 kategoride motor özellikleri. Genel araştırmadan ayrı yürür, RP havuzu ortak.' },
  { id: 'motor', cat: 'arge', owner: 'arastirma', fallback: true, name: 'Motor ve motor pazarı', icon: '⚙️', win: 'arge', sub: 'motor', open: (c, s) => year(c) >= 1979 || !!s.research.done.motor_ozel, hint: '1979\'da motor pazarı açılır.', first: 'Motor pazarı: kendi motorun yoksa buradan lisans al. Peşin öder ya da satıştan yüzde verirsin.' },
  { id: 'turler', cat: 'arge', owner: 'arastirma', fallback: true, name: 'Türler', icon: '🌳', win: 'arge', sub: 'turler', open: (c, s) => !!s.research.done.alt_tur || Genres.knownGenres(c).length >= 3, hint: '"Alt tür" araştırması ya da bilinen üçüncü türle açılır.', first: 'Tür ağacı: ustalık, alt türler, icat ve bildiğin kombinasyonlar.' },
  // Tanıtım
  { id: 'reklam', cat: 'eylem', owner: 'pazarlama', fallback: true, name: 'Reklam ver', icon: '📣', win: 'reklam', open: always, hint: '"Dergi reklamı" araştırması ya da pazarlama odasıyla açılır.', first: 'Reklam projenin hype\'ını yükseltir; hype ilk haftaların satışını büyütür.' },
  { id: 'duyuru', cat: 'dept', owner: 'pazarlama', name: 'Çıkış tarihi duyurusu', icon: '📅', win: 'gelistir', sub: 'oyun', open: released, hint: 'İlk oyun çıkınca açılır.', first: 'Projeyi aç ve "Çıkış tarihi duyur"u seç: geri sayım hype verir; tarihi kaçırma.' },
  { id: 'rapor', cat: 'bilgi', also: ['musteri'], name: 'Oyuncu raporları', icon: '🗒️', win: 'pazar', sub: 'oyunlar', open: (c, s) => s.games.some((g) => g.weeks >= 8), hint: 'İlk oyun 8 hafta satışta kalınca açılır.', first: 'Oyununa dokun, "Oyuncu raporu" iste: ne beğenildi, ne eksikti.' },
  { id: 'fenomen', cat: 'dept', owner: 'pazarlama', name: 'Fenomen anahtarları', icon: '📺', win: 'pazar', sub: 'oyunlar', open: (c, s) => year(c) >= 2010 && s.games.some((g) => g.active), hint: '2010\'da satışta bir oyunla açılır.' },
  // Pazar
  { id: 'satistaki', cat: 'bilgi', name: 'Satıştaki oyunlar', icon: '💿', win: 'pazar', sub: 'oyunlar', open: released, hint: 'İlk oyun çıkınca açılır.' },
  { id: 'liste', cat: 'bilgi', name: 'Satış listesi', icon: '🏆', win: 'pazar', sub: 'liste', open: released, hint: 'İlk oyun çıkınca açılır.', first: 'Haftalık liste: oyunların sırası ve yükselip düşenler.' },
  { id: 'rakipler', cat: 'bilgi', name: 'Rakipler', icon: '🥊', win: 'pazar', sub: 'rakip', open: (c, s) => released(c, s) || s.week >= 48, hint: 'İlk yıl bitince ya da ilk oyun çıkınca açılır.' },
  { id: 'dunya', cat: 'bilgi', name: 'Oyun dünyası', icon: '🌍', win: 'dunya', sub: 'yil', open: (c, s) => released(c, s) || s.week >= 48, hint: 'İlk yıl bitince ya da ilk oyun çıkınca açılır.' },
  { id: 'bolgeler', cat: 'bilgi', name: 'Bölgeler', icon: '🗺️', win: 'dunya', sub: 'bolgeler', open: (c, s) => !!s.research.done.ihracat, hint: '"İhracat" araştırmasıyla açılır.', first: 'Dünya haritası: dağıtım ağı, bölgelerin zevki ve yerelleştirme.' },
  // Şirket
  { id: 'finans', cat: 'eylem', name: 'Finans', icon: '💰', win: 'finans', sub: 'genel', open: always },
  { id: 'ofis', cat: 'eylem', name: 'Ofis ve odalar', icon: '🏢', win: 'ofis', open: always },
  { id: 'kredi', cat: 'eylem', name: 'Krediler', icon: '🏦', win: 'finans', sub: 'genel', open: (c, s) => s.loans.length > 0 || s.cash < 0 || (s.cashHist || []).some((v) => v < 0), hint: 'İlk eksi kasada açılır.' },
  { id: 'borsa', cat: 'eylem', name: 'Borsa ve halka arz', icon: '📈', win: 'finans', sub: 'sirket', open: (c, s) => s.office.tier >= 3, hint: 'Büyük ofiste (3. kademe) açılır.', first: 'Halka arz: hisse sat, kasaya büyük para koy; karşılığında kurul büyüme ister.' },
  { id: 'hisse', cat: 'eylem', name: 'Hisseler', icon: '📊', win: 'hisse', sub: 'sirketler', open: (c, s) => s.cash >= 2e6 || s.rivals.some((r) => r.stake), hint: 'Kasa 2 milyon doları geçince açılır.', first: 'Şirketlerin hissesini kademe kademe al: %10 temettü, %25 kurul koltuğu, %51 kontrol, %100 birleştirme.' },
  { id: 'bagli', cat: 'eylem', name: 'Bağlı stüdyolar', icon: '🏭', win: 'hisse', sub: 'bagli', open: (c, s) => s.rivals.some((r) => (r.stake || 0) >= 51), hint: 'Bir şirketin %51 hissesini alınca açılır.', first: 'Bağlı stüdyona oyun ısmarla, platform politikasını seç, güçlendir; ama çok karışırsan yıldızları istifa eder.' },
  // Sistem
  { id: 'gunluk', cat: 'bilgi', name: 'Günlük', icon: '📰', win: 'gunluk', open: always },
  { id: 'ayarlar', cat: 'sistem', name: 'Kayıt ve ayarlar', icon: '💾', win: 'ayarlar', open: always },
];
export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// Durum kaydı: oyunla birlikte taşınır (state.ui)
export function uiState(s) {
  s.ui ||= {};
  s.ui.known ||= {}; // açıldığı bilinen seçenekler
  s.ui.seen ||= {}; // ziyaret edilenler (YENİ rozeti kalkar)
  s.ui.notes ||= {}; // ilk açılış açıklaması kapatılanlar
  return s.ui;
}
export const isOpen = (c, s, it) => !!it.open(c, s);
const hasRoom = (s, type) => s.rooms.some((r) => r.type === type);
// Kurucunun menüsünde mi? Sahibi kurucu ya da (yedekli) departmanı henüz kurulmamış seçenek.
export const founderHas = (s, it) => !it.owner || (it.fallback && !hasRoom(s, it.owner));
export const openItems = (c, s, cat) => ITEMS.filter((it) => (!cat || it.cat === cat) && founderHas(s, it) && isOpen(c, s, it));
// Departman menüsü: o odanın sahip olduğu ya da paylaştığı seçenekler
export const deptItems = (c, s, type) => ITEMS.filter((it) => (it.owner === type || it.also?.includes(type)) && isOpen(c, s, it));
export const openCats = (c, s) => CATS.filter((k) => k.id === 'departman' ? s.rooms.length > 0 : openItems(c, s, k.id).length);
// Kapalı ama ipucu verilen en çok iki seçenek
export const teasers = (c, s, cat) => ITEMS.filter((it) => it.cat === cat && founderHas(s, it) && it.hint && !isOpen(c, s, it)).slice(0, 2);
export const isNew = (s, it) => { const u = uiState(s); return u.known[it.id] != null && u.known[it.id] > 0 && !u.seen[it.id]; };
export const catNew = (c, s, cat) => openItems(c, s, cat).some((it) => isNew(s, it));
export const anyNew = (c, s) => ITEMS.some((it) => isOpen(c, s, it) && isNew(s, it));
const whereOf = (s, it) => (founderHas(s, it) ? CATS.find((x) => x.id === it.cat)?.name : null) || ({ arastirma: 'Araştırma odası', pazarlama: 'Pazarlama ve yayın', donanim: 'Donanım laboratuvarı', musteri: 'Müşteri destek' }[it.owner] || 'Menü');
// Yeni açılanları bul: günlüğe haber düşer. İlk çağrıda (oyun başı) mevcutlar sessizce işaretlenir.
export function check(game) {
  const s = game.state, c = game.ctx, u = uiState(s);
  const first = !u.init;
  u.init = 1;
  for (const it of ITEMS) {
    if (u.known[it.id] != null || !isOpen(c, s, it)) continue;
    u.known[it.id] = first ? 0 : s.week || 1;
    if (!first) c.news(`🆕 ${whereOf(s, it)} › ${it.name} açıldı.`, 'good');
  }
}
// Pencere sekmeleri aynı kayıttan süzülür: sekmeye bağlı seçenek varsa en az biri açık olmalı.
export function tabVisible(c, s, win, sub) {
  const its = ITEMS.filter((it) => it.win === win && it.sub === sub);
  if (!its.length) return true;
  return its.some((it) => isOpen(c, s, it));
}
export const seats = (c) => Staff.seats(c);
