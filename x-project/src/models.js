// Takılıp çıkarılan modeller: Productivity, Production, Review, Sales.
// Hepsi saf fonksiyon; sayılar pack'ten gelir.
import { lerpTable, logTable, clamp, calendar } from './kernel.js';
import { CRITICS } from './data/critics.js';
import { REGIONS as REGION_DATA } from './data/regions.js';
import { GENRE_IDS, REL, TOPIC_FIT, SUB, TOPIC_SUB, LEGENDS, TIER, MASTERY, LEGACY_SUB, tierOfValue } from './data/genres.js';
import { FEATURES, FEAT, BASE, CATS, GENRE_WANTS, GENRE_MUST, SUB_NEEDS, LICENSED, MIDDLEWARE } from './data/engines.js';

export const tableYear = (ctx) => calendar(ctx.state, ctx.pack).tableYear;
export const inflation = (ctx, y = tableYear(ctx)) => Math.pow(ctx.pack.economy.inflation, y - ctx.pack.meta.startYear);
export const difficulty = (ctx) => ctx.pack.difficulties.find((d) => d.id === ctx.state.difficulty);
// Ana bölgenin ücret düzeyi (Konu C); Türkiye'de kur krizinde maaşlar dolar olarak ucuzlar
export function homePay(ctx) {
  const st = ctx.state, r = REGION_DATA.find((x) => x.id === (st.home || 'na'));
  let k = r ? lerpTable(r.pay, tableYear(ctx)) : 1;
  for (const f of st.fxMods || []) if (f.rid === r?.id && f.pay && f.until > st.week) k *= f.v;
  return k;
}
export const homeImport = (ctx) => { const r = REGION_DATA.find((x) => x.id === (ctx.state.home || 'na')); return r?.importK ? lerpTable(r.importK, tableYear(ctx)) : 1; };
export const homeRent = (ctx) => REGION_DATA.find((x) => x.id === (ctx.state.home || 'na'))?.rent ?? 1;
export const salaryFor = (ctx, skill) => Math.round(ctx.pack.economy.salaryPerSkill * skill * inflation(ctx) * homePay(ctx));

// --- Productivity
export function marketSkill(ctx, y = tableYear(ctx)) {
  const p = ctx.pack.production;
  return Math.min(p.skillCap, p.skillStart + p.skillPerYear * (y - ctx.pack.meta.startYear));
}
export const mYear = (ctx, y = tableYear(ctx)) => lerpTable(ctx.pack.production.mCurve, y);
export function eta(ctx, n) {
  const p = ctx.pack.production;
  return Math.max(p.etaFloor, 1 - p.etaLoss * Math.max(0, n - p.etaFree));
}
export function expectedStationTier(ctx, y = tableYear(ctx)) {
  let t = 0;
  for (const s of ctx.pack.workstations.tiers) if (y >= s.expectedFrom) t = s.tier;
  return t;
}
export function stationFactor(ctx) {
  const ws = ctx.pack.workstations;
  const tier = ctx.state.stationDown > 0 ? 0 : ctx.state.stationTier;
  return clamp(1 + ws.step * (tier - expectedStationTier(ctx)), ws.min, ws.max);
}
// İki huy (MGT): çarpanlar çarpılır, toplamsal değerler (def 0) toplanır.
export const traitsOf = (p) => [p.trait, p.trait2].filter(Boolean);
export const hasTrait = (p, id) => p.trait === id || p.trait2 === id;
export function traitOf(ctx, p, key, def = 1) {
  let v = def;
  for (const id of traitsOf(p)) {
    const t = ctx.pack.traits.find((x) => x.id === id);
    if (!t || t[key] === undefined) continue;
    if (typeof t[key] !== 'number') return t[key];
    v = def === 0 ? v + t[key] : v * t[key];
  }
  return v;
}
// Çalışanın odasının bulunduğu binanın tasarımı.
export function designOf(ctx, p) {
  const room = ctx.state.rooms.find((r) => r.id === p.room);
  const b = room && ctx.pack.buildings.find((x) => x.types.includes(room.type));
  const id = (b && ctx.state.designs?.[b.id]) || 'standart';
  return ctx.pack.designs.find((d) => d.id === id) || ctx.pack.designs[0];
}
// İlişki: aynı odadaki çalışanlarla ortalama ilişki (−100..100).
export const relKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export function relAvg(ctx, p) {
  const rel = ctx.state.rel;
  if (!rel) return 0;
  const mates = ctx.state.staff.filter((x) => x !== p && x.room === p.room);
  if (!mates.length) return 0;
  return mates.reduce((a, x) => a + (rel[relKey(p.id, x.id)] || 0), 0) / mates.length;
}
// Yetenek setleri (MGT): işin yeteneği / geliştirme yeteneklerinin ortalaması.
export function skillK(ctx, p, key) {
  const S = ctx.pack.skills;
  if (!p.skills) return 1;
  const avg = (p.skills.tasarim + p.skills.program + p.skills.grafik + p.skills.ses) / 4 || 1;
  return clamp(Math.pow((p.skills[key] ?? avg) / avg, S.kExp), S.kMin, S.kMax);
}
export const DISC_SKILL = { oyn: 'tasarim', gfx: 'grafik', ses: 'ses', tek: 'program' };
export function eraMult(ctx, key) {
  let m = 1;
  for (const mod of ctx.state.marketMods) if (mod[key] !== undefined) m *= mod[key];
  return m;
}
// --- Kariyer (Kairosoft katmanı)
export const careerOf = (ctx, p) => ctx.pack.careers.find((c) => c.id === p.career);
export const careerLevel = (p) => (p.careers && p.careers[p.career]) || 0;

