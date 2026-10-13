// Özel konsol (Game Dev Story): donanım laboratuvarı + donanım mühendisi, iki aşamalı yapım, piyasaya çıkış,
// donanım satışı ve rakiplerden lisans geliri. Yeni konsol eskisini piyasadan çeker (V).
import { clamp, lerpTable } from '../kernel.js';
import { H, Pz, inflation, tableYear } from '../models.js';
import { weeklyOutput, hasRoom } from './staff.js';

const C = (ctx) => ctx.pack.console;
export const hwEngineers = (ctx) => ctx.state.staff.filter((p) => p.career === 'donanimci');

export function consoleParts(ctx) {
  const y = tableYear(ctx), c = C(ctx), n = hwEngineers(ctx).length;
  const ok = (x) => y >= x.year && (!x.hwEng || n >= x.hwEng);
  return { types: c.types, cpus: c.cpus.filter(ok), media: c.media.filter(ok) };
}

export function consoleBlockers(ctx) {
  const s = ctx.state, out = [];
  if (!s.research.done.donanim_lab) out.push('Donanım laboratuvarı araştırması');
  if (!hasRoom(ctx, 'donanim')) out.push('Donanım laboratuvarı odası');
  if (!hwEngineers(ctx).length) out.push('En az bir Donanım Mühendisi (Yönetmen + Yapımcı seviye 5 olan biri)');
  return out;
}

export function consoleQuote(ctx, d) {
  const c = C(ctx);
  const t = c.types.find((x) => x.id === d.type), cpu = c.cpus.find((x) => x.id === d.cpu), m = c.media.find((x) => x.id === d.media);
  if (!t || !cpu || !m) return null;
  const tech = clamp(Math.round((cpu.tech * 2 + m.tech) / 3), 1, 7);
  return { cost: Math.round((t.cost + cpu.cost + m.cost) * c.costScale), tech, need: Math.round(H(ctx) * c.pointsK * (1 + tech / 7)) };
}

export function startConsole(ctx, d) {
  const { state, ledger } = ctx;
  if (state.consoleJob) return { ok: false, msg: 'Zaten bir konsol yapılıyor.' };
  const block = consoleBlockers(ctx);
  if (block.length) return { ok: false, msg: `Eksik: ${block[0]}.` };
  const parts = consoleParts(ctx);
  if (!parts.cpus.some((x) => x.id === d.cpu) || !parts.media.some((x) => x.id === d.media)) return { ok: false, msg: 'Bu parça henüz kullanılamaz.' };
  const q = consoleQuote(ctx, d);
  if (!q) return { ok: false, msg: 'Parçaları seç.' };
  if (state.cash < q.cost) return { ok: false, msg: `Konsol ${q.cost.toLocaleString('tr-TR')} $ tutuyor.` };
  ledger.post('konsol_yapim', -q.cost, d.name);
  const k = { id: `own${state.nextId++}`, name: d.name || 'X Kutu', type: d.type, cpu: d.cpu, media: d.media, tech: q.tech,
    phase: 0, points: 0, need: q.need, startedWeek: state.week, launched: null, retired: null, base: 0, weeks: 0, sold: 0, ended: false };
  state.consoles.push(k);
  state.consoleJob = k.id;
  ctx.news(`🛠️ Konsol projesi başladı: ${k.name}. Laboratuvar ışıkları hiç sönmeyecek.`, 'info');
  return { ok: true };
}

const qualityFactor = (ctx, k) => {
  const c = C(ctx);
  return clamp(1 + c.qualityK * (k.tech - lerpTable(c.expectedTech, tableYear(ctx))), c.qualityMin, c.qualityMax);
};

export function weeklyConsole(ctx) {
  const { state, ledger } = ctx;
  const c = C(ctx);
  // Yapım
  const job = state.consoles.find((k) => k.id === state.consoleJob);
  if (job) {
    for (const { p, w } of weeklyOutput(ctx, (r) => r.type === 'donanim')) job.points += w * ctx.pack.careers.find((x) => x.id === p.career).hw;
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
  const F = Math.max(1, 1 + 0.5 * Math.log10(Math.max(1, state.fans) / 10000));
  for (const k of state.consoles) {
    if (!k.launched || k.retired || k.ended) continue;
    const games = state.games.filter((g) => g.platforms.includes(k.id)).length;
    const units = Math.round(c.B * Pz(ctx) * qualityFactor(ctx, k) * F * (1 + c.ownGameBoost * games) * Math.pow(c.decay, k.weeks));
    k.weeks++;
    if (units < c.stopBelow && k.weeks > 20) { k.ended = true; ctx.news(`🏭 ${k.name} üretimi durdu. Toplam ${k.sold.toLocaleString('tr-TR')} adet.`, 'info'); continue; }
    k.sold += units; k.base += units / 1e6;
    ledger.post('konsol', Math.round(units * c.marginPerUnit * infl), k.name);
  }
}

export function monthlyConsole(ctx) {
  const { state, ledger } = ctx;
  const c = C(ctx);
  for (const k of state.consoles) {
    if (!k.launched || k.retired || k.base <= 0) continue;
    ledger.post('konsol_lisans', Math.round(k.base * c.licencePerMillion * inflation(ctx) ** 0.5), `${k.name} lisansları`);
  }
}

function launch(ctx, k) {
  const { state } = ctx;
  const y = tableYear(ctx);
  for (const old of state.consoles) if (old.launched && !old.retired) { old.retired = y; ctx.news(`🪦 ${old.name} piyasadan çekildi.`, 'info'); }
  k.launched = y;
  state.consoleJob = null;
  state.heat += 5;
  ctx.queue({ id: 'konsol', title: `🎮 ${k.name} piyasada!`, text: `Kendi konsolun raflarda. Teknoloji seviyesi ${k.tech}. Artık oyunlarını lisans ödemeden bu platforma çıkarabilirsin; rakipler de sana lisans ödeyecek.`, choices: [{ label: 'Lansman partisi!', effects: { morale: 15, hype: 20 } }] });
  ctx.bus.fire('consoleLaunched', k);
}
