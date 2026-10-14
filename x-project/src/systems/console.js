// Özel donanım (Game Dev Story + MGT esinli): donanım laboratuvarı, 8 cihaz tipi (salon makinesi, ev bilgisayarı,
// ev konsolu, el konsolu, VR, melez, retro mini, bulut servisi), yıllara ve araştırmaya göre açılan bileşenler
// (kartuş → kaset/disket → CD → DVD → Blu-ray → dijital → bulut), konsol aileleri ve nesiller (Seri, Seri 2, Seri 3…),
// fiyat stratejisi, donanım satışı, salon jetonu/bulut aboneliği ve rakiplerden lisans geliri.
import { clamp, lerpTable } from '../kernel.js';
import { Pz, inflation, tableYear, skillK, marketSkill, mYear } from '../models.js';
import { weeklyOutput, hasRoom } from './staff.js';

const C = (ctx) => ctx.pack.console;
export const hwEngineers = (ctx) => ctx.state.staff.filter((p) => p.career === 'donanimci');
// Donanımı anlayan biri: Donanım Mühendisi ya da donanım yeteneği yüksek çalışan (MGT yetenek seti).
export const hwCapable = (ctx) => ctx.state.staff.filter((p) => p.career === 'donanimci' || (p.skills?.donanim || 0) >= C(ctx).hwSkillMin);
export const typeById = (ctx, id) => C(ctx).types.find((t) => t.id === id);
export const partById = (ctx, cat, id) => C(ctx).parts[cat]?.list.find((p) => p.id === id);
const seriesList = (state) => (state.consoleSeries ||= []);

export function typeStatus(ctx, t) {
  const y = tableYear(ctx);
  if (y < t.year) return { ok: false, why: `${t.year}'de` };
  if (t.research && !ctx.state.research.done[t.research]) return { ok: false, why: 'araştır' };
  return { ok: true };
}
export function partStatus(ctx, t, p) {
  const y = tableYear(ctx);
  if (p.only && !p.only.includes(t.id)) return { ok: false, why: 'bu tipe uymaz', hide: true };
  if (y < p.year) return { ok: false, why: `${p.year}'de` };
  if (p.research && !ctx.state.research.done[p.research]) return { ok: false, why: 'araştır' };
  if (p.hwEng && hwEngineers(ctx).length < p.hwEng) return { ok: false, why: `${p.hwEng} mühendis`, hide: true };
  return { ok: true };
}
// Bir tip için kategori başına bileşen listesi (kilitli olanlar nedeniyle).
export function consoleParts(ctx, typeId) {
  const c = C(ctx);
  const types = c.types.map((t) => ({ t, ...typeStatus(ctx, t) }));
  const t = typeById(ctx, typeId) || c.types[0];
  const cats = {};
  for (const cat of t.parts) cats[cat] = c.parts[cat].list.map((p) => ({ p, ...partStatus(ctx, t, p) })).filter((x) => !x.hide);
  return { types, type: t, cats };
}
export function upcomingParts(ctx, years = 6) {
  const y = tableYear(ctx);
  return Object.values(C(ctx).parts).flatMap((c) => c.list).filter((p) => p.year > y && p.year <= y + years && !p.hwEng).sort((a, b) => a.year - b.year);
}

export function consoleBlockers(ctx) {
  const s = ctx.state, out = [];
  if (!s.research.done.donanim_lab) out.push('Donanım laboratuvarı araştırması');
  if (!hasRoom(ctx, 'donanim')) out.push('Donanım laboratuvarı odası');
  if (!hwCapable(ctx).length) out.push(`Donanımdan anlayan biri: Donanım Mühendisi ya da donanım yeteneği ${C(ctx).hwSkillMin}+ olan çalışan`);
  return out;
}

// Aile adı ve nesil: yeni seri "Ad", sonraki nesiller "Ad 2", "Ad 3"…
export function nextName(ctx, d) {
  const sr = seriesList(ctx.state).find((x) => String(x.id) === String(d.series));
  if (!sr) return { name: (d.seriesName || 'X Kutu').trim(), gen: 1 };
  const gen = sr.gen + 1;
  return { name: `${sr.name} ${gen}`, gen, series: sr };
}

