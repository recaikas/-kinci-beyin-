// Kalibrasyon ve tutarlılık kontrolleri. Çalıştır: node test/validate.mjs
// "Veri tekrarı" = PDF tablosunu birebir doğrular; "Kalibrasyon" = parametreler bu referansa göre seçildi.
import { PACK } from '../src/data/pack.js';
import { createState, makeGame, newGame as rawNewGame, loadGame, Prod, Staff, Con, Post, Know, World, People, Co, Eco, Market, War, Modern, Charts, Pub, Regions, Genres } from '../src/game.js';
// Konu D öncesi testler 6 eski türün hepsini bilinen sayar; yeni tür testleri rawNewGame kullanır.
const newGame = (o) => { const g = rawNewGame(o); for (const gg of PACK.genres.slice(0, 6)) g.state.research.done[gg.research] ??= 0; return g; };
import { EXTRA_PUBS, TRAITS } from '../src/data/publishers.js';
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
  const p = { genre: 'aksiyon', sub: 'aksiyonmacera', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'orta', engineId: null, bugs: 0, points: {}, alloc: [] };
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
  Pub.directDeal(g.ctx, st.projects[0].id, 'mantar');
  const res = g.release({ projectId: st.projects[0].id, publisherId: 'mantar', price: 20 });
  check('Rapor üretilir ve bilgi birikir', res.report.length >= 3 && Know.known(g.ctx).topicGenre('uzay', 'aksiyon') === 10, res.report.length + ' satır');
  const game = res.game;
  for (let i = 0; i < 3; i++) { st.pending = []; g.tick(); }
  const F0 = game.dif.F; check('Güncelleme satışı canlandırır (yeni alıcı)', g.patch(game.id).ok && game.dif.F < F0);
  const pr = game.price; check('Fiyat indirimi', g.priceDrop(game.id).ok && game.price < pr);
  st.week = Math.round(8 * 48 * st.lengthMult);
  const target = Post.portTargets(g.ctx, game)[0];
  check('Port yeni oyun kaydı açar', !!target && g.port(game.id, target.id).ok && st.games.length === 2, target?.name || '');
  st.week = game.releasedWeek + 10;
  check('Ek paket projesi başlar', g.startExpansion(game.id).ok && st.projects[0].kind === 'ek');
  const portG = st.games.find((x) => x.portOf === game.id);
  check('Port aynı yayıncıyla, ayrı ve avanssız sözleşmeyle çıkar', portG?.deal && portG.deal !== game.deal && portG.deal.pubId === game.deal.pubId && portG.deal.owed === 0);
  const ex = st.projects[0];
  while (ex.status === 'dev') { st.pending = []; g.tick(); }
  const exr = g.release({ projectId: ex.id, publisherId: null, price: 10 });
  check('Ek paket ana oyunun yayıncısıyla çıkar (araştırmasız)', exr.ok && exr.game.deal?.pubId === game.deal.pubId, exr.msg || '');
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
  Pub.directDeal(g.ctx, st.projects[0].id, 'mantar');
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
  const all = [...ys.flatMap((y) => [...YEARS[y].g.map((g) => g[0]), ...YEARS[y].e]), ...COMPANIES.map((c) => c.name), ...PACK.platforms.map((p) => p.name), ...PACK.publishers.map((p) => p.name), ...EXTRA_PUBS.map((p) => p.name)];
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
  const pubs = Pub.list(g.ctx);
  check('Yayıncılar tarihten gelir (gücü yıla göre)', pubs.some((p) => p.hist) && pubs.every((p) => p.power > 0 && p.power < 100 && TRAITS[p.trait]), pubs.slice(0, 3).map((p) => `${p.name} ${p.power}`).join(', '));
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
  Pub.directDeal(g.ctx, st.projects[0].id, 'mantar');
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
  check('1976: Asya küçük, 2025: Asya en büyük pazar', w76.asya < 0.02 && w25.asya > w25.na && w25.asya > w25.jp && w76.na > 0.5, `${w25.asya.toFixed(2)} > ${w25.na.toFixed(2)}`);
  const g = newGame({ seed: 40, difficulty: 'kolay', length: 50 });
  const st = g.state, ctx = g.ctx;
  st.week = (1995 - 1976) * 48; st.cash = 1e7;
  check('Japonya araştırmasız kapalı', !Prod.regionStatus(ctx, 'jp').ok);
  st.research.done.yerel_jp = 1; st.research.done.yerel_dunya = 1; st.research.done.tur_rpg = 1; st.stationTier = 2;
  const r = g.startProject({ name: 'J', genre: 'rpg', topic: 'fantezi', audience: 'genc', platforms: ['oi1'], size: 'kucuk' });
  const pj = r.project;
  check('Varsayılan: stüdyonun dili (K. Amerika)', pj.regions.join() === 'na');
  const c0 = st.cash;
  check('Japonca yerelleştirme bedeli ödenir', g.localize(pj.id, 'jp').ok && st.cash < c0 && pj.regions.includes('jp'));
  const p = M.platformById(ctx, 'oi1');
  const en = M.regionFactor(ctx, { genre: 'rpg', regions: ['na', 'eu'] }, p), all = M.regionFactor(ctx, { genre: 'rpg', regions: ['na', 'eu', 'jp', 'latam', 'asya', 'tr'] }, p);
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

// 30) Modern dönem: ücretsiz oyun, indirilebilir içerik, sezon kartı, erken erişim, kitle fonlama, abonelik servisi, yayıncılar
{
  const mk = (seed) => {
    const g = newGame({ seed, difficulty: 'kolay', length: 50 });
    const st = g.state;
    st.week = (2015 - 1976) * 48; st.cash = 1e9; st.fans = 300000; st.stationTier = 4; st.office.tier = 3;
    for (const id of ['oz_yayin', 'ia_satis', 'dlc', 'sezon_karti', 'erken_erisim', 'boyut_orta', 'tur_rpg']) st.research.done[id] = 1;
    for (let i = 0; i < 6; i++) { const p = Staff.makePerson(g.ctx, { skill: 80 }); p.room = st.rooms[0].id; p.founder = true; st.staff.push(p); }
    return g;
  };
  const tick = (g, n) => { for (let i = 0; i < n; i++) { g.state.pending = []; g.state.nextEventWeek = 1e9; g.tick(); } };
  // Kaliteli bir oyun: geliştirme bitince puanlar 2,2 katına çıkarılır (not ~75–80), hata sıfırlanır
  const ship = (g, o) => { const pj = g.startProject({ name: o.name || 'M', genre: 'casual', topic: 'kedi', audience: 'herkes', platforms: o.platforms || ['afon'], size: 'kucuk' }).project; while (g.state.projects[0]?.status === 'dev') tick(g, 1); for (const k in pj.points) pj.points[k] *= 2.2; pj.bugs = 0; return g.release({ projectId: pj.id, publisherId: null, price: 5, ...o.rel }); };
  // F2P
  const a = mk(50), fr = ship(a, { rel: { model: 'f2p', monet: 'dengeli' } });
  check('Ücretsiz oyun yayınlanır', fr.ok && fr.game.model === 'f2p' && fr.game.price === 0, fr.msg || '');
  tick(a, 20);
  check('Ücretsiz oyunun fiyatı düşürülmez', !a.priceDrop(fr.game.id).ok);
  a.state.stationTier = 4; const pr2 = a.port(fr.game.id, 'pc'); const cp = a.state.games.at(-1);
  check('Ücretsiz oyun uyarlanabilir, satış hesabı sonlu', pr2.ok && cp.model === 'f2p' && Object.values(cp.peak).every(Number.isFinite), pr2.msg || '');
  check('Ücretsiz oyunda oyuncu birikir ve gelir gelir', fr.game.players > 10000 && fr.game.revenue > 0, `${Math.round(fr.game.players)} oyuncu · ${Math.round(fr.game.revenue)} $`);
  const b = mk(50), ag = ship(b, { rel: { model: 'f2p', monet: 'agresif' } });
  check('Agresif para kazanma notu düşürür', ag.review.score < fr.review.score, `${ag.review.score} < ${fr.review.score}`);
  tick(b, 20);
  check('Agresif daha çok kazandırır', ag.game.revenue > fr.game.revenue, `${Math.round(ag.game.revenue)} > ${Math.round(fr.game.revenue)}`);
  const c = mk(50), pr = ship(c, {}); tick(c, 20); tick(a, 20); tick(c, 20);
  check('Mobilde ücretsiz oyun, ücretli sürümden çok kazandırır (40 hafta)', fr.game.revenue > pr.game.revenue, `${Math.round(fr.game.revenue)} > ${Math.round(pr.game.revenue)}`);
  // DLC ve sezon kartı
  const d = mk(51), dg = ship(d, { platforms: ['pc'], rel: { price: 30 } }).game;
  const r0 = dg.revenue; tick(d, 2);
  check('İndirilebilir içerik çıkar', d.releaseDLC(dg.id).ok && dg.dlcs === 1);
  const r1 = dg.revenue; tick(d, 4);
  check('İçerik geliri haftalara yayılır', dg.dlcQueue.length > 0 || dg.revenue > r1, '');
  check('Sezon kartı önden gelir getirir', d.seasonPass(dg.id).ok && dg.passDue > 0);
  const f0 = d.state.fans; d.state.week = dg.passDue; tick(d, 2);
  check('Sözü tutulmayan sezon kartı hayran kaybettirir', d.state.fans < f0 && !dg.passDue);
  // Erken erişim
  const e = mk(52);
  const pj = e.startProject({ name: 'EA', genre: 'casual', topic: 'kedi', audience: 'herkes', platforms: ['pc'], size: 'kucuk' }).project;
  check('Erken erişim başta açılamaz', !e.earlyAccess(pj.id).ok);
  while (pj.week < pj.totalWeeks * 0.4) tick(e, 1);
  check('Erken erişim açılır', e.earlyAccess(pj.id).ok);
  const ea0 = e.state.ledger.total.erken_erisim || 0; tick(e, 3);
  check('Erken erişim satış getirir', (e.state.ledger.total.erken_erisim || 0) > ea0);
  // Kitle fonlama ve abonelik servisi
  const k = mk(53);
  const kp = k.startProject({ name: 'KF', genre: 'casual', topic: 'kedi', audience: 'herkes', platforms: ['pc'], size: 'kucuk' }).project;
  const cr = k.crowdfund(kp.id);
  check('Kitle fonlama para getirir, bir kez', cr.ok && cr.amt > 0 && !k.crowdfund(kp.id).ok, cr.amt + ' $');
  const sv = mk(54); sv.state.week = (2019 - 1976) * 48;
  const sr = ship(sv, { platforms: ['pc'], rel: { price: 30, service: 'pasos' } });
  check('Abonelik servisi önden öder', sr.ok && sr.game.service && (sv.state.ledger.total.abonelik_servisi || 0) > 0, sr.msg || '');
  // Yayıncı anahtarları yalnız o oyunu etkiler
  const y = mk(55), yg = ship(y, { platforms: ['pc'], rel: { price: 30 } }).game;
  check('Yayıncı anahtarları yalnız o oyunu etkiler', y.streamKeys(yg.id).ok && y.state.gameMods.at(-1).gameId === yg.id);
}

