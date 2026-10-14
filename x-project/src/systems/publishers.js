// Yayıncılar (Konu B): kimlik, kademe, kapı, sunuş, toplantı, kurul, teklif, pazarlık, açık artırma, sözleşme,
// geri ödemeli avans, erken anlaşma ve kilometre taşları, sipariş, deneme işi, vitrin etkinlikleri, tavsiye, ajan,
// ilişki ve hafıza, iflas ve birleşme. Para defterden, rastgelelik tohumlu RNG'den; arayüz yalnız bu API'yi çağırır.
import { clamp, lerpTable, makeRng } from '../kernel.js';
import { COMPANIES, YEARS } from '../data/history.js';
import { TRAITS, HIST_PROFILES, EXTRA_PUBS, MERGERS, MEETING_QUESTIONS, SHOWCASES, JAM_THEMES } from '../data/publishers.js';
import { tableYear, inflation, review, peakWeekly, platformById, activePlatforms, platformBase } from '../models.js';
import { companyRep, isActive } from './world.js';
import * as Charts from './charts.js';

const P = (ctx) => ctx.pack.publishing;
export const MEMBERS = [['urun', 'Ürün'], ['pazar', 'Pazar'], ['finans', 'Finans'], ['hukuk', 'Hukuk']];
export const TIER_NAMES = ['Yabancı', 'Tanıdık', 'Ortak', 'Stratejik ortak'];
export const pubState = (state) => (state.pub ||= { rel: {}, mem: {}, used: {}, pitches: [], offers: [], rej: {}, late: {}, trialBan: {}, intro: {}, refBy: {}, orders: [], agent: null, multi: null, known: [], stats: { pitches: 0, rejects: 0, offers: 0, signed: 0 } });
const Y = (ctx) => Math.floor(tableYear(ctx));
const fmt$ = (n) => `${Math.round(n).toLocaleString('tr-TR')} $`;
const genreName = (ctx, id) => ctx.pack.genres.find((g) => g.id === id)?.name || id;
const projectOf = (ctx, pid) => ctx.state.projects.find((p) => p.id === pid);

// ---------- Kimlik: tarihî yayıncılar (güç şirket itibarından, zevk tarihî hitlerden) + kurgusal yayıncılar
const tasteCache = {};
function histTaste(ctx, cid) {
  if (tasteCache[cid]) return tasteCache[cid];
  const n = Object.fromEntries(ctx.pack.genres.map((g) => [g.id, 0]));
  for (const y in YEARS) for (const h of YEARS[y].g || []) if (h[1] === cid && n[h[2]] !== undefined) n[h[2]]++;
  const order = Object.entries(n).sort((a, b) => b[1] - a[1]);
  const likes = order.filter(([, c], i) => c > 0 && (i === 0 || c >= order[0][1] / 3)).slice(0, 2).map(([g]) => g);
  const zero = order.filter(([, c]) => c === 0).map(([g]) => g);
  const h = [...cid].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return (tasteCache[cid] = { likes, dislike: zero.length ? zero[h % zero.length] : null });
}
function decorate(ctx, p) {
  const t = P(ctx).tiers;
  p.tier = p.power >= t.big ? 'buyuk' : p.power >= t.mid ? 'orta' : 'kucuk';
  p.tierName = { buyuk: 'Büyük', orta: 'Orta', kucuk: 'Küçük' }[p.tier];
  p.tr = TRAITS[p.trait] || {};
  return p;
}
export function list(ctx, y = tableYear(ctx)) {
  const out = [];
  for (const c of COMPANIES) {
    if (!c.kind.includes('pub') || !isActive(c, y)) continue;
    const r = ctx.state.rivals?.find((x) => x.cid === c.id);
    if (r?.acquired) continue;
    const prof = HIST_PROFILES[c.id] || { region: ['na'], focus: ['konsol', 'pc'], trait: 'sadik' };
    const t = histTaste(ctx, prof.tasteFrom || c.id);
    out.push(decorate(ctx, { id: c.id, name: c.name, power: Math.round(clamp(r ? r.rep : companyRep(c, y), 5, 99)), hist: true, region: prof.region, focus: prof.focus, trait: prof.trait, likes: t.likes, dislike: t.dislike }));
  }
  for (const e of EXTRA_PUBS) if (y >= e.from && y < e.to) out.push(decorate(ctx, { ...e, power: Math.round(lerpTable(e.power, y)) }));
  return out.sort((a, b) => b.power - a.power);
}
export const byId = (ctx, id) => list(ctx).find((p) => p.id === id) || null;
export const pubName = (ctx, id) => byId(ctx, id)?.name || COMPANIES.find((c) => c.id === id)?.name || EXTRA_PUBS.find((e) => e.id === id)?.name || id;

// ---------- İlişki, kademe, hafıza
export const rel = (ctx, id) => pubState(ctx.state).rel[id] || 0;
export function tierOf(ctx, r) {
  const R = P(ctx).rel;
  if (r <= R.black) return { i: -1, name: 'Kara liste' };
  const i = r >= R.tiers[2] ? 3 : r >= R.tiers[1] ? 2 : r >= R.tiers[0] ? 1 : 0;
  return { i, name: TIER_NAMES[i] };
}
export function remember(ctx, id, t) {
  const m = (pubState(ctx.state).mem[id] ||= []);
  m.unshift({ y: Y(ctx), t });
  if (m.length > 5) m.length = 5;
}
export function relAdd(ctx, id, v, memo = null) {
  if (!id || !v) return;
  const s = pubState(ctx.state), R = P(ctx).rel;
  const cur = s.rel[id] || 0, before = tierOf(ctx, cur).i;
  if (v > 0) v *= cur >= R.tiers[2] ? 0.4 : cur >= R.tiers[1] ? 0.7 : 1; // yakın ilişki yavaş derinleşir
  s.rel[id] = Math.round(clamp(cur + v, R.min, R.max));
  if (memo) remember(ctx, id, memo);
  const after = tierOf(ctx, s.rel[id]).i;
  if (after > before && after >= 1) ctx.news(`🤝 ${pubName(ctx, id)} ile ilişki "${tierOf(ctx, s.rel[id]).name}" seviyesine çıktı.`, 'good');
  if (after === -1 && before > -1) ctx.news(`⛔ ${pubName(ctx, id)} seni kara listeye aldı. Sunuşlarını okumadan geri yollayacaklar.`, 'bad');
}
// Kapıyı tek seferlik atlatan tanışma (maraton, ödül jürisi, ajan) ya da ilişkiyi Tanıdık'a taşıyan mektup
export function introduce(ctx, id, why, v = P(ctx).referral.award) {
  const s = pubState(ctx.state);
  s.intro[id] = true;
  relAdd(ctx, id, Math.max(v, P(ctx).door.knownRel - rel(ctx, id)), `${why}`);
  ctx.news(`✉️ ${pubName(ctx, id)}'dan tanışma mektubu: "${why}. Kapımız açık."`, 'good');
}

// Stüdyo itibarı: son 5 oyunun notu, ilk 10'lar, hayran
export function itibar(ctx) {
  const R = P(ctx).reputation, st = ctx.state;
  const gs = st.games.filter((g) => !g.portOf && !g.expansion);
  if (!gs.length) return R.none;
  const last = gs.slice(-5), avg = last.reduce((a, g) => a + g.score, 0) / last.length;
  const top = gs.filter((g) => (g.bestRank ?? 999) <= 10).length;
  const fans = st.fans > 1000 ? Math.min(R.fansMax, R.fansK * Math.log10(st.fans / 1000)) : 0;
  return Math.round(clamp(avg + R.base + top * R.top10 + fans, R.min, R.max));
}
export const threshold = (ctx, pub) => P(ctx).thresholdA + P(ctx).thresholdK * pub.power + (pub.tr.e || 0);
export const slotsOf = (ctx, pub) => Math.max(P(ctx).slotsMin, Math.round(pub.power / P(ctx).slotsPer));
export function slotsUsed(ctx, pub) { const u = pubState(ctx.state).used[pub.id]; return u && u.y === Y(ctx) ? u.n : 0; }

// Kapı kuralı: güç < 60 herkese; 60–74 en az bir oyun ve eksi olmayan itibar; 75+ yalnız tanıştığı stüdyoya
export function door(ctx, pub) {
  const D = P(ctx).door, r = rel(ctx, pub.id), s = pubState(ctx.state);
  if (r <= P(ctx).rel.black) return { open: false, why: `${pub.name} seni kara listeye aldı; sunuşları okumadan geri yolluyor.` };
  if (s.multi && s.multi.left > 0 && s.multi.pubId === pub.id) return { open: true };
  if (pub.power < D.open) return { open: true };
  if (pub.power < D.known) {
    if (r >= D.knownRel || s.intro[pub.id]) return { open: true };
    const games = ctx.state.games.filter((g) => !g.portOf).length;
    return games >= 1 && itibar(ctx) >= 0 ? { open: true } : { open: false, why: `${pub.name} en az bir çıkmış oyun ve eksi olmayan itibar istiyor (itibarın ${itibar(ctx)}).` };
  }
  if (r >= D.knownRel || s.intro[pub.id]) return { open: true };
  return { open: false, why: `${pub.name} seni tanımıyor. Deneme işi, vitrin etkinliği, ödül ya da bir tavsiye kapıyı açar.` };
}

// ---------- Değerlendirme yardımcıları
// Erken sunuşta yayıncı yarım demoya ve stüdyonun geçmişine birlikte bakar (fazlar farklı disiplinlere çalıştığı için
// yarım projeden düz uzatma yanıltır).
export function trueEstimate(ctx, pj) {
  const fake = { ...ctx, rng: makeRng({ rng: 7 }) };
  if (pj.status === 'dev') {
    const k = pj.totalWeeks / Math.max(1, pj.week), pts = {};
    const tot = Object.values(pj.points).reduce((a, b) => a + b, 0) * k, g = ctx.pack.genres.find((x) => x.id === pj.genre);
    const wsum = Object.values(g.disc).reduce((a, b) => a + b, 0) || 1;
    for (const d in pj.points) pts[d] = Math.max(pj.points[d] * k, tot * (g.disc[d] || 0) / wsum);
    const demo = review(fake, { ...pj, points: pts, bugs: pj.bugs * k * 0.6 }).score;
    const past = ctx.state.games.filter((x) => !x.portOf).slice(-3);
    const track = past.length ? past.reduce((a, x) => a + x.score, 0) / past.length : demo;
    return Math.round((0.5 * demo + 0.5 * track) * 10) / 10;
  }
  return review(fake, pj).score;
}
export function errorSd(ctx, pub, mode, doc) {
  const E = P(ctx).err;
  return Math.max(2, (mode === 'erken' ? E.early : E.finished) * Math.max(E.relMin, 1 - rel(ctx, pub.id) / 100) - (doc ? E.doc : 0));
}
export function tasteOf(ctx, pub, pj) {
  let v = 0;
  const notes = [];
  if (pub.likes?.includes(pj.genre)) { v += 10; notes.push('like'); }
  if (pub.dislike === pj.genre) { v -= 10; notes.push('dislike'); }
  if (pj.regions && pub.region && !pub.region.some((r) => pj.regions.includes(r))) { v -= 5; notes.push('region'); }
  const kinds = (pj.platforms || []).map((id) => platformById(ctx, id)?.kind).filter(Boolean);
  if (kinds.length && pub.focus && !kinds.some((k) => pub.focus.includes(k))) { v -= 10; notes.push('focus'); }
  return { v, notes };
}
const novelCombo = (ctx, pj) => !ctx.state.games.some((g) => g.topic === pj.topic && g.genre === pj.genre);
function rightsOwner(ctx, pj) {
  const ipId = pj.sequelOf ?? (pj.baseGameId ? ctx.state.games.find((g) => g.id === pj.baseGameId)?.ipId : null);
  const ip = ipId != null ? ctx.state.ips.find((x) => x.id === ipId) : null;
  return ip?.rightsPub || null;
}
export const defaultPrice = (ctx) => Math.max(10, Math.round(20 * inflation(ctx) ** 0.4));

