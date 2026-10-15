// Pazar: yayın, haftalık satış, MMO abonelik, trendler, rakipler, fuar, ödüller, listeler.
import { clamp, lerpTable } from '../kernel.js';
import { review, peakWeekly, platformBase, inflation, tableYear, selfPublishPower, gamePrice, eraMult, salaryFor, platformById, Pz, S, difficulty, traitOf, regionMix, ALL_REGIONS, projFeatures, techLowOf } from '../models.js';
import { roomOf, hasRoom, weeklyOutput } from './staff.js';
import { learn } from './knowledge.js';
import { growSkills } from './people.js';
import { initWorld } from './world.js';
import * as Pub from './publishers.js';
import * as Regions from './regions.js';
import * as Modern from './modern.js';
import * as Charts from './charts.js';
import * as Genres from './genres.js';
import * as Engines from './engines.js';
export const publishersAvailable = (ctx) => Pub.list(ctx);

export function release(ctx, { projectId, publisherId, price, model = 'satis', monet = 'dengeli', service = null, printRun = 'normal' }) {
  const { state, pack, ledger, bus } = ctx;
  const pj = state.projects.find((p) => p.id === (projectId ?? state.projects.find((x) => x.status === 'debug')?.id));
  if (!pj || pj.status !== 'debug') return { ok: false, msg: 'Yayınlanacak hazır proje yok.' };
  // Yayıncı: imzalı sözleşme, kelepir satış ya da kendi yayının (Konu B)
  const fr = Pub.forRelease(ctx, pj, publisherId ?? null);
  if (!fr.ok) return fr;
  const pub = fr.pub, deal = fr.deal || null;
  if (!pub && !state.research.done.oz_yayin && pj.kind !== 'ek') return { ok: false, msg: 'Kendi yayının için araştırma gerekli; o zamana kadar bir yayıncıya sun.' };
  if (pj.maxPrice) price = Math.min(price, pj.maxPrice);

  // Modern iş modelleri: ücretsiz oyun kendi yayınınla, abonelik servisi yılı gelince
  const MX = pack.modern;
  if (model === 'f2p' && !Modern.f2pAllowed(ctx)) return { ok: false, msg: 'Ücretsiz oyun için 2008+, "oyun içi satış" araştırması ve kendi yayının gerekli.' };
  if (model === 'f2p' && pub) return { ok: false, msg: 'Ücretsiz oyunu kendin yayınlamalısın.' };
  const svc = service ? MX.services.list.find((o) => o.id === service) : null;
  if (service && (!svc || tableYear(ctx) < svc.year)) return { ok: false, msg: 'Bu abonelik servisi henüz yok.' };
  if (svc && model === 'f2p') return { ok: false, msg: 'Ücretsiz oyun servise girmez.' };

  bus.fire('beforeGameReview', pj);
  const rv = review(ctx, pj);
  const m = Modern.monetById(ctx, monet);
  if (model === 'f2p' && m.score) { rv.score = Math.max(1, Math.round((rv.score + m.score) * 10) / 10); rv.notes.push(`Agresif para kazanma ${m.score}`); }
  const ea = Modern.eaOnRelease(ctx, pj, rv);
  const gfx = Genres.onReview(ctx, pj, rv); // Konu D: efsane keşif, öncü, kült klasik
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
    publisherId: pub ? pub.id : null, publisherName: pub ? pub.name : null, publisherPower: pub ? pub.power : Math.min(100, selfPublishPower(ctx) + (hasRoom(ctx, 'pazarlama') ? pack.rooms.selfPublishBonus : 0)), selfPub: !pub,
    royalty: deal ? (deal.kind === 'tek' ? 0 : pack.publishing.net * deal.pay / 100) : null, deal: deal ? { ...deal } : null,
    releasedWeek: state.week, year: Math.floor(tableYear(ctx)), weeks: 0, active: true, sold: {}, units: 0, revenue: 0,
    pirated: !state.research.done.kopya_koruma, mmo: pj.mmo, subs: 0, lastWeek: 0, rival: false,
    expansion: isExp, baseGameId: base?.id ?? null, hist: [], patches: 0, ports: 0, bugRate: rv.bugRate, alloc: [...pj.alloc], engineId: pj.engineId, engineLic: pj.engineLic || null, lic: pj.lic ? { ...pj.lic } : null, mw: [...(pj.mw || [])], features: projFeatures(ctx, pj), techLow: techLowOf(ctx, pj),
    devCost: Math.round(pj.cost || 0), postCost: 0, profitHist: [], regions: [...(pj.regions || ALL_REGIONS(ctx))], regionSold: {}, loc: { ...(pj.loc || {}) }, badLoc: pj.badLoc ? { ...pj.badLoc } : undefined, kind: pj.kind,
  };
  if (model === 'f2p') { game.model = 'f2p'; game.monet = m.id; game.players = 0; game.price = pack.sales.priceRef; }
  // Konu C: her bölgeye erişim (dağıtım ağı, dil, yayıncının bölgesi, sansür, korsanlık, konu zevki)
  const pubInfo = deal && !deal.bargain ? { power: pub.power, region: (Pub.byId(ctx, deal.pubId) || {}).region || deal.region } : null;
  if (deal && pubInfo) deal.region = pubInfo.region;
  Regions.applyReach(ctx, game, pubInfo, deal);
  game.peak = peakWeekly(ctx, game);
  if (model === 'f2p') game.price = 0;
  if (isExp) for (const k in game.peak) game.peak[k] *= pack.post.expansionSales;
  if (ea) { for (const k in game.peak) game.peak[k] *= ea.peakMult; game.eaUnits = pj.ea.units; }
  if (svc) {
    const pay = Modern.serviceOffers(ctx, pj, rv.score).find((o) => o.id === svc.id).pay;
    for (const k in game.peak) game.peak[k] *= MX.services.salesMult;
    game.service = svc.name;
    ledger.post('abonelik_servisi', pay, `${svc.name}: ${pj.name}`);
    game.revenue += pay;
    state.fans += Math.round(MX.services.fans * inflation(ctx) ** 0.3);
  }
  if (model === 'f2p' && m.fansRelease) state.fans = Math.round(state.fans * (1 + m.fansRelease));
  Modern.crowdOnRelease(ctx, pj, rv.score);
  game.regionSplit = regionSplitOf(ctx, game);
  for (const id of game.platforms) game.sold[id] = 0;
  Charts.onRelease(ctx, game, printRun);

  // Kelepir satış peşin ödenir; sözleşmenin avansı ve finansmanı imzada ödendi (oyunun gelirine işlenir)
  if (deal?.bargain) { ledger.post('yayinci', deal.buyout, `Kelepir Dağıtım: "${pj.name}"`); game.revenue += deal.buyout; }
  // Hayran
  const f = pack.fans;
  const dFans = rv.score >= f.threshold ? (rv.score - f.threshold) * f.perPointAbove * Math.max(1, inflation(ctx) ** 0.5)
    : rv.score < f.lossBelow ? -(f.lossBelow - rv.score) * f.lossPerPoint * (hasRoom(ctx, 'musteri') ? pack.rooms.supportLossCut : 1) : 0;
  state.fans = Math.max(0, Math.round(state.fans + dFans));
  Regions.onRelease(ctx, game, dFans);
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
  for (const p of state.staff) if (['gelistirme', 'grafik', 'ses', 'qa'].includes(roomOf(ctx, p)?.type)) { const o = p.skill; p.skill = Math.min(100, p.skill + pack.production.expGainPerProject * (1 - p.skill / 120) * traitOf(ctx, p, 'learn')); growSkills(ctx, p, o); p.games++; }
  for (const fid of game.features) state.usedFeatures[fid] = true; // Konu E

  state.games.push(game);
  state.lastCombo = `${pj.topic}/${pj.genre}`;
  state.projects = state.projects.filter((x) => x !== pj);
  if (!state.projects.length) state.crunch = false;
  Genres.afterRelease(ctx, game, pj, gfx);
  const report = learn(ctx, pj, rv);
  state.charts.unshift({ name: game.name, studio: state.companyName, score: game.score, week: state.week, mine: true, genre: game.genre });
  if (deal) Pub.onRelease(ctx, game, pj); else Pub.onSelfRelease(ctx, game);
  bus.fire('afterReleaseGame', game);
  const mood = rv.score >= 85 ? '🎉' : rv.score >= 70 ? '🙂' : rv.score >= 50 ? '😐' : '💩';
  ctx.news(`${mood} "${game.name}" yayında! Not: ${rv.score}. Hayran ${dFans >= 0 ? '+' : ''}${Math.round(dFans)}.`, rv.score >= 70 ? 'good' : 'bad');
  for (const p of state.staff) p.morale = clamp(p.morale + (rv.score - 65) / 3, 0, 100);
  if (rv.score < 40) state.heat += 8;
  return { ok: true, game, review: rv, report };
}

