// Üretim: oyun projesi (3 faz × 3 görev), uzman odalar, QA, hata ayıklama, dış kaynak, sözleşme, araştırma, motor.
import { clamp, lerpTable } from '../kernel.js';
import { H, inflation, tableYear, featureStats, engineFactor, traitOf, platformById, careerOf, skillK, DISC_SKILL, homePay, homeImport } from '../models.js';
import { weeklyOutput } from './staff.js';
import { consumeHypeBank } from './charts.js';
import * as Regions from './regions.js';
import * as Genres from './genres.js';

// --- Proje (MGT: her geliştirme odası kendi oyununu yapar; uzman odalar ve QA tüm projelere bölünür)
export function newProject(ctx, o) {
  const { state, pack } = ctx;
  const size = pack.sizes.find((s) => s.id === o.size);
  return {
    id: state.nextId++, name: o.name, genre: o.genre, sub: o.sub || null, topic: o.topic, audience: o.audience,
    platforms: o.platforms, size: o.size, engineId: o.engineId ?? null, sequelOf: o.sequelOf ?? null, roomId: o.roomId ?? null,
    kind: o.kind || 'oyun', baseGameId: o.baseGameId ?? null, regions: baseRegions(ctx), loc: {},
    alloc: o.alloc || pack.genres.find((g) => g.id === o.genre).hint.map((v) => Math.max(20, v)),
    week: 0, totalWeeks: Math.round(size.weeks * (o.kind === 'ek' ? pack.post.expansionWeeks : 1)), phase: 0, status: 'dev',
    points: { oyn: 0, gfx: 0, ses: 0, tek: 0 }, bugs: 0, hype: o.kind === 'ek' ? 0 : consumeHypeBank(state), startedWeek: state.week, mmo: !!size.mmo && o.kind !== 'ek', outsourced: 0,
  };
}

// --- Yerelleştirme: İngilizce sürüm (K. Amerika + Avrupa) her zaman var; diğer bölgeler araştırma + bedel ister.
export const baseRegions = (ctx) => Regions.IDS.filter((r) => Regions.isNative(ctx, r)); // stüdyonun dilini konuşan bölgeler
// Yerelleştirme bölge sistemine taşındı (Konu C): seviye 1 çeviri, 2 tam yerelleştirme, 3 kültürelleştirme.
export function regionStatus(ctx, rid) {
  if (Regions.isNative(ctx, rid)) return { ok: true, free: true };
  const need = rid === 'jp' ? 'yerel_jp' : ['latam', 'asya'].includes(rid) ? 'yerel_dunya' : null;
  if (need && !ctx.state.research.done[need]) return { ok: false, why: 'araştır' };
  return { ok: true };
}
export const locCost = (ctx, rid, sizeId, genre = 'aksiyon', lv = 1) => Regions.locCostOf(ctx, rid, { size: sizeId, genre, loc: {} }, lv);
export const localize = (ctx, pid, rid, lv = 1) => Regions.localize(ctx, pid, rid, lv, false);

export function projectCost(ctx, o) {
  const size = ctx.pack.sizes.find((s) => s.id === o.size);
  let cost = 0;
  for (const id of o.platforms) {
    const p = platformById(ctx, id);
    if (p) cost += p.licence + p.devCost * size.devCost;
  }
  return Math.round(cost * (o.kind === 'ek' ? ctx.pack.post.expansionCost : 1) * homeImport(ctx)); // ithal geliştirme kiti (Konu C)
}

export const projectOfRoom = (state, room) => state.projects.find((p) => p.roomId === room.id) || null;
export const freeDevRooms = (ctx) => ctx.state.rooms.filter((r) => r.type === 'gelistirme' && r.mode !== 'sozlesme' && r.mode !== 'destek' && !projectOfRoom(ctx.state, r));
// Projede çalışan odalar: kendi odası + ona destek veren odalar.
export const worksOn = (pj) => (r) => r.type === 'gelistirme' && ((r.id === pj.roomId && r.mode !== 'sozlesme' && r.mode !== 'destek') || (r.mode === 'destek' && r.target === pj.id));

