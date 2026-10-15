// Ar-Ge: araştırma, teknoloji ve motor (win_engines.js), türler, donanım/konsol tasarımı.
import { M, Prod, Con, War } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { esc, fmt, bar } from './util.js';

export function make(u) {
  const { G, app, ctx } = u;
  // ---------- AR-GE
  function winResearch(sub) {
    const s = G().state, c = ctx();
    if (sub === 'motor') return u.engineView(); // Konu E
    if (sub === 'teknoloji') return u.techTree();
    if (sub === 'konsol') return consoleView();
    if (sub === 'turler') return u.genreTree(); // Konu D
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
    const live = s.consoles.filter((k) => k.launched && !k.retired);
    const segs = [...new Set(live.map((k) => M.segmentOf({ kind: Con.typeById(c, k.type)?.kind })))];
    const segName = { konsol: 'Ev konsolu', el: 'El konsolu', salon: 'Salon makinesi', pc: 'Bilgisayar', vr: 'VR', bulut: 'Bulut' };
    const war = segs.length ? `<section class="box"><h3>Konsol savaşı</h3><p class="muted small">Senin konsolların aynı segmentteki rakiplerden oyuncu çalar. Pay büyüdükçe rakipler fiyat kırar, özel oyun kapar; zayıf olan donanımdan çekilir. Üçüncü parti yayıncılar payın kadar senin konsoluna da oyun çıkarır.</p>
      ${segs.map((seg) => `<h3 class="sub">${segName[seg] || seg}</h3><div class="split-bars">${War.segmentShares(c, seg).slice(0, 6).map((r) => `<div class="${r.own ? 'mine' : ''}"><span>${r.own ? '★ ' : ''}${esc(r.name)}</span>${bar(r.share * 100, r.own ? 'm' : 'prog')}<b class="num">%${Math.round(r.share * 100)}</b></div>`).join('')}</div>`).join('')}
      ${live.map((k) => `<div class="row-item"><div><b>${esc(k.name)}</b><small>${k.thirdParty || 0} üçüncü parti oyun${k.dealUntil && s.week < k.dealUntil ? ' · özel anlaşma sürüyor' : ''}</small></div><button data-act="mi" data-id="anlasma" ${k.ended ? 'disabled' : ''}>Özel anlaşmalar<small>İş › Özel anlaşmalar</small></button></div>`).join('')}</section>` : '';
    const lists = `${war}${series}${old}${soon ? `<section class="box"><h3>Ufuktaki teknolojiler</h3><p class="btns">${soon}</p><p class="muted small">Yılı gelince Ar-Ge'de araştırılabilir.</p></section>` : ''}`;
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
    const gfit = q && !q.issues.length ? PACK.genres.map((g) => { const v = Math.round(M.platGenre(c, { genre: q.genre, kind: q.kind || 'konsol' }, g.id)); return `<span class="pill ${v >= 10 ? '' : v <= 7 ? 'warn' : ''}">${g.name} ${v}</span>`; }).join(' ') : '';
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

  return { winResearch, consoleDraft, consoleView };
}