// Kopya başı fiziksel maliyet çarpanı (platform türüne ve döneme göre)
export function unitCostK(ctx, p) {
  const t = ctx.pack.sales.unitCostK[p.kind] || ctx.pack.sales.unitCostK.konsol;
  return lerpTable(t, tableYear(ctx));
}

// Satışın bölgelere dağılımı (platform zirveleriyle ağırlıklı); arayüzde bölge çubukları için.
export function regionSplitOf(ctx, game) {
  const tot = {};
  for (const id of game.platforms) {
    const p = platformById(ctx, id);
    if (!p) continue;
    const mix = regionMix(ctx, game, p), sum = Object.values(mix).reduce((a, b) => a + b, 0) || 1;
    for (const r in mix) tot[r] = (tot[r] || 0) + (game.peak[id] || 0) * mix[r] / sum;
  }
  const all = Object.values(tot).reduce((a, b) => a + b, 0) || 1;
  for (const r in tot) tot[r] /= all;
  return tot;
}

function weekMult(ctx, game) {
  const { state, pack } = ctx;
  const s = pack.sales;
  let m = eraMult(ctx, 'salesMult');
  for (const mod of state.gameMods) if (mod.untilWeek > state.week && (!mod.gameId || mod.gameId === game.id)) m *= mod.mult;
  if (state.trend && (state.trend.genre === game.genre || state.trend.topic === game.topic)) m *= s.trendMult;
  const newer = state.games.find((g) => g !== game && g.ipId === game.ipId && g.releasedWeek > game.releasedWeek && g.active);
  if (newer) m *= s.sequelOverlapMult;
  if (state.flags.lootbox) m *= 1.1;
  if (game.reach) m *= Regions.weekK(ctx, game); // bölgesel bayram, kampanya, yasak
  m *= Genres.lifeK(ctx, game); // alt türün yaşam döngüsü (Konu D)
  return m;
}

