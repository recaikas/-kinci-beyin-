// Motor ve teknoloji (Konu E): Ar-Ge › Teknoloji (7 kategorili merdiven), Ar-Ge › Motor (kendi motor aileleri, motor pazarı,
// ara yazılımlar, dışarıya lisans) ve sihirbazın Teknoloji adımı (motor seçimi, özellikler, kategori çubukları).
import { M, Engines } from '../game.js';
import { money } from '../kernel.js';
import { esc, bar } from './util.js';

const pctK = (k) => `×${k.toFixed(2).replace('.', ',')}`;
const payText = (p) => [p.fee ? `${money(p.fee)} peşin` : '', p.royalty ? `satıştan %${Math.round(p.royalty * 100)}${p.threshold ? ` (ilk ${money(p.threshold)} hariç)` : ''}` : '', p.seat ? `kişi başı aylık ${money(p.seat)}` : ''].filter(Boolean).join(' + ') || 'bedava';

export function make(u) {
  const { G, app, ctx } = u;
  const catTops = (feats) => Engines.CATS.map((c) => { const top = feats.map((f) => Engines.FEAT[f]).filter((f) => f.cat === c.id).sort((a, b) => a.year - b.year).pop(); return `<span class="pill">${c.icon} ${esc(top?.name || '—')}</span>`; }).join(' ');

  // ---------- Ar-Ge › Teknoloji
  function techTree() {
    const c = ctx(), s = G().state, y = M.tableYear(c);
    if (!Engines.techOpen(c)) return '<p class="muted">"Kendi motorunu yap" araştırmasıyla teknoloji hattı açılır. O zamana kadar sıfırdan kod (yalnız temel özellikler) ya da motor pazarından lisanslı motor kullanırsın.</p>';
    const cur = s.tech.current;
    const curBox = cur ? `<section class="box hl"><h3>🔧 ${esc(Engines.FEAT[cur.id].name)}</h3><p class="muted small">${cur.weeksLeft} hafta kaldı. Bitince motoruna eklemek için yeni sürüm yap.</p></section>` : '';
    const cols = Engines.CATS.map((cat) => {
      const list = Engines.FEATURES.filter((f) => f.cat === cat.id);
      let shownFuture = false;
      const steps = list.map((f) => {
        const st = Engines.techState(c, f.id);
        if (st === 'future') { if (shownFuture) return ''; shownFuture = true; return `<div class="tstep future"><span>🥚 ${esc(f.name)}</span><small>${f.year}'de doğar</small></div>`; }
        if (st === 'done') return `<div class="tstep done"><span>✓ ${esc(f.name)}</span><small>${f.base ? 'temel' : f.year}</small></div>`;
        if (st === 'running') return `<div class="tstep run"><span>⏳ ${esc(f.name)}</span><small>${cur.weeksLeft} hf</small></div>`;
        if (st === 'locked') return `<div class="tstep locked"><span>🔒 ${esc(f.name)}</span><small>önceki basamak</small></div>`;
        const i = M.featureStats(c, f.id), ok = !cur && s.research.rp >= i.rp;
        return `<div class="tstep ready"><span>${esc(f.name)} <small class="muted">${f.year}${f.need?.tech ? ` · konsol kademe ${f.need.tech}` : ''}${f.need?.kinds ? ` · ${f.need.kinds.join(', ')}` : ''}</small></span><button class="mini" data-act="tech" data-id="${f.id}" ${ok ? '' : 'disabled'}>Araştır<small>${i.rp} RP · ${money(i.cost)} · ${i.weeks} hf</small></button></div>`;
      }).join('');
      return `<section class="box tcol"><h3>${cat.icon} ${esc(cat.name)} <small class="muted">${cat.disc === 'gfx' ? 'grafik puanı' : cat.disc === 'ses' ? 'ses puanı' : 'teknik puanı'}</small></h3>${steps}</section>`;
    }).join('');
    return `<div class="rp"><b class="num">${Math.floor(s.research.rp)}</b><span>araştırma puanı (genel araştırmayla ortak)</span></div>${curBox}
      <p class="muted small">Teknoloji hattı genel araştırmadan ayrı yürür. Her kategori bir merdiven: yeni basamak öncekinin üstüne gelir. Eski basamaklar zamanla ucuzlar. Araştırılan özellik oyuna ancak motorun yeni sürümüyle girer.</p>
      <div class="tcols">${cols}</div>`;
  }

  // ---------- Ar-Ge › Motor: kendi motorların, yeni sürüm, motor pazarı
  function engineView() {
    const c = ctx(), s = G().state, y = M.tableYear(c);
    const fams = Engines.families(c).sort((a, b) => b.builtYear - a.builtYear);
    const own = fams.map((e) => {
      const fam = e.family ?? e.id, n = M.familyGames(c, fam), age = Math.floor(y - e.builtYear);
      const lic = s.licensees?.[e.id] || [];
      const older = s.engines.filter((x) => (x.family ?? x.id) === fam && x !== e).map((x) => `${esc(x.name)} (${Math.floor(x.builtYear)})`).join(', ');
      return `<section class="box"><div class="head"><h3>⚙️ ${esc(e.name)}</h3><span class="pill ${age > 5 ? 'warn' : ''}">${Math.floor(e.builtYear)} · ${age > 5 ? 'eskimiş' : `${age} yaşında`}</span></div>
        <p class="small">${catTops([...Engines.BASE, ...e.features])}</p>
        <p class="muted small">${M.engineScore(c, e)} puan · dönem beklentisi ${M.catExpected(c, null)} · ${n} oyun · ${n === 0 ? 'ekip yeni: ilk oyun %5 yavaş, daha hatalı' : n >= 3 ? 'ekip ezbere biliyor: %5 hızlı' : 'ekip alışıyor'}${older ? ` · eski sürümler: ${older}` : ''}</p>
        <div class="foot"><span class="muted small">${e.licensed ? (lic.length ? `🤝 Lisansçılar: ${lic.map(esc).join(', ')}` : 'Pazarda; lisansçı bekliyor (motor dönemin %80\'ini karşılamalı).') : s.research.done.motor_lisans ? 'Motoru rakiplere lisanslarsan aylık gelir; onların oyunları biraz iyileşir.' : '"Motor lisanslama" araştırmasıyla pazara açılır.'}</span>
          <button data-act="licence" data-id="${e.id}" ${s.research.done.motor_lisans ? '' : 'disabled'}>${e.licensed ? 'Lisansı kapat' : 'Pazara aç'}</button></div></section>`;
    }).join('');
    // Yapım: yeni aile ya da seçili ailenin yeni sürümü
    let build = '';
    if (s.research.done.motor_ozel) {
      if (s.engineJob) build = `<section class="box hl"><h3>Yapılıyor: ${esc(s.engineJob.name)}</h3><p class="muted small">${s.engineJob.weeksLeft} hafta kaldı · ${s.engineJob.features.length} özellik</p></section>`;
      else {
        const researched = Engines.FEATURES.filter((f) => !f.base && Engines.techDone(c, f.id)).map((f) => f.id);
        const from = app.engFrom === 'yeni' ? null : fams.find((e) => String(e.id) === String(app.engFrom)) || fams[0] || null;
        if (!app.engineSel.size && researched.length) researched.forEach((f) => app.engineSel.add(f));
        const sel = [...app.engineSel].filter((f) => researched.includes(f));
        const b = Engines.buildCost(c, sel, from?.id ?? null);
        const picks = Engines.CATS.map((cat) => { const fs = researched.filter((f) => Engines.FEAT[f].cat === cat.id); if (!fs.length) return '';
          return `<h3 class="sub">${cat.icon} ${esc(cat.name)}</h3>${fs.map((f) => { const st = M.featureStats(c, f), carried = from?.features.includes(f);
            return `<label class="pick"><input type="checkbox" id="ft-${f}" data-feat="${f}" ${app.engineSel.has(f) ? 'checked' : ''}><span class="name">${esc(Engines.FEAT[f].name)}${carried ? ' <small class="muted">taşınır</small>' : ''}</span><span class="meta num">${st.enginePts} p · ${money(st.engineCost * (carried ? 0.2 : 1))}</span></label>`; }).join('')}`; }).join('');
        build = `<section class="box"><h3>${from ? `${esc(from.name.replace(/\s+\d+$/, ''))} · yeni sürüm` : 'Yeni motor'}</h3>
          <div class="form"><label>Aile<select id="e-from" data-engfrom="1"><option value="yeni" ${!from ? 'selected' : ''}>Yeni aile</option>${fams.map((e) => `<option value="${e.id}" ${from === e ? 'selected' : ''}>${esc(e.name)} → yeni sürüm</option>`).join('')}</select></label>
          ${from ? '' : `<label>Motor adı<input id="e-name" data-eng="name" value="${esc(app.engineName)}" maxlength="24"></label>`}</div>
          ${researched.length ? `<fieldset class="picks">${picks}</fieldset>` : '<p class="muted small">Önce Teknoloji sekmesinden en az bir basamak araştır. Temel özellikler her motorda zaten var.</p>'}
          <div class="foot"><span class="muted small">${b.fs.length} özellik · ${money(b.cost)} · ${b.weeks} hafta${from ? ' · eski özellikler %20 bedelle taşınır' : ''}</span><button class="primary" data-act="engine" ${b.fs.length ? '' : 'disabled'}>${from ? 'Yeni sürümü yap' : 'Motoru yap'}</button></div></section>`;
      }
    }
    // Motor pazarı
    const lics = Engines.licAvailable(c).map((L) => {
      const p = M.licPay(L, y), feats = M.licFeatures(c, L);
      const sk = c.pack.engine.licSpeedK, pc = (k) => Math.round((k - 1) * sk * 100);
      const spec = [L.speed > 1 ? `%${pc(L.speed)} hızlı${L.speedKinds ? ' (telefon ve el konsolu)' : ''}` : '', ...Object.entries(L.genres || {}).map(([gid, k]) => `${esc(M.genreById(c, gid)?.name || gid)} %${pc(k)} hızlı`), L.subs ? 'yalnız görsel roman ve seçimli anlatı' : '', L.to < 2200 ? `${L.to}'e kadar` : ''].filter(Boolean).join(' · ');
      return `<div class="row-item"><div><b>${esc(L.name)}</b><small>“${esc(L.joke)}” · dönemin ${M.licLag(L, y)} yıl gerisi${spec ? ` · ${spec}` : ''}</small><small>${catTops(feats)}</small></div><span class="pill">${payText(p)}</span></div>`;
    }).join('');
    const mws = Engines.mwAvailable(c).map((m) => `<div class="row-item"><div><b>${esc(m.name)}</b><small>${esc(Engines.CATS.find((x) => x.id === m.cat).name)} kategorisini dönemin ${m.lag} yıl gerisine taşır</small></div><span class="pill">${money(m.fee)} peşin</span></div>`).join('');
    const market = y >= 1979 ? `<section class="box"><h3>🧰 Motor pazarı</h3><p class="muted small">Lisans projeye bağlanır: peşin bedel proje başında, yüzde satıştan haftalık kesilir (finans tablosunda "motor lisans"). Lisanslı motor sahibince güncellenir, eskimez.</p>${lics || '<p class="muted small">Bu yıl lisans veren motor yok.</p>'}
      ${mws ? `<h3 class="sub">Ara yazılımlar</h3>${mws}` : ''}</section>` : '<p class="muted small">Motor pazarı 1979\'da açılır.</p>';
    return `${own || (s.research.done.motor_ozel ? '' : '<p class="muted small">Kendi motorun yok. "Kendi motorunu yap" araştırmasıyla teknoloji hattı ve motor yapımı açılır.</p>')}${build}${market}`;
  }

  // ---------- Sihirbaz: Teknoloji adımı
  function draftPj(d) { return { ...d, engineId: d.engineId != null && d.engineId !== '' ? +d.engineId : null, engineLic: d.engineLic || null, mw: d.mw || [], features: d.features || null }; }
  function techStep(d) {
    const c = ctx(), y = M.tableYear(c), s = G().state;
    d.mw ||= [];
    const fams = Engines.families(c).sort((a, b) => b.builtYear - a.builtYear);
    if (d.engineLic && !Engines.licAvailable(c).some((L) => L.id === d.engineLic && Engines.licFits(L, d))) d.engineLic = null;
    const key = d.engineId ? `own:${d.engineId}` : d.engineLic ? `lic:${d.engineLic}` : 'scratch';
    const tile = (k, label, sub) => `<button class="tile ${key === k ? 'on' : ''}" data-act="weng" data-id="${k}">${esc(label)}<small class="ms">${sub}</small></button>`;
    const tiles = [tile('scratch', 'Sıfırdan kod', 'yalnız temel özellikler'),
      ...fams.map((e) => tile(`own:${e.id}`, `⚙️ ${e.name}`, `${Math.floor(e.builtYear)} · kendi motorun`)),
      ...Engines.licAvailable(c).filter((L) => Engines.licFits(L, d)).map((L) => tile(`lic:${L.id}`, `🧰 ${L.name}`, payText(M.licPay(L, y))))].join('');
    const pj = draftPj(d), src = M.engineOf(c, pj);
    const tp = M.techProfile(c, pj), sp = M.engineSpeed(c, pj);
    const chosen = new Set(tp.feats);
    const bars = Engines.CATS.map((cat) => { const x = tp.cats[cat.id];
      return `<div class="tcat"><span>${cat.icon} ${esc(cat.name)}</span>${bar(Math.min(1.5, x.r) / 1.5 * 100, x.r >= 1 ? 'd-oyn' : x.r >= 0.8 ? 'd-ses' : 'd-tek')}<small>${esc(x.top)}${x.r < 1 ? ` <span class="warn">· dönem ${esc(x.expTop)} bekliyor</span>` : ''}</small></div>`; }).join('');
    const feats = Engines.CATS.map((cat) => { const fs = src.avail.filter((f) => Engines.FEAT[f].cat === cat.id && !Engines.FEAT[f].base); if (!fs.length) return '';
      return fs.map((f) => { const ok = M.featOk(c, f, d.platforms);
        return `<label class="pick ${ok ? '' : 'locked'}"><input type="checkbox" id="wf-${f}" data-wfeat="${f}" ${chosen.has(f) ? 'checked' : ''} ${ok ? '' : 'disabled'}><span class="name">${cat.icon} ${esc(Engines.FEAT[f].name)}</span><span class="meta">${ok ? '+%1 süre' : 'platform kaldırmıyor'}</span></label>`; }).join(''); }).join('');
    const mws = src.kind !== 'lic' ? Engines.mwAvailable(c).map((m) => `<label class="pick"><input type="checkbox" id="wm-${m.id}" data-wmw="${m.id}" ${d.mw.includes(m.id) ? 'checked' : ''}><span class="name">${esc(m.name)} <small class="muted">${esc(Engines.CATS.find((x) => x.id === m.cat).name)}</small></span><span class="meta num">${money(m.fee)}</span></label>`).join('') : '';
    const fee = Engines.startFees(c, pj), pay = src.L ? M.licPay(src.L, y) : {};
    const warn = M.techNotes(c, pj).filter((n) => n.v < 0).map((n) => `<li>${esc(n.text)}${n.line ? ` · “${esc(n.line)}”` : ''}</li>`).join('');
    return `<h3>Motor <small class="muted">oyuna giren her teknik özellik bir motordan gelir</small></h3><div class="tiles">${tiles}</div>
      ${src.L ? `<p class="muted small">“${esc(src.L.joke)}” · ${payText(pay)} · dönemin ${M.licLag(src.L, y)} yıl gerisi</p>` : src.kind === 'scratch' ? '<p class="muted small">Sıfırdan kod bedavadır ama yalnız 1976\'nın temel özelliklerini bilir.</p>' : ''}
      <section class="box"><h3>Kategoriler <small class="muted">seninki · dönemin beklentisi</small></h3>${bars}
        <p class="small">Grafik ${pctK(tp.gfx)} · Ses ${pctK(tp.ses)} · Teknik ${pctK(tp.tek)} · Hız ${pctK(sp.speed)}${sp.bugs > 1 ? ' · ilk oyun: daha hatalı' : ''} · Süre +%${Math.round((tp.load - 1) * 100)}</p>
        ${warn ? `<ul class="todo">${warn}</ul>` : ''}</section>
      ${feats ? `<fieldset class="picks"><legend>Özellikler <small>temel dışı her özellik geliştirmeyi %1 uzatır (en çok %15)</small></legend>${feats}</fieldset>` : ''}
      ${mws ? `<fieldset class="picks"><legend>Ara yazılım <small>bir kategoriyi dönemin gerisine taşır, peşin ödenir</small></legend>${mws}</fieldset>` : ''}
      ${fee ? `<p class="small">Motor bedeli: <b class="num">${money(fee)}</b> proje başında.</p>` : ''}`;
  }
  function techSummary(d) {
    const c = ctx(), pj = draftPj(d), src = M.engineOf(c, pj), y = M.tableYear(c);
    const tp = M.techProfile(c, pj);
    return `<span>Motor</span><b>${esc(src.name)}${src.L ? ` · ${payText(M.licPay(src.L, y))}` : ''}</b><span>Teknoloji</span><b>Grafik ${pctK(tp.gfx)} · Ses ${pctK(tp.ses)} · Teknik ${pctK(tp.tek)}${tp.load > 1 ? ` · süre +%${Math.round((tp.load - 1) * 100)}` : ''}</b>`;
  }
  // Etkileşim: motor seçimi, özellik ve ara yazılım kutuları
  function onWeng(id) {
    const d = app.draft; d.features = null; d.mw = [];
    const [k, v] = id.split(':');
    d.engineId = k === 'own' ? +v : null; d.engineLic = k === 'lic' ? v : null;
  }
  function onWfeat(fid, on) {
    const d = app.draft, c = ctx(), pj = draftPj(d);
    const set = new Set(d.features || M.projFeatures(c, pj).filter((f) => !Engines.FEAT[f].base));
    on ? set.add(fid) : set.delete(fid);
    d.features = [...set];
  }
  function onWmw(id, on) { const d = app.draft, set = new Set(d.mw || []); on ? set.add(id) : set.delete(id); d.mw = [...set]; d.features = null; }
  return { techTree, engineView, techStep, techSummary, onWeng, onWfeat, onWmw, draftPj };
}
