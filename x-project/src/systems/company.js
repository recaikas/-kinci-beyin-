// Şirket değeri ve halka arz (derin mekanik 2): değerleme, hisse fiyatı, çeyreklik hedefler, temettü, geri alım
// ve yönetim kurulu baskısı. Halka açılan şirket para bulur ama artık hissedarlara hesap verir.
import { clamp } from '../kernel.js';
import { inflation } from '../models.js';

const I = (ctx) => ctx.pack.ipo;
export const company = (state) => (state.company ||= { listed: false, pct: 0, sent: 1, pressure: 0, price: 0, priceHist: [], valHist: [], qStart: 0, lastQ: 0, quarters: [] });

// Faaliyet kârı: sermaye, kredi, halka arz gibi finansman kalemleri hariç.
export function operatingProfit(ctx, y) {
  const row = ctx.state.ledger.byYear[y] || {};
  return Object.entries(row).filter(([k]) => !I(ctx).excluded.includes(k)).reduce((a, [, v]) => a + v, 0);
}
export function valuation(ctx) {
  const { state } = ctx;
  const c = I(ctx), infl = inflation(ctx) ** 0.5;
  const y = Math.floor(state.week / 48);
  const years = [y - 1, y - 2, y - 3].filter((k) => k >= 0 && state.ledger.byYear[k]);
  const avg = years.length ? years.reduce((a, k) => a + operatingProfit(ctx, k), 0) / years.length : 0;
  const debt = state.loans.reduce((a, l) => a + l.remaining, 0);
  const ips = state.ips.reduce((a, ip) => a + ip.value, 0);
  const v = state.cash - debt + Math.max(0, avg) * c.profitMult + state.fans * c.fanValue * infl + ips * c.ipK * infl + state.prestige * c.prestigeK * infl;
  return Math.max(0, Math.round(v));
}
export const sharePrice = (ctx) => +(valuation(ctx) / I(ctx).shares * company(ctx.state).sent).toFixed(2);

export function ipoCheck(ctx) {
  const { state } = ctx;
  const c = I(ctx), co = company(state);
  const need = [];
  if (co.listed) need.push('Zaten borsada');
  if (state.office.tier < c.minTier) need.push(`En az "${ctx.pack.offices[c.minTier - 1].name}"`);
  if (state.week < c.minWeeks) need.push(`En az ${c.minWeeks / 48} yıllık şirket`);
  const min = Math.round(c.minValuation * inflation(ctx) ** 0.5);
  if (valuation(ctx) < min) need.push(`Değer en az ${min.toLocaleString('tr-TR')} $`);
  return need;
}
export function goPublic(ctx, pct) {
  const { state, ledger } = ctx;
  const c = I(ctx), co = company(state);
  if (!c.sellPcts.includes(pct)) return { ok: false, msg: 'Geçersiz oran.' };
  const need = ipoCheck(ctx);
  if (need.length) return { ok: false, msg: need.join(' · ') };
  const v = valuation(ctx);
  const cash = Math.round(v * pct * c.discount);
  ledger.post('halka_arz', cash, `Halka arz %${Math.round(pct * 100)}`);
  Object.assign(co, { listed: true, pct, sent: 1, pressure: 0, qStart: state.week, lastQ: Math.max(1, quarterRevenue(ctx)), listedWeek: state.week, qAcc: 0, quarters: [] });
  co.price = sharePrice(ctx);
  ctx.news(`🔔 ${state.companyName} borsada! Hisselerin %${Math.round(pct * 100)}'i satıldı, kasaya ${cash.toLocaleString('tr-TR')} $ girdi. Gong çalındı.`, 'good');
  ctx.bus.fire('ipo', { pct, cash });
  return { ok: true, cash };
}
// Faaliyet gelirleri (satış, donanım, lisans, jeton, abonelik, sözleşme…) her hafta toplanır; çeyrek bu birikimdir.
const REVENUE = ['satis', 'konsol', 'konsol_lisans', 'jeton', 'abonelik', 'lisans', 'sozlesme', 'istirak', 'yayinci'];
export function trackRevenue(ctx, { category, amount }) {
  if (amount > 0 && REVENUE.includes(category)) { const co = company(ctx.state); co.qAcc = (co.qAcc || 0) + amount; }
}
export function quarterRevenue(ctx) {
  const co = company(ctx.state);
  if (co.qAcc != null) return Math.round(co.qAcc);
  const n = I(ctx).quarterWeeks;
  return ctx.state.salesHist.slice(-n).reduce((a, x) => a + (x.r || 0), 0);
}
// Hedef: son 4 çeyreğin ortalaması × (1 + büyüme). Tek bir zayıf çeyrek (oyun çıkmadı) her şeyi bozmaz.
export function quarterTarget(ctx) {
  const co = company(ctx.state);
  const last = co.quarters.slice(0, 4).map((q) => q.rev);
  const base = last.length ? last.reduce((a, b) => a + b, 0) / last.length : co.lastQ;
  return Math.round(Math.max(1, base) * (1 + I(ctx).growthTarget));
}
export function dividend(ctx) {
  const { state, ledger } = ctx;
  const c = I(ctx), co = company(state);
  if (!co.listed) return { ok: false, msg: 'Borsada değilsin.' };
  const amt = Math.round(Math.max(0, state.cash) * c.dividendShare * co.pct);
  if (amt <= 0) return { ok: false, msg: 'Dağıtacak nakit yok.' };
  ledger.post('temettu', -amt, 'Temettü');
  co.sent = clamp(co.sent * c.dividendSent, c.sentMin, c.sentMax);
  co.pressure = Math.max(0, co.pressure + c.dividendPressure);
  ctx.news(`💸 Hissedarlara ${amt.toLocaleString('tr-TR')} $ temettü dağıtıldı. Kurul gülümsüyor.`, 'good');
  return { ok: true, amt };
}
export function buyback(ctx) {
  const { state, ledger } = ctx;
  const c = I(ctx), co = company(state);
  if (!co.listed) return { ok: false, msg: 'Borsada değilsin.' };
  const step = Math.min(co.pct, 0.05);
  const cost = Math.round(sharePrice(ctx) * c.shares * step * c.buybackPremium);
  if (state.cash < cost) return { ok: false, msg: `%5 geri alım ${cost.toLocaleString('tr-TR')} $.` };
  ledger.post('geri_alim', -cost, `Hisse geri alımı %${Math.round(step * 100)}`);
  co.pct = +(co.pct - step).toFixed(3);
  if (co.pct <= 0.0001) {
    Object.assign(co, { listed: false, pct: 0, pressure: 0 });
    ctx.news('🗝️ Tüm hisseler geri alındı. Şirket yeniden senin; kurul toplantısı yok, sadece kahve.', 'good');
  } else ctx.news(`📉 %${Math.round(step * 100)} hisse geri alındı. Halka açık oran %${Math.round(co.pct * 100)}.`, 'info');
  return { ok: true };
}
export const buybackCost = (ctx) => Math.round(sharePrice(ctx) * I(ctx).shares * Math.min(company(ctx.state).pct, 0.05) * I(ctx).buybackPremium);