// Yayıncının gözünden beklenen satış: oyunun gölge kopyası yayılma eğrisiyle ilerletilir.
function shadow(ctx, pj, power, score, promo = 0) {
  const st = ctx.state, pk = ctx.pack;
  const ipId = pj.sequelOf ?? null;
  const ip = ipId != null ? st.ips.find((x) => x.id === ipId) : null;
  const g = { score, price: defaultPrice(ctx), hype: Math.min(pk.hype.max, (pj.hype || 0) + promo), ipValue: ip?.value || 0, publisherPower: power, platforms: pj.platforms, size: pj.size,
    genre: pj.genre, audience: pj.audience, topic: pj.topic, regions: pj.regions, pirated: !st.research.done.kopya_koruma, bugRate: 0.01, weeks: 0 };
  g.peak = peakWeekly(ctx, g);
  if (pj.kind === 'ek') for (const k in g.peak) g.peak[k] *= pk.post.expansionSales;
  const D = pk.charts.diffusion;
  Charts.initDif(ctx, g, Charts.playerPQ(ctx, g), g.pirated ? D.lifeWeeksPirated : D.lifeWeeks);
  return { u12: Charts.expectedUnits(ctx, g, P(ctx).advWeeks), life: Charts.expectedUnits(ctx, g, P(ctx).lifeWeeks), price: g.price };
}
// Tahmini geliştirme bedeli (maaşlar + lisans), erken anlaşmanın finansmanı için
export function projectedCost(ctx, pj) {
  const done = Math.max(0.15, pj.status === 'dev' ? pj.week / pj.totalWeeks : 1);
  return Math.round((pj.cost || 0) / done);
}
export function basePay(ctx, pub, mode = 'bitmis') {
  const B = P(ctx);
  const ti = Math.max(0, tierOf(ctx, rel(ctx, pub.id)).i);
  return B.payBase - B.payPowerK * pub.power + B.tierPay[ti] + (pub.tr.pay || 0) + (mode === 'erken' ? B.earlyPay : 0);
}
export function promoOf(ctx, pub, pj) {
  const M = P(ctx).promo;
  const like = pub.likes?.includes(pj.genre) ? M.like : 0;
  return Math.round(Math.min(M.max, (M.base + M.k * pub.power / 100 + like) * (tierOf(ctx, rel(ctx, pub.id)).i >= 2 ? M.partner : 1)));
}
// Teklif koşulları. kind: 'tam' (telif + avans), 'tek' (tek seferlik satış); mode: 'bitmis' | 'erken'
export function terms(ctx, pub, pj, kind, mode, est) {
  const B = P(ctx), s = pubState(ctx.state);
  let pay = basePay(ctx, pub, mode);
  const rights = pub.tr.rights ? 'yayinci' : 'sende';
  if (rights === 'yayinci') pay += B.rightsPay;
  if (s.multi && s.multi.pubId === pub.id && s.multi.left > 0) pay += B.multiPay;
  pay = Math.round(clamp(pay, B.payMin, B.payMax));
  const promo = promoOf(ctx, pub, pj);
  const sh = shadow(ctx, pj, pub.power, est, promo);
  const perUnit = sh.price * B.net * pay / 100;
  const adv = kind === 'tam' && mode === 'bitmis' ? Math.round(sh.u12 * perUnit * (pub.tr.adv || 1)) : 0;
  const buyout = kind === 'tek' ? Math.round(sh.life * perUnit * B.buyoutShare) : 0;
  const fund = mode === 'erken' ? Math.round(projectedCost(ctx, pj) * (B.fund[0] + (B.fund[1] - B.fund[0]) * ctx.rng.next())) : 0;
  return { pay, adv, buyout, fund, rights, promo, expUnits: sh.life, units12: sh.u12, price: sh.price };
}
// Kart için kaba tahmin (RNG kullanmaz)
export function preview(ctx, pub, pj) {
  if (!pj) return { pay: Math.round(clamp(basePay(ctx, pub), P(ctx).payMin, P(ctx).payMax)) };
  const est = trueEstimate(ctx, pj);
  const pay = Math.round(clamp(basePay(ctx, pub, pj.status === 'dev' ? 'erken' : 'bitmis') + (pub.tr.rights ? P(ctx).rightsPay : 0), P(ctx).payMin, P(ctx).payMax));
  const sh = shadow(ctx, pj, pub.power, est, promoOf(ctx, pub, pj));
  const sd = errorSd(ctx, pub, pj.status === 'dev' ? 'erken' : 'bitmis', false);
  return { pay, adv: Math.round(sh.u12 * sh.price * P(ctx).net * pay / 100 * (pub.tr.adv || 1)), est, lo: Math.round(est - sd), hi: Math.round(est + sd), E: Math.round(threshold(ctx, pub)), retail: pay * P(ctx).net };
}

// ---------- Sunuş
export function canPitch(ctx, pj, pub, mode = 'bitmis') {
  const B = P(ctx), s = pubState(ctx.state), w = ctx.state.week;
  if (!pj) return { ok: false, why: 'Proje yok.' };
  if (pj.deal) return { ok: false, why: `"${pj.name}" için ${pj.deal.pubName} ile sözleşme zaten var.` };
  if (mode === 'bitmis' && pj.status !== 'debug') return { ok: false, why: 'Bitmiş oyun sunuşu için içerik bitmeli.' };
  if (mode === 'erken') {
    if (pj.status !== 'dev' || pj.phase < 1) return { ok: false, why: 'Erken anlaşma konsept fazı bitince ve geliştirme sürerken yapılır.' };
    if (rel(ctx, pub.id) < B.rel.tiers[1] && !(s.multi?.pubId === pub.id)) return { ok: false, why: `Erken anlaşma için ${pub.name} ile en az "Ortak" olmalısınız.` };
  }
  const d = door(ctx, pub);
  if (!d.open) return { ok: false, why: d.why };
  if (s.multi && s.multi.left > 0 && s.multi.pubId !== pub.id) return { ok: false, why: `${pubName(ctx, s.multi.pubId)} ile üç oyunluk anlaşman sürüyor.` };
  const owner = rightsOwner(ctx, pj);
  if (owner && owner !== pub.id) return { ok: false, why: `Serinin hakları ${pubName(ctx, owner)}'da; devam oyununu yalnız onlar yayınlar.` };
  const live = s.pitches.filter((p) => p.pid === pj.id);
  if (live.some((p) => p.pubId === pub.id) || s.offers.some((o) => o.pid === pj.id && o.pubId === pub.id)) return { ok: false, why: 'Bu yayıncı zaten dosyana bakıyor.' };
  if (live.length >= B.maxPitches) return { ok: false, why: `Bir oyun aynı anda en çok ${B.maxPitches} yayıncıya sunulur.` };
  const rj = s.rej[`${pj.id}:${pub.id}`];
  if (rj && w < rj.week + B.cooldown && trueEstimate(ctx, pj) < rj.est + B.resubmitGain) return { ok: false, why: `${pub.name} bu oyunu ${rj.week + B.cooldown - w} hafta daha görmek istemiyor (ya da oyunu belirgin iyileştir).` };
  return { ok: true };
}
export const prepCost = (ctx, doc, note) => (pubState(ctx.state).agent ? 0 : Math.round(((doc ? 1 : 0) + (note ? 1 : 0)) * P(ctx).prepCost * inflation(ctx) ** 0.5));
export function pitch(ctx, pid, pubIds, { mode = 'bitmis', doc = false, note = false } = {}) {
  const { state, rng, ledger } = ctx, s = pubState(state), B = P(ctx);
  const pj = projectOf(ctx, pid);
  if (!pj) return { ok: false, msg: 'Proje yok.' };
  if (s.agent) { doc = true; note = true; }
  const pubs = (pubIds || []).map((id) => byId(ctx, id)).filter(Boolean);
  if (!pubs.length) return { ok: false, msg: 'En az bir yayıncı seç.' };
  for (const pub of pubs) { const c = canPitch(ctx, pj, pub, mode); if (!c.ok) return { ok: false, msg: c.why }; }
  if (s.pitches.filter((p) => p.pid === pid).length + pubs.length > B.maxPitches) return { ok: false, msg: `En çok ${B.maxPitches} yayıncı.` };
  const cost = prepCost(ctx, doc, note);
  if (cost && state.cash < cost) return { ok: false, msg: `Dosya hazırlığı ${fmt$(cost)}.` };
  if (cost) { ledger.post('pazarlama', -cost, `${pj.name}: sunuş dosyası`); pj.cost = (pj.cost || 0) + cost; }
  const prep = doc || note ? B.prepWeeks : 0;
  const base = trueEstimate(ctx, pj);
  for (const pub of pubs) {
    const sd = errorSd(ctx, pub, mode, doc);
    const nq = pub.tier === 'buyuk' ? B.meet.big : pub.tier === 'orta' ? B.meet.mid : 0;
    const multi = s.multi && s.multi.left > 0 && s.multi.pubId === pub.id;
    s.pitches.push({ id: state.nextId++, pid, pubId: pub.id, mode, doc, note, week: state.week, est: Math.round(clamp(base + rng.normal(0, sd), 1, 100) * 10) / 10,
      due: state.week + (multi ? 1 : prep + rng.int(...B.respWeeks) + (pub.tr.slow || 0)), qs: multi ? [] : pickQuestions(ctx, pub, nq), meet: {}, multi });
    s.stats.pitches++;
  }
  ctx.news(`📨 "${pj.name}" ${pubs.map((p) => p.name).join(', ')} yayıncısına sunuldu. Cevaplar birkaç hafta içinde gelir.`, 'info');
  return { ok: true };
}
function pickQuestions(ctx, pub, n) {
  if (!n) return [];
  const qs = MEETING_QUESTIONS.filter((q) => !q.chaos || ctx.state.kaos >= 50);
  const pref = qs.filter((q) => q.traits?.includes(pub.trait) || q.chaos);
  const rest = qs.filter((q) => !pref.includes(q));
  const out = [];
  for (const pool of [pref, rest]) {
    const p = [...pool];
    while (p.length && out.length < n) out.push(p.splice(Math.floor(ctx.rng.next() * p.length), 1)[0].id);
  }
  return out;
}

