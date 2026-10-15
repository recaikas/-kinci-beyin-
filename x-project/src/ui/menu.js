// Konu F: Kairosoft tarzı iç içe menü. Alt çubukta başlıklar, başlığın içinde seçenekler, seçeneğin içinde ekran.
// Araştırılmamış, öğrenilmemiş ya da zamanı gelmemiş her şey saklıdır. Her seçenek: başlık, ad, pencere ve sekme,
// açılma koşulu, kapalıyken ipucu ve ilk açılış açıklaması.
import { M, Staff, Genres } from '../game.js';

export const CATS = [
  { id: 'is', name: 'İş', icon: 'gelistir' },
  { id: 'ekip', name: 'Ekip', icon: 'personel' },
  { id: 'arge', name: 'Ar-Ge', icon: 'arge' },
  { id: 'tanitim', name: 'Tanıtım', icon: 'tanitim' },
  { id: 'pazar', name: 'Pazar', icon: 'pazar' },
  { id: 'sirket', name: 'Şirket', icon: 'finans' },
  { id: 'sistem', name: 'Sistem', icon: 'gunluk' },
];

const released = (c, s) => s.games.length > 0;
const year = (c) => M.tableYear(c);
const always = () => true;
// open(c, s): açık mı · hint: kapalıyken "?" kutusunda · first: ilk açılışta tek satırlık açıklama
export const ITEMS = [
  // İş
  { id: 'yeni', cat: 'is', name: 'Yeni oyun', icon: '🎮', win: 'gelistir', sub: 'oyun', wizard: true, open: always, first: 'Konu, tür, platform ve motoru seç; ekibin zamanını dağıt. İlk yıllarda küçük oyunlar can simidi.' },
  { id: 'sozlesme', cat: 'is', name: 'Sözleşme işleri', icon: '📝', win: 'gelistir', sub: 'sozlesme', open: always, first: 'Paralı sözleşme: başkası için iş yap, ödülü ve RP\'yi al. Geç kalırsan ceza.' },
  { id: 'projeler', cat: 'is', name: 'Projeler', icon: '🛠️', win: 'gelistir', sub: 'oyun', open: (c, s) => s.projects.length > 0, hint: 'Bir proje başlayınca açılır.' },
  { id: 'yayincilar', cat: 'is', name: 'Yayıncılar', icon: '🤝', win: 'pazar', sub: 'yayincilar', open: (c, s) => released(c, s) || s.projects.some((p) => p.status === 'debug'), hint: 'İlk oyunun bitince açılır.', first: 'Oyununu yayıncılara sun: avans ve satıştan pay. Ya da kendi yayınını yap.' },
  { id: 'ekpaket', cat: 'is', name: 'Ek paket', icon: '🧩', win: 'pazar', sub: 'oyunlar', open: (c, s) => s.games.some((g) => !g.expansion && g.score >= 60), hint: 'Sevilen bir oyunun olunca açılır.', first: 'Satıştaki oyununa dokun: ek paket, yama, fiyat indirimi ve port oyun ayrıntısında.' },
  { id: 'platform', cat: 'is', name: 'Platform payı', icon: '💽', win: 'platform', sub: 'oran', open: (c, s) => s.consoles.some((k) => k.launched), hint: 'İlk konsolun piyasaya çıkınca açılır.', first: 'Konsolunda satılan başka stüdyo oyunlarından yüzde alırsın. Düşük oran stüdyo çeker, yüksek oran para getirir.' },
  { id: 'anlasma', cat: 'is', name: 'Özel anlaşmalar', icon: '✍️', win: 'platform', sub: 'anlasma', open: (c, s) => s.consoles.some((k) => k.launched), hint: 'İlk konsolun piyasaya çıkınca açılır.', first: 'Büyük oyunları konsoluna özel yaptır: pazarlama, süreli özel, tam özel ya da ikinci parti.' },
  { id: 'konsolyap', cat: 'is', name: 'Konsol yap', icon: '🕹️', win: 'arge', sub: 'konsol', open: (c, s) => !!s.research.done.donanim_lab, hint: '"Donanım laboratuvarı" araştırmasıyla açılır.' },
  // Ekip
  { id: 'isealim', cat: 'ekip', name: 'İşe al', icon: '🧑‍💻', win: 'personel', sub: 'ise_al', open: always, first: 'Başvurular her ay yenilenir. Koltuk yoksa önce oda kur.' },
  { id: 'kadro', cat: 'ekip', name: 'Kadro', icon: '👥', win: 'personel', sub: 'kadro', open: always },
  { id: 'egitim', cat: 'ekip', name: 'Eğitim', icon: '🎓', win: 'personel', sub: 'kadro', open: (c, s) => s.staff.length >= 2, hint: 'Kadroda 2 kişi olunca açılır.', first: 'Bir çalışanın satırındaki menüden kurs seç: beceri artar, maaş biraz artar.' },
  { id: 'tatil', cat: 'ekip', name: 'Tatil politikası', icon: '🏖️', win: 'personel', sub: 'tatil', open: (c, s) => s.staff.length >= 4, hint: 'Kadroda 4 kişi olunca açılır.' },
  // Ar-Ge
  { id: 'arastirma', cat: 'arge', name: 'Araştırma', icon: '🔬', win: 'arge', sub: 'arastirma', open: always, first: 'Türler, boyutlar, odalar ve iş modelleri buradan açılır. Herkes biraz RP üretir.' },
  { id: 'teknoloji', cat: 'arge', name: 'Teknoloji', icon: '🔧', win: 'arge', sub: 'teknoloji', open: (c, s) => !!s.research.done.motor_ozel, hint: '"Kendi motorunu yap" araştırmasıyla açılır.', first: 'Teknoloji hattı: 7 kategoride motor özellikleri. Genel araştırmadan ayrı yürür, RP havuzu ortak.' },
  { id: 'motor', cat: 'arge', name: 'Motor ve motor pazarı', icon: '⚙️', win: 'arge', sub: 'motor', open: (c, s) => year(c) >= 1979 || !!s.research.done.motor_ozel, hint: '1979\'da motor pazarı açılır.', first: 'Motor pazarı: kendi motorun yoksa buradan lisans al. Peşin öder ya da satıştan yüzde verirsin.' },
  { id: 'turler', cat: 'arge', name: 'Türler', icon: '🌳', win: 'arge', sub: 'turler', open: (c, s) => !!s.research.done.alt_tur || Genres.knownGenres(c).length >= 3, hint: '"Alt tür" araştırması ya da bilinen üçüncü türle açılır.', first: 'Tür ağacı: ustalık, alt türler, icat ve bildiğin kombinasyonlar.' },
  { id: 'donanim', cat: 'arge', name: 'Donanım', icon: '🔌', win: 'arge', sub: 'konsol', open: (c, s) => !!s.research.done.donanim_lab, hint: '"Donanım laboratuvarı" araştırmasıyla açılır.' },
  // Tanıtım
  { id: 'reklam', cat: 'tanitim', name: 'Reklam ver', icon: '📣', win: 'reklam', open: (c, s) => !!s.research.done.pazarlama_kucuk || s.rooms.some((r) => r.type === 'pazarlama'), hint: '"Dergi reklamı" araştırması ya da pazarlama odasıyla açılır.', first: 'Reklam projenin hype\'ını yükseltir; hype ilk haftaların satışını büyütür.' },
  { id: 'duyuru', cat: 'tanitim', name: 'Çıkış tarihi duyurusu', icon: '📅', win: 'gelistir', sub: 'oyun', open: released, hint: 'İlk oyun çıkınca açılır.', first: 'Projeyi aç ve "Çıkış tarihi duyur"u seç: geri sayım hype verir; tarihi kaçırma.' },
  { id: 'rapor', cat: 'tanitim', name: 'Oyuncu raporları', icon: '🗒️', win: 'pazar', sub: 'oyunlar', open: (c, s) => s.games.some((g) => g.weeks >= 8), hint: 'İlk oyun 8 hafta satışta kalınca açılır.', first: 'Oyununa dokun, "Oyuncu raporu" iste: ne beğenildi, ne eksikti.' },
  { id: 'fenomen', cat: 'tanitim', name: 'Fenomen anahtarları', icon: '📺', win: 'pazar', sub: 'oyunlar', open: (c, s) => year(c) >= 2010 && s.games.some((g) => g.active), hint: '2010\'da satışta bir oyunla açılır.' },
  // Pazar
  { id: 'satistaki', cat: 'pazar', name: 'Satıştaki oyunlar', icon: '💿', win: 'pazar', sub: 'oyunlar', open: released, hint: 'İlk oyun çıkınca açılır.' },
  { id: 'liste', cat: 'pazar', name: 'Satış listesi', icon: '🏆', win: 'pazar', sub: 'liste', open: released, hint: 'İlk oyun çıkınca açılır.', first: 'Haftalık liste: oyunların sırası ve yükselip düşenler.' },
  { id: 'rakipler', cat: 'pazar', name: 'Rakipler', icon: '🥊', win: 'pazar', sub: 'rakip', open: (c, s) => released(c, s) || s.week >= 48, hint: 'İlk yıl bitince ya da ilk oyun çıkınca açılır.' },
  { id: 'dunya', cat: 'pazar', name: 'Oyun dünyası', icon: '🌍', win: 'dunya', sub: 'yil', open: (c, s) => released(c, s) || s.week >= 48, hint: 'İlk yıl bitince ya da ilk oyun çıkınca açılır.' },
  { id: 'bolgeler', cat: 'pazar', name: 'Bölgeler', icon: '🗺️', win: 'dunya', sub: 'bolgeler', open: (c, s) => !!s.research.done.ihracat, hint: '"İhracat" araştırmasıyla açılır.', first: 'Dünya haritası: dağıtım ağı, bölgelerin zevki ve yerelleştirme.' },
  // Şirket
  { id: 'finans', cat: 'sirket', name: 'Finans', icon: '💰', win: 'finans', sub: 'genel', open: always },
  { id: 'ofis', cat: 'sirket', name: 'Ofis ve odalar', icon: '🏢', win: 'ofis', open: always },
  { id: 'kredi', cat: 'sirket', name: 'Krediler', icon: '🏦', win: 'finans', sub: 'genel', open: (c, s) => s.loans.length > 0 || s.cash < 0 || (s.cashHist || []).some((v) => v < 0), hint: 'İlk eksi kasada açılır.' },
  { id: 'borsa', cat: 'sirket', name: 'Borsa ve halka arz', icon: '📈', win: 'finans', sub: 'sirket', open: (c, s) => s.office.tier >= 3, hint: 'Büyük ofiste (3. kademe) açılır.', first: 'Halka arz: hisse sat, kasaya büyük para koy; karşılığında kurul büyüme ister.' },
  { id: 'hisse', cat: 'sirket', name: 'Hisseler', icon: '📊', win: 'hisse', sub: 'sirketler', open: (c, s) => s.cash >= 2e6 || s.rivals.some((r) => r.stake), hint: 'Kasa 2 milyon doları geçince açılır.', first: 'Şirketlerin hissesini kademe kademe al: %10 temettü, %25 kurul koltuğu, %51 kontrol, %100 birleştirme.' },
  { id: 'bagli', cat: 'sirket', name: 'Bağlı stüdyolar', icon: '🏭', win: 'hisse', sub: 'bagli', open: (c, s) => s.rivals.some((r) => (r.stake || 0) >= 51), hint: 'Bir şirketin %51 hissesini alınca açılır.', first: 'Bağlı stüdyona oyun ısmarla, platform politikasını seç, güçlendir; ama çok karışırsan yıldızları istifa eder.' },
  // Sistem
  { id: 'gunluk', cat: 'sistem', name: 'Günlük', icon: '📰', win: 'gunluk', open: always },
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
export const openItems = (c, s, cat) => ITEMS.filter((it) => (!cat || it.cat === cat) && isOpen(c, s, it));
export const openCats = (c, s) => CATS.filter((k) => openItems(c, s, k.id).length);
// Kapalı ama ipucu verilen en çok iki seçenek
export const teasers = (c, s, cat) => ITEMS.filter((it) => it.cat === cat && it.hint && !isOpen(c, s, it)).slice(0, 2);
export const isNew = (s, it) => { const u = uiState(s); return u.known[it.id] != null && u.known[it.id] > 0 && !u.seen[it.id]; };
export const catNew = (c, s, cat) => openItems(c, s, cat).some((it) => isNew(s, it));
// Yeni açılanları bul: günlüğe haber düşer. İlk çağrıda (oyun başı) mevcutlar sessizce işaretlenir.
export function check(game) {
  const s = game.state, c = game.ctx, u = uiState(s);
  const first = !u.init;
  u.init = 1;
  for (const it of ITEMS) {
    if (u.known[it.id] != null || !isOpen(c, s, it)) continue;
    u.known[it.id] = first ? 0 : s.week || 1;
    if (!first) { const k = CATS.find((x) => x.id === it.cat); c.news(`🆕 ${k.name} › ${it.name} açıldı.`, 'good'); }
  }
}
// Pencere sekmeleri aynı kayıttan süzülür: sekmeye bağlı seçenek varsa en az biri açık olmalı.
export function tabVisible(c, s, win, sub) {
  const its = ITEMS.filter((it) => it.win === win && it.sub === sub);
  if (!its.length) return true;
  return its.some((it) => isOpen(c, s, it));
}
export const seats = (c) => Staff.seats(c);