// Dönemin ortalama çalışanının haftalık üretimi: donanım iş yükü buna göre ölçeklenir (laboratuvar küçük kalır).
const refOutput = (ctx) => ctx.pack.production.K * marketSkill(ctx) * mYear(ctx) / 4;
export const expectedTech = (ctx, t) => lerpTable(C(ctx).expectedTech, tableYear(ctx)) + (t?.techOffset || 0);
const qualityOf = (ctx, tech, t) => { const c = C(ctx); return clamp(1 + c.qualityK * (tech - expectedTech(ctx, t)), c.qualityMin, c.qualityMax); };

export function consoleQuote(ctx, d) {
  const c = C(ctx);
  const t = typeById(ctx, d.type);
  if (!t || !typeStatus(ctx, t).ok) return null;
  const issues = [];
  let wsum = 0, tsum = 0, cost = t.cost, appeal = 1, margin = 0, piracy = 0, netLvl = 0;
  const g = [...t.genre];
  const parts = {};
  for (const cat of t.parts) {
    const p = partById(ctx, cat, d.parts?.[cat]);
    if (!p) { issues.push(`${c.parts[cat].name} seç`); continue; }
    const st = partStatus(ctx, t, p);
    if (!st.ok) { issues.push(`${p.name}: ${st.why}`); continue; }
    parts[cat] = p.id;
    const w = c.parts[cat].w;
    if (w && p.tech != null) { wsum += w; tsum += w * p.tech; }
    cost += p.cost;
    appeal *= p.appeal || 1;
    margin += p.margin || 0;
    piracy = Math.max(piracy, p.piracy || 0);
    if (p.lvl != null) netLvl = p.lvl;
    if (p.g) p.g.forEach((v, i) => (g[i] += v));
  }
  for (const cat of t.parts) { const p = partById(ctx, cat, parts[cat]); if (p?.needNet && (t.parts.includes('net') ? netLvl : 3) < p.needNet) issues.push(`${p.name} için daha iyi bağlantı gerekir`); }
  if (issues.length) return { issues };
  const tech = clamp(+(wsum ? tsum / wsum : 1).toFixed(1), 1, 8);
  const price = c.prices.find((x) => x.id === d.price) || c.prices[1];
  const nm = nextName(ctx, d);
  return {
    issues, parts, tech, name: nm.name, gen: nm.gen,
    cost: Math.round(cost * c.costScale),
    need: Math.round(refOutput(ctx) * c.teamWeeks * (1 + tech / 7) * (t.work || 1)),
    genre: g.map((v) => clamp(v, 5, 10)), aud: [...t.aud], appeal, piracy, price: price.id,
    margin: Math.round((t.margin + margin + price.marginAdd) * price.marginMult),
    quality: qualityOf(ctx, tech, t), expected: +expectedTech(ctx, t).toFixed(1),
  };
}

