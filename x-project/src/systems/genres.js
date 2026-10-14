// Konu D: tür bilgisi, alt tür keşfi ve icadı, yaşam döngüsü, efsane kombinasyonlar, kült klasik,
// çalışan tür yatkınlığı, fikir getiren çalışan, odak grubu ve yıllık tür rehberi.
import { clamp } from '../kernel.js';
import { tableYear, inflation, combo, mastery, genreXp, genreById, topicTier, subTier, topicSubTier, platCap } from '../models.js';
import {
  GENRES, GENRE_IDS, DISPLAY, SUBGENRES, SUB, LEGENDS, BACKGROUNDS, LEGACY_SUB, TIER, ORDER, TEAM_LINES, PRESS_LINES, PLAYER_LINES, FOCUS_LINES, IDEA_LINES, TOPIC_FIT,
} from '../data/genres.js';

export { GENRES, GENRE_IDS, DISPLAY, SUBGENRES, SUB, LEGENDS, BACKGROUNDS, TIER, ORDER, PRESS_LINES, PLAYER_LINES };
const P = (ctx) => ctx.pack.genreSys;
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const pickH = (arr, key) => arr[hash(key) % arr.length];

// --- Durum
export function ensure(state) {
  state.gxp ||= {}; state.gxpLast ||= {}; state.legends ||= {}; state.invented ||= {}; state.subUsed ||= {}; state.ideas ||= [];
  state.focusPaid ||= {}; state.subNews ||= {}; state.inventJob ??= null;
  state.background ||= 'salon';
}
export const bg = (ctx) => BACKGROUNDS.find((b) => b.id === ctx.state.background) || BACKGROUNDS[0];
// Yeni oyun: kurucu geçmişinin türleri açık ve bilgili başlar.
export function initState(state, pack, background) {
  state.background = background || 'salon';
  state.genreV = 1;
  ensure(state);
  const b = BACKGROUNDS.find((x) => x.id === state.background) || BACKGROUNDS[0];
  for (const g of b.genres) state.gxp[g] = b.bonus.xp?.[g] ?? pack.genreSys.startXp;
}
// Eski kayıt: Aksiyon, Macera ve Casual o zaman bedavaydı; araştırılan türler bilinir; alt türler eşlenir; bilgi geçmiş oyunlardan.
export function migrate(state, pack) {
  if (state.genreV) { ensure(state); return; }
  ensure(state);
  state.genreV = 1;
  for (const id of ['tur_aks', 'tur_mac', 'tur_cas']) state.research.done[id] ??= 0;
  const fix = (o) => { if (o && o.sub && !SUB[o.sub]) o.sub = LEGACY_SUB[o.sub] || null; };
  for (const g of state.games || []) fix(g);
  for (const pj of state.projects || []) fix(pj);
  for (const g of GENRES) if (g.research && state.research.done[g.research] != null) state.gxp[g.id] = pack.genreSys.researchXp;
  for (const g of state.games || []) addXp({ state, pack }, g.genre, g.sub, g.size, g.score, g.year);
  for (const p of state.staff || []) if (!p.likes) { const h = hash(String(p.id) + p.name); p.likes = [GENRE_IDS[h % 6]]; p.dislike = h % 3 === 0 ? GENRE_IDS[(h >> 3) % GENRE_IDS.length] : null; if (p.dislike === p.likes[0]) p.dislike = null; p.gexp = {}; }
}

// --- Bilinen türler ve alt türler
export const knows = (ctx, gid) => bg(ctx).genres.includes(gid) || ctx.state.research.done[genreById(ctx, gid)?.research] != null;
export const knownGenres = (ctx) => GENRES.filter((g) => knows(ctx, g.id));
export const bornGenres = (ctx, y = tableYear(ctx)) => GENRES.filter((g) => g.year <= y);
export const subBorn = (sid, y) => SUB[sid] && y >= SUB[sid].year;
export function subAvailable(ctx, sid, y = tableYear(ctx)) {
  const s = SUB[sid];
  if (!s) return false;
  if (!(y >= s.year || ctx.state.invented?.[sid])) return false;
  return knows(ctx, s.parent) || bg(ctx).subs.includes(sid) || !!ctx.state.invented?.[sid];
}
export const availableSubs = (ctx, y = tableYear(ctx)) => SUBGENRES.filter((s) => subAvailable(ctx, s.id, y));

