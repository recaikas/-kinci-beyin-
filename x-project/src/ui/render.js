// Piksel ofis sahnesi: odalar (MGT2 tarzı), tatlı çalışanlar, kaosla bozulan ofis.
// Düşük çözünürlüklü canvas'a çizilir, CSS ile büyütülür.
import { slots, roomSeats, membersOf } from '../systems/staff.js';

export const W = 256, H = 160;

const WALL = { 1: '#6b6478', 2: '#f2b8c6', 3: '#a8e6cf', 4: '#c7b8f5' };
const TRIM = { 1: '#57506a', 2: '#d993a8', 3: '#7fcbb0', 4: '#a493dd' };
const MONITOR = ['#7a9b6a', '#8fb3d9', '#9fe3ff', '#c9a6ff', '#ffb3e6'];
const SKY = ['#9fd3ff', '#9fd3ff', '#b8e3ff', '#bdf0c4', '#c6f5a8', '#ffe39a', '#ffd27a', '#ffc27a', '#f5a97a', '#c9a0d0', '#a3a8d8', '#8fa3d9'];

// 5×5 simgeler: çalışan ifadeleri ve oda tabelaları
const ICON = {
  heart: ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'],
  drop: ['..x..', '..x..', '.xxx.', 'xxxxx', '.xxx.'],
  skull: ['.xxx.', 'x.x.x', 'xxxxx', '.x.x.', '.x.x.'],
  cloud: ['.xx..', 'xxxx.', 'xxxxx', '.x.x.', 'x.x..'],
  fire: ['..x..', '.xx..', '.xxx.', 'xxxxx', '.xxx.'],
  zzz: ['xxxx.', '..x..', '.x...', 'xxxx.', '.....'],
  book: ['xxxx.', 'x..x.', 'xxxx.', 'x..x.', 'xxxx.'],
  plus: ['..x..', '..x..', 'xxxxx', '..x..', '..x..'],
  gelistirme: ['xxxxx', 'x...x', 'x...x', 'xxxxx', '.xxx.'],
  grafik: ['.xxx.', 'x.x.x', 'xxxxx', 'xx.xx', '.xxx.'],
  ses: ['..xxx', '..x.x', '..x..', 'xxx..', 'xxx..'],
  qa: ['x.x.x', '.xxx.', 'xxxxx', '.xxx.', 'x.x.x'],
  arastirma: ['.xxx.', '..x..', '.xxx.', 'xxxxx', 'xxxxx'],
  mola: ['.....', 'x...x', 'xxxxx', 'xxxxx', 'x...x'],
  donanim: ['x.x.x', 'xxxxx', 'xx.xx', 'xxxxx', 'x.x.x'],
};
const ICON_COLOR = { heart: '#ff6fa8', drop: '#6fc3ff', skull: '#5a4a6a', cloud: '#7a7a8f', fire: '#ff8a3d', zzz: '#8f86c9', book: '#d9a03f', plus: '#ff5a5a' };