export function personWeekly(ctx, p, n) {
  const pr = ctx.pack.production;
  const lvl = 1 + ctx.pack.careerRules.outPerLevel * careerLevel(p);
  const morale = pr.moraleFloor + (1 - pr.moraleFloor) * (p.morale / 100);
  const crunch = ctx.state.crunch ? pr.crunchOut : 1;
  let prod = eraMult(ctx, 'prodMult');
  if (prod < 1 && ctx.state.research.done.uzaktan) prod = 1 - (1 - prod) * 0.3;
  const rel = 1 + ctx.pack.relations.outK * relAvg(ctx, p) / 100;
  return (pr.K * p.skill * mYear(ctx) * eta(ctx, n) * stationFactor(ctx) / 4) * morale * crunch * traitOf(ctx, p, 'out') * prod * lvl * designOf(ctx, p).speed * rel;
}

// --- Konu D: türler ve kombinasyon katmanları
const GIDX = Object.fromEntries(GENRE_IDS.map((id, i) => [id, i]));
export const genreById = (ctx, id) => ctx.pack.genres.find((g) => g.id === id);
// Eski 6 türlük diziler (platform, bölge, konsol) yeni türler için eksen karışımıyla okunur.
export function axisBlend(ctx, arr, gid) {
  const i = GIDX[gid] ?? 0;
  if (i < 6) return arr[i];
  const g = genreById(ctx, gid);
  let v = 0, w = 0;
  for (const [ax, k] of Object.entries(g.axes)) { v += arr[GIDX[ax]] * k; w += k; }
  return v / (w || 1);
}
export function platGenre(ctx, p, gid) {
  const i = GIDX[gid] ?? 0;
  if (i < 6) return p.genre[i];
  return clamp(axisBlend(ctx, p.genre, gid) + (genreById(ctx, gid).platAdj?.[p.kind] || 0), 4, 10);
}
export function regionPref(ctx, r, gid) {
  const i = GIDX[gid] ?? 0;
  if (i < 6) return r.pref[i];
  return Math.round(axisBlend(ctx, r.pref, gid) * (genreById(ctx, gid).regAdj?.[r.id] || 1) * 100) / 100;
}
export const topicTier = (topicId, gid) => TOPIC_FIT[topicId]?.[GIDX[gid]] || 'G';
export function subTier(gid, sid) {
  const s = SUB[sid];
  if (!s) return null;
  if (s.rel?.[gid]) return s.rel[gid];
  return s.parent === gid ? 'S' : REL[gid]?.[GIDX[s.parent]] || 'G';
}
export const topicSubTier = (topicId, sid) => TOPIC_SUB[`${topicId}|${sid}`] || 'G';
export function legendOf(ctx, o, y = tableYear(ctx)) {
  for (const L of LEGENDS) {
    if (y < L.year) continue;
    const a = L.any.find((r) => (!r.topic || r.topic === o.topic) && r.genre === o.genre && (!r.sub || r.sub.includes(o.sub)));
    if (a) return { ...L, rule: a };
  }
  return null;
}
// Kombinasyon: konu×tür (kt), tür×alt tür (gs), konu×alt tür (ts), kitle ve platform tavanları, genel not.
export const subId = (sid) => (!sid ? null : SUB[sid] ? sid : LEGACY_SUB[sid] || null); // eski kayıt: alt tür = ana tür
export function combo(ctx, o) {
  if (o.sub && !SUB[o.sub]) o = { ...o, sub: subId(o.sub) };
  const L = o.topic && o.genre ? legendOf(ctx, o) : null;
  let kt = topicTier(o.topic, o.genre), gs = o.sub ? subTier(o.genre, o.sub) : null, ts = o.sub ? topicSubTier(o.topic, o.sub) : 'G';
  if (L) { kt = 'S'; if (gs) gs = 'S'; if (TIER[ts].v < 8) ts = 'G'; }
  const sub = o.sub ? SUB[o.sub] : null;
  const audCap = sub?.aud?.[o.audience] || null;
  const v = gs ? (2 * TIER[kt].v + 2 * TIER[gs].v + TIER[ts].v) / 5 : TIER[kt].v;
  const overall = L ? 'S' : [kt, gs, ts].includes('X') ? 'X' : tierOfValue(v);
  return { kt, gs, ts, audCap, overall, legend: L };
}
export const platCap = (sid, p) => (sid && SUB[subId(sid)]?.plat?.[p.kind]) || null;
export const platFit = (ctx, p, gid, sid) => Math.min(platGenre(ctx, p, gid), platCap(sid, p) ? TIER[platCap(sid, p)].v : 10);
// Stüdyo tür bilgisi ve ustalık kademesi
export const genreXp = (ctx, gid) => ctx.state.gxp?.[gid] ?? 0;
export function mastery(ctx, gid) {
  const x = genreXp(ctx, gid);
  let m = MASTERY[0];
  for (const r of MASTERY) if (x >= r.min) m = r;
  return m;
}