// --- Tür bilgisi: kazanım ve paslanma
function addXp(ctx, gid, sid, size, score, year) {
  const G = ctx.pack.genreSys, st = ctx.state;
  const raw = (G.gain[size] ?? G.gain.kucuk) * (G.gainScoreA + (score || 0) / 100);
  const grow = (id, k) => { const x = st.gxp[id] ?? 0; st.gxp[id] = clamp(x + raw * k * (1 - x / G.gainDecay), 0, G.xpCap); st.gxpLast[id] = year; };
  grow(gid, 1);
  const parent = sid && SUB[sid]?.parent;
  if (parent && parent !== gid) grow(parent, G.crossShare);
}
function rust(ctx) {
  const G = P(ctx), st = ctx.state, y = Math.floor(tableYear(ctx));
  for (const [id, x] of Object.entries(st.gxp)) {
    const last = st.gxpLast[id];
    if (last != null && y - last >= G.rustYears && x > G.rustFloor) st.gxp[id] = Math.max(G.rustFloor, x - G.rustPerYear);
  }
}

// --- Yaşam döngüsü
export function phase(ctx, sid, y = tableYear(ctx)) {
  const s = SUB[sid], L = P(ctx).life;
  if (!s) return { id: 'yok', name: '', icon: '', k: 1 };
  const [a, b] = s.peak;
  if (y < s.year) return { id: 'dogmamis', name: 'Henüz doğmadı', icon: '🥚', k: 1 };
  if (y < a) return { id: 'yukselen', name: 'Yükselen', icon: '📈', k: 1 + L.rise * (y - s.year) / Math.max(1, a - s.year) };
  if (y <= b + 1) return { id: 'altin', name: 'Altın çağ', icon: '🔥', k: L.peak };
  if (s.bubble) return { id: 'cokmus', name: 'Çökmüş', icon: '📉', k: L.crash };
  if (y <= b + 1 + L.satYears) return { id: 'doygun', name: 'Doygun', icon: '➖', k: L.satFrom + (L.satTo - L.satFrom) * (y - b - 1) / L.satYears };
  const retro = y >= L.retro[0] && y <= L.retro[1] + 1 && s.year < L.retroBorn;
  return { id: 'nis', name: retro ? 'Niş (retro dalgası)' : 'Niş', icon: retro ? '👾' : '🌙', k: retro ? L.retroK : L.niche };
}
export function lifeK(ctx, game) {
  if (!game.sub) return 1;
  let k = phase(ctx, game.sub).k;
  if (game.misfire) k *= P(ctx).invent.misfireK;
  return k;
}

// --- Ekip sezgisi (bulanık): ustalık arttıkça kesinleşir
export function intuition(ctx, o) {
  const c = combo(ctx, o);
  if (c.legend) return { tier: 'L', text: TEAM_LINES.L[0], exact: false };
  const ms = mastery(ctx, o.genre), key = `${o.topic}|${o.genre}|${o.sub || ''}|${Math.floor(ctx.state.week / 48)}`;
  let i = ORDER.indexOf(c.overall);
  if (ms.noise && (hash(key) % 1000) / 1000 < ms.noise) i = clamp(i + (hash(key + 'd') % 2 ? 1 : -1), 0, ORDER.length - 1);
  const t = ORDER[i];
  return { tier: t, text: pickH(TEAM_LINES[t], key), exact: !ms.noise };
}

// --- Bilgi kayıtları
export function learnCombo(ctx, o) {
  const k = ctx.state.knowledge, c = combo(ctx, o);
  k[`tg|${o.topic}|${o.genre}`] = TIER[c.kt].v;
  if (o.sub) { k[`gs|${o.genre}|${o.sub}`] = TIER[c.gs].v; k[`ts|${o.topic}|${o.sub}`] = TIER[c.ts].v; }
  return c;
}
export function knownCombo(ctx, o) {
  const k = ctx.state.knowledge;
  const kt = k[`tg|${o.topic}|${o.genre}`], gs = o.sub ? k[`gs|${o.genre}|${o.sub}`] : null, ts = o.sub ? k[`ts|${o.topic}|${o.sub}`] : null;
  const legend = combo(ctx, o).legend;
  const known = kt != null && (!o.sub || (gs != null && ts != null));
  const disc = legend && ctx.state.legends[legend.id];
  return { kt, gs, ts, known: known || !!disc, overall: known || disc ? combo(ctx, o).overall : null };
}

