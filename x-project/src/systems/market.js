// Pazar: yayın, haftalık satış, MMO abonelik, trendler, rakipler, fuar, ödüller, listeler.
import { clamp } from '../kernel.js';
import { review, peakWeekly, weekCurve, platformBase, inflation, tableYear, selfPublishPower, gamePrice, eraMult, salaryFor, platformById } from '../models.js';
import { roomOf } from './staff.js';
import { learn } from './knowledge.js';

export function publishersAvailable(ctx) {
  const y = tableYear(ctx);
  return ctx.pack.publishers.filter((p) => y >= p.from && y < p.to);
}

export function release(ctx, { projectId, publisherId, price }) {
  const { state, pack, ledger, bus } = ctx;
  const pj = state.projects.find((p) => p.id === (projectId ?? state.projects.find((x) => x.status === 'debug')?.id));
  if (!pj || pj.status !== 'debug') return { ok: false, msg: 'Yayınlanacak hazır proje yok.' };
  let pub = null;
  if (publisherId) {
    pub = publishersAvailable(ctx).find((p) => p.id === publisherId);
    if (!pub) return { ok: false, msg: 'Yayıncı yok.' };
    if (state.fans < pub.minFans) return { ok: false, msg: `${pub.name} en az ${pub.minFans} hayran istiyor.` };
  } else if (!state.research.done.oz_yayin) return { ok: false, msg: 'Kendi yayının için araştırma gerekli.' };

  bus.fire('beforeGameReview', pj);
  const rv = review(ctx, pj);
  bus.fire('afterGameReview', { project: pj, review: rv });

  // IP (ek paket temel oyunun IP'sini kullanır, IP değerini değiştirmez)
  const isExp = pj.kind === 'ek';
  const base = isExp ? state.games.find((g) => g.id === pj.baseGameId) : null;
  let ip = base ? state.ips.find((x) => x.id === base.ipId) : pj.sequelOf ? state.ips.find((x) => x.id === pj.sequelOf) : null;
  if (!ip) { ip = { id: state.nextId++, name: pj.name, value: 0, lastRelease: -999, games: 0 }; state.ips.push(ip); }
  const ipValueAtRelease = ip.value;

  const game = {
    id: pj.id, name: pj.name, genre: pj.genre, sub: pj.sub, topic: pj.topic, audience: pj.audience, platforms: pj.platforms,
    size: pj.size, score: rv.score, critics: rv.critics, review: rv, price, hype: pj.hype, ipId: ip.id, ipValue: ipValueAtRelease,
    publisherId: pub ? pub.id : null, publisherPower: pub ? pub.power : selfPublishPower(ctx), royalty: pub ? pub.royalty : null,
    releasedWeek: state.week, year: Math.floor(tableYear(ctx)), weeks: 0, active: true, sold: {}, units: 0, revenue: 0,
    pirated: !state.research.done.kopya_koruma, mmo: pj.mmo, subs: 0, lastWeek: 0, rival: false,
    expansion: isExp, baseGameId: base?.id ?? null, hist: [], patches: 0, ports: 0, bugRate: rv.bugRate,
  };
  game.peak = peakWeekly(ctx, game);
  if (isExp) for (const k in game.peak) game.peak[k] *= pack.post.expansionSales;
  for (const id of game.platforms) game.sold[id] = 0;

  // Yayıncı avansı
  if (pub) {
    const size = pack.sizes.find((s) => s.id === pj.size);
    ledger.post('yayinci', Math.round(pack.publisherAdvance.base * size.sales * inflation(ctx) * pub.power / 100), `${pub.name} avansı`);
  }
  // Hayran
  const f = pack.fans;
  const dFans = rv.score >= f.threshold ? (rv.score - f.threshold) * f.perPointAbove * Math.max(1, inflation(ctx) ** 0.5)
    : rv.score < f.lossBelow ? -(f.lossBelow - rv.score) * f.lossPerPoint : 0;
  state.fans = Math.max(0, Math.round(state.fans + dFans));
  // Prestij
  if (rv.score >= pack.prestige.scoreForUp) state.prestige = Math.min(pack.prestige.max, state.prestige + 1);
  // IP gelişimi (12 ay kuralı)
  const ipr = pack.ip;
  if (!isExp) {
  const fresh = state.week - ip.lastRelease >= ipr.waitWeeks;
  const gain = (rv.score - ipr.gainScoreRef) * ipr.gainK * (fresh ? 1 : 0.3);
  ip.value = clamp(ip.value + Math.max(ipr.minGain, gain) + (ip.games === 0 ? 0.2 : 0), 0, ipr.max);
  ip.lastRelease = state.week; ip.games++;
  }
  // Deneyim
  for (const p of state.staff) if (['gelistirme', 'grafik', 'ses', 'qa'].includes(roomOf(ctx, p)?.type)) { p.skill = Math.min(100, p.skill + pack.production.expGainPerProject * (1 - p.skill / 120)); p.games++; }
  const eng = state.engines.find((e) => e.id === pj.engineId);
  if (eng) for (const fid of eng.features) state.usedFeatures[fid] = true;

  state.games.push(game);
  state.lastCombo = `${pj.topic}/${pj.genre}`;
  state.projects = state.projects.filter((x) => x !== pj);
  if (!state.projects.length) state.crunch = false;
  const report = learn(ctx, pj, rv);
  state.charts.unshift({ name: game.name, studio: state.companyName, score: game.score, week: state.week, mine: true, genre: game.genre });
  bus.fire('afterReleaseGame', game);
  const mood = rv.score >= 85 ? '🎉' : rv.score >= 70 ? '🙂' : rv.score >= 50 ? '😐' : '💩';
  ctx.news(`${mood} "${game.name}" yayında! Not: ${rv.score}. Hayran ${dFans >= 0 ? '+' : ''}${Math.round(dFans)}.`, rv.score >= 70 ? 'good' : 'bad');
  for (const p of state.staff) p.morale = clamp(p.morale + (rv.score - 65) / 3, 0, 100);
  if (rv.score < 40) state.heat += 8;
  return { ok: true, game, review: rv, report };
}

