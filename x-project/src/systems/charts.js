// Satış listesi ve pazar dinamiği (Konu A).
// - Yayılma (Bass) eğrisi: haftalık satış = (merak p + ağızdan ağıza q × satılmış pay) × kalan pay.
//   Oyunun ömür boyu satışı eski tek eğriyle aynı tutulur (mk ayarı); değişen, satışın zamana dağılımıdır.
// - Zamanlama çarpanı (mevsim × rekabet × raf) yayılmayı hızlandırır ya da erteler; liste görünürlüğü merakı artırır.
// - Dolgu oyunlar (görünmeyen küçük stüdyolar) üs yasasıyla sıraya girer; gerçek sıra tek satırda hesaplanır.
// - Raf (fiziksel dönem), vitrin ve indirim festivali (dijital dönem), basım adedi, riskli hamleler, ödüller,
//   liste ailesi (genel, tür, platform, bölge, oynanan, yıl sonu, tüm zamanlar) ve çıkış takvimi.
import { clamp, lerpTable } from '../kernel.js';
import { tableYear, inflation, platformBase, activePlatforms, regionMix, platformById, ALL_REGIONS } from '../models.js';
import { COMPANIES } from '../data/history.js';

const C = (ctx) => ctx.pack.charts;
const D = (ctx) => ctx.pack.charts.diffusion;
export const monthIdx = (ctx, w = ctx.state.week) => Math.floor((w % 48) / 4);
export const isDigital = (ctx) => tableYear(ctx) >= C(ctx).digitalYear;
export const mkt = (state) => (state.mkt ||= { ref: {}, refAll: 0, total: 0, N: 0, S1: 1, allTime: [], years: [], hypeBank: 0, pubRel: {}, genreRep: {} });
export const fillerCount = (ctx) => Math.round(lerpTable(C(ctx).filler, tableYear(ctx)));
const peakSum = (g) => (typeof g.peak === 'number' ? g.peak : Object.values(g.peak || {}).reduce((a, b) => a + b, 0));
const ageW = (ctx) => (isDigital(ctx) ? D(ctx).ageWeeksDigital : D(ctx).ageWeeks);
const stopAt = (ctx) => D(ctx).stopAt * (isDigital(ctx) ? D(ctx).stopDigitalK : 1);

// ---------- Yayılma eğrisi
// Ömür boyu toplamı (zirve haftası cinsinden) hedefe eşitleyen çarpan. Durma kuralı mk'ye bağlı olduğu için iki tur.
function lifeMk(ctx, p, q, life) {
  const aw = ageW(ctx), stop = stopAt(ctx), dd = D(ctx);
  let mk = life;
  for (let it = 0; it < 3; it++) {
    let F = 0, sum = 0;
    for (let t = 0; t < 900; t++) {
      const s = Math.min(1 - F, (p + q * F) * (1 - F));
      const v = s * Math.exp(-t / aw);
      if (t >= dd.minWeeks && F > 0.3 && mk * v < stop) break;
      sum += v; F += s;
    }
    mk = life / Math.max(1e-6, sum);
  }
  return mk;
}
export function playerPQ(ctx, g) {
  const dd = D(ctx), st = ctx.state;
  const fansT = clamp(Math.log10(Math.max(1, st.fans) / 10000) / 2, 0, 1);
  let p = dd.pBase + dd.pHype * clamp((g.hype || 0) / 100, 0, 1) + dd.pPub * (g.publisherPower || 0) / 100 + dd.pIp * Math.min(1, g.ipValue || 0) + dd.pFans * fansT;
  p /= Math.pow(1 + fillerCount(ctx) / C(ctx).discoverRef, C(ctx).discoverExp); // kalabalık pazarda sesini duyurmak zor
  const sc = clamp((g.score - dd.qScoreFrom) / dd.qScoreSpan, 0, 1);
  let q = dd.qBase + dd.qScore * sc + (dd.qSocial[g.genre] || 0);
  q *= 1 - Math.min(dd.qBugMax, (g.bugRate || 0) * dd.qBug);
  if (g.pirated) q *= dd.piracyQ;
  return { p: clamp(p, dd.pMin, dd.pMax), q: clamp(q, dd.qMin, dd.qMax) };
}
function rivalPQ(ctx, g, rank) {
  const dd = D(ctx);
  const p = g.hist ? dd.histP[1] - (dd.histP[1] - dd.histP[0]) * clamp(rank ?? 5, 0, 9) / 9 : dd.rivalP[0] + ctx.rng.next() * (dd.rivalP[1] - dd.rivalP[0]);
  const q = dd.qBase + dd.qScore * clamp((g.score - dd.qScoreFrom) / dd.qScoreSpan, 0, 1);
  return { p: clamp(p, dd.pMin, dd.pMax), q: clamp(q, dd.qMin, dd.qMax) };
}
export function initDif(ctx, g, pq, life) {
  g.dif = { p: pq.p, q: pq.q, F: 0, kick: 0, mk: lifeMk(ctx, pq.p, pq.q, life) };
  return g.dif;
}
// Eski kayıtlar: eğrisi olmayan oyun, geçen hafta sayısı kadar ilerletilir.
export function ensureDif(ctx, g) {
  if (g.dif) return g.dif;
  const rival = typeof g.peak === 'number';
  const d = initDif(ctx, g, rival ? rivalPQ(ctx, g, g.hist ? 5 : null) : playerPQ(ctx, g), rival ? D(ctx).lifeWeeks : g.pirated ? D(ctx).lifeWeeksPirated : D(ctx).lifeWeeks);
  for (let t = 0; t < (g.weeks || 0); t++) d.F = Math.min(1, d.F + Math.min(1 - d.F, (d.p + d.q * d.F) * (1 - d.F)));
  return d;
}
const baseRate = (d) => Math.max(0, (d.p + d.kick + d.q * d.F) * (1 - d.F));

