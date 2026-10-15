// Sistem: kayıt yuvaları (otomatik + 3 yuva, dosyaya aktar/içe al), ayarlar penceresi (ses), kısa öğretici.
import { loadGame, M } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { SAVE_KEY, esc, store } from './util.js';

export const SLOTS = ['xp-slot-1', 'xp-slot-2', 'xp-slot-3'];
const TUT_KEY = 'xp-tut-done';

// Kayıt özeti: ad, yıl, kasa, zorluk (kaydı oyuna açmadan okur)
export function summary(json) {
  try {
    const s = JSON.parse(json);
    const year = Math.floor(PACK.meta.startYear + s.week / 48 / (s.lengthMult || 1));
    const diff = PACK.difficulties.find((d) => d.id === s.difficulty)?.name || s.difficulty;
    return { name: s.companyName, year, cash: s.cash, diff, games: s.games?.length || 0, over: !!s.gameOver, week: s.week };
  } catch { return null; }
}

// Konu F: öğretici 4 adım; gerisini her ekranın ilk açılış açıklaması öğretir.
const STEPS = [
  { sel: '#scene', title: 'X Project\'e hoş geldin', text: '1976, bir garaj, tek bir bilgisayar. Odaya dokun: görevini ve çalışanlarını görürsün. Boş alana dokunup oda kurarsın. Masadaki bilgisayar bütün menüyü tek ekranda açar.' },
  { sel: '[data-cat=is]', title: 'İş › Yeni oyun', text: 'Alt çubukta başlıklar var; her başlığın içinde seçenekler. İş › Yeni oyun ile oyun yaparsın, İş › Sözleşme işleri ile para kazanırsın. Araştırdıkça yeni başlıklar ve seçenekler açılır.' },
  { sel: '#hud .time', title: 'Zaman', text: 'Oynat/durdur ve hız. Boşluk tuşu da durdurur. Pencere açıkken zaman kendiliğinden durur.' },
  { sel: '[data-cat=sistem]', title: 'Günlük', text: 'Sistem › Günlük: haberler, tarihî olaylar ve yeni açılan her şey (🆕). Şimdi ilk oyununun sihirbazı açılıyor.' },
];

