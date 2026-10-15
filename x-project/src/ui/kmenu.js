// Konu H: Kairosoft açılır menüsü. Kurucuya dokun → solda dar bir menü (başlık sütunu + seçenek sütunu).
// Bir odadaki çalışana dokun → departman menüsü: müdürün (yoksa en kıdemlinin) sözü, dokunduğun kişinin kartı ve odanın işleri.
// Hiçbir içerik basmadan açılmaz: yalnız son seçenek bir ekran açar.
import { Staff, Crew } from '../game.js';
import { PACK } from '../data/pack.js';
import { personaOf, leadOf } from '../data/crew.js';
import { esc, bar } from './util.js';
import * as Menu from './menu.js';

export function make(u) {
  const { G, app, ctx } = u;
  const pop = () => app.pop;

  // ---------- karakter kartı
  function personCard(p, role = '') {
    const c = ctx(), car = Staff.career(c, p.career), pe = personaOf(p);
    const likes = (p.likes || []).map((g) => PACK.genres.find((x) => x.id === g)?.name).filter(Boolean).join(', ');
    const trait = [p.trait, p.trait2].filter(Boolean).map((t) => PACK.traits.find((x) => x.id === t)?.name).filter(Boolean).join(', ');
    return `<div class="kcard"><div class="kc-head"><b>${esc(p.name)}</b>${role ? `<span class="pill">${role}</span>` : ''}</div>
      <small>${esc(car.name)} ${p.careers[p.career] || 0} · ${esc(pe.name)} · liderlik ${leadOf(p)}</small>
      <p class="kc-say">“${esc(pe.lines[(G().state.week + p.id) % pe.lines.length])}”</p>
      <div class="kc-bars"><span>Moral</span>${bar(p.morale, 'm')}<span>Stres</span>${bar(p.stress, 's')}</div>
      <small class="muted">${likes ? `Sever: ${esc(likes)}` : ''}${trait ? ` · ${esc(trait)}` : ''}</small></div>`;
  }
  const roleOf = (r, p) => (Staff.managerOf(ctx(), r)?.id === p.id ? 'Müdür' : Staff.spokesOf(ctx(), r)?.id === p.id ? 'Kıdemli' : '');

  // ---------- kurucu menüsü
  function founderPop() {
    const g = G(), s = g.state, c = ctx(), P = pop();
    const cats = Menu.openCats(c, s);
    if (!cats.some((k) => k.id === P.cat)) P.cat = null;
    const founder = s.staff.find((x) => x.founder);
    const col1 = cats.map((k) => `<button class="krow ${P.cat === k.id ? 'on' : ''}" data-pcat="${k.id}"><img src="${u.icons[k.icon]}" alt=""><span>${esc(k.name)}</span>${k.id !== 'departman' && Menu.catNew(c, s, k.id) ? '<em class="newtag">YENİ</em>' : ''}</button>`).join('');
    let col2 = '';
    if (P.cat === 'departman') col2 = s.rooms.map((r) => { const sp = Staff.spokesOf(c, r); return `<button class="krow" data-act="pdept" data-id="${r.id}"><span>${esc(Staff.roomType(c, r.type).name)}</span><small>${sp ? esc(sp.name.split(' ')[0]) : 'boş'}</small></button>`; }).join('');
    else if (P.cat) col2 = Menu.openItems(c, s, P.cat).map((it) => `<button class="krow" data-act="mi" data-id="${it.id}"><span>${it.icon} ${esc(it.name)}</span>${Menu.isNew(s, it) ? '<em class="newtag">YENİ</em>' : ''}</button>`).join('')
      + Menu.teasers(c, s, P.cat).map((it) => `<button class="krow tease" data-act="tease" data-id="${it.id}"><span>??? </span><small>ipucu</small></button>`).join('');
    return `<div class="khead">👑 ${esc(founder?.name || s.founderName)}<button class="kx" data-act="pclose" aria-label="Kapat">✕</button></div>
      <div class="kcols"><div class="kcol">${col1}</div>${col2 ? `<div class="kcol sub">${col2}</div>` : ''}</div>`;
  }
  // ---------- departman menüsü
  function roomPop() {
    const g = G(), s = g.state, c = ctx(), P = pop();
    const r = s.rooms.find((x) => x.id === P.roomId);
    if (!r) { app.pop = null; return ''; }
    const t = Staff.roomType(c, r.type), sp = Staff.spokesOf(c, r), mgr = Staff.managerOf(c, r);
    const tapped = P.personId && s.staff.find((x) => x.id === P.personId && x.room === r.id);
    const own = s.projects.find((p) => p.roomId === r.id);
    const acts = [];
    if (r.type === 'gelistirme') acts.push(own ? `<button class="krow" data-act="open-proj" data-pid="${own.id}"><span>🛠️ Projeyi aç</span><small>${esc(own.name)}</small></button>` : r.mode !== 'sozlesme' && r.mode !== 'destek' ? `<button class="krow" data-act="new-in-room" data-id="${r.id}"><span>🎮 Bu odada yeni oyun</span></button>` : '');
    for (const it of Menu.deptItems(c, s, r.type)) if (!(r.type === 'gelistirme' && ['yeni', 'projeler'].includes(it.id))) acts.push(`<button class="krow" data-act="mi" data-id="${it.id}"><span>${it.icon} ${esc(it.name)}</span>${Menu.isNew(s, it) ? '<em class="newtag">YENİ</em>' : ''}</button>`);
    acts.push(`<button class="krow" data-act="proom" data-id="${r.id}"><span>🧑‍🤝‍🧑 Ekip ve oda</span><small>${Staff.membersOf(c, r).length}/${Staff.roomSeats(c, r)}</small></button>`);
    if (Staff.managersOpen(c)) acts.push(`<button class="krow ${P.sub === 'mgr' ? 'on' : ''}" data-act="pmgr"><span>🎖️ Müdür</span><small>${mgr ? esc(mgr.name.split(' ')[0]) : 'yok'}</small></button>`);
    if (mgr && Crew.AUTO[r.type]) acts.push(`<button class="krow ${r.auto ? 'on' : ''}" data-act="pauto" data-id="${r.id}" title="${esc(Crew.AUTO[r.type])}"><span>⚙️ Otomatik</span><small>${r.auto ? 'açık' : 'kapalı'}</small></button>`);
    const col2 = P.sub === 'mgr' ? Staff.membersOf(c, r).map((p) => `<button class="krow ${mgr?.id === p.id ? 'on' : ''}" data-act="setmgr" data-id="${r.id}" data-pid="${p.id}"><span>${esc(p.name)}</span><small>liderlik ${leadOf(p)}</small></button>`).join('') + (mgr ? `<button class="krow" data-act="setmgr" data-id="${r.id}" data-pid=""><span>Müdürü kaldır</span></button>` : '') : '';
    return `<div class="khead">${esc(t.name)}<button class="kx" data-act="pclose" aria-label="Kapat">✕</button></div>
      ${sp ? personCard(sp, roleOf(r, sp)) : '<p class="muted small kpad">Bu odada kimse yok. Ekip ve oda › işe al.</p>'}
      ${tapped && tapped.id !== sp?.id ? personCard(tapped, roleOf(r, tapped)) : ''}
      ${!mgr && Staff.managersOpen(c) && sp ? '<p class="muted small kpad">Müdür yok: en kıdemli çalışan sözcü (bonus vermez).</p>' : ''}
      <div class="kcols"><div class="kcol">${acts.filter(Boolean).join('')}</div>${col2 ? `<div class="kcol sub">${col2}</div>` : ''}</div>`;
  }
  function renderPop() {
    const el = u.el.pop;
    if (!app.pop || !G()) { el.hidden = true; u.setHTML(el, ''); return; }
    el.hidden = false;
    u.setHTML(el, app.pop.kind === 'room' ? roomPop() : founderPop());
  }
  function openPop(p) {
    if (app.win) u.closeWin();
    if (!app.pop) app.popWas = app.running;
    app.pop = p;
    u.play(false);
    renderPop();
  }
  function closePop() {
    if (!app.pop) return;
    app.pop = null;
    renderPop();
    if (app.popWas && !app.win && !app.dialog) u.play(true);
  }
  return { renderPop, openPop, closePop, personCard };
}