// --- Odak grubu
export function focusCost(ctx, o) {
  const F = P(ctx).focus;
  const size = ctx.pack.sizes.find((s) => s.id === o.size) || ctx.pack.sizes[0];
  const plats = (o.platforms || []).map((id) => ctx.pack.platforms.find((p) => p.id === id)).filter(Boolean);
  const dev = plats.reduce((a, p) => a + p.licence + p.devCost * size.devCost, 0);
  return Math.round(Math.max(F.min * inflation(ctx) ** 0.5, dev * F.share));
}
export function focusGroup(ctx, o) {
  const { state, ledger } = ctx;
  if (!o.topic || !o.genre) return { ok: false, msg: 'Önce konu ve tür seç.' };
  const key = `${o.topic}|${o.genre}|${o.sub || ''}`;
  const cost = state.focusPaid[key] ? 0 : focusCost(ctx, o);
  if (cost && state.cash < cost) return { ok: false, msg: `Odak grubu ${cost.toLocaleString('tr-TR')} $.` };
  if (cost) ledger.post('arastirma', -cost, 'Odak grubu');
  state.focusPaid[key] = true;
  const c = learnCombo(ctx, o);
  const line = pickH(FOCUS_LINES[c.overall], key);
  ctx.bus.fire('focusGroup', { combo: c, o });
  return { ok: true, combo: c, line, cost };
}

// --- Yayın: efsane keşif, öncü ödülü, kült klasik (not ve beklenti satıştan önce değişir)
export function onReview(ctx, pj, rv) {
  const { state, rng } = ctx;
  const G = P(ctx), out = {};
  const c = combo(ctx, pj), y = tableYear(ctx);
  if (c.legend && !state.legends[c.legend.id]) {
    state.legends[c.legend.id] = { by: 'me', year: Math.floor(y) };
    pj.hype = Math.min(ctx.pack.hype.max, pj.hype + G.legend.hype);
    out.legend = c.legend;
  }
  const s = pj.sub && SUB[pj.sub];
  if (s && y < s.year && state.invented[s.id] && !state.subUsed[s.id]) {
    pj.hype = Math.min(ctx.pack.hype.max, pj.hype + G.invent.hype);
    out.pioneer = s;
    if (rng.chance(G.invent.misfire)) out.misfire = true;
  }
  if (['K', 'X'].includes(c.overall) && rv.score < 70) {
    const ch = G.cult.chance * (out.misfire ? G.cult.earlyK : 1);
    if (rng.chance(ch)) { rv.score = Math.min(100, Math.round((rv.score + G.cult.score) * 10) / 10); rv.notes.push(`Kült klasik +${G.cult.score}`); out.cult = true; }
  }
  return out;
}
export function afterRelease(ctx, game, pj, fx) {
  const { state } = ctx;
  const G = P(ctx);
  addXp(ctx, game.genre, game.sub, game.size, game.score, Math.floor(tableYear(ctx)));
  if (game.sub) state.subUsed[game.sub] = (state.subUsed[game.sub] || 0) + 1;
  // Çalışanların tür deneyimi
  const fam = new Set([game.genre, game.sub && SUB[game.sub]?.parent].filter(Boolean));
  for (const p of state.staff) if (p.room && state.rooms.find((r) => r.id === p.room)?.type === 'gelistirme') { p.gexp ||= {}; for (const g of fam) p.gexp[g] = (p.gexp[g] || 0) + 1; }
  if (fx.legend) {
    state.fans = Math.round(state.fans * (1 + G.legend.fans));
    ctx.news(`🌟 Efsane keşif: "${game.name}" ile ${fx.legend.name} doğdu! Basın: "${fx.legend.press}"`, 'good');
    ctx.bus.fire('legendFound', { game, legend: fx.legend });
  }
  if (fx.pioneer) {
    state.fans = Math.round(state.fans * (1 + G.invent.fans));
    game.pioneer = fx.pioneer.id;
    state.awards.push({ year: Math.floor(tableYear(ctx)), name: game.name, type: 'oncu', genre: game.genre, title: `${fx.pioneer.name} türünün babası` });
    ctx.news(`🧪 "${game.name}" ile ${fx.pioneer.name} türünü sen başlattın! ${fx.misfire ? 'Basın: "Kimse anlamadı. On yıl sonra herkes bunu yapacak."' : 'Basın: "Ekranın içine yeni bir kapı açıldı."'}`, fx.misfire ? 'info' : 'good');
  }
  if (fx.misfire) game.misfire = true;
  if (fx.cult) {
    game.cult = true;
    state.fans = Math.round(state.fans * (1 + G.cult.fans));
    ctx.news(`🎭 "${game.name}" kült klasik oldu! Basın: "Bu kadar kötü olması onu iyi yapıyor."`, 'good');
  }
  const ms = mastery(ctx, game.genre);
  const name = genreById(ctx, game.genre).name;
  const prev = state.gxpRank?.[game.genre];
  state.gxpRank ||= {};
  if (prev !== ms.id) {
    state.gxpRank[game.genre] = ms.id;
    if (prev && ['usta', 'uzman', 'efsane'].includes(ms.id)) ctx.news(ms.id === 'efsane' ? `🏛️ Stüdyon artık ${name.toLowerCase()} türünün efsanesi!` : `🎓 Stüdyon ${name.toLowerCase()} türünde ${ms.name.toLowerCase()} oldu.`, 'good');
  }
}

