// Konu E: motor ve teknoloji sistemi. Teknoloji hattı (genel araştırmadan ayrı), kendi motor aileleri ve sürümleri,
// motor pazarı (peşin, yüzde, koltuk), ara yazılımlar, dışarıya lisans, motor olayları ve eski kayıt göçü.
import { clamp } from '../kernel.js';
import {
  tableYear, inflation, featureStats, featPts, engineScore, catExpected, licById, mwById, licOpen, licPay, licFeatures, mwFeatures,
  familyGames, familyLatest, engineOf,
} from '../models.js';
import { removePerson } from './staff.js';
import { FEATURES, FEAT, BASE, CATS, LEGACY_FEATURES, LICENSED, MIDDLEWARE, SUB_NEEDS, GENRE_MUST, GENRE_WANTS } from '../data/engines.js';

export { FEATURES, FEAT, BASE, CATS, LICENSED, MIDDLEWARE, SUB_NEEDS, GENRE_MUST, GENRE_WANTS };
const P = (ctx) => ctx.pack.engine;

export function ensure(state) {
  state.tech ||= { done: {}, current: null };
  state.engines ||= [];
  state.usedFeatures ||= {};
  state.licensees ||= {}; // motor id → [stüdyo adı]
  state.engineFlags ||= {};
}
export function initState(state) {
  ensure(state);
  state.engineV = 1;
  for (const f of BASE) state.tech.done[f] = 0;
}
// Eski kayıt: 15 eski motor özelliği yeni ağaçtaki karşılığına taşınır; motorlar korunur.
export function migrate(state) {
  ensure(state);
  if (state.engineV) return;
  state.engineV = 1;
  for (const f of BASE) state.tech.done[f] ??= 0;
  const map = (id) => LEGACY_FEATURES[id] || (FEAT[id] ? id : null);
  for (const [id, w] of Object.entries(state.research?.done || {})) {
    const n = LEGACY_FEATURES[id];
    if (n) { state.tech.done[n] ??= w; delete state.research.done[id]; }
  }
  const cur = state.research?.current;
  if (cur && LEGACY_FEATURES[cur.id]) { state.tech.current = { id: LEGACY_FEATURES[cur.id], weeksLeft: cur.weeksLeft }; state.research.current = null; }
  // Eski motorlar tek bir aile olur (sürüm sırası yapım sırası)
  const fam = state.engines[0]?.id;
  state.engines.forEach((e, i) => {
    e.features = [...new Set(e.features.map(map).filter((f) => f && !FEAT[f].base))];
    e.family ??= fam; e.ver ??= i + 1;
  });
  if (state.engineJob) state.engineJob.features = [...new Set(state.engineJob.features.map(map).filter((f) => f && !FEAT[f].base))];
  const used = {};
  for (const id of Object.keys(state.usedFeatures)) { const n = map(id); if (n) used[n] = true; }
  state.usedFeatures = used;
}

// ---------- Teknoloji hattı: her kategori bir merdiven; önceki basamak gerekir.
const prevOf = (f) => { const list = FEATURES.filter((x) => x.cat === f.cat); return list[list.indexOf(f) - 1] || null; };
export const techDone = (ctx, fid) => ctx.state.tech.done[fid] != null;
export const techOpen = (ctx) => !!ctx.state.research.done.motor_ozel;
export function techState(ctx, fid) {
  const f = FEAT[fid], y = tableYear(ctx), st = ctx.state.tech;
  if (st.done[fid] != null) return 'done';
  if (st.current?.id === fid) return 'running';
  if (y < f.year) return 'future';
  const pv = prevOf(f);
  if (pv && st.done[pv.id] == null) return 'locked';
  return 'ready';
}
export const techAvailable = (ctx) => (techOpen(ctx) ? FEATURES.filter((f) => techState(ctx, f.id) === 'ready') : []);
export function startTech(ctx, fid) {
  const { state, ledger } = ctx;
  if (!techOpen(ctx)) return { ok: false, msg: 'Önce "Kendi motorunu yap" araştırmasını bitir.' };
  if (state.tech.current) return { ok: false, msg: 'Teknoloji hattında zaten bir çalışma var.' };
  if (techState(ctx, fid) !== 'ready') return { ok: false, msg: 'Bu basamak şu an araştırılamaz.' };
  const info = featureStats(ctx, fid);
  if (state.research.rp < info.rp) return { ok: false, msg: `Yetersiz araştırma puanı (${info.rp} gerekli).` };
  state.research.rp -= info.rp;
  ledger.post('arastirma', -info.cost, `Teknoloji: ${FEAT[fid].name}`);
  state.tech.current = { id: fid, weeksLeft: info.weeks };
  ctx.bus.fire('techStarted', FEAT[fid]);
  return { ok: true };
}

