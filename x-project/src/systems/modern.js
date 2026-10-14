// Modern dönem iş modelleri (2005 sonrası): ücretsiz oyun + oyun içi satış, indirilebilir içerik ve sezon kartı,
// erken erişim, abonelik servisi anlaşmaları, fenomenler (yayıncılar) ve kitle fonlama.
import { clamp, makeRng } from '../kernel.js';
import { inflation, tableYear, review } from '../models.js';

const X = (ctx) => ctx.pack.modern;
const sizeOf = (ctx, id) => ctx.pack.sizes.find((s) => s.id === id);
const done = (ctx, id) => !id || !!ctx.state.research.done[id];

// --- Ücretsiz oyun (F2P): oyuncu kazanımı satış eğrisinden gelir, gelir aktif oyuncu × haftalık harcama.
export const monetById = (ctx, id) => X(ctx).f2p.monet.find((m) => m.id === id) || X(ctx).f2p.monet[1];
export function f2pAllowed(ctx) {
  const f = X(ctx).f2p;
  return tableYear(ctx) >= f.year && done(ctx, f.research) && !!ctx.state.research.done.oz_yayin;
}
export function weeklyF2P(ctx, g, newByPlatform) {
  const { state } = ctx;
  const f = X(ctx).f2p, m = monetById(ctx, g.monet);
  // Platform türüne göre oyuncu kazanımı ve harcama (bilgisayarda daha çok oyuncu ve harcama, mobilde daha az)
  let add = 0, arpuK = 0, w = 0;
  for (const [kind, n] of Object.entries(newByPlatform)) { const k = f.kindK[kind] || f.kindK.mobil; add += n * k.players; arpuK += n * k.arpu; w += n; }
  g.arpuK = w ? arpuK / w : g.arpuK || 1;
  g.players = Math.max(0, (g.players || 0) * (1 - f.churnWeekly) + add * f.playerK);
  const ban = state.flags.lootboxBan && m.id === 'agresif' ? f.banMult : 1;
  const infl = inflation(ctx) ** 0.5;
  const rev = g.players * f.arpuWeek * (g.arpuK || 1) * m.k * ban * infl;
  const cost = g.players * f.serverPerPlayer * infl;
  if (m.fansWeekly) state.fans = Math.max(0, Math.round(state.fans + m.fansWeekly * Math.sqrt(g.players)));
  return { rev: rev - cost, cost };
}

// --- İndirilebilir içerik: satıştaki oyuna küçük paket; sahiplerin bir kısmı alır, gelir birkaç haftaya yayılır.
export function dlcCost(ctx, g) { return Math.round(X(ctx).dlc.cost * sizeOf(ctx, g.size).sales * inflation(ctx) ** 0.5); }
export function dlcAllowed(ctx, g) {
  const d = X(ctx).dlc;
  return g && g.active && !g.expansion && tableYear(ctx) >= d.year && done(ctx, d.research);
}
function queueRevenue(g, total, weeks) {
  (g.dlcQueue ||= []).push({ left: weeks, per: total / weeks });
}
export function releaseDLC(ctx, id) {
  const { state, ledger } = ctx;
  const d = X(ctx).dlc;
  const g = state.games.find((x) => x.id === id);
  if (!dlcAllowed(ctx, g)) return { ok: false, msg: 'Bu oyuna şu an indirilebilir içerik çıkarılamaz.' };
  const cost = dlcCost(ctx, g);
  if (state.cash < cost) return { ok: false, msg: `İçerik ${cost.toLocaleString('tr-TR')} $.` };
  ledger.post('dlc_yapim', -cost, `${g.name} içerik`);
  g.postCost = (g.postCost || 0) + cost;
  g.dlcs = (g.dlcs || 0) + 1;
  const owners = g.model === 'f2p' ? (g.players || 0) * d.f2pAttach : g.units;
  const attach = d.attach * Math.pow(d.attachDecay, g.dlcs - 1) * clamp(g.score / 75, 0.4, 1.4);
  const price = (g.model === 'f2p' ? d.f2pPrice : g.price * d.priceShare) * (g.model === 'f2p' ? inflation(ctx) ** 0.4 : 1);
  queueRevenue(g, owners * attach * price, d.weeks);
  g.weeks = Math.max(0, g.weeks - d.weeksBack);
  if (g.passDue && g.dlcs >= g.passNeed) { g.passDue = null; ctx.news(`🎫 "${g.name}" sezon kartı sözü tutuldu. Oyuncular memnun.`, 'good'); state.fans += Math.round(state.fans * d.passKeptFans); }
  ctx.news(`🧩 "${g.name}" için yeni içerik yayında.`, 'good');
  return { ok: true };
}
export function seasonPassAllowed(ctx, g) {
  const d = X(ctx).dlc;
  return dlcAllowed(ctx, g) && tableYear(ctx) >= d.passYear && done(ctx, d.passResearch) && !g.pass && g.model !== 'f2p';
}
export function seasonPass(ctx, id) {
  const { state, ledger } = ctx;
  const d = X(ctx).dlc;
  const g = state.games.find((x) => x.id === id);
  if (!seasonPassAllowed(ctx, g)) return { ok: false, msg: 'Sezon kartı satılamaz.' };
  g.pass = true;
  g.passNeed = (g.dlcs || 0) + d.passDlcs;
  g.passDue = state.week + d.passWeeks;
  const rev = Math.round(g.units * d.attach * d.passAttach * g.price * d.passPriceShare);
  ledger.post('dlc', rev, `${g.name} sezon kartı`);
  g.revenue += rev;
  ctx.news(`🎫 "${g.name}" sezon kartı satışta: ${rev.toLocaleString('tr-TR')} $. ${d.passWeeks / 4} ay içinde ${d.passDlcs} içerik sözü verdin.`, 'info');
  return { ok: true, rev };
}