export function make(u) {
  const { app, root, G } = u;
  const note = (...a) => u.note(...a);

  // --- kayıt yuvaları
  function slotRows(withSave) {
    const rows = [{ key: SAVE_KEY, label: 'Otomatik kayıt', auto: true }, ...SLOTS.map((k, i) => ({ key: k, label: `Yuva ${i + 1}` }))];
    return rows.map((r) => {
      const j = store((s) => s.getItem(r.key)), sm = j && summary(j);
      const info = sm ? `${esc(sm.name)} · ${sm.year} · ${money(sm.cash)} · ${esc(sm.diff)}${sm.over ? ' · bitti' : ''}` : 'boş';
      const btns = [
        sm && !sm.over ? `<button data-act="slot-load" data-id="${r.key}">Yükle</button>` : '',
        withSave && !r.auto ? `<button data-act="slot-save" data-id="${r.key}">${app.confirm === 'save' + r.key ? 'Üzerine yaz?' : sm ? 'Üzerine kaydet' : 'Kaydet'}</button>` : '',
        sm && !r.auto ? `<button class="ghost danger small" data-act="slot-del" data-id="${r.key}">${app.confirm === 'del' + r.key ? 'Emin misin?' : 'Sil'}</button>` : '',
      ].join('');
      return `<div class="row-item"><div><b>${r.label}</b><small>${info}</small></div><div class="btns">${btns}</div></div>`;
    }).join('');
  }
  function saveSlot(key) {
    if (!G()) return { ok: false, msg: 'Oyun yok.' };
    const ok = store((s) => { s.setItem(key, G().save()); return true; });
    return ok ? { ok: true } : { ok: false, msg: 'Tarayıcı kaydı yazamadı (depolama dolu ya da kapalı).' };
  }
  function loadSlot(key) {
    const j = store((s) => s.getItem(key));
    if (!j) return { ok: false, msg: 'Yuva boş.' };
    u.start(loadGame(j));
    note('Kayıt yüklendi.', 'good');
    return { ok: true };
  }
  function deleteSlot(key) { store((s) => s.removeItem(key)); return { ok: true }; }
  function exportSave() {
    if (!G()) return;
    const blob = new Blob([G().save()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `xproject-${G().state.companyName.replace(/\W+/g, '-')}-${Math.floor(M.tableYear(G().ctx))}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importSave(file) {
    const r = new FileReader();
    r.onload = () => {
      const j = String(r.result);
      if (!summary(j)) return note('Bu dosya bir X Project kaydı değil.', 'bad');
      u.start(loadGame(j));
      note('Kayıt dosyadan yüklendi.', 'good');
    };
    r.readAsText(file);
  }

  // --- ayarlar penceresi
  function winSettings() {
    const a = u.audio.cfg;
    return `<section class="box"><h3>Ses</h3>
        <label class="slider"><span>Efektler</span><input type="range" min="0" max="100" step="5" id="vol-sfx" data-vol="sfx" value="${Math.round(a.sfx * 100)}"><b class="num">${Math.round(a.sfx * 100)}</b></label>
        <label class="slider"><span>Müzik</span><input type="range" min="0" max="100" step="5" id="vol-music" data-vol="music" value="${Math.round(a.music * 100)}"><b class="num">${Math.round(a.music * 100)}</b></label>
        <p class="muted small">Müzik döneme göre değişir (70'lerin kare dalgalarından 2010'ların yumuşak döngülerine); kaos yükseldikçe hızlanır. Üst çubuktaki hoparlör düğmesi hızlıca kısar.</p></section>
      <section class="box"><h3>Kayıtlar</h3><p class="muted small">Oyun her ay otomatik kaydedilir. Yuvalar ayrı kariyerler ya da yedek içindir. Kayıtlar bu tarayıcıda durur; başka cihaza taşımak için dosyaya aktar.</p>
        ${slotRows(true)}
        <div class="btns"><button data-act="export">Dosyaya aktar</button><label class="filebtn">Dosyadan yükle<input type="file" accept=".json,application/json" id="imp-file" data-import="1"></label></div></section>
      <section class="box"><h3>Diğer</h3><div class="btns"><button data-act="tutorial">Öğreticiyi yeniden göster</button><button class="ghost" data-act="mainmenu">${app.confirm === 'menu' ? 'Kaydedip çık?' : 'Ana menü'}</button></div></section>`;
  }

  // --- öğretici
  let tutEl = null, tutStep = 0, tutDone = null;
  function tutorial(onDone) {
    tutDone = onDone || null; tutStep = 0;
    app.tutWas = app.running; u.play(false);
    if (!tutEl) { tutEl = document.createElement('div'); tutEl.id = 'tut'; root.appendChild(tutEl); }
    tutEl.hidden = false;
    showStep();
  }
  function showStep() {
    const st = STEPS[tutStep];
    const target = st.sel && root.querySelector(st.sel);
    const r = target?.getBoundingClientRect();
    const box = r && r.width ? `<div class="tut-hole" style="left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px"></div>` : '<div class="tut-dim"></div>';
    const below = r && r.top < window.innerHeight / 2;
    const pos = r && r.width ? `left:${Math.max(12, Math.min(window.innerWidth - 352, r.left))}px;${below ? `top:${Math.min(window.innerHeight - 200, r.bottom + 14)}px` : `bottom:${Math.max(12, window.innerHeight - r.top + 14)}px`}` : 'left:50%;top:50%;transform:translate(-50%,-50%)';
    tutEl.innerHTML = `${box}<div class="tut-card" role="dialog" aria-modal="true" style="${pos}"><small class="muted">${tutStep + 1}/${STEPS.length}</small><h3>${esc(st.title)}</h3><p>${esc(st.text)}</p>
      <div class="foot"><button class="ghost" data-act="tut-skip">Atla</button><button class="primary" data-act="tut-next">${tutStep === STEPS.length - 1 ? 'Başla' : 'İleri'}</button></div></div>`;
    tutEl.querySelector('[data-act=tut-next]').focus();
  }
  function tutNext(skip = false) {
    if (!skip && tutStep < STEPS.length - 1) { tutStep++; u.audio.play('click'); return showStep(); }
    tutEl.hidden = true; tutEl.innerHTML = '';
    store((s) => s.setItem(TUT_KEY, '1'));
    const done = tutDone; tutDone = null;
    if (done) done(); else if (app.tutWas) u.play(true);
  }
  const tutorialSeen = () => !!store((s) => s.getItem(TUT_KEY));
  const tutorialOpen = () => !!tutEl && !tutEl.hidden;

  return { slotRows, saveSlot, loadSlot, deleteSlot, exportSave, importSave, winSettings, tutorial, tutNext, tutorialSeen, tutorialOpen };
}