// ---------- Kendi motorun: aile ve sürüm
export const families = (ctx) => {
  const out = new Map();
  for (const e of ctx.state.engines) { const k = e.family ?? e.id; if (!out.has(k) || out.get(k).ver < e.ver) out.set(k, e); }
  return [...out.values()];
};
export const latestOf = (ctx, family) => families(ctx).find((e) => (e.family ?? e.id) === family) || null;
export function buildCost(ctx, features, fromId = null) {
  const prev = fromId != null ? ctx.state.engines.find((e) => e.id === fromId) : null;
  const carried = new Set(prev?.features || []);
  const fs = [...new Set(features)].filter((f) => FEAT[f] && !FEAT[f].base);
  const cost = fs.reduce((s, f) => s + featureStats(ctx, f).engineCost * (carried.has(f) ? P(ctx).carryK : 1), 0);
  const fresh = fs.filter((f) => !carried.has(f)).length;
  return { cost: Math.round(cost), weeks: P(ctx).buildWeeksBase + P(ctx).buildWeeksPerFeature * fresh, fresh, fs };
}
export function buildEngine(ctx, name, features, fromId = null) {
  const { state, ledger } = ctx;
  if (!state.research.done.motor_ozel) return { ok: false, msg: 'Önce "Kendi motorunu yap" araştırmasını bitir.' };
  if (state.engineJob) return { ok: false, msg: 'Zaten bir motor yapılıyor.' };
  const ok = features.filter((f) => FEAT[f] && !FEAT[f].base && techDone(ctx, f));
  if (!ok.length) return { ok: false, msg: 'En az bir araştırılmış (temel dışı) özellik seç.' };
  const prev = fromId != null ? state.engines.find((e) => e.id === fromId) : null;
  const b = buildCost(ctx, ok, prev?.id ?? null);
  const family = prev ? prev.family ?? prev.id : null;
  const ver = prev ? Math.max(...state.engines.filter((e) => (e.family ?? e.id) === family).map((e) => e.ver || 1)) + 1 : 1;
  const base = prev ? String(prev.name).replace(/\s+\d+$/, '') : (String(name || '').trim() || 'Motor');
  const nm = prev ? `${base} ${ver}` : base;
  ledger.post('motor', -b.cost, `Motor: ${nm}`);
  state.engineJob = { name: nm, features: b.fs, weeksLeft: b.weeks, family, ver };
  ctx.bus.fire('engineStarted', state.engineJob);
  return { ok: true, cost: b.cost, weeks: b.weeks };
}
export function setLicensed(ctx, id) {
  const { state } = ctx;
  if (!state.research.done.motor_lisans) return { ok: false, msg: 'Motor lisanslama araştırması gerekli.' };
  const e = state.engines.find((x) => x.id === id);
  if (!e) return { ok: false };
  e.licensed = !e.licensed;
  if (!e.licensed) delete state.licensees[e.id];
  return { ok: true };
}