export function weeklyProject(ctx) {
  const { state, pack } = ctx;
  if (!state.projects.length) return;
  const pr = pack.production, rm = pack.rooms;
  const bugK = (p) => pr.bugPerPoint * traitOf(ctx, p, 'bugs') * (state.crunch ? pr.crunchBugMult : 1) * clamp(1.3 - p.skill / 100, 0.3, 1.3);
  const sun = Regions.sunK(ctx); // iki bölgede ekip: güneşi takip eden hata ayıklama
  const debugRate = (p, w) => w * pr.debugPerPointK * (0.5 + p.skill / 100) * careerOf(ctx, p).debug * sun;
  // Odası sökülmüş projeye boş bir geliştirme odası bul.
  for (const pj of state.projects) if (!state.rooms.some((r) => r.id === pj.roomId)) pj.roomId = freeDevRooms(ctx)[0]?.id ?? null;
  for (const r of state.rooms) if (r.mode === 'destek' && !state.projects.some((p) => p.id === r.target)) { r.mode = 'otomatik'; r.target = null; }
  const inDev = state.projects.filter((p) => p.status === 'dev');
  // Destek odası hedefi (MGT): atanmış projeye ya da (atanmamışsa) uygun tüm projelere eşit bölünür.
  for (const r of state.rooms) if (r.target && r.type !== 'gelistirme' && !state.projects.some((p) => p.id === r.target)) r.target = null;
  const share = (room, pj, pool) => (room.target ? (room.target === pj.id ? 1 : 0) : pool.includes(pj) ? 1 / pool.length : 0);
  const wage = (p, k = 1) => (p.salary || 0) / 4 * k; // aylık maaşın haftalık payı → proje maliyeti (MGT satış paneli)
  for (const pj of state.projects) {
    const crew = weeklyOutput(ctx, worksOn(pj));
    pj.cost = (pj.cost || 0) + crew.reduce((a, x) => a + wage(x.p), 0);
    for (const { p, room } of weeklyOutput(ctx, (r) => ['grafik', 'ses', 'qa', 'pazarlama'].includes(r.type))) pj.cost += wage(p, share(room, pj, ['grafik', 'ses'].includes(room.type) ? inDev : state.projects));
    if (pj.status === 'dev') {
      const g = pack.genres.find((x) => x.id === pj.genre);
      pj.phase = Math.min(2, Math.floor(pj.week / (pj.totalWeeks / 3)));
      const ids = pack.missions.map((m, i) => i).filter((i) => pack.missions[i].phase === pj.phase);
      const sum = ids.reduce((s, i) => s + pj.alloc[i], 0) || 1;
      const eng = engineFactor(ctx, state.engines.find((e) => e.id === pj.engineId));
      const spd = Genres.speedK(ctx, pj), gb = Genres.bugK(ctx, pj); // Konu D: stüdyonun tür ustalığı
      for (const { p, w } of crew) {
        const c = careerOf(ctx, p), aff = Genres.staffK(ctx, p, pj) * spd; // çalışanın tür yatkınlığı
        for (const i of ids) {
          const m = pack.missions[i];
          let pts = w * aff * (pj.alloc[i] / sum) * (pr.missionFloor + (1 - pr.missionFloor) * g.mission[i]) * c.aff[m.disc] * skillK(ctx, p, DISC_SKILL[m.disc]) * Genres.missionK(ctx, m);
          if (m.disc === 'tek') pts *= eng;
          pj.points[m.disc] += pts;
          pj.bugs += pts * bugK(p) * gb;
        }
      }
      // Uzman odalar: geliştirmedeki projelere eşit bölünür, yalnızca kendi disiplinine.
      for (const { p, w, room } of weeklyOutput(ctx, (r) => r.type === 'grafik' || r.type === 'ses')) {
        const d = room.type === 'grafik' ? 'gfx' : 'ses';
        const k = share(room, pj, inDev);
        if (!k) continue;
        const pts = w * rm.expertMult * careerOf(ctx, p).aff[d] * k * skillK(ctx, p, DISC_SKILL[d]);
        pj.points[d] += pts;
        pj.bugs += pts * bugK(p) * 0.5;
      }
      // Pazarlama odası: her hafta hype
      for (const { p, w, room } of weeklyOutput(ctx, (r) => r.type === 'pazarlama')) pj.hype = Math.min(pack.hype.max, pj.hype + w * rm.marketingHypeK * share(room, pj, state.projects) * skillK(ctx, p, 'pazar'));
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
    // QA: tüm projelere bölünür; hata temizler, oynanışı cilalar.
    for (const { p, w, room } of weeklyOutput(ctx, (r) => r.type === 'qa')) {
      const k = share(room, pj, state.projects);
      pj.bugs = Math.max(0, pj.bugs - debugRate(p, w) * rm.qaBugK * k * skillK(ctx, p, 'test'));
      pj.points.oyn += w * rm.qaPolish * k;
    }
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
export function outsource(ctx, pid, i) {
  const { state, ledger, pack } = ctx;
  const pj = state.projects.find((p) => p.id === pid);
  if (!pj || pj.status !== 'dev') return { ok: false, msg: 'Dış kaynak yalnızca geliştirme sırasında işe yarar.' };
  const r = outsourceRow(ctx, i);
  if (state.office.tier < r.office) return { ok: false, msg: `${r.name} için daha büyük ofis gerekli.` };
  if (state.cash - r.fee < 0) return { ok: false, msg: `${r.name} ${r.fee.toLocaleString('tr-TR')} $ istiyor.` };
  ledger.post('dis_kaynak', -r.fee, r.name);
  pj.cost = (pj.cost || 0) + r.fee;
  pj.points[r.disc] += r.points;
  pj.bugs += r.points * pack.outsource.bugShare;
  pj.outsourced++;
  ctx.news(`📦 ${r.name} teslim etti: +${r.points} puan (${pj.name}).`, 'info');
  return { ok: true };
}

// --- Sözleşmeler (GDS yapısı): 1–2 disiplin şartı, zorluk kademesi, iş yükü stüdyo kapasitesiyle ölçeklenir.
const DISCS = ['oyn', 'gfx', 'ses', 'tek'];
const contractRooms = (state) => (r) => r.type === 'gelistirme' && (r.mode === 'sozlesme' || (r.mode === 'otomatik' && !projectOfRoom(state, r)));

// Geliştirme odalarının haftalık toplam üretimi (sözleşme yükünü ölçeklemek için).
export function devCapacity(ctx) {
  return weeklyOutput(ctx, (r) => r.type === 'gelistirme').reduce((s, x) => s + x.w, 0);
}

export function genContracts(ctx) {
  const { state, pack, rng } = ctx;
  const c = pack.contracts;
  const h = H(ctx);
  const cap = devCapacity(ctx);
  // Sözleşmeli işler yerel müşterilerden: ödeme ana bölgenin ücret düzeyine göre (Konu C)
  const perPoint = c.rewardPerPoint * Math.pow(inflation(ctx) * 40 / h, c.rewardExp ?? 0.5) * (c.lateK ? lerpTable(c.lateK, tableYear(ctx)) : 1) * Math.pow(homePay(ctx), 0.8);
  state.contractOffers = Array.from({ length: c.offers }, (_, i) => {
    const tier = c.tiers[i % c.tiers.length];
    const weeks = rng.int(c.weeksMin, c.weeksMax);
    const total = Math.max(cap, h * c.minLoadH) * weeks * tier.load * rng.range(0.9, 1.1);
    const discs = [...DISCS].sort(() => rng.next() - 0.5).slice(0, rng.chance(c.twoDiscChance) ? 2 : 1);
    const need = Object.fromEntries(discs.map((d) => [d, Math.round(total / discs.length)]));
    const reward = Math.round(total * perPoint * tier.pay * rng.range(0.9, 1.15));
    return { id: state.nextId++, client: rng.pick(c.clients), job: rng.pick(c.jobs), tier: tier.id, need, weeks, reward };
  });
}

// Eski kayıtlardaki tek sayılı sözleşmeleri yeni biçime çevir.
function normalize(c) {
  if (typeof c.need === 'number') { c.need = { oyn: c.need }; c.progress = { oyn: c.progress || 0 }; c.tier ||= 'kolay'; }
  c.progress ||= Object.fromEntries(Object.keys(c.need).map((d) => [d, 0]));
  return c;
}
export const contractDone = (c) => Object.keys(c.need).every((d) => c.progress[d] >= c.need[d]);
export const contractShare = (c) => Object.keys(c.need).reduce((s, d) => s + Math.min(1, c.progress[d] / c.need[d]), 0) / Object.keys(c.need).length;

export function acceptContract(ctx, id) {
  const { state } = ctx;
  if (state.contract) return { ok: false, msg: 'Zaten bir sözleşme sürüyor.' };
  const o = state.contractOffers.find((x) => x.id === id);
  if (!o) return { ok: false, msg: 'Teklif yok.' };
  state.contract = normalize({ ...o, progress: null, deadline: state.week + o.weeks });
  state.contractOffers = state.contractOffers.filter((x) => x.id !== id);
  ctx.bus.fire('contractStarted', state.contract);
  if (!state.rooms.some((r) => r.type === 'gelistirme' && (r.mode === 'sozlesme' || !projectOfRoom(state, r))))
    ctx.news('📝 Tüm geliştirme odaları oyunla meşgul. Bir odayı "Yalnızca sözleşme"ye al, yoksa sözleşme ilerlemez.', 'warn');
  return { ok: true };
}

export function weeklyContract(ctx) {
  const { state, pack, ledger } = ctx;
  const c = state.contract;
  if (!c) return;
  normalize(c);
  const discs = Object.keys(c.need);
  for (const { p, w } of weeklyOutput(ctx, contractRooms(state))) {
    const aff = careerOf(ctx, p).aff;
    for (const d of discs) c.progress[d] += (w / discs.length) * aff[d];
  }
  const tier = pack.contracts.tiers.find((t) => t.id === c.tier) || pack.contracts.tiers[0];
  if (contractDone(c)) {
    ledger.post('sozlesme', c.reward, `${c.client}: ${c.job}`);
    state.reputation += tier.rep;
    state.research.rp += tier.rp * inflation(ctx) ** 0.5;
    ctx.news(`✅ Sözleşme teslim: ${c.client} (${c.job}). +${Math.round(tier.rp * inflation(ctx) ** 0.5)} RP`, 'good');
    ctx.bus.fire('contractFinished', c);
    state.contract = null;
  } else if (state.week >= c.deadline) {
    ledger.post('sozlesme', -Math.round(c.reward * pack.contracts.penaltyShare), `${c.client} gecikme cezası`);
    state.reputation = Math.max(0, state.reputation - tier.repLoss);
    ctx.news(`⛔ ${c.client} sözleşmesi yetişmedi (%${Math.round(contractShare(c) * 100)}). Ceza kesildi, itibar düştü.`, 'bad');
    ctx.bus.fire('contractFailed', c);
    state.contract = null;
  }
}

// --- Araştırma
export function researchInfo(ctx, item) {
  if (item.engine) {
    const f = featureStats(ctx, item.id);
    return { rp: f.rp, cost: f.cost, weeks: f.weeks };
  }
  const k = Genres.researchDiscount(ctx, item); // yakın türü bilen ucuza öğrenir (Konu D)
  return { rp: Math.round(item.rp * k), cost: Math.round(item.cost * k * inflation(ctx) ** 0.5), weeks: item.weeks };
}
export function researchAvailable(ctx) {
  const y = tableYear(ctx);
  const done = ctx.state.research.done;
  return ctx.pack.research.filter((r) => !done[r.id] && y >= r.year && (!r.requires || done[r.requires]) && !(r.genre && Genres.knows(ctx, r.genre)));
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
  const rk = Genres.researchK(ctx);
  for (const { p, w, room } of weeklyOutput(ctx, () => true)) state.research.rp += rk * w * (pr.rpShare + (room.type === 'arastirma' ? pr.researchRoomRp * skillK(ctx, p, 'arge') * traitOf(ctx, p, 'research') : 0));
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
