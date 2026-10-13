// Arayüz (GDT/Kairosoft esinli): tam ekran sahne, üstte HUD ve proje sayacı, altta ikonlu menü,
// menüden açılan pencereler (açıkken oyun durur), adım adım yeni oyun sihirbazı, faz başında dağılım
// penceresi, yayında eleştirmen ekranı. Oyun mantığı game.js'te; burası yalnızca çağırır ve gösterir.
import { newGame, loadGame, M, Prod, Eco, Market, Staff, Con } from '../game.js';
import { PACK } from '../data/pack.js';
import { makeRenderer, menuIcon } from './render.js';
import { money } from '../kernel.js';

const SAVE_KEY = 'xproject-save-v2';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('tr-TR');
const pct = (v) => Math.max(0, Math.min(100, v));
const bar = (v, cls = '') => `<span class="bar ${cls}"><i style="width:${pct(v)}%"></i></span>`;
const discName = (id) => PACK.disciplines.find((d) => d.id === id).name;
const STATUS = { hasta: 'Hasta', tukenmis: 'Tükenmiş', egitim: 'Eğitimde' };
const SPEEDS = [1, 2, 4, 8];
const kaosLabel = (k) => (k < 30 ? 'Sakin' : k < 55 ? 'Gergin' : k < 80 ? 'Kaotik' : 'Cehennem');
const store = (fn) => { try { return fn(window.localStorage); } catch { return null; } };
const MENU = [['gelistir', 'Geliştir'], ['personel', 'Personel'], ['ofis', 'Ofis'], ['arge', 'Ar-Ge'], ['pazar', 'Pazar'], ['finans', 'Finans'], ['gunluk', 'Günlük']];
const SUBS = { gelistir: [['oyun', 'Oyun'], ['sozlesme', 'Sözleşme']], arge: [['arastirma', 'Araştırma'], ['motor', 'Motor'], ['konsol', 'Konsol']], pazar: [['oyunlar', 'Oyunların'], ['liste', 'Son çıkanlar'], ['rakip', 'Rakipler']] };

