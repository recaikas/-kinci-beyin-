// Arayüzün saf yardımcıları ve sabitleri (DOM durumuna dokunmaz).
import { PACK } from '../data/pack.js';

export const SAVE_KEY = 'xproject-save-v2';
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fmt = (n) => Math.round(n).toLocaleString('tr-TR');
export const pct = (v) => Math.max(0, Math.min(100, v));
export const bar = (v, cls = '') => `<span class="bar ${cls}"><i style="width:${pct(v)}%"></i></span>`;
export const discName = (id) => PACK.disciplines.find((d) => d.id === id).name;
export const STATUS = { hasta: 'Hasta', tukenmis: 'Tükenmiş', egitim: 'Eğitimde', tatil: 'Tatilde', etkinlik: 'Etkinlikte' };
export const SPEEDS = [1, 2, 4, 8];
export const kaosLabel = (k) => (k < 30 ? 'Sakin' : k < 55 ? 'Gergin' : k < 80 ? 'Kaotik' : 'Cehennem');
export const store = (fn) => { try { return fn(window.localStorage); } catch { return null; } };
export const WIN_NAMES = { kat: 'Menü', ayarlar: 'Ayarlar ve kayıt', dunya: 'Oyun dünyası', bilgisayar: 'Bilgisayar', oda: 'Oda', insaat: 'Oda kur', reklam: 'Reklam ver', gelistir: 'Geliştir', personel: 'Personel', ofis: 'Ofis ve binalar', arge: 'Ar-Ge', pazar: 'Pazar', finans: 'Finans', gunluk: 'Günlük' };
export const ICON_OF = { kat: 'bilgisayar', oda: 'ofis', insaat: 'ofis', reklam: 'tanitim', dunya: 'pazar', ayarlar: 'gunluk' };
export const SUBS = { personel: [['kadro', 'Kadro'], ['ise_al', 'İşe al'], ['tatil', 'Tatil']], gelistir: [['oyun', 'Oyun'], ['sozlesme', 'Sözleşme']], arge: [['arastirma', 'Araştırma'], ['teknoloji', 'Teknoloji'], ['motor', 'Motor'], ['turler', 'Türler'], ['konsol', 'Donanım']], pazar: [['oyunlar', 'Oyunların'], ['liste', 'Satış listesi'], ['yayincilar', 'Yayıncılar'], ['cikanlar', 'Son çıkanlar'], ['rakip', 'Rakipler']], finans: [['genel', 'Genel'], ['sirket', 'Şirket ve borsa']], dunya: [['yil', 'Bu yıl'], ['sirketler', 'Şirketler'], ['platformlar', 'Platformlar'], ['bolgeler', 'Bölgeler'], ['tarih', 'Tarih']] };
// Liste sırası değişimi: ▲ yükseldi, ▼ düştü, YENİ ilk hafta.
export const move = (g) => (g.prev == null ? '<i class="new">YENİ</i>' : g.rank < g.prev ? `<i class="up">▲${g.prev - g.rank}</i>` : g.rank > g.prev ? `<i class="down">▼${g.rank - g.prev}</i>` : '<i>–</i>');
