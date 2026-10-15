// Konu G: kendi konsolunda platform payı, özel oyun anlaşmaları, hisse kademeleri ve bağlı stüdyolar, tekelin bedeli.
// Ana yapıya eklenir: konsollar (state.consoles), şirket listesi (state.rivals), tarihî hit takvimi (state.world.queue),
// konsol savaşı payları (state.war), olay sistemi. Konsol yapmayan ve şirket almayan oyuncu için hiçbir şey değişmez.
import { clamp } from '../kernel.js';
import { tableYear, inflation, target, segmentOf, licFeatures, licOpen } from '../models.js';
import { companyById, companyRep, histScore } from './world.js';
import { rivalPrice } from './market.js';
import { newProject } from './production.js';
import { makePerson, freeRoom } from './staff.js';
import * as Genres from './genres.js';
import { LICENSED } from '../data/engines.js';

const P = (ctx) => ctx.pack.platform;
const liveOwn = (state) => (state.consoles || []).filter((k) => k.launched && !k.retired);
const segOf = (ctx, k) => segmentOf({ kind: ctx.pack.console.types.find((t) => t.id === k.type)?.kind });

export function ensure(state) {
  state.plat ||= { rate: 0.3, cart: false, tp: [], deals: [], offers: [], orders: [], heat: 0, boycottUntil: 0, lastProbe: -999, offerWeek: -99 };
  state.coRel ||= {};
  for (const rv of state.rivals || []) {
    rv.stake ??= rv.acquired ? 100 : 0;
    if (rv.stake >= 51) { rv.autonomy ??= 70; rv.policy ??= 'coklu'; rv.boost ??= 0; }
  }
}
export const migrate = (state) => ensure(state);

// ---------- yardımcılar
export const hasConsole = (ctx) => liveOwn(ctx.state).length > 0;
export const isCart = (ctx, k) => P(ctx).cartMedia.includes(k.parts?.media);
export const cartPossible = (ctx) => liveOwn(ctx.state).some((k) => isCart(ctx, k));
export const boycott = (ctx) => ctx.state.plat.boycottUntil > ctx.state.week;
export function attract(ctx) {
  const p = P(ctx), s = ctx.state.plat;
  return clamp(1 + (p.rateStd - s.rate) * p.attractK - (s.cart && cartPossible(ctx) ? p.cartAttract : 0) - (boycott(ctx) ? p.boycott.attract : 0), p.attractMin, p.attractMax);
}
export const licK = (ctx) => ctx.state.plat.rate / P(ctx).rateStd; // aylık lisans geliri orana göre
const relKey = (rv) => rv.cid || `r${rv.id}`;
export const relOf = (ctx, rv) => ctx.state.coRel[relKey(rv)] || 0;
const addRel = (ctx, rv, d) => { if (rv) ctx.state.coRel[relKey(rv)] = clamp(relOf(ctx, rv) + d, -100, 100); };
export const controlled = (ctx) => ctx.state.rivals.filter((r) => (r.stake || 0) >= 51);
// Rakipsiz segment (ör. salon makinesi) tekel sayılmaz: yalnız tarihî rakip platformu olan segmentler
export function maxShare(ctx) { return Math.max(0, ...Object.values(ctx.state.war || {}).filter((w) => w.hist > 0).map((w) => w.share || 0)); }
export function consoleShare(ctx, k) { return ctx.state.war?.[segOf(ctx, k)]?.share || 0; }
const tpPrice = (ctx) => P(ctx).priceRef * inflation(ctx) ** 0.4;