// --- Production yardımcıları
export function discShares(ctx, alloc) {
  const out = { oyn: 0, gfx: 0, ses: 0, tek: 0 };
  let total = 0;
  ctx.pack.missions.forEach((m, i) => { out[m.disc] += alloc[i]; total += alloc[i]; });
  for (const k in out) out[k] = total > 0 ? out[k] / total : 0.25;
  return out;
}
export function alignment(ctx, project) {
  const r = ctx.pack.review;
  const g = ctx.pack.genres.find((x) => x.id === project.genre);
  const a = discShares(ctx, project.alloc);
  let diff = 0;
  for (const d in a) diff += Math.abs(a[d] - g.disc[d]);
  return Math.max(r.alignFloor, 1 - r.alignK * diff);
}
export function fitFactor(ctx, project) {
  const ai = ctx.pack.audiences.findIndex((x) => x.id === project.audience);
  const t = ctx.pack.topics.find((x) => x[0] === project.topic);
  const plats = project.platforms.map((id) => platformById(ctx, id));
  const avg = (f) => plats.reduce((s, p) => s + f(p), 0) / plats.length;
  const c = combo(ctx, project);
  const tg = TIER[c.kt].v / 10, ta = Math.min(t[3][ai], c.audCap ? TIER[c.audCap].v : 10) / 10;
  const pg = avg((p) => platFit(ctx, p, project.genre, project.sub) / 10), pa = avg((p) => p.aud[ai] / 10);
  return Math.sqrt(tg * ta * pg * pa) * (c.gs ? TIER[c.gs].subF ?? 1 : 1);
}
// --- Motor ve teknoloji (Konu E): oyuna giren her teknik özellik bir motordan gelir.
// Kendi motoru (araştırılan özellikler), lisanslı motor (dönemin birkaç yıl gerisi) ya da sıfırdan kod (yalnız temel).
const vRow = (ctx, v) => ctx.pack.researchV.rows.find((r) => r[0] === v);
export const featPts = (ctx, fid) => (FEAT[fid] ? vRow(ctx, FEAT[fid].v)[4] : 0);
export function featureStats(ctx, fid, y = tableYear(ctx)) {
  const f = FEAT[fid], row = vRow(ctx, f.v), E = ctx.pack.engine;
  const age = Math.max(E.techAgeMin, 1 - E.techAgeK * Math.max(0, y - f.year)); // eski teknoloji ucuzlar
  return { v: row[0], rp: Math.round(row[1] * E.techRpK * age), weeks: Math.max(2, Math.round(row[2] * E.techWeeksK * age)), cost: Math.round(row[3] * E.techCostK * age), enginePts: row[4], engineCost: row[5] };
}
// Kendi motorunun puanı: içindeki özelliklerin (temel dahil) toplamı
export function engineScore(ctx, engine) {
  if (!engine) return 0;
  return [...new Set([...BASE, ...engine.features])].reduce((s, fid) => s + featPts(ctx, fid), 0);
}
// Dönemin beklentisi: 3 yıl önce çıkmış ve seçilen platformların kaldırdığı basamakların toplamı (kategori ya da hepsi)
const expFeats = (ctx, cat, y, plats) => FEATURES.filter((f) => (!cat || f.cat === cat) && (f.base || f.year <= y - ctx.pack.engine.expectLag) && (!plats || featOk(ctx, f.id, plats)));
export const catExpected = (ctx, cat, y = tableYear(ctx), plats = null) => expFeats(ctx, cat, y, plats).reduce((s, f) => s + featPts(ctx, f.id), 0);
export const expectedTop = (ctx, cat, y = tableYear(ctx), plats = null) => expFeats(ctx, cat, y, plats).pop();
export const licById = (id) => LICENSED.find((L) => L.id === id) || null;
export const mwById = (id) => MIDDLEWARE.find((m) => m.id === id) || null;
export const licOpen = (L, y) => y >= L.from && y < L.to;
// Lisanslı motorun o yıl taşıdığı özellikler. Bekleyiş Motoru her iki yılda bir yıl yaklaşır.
export function licLag(L, y) { return L.grows ? Math.max(1, L.lag - Math.floor((y - L.from) / 2)) : L.lag; }
export function licFeatures(ctx, L, y = tableYear(ctx)) {
  const lim = y - licLag(L, y);
  return FEATURES.filter((f) => f.base || ((!L.cats || L.cats.includes(f.cat)) && f.year <= Math.min(lim, L.cap ?? 9999, L.capCats?.[f.cat] ?? 9999))).map((f) => f.id);
}
export function licPay(L, y) { let p = L.pay[0]; for (const x of L.pay) if (y >= x.from) p = x; return p; }
export const mwFeatures = (m, y) => FEATURES.filter((f) => f.cat === m.cat && !f.base && f.year <= y - m.lag).map((f) => f.id);
// Platform şartı: kademe şartını seçilen her konsol karşılamalı; tür şartı (fare, dokunmatik) için tek platform yeter.
const techBound = (p) => ['konsol', 'el', 'salon'].includes(p.kind);
const kindOfPlat = (p) => (p.kind === 'salon' ? 'konsol' : p.kind);
export function featOk(ctx, fid, platIds = []) {
  const n = FEAT[fid]?.need;
  if (!n) return true;
  const plats = platIds.map((id) => platformById(ctx, id)).filter(Boolean);
  if (!plats.length) return true;
  if (n.kinds && !plats.some((p) => n.kinds.includes(kindOfPlat(p)))) return false;
  if (n.tech && plats.some((p) => techBound(p) && p.tech < n.tech)) return false;
  return true;
}
// Projenin motoru: kaynak, sunduğu özellikler, hız
export function engineOf(ctx, pj, y = tableYear(ctx)) {
  const st = ctx.state;
  const own = pj.engineId != null ? st.engines.find((e) => e.id === pj.engineId) : null;
  const L = !own && pj.engineLic ? licById(pj.engineLic) : null;
  let avail = own ? [...BASE, ...own.features] : L ? licFeatures(ctx, L, y) : [...BASE];
  for (const id of pj.mw || []) { const m = mwById(id); if (m) avail.push(...mwFeatures(m, y)); }
  avail = [...new Set(avail)];
  return { kind: own ? 'own' : L ? 'lic' : 'scratch', own, L, avail, name: own ? own.name : L ? L.name : 'Sıfırdan kod' };
}
// Oyunda kullanılan özellikler: seçilenler (yoksa motorun hepsi) ∩ motorun sundukları ∩ platformun kaldırdıkları; temel her zaman var.
export function projFeatures(ctx, pj, y = tableYear(ctx)) {
  const src = engineOf(ctx, pj, y);
  const want = pj.features ? new Set([...BASE, ...pj.features]) : null;
  return src.avail.filter((f) => (FEAT[f].base || !want || want.has(f)) && featOk(ctx, f, pj.platforms));
}
// Kategori seviyeleri ve çarpanlar: grafik → grafik puanı, ses → ses puanı, diğer beşi → teknik puanı (türün önemsediği ağır basar)
export function techProfile(ctx, pj, y = tableYear(ctx)) {
  const E = ctx.pack.engine, feats = projFeatures(ctx, pj, y);
  const cats = {};
  for (const c of CATS) {
    const mine = feats.filter((f) => FEAT[f].cat === c.id);
    const have = mine.reduce((s, f) => s + featPts(ctx, f), 0), exp = catExpected(ctx, c.id, y, pj.platforms);
    const top = mine.map((f) => FEAT[f]).sort((a, b) => a.year - b.year).pop();
    cats[c.id] = { have, exp, r: exp > 0 ? have / exp : 1, top: top?.name || '—', expTop: expectedTop(ctx, c.id, y, pj.platforms)?.name || '—' };
  }
  const av = (r) => clamp(E.avBase + E.avK * r, E.avMin, E.avMax);
  const w = GENRE_WANTS[pj.genre] || {};
  const tc = CATS.filter((c) => c.disc === 'tek');
  const ws = tc.reduce((s, c) => s + (w[c.id] || 1), 0);
  const rt = tc.reduce((s, c) => s + (w[c.id] || 1) * Math.min(cats[c.id].r, E.rCap), 0) / ws;
  const extra = feats.filter((f) => !FEAT[f].base).length;
  return { feats, cats, rt, gfx: av(cats.gfx.r), ses: av(cats.ses.r), tek: clamp(E.factorBase + E.factorK * rt, E.factorMin, E.factorMax), load: 1 + Math.min(E.featLoadMax, E.featLoad * extra) };
}
// Oyuncu raporu: dönemin en çok gerisinde kalan kategori (yoksa null)
export function techLowOf(ctx, pj) {
  const tp = techProfile(ctx, pj);
  const w = GENRE_WANTS[pj.genre] || {};
  const low = CATS.map((c) => ({ c, x: tp.cats[c.id], k: (w[c.id] || 1) * (1 - Math.min(1, tp.cats[c.id].r)) })).filter((o) => o.x.r < 0.8).sort((a, b) => b.k - a.k)[0];
  return low ? { cat: low.c.id, name: low.c.name, top: low.x.top, expTop: low.x.expTop } : null;
}
// Eski arayüz ve raporlar için: teknik çarpanı
export function engineFactor(ctx, pj) { return pj ? techProfile(ctx, pj).tek : 1; }
// Motor ailesinde daha önce çıkan oyun sayısı (ekip alışkanlığı)
export function familyGames(ctx, family) {
  const ids = new Set(ctx.state.engines.filter((e) => (e.family ?? e.id) === family).map((e) => e.id));
  return ctx.state.games.filter((g) => ids.has(g.engineId)).length;
}
export const familyLatest = (ctx, family) => ctx.state.engines.filter((e) => (e.family ?? e.id) === family).reduce((m, e) => Math.max(m, e.builtYear), -Infinity);
// Hız (puan çarpanı) ve hata çarpanı
export function engineSpeed(ctx, pj) {
  const E = ctx.pack.engine, src = engineOf(ctx, pj);
  if (src.kind === 'lic') {
    const kindOk = !src.L.speedKinds || (pj.platforms || []).some((id) => src.L.speedKinds.includes(platformById(ctx, id)?.kind));
    const k = (kindOk ? src.L.speed || 1 : 1) * (src.L.genres?.[pj.genre] || 1);
    return { speed: 1 + (k - 1) * E.licSpeedK, bugs: 1 };
  }
  if (src.kind === 'own') {
    const n = familyGames(ctx, src.own.family ?? src.own.id);
    if (n === 0) return { speed: E.famFirstSpeed, bugs: E.famFirstBugs };
    if (n >= E.famUsedGames) return { speed: E.famUsedSpeed, bugs: 1 };
  }
  return { speed: 1, bugs: 1 };
}
// Değerlendirmeye giren motor notları
export function techNotes(ctx, pj, y = tableYear(ctx)) {
  const E = ctx.pack.engine, r = ctx.pack.review, out = [];
  const feats = new Set(projFeatures(ctx, pj, y));
  const sid = subId(pj.sub), need = sid && SUB_NEEDS[sid];
  if (need && !feats.has(need)) out.push({ v: -E.subNeedPenalty, text: `${SUB[sid].name}: ${FEAT[need].name} yok −${E.subNeedPenalty}` });
  const must = GENRE_MUST.find((m) => m.genre === pj.genre && y >= m.from);
  if (must && !must.any.some((f) => feats.has(f))) out.push({ v: -E.mustPenalty, text: `Olmazsa olmaz eksik −${E.mustPenalty}`, line: must.line });
  const src = engineOf(ctx, pj, y);
  if (src.kind === 'own' && y - familyLatest(ctx, src.own.family ?? src.own.id) > r.oldEngineYears) out.push({ v: -r.oldEnginePenalty, text: `Eskimiş motor −${r.oldEnginePenalty}` });
  if ([...feats].some((f) => !FEAT[f].base && !ctx.state.usedFeatures[f])) out.push({ v: r.newFeatureBonus, text: `Yeni özellik +${r.newFeatureBonus}` });
  return out;
}

