// Oyun dünyası (yılın oyunları, şirketler, platformlar, tarih) ve günlük.
import { M, Market, World } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { esc, bar } from './util.js';

export function make(u) {
  const { G, ctx } = u;
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
        <div class="split-bars">${sh.map((x) => `<div><span>${x.p.own ? '★ ' : ''}${esc(x.p.name)}<small class="muted"> ${x.p.own ? 'senin' : x.p.owner ? esc(World.companyById(x.p.owner)?.name || '') : x.p.kind === 'pc' ? 'bilgisayar' : ''}</small></span>${bar(x.share * 100, 'prog')}<b class="num">${x.b.toFixed(1)} M</b></div>`).join('')}</div>
        <p class="muted small">Yakında: ${PACK.platforms.filter((p) => p.from > M.tableYear(c) && p.from < M.tableYear(c) + 3).map((p) => `${esc(p.name)} (${p.from})`).join(', ') || '—'}</p>`;
    }
    if (sub === 'bolgeler') return u.regionsWorld();
    if (sub === 'bolgeler_eski') {
      const w = M.regionShares(c);
      const plats = M.activePlatforms(c).filter((p) => M.platformBase(c, p) > 0);
      return `<p class="muted small">${y} yılında oyun pazarının bölgelere dağılımı, türlere ilgi ve her bölgede en güçlü platformlar. Oyunun hangi bölgelerde satılacağını yeni oyun sihirbazında seçersin; Japonya ve Dünya için araştırma ve yerelleştirme gerekir.</p>
        ${PACK.regions.list.map((r) => { const top = plats.map((p) => [p, M.platformBase(c, p) * M.regionBias(c, p, r.id)]).sort((a, b) => b[1] - a[1]).slice(0, 3);
          return `<section class="box"><div class="head"><h3>${esc(r.name)}</h3><span class="pill">%${Math.round(w[r.id] * 100)}</span></div>${bar(w[r.id] * 100, 'prog')}
            <p class="small">${PACK.genres.map((g, i) => `<span class="pill ${r.pref[i] >= 1.15 ? '' : r.pref[i] <= 0.85 ? 'warn' : ''}">${g.name} ×${r.pref[i]}</span>`).join(' ')}</p>
            <p class="muted small">Önde: ${top.map(([p]) => `${p.own ? '★ ' : ''}${esc(p.name)}`).join(', ') || '—'}</p></section>`; }).join('')}`;
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

  return { winWorld, winNews };
}