// ---------- Toplantı (sınav): cevaplar projenin gerçek verisine göre puanlanır; blöf yakalanabilir.
function answersFor(ctx, qid, pj, pub, pt) {
  const st = ctx.state, tr = pub.trait;
  const remaining = Math.max(0, projectedCost(ctx, pj) - (pj.cost || 0));
  switch (qid) {
    case 'kitle': return ctx.pack.audiences.map((a) => ({ label: a.name, m: 'pazar', v: a.id === pj.audience ? 5 : -4 }));
    case 'butce': return [
      { label: 'Kapsamı daraltırız', m: 'finans', v: tr === 'burokratik' ? 5 : 3 },
      { label: 'Kendi cebimizden öderiz', m: 'finans', v: 8, bluff: st.cash < remaining + 5000 },
      { label: 'Ek bütçe isteriz', m: 'finans', v: tr === 'kumarbaz' ? 3 : -5 }];
    case 'tarih': return [
      { label: 'Gerçekçi bir tarih veririz', m: 'finans', v: tr === 'burokratik' ? 8 : 4 },
      { label: 'İddialı: herkesten önce!', m: 'pazar', v: tr === 'burokratik' ? -4 : 4, ambitious: true },
      { label: 'Belirsiz, oyun hazır olunca', m: 'finans', v: -6 }];
    case 'neden': {
      const known = st.games.filter((g) => g.genre === pj.genre).length >= 2;
      const star = st.staff.some((p) => p.skill >= 75);
      const novel = novelCombo(ctx, pj);
      return [
        { label: 'Bu türü biliyoruz', m: 'urun', v: 6, bluff: !known },
        { label: 'Yıldız bir ekibimiz var', m: 'urun', v: 6, bluff: !star },
        { label: 'Yenilikçi bir fikrimiz var', m: 'urun', v: tr === 'vizyoner' ? 9 : 4, bluff: !novel }];
    }
    case 'rakip': {
      const h = Charts.upcoming(ctx).filter((x) => x.genre === pj.genre).sort((a, b) => a.weeks - b.weeks)[0];
      return [
        { label: 'Tarihi kaydırırız', m: 'pazar', v: 4 },
        { label: 'Biz farklıyız', m: 'pazar', v: h ? 2 : 4 },
        { label: 'Biz daha iyiyiz', m: 'pazar', v: 7, bluff: !!h && pt.est < h.score }];
    }
    case 'yangin': return [
      { label: 'Dürüstçe anlatırız', m: 'finans', v: -3, rel: 2 },
      { label: 'Ört bas ederiz: "Hangi yangın?"', m: 'finans', v: 4, bluff: true }];
  }
  return [{ label: 'Tamam', m: 'urun', v: 0 }];
}
function rivalLine(ctx, pj) {
  const h = Charts.upcoming(ctx).filter((x) => x.genre === pj.genre).sort((a, b) => a.weeks - b.weeks)[0];
  return h ? ` ("${h.name}" ${h.weeks} hafta sonra çıkıyor)` : '';
}
function queueMeeting(ctx, pt) {
  const pj = projectOf(ctx, pt.pid), pub = byId(ctx, pt.pubId);
  if (!pj || !pub) return;
  pt.qs.forEach((qid, i) => {
    const q = MEETING_QUESTIONS.find((x) => x.id === qid);
    const ans = answersFor(ctx, qid, pj, pub, pt);
    ctx.queue({ id: 'pubmeet', title: `🤝 ${pub.name} toplantısı (${i + 1}/${pt.qs.length})`,
      text: `"${pj.name}" için kurul karşında. ${MEMBERS.find((m) => m[0] === q.who)[1]} üyesi soruyor: "${q.q}"${qid === 'rakip' ? rivalLine(ctx, pj) : ''}`,
      choices: ans.map((a) => ({ label: a.label, effects: { pubMeet: { pitch: pt.id, m: a.m, v: a.v, bluff: !!a.bluff, rel: a.rel || 0, ambitious: !!a.ambitious } } })) });
  });
}
export function meetAnswer(ctx, a) {
  const s = pubState(ctx.state), M = P(ctx).meet;
  const pt = s.pitches.find((x) => x.id === a.pitch);
  if (!pt) return;
  let v = a.v;
  if (a.bluff) {
    const p = clamp(M.catchBase + rel(ctx, pt.pubId) * M.catchRel, M.catchMin, M.catchMax);
    if (ctx.rng.chance(p)) { v = M.caught; relAdd(ctx, pt.pubId, M.caughtRel, 'Toplantıda blöf yaptın, yakalandın'); ctx.news(`🙊 ${pubName(ctx, pt.pubId)} blöfünü yakaladı. Toplantı odası bir anda soğudu.`, 'bad'); }
  }
  pt.meet[a.m] = (pt.meet[a.m] || 0) + v;
  if (a.rel) relAdd(ctx, pt.pubId, a.rel);
  if (a.ambitious) pt.ambitious = true;
}

// ---------- Kurul: dört üye kendi alanına bakar
export function evaluate(ctx, pt) {
  const st = ctx.state, B = P(ctx), s = pubState(st);
  const pub = byId(ctx, pt.pubId), pj = projectOf(ctx, pt.pid);
  if (!pub || !pj) return null;
  const E = threshold(ctx, pub), N = pt.est, d = N - E;
  const it = itibar(ctx), r = rel(ctx, pub.id), ta = tasteOf(ctx, pub, pj);
  const devs = st.staff.filter((p) => p.status !== 'ayrildi');
  const avgSkill = devs.length ? devs.reduce((a, p) => a + p.skill, 0) / devs.length : 30;
  const team = clamp((avgSkill - 40) / 10, -3, 5);
  const trend = st.trend && (st.trend.genre === pj.genre || st.trend.topic === pj.topic) ? 4 : 0;
  const full = slotsUsed(ctx, pub) >= slotsOf(ctx, pub);
  const lates = s.late[pub.id] || 0;
  const owner = rightsOwner(ctx, pj);
  const clone = (st.world?.hits || []).some((h) => h.genre === pj.genre && h.score >= 85 && st.week - h.week < 48) && !novelCombo(ctx, pj) ? -4 : 0;
  const m = pt.meet || {}, jit = B.jitter + (pub.tr.jitter || 0);
  const sc = {
    urun: d + (pt.doc ? 5 : 0) + team + (pub.tr.novel && novelCombo(ctx, pj) ? pub.tr.novel : 0) + (m.urun || 0),
    pazar: d / 2 + 6 + ta.v * 1.2 + trend + (full ? B.slotsFull : 0) + (pt.note ? 5 : 0) + Math.min(5, (Charts.mkt(st).genreRep?.[pj.genre] || 0) / 2) + (m.pazar || 0),
    finans: d / 3 + it + r / 5 - lates * 4 * (pub.tr.lateK || 1) + (st.cash < 0 ? -6 : 0) + (m.finans || 0),
    hukuk: d / 4 + 8 + r / 10 + (owner && owner !== pub.id ? -30 : 0) + clone + (m.hukuk || 0),
  };
  for (const k in sc) sc[k] = Math.round((sc[k] + ctx.rng.normal(0, jit)) * 10) / 10;
  const black = r <= B.rel.black;
  const votes = Object.fromEntries(Object.entries(sc).map(([k, v]) => [k, !black && v > 0]));
  const yes = Object.values(votes).filter(Boolean).length, need = pub.tr.need || B.need;
  let verdict = 'ret';
  if (pt.multi) verdict = 'tam';
  else if (!black && yes >= need) verdict = votes.finans ? 'tam' : 'tek';
  else if (!black && yes === need - 1) verdict = 'degisiklik';
  return { pub, pj, E, N, d, sc, votes, yes, need, verdict, ta, full, it, r, black };
}
const VOTE_LINE = (ev) => MEMBERS.map(([k, n]) => `${n} ${ev.votes[k] ? '✓' : '✗'}`).join(' · ');
// Ret mektubu: en zayıf üye ve somut bir ipucu
function rejectLetter(ctx, ev) {
  const { pub, pj } = ev;
  if (ev.black) return 'Zarfı açmadık. Açmayacağız da.';
  const weakest = Object.entries(ev.sc).sort((a, b) => a[1] - b[1])[0][0];
  const parts = review({ ...ctx, rng: makeRng({ rng: 7 }) }, pj).parts;
  const low = Object.entries(parts).sort((a, b) => a[1] - b[1])[0];
  const dn = { oyn: 'Oynanış', gfx: 'Grafikler', ses: 'Ses', tek: 'Teknik' }[low[0]];
  if (weakest === 'urun') return `Demonuzu oynadık. Sonra bir süre pencereden dışarı baktık. (${dn} hedefin %${low[1]}'inde; çıtamız ~${Math.round(ev.E)}.)`;
  if (weakest === 'pazar') {
    if (ev.ta.notes.includes('dislike')) return `${genreName(ctx, pj.genre)} mi? Biz ${genreName(ctx, pj.genre).toLowerCase()} oynayanları toplantıya bile almayız.`;
    if (ev.ta.notes.includes('focus')) return 'O platformda dağıtımımız yok. Kargo kutusu bile gönderemiyoruz.';
    if (ev.full) return `Bu yıl takvimimiz dolu (${slotsOf(ctx, pub)} oyun). Ocak'ta tekrar deneyin.`;
    if (ev.ta.notes.includes('region')) return 'Sizin bölgenizde dağıtımımız yok. Haritayı ters tutmuşuz galiba.';
    return 'Pazarlama ekibimiz bu oyunu kime satacağını bulamadı. Hâlâ arıyorlar.';
  }
  if (weakest === 'finans') {
    if ((pubState(ctx.state).late[pub.id] || 0) > 0) return 'Geçen sefer tarihi kaçırdınız. Ajandamız hâlâ o sayfada açık.';
    if (ev.it < 0) return 'Sizi tanımıyoruz. Annenizden referans mektubu da kabul ediyoruz.';
    return 'Finans ekibimiz rakamlara baktı ve sessizce odadan çıktı.';
  }
  return 'Hukuk ekibimizin "hayır" demek için 14 sayfalık bir gerekçesi var. Size de bir kopya yolladık.';
}

const CHANGES = {
  cila: { name: '4 hafta daha cilalayın', desc: 'Çıkış 4 hafta gecikir, oyun biraz iyileşir.' },
  kitle: { name: 'Kitleyi "Herkes" yapın', desc: 'Kitle değişir; yetişkin hayranlar biraz küser.' },
  fiyat: { name: 'Fiyatı düşürün', desc: 'Fiyat en çok varsayılanın %80\'i olur.' },
  ad: { name: 'Adını değiştirin', desc: 'Bedava ama komik.' },
  seri: { name: 'Seri haklarını bize verin', desc: 'Pay +3 puan; devam oyunu onların elinde.' },
};
export const changeInfo = (id) => CHANGES[id];
function pickChange(ctx, pj, pub, ev) {
  const opts = [];
  if (pj.status === 'debug' && ev.sc.urun <= 0) opts.push('cila');
  if (pj.audience !== 'herkes' && ev.sc.pazar <= 0) opts.push('kitle');
  if (ev.sc.pazar <= 0 || ev.sc.finans <= 0) opts.push('fiyat');
  if (!pub.tr.rights && !rightsOwner(ctx, pj)) opts.push('seri');
  opts.push('ad');
  return ctx.rng.pick(opts);
}