// --- İcat
export function inventInfo(ctx, sid) {
  const I = P(ctx).invent, s = SUB[sid], y = tableYear(ctx), st = ctx.state;
  if (!s) return { ok: false, why: 'Yok.' };
  const early = s.year - y;
  const rp = Math.round(I.rpBase + I.rpPerYear * Math.max(0, early));
  const cost = Math.round((I.cost + I.costPerYear * Math.max(0, early)) * inflation(ctx) ** 0.5);
  if (st.invented[sid] || y >= s.year) return { ok: false, why: 'Zaten doğdu.', rp, cost };
  if (early > I.yearsEarly) return { ok: false, why: `Çok erken: ${Math.ceil(early - I.yearsEarly)} yıl sonra denenebilir.`, rp, cost };
  if (!st.research.done.alt_tur) return { ok: false, why: '"Alt tür" araştırması gerekli.', rp, cost };
  if (!knows(ctx, s.parent)) return { ok: false, why: `${genreById(ctx, s.parent).name} bilinmiyor.`, rp, cost };
  if (genreXp(ctx, s.parent) < I.minXp) return { ok: false, why: `${genreById(ctx, s.parent).name} bilgisi ${I.minXp} olmalı (şu an ${Math.floor(genreXp(ctx, s.parent))}).`, rp, cost };
  if (st.inventJob) return { ok: false, why: 'Zaten bir icat sürüyor.', rp, cost };
  if (st.research.rp < rp) return { ok: false, why: `${rp} AP gerekli.`, rp, cost };
  if (st.cash < cost) return { ok: false, why: `${cost.toLocaleString('tr-TR')} $ gerekli.`, rp, cost };
  return { ok: true, rp, cost };
}
export function invent(ctx, sid) {
  const inf = inventInfo(ctx, sid);
  if (!inf.ok) return { ok: false, msg: inf.why };
  const { state, ledger } = ctx;
  state.research.rp -= inf.rp;
  ledger.post('arastirma', -inf.cost, `İcat: ${SUB[sid].name}`);
  state.inventJob = { sub: sid, weeksLeft: P(ctx).invent.weeks };
  ctx.news(`🧪 Ekip ${SUB[sid].name} üzerinde gizlice çalışıyor. Henüz kimse böyle bir şey yapmadı.`, 'info');
  return { ok: true };
}