// 31) Satış listesi (Konu A): yayılma eğrisi, mevsim, gerçek sıra, raf, basım, ödüller, takvim
{
  const C = PACK.charts;
  // Yayılma: toplam pay 1'i aşmaz; ömür boyu satış hedefle aynı (zirve haftası cinsinden)
  const ctx = ctxAt(1990);
  for (const [p, q] of [[0.22, 0.05], [0.05, 0.22], [0.008, 0.3], [0.012, 0.09]]) {
    const g = { peak: 1, weeks: 0, genre: 'aksiyon', topic: 'uzay' };
    Charts.initDif(ctx, g, { p, q }, C.diffusion.lifeWeeks);
    let tot = 0;
    for (let t = 0; t < 900; t++) { const st = Charts.step({ ...ctx, state: { ...ctx.state, week: 0 } }, g); if (Charts.ended(ctx, g, st)) break; tot += st.k; Charts.commit(ctx, g, st.s); g.weeks++; }
    check(`Yayılma p=${p} q=${q}: toplam satış ≈ ${C.diffusion.lifeWeeks} zirve haftası, pay ≤ 1`, Math.abs(tot - C.diffusion.lifeWeeks) / C.diffusion.lifeWeeks < 0.12 && g.dif.F <= 1.0000001, tot.toFixed(2));
  }
  const avg = C.season.reduce((a, b) => a + b, 0) / 12;
  check('Mevsim çarpanlarının ortalaması ≈ 1', Math.abs(avg - 1) < 0.03, avg.toFixed(3));
  check('Kasım ve Aralık yılın en yüksek ayları', C.season[11] === Math.max(...C.season) && C.season[10] > C.season[9]);
  // Gerçek sıra: çok satan asla daha kötü sırada olmaz; dolgu oyunlar sırayı aşağı iter
  const g1 = newGame({ seed: 61, difficulty: 'orta' });
  for (let i = 0; i < 30; i++) { g1.state.pending = []; g1.tick(); }
  const m = Charts.mkt(g1.state), ent = [];
  const ranks = [10, 100, 1000, 10000].map((x) => Charts.rankOf(g1.ctx, x, ent));
  check('Daha çok satan oyun daha iyi (ya da eşit) sırada', ranks.every((r, i) => i === 0 || r <= ranks[i - 1]), ranks.join(' ≥ '));
  check('1976 pazarında dolgu oyunlar var, toplam ~50', m.N >= 30 && m.total >= 40 && m.total <= 120, `${m.N} dolgu / ${m.total} toplam`);
  const top = g1.state.top;
  check('İlk 10 listesi dolu (gerçek ve küçük stüdyo oyunları)', top.length === 10 && top.every((t, i) => i === 0 || t.units <= top[i - 1].units), top.map((t) => t.units).join(','));
  const v = Charts.listView(g1.ctx, 'tur', 'aksiyon');
  check('Tür listesi çalışır', Array.isArray(v.rows) && v.total >= v.rows.filter((r) => !r.filler).length);
  // Kendi yayınlanan fiziksel oyun basılır; stok biterse satış stokla sınırlı
  const g2 = newGame({ seed: 62, difficulty: 'orta' }); const s2 = g2.state;
  s2.research.done.oz_yayin = 1; s2.cash = 1e6; s2.fans = 150000;
  const pj = g2.startProject({ name: 'Basım', genre: 'aksiyon', topic: 'uzay', audience: 'herkes', platforms: ['pc'], size: 'kucuk' }).project;
  while (s2.projects[0]?.status === 'dev') { s2.pending = []; g2.tick(); }
  const rel = g2.release({ projectId: pj.id, publisherId: null, price: 20, printRun: 'temkinli' });
  const gm = rel.game;
  check('Fiziksel dönemde kendi yayının basılır', rel.ok && gm.printed && gm.stock > 0 && (s2.ledger.total.basim || 0) < 0, rel.msg || '');
  gm.printAuto = false; gm.stock = 3;
  s2.pending = []; g2.tick();
  check('Stok bitince satış stokla sınırlı ve "tükendi"', gm.lastWeek <= 3 && gm.soldOut);
  check('Yeniden basım baskı kuyruğuna girer', g2.reprint(gm.id).ok && gm.printQ.length === 1);
  // Raf: fiziksel dönemde liste dışında kalan oyun raftan iner; 2008 sonrası raf kuralı yok
  gm.rank = 9999; gm.shelfMiss = 5; gm.offShelf = true;
  check('Ucuz Raf Serisi raftan inen oyunu geri getirir, fiyatı düşer', g2.budgetLine(gm.id).ok && !gm.offShelf && gm.price < 20 && !g2.budgetLine(gm.id).ok);
  const g3 = newGame({ seed: 63, difficulty: 'orta' }); g3.state.week = Math.round((2012 - 1976) * 48 * g3.state.lengthMult);
  check('2008 sonrası basım ve raf yok', !Charts.printable(g3.ctx, { royalty: null, model: 'satis' }) && Charts.isDigital(g3.ctx));
  // Ödüller oyun başına bir kez
  gm.aw = {}; gm.lastWeek = 1e7; gm.units = 1e7; s2.fans = 1000;
  Charts.weeklyCharts(g2.ctx); const fa = s2.fans;
  Charts.weeklyCharts(g2.ctx); const fb = s2.fans;
  check('Liste ödülü (ilk 10, zirve) oyun başına bir kez verilir', fa > 1000 && fb === fa && gm.aw.no1 && gm.aw.top10, `${fa} → ${fb}`);
  // Takvim ve tarih duyurusu
  const g4 = newGame({ seed: 64, difficulty: 'orta' });
  for (let i = 0; i < 4; i++) { g4.state.pending = []; g4.tick(); }
  check('Yaklaşan büyük çıkışlar listelenir', Charts.upcoming(g4.ctx).length > 0);
  const p4 = g4.startProject({ name: 'Duyuru', genre: 'aksiyon', topic: 'uzay', audience: 'herkes', platforms: ['pc'], size: 'kucuk' }).project;
  const h0 = p4.hype;
  check('Tarih duyurusu kabul edilir, ikinci kez edilmez', g4.announce(p4.id, 8).ok && !g4.announce(p4.id, 12).ok);
  for (let i = 0; i < 3; i++) { g4.state.pending = []; g4.tick(); }
  check('Geri sayım hype verir', p4.hype > h0 - 1 && p4.annHype > 0, `${p4.annHype}`);
  p4.announce = g4.state.week - 1; const fans4 = g4.state.fans;
  g4.state.pending = []; g4.tick();
  check('Kaçırılan tarih hayran kaybettirir', p4.annMissed && g4.state.fans <= fans4);
}

