// Üretim: oyun projesi (3 faz × 3 görev), uzman odalar, QA, hata ayıklama, dış kaynak, sözleşme, araştırma, motor.
import { clamp } from '../kernel.js';
import { H, inflation, tableYear, featureStats, engineFactor, traitOf, platformById, careerOf } from '../models.js';
import { weeklyOutput } from './staff.js';

// --- Proje
export function newProject(ctx, o) {
  const { state, pack } = ctx;
  const size = pack.sizes.find((s) => s.id === o.size);
  return {
    id: state.nextId++, name: o.name, genre: o.genre, sub: o.sub || null, topic: o.topic, audience: o.audience,
    platforms: o.platforms, size: o.size, engineId: o.engineId ?? null, sequelOf: o.sequelOf ?? null,
    alloc: o.alloc || pack.genres.find((g) => g.id === o.genre).hint.map((v) => Math.max(20, v)),
    week: 0, totalWeeks: size.weeks, phase: 0, status: 'dev',
    points: { oyn: 0, gfx: 0, ses: 0, tek: 0 }, bugs: 0, hype: 0, startedWeek: state.week, mmo: !!size.mmo, outsourced: 0,
  };
}

export function projectCost(ctx, o) {
  const size = ctx.pack.sizes.find((s) => s.id === o.size);
  let cost = 0;
  for (const id of o.platforms) {
    const p = platformById(ctx, id);
    if (p) cost += p.licence + p.devCost * size.devCost;
  }
  return Math.round(cost);
}

const devRoom = (mode) => (r) => r.type === 'gelistirme' && r.mode !== mode;

export function weeklyProject(ctx) {
  const { state, pack } = ctx;
  const pj = state.project;
  if (!pj) return;
  const pr = pack.production, rm = pack.rooms;
  const crew = weeklyOutput(ctx, devRoom('sozlesme'));
  const bugK = (p) => pr.bugPerPoint * traitOf(ctx, p, 'bugs') * (state.crunch ? pr.crunchBugMult : 1) * clamp(1.3 - p.skill / 100, 0.3, 1.3);
  const debugRate = (p, w) => w * pr.debugPerPointK * (0.5 + p.skill / 100) * careerOf(ctx, p).debug;
  if (pj.status === 'dev') {
    const g = pack.genres.find((x) => x.id === pj.genre);
    pj.phase = Math.min(2, Math.floor(pj.week / (pj.totalWeeks / 3)));
    const ids = pack.missions.map((m, i) => i).filter((i) => pack.missions[i].phase === pj.phase);
    const sum = ids.reduce((s, i) => s + pj.alloc[i], 0) || 1;
    const eng = engineFactor(ctx, state.engines.find((e) => e.id === pj.engineId));
    for (const { p, w } of crew) {
      const c = careerOf(ctx, p);
      for (const i of ids) {
        const m = pack.missions[i];
        let pts = w * (pj.alloc[i] / sum) * (pr.missionFloor + (1 - pr.missionFloor) * g.mission[i]) * c.aff[m.disc];
        if (m.disc === 'tek') pts *= eng;
        pj.points[m.disc] += pts;
        pj.bugs += pts * bugK(p);
      }
    }
    // Uzman odalar: tüm proje boyunca yalnızca kendi disiplinine, hızlı (MGT2).
    for (const { p, w, room } of weeklyOutput(ctx, (r) => r.type === 'grafik' || r.type === 'ses')) {
      const d = room.type === 'grafik' ? 'gfx' : 'ses';
      const pts = w * rm.expertMult * careerOf(ctx, p).aff[d];
      pj.points[d] += pts;
      pj.bugs += pts * bugK(p) * 0.5;
    }
    if (crew.length) pj.week++;
    pj.hype = Math.max(0, pj.hype - pack.hype.decayDev);
    if (pj.week >= pj.totalWeeks) {
      pj.status = 'debug';
      ctx.news(`🐞 "${pj.name}" içerik olarak bitti. Hata ayıklama başladı; istediğin an yayınlayabilirsin.`, 'info');
      ctx.bus.fire('projectContentDone', pj);
    }
  } else {
    for (const { p, w } of crew) pj.bugs = Math.max(0, pj.bugs - debugRate(p, w));
  }
  // QA: geliştirme ve ayıklama boyunca hata temizler, oynanışı cilalar.
  for (const { p, w } of weeklyOutput(ctx, (r) => r.type === 'qa')) {
    pj.bugs = Math.max(0, pj.bugs - debugRate(p, w) * rm.qaBugK);
    pj.points.oyn += w * rm.qaPolish;
  }
}

// --- Dış kaynak (GDS outsourcing): tek seferlik ücretle anında puan.
export function outsourceRow(ctx, i) {
  const o = ctx.pack.outsource;
  const [name, feeK, disc, office] = o.rows[i];
  const fee = Math.round(feeK * o.feeScale * inflation(ctx) ** 0.5);
  const q = Math.pow(feeK / o.rows[0][1], o.qualityExp);
  return { i, name, disc, office, fee, points: Math.round(q * H(ctx) * o.pointsPerQuality) };
}
export function outsource(ctx, i) {
  const { state, ledger, pack } = ctx;
  const pj = state.project;
  if (!pj || pj.status !== 'dev') return { ok: false, msg: 'Dış kaynak yalnızca geliştirme sırasında işe yarar.' };
  const r = outsourceRow(ctx, i);
  if (state.office.tier < r.office) return { ok: false, msg: `${r.name} için daha büyük ofis gerekli.` };
  if (state.cash - r.fee < 0) return { ok: false, msg: `${r.name} ${r.fee.toLocaleString('tr-TR')} $ istiyor.` };
  ledger.post('dis_kaynak', -r.fee, r.name);
  pj.points[r.disc] += r.points;
  pj.bugs += r.points * pack.outsource.bugShare;
  pj.outsourced++;
  ctx.news(`📦 ${r.name} teslim etti: +${r.points} puan.`, 'info');
  return { ok: true };
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
  if (state.project && !state.rooms.some((r) => r.type === 'gelistirme' && r.mode === 'sozlesme'))
    ctx.news('📝 Proje sürerken geliştirme odaları oyuna öncelik verir. Bir odayı "Yalnızca sözleşme"ye al.', 'warn');
  return { ok: true };
}

export function weeklyContract(ctx) {
  const { state, pack, ledger } = ctx;
  const c = state.contract;
  if (!c) return;
  const filter = (r) => r.type === 'gelistirme' && (r.mode === 'sozlesme' || (r.mode === 'otomatik' && !state.project));
  for (const { w } of weeklyOutput(ctx, filter)) c.progress += w;
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
  const { state, ledger } = ctx;
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
  for (const { w, room } of weeklyOutput(ctx, () => true)) state.research.rp += w * (pr.rpShare + (room.type === 'arastirma' ? pr.researchRoomRp : 0));
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
