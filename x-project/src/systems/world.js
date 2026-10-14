// Tarihsel oyun dünyası: gerçek tarihe paralel (parodi adlı) şirketler, yayıncılar, yılın hit oyunları ve aylık olaylar.
// Şirketler yıllara göre kurulur, güçlenir, zayıflar ve piyasadan çekilir; rakip listesi ve yayıncılar buradan beslenir.
import { COMPANIES, YEARS } from '../data/history.js';
import { lerpTable, clamp } from '../kernel.js';
import { tableYear, Pz, S, difficulty, inflation, activePlatforms } from '../models.js';

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const companyById = (id) => COMPANIES.find((c) => c.id === id);
export const companyRep = (c, y) => lerpTable(c.rep, y);
export const isActive = (c, y) => y >= c.from && y < c.to;
export const yearData = (y) => YEARS[Math.floor(y)] || null;

// Yayıncılar: küçük sabitler + o yıl güçlü olan tarihsel yayıncılar.
export function publishersAvailable(ctx, y = tableYear(ctx)) {
  const W = ctx.pack.world;
  const fixed = ctx.pack.publishers.filter((p) => y >= p.from && y < p.to);
  const hist = COMPANIES.filter((c) => c.kind.includes('pub') && isActive(c, y))
    .map((c) => ({ c, rep: companyRep(c, y) }))
    .filter((x) => x.rep >= W.pubMinRep && !acquired(ctx, x.c.id))
    .sort((a, b) => b.rep - a.rep).slice(0, W.pubMax)
    .map(({ c, rep }) => ({
      id: c.id, name: c.name, power: Math.round(rep), hist: true,
      royalty: Math.max(W.royaltyMin, +(W.royaltyA - W.royaltyK * rep).toFixed(2)),
      minFans: Math.round(Math.max(0, rep - 50) ** 2 * W.minFansK),
    }));
  return [...hist, ...fixed];
}
const acquired = (ctx, cid) => ctx.state.rivals.some((r) => r.cid === cid && r.acquired);

function newRival(ctx, c, y) {
  const { state, rng, pack } = ctx;
  return { id: state.nextId++, cid: c.id, name: c.name, rep: companyRep(c, y), drift: 0, hw: c.kind.includes('hw'), pub: c.kind.includes('pub'),
    nextRelease: rng.int(...pack.rivals.releaseWeeks), acquired: false, games: 0, lastScore: 0, since: c.from };
}

// Yıl değiştikçe şirket listesi güncellenir: yeni kurulanlar girer, kapananlar haber olur.
export function syncCompanies(ctx, quiet = false) {
  const { state } = ctx;
  const y = tableYear(ctx);
  for (const c of COMPANIES) {
    if (c.id === 'bagimsiz') continue;
    const r = state.rivals.find((x) => x.cid === c.id);
    if (!r && isActive(c, y)) {
      state.rivals.push(newRival(ctx, c, y));
      if (!quiet) ctx.news(`🏢 ${c.name} sahneye çıktı${c.kind.includes('hw') ? ' (donanım devi)' : c.kind.includes('pub') ? ' (yayıncı)' : ''}.`, 'tarih');
    }
  }
  for (const r of [...state.rivals]) {
    const c = r.cid && companyById(r.cid);
    if (!c) continue;
    if (!isActive(c, y) && !r.acquired) {
      state.rivals = state.rivals.filter((x) => x !== r);
      const heir = COMPANIES.find((x) => x.from === c.to && x.id !== c.id && x.name.includes(c.name.split(' ')[0]));
      ctx.news(heir ? `🤝 ${c.name} artık ${heir.name} çatısı altında.` : `🪦 ${c.name} piyasadan çekildi. Bir devrin sonu.`, 'tarih');
    } else if (!r.acquired) r.rep = clamp(companyRep(c, y) + r.drift, 5, 99);
  }
}

// Bir yılın 10 hit oyununu yıl içine yay (her biri farklı ay).
function scheduleYear(ctx, year) {
  const { state, rng } = ctx;
  const d = YEARS[year];
  state.world.year = year;
  if (!d) return;
  const months = [...Array(12).keys()];
  for (let i = 11; i > 0; i--) { const j = rng.int(0, i); [months[i], months[j]] = [months[j], months[i]]; }
  d.g.forEach((g, i) => state.world.queue.push({ name: g[0], cid: g[1], genre: g[2], score: g[3], rank: i, at: year + (months[i] + rng.range(0.1, 0.9)) / 12 }));
  state.world.queue.sort((a, b) => a.at - b.at);
}

