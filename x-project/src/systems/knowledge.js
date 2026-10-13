// Oyun raporu ve bilgi birikimi (GDT esinli): her yayından sonra konu×tür, konu×kitle, platform×tür uyumu
// ve zaman dağılımı dersleri öğrenilir; sihirbaz bu bilgiyi gösterir. Uyum değerleri 6–10 (GDT ölçeği, V).
import { discShares } from '../models.js';

const LABEL = { 10: ['+++', 'Harika'], 9: ['++', 'İyi'], 8: ['+', 'Fena değil'], 7: ['−', 'Kötü'], 6: ['−−', 'Berbat'] };
export const rating = (v) => LABEL[Math.max(6, Math.min(10, Math.round(v)))];

const gi = (ctx, id) => ctx.pack.genres.findIndex((g) => g.id === id);
const ai = (ctx, id) => ctx.pack.audiences.findIndex((a) => a.id === id);
const topic = (ctx, id) => ctx.pack.topics.find((t) => t[0] === id);

// Bilinen uyumlar (yoksa undefined): sihirbaz rozetleri için.
export function known(ctx) {
  const k = ctx.state.knowledge;
  return {
    topicGenre: (t, g) => k[`tg|${t}|${g}`],
    topicAud: (t, a) => k[`ta|${t}|${a}`],
    platGenre: (p, g) => k[`pg|${p}|${g}`],
    genreFocus: (g) => k[`gf|${g}`],
  };
}

export function learn(ctx, pj, rv) {
  const { state, pack } = ctx;
  const k = state.knowledge;
  const lines = [];
  const t = topic(ctx, pj.topic), g = pack.genres.find((x) => x.id === pj.genre);
  const tg = t[2][gi(ctx, pj.genre)], ta = t[3][ai(ctx, pj.audience)];
  k[`tg|${pj.topic}|${pj.genre}`] = tg;
  k[`ta|${pj.topic}|${pj.audience}`] = ta;
  lines.push({ tone: tg >= 9 ? 'good' : tg <= 7 ? 'bad' : 'info', text: `${t[1]} + ${g.name}: ${rating(tg)[1]} (${rating(tg)[0]})` });
  lines.push({ tone: ta >= 9 ? 'good' : ta <= 7 ? 'bad' : 'info', text: `${t[1]} konusu ${pack.audiences[ai(ctx, pj.audience)].name.toLowerCase()} kitle için: ${rating(ta)[1]}` });
  for (const id of pj.platforms.slice(0, 3)) {
    const p = pack.platforms.find((x) => x.id === id);
    if (!p) continue;
    const v = p.genre[gi(ctx, pj.genre)];
    k[`pg|${id}|${pj.genre}`] = v;
    if (v <= 8 || v === 10) lines.push({ tone: v === 10 ? 'good' : 'bad', text: `${p.name}, ${g.name.toLowerCase()} için ${rating(v)[1].toLowerCase()} bir platform` });
  }
  // Disiplin hedefleri
  const weak = Object.entries(rv.parts).filter(([, v]) => v < 80).sort((a, b) => a[1] - b[1]);
  const name = (d) => pack.disciplines.find((x) => x.id === d).name;
  if (weak.length) lines.push({ tone: 'bad', text: `Hedefin gerisinde: ${weak.map(([d, v]) => `${name(d)} %${v}`).join(', ')}. Daha büyük ekip, uzman oda ya da dış kaynak.` });
  else lines.push({ tone: 'good', text: 'Dört disiplin de hedefe ulaştı.' });
  // Zaman dağılımı
  if (rv.hiza < 0.92) {
    k[`gf|${pj.genre}`] = true;
    const ideal = ['oyn', 'gfx', 'ses', 'tek'].map((d) => `${name(d)} %${Math.round(g.disc[d] * 100)}`).join(' / ');
    const mine = discShares(ctx, pj.alloc);
    const off = ['oyn', 'gfx', 'ses', 'tek'].sort((a, b) => Math.abs(mine[b] - g.disc[b]) - Math.abs(mine[a] - g.disc[a]))[0];
    lines.push({ tone: 'bad', text: `Zaman dağılımı türe uymadı (×${rv.hiza.toFixed(2)}). ${g.name} için ideal: ${ideal}. En çok ${name(off)} ${mine[off] > g.disc[off] ? 'fazla' : 'az'}.` });
  } else { k[`gf|${pj.genre}`] = true; lines.push({ tone: 'good', text: `Zaman dağılımı ${g.name.toLowerCase()} türüne uydu.` }); }
  if (rv.bugRate * pack.review.bugMult > 2) lines.push({ tone: 'bad', text: `Hatalar notu ${Math.min(pack.review.bugCap, rv.bugRate * pack.review.bugMult).toFixed(1)} puan düşürdü. Kalite güvence odası ya da daha uzun ayıklama.` });
  for (const n of rv.notes) if (/Alt tür|tekrar|Eskimiş|Küçük boyut/.test(n)) lines.push({ tone: 'bad', text: n });
  ctx.bus.fire('gameReport', { project: pj, lines });
  return lines;
}
