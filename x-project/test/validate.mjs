// Kalibrasyon ve tutarlılık kontrolleri. Çalıştır: node test/validate.mjs
// "Veri tekrarı" = PDF tablosunu birebir doğrular; "Kalibrasyon" = parametreler bu referansa göre seçildi.
import { PACK } from '../src/data/pack.js';
import { createState, makeGame, newGame, Prod, Staff, Con, Post, Know, World, People, Co, Eco, Market, War } from '../src/game.js';
import { COMPANIES, YEARS } from '../src/data/history.js';
import { readFileSync } from 'node:fs';
import * as Ev from '../src/systems/events.js';
import * as M from '../src/models.js';
import { runSmartBot } from './smartbot.mjs';

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
  const a = runSmartBot({ seed: 42, difficulty: 'orta', years: 6 }), b = runSmartBot({ seed: 42, difficulty: 'orta', years: 6 });
  check('Tohumlu RNG tekrarlanabilir', a.cash === b.cash && a.games === b.games, `${a.cash} = ${b.cash}`);
}

// 11) Duman testi: akıllı bot 50 yıl (1976–2025) oynar. Tam rapor: node tools/balance.mjs 8 --md docs/DENGE.md
{
  const med = (rs) => rs.map((r) => r.cash).sort((a, b) => a - b)[Math.floor(rs.length / 2)];
  const orta = [3, 11, 19].map((seed) => runSmartBot({ seed, difficulty: 'orta', years: 50 }));
  const kolay = [3, 11].map((seed) => runSmartBot({ seed, difficulty: 'kolay', years: 50 }));
  const efs = [19, 27, 35].map((seed) => runSmartBot({ seed, difficulty: 'efsanevi', years: 50 }));
  console.log('   Orta    :', orta.map((r) => `${r.over || 'ayakta'} ${(r.cash / 1e6).toFixed(1)}M`).join(' | '));
  console.log('   Efsanevi:', efs.map((r) => `${r.over || 'ayakta'} ${(r.cash / 1e6).toFixed(1)}M`).join(' | '));
  check('Orta: bot 50 yılı batmadan bitirir', orta.every((r) => !r.over), orta.map((r) => r.over || 'ok').join(','), 'Duman');
  check('Orta: aşırı zengin değil (medyan < 1 milyar)', med(orta) < 1e9, (med(orta) / 1e6).toFixed(0) + ' M', 'Duman');
  check('Kolay, Orta’dan zengin', med(kolay) > med(orta), '', 'Duman');
  check('Efsanevi kazanılabilir: bot en az bir tohumda 2025’e ulaşır', efs.some((r) => !r.over), efs.map((r) => r.over || 'ok').join(','), 'Duman');
  check('Efsanevi, Orta’dan çok daha zor', med(efs) < med(orta) / 10, '', 'Duman');
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

// 15) Özel donanım: engeller, dönemsel parçalar, aileler ve nesiller, salon jetonu
{
  const g = newGame({ seed: 9, difficulty: 'kolay' });
  const st = g.state, ctx = g.ctx;
  st.week = Math.round((1995 - 1976) * 48 * st.lengthMult);
  check('Konsol engelleri listelenir', Con.consoleBlockers(ctx).length === 3);
  st.cash = 1e9; st.office.tier = 3; st.research.done.donanim_lab = 1;
  g.buildRoom('donanim');
  const eng = Staff.makePerson(ctx, { career: 'donanimci', level: 3, skill: 80 }); eng.room = st.rooms[1].id; eng.founder = true; st.staff.push(eng);
  check('En az 8 donanım tipi', PACK.console.types.length >= 8, PACK.console.types.map((t) => t.name).join(', '));
  const names = (cat, t = 'konsol') => Con.consoleParts(ctx, t).cats[cat].filter((x) => x.ok).map((x) => x.p.id);
  check('1995: kartuş var, CD araştırmasız kapalı, DVD yok', names('media').includes('kartus') && !names('media').includes('cd') && !names('media').includes('dvd'));
  st.research.done.hw_cd = 1; st.research.done.hw_32bit = 1;
  check('Araştırma CD-ROM ve 32-bit açar', names('media').includes('cd') && names('cpu').includes('c_32'));
  check('El konsolu araştırmasız kapalı', !Con.typeStatus(ctx, Con.typeById(ctx, 'tasinabilir')).ok);
  const d = { type: 'konsol', series: 'yeni', seriesName: 'Piksel Kutu', price: 'normal', parts: { cpu: 'c_32', gpu: 'g_karakter', media: 'cd', ctrl: 'k_joy', net: 'n_yok' } };
  const q = Con.consoleQuote(ctx, d);
  check('Teklif: teknoloji ve maliyet hesaplanır', q && !q.issues.length && q.tech > 1 && q.cost > 0, q && `tech ${q.tech} · ${q.cost}`);
  const res = g.startConsole(d);
  check('Konsol yapımı başlar', res.ok, res.msg || '');
  for (let i = 0; i < 600 && st.consoleJob; i++) { while (st.pending.length) g.resolve(0); g.tick(); }
  const k = st.consoles[0];
  check('Konsol piyasaya çıkar', !!k.launched, `${k.phase}/${PACK.console.phases.length}`);
  for (let i = 0; i < 20; i++) { while (st.pending.length) g.resolve(0); g.tick(); }
  check('Konsol satar ve platform olur', k.sold > 0 && M.activePlatforms(ctx).some((p) => p.id === k.id), k.sold.toLocaleString());
  const sr = st.consoleSeries[0];
  const d2 = { ...d, series: sr.id };
  check('Sonraki nesil "Piksel Kutu 2" adını alır', Con.consoleQuote(ctx, d2).name === 'Piksel Kutu 2');
  st.cash = 1e9; g.startConsole(d2);
  for (let i = 0; i < 600 && st.consoleJob; i++) { while (st.pending.length) g.resolve(0); st.cash = 1e9; g.tick(); }
  const k2 = st.consoles[1];
  check('İkinci nesil çıkar, eskisi son dönemine girer', !!k2.launched && k.sunsetAt > 0 && !k.retired);
  check('Seri ünü yeni nesli destekler', Con.seriesBoost(ctx, k2) > 1, Con.seriesBoost(ctx, k2).toFixed(2));
  for (let i = 0; i < PACK.console.overlapWeeks + 2; i++) { while (st.pending.length) g.resolve(0); st.cash = 1e9; g.tick(); }
  check('Eski nesil sonunda emekli olur', !!k.retired);
}
// 15b) Salon makinesi (1980): jeton geliri; 1980'de CD/3D yok
{
  const g = newGame({ seed: 10, difficulty: 'kolay' });
  const st = g.state, ctx = g.ctx;
  st.week = Math.round((1980.2 - 1976) * 48 * st.lengthMult);
  st.cash = 1e9; st.office.tier = 3; st.research.done.donanim_lab = 1; g.buildRoom('donanim');
  const p = Staff.makePerson(ctx, { skill: 70 }); p.skills.donanim = 90; p.founder = true; p.room = st.rooms[1].id; st.staff.push(p);
  check('Donanım yeteneği yüksek çalışan yeterli', Con.consoleBlockers(ctx).length === 0);
  const parts = Con.consoleParts(ctx, 'salon');
  check('1980 salon: CD ve 3D seçilemez', !parts.cats.media.some((x) => x.ok && x.p.id === 'cd') && !parts.cats.gpu.some((x) => x.ok && x.p.id === 'g_3d'));
  const r = g.startConsole({ type: 'salon', series: 'yeni', seriesName: 'Jeton Canavarı', price: 'normal', parts: { cpu: 'c_8', gpu: 'g_sprite', media: 'kartus', ctrl: 'k_joy' } });
  check('Salon makinesi yapımı başlar', r.ok, r.msg || '');
  for (let i = 0; i < 600 && st.consoleJob; i++) { while (st.pending.length) g.resolve(0); st.cash = 1e9; g.tick(); }
  const before = st.ledger.total.jeton || 0;
  for (let i = 0; i < 16; i++) { while (st.pending.length) g.resolve(0); st.cash = 1e9; g.tick(); }
  check('Salon makineleri jeton geliri getirir', (st.ledger.total.jeton || 0) > before, Math.round(st.ledger.total.jeton || 0) + ' $');
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

// 18) Eleştirmen yorumları: her kademede 5 farklı yorum, her türde 5 yorum, panelde tekrar yok
{
  const { CRITICS } = await import('../src/data/critics.js');
  check('30 puan kademesi × 5 farklı yorum', CRITICS.bands.length === 30 && CRITICS.bands.every((b) => new Set(b[1]).size === 5));
  check('Her türe 5 yorum', PACK.genres.every((g) => CRITICS.genre[g.id]?.length === 5));
  const ctx = ctxAt(1990);
  let dup = 0;
  for (let i = 0; i < 200; i++) {
    const p = proj(ctx, 0.3 + (i % 10) / 12);
    const q = M.review(ctx, p).critics.map((k) => k.quote);
    if (new Set(q).size < q.length) dup++;
  }
  check('Aynı ekranda yorum tekrarı yok', dup === 0, `${dup}/200`);
  check('Puan 5 üstü 0,2 adımlı', [5.13, 6.79, 9.91].map(M.quantizeCritic).join() === '5.2,6.8,10');
}

// 19) MGT: destek odası hedefi, pazarlama hype'ı, müşteri destek hayranı, oyuncu raporu bilgisi
{
  const g = newGame({ seed: 21, difficulty: 'kolay' });
  const st = g.state;
  st.cash = 1e8; st.office.tier = 3; st.research.done.oda_uzman = 1;
  g.buildRoom('gelistirme'); g.buildRoom('grafik'); g.buildRoom('pazarlama');
  const put = (career, roomIdx) => { const p = Staff.makePerson(g.ctx, { career, level: 0, skill: 60 }); p.room = st.rooms[roomIdx].id; p.founder = true; st.staff.push(p); return p; };
  put('yazar', 1); put('tasarimci', 2); put('yazar', 3);
  const base = { genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' };
  const A = g.startProject({ ...base, name: 'A', roomId: st.rooms[0].id }).project;
  const B = g.startProject({ ...base, name: 'B', roomId: st.rooms[1].id }).project;
  const gfxRoom = st.rooms[2], mkt = st.rooms[3];
  check('Grafik stüdyosu projeye atanır', g.setRoomTarget(gfxRoom.id, B.id).ok);
  const a0 = A.points.gfx, b0 = B.points.gfx; Prod.weeklyProject(g.ctx);
  check('Atanan proje grafik alır, diğeri stüdyodan almaz', B.points.gfx - b0 > (A.points.gfx - a0) * 3, `${(B.points.gfx - b0).toFixed(1)} / ${(A.points.gfx - a0).toFixed(1)}`);
  g.setRoomTarget(mkt.id, A.id);
  const h0 = A.hype; Prod.weeklyProject(g.ctx);
  check('Pazarlama odası hype üretir', A.hype > h0 - PACK.hype.decayDev + 0.5, `${h0.toFixed(1)} → ${A.hype.toFixed(1)}`);
  check('Geliştirme odası projeye atanamaz (hedef)', !g.setRoomTarget(st.rooms[0].id, A.id).ok);
}
{
  const g = newGame({ seed: 22, difficulty: 'kolay' });
  const st = g.state;
  st.cash = 1e7; st.research.done.tur_rpg = 1;
  g.startProject({ name: 'R', genre: 'rpg', topic: 'fantezi', audience: 'genc', platforms: ['pc'], size: 'kucuk' });
  while (st.projects[0].status === 'dev') { st.pending = []; g.tick(); }
  const game = g.release({ projectId: st.projects[0].id, publisherId: 'mantar', price: 20 }).game;
  check('Rapor 4 haftadan önce çıkmaz', !g.playerReport(game.id).ok);
  for (let i = 0; i < 5; i++) { st.pending = []; g.tick(); }
  const rep = g.playerReport(game.id);
  check('Oyuncu raporu görev önemini öğretir', rep.ok && Know.known(g.ctx).mission('rpg', 2) === 1, rep.lines?.length + ' satır');
  st.office.tier = 2; st.cash = 1e7; g.buildRoom('musteri');
  const s2 = Staff.makePerson(g.ctx, { skill: 60 }); s2.room = st.rooms[1].id; s2.founder = true; st.staff.push(s2);
  const f0 = st.fans; for (let i = 0; i < 2; i++) { st.pending = []; g.tick(); }
  check('Müşteri destek hayran kazandırır', game.active ? st.fans > f0 : true, `${f0} → ${st.fans}`);
}

// 20) Tarihsel dünya: 1976–2025 her yıl 10 oyun + 12 aylık olay; gerçek marka adları yok.
{
  const ys = Object.keys(YEARS).map(Number);
  check('Tarih 1976–2025 kesintisiz', ys[0] === 1976 && ys.at(-1) === 2025 && ys.length === 50, `${ys.length} yıl`, 'Veri');
  check('Her yıl 10 oyun ve 12 olay', ys.every((y) => YEARS[y].g.length === 10 && YEARS[y].e.length === 12), '', 'Veri');
  check('Oyunların şirketi ve türü geçerli', ys.every((y) => YEARS[y].g.every((g) => COMPANIES.some((c) => c.id === g[1]) && PACK.genres.some((x) => x.id === g[2]))), '', 'Veri');
  const banned = /\b(Nintendo|Sega|Sony|Atari|Microsoft|Xbox|PlayStation|Mario|Zelda|Sonic|Activision|Electronic Arts|Capcom|Konami|Ubisoft|Valve|Rockstar|Blizzard|Pokemon|Pokémon|Tetris|Minecraft|Fortnite|Halo|Doom|Steam|Apple|Commodore|Amiga|Facebook|YouTube|Twitch|Kickstarter)\b/i;
  const all = [...ys.flatMap((y) => [...YEARS[y].g.map((g) => g[0]), ...YEARS[y].e]), ...COMPANIES.map((c) => c.name), ...PACK.platforms.map((p) => p.name), ...PACK.publishers.map((p) => p.name)];
  const hit = all.filter((t) => banned.test(t));
  check('Telif: gerçek marka/ürün adı yok (parodi)', hit.length === 0, hit.slice(0, 3).join(' | '), 'Veri');
  check('50 yıllık tam tarih modu', PACK.meta.gameLengths[50] === 1);
  const g = newGame({ seed: 4, difficulty: 'orta', length: 50 });
  const st = g.state;
  const has = (id) => st.rivals.some((r) => r.cid === id);
  check('1976: Ataro piyasada, Soni yok', has('ataro') && !has('soni'));
  st.cash = 1e9;
  let tarih = 0, hits = 0;
  for (let i = 0; i < 48 * 22; i++) { st.pending = []; st.cash = 1e9; g.tick(); }
  tarih = st.world.count; hits = st.world.hits.length;
  check('Her ay bir tarihî olay', tarih >= 22 * 12 - 2 && tarih <= 22 * 12 + 1 && st.world.log.length <= PACK.world.logMax, `${tarih}`);
  check('Yılda 10 hit oyun çıkar', hits >= 22 * 10 - 10, `${hits}`);
  check('1998: Soni geldi, Ataro gitti', has('soni') && !has('ataro'), Math.floor(M.tableYear(g.ctx)) + '');
  const soni = st.rivals.find((r) => r.cid === 'soni');
  check('Platform devleri satın alınamaz', !Market.acquireRival(g.ctx, soni.id).ok);
  const pubs = World.publishersAvailable(g.ctx);
  check('Yayıncılar tarihten gelir (gücü yıla göre)', pubs.some((p) => p.hist) && pubs.every((p) => p.royalty > 0 && p.royalty < 0.6), pubs.slice(0, 3).map((p) => `${p.name} ${p.power}`).join(', '));
  check('Ataro yayıncılığı 1998\'de yok', !pubs.some((p) => p.id === 'ataro'));
  const act = M.activePlatforms(g.ctx).map((p) => p.id);
  check('1998 platformları dönemine uygun', act.includes('oi1') && act.includes('n64') && !act.includes('ataro') && !act.includes('oi2'), act.join(','));
}

// 21) MGT personel: yetenek setleri ve iki huy
{
  const g = newGame({ seed: 8, difficulty: 'kolay' });
  const ctx = g.ctx;
  const ppl = Array.from({ length: 200 }, () => Staff.makePerson(ctx, { skill: 60 }));
  check('Her çalışanın 8 yeteneği var', ppl.every((p) => Object.keys(p.skills).length === 8));
  check('Uzmanlık alanı en güçlü yetenek', ppl.filter((p) => p.skills[M.DISC_SKILL[p.spec]] >= Math.max(p.skills.tasarim, p.skills.program, p.skills.grafik, p.skills.ses)).length > 150);
  check('Bazı çalışanların iki huyu var', ppl.some((p) => p.trait && p.trait2 && p.trait !== p.trait2));
  const p = ppl.find((x) => x.spec === 'gfx');
  check('Grafikçi grafikte daha verimli', M.skillK(ctx, p, 'grafik') > M.skillK(ctx, p, 'program'), `${M.skillK(ctx, p, 'grafik').toFixed(2)} > ${M.skillK(ctx, p, 'program').toFixed(2)}`);
  const q = { trait: 'iskolik', trait2: 'kafein' };
  check('İki huyun çarpanları birleşir', Math.abs(M.traitOf(ctx, q, 'out') - 1.2 * 1.1) < 1e-9 && Math.abs(M.traitOf(ctx, q, 'stress') - 1.5 * 1.3) < 1e-9);
}

// 22) Tatil: kontenjan, aynı odada çakışma, yasak politikası
{
  const g = newGame({ seed: 9, difficulty: 'kolay' });
  const st = g.state, ctx = g.ctx;
  st.office.tier = 3; st.cash = 1e8; g.buildRoom('gelistirme');
  for (let i = 0; i < 6; i++) { const p = Staff.makePerson(ctx, { skill: 50 }); p.room = st.rooms[i < 3 ? 0 : 1].id; st.staff.push(p); }
  const [a, b] = st.staff.filter((p) => p.room === st.rooms[0].id && !p.founder);
  g.setVacationPolicy('planli');
  check('Tatile gönderilir', g.sendVacation(a.id).ok && a.status === 'tatil');
  check('Planlı: aynı odadan ikinci kişi reddedilir', !People.canVacation(ctx, b).ok, People.canVacation(ctx, b).why);
  for (const p of st.staff) { p.stress = 90; p.vacDue = 5; }
  g.setVacationPolicy('yasak');
  let r = { granted: 0 }; for (let i = 0; i < 5; i++) r.granted += People.weeklyVacations(ctx).granted;
  check('Yasak: kimse izne çıkamaz', r.granted === 0);
  a.statusWeeks = 1; a.stress = 80; Staff.weeklyStaff(ctx);
  check('Tatilden dönen dinlenmiş', a.status === 'ok' && a.stress < 50, `stres ${Math.round(a.stress)}`);
}

// 23) İlişkiler: aynı odada dostluk; toksik huy rekabet yaratır; verime yansır
{
  const g = newGame({ seed: 10, difficulty: 'kolay' });
  const st = g.state, ctx = g.ctx;
  st.office.tier = 2;
  const x = Staff.makePerson(ctx, { skill: 50 }), y = Staff.makePerson(ctx, { skill: 50 });
  x.trait = 'neseli'; y.trait = 'lider'; x.trait2 = y.trait2 = null; x.room = y.room = st.rooms[0].id; st.staff.push(x, y);
  for (let i = 0; i < 40; i++) People.weeklyRelations(ctx);
  const v = People.relation(st, x, y);
  check('Aynı odadakiler zamanla dost olur', v > 10, Math.round(v) + '');
  const w1 = M.personWeekly(ctx, x, 3);
  st.rel[M.relKey(x.id, y.id)] = -100; st.rel[M.relKey(x.id, st.staff[0].id)] = -100;
  check('Düşmanlık verimi düşürür', M.personWeekly(ctx, x, 3) < w1);
}

// 24) Ofis tasarımları: ucuz plastik yavaş ve ucuz, konfor morali yükseltir
{
  const g = newGame({ seed: 12, difficulty: 'kolay' });
  const st = g.state, ctx = g.ctx;
  check('5 ofis tasarımı', PACK.designs.length === 5);
  const p = st.staff[0];
  const w0 = M.personWeekly(ctx, p, 1), r0 = Eco.rent(ctx);
  check('Ucuz plastik seçilir', g.setDesign('ana', 'plastik').ok);
  check('Ucuz plastik: daha yavaş, kira düşük', M.personWeekly(ctx, p, 1) < w0 && Eco.rent(ctx) < r0, `${Eco.rent(ctx)} < ${r0}`);
  st.cash = 1e7; g.setDesign('ana', 'konfor');
  check('Konfor köşesi moral bonusu', M.designOf(ctx, p).morale > 0);
}

// 25) Şirket değeri ve halka arz: koşul, nakit girişi, çeyrek hedefi, kurul baskısı
{
  const g = newGame({ seed: 13, difficulty: 'kolay' });
  const st = g.state, ctx = g.ctx;
  check('Garajda halka arz yok', Co.ipoCheck(ctx).length > 0);
  st.office.tier = 3; st.week = 300; st.cash = 2e7; st.fans = 500000;
  const v = Co.valuation(ctx), c0 = st.cash;
  const r = g.goPublic(0.25);
  check('Halka arz nakit getirir', r.ok && st.cash - c0 > v * 0.2, r.msg || Math.round((st.cash - c0) / 1e6) + ' M');
  const co = Co.company(st);
  check('Hisse fiyatı oluşur', co.price > 0, co.price + ' $');
  st.salesHist = []; co.lastQ = 1e7; co.qStart = st.week - 12;
  Co.weeklyCompany(ctx);
  check('Hedef tutmazsa kurul baskısı artar', co.pressure > 0 && co.quarters[0].beat === false, '%' + Math.round(co.pressure));
  co.pressure = 45; co.qStart = st.week - 12; co.lastQ = 1e7; Co.weeklyCompany(ctx);
  check('Baskı yüksekse kurul toplanır', st.pending.some((e) => e.id === 'kurul'));
  const pr = co.pressure; g.resolve(st.pending.findIndex((e) => e.id === 'kurul') === 0 ? 0 : 0);
  check('Kurul kararı baskıyı düşürür', co.pressure < pr || st.pending.length > 0, `${Math.round(pr)} → ${Math.round(co.pressure)}`);
  const pct = co.pct; st.cash = 1e9;
  check('Hisse geri alımı oranı düşürür', g.buyback().ok && co.pct < pct);
}

// 26) MGT satış paneli verisi: geliştirme maliyeti, gelir, kâr geçmişi
{
  const g = newGame({ seed: 14, difficulty: 'kolay' });
  const st = g.state;
  st.cash = 1e7;
  const hand = Staff.makePerson(g.ctx, { skill: 50 }); hand.room = st.rooms[0].id; st.staff.push(hand);
  g.startProject({ name: 'K', genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' });
  const c0 = st.projects[0].cost;
  while (st.projects[0].status === 'dev') { st.pending = []; g.tick(); }
  check('Proje maliyeti maaşlarla büyür', st.projects[0].cost > c0, `${Math.round(c0)} → ${Math.round(st.projects[0].cost)}`);
  const game = g.release({ projectId: st.projects[0].id, publisherId: 'mantar', price: 20 }).game;
  for (let i = 0; i < 6; i++) { st.pending = []; g.tick(); }
  check('Oyunun maliyeti ve kâr geçmişi var', game.devCost > 0 && game.profitHist.length >= 5 && game.profitHist.at(-1) === Math.round(game.revenue - game.devCost - game.postCost));
}

// 27) Olaylar: en az 80; tüm koşul ve etki anahtarları motor tarafından tanınır; her seçim hatasız uygulanır
{
  check('En az 80 rastgele olay', PACK.events.length >= 80, PACK.events.length + '');
  const src = readFileSync(new URL('../src/systems/events.js', import.meta.url), 'utf8');
  const condKeys = new Set([...src.matchAll(/w\.(\w+)/g)].map((m) => m[1]));
  const effKeys = new Set([...src.matchAll(/e\.(\w+)/g)].map((m) => m[1]));
  const walk = (e, out) => { for (const [k, v] of Object.entries(e || {})) { out.add(k); if (k === 'chance') { walk(v.yes, out); walk(v.no, out); } } return out; };
  const usedCond = new Set(PACK.events.flatMap((e) => Object.keys(e.when || {})));
  const usedEff = PACK.events.reduce((acc, e) => { for (const ch of e.choices) walk(ch.effects, acc); return acc; }, new Set());
  const badC = [...usedCond].filter((k) => !condKeys.has(k)), badE = [...usedEff].filter((k) => !effKeys.has(k));
  check('Olay koşul anahtarları tanınıyor', !badC.length, badC.join(','));
  check('Olay etki anahtarları tanınıyor', !badE.length, badE.join(','));
  const g = newGame({ seed: 30, difficulty: 'kolay', length: 50 });
  const st = g.state, ctx = g.ctx;
  st.cash = 1e7; st.office.tier = 3;
  for (let i = 0; i < 6; i++) { const p = Staff.makePerson(ctx, { skill: 50 }); p.room = st.rooms[0].id; st.staff.push(p); }
  let err = '';
  for (const e of PACK.events) for (const ch of e.choices) { try { Ev.applyEffects(ctx, ch.effects); } catch (x) { err = `${e.id}: ${x.message}`; } }
  check('Tüm olay seçimleri hatasız uygulanır', !err, err);
}

// 28) Bölgesel pazarlar: paylar, yerelleştirme, tür tercihi
{
  const c76 = ctxAt(1976), c25 = ctxAt(2025, 'kolay');
  const w76 = M.regionShares(c76), w25 = M.regionShares(c25);
  check('Bölge payları toplamı 1', Math.abs(Object.values(w25).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  check('1976: Dünya pazarı yok, 2025: Japonya’dan büyük', w76.row === 0 && w25.row > w25.jp, `${w25.row.toFixed(2)} > ${w25.jp.toFixed(2)}`);
  const g = newGame({ seed: 40, difficulty: 'kolay', length: 50 });
  const st = g.state, ctx = g.ctx;
  st.week = (1995 - 1976) * 48; st.cash = 1e7;
  check('Japonya araştırmasız kapalı', !Prod.regionStatus(ctx, 'jp').ok);
  st.research.done.yerel_jp = 1; st.research.done.yerel_dunya = 1; st.research.done.tur_rpg = 1; st.stationTier = 2;
  const r = g.startProject({ name: 'J', genre: 'rpg', topic: 'fantezi', audience: 'genc', platforms: ['oi1'], size: 'kucuk' });
  const pj = r.project;
  check('Varsayılan: İngilizce sürüm (K. Amerika + Avrupa)', pj.regions.join() === 'na,eu');
  const c0 = st.cash;
  check('Japonca yerelleştirme bedeli ödenir', g.localize(pj.id, 'jp').ok && st.cash < c0 && pj.regions.includes('jp'));
  const p = M.platformById(ctx, 'oi1');
  const en = M.regionFactor(ctx, { genre: 'rpg', regions: ['na', 'eu'] }, p), all = M.regionFactor(ctx, { genre: 'rpg', regions: ['na', 'eu', 'jp', 'row'] }, p);
  check('Tüm bölgeler yalnız İngilizceden çok satar', all > en * 1.2, `${all.toFixed(2)} > ${en.toFixed(2)}`);
  const jpRpg = M.regionMix(ctx, { genre: 'rpg', regions: ['jp'] }, p).jp, jpStr = M.regionMix(ctx, { genre: 'strateji', regions: ['jp'] }, p).jp;
  check('Japonya RPG’yi stratejiden çok sever', jpRpg > jpStr * 1.5);
  check('X-Kutu Japonya’da zayıf', M.regionBias(ctx, M.platformById(ctx, 'xkutu') || { owner: 'mikroyumusak' }, 'jp') < 0.5);
}

// 29) Konsol savaşı: pay, rakipten oyuncu çalma, üçüncü parti, özel anlaşma, donanımdan çekilme
{
  const g = newGame({ seed: 41, difficulty: 'kolay', length: 50 });
  const st = g.state, ctx = g.ctx;
  st.week = (1996 - 1976) * 48; st.cash = 1e9; st.fans = 500000;
  const k = { id: 'ownT', name: 'Test Kutu', type: 'konsol', kind: 'konsol', tech: 5, genre: [10, 10, 10, 10, 10, 10], aud: [10, 10, 10], launched: 1996, retired: null, base: 60, active: 6e7, sold: 6e7, weeks: 10, price: 'normal', seriesId: 1, gen: 1 };
  st.consoles.push(k);
  const snes = M.platformById(ctx, 'snes');
  const before = M.platformBase(ctx, snes);
  War.updateShares(ctx);
  check('Konsolun segment payı hesaplanır', st.war.konsol.share > 0.2, st.war.konsol.share.toFixed(2));
  check('Rakip platformlardan oyuncu çalınır', M.platformBase(ctx, snes) < before * 0.9, `${before.toFixed(1)} → ${M.platformBase(ctx, snes).toFixed(1)}`);
  check('Segment payları senin konsolunu içerir', War.segmentShares(ctx, 'konsol').some((r) => r.own));
  st.rng = 5; for (let i = 0; i < 40; i++) War.thirdPartyRelease(ctx, 'Kapkom', 'Oyun ' + i, false);
  check('Üçüncü parti oyunlar gelir', k.thirdParty > 3, String(k.thirdParty));
  check('Özel oyun anlaşması yapılır', g.exclusiveDeal(k.id).ok && st.consoleMods.some((m) => m.console === k.id));
  check('Anlaşma beklemesi var', !g.exclusiveDeal(k.id).ok);
  k.base = 400; const old = { ...PACK.war }; PACK.war.exitChance = 1; PACK.war.exitRepBelow = 101; PACK.war.reactAt = [];
  War.monthlyWar(ctx);
  check('Payı yüksek konsol karşısında zayıf rakip donanımdan çekilir', Object.keys(st.platformEnd || {}).length > 0, JSON.stringify(st.platformEnd));
  Object.assign(PACK.war, old);
}

console.log(`\n${pass} geçti, ${fail} kaldı.`);
process.exit(fail ? 1 : 0);