// ---------- Hafta: teknoloji hattı ve motor inşası
export function weekly(ctx) {
  const { state } = ctx;
  ensure(state);
  const cur = state.tech.current;
  if (cur && --cur.weeksLeft <= 0) {
    state.tech.done[cur.id] = state.week;
    state.tech.current = null;
    const f = FEAT[cur.id];
    ctx.news(`🔧 Teknoloji hazır: ${f.name}. Motoruna eklemek için yeni sürüm yap.`, 'good');
    ctx.bus.fire('techCompleted', f);
  }
  const job = state.engineJob;
  if (job && --job.weeksLeft <= 0) {
    const id = state.nextId++;
    state.engines.push({ id, name: job.name, family: job.family ?? id, ver: job.ver || 1, features: job.features, builtYear: tableYear(ctx), licensed: false });
    ctx.news(`⚙️ Motor hazır: ${job.name}`, 'good');
    ctx.bus.fire('engineFinished', job);
    state.engineJob = null;
  }
}

// ---------- Motor pazarı: projeye bağlanan lisans ve ara yazılım
export const licAvailable = (ctx, y = tableYear(ctx)) => LICENSED.filter((L) => licOpen(L, y));
export const mwAvailable = (ctx, y = tableYear(ctx)) => MIDDLEWARE.filter((m) => y >= m.from && y < m.to);
export function licFits(L, o) { return !L.subs || (o.sub && L.subs.includes(o.sub)); }
// Proje başında ödenecek motor bedeli (lisans peşini + ara yazılımlar)
export function startFees(ctx, o, y = tableYear(ctx)) {
  let fee = 0;
  const L = o.engineId ? null : licById(o.engineLic);
  if (L) fee += licPay(L, y).fee || 0;
  for (const id of o.mw || []) fee += mwById(id)?.fee || 0;
  return fee;
}
export function checkStart(ctx, o, y = tableYear(ctx)) {
  if (o.engineId != null && o.engineId !== '' && !ctx.state.engines.some((e) => e.id === +o.engineId)) return 'Bu motor yok.';
  if (!o.engineId && o.engineLic) {
    const L = licById(o.engineLic);
    if (!L || !licOpen(L, y)) return 'Bu motor artık lisanslanmıyor.';
    if (!licFits(L, o)) return `${L.name} yalnız ${L.subs.length} alt türde kullanılabilir.`;
  }
  for (const id of o.mw || []) { const m = mwById(id); if (!m || y < m.from || y >= m.to) return 'Ara yazılım piyasada yok.'; }
  return null;
}
// Proje başlarken motor bilgilerini projeye yazar ve peşin bedeli keser
export function attach(ctx, pj, o, noFee = false) {
  const y = tableYear(ctx);
  pj.engineId = o.engineId != null && o.engineId !== '' ? +o.engineId : null;
  pj.engineLic = !pj.engineId && o.engineLic ? o.engineLic : null;
  pj.mw = (o.mw || []).filter((id) => mwById(id));
  pj.features = Array.isArray(o.features) ? o.features.filter((f) => FEAT[f]) : null;
  const L = licById(pj.engineLic);
  if (L) {
    const p = licPay(L, y);
    pj.lic = { id: L.id, royalty: p.royalty || 0, threshold: p.threshold || 0, seat: p.seat || 0 };
    if (p.fee && !noFee) ctx.ledger.post('motor_lisans', -p.fee, `${L.name}: ${pj.name}`);
  }
  if (!noFee) for (const id of pj.mw) { const m = mwById(id); if (m.fee) ctx.ledger.post('motor_lisans', -m.fee, `${m.name}: ${pj.name}`); }
}
// Satıştan yüzde: haftalık gelirden kesilir. Gerçeksiz 2022'den sonra ilk 1 milyonu bedava bırakır; Birlik 2023'te kurulum ücreti ister.
export function royaltyCut(ctx, g, rev) {
  if (!g.lic || rev <= 0) return 0;
  let rate = g.lic.royalty || 0;
  const y = tableYear(ctx);
  if (g.lic.id === 'birlik' && y >= 2023 && y < 2024) rate += P(ctx).birlikFee;
  if (!rate) return 0;
  const before = g.revenue || 0, th = g.lic.threshold || 0;
  const base = Math.max(0, before + rev - Math.max(th, before));
  return Math.round(base * rate);
}