// Haftalık: hisse fiyatı. Çeyrek sonunda hedef kontrolü ve kurul baskısı.
export function weeklyCompany(ctx) {
  const { state } = ctx;
  const c = I(ctx), co = company(state);
  if (state.week % 4 === 0) { co.valHist.push(valuation(ctx)); if (co.valHist.length > 240) co.valHist.shift(); }
  if (!co.listed) return;
  co.price = sharePrice(ctx);
  co.priceHist.push(co.price); if (co.priceHist.length > 240) co.priceHist.shift();
  if (state.week - co.qStart < c.quarterWeeks) return;
  co.qStart = state.week;
  const rev = quarterRevenue(ctx);
  const target = quarterTarget(ctx);
  co.qAcc = 0;
  co.pressure = Math.max(0, co.pressure - c.pressureDecay);
  const beat = rev >= target;
  co.quarters.unshift({ w: state.week, rev, target, beat }); if (co.quarters.length > 12) co.quarters.length = 12;
  if (beat) {
    co.sent = clamp(co.sent * c.beatSent, c.sentMin, c.sentMax);
    co.pressure = Math.max(0, co.pressure + c.pressureBeat);
    ctx.news(`📈 Çeyrek hedefi aşıldı (${rev.toLocaleString('tr-TR')} $ / hedef ${target.toLocaleString('tr-TR')} $). Hisse yükseldi.`, 'good');
  } else {
    const miss = target ? 1 - rev / target : 1;
    co.sent = clamp(co.sent * c.missSent, c.sentMin, c.sentMax);
    co.pressure = Math.min(c.fireAt, co.pressure + Math.max(6, miss * c.pressureMissK) * co.pct / 0.25);
    ctx.news(`📉 Çeyrek hedefi tutmadı (${rev.toLocaleString('tr-TR')} $ / hedef ${target.toLocaleString('tr-TR')} $). Kurul baskısı %${Math.round(co.pressure)}.`, 'bad');
    if (co.pressure >= c.fireAt) {
      state.gameOver = { reason: 'kurul', text: 'Yönetim kurulu oybirliğiyle seni CEO\'luktan aldı. Yerine bir "verimlilik danışmanı" geldi. Kedi istifa etti.' };
    } else if (co.pressure >= c.boardAt) boardMeeting(ctx);
  }
  co.lastQ = Math.max(1, rev);
}

function boardMeeting(ctx) {
  const co = company(ctx.state);
  ctx.queue({
    id: 'kurul', title: '🏛️ Olağanüstü Yönetim Kurulu',
    text: `Hissedarlar sabırsız. Kurul baskısı %${Math.round(co.pressure)}. %100'e ulaşırsa seni görevden alacaklar. Masada üç seçenek var:`,
    choices: [
      { label: 'Ekibi %10 küçült', effects: { layoffPct: 0.1, morale: -15, board: -35 } },
      { label: 'Ganimet kutusu ekle', effects: { flag: 'lootbox', fansPct: -0.06, kaos: 6, board: -25 } },
      { label: 'Crunch ilan et', effects: { crunch: true, stress: 15, board: -20 } },
      { label: '"Vizyonuma güvenin!"', effects: { board: 8, morale: 6 } },
    ],
  });
}
export function applyBoard(ctx, d) {
  const co = company(ctx.state);
  co.pressure = clamp(co.pressure + d, 0, ctx.pack.ipo.fireAt);
}