export function startConsole(ctx, d) {
  const { state, ledger } = ctx;
  if (state.consoleJob) return { ok: false, msg: 'Zaten bir donanım yapılıyor.' };
  const block = consoleBlockers(ctx);
  if (block.length) return { ok: false, msg: `Eksik: ${block[0]}.` };
  const t = typeById(ctx, d.type);
  if (!t) return { ok: false, msg: 'Tip seç.' };
  const ts = typeStatus(ctx, t);
  if (!ts.ok) return { ok: false, msg: `${t.name}: ${ts.why}.` };
  const q = consoleQuote(ctx, d);
  if (!q || q.issues.length) return { ok: false, msg: q?.issues[0] || 'Parçaları seç.' };
  if (d.series === 'yeni' && !(d.seriesName || '').trim()) return { ok: false, msg: 'Yeni aileye bir ad ver.' };
  if (state.cash < q.cost) return { ok: false, msg: `${q.name} ${q.cost.toLocaleString('tr-TR')} $ tutuyor.` };
  ledger.post('konsol_yapim', -q.cost, q.name);
  let sr = nextName(ctx, d).series;
  if (!sr) { sr = { id: state.nextId++, name: q.name, gen: 0, sold: 0 }; seriesList(state).push(sr); }
  const k = {
    id: `own${state.nextId++}`, name: q.name, type: t.id, kind: t.kind, parts: q.parts, tech: q.tech, genre: q.genre, aud: q.aud,
    appeal: q.appeal, margin: q.margin, piracy: q.piracy, price: q.price, seriesId: sr.id, gen: q.gen,
    phase: 0, points: 0, need: q.need, startedWeek: state.week, launched: null, retired: null, sunsetAt: null,
    base: 0, active: 0, weeks: 0, sold: 0, revenue: 0, ended: false,
  };
  state.consoles.push(k);
  state.consoleJob = k.id;
  ctx.news(`🛠️ Donanım projesi başladı: ${k.name} (${t.name}). Laboratuvar ışıkları hiç sönmeyecek.`, 'info');
  return { ok: true, console: k };
}

const seriesOf = (ctx, k) => seriesList(ctx.state).find((s) => s.id === k.seriesId);
// Önceki nesillerin toplam satışı seri ününü oluşturur.
export function seriesBoost(ctx, k) {
  const prev = ctx.state.consoles.filter((x) => x.seriesId && x.seriesId === k.seriesId && x !== k && (x.gen || 1) < (k.gen || 1));
  const sold = prev.reduce((a, x) => a + x.sold, 0) / 1e6;
  return 1 + C(ctx).seriesK * Math.log2(1 + sold);
}

function unitsThisWeek(ctx, k) {
  const { state } = ctx;
  const c = C(ctx), t = typeById(ctx, k.type) || c.types[2];
  const F = Math.max(1, 1 + 0.5 * Math.log10(Math.max(1, state.fans) / 10000));
  const games = state.games.filter((g) => g.platforms.includes(k.id) || (k.compatWith && g.platforms.includes(k.compatWith))).length;
  const price = c.prices.find((x) => x.id === k.price) || c.prices[1];
  let u = c.B * Pz(ctx) * lerpTable(t.demand || [[1976, 1]], tableYear(ctx)) * (t.units ?? 1) * qualityOf(ctx, k.tech, t) * F
    * (1 + c.ownGameBoost * games) * (k.appeal || 1) * price.units * seriesBoost(ctx, k) * Math.pow(c.decay, k.weeks);
  if (k.sunsetAt) u *= Math.pow(c.sunsetDecay, Math.max(0, state.week - (k.sunsetAt - c.overlapWeeks)));
  return Math.round(u);
}

export function weeklyConsole(ctx) {
  const { state, ledger } = ctx;
  const c = C(ctx);
  // Yapım
  const job = state.consoles.find((k) => k.id === state.consoleJob);
  if (job) {
    for (const { p, w } of weeklyOutput(ctx, (r) => r.type === 'donanim')) job.points += w * ctx.pack.careers.find((x) => x.id === p.career).hw * skillK(ctx, p, 'donanim');
    const built = state.week - job.startedWeek;
    if (built > 0 && built % c.fanLossWeeks === 0) {
      const last = state.games[state.games.length - 1];
      if (!last || state.week - last.releasedWeek > c.fanLossWeeks) {
        state.fans = Math.round(state.fans * (1 - c.fanLossPct));
        ctx.news('📉 Uzun süredir oyun çıkmadı; hayranlar sabırsız.', 'warn');
      }
    }
    if (job.points >= job.need) {
      job.phase++; job.points = 0;
      if (job.phase < c.phases.length) ctx.news(`🔧 ${job.name}: ${c.phases[job.phase - 1]} tamam. Sırada ${c.phases[job.phase]}.`, 'good');
      else launch(ctx, job);
    }
  }
  // Donanım satışı
  const infl = inflation(ctx) ** 0.5;
  for (const k of state.consoles) {
    if (!k.launched || k.retired) continue;
    if (k.sunsetAt && state.week >= k.sunsetAt) { k.retired = tableYear(ctx); ctx.news(`🪦 ${k.name} piyasadan çekildi. Toplam ${k.sold.toLocaleString('tr-TR')} adet.`, 'info'); continue; }
    if (k.ended) continue;
    const t = typeById(ctx, k.type) || c.types[2];
    const units = unitsThisWeek(ctx, k);
    k.weeks++;
    if (units < c.stopBelow * (t.units ?? 1) && k.weeks > 20) { k.ended = true; ctx.news(`🏭 ${k.name} üretimi durdu. Toplam ${k.sold.toLocaleString('tr-TR')} adet.`, 'info'); continue; }
    k.sold += units; k.active = (k.active || 0) + units; k.lastWeek = units;
    k.base = k.active * (t.players || 1) / 1e6;
    const m = (k.margin ?? c.marginPerUnit);
    if (m) { const r = Math.round(units * m * infl); k.revenue = (k.revenue || 0) + r; ledger.post('konsol', r, k.name); }
    const sr = seriesOf(ctx, k); if (sr) sr.sold = (sr.sold || 0) + units;
  }
}

