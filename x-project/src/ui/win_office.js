// Ofis ve binalar: odalar, taşınma, istasyonlar, ofis tasarımı.
import { M, Eco, Staff } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { esc } from './util.js';
import * as Office from '../systems/office.js';

export function make(u) {
  const { G, app, ctx } = u;
  const buildings = (...a) => u.buildings(...a);
  const targetSelect = (...a) => u.targetSelect(...a);
  // ---------- OFİS
  function winOffice() {
    const s = G().state, c = ctx();
    const off = Eco.office(c), next = PACK.offices.find((o) => o.tier === s.office.tier + 1);
    const moveLabel = next ? `${next.name}'e taşın · ${money(next.cost * M.inflation(c) ** 0.5)}` : off.floorCost && s.office.floors < off.maxFloors ? `Yeni kat (+${off.floorSlots} oda) · ${money(off.floorCost * M.inflation(c) ** 0.5)}` : null;
    const reports = s.staff.map((p) => Office.workReport(c, p));
    const rooms = s.rooms.map((r) => {
      const t = Staff.roomType(c, r.type), people = Staff.membersOf(c, r), cap = Staff.roomSeats(c, r);
      const own = s.projects.find((p) => p.roomId === r.id);
      const modeOpts = Object.entries(PACK.rooms.modes).filter(([k]) => k !== 'destek').map(([k, v]) => `<option value="${k}" ${r.mode === k ? 'selected' : ''}>${v}</option>`).join('')
        + (own ? '' : s.projects.map((p) => `<option value="destek:${p.id}" ${r.mode === 'destek' && r.target === p.id ? 'selected' : ''}>Destek: ${esc(p.name)}</option>`).join(''));
      const mode = r.type === 'gelistirme' ? `<p class="muted small">${own ? `Projesi: <b>${esc(own.name)}</b>` : r.mode === 'destek' ? 'Başka projeye destek veriyor' : 'Projesi yok'}</p><select id="md-${r.id}" data-act="mode" data-id="${r.id}" aria-label="Oda modu">${modeOpts}</select>` : '';
      return `<section class="box room r-${r.type}"><div class="head"><h3>${t.name}</h3><span class="pill">${people.length}/${cap}</span></div>
        <p class="muted small">${t.desc}</p><button data-act="furnish" data-id="${r.id}">Donat ve düzenle</button>${mode}${PACK.rooms.targetable.includes(r.type) ? targetSelect(r) : ''}
        <p class="names">${people.map((p) => `<span class="spec s-${p.spec}">${esc(p.name.split(' ')[0])}</span>`).join('') || '<span class="muted small">Boş</span>'}</p>
        ${s.rooms.length > 1 ? `<div class="foot"><button class="ghost danger small" data-act="demolish" data-id="${r.id}">${app.confirm === 'dem' + r.id ? 'Emin misin?' : 'Sök'}</button></div>` : ''}</section>`;
    }).join('');
    const build = `<button data-act="build-menu">Yeni oda çiz</button>`;
    return `<section class="box"><div class="kv"><span>Mekân</span><b>${esc(off.name)}</b><span>Oda sayısı</span><b class="num">${s.rooms.length}</b><span>Koltuk</span><b class="num">${s.staff.length}/${Staff.seats(c)}</b>
      <span>Donanımlı çalışma yeri</span><b>${s.rooms.reduce((a, r) => a + Office.workstations(c, r.id).length, 0)}</b><span>Ortalama verim</span><b>×${(reports.reduce((a, r) => a + r.factor, 0) / Math.max(1, reports.length)).toFixed(2)}</b><span>Aylık işletme</span><b>${money(Office.monthlyCost(c))}</b></div>
      <div class="btns">${moveLabel ? `<button data-act="office">${moveLabel}</button>` : ''}</div></section>
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