// ---------- G1 · Platform payı
export function setRate(ctx, r) {
  const p = P(ctx);
  if (!hasConsole(ctx)) return { ok: false, msg: 'Önce piyasada bir konsolun olmalı.' };
  ctx.state.plat.rate = clamp(Math.round(r * 100) / 100, p.rateMin, p.rateMax);
  return { ok: true };
}
export function toggleCart(ctx) {
  if (!cartPossible(ctx)) return { ok: false, msg: 'Kartuş tekeli yalnız kartuşlu konsolda olur.' };
  const s = ctx.state.plat;
  s.cart = !s.cart;
  ctx.news(s.cart ? '🏭 Kartuşları artık yalnız sen basıyorsun. Stüdyolar homurdanıyor.' : '🏭 Kartuş basımını serbest bıraktın. Stüdyolar rahatladı.', s.cart ? 'warn' : 'good');
  return { ok: true };
}
// Başka stüdyonun oyunu konsoluna geldi: kütüphaneye girer, 26 hafta azalan eğriyle satar, satıştan yüzde alırsın.
export function tpRelease(ctx, k, studio, name, big = false, mult = 1) {
  const p = P(ctx), s = ctx.state.plat;
  const total = p.tpUnits * (big ? p.tpBigK : 1) * Math.sqrt(Math.max(0.2, k.base || 0) / p.tpBaseRef) * mult;
  s.tp.unshift({ id: ctx.state.nextId++, name, studio, consoleId: k.id, total, w: 0, sold: 0, rev: 0, week: ctx.state.week });
  if (s.tp.length > 60) s.tp.length = 60;
}