// Haftalık satış: yayılma eğrisinin bu haftaki adımı (charts.js) × platform zirvesi × dönem/trend çarpanları.
// Fiziksel dönemde kendi yayınladığın oyun önceden basılır: stok biterse satış kaçar.
export function weeklySales(ctx) {
  const { state, pack, ledger, bus } = ctx;
  const s = pack.sales;
  let total = 0;
  Charts.prepWeek(ctx);
  Charts.weeklyFees(ctx);
  for (const g of state.games) {
    if (!g.active) continue;
    const f2p = g.model === 'f2p';
    const st = Charts.step(ctx, g);
    if (!f2p && Charts.ended(ctx, g, st)) {
      g.active = false;
      Pub.onGameEnd(ctx, g);
      const left = g.printed && g.stock > 0 ? ` Depoda ${g.stock.toLocaleString('tr-TR')} basılı kopya kaldı.` : '';
      ctx.news(`📉 "${g.name}" ${Charts.isDigital(ctx) ? 'mağazalarda artık satmıyor' : 'raflardan kalktı'}. Toplam ${g.units.toLocaleString('tr-TR')} kopya.${left}`, 'info');
      continue;
    }
    if (f2p && g.weeks > pack.modern.f2p.minWeeks && (g.players || 0) < pack.modern.f2p.minPlayers) {
      g.active = false;
      ctx.news(`🔌 "${g.name}" sunucuları kapandı. Toplam ${g.units.toLocaleString('tr-TR')} oyuncu denedi.`, 'info');
      continue;
    }
    const mult = weekMult(ctx, g);
    const want = {};
    let demand = 0;
    for (const id of g.platforms) {
      const p = platformById(ctx, id);
      const cap = s.capShare * platformBase(ctx, p) * 1e6;
      want[id] = Math.max(0, Math.min(Math.round(g.peak[id] * st.k * mult), cap - g.sold[id]));
      demand += want[id];
    }
    // Basılı stok: talep stoku aşarsa satış stokla sınırlı; karşılanmayan alıcıların bir kısmı vazgeçer.
    const stock = Charts.stockFor(ctx, g);
    const f = demand > stock ? stock / demand : 1;
    if (f < 1 && !g.soldOut) { g.soldOut = true; g.dif.kick += pack.charts.print.sellOutKick; ctx.news(`🔥 "${g.name}" TÜKENDİ! Dükkânlar yeni baskıyı bekliyor.`, 'warn'); }
    let units = 0, rev = 0;
    const newBy = {};
    for (const id of g.platforms) {
      const p = platformById(ctx, id);
      const u = f < 1 ? Math.floor(want[id] * f) : want[id];
      g.sold[id] += u; units += u;
      if (f2p) { newBy[p.kind] = (newBy[p.kind] || 0) + u; continue; }
      const price = gamePrice(ctx, g, p);
      const selfUnit = price * (1 - s.retailCut) - s.unitCost * unitCostK(ctx, p) * inflation(ctx) ** 0.5;
      const ds = g.deal?.regions ? Regions.dealShare(g) : 1; // bölgesel haklar: yayıncının bölgeleri telif, diğerleri kendi yayınım
      rev += g.deal?.dist ? u * (price * pack.publishing.net * g.deal.pay / 100 - s.unitCost * unitCostK(ctx, p) * inflation(ctx) ** 0.5)
        : g.royalty != null && ds < 1 ? u * (ds * price * g.royalty + (1 - ds) * selfUnit)
        : g.royalty != null ? u * price * g.royalty
        : g.printed ? u * price * (1 - s.retailCut)
        : u * (price * (1 - s.retailCut) - s.unitCost * unitCostK(ctx, p) * inflation(ctx) ** 0.5);
    }
    if (g.printed) g.stock = Math.max(0, g.stock - units);
    Charts.commit(ctx, g, f < 1 ? st.s * (f + (1 - f) * pack.charts.print.lostShare) : st.s);
    if (f2p) rev = Modern.weeklyF2P(ctx, g, newBy).rev;
    if (g.reach && rev > 0) rev *= Regions.revK(ctx, g); // fiyat endeksi, kur, kampanya indirimi
    if (g.deal) rev = Pub.royaltyCash(ctx, g, rev);
    const cut = Engines.royaltyCut(ctx, g, rev); // Konu E: motor lisansı yüzdesi
    if (cut) ledger.post('motor_lisans', -cut, g.name);
    g.units += units; g.lastWeek = units; g.revenue += rev; g.weeks++;
    if (g.regionSplit) for (const r in g.regionSplit) g.regionSold[r] = (g.regionSold[r] || 0) + Math.round(units * g.regionSplit[r]);
    (g.revHist ||= []).push(Math.round(rev)); if (g.revHist.length > 104) g.revHist.shift();
    (g.profitHist ||= []).push(Math.round(g.revenue - (g.devCost || 0) - (g.postCost || 0))); if (g.profitHist.length > 104) g.profitHist.shift();
    (g.hist ||= []).push(units); if (g.hist.length > 104) g.hist.shift();
    if (g.mmo) g.subs += units * pack.mmo.subPerUnit;
    if (rev) { ledger.post(f2p ? 'oyun_ici' : 'satis', Math.round(rev), g.name); total += rev; }
  }
  // Müşteri destek: satıştaki oyunlar için hayran kazanımı
  const live = state.games.filter((g) => g.active).length;
  if (live) for (const { w } of weeklyOutput(ctx, (r) => r.type === 'musteri')) state.fans += Math.round(w * pack.rooms.supportFansK * Math.sqrt(live));
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
  state.trend = byGenre ? { genre: rng.pick(Genres.bornGenres(ctx)).id, untilWeek: state.week + rng.int(pack.trends.minWeeks, pack.trends.maxWeeks) }
    : { topic: rng.pick(topics)[0], untilWeek: state.week + rng.int(pack.trends.minWeeks, pack.trends.maxWeeks) };
  const label = state.trend.genre ? pack.genres.find((g) => g.id === state.trend.genre).name : pack.topics.find((t) => t[0] === state.trend.topic)[1];
  ctx.news(`📈 Yeni trend: ${label}`, 'info');
}