// 32) Yayıncılar (Konu B): kimlik, kapı, kurul, pay, avans, pazarlık, açık artırma, ilişki, erken anlaşma, sipariş, deneme işi
{
  const tick = (g, n) => { for (let i = 0; i < n; i++) { g.state.pending = []; g.state.nextEventWeek = 1e9; g.tick(); } };
  const g = newGame({ seed: 71, difficulty: 'orta' });
  const c = g.ctx, st = g.state, B = PACK.publishing;
  const at = (y) => Pub.list(c, y);
  const counts = [1976, 1985, 1990, 2000, 2010, 2020].map((y) => at(y).length);
  check('Yayıncı sayısı döneme göre (üç kademe, 22 yeni + 4 yerel yayıncı)', counts[0] >= 5 && counts[2] >= 25 && counts.every((n) => n >= 5) && EXTRA_PUBS.length === 28, counts.join('/'));
  check('Her yayıncının huyu, bölgesi ve odağı var', [1976, 1995, 2015].every((y) => at(y).every((p) => TRAITS[p.trait] && p.region?.length && p.focus?.length)));
  const ataro = Pub.byId(c, 'ataro'), mantar = Pub.byId(c, 'mantar');
  check('Kapı: 1976 Kırmızı Mantar açık, Ataro kapalı (tanışma ister)', Pub.door(c, mantar).open && !Pub.door(c, ataro).open && /tanımıyor/.test(Pub.door(c, ataro).why));
  check('Eşikler: Mantar ~40 (kumarbaz), Ataro ~68', Math.round(Pub.threshold(c, mantar)) === 40 && Math.round(Pub.threshold(c, ataro)) === 68);
  let payOk = true;
  for (const y of [1976, 1990, 2005, 2025]) for (const p of at(y)) for (const r of [-40, 0, 25, 50, 90]) { st.pub.rel[p.id] = r; const v = Math.round(Pub.basePay(c, p)); if (v + 3 + 6 > 40 || v < -10) payOk = false; st.pub.rel[p.id] = 0; }
  check('Pay formülü: yeni stüdyoya netin %14–17\'si (fiyatın ~%8–9\'u)', (() => { const a = Pub.basePay(c, mantar), b = Pub.basePay(c, ataro); return a >= 14 && a <= 17.5 && b >= 12 && b < a; })() && payOk, `${Pub.basePay(c, mantar).toFixed(1)} / ${Pub.basePay(c, ataro).toFixed(1)}`);
  const pj = g.startProject({ name: 'Garaj', genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' }).project;
  tick(g, 3);
  check('Erken anlaşma Ortak olmadan açılmaz', !Pub.canPitch(c, pj, mantar, 'erken').ok);
  while (pj.status === 'dev') tick(g, 1);
  check('Bitmiş oyun sunulur', g.pitch(pj.id, ['mantar']).ok && !g.pitch(pj.id, ['mantar']).ok && !g.pitch(pj.id, ['ataro']).ok);
  // Garaj: hiç oyunu olmayan stüdyoya Finans "hayır" der → tek seferlik satış
  const ev = Pub.evaluate(c, { pid: pj.id, pubId: 'mantar', est: 58, meet: {}, doc: false, note: false });
  check('Garajın ilk oyunu: Finans hayır, tek seferlik satış', ev && ev.sc.finans < 0 && ['tek', 'tam'].includes(ev.verdict), `${ev?.verdict} finans ${ev?.sc.finans}`);
  for (let i = 0; i < 6 && !st.pub.offers.some((o) => o.pid === pj.id); i++) tick(g, 1);
  const off = st.pub.offers.find((o) => o.pid === pj.id);
  check('Cevap 1–4 hafta içinde teklif olarak gelir', !!off && off.pubId === 'mantar', off?.kind);
  // Pazarlık olasılıkları %10–90
  const fake = { ...off, kind: 'tam', rounds: 0, adv: 1000, rights: 'yayinci', mode: 'bitmis', margin: 30, koz: 3 };
  st.pub.offers.push(fake); fake.id = 99999;
  const mv = Pub.negMoves(c, fake);
  check('Pazarlık olasılıkları %10–90 arasında', mv.length >= 3 && mv.every((m) => m.p >= 10 && m.p <= 90), mv.map((m) => `${m.id} ${m.p}`).join(', '));
  st.pub.offers = st.pub.offers.filter((o) => o !== fake);
  // İmza ve geri ödemeli avans: telif önce avansı kapatır
  st.pub.offers = []; st.pub.pitches = [];
  const sres = Pub.directDeal(c, pj.id, 'mantar', 'tam');
  check('Sözleşme imzalanır, avans ödenir', sres.ok && pj.deal && pj.deal.owed === pj.deal.adv && pj.deal.adv > 0, `avans ${pj.deal?.adv}`);
  check('Sözleşme varken başka yayıncı seçilemez (sözleşmedeki yayıncı geçerli)', Pub.forRelease(c, pj, 'ataro').pub?.id === 'mantar');
  const rel0 = Pub.rel(c, 'mantar');
  const res = g.release({ projectId: pj.id, publisherId: 'mantar', price: 20 });
  const game = res.game;
  check('Yayın sözleşmeyi oyuna işler; ilişki artar', res.ok && game.deal?.pubId === 'mantar' && game.royalty > 0 && game.royalty < 0.2 && Pub.rel(c, 'mantar') > rel0, `pay ${game.royalty?.toFixed(3)}`);
  const cash0 = st.cash, owed0 = game.deal.owed;
  const gross = 500;
  const got = Pub.royaltyCash(c, game, gross);
  check('Avans kapanmadan telif akmaz', got === 0 && game.deal.owed === owed0 - gross, `${got}`);
  game.deal.owed = 100;
  check('Avans kapanınca telif akar', Pub.royaltyCash(c, game, 500) === 400 && game.deal.owed <= 0);
  // İlişki sınırları ve kara liste
  for (let i = 0; i < 30; i++) Pub.relAdd(c, 'segga', 50);
  const hi = Pub.rel(c, 'segga');
  for (let i = 0; i < 30; i++) Pub.relAdd(c, 'segga', -50);
  check('İlişki −50 ile 100 arasında kalır', hi <= 100 && Pub.rel(c, 'segga') >= -50, `${hi} / ${Pub.rel(c, 'segga')}`);
  const segga = Pub.byId(c, 'segga');
  check('Kara listedeki yayıncı kapıyı kapatır', !Pub.door(c, segga).open && /kara liste/.test(Pub.door(c, segga).why));
  check('Kara liste kademesi', Pub.tierOf(c, -40).name === 'Kara liste' && Pub.tierOf(c, 25).name === 'Tanıdık' && Pub.tierOf(c, 75).name === 'Stratejik ortak');
  // Aynı tohum aynı kararlar
  const run = () => { const h = newGame({ seed: 72, difficulty: 'orta' }); const p = h.startProject({ name: 'D', genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' }).project; while (p.status === 'dev') tick(h, 1); h.pitch(p.id, ['mantar']); tick(h, 6); return JSON.stringify(h.state.pub.offers.map((o) => [o.kind, o.pay, o.adv, o.buyout])); };
  check('Aynı tohum aynı yayıncı kararı', run() === run());
  // Eski kayıt: yayıncı durumu yokken açılır, A'nın ilişki puanı taşınır
  const old = JSON.parse(g.save());
  delete old.pub; old.mkt.pubRel = { namko: 12 };
  const lg = loadGame(JSON.stringify(old));
  check('Eski kayıt açılır, eski yayıncı puanı ilişkiye taşınır', lg.state.pub && lg.state.pub.rel.namko === 12);
}
{
  // Açık artırma, değişiklik isteği, ret mektubu, kendi yayını eğrisi
  const tick = (g, n) => { for (let i = 0; i < n; i++) { g.state.pending = []; g.state.nextEventWeek = 1e9; g.tick(); } };
  const g = newGame({ seed: 73, difficulty: 'kolay', length: 50 });
  const c = g.ctx, st = g.state;
  st.week = Math.round((1990 - 1976) * 48); st.cash = 1e8; st.research.done.oz_yayin = 1;
  World.initWorld(c);
  const pj = g.startProject({ name: 'Artırma', genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' }).project;
  while (pj.status === 'dev') tick(g, 1);
  const pubs = Pub.list(c).filter((p) => p.power < 60).slice(0, 2);
  const mk = (p, pay) => ({ id: st.nextId++, pid: pj.id, pubId: p.id, pubName: p.name, kind: 'tam', mode: 'bitmis', pay, adv: 1000, buyout: 0, fund: 0, rights: 'sende', promo: 0, expUnits: 1000, price: 20, votes: {}, margin: 20, est: 70, expires: st.week + 4, rounds: 0, koz: 1 });
  st.pub.offers.push(mk(pubs[0], 12), mk(pubs[1], 14));
  const before = Math.max(...st.pub.offers.map((o) => o.pay));
  const a = g.auction(pj.id);
  check('Açık artırma payı yükseltir', a.ok && Math.max(...st.pub.offers.map((o) => o.pay)) > before, st.pub.offers.map((o) => o.pay).join('/'));
  const win = st.pub.offers.find((o) => o.id === a.best);
  const loser = st.pub.offers.find((o) => o.id !== a.best);
  const lr = Pub.rel(c, loser.pubId);
  check('Kazanan imzalanır, kaybedenle ilişki düşer', g.signOffer(win.id).ok && Pub.rel(c, loser.pubId) < lr && st.pub.offers.length === 0);
  // Değişiklik isteği → teklif
  const pj2 = g.startProject({ name: 'Değişiklik', genre: 'macera', topic: 'uzay', audience: 'yetiskin', platforms: ['pc'], size: 'kucuk', roomId: undefined });
  const p2 = pj2.project || st.projects.find((p) => p.name === 'Değişiklik');
  if (p2) {
    while (p2.status === 'dev') tick(g, 1);
    st.pub.offers.push({ ...mk(pubs[0], 12), pid: p2.id, kind: 'degisiklik', change: 'kitle', after: 'tam' });
    const o = st.pub.offers.at(-1);
    check('Değişiklik isteği kabul edilince teklife döner', g.acceptChange(o.id, true).ok && o.kind === 'tam' && p2.audience === 'herkes');
  }
  // Ret mektubu en zayıf üyeden
  const ev = { pub: pubs[0], pj, E: 60, N: 30, d: -30, sc: { urun: -20, pazar: 5, finans: 2, hukuk: 8 }, votes: { urun: false, pazar: true, finans: true, hukuk: true }, ta: { v: 0, notes: [] }, it: 0, full: false };
  check('Ret mektubu en büyük eksi terimden (Ürün)', /Demonuzu oynadık/.test(Pub.__test.rejectLetter(c, ev)));
  ev.sc = { urun: 5, pazar: 4, finans: -15, hukuk: 8 }; ev.it = -10;
  check('Ret mektubu en büyük eksi terimden (Finans: itibar)', /tanımıyoruz/.test(Pub.__test.rejectLetter(c, ev)));
  // Kendi yayınının erişimi: garajda yayıncının çok altında, güçlü stüdyoda üstünde
  const s = PACK.sales, Ys = (p) => s.selfA + s.selfB * (p / 100) ** s.selfExp, Yp = (p) => (s.yA + s.yB * p / 100) * s.pubReach;
  const self = (p) => Ys(p) * (1 - s.retailCut - 0.08), pub = (p, pay) => Yp(p) * PACK.publishing.net * pay / 100;
  check('Kendi yayını: garajda yayıncıdan az, büyük stüdyoda çok kazandırır', self(11) < pub(55, 15) && self(95) > pub(95, 21) * 2, `${self(11).toFixed(3)} < ${pub(55, 15).toFixed(3)}; ${self(95).toFixed(3)} > ${(pub(95, 21) * 2).toFixed(3)}`);
}
{
  // Deneme işi, sipariş, erken anlaşma ve kilometre taşları, vitrin etkinliği
  const tick = (g, n) => { for (let i = 0; i < n; i++) { g.state.pending = []; g.state.nextEventWeek = 1e9; g.tick(); } };
  const g = newGame({ seed: 74, difficulty: 'orta', length: 50 });
  const c = g.ctx, st = g.state;
  st.games.push({ id: 1, name: 'A', score: 75, genre: 'aksiyon', topic: 'uzay', platforms: ['pc'], units: 1000, active: false, ipId: 0 }, { id: 2, name: 'B', score: 72, genre: 'aksiyon', topic: 'uzay', platforms: ['pc'], units: 1000, active: false, ipId: 0 });
  let tr = null;
  for (let i = 0; i < 30 && !tr; i++) { Prod.genContracts(c); Pub.addTrial(c); tr = st.contractOffers.find((o) => o.trial); }
  check('Deneme işi büyük yayıncıdan gelir', !!tr && Pub.byId(c, tr.trial).power >= 60, tr?.client);
  if (tr) {
    const r0 = Pub.rel(c, tr.trial);
    Pub.onContractFinished(c, { ...tr, deadline: st.week + tr.weeks, weeks: tr.weeks });
    check('Deneme işi geçilince Tanıdık olunur', Pub.rel(c, tr.trial) - r0 >= 25 && Pub.door(c, Pub.byId(c, tr.trial)).open);
    Pub.onContractFailed(c, { ...tr });
    check('Deneme işinde kalınca ilişki düşer ve 2 yıl yeni deneme yok', st.pub.trialBan[tr.trial] > st.week + 90);
  }
  // Erken anlaşma: Ortak yayıncı finanse eder, kilometre taşları telifle kapanır
  st.pub.rel.mantar = 45; st.cash = 1e6;
  const pj = g.startProject({ name: 'Erken', genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' }).project;
  while (pj.phase < 1) tick(g, 1);
  check('Ortak yayıncıya erken anlaşma sunulur', Pub.canPitch(c, pj, Pub.byId(c, 'mantar'), 'erken').ok);
  const d = Pub.directDeal(c, pj.id, 'mantar');
  check('Erken anlaşma: ilk kilometre taşı ödenir, kesin tarih var', d.ok && pj.deal.mode === 'erken' && pj.deal.ms === 1 && pj.deal.owed > 0 && pj.deal.due > st.week, `fon ${pj.deal?.fund}`);
  while (pj.status === 'dev') tick(g, 1);
  tick(g, 1);
  check('Kilometre taşları faz sonlarında ödenir', pj.deal.ms === 3 && Math.abs(pj.deal.paid - pj.deal.fund) <= 2, `${pj.deal.paid} / ${pj.deal.fund}`);
  // Vitrin etkinliği: katılan çalışan etkinlikte, sıra hesaplanır
  st.week = Math.round((1980 - 1976) * 48); World.initWorld(c);
  const n0 = st.news.length;
  Pub.joinShowcase(c, 'dergi');
  check('Dergi yarışmasına katılınır, kişi etkinlikte', st.staff.some((p) => p.status === 'etkinlik') && st.news.length > n0, st.news[0]?.t.slice(0, 60));
}

// 33) Bölgeler (Konu C): ana bölge, dağıtım ağı, dil, bayramlar, dönem olayları, kur, yasak, bölgesel haklar, kayıt taşıma
{
  const tick = (g, n) => { for (let i = 0; i < n; i++) { g.state.pending = []; g.state.nextEventWeek = 1e9; g.tick(); } };
  check('Altı bölge, her birinin sesi, takvimi ve bayramları var', Regions.REGIONS.length === 6 && Regions.REGIONS.every((r) => r.host && r.soul && r.season.length === 12) && Regions.HOLIDAYS.length >= 30 && Regions.REGION_EVENTS.length >= 20);
  const g = newGame({ seed: 81, difficulty: 'orta', length: 50 });
  const c = g.ctx, st = g.state;
  check('Garaj yalnız ana bölgede: Avrupa erişimi çok düşük', Regions.distReach(c, 'na') > 1 && Regions.distReach(c, 'eu') < 0.05 && Regions.langReach(c, 'jp') < 0.2);
  check('Posta siparişi araştırmasız açılmaz', !g.buyNet('eu').ok);
  st.research.done.ihracat = 1; st.cash = 1e6;
  const c0 = st.cash;
  check('Posta siparişi açılır, bedeli ödenir', g.buyNet('eu').ok && Regions.netLevel(c, 'eu') === 1 && st.cash < c0 && Math.abs(Regions.distReach(c, 'eu') - 0.25) < 1e-9);
  check('Distribütör hayran ya da tanıdık yayıncı ister', !g.buyNet('eu').ok);
  const pj = g.startProject({ name: 'Dünya', genre: 'rpg', topic: 'fantezi', audience: 'genc', platforms: ['pc'], size: 'kucuk' }).project;
  check('Yeni proje yalnız stüdyonun dilinde', pj.regions.join() === 'na' && Object.keys(pj.loc).length === 0);
  check('Japonca çeviri araştırma ister', !g.localizeLevel(pj.id, 'jp', 1).ok);
  check('Avrupa çevirisi bedelli ve seviyeli', g.localizeLevel(pj.id, 'eu', 1).ok && pj.loc.eu === 1 && g.localizeLevel(pj.id, 'eu', 2).ok && pj.loc.eu === 2 && Regions.langReach(c, 'eu', pj.loc) > 1);
  // Türkiye ana bölge: ucuz maaş ve kira
  const gt = newGame({ seed: 82, difficulty: 'orta', home: 'tr' });
  check('Türkiye ana bölge: maaş ve kira çok daha ucuz', M.salaryFor(gt.ctx, 50) < M.salaryFor(g.ctx, 50) * 0.5 && Eco.rent(gt.ctx) < Eco.rent(g.ctx) * 0.5 && Regions.isNative(gt.ctx, 'tr') && !Regions.isNative(gt.ctx, 'na'));
  // Bayramlar: Ramazan Bayramı her yıl ~11 gün erken, 23 Nisan Türkiye'de talep artırır
  const R = Regions.HOLIDAYS.find((h) => h.id === 'tr_ramazan'), s1 = Regions.holidayStart(R, 1990), s2 = Regions.holidayStart(R, 1991);
  check('Ramazan Bayramı kayar (her yıl ~1–2 hafta erken)', s2 < s1 && s1 - s2 <= 2, `${s1} → ${s2}`);
  gt.state.week = 15; // Nisan 4. hafta
  const trGame = { genre: 'aksiyon', topic: 'kedi', audience: 'genc', platforms: ['pc'], regionSplit: { tr: 1 } };
  check('23 Nisan Türkiye satışını artırır (kedi oyunu, genç kitle)', Regions.activeHolidays(gt.ctx).some((h) => h.id === 'tr_23nisan') && Regions.weekK(gt.ctx, trGame) > 1.5, Regions.weekK(gt.ctx, trGame).toFixed(2));
  check('Türkiye fiyat endeksi gelir çarpanını düşürür', Regions.revK(gt.ctx, trGame) < 0.8, Regions.revK(gt.ctx, trGame).toFixed(2));
  // Dönem olayları: kur krizi ve Asya konsol yasağı
  const ge = newGame({ seed: 83, difficulty: 'kolay', length: 50 });
  ge.state.week = Math.round((2001.6 - 1976) * 48); tick(ge, 1);
  check('2001 Türkiye krizi kuru düşürür', ge.state.fxMods.some((f) => f.rid === 'tr' && f.v < 0.6));
  const kGame = { genre: 'aksiyon', platforms: ['oi2'], regionSplit: { asya: 1 } };
  check('Asya konsol yasağı konsol satışını durdurur', Regions.weekK(ge.ctx, kGame) < 0.2 && ge.state.bans.some((b) => b.rid === 'asya'));
  check('Avrupa şiddet listesi yetişkin aksiyonu kısar, kültürelleştirme aşar', Regions.ratingK(ge.ctx, { genre: 'aksiyon', audience: 'yetiskin' }, 'eu') < 1 && Regions.ratingK(ge.ctx, { genre: 'aksiyon', audience: 'yetiskin' }, 'eu', { eu: 3 }) === 1);
  // Yayın: erişim oyuna yazılır, hayranlar bölgelere dağılır
  while (pj.status === 'dev') tick(g, 1);
  st.research.done.oz_yayin = 1;
  const rel = g.release({ projectId: pj.id, publisherId: null, price: 20 });
  check('Yayında bölge erişimi ve dağılımı hesaplanır', rel.ok && rel.game.reach && rel.game.regionSplit.na > rel.game.regionSplit.jp && Object.values(st.fanMix).reduce((a, b) => a + b, 0) > 0.99);
  // Kademeli çıkış: yayından sonra çeviri ikinci dalga getirir
  st.research.done.yerel_jp = 1; st.cash = 1e6;
  const pk = { ...rel.game.peak };
  check('Yayından sonra yerelleştirme (kademeli çıkış) zirveyi büyütür', g.localizeGame(rel.game.id, 'jp', 1).ok && Object.keys(pk).some((k) => rel.game.peak[k] > pk[k]));
  // Bölgesel haklar
  const gb = newGame({ seed: 84, difficulty: 'kolay' });
  gb.state.research.done.oz_yayin = 1;
  const pb = gb.startProject({ name: 'Haklar', genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' }).project;
  while (pb.status === 'dev') tick(gb, 1);
  const o = { id: gb.state.nextId++, pid: pb.id, pubId: 'namko', pubName: 'Namko', kind: 'tam', mode: 'bitmis', pay: 14, adv: 1000, buyout: 0, fund: 0, rights: 'sende', promo: 0, expUnits: 1000, price: 20, votes: {}, margin: 40, est: 70, expires: gb.state.week + 4, rounds: 0, koz: 3 };
  gb.state.pub.offers.push(o);
  check('Bölgesel haklar hamlesi önerilir', Pub.negMoves(gb.ctx, o).some((m) => m.id === 'bolgesel'));
  o.regions = ['jp'];
  check('Bölgesel haklarla imza: yayıncı yalnız kendi bölgesini alır', gb.signOffer(o.id).ok && pb.deal.regions.join() === 'jp');
  const rb = gb.release({ projectId: pb.id, price: 20 });
  check('Gelir bölgelere göre ayrılır (yayıncı payı < 1)', rb.ok && Regions.dealShare(rb.game) < 0.95 && Regions.dealShare(rb.game) > 0 && rb.game.inDeal.join() === 'jp');
  // Eski kayıt: dört bölgeli dünyadan
  const old = JSON.parse(newGame({ seed: 85 }).save());
  delete old.home; delete old.net; delete old.fanMix; old.games = [{ id: 1, name: 'Eski', regions: ['na', 'eu', 'row'], regionSplit: { na: 0.5, eu: 0.3, row: 0.2 }, regionSold: {}, active: false, units: 0 }];
  const lg = loadGame(JSON.stringify(old));
  check('Eski kayıt: ana bölge K. Amerika, Avrupa dağıtımı açık, "Dünya" bölünür', lg.state.home === 'na' && lg.state.net.eu === 2 && !lg.state.games[0].regions.includes('row') && lg.state.games[0].regionSplit.asya > 0);
}

// 34) Türler (Konu D): 13 ana tür, 100+ alt tür, altı kademe, kurucu geçmişi, tür bilgisi, icat, yaşam döngüsü, efsaneler, göç
{
  const G = await import('../src/data/genres.js');
  check('13 ana tür ve 100+ alt tür', PACK.genres.length === 13 && G.SUBGENRES.length >= 100, `${PACK.genres.length} / ${G.SUBGENRES.length}`);
  check('Her konunun her türle kademesi var', PACK.topics.every((t) => (G.TOPIC_FIT[t[0]] || '').length === 13 && /^[SIGBKX]+$/.test(G.TOPIC_FIT[t[0]])));
  check('Her konunun en az bir Süper türü var', PACK.topics.every((t) => G.TOPIC_FIT[t[0]].includes('S')));
  check('Her alt türün ana türü ve altın çağı geçerli', G.SUBGENRES.every((sb) => PACK.genres.some((g) => g.id === sb.parent) && sb.peak[0] >= sb.year && sb.peak[1] >= sb.peak[0]));
  // Aynı ekip: Süper ile İğrenç arasında en az 25 puan
  const c20 = ctxAt(2020, 'orta');
  const mkp = (genre, topic, sub) => {
    const g = PACK.genres.find((x) => x.id === genre), share = { oyn: 0, gfx: 0, ses: 0, tek: 0 };
    PACK.missions.forEach((m) => (share[m.disc] += 1));
    const p = { genre, sub, topic, audience: 'herkes', platforms: ['pc'], size: 'orta', engineId: null, bugs: 0, points: {}, alloc: PACK.missions.map((m) => (g.disc[m.disc] / share[m.disc]) * 100) };
    for (const d of ['oyn', 'gfx', 'ses', 'tek']) p.points[d] = M.target(c20, d, 'orta') * 0.85;
    return p;
  };
  const sSup = M.review(c20, mkp('nisanci', 'uzay', 'kaydirmali')).score, sIgr = M.review(c20, mkp('strateji', 'dans', 'otosavas')).score;
  check('İğrenç kombinasyon Süper\'den en az 25 puan düşük', sSup - sIgr >= 25, `${sSup} / ${sIgr}`);
  check('Kombinasyon notları doğru', M.combo(c20, mkp('nisanci', 'uzay', 'kaydirmali')).overall === 'S' && M.combo(c20, mkp('strateji', 'dans', 'otosavas')).overall === 'X');
  check('Platform tavanı: ışık tabancası telefonda İğrenç', M.platCap('isiktabancasi', { kind: 'mobil' }) === 'X' && M.platFit(c20, { kind: 'mobil', genre: [8, 7, 7, 9, 8, 10] }, 'nisanci', 'isiktabancasi') === 4);
  check('Kitle tavanı: hayatta kalma korkusu gençlere Kötü', M.combo(c20, { ...mkp('aksiyon', 'korku', 'hayattakorku'), audience: 'genc' }).audCap === 'K');
  // Efsane: yılı gelince Süper
  const c99 = ctxAt(1999, 'orta'), c95 = ctxAt(1995, 'orta');
  check('Efsane kombinasyon yılı gelince Süper (Ambulans Çılgınlığı)', M.combo(c99, { topic: 'hastane', genre: 'yaris' }).legend?.id === 'ambulans' && M.combo(c99, { topic: 'hastane', genre: 'yaris' }).overall === 'S' && M.combo(c95, { topic: 'hastane', genre: 'yaris' }).overall === 'X');
  // Yaşam döngüsü
  const lc = (y) => ctxAt(y, 'orta');
  check('Yaşam döngüsü: plastik enstrüman 2008 altın çağ, 2012 çökmüş', Genres.phase(lc(2008), 'enstruman').id === 'altin' && Genres.phase(lc(2012), 'enstruman').id === 'cokmus' && Genres.phase(lc(2012), 'enstruman').k < 0.7);
  check('Yaşam döngüsü: retro dalgası eski türü niş cezasından kurtarır', Genres.phase(lc(2016), 'tekekran').k === 1 && Genres.phase(lc(2010), 'tekekran').k < 1);
  // Kurucu geçmişi
  const gm = rawNewGame({ seed: 91, difficulty: 'orta', background: 'masa' });
  check('Geçmiş: masa oyunu meraklısı Strateji ve Bulmaca bilir, Aksiyon bilmez', Genres.knows(gm.ctx, 'strateji') && Genres.knows(gm.ctx, 'bulmaca') && !Genres.knows(gm.ctx, 'aksiyon') && gm.state.gxp.strateji === PACK.genreSys.startXp);
  check('Bilinmeyen türle proje başlamaz', !gm.startProject({ name: 'X', genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' }).ok);
  check('Geçmiş: mahalle kaptanı 300 hayranla başlar', rawNewGame({ seed: 92, background: 'mahalle' }).state.fans >= 300);
  check('Kurucu kendi türlerini sever, çalışanların zevki var', gm.state.staff[0].likes.join() === 'strateji,bulmaca' && gm.state.applicants.every((p) => p.likes?.length >= 1));
  // Tür bilgisi yayınla artar
  const tick = (g, n) => { for (let i = 0; i < n; i++) { g.state.pending = []; g.state.nextEventWeek = 1e9; g.tick(); } };
  const gx = rawNewGame({ seed: 93, difficulty: 'kolay' });
  gx.state.research.done.oz_yayin = 1;
  const x0 = gx.state.gxp.aksiyon;
  const pj = gx.startProject({ name: 'Bilgi', genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' }).project;
  while (pj.status === 'dev') tick(gx, 1);
  const rl = gx.release({ projectId: pj.id, price: 20 });
  check('Yayın tür bilgisini artırır ve kombinasyonu öğretir', rl.ok && gx.state.gxp.aksiyon > x0 && gx.state.knowledge['tg|uzay|aksiyon'] === 10);
  // Paslanma
  gx.state.gxp.yaris = 50; gx.state.gxpLast.yaris = 1960;
  gx.state.week = 48 * 10 - 1; tick(gx, 1);
  check('Kullanılmayan tür paslanır', gx.state.gxp.yaris < 50 && gx.state.gxp.yaris >= PACK.genreSys.rustFloor);
  // İcat
  const gi = rawNewGame({ seed: 94, difficulty: 'kolay' });
  gi.state.week = Math.round((1981 - 1976) * 48 * gi.state.lengthMult); gi.state.research.done.alt_tur = 1; gi.state.gxp.aksiyon = 70; gi.state.research.rp = 500; gi.state.cash = 1e6;
  check('Usta stüdyo doğmamış alt türü icat edebilir; çok erkeni edemez', Genres.inventInfo(gi.ctx, 'metroidvania').ok && !Genres.inventInfo(gi.ctx, 'battleroyale').ok && !Genres.subAvailable(gi.ctx, 'metroidvania'));
  const ok = gi.invent('metroidvania').ok;
  tick(gi, PACK.genreSys.invent.weeks + 1);
  check('İcat bitince alt tür doğuşundan önce kullanılabilir', ok && Genres.subAvailable(gi.ctx, 'metroidvania') && gi.state.invented.metroidvania);
  // Odak grubu
  const gf = rawNewGame({ seed: 95, difficulty: 'kolay' }); gf.state.research.done.alt_tur = 1;
  const c0 = gf.state.cash, fr = gf.focusGroup({ topic: 'yaris', genre: 'yaris', sub: 'arcadeyaris', platforms: ['pc'], size: 'kucuk' });
  check('Odak grubu kademeleri öğretir ve para alır', fr.ok && gf.state.cash < c0 && gf.state.knowledge['gs|yaris|arcadeyaris'] === 10 && Genres.knownCombo(gf.ctx, { topic: 'yaris', genre: 'yaris', sub: 'arcadeyaris' }).overall === 'S');
  // Ekip sezgisi: usta stüdyoda kesin
  gf.state.gxp.yaris = 70;
  check('Usta stüdyoda ekip sezgisi kesin', Genres.intuition(gf.ctx, { topic: 'dans', genre: 'yaris', sub: 'arcadeyaris' }).exact && Genres.intuition(gf.ctx, { topic: 'yaris', genre: 'yaris', sub: 'arcadeyaris' }).tier === 'S');
  // Eski kayıt göçü
  const old = JSON.parse(rawNewGame({ seed: 96 }).save());
  for (const k of ['genreV', 'gxp', 'gxpLast', 'background', 'legends', 'invented', 'subUsed', 'ideas']) delete old[k];
  old.research.done.tur_rpg = 10;
  old.games = [{ id: 1, name: 'Eski', genre: 'aksiyon', sub: 'rpg', topic: 'uzay', size: 'kucuk', score: 70, year: 1980, regions: ['na'], regionSplit: { na: 1 }, regionSold: {}, active: false, units: 0 }];
  for (const p of old.staff) { delete p.likes; delete p.dislike; delete p.gexp; }
  const lg = loadGame(JSON.stringify(old));
  check('Eski kayıt: eski türler bilinir, alt tür eşlenir, bilgi geçmiş oyunlardan', Genres.knows(lg.ctx, 'macera') && Genres.knows(lg.ctx, 'casual') && Genres.knows(lg.ctx, 'rpg') && lg.state.games[0].sub === 'aksiyonrpg' && lg.state.gxp.aksiyon > 0 && lg.state.staff[0].likes?.length >= 1);
}

// 35) Konu E: motor ve teknoloji
{
  const E = await import('../src/systems/engines.js');
  const tick = (g, n) => { for (let i = 0; i < n; i++) { g.state.pending = []; g.state.nextEventWeek = 1e9; g.tick(); } };
  const at = (y, o = {}) => { const g = rawNewGame({ seed: 77, difficulty: 'kolay', length: 50, ...o }); g.state.week = Math.round((y - 1976) * 48 * g.state.lengthMult); for (const gg of PACK.genres) g.state.research.done[gg.research] ??= 0; g.state.research.done.alt_tur = 1; g.state.cash = 5e7; return g; };
  check('50 özellik, 7 kategori, 6 temel', E.FEATURES.length === 50 && E.CATS.length === 7 && E.BASE.length === 6, `${E.FEATURES.length}/${E.CATS.length}/${E.BASE.length}`);
  check('Her kategori 1976 temeliyle başlar (kayıt hariç) ve yıla göre sıralı', E.CATS.every((c) => { const l = E.FEATURES.filter((f) => f.cat === c.id); return l.every((f, i) => !i || f.year >= l[i - 1].year); }));
  const g95 = at(1995);
  check('Platform şartı: poligon Ataro\'da yok, bilgisayarda var; fare yalnız bilgisayarda', !M.featOk(g95.ctx, 'g_poligon', ['ataro']) && M.featOk(g95.ctx, 'g_poligon', ['pc']) && M.featOk(g95.ctx, 'k_fare', ['pc', 'oi1']) && !M.featOk(g95.ctx, 'k_fare', ['oi1']));
  const fps = { name: 'F', genre: 'nisanci', sub: 'fps', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk', points: { oyn: 1, gfx: 1, ses: 1, tek: 1 }, bugs: 0, alloc: [] };
  const n0 = M.techNotes(g95.ctx, fps).map((n) => n.text).join('|'), n1 = M.techNotes(g95.ctx, { ...fps, engineLic: 'kiyamet' }).map((n) => n.text).join('|');
  check('Alt tür şartı: sıfırdan kodla FPS −5, Kıyamet Motoru ile yok', /Poligon 3D yok −5/.test(n0) && !/Poligon/.test(n1), n0);
  const rpg = { ...fps, genre: 'rpg', sub: 'aksiyonrpg' };
  check('Türün olmazsa olmazı: kayıtsız RPG −2', M.techNotes(g95.ctx, rpg).some((n) => n.v === -2 && n.line));
  const scr = M.techProfile(g95.ctx, fps), kiy = M.techProfile(g95.ctx, { ...fps, engineLic: 'kiyamet' });
  check('Sıfırdan kod 1995\'te geride, lisanslı motor dönemde', scr.gfx < 0.9 && scr.tek < 1 && kiy.gfx >= 1 && kiy.tek > 1.1, `${scr.gfx.toFixed(2)}/${scr.tek.toFixed(2)} · ${kiy.gfx.toFixed(2)}/${kiy.tek.toFixed(2)}`);
  check('Temel dışı özellik süreyi uzatır (en çok %15)', kiy.load > 1 && kiy.load <= 1.15 + 1e-9);
  const c0 = g95.state.cash, r = g95.startProject({ ...fps, engineLic: 'kiyamet' });
  check('Peşin lisans proje başında kesilir', r.ok && c0 - g95.state.cash >= 150000 && g95.state.ledger.total.motor_lisans <= -150000, String(g95.state.ledger.total.motor_lisans));
  check('Projeye lisans yazılır', r.project?.engineLic === 'kiyamet' && r.project.lic?.royalty === 0);
  // Yüzde ve eşik
  const g15 = at(2015), g22 = at(2022), g23 = at(2023);
  check('Gerçeksiz 2014 sonrası peşin yok, %5', M.licPay(M.licById('gercekdisi'), 2015).fee === 0 && M.licPay(M.licById('gercekdisi'), 2015).royalty === 0.05);
  check('Yüzde haftalık gelirden kesilir', E.royaltyCut(g15.ctx, { lic: { id: 'gercekdisi', royalty: 0.05 }, revenue: 0 }, 100000) === 5000);
  check('Gerçeksiz 2022: ilk 1 milyon yüzdesiz', E.royaltyCut(g22.ctx, { lic: { id: 'gercekdisi', royalty: 0.05, threshold: 1e6 }, revenue: 0 }, 500000) === 0 && E.royaltyCut(g22.ctx, { lic: { id: 'gercekdisi', royalty: 0.05, threshold: 1e6 }, revenue: 900000 }, 200000) === 5000);
  check('Birlik 2023 kurulum ücreti: +%3', E.royaltyCut(g23.ctx, { lic: { id: 'birlik', royalty: 0, seat: 150 }, revenue: 0 }, 100000) === 3000);
  const gr = at(2016); const rr = gr.startProject({ ...fps, engineLic: 'gercekdisi' }).project;
  while (rr.status === 'dev') tick(gr, 1);
  for (const d in rr.points) rr.points[d] = M.target(gr.ctx, d, rr.size); rr.bugs = 0;
  gr.state.research.done.oz_yayin = 1; gr.release({ projectId: rr.id, price: 20 });
  tick(gr, 6);
  check('Satıştan motor lisansı kesilir (finans satırı)', gr.state.ledger.total.motor_lisans < 0 && gr.state.games[0].lic?.id === 'gercekdisi');
  // Çizim Yazılımı kapanır
  check('Çizim Yazılımı 2004\'te kapanır', E.licAvailable(at(2003).ctx).some((L) => L.id === 'cizim') && !E.licAvailable(at(2004).ctx).some((L) => L.id === 'cizim') && !at(2004).startProject({ ...fps, engineLic: 'cizim' }).ok);
  // Teknoloji hattı ve motor sürümü
  const gt = at(1985);
  check('Teknoloji hattı "Kendi motorunu yap" ister', !gt.startTech('g_blok').ok);
  gt.state.research.done.motor_ozel = 1; gt.state.research.rp = 1000;
  check('Merdiven: Sprite, Blok grafikten önce araştırılamaz', E.techState(gt.ctx, 'g_sprite') === 'locked' && E.techState(gt.ctx, 'g_blok') === 'ready');
  const st = gt.startTech('g_blok');
  tick(gt, M.featureStats(gt.ctx, 'g_blok').weeks + 1);
  check('Teknoloji araştırması biter, sonraki basamak açılır', st.ok && E.techDone(gt.ctx, 'g_blok') && E.techState(gt.ctx, 'g_sprite') === 'ready');
  check('Eski basamak ucuzlar', M.featureStats(gt.ctx, 'g_blok').cost < PACK.researchV.rows[0][3]);
  gt.state.tech.done.g_sprite = 1; gt.state.tech.done.s_cip = 1;
  const b1 = gt.buildEngine('Garaj', ['g_blok', 'g_sprite']);
  tick(gt, 8);
  const e1 = gt.state.engines[0];
  const full = E.buildCost(gt.ctx, ['g_blok', 'g_sprite', 's_cip']), carry = E.buildCost(gt.ctx, ['g_blok', 'g_sprite', 's_cip'], e1.id);
  check('Yeni sürüm eski özellikleri %20 bedelle taşır', b1.ok && e1 && carry.cost < full.cost && carry.fresh === 1, `${carry.cost} < ${full.cost}`);
  gt.buildEngine('x', ['g_blok', 'g_sprite', 's_cip'], e1.id); tick(gt, 6);
  check('Sürüm aynı ailede: Garaj 2', gt.state.engines[1]?.name === 'Garaj 2' && gt.state.engines[1].family === e1.family && E.families(gt.ctx).length === 1);
  // Eski kayıt göçü
  const old = JSON.parse(rawNewGame({ seed: 78 }).save());
  delete old.engineV; delete old.tech;
  old.research.done.f_3d = 5; old.research.done.f_sprite = 3; old.usedFeatures = { f_sprite: true };
  old.engines = [{ id: 900, name: 'Eski', features: ['f_metin', 'f_sprite'], builtYear: 1980, licensed: false }, { id: 901, name: 'Eski 2', features: ['f_sprite', 'f_3d'], builtYear: 1993, licensed: false }];
  const lo = loadGame(JSON.stringify(old));
  check('Eski kayıt: eski motor özellikleri yeni ağaca taşınır, motorlar tek aile', lo.state.tech.done.g_poligon === 5 && lo.state.tech.done.g_sprite === 3 && lo.state.engines[1].features.join() === 'g_sprite,g_poligon' && lo.state.engines[0].features.join() === 'g_sprite' && E.families(lo.ctx).length === 1 && lo.state.usedFeatures.g_sprite && !lo.state.research.done.f_3d);
  // Dışarıya lisans
  const gl = at(1990); gl.state.research.done.motor_ozel = 1; gl.state.research.done.motor_lisans = 1;
  for (const f of E.FEATURES) if (f.year <= 1989) gl.state.tech.done[f.id] = 1;
  gl.state.engines.push({ id: 950, name: 'Lisans', family: 950, ver: 1, features: E.FEATURES.filter((f) => !f.base && f.year <= 1989).map((f) => f.id), builtYear: 1990, licensed: false });
  gl.toggleLicence(950); gl.state.reputation = 80;
  const l0 = gl.state.ledger.total.lisans || 0;
  tick(gl, 12);
  check('Dışarıya lisans: lisansçı gelir ve aylık gelir', (gl.state.licensees[950] || []).length >= 1 && (gl.state.ledger.total.lisans || 0) > l0);
  const lic = gl.state.licensees[950][0];
  check('Lisansçı rakibin notu +1', E.rivalBonus(gl.ctx, lic) === 1 && E.rivalBonus(gl.ctx, 'Yok Öyle Bir Stüdyo') === 0);
}

// 36) Konu F: menüler ve kilitler
{
  const Menu = await import('../src/ui/menu.js');
  const { WIN_NAMES, SUBS } = await import('../src/ui/util.js');
  const g = rawNewGame({ seed: 80, difficulty: 'kolay' });
  const cats = () => Menu.openCats(g.ctx, g.state).map((k) => k.id).join();
  Menu.check(g);
  check('1976\'da Tanıtım ve Pazar saklı', cats() === 'is,ekip,arge,sirket,sistem', cats());
  check('7 başlık, 34 seçenek', Menu.CATS.length === 7 && Menu.ITEMS.length === 34, String(Menu.ITEMS.length));
  check('Her seçenek var olan bir pencereye ve sekmeye gider', Menu.ITEMS.every((it) => WIN_NAMES[it.win] && (!it.sub || (SUBS[it.win] || []).some(([k]) => k === it.sub))));
  check('Kapalı seçeneğin ipucu var', Menu.ITEMS.filter((it) => !it.open(g.ctx, g.state)).every((it) => it.hint));
  check('Pazar sekmesinde Yayıncılar ilk oyuna kadar saklı', !Menu.tabVisible(g.ctx, g.state, 'pazar', 'yayincilar') && Menu.tabVisible(g.ctx, g.state, 'gelistir', 'sozlesme'));
  check('İlk kontrol sessiz: açılış haberi yok', !g.state.news.some((n) => n.t.startsWith('🆕')));
  g.state.research.done.motor_ozel = 1;
  Menu.check(g);
  check('"Kendi motorunu yap" Teknoloji\'yi açar ve haber düşer, YENİ rozeti', Menu.isOpen(g.ctx, g.state, Menu.ITEM.teknoloji) && g.state.news.some((n) => n.t === '🆕 Ar-Ge › Teknoloji açıldı.') && Menu.isNew(g.state, Menu.ITEM.teknoloji));
  g.state.games.push({ id: 1, name: 'X', weeks: 0, active: true, score: 50 });
  Menu.check(g);
  check('İlk oyundan sonra Pazar açılır', cats().includes('pazar') && Menu.tabVisible(g.ctx, g.state, 'pazar', 'yayincilar'));
  check('Görülen kayıtla taşınır', JSON.parse(g.save()).ui.known.teknoloji > 0);
}

// 37) Konu G: platform payı, özel anlaşmalar, hisseler, tekel
{
  const Pl = await import('../src/systems/platform.js');
  const tick = (g, n) => { for (let i = 0; i < n; i++) { g.state.pending = []; g.state.nextEventWeek = 1e9; g.tick(); } };
  const mk = (y = 1995, media = 'kartus') => {
    const g = rawNewGame({ seed: 70, difficulty: 'kolay', length: 50 });
    g.state.week = Math.round((y - 1976) * 48 * g.state.lengthMult); g.state.cash = 5e8;
    const k = { id: 'own900', name: 'Test Kutu', type: 'konsol', kind: 'konsol', parts: { media }, tech: 4, launched: y - 1, retired: null, base: 5, active: 5e6, sold: 5e6, weeks: 50, thirdParty: 0, revenue: 0, price: 'normal' };
    g.state.consoles.push(k);
    g.state.war = { konsol: { own: 5, hist: 20, share: 0.2, rivals: [{ id: 'oi1', name: 'Oyunİstasyonu', owner: 'soni', base: 20 }] } };
    return { g, k, c: g.ctx };
  };
  const { g, k, c } = mk();
  const st = g.state;
  st.plat.rate = 0.15; const a15 = Pl.attract(c); st.plat.rate = 0.4; const a40 = Pl.attract(c); st.plat.rate = 0.3;
  check('Platform oranı: düşük oran stüdyo çeker', a15 > 1.3 && a40 < 0.8 && Math.abs(Pl.attract(c) - 1) < 1e-9, `${a15.toFixed(2)} / ${a40.toFixed(2)}`);
  g.toggleCart(); check('Kartuş tekeli çekiciliği düşürür', st.plat.cart && Pl.attract(c) < 1);
  g.toggleCart();
  const { g: gcd } = mk(1995, 'cd');
  check('Kartuş tekeli yalnız kartuşlu konsolda', !gcd.toggleCart().ok);
  // Başka stüdyo oyunundan yüzde
  Pl.tpRelease(c, k, 'Namko', 'Test Oyunu', true);
  const r0 = st.ledger.total.platform_payi || 0;
  Pl.weekly(c);
  const r1 = st.ledger.total.platform_payi || 0;
  st.plat.rate = 0.4; Pl.weekly(c); const r2 = (st.ledger.total.platform_payi || 0) - r1;
  check('Başka stüdyonun satışından oran kadar pay', r1 > r0 && st.plat.tp[0].sold > 0 && r2 > (r1 - r0) * 0.85 * (0.4 / 0.3) * 0.95, `${Math.round(r1 - r0)} → ${Math.round(r2)}`);
  st.plat.rate = 0.3;
  // Teklifler ve fiyatlar
  st.plat.offerWeek = -99; Pl.weekly(c);
  const offers = Pl.offers(c);
  check('Özel anlaşma teklifleri gelir, donanım devlerinin oyunu yok', offers.length > 0 && offers.every((o) => !(o.cid && ['soni', 'pandando', 'segga', 'mikroyumusak', 'ataro'].includes(o.cid))), String(offers.length));
  const o = offers[0];
  const pr = ['pazarlama', 'sureli', 'tam', 'ikinci'].map((t) => Pl.dealPrice(c, o, t, k));
  check('Anlaşma fiyatları: pazarlama < süreli < tam < ikinci parti', pr[0] < pr[1] && pr[1] < pr[2] && pr[2] < pr[3], pr.join(' < '));
  st.war.konsol.share = 0.05; const weak = Pl.dealPrice(c, o, 'sureli', k); st.war.konsol.share = 0.2;
  check('Konsol zayıfsa daha çok para isterler', weak > pr[1]);
  // İmza ve çıkış
  const cash0 = st.cash, sd = g.signDeal(o.id, 'sureli', k.id);
  st.pending = [];
  const d = sd.deal;
  if (d?.counter) g.ctx.bus.fire('plat', { kind: 'counter', id: d.id, raise: true });
  check('Anlaşma imzalanır ve bedel kesilir', sd.ok && st.cash < cash0 && st.plat.deals.length === 1);
  const tp0 = k.thirdParty, mods0 = (st.consoleMods || []).length;
  g.ctx.bus.fire('companyRelease', { cid: o.cid, rid: o.rid, studio: o.studio, name: o.src === 'hit' ? o.name : 'X', score: 85, game: { peak: 100, lastWeek: 10 } });
  check('Oyun çıkınca konsolu iter ve kütüphaneye girer', d.done && !d.broken && k.thirdParty > tp0 && st.consoleMods.length > mods0 && st.consoleMods.at(-1).mult > 1.25);
  // Karşı teklif: çekilmek paranın %90'ını geri verir
  st.plat.offerWeek = -99; Pl.weekly(c);
  const o2 = Pl.offers(c)[0], s2 = g.signDeal(o2.id, 'tam', k.id); st.pending = [];
  s2.deal.counter = { who: 'Soni', extra: 1000 };
  const c2 = st.cash; g.ctx.bus.fire('plat', { kind: 'counter', id: s2.deal.id, raise: false });
  check('Karşı teklifte çekilmek: %90 iade', s2.deal.lost && Math.abs(st.cash - c2 - s2.deal.price * 0.9) < 2);
  // Konsol çakarsa tam özel bozulur
  st.plat.offerWeek = -99; Pl.weekly(c);
  const o3 = Pl.offers(c)[0], s3 = g.signDeal(o3.id, 'tam', k.id); st.pending = []; if (s3.deal.counter) s3.deal.counter = null;
  st.war.konsol.share = 0.01;
  const c3 = st.cash; g.ctx.bus.fire('companyRelease', { cid: o3.cid, rid: o3.rid, studio: o3.studio, name: o3.src === 'hit' ? o3.name : 'Y', score: 80 });
  check('Konsol çakarsa şirket anlaşmayı bozar, yarısını iade eder', s3.deal.broken && Math.abs(st.cash - c3 - s3.deal.price * 0.5) < 2);
  st.war.konsol.share = 0.2;
  // Hisseler
  const rv = st.rivals.filter((r) => !r.hw).sort((a, b) => b.rep - a.rep)[0];
  const p10 = Pl.stakePrice(c, rv, 10), p51 = Pl.stakePrice(c, rv, 51);
  st.coRel[rv.cid || `r${rv.id}`] = -50; const hostile = Pl.stakePrice(c, rv, 10); st.coRel[rv.cid || `r${rv.id}`] = 0;
  check('Hisse fiyatı: düşmanca daha pahalı, %51 kontrol primi', hostile > p10 && p51 / 51 > p10 / 10 * 1.1);
  check('Donanım devinin hissesi satılmaz', !g.buyStake(st.rivals.find((r) => r.hw).id, 10).ok);
  g.buyStake(rv.id, 10); const div0 = st.ledger.total.temettu || 0; Pl.monthly(c);
  check('%10: temettü', rv.stake === 10 && (st.ledger.total.temettu || 0) > div0);
  g.buyStake(rv.id, 25);
  check('%25: koltuk, ilişki artar, anlaşmada %25 indirim', rv.stake === 25 && Pl.relOf(c, rv) >= 10 && Pl.dealPrice(c, { E: 80, rid: rv.id, cid: rv.cid }, 'sureli', k) < Pl.dealPrice(c, { E: 80, cid: 'yokboyle' }, 'sureli', k));
  g.buyStake(rv.id, 51);
  check('%51: kontrol, bağlı stüdyo', rv.acquired && rv.stake === 51 && Pl.controlled(c).includes(rv) && rv.autonomy === PACK.platform.stake.autonomyStart);
  // Sipariş ve teslim
  const or = g.orderGame(rv.id, { genre: 'aksiyon', topic: 'uzay', size: 'kucuk', budget: 'yuksek' });
  check('Sipariş verilir, özerklik düşer, ikinci sipariş beklemeli', or.ok && rv.autonomy < PACK.platform.stake.autonomyStart && !g.orderGame(rv.id, { genre: 'aksiyon', topic: 'uzay', size: 'kucuk', budget: 'normal' }).ok);
  tick(g, Math.round(10 * PACK.platform.stake.orderWeeksK) + 2);
  const ext = st.projects.find((p) => p.ext);
  check('Teslim: projelerde yayına hazır, odasız', ext && ext.status === 'debug' && ext.roomId == null && ext.ext.rid === rv.id);
  st.research.done.oz_yayin = 1;
  const rel = ext && g.release({ projectId: ext.id, price: 20 });
  check('Teslim edilen oyunu sen yayınlarsın', rel?.ok && rel.game.score > 30, String(rel?.game?.score));
  // Politika ve itme
  check('Politika: yalnız benim konsolum', g.setPolicy(rv.id, 'yalniz').ok && rv.policy === 'yalniz');
  const m0 = (st.consoleMods || []).length; g.ctx.bus.fire('companyRelease', { rid: rv.id, cid: rv.cid, studio: rv.name, name: 'Z', score: 70 });
  check('Bağlı stüdyonun oyunu konsolunu iter', st.consoleMods.length > m0);
  // Özerklik düşerse yıldız istifası
  const n0 = st.rivals.length;
  for (let i = 0; i < 300 && st.rivals.length === n0; i++) { rv.autonomy = 0; Pl.monthly(c); }
  check('Özerklik düşerse yıldız yapımcı istifa edip yeni stüdyo kurar', st.rivals.length === n0 + 1 && rv.autonomy === 60);
  // Birleştirme
  g.buyStake(rv.id, 100);
  const s0 = st.staff.length; g.state.rooms.push({ id: 9901, type: 'gelistirme', mode: 'otomatik' });
  const mg = g.mergeStudio(rv.id);
  check('%100: birleştirme çalışan getirir, şirket listeden çıkar', mg.ok && st.staff.length > s0 && !st.rivals.includes(rv));
  // 5 bağlı stüdyo sınırı
  const pool = st.rivals.filter((r) => !r.hw && !(r.stake >= 51));
  for (const r of pool.slice(0, 5)) g.buyStake(r.id, 51);
  const sixth = pool[5];
  check('En çok 5 bağlı stüdyo', Pl.controlled(c).length === 5 && sixth && !g.buyStake(sixth.id, 51).ok);
  // Rekabet Kurumu: anlaşmaları açma ve şirket satma
  st.plat.offerWeek = -99; Pl.weekly(c);
  const o4 = Pl.offers(c)[0]; const s4 = g.signDeal(o4.id, 'sureli', k.id); st.pending = [];
  g.ctx.bus.fire('plat', { kind: 'probe', opt: 'open' });
  check('Rekabet Kurumu: özel anlaşmalar açılır', s4.deal.opened && !st.consoleMods.some((m) => m.deal));
  const weakest = Pl.controlled(c).sort((a, b) => a.rep - b.rep)[0], c5 = st.cash;
  g.ctx.bus.fire('plat', { kind: 'probe', opt: 'sell', id: weakest.id });
  check('Rekabet Kurumu: bir şirket satılır', !weakest.stake && st.cash > c5);
  st.plat.lastProbe = -999; st.war.konsol.share = 0.6;
  let probed = false;
  for (let i = 0; i < 400 && !probed; i++) { st.pending = []; Pl.monthly(c); probed = st.pending.some((e) => e.id === 'rekabet'); }
  check('Pay %40\'ı geçince soruşturma gelir', probed && st.pending.find((e) => e.id === 'rekabet').choices.length === 3);
  check('Tekel ısısı yükselir', st.plat.heat > 30, st.plat.heat.toFixed(0));
  // Eski kayıt
  const old = JSON.parse(rawNewGame({ seed: 71 }).save());
  delete old.plat; delete old.coRel; old.rivals[0].acquired = true; old.rivals[0].price = 1e6; delete old.rivals[0].stake;
  const lg = loadGame(JSON.stringify(old));
  check('Eski kayıt: satın alınmış şirket %100 hisse olur', lg.state.rivals[0].stake === 100 && lg.state.plat.rate === 0.3);
}

console.log(`\n${pass} geçti, ${fail} kaldı.`);
process.exit(fail ? 1 : 0);
