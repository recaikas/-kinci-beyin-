// Kadro sistemi: işe alım, maaş, stres, moral, tükenmişlik, istifa, transfer, eğitim.
import { clamp } from '../kernel.js';
import { marketSkill, salaryFor, traitOf, personWeekly } from '../models.js';

export function makePerson(ctx, { skill, spec, founder = false, name } = {}) {
  const { rng, pack, state } = ctx;
  const g = pack.staffGen;
  const sk = Math.round(skill ?? clamp(rng.normal(marketSkill(ctx), g.skillSpread), 15, 100));
  const sp = spec ?? rng.pick(g.specs);
  const trait = !founder && rng.chance(pack.traitChance) ? rng.pick(pack.traits).id : null;
  const [j0, j1] = pack.economy.salaryJitter;
  return {
    id: state.nextId++,
    name: name ?? `${rng.pick(g.first)} ${rng.pick(g.last)}`,
    skill: sk, spec: sp, trait, founder,
    salary: founder ? 0 : Math.round(salaryFor(ctx, sk) * rng.range(j0, j1)),
    morale: 70, stress: 10, status: 'ok', statusWeeks: 0, assign: 'proje',
    look: { hair: rng.pick(g.hair), skin: rng.pick(g.skin) },
    hiredWeek: state.week, games: 0,
  };
}

export function seats(ctx) {
  const o = ctx.pack.offices.find((x) => x.tier === ctx.state.office.tier);
  return o.seats + (ctx.state.office.floors || 0) * (o.floorSeats || 0);
}

export function genApplicants(ctx) {
  const g = ctx.pack.staffGen;
  const n = g.applicantsBase + g.applicantsPerTier * (ctx.state.office.tier - 1);
  ctx.state.applicants = Array.from({ length: n }, () => makePerson(ctx));
}

export function hire(ctx, id) {
  const { state, pack, ledger, bus } = ctx;
  const a = state.applicants.find((x) => x.id === id);
  if (!a) return { ok: false, msg: 'Aday bulunamadı.' };
  if (state.staff.length >= seats(ctx)) return { ok: false, msg: 'Boş koltuk yok. Ofisi büyüt.' };
  ledger.post('ise_alim', -a.salary * pack.economy.hireFeeMonths, `${a.name} işe alındı`);
  a.hiredWeek = state.week;
  state.staff.push(a);
  state.applicants = state.applicants.filter((x) => x.id !== id);
  bus.fire('staffHired', a);
  ctx.news(`👋 ${a.name} ekibe katıldı.`, 'good');
  return { ok: true };
}

export function removePerson(ctx, p, reason) {
  const { state, bus } = ctx;
  state.staff = state.staff.filter((x) => x.id !== p.id);
  bus.fire('staffFired', { person: p, reason });
}

export function fire(ctx, id) {
  const { state, pack, ledger } = ctx;
  const p = state.staff.find((x) => x.id === id);
  if (!p || p.founder) return { ok: false, msg: 'Kurucuyu kovamazsın (henüz).' };
  ledger.post('tazminat', -p.salary * pack.economy.severanceMonths, `${p.name} kovuldu`);
  removePerson(ctx, p, 'kovuldu');
  for (const o of state.staff) o.morale = clamp(o.morale - 4, 0, 100);
  ctx.news(`📦 ${p.name} kutusunu toplayıp gitti. Ekip gergin.`, 'bad');
  return { ok: true };
}

export function train(ctx, id, tid) {
  const { state, pack, ledger, bus } = ctx;
  const p = state.staff.find((x) => x.id === id);
  const t = pack.training.find((x) => x.id === tid);
  if (!p || !t) return { ok: false, msg: 'Geçersiz.' };
  if (p.status !== 'ok') return { ok: false, msg: `${p.name} şu an müsait değil.` };
  ledger.post('egitim', -Math.round(t.cost * ctx.infl()), `${p.name}: ${t.name}`);
  p.status = 'egitim'; p.statusWeeks = t.weeks; p.trainGain = t.gain;
  bus.fire('trainingStarted', p);
  return { ok: true };
}

export function raise(ctx, id, pct) {
  const p = ctx.state.staff.find((x) => x.id === id);
  if (!p || p.founder) return { ok: false };
  p.salary = Math.round(p.salary * (1 + pct));
  p.morale = clamp(p.morale + 25 * pct * 4, 0, 100);
  return { ok: true };
}

