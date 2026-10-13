// Piksel ofis sahnesi: tatlı çalışanlar, kaosla bozulan ofis. Tüm çizim düşük çözünürlüklü canvas'a, CSS ile büyütülür.
import { seats } from '../systems/staff.js';

export const W = 256, H = 160;

const WALLS = {
  1: { wall: '#6b6478', trim: '#57506a', floor: '#4a4458', floor2: '#433d50' },
  2: { wall: '#f2b8c6', trim: '#d993a8', floor: '#b07a5a', floor2: '#a06e50' },
  3: { wall: '#a8e6cf', trim: '#7fcbb0', floor: '#c9b18a', floor2: '#bba37c' },
  4: { wall: '#c7b8f5', trim: '#a493dd', floor: '#8f8aa8', floor2: '#837e9c' },
};
const MONITOR = ['#7a9b6a', '#8fb3d9', '#9fe3ff', '#c9a6ff', '#ffb3e6'];
const SKY = ['#9fd3ff', '#9fd3ff', '#b8e3ff', '#bdf0c4', '#c6f5a8', '#ffe39a', '#ffd27a', '#ffc27a', '#f5a97a', '#c9a0d0', '#a3a8d8', '#8fa3d9'];

// 5×5 ifade simgeleri
const EMOTE = {
  heart: ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'],
  drop: ['..x..', '..x..', '.xxx.', 'xxxxx', '.xxx.'],
  skull: ['.xxx.', 'x.x.x', 'xxxxx', '.x.x.', '.x.x.'],
  cloud: ['.xx..', 'xxxx.', 'xxxxx', '.x.x.', 'x.x..'],
  fire: ['..x..', '.xx..', '.xxx.', 'xxxxx', '.xxx.'],
  zzz: ['xxxx.', '..x..', '.x...', 'xxxx.', '.....'],
  book: ['xxxx.', 'x..x.', 'xxxx.', 'x..x.', 'xxxx.'],
  plus: ['..x..', '..x..', 'xxxxx', '..x..', '..x..'],
};
const EMOTE_COLOR = { heart: '#ff6fa8', drop: '#6fc3ff', skull: '#5a4a6a', cloud: '#7a7a8f', fire: '#ff8a3d', zzz: '#d8d8ff', book: '#ffd36f', plus: '#ff5a5a' };