// ---------- Ay: koltuk ücreti, dışarıya lisans, motor ekibi
const rivalNames = (ctx) => (ctx.state.rivals || []).filter((r) => !r.acquired && !r.hw).map((r) => r.name);
export function licenseeTarget(ctx, e) {
  const exp = catExpected(ctx, null);
  const ratio = exp > 0 ? engineScore(ctx, e) / exp : 1;
  if (ratio < P(ctx).licenceMinRatio) return 0;
  return clamp(Math.round((ratio - P(ctx).licenceMinRatio) * 8 + (ctx.state.reputation || 0) / 40 + 1), 0, P(ctx).licenseeMax);
}
export function monthly(ctx) {
  const { state, ledger, rng } = ctx;
  ensure(state);
  // Koltuk ücreti: koltukla lisanslanmış motorla süren proje varsa kadro başına
  const seat = state.projects.filter((p) => p.lic?.seat).reduce((m, p) => Math.max(m, p.lic.seat), 0);
  if (seat) ledger.post('motor_lisans', -seat * state.staff.length, 'Koltuk ücreti');
  // Dışarıya lisans: lisansçı sayısı motorun kalitesine ve itibarına göre
  for (const e of state.engines) {
    if (!e.licensed) continue;
    const list = (state.licensees[e.id] ||= []);
    const target = licenseeTarget(ctx, e);
    if (list.length < target) {
      const pool = rivalNames(ctx).filter((n) => !Object.values(state.licensees).some((l) => l.includes(n)));
      if (pool.length) { const n = rng.pick(pool); list.push(n); ctx.news(`🤝 ${n} yeni oyununu senin motorunla (${e.name}) yapıyor.`, 'good'); }
    } else if (list.length > target) {
      const n = list.pop(); ctx.news(`👋 ${n} ${e.name} lisansını bıraktı; motor eskiyor.`, 'warn');
    }
    if (list.length) ledger.post('lisans', Math.round(list.length * engineScore(ctx, e) * P(ctx).licenceIncomePerPoint * inflation(ctx) ** 0.5), `${e.name} · ${list.length} lisansçı`);
  }
  // Motor ekibi istifası: 8 yıl yeni sürüm yapılmayan motorla oyun yapılıyorsa
  const y = tableYear(ctx);
  for (const pj of state.projects) {
    const e = pj.engineId != null && state.engines.find((x) => x.id === pj.engineId);
    if (!e) continue;
    const fam = e.family ?? e.id, key = `quit${fam}`;
    if (y - familyLatest(ctx, fam) <= P(ctx).quitYears || state.engineFlags[key]) continue;
    state.engineFlags[key] = true;
    const p = rng.pick(state.staff.filter((x) => !x.founder));
    if (p) { removePerson(ctx, p, 'olay'); ctx.news(`🚪 ${p.name} istifa etti: "${e.name}" kodunu benden sonra kimse anlamayacak.`, 'bad'); }
  }
}
// Yeni sürüm aileyi tazeler: istifa uyarısı sıfırlanır
function onEngine(ctx, job) { if (job.family != null) delete ctx.state.engineFlags[`quit${job.family}`]; }

