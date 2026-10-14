// Bilgisayar masası, reklam, oda penceresi ve oda kurma.
import { M, Eco, Staff, Co } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { esc, ICON_OF } from './util.js';

export function make(u) {
  const { G, app, ctx, icons } = u;
  const personRow = (...a) => u.personRow(...a);
  // ---------- BİLGİSAYAR (patronun masası): tüm yönetim buradan
  function winHub() {
    const s = G().state, c = ctx();
    const ready = s.projects.filter((p) => p.status === 'debug').length;
    const tile = (id, label, sub, extra = '') => `<button class="hubtile" data-hub="${id}" ${sub ? `data-hubsub="${sub}"` : ''}><img src="${icons[ICON_OF[id] ? id : id] || icons.bilgisayar}" alt=""><b>${label}</b>${extra ? `<small>${extra}</small>` : ''}</button>`;
    return `<p class="muted small">Patronun bilgisayarı. Odalara sahnede dokunarak da iş verebilirsin; binalar arasında kaydırarak geç.</p>
      <div class="hub">
        ${tile('gelistir', 'Yeni oyun geliştir', 'oyun', `${s.projects.length} proje${ready ? ` · ${ready} hazır` : ''}`)}
        ${tile('gelistir', 'Ek iş bul', 'sozlesme', s.contract ? 'sözleşme sürüyor' : `${s.contractOffers.length} teklif`)}
        ${tile('personel', 'Personel bul', '', `${s.staff.length}/${Staff.seats(c)} koltuk`)}
        ${tile('reklam', 'Reklam ver', '', s.projects.length ? `${s.projects.length} proje` : 'proje yok')}
        ${tile('arge', 'Araştırma', 'arastirma', s.research.current ? 'sürüyor' : `${Math.floor(s.research.rp)} RP`)}
        ${tile('pazar', 'Satışlar', 'oyunlar', `${s.games.filter((g) => g.active).length} oyun satışta`)}
        ${tile('pazar', 'Satış listesi', 'liste')}
        ${tile('finans', 'Finans', '', money(s.cash))}
        ${tile('ofis', 'Ofis ve binalar', '', Eco.office(c).name)}
        ${tile('arge', 'Donanım ve konsol', 'konsol', s.consoleJob ? 'yapım sürüyor' : `${(s.consoleSeries || []).length} aile`)}
        ${tile('arge', 'Motor', 'motor')}
        ${tile('ayarlar', 'Ayarlar ve kayıt', '', 'ses, yuvalar')}
        ${tile('dunya', 'Oyun dünyası', 'yil', `${Math.floor(M.tableYear(c))} · ${s.rivals.length} şirket`)}
        ${tile('finans', 'Şirket ve borsa', 'sirket', Co.company(s).listed ? `hisse ${Co.company(s).price} $` : 'halka arz')}
      </div>`;
  }
  // Reklam: her proje için kampanya düğmeleri (Geliştir penceresinin pazarlama kısmının kısayolu)
  function winAds() {
    const s = G().state, c = ctx();
    if (!s.projects.length) return '<p class="muted">Reklam verilecek proje yok. Önce yeni bir oyun başlat.</p>';
    return s.projects.map((pj) => `<section class="box"><div class="head"><h3>${esc(pj.name)}</h3><span class="pill">Hype ${Math.round(pj.hype)}</span></div>
      <div class="btns">${PACK.hype.campaigns.filter((x) => !x.minYear || M.tableYear(c) >= x.minYear).map((x) => { const lock = x.research && !s.research.done[x.research]; return `<button data-act="campaign" data-pid="${pj.id}" data-id="${x.id}" ${lock ? 'disabled' : ''}>${x.name}<small>${lock ? 'araştır' : money(x.cost * M.inflation(c) ** 0.7)}</small></button>`; }).join('')}</div></section>`).join('')
      + `<p class="muted small">Pazarlama ve yayın odası projelere her hafta kendiliğinden hype üretir.</p>`;
  }

  // ---------- ODA (sahnede odaya dokununca): görev, hedef proje, kişiler, odaya özel işler
  function targetSelect(r) {
    const s = G().state;
    if (!PACK.rooms.targetable.includes(r.type)) return '';
    return `<label class="field">Hangi projede çalışsın?<select id="tg-${r.id}" data-act="target" data-id="${r.id}"><option value="">Tüm projeler (eşit bölünür)</option>${s.projects.map((p) => `<option value="${p.id}" ${r.target === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`;
  }
  function devModeSelect(r) {
    const s = G().state;
    const own = s.projects.find((p) => p.roomId === r.id);
    const opts = Object.entries(PACK.rooms.modes).filter(([k]) => k !== 'destek').map(([k, v]) => `<option value="${k}" ${r.mode === k ? 'selected' : ''}>${v}</option>`).join('')
      + (own ? '' : s.projects.map((p) => `<option value="destek:${p.id}" ${r.mode === 'destek' && r.target === p.id ? 'selected' : ''}>Destek: ${esc(p.name)}</option>`).join(''));
    return `<p class="muted small">${own ? `Projesi: <b>${esc(own.name)}</b>` : r.mode === 'destek' ? 'Başka bir projeye destek veriyor.' : 'Şu an projesi yok.'}</p><label class="field">Görev<select id="md-${r.id}" data-act="mode" data-id="${r.id}">${opts}</select></label>`;
  }
  function winRoom() {
    const g = G(), s = g.state, c = ctx();
    const r = s.rooms.find((x) => x.id === app.room);
    if (!r) return '<p class="muted">Oda yok.</p>';
    const t = Staff.roomType(c, r.type), people = Staff.membersOf(c, r), cap = Staff.roomSeats(c);
    let work = '';
    if (r.type === 'gelistirme') {
      const own = s.projects.find((p) => p.roomId === r.id);
      work = devModeSelect(r) + `<div class="btns">${own ? `<button class="primary" data-act="open-proj" data-pid="${own.id}">Projeyi aç</button>` : r.mode !== 'sozlesme' && r.mode !== 'destek' ? `<button class="primary" data-act="new-in-room" data-id="${r.id}">Bu odada yeni oyun</button>` : ''}<button data-act="goto" data-id="gelistir" data-sub="sozlesme">Ek iş bul</button></div>`;
    } else if (r.type === 'arastirma') work = `<div class="btns"><button class="primary" data-act="goto" data-id="arge" data-sub="arastirma">Araştırma listesi</button><span class="muted small">${Math.floor(s.research.rp)} RP</span></div>`;
    else if (r.type === 'donanim') work = `<div class="btns"><button class="primary" data-act="goto" data-id="arge" data-sub="konsol">Konsol yap</button></div>`;
    else if (r.type === 'pazarlama') work = targetSelect(r) + winAds();
    else if (r.type === 'musteri') {
      const list = s.games.slice(-8).reverse().map((gm) => `<div class="row-item"><div><b>${esc(gm.name)}</b><small>${gm.playerReport ? 'rapor hazır' : gm.active && gm.weeks < PACK.playerReport.minWeeks ? `${PACK.playerReport.minWeeks - gm.weeks} hf sonra` : 'rapor çıkarılabilir'}</small></div><button data-act="report" data-id="${gm.id}" ${gm.active && gm.weeks < PACK.playerReport.minWeeks ? 'disabled' : ''}>${gm.playerReport ? 'Raporu gör' : 'Rapor çıkar · bedava'}</button></div>`).join('');
      work = `<p class="muted small">Müşteri destek ekibi oyuncu raporlarını bedavaya hazırlar.</p>${list || '<p class="muted">Henüz oyun yok.</p>'}`;
    } else work = targetSelect(r);
    const hire = people.length < cap ? `<details class="box"><summary><h3>Bu odaya işe al · ${cap - people.length} boş koltuk</h3></summary>${s.applicants.map((p) => `<div class="row-item"><div><b>${esc(p.name)}</b><small><span class="spec s-${p.spec}">${Staff.career(c, p.career).name} ${p.careers[p.career]}</span> beceri ${p.skill}</small></div><button data-act="hire-here" data-id="${p.id}" data-room="${r.id}">${money(p.salary)}/ay</button></div>`).join('') || '<p class="muted">Bu ay başvuru yok.</p>'}</details>` : '';
    return `<p class="muted small">${t.desc}</p><section class="box">${work}</section>
      <div class="head"><h3>Çalışanlar</h3><span class="pill">${people.length}/${cap}</span></div>
      <div class="people">${people.map(personRow).join('') || '<p class="muted small">Boş oda. Personel penceresinden birini buraya taşı ya da aşağıdan işe al.</p>'}</div>${hire}
      ${s.rooms.length > 1 ? `<div class="foot"><button class="ghost danger small" data-act="demolish" data-id="${r.id}">${app.confirm === 'dem' + r.id ? 'Emin misin?' : 'Odayı sök'}</button></div>` : ''}`;
  }
  // Boş alana dokununca: o binaya uygun odalar
  function winBuild() {
    const s = G().state, c = ctx();
    const b = PACK.buildings.find((x) => x.id === app.buildFor) || PACK.buildings[0];
    const free = Staff.slots(c) - s.rooms.length;
    return `<p class="muted small">${esc(b.name)} için oda kur. Boş alan: ${free}.</p><div class="tiles">${PACK.rooms.types.filter((t) => b.types.includes(t.id)).map((t) => {
      const lock = t.research && !s.research.done[t.research] ? 'araştır' : t.office && s.office.tier < t.office ? PACK.offices[t.office - 1].name : '';
      return `<button class="tile" data-act="build" data-id="${t.id}" ${lock || free <= 0 ? 'disabled' : ''} title="${esc(t.desc)}">${t.name}<small>${lock || money(t.cost * M.inflation(c) ** 0.5)}</small></button>`;
    }).join('')}</div>${PACK.rooms.types.filter((t) => b.types.includes(t.id)).map((t) => `<p class="small"><b>${t.name}:</b> <span class="muted">${t.desc}</span></p>`).join('')}`;
  }

  return { winHub, winAds, targetSelect, devModeSelect, winRoom, winBuild };
}