function respond(ctx, pt) {
  const s = pubState(ctx.state), B = P(ctx), w = ctx.state.week;
  const ev = evaluate(ctx, pt);
  s.pitches = s.pitches.filter((x) => x !== pt);
  if (!ev) return;
  const { pub, pj } = ev;
  if (ev.verdict === 'ret') {
    const key = `${pj.id}:${pub.id}`, old = s.rej[key];
    s.rej[key] = { week: w, est: trueEstimate(ctx, pj), n: (old?.n || 0) + 1 };
    if (s.rej[key].n >= 3) relAdd(ctx, pub.id, B.rel.thirdReject, `"${pj.name}" üçüncü kez geri çevrildi`);
    s.stats.rejects++;
    ctx.news(`📪 ${pub.name}: "${pj.name}" reddedildi. ${VOTE_LINE(ev)}. "${rejectLetter(ctx, ev)}"`, 'bad');
    (pj.letters ||= []).unshift({ w, pub: pub.name, ok: false, votes: ev.votes, text: rejectLetter(ctx, ev) });
    return;
  }
  const t = terms(ctx, pub, pj, ev.verdict === 'tek' ? 'tek' : 'tam', pt.mode, ev.N);
  const other = s.offers.filter((o) => o.pid === pj.id && o.kind === 'tam').length;
  const offer = { id: ctx.state.nextId++, pid: pj.id, pubId: pub.id, pubName: pub.name, kind: ev.verdict, mode: pt.mode, ...t, votes: ev.votes, margin: Math.round(ev.d), est: ev.N,
    expires: w + B.offerWeeks, rounds: 0, koz: Math.min(B.kozMax, other), ambitious: !!pt.ambitious, change: ev.verdict === 'degisiklik' ? pickChange(ctx, pj, pub, ev) : null, multi: !!pt.multi };
  if (ev.verdict === 'degisiklik') offer.after = ev.votes.finans ? 'tam' : 'tek';
  s.offers.push(offer);
  s.stats.offers++;
  const what = ev.verdict === 'tam' ? `telif teklifi: netin %${t.pay}'i${t.adv ? `, avans ${fmt$(t.adv)}` : ''}${t.fund ? `, finansman ${fmt$(t.fund)}` : ''}`
    : ev.verdict === 'tek' ? `tek seferlik satış teklifi: ${fmt$(t.buyout)} peşin` : `şartlı ilgi: "${CHANGES[offer.change].name}"`;
  ctx.news(`📬 ${pub.name} "${pj.name}" için ${what}. ${VOTE_LINE(ev)}`, 'good');
  (pj.letters ||= []).unshift({ w, pub: pub.name, ok: true, votes: ev.votes, text: what });
  if (pj.letters.length > 8) pj.letters.length = 8;
}

// ---------- Teklifler: değişiklik isteği, pazarlık, açık artırma, imza
export function acceptChange(ctx, offerId, yes = true) {
  const s = pubState(ctx.state), o = s.offers.find((x) => x.id === offerId);
  if (!o || o.kind !== 'degisiklik') return { ok: false, msg: 'Değişiklik isteği yok.' };
  const pj = projectOf(ctx, o.pid);
  if (!pj) return { ok: false, msg: 'Proje yok.' };
  if (!yes) { s.offers = s.offers.filter((x) => x !== o); ctx.news(`🙅 ${o.pubName}'ın isteğini geri çevirdin. Masadan kalktılar.`, 'info'); return { ok: true }; }
  switch (o.change) {
    case 'cila': for (const d in pj.points) pj.points[d] *= 1.05; pj.hold = ctx.state.week + 4; break;
    case 'kitle': pj.audience = 'herkes'; ctx.state.fans = Math.round(ctx.state.fans * 0.98); break;
    case 'fiyat': pj.maxPrice = Math.round(defaultPrice(ctx) * 0.8); break;
    case 'ad': pj.name = ctx.rng.pick([`Süper ${pj.name} 64`, `${pj.name}: Turbo Sürüm`, `Mega ${pj.name} Ultra`, `${pj.name} DX`]); break;
    case 'seri': o.rights = 'yayinci'; o.pay = Math.min(P(ctx).payMax, o.pay + P(ctx).rightsPay); break;
  }
  o.kind = o.after;
  const pub = byId(ctx, o.pubId);
  if (pub) Object.assign(o, terms(ctx, pub, pj, o.kind, o.mode, o.est), o.change === 'seri' ? { rights: 'yayinci' } : {});
  if (o.change === 'seri' && pub) o.pay = Math.min(P(ctx).payMax, o.pay + (pub.tr.rights ? 0 : P(ctx).rightsPay));
  o.expires = ctx.state.week + P(ctx).offerWeeks;
  ctx.news(`✍️ ${o.pubName} değişikliği onayladı; teklif masada.`, 'good');
  return { ok: true };
}
export function negChance(ctx, o, move) {
  const N = P(ctx).neg, pub = byId(ctx, o.pubId);
  if (!pub) return 0;
  const t = pub.trait, base = N.base + o.margin * N.kE + o.koz * N.koz;
  let p = 0;
  switch (move) {
    case 'pay': p = base + (t === 'cimri' ? -15 : 0); break;
    case 'adv': p = base + (t === 'kumarbaz' ? 15 : t === 'burokratik' ? -10 : 0); break;
    case 'rights': p = N.rightsBase + rel(ctx, o.pubId) / 2 + (t === 'seri' ? -20 : 0); break;
    case 'date': p = N.dateBase + (t === 'burokratik' ? -20 : 0); break;
    case 'dagitim': p = 40 + rel(ctx, o.pubId) / 2 + (t === 'cimri' ? 10 : 0); break;
    case 'rakip': p = N.rival * 100; break;
    default: return 0;
  }
  return clamp(Math.round(p), N.min, N.max);
}
export function negMoves(ctx, o) {
  const s = pubState(ctx.state), B = P(ctx);
  if (o.kind !== 'tam' || o.rounds >= B.neg.rounds || o.multi) return [];
  const mv = [];
  if (o.pay < B.payMax) mv.push({ id: 'pay', name: `Daha yüksek pay (+2 → %${Math.min(B.payMax, o.pay + 2)})` });
  if (o.adv > 0) mv.push({ id: 'adv', name: `Daha büyük avans (×1,5 → ${fmt$(o.adv * 1.5)})` });
  if (o.rights === 'yayinci') mv.push({ id: 'rights', name: 'Seri haklarım bende kalsın' });
  if (o.mode === 'erken') mv.push({ id: 'date', name: 'Tarih esnekliği (+8 hafta)' });
  if (!o.dist && ctx.state.research.done.oz_yayin && rel(ctx, o.pubId) >= B.rel.tiers[0] && o.mode === 'bitmis') mv.push({ id: 'dagitim', name: `Dağıtım anlaşması (netin %${B.distPay}'i; basım ve reklam sende)` });
  const rival = s.offers.filter((x) => x.pid === o.pid && x.id !== o.id && x.kind === 'tam').sort((a, b) => b.pay - a.pay)[0];
  if (rival) mv.push({ id: 'rakip', name: `Rakip teklifi masaya koy (${rival.pubName}: %${rival.pay})` });
  return mv.map((m) => ({ ...m, p: negChance(ctx, o, m.id) }));
}
export function negotiate(ctx, offerId, move) {
  const s = pubState(ctx.state), B = P(ctx);
  const o = s.offers.find((x) => x.id === offerId);
  if (!o) return { ok: false, msg: 'Teklif yok.' };
  const mv = negMoves(ctx, o).find((m) => m.id === move);
  if (!mv) return { ok: false, msg: 'Bu hamle şu an yapılamaz.' };
  o.rounds++;
  if (ctx.rng.next() * 100 < mv.p) {
    if (move === 'pay') o.pay = Math.min(B.payMax, o.pay + 2);
    if (move === 'adv') o.adv = Math.round(o.adv * 1.5);
    if (move === 'rights') { o.rights = 'sende'; o.pay = Math.max(B.payMin, o.pay - B.rightsPay); }
    if (move === 'date') o.dateFlex = 8;
    if (move === 'dagitim') { o.dist = true; o.pay = B.distPay; o.adv = 0; o.promo = 0; }
    if (move === 'rakip') { const r = s.offers.filter((x) => x.pid === o.pid && x.id !== o.id && x.kind === 'tam').sort((a, b) => b.pay - a.pay)[0]; o.pay = Math.min(B.payMax, Math.max(o.pay, r.pay) + (ctx.rng.chance(0.5) ? 1 : 0)); }
    ctx.news(`🤝 ${o.pubName} pazarlıkta geri adım attı: ${mv.name}.`, 'good');
    return { ok: true, won: true };
  }
  relAdd(ctx, o.pubId, B.rel.negFail);
  const pub = byId(ctx, o.pubId);
  if (ctx.rng.chance(pub?.tr.withdraw || B.neg.withdraw)) {
    s.offers = s.offers.filter((x) => x !== o);
    ctx.news(`💨 ${o.pubName} açgözlülüğüne bozuldu ve teklifini geri çekti.`, 'bad');
    return { ok: true, won: false, withdrawn: true };
  }
  ctx.news(`😐 ${o.pubName}: "Hayır." Teklif aynen duruyor.`, 'info');
  return { ok: true, won: false };
}
export function auction(ctx, pid) {
  const s = pubState(ctx.state), B = P(ctx);
  const offers = s.offers.filter((o) => o.pid === pid && o.kind === 'tam' && !o.dist);
  if (offers.length < 2) return { ok: false, msg: 'Açık artırma için en az iki tam teklif gerekir.' };
  const ceil = (o) => Math.min(B.payMax, o.pay + Math.max(0, Math.round(o.margin / 3)) + (byId(ctx, o.pubId)?.tr.ceil || 0) + 2);
  for (const o of offers) { o.ceil = ceil(o); o.auction = true; }
  let moved = true;
  while (moved) {
    moved = false;
    const top = Math.max(...offers.map((o) => o.pay));
    for (const o of offers) if (o.pay < top && o.pay + 2 <= o.ceil) { o.pay = Math.min(o.ceil, top + 2); moved = true; }
  }
  const best = [...offers].sort((a, b) => b.pay - a.pay)[0];
  ctx.news(`🔨 Açık artırma bitti: ${offers.map((o) => `${o.pubName} %${o.pay}`).join(', ')}. En yüksek: ${best.pubName}.`, 'good');
  return { ok: true, best: best.id };
}
export function decline(ctx, offerId) {
  const s = pubState(ctx.state), o = s.offers.find((x) => x.id === offerId);
  if (!o) return { ok: false };
  s.offers = s.offers.filter((x) => x !== o);
  if (o.kind !== 'degisiklik') relAdd(ctx, o.pubId, P(ctx).rel.decline * (byId(ctx, o.pubId)?.trait === 'sadik' ? 3 : 1));
  return { ok: true };
}
export function sign(ctx, offerId) {
  const { state, ledger, rng } = ctx, s = pubState(state), B = P(ctx);
  const o = s.offers.find((x) => x.id === offerId);
  if (!o) return { ok: false, msg: 'Teklif yok.' };
  if (o.kind === 'degisiklik') return { ok: false, msg: 'Önce değişiklik isteğine cevap ver.' };
  if (o.kind === 'siparis') return acceptOrder(ctx, o);
  const pj = projectOf(ctx, o.pid);
  if (!pj) { s.offers = s.offers.filter((x) => x !== o); return { ok: false, msg: 'Proje yok.' }; }
  if (pj.deal) return { ok: false, msg: 'Bu oyun için zaten sözleşme var.' };
  const pub = byId(ctx, o.pubId);
  const deal = { pubId: o.pubId, pubName: o.pubName, power: pub?.power ?? 50, kind: o.kind, mode: o.mode, pay: o.pay, adv: o.adv, buyout: o.buyout, fund: o.fund, rights: o.rights,
    promo: o.promo, expUnits: o.expUnits, paid: 0, owed: 0, dist: !!o.dist, ms: 0, signed: state.week, hit: false, multi: !!o.multi };
  const rest = o.mode === 'erken' ? pj.totalWeeks - pj.week : 0;
  deal.due = state.week + (o.mode === 'erken' ? rest + B.dueSlack - (o.ambitious ? 4 : 0) + (o.dateFlex || 0) : B.finishedDue);
  if (o.kind === 'tek') { ledger.post('yayinci', o.buyout, `${o.pubName}: "${pj.name}" tek seferlik satış`); deal.paid += o.buyout; }
  if (o.adv) {
    const ag = s.agent;
    if (ag?.tier === 'cheap' && rng.chance(state.kaos * B.agent.cheap.scamKaos)) {
      s.agent = null;
      ctx.news(`🕵️ Ajanın ${o.pubName} avansıyla (${fmt$(o.adv)}) birlikte ortadan kayboldu. Telefonu da kapalı. Avans yine de telifinden düşülecek.`, 'bad');
    } else ledger.post('yayinci', o.adv, `${o.pubName} avansı`);
    deal.paid += o.adv; deal.owed += o.adv;
  }
  if (o.mode === 'erken') { const m0 = Math.round(o.fund * B.milestones[0]); ledger.post('yayinci', m0, `${o.pubName}: "${pj.name}" 1. kilometre taşı`); deal.paid += m0; deal.owed += m0; deal.ms = 1; }
  if (o.promo) pj.hype = Math.min(ctx.pack.hype.max, (pj.hype || 0) + o.promo);
  pj.deal = deal;
  const u = s.used[o.pubId];
  s.used[o.pubId] = { y: Y(ctx), n: u && u.y === Y(ctx) ? u.n + 1 : 1 };
  for (const x of s.offers) if (x.pid === o.pid && x.id !== o.id && x.auction && o.auction) relAdd(ctx, x.pubId, B.rel.auctionLoss * (byId(ctx, x.pubId)?.trait === 'sadik' ? 3 : 1), `"${pj.name}" açık artırmasını kaybetti`);
  s.offers = s.offers.filter((x) => x.pid !== o.pid);
  s.pitches = s.pitches.filter((x) => x.pid !== o.pid);
  if (s.intro[o.pubId]) delete s.intro[o.pubId];
  s.stats.signed++;
  remember(ctx, o.pubId, `"${pj.name}" için anlaştınız (${o.kind === 'tek' ? 'tek seferlik' : o.dist ? 'dağıtım' : `netin %${o.pay}'i`})`);
  ctx.news(`🖋️ "${pj.name}" için ${o.pubName} ile sözleşme imzalandı${o.kind === 'tek' ? ` (tek seferlik ${fmt$(o.buyout)})` : `: netin %${o.pay}'i (fiyatın ~%${Math.round(o.pay * B.net)}'i)`}.${o.promo ? ` Yayıncı pazarlaması: hype +${o.promo}.` : ''}`, 'good');
  // Kaprisli yayıncı: "Kasım'a kaydıralım"
  if (pub?.trait === 'kaprisli' && o.mode === 'bitmis' && ![9, 10].includes(Charts.monthIdx(ctx)) && rng.chance(0.4)) {
    ctx.queue({ id: 'pubdate', title: `📅 ${o.pubName} arıyor`, text: `"${pj.name}" çıkışını Kasım'a kaydıralım mı? Talep yüksek ama rekabet de.`,
      choices: [{ label: 'Kaydıralım', effects: { pubDate: { pid: pj.id, ok: true } } }, { label: 'Hayır, plan aynı', effects: { pubDate: { pid: pj.id, ok: false } } }] });
  }
  return { ok: true, deal };
}
export function dateAnswer(ctx, { pid, ok }) {
  const pj = projectOf(ctx, pid);
  if (!pj?.deal) return;
  if (ok) {
    let w = ctx.state.week;
    while (Charts.monthIdx(ctx, w) !== 10) w++;
    pj.hold = w; pj.deal.due = Math.max(pj.deal.due, w + P(ctx).finishedDue);
    remember(ctx, pj.deal.pubId, `"${pj.name}" Kasım'a kaydırıldı`);
  } else relAdd(ctx, pj.deal.pubId, P(ctx).rel.dateRefuse, `"${pj.name}" için tarih isteği reddedildi`);
}

