// Arayüz (GDT/Kairosoft esinli): tam ekran sahne, üstte HUD ve proje sayacı, altta ikonlu menü,
// menüden açılan pencereler (açıkken oyun durur), adım adım yeni oyun sihirbazı, faz başında dağılım
// penceresi, yayında eleştirmen ekranı. Oyun mantığı game.js'te; burası yalnızca çağırır ve gösterir.
import { newGame, loadGame, M, Prod, Eco, Market, Staff, Con, Post, Know, World, People, Co } from '../game.js';
import { PACK } from '../data/pack.js';
import { makeRenderer, menuIcon } from './render.js';
import { money } from '../kernel.js';

const SAVE_KEY = 'xproject-save-v2';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('tr-TR');
const pct = (v) => Math.max(0, Math.min(100, v));
const bar = (v, cls = '') => `<span class="bar ${cls}"><i style="width:${pct(v)}%"></i></span>`;
const discName = (id) => PACK.disciplines.find((d) => d.id === id).name;
const STATUS = { hasta: 'Hasta', tukenmis: 'Tükenmiş', egitim: 'Eğitimde', tatil: 'Tatilde' };
const SPEEDS = [1, 2, 4, 8];
const kaosLabel = (k) => (k < 30 ? 'Sakin' : k < 55 ? 'Gergin' : k < 80 ? 'Kaotik' : 'Cehennem');
const store = (fn) => { try { return fn(window.localStorage); } catch { return null; } };
const MENU = [['bilgisayar', 'Bilgisayar'], ['gunluk', 'Günlük']];
const WIN_NAMES = { dunya: 'Oyun dünyası', bilgisayar: 'Bilgisayar', oda: 'Oda', insaat: 'Oda kur', reklam: 'Reklam ver', gelistir: 'Geliştir', personel: 'Personel', ofis: 'Ofis ve binalar', arge: 'Ar-Ge', pazar: 'Pazar', finans: 'Finans', gunluk: 'Günlük' };
const ICON_OF = { oda: 'ofis', insaat: 'ofis', reklam: 'pazar', dunya: 'pazar' };
const SUBS = { gelistir: [['oyun', 'Oyun'], ['sozlesme', 'Sözleşme']], arge: [['arastirma', 'Araştırma'], ['motor', 'Motor'], ['konsol', 'Donanım']], pazar: [['oyunlar', 'Oyunların'], ['liste', 'Satış listesi'], ['cikanlar', 'Son çıkanlar'], ['rakip', 'Rakipler']], finans: [['genel', 'Genel'], ['sirket', 'Şirket ve borsa']], dunya: [['yil', 'Bu yıl'], ['sirketler', 'Şirketler'], ['platformlar', 'Platformlar'], ['tarih', 'Tarih']] };
// Liste sırası değişimi: ▲ yükseldi, ▼ düştü, YENİ ilk hafta.
const move = (g) => (g.prev == null ? '<i class="new">YENİ</i>' : g.rank < g.prev ? `<i class="up">▲${g.prev - g.rank}</i>` : g.rank > g.prev ? `<i class="down">▼${g.rank - g.prev}</i>` : '<i>–</i>');

