// Türler (Konu D): sihirbazdaki tür, alt tür ve kombinasyon kutusu; Araştırma › Türler penceresi (tür ağacı).
import { M, Genres, Know, Prod } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { esc, bar } from './util.js';

const T = Genres.TIER;
const chip = (tier, unknown = '?') => (tier ? `<em class="kn t${tier}" title="${T[tier].name}">${T[tier].icon}</em>` : `<em class="kn">${unknown}</em>`);
const tierOfV = (v) => (v == null ? null : Genres.ORDER.find((id) => Math.abs(T[id].v - Number(v)) < 0.5) || (v < 5 ? 'X' : 'G'));

export function make(u) {
  const { G, ctx } = u;
  const gname = (id) => PACK.genres.find((g) => g.id === id)?.name || id;

  // ---------- Sihirbaz: ana türler
  function genreTiles(d) {
    const c = ctx(), s = G().state, y = M.tableYear(c), kn = Know.known(c), trend = s.trend || {};
    // Konu H: yalnız bilinen türler; araştırılabilecekler tek satırda, doğmamışlar saklı
    const later = Genres.DISPLAY.filter((id) => !Genres.knows(c, id) && y >= M.genreById(c, id).year).length;
    return Genres.DISPLAY.filter((id) => Genres.knows(c, id)).map((id) => {
      const g = M.genreById(c, id);
      const ms = M.mastery(c, id), x = Math.floor(M.genreXp(c, id));
      return `<button class="tile ${d.genre === id ? 'on' : ''}" data-pick="genre" data-id="${id}" title="${esc(g.soul)}">${g.icon} ${esc(g.name)}${trend.genre === id ? '<em>trend</em>' : ''}${kn.topicGenre(d.topic, id) != null ? chip(tierOfV(kn.topicGenre(d.topic, id))) : ''}<small class="ms">${ms.name} ${x}</small></button>`;
    }).join('') + (later ? `<button class="tile tease" disabled title="Ar-Ge › Araştırma">??? <small class="ms">${later} tür daha araştırılabilir</small></button>` : '');
  }
  // ---------- Sihirbaz: alt türler (önce kendi ana türünün alt türleri, diğerleri katlanır gruplarda)
  function subPicker(d) {
    const c = ctx(), s = G().state, kn = Know.known(c);
    if (!s.research.done.alt_tur) return '<p class="muted small">Alt tür seçmek için "Alt tür (çok türlü oyun)" araştırması gerekli. Alt türsüz oyun −3.</p>';
    const av = Genres.availableSubs(c);
    const one = (sb) => {
      const ph = Genres.phase(c, sb.id), gs = kn.genreSub(d.genre, sb.id);
      const inv = s.invented[sb.id] && M.tableYear(c) < sb.year;
      return `<button class="chip ${d.sub === sb.id ? 'on' : ''}" data-pick="sub" data-id="${sb.id}" title="${esc(sb.joke)} · ${ph.name}${inv ? ' · senin icadın' : ''}">${esc(sb.name)} ${chip(tierOfV(gs))}${ph.icon && ph.id !== 'yukselen' ? ` <small>${ph.icon}</small>` : ''}${inv ? ' 🧪' : ''}</button>`;
    };
    const own = av.filter((sb) => sb.parent === d.genre);
    const groups = Genres.DISPLAY.filter((id) => id !== d.genre).map((id) => [id, av.filter((sb) => sb.parent === id)]).filter(([, a]) => a.length);
    const sel = d.sub && Genres.SUB[d.sub];
    return `<div class="subs"><button class="chip ${!d.sub ? 'on' : ''}" data-pick="sub" data-id="">Alt türsüz (−3)</button>${own.map(one).join('')}</div>
      ${groups.map(([id, a]) => `<details class="subgrp" ${sel && sel.parent === id ? 'open' : ''}><summary>${M.genreById(c, id).icon} ${esc(gname(id))} alt türleri <small class="muted">${a.length}</small></summary><div class="subs">${a.map(one).join('')}</div></details>`).join('')}
      ${sel ? `<p class="muted small">${esc(sel.name)}: “${esc(sel.joke)}” · ${Genres.phase(c, sel.id).icon} ${Genres.phase(c, sel.id).name} (talep ×${Genres.phase(c, sel.id).k.toFixed(2).replace('.', ',')})</p>` : ''}`;
  }
  // ---------- Sihirbaz: kombinasyon kutusu (bilinen kademe, ekip sezgisi, odak grubu, fikirler)
  function comboBox(d) {
    const c = ctx(), s = G().state, app = u.app;
    if (!d.topic || !d.genre || !Genres.knows(c, d.genre)) return '';
    const k = Genres.knownCombo(c, d), it = Genres.intuition(c, d);
    const layers = [['Konu-tür', k.kt], ...(d.sub ? [['Tür-alt tür', k.gs], ['Konu-alt tür', k.ts]] : [])].map(([n, v]) => `${n} ${chip(tierOfV(v))}`).join(' · ');
    const key = `${d.topic}|${d.genre}|${d.sub || ''}`;
    const paid = s.focusPaid[key];
    const cost = Genres.focusCost(c, { ...d, platforms: d.platforms?.length ? d.platforms : ['pc'] });
    const ov = k.overall ? `<b class="tier t${k.overall}">${T[k.overall].icon} ${T[k.overall].name}</b>` : '<b class="tier">?</b>';
    const aud = d.sub && Genres.SUB[d.sub]?.aud?.[d.audience];
    const ideas = (s.ideas || []).map((x) => `<li>💡 ${esc(x.text)} <button class="mini" data-act="idea" data-id="${x.id}">Uygula</button></li>`).join('');
    return `<section class="box combo"><div class="head"><h3>Kombinasyon</h3>${ov}</div>
      <p class="small">${layers}</p>
      <p class="small team">👥 Ekip: “${esc(it.text)}”${it.exact ? '' : ' <small class="muted">(sezgi; usta stüdyoda kesinleşir)</small>'}</p>
      ${aud ? `<p class="small warn">⚠️ ${esc(Genres.SUB[d.sub].name)} bu kitleye ${T[aud].name.toLowerCase()}.</p>` : ''}
      ${app.focusLine && paid ? `<p class="small">🎤 Odak grubu: ${esc(app.focusLine)}</p>` : ''}
      <div class="foot"><span class="muted small">${paid ? 'Bu kombinasyonu odak grubuna sordun.' : 'Odak grubu kademeyi hemen söyler.'}</span>${paid ? '' : `<button data-act="focus">Odak grubu<small>${money(cost)}</small></button>`}</div>
      ${ideas ? `<ul class="ideas small">${ideas}</ul>` : ''}</section>`;
  }

  // ---------- Araştırma › Türler: tür ağacı
  function genreTree() {
    const c = ctx(), s = G().state, y = M.tableYear(c), kn = Know.known(c), app = u.app;
    const cur = app.gtree && M.genreById(c, app.gtree) ? app.gtree : Genres.knownGenres(c)[0]?.id || 'aksiyon';
    const b = Genres.bg(c);
    const branches = Genres.DISPLAY.map((id) => {
      const g = M.genreById(c, id), known = Genres.knows(c, id), x = Math.floor(M.genreXp(c, id)), ms = M.mastery(c, id);
      return `<button class="gbranch ${cur === id ? 'on' : ''} ${known ? '' : 'locked'}" data-act="gtree" data-id="${id}"><span>${g.icon} ${esc(g.name)}</span>${known ? `${bar(x, 'prog')}<small>${ms.name} · ${x}</small>` : `<small>${y >= g.year ? '🔒 araştırılmadı' : `🥚 ${g.year}`}</small>`}</button>`;
    }).join('');
    const g = M.genreById(c, cur);
    const subs = Genres.SUBGENRES.filter((sb) => sb.parent === cur).map((sb) => {
      const ph = Genres.phase(c, sb.id), inv = s.invented[sb.id], info = !inv && y < sb.year ? Genres.inventInfo(c, sb.id) : null;
      const used = s.subUsed[sb.id] || 0;
      const btn = info && (info.ok || /AP|\$/.test(info.why)) ? `<button class="mini" data-act="invent" data-id="${sb.id}" ${info.ok ? '' : 'disabled'} title="${esc(info.why || '')}">İcat et<small>${info.rp} AP · ${money(info.cost)}</small></button>` : info ? `<small class="muted">${esc(info.why)}</small>` : '';
      return `<div class="srow ${y < sb.year && !inv ? 'unborn' : ''}"><span>${ph.icon} <b>${esc(sb.name)}</b> <small class="muted">${sb.year} · altın çağ ${sb.peak[0]}–${sb.peak[1]}${sb.bubble ? ' · balon' : ''}</small></span><small>${esc(sb.joke)}</small><small>${ph.name}${inv ? ` · 🧪 ${inv}'de icat ettin` : ''}${used ? ` · ${used} oyun` : ''}</small>${btn}</div>`;
    }).join('');
    // Bilinen konu × tür kademeleri (bu tür için)
    const topics = PACK.topics.filter((t) => t[4] <= y);
    const grid = topics.map((t) => { const v = kn.topicGenre(t[0], cur); const tr = tierOfV(v); return `<span class="tg ${tr ? `t${tr}` : ''}" title="${esc(t[1])} + ${esc(g.name)}: ${tr ? T[tr].name : 'bilinmiyor'}">${esc(t[1])} ${tr ? T[tr].icon : '?'}</span>`; }).join('');
    const legends = Genres.LEGENDS.filter((L) => s.legends[L.id]).map((L) => `<li>🌟 <b>${esc(L.name)}</b> ${s.legends[L.id].by === 'me' ? '(senin keşfin)' : '(rakipler buldu)'}: “${esc(L.press)}”</li>`).join('');
    const pion = s.awards.filter((a) => a.type === 'oncu').map((a) => `<li>🧪 ${esc(a.title)} · “${esc(a.name)}” (${a.year})</li>`).join('');
    const job = s.inventJob ? `<p class="small">🧪 İcat sürüyor: ${esc(Genres.SUB[s.inventJob.sub].name)} · ${s.inventJob.weeksLeft} hafta</p>` : '';
    return `<p class="muted small">${b.icon} Geçmişin: ${esc(b.name)}. Türler araştırmayla açılır; her yayın o türdeki bilgini artırır. Usta (60+) olduğun türde, alt türleri doğuşlarından en çok 6 yıl önce icat edebilirsin.</p>
      <div class="gtree">${branches}</div>${job}
      <section class="box"><div class="head"><h3>${g.icon} ${esc(g.name)}</h3><span class="pill">${esc(g.soul)}</span></div>
        <div class="slist">${subs}</div></section>
      <section class="box"><h3>Bilinen konu uyumları · ${esc(g.name)}</h3><div class="tgrid">${grid}</div><p class="muted small">★★ Süper · ★ İyi · ● Geçerli · ▽ Başarısız · ✖ Kötü · ☠ İğrenç · ? denenmedi</p></section>
      ${legends || pion ? `<section class="box"><h3>Efsaneler ve öncülük</h3><ul class="small">${legends}${pion}</ul></section>` : ''}`;
  }
  return { genreTiles, subPicker, comboBox, genreTree, chip, tierOfV };
}