function weekMult(ctx, game) {
  const { state, pack } = ctx;
  const s = pack.sales;
  let m = eraMult(ctx, 'salesMult');
  for (const mod of state.gameMods) if (mod.untilWeek > state.week) m *= mod.mult;
  const month = Math.floor((state.week % 48) / 4) + 1;
  if (month === s.christmasMonth) m *= s.christmasMult;
  if (state.trend && (state.trend.genre === game.genre || state.trend.topic === game.topic)) m *= s.trendMult;
  const recentRival = state.charts.some((c) => !c.mine && c.genre === game.genre && state.week - c.week < 8);
  if (recentRival) m *= s.rivalSameGenreMult;
  const newer = state.games.find((g) => g !== game && g.ipId === game.ipId && g.releasedWeek > game.releasedWeek && g.active);
  if (newer) m *= s.sequelOverlapMult;
  if (state.flags.lootbox) m *= 1.1;
  return m;
}

export function weeklySales(ctx) {
  const { state, pack, ledger, bus } = ctx;
  const s = pack.sales;
  let total = 0;
  for (const g of state.games) {
    if (!g.active) continue;
    const curve = weekCurve(ctx, g.weeks, g.pirated);
    if (curve < s.stopAt) {
      g.active = false;
      ctx.news(`📉 "${g.name}" raflardan kalktı. Toplam ${g.units.toLocaleString('tr-TR')} kopya.`, 'info');
      continue;
    }
    const mult = weekMult(ctx, g);
    let units = 0, rev = 0;
    for (const id of g.platforms) {
      const p = platformById(ctx, id);
      const cap = s.capShare * platformBase(ctx, p) * 1e6;
      let u = Math.round(g.peak[id] * curve * mult);
      u = Math.max(0, Math.min(u, cap - g.sold[id]));
      g.sold[id] += u; units += u;
      const price = gamePrice(ctx, g, p);
      rev += g.royalty != null ? u * price * g.royalty : u * (price * (1 - s.retailCut) - s.unitCost * inflation(ctx) ** 0.5);
    }
    g.units += units; g.lastWeek = units; g.revenue += rev; g.weeks++;
    (g.hist ||= []).push(units); if (g.hist.length > 104) g.hist.shift();
    if (g.mmo) g.subs += units * pack.mmo.subPerUnit;
    if (rev) { ledger.post('satis', Math.round(rev), g.name); total += rev; }
  }
  state.salesHist.push({ w: state.week, u: state.games.reduce((a, g) => a + (g.active ? g.lastWeek : 0), 0), r: Math.round(total) });
  if (state.salesHist.length > 156) state.salesHist.shift();
  bus.fire('salesCalculated', total);
}