// --- Fenomenler: satıştaki oyunun anahtarlarını yayıncılara dağıt (2010+)
export function streamCost(ctx, g) { return Math.round(X(ctx).stream.cost * sizeOf(ctx, g.size).sales * inflation(ctx) ** 0.5); }
export function streamKeys(ctx, id) {
  const { state, ledger, rng } = ctx;
  const s = X(ctx).stream;
  const g = state.games.find((x) => x.id === id);
  if (!g || !g.active || tableYear(ctx) < s.year) return { ok: false, msg: 'Yayıncılar henüz yok ya da oyun satışta değil.' };
  if (g.streamed && state.week - g.streamed < s.cooldown) return { ok: false, msg: 'Yayıncılar bu oyunu yakın zamanda oynadı.' };
  const cost = streamCost(ctx, g);
  if (state.cash < cost) return { ok: false, msg: `Anahtar kampanyası ${cost.toLocaleString('tr-TR')} $.` };
  ledger.post('pazarlama', -cost, `${g.name}: yayıncı anahtarları`);
  g.postCost = (g.postCost || 0) + cost;
  g.streamed = state.week;
  const good = rng.chance(clamp(s.baseChance + (g.score - 70) / 60, 0.1, 0.9));
  state.gameMods.push({ mult: good ? s.goodMult : s.badMult, untilWeek: state.week + s.weeks, gameId: g.id });
  if (good) state.fans += Math.round(s.fans * inflation(ctx) ** 0.3);
  ctx.news(good ? `📺 Yayıncılar "${g.name}" oyununu çok sevdi; canlı yayınlar satışları uçurdu.` : `📺 Yayıncılar "${g.name}" oyununu açıp sıkıldı. Sohbet kanalı acımasızdı.`, good ? 'good' : 'warn');
  return { ok: true, good };
}

// --- Erken erişim (2013+): geliştirme sürerken satış ve geri bildirim; tam çıkışta ilk satışlar biraz azalır, not artar.
export function eaAllowed(ctx, pj) {
  const e = X(ctx).ea;
  return pj && pj.status === 'dev' && !pj.ea && tableYear(ctx) >= e.year && done(ctx, e.research) && pj.week >= pj.totalWeeks * e.minProgress && pj.kind !== 'ek';
}
export function startEA(ctx, pid) {
  const { state } = ctx;
  const pj = state.projects.find((p) => p.id === pid);
  if (!eaAllowed(ctx, pj)) return { ok: false, msg: 'Erken erişim için projenin üçte biri bitmiş olmalı (2013+, araştırma).' };
  pj.ea = { weeks: 0, units: 0, revenue: 0, price: Math.max(5, Math.round(20 * inflation(ctx) ** 0.4 * X(ctx).ea.priceShare)) };
  ctx.news(`🧪 "${pj.name}" erken erişimde! Oyuncular yarım oyunu oynayıp yorum yazıyor.`, 'info');
  return { ok: true };
}
function weeklyEA(ctx) {
  const { state, ledger, pack } = ctx;
  const e = X(ctx).ea;
  for (const pj of state.projects) {
    if (!pj.ea) continue;
    const pv = review({ ...ctx, rng: makeRng({ rng: 7 }) }, pj).score;
    const units = Math.round(e.unitsK * pack.sales.B * Math.pow(pv / 70, 3) * sizeOf(ctx, pj.size).sales * (1 + state.fans / 200000) / 52);
    const rev = units * pj.ea.price * (1 - pack.sales.retailCut);
    pj.ea.weeks++; pj.ea.units += units; pj.ea.revenue += rev;
    pj.bugs *= 1 - e.bugFix;
    if (rev > 0) ledger.post('erken_erisim', Math.round(rev), pj.name);
  }
}
export function eaOnRelease(ctx, pj, rv) {
  const e = X(ctx).ea;
  if (!pj.ea) return null;
  const bonus = pj.ea.weeks >= e.polishWeeks ? e.polishBonus : 0;
  if (bonus) { rv.score = Math.min(100, Math.round((rv.score + bonus) * 10) / 10); rv.notes.push(`Erken erişim geri bildirimi +${bonus}`); }
  return { peakMult: 1 - e.peakCut, bonus };
}

