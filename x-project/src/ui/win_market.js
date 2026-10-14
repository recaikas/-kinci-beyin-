// Pazar: oyun ayrıntısı, satış listesi, son çıkanlar, rakipler.
import { M, Market, Post, Know } from '../game.js';
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

  return { gameDetail, winMarket };
}
