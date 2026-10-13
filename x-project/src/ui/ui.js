// Arayüz: üst çubuk, sahne + durum şeridi, sekmeli yönetim paneli, olay pencereleri, kayıt.
// Oyun mantığı game.js'te; burası yalnızca çağırır ve gösterir.
import { newGame, loadGame, M, Prod, Eco, Market, Staff, Con } from '../game.js';
import { PACK } from '../data/pack.js';
import { makeRenderer } from './render.js';
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

export function boot(root, hotData = {}) {
  const app = {
    game: null, running: false, speed: 1, tab: 'proje', frame: 0, timer: null,
    draft: null, engineSel: new Set(), engineName: 'Motor', consoleDraft: { name: 'X Kutu', type: 'konsol', cpu: '', media: '' },
    confirm: null, open: new Set(), expanded: new Set(), seenNews: 0,
  };
  const el = {
    top: root.querySelector('#top'), canvas: root.querySelector('#scene'), status: root.querySelector('#status'),
    panel: root.querySelector('#panel'), tabs: root.querySelector('#tabs'), modal: root.querySelector('#modal'), toast: root.querySelector('#toast'),
  };
  const draw = makeRenderer(el.canvas);
  const G = () => app.game;
  const ctx = () => app.game.ctx;

  // --- kayıt
  const save = () => { if (G()) store((s) => s.setItem(SAVE_KEY, G().save())); };
  window.claude?.hot?.snapshot?.(() => ({ save: G() ? G().save() : null, tab: app.tab }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  function toast(msg, bad = true) {
    el.toast.textContent = msg; el.toast.className = bad ? 'show bad' : 'show';
    clearTimeout(toast.t); toast.t = setTimeout(() => (el.toast.className = ''), 2800);
  }
  const run = (res) => { if (res && res.ok === false) toast(res.msg); render(true); return res; };

  // --- zaman
  function play(on) {
    app.running = on;
    clearInterval(app.timer);
    if (on) app.timer = setInterval(step, PACK.meta.msPerWeek[app.speed]);
    renderTop();
  }
  function step() {
    const g = G();
    if (!g) return;
    if (g.state.pending.length || g.state.gameOver) return showModal();
    const before = g.state.news.length ? g.state.news[0] : null;
    g.tick();
    if (g.state.week % 4 === 0) save();
    const fresh = [];
    for (const n of g.state.news) { if (n === before) break; fresh.push(n); }
    const worst = fresh.find((n) => n.type === 'bad');
    if (worst) toast(worst.t);
    render(false);
    if (g.state.pending.length || g.state.gameOver) showModal();
  }
  function loop() {
    app.frame++;
    if (G()) draw(G().state, PACK, app.frame);
    requestAnimationFrame(loop);
  }
  function render(force) {
    renderTop();
    renderStatus();
    renderTabs();
    const a = document.activeElement;
    const typing = a && el.panel.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'SELECT');
    if (force || !typing) renderPanel();
  }

  // --- üst çubuk
  function renderTop() {
    const g = G();
    if (!g) { el.top.innerHTML = ''; return; }
    const s = g.state, cal = g.cal(), c = ctx();
    const k = Math.round(s.kaos);
    const stars = Math.round(M.studioStars(c));
    el.top.innerHTML = `
      <div class="brand"><b>${esc(s.companyName)}</b><small>${esc(Eco.office(c).name)} · <span class="stars" aria-label="${stars} yıldız">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span></small></div>
      <div class="stats">
        <div class="stat"><small>${cal.label}</small><b class="num">${cal.era}</b></div>
        <div class="stat"><small>Kasa</small><b class="num ${s.cash < 0 ? 'neg' : ''}">${money(s.cash)}</b></div>
        <div class="stat"><small>Hayran</small><b class="num">${fmt(s.fans)}</b></div>
        <div class="stat kaos k${k < 30 ? 0 : k < 55 ? 1 : k < 80 ? 2 : 3}"><small>Kaos · ${kaosLabel(k)}</small><b class="num">${k}</b>${bar(k, 'kbar')}</div>
      </div>
      <div class="time">
        <button id="btn-play" data-act="play" class="${app.running ? '' : 'primary'}" aria-label="${app.running ? 'Durdur' : 'Oynat'}">${app.running ? '❚❚' : '▶'}</button>
        <button id="btn-speed" data-act="speed" aria-label="Hız">${app.speed}×</button>
      </div>`;
  }

  // --- durum şeridi: süren işler, tıklanınca ilgili sekme
  function renderStatus() {
    const g = G();
    if (!g) { el.status.innerHTML = ''; return; }
    const s = g.state, items = [];
    if (s.project) {
      const pj = s.project;
      const v = pj.status === 'dev' ? (pj.week / pj.totalWeeks) * 100 : 100;
      items.push(`<button class="job" data-tab="proje"><span>🎮 ${esc(pj.name)}</span>${bar(v, 'prog')}<small>${pj.status === 'dev' ? `${pj.week}/${pj.totalWeeks} hf` : `Hazır · ${Math.round(pj.bugs)} hata`}</small></button>`);
    } else items.push('<button class="job idle" data-tab="proje"><span>🎮 Proje yok</span><small>Yeni oyun başlat</small></button>');
    if (s.contract) items.push(`<button class="job" data-tab="proje"><span>📝 ${esc(s.contract.client)}</span>${bar((s.contract.progress / s.contract.need) * 100, 'prog')}<small>${s.contract.deadline - s.week} hf kaldı</small></button>`);
    if (s.research.current) { const it = PACK.research.find((r) => r.id === s.research.current.id); items.push(`<button class="job" data-tab="arge"><span>🔬 ${esc(it.name)}</span><small>${s.research.current.weeksLeft} hf</small></button>`); }
    const job = s.consoles.find((k) => k.id === s.consoleJob);
    if (job) items.push(`<button class="job" data-tab="arge"><span>🛠️ ${esc(job.name)}</span>${bar((job.points / job.need) * 100, 'prog')}<small>${PACK.console.phases[job.phase]}</small></button>`);
    if (s.crunch) items.push('<button class="job hot" data-tab="proje"><span>🔥 Crunch</span><small>stres patlıyor</small></button>');
    el.status.innerHTML = items.join('');
  }

  // --- sekmeler
  const TABS = [['proje', 'Proje'], ['ofis', 'Ofis'], ['arge', 'Ar-Ge'], ['pazar', 'Pazar'], ['finans', 'Finans'], ['gunluk', 'Günlük']];
  function renderTabs() {
    const s = G()?.state;
    const unread = s ? Math.max(0, s.news.length - app.seenNews) : 0;
    el.tabs.innerHTML = TABS.map(([id, n]) => `<button role="tab" id="tab-${id}" data-tab="${id}" aria-selected="${app.tab === id}" class="${app.tab === id ? 'on' : ''}">${n}${id === 'gunluk' && unread && app.tab !== 'gunluk' ? `<span class="badge">${Math.min(unread, 99)}</span>` : ''}</button>`).join('');
  }
  function renderPanel() {
    if (!G()) return;
    if (app.tab === 'gunluk') app.seenNews = G().state.news.length;
    const fn = { proje: tabProject, ofis: tabOffice, arge: tabResearch, pazar: tabMarket, finans: tabFinance, gunluk: tabNews }[app.tab];
    const top = el.panel.scrollTop;
    el.panel.innerHTML = fn();
    el.panel.scrollTop = top;
  }
  // Açılır bölüm; açık/kapalı durumu yeniden çizimde korunur.
  const section = (key, title, body, extra = '') => `<details class="card" data-key="${key}" ${app.open.has(key) ? 'open' : ''}><summary><h2>${title}</h2>${extra}</summary><div class="body">${body}</div></details>`;
  const card = (title, body, extra = '') => `<section class="card"><div class="head"><h2>${title}</h2>${extra}</div>${body}</section>`;

  // ---------- PROJE
  function defaultDraft() {
    const g = G(), y = M.tableYear(ctx());
    const r = PACK.rivals, pick = (a) => a[(g.state.week + g.state.games.length * 3) % a.length];
    return { name: `${pick(r.gameNamesA)} ${pick(r.gameNamesB)}`, genre: 'aksiyon', sub: '', topic: PACK.topics.find((t) => t[4] <= y)[0], audience: 'herkes', size: 'kucuk', engineId: '', sequelOf: '', platforms: ['pc'] };
  }
  function tabProject() {
    const s = G().state;
    return (s.project ? projectView() : projectForm()) + contractsView();
  }
  function projectForm() {
    const g = G(), s = g.state, c = ctx(), y = M.tableYear(c);
    const d = (app.draft ||= defaultDraft());
    const done = s.research.done;
    const genres = PACK.genres.filter((x) => !x.research || done[x.research]);
    const topics = PACK.topics.filter((t) => t[4] <= y);
    const maxTech = PACK.workstations.tiers[s.stationTier].maxTech;
    const trend = s.trend || {};
    const opt = (v, label, sel, dis = false) => `<option value="${v}" ${sel ? 'selected' : ''} ${dis ? 'disabled' : ''}>${esc(label)}</option>`;
    const plats = M.activePlatforms(c).map((p) => {
      const locked = !p.own && p.tech > maxTech;
      return `<label class="pick ${locked ? 'locked' : ''}"><input type="checkbox" id="pl-${p.id}" data-plat="${p.id}" ${d.platforms.includes(p.id) ? 'checked' : ''} ${locked ? 'disabled' : ''}>
        <span class="name">${esc(p.name)}${p.own ? ' ★' : ''}</span><span class="meta num">${locked ? 'istasyon yetersiz' : `${M.platformBase(c, p).toFixed(1)} M · ${p.licence ? money(p.licence) : 'lisanssız'}`}</span></label>`;
    }).join('');
    return card('Yeni oyun', `
      <div class="form">
        <label class="wide">Ad<input id="f-name" data-draft="name" value="${esc(d.name)}" maxlength="40"></label>
        <label>Tür<select id="f-genre" data-draft="genre">${genres.map((x) => opt(x.id, x.name + (trend.genre === x.id ? ' · trend' : ''), d.genre === x.id)).join('')}</select></label>
        <label>Alt tür<select id="f-sub" data-draft="sub" ${done.alt_tur ? '' : 'disabled'}>${opt('', done.alt_tur ? 'Yok (−3)' : 'Araştırma gerekli (−3)', !d.sub)}${genres.filter((x) => x.id !== d.genre).map((x) => opt(x.id, x.name, d.sub === x.id)).join('')}</select></label>
        <label>Konu<select id="f-topic" data-draft="topic">${topics.map((t) => opt(t[0], t[1] + (trend.topic === t[0] ? ' · trend' : ''), d.topic === t[0])).join('')}</select></label>
        <label>Kitle<select id="f-aud" data-draft="audience">${PACK.audiences.map((a) => opt(a.id, a.name, d.audience === a.id)).join('')}</select></label>
        <label>Boyut<select id="f-size" data-draft="size">${PACK.sizes.map((z) => {
          const lock = z.research && !done[z.research] ? ' (araştır)' : s.office.tier < z.office ? ` (${PACK.offices[z.office - 1].name})` : '';
          return opt(z.id, `${z.name} · ${z.weeks} hf${lock}`, d.size === z.id, !!lock);
        }).join('')}</select></label>
        <label>Motor<select id="f-engine" data-draft="engineId">${opt('', 'Motorsuz', !d.engineId)}${s.engines.map((e) => opt(e.id, `${e.name} (${M.engineScore(c, e)})`, String(d.engineId) === String(e.id))).join('')}</select></label>
        <label>Seri<select id="f-ip" data-draft="sequelOf">${opt('', 'Yeni IP', !d.sequelOf)}${s.ips.map((ip) => opt(ip.id, `${ip.name} ★${ip.value.toFixed(1)}`, String(d.sequelOf) === String(ip.id))).join('')}</select></label>
      </div>
      <fieldset class="picks"><legend>Platformlar <small>kurulu taban · lisans</small></legend>${plats}</fieldset>
      <div class="foot"><span class="muted">Başlangıç maliyeti <b class="num">${money(Prod.projectCost(c, d))}</b></span><button class="primary" data-act="start">Geliştirmeye başla</button></div>`);
  }
  function projectView() {
    const g = G(), s = g.state, c = ctx(), pj = s.project;
    const genre = PACK.genres.find((x) => x.id === pj.genre);
    const topic = PACK.topics.find((t) => t[0] === pj.topic)[1];
    const prog = pj.status === 'dev' ? (pj.week / pj.totalWeeks) * 100 : 100;
    const pv = g.previewReview();
    const discs = ['oyn', 'gfx', 'ses', 'tek'].map((d) => {
      const v = (pj.points[d] / M.target(c, d, pj.size)) * 100;
      return `<div class="disc"><span>${discName(d)}</span>${bar(v, 'd-' + d)}<b class="num">${Math.round(Math.min(v, 999))}%</b></div>`;
    }).join('');
    const phaseBlock = (ph) => PACK.missions.map((m, i) => (m.phase !== ph ? '' : `<label class="slider"><span>${m.name}${genre.mission[i] === 1 ? ' <i title="Bu tür için kritik">◆</i>' : ''}</span>
      <input type="range" min="0" max="100" step="5" id="alloc-${i}" data-alloc="${i}" value="${pj.alloc[i]}"></label>`)).join('');
    const cur = pj.status === 'dev' ? pj.phase : 2;
    const sliders = `<div class="phase now"><h4>${PACK.production.phaseNames[cur]} · şimdi</h4>${phaseBlock(cur)}</div>`
      + [0, 1, 2].filter((p) => p !== cur).map((p) => `<details class="phase" data-key="faz${p}" ${app.open.has('faz' + p) ? 'open' : ''}><summary><h4>${PACK.production.phaseNames[p]}</h4></summary>${phaseBlock(p)}</details>`).join('');
    const camps = PACK.hype.campaigns.filter((x) => !x.minYear || M.tableYear(c) >= x.minYear).map((x) => {
      const lock = x.research && !s.research.done[x.research];
      return `<button data-act="campaign" data-id="${x.id}" ${lock ? 'disabled' : ''}>${x.name}<small>${lock ? 'araştır' : money(x.cost * M.inflation(c) ** 0.7)}</small></button>`;
    }).join('');
    const outs = PACK.outsource.rows.map((_, i) => Prod.outsourceRow(c, i)).filter((r) => r.office <= s.office.tier).map((r) => `<div class="row-item"><div><b>${esc(r.name)}</b><small>${discName(r.disc)} · +${fmt(r.points)} puan</small></div><button data-act="outsource" data-id="${r.i}" ${pj.status !== 'dev' ? 'disabled' : ''}>${money(r.fee)}</button></div>`).join('');
    let release = '';
    if (pj.status === 'debug') {
      const pubs = Market.publishersAvailable(c);
      const defPrice = Math.max(10, Math.round(20 * M.inflation(c) ** 0.4));
      release = card('Yayınla', `<div class="form">
        <label class="wide">Yayıncı<select id="r-pub">${pubs.map((p) => `<option value="${p.id}" ${s.fans < p.minFans ? 'disabled' : ''}>${esc(p.name)} · güç ${p.power} · pay %${Math.round(p.royalty * 100)}${s.fans < p.minFans ? ` (${fmt(p.minFans)} hayran)` : ''}</option>`).join('')}
          ${s.research.done.oz_yayin ? `<option value="">Kendi yayınım · güç ${Math.round(M.selfPublishPower(c))}</option>` : ''}</select></label>
        <label>Fiyat ($)<input id="r-price" type="number" min="1" max="120" value="${defPrice}"></label></div>
        <div class="foot"><span class="muted">Beklemek hataları azaltır, maaş yer.</span><button class="primary" data-act="release">Yayınla</button></div>`, `<span class="pill">${Math.round(pj.bugs)} hata</span>`);
    }
    return card(esc(pj.name), `
      <p class="tags">${genre.name}${pj.sub ? ' + ' + PACK.genres.find((x) => x.id === pj.sub).name : ''} · ${esc(topic)} · ${PACK.sizes.find((z) => z.id === pj.size).name}</p>
      <div class="progress"><span>${pj.status === 'dev' ? `${PACK.production.phaseNames[pj.phase]} · hafta ${pj.week}/${pj.totalWeeks}` : 'Hata ayıklama'}</span>${bar(prog, 'prog')}</div>
      <div class="split">
        <div class="forecast"><small>Şu an çıksa</small><b class="num">${Math.round(pv.score)}</b><small>${pv.notes.map(esc).join(' · ') || 'ceza yok'}</small></div>
        <div class="discs">${discs}<p class="muted small">Hata ${Math.round(pj.bugs)} · Hype ${Math.round(pj.hype)} · Uyum ×${pv.F.toFixed(2)} · Hiza ×${pv.hiza.toFixed(2)}</p></div>
      </div>`)
      + release
      + card('Zaman dağılımı', `<div class="phases">${sliders}</div>`)
      + card('Pazarlama ve baskı', `<div class="btns">${camps}</div>
        <div class="foot"><span class="muted">Crunch: +%40 üretim; stres, hata ve skandal riski patlar.</span><button data-act="crunch" class="${s.crunch ? 'danger on' : ''}">${s.crunch ? 'Crunch\'ı bitir' : '🔥 Crunch başlat'}</button></div>`)
      + section('dis', 'Dış kaynak', `<p class="muted small">Tek seferlik ücretle anında puan. Pahalılaştıkça getirisi azalır.</p>${outs}`)
      + `<div class="foot"><button class="ghost danger" data-act="cancel">${app.confirm === 'cancel' ? 'Emin misin? Tekrar bas' : 'Projeyi iptal et'}</button></div>`;
  }
  function contractsView() {
    const s = G().state;
    const cur = s.contract ? `<div class="row-item col"><div><b>${esc(s.contract.client)}</b><small>${esc(s.contract.job)} · ${money(s.contract.reward)}</small></div>
      ${bar((s.contract.progress / s.contract.need) * 100, 'prog')}<small class="muted">${Math.round(s.contract.progress)}/${s.contract.need} puan · ${s.contract.deadline - s.week} hafta kaldı</small></div>` : '';
    const offers = s.contract ? '' : s.contractOffers.map((o) => `<div class="row-item"><div><b>${esc(o.client)}</b><small>${esc(o.job)} · ${o.need} puan · ${o.weeks} hf</small></div><button data-act="contract" data-id="${o.id}">${money(o.reward)}</button></div>`).join('');
    const body = `<p class="muted small">Geliştirme odaları oyun yokken sözleşme yapar. Proje sürerken bir odayı Ofis sekmesinden "Yalnızca sözleşme"ye al.</p>${cur}${offers || (cur ? '' : '<p class="muted">Bu ay teklif yok.</p>')}`;
    if (!s.project && !app.open.has('soz')) app.open.add('soz');
    return section('soz', 'Sözleşme işleri', body, s.contract ? '<span class="pill">sürüyor</span>' : `<span class="pill">${s.contractOffers.length} teklif</span>`);
  }

  // ---------- OFİS
  function personRow(p, rooms) {
    const c = ctx(), car = Staff.career(c, p.career), lvl = p.careers[p.career] || 0;
    const open = app.expanded.has(p.id);
    const status = STATUS[p.status] ? `<span class="pill warn">${STATUS[p.status]} ${p.statusWeeks}</span>` : '';
    let actions = '';
    if (open) {
      const lc = Staff.levelCost(c, p);
      const opts = Staff.careerOptions(c, p);
      actions = `<div class="acts">
        <label>Oda<select id="mv-${p.id}" data-act="move" data-id="${p.id}">${rooms.map((r) => `<option value="${r.id}" ${p.room === r.id ? 'selected' : ''}>${esc(Staff.roomType(c, r.type).name)} #${r.id}</option>`).join('')}</select></label>
        <label>Eğitim<select id="tr-${p.id}" data-act="train" data-id="${p.id}"><option value="">Seç…</option>${PACK.training.map((t) => `<option value="${t.id}">${t.name} · ${money(t.cost * M.inflation(c))}</option>`).join('')}</select></label>
        <label>Kariyer<select id="cr-${p.id}" data-act="career" data-id="${p.id}"><option value="">${opts.length ? 'Değiştir…' : 'Seçenek yok'}</option>${opts.map((o) => `<option value="${o.id}">${o.name} · ${money(PACK.careerRules.changeCost * M.inflation(c))}</option>`).join('')}</select></label>
        <div class="btns">
          <button data-act="level" data-id="${p.id}" ${lc == null ? 'disabled' : ''}>${lc == null ? 'Son seviye' : `Seviye atlat · ${lc} RP`}</button>
          ${p.founder ? '' : `<button data-act="raise" data-id="${p.id}">Zam %12</button><button class="ghost danger" data-act="fire" data-id="${p.id}">${app.confirm === 'fire' + p.id ? 'Emin misin?' : 'Kov'}</button>`}
        </div>
        <p class="muted small">${p.trait ? `Özellik: ${esc(PACK.traits.find((t) => t.id === p.trait).name)} · ` : ''}Kariyerler: ${Object.entries(p.careers).map(([k, v]) => `${Staff.career(c, k).name} ${v}`).join(', ')}</p>
      </div>`;
    }
    return `<div class="person ${p.status !== 'ok' ? 'away' : ''} ${open ? 'open' : ''}">
      <button class="who" data-act="expand" data-id="${p.id}" aria-expanded="${open}">
        <span class="name">${p.founder ? '♛ ' : ''}${esc(p.name)}</span>
        <span class="spec s-${p.spec}">${car.name} ${lvl}</span>${status}
        <span class="vit"><span class="num">${Math.round(p.skill)}</span>${bar(p.morale, 'm')}${bar(p.stress, 's')}</span>
        <span class="num pay">${p.founder ? '—' : money(p.salary)}</span>
      </button>${actions}</div>`;
  }
  function tabOffice() {
    const g = G(), s = g.state, c = ctx();
    const off = Eco.office(c);
    const next = PACK.offices.find((o) => o.tier === s.office.tier + 1);
    const moveLabel = next ? `${next.name} · ${money(next.cost * M.inflation(c) ** 0.5)}` : off.floorCost && s.office.floors < off.maxFloors ? `Yeni kat (+${off.floorSlots} oda) · ${money(off.floorCost * M.inflation(c) ** 0.5)}` : null;
    const st = PACK.workstations.tiers[s.stationTier];
    const up = Eco.stationUpgradeCost(c);
    const cap = Staff.roomSeats(c);
    const summary = card(esc(off.name), `
      <div class="kv"><span>Oda alanı</span><b class="num">${s.rooms.length}/${Staff.slots(c)}</b><span>Koltuk</span><b class="num">${s.staff.length}/${Staff.seats(c)}</b>
      <span>Bilgisayar</span><b>${st.name} <small class="muted">×${M.stationFactor(c).toFixed(2)}${s.stationTier < M.expectedStationTier(c) ? ' · geride' : ''}</small></b></div>
      <div class="btns">${moveLabel ? `<button data-act="office">${moveLabel}</button>` : ''}<button data-act="stations" ${up == null ? 'disabled' : ''}>${up == null ? 'İstasyonlar son seviye' : `İstasyon yükselt · ${money(up)}`}</button></div>`);
    const rooms = s.rooms.map((r) => {
      const t = Staff.roomType(c, r.type), people = Staff.membersOf(c, r);
      const mode = r.type === 'gelistirme' ? `<select id="md-${r.id}" data-act="mode" data-id="${r.id}" aria-label="Oda modu">${Object.entries(PACK.rooms.modes).map(([k, v]) => `<option value="${k}" ${r.mode === k ? 'selected' : ''}>${v}</option>`).join('')}</select>` : '';
      return `<section class="card room r-${r.type}"><div class="head"><h2>${t.name}</h2><span class="pill">${people.length}/${cap}</span></div>
        <p class="muted small">${t.desc}</p>${mode ? `<div class="mode">${mode}</div>` : ''}
        <div class="people">${people.map((p) => personRow(p, s.rooms)).join('') || '<p class="muted small">Boş oda. Birini buraya taşı.</p>'}</div>
        ${s.rooms.length > 1 ? `<div class="foot"><button class="ghost danger small" data-act="demolish" data-id="${r.id}">${app.confirm === 'dem' + r.id ? 'Emin misin?' : 'Odayı sök'}</button></div>` : ''}</section>`;
    }).join('');
    const free = Staff.slots(c) - s.rooms.length;
    const build = free > 0 ? card(`Boş alan <span class="muted">(${free})</span>`, `<div class="btns">${PACK.rooms.types.map((t) => {
      const lock = t.research && !s.research.done[t.research] ? 'araştır' : t.office && s.office.tier < t.office ? PACK.offices[t.office - 1].name : '';
      return `<button data-act="build" data-id="${t.id}" ${lock ? 'disabled' : ''} title="${esc(t.desc)}">${t.name}<small>${lock || money(t.cost * M.inflation(c) ** 0.5)}</small></button>`;
    }).join('')}</div>`) : '';
    const apps = s.applicants.map((p) => `<div class="row-item"><div><b>${esc(p.name)}</b><small><span class="spec s-${p.spec}">${Staff.career(c, p.career).name} ${p.careers[p.career]}</span> beceri ${p.skill}${p.trait ? ' · ' + esc(PACK.traits.find((t) => t.id === p.trait).name) : ''}</small></div>
      <button data-act="hire" data-id="${p.id}" ${s.staff.length >= Staff.seats(c) ? 'disabled' : ''}>${money(p.salary)}/ay</button></div>`).join('');
    return summary + section('ise_alim', 'İşe alım', `<p class="muted small">Her ay yenilenir. İşe alım ücreti bir aylık maaş. Yeni gelen boş koltuğu olan odaya oturur.</p>${apps || '<p class="muted">Bu ay başvuru yok.</p>'}`, `<span class="pill">${s.applicants.length}</span>`) + rooms + build;
  }

  // ---------- AR-GE
  function tabResearch() {
    const g = G(), s = g.state, c = ctx();
    const cur = s.research.current ? (() => { const it = PACK.research.find((r) => r.id === s.research.current.id); return `<p>Sürüyor: <b>${esc(it.name)}</b> · ${s.research.current.weeksLeft} hafta</p>`; })() : '';
    const av = Prod.researchAvailable(c).map((r) => {
      const i = Prod.researchInfo(c, r);
      const can = s.research.rp >= i.rp && !s.research.current;
      return `<div class="row-item"><div><b>${esc(r.name)}</b><small>${i.rp} RP · ${i.weeks} hf</small></div><button data-act="research" data-id="${r.id}" ${can ? '' : 'disabled'}>${money(i.cost)}</button></div>`;
    }).join('');
    const feats = PACK.research.filter((r) => r.engine && s.research.done[r.id]);
    const builder = s.research.done.motor_ozel ? `<div class="form"><label class="wide">Motor adı<input id="e-name" data-eng="name" value="${esc(app.engineName)}" maxlength="24"></label></div>
      <fieldset class="picks">${feats.map((f) => { const st = M.featureStats(c, f.id); return `<label class="pick"><input type="checkbox" id="ft-${f.id}" data-feat="${f.id}" ${app.engineSel.has(f.id) ? 'checked' : ''}><span class="name">${esc(f.name.replace('Motor: ', ''))}</span><span class="meta num">${st.enginePts} p · ${money(st.engineCost)}</span></label>`; }).join('') || '<p class="muted">Önce motor özelliği araştır.</p>'}</fieldset>
      <div class="foot">${s.engineJob ? `<span class="muted">Yapılıyor: ${esc(s.engineJob.name)} · ${s.engineJob.weeksLeft} hf</span>` : '<button class="primary" data-act="engine">Motoru yap</button>'}</div>` : '<p class="muted">"Kendi motorunu yap" araştırmasıyla açılır.</p>';
    const engines = s.engines.map((e) => `<div class="row-item"><div><b>${esc(e.name)}</b><small>${M.engineScore(c, e)} puan · ${Math.floor(e.builtYear)} · ×${M.engineFactor(c, e).toFixed(2)}</small></div>
      <button data-act="licence" data-id="${e.id}" ${s.research.done.motor_lisans ? '' : 'disabled'}>${e.licensed ? 'Lisansı kapat' : 'Lisansla'}</button></div>`).join('');
    return card('Araştırma', `${cur}<p class="muted small">Herkes üretiminin bir kısmını RP'ye çevirir; Araştırma odasındakiler çok daha fazla. RP kariyer seviyesi için de harcanır.</p>${av || '<p class="muted">Şimdilik yeni bir şey yok. Yıllar geçtikçe açılır.</p>'}`, `<span class="pill num">${Math.floor(s.research.rp)} RP</span>`)
      + section('motor', 'Oyun motoru', builder + engines, `<span class="pill">${s.engines.length}</span>`)
      + section('konsol', 'Donanım: kendi konsolun', consoleView());
  }
  function consoleView() {
    const g = G(), s = g.state, c = ctx(), cp = PACK.console;
    const mine = s.consoles.filter((k) => k.launched).map((k) => `<div class="row-item"><div><b>${esc(k.name)}</b><small>Teknoloji ${k.tech} · ${fmt(k.sold)} adet · ${k.retired ? 'emekli' : k.ended ? 'üretim bitti' : 'piyasada'}</small></div></div>`).join('');
    const job = s.consoles.find((k) => k.id === s.consoleJob);
    if (job) return `<p><b>${esc(job.name)}</b> · ${cp.phases[job.phase]} (${job.phase + 1}/${cp.phases.length})</p>${bar((job.points / job.need) * 100, 'prog')}<p class="muted small">${fmt(job.points)}/${fmt(job.need)} donanım puanı. Donanım laboratuvarındakiler üretir; mühendisler çok daha hızlı.</p>${mine}`;
    const block = Con.consoleBlockers(c);
    if (block.length) return `<p class="muted small">Eksikler:</p><ul class="todo">${block.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>${mine}`;
    const parts = Con.consoleParts(c), d = app.consoleDraft;
    if (!parts.cpus.some((x) => x.id === d.cpu)) d.cpu = parts.cpus[0]?.id || '';
    if (!parts.media.some((x) => x.id === d.media)) d.media = parts.media[0]?.id || '';
    const q = Con.consoleQuote(c, d);
    const sel = (key, list) => `<select id="cn-${key}" data-con="${key}">${list.map((x) => `<option value="${x.id}" ${d[key] === x.id ? 'selected' : ''}>${x.name} · ${money(x.cost * cp.costScale)}</option>`).join('')}</select>`;
    return `<div class="form"><label class="wide">Konsol adı<input id="cn-name" data-con="name" value="${esc(d.name)}" maxlength="24"></label>
      <label>Tip${sel('type', parts.types)}</label><label>İşlemci${sel('cpu', parts.cpus)}</label><label>Medya${sel('media', parts.media)}</label></div>
      ${q ? `<p class="muted small">Teknoloji ${q.tech} · aşama başına ${fmt(q.need)} donanım puanı · yapım boyunca oyun çıkmazsa hayran kaybedersin. Yeni konsol eskisini piyasadan çeker.</p>` : ''}
      <div class="foot"><b class="num">${q ? money(q.cost) : ''}</b><button class="primary" data-act="console" ${q ? '' : 'disabled'}>Konsolu yap</button></div>${mine}`;
  }

  // ---------- PAZAR
  function tabMarket() {
    const g = G(), s = g.state, c = ctx();
    const tr = s.trend ? (s.trend.genre ? PACK.genres.find((x) => x.id === s.trend.genre).name : PACK.topics.find((t) => t[0] === s.trend.topic)[1]) : '—';
    const mods = s.marketMods.map((m) => { const e = PACK.eras.find((x) => x.id === m.id); return `<span class="pill ${m.salesMult < 1 ? 'warn' : ''}">${esc(e.title)} · satış ×${m.salesMult}</span>`; }).join('');
    const games = [...s.games].reverse().map((x) => `<tr class="${x.active ? '' : 'dim'}"><td>${esc(x.name)}</td><td class="num">${x.score}</td><td class="num">${fmt(x.units)}</td><td class="num">${money(x.revenue)}</td><td class="num">${x.active ? fmt(x.lastWeek) : x.mmo && x.subs > 0 ? fmt(x.subs) + ' ab.' : '—'}</td></tr>`).join('');
    const charts = s.charts.slice(0, 10).map((x) => `<li class="${x.mine ? 'mine' : ''}"><b class="num">${x.score}</b><span>${esc(x.name)}</span><small>${esc(x.studio)}</small></li>`).join('');
    const rivals = s.rivals.map((r) => `<div class="row-item"><div><b>${esc(r.name)}</b><small>itibar ${Math.round(r.rep)} · ${r.games} oyun · son ${r.lastScore || '—'}</small></div>
      ${r.acquired ? '<span class="pill">Senin</span>' : `<button data-act="acquire" data-id="${r.id}">${money(Market.rivalPrice(c, r))}</button>`}</div>`).join('');
    return card('Oyunların', `${mods ? `<div class="btns">${mods}</div>` : ''}<div class="scroll"><table><thead><tr><th>Oyun</th><th>Not</th><th>Kopya</th><th>Gelir</th><th>Bu hf</th></tr></thead><tbody>${games || '<tr><td colspan="5" class="muted">Henüz oyun yok.</td></tr>'}</tbody></table></div>`, `<span class="pill">Trend: ${esc(tr)}</span>`)
      + section('liste', 'Son çıkanlar', `<ol class="charts">${charts || '<li class="muted">Henüz yok.</li>'}</ol>`)
      + section('rakip', 'Rakipler', rivals);
  }

  // ---------- FİNANS
  function tabFinance() {
    const g = G(), s = g.state, c = ctx();
    const y = Math.floor(s.week / 48);
    const years = [y - 2, y - 1, y].filter((v) => v >= 0);
    const cats = [...new Set(years.flatMap((v) => Object.keys(s.ledger.byYear[v] || {})))].sort();
    const head = years.map((v) => `<th>${Math.floor(PACK.meta.startYear + v / s.lengthMult)}</th>`).join('');
    const rows = cats.map((k) => `<tr><td>${k.replace('_', ' ')}</td>${years.map((v) => { const a = (s.ledger.byYear[v] || {})[k] || 0; return `<td class="num ${a < 0 ? 'neg' : ''}">${a ? money(a) : '—'}</td>`; }).join('')}</tr>`).join('');
    const tot = `<tr class="tot"><td>Net</td>${years.map((v) => { const a = g.ctx.ledger.yearProfit(v); return `<td class="num ${a < 0 ? 'neg' : ''}">${money(a)}</td>`; }).join('')}</tr>`;
    const owed = s.loans.reduce((a, l) => a + l.remaining, 0);
    const avail = Math.max(0, Eco.creditLimit(c) * 3 - owed);
    const wages = s.staff.reduce((a, p) => a + p.salary, 0);
    return card('Durum', `<div class="kv"><span>Aylık maaş</span><b class="num">${money(wages)}</b><span>Aylık kira</span><b class="num">${money(Eco.rent(c))}</b>
      <span>Kredi limiti</span><b class="num">${money(Eco.creditLimit(c))}</b><span>Borç</span><b class="num">${money(owed)}</b></div>
      ${s.debtWeeks ? `<p class="neg">Limit aşımı: ${s.debtWeeks}/${PACK.economy.bankruptWeeks} hafta. Sonra iflas.</p>` : ''}
      <p class="muted small">Kredi: 24 ay, yıllık %${PACK.economy.loanRateYear * 100}.</p>
      <div class="btns">${[0.25, 0.5, 1].map((f) => `<button data-act="loan" data-id="${Math.round(avail * f)}" ${avail < 1000 ? 'disabled' : ''}>${money(avail * f)} çek</button>`).join('')}</div>`)
      + card('Defter', `<div class="scroll"><table><thead><tr><th>Kalem</th>${head}</tr></thead><tbody>${rows}${tot}</tbody></table></div>`);
  }
  function tabNews() {
    const s = G().state;
    return card('Günlük', `<ul class="news">${s.news.map((n) => `<li class="${n.type}"><small class="num">Y${Math.floor(n.w / 48) + 1}·A${Math.floor((n.w % 48) / 4) + 1}</small><span>${esc(n.t)}</span></li>`).join('')}</ul>`);
  }

  // --- pencereler
  function showModal() {
    const g = G();
    if (!g) return;
    const s = g.state;
    if (s.gameOver) {
      play(false);
      el.modal.innerHTML = `<div class="dialog over"><h2>${s.gameOver.reason === 'iflas' ? 'İFLAS' : 'SON'}</h2><p>${esc(s.gameOver.text)}</p>
        <div class="kv"><span>Oyun</span><b class="num">${s.games.length}</b><span>Hayran</span><b class="num">${fmt(s.fans)}</b><span>Ödül</span><b class="num">${s.awards.length}</b><span>Skor</span><b class="num">${fmt(g.finalScore())}</b></div>
        <button class="primary block" data-act="newgame">Yeni kariyer</button></div>`;
      el.modal.hidden = false;
      store((st) => st.removeItem(SAVE_KEY));
      return;
    }
    const ev = s.pending[0];
    if (!ev) { el.modal.hidden = true; return; }
    el.modal.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="ev-title"><small class="muted">${g.cal().label} · ${g.cal().era}</small><h2 id="ev-title">${esc(ev.title)}</h2><p>${esc(ev.text)}</p>
      <div class="choices">${ev.choices.map((ch, i) => `<button data-choice="${i}" class="${i === 0 ? 'primary' : ''}">${esc(ch.label)}</button>`).join('')}</div></div>`;
    el.modal.hidden = false;
    el.modal.querySelector('button')?.focus();
  }
  function setupScreen() {
    const has = store((s) => s.getItem(SAVE_KEY));
    el.modal.innerHTML = `<div class="dialog setup"><h1>X PROJECT</h1><p class="tag">Garajdan imparatorluğa. Ya da iflasa.</p>
      ${has ? '<button class="primary block" data-act="continue">Kayıtlı kariyere devam et</button><hr>' : ''}
      <div class="form">
        <label>Stüdyo adı<input id="n-company" value="Piksel & Kaos"></label>
        <label>Kurucu adı<input id="n-founder" value="Sen"></label>
        <label>Kurucunun alanı<select id="n-spec">${PACK.disciplines.map((d) => `<option value="${d.id}">${d.name} · ${Staff.career({ pack: PACK }, PACK.careerRules.founderCareer[d.id]).name}</option>`).join('')}</select></label>
        <label>Zorluk<select id="n-diff">${PACK.difficulties.map((d) => `<option value="${d.id}" ${d.id === 'kolay' ? 'selected' : ''}>${d.name} · ${money(d.startCash)}</option>`).join('')}</select></label>
        <label>Kariyer uzunluğu<select id="n-len">${Object.keys(PACK.meta.gameLengths).map((l) => `<option value="${l}" ${+l === PACK.meta.defaultLength ? 'selected' : ''}>${l} yıl</option>`).join('')}</select></label>
        <label>Tohum<input id="n-seed" type="number" value="${(Date.now() % 100000) | 0}"></label>
      </div>
      <button class="primary block" data-act="begin">1976'da garajı aç</button></div>`;
    el.modal.hidden = false;
  }
  function start(game) {
    app.game = game; app.draft = null; app.engineSel = new Set(); app.seenNews = game.state.news.length;
    el.modal.hidden = true;
    render(true);
    play(true);
    if (game.state.pending.length) showModal();
  }

  // --- etkileşim
  root.addEventListener('toggle', (e) => {
    const d = e.target;
    if (d.tagName === 'DETAILS' && d.dataset.key) d.open ? app.open.add(d.dataset.key) : app.open.delete(d.dataset.key);
  }, true);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.tab) { app.tab = b.dataset.tab; app.confirm = null; el.panel.scrollTop = 0; renderTabs(); return renderPanel(); }
    if (b.dataset.choice !== undefined) {
      G().resolve(+b.dataset.choice);
      save();
      if (G().state.pending.length) showModal(); else { el.modal.hidden = true; render(true); }
      return;
    }
    const act = b.dataset.act, id = b.dataset.id, g = G();
    const confirmTwice = (key, fn) => { if (app.confirm === key) { app.confirm = null; return run(fn()); } app.confirm = key; return render(true); };
    switch (act) {
      case 'begin': {
        const v = (q) => root.querySelector(q).value;
        return start(newGame({ companyName: v('#n-company') || 'X Project', founderName: v('#n-founder') || 'Sen', founderSpec: v('#n-spec'), difficulty: v('#n-diff'), length: +v('#n-len'), seed: +v('#n-seed') || 1976 }));
      }
      case 'continue': { const j = store((s) => s.getItem(SAVE_KEY)); if (j) start(loadGame(j)); return; }
      case 'newgame': return setupScreen();
      case 'play': return play(!app.running);
      case 'speed': app.speed = SPEEDS[(SPEEDS.indexOf(app.speed) + 1) % SPEEDS.length]; return play(app.running);
      case 'crunch': g.toggleCrunch(); return render(true);
      case 'start': {
        const d = app.draft;
        const res = g.startProject({ ...d, engineId: d.engineId ? +d.engineId : null, sequelOf: d.sequelOf ? +d.sequelOf : null, sub: d.sub || null });
        if (res.ok) app.draft = null;
        return run(res);
      }
      case 'release': {
        const res = g.release({ publisherId: root.querySelector('#r-pub').value || null, price: Math.max(1, +root.querySelector('#r-price').value || 20) });
        if (res.ok) { app.tab = 'pazar'; toast(`"${res.game.name}" çıktı. Not ${res.review.score}`, false); }
        return run(res);
      }
      case 'cancel': return confirmTwice('cancel', () => g.cancelProject());
      case 'campaign': return run(g.campaign(id));
      case 'outsource': return run(g.outsource(+id));
      case 'contract': return run(g.acceptContract(+id));
      case 'hire': return run(g.hire(+id));
      case 'fire': return confirmTwice('fire' + id, () => g.fire(+id));
      case 'raise': return run(g.raise(+id));
      case 'level': return run(g.levelUp(+id));
      case 'expand': app.expanded.has(+id) ? app.expanded.delete(+id) : app.expanded.add(+id); return renderPanel();
      case 'build': return run(g.buildRoom(id));
      case 'demolish': return confirmTwice('dem' + id, () => g.demolishRoom(+id));
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
    if (t.dataset.draft) { app.draft[t.dataset.draft] = t.value; if (t.dataset.draft !== 'name') { t.blur(); renderPanel(); } return; }
    if (t.dataset.plat) { const set = new Set(app.draft.platforms); t.checked ? set.add(t.dataset.plat) : set.delete(t.dataset.plat); app.draft.platforms = [...set]; return renderPanel(); }
    if (t.dataset.feat) { t.checked ? app.engineSel.add(t.dataset.feat) : app.engineSel.delete(t.dataset.feat); return; }
    if (t.dataset.eng) { app.engineName = t.value; return; }
    if (t.dataset.con) { app.consoleDraft[t.dataset.con] = t.value; if (t.dataset.con !== 'name') { t.blur(); renderPanel(); } return; }
    const id = +t.dataset.id;
    if (t.dataset.act === 'move') { t.blur(); return run(g.moveStaff(id, +t.value)); }
    if (t.dataset.act === 'mode') { g.setRoomMode(id, t.value); t.blur(); return render(true); }
    if (t.dataset.act === 'train' && t.value) { t.blur(); return run(g.train(id, t.value)); }
    if (t.dataset.act === 'career' && t.value) { t.blur(); return run(g.changeCareer(id, t.value)); }
    if (t.dataset.alloc !== undefined) { t.blur(); render(true); }
  });
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.alloc !== undefined) G().setAlloc(+t.dataset.alloc, +t.value);
    if (t.dataset.draft === 'name') app.draft.name = t.value;
    if (t.dataset.con === 'name') app.consoleDraft.name = t.value;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' && G() && el.modal.hidden && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName || '')) { e.preventDefault(); play(!app.running); }
  });

  requestAnimationFrame(loop);
  const fresh = (j) => { try { return JSON.parse(j).version >= 2; } catch { return false; } };
  if (hotData.save && fresh(hotData.save)) { app.tab = hotData.tab || 'proje'; start(loadGame(hotData.save)); }
  else setupScreen();
}