export function boot(root, hotData = {}) {
  const app = {
    game: null, running: false, speed: 1, frame: 0, timer: null, win: null, sub: {}, wasRunning: false, wasRunningD: false, dialog: null,
    draft: null, wiz: 1, engineSel: new Set(), engineName: 'Motor', consoleDraft: { type: 'konsol', series: 'yeni', seriesName: 'X Kutu', price: 'normal', parts: {} },
    confirm: null, expanded: new Set(), seenNews: 0, phaseSeen: {}, readySeen: {}, sel: null, selGame: null, wizOn: false, dlgPid: null, charts: {},
  };
  const $ = (id) => root.querySelector(id);
  const el = { bnav: $('#bnav'), market: $('#market'), stage: $('#stage'), canvas: $('#scene'), hud: $('#hud'), menu: $('#menu'), notes: $('#notes'), win: $('#win'), winTitle: $('#win-title'), winBody: $('#win-body'), modal: $('#modal') };
  const R = makeRenderer(el.canvas);
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
  }
  const run = (res) => { if (res && res.ok === false) note(res.msg, 'bad'); render(); return res; };

  // --- zaman
  function play(on) {
    app.running = on;
    clearInterval(app.timer);
    if (on) app.timer = setInterval(step, PACK.meta.msPerWeek[app.speed]);
    renderHud();
  }
  const blocked = () => app.win || app.dialog || !el.modal.hidden;
  function step() {
    const g = G();
    if (!g || blocked()) return;
    if (g.state.pending.length || g.state.gameOver) return showEvent();
    const before = g.state.news[0];
    g.tick();
    if (g.state.week % 4 === 0) save();
    for (const n of g.state.news) { if (n === before) break; if (n.type !== 'info') note(n.t, n.type); }
    render();
    if (g.state.pending.length || g.state.gameOver) return showEvent();
    for (const pj of g.state.projects) {
      if (pj.status === 'dev' && app.phaseSeen[pj.id] !== pj.phase) return phaseDialog(pj);
      if (pj.status === 'debug' && !app.readySeen[pj.id]) return readyDialog(pj);
    }
  }
  function loop() {
    app.frame++;
    if (G()) R.draw(G().state, PACK, app.frame, { building: curBuilding().id });
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
    if (!g) return setHTML(el.hud, '');
    const s = g.state, cal = g.cal(), c = ctx();
    if (!el.hud.querySelector('[data-f=cash]')) el.hud.innerHTML = `
      <div class="brand"><b data-f="name"></b><small data-f="date"></small></div>
      <div data-f="proj" class="projslot"></div>
      <div class="stats">
        <div class="stat"><small>Kasa</small><b class="num" data-f="cash"></b></div>
        <div class="stat"><small>Hayran</small><b class="num" data-f="fans"></b></div>
        <div class="stat kaos" data-f="kaosbox"><small data-f="kaoslabel"></small><b class="num" data-f="kaos"></b><span class="bar kbar"><i data-f="kaosbar"></i></span></div>
      </div>
      <div class="time"><button data-act="play" data-f="play"></button><button data-act="speed" data-f="speed" aria-label="Hız"></button></div>`;
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
        <span class="row"><small>Bu hafta</small><b class="num">${fmt(g.lastWeek)} kopya</b></span>${profitSpark((g.profitHist || []).slice(-40))}</button>`;
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
    const fn = { dunya: winWorld, bilgisayar: winHub, oda: winRoom, insaat: winBuild, reklam: winAds, gelistir: winDevelop, personel: winStaff, ofis: winOffice, arge: winResearch, pazar: winMarket, finans: winFinance, gunluk: winNews }[id];
    const title = id === 'oda' ? (() => { const r = G().state.rooms.find((x) => x.id === app.room); return r ? Staff.roomType(ctx(), r.type).name : 'Oda'; })() : WIN_NAMES[id];
    setHTML(el.winTitle, `${app.fromHub && id !== 'bilgisayar' ? '<button class="back" data-act="hub" aria-label="Bilgisayara dön">◀</button>' : ''}<img src="${icons[id] || icons.bilgisayar}" alt=""> ${esc(title)}`);
    const tabs = subs ? `<div class="seg" role="tablist">${subs.map(([k, n]) => `<button role="tab" data-sub="${k}" aria-selected="${sub === k}" class="${sub === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : '';
    const top = el.winBody.scrollTop;
    setHTML(el.winBody, tabs + fn(sub));
    el.winBody.scrollTop = top;
  }

  // ---------- BİLGİSAYAR (patronun masası): tüm yönetim buradan
  function winHub() {
    const s = G().state, c = ctx();
    const ready = s.projects.filter((p) => p.status === 'debug').length;
    const tile = (id, label, sub, extra = '') => `<button class="hubtile" data-hub="${id}" ${sub ? `data-hubsub="${sub}"` : ''}><img src="${icons[ICON_OF[id] ? id : id] || icons.bilgisayar}" alt=""><b>${label}</b>${extra ? `<small>${extra}</small>` : ''}</button>`;
    return `<p class="muted small">Patronun bilgisayarı. Odalara sahnede dokunarak da iş verebilirsin; binalar arasında kaydırarak geç.</p>
      <div class="hub">
        ${tile('gelistir', 'Yeni oyun geliştir', 'oyun', `${s.projects.length} proje${ready ? ` · ${ready} hazır` : ''}`)}
        ${tile('gelistir', 'Ek iş bul', 'sozlesme', s.contract ? 'sözleşme sürüyor' : `${s.contractOffers.length} teklif`)}
        ${tile('personel', 'Personel bul', '', `${s.staff.length}/${Staff.seats(c)} koltuk`)}
        ${tile('reklam', 'Reklam ver', '', s.projects.length ? `${s.projects.length} proje` : 'proje yok')}
        ${tile('arge', 'Araştırma', 'arastirma', s.research.current ? 'sürüyor' : `${Math.floor(s.research.rp)} RP`)}
        ${tile('pazar', 'Satışlar', 'oyunlar', `${s.games.filter((g) => g.active).length} oyun satışta`)}
        ${tile('pazar', 'Satış listesi', 'liste')}
        ${tile('finans', 'Finans', '', money(s.cash))}
        ${tile('ofis', 'Ofis ve binalar', '', Eco.office(c).name)}
        ${tile('arge', 'Donanım ve konsol', 'konsol', s.consoleJob ? 'yapım sürüyor' : `${(s.consoleSeries || []).length} aile`)}
        ${tile('arge', 'Motor', 'motor')}
        ${tile('dunya', 'Oyun dünyası', 'yil', `${Math.floor(M.tableYear(c))} · ${s.rivals.length} şirket`)}
        ${tile('finans', 'Şirket ve borsa', 'sirket', Co.company(s).listed ? `hisse ${Co.company(s).price} $` : 'halka arz')}
      </div>`;
  }
  // Reklam: her proje için kampanya düğmeleri (Geliştir penceresinin pazarlama kısmının kısayolu)
  function winAds() {
    const s = G().state, c = ctx();
    if (!s.projects.length) return '<p class="muted">Reklam verilecek proje yok. Önce yeni bir oyun başlat.</p>';
    return s.projects.map((pj) => `<section class="box"><div class="head"><h3>${esc(pj.name)}</h3><span class="pill">Hype ${Math.round(pj.hype)}</span></div>
      <div class="btns">${PACK.hype.campaigns.filter((x) => !x.minYear || M.tableYear(c) >= x.minYear).map((x) => { const lock = x.research && !s.research.done[x.research]; return `<button data-act="campaign" data-pid="${pj.id}" data-id="${x.id}" ${lock ? 'disabled' : ''}>${x.name}<small>${lock ? 'araştır' : money(x.cost * M.inflation(c) ** 0.7)}</small></button>`; }).join('')}</div></section>`).join('')
      + `<p class="muted small">Pazarlama ve yayın odası projelere her hafta kendiliğinden hype üretir.</p>`;
  }

  // ---------- ODA (sahnede odaya dokununca): görev, hedef proje, kişiler, odaya özel işler
  function targetSelect(r) {
    const s = G().state;
    if (!PACK.rooms.targetable.includes(r.type)) return '';
    return `<label class="field">Hangi projede çalışsın?<select id="tg-${r.id}" data-act="target" data-id="${r.id}"><option value="">Tüm projeler (eşit bölünür)</option>${s.projects.map((p) => `<option value="${p.id}" ${r.target === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`;
  }
  function devModeSelect(r) {
    const s = G().state;
    const own = s.projects.find((p) => p.roomId === r.id);
    const opts = Object.entries(PACK.rooms.modes).filter(([k]) => k !== 'destek').map(([k, v]) => `<option value="${k}" ${r.mode === k ? 'selected' : ''}>${v}</option>`).join('')
      + (own ? '' : s.projects.map((p) => `<option value="destek:${p.id}" ${r.mode === 'destek' && r.target === p.id ? 'selected' : ''}>Destek: ${esc(p.name)}</option>`).join(''));
    return `<p class="muted small">${own ? `Projesi: <b>${esc(own.name)}</b>` : r.mode === 'destek' ? 'Başka bir projeye destek veriyor.' : 'Şu an projesi yok.'}</p><label class="field">Görev<select id="md-${r.id}" data-act="mode" data-id="${r.id}">${opts}</select></label>`;
  }
  function winRoom() {
    const g = G(), s = g.state, c = ctx();
    const r = s.rooms.find((x) => x.id === app.room);
    if (!r) return '<p class="muted">Oda yok.</p>';
    const t = Staff.roomType(c, r.type), people = Staff.membersOf(c, r), cap = Staff.roomSeats(c);
    let work = '';
    if (r.type === 'gelistirme') {
      const own = s.projects.find((p) => p.roomId === r.id);
      work = devModeSelect(r) + `<div class="btns">${own ? `<button class="primary" data-act="open-proj" data-pid="${own.id}">Projeyi aç</button>` : r.mode !== 'sozlesme' && r.mode !== 'destek' ? `<button class="primary" data-act="new-in-room" data-id="${r.id}">Bu odada yeni oyun</button>` : ''}<button data-act="goto" data-id="gelistir" data-sub="sozlesme">Ek iş bul</button></div>`;
    } else if (r.type === 'arastirma') work = `<div class="btns"><button class="primary" data-act="goto" data-id="arge" data-sub="arastirma">Araştırma listesi</button><span class="muted small">${Math.floor(s.research.rp)} RP</span></div>`;
    else if (r.type === 'donanim') work = `<div class="btns"><button class="primary" data-act="goto" data-id="arge" data-sub="konsol">Konsol yap</button></div>`;
    else if (r.type === 'pazarlama') work = targetSelect(r) + winAds();
    else if (r.type === 'musteri') {
      const list = s.games.slice(-8).reverse().map((gm) => `<div class="row-item"><div><b>${esc(gm.name)}</b><small>${gm.playerReport ? 'rapor hazır' : gm.active && gm.weeks < PACK.playerReport.minWeeks ? `${PACK.playerReport.minWeeks - gm.weeks} hf sonra` : 'rapor çıkarılabilir'}</small></div><button data-act="report" data-id="${gm.id}" ${gm.active && gm.weeks < PACK.playerReport.minWeeks ? 'disabled' : ''}>${gm.playerReport ? 'Raporu gör' : 'Rapor çıkar · bedava'}</button></div>`).join('');
      work = `<p class="muted small">Müşteri destek ekibi oyuncu raporlarını bedavaya hazırlar.</p>${list || '<p class="muted">Henüz oyun yok.</p>'}`;
    } else work = targetSelect(r);
    const hire = people.length < cap ? `<details class="box"><summary><h3>Bu odaya işe al · ${cap - people.length} boş koltuk</h3></summary>${s.applicants.map((p) => `<div class="row-item"><div><b>${esc(p.name)}</b><small><span class="spec s-${p.spec}">${Staff.career(c, p.career).name} ${p.careers[p.career]}</span> beceri ${p.skill}</small></div><button data-act="hire-here" data-id="${p.id}" data-room="${r.id}">${money(p.salary)}/ay</button></div>`).join('') || '<p class="muted">Bu ay başvuru yok.</p>'}</details>` : '';
    return `<p class="muted small">${t.desc}</p><section class="box">${work}</section>
      <div class="head"><h3>Çalışanlar</h3><span class="pill">${people.length}/${cap}</span></div>
      <div class="people">${people.map(personRow).join('') || '<p class="muted small">Boş oda. Personel penceresinden birini buraya taşı ya da aşağıdan işe al.</p>'}</div>${hire}
      ${s.rooms.length > 1 ? `<div class="foot"><button class="ghost danger small" data-act="demolish" data-id="${r.id}">${app.confirm === 'dem' + r.id ? 'Emin misin?' : 'Odayı sök'}</button></div>` : ''}`;
  }
  // Boş alana dokununca: o binaya uygun odalar
  function winBuild() {
    const s = G().state, c = ctx();
    const b = PACK.buildings.find((x) => x.id === app.buildFor) || PACK.buildings[0];
    const free = Staff.slots(c) - s.rooms.length;
    return `<p class="muted small">${esc(b.name)} için oda kur. Boş alan: ${free}.</p><div class="tiles">${PACK.rooms.types.filter((t) => b.types.includes(t.id)).map((t) => {
      const lock = t.research && !s.research.done[t.research] ? 'araştır' : t.office && s.office.tier < t.office ? PACK.offices[t.office - 1].name : '';
      return `<button class="tile" data-act="build" data-id="${t.id}" ${lock || free <= 0 ? 'disabled' : ''} title="${esc(t.desc)}">${t.name}<small>${lock || money(t.cost * M.inflation(c) ** 0.5)}</small></button>`;
    }).join('')}</div>${PACK.rooms.types.filter((t) => b.types.includes(t.id)).map((t) => `<p class="small"><b>${t.name}:</b> <span class="muted">${t.desc}</span></p>`).join('')}`;
  }

  // ---------- GELİŞTİR: proje listesi, sihirbaz (bilgi rozetli), proje ayrıntısı
  function defaultDraft() {
    const g = G(), y = M.tableYear(ctx());
    const r = PACK.rivals, pick = (a) => a[(g.state.week + g.state.games.length * 3) % a.length];
    return { name: `${pick(r.gameNamesA)} ${pick(r.gameNamesB)}`, genre: 'aksiyon', sub: '', topic: PACK.topics.find((t) => t[4] <= y)[0], audience: 'herkes', size: 'kucuk', engineId: '', sequelOf: '', platforms: ['pc'], roomId: '' };
  }
  const badgeOf = (v) => (v == null ? '' : `<em class="kn k${v}">${Know.rating(v)[0]}</em>`);
  function winDevelop(sub) {
    if (sub === 'sozlesme') return contractsView();
    const s = G().state;
    const pj = app.sel && s.projects.find((p) => p.id === app.sel);
    if (pj) return projectView(pj);
    if (app.wizOn) return wizard();
    return projectList();
  }
  function projectList() {
    const g = G(), s = g.state, c = ctx();
    const free = g.freeDevRooms();
    const cards = s.projects.map((pj) => {
      const v = pj.status === 'dev' ? (pj.week / pj.totalWeeks) * 100 : 100;
      const room = s.rooms.find((r) => r.id === pj.roomId);
      const helpers = s.rooms.filter((r) => r.mode === 'destek' && r.target === pj.id).length;
      const pv = g.previewReview(pj.id);
      return `<button class="pcard ${pj.status === 'debug' ? 'ready' : ''}" data-act="sel" data-id="${pj.id}">
        <span class="top"><b>${esc(pj.name)}</b>${pj.kind === 'ek' ? '<span class="pill">Ek paket</span>' : ''}<span class="num score">${Math.round(pv.score)}</span></span>
        <small class="muted">${PACK.genres.find((x) => x.id === pj.genre).name} · ${PACK.topics.find((t) => t[0] === pj.topic)[1]} · ${room ? Staff.roomType(c, room.type).name + ' #' + room.id : 'odasız'}${helpers ? ` + ${helpers} destek odası` : ''}</small>
        ${bar(v, 'prog')}<small>${pj.status === 'dev' ? `${PACK.production.phaseNames[pj.phase]} · ${pj.week}/${pj.totalWeeks} hf` : `Yayına hazır · ${fmt(pj.bugs)} hata`}</small></button>`;
    }).join('');
    const why = free.length ? '' : '<p class="muted small">Boş geliştirme odası yok. Ofis penceresinden yeni bir geliştirme odası kur; ya da bir odayı başka projeye destek olarak çalıştır.</p>';
    return `<div class="plist">${cards || '<p class="muted">Şu an süren proje yok.</p>'}</div>${why}
      <div class="foot"><span class="muted small">${s.projects.length} proje · ${free.length} boş geliştirme odası</span><button class="primary big" data-act="new" ${free.length ? '' : 'disabled'}>Yeni oyun</button></div>`;
  }
  function wizard() {
    const g = G(), s = g.state, c = ctx(), y = M.tableYear(c), kn = Know.known(c);
    const d = (app.draft ||= defaultDraft());
    const done = s.research.done, trend = s.trend || {};
    const steps = ['Fikir', 'Platform', 'Onay'];
    const head = `<div class="foot"><button class="ghost" data-act="back">← Projeler</button><span></span></div><ol class="steps">${steps.map((n, i) => `<li class="${app.wiz === i + 1 ? 'on' : app.wiz > i + 1 ? 'done' : ''}">${i + 1}. ${n}</li>`).join('')}</ol>`;
    const opt = (v, label, sel, dis = false) => `<option value="${v}" ${sel ? 'selected' : ''} ${dis ? 'disabled' : ''}>${esc(label)}</option>`;
    const nav = (back, nextLabel) => `<div class="foot">${back ? '<button data-act="wiz" data-id="-1">Geri</button>' : ''}<span></span><button class="primary" data-act="wiz" data-id="1">${nextLabel}</button></div>`;
    if (app.wiz === 1) {
      const genres = PACK.genres.filter((x) => !x.research || done[x.research]);
      const topics = PACK.topics.filter((t) => t[4] <= y);
      const tile = (key, id, label, on, hot, k) => `<button class="tile ${on ? 'on' : ''}" data-pick="${key}" data-id="${id}">${esc(label)}${hot ? '<em>trend</em>' : ''}${badgeOf(k)}</button>`;
      const focus = kn.genreFocus(d.genre) ? (() => { const gg = PACK.genres.find((x) => x.id === d.genre); return `<p class="muted small">Öğrendiğin ideal dağılım (${gg.name}): ${['oyn', 'gfx', 'ses', 'tek'].map((k) => `${discName(k)} %${Math.round(gg.disc[k] * 100)}`).join(' · ')}</p>`; })() : '';
      return head + `<label class="field">Oyunun adı<input id="f-name" data-draft="name" value="${esc(d.name)}" maxlength="40"></label>
        <h3>Konu <small class="muted">rozet: seçili türle bilinen uyum</small></h3><div class="tiles">${topics.map((t) => tile('topic', t[0], t[1], d.topic === t[0], trend.topic === t[0], kn.topicGenre(t[0], d.genre))).join('')}</div>
        <h3>Tür</h3><div class="tiles">${genres.map((x) => tile('genre', x.id, x.name, d.genre === x.id, trend.genre === x.id, kn.topicGenre(d.topic, x.id))).join('')}</div>${focus}
        <div class="form"><label>Alt tür<select id="f-sub" data-draft="sub" ${done.alt_tur ? '' : 'disabled'}>${opt('', done.alt_tur ? 'Yok (−3)' : 'Araştırma gerekli (−3)', !d.sub)}${genres.filter((x) => x.id !== d.genre).map((x) => opt(x.id, x.name, d.sub === x.id)).join('')}</select></label>
        <label>Kitle<select id="f-aud" data-draft="audience">${PACK.audiences.map((a) => { const k = kn.topicAud(d.topic, a.id); return opt(a.id, a.name + (k ? ` (${Know.rating(k)[0]})` : ''), d.audience === a.id); }).join('')}</select></label></div>`
        + nav(false, 'Platforma geç');
    }
    if (app.wiz === 2) {
      const maxTech = PACK.workstations.tiers[s.stationTier].maxTech;
      const plats = M.activePlatforms(c).map((p) => {
        const locked = !p.own && p.tech > maxTech;
        return `<label class="pick ${locked ? 'locked' : ''}"><input type="checkbox" id="pl-${p.id}" data-plat="${p.id}" ${d.platforms.includes(p.id) ? 'checked' : ''} ${locked ? 'disabled' : ''}>
          <span class="name">${esc(p.name)}${p.own ? ' ★' : ''} ${badgeOf(kn.platGenre(p.id, d.genre))}</span><span class="meta num">${locked ? 'istasyon yetersiz' : `${M.platformBase(c, p).toFixed(1)} M kişi · ${p.licence ? money(p.licence) : 'lisanssız'}`}</span></label>`;
      }).join('');
      const free = g.freeDevRooms();
      return head + `<fieldset class="picks"><legend>Platformlar <small>rozet: seçili türle bilinen uyum</small></legend>${plats}</fieldset>
        <div class="form">
          <label>Boyut<select id="f-size" data-draft="size">${PACK.sizes.map((z) => { const lock = z.research && !done[z.research] ? ' (araştır)' : s.office.tier < z.office ? ` (${PACK.offices[z.office - 1].name})` : ''; return opt(z.id, `${z.name} · ${z.weeks} hf${lock}`, d.size === z.id, !!lock); }).join('')}</select></label>
          <label>Motor<select id="f-engine" data-draft="engineId">${opt('', 'Motorsuz', !d.engineId)}${s.engines.map((e) => opt(e.id, `${e.name} (${M.engineScore(c, e)})`, String(d.engineId) === String(e.id))).join('')}</select></label>
          <label>Seri<select id="f-ip" data-draft="sequelOf">${opt('', 'Yeni IP', !d.sequelOf)}${s.ips.map((ip) => opt(ip.id, `${ip.name} ★${ip.value.toFixed(1)}`, String(d.sequelOf) === String(ip.id))).join('')}</select></label>
          <label>Geliştirme odası<select id="f-room" data-draft="roomId">${free.map((r) => opt(r.id, `${Staff.roomType(c, r.type).name} #${r.id} · ${Staff.membersOf(c, r).length} kişi`, String(d.roomId) === String(r.id))).join('')}</select></label>
        </div>` + nav(true, 'Özete geç');
    }
    const genre = PACK.genres.find((x) => x.id === d.genre), topic = PACK.topics.find((t) => t[0] === d.topic);
    const size = PACK.sizes.find((z) => z.id === d.size);
    return head + `<div class="summary">
        <h2>${esc(d.name)}</h2>
        <p>${esc(topic[1])} temalı ${genre.name.toLowerCase()}${d.sub ? ' + ' + PACK.genres.find((x) => x.id === d.sub).name.toLowerCase() : ''} oyunu, ${PACK.audiences.find((a) => a.id === d.audience).name.toLowerCase()} kitle için.</p>
        <div class="kv"><span>Platform</span><b>${d.platforms.map((id) => esc(M.platformById(c, id)?.name || id)).join(', ') || '—'}</b><span>Boyut</span><b>${size.name} · ${size.weeks} hafta</b>
        <span>Başlangıç maliyeti</span><b class="num">${money(Prod.projectCost(c, d))}</b><span>Kasa</span><b class="num">${money(s.cash)}</b></div>
      </div><div class="foot"><button data-act="wiz" data-id="-1">Geri</button><span></span><button class="primary big" data-act="start">Geliştirmeye başla</button></div>`;
  }
  function projectView(pj) {
    const g = G(), s = g.state, c = ctx();
    const genre = PACK.genres.find((x) => x.id === pj.genre);
    const topic = PACK.topics.find((t) => t[0] === pj.topic)[1];
    const prog = pj.status === 'dev' ? (pj.week / pj.totalWeeks) * 100 : 100;
    const pv = g.previewReview(pj.id);
    const pid = pj.id;
    const discs = ['oyn', 'gfx', 'ses', 'tek'].map((d) => { const v = (pj.points[d] / M.target(c, d, pj.size)) * 100; return `<div class="disc"><span>${discName(d)}</span>${bar(v, 'd-' + d)}<b class="num">${Math.round(Math.min(v, 999))}%</b></div>`; }).join('');
    const camps = PACK.hype.campaigns.filter((x) => !x.minYear || M.tableYear(c) >= x.minYear).map((x) => { const lock = x.research && !s.research.done[x.research]; return `<button data-act="campaign" data-pid="${pid}" data-id="${x.id}" ${lock ? 'disabled' : ''}>${x.name}<small>${lock ? 'araştır' : money(x.cost * M.inflation(c) ** 0.7)}</small></button>`; }).join('');
    const outs = PACK.outsource.rows.map((_, i) => Prod.outsourceRow(c, i)).filter((r) => r.office <= s.office.tier).map((r) => `<div class="row-item"><div><b>${esc(r.name)}</b><small>${discName(r.disc)} · +${fmt(r.points)} puan</small></div><button data-act="outsource" data-pid="${pid}" data-id="${r.i}" ${pj.status !== 'dev' ? 'disabled' : ''}>${money(r.fee)}</button></div>`).join('');
    let release = '';
    if (pj.status === 'debug') {
      const pubs = Market.publishersAvailable(c);
      release = `<section class="box hl"><h3>Yayına hazır</h3><div class="form">
        <label class="wide">Yayıncı<select id="r-pub">${pubs.map((p) => `<option value="${p.id}" ${s.fans < p.minFans ? 'disabled' : ''}>${esc(p.name)} · güç ${p.power} · pay %${Math.round(p.royalty * 100)}${s.fans < p.minFans ? ` (${fmt(p.minFans)} hayran)` : ''}</option>`).join('')}
          ${s.research.done.oz_yayin ? `<option value="">Kendi yayınım · güç ${Math.round(M.selfPublishPower(c))}</option>` : ''}</select></label>
        <label>Fiyat ($)<input id="r-price" type="number" min="1" max="120" value="${Math.max(10, Math.round(20 * M.inflation(c) ** 0.4))}"></label></div>
        <div class="foot"><span class="muted small">${fmt(pj.bugs)} hata kaldı. Beklemek hataları azaltır, maaş yer.</span><button class="primary big" data-act="release" data-pid="${pid}">Yayınla</button></div></section>`;
    }
    return `<div class="foot"><button class="ghost" data-act="back">← Projeler</button><span></span></div>
      <div class="proj-head"><div><h2>${esc(pj.name)}</h2><p class="muted small">${genre.name}${pj.sub ? ' + ' + PACK.genres.find((x) => x.id === pj.sub).name : ''} · ${esc(topic)} · ${PACK.sizes.find((z) => z.id === pj.size).name}${pj.kind === 'ek' ? ' · ek paket' : ''}</p></div>
        <div class="forecast"><small>Şu an çıksa</small><b class="num">${Math.round(pv.score)}</b></div></div>
      <div class="progress"><span>${pj.status === 'dev' ? `${PACK.production.phaseNames[pj.phase]} · hafta ${pj.week}/${pj.totalWeeks}` : 'Hata ayıklama'}</span>${bar(prog, 'prog')}</div>
      ${release}
      <section class="box"><h3>Hedefe ulaşma</h3>${discs}<p class="muted small">${pv.notes.map(esc).join(' · ') || 'Ceza yok'} · Uyum ×${pv.F.toFixed(2)} · Hiza ×${pv.hiza.toFixed(2)} · Hype ${Math.round(pj.hype)}</p>
        ${pj.status === 'dev' ? `<div class="foot"><button data-act="phase" data-pid="${pid}">Zaman dağılımını ayarla</button></div>` : ''}</section>
      <section class="box"><h3>Pazarlama</h3><div class="btns">${camps}</div></section>
      <section class="box"><h3>Baskı</h3><div class="foot"><span class="muted small">Crunch tüm stüdyoya uygulanır: +%40 üretim; stres, hata ve skandal riski patlar.</span><button data-act="crunch" class="${s.crunch ? 'danger on' : ''}">${s.crunch ? 'Crunch\'ı bitir' : 'Crunch başlat'}</button></div></section>
      <details class="box"><summary><h3>Dış kaynak</h3></summary><p class="muted small">Tek seferlik ücretle anında puan. Pahalılaştıkça getirisi azalır.</p>${outs}</details>
      <div class="foot"><button class="ghost danger" data-act="cancel" data-pid="${pid}">${app.confirm === 'cancel' + pid ? 'Emin misin? Tekrar bas' : 'Projeyi iptal et'}</button></div>`;
  }
  function contractsView() {
    const s = G().state, c = ctx();
    const tierOf = (id) => PACK.contracts.tiers.find((t) => t.id === id) || PACK.contracts.tiers[0];
    const needs = (o) => Object.entries(o.need).map(([d, n]) => `<span class="spec s-${d}">${discName(d)} ${fmt(n)}</span>`).join(' ');
    const weekly = Prod.devCapacity(c);
    let cur = '';
    if (s.contract) {
      const k = s.contract, t = tierOf(k.tier);
      const bars = Object.entries(k.need).map(([d, n]) => { const v = (k.progress?.[d] || 0) / n * 100; return `<div class="disc"><span>${discName(d)}</span>${bar(v, 'd-' + d)}<b class="num">${Math.round(Math.min(v, 100))}%</b></div>`; }).join('');
      cur = `<section class="box hl"><div class="head"><h3>${esc(k.client)}</h3><span class="pill tier-${t.id}">${t.name}</span></div>
        <p class="muted small">${esc(k.job)} · ödül ${money(k.reward)} · ${k.deadline - s.week} hafta kaldı</p>${bars}
        <p class="muted small">Gecikirse ödülün %${Math.round(PACK.contracts.penaltyShare * 100)}'ı kadar ceza ve itibar kaybı.</p></section>`;
    }
    const offers = s.contract ? '' : s.contractOffers.map((o) => {
      const t = tierOf(o.tier || 'kolay'), need = typeof o.need === 'number' ? { oyn: o.need } : o.need;
      const total = Object.values(need).reduce((a, b) => a + b, 0);
      const est = weekly > 0 ? Math.ceil(total / weekly) : null;
      return `<div class="row-item"><div><b>${esc(o.client)} <span class="pill tier-${t.id}">${t.name}</span></b>
        <small>${esc(o.job)} · ${o.weeks} hafta süre${est ? ` · tüm ekiple ~${est} hf` : ''}</small><small>${needs({ need })}</small></div>
        <button data-act="contract" data-id="${o.id}">${money(o.reward)}</button></div>`;
    }).join('');
    return `<p class="muted small">Sözleşmeyi geliştirme odaları yapar; oyun yokken kendiliğinden, proje sürerken yalnızca "Yalnızca sözleşme" modundaki odalar. İstenen her disiplin ayrı ayrı dolmalı; çalışanın kariyeri o disipline uygunsa daha hızlı ilerler. Zor işler daha çok öder, RP ve itibar getirir.</p>
      ${cur}${offers || (cur ? '' : '<p class="muted">Bu ay teklif yok.</p>')}`;
  }

  // ---------- PERSONEL
  function personRow(p) {
    const c = ctx(), car = Staff.career(c, p.career), lvl = p.careers[p.career] || 0;
    const open = app.expanded.has(p.id);
    const room = Staff.roomOf(c, p);
    const status = STATUS[p.status] ? `<span class="pill warn">${STATUS[p.status]} ${p.statusWeeks}</span>` : '';
    let actions = '';
    if (open) {
      const lc = Staff.levelCost(c, p), opts = Staff.careerOptions(c, p);
      actions = `<div class="acts">
        <label>Oda<select id="mv-${p.id}" data-act="move" data-id="${p.id}">${G().state.rooms.map((r) => `<option value="${r.id}" ${p.room === r.id ? 'selected' : ''}>${esc(Staff.roomType(c, r.type).name)} #${r.id}</option>`).join('')}</select></label>
        <label>Eğitim<select id="tr-${p.id}" data-act="train" data-id="${p.id}"><option value="">Seç…</option>${PACK.training.map((t) => `<option value="${t.id}">${t.name} · ${money(t.cost * M.inflation(c))}</option>`).join('')}</select></label>
        <label>Kariyer<select id="cr-${p.id}" data-act="career" data-id="${p.id}"><option value="">${opts.length ? 'Değiştir…' : 'Seçenek yok'}</option>${opts.map((o) => `<option value="${o.id}">${o.name} · ${money(PACK.careerRules.changeCost * M.inflation(c))}</option>`).join('')}</select></label>
        <div class="btns"><button data-act="level" data-id="${p.id}" ${lc == null ? 'disabled' : ''}>${lc == null ? 'Son seviye' : `Seviye atlat · ${lc} RP`}</button>
          ${p.founder ? '' : `<button data-act="raise" data-id="${p.id}">Zam %12</button><button class="ghost danger" data-act="fire" data-id="${p.id}">${app.confirm === 'fire' + p.id ? 'Emin misin?' : 'Kov'}</button>`}</div>
        <p class="muted small">Kariyerler: ${Object.entries(p.careers).map(([k, v]) => `${Staff.career(c, k).name} ${v}`).join(', ')}</p>
        ${traitPills(p)}
        <div class="skills">${PACK.skills.keys.map(([k, n]) => `<span>${n}</span>${bar(p.skills?.[k] || 0, 'sk')}<b class="num">${p.skills?.[k] ?? '–'}</b>`).join('')}</div>
        ${relLine(p)}
        <div class="foot"><span class="muted small">İzin hakkı ${(p.vacDue || 0).toFixed(1)} hf${p.lastVac != null ? ` · son tatil Y${Math.floor(p.lastVac / 48) + 1}` : ''}</span><button data-act="vacation" data-id="${p.id}" ${p.status !== 'ok' ? 'disabled' : ''}>Tatile gönder</button></div></div>`;
    }
    return `<div class="person ${p.status !== 'ok' ? 'away' : ''} ${open ? 'open' : ''}">
      <button class="who" data-act="expand" data-id="${p.id}" aria-expanded="${open}">
        <span class="name">${p.founder ? '♛ ' : ''}${esc(p.name)}</span><span class="num pay">${p.founder ? 'kurucu' : money(p.salary)}</span>
        <span class="tagline"><span class="spec s-${p.spec}">${car.name} ${lvl}</span><span class="muted">${esc(Staff.roomType(c, room?.type || 'gelistirme').name)}</span>${status}</span>
        <span class="vit"><span class="num" title="Beceri">${Math.round(p.skill)}</span><span title="Moral">${bar(p.morale, 'm')}</span><span title="Stres">${bar(p.stress, 's')}</span></span>
      </button>${actions}</div>`;
  }
  const traitName = (id) => PACK.traits.find((t) => t.id === id)?.name || id;
  const traitPills = (p) => { const t = [p.trait, p.trait2].filter(Boolean); return t.length ? `<p class="traits">${t.map((id) => `<span class="pill">${esc(traitName(id))}</span>`).join('')}</p>` : ''; };
  function relLine(p) {
    const rels = People.relationsOf(ctx(), p);
    if (!rels.length) return '';
    const f = rels.filter(([, v]) => v >= PACK.relations.friendAt), e = rels.filter(([, v]) => v <= PACK.relations.enemyAt);
    return `<p class="small rels">${f.length ? `<span class="up">♥ ${f.slice(0, 3).map(([x]) => esc(x.name.split(' ')[0])).join(', ')}</span> ` : ''}${e.length ? `<span class="down">⚡ ${e.slice(0, 3).map(([x]) => esc(x.name.split(' ')[0])).join(', ')}</span>` : ''}${!f.length && !e.length ? `<span class="muted">İlişkiler nötr</span>` : ''}</p>`;
  }
  function vacationBox() {
    const s = G().state, c = ctx();
    const away = People.onVacation(s), cap = People.vacationCap(c), cur = s.vacationPolicy || 'planli';
    return `<section class="box"><div class="head"><h3>Tatil politikası</h3><span class="pill">${away.length}/${cap} izinde</span></div>
      <div class="seg">${Object.entries(PACK.vacation.policies).map(([k, v]) => `<button data-act="vacpol" data-id="${k}" class="${cur === k ? 'on' : ''}" aria-pressed="${cur === k}">${v.name}</button>`).join('')}</div>
      <p class="muted small">${esc(PACK.vacation.policies[cur].desc)} Çalışanlar yılda ${PACK.vacation.perYear} hafta izin hakkı biriktirir; yorulunca ya da hak dolunca ister. Çakışan istek reddedilir, moral düşer ve aralarında gerginlik olur.</p>
      ${away.length ? `<p class="small">🏖️ ${away.map((p) => `${esc(p.name)} (${p.statusWeeks} hf)`).join(', ')}</p>` : ''}</section>`;
  }
  function winStaff() {
    const s = G().state, c = ctx();
    const apps = s.applicants.map((p) => `<div class="row-item"><div><b>${esc(p.name)}</b><small><span class="spec s-${p.spec}">${Staff.career(c, p.career).name} ${p.careers[p.career]}</span> beceri ${p.skill} · ${People.topSkills(c, p).map(([n, v]) => `${n} ${v}`).join(', ')}${[p.trait, p.trait2].filter(Boolean).map((t) => ' · ' + esc(traitName(t))).join('')}</small></div>
      <button data-act="hire" data-id="${p.id}" ${s.staff.length >= Staff.seats(c) ? 'disabled' : ''}>${money(p.salary)}/ay</button></div>`).join('');
    return vacationBox() + `<div class="legend"><span>Beceri</span><span><i class="dot m"></i>Moral</span><span><i class="dot s"></i>Stres</span><span class="muted">Ayrıntı için isme dokun</span></div>
      <div class="people">${s.staff.map(personRow).join('')}</div>
      <details class="box" ${s.staff.length < Staff.seats(c) ? 'open' : ''}><summary><h3>İşe alım · ${s.staff.length}/${Staff.seats(c)} koltuk</h3></summary>
        <p class="muted small">Her ay yenilenir. İşe alım ücreti bir aylık maaş. ${s.staff.length >= Staff.seats(c) ? 'Koltuk yok: Ofis penceresinden oda kur.' : ''}</p>${apps || '<p class="muted">Bu ay başvuru yok.</p>'}</details>`;
  }

  // ---------- OFİS
  function winOffice() {
    const s = G().state, c = ctx();
    const off = Eco.office(c), next = PACK.offices.find((o) => o.tier === s.office.tier + 1);
    const moveLabel = next ? `${next.name}'e taşın · ${money(next.cost * M.inflation(c) ** 0.5)}` : off.floorCost && s.office.floors < off.maxFloors ? `Yeni kat (+${off.floorSlots} oda) · ${money(off.floorCost * M.inflation(c) ** 0.5)}` : null;
    const st = PACK.workstations.tiers[s.stationTier], up = Eco.stationUpgradeCost(c), cap = Staff.roomSeats(c);
    const rooms = s.rooms.map((r) => {
      const t = Staff.roomType(c, r.type), people = Staff.membersOf(c, r);
      const own = s.projects.find((p) => p.roomId === r.id);
      const modeOpts = Object.entries(PACK.rooms.modes).filter(([k]) => k !== 'destek').map(([k, v]) => `<option value="${k}" ${r.mode === k ? 'selected' : ''}>${v}</option>`).join('')
        + (own ? '' : s.projects.map((p) => `<option value="destek:${p.id}" ${r.mode === 'destek' && r.target === p.id ? 'selected' : ''}>Destek: ${esc(p.name)}</option>`).join(''));
      const mode = r.type === 'gelistirme' ? `<p class="muted small">${own ? `Projesi: <b>${esc(own.name)}</b>` : r.mode === 'destek' ? 'Başka projeye destek veriyor' : 'Projesi yok'}</p><select id="md-${r.id}" data-act="mode" data-id="${r.id}" aria-label="Oda modu">${modeOpts}</select>` : '';
      return `<section class="box room r-${r.type}"><div class="head"><h3>${t.name}</h3><span class="pill">${people.length}/${cap}</span></div>
        <p class="muted small">${t.desc}</p>${mode}${PACK.rooms.targetable.includes(r.type) ? targetSelect(r) : ''}
        <p class="names">${people.map((p) => `<span class="spec s-${p.spec}">${esc(p.name.split(' ')[0])}</span>`).join('') || '<span class="muted small">Boş</span>'}</p>
        ${s.rooms.length > 1 ? `<div class="foot"><button class="ghost danger small" data-act="demolish" data-id="${r.id}">${app.confirm === 'dem' + r.id ? 'Emin misin?' : 'Sök'}</button></div>` : ''}</section>`;
    }).join('');
    const free = Staff.slots(c) - s.rooms.length;
    const build = free > 0 ? `<section class="box"><h3>Boş alan: ${free}</h3><div class="tiles">${PACK.rooms.types.map((t) => {
      const lock = t.research && !s.research.done[t.research] ? 'araştır' : t.office && s.office.tier < t.office ? PACK.offices[t.office - 1].name : '';
      return `<button class="tile" data-act="build" data-id="${t.id}" ${lock ? 'disabled' : ''} title="${esc(t.desc)}">${t.name}<small>${lock || money(t.cost * M.inflation(c) ** 0.5)}</small></button>`;
    }).join('')}</div></section>` : '';
    return `<section class="box"><div class="kv"><span>Mekân</span><b>${esc(off.name)}</b><span>Oda alanı</span><b class="num">${s.rooms.length}/${Staff.slots(c)}</b><span>Koltuk</span><b class="num">${s.staff.length}/${Staff.seats(c)}</b>
      <span>Bilgisayar</span><b>${st.name} <small class="muted">×${M.stationFactor(c).toFixed(2)}${s.stationTier < M.expectedStationTier(c) ? ' · geride' : ''}</small></b></div>
      <div class="btns">${moveLabel ? `<button data-act="office">${moveLabel}</button>` : ''}<button data-act="stations" ${up == null ? 'disabled' : ''}>${up == null ? 'İstasyonlar son seviye' : `İstasyon yükselt · ${money(up)}`}</button></div></section>
      ${designBox()}${build}<div class="grid">${rooms}</div>`;
  }
  function designBox() {
    const s = G().state, c = ctx();
    const list = buildings();
    const eff = (d) => [d.speed !== 1 ? `hız ×${d.speed}` : '', d.morale ? `moral ${d.morale > 0 ? '+' : ''}${d.morale}` : '', d.stress !== 1 ? `stres ×${d.stress}` : '', d.rentMult !== 1 ? `kira ×${d.rentMult}` : '', d.prestige ? 'prestij' : ''].filter(Boolean).join(' · ') || 'nötr';
    return `<section class="box"><h3>Ofis tasarımı</h3><p class="muted small">Her binanın kendi dekoru var. Ucuz dekor kirayı düşürür ama üretimi yavaşlatır; konforlu dekor moral ve stresi iyileştirir.</p>
      ${list.map((b) => { const cur = s.designs?.[b.id] || 'standart'; return `<h3 class="sub">${esc(b.name)}</h3><div class="tiles dz">${PACK.designs.map((d) => { const cost = Eco.designCost(c, b.id, d.id); return `<button class="tile ${cur === d.id ? 'on' : ''}" data-act="design" data-b="${b.id}" data-id="${d.id}" title="${esc(d.desc)}"><i class="sw" style="background:${d.floor || '#5b4a73'};border-color:${d.wall || '#8a7aa3'}"></i>${d.name}<small>${eff(d)}</small><small>${cur === d.id ? 'seçili' : cost ? money(cost) : 'bedava'}</small></button>`; }).join('')}</div>`; }).join('')}</section>`;
  }

  // ---------- AR-GE
  function winResearch(sub) {
    const s = G().state, c = ctx();
    if (sub === 'motor') {
      const feats = PACK.research.filter((r) => r.engine && s.research.done[r.id]);
      const builder = s.research.done.motor_ozel ? `<label class="field">Motor adı<input id="e-name" data-eng="name" value="${esc(app.engineName)}" maxlength="24"></label>
        <fieldset class="picks">${feats.map((f) => { const st = M.featureStats(c, f.id); return `<label class="pick"><input type="checkbox" id="ft-${f.id}" data-feat="${f.id}" ${app.engineSel.has(f.id) ? 'checked' : ''}><span class="name">${esc(f.name.replace('Motor: ', ''))}</span><span class="meta num">${st.enginePts} p · ${money(st.engineCost)}</span></label>`; }).join('') || '<p class="muted">Önce motor özelliği araştır.</p>'}</fieldset>
        <div class="foot">${s.engineJob ? `<span class="muted">Yapılıyor: ${esc(s.engineJob.name)} · ${s.engineJob.weeksLeft} hf</span>` : '<span></span><button class="primary" data-act="engine">Motoru yap</button>'}</div>` : '<p class="muted">"Kendi motorunu yap" araştırmasıyla açılır.</p>';
      const engines = s.engines.map((e) => `<div class="row-item"><div><b>${esc(e.name)}</b><small>${M.engineScore(c, e)} puan · ${Math.floor(e.builtYear)} · ×${M.engineFactor(c, e).toFixed(2)}</small></div>
        <button data-act="licence" data-id="${e.id}" ${s.research.done.motor_lisans ? '' : 'disabled'}>${e.licensed ? 'Lisansı kapat' : 'Lisansla'}</button></div>`).join('');
      return builder + engines;
    }
    if (sub === 'konsol') return consoleView();
    const cur = s.research.current ? (() => { const it = PACK.research.find((r) => r.id === s.research.current.id); return `<section class="box hl"><h3>${esc(it.name)}</h3><p class="muted small">${s.research.current.weeksLeft} hafta kaldı</p></section>`; })() : '';
    const row = (r) => {
      const i = Prod.researchInfo(c, r), can = s.research.rp >= i.rp && !s.research.current;
      return `<div class="row-item"><div><b>${esc(r.name.replace('Donanım: ', ''))}</b><small>${i.rp} RP · ${i.weeks} hafta</small></div><button data-act="research" data-id="${r.id}" ${can ? '' : 'disabled'}>${money(i.cost)}</button></div>`;
    };
    const all = Prod.researchAvailable(c), hw = all.filter((r) => r.hw), game = all.filter((r) => !r.hw);
    const av = game.map(row).join('') + (hw.length ? `<h3 class="sub">Donanım (konsol bileşenleri)</h3>${hw.map(row).join('')}` : '');
    return `<div class="rp"><b class="num">${Math.floor(s.research.rp)}</b><span>araştırma puanı</span></div>${cur}
      <p class="muted small">Herkes üretiminin bir kısmını RP'ye çevirir; Araştırma odasındakiler çok daha fazla. RP kariyer seviyesine de harcanır.</p>${av || '<p class="muted">Şimdilik yeni bir şey yok. Yıllar geçtikçe açılır.</p>'}`;
  }
  // ---------- DONANIM: tip, aile/nesil, dönemine göre bileşenler, fiyat stratejisi
  function consoleDraft() {
    const c = ctx(), d = app.consoleDraft;
    d.parts ||= {}; d.series ||= 'yeni'; d.price ||= 'normal'; d.seriesName ??= 'X Kutu';
    const pc = Con.consoleParts(c, d.type);
    if (!pc.types.find((x) => x.t.id === d.type)?.ok) d.type = (pc.types.find((x) => x.ok) || pc.types[0]).t.id;
    const parts = Con.consoleParts(c, d.type);
    for (const [cat, list] of Object.entries(parts.cats)) {
      const cur = list.find((x) => x.p.id === d.parts[cat]);
      if (!cur || !cur.ok) { const ok = list.filter((x) => x.ok && !x.p.hwEng); d.parts[cat] = (ok[ok.length - 1] || list.find((x) => x.ok))?.p.id || ''; }
    }
    if (d.series !== 'yeni' && !(G().state.consoleSeries || []).some((x) => String(x.id) === String(d.series))) d.series = 'yeni';
    return { d, parts };
  }
  function consoleView() {
    const s = G().state, c = ctx(), cp = PACK.console;
    const typeName = (id) => Con.typeById(c, id)?.name || id;
    const status = (k) => (k.retired ? 'emekli' : k.sunsetAt ? 'son dönem' : k.ended ? 'üretim bitti' : 'piyasada');
    const series = (s.consoleSeries || []).map((sr) => {
      const ks = s.consoles.filter((k) => k.seriesId === sr.id && k.launched);
      return `<section class="box"><div class="head"><h3>${esc(sr.name)} ailesi</h3><span class="pill">${sr.gen} nesil · ${fmt(sr.sold || 0)} adet</span></div>
        ${ks.map((k) => `<div class="row-item"><div><b>${esc(k.name)}</b><small>${esc(typeName(k.type))} · teknoloji ${k.tech} · ${Math.floor(k.launched)} · ${status(k)}</small><small>${fmt(k.sold)} satıldı · kurulu ${k.base.toFixed(2)} M oyuncu · gelir ${money(k.revenue || 0)}${k.lastWeek && !k.retired ? ` · bu hafta ${fmt(k.lastWeek)}` : ''}</small></div></div>`).join('') || '<p class="muted small">Henüz çıkan nesil yok.</p>'}</section>`;
    }).join('');
    const old = s.consoles.filter((k) => k.launched && !k.seriesId).map((k) => `<div class="row-item"><div><b>${esc(k.name)}</b><small>${esc(typeName(k.type))} · teknoloji ${k.tech} · ${fmt(k.sold)} adet · ${status(k)}</small></div></div>`).join('');
    const soon = Con.upcomingParts(c).map((p) => `<span class="pill">${esc(p.name)} · ${p.year}</span>`).join(' ');
    const lists = `${series}${old}${soon ? `<section class="box"><h3>Ufuktaki teknolojiler</h3><p class="btns">${soon}</p><p class="muted small">Yılı gelince Ar-Ge'de araştırılabilir.</p></section>` : ''}`;
    const job = s.consoles.find((k) => k.id === s.consoleJob);
    if (job) return `<section class="box hl"><h3>${esc(job.name)} · ${typeName(job.type)} · ${cp.phases[job.phase]} (${job.phase + 1}/${cp.phases.length})</h3>${bar((job.points / job.need) * 100, 'prog')}
      <p class="muted small">${fmt(job.points)}/${fmt(job.need)} donanım puanı. Laboratuvardakiler üretir; Donanım Mühendisleri ve donanım yeteneği yüksek olanlar çok daha hızlı.</p></section>${lists}`;
    const block = Con.consoleBlockers(c);
    if (block.length) return `<p class="muted">Kendi donanımını yapmak için eksikler:</p><ul class="todo">${block.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>${lists}`;
    const { d, parts } = consoleDraft();
    const q = Con.consoleQuote(c, d);
    const tiles = parts.types.map(({ t, ok, why }) => `<button class="tile ${d.type === t.id ? 'on' : ''}" data-act="ctype" data-id="${t.id}" ${ok ? '' : 'disabled'}>${esc(t.name)}<small>${ok ? `${t.year}'den beri` : why}</small></button>`).join('');
    const famOpts = `<option value="yeni" ${d.series === 'yeni' ? 'selected' : ''}>Yeni aile</option>${(s.consoleSeries || []).map((sr) => `<option value="${sr.id}" ${String(d.series) === String(sr.id) ? 'selected' : ''}>${esc(sr.name)} · ${sr.gen + 1}. nesil</option>`).join('')}`;
    const sel = (cat, list) => `<label>${esc(cp.parts[cat].name)}<select id="cp-${cat}" data-cpart="${cat}">${list.map(({ p, ok, why }) => `<option value="${p.id}" ${d.parts[cat] === p.id ? 'selected' : ''} ${ok ? '' : 'disabled'}>${esc(p.name)}${ok ? `${p.tech != null && cp.parts[cat].w ? ` · tek ${p.tech}` : ''} · ${money(p.cost * cp.costScale)}` : ` (${why})`}</option>`).join('')}</select></label>`;
    const gfit = q && !q.issues.length ? PACK.genres.map((g, i) => `<span class="pill ${q.genre[i] >= 10 ? '' : q.genre[i] <= 7 ? 'warn' : ''}">${g.name} ${q.genre[i]}</span>`).join(' ') : '';
    const summary = q && !q.issues.length ? `<section class="box hl"><h3>${esc(q.name)} <small class="muted">${q.gen}. nesil · ${esc(typeName(d.type))}</small></h3>
        <div class="kv"><span>Teknoloji</span><b class="num">${q.tech} <small class="muted">dönem beklentisi ${q.expected} · kalite ×${q.quality.toFixed(2)}</small></b>
        <span>Yapım maliyeti</span><b class="num">${money(q.cost)}</b><span>İş yükü</span><b class="num">${cp.phases.length} × ${fmt(q.need)} puan</b>
        <span>Adet başı kâr</span><b class="num ${q.margin < 0 ? 'neg' : ''}">${money(q.margin)}</b><span>Çekicilik</span><b class="num">×${q.appeal.toFixed(2)}</b><span>Korsan riski</span><b class="num">%${Math.round(q.piracy * 100)}</b></div>
        <p class="small">Türlere uyum: ${gfit}</p></section>` : q ? `<p class="neg small">${q.issues.map(esc).join(' · ')}</p>` : '';
    return `<p class="muted small">Tip, aile ve bileşenleri seç. Bileşenler yıllar geçtikçe değişir (kartuş → kaset/disket → CD → DVD → Blu-ray → dijital → bulut) ve Ar-Ge'de "Donanım:" araştırmalarıyla açılır. Aynı ailenin yeni nesli eskisinin ününü taşır; eski nesil bir yıl daha satılır.</p>
      <h3 class="sub">Cihaz tipi</h3><div class="tiles">${tiles}</div>
      <div class="form"><label>Aile<select id="cn-series" data-con="series">${famOpts}</select></label>
        ${d.series === 'yeni' ? `<label>Aile adı<input id="cn-sname" data-con="seriesName" value="${esc(d.seriesName)}" maxlength="22"></label>` : ''}
        ${Object.entries(parts.cats).map(([cat, list]) => sel(cat, list)).join('')}
        <label>Fiyat stratejisi<select id="cn-price" data-con="price">${cp.prices.map((p) => `<option value="${p.id}" ${d.price === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}</select></label></div>
      ${summary}
      <div class="foot"><span class="muted small">Zararına satış kurulu tabanı büyütür (daha çok lisans geliri), premium az satar ama kârlıdır.</span><button class="primary" data-act="console" ${q && !q.issues.length ? '' : 'disabled'}>Üretime başla</button></div>${lists}`;
  }

  // ---------- GRAFİKLER: tek seri, ortak bir y ekseni, üzerine gelince çizgi + değer (kayıtlı veri app.charts'ta)
  function chart(id, values, { labels = [], fmtv = fmt, color = 'var(--sky)', kind = 'line', h = 150, barCls = '' } = {}) {
    if (!values.length) return '<p class="muted small">Henüz veri yok.</p>';
    app.charts[id] = { values, labels, fmtv };
    const W = 600, H = h, pl = 54, pr = 10, pt = 10, pb = 22;
    const max = Math.max(1, ...values), min = Math.min(0, ...values);
    const x = (i) => pl + (values.length === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (values.length - 1));
    const y = (v) => pt + ((max - v) * (H - pt - pb)) / (max - min || 1);
    const ticks = (min < 0 ? [max, 0, min] : [max, max / 2, 0]).map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pl - 6}" y="${y(v) + 4}" class="ax" text-anchor="end">${esc(fmtv(v))}</text>`).join('');
    let marks = '';
    if (kind === 'bar') {
      const bw = Math.max(4, Math.min(28, (W - pl - pr) / values.length - 4));
      marks = values.map((v, i) => { const x0 = pl + ((i + 0.5) * (W - pl - pr)) / values.length - bw / 2; const top = Math.min(y(v), y(0)), hh = Math.max(1, Math.abs(y(v) - y(0))); return `<rect x="${x0}" y="${top}" width="${bw}" height="${hh}" rx="2" class="${barCls || (v < 0 ? 'neg' : 'pos')}"/>`; }).join('');
    } else {
      const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      marks = `<polygon points="${pl},${y(Math.max(0, min))} ${pts} ${x(values.length - 1)},${y(Math.max(0, min))}" fill="${color}" opacity="0.14"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>
        <circle cx="${x(values.length - 1)}" cy="${y(values[values.length - 1])}" r="4" fill="${color}" stroke="var(--panel-2)" stroke-width="2"/>`;
    }
    const lab = labels.length ? `<text x="${pl}" y="${H - 6}" class="ax">${esc(labels[0])}</text><text x="${W - pr}" y="${H - 6}" class="ax" text-anchor="end">${esc(labels[labels.length - 1])}</text>` : '';
    return `<div class="chart" data-chart="${id}" data-kind="${kind}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(id)}">${ticks}${marks}${lab}<line class="cross" x1="0" x2="0" y1="${pt}" y2="${H - pb}" visibility="hidden"/></svg><div class="tip" hidden></div></div>`;
  }
  const spark = (vals) => {
    if (!vals || vals.length < 2) return '';
    const max = Math.max(1, ...vals);
    return `<svg class="spark" viewBox="0 0 60 16" preserveAspectRatio="none" aria-hidden="true"><polyline points="${vals.map((v, i) => `${(i * 60) / (vals.length - 1)},${15 - (v / max) * 14}`).join(' ')}" fill="none" stroke="var(--sky)" stroke-width="1.5"/></svg>`;
  };
  root.addEventListener('pointermove', (e) => {
    const box = e.target.closest?.('.chart');
    if (!box) return;
    const data = app.charts[box.dataset.chart];
    if (!data) return;
    const svg = box.querySelector('svg'), r = svg.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width * 600;
    const n = data.values.length, pl = 54, pr = 10;
    const i = box.dataset.kind === 'bar' ? Math.floor(((fx - pl) / (600 - pl - pr)) * n) : Math.round(((fx - pl) / (600 - pl - pr)) * (n - 1));
    const k = Math.max(0, Math.min(n - 1, i));
    const cx = box.dataset.kind === 'bar' ? pl + ((k + 0.5) * (600 - pl - pr)) / n : pl + (n === 1 ? 0 : (k * (600 - pl - pr)) / (n - 1));
    const cross = svg.querySelector('.cross'); cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    const tip = box.querySelector('.tip');
    tip.hidden = false; tip.textContent = `${data.labels[k] ?? ''} · ${data.fmtv(data.values[k])}`;
    tip.style.left = `${Math.min(r.width - 140, Math.max(0, (cx / 600) * r.width - 60))}px`;
  });
  root.addEventListener('pointerleave', (e) => {
    const box = e.target.closest?.('.chart');
    if (box) { box.querySelector('.tip').hidden = true; box.querySelector('.cross').setAttribute('visibility', 'hidden'); }
  }, true);

  // ---------- PAZAR
  function gameDetail(gm) {
    const g = G(), s = g.state, c = ctx();
    const P = PACK.post;
    const targets = Post.portTargets(c, gm);
    const canExp = Post.expansionAllowed(c, gm) && g.freeDevRooms().length;
    const wk = (gm.hist || []).map((_, i, a) => `${gm.weeks - a.length + i + 1}. hafta`);
    const actions = gm.active ? `<div class="btns">
        <button data-act="patch" data-id="${gm.id}" ${gm.patches >= P.patchMax ? 'disabled' : ''}>Güncelleme yayınla<small>${gm.patches >= P.patchMax ? 'sınırda' : money(Post.patchCost(c, gm))}</small></button>
        <button data-act="pricedrop" data-id="${gm.id}">Fiyatı %${Math.round(P.priceDropPct * 100)} düşür<small>${gm.price} $ → ${Math.max(P.priceFloor, Math.round(gm.price * (1 - P.priceDropPct)))} $</small></button>
      </div>` : '<p class="muted small">Oyun raflardan kalktı. Port ile yeni platformda yeniden çıkabilir.</p>';
    const port = !gm.expansion && !gm.portOf && targets.length ? `<div class="form"><label class="wide">Başka platforma uyarla (port)<select id="port-sel">${targets.map((p) => `<option value="${p.id}">${esc(p.name)} · ${money(Post.portCost(c, gm, p.id))}</option>`).join('')}</select></label></div>
      <div class="foot"><span class="muted small">Not −${P.portScorePenalty}, satış ×${P.portSales}.</span><button data-act="port" data-id="${gm.id}">Uyarla</button></div>` : '';
    const exp = !gm.expansion && !gm.portOf ? `<div class="foot"><span class="muted small">Ek paket: aynı konu ve türde kısa proje, temel oyunun satışlarına bağlı. ${Post.expansionAllowed(c, gm) ? '' : 'Bu oyun için artık yapılamaz.'}</span><button data-act="expansion" data-id="${gm.id}" ${canExp ? '' : 'disabled'}>Ek paket başlat</button></div>` : '';
    return `<div class="foot"><button class="ghost" data-act="back-game">← Oyunlar</button><span></span></div>
      <div class="proj-head"><div><h2>${esc(gm.name)}</h2><p class="muted small">${PACK.genres.find((x) => x.id === gm.genre).name} · ${gm.year} · ${gm.platforms.map((id) => esc(M.platformById(c, id)?.name || id)).join(', ')} · ${gm.price} $</p></div>
        <div class="forecast"><small>Not</small><b class="num">${gm.score}</b></div></div>
      <div class="stats4">
        <div><small>Bu hafta</small><b class="num">${gm.active ? fmt(gm.lastWeek) : '—'}</b></div>
        <div><small>Liste sırası</small><b class="num">${gm.active && gm.rank ? `#${gm.rank}` : '—'}</b>${gm.active && gm.rank ? move({ rank: gm.rank, prev: gm.prevRank }) : ''}<small>en iyi #${gm.bestRank && gm.bestRank < 999 ? gm.bestRank : '–'}</small></div>
        <div><small>Toplam kopya</small><b class="num">${fmt(gm.units)}</b></div>
        <div><small>Toplam gelir</small><b class="num">${money(gm.revenue)}</b></div>
      </div>
      <p class="muted small">Rafta ${gm.weeks} hafta${gm.active ? '' : ' (bitti)'} · güncelleme ${gm.patches || 0}/${P.patchMax} · ${gm.publisherId ? `yayıncı: ${esc(gm.publisherName || PACK.publishers.find((x) => x.id === gm.publisherId)?.name || '')}, pay %${Math.round((gm.royalty || 0) * 100)}` : 'kendi yayının'}</p>
      ${gm.critics?.[0]?.quote ? `<section class="box"><h3>Eleştirmenler</h3><ul class="quotes">${gm.critics.map((k) => `<li><b class="num">${String(k.score).replace('.', ',')}</b><span>${esc(k.name)}: “${esc(k.quote)}”</span></li>`).join('')}</ul>${gm.review?.genreNote ? `<p class="muted small">“${esc(gm.review.genreNote)}”</p>` : ''}</section>` : ''}
      <section class="box"><h3>Oyuncu raporu</h3>${gm.playerReport ? `<ul class="plist-r">${gm.playerReport.map((l) => `<li class="${l.tone}">${esc(l.text)}</li>`).join('')}</ul><p class="muted small">Öğrenilen görev önemleri faz pencerelerinde rozet olarak görünür.</p>`
        : `<div class="foot"><span class="muted small">Oyuncular neyi sevdi, neyi sevmedi? Görev bazında ne geliştirmen gerektiğini söyler.${gm.active && gm.weeks < PACK.playerReport.minWeeks ? ` ${PACK.playerReport.minWeeks - gm.weeks} hafta sonra hazırlanabilir.` : ''}</span><button data-act="report" data-id="${gm.id}" ${gm.active && gm.weeks < PACK.playerReport.minWeeks ? 'disabled' : ''}>Rapor çıkar · ${Know.reportCost(c) ? money(Know.reportCost(c)) : 'bedava'}</button></div>`}</section>
      <section class="box"><h3>Haftalık satış (kopya)</h3>${chart('game' + gm.id, gm.hist || [], { labels: wk, kind: 'bar', barCls: 'sky' })}</section>
      <section class="box"><h3>Haftalık gelir</h3>${chart('rev' + gm.id, gm.revHist || [], { labels: wk.slice(-(gm.revHist || []).length), fmtv: money, color: 'var(--mint)' })}</section>
      <section class="box"><h3>Platformlara göre</h3><div class="split-bars">${Object.entries(gm.sold || {}).sort((a, b) => b[1] - a[1]).map(([pid, u]) => `<div><span>${esc(M.platformById(c, pid)?.name || pid)}</span>${bar(gm.units ? (u / gm.units) * 100 : 0, 'prog')}<b class="num">${fmt(u)}</b></div>`).join('')}</div></section>
      <section class="box"><h3>Yayın sonrası</h3>${actions}${port}${exp}</section>`;
  }
  function winMarket(sub) {
    const s = G().state, c = ctx();
    if (sub === 'liste') return `<p class="muted small">Bu haftanın en çok satan ${PACK.rivals.topN} oyunu (senin ve rakiplerin). Senin oyunların vurgulu.</p>
      <ol class="toplist">${(s.top || []).map((t) => `<li class="${t.mine ? 'mine' : ''}"><span class="r">${t.rank}</span>${move(t)}<span>${esc(t.name)}<small>${esc(t.studio)}</small></span><b class="num">${fmt(t.units)}</b></li>`).join('') || '<li class="muted">Henüz satışta oyun yok.</li>'}</ol>`;
    if (sub === 'cikanlar') return `<ol class="charts">${s.charts.slice(0, 15).map((x) => `<li class="${x.mine ? 'mine' : ''}"><b class="num">${x.score}</b><span>${esc(x.name)}</span><small>${esc(x.studio)}</small></li>`).join('') || '<li class="muted">Henüz yok.</li>'}</ol>`;
    if (sub === 'rakip') return [...s.rivals].sort((a, b) => b.rep - a.rep).map((r) => `<div class="row-item"><div><b>${esc(r.name)}</b><small>itibar ${Math.round(r.rep)} · ${r.games} oyun · son ${r.lastScore || '—'}</small></div>${r.acquired ? '<span class="pill">Senin</span>' : r.hw ? '<span class="pill">platform devi</span>' : `<button data-act="acquire" data-id="${r.id}">${money(Market.rivalPrice(c, r))}</button>`}</div>`).join('');
    const gm = app.selGame && s.games.find((x) => x.id === app.selGame);
    if (gm) return gameDetail(gm);
    const tr = s.trend ? (s.trend.genre ? PACK.genres.find((x) => x.id === s.trend.genre).name : PACK.topics.find((t) => t[0] === s.trend.topic)[1]) : '—';
    const mods = s.marketMods.map((m) => { const e = PACK.eras.find((x) => x.id === m.id); return `<span class="pill ${m.salesMult < 1 ? 'warn' : ''}">${esc(e.title)} · satış ×${m.salesMult}</span>`; }).join('');
    const hist = s.salesHist.slice(-104);
    const labels = hist.map((h) => `Y${Math.floor(h.w / 48) + 1} A${Math.floor((h.w % 48) / 4) + 1}`);
    const games = [...s.games].reverse().map((x) => `<tr class="${x.active ? '' : 'dim'} click" data-game="${x.id}"><td>${esc(x.name)}${x.expansion ? ' <small>ek</small>' : x.portOf ? ' <small>port</small>' : ''}</td><td class="num">${x.score}</td><td class="num">${x.active && x.rank ? '#' + x.rank : '—'}</td><td>${spark((x.hist || []).slice(-26))}</td><td class="num">${x.active ? fmt(x.lastWeek) : '—'}</td><td class="num">${fmt(x.units)}</td><td class="num">${money(x.revenue)}</td></tr>`).join('');
    return `<div class="btns"><span class="pill">Trend: ${esc(tr)}</span>${mods}</div>
      <section class="box"><h3>Stüdyonun haftalık geliri (son 2 yıl)</h3>${chart('sales', hist.map((h) => h.r), { labels, fmtv: money, color: 'var(--mint)' })}</section>
      <p class="muted small">Ayrıntı, güncelleme, port ve ek paket için bir oyuna dokun.</p>
      <div class="scroll"><table><thead><tr><th>Oyun</th><th>Not</th><th>Sıra</th><th>Son 6 ay</th><th>Bu hf</th><th>Kopya</th><th>Gelir</th></tr></thead><tbody>${games || '<tr><td colspan="7" class="muted">Henüz oyun yok.</td></tr>'}</tbody></table></div>`;
  }

  // ---------- FİNANS
  function companyView() {
    const g = G(), s = g.state, c = ctx(), I = PACK.ipo;
    const co = Co.company(s), v = Co.valuation(c);
    const vh = co.valHist.slice(-120);
    const vchart = `<section class="box"><h3>Şirket değeri (aylık)</h3>${chart('val', vh, { labels: vh.map((_, i) => (i === vh.length - 1 ? 'şimdi' : `${vh.length - 1 - i} ay önce`)), fmtv: money, color: 'var(--amber)' })}</section>`;
    const head = `<section class="box"><div class="kv"><span>Şirket değeri</span><b class="num">${money(v)}</b><span>Son yıl faaliyet kârı</span><b class="num">${money(Co.operatingProfit(c, Math.floor(s.week / 48) - 1))}</b>
      <span>Durum</span><b>${co.listed ? `Borsada · halka açık %${Math.round(co.pct * 100)}` : 'Özel şirket'}</b>${co.listed ? `<span>Hisse fiyatı</span><b class="num">${co.price} $</b>` : ''}</div>
      <p class="muted small">Değer = nakit − borç + son 3 yılın ortalama kârı × ${I.profitMult} + hayran, marka (IP) ve prestij.</p></section>`;
    if (!co.listed) {
      const need = Co.ipoCheck(c);
      return head + `<section class="box ${need.length ? '' : 'hl'}"><h3>Halka arz</h3>
        <p class="small">Hisselerinin bir kısmını satıp kasaya büyük para koy. Karşılığında her çeyrek (12 hafta) faaliyet gelirinin son 4 çeyreğin ortalamasını %${(I.growthTarget * 100).toFixed(1)} aşması beklenir; tutmazsa yönetim kurulu baskısı artar, %100'de seni görevden alırlar.</p>
        ${need.length ? `<ul class="todo">${need.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<div class="btns">${I.sellPcts.map((p) => `<button data-act="ipo" data-id="${p}">%${Math.round(p * 100)} sat<small>${money(v * p * I.discount)}</small></button>`).join('')}</div>`}</section>` + vchart;
    }
    const ph = co.priceHist.slice(-104);
    const q = co.quarters.map((x) => `<tr><td>Y${Math.floor(x.w / 48) + 1} A${Math.floor((x.w % 48) / 4) + 1}</td><td class="num">${money(x.rev)}</td><td class="num">${money(x.target)}</td><td class="${x.beat ? 'up' : 'down'}">${x.beat ? 'Aşıldı' : 'Kaçtı'}</td></tr>`).join('');
    const left = I.quarterWeeks - (s.week - co.qStart);
    return head + `<section class="box ${co.pressure >= I.boardAt ? 'hl' : ''}"><div class="head"><h3>Yönetim kurulu baskısı</h3><span class="pill ${co.pressure >= I.boardAt ? 'warn' : ''}">%${Math.round(co.pressure)}</span></div>${bar(co.pressure, 's')}
      <p class="muted small">Bu çeyreğin bitmesine ${left} hafta. Hedef: ${money(Co.quarterTarget(c))} faaliyet geliri, son 4 çeyreğin ortalaması +%${(I.growthTarget * 100).toFixed(1)} (şu an ${money(Co.quarterRevenue(c))}).</p>
      <div class="btns"><button data-act="dividend">Temettü dağıt<small>${money(Math.max(0, s.cash) * I.dividendShare * co.pct)}</small></button><button data-act="buyback">%5 hisse geri al<small>${money(Co.buybackCost(c))}</small></button></div></section>
      <section class="box"><h3>Hisse fiyatı</h3>${chart('price', ph, { labels: ph.map((_, i) => (i === ph.length - 1 ? 'şimdi' : `${ph.length - 1 - i} hf önce`)), fmtv: (x) => `${(+x).toFixed(2)} $`, color: 'var(--sky)' })}</section>
      ${q ? `<div class="scroll"><table><thead><tr><th>Çeyrek</th><th>Gelir</th><th>Hedef</th><th></th></tr></thead><tbody>${q}</tbody></table></div>` : ''}` + vchart;
  }
  function winFinance(sub) {
    if (sub === 'sirket') return companyView();
    const g = G(), s = g.state, c = ctx();
    const y = Math.floor(s.week / 48), years = [y - 2, y - 1, y].filter((v) => v >= 0);
    const cats = [...new Set(years.flatMap((v) => Object.keys(s.ledger.byYear[v] || {})))].sort();
    const yearName = (v) => String(Math.floor(PACK.meta.startYear + v / s.lengthMult));
    const head = years.map((v) => `<th>${yearName(v)}</th>`).join('');
    const rows = cats.map((k) => `<tr><td>${k.replace('_', ' ')}</td>${years.map((v) => { const a = (s.ledger.byYear[v] || {})[k] || 0; return `<td class="num ${a < 0 ? 'neg' : ''}">${a ? money(a) : '—'}</td>`; }).join('')}</tr>`).join('');
    const tot = `<tr class="tot"><td>Net</td>${years.map((v) => { const a = g.ctx.ledger.yearProfit(v); return `<td class="num ${a < 0 ? 'neg' : ''}">${money(a)}</td>`; }).join('')}</tr>`;
    const owed = s.loans.reduce((a, l) => a + l.remaining, 0), avail = Math.max(0, Eco.creditLimit(c) * 3 - owed);
    const allYears = Array.from({ length: y + 1 }, (_, i) => i).slice(-15);
    const cash = s.cashHist.slice(-120);
    return `<section class="box"><div class="kv"><span>Aylık maaş</span><b class="num">${money(s.staff.reduce((a, p) => a + p.salary, 0))}</b><span>Aylık kira</span><b class="num">${money(Eco.rent(c))}</b>
      <span>Kredi limiti</span><b class="num">${money(Eco.creditLimit(c))}</b><span>Borç</span><b class="num">${money(owed)}</b></div>
      ${s.debtWeeks ? `<p class="neg">Limit aşımı: ${s.debtWeeks}/${PACK.economy.bankruptWeeks} hafta. Sonra iflas.</p>` : ''}
      <p class="muted small">Kredi: 24 ay, yıllık %${Math.round(PACK.economy.loanRateYear * 100)}.</p>
      <div class="btns">${[0.25, 0.5, 1].map((f) => `<button data-act="loan" data-id="${Math.round(avail * f)}" ${avail < 1000 ? 'disabled' : ''}>${money(avail * f)} çek</button>`).join('')}</div></section>
      <section class="box"><h3>Kasa (aylık, son 10 yıl)</h3>${chart('cash', cash, { labels: cash.map((_, i) => `${cash.length - i} ay önce`).map((l, i, a) => (i === a.length - 1 ? 'şimdi' : l)), fmtv: money, color: 'var(--candy)' })}</section>
      <section class="box"><h3>Yıllık net kâr / zarar</h3>${chart('net', allYears.map((v) => g.ctx.ledger.yearProfit(v)), { labels: allYears.map(yearName), fmtv: money, kind: 'bar' })}</section>
      <div class="scroll"><table><thead><tr><th>Kalem</th>${head}</tr></thead><tbody>${rows}${tot}</tbody></table></div>`;
  }
  // ---------- OYUN DÜNYASI: yılın hitleri, şirketler, platformlar, tarih
  function winWorld(sub) {
    const s = G().state, c = ctx(), y = Math.floor(M.tableYear(c));
    const W = s.world || { hits: [], log: [] };
    const gname = (id) => PACK.genres.find((x) => x.id === id)?.name || id;
    if (sub === 'sirketler') {
      const list = World.companyBoard(c, 40);
      return `<p class="muted small">${y} yılında piyasadaki şirketler (güce göre). Platform devleri satın alınamaz. Yeni şirketler kurulur, eskiler zamanla piyasadan çekilir.</p>
        <div class="board">${list.map((r, i) => `<div class="row-item"><div><b>${i + 1}. ${esc(r.name)} ${r.hw ? '<span class="pill">platform</span>' : ''}${r.pub ? '<span class="pill">yayıncı</span>' : ''}</b>${bar(r.rep, 'prog')}<small>güç ${Math.round(r.rep)} · ${r.since} · ${r.games} oyun · son not ${r.lastScore || '—'}</small></div>${r.acquired ? '<span class="pill">Senin</span>' : r.hw ? '' : `<button data-act="acquire" data-id="${r.id}">${money(Market.rivalPrice(c, r))}</button>`}</div>`).join('')}</div>`;
    }
    if (sub === 'platformlar') {
      const sh = World.platformShares(c, (p) => M.platformBase(c, p));
      return `<p class="muted small">${y} yılında piyasadaki konsollar ve bilgisayarlar. Kurulu taban (milyon kişi) ve pazar payı.</p>
        <div class="split-bars">${sh.map((x) => `<div><span>${esc(x.p.name)}<small class="muted"> ${x.p.owner ? esc(World.companyById(x.p.owner)?.name || '') : x.p.kind === 'pc' ? 'bilgisayar' : ''}</small></span>${bar(x.share * 100, 'prog')}<b class="num">${x.b.toFixed(1)} M</b></div>`).join('')}</div>
        <p class="muted small">Yakında: ${PACK.platforms.filter((p) => p.from > M.tableYear(c) && p.from < M.tableYear(c) + 3).map((p) => `${esc(p.name)} (${p.from})`).join(', ') || '—'}</p>`;
    }
    if (sub === 'tarih') return `<ul class="news">${W.log.map((e) => `<li class="tarih"><small class="num">${World.MONTHS[e.m].slice(0, 3)} ${e.y}</small><span>${esc(e.t)}</span></li>`).join('') || '<li class="muted">Henüz yok.</li>'}</ul>`;
    const hits = W.hits.filter((h) => h.year === y);
    const ev = W.log.filter((e) => e.y === y).reverse();
    const mine = s.games.filter((g) => g.year === y);
    const rows = [...hits.map((h) => ({ ...h, mine: false })), ...mine.map((g) => ({ name: g.name, studio: s.companyName, score: g.score, genre: g.genre, mine: true }))].sort((a, b) => b.score - a.score);
    return `<div class="proj-head"><div><h2>${y}</h2><p class="muted small">${hits.length}/10 büyük oyun çıktı · ${s.rivals.length} şirket piyasada</p></div></div>
      <section class="box"><h3>Yılın oyunları</h3><ol class="charts">${rows.map((x) => `<li class="${x.mine ? 'mine' : ''}"><b class="num">${x.score}</b><span>${esc(x.name)}</span><small>${esc(x.studio)} · ${gname(x.genre)}</small></li>`).join('') || '<li class="muted">Bu yıl henüz büyük bir oyun çıkmadı.</li>'}</ol></section>
      <section class="box"><h3>Bu yılın olayları</h3><ul class="news">${ev.map((e) => `<li class="tarih"><small class="num">${World.MONTHS[e.m]}</small><span>${esc(e.t)}</span></li>`).join('') || '<li class="muted">Yeni yıl başladı.</li>'}</ul></section>`;
  }
  function winNews() {
    return `<ul class="news">${G().state.news.map((n) => `<li class="${n.type}"><small class="num">Y${Math.floor(n.w / 48) + 1}·A${Math.floor((n.w % 48) / 4) + 1}</small><span>${esc(n.t)}</span></li>`).join('')}</ul>`;
  }

  // --- diyaloglar: olaylar, faz dağılımı, yayın, eleştirmenler, kurulum
  function dialog(html, kind = '') {
    if (!app.dialog) app.wasRunningD = app.running || app.wasRunningD;
    app.dialog = kind || 'dlg';
    play(false);
    el.modal.innerHTML = `<div class="dialog ${kind}" role="dialog" aria-modal="true">${html}</div>`;
    el.modal.hidden = false;
    el.modal.querySelector('button.primary, button')?.focus();
  }
  function closeDialog() {
    app.dialog = null; el.modal.hidden = true; el.modal.innerHTML = '';
    if (G()?.state.pending.length) return showEvent();
    const resume = app.wasRunningD; app.wasRunningD = false;
    render();
    if (!app.win && resume) play(true);
  }
  function showEvent() {
    const g = G(), s = g.state;
    if (s.gameOver) {
      store((st) => st.removeItem(SAVE_KEY));
      return dialog(`<h2 class="big">${{ iflas: 'İFLAS', kurul: 'GÖREVDEN ALINDIN' }[s.gameOver.reason] || 'SON'}</h2><p>${esc(s.gameOver.text)}</p>
        <div class="kv"><span>Oyun</span><b class="num">${s.games.length}</b><span>Hayran</span><b class="num">${fmt(s.fans)}</b><span>Ödül</span><b class="num">${s.awards.length}</b><span>Skor</span><b class="num">${fmt(g.finalScore())}</b></div>
        <button class="primary block" data-act="newgame">Yeni kariyer</button>`, 'over');
    }
    const ev = s.pending[0];
    if (!ev) return;
    dialog(`<small class="muted">${g.cal().era} · ${g.cal().label}</small><h2>${esc(ev.title)}</h2><p>${esc(ev.text)}</p>
      <div class="choices">${ev.choices.map((ch, i) => `<button data-choice="${i}" class="${i === 0 ? 'primary' : ''}">${esc(ch.label)}</button>`).join('')}</div>`, 'event');
  }
  function phaseDialog(pj) {
    const genre = PACK.genres.find((x) => x.id === pj.genre);
    app.phaseSeen[pj.id] = pj.phase; app.dlgPid = pj.id;
    const ids = PACK.missions.map((m, i) => i).filter((i) => PACK.missions[i].phase === pj.phase);
    dialog(`<small class="muted">${esc(pj.name)} · ${genre.name}</small><h2>${PACK.production.phaseNames[pj.phase]}</h2>
      <p class="small">Ekibin zamanını bu fazın üç görevine dağıt. Rozetler oyuncu raporlarından öğrendiğin önemi gösterir; ? henüz bilinmiyor.</p>
      <div class="phase-sliders">${ids.map((i) => `<label class="slider"><span>${PACK.missions[i].name} ${(() => { const w = Know.known(ctx()).mission(pj.genre, i); return w == null ? '<em class="kn">?</em>' : badgeOf(Math.round(w * 10)); })()}</span>
        <input type="range" min="0" max="100" step="5" id="alloc-${i}" data-alloc="${i}" value="${pj.alloc[i]}"><b class="num" id="pct-${i}"></b></label>`).join('')}</div>
      <button class="primary block" data-act="close-dialog">Devam</button>`, 'phase');
    updatePhasePct();
  }
  function updatePhasePct() {
    const pj = G()?.state.projects.find((p) => p.id === app.dlgPid);
    if (!pj) return;
    const ids = PACK.missions.map((m, i) => i).filter((i) => PACK.missions[i].phase === pj.phase);
    const sum = ids.reduce((a, i) => a + pj.alloc[i], 0) || 1;
    for (const i of ids) { const b = el.modal.querySelector(`#pct-${i}`); if (b) b.textContent = `%${Math.round((pj.alloc[i] / sum) * 100)}`; }
  }
  function readyDialog(pj) {
    app.readySeen[pj.id] = true;
    dialog(`<h2>"${esc(pj.name)}" hazır</h2><p>İçerik tamamlandı. Ekip şimdi hataları ayıklıyor (${fmt(pj.bugs)} hata). İstediğin an yayınlayabilirsin.</p>
      <div class="choices"><button class="primary" data-act="go-release" data-pid="${pj.id}">Yayın ekranına git</button><button data-act="close-dialog">Biraz daha ayıklasınlar</button></div>`);
  }
  function reviewDialog(game, rv, report = []) {
    const verdict = rv.score >= 90 ? 'Başyapıt!' : rv.score >= 75 ? 'Çok iyi' : rv.score >= 60 ? 'Fena değil' : rv.score >= 40 ? 'Vasat' : 'Felaket';
    dialog(`<small class="muted">Eleştirmenler konuştu</small><h2>${esc(game.name)}</h2>
      <div class="critics">${rv.critics.map((k, i) => `<div class="critic" style="animation-delay:${0.25 + i * 0.35}s"><small>${esc(k.name)}</small><b class="num">${String(k.score).replace('.', ',')}</b>${k.quote ? `<q>${esc(k.quote)}</q>` : ''}</div>`).join('')}</div>
      <p class="verdict" style="animation-delay:1.8s"><b class="num">${String(rv.score).replace('.', ',')}</b> ${verdict}</p>
      ${rv.genreNote ? `<p class="gnote">“${esc(rv.genreNote)}”</p>` : ''}
      <div class="report"><h3>Oyun raporu</h3><ul>${report.map((l) => `<li class="${l.tone}">${esc(l.text)}</li>`).join('')}</ul><p class="muted small">Öğrendiklerin yeni oyun sihirbazında rozet olarak görünür.</p></div>
      <button class="primary block" data-act="close-dialog">Satışları izle</button>`, 'review');
  }
  function setupScreen() {
    const has = store((s) => s.getItem(SAVE_KEY));
    dialog(`<h1>X PROJECT</h1><p class="tag">Garajdan imparatorluğa. Ya da iflasa.</p>
      ${has ? '<button class="primary block" data-act="continue">Kayıtlı kariyere devam et</button><hr>' : ''}
      <div class="form">
        <label>Stüdyo adı<input id="n-company" value="Piksel & Kaos"></label>
        <label>Kurucu adı<input id="n-founder" value="Sen"></label>
        <label>Kurucunun alanı<select id="n-spec">${PACK.disciplines.map((d) => `<option value="${d.id}">${d.name} · ${Staff.career({ pack: PACK }, PACK.careerRules.founderCareer[d.id]).name}</option>`).join('')}</select></label>
        <label>Zorluk<select id="n-diff">${PACK.difficulties.map((d) => `<option value="${d.id}" ${d.id === 'kolay' ? 'selected' : ''}>${d.name} · ${money(d.startCash)}</option>`).join('')}</select></label>
        <label>Kariyer uzunluğu<select id="n-len">${Object.keys(PACK.meta.gameLengths).map((l) => `<option value="${l}" ${+l === PACK.meta.defaultLength ? 'selected' : ''}>${+l === 50 ? '50 yıl · tam tarih 1976–2025' : `${l} yıl`}</option>`).join('')}</select></label>
        <label>Tohum<input id="n-seed" type="number" value="${(Date.now() % 100000) | 0}"></label>
      </div>
      <button class="primary block big" data-act="begin">1976'da garajı aç</button>`, 'setup');
  }
  function start(game) {
    app.game = game; app.draft = null; app.wiz = 1; app.engineSel = new Set(); app.seenNews = game.state.news.length;
    app.phaseSeen = Object.fromEntries(game.state.projects.map((p) => [p.id, p.phase])); app.readySeen = Object.fromEntries(game.state.projects.filter((p) => p.status === 'debug').map((p) => [p.id, true]));
    app.sel = null; app.selGame = null; app.wizOn = false;
    app.dialog = null; app.wasRunningD = false; el.modal.hidden = true; el.modal.innerHTML = '';
    fit(); render();
    play(true);
    if (game.state.pending.length) return showEvent();
    if (!game.state.projects.length && !game.state.games.length) { app.sub.gelistir = 'oyun'; app.wizOn = true; openWin('gelistir'); }
  }

  // --- etkileşim
  root.addEventListener('click', (e) => {
    if (e.target === el.win) return closeWin();
    const row = e.target.closest('tr[data-game]');
    if (row) { app.selGame = +row.dataset.game; el.winBody.scrollTop = 0; return renderWindow(); }
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
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
        const res = g.release({ projectId: pid, publisherId: root.querySelector('#r-pub').value || null, price: Math.max(1, +root.querySelector('#r-price').value || 20) });
        if (!res.ok) return run(res);
        app.sel = null;
        const resume = app.wasRunning; app.wasRunning = false; closeWin(); app.wasRunningD = resume || true;
        return reviewDialog(res.game, res.review, res.report);
      }
      case 'crunch': g.toggleCrunch(); return render();
      case 'cancel': return twice('cancel' + pid, () => { app.sel = null; return g.cancelProject(pid); });
      case 'campaign': return run(g.campaign(pid, id));
      case 'outsource': return run(g.outsource(pid, +id));
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
    if (!g) return;
    if (t.dataset.draft) { app.draft[t.dataset.draft] = t.value; if (t.dataset.draft !== 'name') { t.blur(); renderWindow(); } return; }
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
    if (t.dataset.draft === 'name') app.draft.name = t.value;
    if (t.dataset.con === 'seriesName') app.consoleDraft.seriesName = t.value;
  });
  document.addEventListener('keydown', (e) => {
    if (!G()) return;
    if (e.key === 'Escape' && app.win) return closeWin();
    if (e.key === ' ' && !blocked() && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName || '')) { e.preventDefault(); play(!app.running); }
  });

  requestAnimationFrame(loop);
  fit();
  const fresh = (j) => { try { return JSON.parse(j).version >= 2; } catch { return false; } };
  if (hotData.save && fresh(hotData.save)) start(loadGame(hotData.save));
  else setupScreen();
}
