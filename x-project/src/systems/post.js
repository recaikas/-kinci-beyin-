// Yayın sonrası (MGT/GDT): güncelleme, fiyat indirimi, başka platforma uyarlama (port), ek paket.
import { inflation, peakWeekly, platformById, activePlatforms } from '../models.js';

const P = (ctx) => ctx.pack.post;
const sizeOf = (ctx, g) => ctx.pack.sizes.find((s) => s.id === g.size);

export function patchCost(ctx, g) { return Math.round(P(ctx).patchCost * inflation(ctx) ** 0.5 * sizeOf(ctx, g).sales); }
export function patch(ctx, id) {
  const { state, ledger } = ctx;
  const g = state.games.find((x) => x.id === id);
  const p = P(ctx);
  if (!g || !g.active) return { ok: false, msg: 'Yalnızca satıştaki oyun güncellenir.' };
  if (g.patches >= p.patchMax) return { ok: false, msg: 'Bu oyun yeterince güncellendi.' };
  const cost = patchCost(ctx, g);
  if (state.cash < cost) return { ok: false, msg: `Güncelleme ${cost.toLocaleString('tr-TR')} $.` };
  ledger.post('guncelleme', -cost, g.name);
  g.patches++;
  g.weeks = Math.max(0, g.weeks - Math.round(p.patchWeeksBack / g.patches));
  const fans = Math.round(state.fans * p.patchFansPct * Math.min(1, (g.bugRate || 0) * 10 + 0.3));
  state.fans += fans;
  ctx.news(`🩹 "${g.name}" güncellendi. Satışlar canlandı, +${fans.toLocaleString('tr-TR')} hayran.`, 'good');
  return { ok: true };
}

export function priceDrop(ctx, id) {
  const { state } = ctx;
  const g = state.games.find((x) => x.id === id);
  const p = P(ctx);
  if (!g || !g.active) return { ok: false, msg: 'Yalnızca satıştaki oyunun fiyatı düşer.' };
  const next = Math.max(p.priceFloor, Math.round(g.price * (1 - p.priceDropPct)));
  if (next >= g.price) return { ok: false, msg: 'Fiyat zaten en altta.' };
  const k = Math.pow(g.price / next, ctx.pack.sales.priceExp);
  for (const pid in g.peak) g.peak[pid] *= k;
  g.price = next;
  g.weeks = Math.max(0, g.weeks - p.priceDropWeeksBack);
  ctx.news(`🏷️ "${g.name}" artık ${next} $. Raflarda yeniden hareket var.`, 'info');
  return { ok: true };
}

// Port: aynı oyun yeni platformlara, biraz düşük notla ve daha az satışla.
export function portTargets(ctx, g) {
  const maxTech = ctx.pack.workstations.tiers[ctx.state.stationTier].maxTech;
  return activePlatforms(ctx).filter((p) => !g.platforms.includes(p.id) && (p.own || p.tech <= maxTech));
}
export function portCost(ctx, g, pid) {
  const p = platformById(ctx, pid);
  return Math.round((p.licence + p.devCost * sizeOf(ctx, g).devCost) * P(ctx).portCostMult);
}
export function port(ctx, id, pid) {
  const { state, ledger } = ctx;
  const g = state.games.find((x) => x.id === id);
  const p = platformById(ctx, pid);
  if (!g || g.expansion || g.portOf) return { ok: false, msg: 'Bu oyun uyarlanamaz.' };
  if (!p || !portTargets(ctx, g).includes(p)) return { ok: false, msg: 'Bu platforma uyarlanamaz.' };
  const cost = portCost(ctx, g, pid);
  if (state.cash < cost) return { ok: false, msg: `Uyarlama ${cost.toLocaleString('tr-TR')} $.` };
  ledger.post('port', -cost, `${g.name} → ${p.name}`);
  const copy = {
    ...g, id: state.nextId++, name: `${g.name} (${p.name})`, platforms: [pid], score: Math.max(1, g.score - P(ctx).portScorePenalty),
    hype: P(ctx).portHype, releasedWeek: state.week, weeks: 0, active: true, sold: { [pid]: 0 }, units: 0, revenue: 0, lastWeek: 0,
    hist: [], patches: 0, portOf: g.id, subs: 0, mmo: false,
  };
  copy.peak = peakWeekly(ctx, copy);
  for (const k in copy.peak) copy.peak[k] *= P(ctx).portSales;
  g.ports = (g.ports || 0) + 1;
  state.games.push(copy);
  state.charts.unshift({ name: copy.name, studio: state.companyName, score: copy.score, week: state.week, mine: true, genre: copy.genre });
  ctx.news(`🔁 "${g.name}" ${p.name} için yayında.`, 'good');
  return { ok: true };
}

// Ek paket: temel oyunun konu/tür/platformlarıyla kısa bir proje (sihirbaz yerine doğrudan başlar).
export function expansionAllowed(ctx, g) {
  return g && !g.expansion && !g.portOf && ctx.state.week - g.releasedWeek <= P(ctx).expansionMaxAgeWeeks && !ctx.state.projects.some((p) => p.baseGameId === g.id);
}
export function expansionDraft(ctx, g) {
  return {
    name: `${g.name}: Ek Paket`, genre: g.genre, sub: g.sub, topic: g.topic, audience: g.audience,
    platforms: g.platforms.filter((id) => activePlatforms(ctx).some((p) => p.id === id)), size: 'kucuk', kind: 'ek', baseGameId: g.id,
  };
}