// Doğrudan anlaşma (testler ve geliştirici araçları): kurulu atlar, koşullar aynı formülden
export function directDeal(ctx, pid, pubId, kind = 'tam') {
  const pj = projectOf(ctx, pid), pub = byId(ctx, pubId);
  if (!pj || !pub) return { ok: false, msg: 'Proje ya da yayıncı yok.' };
  const t = terms(ctx, pub, pj, kind, pj.status === 'dev' ? 'erken' : 'bitmis', trueEstimate(ctx, pj));
  const o = { id: ctx.state.nextId++, pid, pubId, pubName: pub.name, kind, mode: pj.status === 'dev' ? 'erken' : 'bitmis', ...t, votes: {}, margin: 0, est: trueEstimate(ctx, pj), expires: ctx.state.week + 4, rounds: 0, koz: 0 };
  pubState(ctx.state).offers.push(o);
  return sign(ctx, o.id);
}

// ---------- Yayın: sözleşmeyi oyuna işle
// publisherId: null = kendi yayının; 'kelepir' = ucuz dağıtıcıya peşin satış; aksi hâlde imzalı sözleşme gerekir.
export function forRelease(ctx, pj, publisherId, selfPower) {
  const s = pubState(ctx.state), B = P(ctx);
  if (pj.hold && ctx.state.week < pj.hold) return { ok: false, msg: `Çıkış ${pj.hold - ctx.state.week} hafta sonra (${pj.deal?.pubName || 'yayıncı'} isteği).` };
  if (!pj.deal && publisherId !== 'kelepir') {
    const ord = s.orders.find((x) => x.genre === pj.genre && x.topic === pj.topic && pj.platforms.includes(x.platform));
    if (ord) pj.deal = orderDeal(ctx, ord);
  }
  if (pj.deal) {
    const pub = byId(ctx, pj.deal.pubId);
    const power = Math.round((pub?.power ?? pj.deal.power) * (pj.deal.dist ? B.distPower : 1));
    return { ok: true, pub: { id: pj.deal.pubId, name: pj.deal.pubName, power }, deal: pj.deal };
  }
  if (publisherId === 'kelepir') {
    const sh = shadow(ctx, pj, B.bargain.power, trueEstimate(ctx, pj));
    const amt = Math.round(sh.life * sh.price * B.net * (B.payBase - B.payPowerK * B.bargain.power) / 100 * B.bargain.share);
    return { ok: true, pub: { id: 'kelepir', name: 'Kelepir Dağıtım', power: B.bargain.power }, deal: { pubId: 'kelepir', pubName: 'Kelepir Dağıtım', power: B.bargain.power, kind: 'tek', mode: 'bitmis', pay: 0, buyout: amt, paid: amt, owed: 0, bargain: true, expUnits: sh.life } };
  }
  if (publisherId) return { ok: false, msg: 'Önce bu yayıncıya sunup sözleşme imzalamalısın.' };
  if (s.multi && s.multi.left > 0) return { ok: false, msg: `${pubName(ctx, s.multi.pubId)} ile üç oyunluk anlaşman sürüyor.` };
  const owner = rightsOwner(ctx, pj);
  if (owner) return { ok: false, msg: `Serinin hakları ${pubName(ctx, owner)}'da; kendin yayınlayamazsın.` };
  return { ok: true, pub: null, self: selfPower };
}
// Satış haftası: telif önce avansı ve kilometre taşlarını kapatır; kademeli pay; ajan payı
export function royaltyCash(ctx, g, gross) {
  const d = g.deal, B = P(ctx);
  if (!d || gross <= 0) return gross;
  if (!d.hit && d.expUnits > 0 && g.units > d.expUnits * B.hitAt && d.kind === 'tam' && !d.dist) {
    d.hit = true; d.pay = Math.min(B.payMax, d.pay + B.hitPay); g.royalty = B.net * d.pay / 100;
    ctx.news(`📈 "${g.name}" beklentinin ${B.hitAt} katını geçti: ${d.pubName} payını netin %${d.pay}'ine çıkardı.`, 'good');
  }
  let cash = gross;
  if (d.owed > 0) {
    const take = Math.min(d.owed, cash);
    d.owed -= take; cash -= take;
    if (d.owed <= 0) {
      relAdd(ctx, d.pubId, B.rel.recouped, `"${g.name}" avansını kapattı`);
      ctx.news(`💌 "${g.name}" avansını kapattı. İlk telif çeki geldi!`, 'good');
    }
  }
  const ag = pubState(ctx.state).agent;
  if (ag && cash > 0 && d.agent) cash *= 1 - B.agent[ag.tier].fee;
  return cash;
}
export function onRelease(ctx, g, pj) {
  const s = pubState(ctx.state), B = P(ctx), R = B.rel, d = g.deal;
  if (!d || d.bargain) return;
  d.agent = !!s.agent;
  (s.lastWork ||= {})[d.pubId] = ctx.state.week;
  g.revenue += d.paid;
  relAdd(ctx, d.pubId, R.release);
  if (g.score >= 80) relAdd(ctx, d.pubId, R.hit, `"${g.name}" ${Math.round(g.score)} not aldı`);
  // Ana ortağı başka yayıncıya giderek kırmak
  const partner = Object.entries(s.rel).filter(([id, v]) => id !== d.pubId && v >= R.tiers[1]).sort((a, b) => b[1] - a[1])[0];
  if (partner) relAdd(ctx, partner[0], R.otherPub * (byId(ctx, partner[0])?.trait === 'sadik' ? 2 : 1), `"${g.name}" başka yayıncıyla çıktı`);
  if (d.rights === 'yayinci') { const ip = ctx.state.ips.find((x) => x.id === g.ipId); if (ip) ip.rightsPub = d.pubId; }
  if (d.mode === 'erken' && ctx.state.week > d.due) { s.late[d.pubId] = (s.late[d.pubId] || 0) + 1; remember(ctx, d.pubId, `"${g.name}" tarihi ${ctx.state.week - d.due} hafta kaçırdı`); }
  if (d.order) {
    const ord = s.orders.find((x) => x.id === d.order);
    s.orders = s.orders.filter((x) => x.id !== d.order);
    if (ord && (g.score < ord.minScore || ctx.state.week > ord.due)) {
      ctx.ledger.post('yayinci', -ord.penalty, `${ord.pubName} sipariş cezası`);
      relAdd(ctx, d.pubId, R.broken, `Sipariş şartı tutmadı ("${g.name}")`);
      ctx.news(`📉 ${ord.pubName} siparişi şartları tutmadı (en az ${ord.minScore} not, tarih). Ceza ${fmt$(ord.penalty)}.`, 'bad');
    } else if (ord) remember(ctx, d.pubId, `Siparişi zamanında teslim ettin ("${g.name}")`);
  }
  if (d.multi && s.multi?.pubId === d.pubId) { s.multi.left--; if (s.multi.left <= 0) { ctx.news(`📜 ${d.pubName} ile üç oyunluk anlaşma tamamlandı. Artık özgürsün.`, 'info'); s.multi = null; } }
  // Tavsiye kaynakları: platform sahibi ve eleştirmen
  const F = B.referral;
  if (g.score >= 75) for (const id of g.platforms) {
    const owner = platformById(ctx, id)?.owner;
    if (owner && owner !== d.pubId && byId(ctx, owner)) { relAdd(ctx, owner, F.platform, `Platformlarında iyi bir oyun çıkardın ("${g.name}")`); break; }
  }
  if ((g.critics || []).some((c) => c.score >= 9)) {
    const t = list(ctx).filter((p) => p.likes?.includes(g.genre) && p.id !== d.pubId);
    if (t.length) refer(ctx, ctx.rng.pick(t).id, F.critic, `Bir dergi editörü "${g.name}" için seni övdü`);
  }
}
// Kendi yayınında da eleştirmen ve platform tavsiyeleri gelir
export function onSelfRelease(ctx, g) {
  const F = P(ctx).referral;
  if ((g.critics || []).some((c) => c.score >= 9)) {
    const t = list(ctx).filter((p) => p.likes?.includes(g.genre));
    if (t.length) refer(ctx, ctx.rng.pick(t).id, F.critic, `Bir dergi editörü "${g.name}" için seni övdü`);
  }
}
export function onGameEnd(ctx, g) {
  const d = g.deal, R = P(ctx).rel, s = pubState(ctx.state);
  if (!d || d.bargain || d.closed) return;
  d.closed = true;
  if (d.owed > 0) {
    relAdd(ctx, d.pubId, R.notRecouped * (byId(ctx, d.pubId)?.tr.flopK || 1), `"${g.name}" avansını kapatamadı`);
    const ref = s.refBy[d.pubId];
    if (ref && ref !== d.pubId) relAdd(ctx, ref, P(ctx).referral.social, `Tavsiye ettiği "${g.name}" batınca mahcup oldu`);
  } else if (d.expUnits && g.units > d.expUnits) relAdd(ctx, d.pubId, R.hit, `"${g.name}" beklentiyi aştı`);
}