// --- Kitle fonlama (2012–2022): proje için önden para; çıkış notu düşükse destekçiler öfkelenir.
export function crowdAllowed(ctx, pj) {
  const k = X(ctx).crowd, y = tableYear(ctx);
  return pj && pj.status === 'dev' && !pj.crowd && y >= k.from && y < k.to && ctx.state.fans >= k.minFans;
}
export function crowdAmount(ctx, pj) {
  const k = X(ctx).crowd;
  return Math.round(Math.min(k.cap * inflation(ctx) ** 0.5, ctx.state.fans * k.perFan * (0.5 + pj.hype / 100) * inflation(ctx) ** 0.3));
}
export function crowdfund(ctx, pid) {
  const { state, ledger } = ctx;
  const pj = state.projects.find((p) => p.id === pid);
  if (!crowdAllowed(ctx, pj)) return { ok: false, msg: 'Kitle fonlama şu an yapılamaz (2012–2022, yeterli hayran, geliştirme sürerken).' };
  const amt = crowdAmount(ctx, pj);
  ledger.post('kitle_fonlama', amt, pj.name);
  pj.crowd = amt;
  pj.hype = Math.min(ctx.pack.hype.max, pj.hype + X(ctx).crowd.hype);
  ctx.news(`💰 "${pj.name}" kitle fonlamada ${amt.toLocaleString('tr-TR')} $ topladı. Destekçiler bekliyor…`, 'good');
  return { ok: true, amt };
}
export function crowdOnRelease(ctx, pj, score) {
  const k = X(ctx).crowd, { state } = ctx;
  if (!pj.crowd) return;
  if (score < k.angryBelow) { state.fans = Math.round(state.fans * (1 - k.angryFans)); state.heat += 6; ctx.news(`😡 Destekçiler "${pj.name}" oyununa öfkeli: "Paramızı buna mı verdik?"`, 'bad'); }
  else if (score >= k.happyAt) { state.fans = Math.round(state.fans * (1 + k.happyFans)); ctx.news(`🥳 Destekçiler "${pj.name}" ile gurur duyuyor.`, 'good'); }
}

// --- Abonelik servisleri (2017+): önden ödeme karşılığında oyun servise girer; satış düşer, oyuncu ve hayran artar.
export function serviceOffers(ctx, pj, previewScore) {
  const s = X(ctx).services, y = tableYear(ctx);
  return s.list.filter((o) => y >= o.year).map((o) => ({ ...o, pay: Math.round(o.base * sizeOf(ctx, pj.size).sales * Math.pow(clamp(previewScore, 30, 100) / 80, 2) * (1 + pj.hype / 100) * inflation(ctx) ** 0.5) }));
}

// Haftalık: indirilebilir içerik gelirleri, erken erişim satışları, sezon kartı sözleri.
export function weeklyModern(ctx) {
  const { state, ledger } = ctx;
  for (const g of state.games) {
    if (g.dlcQueue?.length) {
      let rev = 0;
      for (const q of g.dlcQueue) if (q.left > 0) { rev += q.per; q.left--; }
      g.dlcQueue = g.dlcQueue.filter((q) => q.left > 0);
      if (rev > 0) { ledger.post('dlc', Math.round(rev), `${g.name} içerik`); g.revenue += rev; }
    }
    if (g.passDue && state.week > g.passDue) {
      g.passDue = null;
      state.fans = Math.round(state.fans * (1 - X(ctx).dlc.passBrokenFans));
      state.heat += 8;
      ctx.news(`😠 "${g.name}" sezon kartı sözü tutulmadı. Oyuncular iade istiyor.`, 'bad');
    }
  }
  weeklyEA(ctx);
}
