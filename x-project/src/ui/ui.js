// Arayüz: HUD, sekmeler, olay pencereleri, kayıt. Oyun mantığı game.js'te; burası yalnızca çağırır ve gösterir.
import { newGame, loadGame, M, Prod, Eco, Market, Staff } from '../game.js';
import { PACK } from '../data/pack.js';
import { makeRenderer } from './render.js';
import { money } from '../kernel.js';

const SAVE_KEY = 'xproject-save-v1';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('tr-TR');
const pct = (v) => Math.max(0, Math.min(100, v));
const bar = (v, cls = '') => `<span class="bar ${cls}"><i style="width:${pct(v)}%"></i></span>`;
const discName = (id) => PACK.disciplines.find((d) => d.id === id).name;
const ROLES = { proje: 'Oyun', sozlesme: 'Sözleşme', arastirma: 'Araştırma', dinlen: 'Dinlenme' };
const STATUS = { ok: '', hasta: 'Hasta', tukenmis: 'Tükenmiş', egitim: 'Eğitimde' };
const kaosLabel = (k) => (k < 30 ? 'Sakin' : k < 55 ? 'Gergin' : k < 80 ? 'Kaotik' : 'Cehennem');

function store(fn) { try { return fn(window.localStorage); } catch { return null; } }

export function boot(root, hotData = {}) {
  const app = { game: null, speed: 0, tab: 'proje', frame: 0, timer: null, draft: null, engineSel: new Set(), engineName: 'Motor', confirm: null };
  const el = {
    hud: root.querySelector('#hud'), canvas: root.querySelector('#scene'), panel: root.querySelector('#panel'),
    tabs: root.querySelector('#tabs'), modal: root.querySelector('#modal'), toast: root.querySelector('#toast'), ticker: root.querySelector('#ticker'),
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
    clearTimeout(toast.t); toast.t = setTimeout(() => (el.toast.className = ''), 2600);
  }
  const run = (res) => { if (res && res.ok === false) toast(res.msg); render(true); return res; };

  // --- hız
  function setSpeed(s) {
    app.speed = s;
    clearInterval(app.timer);
    if (s > 0) app.timer = setInterval(step, PACK.meta.msPerWeek[s]);
    renderHud();
  }
  function step() {
    const g = G();
    if (!g) return;
    if (g.state.pending.length || g.state.gameOver) { showModal(); return; }
    g.tick();
    if (g.state.week % 4 === 0) save();
    render(false);
    if (g.state.pending.length || g.state.gameOver) showModal();
  }

  // --- çizim döngüsü
  function loop() {
    app.frame++;
    if (G()) draw(G().state, PACK, app.frame);
    requestAnimationFrame(loop);
  }

  function render(force) {
    renderHud();
    renderTicker();
    const a = document.activeElement;
    const typing = a && el.panel.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'SELECT');
    if (force || !typing) renderPanel();
  }

  // --- HUD
  function renderHud() {
    const g = G();
    if (!g) { el.hud.innerHTML = ''; return; }
    const s = g.state, cal = g.cal();
    const stars = '★'.repeat(Math.round(M.studioStars(ctx()))) + '☆'.repeat(5 - Math.round(M.studioStars(ctx())));
    const k = Math.round(s.kaos);
    el.hud.innerHTML = `
      <div class="brand"><b>${esc(s.companyName)}</b><small>${esc(Eco.office(ctx()).name)} · ${stars}</small></div>
      <div class="stat"><small>Tarih</small><b class="num">${cal.era}</b><small>${cal.label}</small></div>
      <div class="stat"><small>Kasa</small><b class="num ${s.cash < 0 ? 'neg' : ''}">${money(s.cash)}</b><small>limit −${money(Eco.creditLimit(ctx()))}</small></div>
      <div class="stat"><small>Hayran</small><b class="num">${fmt(s.fans)}</b><small>prestij ${s.prestige.toFixed(1)}</small></div>
      <div class="stat kaos k${k < 30 ? 0 : k < 55 ? 1 : k < 80 ? 2 : 3}"><small>Kaos</small><b class="num">${k}</b><small>${kaosLabel(k)}</small>${bar(k, 'kbar')}</div>
      <div class="speed" role="group" aria-label="Hız">
        ${[0, 1, 2, 4, 8].map((v) => `<button data-speed="${v}" class="${app.speed === v ? 'on' : ''}" aria-label="${v ? v + ' kat hız' : 'Durdur'}">${v ? '▶'.repeat(Math.min(3, Math.log2(v) + 1)) : '❚❚'}</button>`).join('')}
        <button data-act="crunch" class="crunch ${s.crunch ? 'on' : ''}" title="Crunch: +%40 üretim, stres ve hata patlar">🔥 Crunch</button>
      </div>`;
  }
  function renderTicker() {
    const s = G()?.state;
    if (!s) return;
    el.ticker.innerHTML = s.news.slice(0, 3).map((n) => `<span class="${n.type}">${esc(n.t)}</span>`).join('');
  }

  // --- Sekmeler
  const TABS = [['proje', 'Proje'], ['kadro', 'Kadro'], ['arastirma', 'Araştırma'], ['pazar', 'Pazar'], ['finans', 'Finans'], ['haber', 'Haberler']];
  el.tabs.innerHTML = TABS.map(([id, n]) => `<button data-tab="${id}" id="tab-${id}">${n}</button>`).join('');

  function renderPanel() {
    if (!G()) return;
    for (const b of el.tabs.children) b.classList.toggle('on', b.dataset.tab === app.tab);
    const fn = { proje: tabProject, kadro: tabStaff, arastirma: tabResearch, pazar: tabMarket, finans: tabFinance, haber: tabNews }[app.tab];
    el.panel.innerHTML = fn();
  }

  // ---------- PROJE
  function defaultDraft() {
    const g = G(), c = ctx(), y = M.tableYear(c);
    const r = PACK.rivals;
    const pick = (a) => a[(g.state.week + g.state.games.length * 3) % a.length];
    return {
      name: `${pick(r.gameNamesA)} ${pick(r.gameNamesB)}`, genre: 'aksiyon', sub: '', topic: PACK.topics.find((t) => t[4] <= y)[0],
      audience: 'herkes', size: 'kucuk', engineId: '', sequelOf: '', platforms: ['pc'],
    };
  }
  function tabProject() {
    const g = G(), s = g.state, c = ctx();
    let html = '';
    if (!s.project) html += projectForm();
    else html += projectView();
    html += contractsView();
    return html;
  }
  function projectForm() {
    const g = G(), s = g.state, c = ctx(), y = M.tableYear(c);
    const d = (app.draft ||= defaultDraft());
    const done = s.research.done;
    const genres = PACK.genres.filter((x) => !x.research || done[x.research]);
    const topics = PACK.topics.filter((t) => t[4] <= y);
    const maxTech = PACK.workstations.tiers[s.stationTier].maxTech;
    const plats = M.activePlatforms(c);
    const trend = s.trend || {};
    const opt = (v, label, sel, dis = false) => `<option value="${v}" ${sel ? 'selected' : ''} ${dis ? 'disabled' : ''}>${esc(label)}</option>`;
    const cost = Prod.projectCost(c, d);
    return `<section class="card">
      <h2>Yeni oyun</h2>
      <div class="form">
        <label>Ad<input id="f-name" data-draft="name" value="${esc(d.name)}" maxlength="40"></label>
        <label>Tür<select id="f-genre" data-draft="genre">${genres.map((x) => opt(x.id, x.name + (trend.genre === x.id ? ' 🔥' : ''), d.genre === x.id)).join('')}</select></label>
        <label>Alt tür<select id="f-sub" data-draft="sub" ${done.alt_tur ? '' : 'disabled'}>${opt('', done.alt_tur ? 'Yok (−3)' : 'Araştırma gerekli (−3)', !d.sub)}${genres.filter((x) => x.id !== d.genre).map((x) => opt(x.id, x.name, d.sub === x.id)).join('')}</select></label>
        <label>Konu<select id="f-topic" data-draft="topic">${topics.map((t) => opt(t[0], t[1] + (trend.topic === t[0] ? ' 🔥' : ''), d.topic === t[0])).join('')}</select></label>
        <label>Kitle<select id="f-aud" data-draft="audience">${PACK.audiences.map((a) => opt(a.id, a.name, d.audience === a.id)).join('')}</select></label>
        <label>Boyut<select id="f-size" data-draft="size">${PACK.sizes.map((z) => {
          const lock = (z.research && !done[z.research]) ? ' (araştır)' : s.office.tier < z.office ? ` (${PACK.offices[z.office - 1].name})` : '';
          return opt(z.id, `${z.name} · ${z.weeks} hf${lock}`, d.size === z.id, !!lock);
        }).join('')}</select></label>
        <label>Motor<select id="f-engine" data-draft="engineId">${opt('', 'Motorsuz', !d.engineId)}${s.engines.map((e) => opt(e.id, `${e.name} (${M.engineScore(c, e)} puan)`, String(d.engineId) === String(e.id))).join('')}</select></label>
        <label>Seri (IP)<select id="f-ip" data-draft="sequelOf">${opt('', 'Yeni IP', !d.sequelOf)}${s.ips.map((ip) => opt(ip.id, `${ip.name} ★${ip.value.toFixed(1)}`, String(d.sequelOf) === String(ip.id))).join('')}</select></label>
      </div>
      <fieldset class="plats"><legend>Platformlar</legend>
        ${plats.map((p) => {
          const locked = p.tech > maxTech;
          const on = d.platforms.includes(p.id);
          return `<label class="chip ${locked ? 'locked' : ''}"><input type="checkbox" data-plat="${p.id}" ${on ? 'checked' : ''} ${locked ? 'disabled' : ''}>
            <span>${esc(p.name)}<small>${locked ? 'daha iyi istasyon' : `${M.platformBase(c, p).toFixed(1)} M kişi · lisans ${money(p.licence)}`}</small></span></label>`;
        }).join('')}
      </fieldset>
      <div class="row end"><span class="muted">Lisans + geliştirme kiti: <b class="num">${money(cost)}</b></span><button class="primary" data-act="start">Geliştirmeye başla</button></div>
    </section>`;
  }
  function projectView() {
    const g = G(), s = g.state, c = ctx(), pj = s.project;
    const genre = PACK.genres.find((x) => x.id === pj.genre);
    const topic = PACK.topics.find((t) => t[0] === pj.topic)[1];
    const prog = pj.status === 'dev' ? (pj.week / pj.totalWeeks) * 100 : 100;
    const pv = g.previewReview();
    const discs = ['oyn', 'gfx', 'ses', 'tek'].map((d) => {
      const T = M.target(c, d, pj.size);
      const v = (pj.points[d] / T) * 100;
      return `<div class="disc"><span>${discName(d)}</span>${bar(v, 'd-' + d)}<b class="num">${Math.round(Math.min(v, 999))}%</b></div>`;
    }).join('');
    const sliders = [0, 1, 2].map((ph) => `<div class="phase ${pj.status === 'dev' && pj.phase === ph ? 'now' : ''}"><h4>${PACK.production.phaseNames[ph]}</h4>
      ${PACK.missions.map((m, i) => (m.phase !== ph ? '' : `<label class="slider"><span>${m.name}${genre.mission[i] === 1 ? ' <i title="Bu tür için kritik">◆</i>' : ''}</span>
        <input type="range" min="0" max="100" step="5" id="alloc-${i}" data-alloc="${i}" value="${pj.alloc[i]}"></label>`)).join('')}</div>`).join('');
    const bugs = Math.round(pj.bugs);
    const camps = PACK.hype.campaigns.filter((x) => !x.minYear || M.tableYear(c) >= x.minYear).map((x) => {
      const lock = x.research && !s.research.done[x.research];
      return `<button data-act="campaign" data-id="${x.id}" ${lock ? 'disabled' : ''}>${x.name} <small>${lock ? 'araştır' : money(x.cost * M.inflation(c) ** 0.7)}</small></button>`;
    }).join('');
    let release = '';
    if (pj.status === 'debug') {
      const pubs = Market.publishersAvailable(c);
      const defPrice = Math.max(10, Math.round(20 * M.inflation(c) ** 0.4));
      release = `<div class="release"><h3>Yayınla</h3>
        <div class="form"><label>Yayıncı<select id="r-pub">
          ${pubs.map((p) => `<option value="${p.id}" ${s.fans < p.minFans ? 'disabled' : ''}>${esc(p.name)} · güç ${p.power} · pay %${Math.round(p.royalty * 100)}${s.fans < p.minFans ? ` (${fmt(p.minFans)} hayran)` : ''}</option>`).join('')}
          ${s.research.done.oz_yayin ? `<option value="">Kendi yayınım · güç ${Math.round(M.selfPublishPower(c))} · kâr ~%${Math.round((1 - PACK.sales.retailCut) * 100)}</option>` : ''}
        </select></label>
        <label>Fiyat ($)<input id="r-price" type="number" min="1" max="120" value="${defPrice}"></label></div>
        <div class="row end"><span class="muted">Kalan hata: ${bugs}. Beklemek hataları azaltır ama maaş yer.</span><button class="primary" data-act="release">Yayınla!</button></div></div>`;
    }
    return `<section class="card">
      <div class="row"><h2>${esc(pj.name)}</h2><span class="pill">${genre.name}${pj.sub ? ' + ' + PACK.genres.find((x) => x.id === pj.sub).name : ''} · ${esc(topic)} · ${PACK.sizes.find((z) => z.id === pj.size).name}</span></div>
      <div class="progress"><span>${pj.status === 'dev' ? PACK.production.phaseNames[pj.phase] + ` · hafta ${pj.week}/${pj.totalWeeks}` : 'Hata ayıklama'}</span>${bar(prog, 'prog')}</div>
      <div class="grid2">
        <div><h3>Hedefe ulaşma</h3>${discs}
          <p class="muted">Hata: <b class="num">${bugs}</b> · Hype: <b class="num">${Math.round(pj.hype)}</b> · Uyum ×${pv.F.toFixed(2)} · Hiza ×${pv.hiza.toFixed(2)}</p>
          <p class="forecast">Şu an çıksa not ≈ <b class="num">${Math.round(pv.score)}</b> ${pv.notes.length ? `<small>${pv.notes.map(esc).join(' · ')}</small>` : ''}</p></div>
        <div><h3>Zaman dağılımı</h3><div class="phases">${sliders}</div></div>
      </div>
      <div class="row wrap"><span class="muted">Pazarlama:</span>${camps}</div>
      ${release}
      <div class="row end"><button class="ghost danger" data-act="cancel">${app.confirm === 'cancel' ? 'Emin misin? Tekrar bas' : 'Projeyi iptal et'}</button></div>
    </section>`;
  }
  function contractsView() {
    const s = G().state;
    const cur = s.contract ? `<div class="contract on"><b>${esc(s.contract.client)}</b> · ${esc(s.contract.job)}
      ${bar((s.contract.progress / s.contract.need) * 100, 'prog')}<small>${Math.round(s.contract.progress)}/${s.contract.need} puan · teslim: ${s.contract.deadline - s.week} hf · ${money(s.contract.reward)}</small></div>` : '';
    const offers = s.contract ? '' : s.contractOffers.map((o) => `<div class="contract"><div><b>${esc(o.client)}</b> · ${esc(o.job)}<small>${o.need} puan · ${o.weeks} hafta · ödül ${money(o.reward)}</small></div><button data-act="contract" data-id="${o.id}">Kabul</button></div>`).join('');
    return `<section class="card"><h2>Sözleşme işleri</h2><p class="muted">Garajda kirayı ödemenin yolu. Kadro sekmesinden birini "Sözleşme"ye ata.</p>${cur}${offers || (cur ? '' : '<p class="muted">Bu ay teklif yok.</p>')}</section>`;
  }

  // ---------- KADRO
  function tabStaff() {
    const g = G(), s = g.state, c = ctx();
    const seatN = Staff.seats(c);
    const next = PACK.offices.find((o) => o.tier === s.office.tier + 1);
    const cur = Eco.office(c);
    const moveLabel = next ? `${next.name}'e taşın · ${money(next.cost * M.inflation(c) ** 0.5)}` : cur.floorCost && s.office.floors < cur.maxFloors ? `Yeni kat (+${cur.floorSeats}) · ${money(cur.floorCost * M.inflation(c) ** 0.5)}` : 'En büyük kampüs';
    const st = PACK.workstations.tiers[s.stationTier];
    const up = Eco.stationUpgradeCost(c);
    const exp = M.expectedStationTier(c);
    const people = s.staff.map((p) => `<div class="person ${p.status !== 'ok' ? 'away' : ''}">
      <div class="who"><b>${p.founder ? '👑 ' : ''}${esc(p.name)}</b><span class="spec s-${p.spec}">${discName(p.spec)}</span>${p.trait ? `<span class="trait">${esc(PACK.traits.find((t) => t.id === p.trait).name)}</span>` : ''}${STATUS[p.status] ? `<span class="pill warn">${STATUS[p.status]} ${p.statusWeeks} hf</span>` : ''}</div>
      <div class="vitals"><span>Beceri <b class="num">${Math.round(p.skill)}</b></span><span>Moral ${bar(p.morale, 'm')}</span><span>Stres ${bar(p.stress, 's')}</span><span class="num">${p.founder ? 'kurucu' : money(p.salary) + '/ay'}</span></div>
      <div class="acts">
        <select id="as-${p.id}" data-act="assign" data-id="${p.id}" aria-label="Görev">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${p.assign === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <select id="tr-${p.id}" data-act="train" data-id="${p.id}" aria-label="Eğitim"><option value="">Eğitim…</option>${PACK.training.map((t) => `<option value="${t.id}">${t.name} · ${money(t.cost * M.inflation(c))}</option>`).join('')}</select>
        ${p.founder ? '' : `<button data-act="raise" data-id="${p.id}">Zam %12</button><button class="ghost danger" data-act="fire" data-id="${p.id}">${app.confirm === 'fire' + p.id ? 'Emin misin?' : 'Kov'}</button>`}
      </div></div>`).join('');
    const apps = s.applicants.map((p) => `<div class="person applicant"><div class="who"><b>${esc(p.name)}</b><span class="spec s-${p.spec}">${discName(p.spec)}</span>${p.trait ? `<span class="trait">${esc(PACK.traits.find((t) => t.id === p.trait).name)}</span>` : ''}</div>
      <div class="vitals"><span>Beceri <b class="num">${p.skill}</b></span><span class="num">${money(p.salary)}/ay</span></div><button data-act="hire" data-id="${p.id}" ${s.staff.length >= seatN ? 'disabled' : ''}>İşe al</button></div>`).join('');
    return `<section class="card"><div class="row"><h2>Ekip <span class="num">${s.staff.length}/${seatN}</span></h2>
        <div class="row wrap"><button data-act="office">${moveLabel}</button>
        <button data-act="stations" ${up == null ? 'disabled' : ''}>${up == null ? 'İstasyonlar son seviye' : `İstasyon yükselt · ${money(up)}`}</button></div></div>
      <p class="muted">Bilgisayarlar: <b>${st.name}</b> (platform seviyesi ≤ ${st.maxTech}) · üretim ×${M.stationFactor(c).toFixed(2)}${s.stationTier < exp ? ' · <span class="neg">dönemin gerisinde</span>' : ''}</p>
      <div class="row wrap"><span class="muted">Herkesi:</span>${Object.entries(ROLES).map(([k, v]) => `<button class="ghost" data-act="assignAll" data-id="${k}">${v}</button>`).join('')}</div>
      ${people}</section>
      <section class="card"><h2>Başvurular</h2><p class="muted">Her ay yenilenir. İşe alım ücreti bir aylık maaş.</p>${apps || '<p class="muted">Bu ay başvuru yok.</p>'}</section>`;
  }

  // ---------- ARAŞTIRMA
  function tabResearch() {
    const g = G(), s = g.state, c = ctx();
    const cur = s.research.current ? (() => { const it = PACK.research.find((r) => r.id === s.research.current.id); return `<p>Sürüyor: <b>${esc(it.name)}</b> · ${s.research.current.weeksLeft} hafta kaldı</p>`; })() : '<p class="muted">Şu an araştırma yok.</p>';
    const av = Prod.researchAvailable(c).map((r) => {
      const i = Prod.researchInfo(c, r);
      const can = s.research.rp >= i.rp && !s.research.current;
      return `<div class="res"><div><b>${esc(r.name)}</b><small>${i.rp} RP · ${money(i.cost)} · ${i.weeks} hf</small></div><button data-act="research" data-id="${r.id}" ${can ? '' : 'disabled'}>Başlat</button></div>`;
    }).join('');
    const feats = PACK.research.filter((r) => r.engine && s.research.done[r.id]);
    const builder = s.research.done.motor_ozel ? `<div class="form"><label>Motor adı<input id="e-name" data-eng="name" value="${esc(app.engineName)}" maxlength="24"></label></div>
      <div class="plats">${feats.map((f) => { const st = M.featureStats(c, f.id); return `<label class="chip"><input type="checkbox" data-feat="${f.id}" ${app.engineSel.has(f.id) ? 'checked' : ''}><span>${esc(f.name.replace('Motor: ', ''))}<small>${st.enginePts} puan · ${money(st.engineCost)}</small></span></label>`; }).join('') || '<p class="muted">Önce motor özelliği araştır.</p>'}</div>
      <div class="row end">${s.engineJob ? `<span class="muted">Yapılıyor: ${esc(s.engineJob.name)} · ${s.engineJob.weeksLeft} hf</span>` : `<button class="primary" data-act="engine">Motoru yap</button>`}</div>` : '<p class="muted">"Kendi motorunu yap" araştırmasıyla açılır.</p>';
    const engines = s.engines.map((e) => `<div class="res"><div><b>${esc(e.name)}</b><small>${M.engineScore(c, e)} puan · ${e.features.length} özellik · ${Math.floor(e.builtYear)} · etki ×${M.engineFactor(c, e).toFixed(2)}</small></div>
      <button data-act="licence" data-id="${e.id}" ${s.research.done.motor_lisans ? '' : 'disabled'}>${e.licensed ? 'Lisansı kapat' : 'Lisansla'}</button></div>`).join('');
    return `<section class="card"><div class="row"><h2>Araştırma</h2><span class="pill num">${Math.floor(s.research.rp)} RP</span></div>${cur}
      <p class="muted">Herkes üretiminin bir kısmını RP'ye çevirir; "Araştırma" görevindekiler çok daha fazla.</p>${av || '<p class="muted">Şimdilik araştırılacak bir şey yok. Yıllar geçtikçe yenileri açılır.</p>'}</section>
      <section class="card"><h2>Oyun motoru</h2>${builder}${engines}</section>`;
  }

  // ---------- PAZAR
  function tabMarket() {
    const g = G(), s = g.state, c = ctx();
    const tr = s.trend ? (s.trend.genre ? PACK.genres.find((x) => x.id === s.trend.genre).name : PACK.topics.find((t) => t[0] === s.trend.topic)[1]) : '—';
    const mods = s.marketMods.map((m) => { const e = PACK.eras.find((x) => x.id === m.id); return `<span class="pill ${m.salesMult < 1 ? 'warn' : ''}">${esc(e.title)} · satış ×${m.salesMult}</span>`; }).join('');
    const games = [...s.games].reverse().map((x) => `<tr class="${x.active ? '' : 'dim'}"><td>${esc(x.name)}${x.mmo ? ' <small>MMO</small>' : ''}</td><td class="num">${x.score}</td><td class="crit">${x.critics.map((k) => k.score).join(' ')}</td><td class="num">${fmt(x.units)}</td><td class="num">${money(x.revenue)}</td><td class="num">${x.active ? fmt(x.lastWeek) + '/hf' : x.mmo && x.subs > 0 ? fmt(x.subs) + ' abone' : '—'}</td></tr>`).join('');
    const charts = s.charts.slice(0, 10).map((x) => `<li class="${x.mine ? 'mine' : ''}"><b class="num">${x.score}</b> ${esc(x.name)} <small>${esc(x.studio)}</small></li>`).join('');
    const rivals = s.rivals.map((r) => `<div class="res"><div><b>${esc(r.name)}</b><small>itibar ${Math.round(r.rep)} · ${r.games} oyun · son not ${r.lastScore || '—'}</small></div>
      ${r.acquired ? '<span class="pill">Senin</span>' : `<button data-act="acquire" data-id="${r.id}">Satın al · ${money(Market.rivalPrice(c, r))}</button>`}</div>`).join('');
    return `<section class="card"><div class="row"><h2>Pazar</h2><span class="pill">Trend: ${esc(tr)} 🔥</span></div>${mods ? `<div class="row wrap">${mods}</div>` : ''}
      <div class="scroll"><table><thead><tr><th>Oyun</th><th>Not</th><th>Eleştirmenler</th><th>Kopya</th><th>Gelir</th><th>Bu hafta</th></tr></thead><tbody>${games || '<tr><td colspan="6" class="muted">Henüz oyun yok.</td></tr>'}</tbody></table></div></section>
      <section class="card grid2"><div><h2>Son çıkanlar</h2><ol class="charts">${charts}</ol></div><div><h2>Rakipler</h2>${rivals}</div></section>`;
  }

  // ---------- FİNANS
  function tabFinance() {
    const g = G(), s = g.state, c = ctx();
    const y = Math.floor(s.week / 48);
    const years = [y - 2, y - 1, y].filter((v) => v >= 0);
    const cats = [...new Set(years.flatMap((v) => Object.keys(s.ledger.byYear[v] || {})))];
    const head = years.map((v) => `<th>Y${v + 1} · ${Math.floor(PACK.meta.startYear + v / s.lengthMult)}</th>`).join('');
    const rows = cats.map((k) => `<tr><td>${k}</td>${years.map((v) => { const a = (s.ledger.byYear[v] || {})[k] || 0; return `<td class="num ${a < 0 ? 'neg' : ''}">${a ? money(a) : '—'}</td>`; }).join('')}</tr>`).join('');
    const tot = `<tr class="tot"><td>Net</td>${years.map((v) => { const a = g.ctx.ledger.yearProfit(v); return `<td class="num ${a < 0 ? 'neg' : ''}">${money(a)}</td>`; }).join('')}</tr>`;
    const owed = s.loans.reduce((a, l) => a + l.remaining, 0);
    const avail = Math.max(0, Eco.creditLimit(c) * 3 - owed);
    const loans = s.loans.map((l) => `<li>${money(l.amount)} · aylık ${money(l.monthly)} · kalan ${money(l.remaining)}</li>`).join('');
    const wages = s.staff.reduce((a, p) => a + p.salary, 0);
    return `<section class="card"><h2>Durum</h2>
      <div class="kv"><span>Aylık maaş</span><b class="num">${money(wages)}</b><span>Aylık kira</span><b class="num">${money(Eco.rent(c))}</b>
      <span>Kredi limiti</span><b class="num">${money(Eco.creditLimit(c))}</b><span>Borç</span><b class="num">${money(owed)}</b></div>
      ${s.debtWeeks ? `<p class="neg">Limit aşımı: ${s.debtWeeks}/${PACK.economy.bankruptWeeks} hafta. Sonra iflas.</p>` : ''}
      <div class="row wrap"><span class="muted">Kredi çek (24 ay, yıllık %${PACK.economy.loanRateYear * 100}):</span>${[0.25, 0.5, 1].map((f) => `<button data-act="loan" data-id="${Math.round(avail * f)}" ${avail < 1000 ? 'disabled' : ''}>${money(avail * f)}</button>`).join('')}</div>
      ${loans ? `<ul>${loans}</ul>` : ''}</section>
      <section class="card"><h2>Defter</h2><div class="scroll"><table><thead><tr><th>Kalem</th>${head}</tr></thead><tbody>${rows}${tot}</tbody></table></div></section>`;
  }

  function tabNews() {
    const s = G().state;
    return `<section class="card"><h2>Haberler</h2><ul class="news">${s.news.map((n) => `<li class="${n.type}"><small class="num">Y${Math.floor(n.w / 48) + 1} A${Math.floor((n.w % 48) / 4) + 1}</small>${esc(n.t)}</li>`).join('')}</ul></section>`;
  }

  // --- olay penceresi
  function showModal() {
    const g = G();
    if (!g) return;
    const s = g.state;
    if (s.gameOver) {
      setSpeed(0);
      const score = g.finalScore();
      el.modal.innerHTML = `<div class="dialog over"><h2>${s.gameOver.reason === 'iflas' ? 'İFLAS' : 'SON'}</h2><p>${esc(s.gameOver.text)}</p>
        <div class="kv"><span>Oyun</span><b class="num">${s.games.length}</b><span>Hayran</span><b class="num">${fmt(s.fans)}</b><span>Ödül</span><b class="num">${s.awards.length}</b><span>Skor</span><b class="num">${fmt(score)}</b></div>
        <button class="primary" data-act="newgame">Yeni kariyer</button></div>`;
      el.modal.hidden = false;
      store((st) => st.removeItem(SAVE_KEY));
      return;
    }
    const ev = s.pending[0];
    if (!ev) { el.modal.hidden = true; return; }
    el.modal.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="ev-title"><h2 id="ev-title">${esc(ev.title)}</h2><p>${esc(ev.text)}</p>
      <div class="choices">${ev.choices.map((ch, i) => `<button data-choice="${i}" class="${i === 0 ? 'primary' : ''}">${esc(ch.label)}</button>`).join('')}</div></div>`;
    el.modal.hidden = false;
    el.modal.querySelector('button')?.focus();
  }

  function setupScreen() {
    const has = store((s) => s.getItem(SAVE_KEY));
    el.modal.innerHTML = `<div class="dialog setup"><h1>X PROJECT</h1><p class="tag">Garajdan imparatorluğa. Ya da iflasa.</p>
      ${has ? '<button class="primary wide" data-act="continue">Kayıtlı kariyere devam et</button><hr>' : ''}
      <div class="form">
        <label>Stüdyo adı<input id="n-company" value="Piksel & Kaos"></label>
        <label>Kurucu adı<input id="n-founder" value="Sen"></label>
        <label>Kurucunun alanı<select id="n-spec">${PACK.disciplines.map((d) => `<option value="${d.id}">${d.name}</option>`).join('')}</select></label>
        <label>Zorluk<select id="n-diff">${PACK.difficulties.map((d) => `<option value="${d.id}" ${d.id === 'kolay' ? 'selected' : ''}>${d.name} · ${money(d.startCash)}</option>`).join('')}</select></label>
        <label>Kariyer uzunluğu<select id="n-len">${Object.keys(PACK.meta.gameLengths).map((l) => `<option value="${l}" ${+l === PACK.meta.defaultLength ? 'selected' : ''}>${l} yıl</option>`).join('')}</select></label>
        <label>Tohum<input id="n-seed" type="number" value="${(Date.now() % 100000) | 0}"></label>
      </div>
      <button class="primary wide" data-act="begin">1976'da garajı aç</button></div>`;
    el.modal.hidden = false;
  }

  function start(game) {
    app.game = game; app.draft = null; app.engineSel = new Set();
    el.modal.hidden = true;
    render(true);
    setSpeed(1);
    if (game.state.pending.length) showModal();
  }

  // --- olay yönetimi
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.speed !== undefined) return setSpeed(+b.dataset.speed);
    if (b.dataset.tab) { app.tab = b.dataset.tab; app.confirm = null; return renderPanel(); }
    if (b.dataset.choice !== undefined) {
      G().resolve(+b.dataset.choice);
      save();
      if (G().state.pending.length) showModal(); else { el.modal.hidden = true; render(true); }
      return;
    }
    const act = b.dataset.act, id = b.dataset.id;
    const g = G();
    switch (act) {
      case 'begin': {
        const v = (q) => root.querySelector(q).value;
        start(newGame({ companyName: v('#n-company') || 'X Project', founderName: v('#n-founder') || 'Sen', founderSpec: v('#n-spec'), difficulty: v('#n-diff'), length: +v('#n-len'), seed: +v('#n-seed') || 1976 }));
        return;
      }
      case 'continue': { const j = store((s) => s.getItem(SAVE_KEY)); if (j) start(loadGame(j)); return; }
      case 'newgame': setupScreen(); return;
      case 'crunch': g.toggleCrunch(); return render(true);
      case 'start': {
        const d = app.draft;
        const res = g.startProject({ ...d, engineId: d.engineId ? +d.engineId : null, sequelOf: d.sequelOf ? +d.sequelOf : null, sub: d.sub || null });
        if (res.ok) app.draft = null;
        return run(res);
      }
      case 'release': {
        const pub = root.querySelector('#r-pub').value || null;
        const price = Math.max(1, +root.querySelector('#r-price').value || 20);
        const res = g.release({ publisherId: pub, price });
        if (res.ok) { app.tab = 'pazar'; toast(`"${res.game.name}" çıktı. Not ${res.review.score}`, false); }
        return run(res);
      }
      case 'cancel': if (app.confirm === 'cancel') { g.cancelProject(); app.confirm = null; } else app.confirm = 'cancel'; return render(true);
      case 'campaign': return run(g.campaign(id));
      case 'contract': return run(g.acceptContract(+id));
      case 'hire': return run(g.hire(+id));
      case 'fire': if (app.confirm === 'fire' + id) { app.confirm = null; return run(g.fire(+id)); } app.confirm = 'fire' + id; return render(true);
      case 'raise': return run(g.raise(+id));
      case 'assignAll': g.assignAll(id); return render(true);
      case 'office': return run(g.moveOffice());
      case 'stations': return run(g.upgradeStations());
      case 'research': return run(g.startResearch(id));
      case 'engine': { const r = g.buildEngine(app.engineName || 'Motor', [...app.engineSel]); if (r.ok) app.engineSel.clear(); return run(r); }
      case 'licence': return run(g.toggleLicence(+id));
      case 'loan': return run(g.takeLoan(+id));
      case 'acquire': return run(g.acquireRival(+id));
    }
  });
  root.addEventListener('change', (e) => {
    const t = e.target, g = G();
    if (!g) return;
    if (t.dataset.draft) { app.draft[t.dataset.draft] = t.value; if (t.dataset.draft !== 'name') renderPanel(); return; }
    if (t.dataset.plat) { const set = new Set(app.draft.platforms); t.checked ? set.add(t.dataset.plat) : set.delete(t.dataset.plat); app.draft.platforms = [...set]; return renderPanel(); }
    if (t.dataset.feat) { t.checked ? app.engineSel.add(t.dataset.feat) : app.engineSel.delete(t.dataset.feat); return; }
    if (t.dataset.eng) { app.engineName = t.value; return; }
    if (t.dataset.act === 'assign') { g.assign(+t.dataset.id, t.value); t.blur(); return render(true); }
    if (t.dataset.act === 'train' && t.value) { run(g.train(+t.dataset.id, t.value)); return; }
    if (t.dataset.alloc !== undefined) { t.blur(); render(true); }
  });
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.alloc !== undefined) G().setAlloc(+t.dataset.alloc, +t.value);
    if (t.dataset.draft === 'name') app.draft.name = t.value;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' && G() && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName || '')) { e.preventDefault(); setSpeed(app.speed ? 0 : 1); }
  });

  // --- açılış
  requestAnimationFrame(loop);
  const hot = hotData.save;
  if (hot) { app.tab = hotData.tab || 'proje'; start(loadGame(hot)); }
  else setupScreen();
}
