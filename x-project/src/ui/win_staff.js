// Personel: çalışan satırı, yetenek/huy/ilişki, tatil politikası, işe alım.
import { M, Staff, People } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { esc, bar, STATUS, move } from './util.js';

export function make(u) {
  const { G, app, ctx } = u;
  // ---------- PERSONEL
  function personRow(p) {
    const c = ctx(), car = Staff.career(c, p.career), lvl = p.careers[p.career] || 0;
    const open = app.expanded.has(p.id);
    const room = Staff.roomOf(c, p);
    const status = STATUS[p.status] ? `<span class="pill warn">${STATUS[p.status]} ${p.statusWeeks}</span>` : '';
    let actions = '';
    if (open) {
      const lc = Staff.levelCost(c, p), opts = Staff.careerOptions(c, p);
      actions = `<div class="acts">
        <label>Oda<select id="mv-${p.id}" data-act="move" data-id="${p.id}">${G().state.rooms.map((r) => `<option value="${r.id}" ${p.room === r.id ? 'selected' : ''}>${esc(Staff.roomType(c, r.type).name)} #${r.id}</option>`).join('')}</select></label>
        <label>Eğitim<select id="tr-${p.id}" data-act="train" data-id="${p.id}"><option value="">Seç…</option>${PACK.training.map((t) => `<option value="${t.id}">${t.name} · ${money(t.cost * M.inflation(c))}</option>`).join('')}</select></label>
        <label>Kariyer<select id="cr-${p.id}" data-act="career" data-id="${p.id}"><option value="">${opts.length ? 'Değiştir…' : 'Seçenek yok'}</option>${opts.map((o) => `<option value="${o.id}">${o.name} · ${money(PACK.careerRules.changeCost * M.inflation(c))}</option>`).join('')}</select></label>
        <div class="btns"><button data-act="level" data-id="${p.id}" ${lc == null ? 'disabled' : ''}>${lc == null ? 'Son seviye' : `Seviye atlat · ${lc} RP`}</button>
          ${p.founder ? '' : `<button data-act="raise" data-id="${p.id}">Zam %12</button><button class="ghost danger" data-act="fire" data-id="${p.id}">${app.confirm === 'fire' + p.id ? 'Emin misin?' : 'Kov'}</button>`}</div>
        <p class="muted small">Kariyerler: ${Object.entries(p.careers).map(([k, v]) => `${Staff.career(c, k).name} ${v}`).join(', ')}</p>
        ${traitPills(p)}
        <div class="skills">${PACK.skills.keys.map(([k, n]) => `<span>${n}</span>${bar(p.skills?.[k] || 0, 'sk')}<b class="num">${p.skills?.[k] ?? '–'}</b>`).join('')}</div>
        ${relLine(p)}
        <div class="foot"><span class="muted small">İzin hakkı ${(p.vacDue || 0).toFixed(1)} hf${p.lastVac != null ? ` · son tatil Y${Math.floor(p.lastVac / 48) + 1}` : ''}</span><button data-act="vacation" data-id="${p.id}" ${p.status !== 'ok' ? 'disabled' : ''}>Tatile gönder</button></div></div>`;
    }
    return `<div class="person ${p.status !== 'ok' ? 'away' : ''} ${open ? 'open' : ''}">
      <button class="who" data-act="expand" data-id="${p.id}" aria-expanded="${open}">
        <span class="name">${p.founder ? '♛ ' : ''}${esc(p.name)}</span><span class="num pay">${p.founder ? 'kurucu' : money(p.salary)}</span>
        <span class="tagline"><span class="spec s-${p.spec}">${car.name} ${lvl}</span><span class="muted">${esc(Staff.roomType(c, room?.type || 'gelistirme').name)}</span>${status}</span>
        <span class="vit"><span class="num" title="Beceri">${Math.round(p.skill)}</span><span title="Moral">${bar(p.morale, 'm')}</span><span title="Stres">${bar(p.stress, 's')}</span></span>
      </button>${actions}</div>`;
  }
  const traitName = (id) => PACK.traits.find((t) => t.id === id)?.name || id;
  const traitPills = (p) => { const t = [p.trait, p.trait2].filter(Boolean); return t.length ? `<p class="traits">${t.map((id) => `<span class="pill">${esc(traitName(id))}</span>`).join('')}</p>` : ''; };
  function relLine(p) {
    const rels = People.relationsOf(ctx(), p);
    if (!rels.length) return '';
    const f = rels.filter(([, v]) => v >= PACK.relations.friendAt), e = rels.filter(([, v]) => v <= PACK.relations.enemyAt);
    return `<p class="small rels">${f.length ? `<span class="up">♥ ${f.slice(0, 3).map(([x]) => esc(x.name.split(' ')[0])).join(', ')}</span> ` : ''}${e.length ? `<span class="down">⚡ ${e.slice(0, 3).map(([x]) => esc(x.name.split(' ')[0])).join(', ')}</span>` : ''}${!f.length && !e.length ? `<span class="muted">İlişkiler nötr</span>` : ''}</p>`;
  }
  function vacationBox() {
    const s = G().state, c = ctx();
    const away = People.onVacation(s), cap = People.vacationCap(c), cur = s.vacationPolicy || 'planli';
    return `<section class="box"><div class="head"><h3>Tatil politikası</h3><span class="pill">${away.length}/${cap} izinde</span></div>
      <div class="seg">${Object.entries(PACK.vacation.policies).map(([k, v]) => `<button data-act="vacpol" data-id="${k}" class="${cur === k ? 'on' : ''}" aria-pressed="${cur === k}">${v.name}</button>`).join('')}</div>
      <p class="muted small">${esc(PACK.vacation.policies[cur].desc)} Çalışanlar yılda ${PACK.vacation.perYear} hafta izin hakkı biriktirir; yorulunca ya da hak dolunca ister. Çakışan istek reddedilir, moral düşer ve aralarında gerginlik olur.</p>
      ${away.length ? `<p class="small">🏖️ ${away.map((p) => `${esc(p.name)} (${p.statusWeeks} hf)`).join(', ')}</p>` : ''}</section>`;
  }
  function winStaff() {
    const s = G().state, c = ctx();
    const apps = s.applicants.map((p) => `<div class="row-item"><div><b>${esc(p.name)}</b><small><span class="spec s-${p.spec}">${Staff.career(c, p.career).name} ${p.careers[p.career]}</span> beceri ${p.skill} · ${People.topSkills(c, p).map(([n, v]) => `${n} ${v}`).join(', ')}${[p.trait, p.trait2].filter(Boolean).map((t) => ' · ' + esc(traitName(t))).join('')}</small></div>
      <button data-act="hire" data-id="${p.id}" ${s.staff.length >= Staff.seats(c) ? 'disabled' : ''}>${money(p.salary)}/ay</button></div>`).join('');
    return vacationBox() + `<div class="legend"><span>Beceri</span><span><i class="dot m"></i>Moral</span><span><i class="dot s"></i>Stres</span><span class="muted">Ayrıntı için isme dokun</span></div>
      <div class="people">${s.staff.map(personRow).join('')}</div>
      <details class="box" ${s.staff.length < Staff.seats(c) ? 'open' : ''}><summary><h3>İşe alım · ${s.staff.length}/${Staff.seats(c)} koltuk</h3></summary>
        <p class="muted small">Her ay yenilenir. İşe alım ücreti bir aylık maaş. ${s.staff.length >= Staff.seats(c) ? 'Koltuk yok: Ofis penceresinden oda kur.' : ''}</p>${apps || '<p class="muted">Bu ay başvuru yok.</p>'}</details>`;
  }

  return { personRow, traitName, traitPills, relLine, vacationBox, winStaff };
}
