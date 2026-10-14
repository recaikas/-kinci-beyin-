// Arayüz (GDT/Kairosoft esinli): tam ekran sahne, üstte HUD ve proje sayacı, altta ikonlu menü,
// menüden açılan pencereler (açıkken oyun durur), adım adım yeni oyun sihirbazı, faz başında dağılım
// penceresi, yayında eleştirmen ekranı. Oyun mantığı game.js'te; burası yalnızca çağırır ve gösterir.
import { newGame, loadGame, M, Staff, Co } from '../game.js';
import { PACK } from '../data/pack.js';
import { makeRenderer, menuIcon } from './render.js';
import { money } from '../kernel.js';
import { SAVE_KEY, esc, fmt, pct, bar, discName, SPEEDS, kaosLabel, store, MENU, WIN_NAMES, ICON_OF, SUBS, move } from './util.js';
import { make as make_win_hub } from './win_hub.js';
import { make as make_win_develop } from './win_develop.js';
import { make as make_win_staff } from './win_staff.js';
import { make as make_win_office } from './win_office.js';
import { make as make_win_research } from './win_research.js';
import { make as make_chart } from './chart.js';
import { make as make_win_market } from './win_market.js';
import { make as make_win_finance } from './win_finance.js';
import { make as make_win_world } from './win_world.js';
import { make as make_dialogs } from './dialogs.js';
import { make as make_system } from './system.js';
import { makeAudio } from './audio.js';