// --- Rakipler
export function initRivals(ctx) {
  const { state, pack, rng } = ctx;
  const r = pack.rivals;
  initWorld(ctx);
  // Pazar boş başlamasın: güçlü şirketlerin rafta zaten birer oyunu var.
  for (const rv of [...state.rivals].sort((a, b) => b.rep - a.rep).slice(0, 6)) {
    const score = Math.round(clamp(rng.normal(rv.rep * r.repScoreK + 5, r.scoreSpread), 20, 95));
    const s = pack.sales, power = rv.rep / 100;
    const peak = s.B * Pz(ctx) * difficulty(ctx).Z * S(ctx, score) * (s.yA + s.yB * power) * (s.stA + s.stB * power) * rng.pick(r.sizePick) * r.salesPeakK;
    const rg = { id: state.nextId++, name: `${rng.pick(r.gameNamesA)} ${rng.pick(r.gameNamesB)}`, studio: rv.name, score, genre: Genres.rivalGenre(ctx), weeks: rng.int(0, 8), peak, lastWeek: 0, units: 0, active: true };
    Charts.tagRival(ctx, rg, { owner: rv.hw ? rv.cid : null });
    Charts.advanceRival(ctx, rg, rg.weeks);
    state.rivalGames.push(rg);
  }
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
  if (rv.hw) return { ok: false, msg: `${rv.name} bir platform devi; satın alınamaz.` };
  // Konu G: tek adımda %100 hisse (hisse kademeleri systems/platform.js)
  const price = rivalPrice(ctx, rv);
  if (state.cash < price) return { ok: false, msg: 'Yeterli nakit yok.' };
  ledger.post('satin_alma', -price, rv.name);
  rv.acquired = true; rv.price = price; rv.stake = 100; rv.autonomy ??= ctx.pack.platform.stake.autonomyStart; rv.policy ??= 'coklu'; rv.boost ??= 0;
  ctx.news(`🏢 ${rv.name} artık senin! Monopoli kokusu alıyorum.`, 'good');
  ctx.bus.fire('companyAcquired', rv);
  return { ok: true };
}
export function weeklyRivals(ctx) {
  const { state, pack, rng } = ctx;
  const r = pack.rivals;
  // Yalnızca o yılın en güçlü N şirketi (ve senin iştiraklerin) düzenli oyun çıkarır.
  const top = new Set([...state.rivals].sort((a, b) => b.rep - a.rep).slice(0, pack.world.activeRivals).map((x) => x.id));
  for (const rv of state.rivals) {
    if (--rv.nextRelease > 0) continue;
    rv.nextRelease = rng.int(...r.releaseWeeks);
    if (!top.has(rv.id) && !rv.acquired) continue;
    // Sakin aylarda bazen bekler: çıkışlar yılsonuna yığılır.
    if (Charts.rivalPostpones(ctx)) { rv.nextRelease = 4; continue; }
    const genre = Genres.rivalGenre(ctx);
    // Aynı tür ve yakın tarihte duyurulmuş güçlü bir oyundan kaçabilir.
    if (Charts.rivalDodges(ctx, rv, genre)) { rv.nextRelease = pack.charts.announce.dodgeWeeks * 2 + 1; continue; }
    const score = Math.round(clamp(rng.normal(rv.rep * r.repScoreK + r.scoreBias, r.scoreSpread) + Engines.rivalBonus(ctx, rv.name), 15, 97)); // senin motorunu kullanan rakip +1
    rv.drift = clamp((rv.drift || 0) * 0.7 + (score - 70) / 12, -15, 15);
    rv.rep = clamp(rv.rep + (score - 70) / 12, 5, 99);
    rv.games++; rv.lastScore = score;
    const name = `${rng.pick(r.gameNamesA)} ${rng.pick(r.gameNamesB)}${rng.chance(0.3) ? ' ' + rng.int(2, 5) : ''}`;
    state.charts.unshift({ name, studio: rv.name + (rv.acquired ? ' (sizin)' : ''), score, week: state.week, mine: rv.acquired, genre });
    // Satış listesi için rakip oyunun haftalık satış zirvesi (stüdyo gücü + not + pazar büyüklüğü)
    const s = pack.sales, power = rv.rep / 100;
    const peak = s.B * Pz(ctx) * difficulty(ctx).Z * S(ctx, score) * (s.yA + s.yB * power) * (s.stA + s.stB * power) * rng.pick(r.sizePick) * r.salesPeakK;
    const rg = Charts.tagRival(ctx, { id: state.nextId++, name, studio: rv.name, score, genre, weeks: 0, peak, lastWeek: 0, units: 0, active: true }, { owner: rv.hw ? rv.cid : null });
    state.rivalGames.push(rg);
    if (!rv.hw && !rv.acquired) ctx.bus.fire('rivalRelease', { studio: rv.name, name, big: false, cid: rv.cid });
    if (!rv.hw) ctx.bus.fire('companyRelease', { cid: rv.cid, rid: rv.id, studio: rv.name, name, score, game: rg }); // Konu G
  }
  if (state.charts.length > 40) state.charts.length = 40;
  // Rakip oyunların bu haftaki satışı
  Charts.sellRivals(ctx, eraMult(ctx, 'salesMult'));
  state.rivalGames = state.rivalGames.filter((g) => g.active || state.week - g.weeks < 200).slice(-80);
}