// --- Çalışan tür yatkınlığı
export function assignTaste(ctx, p, founder = false) {
  const { rng } = ctx, S = P(ctx).staff;
  if (founder) { p.likes = [...bg(ctx).genres]; p.dislike = null; p.gexp = {}; return p; }
  const y = tableYear(ctx);
  const pool = bornGenres(ctx, y);
  const w = pool.map((g) => 1 + SUBGENRES.filter((s) => s.parent === g.id && phase(ctx, s.id, y).id === 'altin').length);
  const pick = (ex) => { const ok = pool.map((g, i) => (ex.includes(g.id) ? 0 : w[i])); let r = rng.next() * ok.reduce((a, b) => a + b, 0); for (let i = 0; i < pool.length; i++) { r -= ok[i]; if (r <= 0) return pool[i].id; } return pool[0].id; };
  p.likes = [pick([])];
  if (rng.chance(S.likeTwo)) p.likes.push(pick(p.likes));
  p.dislike = rng.chance(S.dislikeChance) ? pick(p.likes) : null;
  p.gexp = {};
  return p;
}
export function projectOfPerson(state, p) {
  const room = state.rooms.find((r) => r.id === p.room);
  if (!room || room.type !== 'gelistirme') return null;
  return state.projects.find((x) => x.roomId === room.id && room.mode !== 'destek') || (room.mode === 'destek' ? state.projects.find((x) => x.id === room.target) : null) || null;
}
const fam = (pj) => [pj.genre, pj.sub && SUB[pj.sub]?.parent].filter(Boolean);
export function staffK(ctx, p, pj) {
  if (!pj || !p.likes) return 1;
  const S = P(ctx).staff, f = fam(pj);
  let k = 1;
  if (p.likes.some((g) => f.includes(g))) k *= S.likeK;
  else if (p.dislike && f.includes(p.dislike)) k *= S.dislikeK;
  const e = Math.max(0, ...f.map((g) => p.gexp?.[g] || 0));
  if (e >= S.exp2) k *= S.exp2K; else if (e >= S.exp1) k *= S.exp1K;
  return k;
}
export function staffMood(ctx, p) {
  const pj = p.likes ? projectOfPerson(ctx.state, p) : null;
  if (!pj || pj.status !== 'dev') return 0;
  const f = fam(pj);
  return p.likes.some((g) => f.includes(g)) ? 6 : p.dislike && f.includes(p.dislike) ? -6 : 0;
}
export const expBadge = (ctx, n) => (n >= P(ctx).staff.exp2 ? '⭐⭐' : n >= P(ctx).staff.exp1 ? '⭐' : '');
// Üretim: ustalık hızı, kurucu geçmişi bonusu, acemi hata çarpanı
export const speedK = (ctx, pj) => mastery(ctx, pj.genre).speed || 1;
export const bugK = (ctx, pj) => mastery(ctx, pj.genre).bugs || 1;
export function missionK(ctx, m) {
  const b = bg(ctx).bonus;
  return (b.disc?.[m.disc] || 1) * (b.missions?.[m.id] || 1);
}
export const researchK = (ctx) => bg(ctx).bonus.research || 1;
export const pubAdj = (ctx, gid) => { const m = mastery(ctx, gid).id; return m === 'uzman' || m === 'efsane' ? P(ctx).pubXpK : m === 'acemi' ? -P(ctx).pubXpK : 0; };

// --- Rakipler ve trendler dönemin türlerini seçer (altın çağdaki alt türler ağırlık verir)
export function rivalGenre(ctx) {
  const y = tableYear(ctx), pool = bornGenres(ctx, y);
  const w = pool.map((g) => 1 + 0.5 * SUBGENRES.filter((s) => s.parent === g.id && phase(ctx, s.id, y).id === 'altin').length);
  let r = ctx.rng.next() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i].id; }
  return pool[0].id;
}

// --- En iyi bilinen kombinasyonlar (bot ve fikir için)
export function bestSubFor(ctx, gid, topic, { onlyKnown = false } = {}) {
  const k = ctx.state.knowledge;
  let best = null, bv = -1e9;
  for (const s of availableSubs(ctx)) {
    const gs = onlyKnown ? k[`gs|${gid}|${s.id}`] : TIER[subTier(gid, s.id)].v;
    if (gs == null) continue;
    const ts = topic ? (onlyKnown ? k[`ts|${topic}|${s.id}`] ?? 8 : TIER[topicSubTier(topic, s.id)].v) : 8;
    const v = gs * 2 + ts + phase(ctx, s.id).k * 4;
    if (v > bv) { bv = v; best = s.id; }
  }
  return best;
}