// --- Review (değerlendirme)
export const H = (ctx, y = tableYear(ctx)) => logTable(ctx.pack.targetCurve.points, y);
export const tau = (ctx, d, y = tableYear(ctx)) => (d === 'tek' ? lerpTable(ctx.pack.techTargetMult.points, y) : 1);
export function target(ctx, d, sizeId, y = tableYear(ctx)) {
  const size = ctx.pack.sizes.find((s) => s.id === sizeId);
  const pr = ctx.pack.prestige;
  return H(ctx, y) * difficulty(ctx).D * tau(ctx, d, y) * Math.pow(pr.base, ctx.state.prestige) * size.target;
}
export function sizePenalty(ctx, sizeId, y = tableYear(ctx)) {
  const size = ctx.pack.sizes.find((s) => s.id === sizeId);
  let pen = 0;
  for (const [yr, row] of ctx.pack.sizePenalty.rows) if (y >= yr) pen = row[size.mgt] || 0;
  return pen;
}
export function review(ctx, project) {
  const r = ctx.pack.review;
  const g = ctx.pack.genres.find((x) => x.id === project.genre);
  const hiza = alignment(ctx, project);
  const F = fitFactor(ctx, project);
  const parts = {};
  let sum = 0;
  for (const d of ['oyn', 'gfx', 'ses', 'tek']) {
    const T = target(ctx, d, project.size);
    const ratio = Math.min(1, (project.points[d] * hiza) / T);
    parts[d] = Math.round(ratio * 100);
    sum += g.disc[d] * r.cap * ratio;
  }
  let score = F * sum;
  const notes = [];
  const c = combo(ctx, project);
  const sgn = (v) => (v > 0 ? `+${String(v).replace('.', ',')}` : `−${String(-v).replace('.', ',')}`);
  if (!subId(project.sub)) { score -= r.noSubgenrePenalty; notes.push(`Alt tür yok −${r.noSubgenrePenalty}`); }
  else {
    const a = TIER[c.gs].sub, b = TIER[c.ts].ts;
    if (a) { score += a; notes.push(`Alt tür ${TIER[c.gs].name.toLowerCase()} ${sgn(a)}`); }
    if (b) { score += b; notes.push(`Konu ve alt tür ${TIER[c.ts].name.toLowerCase()} ${sgn(b)}`); }
  }
  // Stüdyonun bu türdeki ustalığı (Konu D)
  const ms = ctx.state.gxp ? mastery(ctx, project.genre) : null;
  if (ms?.score) { score += ms.score; notes.push(`${g.name} ${ms.name.toLowerCase()} ${sgn(ms.score)}`); }
  const totalPts = Object.values(project.points).reduce((a, b) => a + b, 0) || 1;
  const bugRate = project.bugs / totalPts;
  const bugPen = Math.min(r.bugCap, r.bugMult * bugRate);
  if (bugPen > 0.5) notes.push(`Hatalar −${bugPen.toFixed(1)}`);
  score -= bugPen;
  const sp = sizePenalty(ctx, project.size);
  if (sp) { score += sp; notes.push(`Küçük boyut ${sp}`); }
  const last = ctx.state.games[ctx.state.games.length - 1];
  if (last && last.topic === project.topic && last.genre === project.genre) { score -= r.repeatComboPenalty; notes.push(`Aynı konu×tür tekrarı −${r.repeatComboPenalty}`); }
  for (const n of techNotes(ctx, project)) { score += n.v; notes.push(n.text); } // Konu E
  if (score >= r.cap - 0.01) score = r.cap + ctx.rng.range(0, r.randTop);
  score = clamp(score, 1, 100);
  const critics = criticPanel(ctx, score, project.genre);
  return { score: Math.round(score * 10) / 10, parts, hiza, F, bugRate, notes, critics, genreNote: genreNote(project.genre, score), combo: c.overall, legend: c.legend?.id || null };
}