export function makeRenderer(canvas) {
  const g = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const icon = (name, x, y) => {
    const rows = EMOTE[name];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (rows[j][i] === 'x') px(x + i, y + j, 1, 1, EMOTE_COLOR[name]);
  };
  // Kalıcı rastgele dekor (tohumlu, kareden kareye titremesin)
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  function person(x, y, p, frame, founder) {
    const bob = p.status === 'ok' && (frame + p.id) % 20 < 10 ? 1 : 0;
    // sandalye
    px(x - 1, y + 7, 9, 3, '#3a3048');
    // gövde
    px(x, y + 4, 7, 5, p.shirt);
    // kafa
    px(x + 1, y - 1, 5, 5, p.look.skin);
    px(x + 1, y - 2, 5, 2, p.look.hair);
    px(x + 1, y - 1, 1, 2, p.look.hair);
    if (founder) { px(x + 1, y - 3, 5, 1, '#ffd36f'); px(x + 2, y - 4, 1, 1, '#ffd36f'); px(x + 4, y - 4, 1, 1, '#ffd36f'); }
    // gözler (arkası dönük değil, ekrana bakıyor; yandan)
    if (p.status === 'tukenmis') { px(x + 2, y + 1, 1, 1, '#2a2030'); px(x + 4, y + 1, 1, 1, '#2a2030'); px(x + 2, y + 3, 3, 1, '#2a2030'); }
    else { px(x + 2, y + 1, 1, 1, '#2a2030'); px(x + 4, y + 1, 1, 1, '#2a2030'); if (p.morale > 60) px(x + 3, y + 3, 1, 1, '#c24d6a'); }
    // kollar (yazma animasyonu)
    if (p.status === 'ok') { px(x - 1, y + 5 - bob, 2, 2, p.look.skin); px(x + 6, y + 4 + bob, 2, 2, p.look.skin); }
  }

  function emote(p, x, y, frame, state) {
    let e = null;
    if (p.status === 'tukenmis') e = 'skull';
    else if (p.status === 'hasta') e = 'plus';
    else if (p.status === 'egitim') e = 'book';
    else if (state.crunch && frame % 60 < 30) e = 'fire';
    else if (p.stress > 80) e = 'drop';
    else if (p.morale < 30) e = 'cloud';
    else if (p.assign === 'dinlen') e = 'zzz';
    else if (p.morale > 82) e = 'heart';
    if (!e) return;
    const fl = Math.sin((frame + p.id * 7) / 8) > 0 ? 0 : 1;
    px(x - 1, y - 1 - fl, 7, 7, '#1b1426');
    px(x, y - fl, 5, 5, '#fff7fb');
    icon(e, x, y - fl);
  }

  return function draw(state, pack, frame) {
    const tier = state.office.tier;
    const pal = WALLS[tier];
    const month = Math.floor((state.week % 48) / 4);
    const kaos = state.kaos;
    const [t1, t2, t3] = pack.chaos.visualThresholds;
    seed = 7 + tier * 13 + (state.office.floors || 0);

    // duvar & zemin
    px(0, 0, W, 56, pal.wall);
    for (let x = 0; x < W; x += 16) px(x, 0, 1, 56, pal.trim);
    px(0, 52, W, 4, pal.trim);
    for (let y = 56; y < H; y += 8) for (let x = 0; x < W; x += 8) px(x, y, 8, 8, ((x + y) / 8) % 2 ? pal.floor : pal.floor2);

    // pencereler / garaj kapısı
    if (tier === 1) {
      px(8, 8, 60, 44, '#8a8296');
      for (let y = 10; y < 52; y += 6) px(10, y, 56, 4, '#9e97aa');
      px(190, 12, 40, 26, '#3a3048'); px(192, 14, 36, 22, SKY[month]);
    } else {
      const n = tier + 1;
      for (let i = 0; i < n; i++) {
        const wx = 14 + i * Math.floor((W - 28) / n);
        px(wx, 10, 36, 26, '#3a3048'); px(wx + 2, 12, 32, 22, SKY[month]);
        px(wx + 17, 12, 2, 22, '#3a3048');
        // kış: kar; sonbahar: yağmur
        if (month === 11 || month <= 1) for (let k = 0; k < 6; k++) px(wx + 3 + ((k * 7 + frame / 3) % 30), 12 + ((k * 11 + frame / 2) % 21), 1, 1, '#ffffff');
        else if (month >= 8 && month <= 10) for (let k = 0; k < 5; k++) px(wx + 3 + ((k * 9) % 30), 12 + ((k * 5 + frame) % 21), 1, 2, '#6f8fbf');
      }
    }
    // poster: şirket logosu
    px(W - 30, 38, 22, 12, '#1b1426'); px(W - 28, 40, 18, 8, '#ff8fc7'); px(W - 24, 42, 10, 4, '#1b1426');

    // çatlak (kaos)
    if (kaos > t2) { px(120, 4, 1, 6, '#2a2030'); px(121, 9, 1, 5, '#2a2030'); px(119, 13, 1, 6, '#2a2030'); px(122, 18, 1, 4, '#2a2030'); }

    // masalar: az koltukta büyük çiz (garaj ×3, ofis ×2), kampüste ×1
    const n = seats({ state, pack });
    const z = n <= 1 ? 3 : n <= 10 ? 2 : 1;
    const vw = W / z, vh = (H - 60) / z;
    const cols = Math.min(n, z === 3 ? 1 : z === 2 ? 5 : 8);
    const rows = Math.ceil(n / cols);
    const cellW = z === 3 ? 18 : Math.floor((vw - 8) / cols), cellH = Math.min(26, Math.floor(vh / rows));
    const ox = z === 3 ? Math.floor(vw * 0.5) : 4 + Math.floor((vw - 8 - cellW * cols) / 2);
    const staff = state.staff;
    const monitor = state.stationDown > 0 ? '#4a4458' : MONITOR[state.stationTier];
    g.save(); g.translate(0, 58); g.scale(z, z);
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const x = ox + c * cellW + Math.floor(cellW / 2) - 9, y = 10 + r * cellH;
      const p = staff[i];
      px(x, y + 8, 18, 3, '#7a5640'); px(x + 1, y + 11, 2, 4, '#5e4231'); px(x + 15, y + 11, 2, 4, '#5e4231');
      px(x + 9, y, 8, 7, '#2a2030'); px(x + 10, y + 1, 6, 5, monitor); px(x + 12, y + 7, 2, 1, '#2a2030');
      if (p && p.status === 'ok' && state.stationDown <= 0 && frame % 30 < 15) px(x + 11, y + 2 + ((frame + i) % 3), 3, 1, '#ffffff');
      if (!p) continue;
      p.shirt = pack.staffGen.shirt[p.spec];
      if (p.status === 'ok' || p.status === 'egitim') person(x + 1, y + 1, p, frame, p.founder);
      else px(x + 1, y + 8, 9, 3, '#3a3048');
      emote(p, x + 2, y - 9, frame, state);
    }
    g.restore();

    // kedi
    if (state.flags.kedi) {
      const cx = 30 + ((frame / 4) % (W - 60)), cy = H - 12;
      px(cx, cy, 8, 4, '#f29a4a'); px(cx + 6, cy - 3, 4, 4, '#f29a4a'); px(cx + 6, cy - 4, 1, 1, '#f29a4a'); px(cx + 9, cy - 4, 1, 1, '#f29a4a'); px(cx - 2, cy - 2 + (frame % 20 < 10 ? 0 : 1), 2, 1, '#f29a4a');
    }

    // kaos: yerdeki kâğıtlar, pizza kutuları
    if (kaos > t1) {
      const k = Math.floor((kaos - t1) / 4) + 3;
      for (let i = 0; i < k; i++) { const x = rnd() * (W - 8), y = 60 + rnd() * (H - 64); px(x, y, 4, 3, i % 3 ? '#f5f0e6' : '#d9a066'); }
    }
    // kaos: titreyen ışık
    if (kaos > t2 && (frame % 90 < 6 || (kaos > t3 && frame % 37 < 3))) { g.fillStyle = 'rgba(10,6,20,0.45)'; g.fillRect(0, 0, W, H); }
    // kaos: alarm ve küçük yangınlar
    if (kaos > t3) {
      const a = (Math.sin(frame / 6) + 1) / 2;
      g.fillStyle = `rgba(255,40,60,${0.08 + a * 0.12})`; g.fillRect(0, 0, W, H);
      px(W / 2 - 3, 2, 6, 3, a > 0.5 ? '#ff3b4f' : '#7a1f2a');
      for (let i = 0; i < 2; i++) { const fx = 40 + i * 140, fy = H - 14; px(fx, fy + 4, 6, 2, '#ff8a3d'); px(fx + 1, fy + 1 + (frame % 8 < 4 ? 0 : 1), 4, 4, '#ffd36f'); px(fx + 2, fy - 1, 2, 3, '#ff5a3d'); }
    }
    // crunch: gece mavisi
    if (state.crunch) { g.fillStyle = 'rgba(30,20,80,0.18)'; g.fillRect(0, 0, W, H); }
  };
}
