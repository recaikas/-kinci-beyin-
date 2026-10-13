// Olay sistemi: tarihî dönemler, rastgele olaylar (36 + 48·r hafta, kaosla sıklaşır), etkiler.
import { clamp } from '../kernel.js';
import { applyBoard } from './company.js';
import { inflation, tableYear } from '../models.js';
import { removePerson } from './staff.js';

function cond(ctx, w = {}) {
  const { state } = ctx;
  const y = tableYear(ctx);
  const n = state.staff.length;
  const avgMorale = n ? state.staff.reduce((s, p) => s + p.morale, 0) / n : 100;
  if (w.minYear && y < w.minYear) return false;
  if (w.maxYear && y > w.maxYear) return false;
  if (w.minStaff && n < w.minStaff) return false;
  if (w.officeTier && state.office.tier !== w.officeTier) return false;
  if (w.hasProject && !state.projects.length) return false;
  if (w.hasReleased && !state.games.length) return false;
  if (w.hasMmo && !state.games.some((g) => g.mmo && g.subs > 0)) return false;
  if (w.hasPublisherGame && !state.games.some((g) => g.active && g.publisherId)) return false;
  if (w.minKaos && state.kaos < w.minKaos) return false;
  if (w.minCash && state.cash < w.minCash * inflation(ctx)) return false;
  if (w.maxCash !== undefined && state.cash > w.maxCash) return false;
  if (w.minFans && state.fans < w.minFans) return false;
  if (w.maxMorale && avgMorale > w.maxMorale) return false;
  if (w.crunch && !state.crunch) return false;
  if (w.hasLoan && !state.loans.length) return false;
  if (w.flag && !state.flags[w.flag]) return false;
  if (w.notFlag && state.flags[w.notFlag]) return false;
  if (w.noResearch && state.research.done[w.noResearch]) return false;
  if (w.trait && !state.staff.some((p) => p.trait === w.trait || p.trait2 === w.trait)) return false;
  return true;
}

export function applyEffects(ctx, e = {}) {
  const { state, ledger, rng } = ctx;
  const infl = inflation(ctx);
  const c = ctx.pack.chaos;
  const scale = clamp(c.eventScaleBase + c.eventScalePerStaff * state.staff.length, c.eventScaleMin, c.eventScaleMax);
  const all = (fn) => state.staff.forEach(fn);
  if (e.cash) ledger.post('olay', Math.round(e.cash * infl * scale), 'Olay');
  if (e.cashRaw) ledger.post('olay', e.cashRaw, 'Olay');
  if (e.cashPct && state.cash > 0) ledger.post('olay', Math.round(state.cash * e.cashPct), 'Olay');
  if (e.morale) all((p) => (p.morale = clamp(p.morale + e.morale, 0, 100)));
  if (e.stress) all((p) => (p.stress = clamp(p.stress + e.stress, 0, 100)));
  if (e.skill) all((p) => (p.skill = clamp(p.skill + e.skill, 1, 100)));
  // Proje etkileri rastgele bir projeye düşer.
  const pj = state.projects.length ? rng.pick(state.projects) : null;
  if (e.hype && pj) pj.hype = clamp(pj.hype + e.hype, 0, ctx.pack.hype.max);
  if (e.fans) state.fans = Math.max(0, Math.round(state.fans + e.fans * Math.max(1, infl ** 0.5)));
  if (e.fansPct) state.fans = Math.max(0, Math.round(state.fans * (1 + e.fansPct)));
  if (e.prestige) state.prestige = clamp(state.prestige + e.prestige, 0, ctx.pack.prestige.max);
  if (e.kaos) state.heat += e.kaos;
  if (e.rp) state.research.rp += e.rp * infl ** 0.5;
  if (e.progress && pj && pj.status === 'dev') pj.week = clamp(pj.week + e.progress, 0, pj.totalWeeks);
  if (e.bugsPct && pj) pj.bugs *= 1 + e.bugsPct;
  if (e.salesMult) state.gameMods.push({ mult: e.salesMult.mult, untilWeek: state.week + e.salesMult.weeks });
  if (e.salaryPct) all((p) => { if (!p.founder) p.salary = Math.round(p.salary * (1 + e.salaryPct)); });
  if (e.rentPct) state.rentMult *= 1 + e.rentPct;
  if (e.flag) state.flags[e.flag] = true;
  if (e.unflag) delete state.flags[e.unflag];
  if (e.endCrunch) state.crunch = false;
  if (e.stationDown) state.stationDown = 8;
  if (e.sick) for (let i = 0; i < e.sick; i++) {
    const p = rng.pick(state.staff.filter((x) => x.status === 'ok'));
    if (p) { p.status = 'hasta'; p.statusWeeks = rng.int(1, 3); }
  }
  const others = () => state.staff.filter((p) => !p.founder);
  if (e.quit) for (let i = 0; i < e.quit; i++) {
    const p = rng.pick(others());
    if (p) { removePerson(ctx, p, 'olay'); ctx.news(`🚪 ${p.name} ayrıldı.`, 'bad'); }
  }
  if (e.poach) {
    const top = others().sort((a, b) => b.skill - a.skill)[0];
    if (top) { removePerson(ctx, top, 'transfer'); ctx.news(`🦈 ${top.name} rakibe gitti.`, 'bad'); }
  }
  if (e.topRaise) {
    const top = others().sort((a, b) => b.skill - a.skill)[0];
    if (top) { top.salary = Math.round(top.salary * (1 + e.topRaise)); top.morale = clamp(top.morale + 20, 0, 100); }
  }
  if (e.fireTrait) for (const p of others().filter((x) => x.trait === e.fireTrait || x.trait2 === e.fireTrait)) { removePerson(ctx, p, 'kovuldu'); ctx.news(`📦 ${p.name} kovuldu.`, 'bad'); }
  if (e.fireSpec) for (const p of others().filter((x) => x.spec === e.fireSpec)) { removePerson(ctx, p, 'kovuldu'); ctx.news(`🤖 ${p.name} yerini bir modele bıraktı.`, 'bad'); }
  if (e.layoffPct) {
    const k = Math.ceil(others().length * e.layoffPct);
    const victims = others().sort((a, b) => a.skill - b.skill).slice(0, k);
    for (const p of victims) removePerson(ctx, p, 'kovuldu');
    if (k) ctx.news(`✂️ ${k} kişi işten çıkarıldı.`, 'bad');
  }
  if (e.chance) {
    const branch = rng.chance(e.chance.p) ? e.chance.yes : e.chance.no;
    applyEffects(ctx, branch);
  }
  if (e.board) applyBoard(ctx, e.board);
  if (e.crunch) state.crunch = true;
  if (e.news) ctx.news(e.news, 'info');
}