export function initWorld(ctx) {
  const { state } = ctx;
  state.world = { year: 0, evKey: -1, queue: [], log: [], hits: [] };
  syncCompanies(ctx, true);
  scheduleYear(ctx, Math.floor(tableYear(ctx)));
}

export const histScore = (ctx, score) => Math.round(score * (ctx.pack.world.histScoreK[ctx.state.difficulty] ?? 1));

function releaseHit(ctx, h) {
  const { state, pack, rng } = ctx;
  const W = pack.world, s = pack.sales;
  const c = companyById(h.cid);
  const studio = c?.name || 'Bağımsız';
  const score = histScore(ctx, h.score);
  const power = Math.max(W.hitPower, c ? companyRep(c, tableYear(ctx)) : 60) / 100;
  const peak = s.B * Pz(ctx) * difficulty(ctx).Z * S(ctx, score) * (s.yA + s.yB * power) * (s.stA + s.stB * power) * 1.7 * pack.rivals.salesPeakK * W.hitPeakK * (1 - W.hitRankDecay * h.rank) * rng.range(0.85, 1.15);
  state.charts.unshift({ name: h.name, studio, score, week: state.week, mine: false, genre: h.genre, hist: true });
  state.rivalGames.push({ id: state.nextId++, name: h.name, studio, score, genre: h.genre, weeks: 0, peak, lastWeek: 0, units: 0, active: true, hist: true });
  const r = state.rivals.find((x) => x.cid === h.cid);
  if (r) { r.games++; r.lastScore = score; }
  state.world.hits.unshift({ name: h.name, studio, score, genre: h.genre, year: Math.floor(tableYear(ctx)), week: state.week });
  if (state.world.hits.length > 600) state.world.hits.length = 600;
  ctx.news(`🕹️ ${studio}, "${h.name}" oyununu çıkardı (not ${score}).`, h.rank < 3 ? 'tarih' : 'info');
  ctx.bus.fire('rivalRelease', { studio, name: h.name, big: true, cid: h.cid });
}

// Haftalık: yıl değişimi, hit oyunlar, ayın tarihî olayı.
export function weeklyWorld(ctx) {
  const { state, pack } = ctx;
  if (!state.world) initWorld(ctx);
  const y = tableYear(ctx), Y = Math.floor(y);
  if (Y > state.world.year) { syncCompanies(ctx); scheduleYear(ctx, Y); }
  while (state.world.queue.length && state.world.queue[0].at <= y) releaseHit(ctx, state.world.queue.shift());
  const m = Math.min(11, Math.floor((y - Y) * 12)), key = Y * 12 + m;
  if (key > state.world.evKey) {
    state.world.evKey = key;
    const d = YEARS[Y];
    if (d) {
      const text = d.e[m];
      state.world.log.unshift({ y: Y, m, t: text });
      state.world.count = (state.world.count || 0) + 1;
      if (state.world.log.length > pack.world.logMax) state.world.log.length = pack.world.logMax;
      ctx.news(`📰 ${MONTHS[m]} ${Y}: ${text}`, 'tarih');
    }
  }
}

// Şirket sıralaması (dünya penceresi): o yılın en güçlü şirketleri.
export function companyBoard(ctx, n = 12) {
  const y = tableYear(ctx);
  return ctx.state.rivals.map((r) => ({ ...r, kind: companyById(r.cid)?.kind || [] })).sort((a, b) => b.rep - a.rep).slice(0, n);
}

// Platform pazar payları (dünya penceresi).
export function platformShares(ctx, base) {
  const list = activePlatforms(ctx).map((p) => ({ p, b: base(p) })).filter((x) => x.b > 0);
  const total = list.reduce((a, x) => a + x.b, 0) || 1;
  return list.map((x) => ({ ...x, share: x.b / total })).sort((a, b) => b.share - a.share);
}

export const valuationInfl = (ctx) => inflation(ctx);