// ---------- Tavsiye ve tanışma
// Tavsiye gücü: tavsiye eden yayıncıyla ilişkin zayıfsa yarı değer; tavsiye edilen yayıncı batarsa tavsiye eden mahcup olur.
export function refer(ctx, id, v, why, from = null) {
  if (!id || !byId(ctx, id)) return;
  const k = from ? clamp(rel(ctx, from) / P(ctx).rel.tiers[2], 0.5, 1) : 1;
  if (from) pubState(ctx.state).refBy[id] = from;
  relAdd(ctx, id, Math.round(v * k), why);
  ctx.news(`🗣️ ${why}: ${pubName(ctx, id)} ile ilişki +${Math.round(v * k)}.`, 'good');
}
const bigClosed = (ctx) => list(ctx).filter((p) => p.power >= P(ctx).door.known && !door(ctx, p).open && rel(ctx, p.id) > P(ctx).rel.black);
export function onAward(ctx, { genre }) {
  const F = P(ctx).referral, r = ctx.rng;
  const big = list(ctx).filter((p) => p.tier === 'buyuk');
  if (big.length) refer(ctx, r.pick(big).id, F.jury, 'Ödül jürisindeki yayıncı seni not etti');
  const fans = bigClosed(ctx).filter((p) => p.likes?.includes(genre)).slice(0, 2);
  for (const p of fans) introduce(ctx, p.id, `${genreName(ctx, genre)} ödülünü gördük`);
}
export function onTop10(ctx, g) {
  const t = bigClosed(ctx).filter((p) => p.likes?.includes(g.genre));
  if (t.length) introduce(ctx, ctx.rng.pick(t).id, `"${g.name}" listede ilk 10'da; tebrikler`);
}
export function onStaffTransfer(ctx, { person, rival }) {
  const F = P(ctx).referral;
  if (!rival?.cid || !byId(ctx, rival.cid)) return;
  if (person.morale >= 50) refer(ctx, rival.cid, F.staff, `Eski çalışanın ${person.name} artık ${rival.name}'da ve senden iyi söz ediyor`);
  else { relAdd(ctx, rival.cid, F.staffBad, `${person.name} küskün ayrıldı, dedikodu yaydı`); ctx.news(`🗯️ ${person.name} yeni şirketi ${rival.name}'da hakkında dedikodu yayıyor.`, 'bad'); }
}
export function onTraining(ctx) {
  const t = list(ctx).filter((p) => p.tier !== 'kucuk');
  if (t.length && ctx.rng.chance(0.25)) refer(ctx, ctx.rng.pick(t).id, P(ctx).referral.course, 'Kursta tanışılan bir yönetici seni hatırladı');
}
export function onIpo(ctx) {
  const t = list(ctx).filter((p) => p.tier === 'buyuk');
  if (t.length) refer(ctx, ctx.rng.pick(t).id, P(ctx).referral.ipo, 'Yönetim kurulundaki yatırımcı seni bir yayıncıyla tanıştırdı');
}
export function onFair(ctx) {
  const pool = list(ctx).filter((p) => p.tier !== 'kucuk');
  const n = Math.min(pool.length, ctx.rng.int(1, 2));
  for (let i = 0; i < n; i++) { const p = pool.splice(Math.floor(ctx.rng.next() * pool.length), 1)[0]; refer(ctx, p.id, P(ctx).referral.fair, `Fuardaki standına ${p.name} yetkilileri uğradı`); }
}

// Seri haklarını geri satın al: IP değeriyle ölçeklenen bedel; yayıncı biraz kırılır
export const rightsPrice = (ctx, ip) => Math.round((20000 + 60000 * Math.min(3, ip.value || 0)) * inflation(ctx) ** 0.6);
export function buyRights(ctx, ipId) {
  const ip = ctx.state.ips.find((x) => x.id === ipId);
  if (!ip?.rightsPub) return { ok: false, msg: 'Bu serinin hakları zaten sende.' };
  const price = rightsPrice(ctx, ip);
  if (ctx.state.cash < price) return { ok: false, msg: `Haklar ${fmt$(price)}.` };
  ctx.ledger.post('yayinci', -price, `"${ip.name}" seri hakları`);
  relAdd(ctx, ip.rightsPub, -5, `"${ip.name}" serisinin haklarını geri aldın`);
  ctx.news(`📜 "${ip.name}" serisinin haklarını ${pubName(ctx, ip.rightsPub)}'dan ${fmt$(price)} karşılığında geri aldın.`, 'good');
  ip.rightsPub = null;
  return { ok: true };
}

// ---------- Ajan
export function hireAgent(ctx, tier) {
  const s = pubState(ctx.state), A = P(ctx).agent[tier];
  if (!A) return { ok: false, msg: 'Böyle bir ajan yok.' };
  s.agent = { tier, since: ctx.state.week };
  ctx.news(tier === 'good' ? '💼 Deneyimli bir ajanla anlaştın: payının %10\'u onun, dosyaların ve kapıların da.' : '🕶️ Ucuz bir ajan buldun. Kartvizitinde üç farklı soyadı var.', 'info');
  return { ok: true };
}
export function fireAgent(ctx) { pubState(ctx.state).agent = null; return { ok: true }; }

// ---------- Deneme işi (sınav): büyük yayıncıdan sözleşmeli iş; geçersen tanışırsın
export function addTrial(ctx) {
  const { state, rng } = ctx, s = pubState(state), T = P(ctx).trial;
  if (state.contractOffers.some((o) => o.trial) || !state.contractOffers.length) return;
  const gs = state.games.filter((g) => !g.portOf);
  if (gs.length < T.minGames) return;
  const avg = gs.slice(-3).reduce((a, g) => a + g.score, 0) / Math.min(3, gs.length);
  if (avg < T.minAvg || !rng.chance(0.5)) return;
  const cands = list(ctx).filter((p) => p.power >= P(ctx).door.open && !door(ctx, p).open && (s.trialBan[p.id] || 0) <= state.week && rel(ctx, p.id) > P(ctx).rel.black);
  if (!cands.length) return;
  const pub = rng.pick(cands);
  const base = state.contractOffers[state.contractOffers.length - 1];
  const job = rng.pick(['Uyarlama: salon oyununu ev sistemine taşı', 'Lisanslı oyun: filmin oyunu', 'Görev odaklı prototip', 'Eski hitin yeni platform sürümü']);
  state.contractOffers[state.contractOffers.length - 1] = { ...base, id: state.nextId++, client: `${pub.name} (deneme işi)`, job, trial: pub.id, reward: Math.round(base.reward * T.payK) };
}
export function onContractFinished(ctx, c) {
  if (!c?.trial) return;
  const T = P(ctx).trial, fast = c.deadline - ctx.state.week >= c.weeks * (1 - T.fastShare);
  relAdd(ctx, c.trial, fast ? T.relFast : T.rel, `Deneme işini ${fast ? 'erken ve temiz' : 'zamanında'} teslim ettin`);
  ctx.news(`🎓 ${pubName(ctx, c.trial)} deneme işinden memnun: "Bundan sonra dosyalarınızı okuyacağız."`, 'good');
}
export function onContractFailed(ctx, c) {
  if (!c?.trial) return;
  const T = P(ctx).trial;
  relAdd(ctx, c.trial, T.failRel, 'Deneme işini yetiştiremedin');
  pubState(ctx.state).trialBan[c.trial] = ctx.state.week + T.banWeeks;
  ctx.news(`📉 ${pubName(ctx, c.trial)} deneme işini beğenmedi. İki yıl yeni deneme yok.`, 'bad');
}