// Eleştirmen puanı: 5'in altında tam sayı, üstünde 0,2'lik adım. Her eleştirmen kendi kademesinden farklı bir yorum seçer.
export function quantizeCritic(v) {
  v = clamp(v, 1, 10);
  return v < 5 ? Math.max(1, Math.round(v)) : Math.round(v * 5) / 5;
}
export function criticBand(v) {
  let band = CRITICS.bands[0];
  for (const b of CRITICS.bands) if (v + 1e-9 >= b[0]) band = b;
  return band;
}
function criticPanel(ctx, score, genre) {
  const used = new Set();
  return CRITICS.outlets.map((name) => {
    const v = quantizeCritic(score / 10 + ctx.rng.normal(0, 0.45));
    const lines = criticBand(v)[1];
    let i = Math.floor(ctx.rng.next() * lines.length);
    for (let k = 0; k < lines.length && used.has(lines[i]); k++) i = (i + 1) % lines.length;
    used.add(lines[i]);
    return { name, score: v, quote: lines[i] };
  });
}
export function genreNote(genre, score) {
  const list = CRITICS.genre[genre];
  if (!list) return '';
  return list[score < 30 ? 0 : score < 50 ? 1 : score < 70 ? 2 : score < 86 ? 3 : 4];
}

// --- Sales
export const Pz = (ctx, y = tableYear(ctx)) => logTable(ctx.pack.sales.pzCurve, y);
export function S(ctx, n) {
  const s = ctx.pack.sales;
  return n >= s.sCut ? Math.exp(s.sA * (n - s.sCenter)) : Math.exp(s.sLow) * Math.exp(s.sLowK * (n - s.sCut));
}
// Oyuncunun kendi konsolları da platform gibi davranır (kurulu taban state'te).
export function ownPlatforms(ctx) {
  const c = ctx.pack.console;
  return (ctx.state.consoles || []).filter((k) => k.launched).map((k) => {
    const type = c.types.find((t) => t.id === k.type) || c.types.find((t) => t.id === 'konsol');
    return { id: k.id, name: k.name, kind: type.kind, from: k.launched, to: k.retired || 2200, tech: Math.min(7, Math.round(k.tech)), genre: k.genre || type.genre, aud: k.aud || type.aud, licence: 0, devCost: c.ownDevCost, own: true };
  });
}
export const allPlatforms = (ctx) => ctx.pack.platforms.concat(ownPlatforms(ctx));
export const platformById = (ctx, id) => allPlatforms(ctx).find((p) => p.id === id);

