// Kalibrasyon ve tutarlılık kontrolleri. Çalıştır: node test/validate.mjs
// "Veri tekrarı" = PDF tablosunu birebir doğrular; "Kalibrasyon" = parametreler bu referansa göre seçildi.
import { PACK } from '../src/data/pack.js';
import { createState, makeGame, newGame, Prod, Staff, Con, Post, Know } from '../src/game.js';
import * as M from '../src/models.js';
import { runBot } from './bot.mjs';

let pass = 0, fail = 0;
const check = (name, ok, info = '', kind = 'Tutarlılık') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? '✔' : '✘'} [${kind}] ${name}${info ? ' — ' + info : ''}`);
};
const ctxAt = (year, difficulty = 'kolay', prestige = 0) => {
  const st = createState({ difficulty, length: 30 });
  st.week = Math.round((year - 1976) * 48);
  st.prestige = prestige;
  return makeGame(st).ctx;
};

// 1) Hedef tablosu (V)
const c76 = ctxAt(1976), c85 = ctxAt(1985), c94 = ctxAt(1994);
check('H(1976)=40', Math.abs(M.H(c76) - 40) < 0.5, M.H(c76).toFixed(1), 'Veri tekrarı');
check('H(1985)=363', Math.abs(M.H(c85) - 363) < 2, M.H(c85).toFixed(1), 'Veri tekrarı');
check('H(1994)=1334', Math.abs(M.H(c94) - 1334) < 3, M.H(c94).toFixed(1), 'Veri tekrarı');
check('τ teknik 1976 = 1,125', M.tau(c76, 'tek') === 1.125, '', 'Veri tekrarı');

// 2) Disiplin ağırlıkları toplamı 1
for (const g of PACK.genres) {
  const s = Object.values(g.disc).reduce((a, b) => a + b, 0);
  check(`${g.name} ağırlık toplamı 1`, Math.abs(s - 1) < 0.002, s.toFixed(3));
  check(`${g.name} 9 görev`, g.mission.length === 9 && g.hint.length === 9);
}

// 3) Not: hedefin %100'ü ~98, %50'si ~49 (MGT2 yapısı)
const proj = (ctx, frac) => {
  const g = PACK.genres.find((x) => x.id === 'aksiyon');
  const p = { genre: 'aksiyon', sub: 'macera', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'orta', engineId: null, bugs: 0, points: {}, alloc: [] };
  // ideal hizalama: payA = w_d
  const share = { oyn: 0, gfx: 0, ses: 0, tek: 0 };
  PACK.missions.forEach((m) => (share[m.disc] += 1));
  p.alloc = PACK.missions.map((m) => (g.disc[m.disc] / share[m.disc]) * 100);
  for (const d of ['oyn', 'gfx', 'ses', 'tek']) p.points[d] = M.target(ctx, d, 'orta') * frac;
  return p;
};
const fitCtx = ctxAt(1985, 'zor');
const pFull = proj(fitCtx, 1), pHalf = proj(fitCtx, 0.5);
const F = M.fitFactor(fitCtx, pFull);
const rFull = M.review(fitCtx, pFull).score / F, rHalf = M.review(fitCtx, pHalf).score / F;
check('Hedefin %100ü → ~98', rFull >= 97 && rFull <= 100.5, rFull.toFixed(1), 'MGT2 yapısı');
check('Hedefin %50si → ~49', Math.abs(rHalf - 49) < 1.5, rHalf.toFixed(1), 'MGT2 yapısı');

// 4) Prestij eşiği: P=3 aynı puanı 99'dan ~72'ye indirir
const cP3 = ctxAt(1985, 'zor', 3);
const r3 = M.review(cP3, pFull).score / F;
check('P=3 → ~72', Math.abs(r3 - 72) < 2.5, r3.toFixed(1), 'Tasarım davranışı (P)');

// 5) 22 kişi Ocak 1976 Efsanevi, 1 aylık proje → hedefin %98'i
{
  const ctx = ctxAt(1976, 'efsanevi');
  const n = 22;
  const per = M.personWeekly(ctx, { skill: 35, morale: 100, trait: null }, n);
  const total = per * n * 4;
  const need = ['oyn', 'gfx', 'ses'].reduce((s, d) => s + M.target(ctx, d, 'orta'), 0) + M.target(ctx, 'tek', 'orta');
  check('22 kişi Oca 1976 Efsanevi hedefi yakalar', Math.abs(total - need) / need < 0.05, `${total.toFixed(0)} / ${need.toFixed(0)}`, 'Kalibrasyon');
}

// 6) Satış ölçeği (yeniden kalibrasyon, P): 1992 yerleşik hit ≈ 40 bin/hafta, 1977 garaj iyi oyun ≈ 300/hafta
{
  const ctx = ctxAt(1992, 'orta');
  ctx.state.fans = 100000; ctx.state.prestige = 2;
  const g = { score: 90, price: 35, hype: 50, ipValue: 1, publisherPower: 90, size: 'orta', genre: 'aksiyon', audience: 'genc' };
  g.platforms = M.activePlatforms(ctx).map((p) => p.id);
  const all = Object.values(M.peakWeekly(ctx, g)).reduce((a, b) => a + b, 0);
  check('1992 yerleşik hit 20–60 bin/hafta', all > 20000 && all < 60000, all.toFixed(0), 'Kalibrasyon');
  const one = M.peakWeekly(ctx, { ...g, platforms: ['snes'] }).snes;
  check('Tek platform daha az satar', one < all, one.toFixed(0));
  const c77 = ctxAt(1977, 'orta');
  const early = M.peakWeekly(c77, { score: 75, price: 20, hype: 10, ipValue: 0, publisherPower: 55, size: 'kucuk', genre: 'aksiyon', audience: 'genc', platforms: ['pc', 'ataro'] });
  const e = Object.values(early).reduce((a, b) => a + b, 0);
  check('1977 garaj iyi oyun 100–800/hafta', e > 100 && e < 800, e.toFixed(0), 'Kalibrasyon');
}

// 7) Fiyat tatlı noktası: 35 $ referansında gelir/fiyat dengesi
{
  const ctx = ctxAt(1992, 'kolay');
  const rev = (price) => { const g = { score: 80, price, hype: 30, ipValue: 1, publisherPower: 80, platforms: ['pc'], size: 'orta', genre: 'rpg', audience: 'yetiskin' }; return M.peakWeekly(ctx, g).pc * price; };
  check('Düşük fiyat daha çok adet ama esneklik 1,5', rev(20) > rev(50), `${rev(20).toFixed(0)} > ${rev(50).toFixed(0)}`, 'Kaba tutarlılık');
}

// 8) Hafta eğrisi
{
  const ctx = ctxAt(1990);
  check('Hafta eğrisi 0,6 / 0,85 / 1 / 0,85', [0, 1, 2, 3].map((n) => M.weekCurve(ctx, n)).join() === '0.6,0.85,1,0.85', '', 'Veri tekrarı');
}

// 9) Olay paketinin bütünlüğü
for (const e of PACK.events) check(`Olay ${e.id} seçenekli`, Array.isArray(e.choices) && e.choices.length > 0);

// 10) Deterministik RNG: aynı tohum + aynı eylemler = aynı sonuç
{
  const a = runBot({ seed: 42, difficulty: 'orta', years: 6 }), b = runBot({ seed: 42, difficulty: 'orta', years: 6 });
  check('Tohumlu RNG tekrarlanabilir', a.cash === b.cash && a.games === b.games, `${a.cash} = ${b.cash}`);
}

// 11) Duman testi: basit bot
{
  const med = runBot({ seed: 7, difficulty: 'orta', years: 20 });
  console.log('   Orta  :', med);
  check('Orta: 20 yılda batmaz', !med.over || med.over === 'son', med.over || '', 'Duman');
  check('Orta: aşırı zengin değil (< 50 M)', med.cash < 50e6, (med.cash / 1e6).toFixed(1) + ' M', 'Duman');
  const leg = runBot({ seed: 7, difficulty: 'efsanevi', years: 20 });
  console.log('   Efsane:', leg);
  check('Efsanevi, Orta’dan zor', leg.cash < med.cash, '', 'Duman');
}

// 12) Kairosoft kariyer kuralları (V): ileri kariyer için aynı kişinin ön koşulları seviye 5 olmalı
{
  const g = newGame({ seed: 3, difficulty: 'kolay' });
  const ctx = g.ctx, p = g.state.staff[0];
  p.careers = { kodcu: 5, yazar: 4 }; p.career = 'kodcu';
  check('Yazar sv.4 iken Yönetmen kapalı', !Staff.careerOptions(ctx, p).some((c) => c.id === 'yonetmen'), '', 'Veri tekrarı');
  p.careers.yazar = 5;
  check('Kodcu 5 + Yazar 5 → Yönetmen açık', Staff.careerOptions(ctx, p).some((c) => c.id === 'yonetmen'), '', 'Veri tekrarı');
  g.state.research.rp = 1000; g.state.cash = 1e6;
  const before = p.salary;
  g.changeCareer(p.id, 'yonetmen');
  check('Kariyer değişti', p.career === 'yonetmen' && p.careers.yonetmen === 0);
  g.levelUp(p.id);
  check('Seviye atladı', p.careers.yonetmen === 1);
  check('Maaş seviye başına ×1,2 (kurucu hariç)', PACK.careerRules.salaryPerLevel === 1.2 && p.salary === before, '', 'Veri tekrarı');
}

// 13) Dış kaynak fiyat–kalite eğrisi (P): ücret ~240×, puan ~11–12×
{
  const ctx = ctxAt(1990);
  const lo = Prod.outsourceRow(ctx, 0), hi = Prod.outsourceRow(ctx, 4);
  const r = hi.points / lo.points;
  check('Dış kaynak getirisi azalan (×240 ücret → ×10–13 puan)', r > 10 && r < 13, r.toFixed(1), 'Kaba tutarlılık');
}

// 14) Odalar: koltuklar odalardan gelir, uzman oda kendi disiplinine puan verir
{
  const g = newGame({ seed: 5, difficulty: 'kolay' });
  const st = g.state;
  check('Garaj: 1 oda, 1 koltuk', st.rooms.length === 1 && Staff.seats(g.ctx) === 1);
  st.cash = 1e7; st.office.tier = 3; st.research.done.oda_uzman = 1;
  check('Grafik stüdyosu kurulur', g.buildRoom('grafik').ok && Staff.seats(g.ctx) === 8);
  g.startProject({ name: 'T', genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' });
  const artist = Staff.makePerson(g.ctx, { career: 'tasarimci', level: 0, skill: 50 });
  artist.room = st.rooms[1].id; st.staff.push(artist);
  const pj = st.projects[0]; const gfx0 = pj.points.gfx; Prod.weeklyProject(g.ctx);
  check('Grafik stüdyosu faz 1’de bile grafik üretir', pj.points.gfx > gfx0);
}

// 15) Özel konsol: engeller, yapım ve çıkış
{
  const g = newGame({ seed: 9, difficulty: 'kolay' });
  const st = g.state, ctx = g.ctx;
  st.week = Math.round((1995 - 1976) * 48 * st.lengthMult);
  check('Konsol engelleri listelenir', Con.consoleBlockers(ctx).length === 3);
  st.cash = 1e9; st.office.tier = 3; st.research.done.donanim_lab = 1;
  g.buildRoom('donanim');
  // Rastgele olaylar mühendisi götürmesin diye kurucu gibi işaretlenir (istifa/transfer/kovulma dışı).
  const eng = Staff.makePerson(ctx, { career: 'donanimci', level: 3, skill: 80 }); eng.room = st.rooms[1].id; eng.founder = true; st.staff.push(eng);
  const res = g.startConsole({ name: 'Piksel Kutu', type: 'konsol', cpu: 'b32', media: 'cd' });
  check('Konsol yapımı başlar', res.ok, res.msg || '');
  for (let i = 0; i < 400 && st.consoleJob; i++) { while (st.pending.length) g.resolve(0); g.tick(); }
  const k = st.consoles[0];
  check('Konsol piyasaya çıkar', !!k.launched, `${k.phase}/${PACK.console.phases.length}`);
  for (let i = 0; i < 20; i++) { while (st.pending.length) g.resolve(0); g.tick(); }
  check('Konsol satar ve platform olur', k.sold > 0 && M.activePlatforms(ctx).some((p) => p.id === k.id), k.sold.toLocaleString());
}

// 16) Çoklu proje (MGT): her geliştirme odası kendi oyununu yapar
{
  const g = newGame({ seed: 12, difficulty: 'kolay' });
  const st = g.state;
  st.cash = 1e7; st.office.tier = 2;
  const base = { genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' };
  check('İlk proje başlar', g.startProject({ ...base, name: 'A' }).ok);
  check('Oda yokken ikinci proje başlamaz', !g.startProject({ ...base, name: 'B' }).ok);
  g.buildRoom('gelistirme');
  const p2 = Staff.makePerson(g.ctx, { skill: 50 }); p2.room = st.rooms[1].id; st.staff.push(p2);
  check('Yeni odada ikinci proje başlar', g.startProject({ ...base, name: 'B' }).ok && st.projects.length === 2);
  for (let i = 0; i < 4; i++) { st.pending = []; g.tick(); }
  check('İki proje birlikte ilerler', st.projects.every((p) => p.week > 0), st.projects.map((p) => p.week).join('/'));
}

// 17) Oyun raporu ve yayın sonrası
{
  const g = newGame({ seed: 13, difficulty: 'kolay' });
  const st = g.state;
  st.cash = 1e7;
  g.startProject({ name: 'R', genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' });
  while (st.projects[0].status === 'dev') { st.pending = []; g.tick(); }
  const res = g.release({ projectId: st.projects[0].id, publisherId: 'mantar', price: 20 });
  check('Rapor üretilir ve bilgi birikir', res.report.length >= 3 && Know.known(g.ctx).topicGenre('uzay', 'aksiyon') === 10, res.report.length + ' satır');
  const game = res.game;
  for (let i = 0; i < 3; i++) { st.pending = []; g.tick(); }
  const w = game.weeks; check('Güncelleme satış ömrünü uzatır', g.patch(game.id).ok && game.weeks < w);
  const pr = game.price; check('Fiyat indirimi', g.priceDrop(game.id).ok && game.price < pr);
  st.week = Math.round(8 * 48 * st.lengthMult);
  const target = Post.portTargets(g.ctx, game)[0];
  check('Port yeni oyun kaydı açar', !!target && g.port(game.id, target.id).ok && st.games.length === 2, target?.name || '');
  st.week = game.releasedWeek + 10;
  check('Ek paket projesi başlar', g.startExpansion(game.id).ok && st.projects[0].kind === 'ek');
}

console.log(`\n${pass} geçti, ${fail} kaldı.`);
process.exit(fail ? 1 : 0);
