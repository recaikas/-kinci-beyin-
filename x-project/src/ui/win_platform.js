// Konu G: İş › Platform ve anlaşmalar (platform payı, özel anlaşmalar, tekel) ve Şirket › Hisseler / Bağlı stüdyolar.
import { M, Platform, Genres } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { esc, fmt, bar } from './util.js';
import { MONTHS } from '../systems/world.js';

const pct = (v) => `%${Math.round(v * 100)}`;
const k2 = (v) => `×${v.toFixed(2).replace('.', ',')}`;

export function make(u) {
  const { G, app, ctx } = u;
  const P = PACK.platform;
  const live = () => G().state.consoles.filter((k) => k.launched && !k.retired);

  // ---------- Platform penceresi
  function winPlatform(sub) {
    const s = G().state, c = ctx();
    if (!live().length) return '<p class="muted">Piyasada konsolun yok. Konsol yapınca başka stüdyoların oyunlarından pay alır, özel anlaşmalar yaparsın.</p>';
    if (sub === 'anlasma') return dealsView();
    if (sub === 'tekel') return heatView();
    const pl = s.plat;
    const rates = [0.15, 0.2, 0.25, 0.3, 0.35, 0.4].map((r) => `<button class="chip ${Math.abs(pl.rate - r) < 0.001 ? 'on' : ''}" data-act="prate" data-id="${r}">${pct(r)}${r === P.rateStd ? ' · standart' : ''}</button>`).join('');
    const cons = live().map((k) => `<div class="row-item"><div><b>${esc(k.name)}</b><small>${fmt(k.sold)} adet · kurulu ${(k.base || 0).toFixed(2)} M oyuncu · segment payı ${pct(Platform.consoleShare(c, k))} · kütüphane ${k.thirdParty || 0} oyun${Platform.isCart(c, k) ? ' · kartuş' : ''}</small></div></div>`).join('');
    const y = Math.floor(s.week / 48), row = s.ledger.byYear[y] || {};
    const tp = pl.tp.slice(0, 15).map((t) => `<tr><td>${esc(t.name)}</td><td>${esc(t.studio)}</td><td class="num">${fmt(t.sold)}</td><td class="num">${money(t.rev)}</td></tr>`).join('');
    return `<section class="box"><h3>Platform oranı</h3>
        <p class="muted small">Konsolunda satılan her başka stüdyo oyunundan bu yüzdeyi alırsın. Düşük oran stüdyoları çeker (daha çok oyun, daha hızlı büyüyen konsol), yüksek oran oyun başına daha çok para getirir ama küçük stüdyolar kaçar; %35'in üstünde boykot riski var.</p>
        <div class="subs">${rates}</div>
        <div class="kv"><span>Stüdyo çekiciliği</span><b class="num">${k2(Platform.attract(c))}${Platform.boycott(c) ? ' · <span class="warn">boykot sürüyor</span>' : ''}</b><span>Aylık lisans geliri</span><b class="num">${k2(Platform.licK(c))}</b>
          <span>Bu yıl platform payı</span><b class="num">${money(row.platform_payi || 0)}</b><span>Bu yıl konsol lisansı</span><b class="num">${money(row.konsol_lisans || 0)}</b>${row.kartus_basim ? `<span>Bu yıl kartuş basımı</span><b class="num">${money(row.kartus_basim)}</b>` : ''}</div></section>
      ${Platform.cartPossible(c) ? `<section class="box ${pl.cart ? 'hl' : ''}"><div class="head"><h3>Kartuş tekeli</h3><button data-act="pcart">${pl.cart ? 'Basımı serbest bırak' : 'Kartuşları yalnız ben basayım'}</button></div>
        <p class="muted small">Kartuşları yalnız sen basarsan başka stüdyoların her satışından adet başı ${money(P.cartFee * M.inflation(c) ** 0.5)} basım ücreti alırsın. Stüdyolar sevmez: çekicilik −${P.cartAttract.toLocaleString('tr-TR')}.</p></section>` : ''}
      <section class="box"><h3>Konsolların</h3>${cons}</section>
      <section class="box"><h3>Başka stüdyoların oyunları <small class="muted">son 15</small></h3>${tp ? `<div class="scroll"><table><thead><tr><th>Oyun</th><th>Stüdyo</th><th>Satış</th><th>Senin payın</th></tr></thead><tbody>${tp}</tbody></table></div>` : '<p class="muted small">Henüz konsoluna başka stüdyo oyunu gelmedi. Pazar payın ve çekiciliğin arttıkça gelirler.</p>'}</section>`;
  }
  function dealsView() {
    const s = G().state, c = ctx(), k = live()[0];
    const when = (at) => (at ? `${MONTHS[Math.min(11, Math.floor((at - Math.floor(at)) * 12))]} ${Math.floor(at)}` : 'bir sonraki oyunu');
    const offers = Platform.offers(c).map((o) => {
      const rv = s.rivals.find((r) => (o.rid ? r.id === o.rid : r.cid === o.cid));
      const btns = Object.entries(P.deal.types).map(([id, t]) => { const pr = Platform.dealPrice(c, o, id, k); return `<button data-act="deal" data-id="${o.id}" data-type="${id}" ${s.cash >= pr ? '' : 'disabled'}>${t.name}<small>${money(pr)}</small></button>`; }).join('');
      return `<section class="box"><div class="head"><h3>${esc(o.name)}</h3><span class="pill">beklenen not ${o.E}</span></div>
        <p class="muted small">${esc(o.studio)} · ${when(o.at)}${rv ? ` · ilişki ${Platform.relOf(c, rv)}${rv.stake ? ` · hissen %${rv.stake}` : ''}` : ''}</p><div class="btns">${btns}</div></section>`;
    }).join('');
    const st = { pazarlama: 'logon reklamlarda', sureli: '6–12 ay yalnız sende', tam: 'hiç başka yerde çıkmaz', ikinci: 'tam özel + kalıcı ortaklık' };
    const active = s.plat.deals.slice(-10).reverse().map((d) => `<div class="row-item"><div><b>${esc(d.name)}</b><small>${esc(d.studio)} · ${P.deal.types[d.type].name} · ${money(d.price)} · ${d.broken ? 'bozuldu' : d.lost ? 'karşı teklife kaybedildi' : d.opened ? 'Rekabet Kurumu açtırdı' : d.done ? `çıktı (not ${d.score ?? '—'})` : 'bekleniyor'}</small></div></div>`).join('');
    return `<p class="muted small">Belli bir şirketle belli bir oyun için anlaşırsın. Fiyat beklenen nota, şirketin gücüne, ilişkine ve konsolunun payına göre (konsolun zayıfsa daha çok isterler). %25 hissen varsa %25 indirim ve karşı teklif yok. Türler: ${Object.entries(P.deal.types).map(([id, t]) => `<b>${t.name}</b> (${st[id]})`).join(', ')}. Konsolun çakarsa (pay %${Math.round(P.deal.flopShare * 100)} altı) şirket anlaşmayı bozar.</p>
      ${offers || '<p class="muted">Bu ay teklif yok; liste her ay yenilenir.</p>'}${active ? `<section class="box"><h3>Anlaşmaların</h3>${active}</section>` : ''}`;
  }
  function heatView() {
    const s = G().state, c = ctx(), A = P.antitrust;
    const h = s.plat.heat;
    return `<section class="box ${h > P.heat.fansAt ? 'hl' : ''}"><div class="head"><h3>Tekel ısısı</h3><span class="pill ${h > P.heat.fansAt ? 'warn' : ''}">${Math.round(h)}</span></div>${bar(h, 's')}
        <p class="muted small">Isı = en büyük segment payın, süren özel anlaşmalar, bağlı stüdyoların ve yüksek platform oranından gelir. ${P.heat.fansAt}'yi geçince hayranlar her ay biraz azalır, basın manşet atar.</p>
        <div class="kv"><span>En büyük segment payın</span><b class="num">${pct(Platform.maxShare(c))}</b><span>Bağlı stüdyo</span><b class="num">${Platform.controlled(c).length}/${P.stake.maxControlled}</b><span>Platform oranı</span><b class="num">${pct(s.plat.rate)}</b></div></section>
      <section class="box"><h3>⚖️ Rekabet Kurumu</h3><p class="small">Payın %${Math.round(A.shareAt * 100)}'ı geçerse ya da ${A.controlledAt}+ bağlı stüdyon varsa soruşturma açabilir (en çok ${A.cooldownYears} yılda bir). Seçenekler: geçen yılın gelirinin %${Math.round(A.finePct * 100)}'ü kadar ceza, özel anlaşmaları açma ya da bir şirketi değerinin %${Math.round(A.sellK * 100)}'ine satma.</p>
        <p class="muted small">${s.plat.lastProbe > 0 ? `Son soruşturma: ${s.plat.lastProbe}.` : 'Henüz soruşturma yok.'}</p></section>
      <section class="box"><h3>🪧 Boykot</h3><p class="small">Oran %${Math.round(P.boycott.rateAt * 100)}'in üstündeyse bağımsız stüdyolar bir yıl konsoluna oyun yapmayabilir (çekicilik −${P.boycott.attract.toLocaleString('tr-TR')}).</p></section>`;
  }

  // ---------- Hisseler penceresi
  function winStakes(sub) {
    const s = G().state, c = ctx();
    if (sub === 'bagli') return subsView();
    const list = [...s.rivals].sort((a, b) => b.rep - a.rep).map((r) => {
      if (r.hw) return `<div class="row-item"><div><b>${esc(r.name)}</b><small>güç ${Math.round(r.rep)}</small></div><span class="pill">platform devi</span></div>`;
      const st = r.stake || 0;
      const btns = P.stake.tiers.filter((t) => t > st).map((t) => { const pr = Platform.stakePrice(c, r, t); const capped = t >= 51 && st < 51 && Platform.controlled(c).length >= P.stake.maxControlled; return `<button class="mini" data-act="stake" data-id="${r.id}" data-to="${t}" ${s.cash >= pr && !capped ? '' : 'disabled'}>%${t}<small>${money(pr)}</small></button>`; }).join('');
      const next = st >= 10 && r.cid ? (s.world?.queue || []).filter((h) => h.cid === r.cid).slice(0, 2).map((h) => `"${esc(h.name)}" ${Math.floor(h.at)}`).join(', ') : '';
      return `<div class="row-item"><div><b>${esc(r.name)}${st ? ` <span class="pill">%${st}</span>` : ''}${r.exitSale ? ' <span class="pill warn">satılık</span>' : ''}</b><small>güç ${Math.round(r.rep)} · ilişki ${Platform.relOf(c, r)} · değer ${money(Platform.value(c, r))}${next ? ` · sıradaki: ${next}` : ''}</small><div class="btns">${btns}${st ? `<button class="mini ghost" data-act="sellstake" data-id="${r.id}">Sat<small>${money(Platform.value(c, r) * st / 100 * P.stake.sellK)}</small></button>` : ''}</div></div></div>`;
    }).join('');
    return `<p class="muted small">%10 temettü ve şirketin planları · %25 yönetim kurulu koltuğu (özel anlaşmada %25 indirim, karşı teklif yok) · %51 kontrol: bağlı stüdyo (oyun siparişi, platform politikası, güçlendirme) · %100 birleştirme. İlişki iyiyse %${Math.round((P.stake.friendly - 1) * 100)} prim, kötüyse %${Math.round((P.stake.hostile - 1) * 100)}; %51'i geçerken +%${Math.round(P.stake.control * 100)} kontrol primi. En çok ${P.stake.maxControlled} bağlı stüdyo.</p><div class="board">${list}</div>`;
  }
  function subsView() {
    const s = G().state, c = ctx(), y = M.tableYear(c);
    const subs = Platform.controlled(c);
    if (!subs.length) return '<p class="muted">Bağlı stüdyon yok. Bir şirketin %51 hissesini al.</p>';
    const topics = PACK.topics.filter((t) => t[4] <= y);
    return subs.map((r) => {
      const o = ((app.order ||= {})[r.id] ||= { genre: Genres.knownGenres(c)[0]?.id || 'aksiyon', topic: topics[0][0], size: 'kucuk', budget: 'normal' });
      const busy = s.plat.orders.find((x) => x.rid === r.id);
      const sel = (key, opts) => `<select data-order="${key}" data-id="${r.id}">${opts.map(([v, n]) => `<option value="${v}" ${o[key] === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
      const sizes = PACK.sizes.filter((z) => !z.mmo && (!z.research || s.research.done[z.research] || r.rep >= 60));
      return `<section class="box"><div class="head"><h3>🏭 ${esc(r.name)} <small class="muted">%${r.stake}</small></h3><span class="pill">güç ${Math.round(r.rep)}</span></div>
        <div class="kv"><span>Özerklik</span><b>${bar(r.autonomy ?? 70, (r.autonomy ?? 70) < P.stake.quitBelow ? 'tek' : 'prog')} ${Math.round(r.autonomy ?? 70)}</b></div>
        <p class="muted small">Her sipariş özerkliği ${P.stake.orderAutonomy} düşürür; ${P.stake.quitBelow}'un altında yıldız yapımcı istifa edebilir.</p>
        <div class="foot"><span class="small">Platform politikası</span><span class="btns"><button class="chip ${r.policy !== 'yalniz' ? 'on' : ''}" data-act="policy" data-id="${r.id}" data-pol="coklu">Çoklu platform</button><button class="chip ${r.policy === 'yalniz' ? 'on' : ''}" data-act="policy" data-id="${r.id}" data-pol="yalniz">Yalnız benim konsolum</button></span></div>
        <div class="foot"><span class="small">Güçlendirme (yıllık)</span><span class="btns">${[0, 1, 2, 3].map((l) => `<button class="chip ${(r.boost || 0) === l ? 'on' : ''}" data-act="boost" data-id="${r.id}" data-lv="${l}">${l ? `+${l} güç · ${money(P.stake.boostCost * l * M.inflation(c) ** 0.5)}` : 'Yok'}</button>`).join('')}</span></div>
        <h3 class="sub">Oyun siparişi</h3>
        ${busy ? `<p class="small">📦 Siparişin yapılıyor: ${esc(PACK.genres.find((g) => g.id === busy.genre).name)} · ${Math.max(0, busy.readyWeek - s.week)} hafta kaldı. Teslimde Geliştir › Projeler'de yayına hazır olur.</p>`
          : `<div class="form"><label>Tür${sel('genre', PACK.genres.map((g) => [g.id, g.name]))}</label><label>Konu${sel('topic', topics.map((t) => [t[0], t[1]]))}</label>
            <label>Boyut${sel('size', sizes.map((z) => [z.id, `${z.name} · ${Math.round(z.weeks * P.stake.orderWeeksK)} hf`]))}</label><label>Bütçe${sel('budget', Object.entries(P.stake.budgets).map(([k, b]) => [k, b.name]))}</label></div>
            <div class="foot"><span class="muted small">Kaliteyi stüdyonun gücü ve bütçe belirler; oyunu sen yayınlarsın.</span><button class="primary" data-act="order" data-id="${r.id}">Sipariş ver<small>${money(Platform.orderCost(c, o.size, o.budget))}</small></button></div>`}
        <div class="foot"><button class="ghost" data-act="sellstake" data-id="${r.id}">Hisseleri sat</button>${r.stake >= 100 ? `<button data-act="merge" data-id="${r.id}">${app.confirm === 'merge' + r.id ? 'Emin misin? Tekrar bas' : 'Şirketime kat'}</button>` : ''}</div></section>`;
    }).join('');
  }
  return { winPlatform, winStakes };
}
