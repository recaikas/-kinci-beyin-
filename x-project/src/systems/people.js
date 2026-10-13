// İnsanlar (MGT/GDT/GDS esinli): yetenek setleri, tatil (çakışma kuralı) ve çalışan ilişkileri.
import { clamp } from '../kernel.js';
import { traitOf, hasTrait, relKey } from '../models.js';

// --- Yetenek setleri
export function genSkills(ctx, sk, spec) {
  const { pack, rng } = ctx;
  const S = pack.skills;
  const specKey = (S.keys.find((k) => k[2] === spec) || S.keys[0])[0];
  const second = rng.pick(S.keys.filter((k) => k[0] !== specKey))[0];
  const out = {};
  for (const [k] of S.keys) out[k] = clamp(Math.round(sk * rng.range(...(k === specKey ? S.specHi : k === second ? S.secondary : S.other))), 1, 100);
  return out;
}
export function ensureSkills(ctx, p) {
  if (!p.skills) p.skills = genSkills(ctx, p.skill, p.spec);
  return p.skills;
}
// Genel beceri değişince yetenekler orantılı büyür (öğrenme huyuyla).
export function growSkills(ctx, p, oldSkill) {
  if (!p.skills || !oldSkill) return;
  const f = p.skill / oldSkill;
  for (const k in p.skills) p.skills[k] = clamp(Math.round(p.skills[k] * f), 1, 100);
}
export const topSkills = (ctx, p, n = 2) => Object.entries(ensureSkills(ctx, p)).sort((a, b) => b[1] - a[1]).slice(0, n)
  .map(([k, v]) => [ctx.pack.skills.keys.find((x) => x[0] === k)[1], v]);

// --- Tatil
export const vacPolicy = (ctx) => ctx.pack.vacation.policies[ctx.state.vacationPolicy || 'planli'];
export const onVacation = (state) => state.staff.filter((p) => p.status === 'tatil');
export function vacationCap(ctx) {
  const pol = vacPolicy(ctx);
  return pol.cap ? Math.max(1, Math.floor(ctx.state.staff.length * pol.cap)) : 0;
}
// İzin isteğini değerlendir: { ok, why, clash }
export function canVacation(ctx, p, forced = false) {
  const { state } = ctx;
  const pol = vacPolicy(ctx);
  if (p.status !== 'ok') return { ok: false, why: 'müsait değil' };
  if (!forced && !pol.cap) return { ok: false, why: 'tatil yasak' };
  const away = onVacation(state);
  if (!forced && away.length >= vacationCap(ctx)) return { ok: false, why: 'kontenjan dolu', clash: away[0] };
  const mate = away.find((x) => x.room === p.room);
  if (!forced && pol.perRoom && mate) return { ok: false, why: `${mate.name} zaten izinde`, clash: mate };
  return { ok: true };
}
export function startVacation(ctx, p, weeks) {
  const V = ctx.pack.vacation;
  p.status = 'tatil'; p.statusWeeks = weeks ?? ctx.rng.int(...V.weeks);
  p.vacDue = Math.max(0, (p.vacDue || 0) - p.statusWeeks);
  p.lastVac = ctx.state.week;
}
export function sendVacation(ctx, id) {
  const p = ctx.state.staff.find((x) => x.id === id);
  if (!p) return { ok: false, msg: 'Yok.' };
  const r = canVacation(ctx, p, true);
  if (!r.ok) return { ok: false, msg: `${p.name}: ${r.why}.` };
  startVacation(ctx, p);
  ctx.news(`🏖️ ${p.name} tatile gönderildi (${p.statusWeeks} hafta).`, 'good');
  return { ok: true };
}
export function setVacationPolicy(ctx, id) {
  if (!ctx.pack.vacation.policies[id]) return { ok: false };
  ctx.state.vacationPolicy = id;
  return { ok: true };
}
// Haftalık: izin hakkı birikir; yorgun ya da hakkı dolmuş çalışan izin ister. Çakışan istek reddedilir.
export function weeklyVacations(ctx) {
  const { state, pack, rng } = ctx;
  const V = pack.vacation, R = pack.relations;
  const pol = vacPolicy(ctx);
  let denied = 0, granted = 0, lastDenied = null;
  for (const p of state.staff) {
    if (p.status !== 'ok') continue;
    p.vacDue = Math.min(V.perYear * 2, (p.vacDue || 0) + (V.perYear / 48) * traitOf(ctx, p, 'vacation'));
    const wants = p.stress >= V.stressWant || p.vacDue >= V.dueWant * traitOf(ctx, p, 'vacation') ** -1;
    if (!wants || !rng.chance(V.askChance)) continue;
    const r = canVacation(ctx, p);
    if (r.ok) { startVacation(ctx, p); granted++; continue; }
    p.morale = clamp(p.morale + (pol.cap ? V.deniedMorale : V.banMorale), 0, 100);
    p.stress = clamp(p.stress + V.deniedStress, 0, 100);
    if (r.clash) { const k = relKey(p.id, r.clash.id); state.rel ||= {}; state.rel[k] = clamp((state.rel[k] || 0) + V.conflictRel, -100, 100); }
    denied++; lastDenied = [p, r];
  }
  if (granted) ctx.news(`🏖️ ${granted} kişi tatile çıktı.`, 'info');
  if (denied && lastDenied) ctx.news(`🙅 ${lastDenied[0].name} tatil istedi, reddedildi (${lastDenied[1].why})${denied > 1 ? ` · +${denied - 1} kişi daha` : ''}.`, 'warn');
  return { granted, denied };
}

