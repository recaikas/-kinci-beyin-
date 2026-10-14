// Ofis ve binalar: odalar, taşınma, istasyonlar, ofis tasarımı.
import { M, Eco, Staff } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { esc } from './util.js';

export function make(u) {
  const { G, app, ctx } = u;
  const buildings = (...a) => u.buildings(...a);
  const targetSelect = (...a) => u.targetSelect(...a);
  // ---------- OFİS
  function winOffice() {
    const s = G().state, c = ctx();
    const off = Eco.office(c), next = PACK.offices.find((o) => o.tier === s.office.tier + 1);
    const moveLabel = next ? `${next.name}'e taşın · ${money(next.cost * M.inflation(c) ** 0.5)}` : off.floorCost && s.office.floors < off.maxFloors ? `Yeni kat (+${off.floorSlots} oda) · ${money(off.floorCost * M.inflation(c) ** 0.5)}` : null;
    const st = PACK.workstations.tiers[s.stationTier], up = Eco.stationUpgradeCost(c), cap = Staff.roomSeats(c);
    const rooms = s.rooms.map((r) => {
      const t = Staff.roomType(c, r.type), people = Staff.membersOf(c, r);
      const own = s.projects.find((p) => p.roomId === r.id);
      const modeOpts = Object.entries(PACK.rooms.modes).filter(([k]) => k !== 'destek').map(([k, v]) => `<option value="${k}" ${r.mode === k ? 'selected' : ''}>${v}</option>`).join('')
        + (own ? '' : s.projects.map((p) => `<option value="destek:${p.id}" ${r.mode === 'destek' && r.target === p.id ? 'selected' : ''}>Destek: ${esc(p.name)}</option>`).join(''));
      const mode = r.type === 'gelistirme' ? `<p class="muted small">${own ? `Projesi: <b>${esc(own.name)}</b>` : r.mode === 'destek' ? 'Başka projeye destek veriyor' : 'Projesi yok'}</p><select id="md-${r.id}" data-act="mode" data-id="${r.id}" aria-label="Oda modu">${modeOpts}</select>` : '';
      return `<section class="box room r-${r.type}"><div class="head"><h3>${t.name}</h3><span class="pill">${people.length}/${cap}</span></div>
        <p class="muted small">${t.desc}</p>${mode}${PACK.rooms.targetable.includes(r.type) ? targetSelect(r) : ''}
        <p class="names">${people.map((p) => `<span class="spec s-${p.spec}">${esc(p.name.split(' ')[0])}</span>`).join('') || '<span class="muted small">Boş</span>'}</p>
        ${s.rooms.length > 1 ? `<div class="foot"><button class="ghost danger small" data-act="demolish" data-id="${r.id}">${app.confirm === 'dem' + r.id ? 'Emin misin?' : 'Sök'}</button></div>` : ''}</section>`;
    }).join('');
    const free = Staff.slots(c) - s.rooms.length;
    const build = free > 0 ? `<section class="box"><h3>Boş alan: ${free}</h3><div class="tiles">${PACK.rooms.types.map((t) => {
      const lock = t.research && !s.research.done[t.research] ? 'araştır' : t.office && s.office.tier < t.office ? PACK.offices[t.office - 1].name : '';
      return `<button class="tile" data-act="build" data-id="${t.id}" ${lock ? 'disabled' : ''} title="${esc(t.desc)}">${t.name}<small>${lock || money(t.cost * M.inflation(c) ** 0.5)}</small></button>`;
    }).join('')}</div></section>` : '';
    return `<section class="box"><div class="kv"><span>Mekân</span><b>${esc(off.name)}</b><span>Oda alanı</span><b class="num">${s.rooms.length}/${Staff.slots(c)}</b><span>Koltuk</span><b class="num">${s.staff.length}/${Staff.seats(c)}</b>
      <span>Bilgisayar</span><b>${st.name} <small class="muted">×${M.stationFactor(c).toFixed(2)}${s.stationTier < M.expectedStationTier(c) ? ' · geride' : ''}</small></b></div>
      <div class="btns">${moveLabel ? `<button data-act="office">${moveLabel}</button>` : ''}<button data-act="stations" ${up == null ? 'disabled' : ''}>${up == null ? 'İstasyonlar son seviye' : `İstasyon yükselt · ${money(up)}`}</button></div></section>
      ${designBox()}${build}<div class="grid">${rooms}</div>`;
  }
  function designBox() {
    const s = G().state, c = ctx();
    const list = buildings();
    const eff = (d) => [d.speed !== 1 ? `hız ×${d.speed}` : '', d.morale ? `moral ${d.morale > 0 ? '+' : ''}${d.morale}` : '', d.stress !== 1 ? `stres ×${d.stress}` : '', d.rentMult !== 1 ? `kira ×${d.rentMult}` : '', d.prestige ? 'prestij' : ''].filter(Boolean).join(' · ') || 'nötr';
    return `<section class="box"><h3>Ofis tasarımı</h3><p class="muted small">Her binanın kendi dekoru var. Ucuz dekor kirayı düşürür ama üretimi yavaşlatır; konforlu dekor moral ve stresi iyileştirir.</p>
      ${list.map((b) => { const cur = s.designs?.[b.id] || 'standart'; return `<h3 class="sub">${esc(b.name)}</h3><div class="tiles dz">${PACK.designs.map((d) => { const cost = Eco.designCost(c, b.id, d.id); return `<button class="tile ${cur === d.id ? 'on' : ''}" data-act="design" data-b="${b.id}" data-id="${d.id}" title="${esc(d.desc)}"><i class="sw" style="background:${d.floor || '#5b4a73'};border-color:${d.wall || '#8a7aa3'}"></i>${d.name}<small>${eff(d)}</small><small>${cur === d.id ? 'seçili' : cost ? money(cost) : 'bedava'}</small></button>`; }).join('')}</div>`; }).join('')}</section>`;
  }

  return { winOffice, designBox };
}