export function visMult(ctx, g) {
  const c = C(ctx);
  let v = 1;
  if (g.rank) for (const [r, m] of c.visibility) if (g.rank <= r) { v = m; break; }
  if (isDigital(ctx) && g.rank && g.rank <= c.showcase.rank) v *= c.showcase.mult;
  if ((g.coverUntil || 0) > ctx.state.week) v *= c.cover.mult;
  return v;
}
export function seasonMult(ctx, g, m = monthIdx(ctx)) {
  const c = C(ctx);
  let t = c.season[m];
  const ex = c.seasonTopic[g.topic];
  if (ex && ex[0] === m) t *= ex[1];
  return t;
}
export function timing(ctx, g) {
  let t = seasonMult(ctx, g) * (g.comp ?? 1);
  if (g.offShelf) t *= C(ctx).shelf.offMult;
  return t;
}
// Bu haftanın adımı: s = yayılan pay, k = zirve başına satış (eskime dahil).
export function step(ctx, g) {
  const d = ensureDif(ctx, g);
  const r = Math.max(0, (d.p * visMult(ctx, g) + d.kick + d.q * d.F) * (1 - d.F));
  const s = Math.min(1 - d.F, r * timing(ctx, g));
  return { s, k: d.mk * s * Math.exp(-(g.weeks || 0) / ageW(ctx)) };
}
export function commit(ctx, g, s) {
  const d = g.dif;
  d.F = Math.min(1, d.F + Math.max(0, s));
  d.kick *= D(ctx).kickDecay;
}
export const ended = (ctx, g, st) => (g.weeks || 0) >= D(ctx).minWeeks && (g.dif.F > 0.3 || g.weeks > 52) && st.k < stopAt(ctx);
// Canlandırma (güncelleme, fiyat indirimi, ek içerik, festival): yeni potansiyel alıcı + kısa merak.
export function revive(ctx, g, weeks, kick = D(ctx).reviveKick) {
  const d = ensureDif(ctx, g);
  d.F = Math.max(0, d.F - weeks * D(ctx).reviveWeek);
  d.kick += kick;
}
// Satış kartı için tek kelimelik eğri durumu
export function curveWord(ctx, g) {
  if (!g.active) return 'bitti';
  const d = ensureDif(ctx, g), r = baseRate(d);
  const next = (d.p + d.q * (d.F + r)) * (1 - d.F - r);
  if (g.weeks <= 2 && d.p >= 0.12) return 'patlama';
  if (next > r * 1.02) return 'yükseliyor';
  if (d.q < 0.12 && d.p < 0.05) return 'uzun soluklu';
  return d.F > 0.85 ? 'kuyrukta' : 'sönüyor';
}

// ---------- Oyunun yayınlanması ve basım
export function onRelease(ctx, g, printRun = 'normal') {
  const dd = D(ctx);
  initDif(ctx, g, playerPQ(ctx, g), g.pirated ? dd.lifeWeeksPirated : dd.lifeWeeks);
  Object.assign(g, { aw: {}, offShelf: false, shelfMiss: 0, shelfPaid: false, stock: 0, printQ: [], printCost: 0, listWeeks: 0, top10Run: 0, play: 0, yU: 0, yY: Math.floor(tableYear(ctx)) });
  g.printed = printable(ctx, g);
  if (g.printed) {
    g.printAuto = true;
    const weeks = C(ctx).print.runs[printRun] ?? C(ctx).print.runs.normal;
    print(ctx, g, expectedUnits(ctx, g, weeks), 0);
  }
}
export const printable = (ctx, g) => !isDigital(ctx) && g.royalty == null && g.model !== 'f2p';
export function printUnitCost(ctx, g) {
  const s = ctx.pack.sales, tot = peakSum(g) || 1;
  let c = 0;
  for (const id of g.platforms) {
    const p = platformById(ctx, id);
    if (!p) continue;
    const k = lerpTable(s.unitCostK[p.kind] || s.unitCostK.konsol, tableYear(ctx));
    c += (g.peak[id] || 0) / tot * s.unitCost * k;
  }
  return c * inflation(ctx) ** 0.5;
}
// Önümüzdeki n haftanın beklenen satışı (çarpanlar hariç, kaba tahmin)
export function expectedUnits(ctx, g, n) {
  const d = ensureDif(ctx, g);
  let F = d.F, kick = d.kick, sum = 0;
  for (let t = 0; t < n; t++) {
    const s = Math.min(1 - F, (d.p + kick + d.q * F) * (1 - F));
    sum += d.mk * s * Math.exp(-((g.weeks || 0) + t) / ageW(ctx));
    F += s; kick *= D(ctx).kickDecay;
  }
  return Math.max(0, Math.round(sum * peakSum(g) * 1.05));
}
export function print(ctx, g, n, delay = C(ctx).print.delay) {
  n = Math.max(0, Math.round(n));
  if (!n) return 0;
  const cost = Math.round(n * printUnitCost(ctx, g));
  ctx.ledger.post('basim', -cost, `${g.name} basımı`);
  g.printCost = (g.printCost || 0) + cost;
  g.postCost = (g.postCost || 0) + cost;
  if (delay > 0) (g.printQ ||= []).push({ w: ctx.state.week + delay, n });
  else g.stock = (g.stock || 0) + n;
  return cost;
}
// Haftalık stok: gelen baskılar, otomatik yeniden basım. Satılabilecek en fazla kopyayı döndürür.
export function stockFor(ctx, g) {
  if (!g.printed) return Infinity;
  const due = (g.printQ || []).filter((x) => x.w <= ctx.state.week);
  if (due.length) { for (const x of due) g.stock += x.n; g.printQ = g.printQ.filter((x) => x.w > ctx.state.week); g.soldOut = false; }
  if (g.printAuto && !g.printQ.length) {
    const need = Math.max(g.lastWeek || 0, expectedUnits(ctx, g, 1)) * C(ctx).print.delay;
    if (g.stock < need) print(ctx, g, Math.max(expectedUnits(ctx, g, C(ctx).print.reprintWeeks), (g.lastWeek || 0) * 2));
  }
  return g.stock;
}
export function reprint(ctx, id) {
  const g = ctx.state.games.find((x) => x.id === id);
  if (!g || !g.active || !g.printed) return { ok: false, msg: 'Bu oyun basılmıyor.' };
  const n = Math.max(expectedUnits(ctx, g, C(ctx).print.reprintWeeks), (g.lastWeek || 0) * 2, 50);
  if (ctx.state.cash < n * printUnitCost(ctx, g)) return { ok: false, msg: 'Basım için para yetmiyor.' };
  print(ctx, g, n);
  ctx.news(`🖨️ "${g.name}" için ${n.toLocaleString('tr-TR')} kopya baskıya girdi. ${C(ctx).print.delay} hafta sonra rafta.`, 'info');
  return { ok: true };
}
export function togglePrintAuto(ctx, id) {
  const g = ctx.state.games.find((x) => x.id === id);
  if (!g || !g.printed) return { ok: false, msg: 'Bu oyun basılmıyor.' };
  g.printAuto = !g.printAuto;
  return { ok: true };
}