// --- Çalışan ilişkileri
export function relation(state, a, b) { return (state.rel && state.rel[relKey(a.id, b.id)]) || 0; }
export function relationsOf(ctx, p) {
  const out = [];
  for (const x of ctx.state.staff) if (x !== p) { const v = relation(ctx.state, p, x); if (Math.abs(v) >= 15) out.push([x, v]); }
  return out.sort((a, b) => b[1] - a[1]);
}
export function weeklyRelations(ctx) {
  const { state, pack, rng } = ctx;
  const R = pack.relations;
  state.rel ||= {};
  const ids = new Set(state.staff.map((p) => p.id));
  for (const k in state.rel) { const [a, b] = k.split('|').map(Number); if (!ids.has(a) || !ids.has(b)) delete state.rel[k]; }
  const pairs = [];
  for (const room of state.rooms) {
    const m = state.staff.filter((p) => p.room === room.id && p.status === 'ok');
    for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) pairs.push([m[i], m[j]]);
  }
  for (const [a, b] of pairs) {
    const k = relKey(a.id, b.id);
    let d = R.drift * traitOf(ctx, a, 'social') * traitOf(ctx, b, 'social');
    if (state.crunch) d += R.crunchDrift;
    for (const p of [a, b]) {
      if (hasTrait(p, 'toksik') || hasTrait(p, 'drama')) d += R.toxicDrift;
      if (hasTrait(p, 'kiskanc') && Math.abs(a.skill - b.skill) > 10) d += R.rivalDrift;
    }
    state.rel[k] = clamp((state.rel[k] || 0) + d, -100, 100);
    if (state.rel[k] <= R.enemyAt) { a.stress = clamp(a.stress + R.enemyStress, 0, 100); b.stress = clamp(b.stress + R.enemyStress, 0, 100); }
  }
  if (pairs.length && rng.chance(R.eventChance)) {
    const [a, b] = rng.pick(pairs);
    const k = relKey(a.id, b.id), v = state.rel[k] || 0;
    const bad = rng.chance(clamp(0.5 - v / 150 + (hasTrait(a, 'toksik') || hasTrait(b, 'toksik') ? 0.25 : 0), 0.1, 0.9));
    if (bad) {
      state.rel[k] = clamp(v + R.fight, -100, 100);
      ctx.news(rng.pick([`💢 ${a.name} ile ${b.name} kod incelemesinde kavga etti.`, `💢 ${a.name}, ${b.name}'in öğle yemeğini yedi. Savaş ilan edildi.`, `💢 ${a.name} ile ${b.name} sekme mi boşluk mu tartışmasında küstü.`]), 'warn');
    } else {
      state.rel[k] = clamp(v + R.friend, -100, 100);
      ctx.news(rng.pick([`🤝 ${a.name} ile ${b.name} birlikte bir hatayı gece 3'te çözdü; artık kanka.`, `🤝 ${a.name} ile ${b.name} aynı grubu dinliyormuş. Dostluk doğdu.`, `🤝 ${a.name}, ${b.name}'e kahve ısmarladı. Ekipte sıcak rüzgârlar.`]), 'good');
    }
  }
}