// Konsol savaşı segmenti: aynı segmentteki platformlar oyuncu için yarışır.
export const segmentOf = (p) => (p.kind === 'el' ? 'el' : p.kind === 'konsol' ? 'konsol' : p.kind || 'pc');
export const platformEnd = (ctx, p) => ctx.state.platformEnd?.[p.id] ?? p.to;
export function platformBase(ctx, p, y = tableYear(ctx)) {
  const raw = platformBaseRaw(ctx, p, y);
  const w = !p.own && raw > 0 && ctx.state.war && ctx.state.war[segmentOf(p)];
  return w ? raw * (1 - ctx.pack.war.steal * w.share) : raw;
}
export function platformBaseRaw(ctx, p, y = tableYear(ctx)) {
  if (y < p.from || y >= platformEnd(ctx, p)) return 0;
  if (p.own) return ctx.state.consoles.find((k) => k.id === p.id).base;
  if (p.key) return lerpTable(p.key, y);
  const G = ctx.pack.platformGrowth, life = clamp((y - p.from) / (p.to - p.from), 0, 1);
  const frac = clamp(life / G.peakAt, 0, 1);
  const decline = life > G.declineFrom ? 1 - (1 - G.declineTo) * (life - G.declineFrom) / (1 - G.declineFrom) : 1;
  return (p.start + (p.units - p.start) * frac) * decline;
}
export function activePlatforms(ctx, y = tableYear(ctx)) {
  return allPlatforms(ctx).filter((p) => y >= p.from && y < platformEnd(ctx, p));
}
// --- Bölgesel pazarlar
export function regionShares(ctx, y = tableYear(ctx)) {
  const list = ctx.pack.regions.list;
  const raw = list.map((r) => Math.max(0, lerpTable(r.weight, y)));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(list.map((r, i) => [r.id, raw[i] / sum]));
}
export function regionBias(ctx, p, rid) {
  const key = p.own ? 'sen' : p.owner || (p.kind === 'pc' ? 'pc' : p.kind === 'mobil' ? 'mobil' : null);
  return (key && ctx.pack.regions.ownerBias[key]?.[rid]) ?? 1;
}
export const ALL_REGIONS = (ctx) => ctx.pack.regions.list.map((r) => r.id);
// Bir oyunun bir platformdaki bölge karışımı: pazar payı × tür ilgisi × platformun o bölgedeki gücü.
export function regionMix(ctx, game, p, y = tableYear(ctx)) {
  const w = regionShares(ctx, y);
  const regs = game.regions || ALL_REGIONS(ctx);
  const out = {};
  for (const r of ctx.pack.regions.list) {
    const acc = game.reach ? game.reach[r.id] || 0 : regs.includes(r.id) ? 1 : 0;
    if (acc > 0) out[r.id] = w[r.id] * regionPref(ctx, r, game.genre) * regionBias(ctx, p, r.id) * acc;
  }
  return out;
}
export const regionFactor = (ctx, game, p) => Object.values(regionMix(ctx, game, p)).reduce((a, b) => a + b, 0) / ctx.pack.regions.norm;
export function studioStars(ctx) {
  return clamp(ctx.state.prestige + Math.log10(1 + ctx.state.fans / 10000), 0, 5);
}
export function selfPublishPower(ctx) {
  const s = ctx.pack.sales;
  return Math.min(s.selfPublishPowerCap, s.selfPublishPowerBase + ctx.state.fans / s.selfPublishFansPerPower);
}
// Haftalık zirve satış (platform başına). game: {score, price, hype, ipValue, publisherPower, platforms, size}
export function peakWeekly(ctx, game) {
  const s = ctx.pack.sales;
  const diff = difficulty(ctx);
  const size = ctx.pack.sizes.find((x) => x.id === game.size);
  const F = Math.max(1, 1 + s.fanK * Math.log10(Math.max(1, ctx.state.fans) / s.fanRef));
  const Hh = 1 + (s.hypeK * game.hype) / 100;
  // Konu C: bölgesel erişim (game.reach) yayıncı ya da kendi yayın gücünü bölge bölge zaten içerir
  const Y = game.reach ? 1 : game.selfPub ? s.selfA + s.selfB * (game.publisherPower / 100) ** s.selfExp : (s.yA + (s.yB * game.publisherPower) / 100) * (s.pubReach ?? 1);
  const St = s.stA + (s.stB * Math.min(studioStars(ctx), s.stCap)) / s.stCap;
  const I = s.iA + s.iB * Math.min(game.ipValue, 1);
  const ip = 1 + s.ipK * game.ipValue * diff.ipD;
  const base = s.B * Pz(ctx) * diff.Z * S(ctx, game.score) * ip * F * Hh * Y * St * I * size.sales;
  const act = activePlatforms(ctx);
  const total = act.reduce((a, p) => a + platformBase(ctx, p), 0) || 1;
  const ai = ctx.pack.audiences.findIndex((x) => x.id === game.audience);
  const out = {};
  for (const id of game.platforms) {
    const p = platformById(ctx, id);
    const share = platformBase(ctx, p) / total;
    const fit = (platFit(ctx, p, game.genre, game.sub) / 10) * (p.aud[ai] / 10);
    const price = Math.pow((p.priceRef || s.priceRef) / gamePrice(ctx, game, p), s.priceExp);
    out[id] = base * share * fit * price * regionFactor(ctx, game, p);
  }
  return out;
}
export function gamePrice(ctx, game, p) {
  return p.priceRef ? Math.max(1, Math.round(game.price * (p.priceRef / ctx.pack.sales.priceRef))) : game.price;
}
export function weekCurve(ctx, n, pirated) {
  const s = ctx.pack.sales;
  if (n < s.curve.length) return s.curve[n];
  return s.tailA * Math.pow(pirated ? s.tailBPirated : s.tailB, n - s.curve.length);
}
