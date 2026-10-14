// Kadro sistemi: odalar (MGT2), kariyerler (Kairosoft), işe alım, maaş, stres, moral, tükenmişlik, istifa, transfer, eğitim.
import { clamp } from '../kernel.js';
import * as Regions from './regions.js';
import { marketSkill, salaryFor, traitOf, personWeekly, inflation, careerLevel, designOf, relAvg } from '../models.js';
import { genSkills, growSkills, weeklyVacations, weeklyRelations, ensureSkills } from './people.js';
import * as Genres from './genres.js';

// --- Odalar
export const officeOf = (ctx) => ctx.pack.offices.find((o) => o.tier === ctx.state.office.tier);
export const roomType = (ctx, type) => ctx.pack.rooms.types.find((t) => t.id === type);
export const slots = (ctx) => officeOf(ctx).slots + (ctx.state.office.floors || 0) * (officeOf(ctx).floorSlots || 0);
export const roomSeats = (ctx) => officeOf(ctx).roomSeats;
export const seats = (ctx) => ctx.state.rooms.length * roomSeats(ctx);
export const roomOf = (ctx, p) => ctx.state.rooms.find((r) => r.id === p.room);
export const membersOf = (ctx, room) => ctx.state.staff.filter((p) => p.room === room.id);
export const hasRoom = (ctx, type) => ctx.state.rooms.some((r) => r.type === type);

export function freeRoom(ctx, prefer = 'gelistirme') {
  const cap = roomSeats(ctx);
  const open = ctx.state.rooms.filter((r) => membersOf(ctx, r).length < cap);
  return open.find((r) => r.type === prefer) || open[0] || null;
}

export function buildRoom(ctx, type) {
  const { state, ledger } = ctx;
  const t = roomType(ctx, type);
  if (!t) return { ok: false, msg: 'Geçersiz oda.' };
  if (state.rooms.length >= slots(ctx)) return { ok: false, msg: 'Boş alan yok. Daha büyük ofise taşın.' };
  if (t.research && !state.research.done[t.research]) return { ok: false, msg: `${t.name} için araştırma gerekli.` };
  if (t.office && state.office.tier < t.office) return { ok: false, msg: `${t.name} için en az "${ctx.pack.offices[t.office - 1].name}" gerekli.` };
  const cost = Math.round(t.cost * inflation(ctx) ** 0.5);
  if (state.cash < cost) return { ok: false, msg: `${t.name} ${cost.toLocaleString('tr-TR')} $.` };
  ledger.post('oda', -cost, t.name);
  state.rooms.push({ id: state.nextId++, type, mode: 'otomatik' });
  ctx.news(`🧱 ${t.name} kuruldu.`, 'good');
  ctx.bus.fire('facilityUpgraded', t);
  return { ok: true };
}

export function demolishRoom(ctx, id) {
  const { state, ledger, pack } = ctx;
  const room = state.rooms.find((r) => r.id === id);
  if (!room) return { ok: false, msg: 'Oda yok.' };
  if (state.rooms.length === 1) return { ok: false, msg: 'Son odayı yıkamazsın.' };
  const others = state.rooms.filter((r) => r.id !== id);
  const people = membersOf(ctx, room);
  const freeSeats = others.length * roomSeats(ctx) - state.staff.filter((p) => p.room !== id).length;
  if (people.length > freeSeats) return { ok: false, msg: 'Odadakilere başka yerde yer yok.' };
  state.rooms = others;
  for (const p of people) p.room = freeRoom(ctx).id;
  ledger.post('oda', Math.round(roomType(ctx, room.type).cost * inflation(ctx) ** 0.5 * pack.rooms.demolishRefund), 'Oda söküldü');
  return { ok: true };
}