export function makeRenderer(canvas) {
  const g = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const icon = (name, x, y, color) => {
    const rows = ICON[name];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (rows[j][i] === 'x') px(x + i, y + j, 1, 1, color || ICON_COLOR[name]);
  };
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  function person(x, y, p, frame) {
    const bob = p.status === 'ok' && (frame + p.id) % 20 < 10 ? 1 : 0;
    px(x - 1, y + 7, 9, 3, '#3a3048');
    px(x, y + 4, 7, 5, p.shirt);
    px(x + 1, y - 1, 5, 5, p.look.skin);
    px(x + 1, y - 2, 5, 2, p.look.hair);
    px(x + 1, y - 1, 1, 2, p.look.hair);
    if (p.founder) { px(x + 1, y - 3, 5, 1, '#ffd36f'); px(x + 2, y - 4, 1, 1, '#ffd36f'); px(x + 4, y - 4, 1, 1, '#ffd36f'); }
    px(x + 2, y + 1, 1, 1, '#2a2030'); px(x + 4, y + 1, 1, 1, '#2a2030');
    if (p.morale > 60) px(x + 3, y + 3, 1, 1, '#c24d6a');
    if (p.status === 'ok') { px(x - 1, y + 5 - bob, 2, 2, p.look.skin); px(x + 6, y + 4 + bob, 2, 2, p.look.skin); }
  }

  function emote(p, x, y, frame, state, resting) {
    let e = null;
    if (p.status === 'tukenmis') e = 'skull';
    else if (p.status === 'hasta') e = 'plus';
    else if (p.status === 'egitim') e = 'book';
    else if (state.crunch && !resting && frame % 60 < 30) e = 'fire';
    else if (p.stress > 80) e = 'drop';
    else if (p.morale < 30) e = 'cloud';
    else if (resting) e = 'zzz';
    else if (p.morale > 82) e = 'heart';
    if (!e) return;
    const fl = Math.sin((frame + p.id * 7) / 8) > 0 ? 0 : 1;
    px(x - 1, y - 1 - fl, 7, 7, '#1b1426');
    px(x, y - fl, 5, 5, '#fff7fb');
    icon(e, x, y - fl);
  }

  // Bir masa + (varsa) çalışan. Yerel koordinatlarda, 20×22'lik hücre.
  function desk(x, y, p, frame, state, monitor, kind) {
    if (kind === 'mola') {
      px(x, y + 9, 18, 6, '#c76f8f'); px(x, y + 6, 3, 9, '#a85a76'); px(x + 15, y + 6, 3, 9, '#a85a76');
    } else {
      px(x, y + 8, 18, 3, '#7a5640'); px(x + 1, y + 11, 2, 4, '#5e4231'); px(x + 15, y + 11, 2, 4, '#5e4231');
      if (kind === 'donanim') { px(x + 9, y + 2, 8, 5, '#5a6a5a'); px(x + 10, y + 3, 2, 1, '#ff5a5a'); px(x + 13, y + 3, 2, 1, '#8ff0c4'); }
      else {
        px(x + 9, y, 8, 7, '#2a2030'); px(x + 10, y + 1, 6, 5, kind === 'grafik' ? '#ffd6ea' : kind === 'ses' ? '#d9c8ff' : monitor); px(x + 12, y + 7, 2, 1, '#2a2030');
        if (p && p.status === 'ok' && state.stationDown <= 0 && frame % 30 < 15) px(x + 11, y + 2 + ((frame + p.id) % 3), 3, 1, '#ffffff');
      }
    }
    if (!p) return;
    p.shirt = p.shirt || '#f28fb1';
    if (p.status === 'ok' || p.status === 'egitim') person(x + 1, y + (kind === 'mola' ? 3 : 1), p, frame);
    emote(p, x + 2, y - 9, frame, state, kind === 'mola');
  }

  function room(rx, ry, rw, rh, r, members, cap, frame, state, pack) {
    const t = pack.rooms.types.find((x) => x.id === r.type);
    for (let y = 0; y < rh; y += 6) for (let x = 0; x < rw; x += 6) px(rx + x, ry + y, Math.min(6, rw - x), Math.min(6, rh - y), ((x + y) / 6) % 2 ? t.floor : shade(t.floor));
    px(rx, ry, rw, 2, '#2a2030'); px(rx, ry + rh - 2, rw, 2, '#2a2030'); px(rx, ry, 2, rh, '#2a2030'); px(rx + rw - 2, ry, 2, rh, '#2a2030');
    // tabela
    px(rx + 3, ry + 3, 9, 9, '#1b1426'); px(rx + 4, ry + 4, 7, 7, '#fff7fb'); icon(r.type, rx + 5, ry + 5, t.floor);
    // masalar: sığarsa ×2 çiz
    const inner = { x: rx + 4, y: ry + 13, w: rw - 8, h: rh - 15 };
    let z = 1, cols = 1, rows = 1;
    for (const zz of [2, 1]) {
      cols = Math.max(1, Math.floor(inner.w / (20 * zz))); rows = Math.max(1, Math.floor(inner.h / (22 * zz)));
      if (cols * rows >= cap || zz === 1) { z = zz; break; }
    }
    cols = Math.min(cols, cap); rows = Math.ceil(cap / cols);
    const ox = inner.x + (inner.w - cols * 20 * z) / 2, oy = inner.y + Math.max(0, (inner.h - rows * 22 * z) / 2);
    const monitor = state.stationDown > 0 ? '#4a4458' : MONITOR[state.stationTier];
    g.save(); g.translate(Math.round(ox), Math.round(oy)); g.scale(z, z);
    for (let i = 0; i < cap; i++) {
      const p = members[i];
      if (p) p.shirt = pack.staffGen.shirt[p.spec];
      desk((i % cols) * 20 + 1, Math.floor(i / cols) * 22 + 8, p, frame, state, monitor, r.type);
    }
    g.restore();
  }

  function emptySlot(rx, ry, rw, rh, frame) {
    for (let x = 0; x < rw; x += 4) { px(rx + x, ry, 2, 1, '#8f86a8'); px(rx + x, ry + rh - 1, 2, 1, '#8f86a8'); }
    for (let y = 0; y < rh; y += 4) { px(rx, ry + y, 1, 2, '#8f86a8'); px(rx + rw - 1, ry + y, 1, 2, '#8f86a8'); }
    if (frame % 80 < 50) { px(rx + rw / 2 - 3, ry + rh / 2, 7, 1, '#8f86a8'); px(rx + rw / 2, ry + rh / 2 - 3, 1, 7, '#8f86a8'); }
  }

  return function draw(state, pack, frame) {
    const ctx = { state, pack };
    const tier = state.office.tier;
    const month = Math.floor((state.week % 48) / 4);
    const kaos = state.kaos;
    const [t1, t2, t3] = pack.chaos.visualThresholds;
    seed = 7 + tier * 13 + (state.office.floors || 0) + state.rooms.length;

    // duvar ve pencereler (üst bant)
    const wallH = tier === 1 ? 56 : 30;
    px(0, 0, W, wallH, WALL[tier]);
    for (let x = 0; x < W; x += 16) px(x, 0, 1, wallH, TRIM[tier]);
    px(0, wallH - 3, W, 3, TRIM[tier]);
    px(0, wallH, W, H - wallH, '#3a3048');
    if (tier === 1) {
      px(8, 8, 60, 44, '#8a8296');
      for (let y = 10; y < 52; y += 6) px(10, y, 56, 4, '#9e97aa');
      px(190, 12, 40, 26, '#3a3048'); px(192, 14, 36, 22, SKY[month]);
      for (let y = 56; y < H; y += 8) for (let x = 0; x < W; x += 8) px(x, y, 8, 8, ((x + y) / 8) % 2 ? '#4a4458' : '#433d50');
    } else {
      const n = 4 + tier;
      for (let i = 0; i < n; i++) {
        const wx = 8 + i * Math.floor((W - 16) / n);
        px(wx, 5, 20, 18, '#3a3048'); px(wx + 2, 7, 16, 14, SKY[month]);
        if (month === 11 || month <= 1) for (let k = 0; k < 3; k++) px(wx + 3 + ((k * 7 + frame / 3) % 14), 7 + ((k * 11 + frame / 2) % 13), 1, 1, '#ffffff');
        else if (month >= 8 && month <= 10) for (let k = 0; k < 3; k++) px(wx + 3 + ((k * 5) % 14), 7 + ((k * 5 + frame) % 13), 1, 2, '#6f8fbf');
      }
    }
    if (kaos > t2) { px(120, 2, 1, 6, '#2a2030'); px(121, 7, 1, 5, '#2a2030'); px(119, 11, 1, 6, '#2a2030'); }

    // odalar
    if (tier === 1) {
      const r = state.rooms[0], p = membersOf(ctx, r)[0];
      if (p) p.shirt = pack.staffGen.shirt[p.spec];
      g.save(); g.translate(126, 70); g.scale(3, 3);
      desk(0, 0, p, frame, state, state.stationDown > 0 ? '#4a4458' : MONITOR[state.stationTier], 'gelistirme');
      g.restore();
    } else {
      const total = slots(ctx), cap = roomSeats(ctx);
      const cols = total <= 2 ? 2 : total <= 4 ? 2 : total <= 9 ? 3 : 4;
      const rows = Math.ceil(total / cols);
      const top = wallH + 2, gap = 2;
      const rw = Math.floor((W - 4 - gap * (cols - 1)) / cols), rh = Math.floor((H - top - 2 - gap * (rows - 1)) / rows);
      for (let i = 0; i < total; i++) {
        const x = 2 + (i % cols) * (rw + gap), y = top + Math.floor(i / cols) * (rh + gap);
        const r = state.rooms[i];
        if (r) room(x, y, rw, rh, r, membersOf(ctx, r), cap, frame, state, pack);
        else emptySlot(x, y, rw, rh, frame);
      }
    }

    // kedi
    if (state.flags.kedi) {
      const cx = 20 + ((frame / 4) % (W - 40)), cy = H - 8;
      px(cx, cy, 8, 4, '#f29a4a'); px(cx + 6, cy - 3, 4, 4, '#f29a4a'); px(cx + 6, cy - 4, 1, 1, '#f29a4a'); px(cx + 9, cy - 4, 1, 1, '#f29a4a'); px(cx - 2, cy - 2 + (frame % 20 < 10 ? 0 : 1), 2, 1, '#f29a4a');
    }
    // kaos: yerdeki kâğıtlar ve pizza kutuları
    if (kaos > t1) {
      const k = Math.floor((kaos - t1) / 4) + 3;
      for (let i = 0; i < k; i++) { const x = rnd() * (W - 8), y = wallH + 4 + rnd() * (H - wallH - 8); px(x, y, 4, 3, i % 3 ? '#f5f0e6' : '#d9a066'); }
    }
    if (kaos > t2 && (frame % 90 < 6 || (kaos > t3 && frame % 37 < 3))) { g.fillStyle = 'rgba(10,6,20,0.45)'; g.fillRect(0, 0, W, H); }
    if (kaos > t3) {
      const a = (Math.sin(frame / 6) + 1) / 2;
      g.fillStyle = `rgba(255,40,60,${0.08 + a * 0.12})`; g.fillRect(0, 0, W, H);
      px(W / 2 - 3, 1, 6, 3, a > 0.5 ? '#ff3b4f' : '#7a1f2a');
      for (let i = 0; i < 2; i++) { const fx = 40 + i * 140, fy = H - 12; px(fx, fy + 4, 6, 2, '#ff8a3d'); px(fx + 1, fy + 1 + (frame % 8 < 4 ? 0 : 1), 4, 4, '#ffd36f'); px(fx + 2, fy - 1, 2, 3, '#ff5a3d'); }
    }
    if (state.crunch) { g.fillStyle = 'rgba(30,20,80,0.18)'; g.fillRect(0, 0, W, H); }
  };
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * 0.88)).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}