// ---------- Yayıncı siparişi: yayıncı sana gelir (tür, konu, platform, boyut, en düşük not, tarih)
function genOrder(ctx) {
  const { state, rng, pack } = ctx, s = pubState(state), O = P(ctx).orders;
  if (s.orders.length || s.offers.some((o) => o.kind === 'siparis')) return;
  if (state.games.filter((g) => !g.portOf).length < O.minGames) return;
  const it = itibar(ctx);
  const cands = list(ctx).filter((p) => door(ctx, p).open && (rel(ctx, p.id) >= P(ctx).rel.tiers[1] || (it >= 10 && p.power >= P(ctx).door.open)));
  if (!cands.length || !rng.chance(O.chance * (s.sequelHint ? 2 : 1))) return;
  s.sequelHint = false;
  const pub = rng.pick(cands), y = tableYear(ctx);
  const genres = pack.genres.filter((g) => !g.research || state.research.done[g.research]);
  const genre = pub.likes?.find((g) => genres.some((x) => x.id === g)) || rng.pick(genres).id;
  const gi = pack.genres.findIndex((g) => g.id === genre);
  const topics = pack.topics.filter((t) => t[4] <= y).sort((a, b) => b[2][gi] - a[2][gi]).slice(0, 8);
  const topic = rng.pick(topics);
  const maxTech = pack.workstations.tiers[state.stationTier].maxTech;
  const plats = activePlatforms(ctx).filter((p) => !p.own && p.tech <= maxTech && pub.focus.includes(p.kind)).sort((a, b) => platformBase(ctx, b) - platformBase(ctx, a));
  if (!plats.length) return;
  const plat = plats[0];
  const size = state.staff.length >= 8 && state.office.tier >= 2 ? 'orta' : 'kucuk';
  const sz = pack.sizes.find((z) => z.id === size);
  const minScore = Math.round(clamp(O.scoreA + O.scoreK * pub.power, O.scoreMin, O.scoreMax));
  const fake = { platforms: [plat.id], size, genre, topic: topic[0], audience: pack.audiences[topic[3].indexOf(Math.max(...topic[3]))].id, regions: ['na', 'eu'], hype: 10, kind: 'oyun' };
  const pay = Math.round(clamp(basePay(ctx, pub), P(ctx).payMin, P(ctx).payMax));
  const sh = shadow(ctx, fake, pub.power, minScore + 5, promoOf(ctx, pub, fake));
  const adv = Math.round(sh.u12 * sh.price * P(ctx).net * pay / 100);
  const weeks = Math.round(sz.weeks * Math.max(1, 4 / Math.max(1, state.staff.length)) ** 0.5) + O.slackWeeks;
  s.offers.push({ id: state.nextId++, kind: 'siparis', pid: null, pubId: pub.id, pubName: pub.name, genre, topic: topic[0], topicName: topic[1], platform: plat.id, platformName: plat.name, size, audience: fake.audience,
    minScore, pay, adv, promo: promoOf(ctx, pub, fake), expUnits: sh.life, penalty: Math.round(adv * O.penalty), dueWeeks: weeks, expires: state.week + P(ctx).offerWeeks, rounds: 0, koz: 0, margin: 0 });
  ctx.news(`📦 ${pub.name}'dan sipariş: ${weeks} hafta içinde ${plat.name} için bir ${topic[1]} × ${genreName(ctx, genre)} oyunu, en az ${minScore} not. Avans ${fmt$(adv)}.`, 'info');
}
function acceptOrder(ctx, o) {
  const s = pubState(ctx.state);
  s.offers = s.offers.filter((x) => x !== o);
  const ord = { ...o, due: ctx.state.week + o.dueWeeks, owed: o.adv };
  s.orders.push(ord);
  ctx.ledger.post('yayinci', o.adv, `${o.pubName} sipariş avansı`);
  remember(ctx, o.pubId, `Sipariş kabul edildi (${o.topicName} × ${genreName(ctx, o.genre)})`);
  ctx.news(`📝 ${o.pubName} siparişini kabul ettin. Tür, konu ve platformu tutan ilk oyunun onların olacak.`, 'good');
  return { ok: true };
}
function orderDeal(ctx, ord) {
  return { pubId: ord.pubId, pubName: ord.pubName, power: byId(ctx, ord.pubId)?.power ?? 60, kind: 'tam', mode: 'siparis', pay: ord.pay, adv: ord.adv, buyout: 0, fund: 0, rights: 'sende', promo: ord.promo,
    expUnits: ord.expUnits, paid: ord.adv, owed: ord.adv, dist: false, ms: 0, signed: ctx.state.week, hit: false, order: ord.id, due: ord.due };
}
export function orderDraft(ctx, id) {
  const o = pubState(ctx.state).orders.find((x) => x.id === id);
  return o ? { genre: o.genre, topic: o.topic, platforms: [o.platform], size: o.size, audience: o.audience } : null;
}

// ---------- Vitrin etkinlikleri ve oyun maratonu
function showcaseOpen(ctx, sc) { const y = tableYear(ctx); return y >= sc.from && y < sc.to; }
function queueShowcase(ctx, sc) {
  const { state, rng } = ctx;
  const free = state.staff.filter((p) => p.status === 'ok');
  if (sc.people && free.length < sc.people) return;
  if (sc.id === 'festival' && !recentWork(ctx)) return;
  let text = '';
  if (sc.id === 'dergi') text = 'Bir bilgisayar dergisi programlama yarışması açtı. 1 kişi 2 hafta mini bir oyun yazıp gönderir. İlk üçe giren dergide yayınlanır.';
  if (sc.id === 'demo') text = 'Bu yaz büyük demo partisi var: 2 kişi bir hafta görsel şölen hazırlar. Teknik becerin konuşulur.';
  if (sc.id === 'mod') text = 'Büyük bir yayıncının oyunu için mod yarışması açıldı: 1 kişi 3 hafta mod yapar.';
  if (sc.id === 'festival') text = `Bağımsız oyun festivali başvuruları açık. "${recentWork(ctx).name}" ile başvurabilirsin.`;
  if (sc.id === 'maraton') { pubState(state).jamTheme = rng.pick(JAM_THEMES); text = `Oyun maratonu bu hafta sonu! Tema: "${pubState(state).jamTheme}". 3 kişi bir haftalığına projelerinden çıkar.`; }
  ctx.queue({ id: 'pubshow', title: `🎪 ${sc.name}`, text, choices: [{ label: 'Katıl', effects: { pubShow: sc.id } }, { label: 'Bu yıl pas', effects: {} }] });
}
function recentWork(ctx) {
  const st = ctx.state;
  return st.games.filter((g) => st.week - g.releasedWeek < 48 && !g.portOf).sort((a, b) => b.score - a.score)[0] || null;
}
export function joinShowcase(ctx, id) {
  const { state, rng } = ctx, S = P(ctx).showcase, F = P(ctx).referral;
  const sc = SHOWCASES.find((x) => x.id === id);
  if (!sc || !showcaseOpen(ctx, sc)) return;
  const team = state.staff.filter((p) => p.status === 'ok').sort((a, b) => b.skill - a.skill).slice(0, sc.people);
  for (const p of team) { p.status = 'etkinlik'; p.statusWeeks = sc.weeks; p.morale = clamp(p.morale + S.morale, 0, 100); p.skill = clamp(p.skill + S.skill, 1, 100); }
  const entrants = Math.round(lerpTable(sc.entrants, tableYear(ctx)));
  let q;
  if (sc.id === 'festival') q = (recentWork(ctx)?.score || 50) * rng.normal(1, 0.08);
  else q = (team.reduce((a, p) => a + p.skill, 0) / Math.max(1, team.length)) * clamp(rng.normal(1.1, 0.16 + state.kaos / 500), 0.3, 1.8);
  const rank = Math.round(clamp(1 + Math.floor(entrants * Math.exp(-(q - 35) / 11)), 1, entrants));
  const top3 = rank <= 3, onePct = rank <= Math.max(3, entrants / 100);
  const where = `${entrants.toLocaleString('tr-TR')} katılımcı arasında ${rank}.`;
  if (id === 'maraton') {
    const m = Charts.mkt(state);
    m.hypeBank = Math.min(30, (m.hypeBank || 0) + (top3 ? S.jamHype : Math.round(S.jamHype / 2)));
    const pubs = list(ctx).filter((p) => p.tier !== 'kucuk');
    if (pubs.length && rng.chance(0.5)) refer(ctx, rng.pick(pubs).id, F.jamFriend, 'Maratonda aynı masayı paylaştığın stüdyo seni yayıncısına anlattı');
    if (rng.chance(0.15)) ctx.news(rng.pick(['😴 Kodcu 48 saat uyumadı; oyun çalışıyor ama kimse nedenini bilmiyor.', '🐈 Ofis kedisi klavyeye bastı ve jüri buna bayıldı.']), 'info');
  }
  if (top3) {
    state.fans += Math.round(S.fans * inflation(ctx) ** 0.3);
    const t = bigClosed(ctx);
    const pick = t.length ? rng.pick(t) : rng.pick(list(ctx).filter((p) => p.tier !== 'kucuk'));
    if (pick) introduce(ctx, pick.id, `${sc.name}nda ${rank}. oldunuz`);
    if (id === 'festival') ctx.ledger.post('odul', Math.round(S.festPrize * inflation(ctx) ** 0.5), 'Festival ödülü');
    ctx.news(`🏆 ${sc.name}: ${where} Dergiler adını yazdı!`, 'good');
  } else if (onePct) {
    state.fans += Math.round(S.fans / 3 * inflation(ctx) ** 0.3);
    const t = list(ctx).filter((p) => p.tier === 'orta');
    if (t.length) refer(ctx, rng.pick(t).id, S.onePctRel, `${sc.name}nda ilk %1'e girdin`);
    ctx.news(`🎖️ ${sc.name}: ${where} İlk %1!`, 'good');
  } else ctx.news(`🎪 ${sc.name}: ${where} Ekip moral topladı.`, 'info');
  if (id === 'mod') {
    const big = list(ctx).filter((p) => p.tier === 'buyuk');
    if (big.length && rank <= entrants / 10) refer(ctx, big[0].id, S.modRel, `${big[0].name} oyununa yaptığın mod beğenildi`);
  }
}