export function boot(root, hotData = {}) {
  const app = {
    game: null, running: false, speed: 1, frame: 0, timer: null, win: null, sub: {}, wasRunning: false, wasRunningD: false, dialog: null,
    draft: null, wiz: 1, engineSel: new Set(), engineName: 'Motor', consoleDraft: { type: 'konsol', series: 'yeni', seriesName: 'X Kutu', price: 'normal', parts: {} },
    confirm: null, expanded: new Set(), seenNews: 0, phaseSeen: {}, readySeen: {}, sel: null, selGame: null, wizOn: false, dlgPid: null, charts: {},
  };
  const $ = (id) => root.querySelector(id);
  const el = { bnav: $('#bnav'), market: $('#market'), stage: $('#stage'), canvas: $('#scene'), hud: $('#hud'), menu: $('#menu'), notes: $('#notes'), win: $('#win'), winTitle: $('#win-title'), winBody: $('#win-body'), modal: $('#modal') };
  const R = makeRenderer(el.canvas);
  // Ortak bağlam: pencere modülleri (src/ui/win_*.js, dialogs.js, chart.js) buradan okur ve fonksiyonlarını buraya ekler.
  const u = { app, el, root, R, G: () => app.game, ctx: () => app.game.ctx, audio: makeAudio() };
  const audio = u.audio;
  // Tarayıcı kuralı: ses ancak ilk dokunuştan sonra açılabilir
  root.addEventListener('pointerdown', () => audio.unlock());
  document.addEventListener('keydown', () => audio.unlock());
  const closeDialog = (...a) => u.closeDialog(...a);
  const consoleDraft = (...a) => u.consoleDraft(...a);
  const dialog = (...a) => u.dialog(...a);
  const phaseDialog = (...a) => u.phaseDialog(...a);
  const readyDialog = (...a) => u.readyDialog(...a);
  const reviewDialog = (...a) => u.reviewDialog(...a);
  const setupScreen = (...a) => u.setupScreen(...a);
  const showEvent = (...a) => u.showEvent(...a);
  const updatePhasePct = (...a) => u.updatePhasePct(...a);
  const winAds = (...a) => u.winAds(...a);
  const winBuild = (...a) => u.winBuild(...a);
  const winDevelop = (...a) => u.winDevelop(...a);
  const winFinance = (...a) => u.winFinance(...a);
  const winHub = (...a) => u.winHub(...a);
  const winMarket = (...a) => u.winMarket(...a);
  const winNews = (...a) => u.winNews(...a);
  const winOffice = (...a) => u.winOffice(...a);
  const winResearch = (...a) => u.winResearch(...a);
  const winRoom = (...a) => u.winRoom(...a);
  const winStaff = (...a) => u.winStaff(...a);
  const winWorld = (...a) => u.winWorld(...a);
  const winSettings = (...a) => u.winSettings(...a);
  const tutorial = (...a) => u.tutorial(...a);
  const G = () => app.game;
  const ctx = () => app.game.ctx;
  // Yalnızca içerik değiştiyse yeniden çiz: yarım kalan tıklamalar kaybolmasın.
  const setHTML = (node, html) => { if (node._html !== html) { node._html = html; node.innerHTML = html; } };

  // --- kayıt
  const save = () => { if (G()) store((s) => s.setItem(SAVE_KEY, G().save())); };
  window.claude?.hot?.snapshot?.(() => ({ save: G() ? G().save() : null }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  // --- sahne boyutu: kapsayıcıya göre düşük çözünürlük (piksel ~4 masaüstü, ~1,6 telefon)
  function fit() {
    const r = el.stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const scale = Math.max(1.5, Math.min(5, Math.min(r.width / 340, r.height / 210)));
    const w = Math.floor(r.width / scale), h = Math.floor(r.height / scale);
    if (el.canvas.width !== w || el.canvas.height !== h) { el.canvas.width = w; el.canvas.height = h; }
  }
  new ResizeObserver(fit).observe(el.stage);

  // --- bildirimler (sağ üst, en fazla 3, kendiliğinden kaybolur)
  function note(text, type = 'info') {
    const n = document.createElement('div');
    n.className = `note ${type}`; n.textContent = text;
    el.notes.prepend(n);
    while (el.notes.children.length > 3) el.notes.lastChild.remove();
    setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 400); }, 4500);
    audio.play({ good: 'good', bad: 'bad', warn: 'warn', tarih: 'news' }[type] || 'news');
  }
  const run = (res) => { if (res && res.ok === false) note(res.msg, 'bad'); else if (res && res.ok) audio.play('coin'); render(); return res; };

  // --- zaman
  function play(on) {
    app.running = on;
    clearInterval(app.timer);
    if (on) app.timer = setInterval(step, PACK.meta.msPerWeek[app.speed]);
    renderHud();
  }
  const blocked = () => app.win || app.dialog || !el.modal.hidden || u.tutorialOpen?.();
  function step() {
    const g = G();
    if (!g || blocked()) return;
    if (g.state.pending.length || g.state.gameOver) return showEvent();
    const before = g.state.news[0];
    g.tick();
    audio.setEra(M.tableYear(g.ctx), g.state.kaos);
    if (g.state.week % 4 === 0) save();
    for (const n of g.state.news) { if (n === before) break; if (n.type !== 'info') note(n.t, n.type); }
    render();
    if (g.state.pending.length || g.state.gameOver) return showEvent();
    for (const pj of g.state.projects) {
      if (pj.status === 'dev' && app.phaseSeen[pj.id] !== pj.phase) return phaseDialog(pj);
      if (pj.status === 'debug' && !app.readySeen[pj.id]) return readyDialog(pj);
    }
  }
  // Animasyon sayacı yalnız zaman akarken ilerler: duraklatınca (ya da pencere açıkken) ofis donar.
  function loop() {
    const paused = !app.running || !!blocked();
    if (!paused) app.frame++;
    el.stage?.classList.toggle('paused', !!G() && paused && !app.win);
    if (G()) R.draw(G().state, PACK, app.frame, { building: curBuilding().id, paused });
    requestAnimationFrame(loop);
  }
  function render() {
    renderHud();
    renderMarket();
    renderBnav();
    renderMenu();
    if (app.win) {
      const a = document.activeElement;
      const typing = a && el.win.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'SELECT');
      if (!typing) renderWindow();
    }
  }

  // --- HUD: iskelet bir kez kurulur, her hafta yalnızca alanlar güncellenir.
  function renderHud() {
    const g = G();
    if (!g) { el.hud.innerHTML = ''; el.hud._html = ''; return; }
    const s = g.state, cal = g.cal(), c = ctx();
    if (!el.hud.querySelector('[data-f=cash]')) el.hud.innerHTML = `
      <div class="brand"><b data-f="name"></b><small data-f="date"></small></div>
      <div data-f="proj" class="projslot"></div>
      <div class="stats">
        <div class="stat"><small>Kasa</small><b class="num" data-f="cash"></b></div>
        <div class="stat"><small>Hayran</small><b class="num" data-f="fans"></b></div>
        <div class="stat kaos" data-f="kaosbox"><small data-f="kaoslabel"></small><b class="num" data-f="kaos"></b><span class="bar kbar"><i data-f="kaosbar"></i></span></div>
      </div>
      <div class="time"><button data-act="play" data-f="play"></button><button data-act="speed" data-f="speed" aria-label="Hız"></button><button data-act="sound" data-f="sound" aria-label="Ses"></button></div>`;
    const f = (k) => el.hud.querySelector(`[data-f=${k}]`);
    const set = (k, v) => { const n = f(k); if (n.textContent !== v) n.textContent = v; };
    const k = Math.round(s.kaos), stars = Math.round(M.studioStars(c));
    set('name', s.companyName);
    set('date', `${cal.era} · ${cal.label} · ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`);
    set('cash', money(s.cash)); f('cash').classList.toggle('neg', s.cash < 0);
    set('fans', fmt(s.fans));
    set('kaos', String(k)); set('kaoslabel', `Kaos · ${kaosLabel(k)}`);
    f('kaosbox').className = `stat kaos k${k < 30 ? 0 : k < 55 ? 1 : k < 80 ? 2 : 3}`;
    f('kaosbar').style.width = `${pct(k)}%`;
    set('play', app.running ? '❚❚' : '▶'); f('play').className = app.running ? '' : 'primary'; f('play').setAttribute('aria-label', app.running ? 'Durdur' : 'Oynat');
    set('speed', `${app.speed}×`);
    set('sound', { on: '🔊', sfx: '🔉', off: '🔇' }[audio.state()]); f('sound').title = { on: 'Ses ve müzik açık', sfx: 'Yalnız efektler', off: 'Sessiz' }[audio.state()];
    // proje sayacı (GDT): yapı yalnızca proje değişince kurulur
    const pj = s.projects[0], slot = f('proj');
    const best = !pj && s.games.filter((g) => g.active && g.rank).sort((a, b) => a.rank - b.rank)[0];
    const key = pj ? `p${pj.id}:${s.projects.length}` : best ? `s${best.id}:${best.rank}:${best.lastWeek}` : 'none';
    if (slot.dataset.key !== key) {
      slot.dataset.key = key;
      slot.innerHTML = pj ? `<button class="proj" data-open="gelistir"><span class="pname"></span>${s.projects.length > 1 ? `<em class="more">+${s.projects.length - 1} proje</em>` : ''}<span class="counters">${['oyn', 'gfx', 'ses', 'tek'].map((d) => `<b class="num c-${d}" title="${discName(d)}" data-d="${d}"></b>`).join('')}<b class="num c-bug" title="Hata" data-d="bug"></b></span><span class="bar prog"><i></i></span></button>`
        : best ? `<button class="proj sale" data-open="gelistir"><span class="pname">Satışta: ${esc(best.name)}</span><span class="rk">#${best.rank} ${move({ rank: best.rank, prev: best.prevRank })}</span><small class="muted">${fmt(best.lastWeek)} kopya bu hafta · toplam ${fmt(best.units)} · yeni oyun başlat</small></button>`
        : '<button class="proj idle" data-open="gelistir"><span>Proje yok</span><small>Yeni oyun başlat</small></button>';
    }
    if (pj) {
      slot.querySelector('.pname').textContent = pj.name;
      for (const b of slot.querySelectorAll('[data-d]')) b.textContent = fmt(b.dataset.d === 'bug' ? pj.bugs : pj.points[b.dataset.d]);
      slot.querySelector('.bar i').style.width = `${pj.status === 'dev' ? pct((pj.week / pj.totalWeeks) * 100) : 100}%`;
    }
  }

  // --- MGT tarzı yan satış paneli: satıştaki her oyun için maliyet, gelir, kâr, sıra ve kâr eğrisi; geliştirilen projelerin maliyeti
  const signed = (v) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`;
  function profitSpark(vals) {
    if (!vals || vals.length < 2) return '';
    const max = Math.max(1, ...vals), min = Math.min(0, ...vals), y = (v) => 1 + ((max - v) * 20) / (max - min || 1);
    const pts = vals.map((v, i) => `${((i * 100) / (vals.length - 1)).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="100" y1="${y(0)}" y2="${y(0)}" class="zero"/><polyline points="${pts}" class="${vals[vals.length - 1] >= 0 ? 'pos' : 'neg'}"/></svg>`;
  }
  // Panel tercihi hatırlanır; telefonda varsayılan kapalı (sahneyi kapatmasın).
  const panelOpen = () => app.panel ?? ((store((st) => st.getItem('xp-panel')) ?? (window.innerWidth >= 700 ? '1' : '0')) !== '0');
  function renderMarket() {
    const s = G()?.state;
    if (!s) return setHTML(el.market, '');
    const live = s.games.filter((g) => g.active).sort((a, b) => (a.rank || 999) - (b.rank || 999));
    const open = panelOpen();
    const total = live.reduce((a, g) => a + (g.revenue - (g.devCost || 0) - (g.postCost || 0)), 0);
    const head = `<button class="phead" data-panel="1" aria-expanded="${open}"><span>💰 Satışta <b class="num">${live.length}</b></span>${live.length ? `<span class="num ${total < 0 ? 'neg' : 'pos'}">${signed(total)}</span>` : ''}<i>${open ? '▸' : '◂'}</i></button>`;
    if (!open) return setHTML(el.market, head), el.market.classList.add('closed');
    el.market.classList.remove('closed');
    const cards = live.map((g) => {
      const cost = (g.devCost || 0) + (g.postCost || 0), profit = g.revenue - cost;
      return `<button class="mcard" data-mgame="${g.id}" title="${esc(g.name)}">
        <span class="rk ${g.rank && g.rank <= 3 ? 'top' : ''}">#${g.rank || '–'}</span><span class="nm">${esc(g.name)}</span><span class="wk">${g.weeks}. hf ${move({ rank: g.rank, prev: g.prevRank })}</span>
        <span class="row"><small>Maliyet</small><b class="num">${money(cost)}</b></span>
        <span class="row"><small>Gelir</small><b class="num">${money(g.revenue)}</b></span>
        <span class="row"><small>Kâr</small><b class="num ${profit < 0 ? 'neg' : 'pos'}">${signed(profit)}</b></span>
        <span class="row"><small>${g.model === 'f2p' ? 'Aktif oyuncu' : 'Bu hafta'}</small><b class="num">${g.model === 'f2p' ? fmt(g.players || 0) : `${fmt(g.lastWeek)} kopya`}</b></span>${profitSpark((g.profitHist || []).slice(-40))}</button>`;
    }).join('');
    const dev = s.projects.map((pj) => `<div class="mcard dev"><span class="rk">⚙</span><span class="nm">${esc(pj.name)}</span><span class="wk">${pj.status === 'dev' ? `${pj.week}/${pj.totalWeeks} hf` : 'yayına hazır'}</span>
      <span class="row"><small>Maliyet şimdiye dek</small><b class="num neg">${money(pj.cost || 0)}</b></span></div>`).join('');
    setHTML(el.market, head + `<div class="plist-m">${cards}${dev || ''}${!cards && !dev ? '<p class="muted small">Satışta oyun yok.</p>' : ''}</div>`);
  }
  el.market.addEventListener('click', (e) => {
    if (!e.target.closest('[data-panel]')) return;
    app.panel = !panelOpen();
    store((st) => st.setItem('xp-panel', app.panel ? '1' : '0'));
    renderMarket();
  });
  // Kartlar her hafta yenilenir; tıklama kaybolmasın diye pointerdown ile açılır.
  el.market.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-mgame]');
    if (!b || !G()) return;
    e.preventDefault();
    app.sub.pazar = 'oyunlar'; app.selGame = +b.dataset.mgame; openWin('pazar');
  });

  // --- alt menü (az düğme): Bilgisayar ve Günlük. Diğer her şey patronun bilgisayarından ya da odaya dokunarak.
  const icons = Object.fromEntries(Object.keys(WIN_NAMES).map((id) => [id, menuIcon(ICON_OF[id] || id)]));
  Object.assign(u, { icons });
  function renderMenu() {
    const s = G()?.state;
    if (!s) return;
    if (!el.menu.children.length) el.menu.innerHTML = MENU.map(([id, name]) => `<button data-open="${id}"><img src="${icons[id]}" alt=""><span>${name}</span><em class="badge" hidden></em></button>`).join('');
    const unread = Math.max(0, s.news.length - app.seenNews);
    const alert = s.projects.some((p) => p.status === 'debug') || s.staff.some((p) => p.status === 'tukenmis') || Co.company(s).pressure >= PACK.ipo.boardAt;
    const badge = { gunluk: unread ? String(Math.min(unread, 99)) : '', bilgisayar: alert ? '!' : '' };
    for (const b of el.menu.children) {
      const id = b.dataset.open, em = b.querySelector('.badge');
      b.classList.toggle('on', app.win === id || (id === 'bilgisayar' && app.win && app.win !== 'gunluk'));
      em.hidden = !badge[id];
      if (em.textContent !== (badge[id] || '')) em.textContent = badge[id] || '';
    }
  }

  // --- binalar (MGT): sahnede kaydırarak ya da oklarla geçilir
  const buildings = () => {
    const s = G().state;
    if (s.office.tier === 1) return [PACK.buildings[0]];
    return PACK.buildings.filter((b) => !b.minTier || s.office.tier >= b.minTier);
  };
  const curBuilding = () => { const list = buildings(); app.bIdx = Math.min(app.bIdx || 0, list.length - 1); return list[app.bIdx]; };
  function renderBnav() {
    if (!G()) return setHTML(el.bnav, '');
    const list = buildings();
    if (list.length < 2) return setHTML(el.bnav, '');
    const b = curBuilding();
    setHTML(el.bnav, `<button data-act="bprev" aria-label="Önceki bina">◀</button><span class="bname">${esc(b.name)}<small>${list.map((x, i) => `<i class="${i === app.bIdx ? 'on' : ''}"></i>`).join('')}</small></span><button data-act="bnext" aria-label="Sonraki bina">▶</button>`);
  }
  const goBuilding = (d) => { const n = buildings().length; app.bIdx = ((app.bIdx || 0) + d + n) % n; renderBnav(); };
  // Sahneye dokunma: kısa dokunuş = odaya/kişiye tıklama, yatay sürükleme = bina değiştirme
  let down = null;
  el.canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  el.canvas.addEventListener('pointerup', (e) => {
    if (!down || !G()) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y; down = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return goBuilding(dx < 0 ? 1 : -1);
    const r = el.canvas.getBoundingClientRect();
    const h = R.hit((e.clientX - r.left) * (el.canvas.width / r.width), (e.clientY - r.top) * (el.canvas.height / r.height));
    if (!h) return;
    if (h.kind === 'boss') return openWin('bilgisayar');
    if (h.kind === 'slot') { app.buildFor = h.building; return openWin('insaat'); }
    if (h.kind === 'locked') return openWin('ofis');
    app.room = h.room || h.id; openWin('oda');
  });

  // --- pencereler
  function openWin(id, fromHub = false) {
    if (!app.win) app.wasRunning = app.running;
    app.fromHub = fromHub; app.win = id; app.confirm = null;
    if (id === 'gunluk') app.seenNews = G().state.news.length;
    el.win.hidden = false;
    play(false);
    renderWindow(); renderMenu();
    el.winBody.scrollTop = 0;
  }
  function closeWin() {
    app.win = null; el.win.hidden = true;
    renderMenu();
    if (app.wasRunning && !app.dialog) play(true);
  }
  function renderWindow() {
    if (!app.win || !G()) return;
    const id = app.win;
    const subs = SUBS[id];
    const sub = app.sub[id] || subs?.[0][0];
    const fn = { dunya: winWorld, bilgisayar: winHub, oda: winRoom, insaat: winBuild, reklam: winAds, gelistir: winDevelop, personel: winStaff, ofis: winOffice, arge: winResearch, pazar: winMarket, finans: winFinance, gunluk: winNews, ayarlar: winSettings }[id];
    const title = id === 'oda' ? (() => { const r = G().state.rooms.find((x) => x.id === app.room); return r ? Staff.roomType(ctx(), r.type).name : 'Oda'; })() : WIN_NAMES[id];
    setHTML(el.winTitle, `${app.fromHub && id !== 'bilgisayar' ? '<button class="back" data-act="hub" aria-label="Bilgisayara dön">◀</button>' : ''}<img src="${icons[id] || icons.bilgisayar}" alt=""> ${esc(title)}`);
    const tabs = subs ? `<div class="seg" role="tablist">${subs.map(([k, n]) => `<button role="tab" data-sub="${k}" aria-selected="${sub === k}" class="${sub === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : '';
    const top = el.winBody.scrollTop;
    setHTML(el.winBody, tabs + fn(sub));
    el.winBody.scrollTop = top;
  }

  function start(game) {
    app.game = game; app.draft = null; app.wiz = 1; app.engineSel = new Set(); app.seenNews = game.state.news.length;
    app.phaseSeen = Object.fromEntries(game.state.projects.map((p) => [p.id, p.phase])); app.readySeen = Object.fromEntries(game.state.projects.filter((p) => p.status === 'debug').map((p) => [p.id, true]));
    app.sel = null; app.selGame = null; app.wizOn = false;
    app.dialog = null; app.wasRunningD = false; el.modal.hidden = true; el.modal.innerHTML = '';
    fit(); render();
    play(true);
    if (game.state.pending.length) return showEvent();
    const fresh = !game.state.projects.length && !game.state.games.length;
    const wizard = () => { app.sub.gelistir = 'oyun'; app.wizOn = true; openWin('gelistir'); };
    if (fresh && !u.tutorialSeen()) return tutorial(() => { app.wasRunning = true; wizard(); });
    if (fresh) wizard();
  }

  Object.assign(u, { setHTML, save, fit, note, run, play, step, loop, render, renderHud, signed, profitSpark, panelOpen, renderMarket, renderMenu, buildings, curBuilding, renderBnav, goBuilding, openWin, closeWin, renderWindow, start });
  Object.assign(u, make_win_hub(u));
  Object.assign(u, make_win_develop(u));
  Object.assign(u, make_win_staff(u));
  Object.assign(u, make_win_office(u));
  Object.assign(u, make_win_research(u));
  Object.assign(u, make_chart(u));
  Object.assign(u, make_win_market(u));
  Object.assign(u, make_win_finance(u));
  Object.assign(u, make_win_world(u));
  Object.assign(u, make_dialogs(u));
  Object.assign(u, make_system(u));

  // --- etkileşim
  root.addEventListener('click', (e) => {
    if (e.target === el.win) return closeWin();
    const row = e.target.closest('tr[data-game]');
    if (row) { app.selGame = +row.dataset.game; el.winBody.scrollTop = 0; return renderWindow(); }
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    audio.play('click');
    const g = G();
    if (b.dataset.open) return app.win && (app.win === b.dataset.open || (b.dataset.open === 'bilgisayar' && app.win !== 'gunluk')) ? closeWin() : openWin(b.dataset.open, false);
    if (b.dataset.hub) { if (b.dataset.hubsub) app.sub[b.dataset.hub] = b.dataset.hubsub; if (b.dataset.hub === 'gelistir') { app.sel = null; app.wizOn = b.dataset.hubsub === 'oyun' && !G().state.projects.length; } app.selGame = null; app.win = b.dataset.hub; app.fromHub = true; el.winBody.scrollTop = 0; renderWindow(); return renderMenu(); }
    if (b.dataset.sub) { app.sub[app.win] = b.dataset.sub; el.winBody.scrollTop = 0; return renderWindow(); }
    if (b.dataset.pick) { app.draft[b.dataset.pick] = b.dataset.id; if (b.dataset.pick === 'genre' && app.draft.sub === b.dataset.id) app.draft.sub = ''; return renderWindow(); }
    if (b.dataset.choice !== undefined) { g.resolve(+b.dataset.choice); save(); return closeDialog(); }
    const act = b.dataset.act, id = b.dataset.id, pid = +b.dataset.pid;
    const twice = (key, fn) => { if (app.confirm === key) { app.confirm = null; return run(fn()); } app.confirm = key; return render(); };
    switch (act) {
      case 'close-win': return closeWin();
      case 'sound': audio.unlock(); audio.cycle(); return renderHud();
      case 'tut-next': return u.tutNext();
      case 'tut-skip': return u.tutNext(true);
      case 'tutorial': closeWin(); return tutorial();
      case 'slot-save': return store((st) => st.getItem(id)) ? twice('save' + id, () => u.saveSlot(id)) : run(u.saveSlot(id));
      case 'slot-load': if (app.win) closeWin(); return run(u.loadSlot(id));
      case 'slot-del': return twice('del' + id, () => u.deleteSlot(id));
      case 'export': return u.exportSave();
      case 'mainmenu': return twice('menu', () => { save(); play(false); app.win = null; el.win.hidden = true; setHTML(el.winBody, ''); app.game = null; render(); setupScreen(); return { ok: true }; });
      case 'hub': app.win = 'bilgisayar'; app.fromHub = false; el.winBody.scrollTop = 0; renderWindow(); return renderMenu();
      case 'bprev': return goBuilding(-1);
      case 'bnext': return goBuilding(1);
      case 'goto': if (b.dataset.sub) app.sub[id] = b.dataset.sub; if (id === 'gelistir') { app.sel = null; app.wizOn = false; } app.win = id; app.fromHub = false; el.winBody.scrollTop = 0; renderWindow(); return renderMenu();
      case 'open-proj': app.win = 'gelistir'; app.sub.gelistir = 'oyun'; app.sel = pid; el.winBody.scrollTop = 0; renderWindow(); return renderMenu();
      case 'new-in-room': app.win = 'gelistir'; app.sub.gelistir = 'oyun'; app.sel = null; app.wizOn = true; app.wiz = 1; app.draft = { ...defaultDraft(), roomId: id }; el.winBody.scrollTop = 0; renderWindow(); return renderMenu();
      case 'hire-here': { const res = g.hire(+id); if (res.ok) { const p = g.state.staff[g.state.staff.length - 1]; g.moveStaff(p.id, +b.dataset.room); } return run(res); }
      case 'report': { const gm = g.state.games.find((x) => x.id === +id); const res = g.playerReport(+id); if (!res.ok) return run(res); app.win = 'pazar'; app.sub.pazar = 'oyunlar'; app.selGame = gm.id; el.winBody.scrollTop = 0; renderWindow(); return renderMenu(); }
      case 'close-dialog': return closeDialog();
      case 'begin': {
        const v = (q) => root.querySelector(q).value;
        return start(newGame({ companyName: v('#n-company') || 'X Project', founderName: v('#n-founder') || 'Sen', founderSpec: v('#n-spec'), difficulty: v('#n-diff'), length: +v('#n-len'), seed: +v('#n-seed') || 1976 }));
      }
      case 'continue': { const j = store((s) => s.getItem(SAVE_KEY)); if (j) start(loadGame(j)); return; }
      case 'newgame': return setupScreen();
      case 'play': return play(!app.running);
      case 'speed': app.speed = SPEEDS[(SPEEDS.indexOf(app.speed) + 1) % SPEEDS.length]; return play(app.running);
      case 'wiz': {
        if (+id > 0 && app.wiz === 2 && !app.draft.platforms.length) return note('En az bir platform seç.', 'bad');
        app.wiz = Math.max(1, Math.min(3, app.wiz + +id)); el.winBody.scrollTop = 0; return renderWindow();
      }
      case 'new': app.wizOn = true; app.wiz = 1; app.draft = null; el.winBody.scrollTop = 0; return renderWindow();
      case 'back': app.sel = null; app.wizOn = false; app.confirm = null; el.winBody.scrollTop = 0; return renderWindow();
      case 'sel': app.sel = +id; el.winBody.scrollTop = 0; return renderWindow();
      case 'back-game': app.selGame = null; el.winBody.scrollTop = 0; return renderWindow();
      case 'start': {
        const d = app.draft;
        const res = g.startProject({ ...d, roomId: d.roomId ? +d.roomId : null, engineId: d.engineId ? +d.engineId : null, sequelOf: d.sequelOf ? +d.sequelOf : null, sub: d.sub || null });
        if (!res.ok) return run(res);
        app.draft = null; app.wiz = 1; app.wizOn = false; app.sel = null;
        const resume = app.wasRunning; app.wasRunning = false; closeWin(); app.wasRunningD = resume || true;
        return phaseDialog(res.project);
      }
      case 'phase': { const pj = g.projectById(pid); if (!pj) return; if (app.win) { const r = app.wasRunning; app.wasRunning = false; closeWin(); app.wasRunningD = r; } return phaseDialog(pj); }
      case 'go-release': app.dialog = null; el.modal.hidden = true; app.sub.gelistir = 'oyun'; app.sel = pid; openWin('gelistir'); app.wasRunning = app.wasRunningD; app.wasRunningD = false; return;
      case 'release': {
        const v = (q) => root.querySelector(q)?.value;
        const res = g.release({ projectId: pid, publisherId: v('#r-model') === 'f2p' ? null : v('#r-pub') || null, price: Math.max(1, +v('#r-price') || 20), model: v('#r-model') || 'satis', monet: v('#r-monet') || 'dengeli', service: v('#r-svc') || null });
        if (!res.ok) return run(res);
        app.sel = null;
        const resume = app.wasRunning; app.wasRunning = false; closeWin(); app.wasRunningD = resume || true;
        return reviewDialog(res.game, res.review, res.report);
      }
      case 'crunch': g.toggleCrunch(); return render();
      case 'cancel': return twice('cancel' + pid, () => { app.sel = null; return g.cancelProject(pid); });
      case 'campaign': return run(g.campaign(pid, id));
      case 'outsource': return run(g.outsource(pid, +id));
      case 'localize': return run(g.localize(pid, id));
      case 'deal': return run(g.exclusiveDeal(id));
      case 'ea': return run(g.earlyAccess(pid));
      case 'crowd': return run(g.crowdfund(pid));
      case 'dlc': return run(g.releaseDLC(+id));
      case 'pass': return run(g.seasonPass(+id));
      case 'stream': return run(g.streamKeys(+id));
      case 'patch': return run(g.patch(+id));
      case 'pricedrop': return run(g.priceDrop(+id));
      case 'port': return run(g.port(+id, root.querySelector('#port-sel').value));
      case 'expansion': { const r = g.startExpansion(+id); if (!r.ok) return run(r); app.selGame = null; const resume = app.wasRunning; app.wasRunning = false; closeWin(); app.wasRunningD = resume || true; return phaseDialog(r.project); }
      case 'contract': return run(g.acceptContract(+id));
      case 'hire': return run(g.hire(+id));
      case 'fire': return twice('fire' + id, () => g.fire(+id));
      case 'raise': return run(g.raise(+id));
      case 'level': return run(g.levelUp(+id));
      case 'expand': app.expanded.has(+id) ? app.expanded.delete(+id) : app.expanded.add(+id); return renderWindow();
      case 'build': return run(g.buildRoom(id));
      case 'demolish': return twice('dem' + id, () => g.demolishRoom(+id));
      case 'office': return run(g.moveOffice());
      case 'stations': return run(g.upgradeStations());
      case 'research': return run(g.startResearch(id));
      case 'engine': { const r = g.buildEngine(app.engineName || 'Motor', [...app.engineSel]); if (r.ok) app.engineSel.clear(); return run(r); }
      case 'licence': return run(g.toggleLicence(+id));
      case 'console': { const r = g.startConsole({ ...app.consoleDraft, parts: { ...app.consoleDraft.parts } }); if (r.ok) app.consoleDraft.series = String(r.console.seriesId); return run(r); }
      case 'ctype': app.consoleDraft.type = id; return renderWindow();
      case 'loan': return run(g.takeLoan(+id));
      case 'acquire': return run(g.acquireRival(+id));
      case 'vacation': return run(g.sendVacation(+id));
      case 'vacpol': return run(g.setVacationPolicy(id));
      case 'design': return run(g.setDesign(b.dataset.b, id));
      case 'ipo': return run(g.goPublic(+id));
      case 'dividend': return run(g.dividend());
      case 'buyback': return run(g.buyback());
    }
  });
  root.addEventListener('change', (e) => {
    const t = e.target, g = G();
    if (t.dataset.import && t.files?.[0]) { u.importSave(t.files[0]); t.value = ''; return; }
    if (!g) return;
    if (t.dataset.draft) { app.draft[t.dataset.draft] = t.value; if (t.dataset.draft !== 'name') { t.blur(); renderWindow(); } return; }
    if (t.dataset.region) { const set = new Set(app.draft.regions); t.checked ? set.add(t.dataset.region) : set.delete(t.dataset.region); app.draft.regions = [...set]; return; }
    if (t.dataset.plat) { const set = new Set(app.draft.platforms); t.checked ? set.add(t.dataset.plat) : set.delete(t.dataset.plat); app.draft.platforms = [...set]; return; }
    if (t.dataset.feat) { t.checked ? app.engineSel.add(t.dataset.feat) : app.engineSel.delete(t.dataset.feat); return; }
    if (t.dataset.eng) { app.engineName = t.value; return; }
    if (t.dataset.con) { app.consoleDraft[t.dataset.con] = t.value; if (t.dataset.con !== 'seriesName') { t.blur(); renderWindow(); } return; }
    if (t.dataset.cpart) { app.consoleDraft.parts[t.dataset.cpart] = t.value; t.blur(); return renderWindow(); }
    const id = +t.dataset.id;
    if (t.dataset.act === 'move') { t.blur(); return run(g.moveStaff(id, +t.value)); }
    if (t.dataset.act === 'mode') { t.blur(); return run(g.setRoomMode(id, t.value)); }
    if (t.dataset.act === 'target') { t.blur(); return run(g.setRoomTarget(id, t.value ? +t.value : null)); }
    if (t.dataset.act === 'train' && t.value) { t.blur(); return run(g.train(id, t.value)); }
    if (t.dataset.act === 'career' && t.value) { t.blur(); return run(g.changeCareer(id, t.value)); }
  });
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.alloc !== undefined) { G().setAlloc(app.dlgPid, +t.dataset.alloc, +t.value); updatePhasePct(); }
    if (t.dataset.vol) { audio.set(t.dataset.vol, +t.value / 100); const b = t.parentElement.querySelector('b'); if (b) b.textContent = t.value; renderHud(); }
    if (t.dataset.draft === 'name') app.draft.name = t.value;
    if (t.dataset.con === 'seriesName') app.consoleDraft.seriesName = t.value;
  });
  document.addEventListener('keydown', (e) => {
    if (!G()) return;
    if (e.key === 'Escape' && u.tutorialOpen()) return u.tutNext(true);
    if (e.key === 'Escape' && app.win) return closeWin();
    if (e.key === ' ' && !blocked() && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName || '')) { e.preventDefault(); play(!app.running); }
  });

  requestAnimationFrame(loop);
  fit();
  const fresh = (j) => { try { return JSON.parse(j).version >= 2; } catch { return false; } };
  if (hotData.save && fresh(hotData.save)) start(loadGame(hotData.save));
  else setupScreen();
}
