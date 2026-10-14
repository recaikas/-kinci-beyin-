// Oyun raporu ve bilgi birikimi (GDT esinli): her yayından sonra konu×tür, tür×alt tür, konu×alt tür, konu×kitle,
// platform×tür uyumu ve zaman dağılımı dersleri öğrenilir; sihirbaz bu bilgiyi gösterir.
// Konu D: uyumlar altı kademeli (Süper 10 · İyi 9 · Geçerli 8 · Başarısız 7 · Kötü 6 · İğrenç 4).
import { discShares, inflation, engineFactor, combo, platFit } from '../models.js';
import { hasRoom } from './staff.js';
import { TIER, tierOfValue, SUB, PRESS_LINES, PLAYER_LINES } from '../data/genres.js';
import { learnCombo } from './genres.js';

export const rating = (v) => { const t = TIER[tierOfValue(v)]; return [t.icon, t.name]; };
export const tierOf = (v) => TIER[tierOfValue(v)];

const ai = (ctx, id) => ctx.pack.audiences.findIndex((a) => a.id === id);
const topic = (ctx, id) => ctx.pack.topics.find((t) => t[0] === id);

// Bilinen uyumlar (yoksa undefined): sihirbaz rozetleri için.
export function known(ctx) {
  const k = ctx.state.knowledge;
  return {
    topicGenre: (t, g) => k[`tg|${t}|${g}`],
    genreSub: (g, s) => k[`gs|${g}|${s}`],
    topicSub: (t, s) => k[`ts|${t}|${s}`],
    topicAud: (t, a) => k[`ta|${t}|${a}`],
    platGenre: (p, g) => k[`pg|${p}|${g}`],
    genreFocus: (g) => k[`gf|${g}`],
    mission: (g, i) => k[`gm|${g}|${i}`], // görev önemi (GDT ağırlığı 0,6–1,0) oyuncu raporuyla öğrenilir
  };
}