// ---------- Haftalık akış
export function weekly(ctx) {
  const { state } = ctx, s = pubState(state), B = P(ctx), w = state.week;
  // Cevaplar: büyük yayıncı önce toplantı yapar
  for (const pt of [...s.pitches]) {
    if (!projectOf(ctx, pt.pid)) { s.pitches = s.pitches.filter((x) => x !== pt); continue; }
    if (w < pt.due) continue;
    if (pt.qs.length && !pt.asked) { pt.asked = true; pt.due = w + 1; queueMeeting(ctx, pt); continue; }
    respond(ctx, pt);
  }
  for (const o of [...s.offers]) {
    if (o.pid && !projectOf(ctx, o.pid)) { s.offers = s.offers.filter((x) => x !== o); continue; }
    if (w > o.expires) { s.offers = s.offers.filter((x) => x !== o); ctx.news(`⌛ ${o.pubName} teklifinin süresi doldu.`, 'info'); }
  }
  // Sözleşmeli projeler: kilometre taşları, gecikme
  for (const pj of state.projects) {
    const d = pj.deal;
    if (!d) continue;
    if (d.mode === 'erken') {
      if (d.ms === 1 && (pj.status !== 'dev' || pj.phase >= 2)) payMilestone(ctx, pj, 1);
      if (d.ms === 2 && pj.status === 'debug') { if (w <= d.due) payMilestone(ctx, pj, 2); else { d.ms = 3; ctx.news(`⛔ ${d.pubName}: "${pj.name}" tarihi kaçırdı; son ödeme durdu.`, 'bad'); } }
    }
    if (w > d.due) {
      const late = w - d.due;
      const lost = d.lateLost || 0;
      if (lost > B.rel.lateMax) { const v = Math.max(B.rel.lateMax - lost, B.rel.latePerWeek * (byId(ctx, d.pubId)?.tr.lateK || 1)); relAdd(ctx, d.pubId, v); d.lateLost = lost + v; }
      if (late === 1) ctx.news(`⏰ "${pj.name}" ${d.pubName} ile anlaşılan tarihi geçti. Her hafta ilişki düşüyor.`, 'warn');
      if (late > B.lateWithdraw) {
        const repay = Math.round((d.mode === 'erken' ? d.paid : d.adv || d.buyout || 0) * B.withdrawRepay);
        if (repay) ctx.ledger.post('yayinci', -repay, `${d.pubName} sözleşme cezası`);
        relAdd(ctx, d.pubId, B.rel.broken, `"${pj.name}" için tarih tutmadı; sözleşme feshedildi`);
        s.late[d.pubId] = (s.late[d.pubId] || 0) + 1;
        ctx.news(`💔 ${d.pubName} "${pj.name}" sözleşmesini feshetti. Ceza ${fmt$(repay)}.`, 'bad');
        pj.deal = null;
      }
    }
  }
  for (const o of [...s.orders]) {
    if (w > o.due + B.lateWithdraw && !state.projects.some((pj) => pj.deal?.order === o.id)) {
      s.orders = s.orders.filter((x) => x !== o);
      ctx.ledger.post('yayinci', -o.penalty, `${o.pubName} sipariş cezası`);
      relAdd(ctx, o.pubId, B.rel.broken, 'Sipariş teslim edilmedi');
      ctx.news(`📦❌ ${o.pubName} siparişi teslim edilmedi. Ceza ${fmt$(o.penalty)}.`, 'bad');
    }
  }
  if (w % 4 === 0) monthly(ctx);
  if (w % 12 === 0) quarterly(ctx);
  if (w % 48 === 0) yearly(ctx);
}
function payMilestone(ctx, pj, i) {
  const d = pj.deal, amt = Math.round(d.fund * P(ctx).milestones[i]);
  ctx.ledger.post('yayinci', amt, `${d.pubName}: "${pj.name}" ${i + 1}. kilometre taşı`);
  d.paid += amt; d.owed += amt; d.ms = i + 1;
}
function monthly(ctx) {
  const { state, ledger } = ctx, s = pubState(state);
  genOrder(ctx);
  if (s.agent) ledger.post('ajan', -Math.round(P(ctx).agent[s.agent.tier].retainer * inflation(ctx) ** 0.5), 'Ajan ücreti');
  const mi = Charts.monthIdx(ctx);
  for (const sc of SHOWCASES) if (sc.month === mi && showcaseOpen(ctx, sc) ) queueShowcase(ctx, sc);
}
// Yayıncının kendi kararı: sönen oyunun fiyatını indirmek. İyi ilişkide önce sorar.
export function priceAnswer(ctx, { gid, ok }) {
  const g = ctx.state.games.find((x) => x.id === gid);
  if (!g?.deal) return;
  if (ok) { g.price = Math.max(ctx.pack.post.priceFloor, Math.round(g.price * 0.75)); Charts.revive(ctx, g, 4); g.pubCut = true; ctx.news(`🏷️ ${g.deal.pubName} "${g.name}" fiyatını ${g.price} $'a indirdi.`, 'info'); }
  else { g.pubCut = true; relAdd(ctx, g.deal.pubId, -2); }
}
function quarterly(ctx) {
  const { state } = ctx, s = pubState(state);
  const fading = state.games.find((x) => x.active && x.deal && !x.deal.bargain && !x.pubCut && x.model !== 'f2p' && x.weeks > 30 && x.dif?.F > 0.85);
  if (fading) {
    if (rel(ctx, fading.deal.pubId) >= P(ctx).rel.tiers[0]) ctx.queue({ id: 'pubprice', title: `🏷️ ${fading.deal.pubName} soruyor`, text: `"${fading.name}" sönüyor. Fiyatı %25 indirelim mi? Satış biraz canlanır ama kopya başı payın düşer.`,
      choices: [{ label: 'İndirin', effects: { pubPrice: { gid: fading.id, ok: true } } }, { label: 'Fiyat kalsın', effects: { pubPrice: { gid: fading.id, ok: false } } }] });
    else priceAnswer(ctx, { gid: fading.id, ok: true });
  }
  const g = state.games.filter((x) => x.active && x.deal && !x.deal.bargain && rel(ctx, x.deal.pubId) >= P(ctx).rel.tiers[0] && x.weeks >= 6).sort((a, b) => b.units - a.units)[0];
  if (!g) return;
  const exp = g.deal.expUnits * Math.min(1, g.weeks / 30);
  if (g.units > exp * 1.2) { s.sequelHint = true; ctx.news(`✉️ ${g.deal.pubName} çeyrek raporu: "${g.name}" beklentinin üstünde. "Bir devam oyunu düşünür müsünüz?"`, 'good'); }
  else if (g.units < exp * 0.7) ctx.news(`✉️ ${g.deal.pubName} çeyrek raporu: "${g.name}" beklentinin altında. "Belki bir güncelleme?"`, 'info');
}
function yearly(ctx) {
  const { state, rng } = ctx, s = pubState(state), B = P(ctx), F = B.referral;
  const pubs = list(ctx), ids = new Set(pubs.map((p) => p.id));
  // Kendiliğinden soğuma
  for (const id in s.rel) {
    const p = pubs.find((x) => x.id === id);
    const idle = state.week - (s.lastWork?.[id] ?? -999) > 96 ? 3 : 0; // iki yıldır birlikte iş yoksa ilişki daha hızlı soğur
    const dec = (p?.tr.decay ?? B.rel.decay) + (s.rel[id] >= B.rel.tiers[1] ? idle : 0);
    if (s.rel[id] > 0) s.rel[id] = Math.max(0, s.rel[id] - dec);
    else if (s.rel[id] < 0) s.rel[id] = Math.min(0, s.rel[id] + 1);
  }
  // Birleşmeler: ilişki puanları ortalanır
  for (const m of MERGERS) if (ids.has(m.to) && !s.rel[m.to] && m.from.some((f) => s.rel[f])) {
    const vals = m.from.map((f) => s.rel[f] || 0);
    s.rel[m.to] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    for (const f of m.from) if (s.mem[f]) (s.mem[m.to] ||= []).push(...s.mem[f].slice(0, 2));
    ctx.news(`🤝 ${m.from.map((f) => pubName(ctx, f)).join(' ve ')} birleşti: artık ${pubName(ctx, m.to)}. İlişkin ${s.rel[m.to]} ile devam ediyor.`, 'tarih');
  }
  // İflas: listeden çıkan yayıncının oyunları raftan çekilir, son 4 haftanın telifi yanar, haklar sana döner
  for (const g of state.games) {
    const d = g.deal;
    if (!d || d.bargain || ids.has(d.pubId) || d.bankrupt) continue;
    const heir = MERGERS.find((m) => m.from.includes(d.pubId) && ids.has(m.to));
    if (heir) { d.pubId = heir.to; d.pubName = pubName(ctx, heir.to); continue; }
    d.bankrupt = true;
    if (g.active) {
      const burn = (g.revHist || []).slice(-4).reduce((a, b) => a + b, 0);
      if (burn > 0) ctx.ledger.post('yayinci', -Math.round(burn), `${d.pubName} iflası: ödenmeyen telif`);
      g.active = false;
      ctx.news(`🪦 ${d.pubName} iflas etti. "${g.name}" raftan çekildi; son telifler buhar oldu.`, 'bad');
    }
    for (const ip of state.ips) if (ip.rightsPub === d.pubId) { ip.rightsPub = null; ctx.news(`📜 "${ip.name}" serisinin hakları sana döndü.`, 'good'); }
  }
  // Tavsiyeler: stratejik ortak, geliştirici dost, hayran kampanyası, ajan
  const strat = pubs.filter((p) => rel(ctx, p.id) >= B.rel.tiers[2]);
  for (const p of strat) {
    const t = pubs.filter((x) => x.id !== p.id && rel(ctx, x.id) < B.rel.tiers[0] && x.tier !== 'kucuk');
    if (t.length) refer(ctx, rng.pick(t).id, F.partner, `${p.name} seni bir dostuna tavsiye etti`, p.id);
    if (!s.multi && !state.pending.some((e) => e.id === 'pubmulti') && rng.chance(0.35)) queueMulti(ctx, p);
  }
  if (rng.chance(0.15) && state.games.length) {
    const devs = COMPANIES.filter((c) => !c.kind.includes('pub') && isActive(c, tableYear(ctx)));
    if (devs.length) {
      const dv = rng.pick(devs), t = pubs.filter((p) => p.tier !== 'kucuk');
      if (t.length) refer(ctx, rng.pick(t).id, F.devFriend, `${dv.name} ile yardımlaştınız; seni yayıncılarına anlattılar`);
    }
  }
  if (state.fans >= 100000 && rng.chance(0.3)) {
    const last = state.games.at(-1), t = pubs.filter((p) => last && p.likes?.includes(last.genre));
    if (t.length) refer(ctx, rng.pick(t).id, F.fanCampaign, 'Hayranların imza kampanyası başlattı ve bir yayıncı fark etti');
  }
  if (s.agent) {
    const t = bigClosed(ctx);
    for (let i = 0; i < B.agent[s.agent.tier].doors && t.length; i++) { const p = t.splice(Math.floor(rng.next() * t.length), 1)[0]; introduce(ctx, p.id, 'Ajanın bizi aradı; bir görüşelim', 0); }
  }
}
function queueMulti(ctx, pub) {
  ctx.queue({ id: 'pubmulti', title: `📜 ${pub.name}: üç oyunluk anlaşma`, text: `${pub.name} sonraki üç oyununu sabit pay (+%${P(ctx).multiPay}) ve garanti pazarlamayla yayınlamak istiyor. Karşılığında bu üç oyunu başka yayıncıya götüremezsin ve kendin yayınlayamazsın.`,
    choices: [{ label: 'İmzala', effects: { pubMulti: pub.id } }, { label: 'Özgür kalayım', effects: {} }] });
}
export function acceptMulti(ctx, id) {
  pubState(ctx.state).multi = { pubId: id, left: 3 };
  remember(ctx, id, 'Üç oyunluk anlaşma imzalandı');
  ctx.news(`📜 ${pubName(ctx, id)} ile üç oyunluk anlaşma imzalandı.`, 'good');
}

// Efekt anahtarları (olay seçimleri) ve diğer sistemlerin olayları
export function wire(ctx) {
  const { bus } = ctx;
  bus.on('pubMeet', (a) => meetAnswer(ctx, a));
  bus.on('pubDate', (a) => dateAnswer(ctx, a));
  bus.on('pubShow', (id) => joinShowcase(ctx, id));
  bus.on('pubMulti', (id) => acceptMulti(ctx, id));
  bus.on('pubFair', () => onFair(ctx));
  bus.on('pubPrice', (a) => priceAnswer(ctx, a));
  bus.on('pubRel', (x) => relAdd(ctx, x.id, x.v, x.memo));
  bus.on('gameTop10', (g) => onTop10(ctx, g));
  bus.on('awardWon', (a) => onAward(ctx, a));
  bus.on('staffTransfer', (x) => onStaffTransfer(ctx, x));
  bus.on('trainingFinished', () => onTraining(ctx));
  bus.on('ipo', () => onIpo(ctx));
  bus.on('contractFinished', (c) => onContractFinished(ctx, c));
  bus.on('contractFailed', (c) => onContractFailed(ctx, c));
}

// Eski kayıtlar: Konu A'nın biriktirdiği yayıncı puanı ilişkiye taşınır
export function migrate(state) {
  const s = pubState(state);
  const old = state.mkt?.pubRel;
  if (old && !s.migrated) { for (const id in old) s.rel[id] = (s.rel[id] || 0) + old[id]; s.migrated = true; }
  for (const g of state.games || []) if (g.publisherId && !g.deal && g.royalty != null) g.legacyRoyalty = true;
}

export const __test = { rejectLetter };
