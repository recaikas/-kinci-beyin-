// Arayüz (GDT/Kairosoft esinli): tam ekran sahne, üstte HUD ve proje sayacı, altta ikonlu menü,
// menüden açılan pencereler (açıkken oyun durur), adım adım yeni oyun sihirbazı, faz başında dağılım
// penceresi, yayında eleştirmen ekranı. Oyun mantığı game.js'te; burası yalnızca çağırır ve gösterir.
import { newGame, loadGame, M, Staff, Co, Charts, Engines, Crew } from '../game.js';
import { PACK } from '../data/pack.js';
import { menuIcon } from './icons.js';
import { makeOfficeRenderer } from '../office/renderer.js';
import { FURNITURE } from '../systems/office.js';
import { money } from '../kernel.js';
import { SAVE_KEY, esc, fmt, pct, bar, discName, SPEEDS, kaosLabel, store, WIN_NAMES, ICON_OF, SUBS, move } from './util.js';
import * as Menu from './menu.js';
import { make as make_win_hub } from './win_hub.js';
import { make as make_win_develop } from './win_develop.js';
import { make as make_win_staff } from './win_staff.js';
import { make as make_win_office } from './win_office.js';
import { make as make_win_research } from './win_research.js';
import { make as make_chart } from './chart.js';
import { make as make_win_market } from './win_market.js';
import { make as make_win_pub } from './win_pub.js';
import { make as make_win_regions } from './win_regions.js';
import { make as make_win_genres } from './win_genres.js';
import { make as make_win_engines } from './win_engines.js';
import { make as make_win_platform } from './win_platform.js';
import { make as make_kmenu } from './kmenu.js';
import { make as make_win_finance } from './win_finance.js';
import { make as make_win_world } from './win_world.js';
import { make as make_dialogs } from './dialogs.js';
import { make as make_system } from './system.js';
import { makeAudio } from './audio.js';