// ---------- Rekabet: aynı tür ve tüm pazar. Normal kalabalığa göre ne kadar az ya da çok rakip var?
export function prepWeek(ctx) {
  const { state } = ctx, cc = C(ctx).competition, m = mkt(state);
  const all = [...state.games.filter((g) => g.active), ...state.rivalGames.filter((g) => g.active)];
  const by = {};
  let tot = 0;
  for (const g of all) {
    g._A = peakSum(g) * ensureDif(ctx, g).mk * baseRate(g.dif) * (typeof g.peak === 'number' ? C(ctx).rivalScale : 1);
    (by[g.genre] ||= []).push(g); tot += g._A;
  }
  const term = (R, O) => (R > 0 ? (2 * R) / (R + O) : O > 0 ? 0 : 1);
  let wAll = 0, oAll = 0;
  for (const g of all) { wAll += g._A; oAll += g._A * (tot - g._A); }
  if (wAll > 0) m.refAll = m.refAll ? m.refAll * (1 - cc.ema) + (oAll / wAll) * cc.ema : oAll / wAll;
  for (const [genre, list] of Object.entries(by)) {
    const crowd = list.reduce((a, g) => a + g._A, 0);
    const w = crowd, o = list.reduce((a, g) => a + g._A * (crowd - g._A), 0);
    if (w > 0) m.ref[genre] = m.ref[genre] != null ? m.ref[genre] * (1 - cc.ema) + (o / w) * cc.ema : o / w;
    for (const g of list) {
      const c = Math.pow(term(m.ref[genre] || 0, crowd - g._A), cc.segW) * Math.pow(term(m.refAll, tot - g._A), cc.allW);
      g.comp = clamp(c, cc.min, cc.max);
    }
  }
}

// ---------- Rakip oyunlar
// Yeni rakip oyuna platform, bölge dağılımı ve yayılma eğrisi verir.
export function tagRival(ctx, rg, { rank = null, owner = null } = {}) {
  const act = activePlatforms(ctx).filter((p) => !p.own);
  const own = owner && act.filter((p) => p.owner === owner);
  const pool = own && own.length ? own : act;
  const w = pool.map((p) => Math.max(0, platformBase(ctx, p)));
  let r = ctx.rng.next() * (w.reduce((a, b) => a + b, 0) || 1), plat = pool[0];
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { plat = pool[i]; break; } }
  rg.plat = plat?.id || null;
  const mix = plat ? regionMix(ctx, { genre: rg.genre, regions: ALL_REGIONS(ctx) }, plat) : {};
  const sum = Object.values(mix).reduce((a, b) => a + b, 0) || 1;
  rg.split = Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, v / sum]));
  initDif(ctx, rg, rivalPQ(ctx, rg, rank), D(ctx).lifeWeeks);
  Object.assign(rg, { offShelf: false, shelfMiss: 0, listWeeks: 0, play: 0, yU: 0, yY: Math.floor(tableYear(ctx)) });
  return rg;
}
// Rafta hazır başlayan rakip oyunlar: n hafta ilerletilmiş gibi
export function advanceRival(ctx, rg, n) {
  const d = ensureDif(ctx, rg);
  for (let t = 0; t < n; t++) d.F = Math.min(1, d.F + Math.min(1 - d.F, baseRate(d)));
}
export function sellRivals(ctx, mult) {
  for (const g of ctx.state.rivalGames) {
    if (!g.active) continue;
    const st = step(ctx, g);
    if (ended(ctx, g, st)) { g.active = false; g.lastWeek = 0; continue; }
    g.lastWeek = Math.round(g.peak * st.k * mult * C(ctx).rivalScale);
    g.units += g.lastWeek; g.weeks++;
    commit(ctx, g, st.s);
  }
}