export function moveStaff(ctx, id, roomId) {
  const p = ctx.state.staff.find((x) => x.id === id);
  const room = ctx.state.rooms.find((r) => r.id === roomId);
  if (!p || !room) return { ok: false, msg: 'Geçersiz.' };
  if (p.room === roomId) return { ok: true };
  if (membersOf(ctx, room).length >= roomSeats(ctx)) return { ok: false, msg: 'O oda dolu.' };
  p.room = roomId;
  return { ok: true };
}

// --- Kariyer
export const career = (ctx, id) => ctx.pack.careers.find((c) => c.id === id);
export function levelCost(ctx, p) {
  const r = ctx.pack.careerRules;
  const lvl = careerLevel(p);
  if (lvl >= r.maxLevel) return null;
  return Math.round(r.rpPerLevel[lvl] * r.tierRpMult[career(ctx, p.career).tier] * inflation(ctx) ** 0.5);
}
export function levelUp(ctx, id) {
  const { state, pack } = ctx;
  const p = state.staff.find((x) => x.id === id);
  if (!p) return { ok: false, msg: 'Yok.' };
  const cost = levelCost(ctx, p);
  if (cost == null) return { ok: false, msg: 'Bu kariyerde en üst seviyede.' };
  if (state.research.rp < cost) return { ok: false, msg: `${cost} araştırma puanı gerekli.` };
  state.research.rp -= cost;
  p.careers[p.career] = careerLevel(p) + 1;
  if (!p.founder) p.salary = Math.round(p.salary * pack.careerRules.salaryPerLevel);
  ctx.news(`⬆️ ${p.name}: ${career(ctx, p.career).name} seviye ${p.careers[p.career]}.`, 'good');
  return { ok: true };
}
// V: ileri kariyer için ön koşul kariyerlerde o çalışanın kendisi seviye 5 olmalı.
export function careerOptions(ctx, p) {
  const max = ctx.pack.careerRules.maxLevel;
  return ctx.pack.careers.filter((c) => c.id !== p.career && c.req.every((r) => (p.careers[r] || 0) >= max));
}
export function changeCareer(ctx, id, cid) {
  const { state, pack, ledger } = ctx;
  const p = state.staff.find((x) => x.id === id);
  const c = career(ctx, cid);
  if (!p || !c) return { ok: false, msg: 'Geçersiz.' };
  if (!careerOptions(ctx, p).includes(c)) return { ok: false, msg: `${c.name} için ön koşullar tamam değil.` };
  ledger.post('egitim', -Math.round(pack.careerRules.changeCost * inflation(ctx)), `${p.name}: kariyer değişimi`);
  p.career = cid; p.careers[cid] = p.careers[cid] || 0; p.spec = c.disc;
  ctx.news(`🔀 ${p.name} artık ${c.name}.`, 'info');
  return { ok: true };
}

// --- Kişiler
export function makePerson(ctx, { skill, career: cid, founder = false, name, level } = {}) {
  const { rng, pack, state } = ctx;
  const g = pack.staffGen;
  const sk = Math.round(skill ?? clamp(rng.normal(marketSkill(ctx), g.skillSpread), 15, 100));
  const c = cid ? pack.careers.find((x) => x.id === cid) : rng.pick(pack.careers.filter((x) => x.tier === 1));
  const lvl = level ?? rng.int(0, pack.careerRules.hireMaxLevel);
  const trait = !founder && rng.chance(pack.traitChance) ? rng.pick(pack.traits).id : null;
  const trait2 = trait && rng.chance(pack.traitChance2) ? rng.pick(pack.traits.filter((t) => t.id !== trait)).id : null;
  const skills = genSkills(ctx, sk, c.disc);
  const [j0, j1] = pack.economy.salaryJitter;
  return Genres.assignTaste(ctx, {
    skills, trait2, vacDue: rng.range(0, 1.5),
    id: state.nextId++,
    name: name ?? `${rng.pick(g.first)} ${rng.pick(g.last)}`,
    skill: sk, career: c.id, careers: { [c.id]: lvl }, spec: c.disc, trait, founder,
    salary: founder ? 0 : Math.round(salaryFor(ctx, sk) * rng.range(j0, j1) * Math.pow(pack.careerRules.salaryPerLevel, lvl)),
    morale: 70, stress: 10, status: 'ok', statusWeeks: 0, room: null,
    look: { hair: rng.pick(g.hair), skin: rng.pick(g.skin) },
    hiredWeek: state.week, games: 0,
  }, founder); // Konu D: sevdiği ve sevmediği türler
}

