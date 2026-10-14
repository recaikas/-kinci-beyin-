// Geliştir: proje listesi, yeni oyun sihirbazı, proje ayrıntısı, sözleşmeler.
import { M, Prod, Market, Staff, Know, Modern, Charts } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { esc, fmt, bar, discName } from './util.js';

export function make(u) {
  const { G, app, ctx } = u;
  const start = (...a) => u.start(...a);
  // ---------- GELİŞTİR: proje listesi, sihirbaz (bilgi rozetli), proje ayrıntısı
  function defaultDraft() {
    const g = G(), y = M.tableYear(ctx());
    const r = PACK.rivals, pick = (a) => a[(g.state.week + g.state.games.length * 3) % a.length];
    return { name: `${pick(r.gameNamesA)} ${pick(r.gameNamesB)}`, genre: 'aksiyon', sub: '', topic: PACK.topics.find((t) => t[4] <= y)[0], audience: 'herkes', size: 'kucuk', engineId: '', sequelOf: '', platforms: ['pc'], roomId: '', regions: Prod.baseRegions(ctx()) };
  }
  const badgeOf = (v) => (v == null ? '' : `<em class="kn k${v}">${Know.rating(v)[0]}</em>`);
  // Yayın zamanlaması (Konu A): bu ayın talebi ve yakın tarihte aynı türde çıkacak büyük oyunlar
  function releaseTiming(pj) {
    const c = ctx(), mult = Charts.seasonMult(c, pj);
    const clash = Charts.upcoming(c).filter((h) => h.genre === pj.genre && h.weeks <= 6);
    const nameOf = (id) => PACK.genres.find((x) => x.id === id)?.name.toLowerCase() || '';
    return `<p class="small">📅 Bu ay talep ×${mult.toFixed(2).replace('.', ',')}${mult >= 1.3 ? ' (yılsonu: talep yüksek ama rakip de çok)' : mult < 0.9 ? ' (sakin ay: talep düşük, rakip az)' : ''}.${clash.length ? ` ⚠️ ${clash.map((h) => `${h.weeks} hafta sonra ${esc(h.studio)} "${esc(h.name)}"`).join(', ')} çıkıyor (${nameOf(pj.genre)}).` : ''}</p>`;
  }
  function announceBox(pj) {
    const s = G().state, a = PACK.charts.announce;
    if (pj.announce) return `<p class="small">📣 Çıkış tarihi duyuruldu: ${Math.max(0, pj.announce - s.week)} hafta sonra. Geri sayım hype veriyor; tarihi kaçırırsan hayranlar kızar.</p>`;
    if (pj.annMissed) return '<p class="muted small">Duyurulan tarih kaçırıldı; yeni tarih verilemez.</p>';
    if (!Charts.announceAllowed(ctx(), pj)) return '';
    const left = pj.status === 'dev' ? pj.totalWeeks - pj.week : 0;
    return `<p class="muted small">Çıkış tarihi duyur: geri sayım haftada +${String(a.hypePerWeek).replace('.', ',')} hype verir (en çok ${a.hypeCap}) ve aynı türdeki rakipler tarih kaydırabilir. Kalan geliştirme ~${left} hafta.</p>
      <div class="btns">${a.options.map((w) => `<button data-act="announce" data-pid="${pj.id}" data-id="${w}" ${w < left ? 'class="warn"' : ''}>${w} hafta sonra<small>${w < left ? 'riskli' : 'güvenli'}</small></button>`).join('')}</div>`;
  }
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
      d.regions ||= Prod.baseRegions(c);
      const gi = PACK.genres.findIndex((x) => x.id === d.genre), w = M.regionShares(c);
      const regs = PACK.regions.list.map((r) => { const st = Prod.regionStatus(c, r.id), on = d.regions.includes(r.id) || st.free;
        return `<label class="pick ${st.ok ? '' : 'locked'}"><input type="checkbox" id="rg-${r.id}" data-region="${r.id}" ${on ? 'checked' : ''} ${!st.ok || st.free ? 'disabled' : ''}>
          <span class="name">${esc(r.name)} <small class="muted">pazarın %${Math.round(w[r.id] * 100)} · ${PACK.genres[gi].name} ilgisi ×${r.pref[gi]}</small></span><span class="meta num">${st.free ? 'İngilizce sürüm' : st.ok ? money(Prod.locCost(c, r.id, d.size)) : st.why}</span></label>`; }).join('');
      return head + `<fieldset class="picks"><legend>Platformlar <small>rozet: seçili türle bilinen uyum</small></legend>${plats}</fieldset>
        <fieldset class="picks"><legend>Bölgeler <small>yerelleştirme bedeli boyuta göre</small></legend>${regs}</fieldset>
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
      release = `<section class="box hl"><h3>Yayına hazır</h3><div class="form">
        ${u.releaseChoice(pj)}
        <label>Fiyat ($)<input id="r-price" type="number" min="1" max="120" value="${Math.max(10, Math.round(20 * M.inflation(c) ** 0.4))}"></label>
        ${Modern.f2pAllowed(c) ? `<label>İş modeli<select id="r-model"><option value="satis">Satış (ücretli)</option><option value="f2p">Ücretsiz + oyun içi satış</option></select></label>
          <label>Para kazanma<select id="r-monet">${PACK.modern.f2p.monet.map((m) => `<option value="${m.id}" ${m.id === 'dengeli' ? 'selected' : ''}>${esc(m.name)}${m.score ? ` (not ${m.score})` : ''}</option>`).join('')}</select></label>` : ''}
        ${(() => { const offers = Modern.serviceOffers(c, pj, G().previewReview(pid).score); return offers.length ? `<label class="wide">Abonelik servisi<select id="r-svc"><option value="">Servise girme</option>${offers.map((o) => `<option value="${o.id}">${esc(o.name)} · önden ${money(o.pay)} · satış ×${PACK.modern.services.salesMult}</option>`).join('')}</select></label>` : ''; })()}</div>
        ${pj.ea ? `<p class="small">🧪 Erken erişimde ${pj.ea.weeks} hafta: ${fmt(pj.ea.units)} kopya, ${money(pj.ea.revenue)}.${pj.ea.weeks >= PACK.modern.ea.polishWeeks ? ` Not +${PACK.modern.ea.polishBonus}.` : ''} İlk satışlar %${Math.round(PACK.modern.ea.peakCut * 100)} az olur.</p>` : ''}
        ${pj.crowd ? `<p class="small">💰 Destekçiler ${money(pj.crowd)} verdi; not ${PACK.modern.crowd.angryBelow}'in altında kalırsa öfkelenirler.</p>` : ''}
        ${!Charts.isDigital(c) && s.research.done.oz_yayin ? `<div class="form"><label class="wide">Basım adedi (kendi yayınında)<select id="r-print">${Object.entries(PACK.charts.print.runs).map(([k, w]) => `<option value="${k}" ${k === 'normal' ? 'selected' : ''}>${{ temkinli: 'Temkinli', normal: 'Normal', cesur: 'Cesur' }[k]} · ilk ${w} haftalık tahmin</option>`).join('')}</select></label></div>` : ''}
        ${releaseTiming(pj)}
        <div class="foot"><span class="muted small">${fmt(pj.bugs)} hata kaldı. Beklemek hataları azaltır, maaş yer.</span><button class="primary big" data-act="release" data-pid="${pid}">Yayınla</button></div></section>`;
    }
    const pubBox = u.projectPubBox(pj);
    return `<div class="foot"><button class="ghost" data-act="back">← Projeler</button><span></span></div>
      <div class="proj-head"><div><h2>${esc(pj.name)}</h2><p class="muted small">${genre.name}${pj.sub ? ' + ' + PACK.genres.find((x) => x.id === pj.sub).name : ''} · ${esc(topic)} · ${PACK.sizes.find((z) => z.id === pj.size).name}${pj.kind === 'ek' ? ' · ek paket' : ''}</p></div>
        <div class="forecast"><small>Şu an çıksa</small><b class="num">${Math.round(pv.score)}</b></div></div>
      <div class="progress"><span>${pj.status === 'dev' ? `${PACK.production.phaseNames[pj.phase]} · hafta ${pj.week}/${pj.totalWeeks}` : 'Hata ayıklama'}</span>${bar(prog, 'prog')}</div>
      ${pj.deal ? release + pubBox : pubBox + release}
      <section class="box"><h3>Hedefe ulaşma</h3>${discs}<p class="muted small">${pv.notes.map(esc).join(' · ') || 'Ceza yok'} · Uyum ×${pv.F.toFixed(2)} · Hiza ×${pv.hiza.toFixed(2)} · Hype ${Math.round(pj.hype)}</p>
        ${pj.status === 'dev' ? `<div class="foot"><button data-act="phase" data-pid="${pid}">Zaman dağılımını ayarla</button></div>` : ''}</section>
      <section class="box"><h3>Bölgeler</h3><div class="btns">${PACK.regions.list.map((r) => { const on = (pj.regions || []).includes(r.id), st = Prod.regionStatus(c, r.id); return on ? `<span class="pill">✓ ${esc(r.short)}</span>` : `<button data-act="localize" data-pid="${pid}" data-id="${r.id}" ${st.ok ? '' : 'disabled'}>${esc(r.short)}<small>${st.ok ? money(Prod.locCost(c, r.id, pj.size)) : st.why}</small></button>`; }).join('')}</div></section>
      <section class="box"><h3>Pazarlama</h3><div class="btns">${camps}</div>${announceBox(pj)}</section>
      ${pj.status === 'dev' && (Modern.eaAllowed(c, pj) || pj.ea || Modern.crowdAllowed(c, pj) || pj.crowd || M.tableYear(c) >= PACK.modern.ea.year) ? `<section class="box"><h3>Erken erişim ve fonlama</h3>
        <div class="foot"><span class="muted small">${pj.ea ? `Erken erişimde ${pj.ea.weeks} hafta · ${fmt(pj.ea.units)} kopya · ${money(pj.ea.revenue)}` : 'Projenin üçte biri bitince yarım oyunu satışa aç: para ve geri bildirim (hata azalır, not artar), ama tam çıkışta ilk satışlar azalır.'}</span>${pj.ea ? '' : `<button data-act="ea" data-pid="${pid}" ${Modern.eaAllowed(c, pj) ? '' : 'disabled'}>Erken erişime aç</button>`}</div>
        ${M.tableYear(c) >= PACK.modern.crowd.from && M.tableYear(c) < PACK.modern.crowd.to ? `<div class="foot"><span class="muted small">${pj.crowd ? `Kitle fonlamada ${money(pj.crowd)} toplandı.` : `Kitle fonlama: hayranlarından önden para (~${money(Modern.crowdAmount(c, pj))}). Not düşük çıkarsa destekçiler öfkelenir.`}</span>${pj.crowd ? '' : `<button data-act="crowd" data-pid="${pid}" ${Modern.crowdAllowed(c, pj) ? '' : 'disabled'}>Kampanya aç</button>`}</div>` : ''}</section>` : ''}
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

  return { defaultDraft, badgeOf, winDevelop, projectList, wizard, projectView, contractsView };
}