// ---------- Liste: dolgu oyunlar, gerçek sıra, raf, ödüller, liste ailesi
const aboveFn = (m, zipf) => (x) => (x > 0 ? Math.min(m.N, Math.floor(Math.pow(m.S1 / x, 1 / zipf))) : m.N);
export function rankOf(ctx, x, entries) {
  const m = mkt(ctx.state);
  return 1 + entries.filter((e) => e.x > x).length + aboveFn(m, C(ctx).zipf)(x);
}
function entriesOf(ctx) {
  const { state } = ctx;
  const mine = state.games.filter((g) => g.active && g.weeks > 0 && g.model !== 'f2p').map((g) => ({ g, mine: true, studio: state.companyName }));
  const riv = state.rivalGames.filter((g) => g.active && g.weeks > 0).map((g) => ({ g, mine: false, studio: g.studio }));
  const all = [...mine, ...riv];
  for (const e of all) e.x = (e.g.lastWeek || 0) + (e.g.chartBoost || 0);
  return all.sort((a, b) => b.x - a.x);
}
function reward(ctx, g, key, fn) { g.aw ||= {}; if (g.aw[key]) return; g.aw[key] = true; fn(); }
function applyReward(ctx, g, r) {
  const { state } = ctx;
  if (r.fansOfUnits) state.fans += Math.round((g.units || 0) * r.fansOfUnits);
  if (r.morale) for (const p of state.staff) p.morale = clamp(p.morale + r.morale, 0, 100);
  const m = mkt(state);
  if (r.pubRel && g.publisherId) m.pubRel[g.publisherId] = (m.pubRel[g.publisherId] || 0) + r.pubRel;
  if (r.hypeBank) m.hypeBank = Math.min(30, m.hypeBank + r.hypeBank);
  if (r.genreRep) m.genreRep[g.genre] = (m.genreRep[g.genre] || 0) + r.genreRep;
  if (r.prestige) state.prestige = Math.min(ctx.pack.prestige.max, state.prestige + r.prestige);
}

// Pazar özeti: dolgu sayısı, en iyi dolgu oyunun satışı, toplam oyun (kayıt yüklenince de hemen hesaplanır)
function marketRefresh(ctx, entries = entriesOf(ctx)) {
  const c = C(ctx), m = mkt(ctx.state);
  const sims = entries.filter((e) => !e.mine && e.x > 0);
  const anchor = sims.length ? sims[Math.min(c.fillerAnchor, sims.length - 1)].x : 1;
  m.N = fillerCount(ctx); m.S1 = Math.max(1, anchor * c.fillerTopK); m.total = entries.length + m.N;
  return m;
}
export function weeklyCharts(ctx) {
  const { state, pack } = ctx, c = C(ctx), y = tableYear(ctx), Y = Math.floor(y);
  const entries = entriesOf(ctx);
  const m = marketRefresh(ctx, entries);
  const above = aboveFn(m, c.zipf);
  const gCount = {};
  for (const g of state.games) if (!g.active || g.model === 'f2p') { if (g.rank) g.prevRank = g.rank; g.rank = null; g.gRank = null; }
  const shelfN = lerpTable(c.shelf.size, y), digital = y >= c.digitalYear, share = 1 / pack.genres.length;
  let greater = 0;
  entries.forEach((e, i) => {
    if (i > 0 && e.x < entries[i - 1].x) greater = i;
    const g = e.g;
    g.prevRank = g.rank ?? null;
    g.rank = 1 + greater + above(e.x);
    g.bestRank = Math.min(g.bestRank ?? 999999, g.rank);
    gCount[g.genre] = gCount[g.genre] || { n: 0, last: Infinity, idx: 0 };
    const gc = gCount[g.genre];
    if (e.x < gc.last) gc.idx = gc.n;
    gc.n++; gc.last = e.x;
    g.gRank = 1 + gc.idx + Math.floor(above(e.x) * share);
    if (g.rank <= c.lists.show) g.listWeeks = (g.listWeeks || 0) + 1;
    g.top10Run = g.rank <= c.lists.top ? (g.top10Run || 0) + 1 : 0;
    g.chartBoost = 0;
    // Raf: fiziksel dönemde ilk N'nin dışında iki hafta kalan oyun raftan iner
    if (digital) { g.offShelf = false; g.shelfMiss = 0; }
    else if (!g.offShelf) {
      g.shelfMiss = g.rank > shelfN ? (g.shelfMiss || 0) + 1 : 0;
      if (g.shelfMiss >= c.shelf.missWeeks && !g.shelfPaid) {
        g.offShelf = true;
        if (e.mine) ctx.news(`📦 "${g.name}" raftan indi: dükkânlar yerini yeni oyunlara verdi. Ucuz Raf Serisi ya da raf parası geri getirir.`, 'warn');
      }
    }
    if (e.mine) {
      (g.rankHist ||= []).push(g.rank); if (g.rankHist.length > pack.rivals.rankHistMax) g.rankHist.shift();
      const R = c.rewards;
      if (g.weeks === 1) ctx.news(`📊 "${g.name}" satış listesine #${g.rank.toLocaleString('tr-TR')}'den girdi (${m.total.toLocaleString('tr-TR')} oyun arasında).`, g.rank <= c.lists.top ? 'good' : 'info');
      if (g.rank <= c.lists.show) reward(ctx, g, 'top40', () => { applyReward(ctx, g, R.top40); if (g.rank > c.lists.top) ctx.news(`📈 "${g.name}" ilk ${c.lists.show}'a girdi (#${g.rank}).`, 'good'); });
      if (g.rank <= c.lists.top) reward(ctx, g, 'top10', () => { applyReward(ctx, g, R.top10); ctx.news(`🔟 "${g.name}" satış listesinde ilk 10'da (#${g.rank})! Hayranlar ve ekip coştu.`, 'good'); });
      if (g.rank === 1) reward(ctx, g, 'no1', () => { applyReward(ctx, g, R.no1); ctx.news(`👑 "${g.name}" listenin zirvesinde! Dergi kapakları senin; bir sonraki oyunun merakla bekleniyor.`, 'good'); });
      if (g.gRank === 1) reward(ctx, g, 'genre1', () => { applyReward(ctx, g, R.genre1); ctx.news(`🏅 "${g.name}" ${pack.genres.find((x) => x.id === g.genre).name.toLowerCase()} listesinde #1.`, 'good'); });
      if (g.top10Run >= R.classicRun) reward(ctx, g, 'classic', () => { g.dif.q += R.classicQ; ctx.news(`💎 "${g.name}" ${R.classicRun} haftadır ilk 10'da: artık bir klasik. Ağızdan ağıza yayılıyor.`, 'good'); });
    }
  });
  // Oynananlar (son aylarda oyuna sahip olup oynayanların kaba tahmini), yıllık sayaç
  for (const g of [...state.games, ...state.rivalGames]) {
    if (!g.active) continue;
    g.play = g.model === 'f2p' ? (g.players || 0) : (g.play || 0) * c.lists.playDecay + (g.lastWeek || 0);
    if (g.yY !== Y) { g.yY = Y; g.yU = 0; }
    g.yU = (g.yU || 0) + (g.model === 'f2p' ? 0 : g.lastWeek || 0);
  }
  state.top = merged(ctx, entries.map((e) => ({ id: e.g.id, name: e.g.name, studio: e.studio, units: e.x, mine: e.mine, rank: e.g.rank, prev: e.g.prevRank, weeksOn: e.g.listWeeks || 0, best: e.g.bestRank })), 1, m.S1, 'genel').slice(0, c.lists.top);
  if (state.week % 48 === 47) yearEnd(ctx, Y);
  if (state.week % 4 === 0) allTime(ctx);
}