// Haftalık satış listesi: dolgu oyunlarla gerçek sıra, raf, ödüller (charts.js).
export const weeklyCharts = (ctx) => Charts.weeklyCharts(ctx);

// İştirak ve temettü gelirleri Konu G ile systems/platform.js'e taşındı (hisse kademeleri).
export function monthlySubsidiaries() {}

// --- Fuar & ödüller
export function scheduled(ctx) {
  const { state, pack } = ctx;
  const month = Math.floor((state.week % 48) / 4) + 1, wk = (state.week % 4) + 1;
  const fairPj = state.projects[0];
  if (month === pack.fair.month && wk === pack.fair.week && fairPj) {
    const cost = Math.round(pack.fair.boothCost * inflation(ctx) ** 0.7);
    ctx.queue({ id: 'fuar', title: 'GameCon Fuarı', text: `Yıllık fuar kapıda. "${fairPj.name}" için stant açmak ${cost.toLocaleString('tr-TR')} $.`,
      choices: [{ label: 'Stant aç!', effects: { cashRaw: -cost, hype: pack.fair.hype, fans: pack.fair.fans, pubFair: true } }, { label: 'Bu yıl pas', effects: {} }] });
  }
  if (month === pack.awards.month && wk === pack.awards.week) awards(ctx);
}

