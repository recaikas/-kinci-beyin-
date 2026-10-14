// Bölgeler (Konu C): dünya haritası, bölge kartları, bayram takvimi, projede dağıtım planı, yayında kademeli çıkış.
import { M, Regions } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { esc, fmt, bar } from './util.js';

// Harita: kıtaları andıran piksel adalar (x, y, en, boy) — 0..100 ölçeğinde
const LABELS = { na: [6, 7.5], latam: [24, 46], eu: [41, 7.5], tr: [53, 34], asya: [64, 10], jp: [88, 29.2, 'middle'] };
const SHAPES = {
  na: [[6, 10, 24, 18], [10, 28, 14, 10]], latam: [[20, 44, 12, 14], [22, 58, 8, 12]], eu: [[44, 10, 14, 12]],
  tr: [[56, 24, 6, 5]], asya: [[62, 12, 26, 16], [70, 30, 14, 12], [80, 48, 10, 8]], jp: [[90, 16, 4, 9]],
};
const LEVEL_CLS = ['l0', 'l1', 'l2', 'l3', 'home'];
const pct = (v) => `%${Math.round(v * 100)}`;
const f2 = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

export function make(u) {
  const { G, ctx } = u;
  const genreName = (id) => PACK.genres.find((g) => g.id === id)?.name || id;
  const topicName = (id) => PACK.topics.find((t) => t[0] === id)?.[1] || id;

  function map() {
    const c = ctx(), w = M.regionShares(c);
    const blobs = Regions.REGIONS.map((r) => {
      const lv = Regions.netLevel(c, r.id), sh = SHAPES[r.id] || [];
      const [x, y, anchor = 'start'] = LABELS[r.id] || sh[0] || [0, 0];
      return `<g class="rg ${LEVEL_CLS[lv]}" data-region-card="${r.id}">${sh.map(([a, b, ww, hh]) => `<rect x="${a}" y="${b}" width="${ww}" height="${hh}" rx="1.5"/>`).join('')}
        <text x="${x}" y="${y}" text-anchor="${anchor}">${r.flag} ${esc(r.short)} ${pct(w[r.id])}</text></g>`;
    }).join('');
    return `<section class="box mapbox"><svg class="wmap" viewBox="0 0 100 72" role="img" aria-label="Dünya haritası: bölgelerdeki varlığın">${blobs}</svg>
      <p class="maplegend small"><span class="lg home"></span>Ana bölge <span class="lg l3"></span>Ofis <span class="lg l2"></span>Distribütör <span class="lg l1"></span>Posta <span class="lg l0"></span>Yok</p></section>`;
  }
  function calendar() {
    const c = ctx(), up = Regions.upcomingHolidays(c, 8), act = Regions.activeHolidays(c);
    const rflag = (id) => (id === 'all' ? '🌍' : Regions.R(id).flag);
    return `<section class="box"><h3>Takvim: bayramlar ve özel günler</h3>
      ${act.length ? `<p class="small">Bu hafta: ${act.map((h) => `${h.icon} ${rflag(h.region)} ${esc(h.name)}`).join(' · ')}</p>` : ''}
      <div class="cal">${up.map(({ h, in: n }) => `<div class="calrow"><span>${h.icon}</span><span>${rflag(h.region)} ${esc(h.name)}</span><small class="muted">${n === 0 ? 'bu hafta' : `${n} hafta sonra`}${h.demand && h.demand !== 1 ? ` · satış ×${f2(h.demand)}` : ''}${h.topics ? ` · ${Object.keys(h.topics).map(topicName).join(', ')} sever` : ''}</small></div>`).join('') || '<p class="muted small">Bu yıl kalan özel gün yok.</p>'}</div></section>`;
  }
  function regionCard(r) {
    const g = G(), c = ctx(), s = g.state, w = M.regionShares(c);
    const lv = Regions.netLevel(c, r.id), home = lv === 4;
    const next = home ? null : lv < 3 ? Regions.netCheck(c, r.id, lv + 1) : null;
    const nl = Regions.NET_LEVELS;
    const likes = PACK.genres.map((x) => [x.name, M.regionPref(c, r, x.id)]).filter(([, v]) => v >= 1.1).map(([n]) => n).join(', ') || '—';
    const tops = Object.entries(r.topics).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => topicName(k)).join(', ');
    const peak = r.season.map((v, i) => [i, v]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([i]) => Regions.MONTHS[i]).join(', ');
    const board = Regions.boardActive(c, r.id);
    const lang = Regions.isNative(c, r.id) ? 'senin dilin' : `çevirisiz erişim ${pct(Regions.langReach(c, r.id, {}))}`;
    const bans = (s.bans || []).filter((b) => b.rid === r.id && M.tableYear(c) < b.until).map(() => '🚫 konsol yasağı').join('');
    const fx = (s.fxMods || []).filter((f) => f.rid === r.id && f.until > s.week).map((f) => `kur ×${f2(f.v)}`).join(', ');
    return `<section class="box region" id="rc-${r.id}"><div class="head"><h3>${r.flag} ${esc(r.name)}</h3><span class="pill">${home ? 'ana bölge' : nl[Math.min(3, lv)].name}</span><span class="pill">pazarın ${pct(w[r.id])}</span></div>
      <p class="small soul">${esc(r.soul)}</p>
      <div class="kv small"><span>Sesi</span><b>${esc(r.host)} · ${esc(r.press)}</b>
        <span>Hayranların</span><b class="num">${fmt(Regions.regionFans(c, r.id))} · yayın gücü ${Math.round(Regions.regionPower(c, r.id))}</b>
        <span>Sever</span><b>${esc(likes)} · ${esc(tops)}</b>
        <span>Dil</span><b>${esc(r.langName)} · ${lang}</b>
        <span>Fiyat · korsan</span><b>endeks ${f2(r.price)} · korsanlık ${pct(Math.min(0.95, piracyNow(r) + (s.pirAdd?.[r.id] || 0)))}</b>
        <span>Yoğun aylar</span><b>${peak}</b>
        ${board ? `<span>Yaş kurulu</span><b>${esc(board.name)}</b>` : ''}
        ${bans || fx ? `<span>Durum</span><b>${[bans, fx].filter(Boolean).join(' · ')}</b>` : ''}</div>
      ${home ? '<p class="muted small">Yerli bonusu: burada satışın +%15. Yerel basın seni tanıyor.</p>' : lv < 3 ? `<div class="foot"><span class="muted small">${esc(nl[lv + 1].desc)}${next && !next.ok ? ` · 🔒 ${esc(next.why)}` : ''}</span><button data-act="buynet" data-id="${r.id}" ${next?.ok ? '' : 'disabled'}>${nl[lv + 1].name}<small>${money(Regions.netCost(c, r.id, lv + 1))}</small></button></div>` : '<p class="muted small">Bölge ofisi açık: yerel adaylar ve yerli bonusu burada da geçerli.</p>'}</section>`;
  }
  function piracyNow(r) { const y = M.tableYear(ctx()), t = r.piracy; let v = t[0][1]; for (let i = 0; i < t.length - 1; i++) if (y >= t[i][0]) v = y >= t[i + 1][0] ? t[i + 1][1] : t[i][1] + (t[i + 1][1] - t[i][1]) * (y - t[i][0]) / (t[i + 1][0] - t[i][0]); return v; }
  function regionsWorld() {
    const c = ctx(), y = Math.floor(M.tableYear(c));
    return `<p class="muted small">${y}: dünyada varlığın. Garaj yalnız ana bölgesinde satar; diğer bölgelere yayıncıyla, posta siparişiyle, distribütörle ya da bölge ofisiyle girersin. Oyunun dilini bilmeyen bölgede çeviri gerekir.</p>
      ${map()}${calendar()}${Regions.REGIONS.map(regionCard).join('')}`;
  }

  // ---------- Projede dağıtım planı
  function distPlan(pj) {
    const g = G(), c = ctx(), w = M.regionShares(c);
    const pub = pj.deal ? { power: pj.deal.power, region: pj.deal.region || (g.publishers().find((p) => p.id === pj.deal.pubId) || {}).region } : null;
    const reach = Regions.computeReach(c, { ...pj, selfPub: !pj.deal, loc: pj.loc || {} }, pj.deal ? { pub, deal: pj.deal } : {}).reach;
    const tot = Regions.IDS.reduce((a, r) => a + w[r] * M.regionPref(c, Regions.R(r), pj.genre) * reach[r], 0) || 1;
    const rows = Regions.REGIONS.map((r) => {
      const lvNet = Regions.netLevel(c, r.id), loc = pj.loc?.[r.id] || 0, nat = Regions.isNative(c, r.id);
      const via = pj.deal && (!pj.deal.regions || pj.deal.regions.includes(r.id)) ? `📜 ${esc(pj.deal.pubName)}` : lvNet === 4 ? '🏠 yerli' : Regions.NET_LEVELS[Math.min(3, lvNet)].name;
      const share = w[r.id] * M.regionPref(c, r, pj.genre) * reach[r.id] / tot;
      const btns = nat ? '<span class="pill">dil tamam</span>' : [1, 2, 3].filter((lv) => lv > loc).map((lv) => { const ck = Regions.locCheck(c, r.id, pj, lv); return `<button class="mini" data-act="loclv" data-pid="${pj.id}" data-id="${r.id}" data-lv="${lv}" ${ck.ok ? '' : 'disabled'} title="${esc(ck.ok ? Regions.LOC_LEVELS[lv].desc : ck.why)}">${Regions.LOC_LEVELS[lv].name}<small>${ck.ok ? money(ck.cost) : '🔒'}</small></button>`; }).join('');
      return `<div class="drow"><span>${r.flag} ${esc(r.short)}</span><small>${via}</small><small>${nat ? 'kendi dilin' : loc ? Regions.LOC_LEVELS[loc].name : 'çevirisiz'}</small>${bar(share * 100, 'prog')}<b class="num">${pct(share)}</b><span class="btns">${btns}</span></div>`;
    }).join('');
    return `<section class="box"><h3>🌍 Dağıtım planı</h3><p class="muted small">Satışın bölgelere beklenen dağılımı. Erişimi dağıtım ağın (Dünya › Bölgeler) ya da yayıncının bölgesi belirler; dil bilmeyen bölgede çeviri gerekir. Yayından sonra da yerelleştirebilirsin (kademeli çıkış, ikinci dalga).</p><div class="dplan">${rows}</div></section>`;
  }
  // ---------- Yayındaki oyun: bölgelere göre satış + kademeli çıkış
  function gameRegions(gm) {
    const c = ctx();
    const rows = Regions.REGIONS.map((r) => {
      const u = gm.regionSold?.[r.id] || 0, loc = gm.loc?.[r.id] || 0, nat = Regions.isNative(c, r.id);
      const can = gm.active && !nat && loc < 1 && gm.reach ? Regions.locCheck(c, r.id, gm, 1) : null;
      return `<div><span>${r.flag} ${esc(r.short)}</span>${bar(gm.units ? (u / gm.units) * 100 : 0, 'prog')}<b class="num">${fmt(u)}</b>${can ? `<button class="mini" data-act="gloc" data-id="${gm.id}" data-region-id="${r.id}" ${can.ok ? '' : 'disabled'}>Çevir ve çıkar<small>${can.ok ? money(can.cost) : '🔒'}</small></button>` : ''}</div>`;
    }).join('');
    return `<section class="box"><h3>Bölgelere göre</h3>${gm.regionNote ? `<p class="muted small">Satışın en çok: ${esc(gm.regionNote)}</p>` : ''}<div class="split-bars regbars">${rows}</div></section>`;
  }
  return { regionsWorld, distPlan, gameRegions };
}