export function monthlyMmo(ctx) {
  const { state, pack, ledger } = ctx;
  for (const g of state.games) {
    if (!g.mmo || g.subs <= 0) continue;
    g.subs = Math.max(0, g.subs * (1 - pack.mmo.churn));
    const infl = inflation(ctx) ** 0.5;
    ledger.post('abonelik', Math.round(g.subs * pack.mmo.monthlyFee * infl), g.name);
    ledger.post('sunucu', -Math.round(g.subs * pack.mmo.serverCostPerSub * infl), g.name);
    if (g.subs < pack.mmo.minSubs) { g.subs = 0; ctx.news(`🔌 "${g.name}" sunucuları kapandı.`, 'info'); }
  }
}

// --- Trendler
export function weeklyTrend(ctx) {
  const { state, pack, rng } = ctx;
  if (state.trend && state.trend.untilWeek > state.week) return;
  const y = tableYear(ctx);
  const topics = pack.topics.filter((t) => t[4] <= y);
  const byGenre = rng.chance(0.5);
  state.trend = byGenre ? { genre: rng.pick(pack.genres).id, untilWeek: state.week + rng.int(pack.trends.minWeeks, pack.trends.maxWeeks) }
    : { topic: rng.pick(topics)[0], untilWeek: state.week + rng.int(pack.trends.minWeeks, pack.trends.maxWeeks) };
  const label = state.trend.genre ? pack.genres.find((g) => g.id === state.trend.genre).name : pack.topics.find((t) => t[0] === state.trend.topic)[1];
  ctx.news(`📈 Yeni trend: ${label}`, 'info');
}

// --- Rakipler
export function initRivals(ctx) {
  const { state, pack, rng } = ctx;
  const r = pack.rivals;
  const names = [...r.names];
  state.rivals = Array.from({ length: r.count }, () => {
    const name = names.splice(rng.int(0, names.length - 1), 1)[0];
    return { id: state.nextId++, name, rep: rng.int(...r.repRange), nextRelease: rng.int(...r.releaseWeeks), acquired: false, games: 0, lastScore: 0 };
  });
}
export function rivalPrice(ctx, rv) {
  const r = ctx.pack.rivals;
  const yearlyProfit = rv.rep * r.profitPerRep * inflation(ctx);
  return Math.round(Math.max(r.acquireMin * inflation(ctx) ** 0.5, r.acquireYears * yearlyProfit));
}
export function acquireRival(ctx, id) {
  const { state, ledger } = ctx;
  const rv = state.rivals.find((x) => x.id === id);
  if (!rv || rv.acquired) return { ok: false, msg: 'Satın alınamaz.' };
  const price = rivalPrice(ctx, rv);
  if (state.cash < price) return { ok: false, msg: 'Yeterli nakit yok.' };
  ledger.post('satin_alma', -price, rv.name);
  rv.acquired = true; rv.price = price;
  ctx.news(`🏢 ${rv.name} artık senin! Monopoli kokusu alıyorum.`, 'good');
  ctx.bus.fire('companyAcquired', rv);
  return { ok: true };
}
export function weeklyRivals(ctx) {
  const { state, pack, rng } = ctx;
  const r = pack.rivals;
  for (const rv of state.rivals) {
    if (--rv.nextRelease > 0) continue;
    rv.nextRelease = rng.int(...r.releaseWeeks);
    const score = Math.round(clamp(rng.normal(rv.rep + 10, r.scoreSpread), 15, 99));
    rv.rep = clamp(rv.rep + (score - 70) / 12, 5, 99);
    rv.games++; rv.lastScore = score;
    const genre = rng.pick(pack.genres).id;
    const name = `${rng.pick(r.gameNamesA)} ${rng.pick(r.gameNamesB)}${rng.chance(0.3) ? ' ' + rng.int(2, 5) : ''}`;
    state.charts.unshift({ name, studio: rv.name + (rv.acquired ? ' (sizin)' : ''), score, week: state.week, mine: rv.acquired, genre });
  }
  if (state.charts.length > 40) state.charts.length = 40;
}
export function monthlySubsidiaries(ctx) {
  const { state, pack, ledger } = ctx;
  for (const rv of state.rivals) {
    if (!rv.acquired) continue;
    const profit = rv.rep * pack.rivals.profitPerRep * inflation(ctx) / 12;
    ledger.post('istirak', Math.round(profit - rv.price * pack.rivals.monthlyCostShare), rv.name);
  }
}