export function resolvePending(ctx, choiceIdx) {
  const { state } = ctx;
  const ev = state.pending.shift();
  if (!ev) return;
  const ch = ev.choices[choiceIdx] || ev.choices[0];
  applyEffects(ctx, ch.effects);
  ctx.bus.fire('eventResolved', { ev, choice: ch });
}

export function weeklyEvents(ctx) {
  const { state, pack, rng } = ctx;
  const y = tableYear(ctx);
  // Tarihî dönemler
  for (const era of pack.eras) {
    if (state.erasFired[era.id] || y < era.year) continue;
    state.erasFired[era.id] = true;
    state.marketMods.push({ id: era.id, salesMult: era.salesMult, prodMult: era.prodMult, creditMult: era.creditMult, untilWeek: state.week + Math.round(era.weeks * state.lengthMult) });
    if (era.flag) state.flags[era.flag] = true;
    if (era.kaos) state.heat += era.kaos;
    for (const p of state.projects) if (era.hype) p.hype += era.hype;
    ctx.queue({ id: era.id, title: `📰 ${era.title}`, text: era.text, choices: [{ label: 'Kemerleri bağla', effects: {} }] });
  }
  for (const m of state.marketMods) if (m.untilWeek <= state.week) {
    const era = pack.eras.find((e) => e.id === m.id);
    if (era && era.flag && era.flag !== 'lootboxBan') delete state.flags[era.flag];
    ctx.news(`📰 Dönem sona erdi: ${era ? era.title : ''}`, 'info');
  }
  state.marketMods = state.marketMods.filter((m) => m.untilWeek > state.week);
  state.gameMods = state.gameMods.filter((m) => m.untilWeek > state.week);

  // Rastgele olaylar
  if (state.week < state.nextEventWeek) return;
  const c = pack.chaos;
  state.nextEventWeek = state.week + Math.max(c.eventMinGap, Math.round((c.eventBase + c.eventRand * rng.next()) / (1 + state.kaos / c.eventKaosDiv)));
  const pool = pack.events.filter((e) => cond(ctx, e.when) && (!e.maxTriggers || (state.eventCounts[e.id] || 0) < e.maxTriggers) && state.lastEvents.indexOf(e.id) < 0);
  if (!pool.length) return;
  const ev = rng.pick(pool);
  state.eventCounts[ev.id] = (state.eventCounts[ev.id] || 0) + 1;
  state.lastEvents.unshift(ev.id);
  state.lastEvents.length = Math.min(state.lastEvents.length, 6);
  ctx.queue({ id: ev.id, title: ev.title, text: ev.text, choices: ev.choices });
  ctx.bus.fire('randomEvent', ev);
}