// ---------- G2 · Özel oyun anlaşmaları
const rivalOfCid = (ctx, cid) => ctx.state.rivals.find((r) => r.cid === cid);
const isHw = (ctx, cid) => { const c = companyById(cid); return !!c && c.kind.includes('hw') && tableYear(ctx) < c.to; };
function refreshOffers(ctx) {
  const { state } = ctx, p = P(ctx).deal, s = state.plat, y = tableYear(ctx);
  const taken = new Set(s.deals.filter((d) => !d.done).map((d) => d.key));
  const hits = (state.world?.queue || []).filter((h) => h.at <= y + p.horizon && h.cid && !isHw(ctx, h.cid))
    .map((h) => ({ key: `h|${h.name}`, src: 'hit', name: h.name, cid: h.cid, studio: companyById(h.cid)?.name || 'Bağımsız', E: histScore(ctx, h.score), at: h.at }));
  const next = state.rivals.filter((r) => !r.hw && (r.stake || 0) < 51).sort((a, b) => b.rep - a.rep).slice(0, p.rivalOffers)
    .map((r) => ({ key: `r|${r.id}|${r.games}`, src: 'next', name: `${r.name}: sıradaki oyun`, rid: r.id, cid: r.cid, studio: r.name, E: Math.round(r.rep * ctx.pack.rivals.repScoreK + ctx.pack.rivals.scoreBias), at: null }));
  const free = (l) => l.filter((o) => !taken.has(o.key));
  s.offers = [...free(hits).sort((a, b) => b.E - a.E).slice(0, p.offers - 2), ...free(next).slice(0, 2)].map((o) => ({ ...o, id: state.nextId++ }));
  s.offerWeek = state.week;
}
export const offers = (ctx) => ctx.state.plat.offers;
const offerRival = (ctx, o) => (o.rid ? ctx.state.rivals.find((r) => r.id === o.rid) : rivalOfCid(ctx, o.cid));
export function dealPrice(ctx, o, type, k = liveOwn(ctx.state)[0]) {
  const p = P(ctx).deal, t = p.types[type], rv = offerRival(ctx, o);
  const rep = rv?.rep ?? (companyById(o.cid) ? companyRep(companyById(o.cid), tableYear(ctx)) : 60);
  const rel = rv ? relOf(ctx, rv) : 0;
  const seat = (rv?.stake || 0) >= 25 ? 1 - p.seatDiscount : 1;
  const share = k ? consoleShare(ctx, k) : 0;
  return Math.round(p.base * inflation(ctx) ** 0.5 * (o.E / p.scoreRef) ** p.scoreExp * (rep / 60) * (p.shareK - share) * clamp(1 - rel / 250, 0.8, 1.2) * t.k * seat);
}
export function signDeal(ctx, offerId, type, consoleId) {
  const { state, ledger, rng } = ctx, p = P(ctx).deal, s = state.plat;
  const o = s.offers.find((x) => x.id === offerId), t = p.types[type];
  if (!o || !t) return { ok: false, msg: 'Teklif yok.' };
  const k = liveOwn(state).find((x) => x.id === consoleId) || liveOwn(state)[0];
  if (!k) return { ok: false, msg: 'Piyasada konsolun yok.' };
  const price = dealPrice(ctx, o, type, k);
  if (state.cash < price) return { ok: false, msg: `Anlaşma ${price.toLocaleString('tr-TR')} $.` };
  ledger.post('konsol_anlasma', -price, `${o.studio}: ${t.name}`);
  const d = { id: state.nextId++, key: o.key, src: o.src, name: o.name, cid: o.cid, rid: o.rid, studio: o.studio, E: o.E, type, price, consoleId: k.id, signedWeek: state.week, done: false };
  s.deals.push(d);
  s.offers = s.offers.filter((x) => x !== o);
  const rv = offerRival(ctx, o);
  addRel(ctx, rv, t.rel);
  ctx.news(`🤝 ${o.studio} ile ${t.name.toLowerCase()} anlaşması: "${o.name}" ${k.name} için.`, 'good');
  // Karşı teklif: segmentte rakip konsol sahibi varsa, büyük oyunda ve payın büyükse daha olası. %25+ hisse engeller.
  const hwRival = (state.war?.[segOf(ctx, k)]?.rivals || []).find((r) => r.owner && r.owner !== o.cid);
  if (type !== 'pazarlama' && (rv?.stake || 0) < 25 && hwRival && rng.chance(clamp(p.counterK * (o.E / 80) * (1 + consoleShare(ctx, k)), 0, 0.8))) {
    const who = companyById(hwRival.owner)?.name || 'Rakip konsol';
    d.counter = { who, extra: Math.round(price * p.counterRaise) };
    ctx.queue({ id: 'karsiteklif', title: `⚔️ ${who} karşı teklif verdi`, text: `${who}, "${o.name}" için %${Math.round(p.counterRaise * 100)} fazlasını teklif etti. ${o.studio} senden de aynısını bekliyor.`,
      choices: [{ label: `Artır (+${d.counter.extra.toLocaleString('tr-TR')} $)`, effects: { plat: { kind: 'counter', id: d.id, raise: true } } }, { label: `Çekil (paranın %${Math.round(p.withdrawRefund * 100)}'ı döner)`, effects: { plat: { kind: 'counter', id: d.id, raise: false } } }] });
  }
  return { ok: true, deal: d };
}
function counter(ctx, a) {
  const { state, ledger } = ctx, p = P(ctx).deal, s = state.plat;
  const d = s.deals.find((x) => x.id === a.id);
  if (!d || d.done) return;
  if (a.raise && state.cash > -1e12) { ledger.post('konsol_anlasma', -d.counter.extra, `${d.studio}: karşı teklif`); d.price += d.counter.extra; ctx.news(`💸 Teklifi artırdın; "${d.name}" seninle kaldı.`, 'good'); }
  else { ledger.post('konsol_anlasma', Math.round(d.price * p.withdrawRefund), `${d.studio}: anlaşmadan çekilme`); d.done = true; d.lost = true; addRel(ctx, offerRival(ctx, d), -5); ctx.news(`🏳️ "${d.name}" ${d.counter.who} tarafına geçti.`, 'warn'); }
  d.counter = null;
}
function pushMod(ctx, k, mult, weeks, deal = null) { (ctx.state.consoleMods ||= []).push({ mult, untilWeek: ctx.state.week + weeks, console: k.id, deal }); }
// Bir şirket oyun çıkardı: anlaşmalar, ikinci parti ortaklık, "yalnız benim konsolum" politikası
export function onRelease(ctx, ev) {
  const { state, ledger } = ctx, p = P(ctx), s = state.plat;
  const rv = ev.rid ? state.rivals.find((r) => r.id === ev.rid) : ev.cid ? rivalOfCid(ctx, ev.cid) : null;
  for (const d of s.deals.filter((x) => !x.done && ((x.src === 'hit' && x.name === ev.name) || (x.src === 'next' && rv && x.rid === rv.id)))) {
    d.done = true; d.releasedWeek = state.week; d.score = ev.score;
    const k = state.consoles.find((x) => x.id === d.consoleId && x.launched && !x.retired) || liveOwn(state)[0];
    const t = p.deal.types[d.type];
    if (!k || (t.steal && consoleShare(ctx, k) < p.deal.flopShare)) {
      ledger.post('konsol_anlasma', Math.round(d.price * p.deal.flopRefund), `${d.studio}: anlaşma bozuldu`);
      d.broken = true;
      ctx.news(`💔 ${d.studio}, konsolun tutmadığı için "${ev.name}" anlaşmasını bozdu; paranın yarısını geri verdi.`, 'bad');
      continue;
    }
    const mult = t.scale ? 1 + (t.mult - 1) * clamp((ev.score || d.E) / 70, 0.4, 1.5) : t.mult;
    pushMod(ctx, k, mult, t.weeks, d.id);
    k.thirdParty = (k.thirdParty || 0) + t.tp;
    s.heat += t.heat;
    if (t.steal && ev.game) { ev.game.peak *= 1 - t.steal; if (ev.game.lastWeek) ev.game.lastWeek *= 1 - t.steal; }
    tpRelease(ctx, k, d.studio, ev.name, true, t.steal ? 2 : 1);
    if (d.type === 'ikinci' && rv) rv.partner = k.id;
    ctx.news(`🎮 "${ev.name}" (${d.studio}, not ${ev.score}) ${t.name.toLowerCase()} olarak ${k.name} için çıktı. Konsol satışın ×${mult.toFixed(2).replace('.', ',')}.`, 'good');
  }
  if (!rv) return;
  const k = liveOwn(state).find((x) => x.id === rv.partner) || ((rv.stake || 0) >= 51 && rv.policy === 'yalniz' ? liveOwn(state)[0] : null);
  if (k) {
    const m = rv.partner === k.id ? p.deal.types.ikinci.partner : p.stake.policyMod;
    pushMod(ctx, k, m.mult, m.weeks);
    k.thirdParty = (k.thirdParty || 0) + 1;
    tpRelease(ctx, k, rv.name, ev.name, false, 1.5);
  }
}