// --- Fuar & ödüller
export function scheduled(ctx) {
  const { state, pack } = ctx;
  const month = Math.floor((state.week % 48) / 4) + 1, wk = (state.week % 4) + 1;
  const fairPj = state.projects[0];
  if (month === pack.fair.month && wk === pack.fair.week && fairPj) {
    const cost = Math.round(pack.fair.boothCost * inflation(ctx) ** 0.7);
    ctx.queue({ id: 'fuar', title: 'GameCon Fuarı', text: `Yıllık fuar kapıda. "${fairPj.name}" için stant açmak ${cost.toLocaleString('tr-TR')} $.`,
      choices: [{ label: 'Stant aç!', effects: { cashRaw: -cost, hype: pack.fair.hype, fans: pack.fair.fans } }, { label: 'Bu yıl pas', effects: {} }] });
  }
  if (month === pack.awards.month && wk === pack.awards.week) awards(ctx);
}

function awards(ctx) {
  const { state, pack, ledger } = ctx;
  const yearStart = state.week - 48;
  const mine = state.games.filter((g) => g.releasedWeek > yearStart);
  if (!mine.length) return;
  const best = mine.reduce((a, b) => (b.score > a.score ? b : a));
  const rivalBest = state.charts.filter((c) => !c.mine && c.week > yearStart).reduce((m, c) => Math.max(m, c.score), 0);
  const a = pack.awards;
  if (best.score >= rivalBest) {
    state.prestige = Math.min(pack.prestige.max, state.prestige + a.goty.prestige);
    state.fans += a.goty.fans;
    ledger.post('odul', Math.round(a.goty.cash * inflation(ctx) ** 0.5), 'Yılın Oyunu');
    state.awards.push({ year: Math.floor(tableYear(ctx)), name: best.name, type: 'goty' });
    ctx.queue({ id: 'goty', title: '🏆 Yılın Oyunu!', text: `"${best.name}" yılın oyunu seçildi! Sahnede ağladın. Herkes ağladı.`, choices: [{ label: 'Teşekkürler!', effects: { morale: 15 } }] });
  }
  const worst = mine.reduce((a2, b) => (b.score < a2.score ? b : a2));
  if (worst.score < a.worstBelow) {
    state.fans = Math.max(0, state.fans + a.worst.fans);
    ctx.queue({ id: 'altin_ahududu', title: '🍓 Yılın En Kötü Oyunu', text: `"${worst.name}" yılın en kötü oyunu ödülünü kazandı. Ödül plastik ve yapışkan.`, choices: [{ label: 'Ödülü almaya git (cesaret)', effects: { morale: 5, hype: 5, prestige: -0.2 } }, { label: 'Saklan', effects: { morale: a.worst.morale } }] });
  }
}

export function marketSalary(ctx, skill) { return salaryFor(ctx, skill); }