export function genApplicants(ctx) {
  const g = ctx.pack.staffGen;
  const n = g.applicantsBase + g.applicantsPerTier * (ctx.state.office.tier - 1);
  ctx.state.applicants = Array.from({ length: n }, () => makePerson(ctx));
  // Bölge ofisi olan yerlerden yerel adaylar: maaş o bölgenin ücret düzeyinde (Konu C)
  for (const rid of Regions.offices(ctx)) {
    const p = makePerson(ctx);
    p.salary = Math.round(p.salary * Regions.payRatio(ctx, rid));
    p.origin = rid; p.name = `${p.name} ${Regions.R(rid).flag}`;
    ctx.state.applicants.push(p);
  }
}

export function hire(ctx, id) {
  const { state, pack, ledger, bus } = ctx;
  const a = state.applicants.find((x) => x.id === id);
  if (!a) return { ok: false, msg: 'Aday bulunamadı.' };
  const room = freeRoom(ctx);
  if (!room) return { ok: false, msg: 'Boş koltuk yok. Oda kur ya da ofisi büyüt.' };
  ledger.post('ise_alim', -a.salary * pack.economy.hireFeeMonths, `${a.name} işe alındı`);
  a.hiredWeek = state.week; a.room = room.id;
  state.staff.push(a);
  state.applicants = state.applicants.filter((x) => x.id !== id);
  bus.fire('staffHired', a);
  ctx.news(`👋 ${a.name} ekibe katıldı (${roomType(ctx, room.type).name}).`, 'good');
  return { ok: true };
}