// --- Haftalık / aylık / yıllık
export function weekly(ctx) {
  const { state, rng } = ctx;
  ensure(state);
  const job = state.inventJob;
  if (job && --job.weeksLeft <= 0) {
    state.invented[job.sub] = Math.floor(tableYear(ctx));
    ctx.news(`🧪 İcat tamam: ${SUB[job.sub].name}! Bu alt tür doğana kadar yalnız sen yapabilirsin.`, 'good');
    ctx.bus.fire('subInvented', job.sub);
    state.inventJob = null;
  }
  const y = tableYear(ctx);
  if (state.week % 4 === 0) {
    // Alt tür haberleri: doğuş, altın çağ, çöküş
    const init = !state.subNewsInit;
    for (const s of SUBGENRES) {
      const ph = phase(ctx, s.id, y).id, seen = state.subNews[s.id];
      if (init || ph === seen) { state.subNews[s.id] = ph; continue; }
      state.subNews[s.id] = ph;
      if (!seen || seen === 'dogmamis') ctx.news(`🐣 Yeni bir tür doğdu: ${s.name}! ${s.joke}`, 'info');
      else if (ph === 'altin') ctx.news(`🔥 ${s.name} çılgınlığı başladı. Talep tavan!`, 'info');
      else if (ph === 'cokmus') ctx.news(`📉 ${s.name} balonu patladı. Depolar dolu, fiyatlar çakıldı.`, 'bad');
    }
    state.subNewsInit = true;
    // Efsaneyi kimse bulmazsa rakipler bulur
    for (const L of LEGENDS) if (!state.legends[L.id] && y >= L.year + 4) { state.legends[L.id] = { by: 'rakip', year: Math.floor(y) }; ctx.news(`🌟 Bir rakip stüdyo efsanevi bir kombinasyon buldu: ${L.name}. Herkes kopyalamaya başladı.`, 'info'); learnLegend(ctx, L); }
    // Fikir getiren çalışan
    const I = P(ctx).idea;
    if (state.research.done.alt_tur) for (const p of state.staff) {
      if (p.founder || !p.likes || !rng.chance(I.monthly)) continue;
      const idea = ideaFor(ctx, p);
      if (!idea) continue;
      state.ideas.unshift(idea); state.ideas.length = Math.min(state.ideas.length, 3);
      learnCombo(ctx, idea);
      p.morale = clamp(p.morale + I.morale / 2, 0, 100);
      ctx.news(`💡 ${idea.text}`, 'good');
      break;
    }
  }
  if (state.week % 48 === 0) { rust(ctx); yearlyGuide(ctx); }
}
function learnLegend(ctx, L) {
  const a = L.any[0];
  const topic = a.topic || Object.keys(TOPIC_FIT)[0];
  learnCombo(ctx, { topic, genre: a.genre, sub: a.sub?.[0] || null });
}
function ideaFor(ctx, p) {
  const genres = p.likes.filter((g) => knows(ctx, g));
  if (!genres.length) return null;
  const gid = ctx.rng.pick(genres);
  const topics = ctx.pack.topics.filter((t) => t[4] <= tableYear(ctx) && ['S', 'I'].includes(topicTier(t[0], gid)));
  if (!topics.length) return null;
  const t = ctx.rng.pick(topics);
  const sub = bestSubFor(ctx, gid, t[0]);
  if (!sub) return null;
  const c = `${t[1]} + ${genreById(ctx, gid).name} + ${SUB[sub].name}`;
  return { id: ctx.state.nextId++, by: p.name, topic: t[0], genre: gid, sub, week: ctx.state.week, text: ctx.rng.pick(IDEA_LINES).replace('{n}', p.name).replace('{c}', c) };
}
// Piksel Dergisi yıllık tür rehberi: bir tavsiye, bir uyarı, bir sürpriz
function yearlyGuide(ctx) {
  const { rng, pack } = ctx;
  const y = tableYear(ctx);
  const topics = pack.topics.filter((t) => t[4] <= y), genres = bornGenres(ctx, y);
  const all = [];
  for (const t of topics) for (const g of genres) all.push({ topic: t[0], tname: t[1], genre: g.id, gname: g.name, tier: topicTier(t[0], g.id) });
  const good = all.filter((x) => x.tier === 'S'), bad = all.filter((x) => x.tier === 'X' || x.tier === 'K');
  const picks = [good.length && rng.pick(good), bad.length && rng.pick(bad), rng.pick(all)].filter(Boolean).slice(0, P(ctx).guide.count);
  if (!picks.length) return;
  for (const x of picks) ctx.state.knowledge[`tg|${x.topic}|${x.genre}`] = TIER[x.tier].v;
  ctx.news(`📰 Piksel Dergisi yıllık tür rehberi: ${picks.map((x) => `${x.tname} + ${x.gname} ${TIER[x.tier].icon}`).join(' · ')}`, 'info');
}

export function wire(ctx) {
  ctx.bus.on('researchCompleted', (item) => {
    if (!item?.genre) return;
    const st = ctx.state;
    st.gxp[item.genre] = Math.max(st.gxp[item.genre] || 0, P(ctx).researchXp);
    st.gxpLast[item.genre] = Math.floor(tableYear(ctx));
    ctx.news(`${genreById(ctx, item.genre).icon} ${genreById(ctx, item.genre).name} artık biliniyor. "${genreById(ctx, item.genre).soul}"`, 'good');
  });
}

// Araştırma indirimi: yakın bir türü bilen stüdyo %30 ucuza öğrenir.
export function researchDiscount(ctx, item) {
  if (!item.genre) return 1;
  const g = genreById(ctx, item.genre);
  return g?.near?.some((n) => knows(ctx, n)) ? P(ctx).nearDiscount : 1;
}
export { platCap };
