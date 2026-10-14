// Diyaloglar: olay, faz dağılımı, yayına hazır, eleştirmenler, kurulum.
import { Staff, Know } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { SLOTS } from './system.js';
import { SAVE_KEY, esc, fmt, pct, store } from './util.js';

export function make(u) {
  const { G, app, ctx, el } = u;
  const badgeOf = (...a) => u.badgeOf(...a);
  const play = (...a) => u.play(...a);
  const render = (...a) => u.render(...a);
  const step = (...a) => u.step(...a);
  // --- diyaloglar: olaylar, faz dağılımı, yayın, eleştirmenler, kurulum
  function dialog(html, kind = '') {
    if (!app.dialog) app.wasRunningD = app.running || app.wasRunningD;
    app.dialog = kind || 'dlg';
    play(false);
    el.modal.innerHTML = `<div class="dialog ${kind}" role="dialog" aria-modal="true">${html}</div>`;
    el.modal.hidden = false;
    el.modal.querySelector('button.primary, button')?.focus();
  }
  function closeDialog() {
    app.dialog = null; el.modal.hidden = true; el.modal.innerHTML = '';
    if (G()?.state.pending.length) return showEvent();
    const resume = app.wasRunningD; app.wasRunningD = false;
    render();
    if (!app.win && resume) play(true);
  }
  function showEvent() {
    const g = G(), s = g.state;
    if (s.gameOver) {
      store((st) => st.removeItem(SAVE_KEY));
      u.audio.play('over');
      return dialog(`<h2 class="big">${{ iflas: 'İFLAS', kurul: 'GÖREVDEN ALINDIN' }[s.gameOver.reason] || 'SON'}</h2><p>${esc(s.gameOver.text)}</p>
        <div class="kv"><span>Oyun</span><b class="num">${s.games.length}</b><span>Hayran</span><b class="num">${fmt(s.fans)}</b><span>Ödül</span><b class="num">${s.awards.length}</b><span>Skor</span><b class="num">${fmt(g.finalScore())}</b></div>
        <button class="primary block" data-act="newgame">Yeni kariyer</button>`, 'over');
    }
    const ev = s.pending[0];
    if (!ev) return;
    u.audio.play('alert');
    dialog(`<small class="muted">${g.cal().era} · ${g.cal().label}</small><h2>${esc(ev.title)}</h2><p>${esc(ev.text)}</p>
      <div class="choices">${ev.choices.map((ch, i) => `<button data-choice="${i}" class="${i === 0 ? 'primary' : ''}">${esc(ch.label)}</button>`).join('')}</div>`, 'event');
  }
  function phaseDialog(pj) {
    const genre = PACK.genres.find((x) => x.id === pj.genre);
    app.phaseSeen[pj.id] = pj.phase; app.dlgPid = pj.id;
    const ids = PACK.missions.map((m, i) => i).filter((i) => PACK.missions[i].phase === pj.phase);
    dialog(`<small class="muted">${esc(pj.name)} · ${genre.name}</small><h2>${PACK.production.phaseNames[pj.phase]}</h2>
      <p class="small">Ekibin zamanını bu fazın üç görevine dağıt. Rozetler oyuncu raporlarından öğrendiğin önemi gösterir; ? henüz bilinmiyor.</p>
      <div class="phase-sliders">${ids.map((i) => `<label class="slider"><span>${PACK.missions[i].name} ${(() => { const w = Know.known(ctx()).mission(pj.genre, i); return w == null ? '<em class="kn">?</em>' : badgeOf(Math.round(w * 10)); })()}</span>
        <input type="range" min="0" max="100" step="5" id="alloc-${i}" data-alloc="${i}" value="${pj.alloc[i]}"><b class="num" id="pct-${i}"></b></label>`).join('')}</div>
      <button class="primary block" data-act="close-dialog">Devam</button>`, 'phase');
    updatePhasePct();
  }
  function updatePhasePct() {
    const pj = G()?.state.projects.find((p) => p.id === app.dlgPid);
    if (!pj) return;
    const ids = PACK.missions.map((m, i) => i).filter((i) => PACK.missions[i].phase === pj.phase);
    const sum = ids.reduce((a, i) => a + pj.alloc[i], 0) || 1;
    for (const i of ids) { const b = el.modal.querySelector(`#pct-${i}`); if (b) b.textContent = `%${Math.round((pj.alloc[i] / sum) * 100)}`; }
  }
  function readyDialog(pj) {
    app.readySeen[pj.id] = true;
    dialog(`<h2>"${esc(pj.name)}" hazır</h2><p>İçerik tamamlandı. Ekip şimdi hataları ayıklıyor (${fmt(pj.bugs)} hata). İstediğin an yayınlayabilirsin.</p>
      <div class="choices"><button class="primary" data-act="go-release" data-pid="${pj.id}">Yayın ekranına git</button><button data-act="close-dialog">Biraz daha ayıklasınlar</button></div>`);
  }
  function reviewDialog(game, rv, report = []) {
    u.audio.play(rv.score >= 60 ? 'fanfare' : 'bad');
    const verdict = rv.score >= 90 ? 'Başyapıt!' : rv.score >= 75 ? 'Çok iyi' : rv.score >= 60 ? 'Fena değil' : rv.score >= 40 ? 'Vasat' : 'Felaket';
    dialog(`<small class="muted">Eleştirmenler konuştu</small><h2>${esc(game.name)}</h2>
      <div class="critics">${rv.critics.map((k, i) => `<div class="critic" style="animation-delay:${0.25 + i * 0.35}s"><small>${esc(k.name)}</small><b class="num">${String(k.score).replace('.', ',')}</b>${k.quote ? `<q>${esc(k.quote)}</q>` : ''}</div>`).join('')}</div>
      <p class="verdict" style="animation-delay:1.8s"><b class="num">${String(rv.score).replace('.', ',')}</b> ${verdict}</p>
      ${rv.genreNote ? `<p class="gnote">“${esc(rv.genreNote)}”</p>` : ''}
      <div class="report"><h3>Oyun raporu</h3><ul>${report.map((l) => `<li class="${l.tone}">${esc(l.text)}</li>`).join('')}</ul><p class="muted small">Öğrendiklerin yeni oyun sihirbazında rozet olarak görünür.</p></div>
      <button class="primary block" data-act="close-dialog">Satışları izle</button>`, 'review');
  }
  function setupScreen() {
    const has = store((s) => s.getItem(SAVE_KEY));
    dialog(`<h1>X PROJECT</h1><p class="tag">Garajdan imparatorluğa. Ya da iflasa.</p>
      ${has ? '<button class="primary block" data-act="continue">Kayıtlı kariyere devam et</button>' : ''}
      ${SLOTS.some((k) => store((st) => st.getItem(k))) ? `<details class="box"><summary><h3>Kayıt yuvaları</h3></summary>${u.slotRows(false)}</details>` : ''}
      <label class="filebtn small">Dosyadan kayıt yükle<input type="file" accept=".json,application/json" id="imp-file0" data-import="1"></label>
      ${has ? '<hr>' : ''}
      <div class="form">
        <label>Stüdyo adı<input id="n-company" value="Piksel & Kaos"></label>
        <label>Kurucu adı<input id="n-founder" value="Sen"></label>
        <label>Kurucunun alanı<select id="n-spec">${PACK.disciplines.map((d) => `<option value="${d.id}">${d.name} · ${Staff.career({ pack: PACK }, PACK.careerRules.founderCareer[d.id]).name}</option>`).join('')}</select></label>
        <label>Zorluk<select id="n-diff">${PACK.difficulties.map((d) => `<option value="${d.id}" ${d.id === 'kolay' ? 'selected' : ''}>${d.name} · ${money(d.startCash)}</option>`).join('')}</select></label>
        <label>Kariyer uzunluğu<select id="n-len">${Object.keys(PACK.meta.gameLengths).map((l) => `<option value="${l}" ${+l === PACK.meta.defaultLength ? 'selected' : ''}>${+l === 50 ? '50 yıl · tam tarih 1976–2025' : `${l} yıl`}</option>`).join('')}</select></label>
        <label>Tohum<input id="n-seed" type="number" value="${(Date.now() % 100000) | 0}"></label>
      </div>
      <button class="primary block big" data-act="begin">1976'da garajı aç</button>`, 'setup');
  }
  return { dialog, closeDialog, showEvent, phaseDialog, updatePhasePct, readyDialog, reviewDialog, setupScreen };
}
