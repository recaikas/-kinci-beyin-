// Chiptune ses (tarayıcının kendi ses motoru, dosya yok): efektler ve döneme göre değişen prosedürel müzik.
// İlk dokunuştan önce ses açılmaz (tarayıcı kuralı). Ayarlar tarayıcıda saklanır.
const KEY = 'xp-audio';
const load = () => { try { return { sfx: 0.5, music: 0.25, muted: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { sfx: 0.5, music: 0.25, muted: false }; } };
const saveCfg = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* yok */ } };

// Dönem müzikleri: tempo, gam (yarım ton), akor ilerleyişi (kök dereceleri), bas deseni ve dalga biçimi
const ERAS = [
  { from: 1976, bpm: 112, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 3], wave: 'square', duty: 0.5 },
  { from: 1985, bpm: 126, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 3, 4], wave: 'square', duty: 0.25 },
  { from: 1994, bpm: 100, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 6, 4], wave: 'square', duty: 0.125 },
  { from: 2005, bpm: 118, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 6, 4], wave: 'triangle', duty: 0.5 },
  { from: 2015, bpm: 84, scale: [0, 2, 4, 7, 9, 11], prog: [0, 5, 3, 4], wave: 'triangle', duty: 0.5 },
];
const SFX = {
  click: [[880, 0.03]],
  coin: [[988, 0.06], [1319, 0.12]],
  good: [[523, 0.07], [659, 0.07], [784, 0.12]],
  bad: [[392, 0.1], [311, 0.18]],
  warn: [[660, 0.08], [520, 0.1]],
  news: [[740, 0.05], [988, 0.08]],
  alert: [[880, 0.08], [0, 0.04], [880, 0.08], [1175, 0.14]],
  fanfare: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.32]],
  error: [[180, 0.12]],
  over: [[523, 0.18], [415, 0.18], [349, 0.18], [262, 0.5]],
};

export function makeAudio() {
  const cfg = load();
  let ac = null, master, sfxBus, musBus, noiseBuf, waves = {};
  let seqTimer = null, nextTime = 0, step = 0, era = ERAS[0], kaos = 0, seed = 1;

  function unlock() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    musBus = ac.createGain(); musBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyCfg();
    startMusic();
  }
  function applyCfg() {
    if (!ac) return;
    master.gain.value = cfg.muted ? 0 : 1;
    sfxBus.gain.value = cfg.sfx;
    musBus.gain.value = cfg.music;
  }
  // Darbe genişlikli kare dalga (NES benzeri): Fourier katsayılarıyla
  function pulse(duty) {
    if (waves[duty]) return waves[duty];
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return (waves[duty] = ac.createPeriodicWave(re, im));
  }
  function tone(bus, freq, t, dur, { wave = 'square', duty = 0.5, vol = 0.25, slide = 0 } = {}) {
    if (!freq) return;
    const o = ac.createOscillator(), g = ac.createGain();
    if (wave === 'square') o.setPeriodicWave(pulse(duty)); else o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(bus, t, dur, vol = 0.15, hp = 6000) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t); s.stop(t + dur + 0.02);
  }
  function play(name) {
    if (!ac || cfg.muted || !cfg.sfx) return;
    const notes = SFX[name];
    if (!notes) return;
    let t = ac.currentTime + 0.01;
    for (const [f, d] of notes) { tone(sfxBus, f, t, d, { duty: 0.25, vol: 0.22, slide: name === 'over' ? 0.98 : 0 }); t += d * 0.9; }
  }

  // --- Müzik: 16 adımlık döngü; tohumlu rastgele melodi, dönemin gamı ve akorları; kaos yükseldikçe hızlanır ve kararır
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let melody = [];
  function compose() {
    melody = Array.from({ length: 64 }, (_, i) => (i % 4 === 3 && rnd() < 0.5 ? null : era.scale[Math.floor(rnd() * era.scale.length)] + (rnd() < 0.2 ? 12 : 0)));
  }
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function schedule() {
    if (!ac) return;
    const bpm = era.bpm * (1 + Math.min(0.25, kaos / 400));
    const spb = 60 / bpm / 4; // 16'lık nota
    while (nextTime < ac.currentTime + 0.25) {
      const bar = Math.floor(step / 16) % era.prog.length;
      const root = 48 + era.prog[bar] + (kaos > 70 ? -1 : 0);
      const s16 = step % 16;
      if (cfg.music && !cfg.muted) {
        const m = melody[step % 64];
        if (m != null && s16 % 2 === 0) tone(musBus, midi(root + 12 + m), nextTime, spb * 1.8, { wave: era.wave, duty: era.duty, vol: 0.09 });
        if (s16 % 4 === 0) tone(musBus, midi(root - 12 + (s16 === 8 ? 7 : 0)), nextTime, spb * 3.5, { wave: 'triangle', vol: 0.16 });
        if (s16 % 8 === 4) noise(musBus, nextTime, 0.08, 0.08, 1500);
        if (s16 % 2 === 1) noise(musBus, nextTime, 0.025, 0.04, 8000);
      }
      nextTime += spb; step++;
      if (step % 64 === 0) compose();
    }
  }
  function startMusic() {
    if (seqTimer) return;
    compose();
    nextTime = ac.currentTime + 0.1;
    seqTimer = setInterval(schedule, 60);
  }
  function setEra(year, k = 0) {
    kaos = k;
    const e = [...ERAS].reverse().find((x) => year >= x.from) || ERAS[0];
    if (e !== era) { era = e; seed = Math.floor(year) * 31 + 7; compose(); }
  }
  function set(key, v) { cfg[key] = v; saveCfg(cfg); applyCfg(); }
  // Ses düğmesi: hepsi açık → müzik kapalı → tamamen sessiz → hepsi açık
  function cycle() {
    if (cfg.muted) { cfg.muted = false; cfg.music = cfg._music ?? 0.25; }
    else if (cfg.music > 0) { cfg._music = cfg.music; cfg.music = 0; }
    else cfg.muted = true;
    saveCfg(cfg); applyCfg();
    return state();
  }
  const state = () => (cfg.muted ? 'off' : cfg.music > 0 ? 'on' : 'sfx');
  return { unlock, play, setEra, set, cycle, state, cfg };
}
