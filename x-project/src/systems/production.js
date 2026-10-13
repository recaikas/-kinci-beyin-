// Üretim: oyun projesi (3 faz × 3 görev), hata ayıklama, sözleşme işleri, araştırma, motor.
import { clamp } from '../kernel.js';
import { H, inflation, tableYear, featureStats, engineFactor, traitOf } from '../models.js';
import { weeklyOutput } from './staff.js';

// --- Proje
export function newProject(ctx, o) {
  const { state, pack } = ctx;
  const size = pack.sizes.find((s) => s.id === o.size);
  const weeks = size.weeks;
  return {
    id: state.nextId++, name: o.name, genre: o.genre, sub: o.sub || null, topic: o.topic, audience: o.audience,
    platforms: o.platforms, size: o.size, engineId: o.engineId ?? null, sequelOf: o.sequelOf ?? null,
    alloc: o.alloc || pack.genres.find((g) => g.id === o.genre).hint.map((v) => Math.max(20, v)),
    week: 0, totalWeeks: weeks, phase: 0, status: 'dev',
    points: { oyn: 0, gfx: 0, ses: 0, tek: 0 }, bugs: 0, hype: 0, startedWeek: state.week, mmo: !!size.mmo,
  };
}

export function projectCost(ctx, o) {
  const { pack } = ctx;
  const size = pack.sizes.find((s) => s.id === o.size);
  let cost = 0;
  for (const id of o.platforms) {
    const p = pack.platforms.find((x) => x.id === id);
    cost += p.licence + p.devCost * size.devCost;
  }
  return Math.round(cost);
}

export function weeklyProject(ctx) {
  const { state, pack } = ctx;
  const pj = state.project;
  if (!pj) return;
  const pr = pack.production;
  const crew = weeklyOutput(ctx, (p) => p.assign === 'proje');
  if (pj.status === 'dev') {
    const g = pack.genres.find((x) => x.id === pj.genre);
    const phaseLen = pj.totalWeeks / 3;
    pj.phase = Math.min(2, Math.floor(pj.week / phaseLen));
    const ids = pack.missions.map((m, i) => i).filter((i) => pack.missions[i].phase === pj.phase);
    const sum = ids.reduce((s, i) => s + pj.alloc[i], 0) || 1;
    const eng = engineFactor(ctx, state.engines.find((e) => e.id === pj.engineId));
    for (const { p, w } of crew) {
      for (const i of ids) {
        const m = pack.missions[i];
        let pts = w * (pj.alloc[i] / sum) * (pr.missionFloor + (1 - pr.missionFloor) * g.mission[i]);
        if (p.spec === m.disc) pts *= pr.specBonus;
        if (m.disc === 'tek') pts *= eng;
        pj.points[m.disc] += pts;
        const bugK = pr.bugPerPoint * traitOf(ctx, p, 'bugs') * (state.crunch ? pr.crunchBugMult : 1) * clamp(1.3 - p.skill / 100, 0.3, 1.3);
        pj.bugs += pts * bugK;
      }
    }
    if (crew.length) pj.week++;
    pj.hype = Math.max(0, pj.hype - pack.hype.decayDev);
    if (pj.week >= pj.totalWeeks) {
      pj.status = 'debug';
      ctx.news(`🐞 "${pj.name}" içerik olarak bitti. Hata ayıklama başladı; istediğin an yayınlayabilirsin.`, 'info');
      ctx.bus.fire('projectContentDone', pj);
    }
  } else if (pj.status === 'debug') {
    for (const { p, w } of crew) pj.bugs = Math.max(0, pj.bugs - w * pr.debugPerPointK * (0.5 + p.skill / 100));
  }
}

// --- Sözleşmeler
export function genContracts(ctx) {
  const { state, pack, rng } = ctx;
  const c = pack.contracts;
  const h = H(ctx);
  state.contractOffers = Array.from({ length: c.offers }, () => {
    const need = Math.round(h * c.pointsMult * rng.range(0.6, 1.6) * (1 + state.reputation / 30));
    const weeks = rng.int(c.weeksMin, c.weeksMax);
    const reward = Math.round(need * c.rewardPerPoint * Math.sqrt(inflation(ctx) * 40 / h) * rng.range(0.8, 1.3));
    return { id: state.nextId++, client: rng.pick(c.clients), job: rng.pick(c.jobs), need, weeks, reward };
  });
}

