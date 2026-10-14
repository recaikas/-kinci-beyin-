// Pazar: oyun ayrıntısı, satış listesi, son çıkanlar, rakipler.
import { M, Market, Post, Know, Modern, Charts, Genres } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { esc, fmt, bar, move } from './util.js';

export function make(u) {
  const { G, app, ctx } = u;
  const chart = (...a) => u.chart(...a);
  const spark = (...a) => u.spark(...a);
  // ---------- PAZAR
  function gameDetail(gm) {
    const g = G(), s = g.state, c = ctx();
    const P = PACK.post;
    const targets = Post.portTargets(c, gm);
    const canExp = Post.expansionAllowed(c, gm) && g.freeDevRooms().length;
    const wk = (gm.hist || []).map((_, i, a) => `${gm.weeks - a.length + i + 1}. hafta`);
    const lbl = Charts.rankLabel(c, gm);
    const MX = PACK.modern, ty = M.tableYear(c);
    const modern = gm.active ? `<div class="btns">
        ${ty >= MX.dlc.year ? `<button data-act="dlc" data-id="${gm.id}" ${Modern.dlcAllowed(c, gm) ? '' : 'disabled'}>İndirilebilir içerik<small>${Modern.dlcAllowed(c, gm) ? money(Modern.dlcCost(c, gm)) : 'araştır'}</small></button>` : ''}
        ${ty >= MX.dlc.passYear && gm.model !== 'f2p' ? `<button data-act="pass" data-id="${gm.id}" ${Modern.seasonPassAllowed(c, gm) ? '' : 'disabled'}>Sezon kartı sat<small>${gm.pass ? (gm.passDue ? `${gm.passNeed - (gm.dlcs || 0)} içerik borcun var` : 'satıldı') : `${MX.dlc.passDlcs} içerik sözü`}</small></button>` : ''}
        ${ty >= MX.stream.year ? `<button data-act="stream" data-id="${gm.id}">Yayıncılara anahtar<small>${money(Modern.streamCost(c, gm))}</small></button>` : ''}
      </div>` : '';
    const actions = gm.active ? `<div class="btns">
        <button data-act="patch" data-id="${gm.id}" ${gm.patches >= P.patchMax ? 'disabled' : ''}>Güncelleme yayınla<small>${gm.patches >= P.patchMax ? 'sınırda' : money(Post.patchCost(c, gm))}</small></button>
${gm.model === 'f2p' ? '' : `        <button data-act="pricedrop" data-id="${gm.id}">Fiyatı %${Math.round(P.priceDropPct * 100)} düşür<small>${gm.price} $ → ${Math.max(P.priceFloor, Math.round(gm.price * (1 - P.priceDropPct)))} $</small></button>`}
      </div>` : '<p class="muted small">Oyun raflardan kalktı. Port ile yeni platformda yeniden çıkabilir.</p>';
    const port = !gm.expansion && !gm.portOf && targets.length ? `<div class="form"><label class="wide">Başka platforma uyarla (port)<select id="port-sel">${targets.map((p) => `<option value="${p.id}">${esc(p.name)} · ${money(Post.portCost(c, gm, p.id))}</option>`).join('')}</select></label></div>
      <div class="foot"><span class="muted small">Not −${P.portScorePenalty}, satış ×${P.portSales}.</span><button data-act="port" data-id="${gm.id}">Uyarla</button></div>` : '';
    const exp = !gm.expansion && !gm.portOf ? `<div class="foot"><span class="muted small">Ek paket: aynı konu ve türde kısa proje, temel oyunun satışlarına bağlı. ${Post.expansionAllowed(c, gm) ? '' : 'Bu oyun için artık yapılamaz.'}</span><button data-act="expansion" data-id="${gm.id}" ${canExp ? '' : 'disabled'}>Ek paket başlat</button></div>` : '';
    return `<div class="foot"><button class="ghost" data-act="back-game">← Oyunlar</button><span></span></div>
      <div class="proj-head"><div><h2>${esc(gm.name)}</h2><p class="muted small">${PACK.genres.find((x) => x.id === gm.genre).name}${gm.sub && Genres.SUB[gm.sub] ? ` · ${esc(Genres.SUB[gm.sub].name)}` : ''}${gm.review?.combo ? ` · kombinasyon ${Genres.TIER[gm.review.combo].icon} ${Genres.TIER[gm.review.combo].name}` : ''}${gm.cult ? ' · 🎭 kült klasik' : ''}${gm.pioneer ? ' · 🧪 öncü' : ''} · ${gm.year} · ${gm.platforms.map((id) => esc(M.platformById(c, id)?.name || id)).join(', ')} · ${gm.price} $</p></div>
        <div class="forecast"><small>Not</small><b class="num">${gm.score}</b></div></div>
      <div class="stats4">
        <div><small>Bu hafta</small><b class="num">${gm.active ? fmt(gm.lastWeek) : '—'}</b></div>
        <div><small>Liste sırası</small><b class="num">${gm.active && gm.rank ? lbl.text : '—'}</b>${gm.active && gm.rank && lbl.cls !== 'off' ? move({ rank: gm.rank, prev: gm.prevRank }) : ''}<small>en iyi #${gm.bestRank && gm.bestRank < 999999 ? fmt(gm.bestRank) : '–'}</small></div>
        <div><small>Toplam kopya</small><b class="num">${fmt(gm.units)}</b></div>
        <div><small>Toplam gelir</small><b class="num">${money(gm.revenue)}</b></div>
      </div>
      ${gm.model === 'f2p' ? `<p class="small">🆓 Ücretsiz oyun · ${esc(Modern.monetById(c, gm.monet).name)} · aktif oyuncu <b class="num">${fmt(gm.players || 0)}</b> · bu hafta ${money(gm.revHist?.at(-1) || 0)}</p>` : ''}
      ${gm.service ? `<p class="small">📦 ${esc(gm.service)} kataloğunda</p>` : ''}${gm.dlcs ? `<p class="small">🧩 ${gm.dlcs} indirilebilir içerik${gm.pass ? ' · sezon kartı' : ''}</p>` : ''}
      <p class="muted small">Rafta ${gm.weeks} hafta${gm.active ? '' : ' (bitti)'} · güncelleme ${gm.patches || 0}/${P.patchMax} · ${gm.deal ? `yayıncı: ${esc(gm.deal.pubName)}, ${gm.deal.kind === 'tek' ? 'tek seferlik satış' : `netin %${gm.deal.pay}'i${gm.deal.owed > 0 ? ` · avans kapanıyor: %${Math.round(100 - gm.deal.owed / Math.max(1, gm.deal.paid) * 100)}` : ''}`}` : gm.publisherId ? `yayıncı: ${esc(gm.publisherName || '')}, pay %${Math.round((gm.royalty || 0) * 100)}` : 'kendi yayının'}</p>
      ${gm.critics?.[0]?.quote ? `<section class="box"><h3>Eleştirmenler</h3><ul class="quotes">${gm.critics.map((k) => `<li><b class="num">${String(k.score).replace('.', ',')}</b><span>${esc(k.name)}: “${esc(k.quote)}”</span></li>`).join('')}</ul>${gm.review?.genreNote ? `<p class="muted small">“${esc(gm.review.genreNote)}”</p>` : ''}</section>` : ''}
      <section class="box"><h3>Oyuncu raporu</h3>${gm.playerReport ? `<ul class="plist-r">${gm.playerReport.map((l) => `<li class="${l.tone}">${esc(l.text)}</li>`).join('')}</ul><p class="muted small">Öğrenilen görev önemleri faz pencerelerinde rozet olarak görünür.</p>`
        : `<div class="foot"><span class="muted small">Oyuncular neyi sevdi, neyi sevmedi? Görev bazında ne geliştirmen gerektiğini söyler.${gm.active && gm.weeks < PACK.playerReport.minWeeks ? ` ${PACK.playerReport.minWeeks - gm.weeks} hafta sonra hazırlanabilir.` : ''}</span><button data-act="report" data-id="${gm.id}" ${gm.active && gm.weeks < PACK.playerReport.minWeeks ? 'disabled' : ''}>Rapor çıkar · ${Know.reportCost(c) ? money(Know.reportCost(c)) : 'bedava'}</button></div>`}</section>
      <section class="box"><h3>Haftalık satış (kopya)</h3>${chart('game' + gm.id, gm.hist || [], { labels: wk, kind: 'bar', barCls: 'sky' })}</section>
      <section class="box"><h3>Haftalık gelir</h3>${chart('rev' + gm.id, gm.revHist || [], { labels: wk.slice(-(gm.revHist || []).length), fmtv: money, color: 'var(--mint)' })}</section>
      ${u.gameRegions(gm)}
      <section class="box"><h3>Platformlara göre</h3><div class="split-bars">${Object.entries(gm.sold || {}).sort((a, b) => b[1] - a[1]).map(([pid, u]) => `<div><span>${esc(M.platformById(c, pid)?.name || pid)}</span>${bar(gm.units ? (u / gm.units) * 100 : 0, 'prog')}<b class="num">${fmt(u)}</b></div>`).join('')}</div></section>
      ${listBox(gm)}
      <section class="box"><h3>Yayın sonrası</h3>${actions}${modern}${port}${exp}</section>`;
  }
  // Oyunun liste, raf ve satış hamleleri (Konu A)
  function listBox(gm) {
    const c = ctx(), CH = PACK.charts;
    if (!gm.active) return '';
    const lbl = Charts.rankLabel(c, gm), dig = Charts.isDigital(c), gname = PACK.genres.find((x) => x.id === gm.genre).name.toLowerCase();
    const shelf = gm.model === 'f2p' ? 'ücretsiz oyun' : dig ? (gm.rank && gm.rank <= CH.showcase.rank ? 'mağaza vitrininde' : 'dijital mağazada') : gm.offShelf ? 'raftan indi' : gm.shelfPaid ? 'rafta (raf parası ödeniyor)' : 'rafta';
    const comp = gm.comp ? (gm.comp > 1.08 ? 'rakip az' : gm.comp < 0.92 ? 'rakip çok' : 'normal') : '—';
    const info = `<p class="small">${esc(lbl.sub)}${gm.gRank ? ` · ${esc(gname)} listesinde #${fmt(gm.gRank)}` : ''}</p>
      <p class="muted small">Eğri: <b>${esc(Charts.curveWord(c, gm))}</b> · ${esc(shelf)} · rekabet: ${comp} · bu ay talep ×${String(Charts.seasonMult(c, gm).toFixed(2)).replace('.', ',')}${gm.printed ? ` · stok ${fmt(gm.stock || 0)}${gm.printQ?.length ? ` (+${fmt(gm.printQ.reduce((a, x) => a + x.n, 0))} baskıda)` : ''}` : ''}</p>`;
    const btn = (act, ok, label, small) => `<button data-act="${act}" data-id="${gm.id}" ${ok ? '' : 'disabled'}>${label}<small>${small}</small></button>`;
    const btns = [
      !dig && gm.model !== 'f2p' ? btn('budget', Charts.budgetAllowed(c, gm), 'Ucuz Raf Serisi', gm.budget ? 'yapıldı' : `fiyat yarıya · ${money(Charts.budgetCost(c, gm))}`) : '',
      !dig && gm.model !== 'f2p' ? btn('shelfpay', true, gm.shelfPaid ? 'Raf parasını kes' : 'Raf parası öde', `haftada ${money(Charts.shelfFee(c, gm))}`) : '',
      dig && gm.model !== 'f2p' ? btn('festival', Charts.festivalAllowed(c, gm), 'İndirim festivali', Charts.festivalOpen(c) ? `${CH.festival.weeks} hafta %${Math.round((1 - CH.festival.price) * 100)} indirim` : 'Haziran ve Aralık') : '',
      gm.printed ? btn('reprint', true, 'Yeniden bas', `${CH.print.delay} haftada rafta`) : '',
      gm.printed ? btn('printauto', true, gm.printAuto ? 'Otomatik basım: açık' : 'Otomatik basım: kapalı', 'stok azalınca basar') : '',
      gm.model !== 'f2p' ? btn('cover', Charts.coverAllowed(c, gm), 'Dergi kapağı satın al', gm.cover ? 'yapıldı' : `${money(Charts.coverCost(c))} · %${Math.round(CH.cover.scandal * 100)} skandal riski`) : '',
      gm.model !== 'f2p' ? btn('bulk', Charts.bulkAllowed(c, gm), 'Toplu alım (listeyi şişir)', gm.bulk ? 'yapıldı' : gm.weeks > CH.bulk.maxWeeks ? 'yalnız ilk haftalar' : `${money(Charts.bulkCost(c, gm))} · %${Math.round(CH.bulk.scandal * 100)} skandal riski`) : '',
    ].join('');
    return `<section class="box"><h3>Liste ve raf</h3>${info}<div class="btns">${btns}</div></section>`;
  }
  // Satış listesi ailesi: genel, tür, platform, bölge, oynanan, yıl sonu, tüm zamanlar, yaklaşan çıkışlar
  const LTABS = [['genel', 'Genel'], ['tur', 'Tür'], ['platform', 'Platform'], ['bolge', 'Bölge'], ['oynanan', 'En çok oynanan'], ['yil', 'Yıl sonu'], ['tum', 'Tüm zamanlar'], ['yaklasan', 'Yaklaşan çıkışlar']];
  function listWin() {
    const s = G().state, c = ctx(), m = s.mkt || {};
    const L = app.listTab || { kind: 'genel', key: null };
    const tabs = `<div class="btns ltabs">${LTABS.map(([k, n]) => `<button class="${L.kind === k ? 'on' : 'ghost'} small" data-act="ltab" data-id="${k}">${n}</button>`).join('')}</div>`;
    const keyBtns = (list, cur) => `<div class="btns ltabs">${list.map(([k, n]) => `<button class="${String(cur) === String(k) ? 'on' : 'ghost'} small" data-act="lkey" data-id="${k}">${esc(n)}</button>`).join('')}</div>`;
    let key = L.key, sub = '';
    if (L.kind === 'tur') { key ||= PACK.genres[0].id; sub = keyBtns(PACK.genres.map((x) => [x.id, x.name]), key); }
    if (L.kind === 'platform') { const act = M.activePlatforms(c).filter((p) => M.platformBase(c, p) > 0); key = act.some((p) => p.id === key) ? key : act[0]?.id; sub = keyBtns(act.map((p) => [p.id, p.name]), key); }
    if (L.kind === 'bolge') { key ||= PACK.regions.list[0].id; sub = keyBtns(PACK.regions.list.map((r) => [r.id, r.short]), key); }
    if (L.kind === 'yil') { key = (m.years || []).some((y) => y.y === +key) ? +key : m.years?.[0]?.y; sub = (m.years || []).length ? keyBtns(m.years.slice(0, 12).map((y) => [y.y, y.y]), key) : ''; }
    if (L.kind === 'yaklasan') {
      const up = Charts.upcoming(c), own = s.projects.filter((pj) => pj.announce);
      const rows = [...up.map((h) => ({ w: h.weeks, html: `<li><span class="r">${h.weeks}</span><i>hf</i><span>${esc(h.name)}<small>${esc(h.studio)} · ${esc(PACK.genres.find((x) => x.id === h.genre)?.name || '')} · beklenti ${h.score}${h.slipped ? ' · ertelendi' : ''}</small></span><b class="num">${h.rank < 3 ? '★' : ''}</b></li>` })),
        ...own.map((pj) => ({ w: pj.announce - s.week, html: `<li class="mine"><span class="r">${Math.max(0, pj.announce - s.week)}</span><i>hf</i><span>${esc(pj.name)}<small>${esc(s.companyName)} · ${esc(PACK.genres.find((x) => x.id === pj.genre).name)} · duyuruldu</small></span><b class="num">📣</b></li>` }))].sort((a, b) => a.w - b.w);
      return `${tabs}<p class="muted small">Sektör dergisinin önümüzdeki ${PACK.charts.calendar.aheadMonths} ayda beklediği büyük çıkışlar. Büyük oyunların bir kısmı son anda ertelenir. Aynı türde dev bir oyunla aynı haftalara düşmek satışını düşürür.</p>
        <ol class="toplist">${rows.map((r) => r.html).join('') || '<li class="muted">Yakında büyük bir çıkış görünmüyor.</li>'}</ol>`;
    }
    const v = Charts.listView(c, L.kind, key);
    const unit = v.unit === 'oyuncu' ? 'oyuncu' : L.kind === 'yil' ? 'kopya (yıl boyu)' : L.kind === 'tum' ? 'kopya (toplam)' : 'kopya bu hafta';
    const li = (r) => `<li class="${r.mine ? 'mine' : ''}${r.filler ? ' filler' : ''}"><span class="r">${fmt(r.rank)}</span>${L.kind === 'genel' && !r.filler ? move({ rank: r.rank, prev: r.prev }) : '<i></i>'}<span>${esc(r.name)}<small>${esc(r.studio)}${r.year ? ` · ${r.year}` : ''}${r.weeksOn && L.kind === 'genel' ? ` · ${r.weeksOn}. hafta listede` : ''}${r.offShelf ? ' · raftan indi' : ''}</small></span><b class="num">${fmt(r.units)}</b></li>`;
    const head = L.kind === 'tum' ? 'Tüm zamanların en çok satan oyunları.' : L.kind === 'yil' ? `${v.year ?? '—'} yılının en çok satanları.` : `${fmt(v.total)} oyun arasında · ${unit}. Senin oyunların vurgulu; küçük stüdyoların oyunları soluk.`;
    return `${tabs}${sub}<p class="muted small">${head}</p>
      <ol class="toplist">${v.rows.map(li).join('') || '<li class="muted">Bu listede henüz oyun yok.</li>'}${v.pinned.length ? `<li class="gap"><span class="r">…</span></li>${v.pinned.map(li).join('')}` : ''}</ol>`;
  }
  function winMarket(sub) {
    const s = G().state, c = ctx();
    if (sub === 'liste') return listWin();
    if (sub === 'yayincilar') return u.winPublishers();
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

  return { gameDetail, winMarket };
}
