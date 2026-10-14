// Yayıncılar (Konu B): proje ekranındaki sunuş ve teklif kutusu, Pazar › Yayıncılar sekmesi (kartlar, siparişler, ajan, haklar).
import { M, Pub } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { esc, fmt, bar } from './util.js';

export function make(u) {
  const { G, app, ctx } = u;
  const B = PACK.publishing;
  const genreName = (id) => PACK.genres.find((g) => g.id === id)?.name || id;
  const regionName = (id) => PACK.regions.list.find((r) => r.id === id)?.short || id;
  const KIND = { salon: 'salon', konsol: 'konsol', pc: 'bilgisayar', el: 'el konsolu', mobil: 'mobil', vr: 'VR', bulut: 'bulut' };
  const retail = (pay) => Math.round(pay * B.net);
  const sel = (pid) => ((app.pubSel ||= {})[pid] ||= []);
  const relBar = (r) => bar((r - B.rel.min) / (B.rel.max - B.rel.min) * 100, r >= B.rel.tiers[0] ? 'rel-ok' : r <= B.rel.black ? 'rel-bad' : 'rel');

  // ---------- Yayıncı kartı
  function pubCard(p, pj = null, mode = null) {
    const c = ctx(), s = G().state, st = Pub.pubState(s);
    const r = Pub.rel(c, p.id), tier = Pub.tierOf(c, r);
    const door = Pub.door(c, p);
    const can = pj && mode ? Pub.canPitch(c, pj, p, mode) : null;
    const on = pj && sel(pj.id).includes(p.id);
    const locked = can ? !can.ok : !door.open;
    const pv = Pub.preview(c, p, pj);
    const taste = [p.likes?.length ? `♥ ${p.likes.map(genreName).join(', ')}` : '♥ her şey', p.dislike ? `✗ ${genreName(p.dislike)}` : ''].filter(Boolean).join(' · ');
    const mem = st.mem[p.id]?.[0];
    const used = Pub.slotsUsed(c, p), slots = Pub.slotsOf(c, p);
    const tag = pj && mode ? 'button' : 'div';
    const attrs = pj && mode ? `data-act="pubpick" data-pid="${pj.id}" data-id="${p.id}" ${locked ? 'disabled' : ''}` : '';
    return `<${tag} class="pubcard ${on ? 'sel' : ''} ${locked ? 'locked' : ''}" ${attrs}>
      <span class="ph"><b>${esc(p.name)}</b><span class="pill">${p.tierName}</span><span class="pill" title="${esc(p.tr.desc || '')}">${esc(p.tr.name || p.trait)}</span></span>
      <span class="pr"><small>Güç</small>${bar(p.power, 'pow')}<b class="num">${p.power}</b></span>
      <span class="pr"><small>İlişki</small>${relBar(r)}<b class="num">${r} · ${tier.name}</b></span>
      <small>${esc(taste)} · ${p.region.map(regionName).join(', ')} · ${p.focus.map((k) => KIND[k] || k).join(', ')}</small>
      ${pj ? `<small>Tahmini teklif: netin %${pv.pay}'i (fiyatın ~%${retail(pv.pay)}'i)${pv.adv ? ` · avans ~${money(pv.adv)}` : ''}</small>
      <small>Gözlerinde oyunun ~${pv.lo}–${pv.hi} puan · çıtaları ~${pv.E}</small>` : `<small>Pay tabanı: netin %${pv.pay}'i (fiyatın ~%${retail(pv.pay)}'i) · çıta ~${Math.round(Pub.threshold(c, p))} · bu yıl ${used}/${slots} oyun</small>`}
      ${locked ? `<small class="why">🔒 ${esc(can ? can.why : door.why)}</small>` : ''}
      ${mem ? `<small class="mem">🗒️ ${mem.y}: ${esc(mem.t)}</small>` : ''}
    </${tag}>`;
  }
  function filtered(list, pj) {
    const c = ctx(), f = app.pubFilter || 'acik';
    if (f === 'acik') return list.filter((p) => Pub.door(c, p).open);
    if (f === 'tur') return list.filter((p) => !pj || p.likes?.includes(pj.genre) || !p.likes?.length);
    return list;
  }
  const filters = () => `<div class="btns ltabs">${[['acik', 'Kapısı açık'], ['tur', 'Türüme uygun'], ['tum', 'Tümü']].map(([k, n]) => `<button data-act="pubfilter" data-id="${k}" class="${(app.pubFilter || 'acik') === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;

  // ---------- Teklif kartı: koşullar, kurul oyları, pazarlık, imza
  function offerCard(o) {
    const c = ctx();
    const votes = Object.keys(o.votes || {}).length ? `<small>${[['urun', 'Ürün'], ['pazar', 'Pazar'], ['finans', 'Finans'], ['hukuk', 'Hukuk']].map(([k, n]) => `${n} ${o.votes[k] ? '✓' : '✗'}`).join(' · ')}</small>` : '';
    if (o.kind === 'degisiklik') {
      const ch = Pub.changeInfo(o.change);
      return `<div class="offer"><div class="oh"><b>${esc(o.pubName)}</b><span class="pill warn">Şartlı ilgi</span></div>${votes}
        <p class="small">"${esc(ch.name)}" — ${esc(ch.desc)} Kabul edersen teklif gelir.</p>
        <div class="btns"><button class="primary" data-act="ochange" data-id="${o.id}" data-yes="1">Kabul et</button><button data-act="ochange" data-id="${o.id}" data-yes="0">Reddet</button></div></div>`;
    }
    const left = o.expires - G().state.week;
    const lines = o.kind === 'tek'
      ? `<span>Tek seferlik</span><b class="num">${money(o.buyout)} peşin</b><span>Telif</span><b>yok; oyunun geliri yayıncının</b>`
      : `<span>Pay</span><b class="num">netin %${o.pay}'i (fiyatın ~%${retail(o.pay)}'i)${o.dist ? ' · dağıtım anlaşması' : ''}</b>
         ${o.adv ? `<span>Avans</span><b class="num">${money(o.adv)} (telifle geri ödenir)</b>` : ''}
         ${o.fund ? `<span>Finansman</span><b class="num">${money(o.fund)} (%30/%30/%40, telifle kapanır)</b>` : ''}
         <span>Seri hakları</span><b>${o.rights === 'yayinci' ? 'yayıncıda' : 'sende'}</b>
         ${o.promo ? `<span>Pazarlama sözü</span><b>hype +${o.promo}</b>` : ''}
         <span>Beklenen satış</span><b class="num">~${fmt(o.expUnits)} kopya</b>`;
    const moves = Pub.negMoves(c, o).map((m) => `<button data-act="oneg" data-id="${o.id}" data-move="${m.id}">${esc(m.name)}<small>%${m.p} olasılık</small></button>`).join('');
    return `<div class="offer"><div class="oh"><b>${esc(o.pubName)}</b><span class="pill">${o.kind === 'tek' ? 'Tek seferlik satış' : o.mode === 'erken' ? 'Erken anlaşma' : 'Telif'}</span>${o.auction ? '<span class="pill">açık artırma</span>' : ''}</div>
      ${votes}<div class="kv small">${lines}</div>
      ${moves ? `<div class="btns">${moves}</div><p class="muted small">Pazarlık en çok ${B.neg.rounds} tur. Başarısız hamle ilişkiyi −2 düşürür; teklif %${Math.round(B.neg.withdraw * 100)} ihtimalle masadan kalkar (kaprisli yayıncıda daha sık).</p>` : ''}
      <div class="foot"><span class="muted small">${left > 0 ? `${left} hafta geçerli` : 'bu hafta sona eriyor'}</span><span class="btns"><button data-act="odecline" data-id="${o.id}">Vazgeç</button><button class="primary" data-act="osign" data-id="${o.id}">İmzala</button></span></div></div>`;
  }

  // ---------- Proje ekranındaki yayıncı kutusu
  function projectPubBox(pj) {
    const g = G(), s = g.state, c = ctx(), st = Pub.pubState(s);
    if (pj.kind === 'ek' && !pj.deal) return '';
    if (pj.deal) {
      const d = pj.deal;
      const kind = d.kind === 'tek' ? 'Tek seferlik satış' : d.dist ? 'Dağıtım anlaşması' : d.mode === 'erken' ? 'Erken anlaşma' : d.mode === 'siparis' ? 'Yayıncı siparişi' : 'Telif';
      const due = d.due - s.week;
      return `<section class="box"><h3>📜 Sözleşme: ${esc(d.pubName)}</h3><div class="kv small">
        <span>Tür</span><b>${kind}</b>
        ${d.kind === 'tek' ? `<span>Peşin</span><b class="num">${money(d.buyout)} (ödendi)</b>` : `<span>Pay</span><b class="num">netin %${d.pay}'i (fiyatın ~%${retail(d.pay)}'i)</b>`}
        ${d.owed > 0 ? `<span>Telifle kapanacak</span><b class="num">${money(d.owed)}</b>` : ''}
        ${d.fund ? `<span>Finansman</span><b class="num">${money(d.paid)} / ${money(d.fund)} ödendi</b>` : ''}
        <span>Seri hakları</span><b>${d.rights === 'yayinci' ? 'yayıncıda' : 'sende'}</b>
        <span>Tarih</span><b>${due >= 0 ? `${due} hafta içinde çıkmalı` : `${-due} hafta gecikti; her hafta ilişki düşüyor`}</b>
        ${pj.hold && pj.hold > s.week ? `<span>Bekleme</span><b>yayıncı ${pj.hold - s.week} hafta sonra çıkarmak istiyor</b>` : ''}</div></section>`;
    }
    const mode = pj.status === 'debug' ? 'bitmis' : pj.phase >= 1 ? 'erken' : null;
    const pending = st.pitches.filter((x) => x.pid === pj.id);
    const offers = st.offers.filter((o) => o.pid === pj.id);
    const full = offers.filter((o) => o.kind === 'tam' && !o.dist);
    const letters = (pj.letters || []).slice(0, 3).map((l) => `<small class="${l.ok ? '' : 'why'}">${l.ok ? '📬' : '📪'} ${esc(l.pub)}: ${esc(l.text)}</small>`).join('');
    let pick = '';
    if (mode) {
      const all = Pub.list(c);
      const canAny = all.some((p) => Pub.canPitch(c, pj, p, mode).ok);
      const chosen = sel(pj.id).filter((id) => Pub.byId(c, id) && Pub.canPitch(c, pj, Pub.byId(c, id), mode).ok);
      app.pubSel[pj.id] = chosen;
      const doc = app.pubDoc ?? true, note = app.pubNote ?? false;
      const agent = st.agent;
      const cost = Pub.prepCost(c, doc, note);
      if (mode === 'erken' && !canAny) pick = '<p class="muted small">Erken anlaşma (yayıncı finansmanı) için bir yayıncıyla en az "Ortak" olmalısın. Şimdilik oyunu bitirip sunabilirsin.</p>';
      else pick = `<details class="pubpick" ${app.pubOpen === pj.id || pending.length + offers.length === 0 ? 'open' : ''}><summary><b>${mode === 'erken' ? 'Erken anlaşma için sun' : 'Yayıncıya sun'}</b> <small class="muted">en çok ${B.maxPitches} yayıncı · cevap 1–4 hafta</small></summary>
        ${filters()}<div class="pubgrid">${filtered(all, pj).map((p) => pubCard(p, pj, mode)).join('') || '<p class="muted small">Bu filtrede yayıncı yok.</p>'}</div>
        <div class="btns"><button data-act="pubdoc" class="${doc || agent ? 'on' : ''}" ${agent ? 'disabled' : ''}>Tasarım belgesi<small>tahmin hatası −2, Ürün +5</small></button>
          <button data-act="pubnote" class="${note || agent ? 'on' : ''}" ${agent ? 'disabled' : ''}>Pazar notu<small>Pazar +5</small></button></div>
        <div class="foot"><span class="muted small">${agent ? 'Ajanın dosyayı hazırlıyor.' : cost ? `Dosya hazırlığı ${money(cost)} · cevap 1 hafta gecikir.` : 'Dosyasız sunuş: hızlı ama kurul daha az ikna olur.'}</span>
          <button class="primary" data-act="pitch" data-pid="${pj.id}" data-mode="${mode}" ${chosen.length ? '' : 'disabled'}>Sun (${chosen.length})</button></div></details>`;
    }
    const pend = pending.map((x) => `<small>⏳ ${esc(Pub.pubName(c, x.pubId))} dosyana bakıyor · ${x.qs.length && !x.asked ? 'önce toplantı var · ' : ''}cevap ~${Math.max(0, x.due - s.week)} hafta</small>`).join('');
    const head = `<p class="muted small">Yayıncıya çıkmak için önce sunup teklif almalısın. ${s.research.done.oz_yayin ? 'Kendi yayınını yapabilir ya da' : 'Kendi yayının "Kendi yayınını yap" araştırmasıyla açılır; o zamana kadar'} hiçbir yayıncı istemezse oyunu Kelepir Dağıtım'a peşin satabilirsin.</p>`;
    return `<section class="box"><h3>🏢 Yayıncılar</h3>${head}${pend}${letters}
      ${offers.map(offerCard).join('')}
      ${full.length >= 2 && !full.some((o) => o.auction) ? `<div class="foot"><span class="muted small">İki tam teklif var: yayıncılar payı sırayla 2 puan artırır, her biri kendi tavanında durur.</span><button data-act="oauction" data-pid="${pj.id}">Açık artırma</button></div>` : ''}
      ${pick}</section>`;
  }
  // Yayın formundaki seçim: sözleşme varsa o, yoksa kendi yayının ya da kelepir satış
  function releaseChoice(pj) {
    const s = G().state, c = ctx();
    if (pj.deal) return `<label class="wide">Yayıncı<select id="r-pub"><option value="${esc(pj.deal.pubId)}">${esc(pj.deal.pubName)} · ${pj.deal.kind === 'tek' ? 'tek seferlik satış' : `netin %${pj.deal.pay}'i`}</option></select></label>`;
    const self = Math.min(100, M.selfPublishPower(c) + (s.rooms.some((r) => r.type === 'pazarlama') ? PACK.rooms.selfPublishBonus : 0));
    return `<label class="wide">Yayın yolu<select id="r-pub">
      ${s.research.done.oz_yayin ? `<option value="">Kendi yayınım · güç ${Math.round(self)}</option>` : ''}
      <option value="kelepir">Kelepir Dağıtım · peşin, küçük bir para</option></select></label>`;
  }

  // ---------- Pazar › Yayıncılar
  function winPublishers() {
    const g = G(), s = g.state, c = ctx(), st = Pub.pubState(s);
    const it = Pub.itibar(c);
    const orders = st.orders.map((o) => `<div class="row-item"><div><b>${esc(o.pubName)} siparişi</b>
      <small>${esc(o.topicName)} × ${genreName(o.genre)} · ${esc(o.platformName)} · ${PACK.sizes.find((z) => z.id === o.size)?.name} · en az ${o.minScore} not · ${Math.max(0, o.due - s.week)} hafta kaldı · ceza ${money(o.penalty)}</small></div>
      <button data-act="orderdraft" data-id="${o.id}">Bu siparişle proje başlat</button></div>`).join('');
    const orderOffers = st.offers.filter((o) => o.kind === 'siparis').map((o) => `<div class="offer"><div class="oh"><b>${esc(o.pubName)}</b><span class="pill">Sipariş</span></div>
      <p class="small">${o.dueWeeks} hafta içinde ${esc(o.platformName)} için ${esc(o.topicName)} × ${genreName(o.genre)} oyunu (${PACK.sizes.find((z) => z.id === o.size)?.name}), en az ${o.minScore} not. Avans ${money(o.adv)}, pay netin %${o.pay}'i. Tutmazsa ${money(o.penalty)} ceza ve ilişki −15.</p>
      <div class="foot"><span class="muted small">${o.expires - s.week} hafta geçerli</span><span class="btns"><button data-act="odecline" data-id="${o.id}">Vazgeç</button><button class="primary" data-act="osign" data-id="${o.id}">Kabul et</button></span></div></div>`).join('');
    const inbox = s.projects.map((pj) => ({ pj, n: st.offers.filter((o) => o.pid === pj.id).length, w: st.pitches.filter((x) => x.pid === pj.id).length })).filter((x) => x.n || x.w)
      .map((x) => `<div class="row-item"><div><b>${esc(x.pj.name)}</b><small>${x.n} teklif · ${x.w} yayıncı bakıyor</small></div><button data-act="open-proj" data-pid="${x.pj.id}">Projeye git</button></div>`).join('');
    const A = B.agent;
    const agent = st.agent ? `<div class="row-item"><div><b>${st.agent.tier === 'good' ? 'Deneyimli ajan' : 'Ucuz ajan'}</b><small>Telif gelirinin %${Math.round(A[st.agent.tier].fee * 100)}'i + aylık ${money(A[st.agent.tier].retainer * M.inflation(c) ** 0.5)}. Dosyaları hazırlar, yılda ${A[st.agent.tier].doors} büyük kapıyı açar.</small></div><button data-act="agentfire">Kov</button></div>`
      : `<div class="btns"><button data-act="agent" data-id="good">Deneyimli ajan<small>%10 + ${money(A.good.retainer * M.inflation(c) ** 0.5)}/ay</small></button><button data-act="agent" data-id="cheap">Ucuz ajan<small>%5 + ${money(A.cheap.retainer * M.inflation(c) ** 0.5)}/ay · riskli</small></button></div>`;
    const rights = s.ips.filter((ip) => ip.rightsPub).map((ip) => `<div class="row-item"><div><b>"${esc(ip.name)}" serisi</b><small>Haklar ${esc(Pub.pubName(c, ip.rightsPub))}'da: devam oyununu yalnız onlar yayınlar.</small></div><button data-act="buyrights" data-id="${ip.id}">Geri al · ${money(Pub.rightsPrice(c, ip))}</button></div>`).join('');
    const multi = st.multi ? `<p class="small">📜 ${esc(Pub.pubName(c, st.multi.pubId))} ile üç oyunluk anlaşma: ${st.multi.left} oyun kaldı.</p>` : '';
    return `<section class="box"><h3>Stüdyonun yayıncı gözündeki itibarı: <span class="num">${it > 0 ? '+' : ''}${it}</span></h3>
        <p class="muted small">Son 5 oyunun not ortalaması, ilk 10'lar ve hayranlar. Gücü 60'ın altındaki yayıncılar herkese açık; 60–74 en az bir oyun ve eksi olmayan itibar ister; 75 ve üstü yalnız tanıştığı stüdyoyla çalışır (deneme işi, vitrin etkinliği, ödül, tavsiye ya da ajan). Pay yayıncı netinin (fiyatın %${Math.round(B.net * 100)}'i) yüzdesidir.</p>${multi}</section>
      ${inbox ? `<section class="box"><h3>Teklif kutusu</h3>${inbox}</section>` : ''}
      ${orderOffers || orders ? `<section class="box"><h3>Siparişler</h3>${orderOffers}${orders}</section>` : ''}
      ${st.agent || s.games.length >= 2 ? `<section class="box"><h3>Ajan</h3>${agent}</section>` : ''}
      ${rights ? `<section class="box"><h3>Seri hakları</h3>${rights}</section>` : ''}
      ${filters()}<div class="pubgrid">${filtered(Pub.list(c), null).map((p) => pubCard(p)).join('')}</div>`;
  }

  return { pubCard, projectPubBox, releaseChoice, winPublishers };
}