export function boot(root, hotData = {}) {
  const app = {
    game: null, running: false, speed: 1, timer: null, win: null, sub: {}, wasRunning: false, wasRunningD: false, dialog: null,
    editOffice: false, officeEditInfo: null,
    draft: null, wiz: 1, engineSel: new Set(), engineName: 'Motor', consoleDraft: { type: 'konsol', series: 'yeni', seriesName: 'X Kutu', price: 'normal', parts: {} },
    confirm: null, expanded: new Set(), seenNews: 0, phaseSeen: {}, readySeen: {}, sel: null, selGame: null, wizOn: false, dlgPid: null, charts: {},
  };
  const $ = (id) => root.querySelector(id);
  const el = { pop: $('#kpop'), bnav: $('#bnav'), market: $('#market'), stage: $('#stage'), canvas: $('#scene'), hud: $('#hud'), menu: $('#menu'), notes: $('#notes'), win: $('#win'), winTitle: $('#win-title'), winBody: $('#win-body'), modal: $('#modal') };
  el.officeTools = $('#office-tools');
  const R = makeOfficeRenderer(el.canvas, {
    view: () => ({ game: app.game, building: app.game ? curBuilding().id : 'ana', paused: !app.running || !!blocked(), speed: app.speed,
      editing: app.editOffice, blocked: !!(app.win || app.dialog || !el.modal.hidden || u.tutorialOpen?.()) }),
    onHit: (h) => officeHit(h),
    onEditChange: (info) => { app.officeEditInfo = info; renderOfficeTools(); },
    onPlace: (roomId, item) => { const res = G().placeFurniture(roomId, item); if (res.ok) save(); else note(res.msg, 'bad'); return res; },
    onRemove: (roomId, id) => { const res = G().removeFurniture(roomId, id); if (res.ok) save(); else note(res.msg, 'bad'); return res; },
    onMessage: (text) => note(text, 'warn'), onReady: () => fit(),
  });
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

  // Phaser kamerayı ölçekler; dünya koordinatları ve eşya konumları değişmez.
  function fit() {
    const r = el.stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    R.resize(r.width, r.height);
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
    renderOfficeTools();
  }
  const blocked = () => app.editOffice || app.win || app.pop || app.dialog || !el.modal.hidden || u.tutorialOpen?.();
  function step() {
    const g = G();
    if (!g || blocked()) return;
    if (g.state.pending.length || g.state.gameOver) return showEvent();
    const before = g.state.news[0];
    g.tick();
    Menu.check(g); // Konu F: yeni açılan seçenekler günlüğe düşer
    audio.setEra(M.tableYear(g.ctx), g.state.kaos);
    if (g.state.week % 4 === 0) save();
    for (const n of g.state.news) { if (n === before) break; if (n.type !== 'info') note(n.t, n.type); }
    render();
    if (g.state.pending.length || g.state.gameOver) return showEvent();
    for (const pj of g.state.projects) {
      if (pj.status === 'dev' && app.phaseSeen[pj.id] !== pj.phase) { if (Crew.devAuto(g.ctx, pj)) { app.phaseSeen[pj.id] = pj.phase; note(`🎖️ Geliştirme müdürü "${pj.name}" için faz dağılımını ayarladı.`, 'info'); continue; } return phaseDialog(pj); }
      if (pj.status === 'debug' && !app.readySeen[pj.id]) return readyDialog(pj);
    }
  }
  function render() {
    renderHud();
    renderMarket();
    renderBnav();
    renderMenu();
    renderOfficeTools();
    if (app.pop) u.renderPop();
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
    const key = pj ? `p${pj.id}:${s.projects.length}` : best ? `s${best.id}:${best.rank}:${best.lastWeek}:${s.mkt?.total}` : 'none';
    const bl = best && Charts.rankLabel(G().ctx, best);
    if (slot.dataset.key !== key) {
      slot.dataset.key = key;
      slot.innerHTML = pj ? `<button class="proj" data-open="gelistir"><span class="pname"></span>${s.projects.length > 1 ? `<em class="more">+${s.projects.length - 1} proje</em>` : ''}<span class="counters">${['oyn', 'gfx', 'ses', 'tek'].map((d) => `<b class="num c-${d}" title="${discName(d)}" data-d="${d}"></b>`).join('')}<b class="num c-bug" title="Hata" data-d="bug"></b></span><span class="bar prog"><i></i></span></button>`
        : best ? `<button class="proj sale" data-open="gelistir"><span class="pname">Satışta: ${esc(best.name)}</span><span class="rk ${bl.cls}">${bl.text} ${bl.cls === 'off' ? '' : move({ rank: best.rank, prev: best.prevRank })}</span><small class="muted">${fmt(best.lastWeek)} kopya bu hafta · ${esc(bl.sub)}</small></button>`
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
    const c = G().ctx;
    const cards = live.map((g) => {
      const cost = (g.devCost || 0) + (g.postCost || 0), profit = g.revenue - cost;
      const lb = g.model === 'f2p' ? { text: '🆓', cls: 'mid', sub: 'ücretsiz oyun · oynananlar listesinde' } : Charts.rankLabel(c, g);
      const stock = g.printed ? ` · stok ${fmt(g.stock || 0)}${g.printQ?.length ? '+' : ''}` : '';
      return `<button class="mcard" data-mgame="${g.id}" title="${esc(g.name)}">
        <span class="rk ${lb.cls}">${lb.text}</span><span class="nm">${esc(g.name)}</span><span class="wk">${g.weeks}. hf ${lb.cls === 'off' ? '' : move({ rank: g.rank, prev: g.prevRank })}</span>
        <span class="lsub">${esc(Charts.curveWord(c, g))} · ${esc(lb.sub)}${stock}</span>
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

  // --- alt menü (Konu F): Kairosoft gibi başlıklar. Başlığın içinde seçenekler, seçeneğin içinde ekran; kapalı olanlar saklı.
  const icons = Object.fromEntries([...Object.keys(WIN_NAMES), ...Menu.CATS.map((k) => k.icon), 'kaydet'].map((id) => [id, menuIcon(ICON_OF[id] || id)]));
  Object.assign(u, { icons });
  // Konu H: alt çubuk Kairosoft gibi sade: Kaydet · Günlük · Menü (menü kurucunun açılır menüsünü açar).
  function renderMenu() {
    const g = G(), s = g?.state;
    if (!s) return;
    if (!el.menu.children.length) el.menu.innerHTML = [['ksave', 'Kaydet', 'kaydet'], ['knews', 'Günlük', 'gunluk'], ['kmenu', 'Menü', 'bilgisayar']].map(([a, n, ic]) => `<button data-act="${a}"><img src="${icons[ic] || icons.bilgisayar}" alt=""><span>${n}</span><em class="badge" hidden></em></button>`).join('');
    const unread = Math.max(0, s.news.length - app.seenNews);
    const alert = s.projects.some((p) => p.status === 'debug') || s.staff.some((p) => p.status === 'tukenmis') || Co.company(s).pressure >= PACK.ipo.boardAt;
    const badge = { knews: unread ? String(Math.min(unread, 99)) : '', kmenu: alert ? '!' : Menu.anyNew(g.ctx, s) ? 'YENİ' : '' };
    for (const b of el.menu.children) {
      const id = b.dataset.act, em = b.querySelector('.badge'), txt = badge[id] || '';
      b.classList.toggle('on', (id === 'kmenu' && !!app.pop) || (id === 'knews' && app.win === 'gunluk'));
      em.hidden = !txt; em.classList.toggle('new', txt === 'YENİ');
      if (em.textContent !== txt) em.textContent = txt;
    }
  }
  function openItem(id) {
    const it = Menu.ITEM[id];
    if (!it) return;
    const s = G().state, ui = Menu.uiState(s);
    ui.seen[id] = 1;
    if (!app.win) app.wasRunning = app.running;
    app.cat = it.cat; app.fromCat = it.cat; app.item = id; app.fromHub = false; app.confirm = null; app.leaf = true;
    if (it.sub) app.sub[it.win] = it.sub;
    if (it.win === 'gelistir') { app.sel = null; app.wizOn = !!it.wizard && G().freeDevRooms().length > 0; if (app.wizOn) app.wiz = 1; }
    if (it.win === 'pazar') app.selGame = null;
    if (it.win === 'gunluk') app.seenNews = s.news.length;
    app.win = it.win; el.win.hidden = false; play(false);
    el.winBody.scrollTop = 0; renderWindow(); renderMenu();
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
  // Phaser girdi olayları: boş zeminde sürükleme kamerayı taşır; bina okları korunur.
  function officeHit(h) {
    if (!G() || !h) return;
    if (app.pop) return u.closePop(); // açık menü: sahneye dokunmak kapatır
    if (!h) return;
    if (h.kind === 'boss') return u.openPop({ kind: 'founder', cat: null }); // Konu H: ana karakter → Kairosoft menüsü
    if (h.kind === 'slot') { app.buildFor = h.building; return openWin('insaat'); }
    if (h.kind === 'locked') return openWin('ofis');
    u.openPop({ kind: 'room', roomId: h.room || h.id, personId: h.kind === 'person' ? h.id : null }); // departman menüsü
  }

  function renderOfficeTools() {
    el.officeTools.hidden = !G();
    el.stage.classList.toggle('paused', !!G() && !app.editOffice && (!app.running || !!blocked()) && !app.win);
    if (!G()) return;
    const edit = el.officeTools.querySelector('[data-office=edit]');
    edit.setAttribute('aria-pressed', String(app.editOffice)); edit.textContent = app.editOffice ? '✓ Düzenlemeyi bitir' : 'Ofisi düzenle';
    el.officeTools.querySelector('.office-edit').hidden = !app.editOffice;
    if (!app.editOffice) return;
    const info = app.officeEditInfo, draft = info?.draft;
    const select = el.officeTools.querySelector('[data-office-room]');
    const options = (info?.rooms || []).map((r) => `<option value="${r.roomId}">${esc(Staff.roomType(ctx(), G().state.rooms.find((x) => x.id === r.roomId).type).name)} #${r.roomId}</option>`).join('');
    setHTML(select, options); if (info?.roomId != null) select.value = String(info.roomId);
    const status = el.officeTools.querySelector('output');
    status.textContent = draft ? `${FURNITURE[draft.type].name} · ${info.valid?.ok ? 'Yerleştirmeye uygun' : info.valid?.msg || ''}` : info?.rooms.length ? 'Eşyaya dokun, sürükle ve Yerleştir ile onayla.' : 'Önce bu binada bir oda kur.';
    status.classList.toggle('invalid', !!draft && !info.valid?.ok);
    for (const b of el.officeTools.querySelectorAll('[data-office=rotate], [data-office=cancel]')) b.disabled = !draft;
    el.officeTools.querySelector('[data-office=confirm]').disabled = !draft || !info.valid?.ok;
    const model = G().state.rooms.find((r) => r.id === info?.roomId);
    el.officeTools.querySelector('[data-office=remove]').disabled = !draft?.id || !FURNITURE[draft.type]?.removable || draft.type === 'sofa' && model?.type === 'mola';
    for (const b of el.officeTools.querySelectorAll('[data-office=add]')) b.disabled = !info?.rooms.length;
  }
  function endOfficeEdit() {
    if (!app.editOffice) return;
    app.editOffice = false; R.setEditing();
    if (app.editWasRunning && !blocked()) play(true);
    renderOfficeTools();
  }
  function officeAction(action, value) {
    if (!G()) return;
    if (action === 'edit') {
      if (app.editOffice) return endOfficeEdit();
      if (app.win || app.dialog || u.tutorialOpen()) return;
      if (app.pop) u.closePop();
      app.editWasRunning = app.running; app.editOffice = true; play(false); R.setEditing(); return renderOfficeTools();
    }
    if (action === 'zoom-in') return R.zoom(1.2);
    if (action === 'zoom-out') return R.zoom(1 / 1.2);
    if (action === 'fit') return R.fit();
    R.action(action, value);
  }

  // --- pencereler
  function openWin(id, fromHub = false) {
    if (!app.win) app.wasRunning = app.running;
    app.fromHub = fromHub; app.win = id; app.confirm = null; app.leaf = false; app.fromCat = null; app.item = null; app.popBack = null;
    if (id === 'gunluk') app.seenNews = G().state.news.length;
    el.win.hidden = false;
    play(false);
    renderWindow(); renderMenu();
    el.winBody.scrollTop = 0;
  }
  function closeWin() {
    app.win = null; app.fromCat = null; app.item = null; app.leaf = false; el.win.hidden = true;
    renderMenu();
    if (app.wasRunning && !app.dialog) play(true);
  }
  function renderWindow() {
    if (!app.win || !G()) return;
    const id = app.win;
    const subs = SUBS[id]?.filter(([k]) => Menu.tabVisible(ctx(), G().state, id, k)); // Konu F: kapalı sekmeler saklı
    if (subs && !subs.some(([k]) => k === app.sub[id])) app.sub[id] = subs[0]?.[0];
    const sub = app.sub[id] || subs?.[0]?.[0];
    const fn = { platform: (s) => u.winPlatform(s), hisse: (s) => u.winStakes(s), dunya: winWorld, bilgisayar: winHub, oda: winRoom, insaat: winBuild, reklam: winAds, gelistir: winDevelop, personel: winStaff, ofis: winOffice, arge: winResearch, pazar: winMarket, finans: winFinance, gunluk: winNews, ayarlar: winSettings }[id];
    const cat = Menu.CATS.find((k) => k.id === app.cat), item = app.item && Menu.ITEM[app.item];
    const from = app.popBack?.kind === 'room' ? (() => { const r = G().state.rooms.find((x) => x.id === app.popBack.roomId); return r ? Staff.roomType(ctx(), r.type).name : null; })() : cat?.name;
    const crumb = id === 'kat' && cat ? cat.name : app.fromCat && item && item.win === id && from ? `${from} › ${item.name}` : null;
    const title = crumb || (id === 'oda' ? (() => { const r = G().state.rooms.find((x) => x.id === app.room); return r ? Staff.roomType(ctx(), r.type).name : 'Oda'; })() : WIN_NAMES[id]);
    const back = app.fromCat && id !== 'kat' ? `<button class="back" data-act="cat-back" aria-label="${esc(from || '')} menüsüne dön">◀</button>` : app.fromHub && id !== 'bilgisayar' ? '<button class="back" data-act="hub" aria-label="Bilgisayara dön">◀</button>' : '';
    setHTML(el.winTitle, `${back}<img src="${icons[id === 'kat' && cat ? cat.icon : id] || icons.bilgisayar}" alt=""> ${esc(title)}`);
    const note1 = item && item.first && item.win === id && !Menu.uiState(G().state).notes[item.id] ? `<div class="firstnote"><span>ℹ️ ${esc(item.first)}</span><button class="mini" data-act="note-ok" data-id="${item.id}">Tamam</button></div>` : '';
    const tabs = subs && !app.leaf ? `<div class="seg" role="tablist">${subs.map(([k, n]) => `<button role="tab" data-sub="${k}" aria-selected="${sub === k}" class="${sub === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : '';
    const top = el.winBody.scrollTop;
    setHTML(el.winBody, note1 + tabs + fn(sub));
    el.winBody.scrollTop = top;
  }

  function start(game) {
    app.editOffice = false; app.officeEditInfo = null; app.bIdx = 0;
    app.game = game; app.draft = null; app.wiz = 1; app.engineSel = new Set(); app.seenNews = game.state.news.length;
    app.phaseSeen = Object.fromEntries(game.state.projects.map((p) => [p.id, p.phase])); app.readySeen = Object.fromEntries(game.state.projects.filter((p) => p.status === 'debug').map((p) => [p.id, true]));
    app.sel = null; app.selGame = null; app.wizOn = false; app.cat = null; app.fromCat = null; app.item = null;
    Menu.check(game); el.menu._sig = null;
    app.dialog = null; app.wasRunningD = false; el.modal.hidden = true; el.modal.innerHTML = '';
    fit(); render();
    play(true);
    if (game.state.pending.length) return showEvent();
    const fresh = !game.state.projects.length && !game.state.games.length;
    const wizard = () => { app.sub.gelistir = 'oyun'; app.wizOn = true; openWin('gelistir'); app.leaf = true; renderWindow(); };
    if (fresh && !u.tutorialSeen()) return tutorial(() => { app.wasRunning = true; wizard(); });
    if (fresh) wizard();
  }

  Object.assign(u, { setHTML, save, fit, note, run, play, step, render, renderHud, signed, profitSpark, panelOpen, renderMarket, renderMenu, buildings, curBuilding, renderBnav, goBuilding, openWin, closeWin, renderWindow, start });
  Object.assign(u, make_win_hub(u));
  Object.assign(u, make_win_develop(u));
  Object.assign(u, make_win_staff(u));
  Object.assign(u, make_win_office(u));
  Object.assign(u, make_win_research(u));
  Object.assign(u, make_chart(u));
  Object.assign(u, make_win_market(u));
  Object.assign(u, make_win_pub(u));
  Object.assign(u, make_win_regions(u));
  Object.assign(u, make_win_genres(u));
  Object.assign(u, make_win_engines(u));
  Object.assign(u, make_win_platform(u));
  Object.assign(u, make_kmenu(u));
  Object.assign(u, make_win_finance(u));
  Object.assign(u, make_win_world(u));
  Object.assign(u, make_dialogs(u));
  Object.assign(u, make_system(u));

  // --- etkileşim
  root.addEventListener('click', (e) => {
    const officeButton = e.target.closest('[data-office]');
    if (officeButton) { if (!officeButton.disabled) officeAction(officeButton.dataset.office, officeButton.dataset.value); return; }
    if (e.target === el.win) return closeWin();
    const row = e.target.closest('tr[data-game]');
    if (row) { app.selGame = +row.dataset.game; el.winBody.scrollTop = 0; return renderWindow(); }
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    endOfficeEdit();
    audio.play('click');
    const g = G();
    if (b.dataset.pcat) { app.pop.cat = app.pop.cat === b.dataset.pcat ? null : b.dataset.pcat; return u.renderPop(); }
    if (b.dataset.open) { u.closePop(); app.fromCat = null; app.item = null; }
    if (b.dataset.open) return app.win && (app.win === b.dataset.open || (b.dataset.open === 'bilgisayar' && app.win !== 'gunluk')) ? closeWin() : openWin(b.dataset.open, false);
    if (b.dataset.hub) { if (b.dataset.hubsub) app.sub[b.dataset.hub] = b.dataset.hubsub; if (b.dataset.hub === 'gelistir') { app.sel = null; app.wizOn = b.dataset.hubsub === 'oyun' && !G().state.projects.length; } app.selGame = null; app.win = b.dataset.hub; app.fromHub = true; el.winBody.scrollTop = 0; renderWindow(); return renderMenu(); }
    if (b.dataset.sub) { const mi = app.fromCat && Menu.ITEMS.find((it) => it.win === app.win && it.sub === b.dataset.sub); if (mi) app.item = mi.id; app.sub[app.win] = b.dataset.sub; el.winBody.scrollTop = 0; return renderWindow(); }
    if (b.dataset.pick) { app.draft[b.dataset.pick] = b.dataset.id; if (b.dataset.pick === 'genre' && app.draft.sub === b.dataset.id) app.draft.sub = ''; return renderWindow(); }
    if (b.dataset.choice !== undefined) { g.resolve(+b.dataset.choice); save(); return closeDialog(); }
    const act = b.dataset.act, id = b.dataset.id, pid = +b.dataset.pid;
    const twice = (key, fn) => { if (app.confirm === key) { app.confirm = null; return run(fn()); } app.confirm = key; return render(); };
    switch (act) {
      case 'close-win': return closeWin();
      case 'mi': { if (!app.pop) return openItem(id); app.popBack = { ...app.pop }; const was = app.popWas; app.pop = null; u.renderPop(); openItem(id); app.wasRunning = was; return; }
      case 'cat-back': { const back = app.popBack || { kind: 'founder', cat: app.cat }; const was = app.wasRunning; closeWin(); u.openPop(back); app.popWas = was; return; }
      // Konu H: Kairosoft açılır menüsü, departmanlar, müdürler
      case 'kmenu': return app.pop?.kind === 'founder' ? u.closePop() : u.openPop({ kind: 'founder', cat: null });
      case 'ksave': save(); return note('💾 Kaydedildi.', 'good');
      case 'knews': u.closePop(); return app.win === 'gunluk' ? closeWin() : openWin('gunluk');
      case 'pclose': return u.closePop();
      case 'pdept': { const r = g.state.rooms.find((x) => x.id === +id); if (r) { const bi = buildings().findIndex((bb) => bb.types.includes(r.type)); if (bi >= 0) { app.bIdx = bi; renderBnav(); } } return u.openPop({ kind: 'room', roomId: +id }); }
      case 'proom': { const was = app.popWas; app.pop = null; u.renderPop(); app.room = +id; openWin('oda'); app.wasRunning = was; return; }
      case 'pmgr': app.pop.sub = app.pop.sub === 'mgr' ? null : 'mgr'; return u.renderPop();
      case 'setmgr': { const r = g.setManager(+id, b.dataset.pid ? +b.dataset.pid : null); if (app.pop) app.pop.sub = null; run(r); return u.renderPop(); }
      case 'pauto': { const r = g.state.rooms.find((x) => x.id === +id); run(g.setAuto(+id, !r?.auto)); return u.renderPop(); }
      case 'buylic': return run(g.buyLicense(id));
      case 'tease': { const it = Menu.ITEM[id]; return note(`🔒 ${it.hint}`, 'info'); }
      case 'note-ok': Menu.uiState(g.state).notes[id] = 1; return renderWindow();
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
      case 'open-proj': case 'new-in-room': {
        const fromPop = !!app.pop, was = app.popWas;
        if (fromPop) { app.popBack = { ...app.pop }; app.pop = null; u.renderPop(); }
        app.sub.gelistir = 'oyun';
        if (act === 'open-proj') { app.sel = pid; app.wizOn = false; } else { app.sel = null; app.wizOn = true; app.wiz = 1; app.draft = { ...defaultDraft(), roomId: id }; }
        if (!app.win) { openWin('gelistir'); if (fromPop) app.wasRunning = was; } else { app.win = 'gelistir'; el.winBody.scrollTop = 0; renderWindow(); renderMenu(); }
        app.leaf = true; return renderWindow();
      }
      case 'hire-here': { const res = g.hire(+id); if (res.ok) { const p = g.state.staff[g.state.staff.length - 1]; g.moveStaff(p.id, +b.dataset.room); } return run(res); }
      case 'report': { const gm = g.state.games.find((x) => x.id === +id); const res = g.playerReport(+id); if (!res.ok) return run(res); app.win = 'pazar'; app.sub.pazar = 'oyunlar'; app.selGame = gm.id; el.winBody.scrollTop = 0; renderWindow(); return renderMenu(); }
      case 'close-dialog': return closeDialog();
      case 'begin': {
        const v = (q) => root.querySelector(q).value;
        return start(newGame({ companyName: v('#n-company') || 'X Project', founderName: v('#n-founder') || 'Sen', founderSpec: v('#n-spec'), difficulty: v('#n-diff'), length: +v('#n-len'), seed: +v('#n-seed') || 1976, home: v('#n-home') || 'na', background: v('#n-bg') || 'salon' }));
      }
      case 'continue': { const j = store((s) => s.getItem(SAVE_KEY)); if (j) start(loadGame(j)); return; }
      case 'newgame': return setupScreen();
      case 'play': return play(!app.running);
      case 'speed': app.speed = SPEEDS[(SPEEDS.indexOf(app.speed) + 1) % SPEEDS.length]; return play(app.running);
      case 'wiz': {
        if (+id > 0 && app.wiz === 2 && !app.draft.platforms.length) return note('En az bir platform seç.', 'bad');
        app.wiz = Math.max(1, Math.min(4, app.wiz + +id));
        if (app.wiz === 3 && !u.hasTechStep()) app.wiz += +id; // Konu H: seçilecek motor yoksa teknoloji adımı atlanır
        el.winBody.scrollTop = 0; return renderWindow();
      }
      case 'new': app.wizOn = true; app.wiz = 1; app.draft = null; el.winBody.scrollTop = 0; return renderWindow();
      case 'back': app.sel = null; app.wizOn = false; app.confirm = null; el.winBody.scrollTop = 0; return renderWindow();
      case 'sel': app.sel = +id; el.winBody.scrollTop = 0; return renderWindow();
      case 'back-game': app.selGame = null; el.winBody.scrollTop = 0; return renderWindow();
      case 'start': {
        const d = app.draft;
        const res = g.startProject({ ...u.draftPj(d), roomId: d.roomId ? +d.roomId : null, sequelOf: d.sequelOf ? +d.sequelOf : null, sub: d.sub || null });
        if (!res.ok) return run(res);
        app.draft = null; app.wiz = 1; app.wizOn = false; app.sel = null;
        const resume = app.wasRunning; app.wasRunning = false; closeWin(); app.wasRunningD = resume || true;
        return phaseDialog(res.project);
      }
      case 'phase': { const pj = g.projectById(pid); if (!pj) return; if (app.win) { const r = app.wasRunning; app.wasRunning = false; closeWin(); app.wasRunningD = r; } return phaseDialog(pj); }
      case 'go-release': app.dialog = null; el.modal.hidden = true; app.sub.gelistir = 'oyun'; app.sel = pid; openWin('gelistir'); app.wasRunning = app.wasRunningD; app.wasRunningD = false; return;
      case 'release': {
        const v = (q) => root.querySelector(q)?.value;
        if (v('#r-pub') === 'kelepir' && v('#r-model') !== 'f2p' && app.confirm !== 'kelepir' + pid) { app.confirm = 'kelepir' + pid; note('Kelepir satış: oyunu küçük bir peşin paraya satarsın ve telif almazsın. Onaylamak için Yayınla\'ya tekrar bas.', 'warn'); return render(); }
        const res = g.release({ projectId: pid, publisherId: v('#r-model') === 'f2p' ? null : v('#r-pub') || null, price: Math.max(1, +v('#r-price') || 20), model: v('#r-model') || 'satis', monet: v('#r-monet') || 'dengeli', service: v('#r-svc') || null, printRun: v('#r-print') || 'normal' });
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
      case 'ea': return run(g.earlyAccess(pid));
      case 'crowd': return run(g.crowdfund(pid));
      case 'dlc': return run(g.releaseDLC(+id));
      case 'pass': return run(g.seasonPass(+id));
      case 'stream': return run(g.streamKeys(+id));
      case 'patch': return run(g.patch(+id));
      case 'pricedrop': return run(g.priceDrop(+id));
      case 'budget': return run(g.budgetLine(+id));
      case 'shelfpay': return run(g.shelfPay(+id));
      case 'festival': return run(g.festival(+id));
      case 'bulk': return twice('bulk' + id, () => g.bulkBuy(+id));
      case 'cover': return run(g.buyCover(+id));
      case 'reprint': return run(g.reprint(+id));
      case 'printauto': return run(g.printAuto(+id));
      case 'announce': return run(g.announce(pid, +id));
      // Bölgeler (Konu C)
      case 'buynet': return run(g.buyNet(id));
      // Konu D: türler
      case 'focus': { const r = g.focusGroup(app.draft || {}); if (r.ok) app.focusLine = r.line; return run(r); }
      case 'idea': { const it = g.state.ideas.find((x) => x.id === +id); if (!it) return; Object.assign(app.draft ||= u.defaultDraft(), { topic: it.topic, genre: it.genre, sub: it.sub }); g.state.ideas = g.state.ideas.filter((x) => x !== it); return renderWindow(); }
      case 'invent': return run(g.invent(id));
      case 'gtree': app.gtree = id; return renderWindow();
      case 'loclv': return run(g.localizeLevel(pid, id, +b.dataset.lv));
      case 'gloc': return run(g.localizeGame(+id, b.dataset.regionId, 1));
      // Yayıncılar (Konu B)
      case 'pubpick': { const list = ((app.pubSel ||= {})[pid] ||= []); const i = list.indexOf(id); if (i >= 0) list.splice(i, 1); else if (list.length < PACK.publishing.maxPitches) list.push(id); app.pubOpen = pid; return renderWindow(); }
      case 'pubfilter': app.pubFilter = id; return renderWindow();
      case 'pubdoc': app.pubDoc = !(app.pubDoc ?? true); return renderWindow();
      case 'pubnote': app.pubNote = !(app.pubNote ?? false); return renderWindow();
      case 'pitch': { const r = g.pitch(pid, (app.pubSel || {})[pid] || [], { mode: b.dataset.mode, doc: app.pubDoc ?? true, note: app.pubNote ?? false }); if (r.ok) app.pubSel[pid] = []; return run(r); }
      case 'osign': return run(g.signOffer(+id));
      case 'odecline': return run(g.declineOffer(+id));
      case 'oneg': return run(g.negotiate(+id, b.dataset.move));
      case 'oauction': return run(g.auction(pid));
      case 'ochange': return run(g.acceptChange(+id, b.dataset.yes === '1'));
      case 'agent': return run(g.hireAgent(id));
      case 'agentfire': return twice('agentfire', () => g.fireAgent());
      case 'buyrights': return twice('rights' + id, () => g.buyRights(+id));
      case 'orderdraft': { const d = g.orderDraft(+id); if (!d) return; app.draft = { ...u.defaultDraft(), ...d }; app.sub.gelistir = 'oyun'; app.sel = null; app.wizOn = true; app.wiz = 1; app.win = 'gelistir'; el.winBody.scrollTop = 0; renderWindow(); return renderMenu(); }
      case 'ltab': app.listTab = { kind: id, key: null }; return renderWindow();
      case 'lkey': app.listTab = { ...(app.listTab || { kind: 'genel' }), key: id }; return renderWindow();
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
      case 'engine': { const fams = Engines.families(g.ctx).sort((a, b) => b.builtYear - a.builtYear); const from = app.engFrom === 'yeni' ? null : fams.find((e) => String(e.id) === String(app.engFrom)) || fams[0] || null;
        const r = g.buildEngine(app.engineName || 'Motor', [...app.engineSel], from?.id ?? null); if (r.ok) app.engineSel.clear(); return run(r); }
      case 'tech': return run(g.startTech(id));
      // Konu G: platform, anlaşmalar, hisseler
      case 'prate': return run(g.setPlatRate(+id));
      case 'pcart': return run(g.toggleCart());
      case 'deal': return run(g.signDeal(+id, b.dataset.type));
      case 'stake': return run(g.buyStake(+id, +b.dataset.to));
      case 'sellstake': return twice('sell' + id, () => g.sellStake(+id));
      case 'policy': return run(g.setPolicy(+id, b.dataset.pol));
      case 'boost': return run(g.setBoost(+id, +b.dataset.lv));
      case 'order': return run(g.orderGame(+id, (app.order || {})[+id] || {}));
      case 'merge': return twice('merge' + id, () => g.mergeStudio(+id));
      case 'weng': u.onWeng(id); return renderWindow();
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
    if (e.target.matches('[data-office-room]')) return R.action('room', e.target.value);
    const t = e.target, g = G();
    if (t.dataset.import && t.files?.[0]) { u.importSave(t.files[0]); t.value = ''; return; }
    if (!g) return;
    if (t.dataset.draft) { app.draft[t.dataset.draft] = t.value; if (t.dataset.draft !== 'name') { t.blur(); renderWindow(); } return; }
    if (t.dataset.region) { const set = new Set(app.draft.regions); t.checked ? set.add(t.dataset.region) : set.delete(t.dataset.region); app.draft.regions = [...set]; return; }
    if (t.dataset.plat) { const set = new Set(app.draft.platforms); t.checked ? set.add(t.dataset.plat) : set.delete(t.dataset.plat); app.draft.platforms = [...set]; return; }
    if (t.dataset.feat) { t.checked ? app.engineSel.add(t.dataset.feat) : app.engineSel.delete(t.dataset.feat); return; }
    if (t.dataset.eng) { app.engineName = t.value; return; }
    if (t.dataset.mgr) { t.blur(); return run(g.setManager(+t.dataset.mgr, t.value ? +t.value : null)); }
    if (t.dataset.order) { (((app.order ||= {})[+t.dataset.id]) ||= {})[t.dataset.order] = t.value; t.blur(); return renderWindow(); }
    if (t.dataset.engfrom) { app.engFrom = t.value; app.engineSel.clear(); t.blur(); return renderWindow(); }
    if (t.dataset.wfeat) { u.onWfeat(t.dataset.wfeat, t.checked); return renderWindow(); }
    if (t.dataset.wmw) { u.onWmw(t.dataset.wmw, t.checked); return renderWindow(); }
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
    if (app.editOffice && e.key === 'Escape') { e.preventDefault(); return endOfficeEdit(); }
    if (app.editOffice && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) {
      if (e.key.toLowerCase() === 'r') { e.preventDefault(); return R.action('rotate'); }
      if (e.key === 'Enter') { e.preventDefault(); return R.action('confirm'); }
    }
    if (e.key === 'Escape' && u.tutorialOpen()) return u.tutNext(true);
    if (e.key === 'Escape' && app.pop) return u.closePop();
    if (e.key === 'Escape' && app.win) return closeWin();
    if (e.key === ' ' && !blocked() && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName || '')) { e.preventDefault(); play(!app.running); }
  });

  fit();
  const fresh = (j) => { try { return JSON.parse(j).version >= 2; } catch { return false; } };
  if (hotData.save && fresh(hotData.save)) start(loadGame(hotData.save));
  else setupScreen();
}