// ---------- G3 · Hisse kademeleri ve bağlı stüdyolar
export const value = (ctx, rv) => Math.round(rivalPrice(ctx, rv) * (rv.exitSale ? P(ctx).stake.exitDiscount : 1));
export function stakePrice(ctx, rv, to) {
  const p = P(ctx).stake, from = rv.stake || 0;
  if (to <= from) return 0;
  const prem = (relOf(ctx, rv) >= 0 ? p.friendly : p.hostile) + (from < 51 && to >= 51 ? p.control : 0);
  return Math.round(value(ctx, rv) * (to - from) / 100 * prem);
}
export function buyStake(ctx, rid, to) {
  const { state, ledger } = ctx, p = P(ctx).stake;
  const rv = state.rivals.find((r) => r.id === rid);
  if (!rv) return { ok: false, msg: 'Şirket yok.' };
  if (rv.hw) return { ok: false, msg: `${rv.name} bir platform devi; hissesi satılmıyor.` };
  if (!p.tiers.includes(to) || to <= (rv.stake || 0)) return { ok: false, msg: 'Bu kademe alınamaz.' };
  if (to >= 51 && (rv.stake || 0) < 51 && controlled(ctx).length >= p.maxControlled) return { ok: false, msg: `En çok ${p.maxControlled} bağlı stüdyo.` };
  const price = stakePrice(ctx, rv, to);
  if (state.cash < price) return { ok: false, msg: `Hisse ${price.toLocaleString('tr-TR')} $.` };
  const from = rv.stake || 0;
  ledger.post('satin_alma', -price, `${rv.name} %${to}`);
  rv.stake = to; rv.price ||= value(ctx, rv);
  if (from < 25 && to >= 25) addRel(ctx, rv, p.seatRel);
  if (from < 51 && to >= 51) {
    rv.acquired = true; rv.autonomy = p.autonomyStart; rv.policy = 'coklu'; rv.boost = 0;
    ctx.bus.fire('companyAcquired', rv);
  }
  ctx.news(to >= 100 ? `🏢 ${rv.name} artık tamamen senin.` : to >= 51 ? `🏢 ${rv.name}'in kontrolü sende (%${to}). Bağlı stüdyon oldu.` : to >= 25 ? `🪑 ${rv.name}'in %${to}'i senin: yönetim kurulunda koltuğun var.` : `📈 ${rv.name}'in %${to}'ini aldın: temettü ve planlarını görme hakkı.`, 'good');
  return { ok: true, price };
}
export function sellStake(ctx, rid, k = P(ctx).stake.sellK, why = '') {
  const { state, ledger } = ctx;
  const rv = state.rivals.find((r) => r.id === rid);
  if (!rv || !rv.stake) return { ok: false, msg: 'Hissen yok.' };
  const got = Math.round(value(ctx, rv) * rv.stake / 100 * k);
  ledger.post('hisse_satis', got, `${rv.name} %${rv.stake}`);
  ctx.news(`💼 ${rv.name} hisselerini sattın (${got.toLocaleString('tr-TR')} $)${why}.`, 'info');
  rv.stake = 0; rv.acquired = false; rv.policy = null; rv.boost = 0; rv.partner = rv.partner || null;
  state.plat.orders = state.plat.orders.filter((o) => o.rid !== rid);
  return { ok: true, got };
}
const needControl = (ctx, rid) => { const rv = ctx.state.rivals.find((r) => r.id === rid); return rv && (rv.stake || 0) >= 51 ? rv : null; };
export function setPolicy(ctx, rid, pol) {
  const rv = needControl(ctx, rid);
  if (!rv) return { ok: false, msg: 'Kontrol (%51) gerekli.' };
  if (pol === 'yalniz' && !hasConsole(ctx)) return { ok: false, msg: 'Önce piyasada bir konsolun olmalı.' };
  rv.policy = pol === 'yalniz' ? 'yalniz' : 'coklu';
  return { ok: true };
}
export function setBoost(ctx, rid, lvl) {
  const rv = needControl(ctx, rid);
  if (!rv) return { ok: false, msg: 'Kontrol (%51) gerekli.' };
  rv.boost = clamp(Math.round(lvl), 0, 3);
  return { ok: true };
}
export const orderCost = (ctx, size, budget) => Math.round(P(ctx).stake.orderBase * (ctx.pack.sizes.find((z) => z.id === size)?.devCost || 1) * inflation(ctx) ** 0.5 * (P(ctx).stake.budgets[budget]?.cost || 1));
export function orderGame(ctx, rid, o) {
  const { state, ledger } = ctx, p = P(ctx).stake;
  const rv = needControl(ctx, rid);
  if (!rv) return { ok: false, msg: 'Kontrol (%51) gerekli.' };
  if (state.plat.orders.some((x) => x.rid === rid)) return { ok: false, msg: `${rv.name} zaten bir siparişin üstünde.` };
  const size = ctx.pack.sizes.find((z) => z.id === o.size && !z.mmo);
  const gn = ctx.pack.genres.find((g) => g.id === o.genre), tp = ctx.pack.topics.find((t) => t[0] === o.topic && t[4] <= tableYear(ctx));
  if (!size || !gn || !tp || !p.budgets[o.budget]) return { ok: false, msg: 'Tür, konu, boyut ve bütçe seç.' };
  const cost = orderCost(ctx, size.id, o.budget);
  if (state.cash < cost) return { ok: false, msg: `Sipariş ${cost.toLocaleString('tr-TR')} $.` };
  ledger.post('siparis', -cost, `${rv.name}: ${gn.name}`);
  state.plat.orders.push({ id: state.nextId++, rid, studio: rv.name, genre: gn.id, topic: tp[0], size: size.id, budget: o.budget, cost, readyWeek: state.week + Math.round(size.weeks * p.orderWeeksK) });
  rv.autonomy = clamp((rv.autonomy ?? p.autonomyStart) + p.orderAutonomy, 0, 100);
  ctx.news(`📦 ${rv.name}'e ${size.name.toLowerCase()} bir ${gn.name.toLowerCase()} oyunu ısmarladın.`, 'info');
  return { ok: true };
}
// Sipariş teslim: Geliştir › Projeler'de "yayına hazır" bekler; sen yayınlarsın.
function deliver(ctx, o) {
  const { state } = ctx, p = P(ctx).stake;
  const rv = state.rivals.find((r) => r.id === o.rid);
  const t = ctx.pack.topics.find((x) => x[0] === o.topic);
  const ai = t[3].indexOf(Math.max(...t[3]));
  const own = liveOwn(state)[0];
  const platforms = rv?.policy === 'yalniz' && own ? [own.id] : own ? ['pc', own.id] : ['pc'];
  const name = `${ctx.rng.pick(ctx.pack.rivals.gameNamesA)} ${ctx.rng.pick(ctx.pack.rivals.gameNamesB)}`;
  const pj = newProject(ctx, { name, genre: o.genre, sub: Genres.bestSubFor(ctx, o.genre, o.topic) || null, topic: o.topic, audience: ctx.pack.audiences[ai].id, platforms, size: o.size, kind: 'oyun' });
  const y = tableYear(ctx);
  const L = LICENSED.filter((x) => licOpen(x, y) && !x.subs).sort((a, b) => licFeatures(ctx, b, y).length - licFeatures(ctx, a, y).length)[0];
  pj.engineLic = L?.id || null; pj.lic = null; pj.roomId = null;
  const q = clamp(0.5 + (rv?.rep ?? 50) / 200, 0.5, 1) * (p.budgets[o.budget]?.q || 1);
  for (const d of ['oyn', 'gfx', 'ses', 'tek']) pj.points[d] = target(ctx, d, o.size) * q;
  pj.bugs = Object.values(pj.points).reduce((a, b) => a + b, 0) * 0.01 * Math.max(0.1, 1.2 - q);
  pj.status = 'debug'; pj.week = pj.totalWeeks; pj.ext = { rid: o.rid, studio: o.studio }; pj.cost = o.cost;
  state.projects.push(pj);
  ctx.news(`📬 ${o.studio} "${name}" oyununu teslim etti. Geliştir › Projeler'de yayına hazır.`, 'good');
  ctx.bus.fire('projectContentDone', pj);
}
export function merge(ctx, rid) {
  const { state } = ctx, p = P(ctx).stake;
  const rv = state.rivals.find((r) => r.id === rid);
  if (!rv || (rv.stake || 0) < 100) return { ok: false, msg: 'Birleştirmek için %100 hisse gerekli.' };
  let n = 0;
  for (let i = 0; i < p.mergeStaff; i++) {
    const room = freeRoom(ctx);
    if (!room) break;
    const person = makePerson(ctx, { skill: clamp(Math.round(rv.rep * 0.8), 20, 90) });
    person.room = room.id; person.hiredWeek = state.week;
    state.staff.push(person); n++;
  }
  state.fans += Math.round(rv.rep * p.mergeFansPerRep);
  state.prestige = Math.min(ctx.pack.prestige.max, state.prestige + 1);
  state.rivals = state.rivals.filter((r) => r !== rv);
  state.plat.orders = state.plat.orders.filter((o) => o.rid !== rid);
  ctx.news(`🧩 ${rv.name} şirketine katıldı: ${n} deneyimli çalışan, hayranları ve ünü artık senin.`, 'good');
  return { ok: true, staff: n };
}