export function removePerson(ctx, p, reason) {
  ctx.state.staff = ctx.state.staff.filter((x) => x.id !== p.id);
  ctx.bus.fire('staffFired', { person: p, reason });
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
  ledger.post('egitim', -Math.round(t.cost * inflation(ctx)), `${p.name}: ${t.name}`);
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

// Odanın bu hafta işi var mı?
export function roomBusy(ctx, room) {
  const s = ctx.state;
  switch (room.type) {
    case 'gelistirme': {
      if (room.mode === 'destek') return s.projects.some((p) => p.id === room.target);
      const own = s.projects.some((p) => p.roomId === room.id);
      return (room.mode !== 'sozlesme' && own) || (!!s.contract && (room.mode === 'sozlesme' || (room.mode === 'otomatik' && !own)));
    }
    case 'grafik': case 'ses': return room.target ? s.projects.some((p) => p.id === room.target && p.status === 'dev') : s.projects.some((p) => p.status === 'dev');
    case 'qa': case 'pazarlama': return room.target ? s.projects.some((p) => p.id === room.target) : s.projects.length > 0;
    case 'musteri': return s.games.some((g) => g.active);
    case 'arastirma': return true;
    case 'donanim': return !!(s.consoleJob);
    default: return false;
  }
}

// Haftalık: personel durumu, stres, moral, tükenmişlik, istifa, transfer.
export function weeklyStaff(ctx) {
  const { state, pack, rng } = ctx;
  const wb = pack.wellbeing;
  const n = state.staff.length;
  const teamMood = state.staff.reduce((s, p) => s + traitOf(ctx, p, 'moraleTeam', 0), 0);
  const restRoom = hasRoom(ctx, 'mola');
  const busyRooms = new Set(state.rooms.filter((r) => roomBusy(ctx, r)).map((r) => r.id));
  const leaving = [];
  weeklyRelations(ctx);
  weeklyVacations(ctx);
  const banned = !pack.vacation.policies[state.vacationPolicy || 'planli'].cap;
  for (const p of state.staff) {
    ensureSkills(ctx, p);
    if (!p.room || !state.rooms.some((r) => r.id === p.room)) p.room = (freeRoom(ctx) || state.rooms[0]).id;
    if (p.status !== 'ok') {
      p.statusWeeks--;
      p.stress = clamp(p.stress + wb.stressRest, 0, 100);
      if (p.statusWeeks <= 0) {
        if (p.status === 'egitim') {
          const gain = p.trainGain * (1 - p.skill / pack.trainingRules.diminish) * traitOf(ctx, p, 'learn');
          const old = p.skill;
          p.skill = clamp(Math.round(p.skill + gain), 1, pack.trainingRules.skillMax);
          growSkills(ctx, p, old);
          p.salary = Math.round(p.salary * (1 + gain * pack.trainingRules.salaryRaisePerPoint));
          ctx.news(`🎓 ${p.name} eğitimi bitirdi (beceri ${p.skill}).`, 'good');
          ctx.bus.fire('trainingFinished', p);
        }
        if (p.status === 'tatil') {
          p.morale = clamp(p.morale + pack.vacation.backMorale, 0, 100);
          p.stress = clamp(p.stress + pack.vacation.backStress, 0, 100);
        }
        p.status = 'ok';
      }
      continue;
    }
    const room = roomOf(ctx, p);
    const resting = room.type === 'mola';
    const busy = busyRooms.has(room.id);
    let ds = resting ? wb.stressRest : busy ? wb.stressWork + wb.stressPerExtraStaff * n : wb.stressIdle;
    if (state.crunch && busy) ds += wb.stressCrunch;
    if (state.flags.union && state.crunch) ds -= 2;
    if (restRoom) ds += pack.rooms.restRoomStress;
    const des = designOf(ctx, p);
    p.stress = clamp(p.stress + ds * (ds > 0 ? traitOf(ctx, p, 'stress') * des.stress : 1), 0, 100);

    const market = salaryFor(ctx, p.skill) * Math.pow(pack.careerRules.salaryPerLevel, careerLevel(p));
    const underpaid = p.founder ? 0 : Math.max(0, 1 - p.salary / market) * 100 * wb.moraleUnderpaidK;
    const target = wb.moraleTarget - p.stress * wb.moraleStressK * 6 + teamMood + traitOf(ctx, p, 'moraleSelf', 0) - underpaid + (state.flags.union ? 5 : 0) + (restRoom ? 3 : 0)
      + des.morale + pack.relations.moraleK * relAvg(ctx, p) / 100 + Genres.staffMood(ctx, p);
    p.morale = clamp(p.morale + (target - p.morale) * wb.moraleRecovery, 0, 100);

    if (p.stress >= wb.burnoutAt && rng.chance(wb.burnoutChance * (banned ? pack.vacation.banBurnout : 1))) {
      p.status = 'tukenmis'; p.statusWeeks = rng.int(...wb.burnoutWeeks);
      ctx.news(`💀 ${p.name} tükendi. ${p.statusWeeks} hafta yok.`, 'bad');
      state.heat += 3;
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
      ctx.bus.fire('staffTransfer', { person: p, rival: r });
      if (r.rep !== undefined) r.rep = clamp(r.rep + 1, 1, 100);
    }
    for (const o of state.staff) o.morale = clamp(o.morale - 3, 0, 100);
  }
}

// Belirli odalardaki çalışanların bu haftaki çıktısı.
export function weeklyOutput(ctx, roomFilter) {
  const n = ctx.state.staff.length;
  const out = [];
  for (const p of working(ctx.state)) {
    const room = roomOf(ctx, p);
    if (room && roomFilter(room)) out.push({ p, w: personWeekly(ctx, p, n), room });
  }
  return out;
}