export function acceptContract(ctx, id) {
  const { state } = ctx;
  if (state.contract) return { ok: false, msg: 'Zaten bir sözleşme sürüyor.' };
  const o = state.contractOffers.find((x) => x.id === id);
  if (!o) return { ok: false, msg: 'Teklif yok.' };
  state.contract = { ...o, progress: 0, deadline: state.week + o.weeks };
  state.contractOffers = state.contractOffers.filter((x) => x.id !== id);
  ctx.bus.fire('contractStarted', state.contract);
  if (!state.staff.some((p) => p.assign === 'sozlesme')) ctx.news('📝 Sözleşmeye kimse atanmadı. Personel panelinden birini "sözleşme"ye ata.', 'warn');
  return { ok: true };
}

export function weeklyContract(ctx) {
  const { state, pack, ledger } = ctx;
  const c = state.contract;
  if (!c) return;
  for (const { w } of weeklyOutput(ctx, (p) => p.assign === 'sozlesme')) c.progress += w;
  if (c.progress >= c.need) {
    ledger.post('sozlesme', c.reward, `${c.client}: ${c.job}`);
    state.reputation += pack.contracts.repGain;
    ctx.news(`✅ Sözleşme teslim: ${c.client} (${c.job}).`, 'good');
    ctx.bus.fire('contractFinished', c);
    state.contract = null;
  } else if (state.week >= c.deadline) {
    ledger.post('sozlesme', -Math.round(c.reward * pack.contracts.penaltyShare), `${c.client} gecikme cezası`);
    state.reputation = Math.max(0, state.reputation - 2);
    ctx.news(`⛔ ${c.client} sözleşmesi gecikti. Ceza kesildi, itibar düştü.`, 'bad');
    state.contract = null;
  }
}

// --- Araştırma
export function researchInfo(ctx, item) {
  if (item.engine) {
    const f = featureStats(ctx, item.id);
    return { rp: f.rp, cost: f.cost, weeks: f.weeks };
  }
  return { rp: item.rp, cost: Math.round(item.cost * inflation(ctx) ** 0.5), weeks: item.weeks };
}
export function researchAvailable(ctx) {
  const y = tableYear(ctx);
  const done = ctx.state.research.done;
  return ctx.pack.research.filter((r) => !done[r.id] && y >= r.year && (!r.requires || done[r.requires]));
}
export function startResearch(ctx, id) {
  const { state, pack, ledger } = ctx;
  if (state.research.current) return { ok: false, msg: 'Zaten bir araştırma sürüyor.' };
  const item = researchAvailable(ctx).find((r) => r.id === id);
  if (!item) return { ok: false, msg: 'Araştırılamaz.' };
  const info = researchInfo(ctx, item);
  if (state.research.rp < info.rp) return { ok: false, msg: `Yetersiz araştırma puanı (${info.rp} gerekli).` };
  state.research.rp -= info.rp;
  ledger.post('arastirma', -info.cost, item.name);
  state.research.current = { id, weeksLeft: info.weeks };
  ctx.bus.fire('researchStarted', item);
  return { ok: true };
}
export function weeklyResearch(ctx) {
  const { state, pack } = ctx;
  const pr = pack.production;
  for (const { p, w } of weeklyOutput(ctx, () => true)) state.research.rp += w * (pr.rpShare + (p.assign === 'arastirma' ? pr.researchRoomRp : 0));
  const cur = state.research.current;
  if (cur && --cur.weeksLeft <= 0) {
    state.research.done[cur.id] = state.week;
    const item = pack.research.find((r) => r.id === cur.id);
    ctx.news(`🔬 Araştırma bitti: ${item.name}`, 'good');
    ctx.bus.fire('researchCompleted', item);
    state.research.current = null;
  }
  const job = state.engineJob;
  if (job && --job.weeksLeft <= 0) {
    state.engines.push({ id: state.nextId++, name: job.name, features: job.features, builtYear: tableYear(ctx), licensed: false });
    ctx.news(`⚙️ Motor hazır: ${job.name}`, 'good');
    ctx.bus.fire('engineFinished', job);
    state.engineJob = null;
  }
}

// --- Motor
export function buildEngine(ctx, name, features) {
  const { state, pack, ledger } = ctx;
  if (!state.research.done.motor_ozel) return { ok: false, msg: 'Önce "Kendi motorunu yap" araştırmasını bitir.' };
  if (state.engineJob) return { ok: false, msg: 'Zaten bir motor yapılıyor.' };
  const fs = features.filter((f) => state.research.done[f]);
  if (!fs.length) return { ok: false, msg: 'En az bir araştırılmış özellik seç.' };
  const cost = fs.reduce((s, f) => s + featureStats(ctx, f).engineCost, 0);
  ledger.post('motor', -cost, `Motor: ${name}`);
  state.engineJob = { name, features: fs, weeksLeft: pack.engine.buildWeeksBase + pack.engine.buildWeeksPerFeature * fs.length };
  ctx.bus.fire('engineStarted', state.engineJob);
  return { ok: true };
}