export function boot(root, hotData = {}) {
  const app = {
    game: null, running: false, speed: 1, frame: 0, timer: null, win: null, sub: {}, wasRunning: false, wasRunningD: false, dialog: null,
    draft: null, wiz: 1, engineSel: new Set(), engineName: 'Motor', consoleDraft: { name: 'X Kutu', type: 'konsol', cpu: '', media: '' },
    confirm: null, expanded: new Set(), seenNews: 0, lastPhase: null, askedRelease: null,
  };
  const $ = (id) => root.querySelector(id);
  const el = { stage: $('#stage'), canvas: $('#scene'), hud: $('#hud'), menu: $('#menu'), notes: $('#notes'), win: $('#win'), winTitle: $('#win-title'), winBody: $('#win-body'), modal: $('#modal') };
  const draw = makeRenderer(el.canvas);
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
    const pj = g.state.project;
    if (pj && pj.status === 'dev' && pj.phase !== app.lastPhase) phaseDialog();
    else if (pj && pj.status === 'debug' && app.askedRelease !== pj.id) readyDialog();
  }
  function loop() {
    app.frame++;
    if (G()) draw(G().state, PACK, app.frame);
    requestAnimationFrame(loop);
  }
  function render() {
    renderHud();
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
    const pj = s.project, slot = f('proj');
    const key = pj ? `p${pj.id}` : 'none';
    if (slot.dataset.key !== key) {
      slot.dataset.key = key;
      slot.innerHTML = pj ? `<button class="proj" data-open="gelistir"><span class="pname"></span><span class="counters">${['oyn', 'gfx', 'ses', 'tek'].map((d) => `<b class="num c-${d}" title="${discName(d)}" data-d="${d}"></b>`).join('')}<b class="num c-bug" title="Hata" data-d="bug"></b></span><span class="bar prog"><i></i></span></button>`
        : '<button class="proj idle" data-open="gelistir"><span>Proje yok</span><small>Yeni oyun başlat</small></button>';
    }
    if (pj) {
      slot.querySelector('.pname').textContent = pj.name;
      for (const b of slot.querySelectorAll('[data-d]')) b.textContent = fmt(b.dataset.d === 'bug' ? pj.bugs : pj.points[b.dataset.d]);
      slot.querySelector('.bar i').style.width = `${pj.status === 'dev' ? pct((pj.week / pj.totalWeeks) * 100) : 100}%`;
    }
  }

  // --- alt menü: düğmeler bir kez kurulur; rozet ve seçili durum yerinde güncellenir.
  const icons = Object.fromEntries(MENU.map(([id]) => [id, menuIcon(id)]));
  function renderMenu() {
    const s = G()?.state;
    if (!s) return;
    if (!el.menu.children.length) el.menu.innerHTML = MENU.map(([id, name]) => `<button data-open="${id}"><img src="${icons[id]}" alt=""><span>${name}</span><em class="badge" hidden></em></button>`).join('');
    const unread = Math.max(0, s.news.length - app.seenNews);
    const badge = { gunluk: unread ? String(Math.min(unread, 99)) : '', gelistir: s.project?.status === 'debug' ? '!' : '', personel: s.staff.some((p) => p.status === 'tukenmis') ? '!' : '' };
    for (const b of el.menu.children) {
      const id = b.dataset.open, em = b.querySelector('.badge');
      b.classList.toggle('on', app.win === id);
      em.hidden = !badge[id];
      if (em.textContent !== (badge[id] || '')) em.textContent = badge[id] || '';
    }
  }

  // --- pencereler
  function openWin(id) {
    if (!app.win) app.wasRunning = app.running;
    app.win = id; app.confirm = null;
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
    const id = app.win, name = MENU.find((m) => m[0] === id)[1];
    const subs = SUBS[id];
    const sub = app.sub[id] || subs?.[0][0];
    const fn = { gelistir: winDevelop, personel: winStaff, ofis: winOffice, arge: winResearch, pazar: winMarket, finans: winFinance, gunluk: winNews }[id];
    el.winTitle.innerHTML = `<img src="${icons[id]}" alt=""> ${name}`;
    const tabs = subs ? `<div class="seg" role="tablist">${subs.map(([k, n]) => `<button role="tab" data-sub="${k}" aria-selected="${sub === k}" class="${sub === k ? 'on' : ''}">${n}</button>`).join('')}</div>` : '';
    const top = el.winBody.scrollTop;
    setHTML(el.winBody, tabs + fn(sub));
    el.winBody.scrollTop = top;
  }

  // ---------- GELİŞTİR
  function defaultDraft() {
    const g = G(), y = M.tableYear(ctx());
    const r = PACK.rivals, pick = (a) => a[(g.state.week + g.state.games.length * 3) % a.length];
    return { name: `${pick(r.gameNamesA)} ${pick(r.gameNamesB)}`, genre: 'aksiyon', sub: '', topic: PACK.topics.find((t) => t[4] <= y)[0], audience: 'herkes', size: 'kucuk', engineId: '', sequelOf: '', platforms: ['pc'] };
  }
  function winDevelop(sub) {
    if (sub === 'sozlesme') return contractsView();
    return G().state.project ? projectView() : wizard();
  }
  function wizard() {
    const g = G(), s = g.state, c = ctx(), y = M.tableYear(c);
    const d = (app.draft ||= defaultDraft());
    const done = s.research.done, trend = s.trend || {};
    const steps = ['Fikir', 'Platform', 'Onay'];
    const head = `<ol class="steps">${steps.map((n, i) => `<li class="${app.wiz === i + 1 ? 'on' : app.wiz > i + 1 ? 'done' : ''}">${i + 1}. ${n}</li>`).join('')}</ol>`;
    const opt = (v, label, sel, dis = false) => `<option value="${v}" ${sel ? 'selected' : ''} ${dis ? 'disabled' : ''}>${esc(label)}</option>`;
    const nav = (back, nextLabel) => `<div class="foot">${back ? '<button data-act="wiz" data-id="-1">Geri</button>' : ''}<span></span><button class="primary" data-act="wiz" data-id="1">${nextLabel}</button></div>`;
    if (app.wiz === 1) {
      const genres = PACK.genres.filter((x) => !x.research || done[x.research]);
      const topics = PACK.topics.filter((t) => t[4] <= y);
      const tile = (key, id, label, on, hot) => `<button class="tile ${on ? 'on' : ''}" data-pick="${key}" data-id="${id}">${esc(label)}${hot ? '<em>trend</em>' : ''}</button>`;
      return head + `<label class="field">Oyunun adı<input id="f-name" data-draft="name" value="${esc(d.name)}" maxlength="40"></label>
        <h3>Konu</h3><div class="tiles">${topics.map((t) => tile('topic', t[0], t[1], d.topic === t[0], trend.topic === t[0])).join('')}</div>
        <h3>Tür</h3><div class="tiles">${genres.map((x) => tile('genre', x.id, x.name, d.genre === x.id, trend.genre === x.id)).join('')}</div>
        <div class="form"><label>Alt tür<select id="f-sub" data-draft="sub" ${done.alt_tur ? '' : 'disabled'}>${opt('', done.alt_tur ? 'Yok (−3)' : 'Araştırma gerekli (−3)', !d.sub)}${genres.filter((x) => x.id !== d.genre).map((x) => opt(x.id, x.name, d.sub === x.id)).join('')}</select></label>
        <label>Kitle<select id="f-aud" data-draft="audience">${PACK.audiences.map((a) => opt(a.id, a.name, d.audience === a.id)).join('')}</select></label></div>`
        + nav(false, 'Platforma geç');
    }
    if (app.wiz === 2) {
      const maxTech = PACK.workstations.tiers[s.stationTier].maxTech;
      const plats = M.activePlatforms(c).map((p) => {
        const locked = !p.own && p.tech > maxTech;
        return `<label class="pick ${locked ? 'locked' : ''}"><input type="checkbox" id="pl-${p.id}" data-plat="${p.id}" ${d.platforms.includes(p.id) ? 'checked' : ''} ${locked ? 'disabled' : ''}>
          <span class="name">${esc(p.name)}${p.own ? ' ★' : ''}</span><span class="meta num">${locked ? 'istasyon yetersiz' : `${M.platformBase(c, p).toFixed(1)} M kişi · ${p.licence ? money(p.licence) : 'lisanssız'}`}</span></label>`;
      }).join('');
      return head + `<fieldset class="picks"><legend>Platformlar</legend>${plats}</fieldset>
        <div class="form">
          <label>Boyut<select id="f-size" data-draft="size">${PACK.sizes.map((z) => { const lock = z.research && !done[z.research] ? ' (araştır)' : s.office.tier < z.office ? ` (${PACK.offices[z.office - 1].name})` : ''; return opt(z.id, `${z.name} · ${z.weeks} hf${lock}`, d.size === z.id, !!lock); }).join('')}</select></label>
          <label>Motor<select id="f-engine" data-draft="engineId">${opt('', 'Motorsuz', !d.engineId)}${s.engines.map((e) => opt(e.id, `${e.name} (${M.engineScore(c, e)})`, String(d.engineId) === String(e.id))).join('')}</select></label>
          <label class="wide">Seri<select id="f-ip" data-draft="sequelOf">${opt('', 'Yeni IP', !d.sequelOf)}${s.ips.map((ip) => opt(ip.id, `${ip.name} ★${ip.value.toFixed(1)}`, String(d.sequelOf) === String(ip.id))).join('')}</select></label>
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
  function projectView() {
    const g = G(), s = g.state, c = ctx(), pj = s.project;
    const genre = PACK.genres.find((x) => x.id === pj.genre);
    const topic = PACK.topics.find((t) => t[0] === pj.topic)[1];
    const prog = pj.status === 'dev' ? (pj.week / pj.totalWeeks) * 100 : 100;
    const pv = g.previewReview();
    const discs = ['oyn', 'gfx', 'ses', 'tek'].map((d) => { const v = (pj.points[d] / M.target(c, d, pj.size)) * 100; return `<div class="disc"><span>${discName(d)}</span>${bar(v, 'd-' + d)}<b class="num">${Math.round(Math.min(v, 999))}%</b></div>`; }).join('');
    const camps = PACK.hype.campaigns.filter((x) => !x.minYear || M.tableYear(c) >= x.minYear).map((x) => { const lock = x.research && !s.research.done[x.research]; return `<button data-act="campaign" data-id="${x.id}" ${lock ? 'disabled' : ''}>${x.name}<small>${lock ? 'araştır' : money(x.cost * M.inflation(c) ** 0.7)}</small></button>`; }).join('');
    const outs = PACK.outsource.rows.map((_, i) => Prod.outsourceRow(c, i)).filter((r) => r.office <= s.office.tier).map((r) => `<div class="row-item"><div><b>${esc(r.name)}</b><small>${discName(r.disc)} · +${fmt(r.points)} puan</small></div><button data-act="outsource" data-id="${r.i}" ${pj.status !== 'dev' ? 'disabled' : ''}>${money(r.fee)}</button></div>`).join('');
    let release = '';
    if (pj.status === 'debug') {
      const pubs = Market.publishersAvailable(c);
      release = `<section class="box hl"><h3>Yayına hazır</h3><div class="form">
        <label class="wide">Yayıncı<select id="r-pub">${pubs.map((p) => `<option value="${p.id}" ${s.fans < p.minFans ? 'disabled' : ''}>${esc(p.name)} · güç ${p.power} · pay %${Math.round(p.royalty * 100)}${s.fans < p.minFans ? ` (${fmt(p.minFans)} hayran)` : ''}</option>`).join('')}
          ${s.research.done.oz_yayin ? `<option value="">Kendi yayınım · güç ${Math.round(M.selfPublishPower(c))}</option>` : ''}</select></label>
        <label>Fiyat ($)<input id="r-price" type="number" min="1" max="120" value="${Math.max(10, Math.round(20 * M.inflation(c) ** 0.4))}"></label></div>
        <div class="foot"><span class="muted small">${fmt(pj.bugs)} hata kaldı. Beklemek hataları azaltır, maaş yer.</span><button class="primary big" data-act="release">Yayınla</button></div></section>`;
    }
    return `<div class="proj-head"><div><h2>${esc(pj.name)}</h2><p class="muted small">${genre.name}${pj.sub ? ' + ' + PACK.genres.find((x) => x.id === pj.sub).name : ''} · ${esc(topic)} · ${PACK.sizes.find((z) => z.id === pj.size).name}</p></div>
        <div class="forecast"><small>Şu an çıksa</small><b class="num">${Math.round(pv.score)}</b></div></div>
      <div class="progress"><span>${pj.status === 'dev' ? `${PACK.production.phaseNames[pj.phase]} · hafta ${pj.week}/${pj.totalWeeks}` : 'Hata ayıklama'}</span>${bar(prog, 'prog')}</div>
      ${release}
      <section class="box"><h3>Hedefe ulaşma</h3>${discs}<p class="muted small">${pv.notes.map(esc).join(' · ') || 'Ceza yok'} · Uyum ×${pv.F.toFixed(2)} · Hiza ×${pv.hiza.toFixed(2)} · Hype ${Math.round(pj.hype)}</p>
        ${pj.status === 'dev' ? '<div class="foot"><button data-act="phase">Zaman dağılımını ayarla</button></div>' : ''}</section>
      <section class="box"><h3>Pazarlama</h3><div class="btns">${camps}</div></section>
      <section class="box"><h3>Baskı</h3><div class="foot"><span class="muted small">Crunch: +%40 üretim; stres, hata ve skandal riski patlar.</span><button data-act="crunch" class="${s.crunch ? 'danger on' : ''}">${s.crunch ? 'Crunch\'ı bitir' : 'Crunch başlat'}</button></div></section>
      <details class="box"><summary><h3>Dış kaynak</h3></summary><p class="muted small">Tek seferlik ücretle anında puan. Pahalılaştıkça getirisi azalır.</p>${outs}</details>
      <div class="foot"><button class="ghost danger" data-act="cancel">${app.confirm === 'cancel' ? 'Emin misin? Tekrar bas' : 'Projeyi iptal et'}</button></div>`;
  }
  function contractsView() {
    const s = G().state;
    const cur = s.contract ? `<section class="box hl"><h3>${esc(s.contract.client)}</h3><p class="muted small">${esc(s.contract.job)} · ${money(s.contract.reward)}</p>
      ${bar((s.contract.progress / s.contract.need) * 100, 'prog')}<p class="muted small">${Math.round(s.contract.progress)}/${s.contract.need} puan · ${s.contract.deadline - s.week} hafta kaldı</p></section>` : '';
    const offers = s.contract ? '' : s.contractOffers.map((o) => `<div class="row-item"><div><b>${esc(o.client)}</b><small>${esc(o.job)} · ${o.need} puan · ${o.weeks} hafta</small></div><button data-act="contract" data-id="${o.id}">${money(o.reward)}</button></div>`).join('');
    return `<p class="muted small">Geliştirme odaları oyun yokken sözleşme yapar. Proje sürerken bir odayı Ofis penceresinden "Yalnızca sözleşme"ye al.</p>${cur}${offers || (cur ? '' : '<p class="muted">Bu ay teklif yok.</p>')}`;
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
        <p class="muted small">${p.trait ? `Özellik: ${esc(PACK.traits.find((t) => t.id === p.trait).name)} · ` : ''}Kariyerler: ${Object.entries(p.careers).map(([k, v]) => `${Staff.career(c, k).name} ${v}`).join(', ')}</p></div>`;
    }
    return `<div class="person ${p.status !== 'ok' ? 'away' : ''} ${open ? 'open' : ''}">
      <button class="who" data-act="expand" data-id="${p.id}" aria-expanded="${open}">
        <span class="name">${p.founder ? '♛ ' : ''}${esc(p.name)}</span><span class="num pay">${p.founder ? 'kurucu' : money(p.salary)}</span>
        <span class="tagline"><span class="spec s-${p.spec}">${car.name} ${lvl}</span><span class="muted">${esc(Staff.roomType(c, room?.type || 'gelistirme').name)}</span>${status}</span>
        <span class="vit"><span class="num" title="Beceri">${Math.round(p.skill)}</span><span title="Moral">${bar(p.morale, 'm')}</span><span title="Stres">${bar(p.stress, 's')}</span></span>
      </button>${actions}</div>`;
  }
  function winStaff() {
    const s = G().state, c = ctx();
    const apps = s.applicants.map((p) => `<div class="row-item"><div><b>${esc(p.name)}</b><small><span class="spec s-${p.spec}">${Staff.career(c, p.career).name} ${p.careers[p.career]}</span> beceri ${p.skill}${p.trait ? ' · ' + esc(PACK.traits.find((t) => t.id === p.trait).name) : ''}</small></div>
      <button data-act="hire" data-id="${p.id}" ${s.staff.length >= Staff.seats(c) ? 'disabled' : ''}>${money(p.salary)}/ay</button></div>`).join('');
    return `<div class="legend"><span>Beceri</span><span><i class="dot m"></i>Moral</span><span><i class="dot s"></i>Stres</span><span class="muted">Ayrıntı için isme dokun</span></div>
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
      const mode = r.type === 'gelistirme' ? `<select id="md-${r.id}" data-act="mode" data-id="${r.id}" aria-label="Oda modu">${Object.entries(PACK.rooms.modes).map(([k, v]) => `<option value="${k}" ${r.mode === k ? 'selected' : ''}>${v}</option>`).join('')}</select>` : '';
      return `<section class="box room r-${r.type}"><div class="head"><h3>${t.name}</h3><span class="pill">${people.length}/${cap}</span></div>
        <p class="muted small">${t.desc}</p>${mode}
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
      ${build}<div class="grid">${rooms}</div>`;
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
    const av = Prod.researchAvailable(c).map((r) => {
      const i = Prod.researchInfo(c, r), can = s.research.rp >= i.rp && !s.research.current;
      return `<div class="row-item"><div><b>${esc(r.name)}</b><small>${i.rp} RP · ${i.weeks} hafta</small></div><button data-act="research" data-id="${r.id}" ${can ? '' : 'disabled'}>${money(i.cost)}</button></div>`;
    }).join('');
    return `<div class="rp"><b class="num">${Math.floor(s.research.rp)}</b><span>araştırma puanı</span></div>${cur}
      <p class="muted small">Herkes üretiminin bir kısmını RP'ye çevirir; Araştırma odasındakiler çok daha fazla. RP kariyer seviyesine de harcanır.</p>${av || '<p class="muted">Şimdilik yeni bir şey yok. Yıllar geçtikçe açılır.</p>'}`;
  }
  function consoleView() {
    const s = G().state, c = ctx(), cp = PACK.console;
    const mine = s.consoles.filter((k) => k.launched).map((k) => `<div class="row-item"><div><b>${esc(k.name)}</b><small>Teknoloji ${k.tech} · ${fmt(k.sold)} adet · ${k.retired ? 'emekli' : k.ended ? 'üretim bitti' : 'piyasada'}</small></div></div>`).join('');
    const job = s.consoles.find((k) => k.id === s.consoleJob);
    if (job) return `<section class="box hl"><h3>${esc(job.name)} · ${cp.phases[job.phase]} (${job.phase + 1}/${cp.phases.length})</h3>${bar((job.points / job.need) * 100, 'prog')}<p class="muted small">${fmt(job.points)}/${fmt(job.need)} donanım puanı. Laboratuvardakiler üretir; mühendisler çok daha hızlı.</p></section>${mine}`;
    const block = Con.consoleBlockers(c);
    if (block.length) return `<p class="muted">Kendi konsolunu yapmak için eksikler:</p><ul class="todo">${block.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>${mine}`;
    const parts = Con.consoleParts(c), d = app.consoleDraft;
    if (!parts.cpus.some((x) => x.id === d.cpu)) d.cpu = parts.cpus[0]?.id || '';
    if (!parts.media.some((x) => x.id === d.media)) d.media = parts.media[0]?.id || '';
    const q = Con.consoleQuote(c, d);
    const sel = (key, list) => `<select id="cn-${key}" data-con="${key}">${list.map((x) => `<option value="${x.id}" ${d[key] === x.id ? 'selected' : ''}>${x.name} · ${money(x.cost * cp.costScale)}</option>`).join('')}</select>`;
    return `<div class="form"><label class="wide">Konsol adı<input id="cn-name" data-con="name" value="${esc(d.name)}" maxlength="24"></label>
      <label>Tip${sel('type', parts.types)}</label><label>İşlemci${sel('cpu', parts.cpus)}</label><label class="wide">Medya${sel('media', parts.media)}</label></div>
      ${q ? `<p class="muted small">Teknoloji ${q.tech} · aşama başına ${fmt(q.need)} donanım puanı. Yapım boyunca oyun çıkmazsa hayran kaybedersin. Yeni konsol eskisini emekli eder.</p>` : ''}
      <div class="foot"><b class="num">${q ? money(q.cost) : ''}</b><button class="primary" data-act="console" ${q ? '' : 'disabled'}>Konsolu yap</button></div>${mine}`;
  }

  // ---------- PAZAR
  function winMarket(sub) {
    const s = G().state, c = ctx();
    if (sub === 'liste') return `<ol class="charts">${s.charts.slice(0, 15).map((x) => `<li class="${x.mine ? 'mine' : ''}"><b class="num">${x.score}</b><span>${esc(x.name)}</span><small>${esc(x.studio)}</small></li>`).join('') || '<li class="muted">Henüz yok.</li>'}</ol>`;
    if (sub === 'rakip') return s.rivals.map((r) => `<div class="row-item"><div><b>${esc(r.name)}</b><small>itibar ${Math.round(r.rep)} · ${r.games} oyun · son ${r.lastScore || '—'}</small></div>${r.acquired ? '<span class="pill">Senin</span>' : `<button data-act="acquire" data-id="${r.id}">${money(Market.rivalPrice(c, r))}</button>`}</div>`).join('');
    const tr = s.trend ? (s.trend.genre ? PACK.genres.find((x) => x.id === s.trend.genre).name : PACK.topics.find((t) => t[0] === s.trend.topic)[1]) : '—';
    const mods = s.marketMods.map((m) => { const e = PACK.eras.find((x) => x.id === m.id); return `<span class="pill ${m.salesMult < 1 ? 'warn' : ''}">${esc(e.title)} · satış ×${m.salesMult}</span>`; }).join('');
    const games = [...s.games].reverse().map((x) => `<tr class="${x.active ? '' : 'dim'}"><td>${esc(x.name)}</td><td class="num">${x.score}</td><td class="num">${fmt(x.units)}</td><td class="num">${money(x.revenue)}</td><td class="num">${x.active ? fmt(x.lastWeek) : x.mmo && x.subs > 0 ? fmt(x.subs) + ' ab.' : '—'}</td></tr>`).join('');
    return `<div class="btns"><span class="pill">Trend: ${esc(tr)}</span>${mods}</div><div class="scroll"><table><thead><tr><th>Oyun</th><th>Not</th><th>Kopya</th><th>Gelir</th><th>Bu hf</th></tr></thead><tbody>${games || '<tr><td colspan="5" class="muted">Henüz oyun yok.</td></tr>'}</tbody></table></div>`;
  }

  // ---------- FİNANS
  function winFinance() {
    const g = G(), s = g.state, c = ctx();
    const y = Math.floor(s.week / 48), years = [y - 2, y - 1, y].filter((v) => v >= 0);
    const cats = [...new Set(years.flatMap((v) => Object.keys(s.ledger.byYear[v] || {})))].sort();
    const head = years.map((v) => `<th>${Math.floor(PACK.meta.startYear + v / s.lengthMult)}</th>`).join('');
    const rows = cats.map((k) => `<tr><td>${k.replace('_', ' ')}</td>${years.map((v) => { const a = (s.ledger.byYear[v] || {})[k] || 0; return `<td class="num ${a < 0 ? 'neg' : ''}">${a ? money(a) : '—'}</td>`; }).join('')}</tr>`).join('');
    const tot = `<tr class="tot"><td>Net</td>${years.map((v) => { const a = g.ctx.ledger.yearProfit(v); return `<td class="num ${a < 0 ? 'neg' : ''}">${money(a)}</td>`; }).join('')}</tr>`;
    const owed = s.loans.reduce((a, l) => a + l.remaining, 0), avail = Math.max(0, Eco.creditLimit(c) * 3 - owed);
    return `<section class="box"><div class="kv"><span>Aylık maaş</span><b class="num">${money(s.staff.reduce((a, p) => a + p.salary, 0))}</b><span>Aylık kira</span><b class="num">${money(Eco.rent(c))}</b>
      <span>Kredi limiti</span><b class="num">${money(Eco.creditLimit(c))}</b><span>Borç</span><b class="num">${money(owed)}</b></div>
      ${s.debtWeeks ? `<p class="neg">Limit aşımı: ${s.debtWeeks}/${PACK.economy.bankruptWeeks} hafta. Sonra iflas.</p>` : ''}
      <p class="muted small">Kredi: 24 ay, yıllık %${PACK.economy.loanRateYear * 100}.</p>
      <div class="btns">${[0.25, 0.5, 1].map((f) => `<button data-act="loan" data-id="${Math.round(avail * f)}" ${avail < 1000 ? 'disabled' : ''}>${money(avail * f)} çek</button>`).join('')}</div></section>
      <div class="scroll"><table><thead><tr><th>Kalem</th>${head}</tr></thead><tbody>${rows}${tot}</tbody></table></div>`;
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
      return dialog(`<h2 class="big">${s.gameOver.reason === 'iflas' ? 'İFLAS' : 'SON'}</h2><p>${esc(s.gameOver.text)}</p>
        <div class="kv"><span>Oyun</span><b class="num">${s.games.length}</b><span>Hayran</span><b class="num">${fmt(s.fans)}</b><span>Ödül</span><b class="num">${s.awards.length}</b><span>Skor</span><b class="num">${fmt(g.finalScore())}</b></div>
        <button class="primary block" data-act="newgame">Yeni kariyer</button>`, 'over');
    }
    const ev = s.pending[0];
    if (!ev) return;
    dialog(`<small class="muted">${g.cal().era} · ${g.cal().label}</small><h2>${esc(ev.title)}</h2><p>${esc(ev.text)}</p>
      <div class="choices">${ev.choices.map((ch, i) => `<button data-choice="${i}" class="${i === 0 ? 'primary' : ''}">${esc(ch.label)}</button>`).join('')}</div>`, 'event');
  }
  function phaseDialog() {
    const pj = G().state.project, genre = PACK.genres.find((x) => x.id === pj.genre);
    app.lastPhase = pj.phase;
    const ids = PACK.missions.map((m, i) => i).filter((i) => PACK.missions[i].phase === pj.phase);
    dialog(`<small class="muted">${esc(pj.name)} · ${genre.name}</small><h2>${PACK.production.phaseNames[pj.phase]}</h2>
      <p class="small">Ekibin zamanını bu fazın üç görevine dağıt. ◆ işaretli görevler bu tür için kritik.</p>
      <div class="phase-sliders">${ids.map((i) => `<label class="slider"><span>${PACK.missions[i].name}${genre.mission[i] === 1 ? ' <i>◆</i>' : ''}</span>
        <input type="range" min="0" max="100" step="5" id="alloc-${i}" data-alloc="${i}" value="${pj.alloc[i]}"><b class="num" id="pct-${i}"></b></label>`).join('')}</div>
      <button class="primary block" data-act="close-dialog">Devam</button>`, 'phase');
    updatePhasePct();
  }
  function updatePhasePct() {
    const pj = G()?.state.project;
    if (!pj) return;
    const ids = PACK.missions.map((m, i) => i).filter((i) => PACK.missions[i].phase === pj.phase);
    const sum = ids.reduce((a, i) => a + pj.alloc[i], 0) || 1;
    for (const i of ids) { const b = el.modal.querySelector(`#pct-${i}`); if (b) b.textContent = `%${Math.round((pj.alloc[i] / sum) * 100)}`; }
  }
  function readyDialog() {
    const pj = G().state.project;
    app.askedRelease = pj.id;
    dialog(`<h2>"${esc(pj.name)}" hazır</h2><p>İçerik tamamlandı. Ekip şimdi hataları ayıklıyor (${fmt(pj.bugs)} hata). İstediğin an yayınlayabilirsin.</p>
      <div class="choices"><button class="primary" data-act="go-release">Yayın ekranına git</button><button data-act="close-dialog">Biraz daha ayıklasınlar</button></div>`);
  }
  function reviewDialog(game, rv) {
    const verdict = rv.score >= 90 ? 'Başyapıt!' : rv.score >= 75 ? 'Çok iyi' : rv.score >= 60 ? 'Fena değil' : rv.score >= 40 ? 'Vasat' : 'Felaket';
    dialog(`<small class="muted">Eleştirmenler konuştu</small><h2>${esc(game.name)}</h2>
      <div class="critics">${rv.critics.map((k, i) => `<div class="critic" style="animation-delay:${0.25 + i * 0.35}s"><small>${esc(k.name)}</small><b class="num">${k.score}</b></div>`).join('')}</div>
      <p class="verdict" style="animation-delay:1.8s"><b class="num">${rv.score}</b> ${verdict}</p>
      <p class="muted small">${rv.notes.map(esc).join(' · ') || 'Ceza yok'}</p>
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
        <label>Kariyer uzunluğu<select id="n-len">${Object.keys(PACK.meta.gameLengths).map((l) => `<option value="${l}" ${+l === PACK.meta.defaultLength ? 'selected' : ''}>${l} yıl</option>`).join('')}</select></label>
        <label>Tohum<input id="n-seed" type="number" value="${(Date.now() % 100000) | 0}"></label>
      </div>
      <button class="primary block big" data-act="begin">1976'da garajı aç</button>`, 'setup');
  }
  function start(game) {
    app.game = game; app.draft = null; app.wiz = 1; app.engineSel = new Set(); app.seenNews = game.state.news.length;
    app.lastPhase = game.state.project?.phase ?? null; app.askedRelease = game.state.project?.status === 'debug' ? game.state.project.id : null;
    app.dialog = null; app.wasRunningD = false; el.modal.hidden = true; el.modal.innerHTML = '';
    fit(); render();
    play(true);
    if (game.state.pending.length) return showEvent();
    if (!game.state.project && !game.state.games.length) { app.sub.gelistir = 'oyun'; openWin('gelistir'); }
  }

  // --- etkileşim
  root.addEventListener('click', (e) => {
    if (e.target === el.win) return closeWin();
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const g = G();
    if (b.dataset.open) return app.win === b.dataset.open ? closeWin() : openWin(b.dataset.open);
    if (b.dataset.sub) { app.sub[app.win] = b.dataset.sub; el.winBody.scrollTop = 0; return renderWindow(); }
    if (b.dataset.pick) { app.draft[b.dataset.pick] = b.dataset.id; if (b.dataset.pick === 'genre' && app.draft.sub === b.dataset.id) app.draft.sub = ''; return renderWindow(); }
    if (b.dataset.choice !== undefined) { g.resolve(+b.dataset.choice); save(); return closeDialog(); }
    const act = b.dataset.act, id = b.dataset.id;
    const twice = (key, fn) => { if (app.confirm === key) { app.confirm = null; return run(fn()); } app.confirm = key; return render(); };
    switch (act) {
      case 'close-win': return closeWin();
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
      case 'start': {
        const d = app.draft;
        const res = g.startProject({ ...d, engineId: d.engineId ? +d.engineId : null, sequelOf: d.sequelOf ? +d.sequelOf : null, sub: d.sub || null });
        if (!res.ok) return run(res);
        app.draft = null; app.wiz = 1; app.wasRunning = false;
        closeWin(); app.wasRunningD = true;
        return phaseDialog();
      }
      case 'phase': if (app.win) { closeWin(); app.wasRunningD = app.wasRunning; } return phaseDialog();
      case 'go-release': app.dialog = null; el.modal.hidden = true; app.sub.gelistir = 'oyun'; openWin('gelistir'); app.wasRunning = app.wasRunningD; app.wasRunningD = false; return;
      case 'release': {
        const res = g.release({ publisherId: root.querySelector('#r-pub').value || null, price: Math.max(1, +root.querySelector('#r-price').value || 20) });
        if (!res.ok) return run(res);
        const resume = app.wasRunning; app.wasRunning = false; closeWin(); app.wasRunningD = resume || true;
        return reviewDialog(res.game, res.review);
      }
      case 'crunch': g.toggleCrunch(); return render();
      case 'cancel': return twice('cancel', () => g.cancelProject());
      case 'campaign': return run(g.campaign(id));
      case 'outsource': return run(g.outsource(+id));
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
      case 'console': return run(g.startConsole({ ...app.consoleDraft }));
      case 'loan': return run(g.takeLoan(+id));
      case 'acquire': return run(g.acquireRival(+id));
    }
  });
  root.addEventListener('change', (e) => {
    const t = e.target, g = G();
    if (!g) return;
    if (t.dataset.draft) { app.draft[t.dataset.draft] = t.value; if (t.dataset.draft !== 'name') { t.blur(); renderWindow(); } return; }
    if (t.dataset.plat) { const set = new Set(app.draft.platforms); t.checked ? set.add(t.dataset.plat) : set.delete(t.dataset.plat); app.draft.platforms = [...set]; return; }
    if (t.dataset.feat) { t.checked ? app.engineSel.add(t.dataset.feat) : app.engineSel.delete(t.dataset.feat); return; }
    if (t.dataset.eng) { app.engineName = t.value; return; }
    if (t.dataset.con) { app.consoleDraft[t.dataset.con] = t.value; if (t.dataset.con !== 'name') { t.blur(); renderWindow(); } return; }
    const id = +t.dataset.id;
    if (t.dataset.act === 'move') { t.blur(); return run(g.moveStaff(id, +t.value)); }
    if (t.dataset.act === 'mode') { g.setRoomMode(id, t.value); t.blur(); return render(); }
    if (t.dataset.act === 'train' && t.value) { t.blur(); return run(g.train(id, t.value)); }
    if (t.dataset.act === 'career' && t.value) { t.blur(); return run(g.changeCareer(id, t.value)); }
  });
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.alloc !== undefined) { G().setAlloc(+t.dataset.alloc, +t.value); updatePhasePct(); }
    if (t.dataset.draft === 'name') app.draft.name = t.value;
    if (t.dataset.con === 'name') app.consoleDraft.name = t.value;
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