export function learn(ctx, pj, rv) {
  const { state, pack } = ctx;
  const k = state.knowledge;
  const lines = [];
  const t = topic(ctx, pj.topic), g = pack.genres.find((x) => x.id === pj.genre);
  const c = learnCombo(ctx, pj), ta = t[3][ai(ctx, pj.audience)];
  k[`ta|${pj.topic}|${pj.audience}`] = ta;
  const line = (tier, text) => lines.push({ tone: TIER[tier].tone, text: `${text}: ${TIER[tier].name} (${TIER[tier].icon})` });
  line(c.kt, `${t[1]} + ${g.name}`);
  if (pj.sub && SUB[pj.sub]) {
    line(c.gs, `${g.name} + ${SUB[pj.sub].name}`);
    if (c.ts !== 'G') line(c.ts, `${t[1]} + ${SUB[pj.sub].name}`);
    lines.push({ tone: TIER[c.overall].tone, text: `Genel kombinasyon ${TIER[c.overall].name} ${TIER[c.overall].icon}${c.legend ? ` · efsane: ${c.legend.name}` : ''}. Basın: "${PRESS_LINES[c.overall]}"` });
  }
  const taT = tierOfValue(ta);
  lines.push({ tone: TIER[taT].tone, text: `${t[1]} konusu ${pack.audiences[ai(ctx, pj.audience)].name.toLowerCase()} kitle için: ${TIER[taT].name}` });
  if (c.audCap) lines.push({ tone: 'bad', text: `${SUB[pj.sub].name}, ${pack.audiences[ai(ctx, pj.audience)].name.toLowerCase()} kitleye ${TIER[c.audCap].name.toLowerCase()}; kitle uyumu bununla sınırlı kaldı.` });
  for (const id of pj.platforms.slice(0, 3)) {
    const p = pack.platforms.find((x) => x.id === id);
    if (!p) continue;
    const v = platFit(ctx, p, pj.genre, pj.sub);
    k[`pg|${id}|${pj.genre}`] = v;
    const pt = tierOfValue(v);
    if (v <= 8 || v >= 10) lines.push({ tone: TIER[pt].tone, text: `${p.name}, ${pj.sub && SUB[pj.sub]?.plat?.[p.kind] ? SUB[pj.sub].name.toLowerCase() : g.name.toLowerCase()} için ${TIER[pt].name.toLowerCase()} bir platform` });
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
  for (const n of rv.notes) if (/Alt tür (başarısız|kötü|iğrenç|yok)|Konu ve alt tür (başarısız|kötü|iğrenç)|acemi|çırak|tekrar|Eskimiş|Küçük boyut/.test(n)) lines.push({ tone: 'bad', text: n });
  for (const n of rv.notes) if (/Kült klasik|usta|uzman|efsane/.test(n)) lines.push({ tone: 'good', text: n });
  ctx.bus.fire('gameReport', { project: pj, lines });
  return lines;
}

// Oyuncu raporu (GDT esinli): oyuncuların neyi sevip neyi sevmediği. Görev önemleri bilgi olarak kalır.
export function reportCost(ctx) {
  return hasRoom(ctx, 'musteri') ? 0 : Math.round(ctx.pack.playerReport.cost * inflation(ctx) ** 0.5);
}
export function playerReport(ctx, id) {
  const { state, pack, ledger, rng } = ctx;
  const R = pack.playerReport;
  const g = state.games.find((x) => x.id === id);
  if (!g) return { ok: false, msg: 'Oyun yok.' };
  if (g.playerReport) return { ok: true, lines: g.playerReport };
  if (g.active && g.weeks < R.minWeeks) return { ok: false, msg: `Oyuncuların fikir oluşturması için ${R.minWeeks} hafta satışta kalmalı.` };
  if (!g.alloc) return { ok: false, msg: 'Bu oyun için yeterli veri yok.' };
  const cost = reportCost(ctx);
  if (state.cash < cost) return { ok: false, msg: `Rapor ${cost.toLocaleString('tr-TR')} $.` };
  if (cost) ledger.post('arastirma', -cost, `Oyuncu raporu: ${g.name}`);
  const genre = pack.genres.find((x) => x.id === g.genre);
  const k = state.knowledge;
  const lines = [];
  // Görevler: faz içindeki pay ile türün görev önemi karşılaştırılır.
  for (let ph = 0; ph < 3; ph++) {
    const ids = pack.missions.map((m, i) => i).filter((i) => pack.missions[i].phase === ph);
    const sum = ids.reduce((a, i) => a + g.alloc[i], 0) || 1;
    for (const i of ids) {
      const m = pack.missions[i], wgt = genre.mission[i], share = g.alloc[i] / sum;
      k[`gm|${g.genre}|${i}`] = wgt;
      if (wgt >= 1 && share >= R.highAlloc) lines.push({ tone: 'good', text: `Oyuncular ${m.name.toLowerCase()} kısmına bayıldı. ${genre.name} için kritik ve iyi yatırım yapmışsın.` });
      else if (wgt >= 1 && share < R.lowAlloc) lines.push({ tone: 'bad', text: `${m.name} zayıf bulundu. ${genre.name} oyuncuları buna çok önem veriyor.` });
      else if (wgt <= 0.7 && share >= R.highAlloc) lines.push({ tone: 'bad', text: `${m.name} için harcanan emek fark edilmedi; ${genre.name} oyuncuları pek önemsemiyor.` });
    }
  }
  // Kitle, fiyat, hata, motor, beklenti
  const t = pack.topics.find((x) => x[0] === g.topic), ai = pack.audiences.findIndex((a) => a.id === g.audience);
  const best = pack.audiences.map((a, i) => [a, t[3][i]]).sort((a, b) => b[1] - a[1])[0];
  if (best[0].id !== g.audience && best[1] > t[3][ai]) lines.push({ tone: 'info', text: `${t[1]} konusu en çok ${best[0].name.toLowerCase()} kitlede tuttu; bir dahaki sefere onları hedefle.` });
  const ref = pack.sales.priceRef * (g.platforms.some((id) => pack.platforms.find((p) => p.id === id)?.priceRef) ? 0.3 : 1) * inflation(ctx) ** 0.4;
  if (g.price > ref * R.priceHigh) lines.push({ tone: 'bad', text: `Fiyat pahalı bulundu (${g.price} $). Satış daha hızlı düştü.` });
  else if (g.price < ref * R.priceLow) lines.push({ tone: 'info', text: `Oyuncular fiyatı çok uygun buldu; biraz daha pahalı da satardı.` });
  if ((g.bugRate || 0) * pack.review.bugMult > 2) lines.push({ tone: 'bad', text: 'Forumlar hata şikâyetiyle dolu. Güncelleme çıkar ya da bir dahakine QA odası kullan.' });
  const eng = state.engines.find((e) => e.id === g.engineId);
  if (engineFactor(ctx, eng) < 1) lines.push({ tone: 'bad', text: 'Teknik açıdan dönemin gerisinde bulundu. Daha yeni bir motor gerek.' });
  if (g.hype - (g.score - 50) > R.hypeGap) lines.push({ tone: 'bad', text: 'Reklam beklentiyi çok yükseltti; oyun karşılayamayınca hayal kırıklığı oldu.' });
  else if (g.score >= 80 && g.hype < 20) lines.push({ tone: 'info', text: 'Oyunu sevenler çok ama kimse duymamış. Daha çok pazarlama satışları katlardı.' });
  if (!lines.some((l) => l.tone === 'good')) lines.push({ tone: 'info', text: 'Oyuncular dikkat çekici bir güçlü yan bulamadı.' });
  const fan = ['"Gece 4\'e kadar oynadım, işe geç kaldım."', '"Kedim bile izledi."', '"Devamı ne zaman?!"', '"Para iadesi istiyorum, ama yine de oynuyorum."', '"Kardeşimle kavga ettik, kontrolcü bende kalacak."', '"Bu fiyata bu kadar hata olmaz."', '"Müziği hâlâ kafamda."', '"Sonunu beğenmedim ama 3 kez bitirdim."'];
  const cb = g.genre && g.topic ? combo(ctx, g) : null;
  lines.push({ tone: 'quote', text: `Bir oyuncu: ${g.cult ? '"Bu kadar kötü olması onu iyi yapıyor. Üç kez bitirdim."' : cb && g.sub && rng.chance(0.5) ? `"${PLAYER_LINES[cb.overall]}"` : rng.pick(fan)}` });
  g.playerReport = lines;
  ctx.bus.fire('playerReport', { game: g, lines });
  ctx.news(`📋 "${g.name}" için oyuncu raporu hazır.`, 'info');
  return { ok: true, lines };
}