// ---------- Rakip: lisansçı rakibin notu +1; senin motorunla yılın oyunu
export const licenseeOf = (ctx, studio) => Object.entries(ctx.state.licensees || {}).find(([, l]) => l.includes(studio))?.[0] ?? null;
export function rivalBonus(ctx, studio) { return licenseeOf(ctx, studio) != null ? P(ctx).rivalBonus : 0; }
export function rivalGoty(ctx, studio, name) {
  const eid = licenseeOf(ctx, studio);
  if (eid == null) return;
  const e = ctx.state.engines.find((x) => x.id === +eid);
  ctx.state.reputation = (ctx.state.reputation || 0) + P(ctx).gotyRep;
  ctx.state.fans += Math.round(P(ctx).gotyFans * inflation(ctx) ** 0.3);
  ctx.news(`🏆 ${studio} "${name}" ile yılın oyununu aldı, hem de senin motorunla (${e?.name || 'motorun'}). Motorun yine konuşuluyor.`, 'good');
}

// ---------- Yıl: motor pazarı haberleri
function yearly(ctx) {
  const { state } = ctx, y = Math.floor(tableYear(ctx));
  const once = (k, fn) => { if (!state.engineFlags[k]) { state.engineFlags[k] = true; fn(); } };
  const usedLic = (id) => state.games.some((g) => g.lic?.id === id) || state.projects.some((p) => p.engineLic === id);
  for (const L of LICENSED) {
    if (y === L.from) once(`born_${L.id}`, () => ctx.news(`🧰 Motor pazarında yeni: ${L.name}. "${L.joke}"`, 'info'));
    if (y === L.to && L.to < 2200) once(`gone_${L.id}`, () => ctx.news(L.id === 'cizim'
      ? '📰 Çizim Yazılımı dev bir yayıncı tarafından satın alındı. Yeni lisans verilmeyecek; süren projeler bitebilir. Başkasının motoruna bağlanmanın bedeli.'
      : `📰 ${L.name} artık lisanslanmıyor. Süren projeler bitebilir.`, usedLic(L.id) ? 'bad' : 'info'));
  }
  if (y === 2014) once('gercek14', () => ctx.news('📰 Gerçeksiz Motor artık peşin para istemiyor; satıştan %5 alıyor. Küçük stüdyolar için kapı açıldı.', 'good'));
  if (y === 2022) once('gercek22', () => ctx.news('📰 Gerçeksiz Motor her oyunun ilk 1 milyon dolarını yüzdesiz bırakıyor.', 'good'));
  if (y === 2023) once('birlik23', () => {
    ctx.news('📰 Birlik Motoru kurulum başına ücret istedi: bu yıl Birlik\'le yapılan oyunların gelirinden %3 ek kesilecek. Forumlar yanıyor.', 'bad');
    if (usedLic('birlik')) ctx.queue({ id: 'birlik23', title: 'Birlik kurulum ücreti', text: 'Birlik Motoru kurulum başına ücret istiyor. Ekip soruyor: "Bekleyiş Motoru\'na geçelim mi?"',
      choices: [{ label: 'Geçelim, bir daha olmasın', effects: { morale: 5 } }, { label: 'Bekleyip görelim', effects: {} }] });
  });
  if (y === 2024) once('birlik24', () => ctx.news('📰 Birlik kurulum ücretini geri aldı ve özür diledi. Kimse inanmadı.', 'info'));
  if (y >= 2016 && y % 3 === 1) once(`bekle${y}`, () => ctx.news(`📰 Bekleyiş Motoru büyüyor: açık kaynak topluluğu onu dönemin ${licLagText(y)} gerisine taşıdı.`, 'info'));
}
const licLagText = (y) => { const L = licById('bekleyis'); return `${Math.max(1, L.lag - Math.floor((y - L.from) / 2))} yıl`; };

export function wire(ctx) {
  ctx.bus.on('engineFinished', (job) => onEngine(ctx, job));
  ctx.bus.on('yearProceeded', () => yearly(ctx));
}

// ---------- Yardımcılar (arayüz ve bot)
export const featsOfLic = (ctx, id) => licFeatures(ctx, licById(id));
export const featsOfMw = (ctx, id) => mwFeatures(mwById(id), tableYear(ctx));
export { engineOf, featPts, familyGames, licPay, licById, mwById };