export const working = (state) => state.staff.filter((p) => p.status === 'ok');

// Haftalık: personel durumu, stres, moral, tükenmişlik, istifa, transfer.
export function weeklyStaff(ctx) {
  const { state, pack, rng } = ctx;
  const wb = pack.wellbeing;
  const n = state.staff.length;
  const teamMood = state.staff.reduce((s, p) => s + traitOf(ctx, p, 'moraleTeam', 0), 0);
  const leaving = [];
  for (const p of state.staff) {
    if (p.status !== 'ok') {
      p.statusWeeks--;
      p.stress = clamp(p.stress + wb.stressRest, 0, 100);
      if (p.statusWeeks <= 0) {
        if (p.status === 'egitim') {
          const gain = p.trainGain * (1 - p.skill / pack.trainingRules.diminish);
          p.skill = clamp(Math.round(p.skill + gain), 1, pack.trainingRules.skillMax);
          p.salary = Math.round(p.salary * (1 + gain * pack.trainingRules.salaryRaisePerPoint));
          ctx.news(`🎓 ${p.name} eğitimi bitirdi (beceri ${p.skill}).`, 'good');
          ctx.bus.fire('trainingFinished', p);
        }
        p.status = 'ok';
      }
      continue;
    }
    const busy = p.assign !== 'dinlen' && (p.assign !== 'proje' || state.project) && (p.assign !== 'sozlesme' || state.contract);
    let ds = busy ? wb.stressWork + wb.stressPerExtraStaff * n : wb.stressIdle;
    if (p.assign === 'dinlen') ds = wb.stressRest;
    if (state.crunch && busy) ds += wb.stressCrunch;
    if (state.flags.union && state.crunch) ds -= 2;
    p.stress = clamp(p.stress + ds * traitOf(ctx, p, 'stress'), 0, 100);

    const market = salaryFor(ctx, p.skill);
    const underpaid = p.founder ? 0 : Math.max(0, 1 - p.salary / market) * 100 * wb.moraleUnderpaidK;
    const target = wb.moraleTarget - p.stress * wb.moraleStressK * 6 + teamMood + traitOf(ctx, p, 'moraleSelf', 0) - underpaid + (state.flags.union ? 5 : 0);
    p.morale = clamp(p.morale + (target - p.morale) * wb.moraleRecovery, 0, 100);

    if (p.stress >= wb.burnoutAt && rng.chance(wb.burnoutChance)) {
      p.status = 'tukenmis'; p.statusWeeks = rng.int(...wb.burnoutWeeks);
      ctx.news(`💀 ${p.name} tükendi. ${p.statusWeeks} hafta yok.`, 'bad');
      ctx.state.heat += 3;
      continue;
    }
    if (rng.chance(wb.sickChance)) {
      p.status = 'hasta'; p.statusWeeks = rng.int(...wb.sickWeeks);
      ctx.news(`🤒 ${p.name} hastalandı.`, 'warn');
      continue;
    }
    if (p.founder) continue;
    const unhappy = p.stress >= wb.quitStress || p.morale < wb.quitMoraleBelow;
    if (unhappy && rng.chance(wb.quitChance * traitOf(ctx, p, 'quit'))) { leaving.push([p, 'istifa']); continue; }
    const poach = (wb.poachBase + p.skill * wb.poachSkillK) * (p.morale < 50 ? 2 : 1);
    if (rng.chance(poach)) leaving.push([p, 'transfer']);
  }
  for (const [p, why] of leaving) {
    removePerson(ctx, p, why);
    if (why === 'istifa') ctx.news(`🚪 ${p.name} istifa etti. Veda e-postası: "Artık yeter."`, 'bad');
    else {
      const r = rng.pick(state.rivals.filter((x) => !x.acquired)) || { name: 'bir rakip' };
      ctx.news(`🦈 ${p.name}, ${r.name} stüdyosuna transfer oldu.`, 'bad');
      if (r.rep !== undefined) r.rep = clamp(r.rep + 1, 1, 100);
    }
    for (const o of state.staff) o.morale = clamp(o.morale - 3, 0, 100);
  }
}

export function weeklyOutput(ctx, filter) {
  const ws = working(ctx.state).filter(filter);
  const n = ctx.state.staff.length;
  return ws.map((p) => ({ p, w: personWeekly(ctx, p, n) }));
}