// ---------- Hafta ve ay
export function weekly(ctx) {
  const { state, ledger } = ctx, p = P(ctx), s = state.plat;
  if (!s) return;
  const price = tpPrice(ctx);
  let rev = 0, cart = 0;
  for (const t of s.tp) {
    if (t.w >= p.tpWeeks) continue;
    const u = t.total * (1 - p.tpDecay) * Math.pow(p.tpDecay, t.w++);
    const r = u * price * s.rate;
    t.sold += u; t.rev += r; rev += r;
    const k = state.consoles.find((x) => x.id === t.consoleId);
    if (s.cart && k && isCart(ctx, k)) cart += u * p.cartFee * inflation(ctx) ** 0.5;
  }
  if (rev >= 1) ledger.post('platform_payi', Math.round(rev), 'Başka stüdyoların oyunları');
  if (cart >= 1) ledger.post('kartus_basim', Math.round(cart), 'Kartuş basımı');
  for (const o of [...s.orders]) if (state.week >= o.readyWeek) { s.orders = s.orders.filter((x) => x !== o); deliver(ctx, o); }
  if (hasConsole(ctx)) refreshOffers(ctx); // her hafta: çıkan hit düşer, yeni yılın takvimi girer
}
const HEADLINES = ['"Konsol devi oyuncak kutusunu da mı satın alacak?"', '"Bir şirket, bütün oyunlar: hayranlar endişeli"', '"Özel oyun savaşında kaybeden yine oyuncu"', '"Tek konsol, tek fiyat, tek seçenek mi?"'];
export function monthly(ctx) {
  const { state, ledger, rng } = ctx, p = P(ctx), s = state.plat;
  ensure(state);
  const infl = inflation(ctx);
  // Bağlı stüdyolar ve hisseler
  for (const rv of [...state.rivals]) {
    if (!rv.stake) continue;
    const profit = rv.rep * ctx.pack.rivals.profitPerRep * infl / 12;
    if (rv.stake >= 51) {
      ledger.post('istirak', Math.round(profit * rv.stake / 100 * (rv.policy === 'yalniz' ? p.stake.policyProfit : 1) - (rv.price || 0) * ctx.pack.rivals.monthlyCostShare * rv.stake / 100), rv.name);
      if (rv.boost) { ledger.post('guclendirme', -Math.round(p.stake.boostCost * rv.boost * infl ** 0.5 / 12), rv.name); rv.rep = clamp(rv.rep + rv.boost / 12, 5, 99); }
      rv.autonomy = clamp((rv.autonomy ?? p.stake.autonomyStart) + p.stake.recover + (rv.policy === 'yalniz' ? p.stake.policyAutonomy : 0) + p.stake.boostAutonomy * rv.boost / 3, 0, 100);
      if (rv.autonomy < p.stake.quitBelow && rng.chance(p.stake.quitChance)) starQuits(ctx, rv);
    } else ledger.post('temettu', Math.round(profit * rv.stake / 100 * p.stake.dividendK), rv.name);
  }
  // Tekel ısısı
  const share = maxShare(ctx), activeDeals = s.deals.filter((d) => !d.done && d.type !== 'pazarlama').length + (state.consoleMods || []).filter((m) => m.deal && m.untilWeek > state.week).length;
  const subs = controlled(ctx).length;
  const tgt = clamp(share * p.heat.shareK + activeDeals * p.heat.perDeal + subs * p.heat.perSub + (hasConsole(ctx) && s.rate > p.heat.rateAt ? p.heat.rate : 0), 0, 100);
  s.heat = clamp(s.heat + (tgt - s.heat) * p.heat.smooth, 0, 100);
  if (s.heat > p.heat.fansAt) {
    state.fans = Math.round(state.fans * (1 - p.heat.fansK * (s.heat - p.heat.fansAt) / 50));
    if (rng.chance(0.08)) ctx.news(`🗞️ ${rng.pick(HEADLINES)}`, 'warn');
  }
  // Boykot
  if (hasConsole(ctx) && s.rate > p.boycott.rateAt && !boycott(ctx) && rng.chance(p.boycott.chance)) {
    s.boycottUntil = state.week + p.boycott.weeks;
    ctx.news(`🪧 Bağımsız stüdyolar %${Math.round(s.rate * 100)} platform oranını protesto ediyor: bir yıl konsoluna oyun yapmayacaklar.`, 'bad');
  }
  // Rekabet Kurumu
  const y = tableYear(ctx);
  if ((share > p.antitrust.shareAt || subs >= p.antitrust.controlledAt) && y - s.lastProbe >= p.antitrust.cooldownYears && rng.chance(p.antitrust.chance)) {
    s.lastProbe = Math.floor(y);
    const fine = Math.round(Math.max(0, lastYearRevenue(ctx)) * p.antitrust.finePct);
    const weakest = controlled(ctx).sort((a, b) => a.rep - b.rep)[0];
    const choices = [{ label: `Para cezasını öde (${fine.toLocaleString('tr-TR')} $)`, effects: { cashRaw: -fine } },
      { label: 'Özel anlaşmaları aç', effects: { plat: { kind: 'probe', opt: 'open' } } }];
    if (weakest) choices.push({ label: `${weakest.name} şirketini sat (%${Math.round(p.antitrust.sellK * 100)} değer)`, effects: { plat: { kind: 'probe', opt: 'sell', id: weakest.id } } });
    ctx.queue({ id: 'rekabet', title: '⚖️ Rekabet Kurumu kapıda', text: `Pazar payın %${Math.round(share * 100)}${subs ? `, ${subs} bağlı stüdyon` : ''}. Kurum tekel soruşturması açtı ve bir çözüm istiyor.`, choices });
  }
}
function lastYearRevenue(ctx) {
  const row = ctx.state.ledger.byYear[Math.floor(ctx.state.week / 48) - 1] || ctx.state.ledger.byYear[Math.floor(ctx.state.week / 48)] || {};
  return Object.values(row).filter((v) => v > 0).reduce((a, b) => a + b, 0);
}
const QUIT_NAMES = ['Yeniden Doğuş Stüdyosu', 'Kaçak Yıldız Oyunları', 'Bağımsız Kalp Stüdyo', 'İkinci Şans Oyun', 'Özgür Piksel', 'Kapıyı Çarpanlar'];
function starQuits(ctx, rv) {
  const { state, rng } = ctx, p = P(ctx).stake;
  rv.rep = clamp(rv.rep - p.quitRep, 5, 99);
  rv.autonomy = 60;
  const used = new Set(state.rivals.map((r) => r.name));
  const name = QUIT_NAMES.find((n) => !used.has(n)) || `${rv.name} Kaçakları`;
  state.rivals.push({ id: state.nextId++, cid: null, name, rep: 45, drift: 0, hw: false, pub: false, nextRelease: rng.int(...ctx.pack.rivals.releaseWeeks), acquired: false, games: 0, lastScore: 0, since: Math.floor(tableYear(ctx)), stake: 0 });
  ctx.news(`🚪 ${rv.name}'in yıldız yapımcısı "Bu kadar karışma olmaz" deyip istifa etti ve ${name}'yu kurdu. Ekibin bir kısmı da gitti.`, 'bad');
}
function probe(ctx, a) {
  const { state } = ctx, p = P(ctx);
  if (a.opt === 'open') {
    for (const d of state.plat.deals.filter((x) => !x.done || (x.releasedWeek && state.week - x.releasedWeek < 48))) {
      d.done = true; d.opened = true;
      addRel(ctx, offerRival(ctx, d), p.antitrust.rel);
    }
    state.consoleMods = (state.consoleMods || []).filter((m) => !m.deal);
    for (const rv of state.rivals) if (rv.partner) rv.partner = null;
    ctx.news('⚖️ Özel anlaşmalar açıldı: oyunlar artık herkese. Kurum dosyayı kapattı.', 'warn');
  } else if (a.opt === 'sell' && a.id) sellStake(ctx, a.id, p.antitrust.sellK, ' (Rekabet Kurumu kararı)');
}
// Donanımdan çekilen dev: stüdyoları satılık
function hwExit(ctx, co) {
  const { state, rng } = ctx;
  const name = `${co.name} Stüdyoları`;
  if (state.rivals.some((r) => r.name === name)) return;
  state.rivals.push({ id: state.nextId++, cid: null, name, rep: clamp(Math.round(companyRep(co, tableYear(ctx)) * 0.9), 30, 95), drift: 0, hw: false, pub: true, nextRelease: rng.int(...ctx.pack.rivals.releaseWeeks), acquired: false, games: 0, lastScore: 0, since: Math.floor(tableYear(ctx)), stake: 0, exitSale: true });
  ctx.news(`🏷️ ${name} satılık! Serileri ve ekipleriyle, değerinin %${Math.round(P(ctx).stake.exitDiscount * 100)}'ına (Şirket › Hisseler).`, 'tarih');
}

export function wire(ctx) {
  ctx.bus.on('companyRelease', (ev) => onRelease(ctx, ev));
  ctx.bus.on('plat', (a) => (a.kind === 'counter' ? counter(ctx, a) : a.kind === 'probe' ? probe(ctx, a) : null));
  ctx.bus.on('hwExit', (co) => hwExit(ctx, co));
}