function awards(ctx) {
  const { state, pack, ledger } = ctx;
  const yearStart = state.week - 48;
  const mine = state.games.filter((g) => g.releasedWeek > yearStart);
  if (!mine.length) return;
  const best = mine.reduce((a, b) => (b.score > a.score ? b : a));
  const rivalTop = state.charts.filter((c) => !c.mine && c.week > yearStart).reduce((m, c) => (!m || c.score > m.score ? c : m), null);
  const rivalBest = rivalTop?.score || 0;
  const a = pack.awards;
  if (rivalTop && best.score < rivalBest) Engines.rivalGoty(ctx, rivalTop.studio, rivalTop.name); // Konu E: senin motorunla yılın oyunu
  if (best.score >= rivalBest) {
    state.prestige = Math.min(pack.prestige.max, state.prestige + a.goty.prestige);
    state.fans += a.goty.fans;
    ledger.post('odul', Math.round(a.goty.cash * inflation(ctx) ** 0.5), 'Yılın Oyunu');
    state.awards.push({ year: Math.floor(tableYear(ctx)), name: best.name, type: 'goty' });
    ctx.bus.fire('awardWon', { type: 'goty', genre: best.genre });
    ctx.queue({ id: 'goty', title: '🏆 Yılın Oyunu!', text: `"${best.name}" yılın oyunu seçildi! Sahnede ağladın. Herkes ağladı.`, choices: [{ label: 'Teşekkürler!', effects: { morale: 15 } }] });
  }
  else {
    // Tür ödülü: yılın oyunu olamasan da kendi türünde en iyisiysen.
    const g = pack.world.genreAward;
    const won = mine.filter((m) => m.score >= state.charts.filter((c) => !c.mine && c.week > yearStart && c.genre === m.genre).reduce((x, c) => Math.max(x, c.score), 0));
    if (won.length) {
      const w = won.reduce((x, y) => (y.score > x.score ? y : x));
      const gname = pack.genres.find((x) => x.id === w.genre).name;
      state.prestige = Math.min(pack.prestige.max, state.prestige + g.prestige);
      state.fans += g.fans;
      ledger.post('odul', Math.round(g.cash * inflation(ctx) ** 0.5), `En iyi ${gname}`);
      state.awards.push({ year: Math.floor(tableYear(ctx)), name: w.name, type: 'tur', genre: w.genre });
      ctx.bus.fire('awardWon', { type: 'tur', genre: w.genre });
      ctx.news(`🥇 "${w.name}" yılın en iyi ${gname.toLowerCase()} oyunu seçildi!`, 'good');
    }
  }
  const worst = mine.reduce((a2, b) => (b.score < a2.score ? b : a2));
  if (worst.score < a.worstBelow) {
    state.fans = Math.max(0, state.fans + a.worst.fans);
    ctx.queue({ id: 'altin_ahududu', title: '🍓 Yılın En Kötü Oyunu', text: `"${worst.name}" yılın en kötü oyunu ödülünü kazandı. Ödül plastik ve yapışkan.`, choices: [{ label: 'Ödülü almaya git (cesaret)', effects: { morale: 5, hype: 5, prestige: -0.2 } }, { label: 'Saklan', effects: { morale: a.worst.morale } }] });
  }
}

export function marketSalary(ctx, skill) { return salaryFor(ctx, skill); }