function yearEnd(ctx, Y) {
  const { state } = ctx, c = C(ctx), m = mkt(state);
  const list = [...state.games.filter((g) => g.model !== 'f2p').map((g) => ({ g, mine: true, studio: state.companyName })), ...state.rivalGames.map((g) => ({ g, mine: false, studio: g.studio }))]
    .filter((e) => e.g.yY === Y && e.g.yU > 0).sort((a, b) => b.g.yU - a.g.yU).slice(0, c.lists.top)
    .map((e, i) => ({ rank: i + 1, id: e.g.id, name: e.g.name, studio: e.studio, units: e.g.yU, mine: e.mine }));
  m.years.unshift({ y: Y, list });
  if (m.years.length > 60) m.years.length = 60;
  for (const e of list.filter((x) => x.mine)) {
    const g = state.games.find((x) => x.id === e.id);
    reward(ctx, g, `yil${Y}`, () => applyReward(ctx, g, c.rewards.yearTop));
  }
  const mineTop = list.filter((x) => x.mine);
  if (list.length) ctx.news(`🗓️ ${Y} yılının en çok satanı: "${list[0].name}" (${list[0].studio}).${mineTop.length ? ` Senin ${mineTop.length} oyunun yılın ilk 10'unda!` : ''}`, mineTop.length ? 'good' : 'info');
}
function allTime(ctx) {
  const { state } = ctx, c = C(ctx), m = mkt(state);
  const map = new Map(m.allTime.map((x) => [x.id, x]));
  const cands = [...state.games.filter((g) => g.model !== 'f2p' && !g.portOf).map((g) => ({ g, mine: true, studio: state.companyName })), ...state.rivalGames.map((g) => ({ g, mine: false, studio: g.studio }))];
  const minU = m.allTime.length >= c.lists.allTimeMax ? m.allTime.at(-1).units : 0;
  for (const { g, mine, studio } of cands) if (g.units > minU || map.has(g.id)) map.set(g.id, { id: g.id, name: g.name, studio, units: g.units, year: g.year ?? Math.floor(tableYear(ctx)), mine });
  m.allTime = [...map.values()].sort((a, b) => b.units - a.units).slice(0, c.lists.allTimeMax);
  for (const e of m.allTime.filter((x) => x.mine)) {
    const g = state.games.find((x) => x.id === e.id);
    if (g) reward(ctx, g, 'allTime', () => {
      const ip = state.ips.find((x) => x.id === g.ipId);
      if (ip) ip.value = Math.min(ctx.pack.ip.max, ip.value + c.rewards.allTime.ip);
      ctx.news(`🏛️ "${g.name}" tüm zamanların en çok satan ${c.lists.allTimeMax} oyunu arasında. Serinin değeri arttı.`, 'good');
    });
  }
}

// Dolgu oyunlar listede adıyla görünür: küçük stüdyoların oyunları. Ad, yıl ve sıraya göre sabittir.
const FILLER_STUDIOS = ['Garaj Yazılım', 'Bodrum Bilişim', 'Mini Piksel', 'Kasetçi Kardeşler', 'Mahalle Kodcuları', 'Gece Vardiyası', 'Çay Ocağı Oyun', 'Disket Dostları', 'Tek Kişilik Ordu', 'Pikselhane', 'Ufak Tefek Yapım', 'Kuzen Yazılım'];
function fillerName(ctx, key, j) {
  let h = 2166136261;
  for (const ch of `${key}|${Math.floor(tableYear(ctx))}|${j}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const r = ctx.pack.rivals, A = r.gameNamesA, B = r.gameNamesB;
  return { name: `${A[h % A.length]} ${B[(h >>> 8) % B.length]}${(h >>> 16) % 4 === 0 ? ' ' + (2 + ((h >>> 20) % 3)) : ''}`, studio: FILLER_STUDIOS[(h >>> 12) % FILLER_STUDIOS.length] };
}
// Gerçek satırlarla dolgu satırlarını sıraya göre birleştirir (ilk 40 için yeterince dolgu üretir).
function merged(ctx, rows, share, S1, key) {
  const c = C(ctx), m = mkt(ctx.state), out = [...rows];
  const n = Math.min(Math.floor(m.N * share), c.lists.show + 5);
  for (let j = 1; j <= n; j++) {
    const x = Math.floor(S1 / Math.pow(j / share, c.zipf));
    if (x <= 0) break;
    out.push({ ...fillerName(ctx, key, j), units: x, filler: true, rank: null });
  }
  out.sort((a, b) => b.units - a.units || (a.filler ? 1 : -1));
  // Görünen ilk satırlarda sıra konuma göre verilir (eşitlikte tutarlı); daha aşağısı formüldeki sırayı korur.
  let greater = 0;
  out.forEach((r, i) => { if (i > 0 && r.units < out[i - 1].units) greater = i; if (r.filler || i < c.lists.show) r.rank = greater + 1; });
  return out;
}

// ---------- Liste ailesi (arayüz için): genel, tür, platform, bölge, oynanan, yıl, tüm zamanlar
// Her satır: { rank, prev, name, studio, units, weeksOn, best, mine, id }. pinned: listede görünmeyen kendi oyunların.
export function listView(ctx, kind = 'genel', key = null) {
  const { state } = ctx, c = C(ctx), m = mkt(state);
  if (!m.N) marketRefresh(ctx);
  const base = entriesOf(ctx);
  const above = aboveFn(m, c.zipf);
  let rows, share = 1, unit = 'kopya';
  const unitsOf = (e) => {
    const g = e.g;
    if (kind === 'platform') return e.mine ? Math.round((g.lastWeek || 0) * (g.peak?.[key] || 0) / (peakSum(g) || 1)) : g.plat === key ? e.x : 0;
    if (kind === 'bolge') { const sp = e.mine ? g.regionSplit : g.split; return Math.round(e.x * (sp?.[key] || 0)); }
    return e.x;
  };
  if (kind === 'yil') {
    const yr = m.years.find((x) => x.y === key) || m.years[0];
    return { rows: (yr?.list || []).map((r) => ({ ...r })), pinned: [], unit, total: yr?.list.length || 0, year: yr?.y };
  }
  if (kind === 'tum') return { rows: m.allTime.slice(0, c.lists.allTimeMax).map((r, i) => ({ ...r, rank: i + 1 })), pinned: [], unit, total: m.allTime.length };
  if (kind === 'oynanan') {
    unit = 'oyuncu';
    const all = [...state.games.filter((g) => g.active).map((g) => ({ g, mine: true, studio: state.companyName })), ...state.rivalGames.filter((g) => g.active).map((g) => ({ g, mine: false, studio: g.studio }))]
      .map((e) => ({ ...e, x: Math.round(e.g.play || 0) })).sort((a, b) => b.x - a.x);
    rows = all.map((e) => ({ e, x: e.x }));
    share = 1; // dolgu oyunlar oyuncu listesinde de aynı oranla
    const S1p = m.S1 * 12;
    return finish(rows, (x) => (x > 0 ? Math.min(m.N, Math.floor(Math.pow(S1p / x, 1 / c.zipf))) : m.N), S1p);
  }
  if (kind === 'tur') { rows = base.filter((e) => e.g.genre === key).map((e) => ({ e, x: e.x })); share = 1 / ctx.pack.genres.length; }
  else if (kind === 'platform') { rows = base.map((e) => ({ e, x: unitsOf(e) })).filter((r) => r.x > 0); const p = platformById(ctx, key), act = activePlatforms(ctx); share = p ? platformBase(ctx, p) / (act.reduce((a, q) => a + platformBase(ctx, q), 0) || 1) : 0; }
  else if (kind === 'bolge') { rows = base.map((e) => ({ e, x: unitsOf(e) })).filter((r) => r.x > 0); share = 1 / ctx.pack.regions.list.length; }
  else rows = base.map((e) => ({ e, x: e.x }));
  rows.sort((a, b) => b.x - a.x);
  return finish(rows, (x) => Math.floor(above(x) * share), m.S1);

  function finish(list, fill, S1) {
    let greater = 0;
    const out = list.map((r, i) => {
      if (i > 0 && r.x < list[i - 1].x) greater = i;
      const g = r.e.g;
      return { rank: 1 + greater + fill(r.x), prev: kind === 'genel' ? g.prevRank : null, name: g.name, studio: r.e.studio, units: r.x, weeksOn: g.listWeeks || 0, best: g.bestRank, mine: r.e.mine, id: g.id, offShelf: g.offShelf, f2p: g.model === 'f2p' };
    });
    const sh = kind === 'genel' || kind === 'oynanan' ? 1 : share;
    const total = list.length + Math.floor(sh * m.N);
    const all = merged(ctx, out, sh, S1, `${kind}|${key}`);
    const shown = all.slice(0, c.lists.show);
    return { rows: shown, pinned: out.filter((r) => r.mine && !shown.includes(r)), unit, total };
  }
}
// Satış kartı ve HUD için sıra metni
export function rankLabel(ctx, g) {
  const c = C(ctx), m = mkt(ctx.state);
  if (!m.N) marketRefresh(ctx);
  if (!g.active || !g.rank) return { text: '—', cls: 'off', sub: '' };
  const fmt = (n) => n.toLocaleString('tr-TR');
  if (g.rank <= c.lists.top) return { text: `#${g.rank}`, cls: 'top', sub: `${g.listWeeks || 0}. hafta listede · en iyi #${g.bestRank}` };
  if (g.rank <= c.lists.show) {
    const tenth = (ctx.state.top || [])[c.lists.top - 1];
    return { text: `#${g.rank}`, cls: 'mid', sub: tenth ? `ilk 10'a haftada ${fmt(Math.max(0, tenth.units - g.lastWeek))} kopya kaldı` : `ilk ${c.lists.show}'ta` };
  }
  return { text: `#${fmt(g.rank)}`, cls: 'off', sub: `${fmt(m.total)} oyun arasında · listede değil${g.offShelf ? ' · raftan indi' : ''}` };
}

// ---------- Oyuncu hamleleri
const game = (ctx, id) => ctx.state.games.find((x) => x.id === id);
const sizeSales = (ctx, g) => ctx.pack.sizes.find((s) => s.id === g.size)?.sales || 1;
export const budgetCost = (ctx, g) => Math.round(C(ctx).shelf.budgetCost * inflation(ctx) ** 0.5 * sizeSales(ctx, g));
export const budgetAllowed = (ctx, g) => !!g && g.active && !g.budget && g.model !== 'f2p' && !isDigital(ctx) && (g.offShelf || g.weeks >= C(ctx).shelf.budgetMinWeeks);
export function budgetLine(ctx, id) {
  const g = game(ctx, id), sh = C(ctx).shelf;
  if (!budgetAllowed(ctx, g)) return { ok: false, msg: 'Ucuz Raf Serisi bu oyun için şu an açık değil.' };
  const cost = budgetCost(ctx, g);
  if (ctx.state.cash < cost) return { ok: false, msg: `Yeniden dağıtım ${cost.toLocaleString('tr-TR')} $.` };
  ctx.ledger.post('dagitim', -cost, `${g.name} Ucuz Raf Serisi`);
  g.postCost = (g.postCost || 0) + cost;
  const k = Math.pow(g.price / Math.max(ctx.pack.post.priceFloor, Math.round(g.price * sh.budgetPrice)), ctx.pack.sales.priceExp);
  g.price = Math.max(ctx.pack.post.priceFloor, Math.round(g.price * sh.budgetPrice));
  for (const pid in g.peak) g.peak[pid] *= Math.min(k, 2);
  g.budget = true; g.offShelf = false; g.shelfMiss = 0;
  revive(ctx, g, sh.budgetRevive / D(ctx).reviveWeek, sh.budgetKick);
  ctx.news(`🏷️ "${g.name}" Ucuz Raf Serisi'nde, ${g.price} $. Raflara geri döndü.`, 'good');
  return { ok: true };
}
export const shelfFee = (ctx, g) => Math.round(C(ctx).shelf.fee * inflation(ctx) ** 0.5 * sizeSales(ctx, g));
export function toggleShelfPay(ctx, id) {
  const g = game(ctx, id);
  if (!g || !g.active || isDigital(ctx) || g.model === 'f2p') return { ok: false, msg: 'Raf parası yalnız fiziksel dönemde ödenir.' };
  g.shelfPaid = !g.shelfPaid;
  if (g.shelfPaid) { g.offShelf = false; g.shelfMiss = 0; }
  ctx.news(g.shelfPaid ? `🤝 "${g.name}" için zincir mağazalara raf parası ödeniyor (haftada ${shelfFee(ctx, g).toLocaleString('tr-TR')} $).` : `"${g.name}" için raf parası kesildi.`, 'info');
  return { ok: true };
}
export function weeklyFees(ctx) {
  for (const g of ctx.state.games) {
    if (g.active && g.shelfPaid && !isDigital(ctx)) { const f = shelfFee(ctx, g); ctx.ledger.post('raf_parasi', -f, g.name); g.postCost = (g.postCost || 0) + f; }
    else if (g.shelfPaid && (isDigital(ctx) || !g.active)) g.shelfPaid = false;
    if (g.festUntil && g.festUntil <= ctx.state.week) { g.price = g.festPrice; g.festUntil = null; }
  }
}
export const festivalOpen = (ctx) => isDigital(ctx) && C(ctx).festival.months.includes(monthIdx(ctx));
export const festivalAllowed = (ctx, g) => !!g && g.active && festivalOpen(ctx) && g.model !== 'f2p' && g.weeks >= C(ctx).festival.minWeeks && !g.festUntil && (g.festLast || -99) < ctx.state.week - 8;
export function festival(ctx, id) {
  const g = game(ctx, id), f = C(ctx).festival;
  if (!festivalAllowed(ctx, g)) return { ok: false, msg: 'İndirim festivali şu an bu oyun için açık değil.' };
  g.festPrice = g.price; g.festUntil = ctx.state.week + f.weeks; g.festLast = ctx.state.week;
  g.price = Math.max(1, Math.round(g.price * f.price));
  revive(ctx, g, f.revive / D(ctx).reviveWeek, f.kick);
  ctx.news(`🎪 "${g.name}" indirim festivalinde: ${f.weeks} hafta ${g.price} $.`, 'good');
  return { ok: true };
}
export const bulkCopies = (ctx, g) => Math.max(C(ctx).bulk.minCopies, Math.round(Math.max(g.lastWeek || 0, expectedUnits(ctx, g, 1)) * C(ctx).bulk.share));
export const bulkCost = (ctx, g) => Math.round(bulkCopies(ctx, g) * g.price * C(ctx).bulk.costK);
export const bulkAllowed = (ctx, g) => !!g && g.active && g.model !== 'f2p' && g.weeks <= C(ctx).bulk.maxWeeks && !g.bulk;
export function bulkBuy(ctx, id) {
  const g = game(ctx, id), b = C(ctx).bulk;
  if (!bulkAllowed(ctx, g)) return { ok: false, msg: 'Toplu alım yalnız çıkışın ilk haftalarında, oyun başına bir kez.' };
  const n = bulkCopies(ctx, g), cost = bulkCost(ctx, g);
  if (ctx.state.cash < cost) return { ok: false, msg: `Toplu alım ${cost.toLocaleString('tr-TR')} $.` };
  ctx.ledger.post('toplu_alim', -cost, g.name);
  g.postCost = (g.postCost || 0) + cost;
  g.bulk = true; g.chartBoost = (g.chartBoost || 0) + n;
  if (ctx.rng.chance(b.scandal)) {
    ctx.state.fans = Math.round(ctx.state.fans * (1 - b.scandalFans)); ctx.state.kaos = Math.min(100, ctx.state.kaos + b.scandalKaos);
    if (g.publisherId) { const m = mkt(ctx.state); m.pubRel[g.publisherId] = (m.pubRel[g.publisherId] || 0) - 10; }
    ctx.news(`🗞️ SKANDAL: "${g.name}" kopyalarını stüdyonun kendisinin topladığı ortaya çıktı! Hayranlar öfkeli.`, 'bad');
  } else ctx.news(`🛒 "${g.name}" için ${n.toLocaleString('tr-TR')} kopya sessizce toplandı. Liste haftası heyecanlı geçecek.`, 'info');
  return { ok: true };
}
export const coverCost = (ctx) => Math.round(C(ctx).cover.cost * inflation(ctx) ** 0.5);
export const coverAllowed = (ctx, g) => !!g && g.active && (g.coverUntil || 0) <= ctx.state.week && !g.cover;
export function buyCover(ctx, id) {
  const g = game(ctx, id), cv = C(ctx).cover;
  if (!coverAllowed(ctx, g)) return { ok: false, msg: 'Bu oyun zaten kapak oldu.' };
  const cost = coverCost(ctx);
  if (ctx.state.cash < cost) return { ok: false, msg: `Dergi kapağı ${cost.toLocaleString('tr-TR')} $.` };
  ctx.ledger.post('reklam', -cost, `${g.name} dergi kapağı`);
  g.postCost = (g.postCost || 0) + cost;
  g.cover = true; g.coverUntil = ctx.state.week + cv.weeks;
  if (ctx.rng.chance(cv.scandal)) {
    ctx.state.fans = Math.round(ctx.state.fans * (1 - cv.scandalFans)); ctx.state.kaos = Math.min(100, ctx.state.kaos + cv.scandalKaos);
    ctx.news(`🗞️ Rakip dergi manşeti: "Para ile kapak: ${g.name}". Biraz utanç verici.`, 'bad');
  } else ctx.news(`📰 "${g.name}" bu ay dergi kapağında!`, 'good');
  return { ok: true };
}

// ---------- Çıkış takvimi ve tarih duyurusu
const companyName = (cid) => COMPANIES.find((x) => x.id === cid)?.name || 'Bağımsız';
export function upcoming(ctx) {
  const y = tableYear(ctx), lm = ctx.state.lengthMult || 1, cal = C(ctx).calendar;
  return (ctx.state.world?.queue || []).filter((h) => h.at - y <= cal.aheadMonths / 12).map((h) => ({
    name: h.name, studio: companyName(h.cid), genre: h.genre, score: h.score, rank: h.rank, slipped: !!h.slipped,
    weeks: Math.max(0, Math.round((h.at - y) * 48 * lm)),
  }));
}
// Büyük çıkışların bir kısmı son anda ertelenir.
export function weeklyCalendar(ctx) {
  const { state, rng } = ctx, cal = C(ctx).calendar, y = tableYear(ctx);
  const q = state.world?.queue || [];
  let moved = false;
  for (const h of q) {
    if (h.slipChecked || h.at - y > cal.slipNotice / 12) continue;
    h.slipChecked = true;
    if (h.rank < cal.slipTopRanks && rng.chance(cal.slip)) {
      const mo = rng.int(...cal.slipMonths);
      h.at += mo / 12; h.slipped = true; moved = true;
      ctx.news(`⏳ ${companyName(h.cid)}, "${h.name}" oyununu ${mo} ay erteledi. Takvim değişti.`, 'tarih');
    }
  }
  if (moved) q.sort((a, b) => a.at - b.at);
  weeklyAnnounce(ctx);
}
export const announceAllowed = (ctx, pj) => !!pj && ['dev', 'debug'].includes(pj.status) && !pj.announce && !pj.annMissed;
export function announce(ctx, pid, weeks) {
  const pj = ctx.state.projects.find((x) => x.id === pid), a = C(ctx).announce;
  if (!announceAllowed(ctx, pj)) return { ok: false, msg: 'Bu proje için tarih duyurulamaz.' };
  if (!a.options.includes(weeks)) return { ok: false, msg: 'Geçersiz süre.' };
  pj.announce = ctx.state.week + weeks; pj.annHype = 0;
  ctx.news(`📣 "${pj.name}" için çıkış tarihi duyuruldu: ${weeks} hafta sonra. Geri sayım başladı!`, 'good');
  return { ok: true };
}
function weeklyAnnounce(ctx) {
  const { state, pack } = ctx, a = C(ctx).announce;
  for (const pj of state.projects) {
    if (!pj.announce) continue;
    if (state.week <= pj.announce) {
      const add = Math.min(a.hypePerWeek, a.hypeCap - (pj.annHype || 0));
      if (add > 0) { pj.hype = Math.min(pack.hype.max, pj.hype + add); pj.annHype = (pj.annHype || 0) + add; }
    } else {
      pj.announce = null; pj.annMissed = true;
      state.fans = Math.round(state.fans * (1 - a.missFans)); state.kaos = Math.min(100, state.kaos + a.missKaos);
      if (pj.publisherHint) { const m = mkt(state); m.pubRel[pj.publisherHint] = (m.pubRel[pj.publisherHint] || 0) - 5; }
      ctx.news(`😬 "${pj.name}" duyurulan tarihte çıkmadı. Hayranlar kızgın, forumlar alevli.`, 'bad');
    }
  }
}
// Rakip, aynı tür ve yakın tarihte duyurulmuş güçlü bir oyundan kaçar mı?
export function rivalDodges(ctx, rv, genre) {
  const a = C(ctx).announce, w = ctx.state.week;
  const hit = ctx.state.projects.some((pj) => pj.announce && pj.genre === genre && Math.abs(pj.announce - w) <= a.dodgeWeeks && pj.hype > rv.rep * 0.5);
  return hit && ctx.rng.chance(a.dodge);
}
// Rakipler de çıkışlarını kalabalık ama kazançlı aylara yığar.
export function rivalPostpones(ctx) {
  const c = C(ctx), s = c.season[monthIdx(ctx)], mx = Math.max(...c.season);
  return ctx.rng.chance((1 - s / mx) * c.rivalSeasonK);
}
// Tarihî hitler için ay seçimi (yerine koymadan, mevsime göre ağırlıklı)
export function pickMonths(ctx, n) {
  const w = [...C(ctx).season], out = [];
  for (let i = 0; i < n && i < 12; i++) {
    let r = ctx.rng.next() * w.reduce((a, b) => a + b, 0), k = 0;
    for (; k < 12; k++) { r -= w[k]; if (r <= 0 && w[k] > 0) break; }
    if (k >= 12) k = w.findIndex((x) => x > 0);
    out.push(k); w[k] = 0;
  }
  return out;
}
export function consumeHypeBank(state) {
  const m = mkt(state), h = m.hypeBank || 0;
  m.hypeBank = 0;
  return h;
}