export function monthlyConsole(ctx) {
  const { state, ledger } = ctx;
  const c = C(ctx);
  const infl = inflation(ctx) ** 0.5;
  for (const k of state.consoles) {
    if (!k.launched || k.retired) continue;
    const t = typeById(ctx, k.type) || c.types[2];
    // Salon jetonu / bulut aboneliği: kurulu birim başına aylık gelir, aylık kayıp
    if (t.monthly && k.active > 0) {
      const r = Math.round(k.active * t.monthly * infl);
      k.revenue = (k.revenue || 0) + r;
      ledger.post(t.id === 'bulut' ? 'abonelik' : 'jeton', r, k.name);
      k.active *= 1 - (t.churn || 0);
      k.base = k.active * (t.players || 1) / 1e6;
    }
    if (k.base > 0) ledger.post('konsol_lisans', Math.round(k.base * c.licencePerMillion * (1 - (k.piracy || 0)) * infl), `${k.name} lisansları`);
  }
}

function launch(ctx, k) {
  const { state } = ctx;
  const c = C(ctx);
  const y = tableYear(ctx);
  const sr = seriesOf(ctx, k);
  if (sr) sr.gen = Math.max(sr.gen, k.gen || 1);
  // Aynı ailenin aynı tipteki eski nesli bir süre daha satılır, sonra emekli olur. Geriye uyumluluk tabanın bir kısmını taşır.
  for (const old of state.consoles) {
    if (old === k || !old.launched || old.retired || old.sunsetAt) continue;
    const sameLine = old.seriesId ? old.seriesId === k.seriesId && old.type === k.type : old.type === k.type;
    if (!sameLine) continue;
    old.sunsetAt = state.week + c.overlapWeeks;
    if (state.research.done.hw_geri_uyum) { k.active += old.active * c.backCompat; k.compatWith = old.id; }
    ctx.news(`📦 ${old.name} son dönemine girdi; ${Math.round(c.overlapWeeks / 4)} ay daha raflarda.`, 'info');
  }
  const t = typeById(ctx, k.type);
  k.base = (k.active || 0) * (t?.players || 1) / 1e6;
  k.launched = y;
  state.consoleJob = null;
  state.heat += 5;
  ctx.queue({ id: 'konsol', title: `🎮 ${k.name} piyasada!`, text: `${t?.name || 'Konsol'} raflarda. Teknoloji ${k.tech} (dönem beklentisi ${expectedTech(ctx, t).toFixed(1)}). Artık oyunlarını lisans ödemeden bu platforma çıkarabilirsin; rakipler de sana lisans ödeyecek.${k.compatWith ? ' Geriye uyumluluk sayesinde eski neslin oyuncuları da geliyor.' : ''}`, choices: [{ label: 'Lansman partisi!', effects: { morale: 15, hype: 20 } }] });
  ctx.bus.fire('consoleLaunched', k);
}
