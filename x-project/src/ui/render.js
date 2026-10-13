// Piksel ofis sahnesi, 3/4 perspektif: arka duvar, kalın bölme duvarları, gölgeler, gün-gece ışığı,
// mobilya ve çalışanların kafasından yükselen puan baloncukları (GDT/Kairosoft esinli).
// Canvas boyutu dışarıdan ayarlanır (masaüstünde yatay, telefonda dikey); yerleşim her karede ona göre hesaplanır.
import { slots, roomSeats, membersOf, roomBusy } from '../systems/staff.js';

const WALL = { 1: ['#7a7288', '#665f75', '#8e86a0'], 2: ['#f4c4d0', '#dca2b4', '#fde0e8'], 3: ['#b4e8d4', '#8fcfb6', '#d4f6e8'], 4: ['#cfc2f6', '#ab9ce0', '#e4dcff'] };
const FLOOR = { 1: ['#55506a', '#4d4860'], 2: ['#b9835f', '#a97553'], 3: ['#cdb68f', '#bea781'], 4: ['#9a94b6', '#8d87a8'] };
const DISC_COLOR = { oyn: '#ff8fc7', gfx: '#7fd0f5', ses: '#c3a6ff', tek: '#8fe89a' };
const SCREEN = ['#8fbf7a', '#9cc4ea', '#a8ecff', '#d4b8ff', '#ffc4ec'];

const ICON = {
  heart: ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'], drop: ['..x..', '..x..', '.xxx.', 'xxxxx', '.xxx.'],
  skull: ['.xxx.', 'x.x.x', 'xxxxx', '.x.x.', '.x.x.'], cloud: ['.xx..', 'xxxx.', 'xxxxx', '.x.x.', 'x.x..'],
  fire: ['..x..', '.xx..', '.xxx.', 'xxxxx', '.xxx.'], zzz: ['xxxx.', '..x..', '.x...', 'xxxx.', '.....'],
  book: ['xxxx.', 'x..x.', 'xxxx.', 'x..x.', 'xxxx.'], plus: ['..x..', '..x..', 'xxxxx', '..x..', '..x..'],
  gelistirme: ['xxxxx', 'x...x', 'x...x', 'xxxxx', '.xxx.'], grafik: ['.xxx.', 'x.x.x', 'xxxxx', 'xx.xx', '.xxx.'],
  ses: ['..xxx', '..x.x', '..x..', 'xxx..', 'xxx..'], qa: ['x.x.x', '.xxx.', 'xxxxx', '.xxx.', 'x.x.x'],
  arastirma: ['.xxx.', '..x..', '.xxx.', 'xxxxx', 'xxxxx'], mola: ['.....', 'x...x', 'xxxxx', 'xxxxx', 'x...x'],
  donanim: ['x.x.x', 'xxxxx', 'xx.xx', 'xxxxx', 'x.x.x'],
};
const ICON_COLOR = { heart: '#ff6fa8', drop: '#5fb8ff', skull: '#5a4a6a', cloud: '#7a7a8f', fire: '#ff8a3d', zzz: '#8f86c9', book: '#d9a03f', plus: '#ff5a5a' };

const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const shade = (h, f) => mix(h, f < 1 ? '#000000' : '#ffffff', Math.abs(1 - f));

export function makeRenderer(canvas) {
  const g = canvas.getContext('2d');
  const bubbles = [];
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const icon = (name, x, y, color) => {
    const rows = ICON[name];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (rows[j][i] === 'x') px(x + i, y + j, 1, 1, color || ICON_COLOR[name]);
  };
  const shadow = (x, y, w, h) => { g.fillStyle = 'rgba(10,6,20,0.28)'; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, Math.PI * 2); g.fill(); };
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // --- Çalışan: masanın arkasında, izleyiciye dönük (yüz monitörün yanında görünür)
  function person(x, y, p, frame, sitting = true) {
    const blink = (frame + p.id * 13) % 180 < 4;
    const bob = sitting ? 0 : Math.round(Math.sin((frame + p.id * 9) / 10));
    // gövde
    px(x + 2, y + 9 + bob, 10, 7, p.shirt);
    px(x + 2, y + 9 + bob, 10, 1, shade(p.shirt, 1.15));
    px(x + 6, y + 10 + bob, 2, 3, shade(p.shirt, 0.85));
    // kafa
    px(x + 3, y + 1 + bob, 8, 8, p.look.skin);
    px(x + 3, y + 7 + bob, 8, 1, shade(p.look.skin, 0.9));
    px(x + 2, y + bob, 10, 3, p.look.hair);
    px(x + 2, y + 3 + bob, 2, 4, p.look.hair);
    px(x + 10, y + 3 + bob, 2, 2, p.look.hair);
    if (p.founder) { px(x + 3, y - 2 + bob, 8, 2, '#ffd36f'); px(x + 3, y - 3 + bob, 1, 1, '#ffd36f'); px(x + 6, y - 3 + bob, 2, 1, '#ffd36f'); px(x + 10, y - 3 + bob, 1, 1, '#ffd36f'); }
    // yüz
    if (p.status === 'tukenmis') { px(x + 5, y + 4 + bob, 1, 1, '#2a2030'); px(x + 8, y + 4 + bob, 1, 1, '#2a2030'); px(x + 5, y + 7 + bob, 4, 1, '#2a2030'); }
    else if (!blink) { px(x + 5, y + 4 + bob, 1, 2, '#2a2030'); px(x + 8, y + 4 + bob, 1, 2, '#2a2030'); }
    if (p.stress > 70) px(x + 10, y + 3 + bob, 1, 2, '#9fd8ff');
    if (p.morale > 60) { px(x + 6, y + 7 + bob, 2, 1, '#c24d6a'); px(x + 4, y + 6 + bob, 1, 1, '#f7a0b4'); px(x + 9, y + 6 + bob, 1, 1, '#f7a0b4'); }
    else if (p.morale < 30) px(x + 6, y + 7 + bob, 2, 1, '#5a4a6a');
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
    else if (p.morale > 85) e = 'heart';
    if (!e) return;
    const fl = Math.sin((frame + p.id * 7) / 8) > 0 ? 0 : 1;
    px(x - 1, y - 1 - fl, 9, 9, '#1b1426');
    px(x, y - fl, 7, 7, '#fff7fb');
    px(x + 2, y + 7 - fl, 2, 2, '#1b1426');
    icon(e, x + 1, y + 1 - fl);
  }

  // --- Mobilya (yerel koordinatlar; hücre 26×28)
  function workstation(x, y, p, frame, state, kind, busy, night) {
    shadow(x + 13, y + 26, 13, 3);
    px(x + 4, y + 5, 10, 11, '#3a3048'); // sandalye sırtı
    if (p && (p.status === 'ok' || p.status === 'egitim')) person(x + 2, y + 4, p, frame);
    // masa: üst yüzey + ön yüz
    const top = kind === 'donanim' ? '#9aa0b0' : '#c99a6e', front = kind === 'donanim' ? '#6e7484' : '#94673f';
    px(x, y + 16, 26, 4, top); px(x, y + 16, 26, 1, shade(top, 1.15));
    px(x, y + 20, 26, 5, front); px(x + 1, y + 25, 2, 2, shade(front, 0.7)); px(x + 23, y + 25, 2, 2, shade(front, 0.7));
    const screen = state.stationDown > 0 ? '#4a4458' : SCREEN[state.stationTier];
    if (kind === 'donanim') {
      px(x + 15, y + 12, 9, 4, '#3e7a52'); px(x + 16, y + 13, 2, 1, '#ffd36f'); px(x + 20, y + 13, 1, 2, '#ff6f6f');
      px(x + 3, y + 13, 2, 3, '#555'); px(x + 4, y + 10 + (frame % 40 < 20 ? 0 : 1), 5, 1, '#888');
    } else {
      // açılı monitör
      px(x + 16, y + 6, 9, 9, '#2a2030'); px(x + 17, y + 7, 6, 7, kind === 'grafik' ? '#ffd6ea' : kind === 'ses' ? '#d9c8ff' : screen);
      if (busy && p && p.status === 'ok' && frame % 24 < 12) px(x + 18, y + 8 + ((frame + p.id) % 4), 4, 1, '#ffffff');
      px(x + 19, y + 15, 3, 1, '#2a2030');
      if (night && p) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x + 20, y + 10, 1, x + 20, y + 10, 16); gr.addColorStop(0, 'rgba(120,180,255,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - 4, y - 6, 40, 34); g.restore(); }
      if (kind === 'ses') { px(x + 2, y + 14, 4, 2, '#2a2030'); px(x + 3, y + 13, 2, 1, '#c3a6ff'); }
      if (kind === 'grafik') { px(x + 2, y + 14, 7, 2, '#ffffff'); px(x + 3, y + 14, 2, 1, '#ff8fc7'); }
    }
    // klavye ve eller
    px(x + 7, y + 16, 8, 2, '#4a4058');
    if (p && p.status === 'ok') { const t = busy ? (frame + p.id) % 12 < 6 : true; px(x + 6, y + 15 + (t ? 0 : 1), 3, 2, p.look.skin); px(x + 12, y + 15 + (t ? 1 : 0), 3, 2, p.look.skin); }
  }
  function couch(x, y, p, frame) {
    shadow(x + 13, y + 26, 13, 3);
    px(x, y + 8, 26, 8, '#b85d82'); px(x, y + 8, 26, 1, '#d47aa0');
    if (p && p.status === 'ok') person(x + 6, y + 3, p, frame, false);
    px(x, y + 16, 26, 7, '#c76f8f'); px(x, y + 16, 26, 1, '#e08aaa'); px(x - 1, y + 11, 3, 12, '#a85a76'); px(x + 24, y + 11, 3, 12, '#a85a76');
  }

  // Oda arka duvarı süsü (oda tipine göre)
  function roomDecor(type, x, y, w, frame) {
    if (type === 'gelistirme') { px(x + 4, y + 2, 18, 9, '#f5f3ff'); px(x + 6, y + 4, 8, 1, '#ff8fc7'); px(x + 6, y + 6, 12, 1, '#8fd3f2'); px(x + 6, y + 8, 6, 1, '#8fe89a'); }
    if (type === 'grafik') { px(x + 4, y + 2, 10, 8, '#fff'); px(x + 5, y + 3, 8, 6, '#ffd6ea'); px(x + 7, y + 5, 3, 3, '#7fd0f5'); px(x + 16, y + 2, 8, 8, '#ffe39a'); }
    if (type === 'ses') { px(x + 4, y + 2, 5, 9, '#2a2030'); px(x + 5, y + 4, 3, 3, '#6a5a7a'); px(w + x - 9, y + 2, 5, 9, '#2a2030'); px(w + x - 8, y + 4, 3, 3, '#6a5a7a'); px(x + 12, y + 3, 10, 2, '#c3a6ff'); }
    if (type === 'qa') { px(x + 4, y + 2, 12, 9, '#fff3c4'); icon('qa', x + 7, y + 4, '#d9534f'); }
    if (type === 'arastirma') { px(x + 4, y + 1, 16, 10, '#7a5640'); for (let i = 0; i < 6; i++) px(x + 5 + i * 2.5, y + 2 + (i % 2), 2, 4, ['#ff8fc7', '#8fd3f2', '#ffd36f', '#8fe89a'][i % 4]); for (let i = 0; i < 6; i++) px(x + 5 + i * 2.5, y + 7, 2, 3, ['#c3a6ff', '#ff8a3d', '#8fd3f2'][i % 3]); }
    if (type === 'mola') { px(x + 4, y + 2, 14, 9, '#2a2030'); px(x + 5, y + 3, 12, 7, frame % 60 < 30 ? '#7fd0f5' : '#8fe89a'); px(w + x - 10, y + 1, 6, 10, '#3a7a52'); px(w + x - 9, y + 2, 4, 3, '#ffd36f'); }
    if (type === 'donanim') { px(x + 4, y + 2, 14, 8, '#3e7a52'); for (let i = 0; i < 4; i++) px(x + 6 + i * 3, y + 4, 1, 4, '#ffd36f'); px(x + 20, y + 3, 4, 7, '#888'); }
  }
  function plant(x, y) { shadow(x + 4, y + 13, 5, 2); px(x + 1, y + 8, 6, 5, '#b8683e'); px(x + 1, y + 8, 6, 1, '#d0804e'); px(x + 2, y + 2, 4, 6, '#4fa860'); px(x, y + 4, 3, 3, '#5fbf70'); px(x + 5, y + 3, 3, 4, '#3f9050'); }

  function room(rx, ry, rw, rh, r, members, cap, frame, state, pack, busy, night) {
    const t = pack.rooms.types.find((x) => x.id === r.type);
    const wallH = 13;
    // arka duvar (derinlik)
    px(rx, ry, rw, wallH, shade(t.floor, 1.35));
    px(rx, ry + wallH - 2, rw, 2, shade(t.floor, 0.7));
    roomDecor(r.type, rx + 3, ry + 1, rw - 6, frame);
    // tabela
    px(rx + rw - 13, ry + 2, 10, 9, '#1b1426'); px(rx + rw - 12, ry + 3, 8, 7, '#fff7fb'); icon(r.type, rx + rw - 11, ry + 4, t.floor);
    // zemin
    for (let y = wallH; y < rh; y += 6) for (let x = 0; x < rw; x += 12) px(rx + x, ry + y, Math.min(12, rw - x), Math.min(6, rh - y), ((y / 6 + x / 12) | 0) % 2 ? t.floor : shade(t.floor, 0.92));
    // duvar gölgesi zemine
    g.fillStyle = 'rgba(10,6,20,0.22)'; g.fillRect(rx, ry + wallH, rw, 3);
    // masalar
    const inner = { x: rx + 3, y: ry + wallH + 2, w: rw - 6, h: rh - wallH - 4 };
    let z = 1, cols = 1, rows = 1;
    for (const zz of [2, 1]) {
      cols = Math.max(1, Math.floor(inner.w / (28 * zz))); rows = Math.max(1, Math.floor(inner.h / (30 * zz)));
      if (cols * rows >= cap || zz === 1) { z = zz; break; }
    }
    cols = Math.min(cols, cap); rows = Math.ceil(cap / cols);
    const cw = Math.min(inner.w / cols, 34 * z), ch = Math.min(inner.h / rows, 32 * z);
    const ox = inner.x + (inner.w - cols * cw) / 2, oy = inner.y + Math.max(0, (inner.h - rows * ch) / 2);
    for (let i = 0; i < cap; i++) {
      const p = members[i];
      if (p) p.shirt = pack.staffGen.shirt[p.spec];
      const cx = ox + (i % cols) * cw + (cw - 26 * z) / 2, cy = oy + Math.floor(i / cols) * ch;
      g.save(); g.translate(Math.round(cx), Math.round(cy)); g.scale(z, z);
      if (r.type === 'mola') couch(0, 0, p, frame); else workstation(0, 0, p, frame, state, r.type, busy, night);
      g.restore();
      if (p) {
        emote(p, cx + 6 * z, cy - 8, frame, state, r.type === 'mola');
        if (busy && p.status === 'ok' && r.type !== 'mola' && (frame + p.id * 37) % Math.max(30, 110 - p.skill) === 0) spawnBubble(cx + 9 * z, cy, r, p, state, pack);
      }
    }
    if (rw > 60 && r.type !== 'mola') plant(rx + 2, ry + rh - 15);
    // bölme duvarları: kalın, üst yüz açık, yan yüz koyu
    px(rx - 2, ry - 2, rw + 4, 2, '#3a2f4c');
    px(rx - 2, ry, 2, rh, '#2a2238'); px(rx + rw, ry, 2, rh, '#2a2238');
    px(rx - 2, ry + rh, rw + 4, 3, '#4a3d60'); px(rx - 2, ry + rh + 3, rw + 4, 2, '#2a2238');
  }

  function spawnBubble(x, y, r, p, state, pack) {
    let disc = p.spec;
    if (r.type === 'grafik') disc = 'gfx';
    else if (r.type === 'ses') disc = 'ses';
    else if (r.type === 'qa' || r.type === 'arastirma' || r.type === 'donanim') disc = null;
    else {
      const pj = state.projects.find((x) => x.roomId === r.id || (r.mode === 'destek' && r.target === x.id));
      if (!pj || pj.status !== 'dev') { disc = null; } else {
      const ms = pack.missions.filter((m) => m.phase === pj.phase);
      disc = ms[(p.id + bubbles.length) % ms.length].disc;
      }
    }
    const bug = disc && (p.trait === 'hatamakinesi' || state.crunch) && bubbles.length % 4 === 0;
    const color = bug ? '#ff5a6e' : disc ? DISC_COLOR[disc] : r.type === 'arastirma' ? '#ffd36f' : r.type === 'qa' ? '#8ff0c4' : '#b0b0c8';
    bubbles.push({ x, y, color, bug, life: 70 });
    if (bubbles.length > 80) bubbles.shift();
  }
  function drawBubbles() {
    for (const b of bubbles) {
      b.life--; b.y -= 0.35; b.x += Math.sin(b.life / 8) * 0.15;
      if (b.life <= 0) continue;
      g.globalAlpha = Math.min(1, b.life / 25);
      px(b.x - 3, b.y - 2, 7, 5, b.color); px(b.x - 2, b.y - 3, 5, 7, b.color);
      px(b.x - 1, b.y - 2, 2, 1, '#ffffff');
      if (b.bug) { px(b.x - 1, b.y, 1, 1, '#2a2030'); px(b.x + 1, b.y, 1, 1, '#2a2030'); }
      g.globalAlpha = 1;
    }
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].life <= 0) bubbles.splice(i, 1);
  }

  function emptySlot(rx, ry, rw, rh, frame) {
    px(rx, ry, rw, rh, 'rgba(20,14,30,0.35)');
    for (let x = 0; x < rw; x += 6) { px(rx + x, ry, 3, 1, '#8f86a8'); px(rx + x, ry + rh - 1, 3, 1, '#8f86a8'); }
    for (let y = 0; y < rh; y += 6) { px(rx, ry + y, 1, 3, '#8f86a8'); px(rx + rw - 1, ry + y, 1, 3, '#8f86a8'); }
    if (frame % 80 < 50) { px(rx + rw / 2 - 4, ry + rh / 2, 9, 1, '#8f86a8'); px(rx + rw / 2, ry + rh / 2 - 4, 1, 9, '#8f86a8'); }
  }

  // Gün içi ışık döngüsü (yalnızca görsel): 0 gündüz … 1 gece
  const nightness = (frame) => { const t = (frame % 3600) / 3600; return Math.max(0, Math.min(1, (Math.cos(t * Math.PI * 2) * -1.4 + 0.2))); };

  return function draw(state, pack, frame) {
    const W = canvas.width, H = canvas.height;
    const ctx = { state, pack };
    const tier = state.office.tier;
    const kaos = state.kaos;
    const [t1, t2, t3] = pack.chaos.visualThresholds;
    const night = nightness(frame);
    seed = 7 + tier * 13 + (state.office.floors || 0) + state.rooms.length;
    const [wall, wallDark, wallLight] = WALL[tier];
    const wallH = Math.round(H * (tier === 1 ? 0.3 : 0.17));

    // arka duvar
    px(0, 0, W, wallH, wall);
    for (let x = 0; x < W; x += 20) px(x, 0, 1, wallH, shade(wall, 0.94));
    px(0, 0, W, 3, wallLight);
    px(0, wallH - 4, W, 4, wallDark);
    // pencereler
    const sky = night > 0.5 ? mix('#f5a97a', '#1e2250', (night - 0.5) * 2) : mix('#9fd3ff', '#f5a97a', night * 2);
    const nWin = Math.max(2, Math.floor(W / 64));
    for (let i = 0; i < nWin; i++) {
      const ww = tier === 1 ? 34 : 26, wh = Math.round(wallH * 0.55);
      const wx = Math.round((i + 0.5) * (W / nWin) - ww / 2), wy = Math.round(wallH * 0.18);
      if (tier === 1 && i === 0) { // garaj kapısı
        px(wx - 6, wy - 4, ww + 30, wallH - wy, '#8a8296'); for (let y = wy; y < wallH - 6; y += 5) px(wx - 4, y, ww + 26, 3, '#9e97aa');
        continue;
      }
      px(wx - 2, wy - 2, ww + 4, wh + 4, '#3a3048'); px(wx, wy, ww, wh, sky);
      if (night > 0.6) for (let k = 0; k < 3; k++) px(wx + 3 + ((k * 9 + i * 5) % (ww - 4)), wy + 2 + ((k * 7) % (wh - 4)), 1, 1, '#ffffff');
      else px(wx + 3, wy + 3, 6, 2, '#ffffff');
      px(wx + ww / 2 - 1, wy, 2, wh, '#3a3048'); px(wx - 3, wy + wh + 2, ww + 6, 2, wallLight);
    }
    // saat ve logo
    px(W - 22, 6, 12, 12, '#fff7fb'); px(W - 21, 7, 10, 10, '#f5f0e6'); px(W - 16, 9, 1, 4, '#2a2030'); px(W - 16, 12, 3, 1, '#2a2030');
    if (kaos > t2) { const cx = Math.round(W * 0.45); px(cx, 2, 1, 6, '#2a2030'); px(cx + 1, 7, 1, 5, '#2a2030'); px(cx - 1, 11, 1, 6, '#2a2030'); }
    // zemin
    const [f1, f2] = FLOOR[tier];
    for (let y = wallH; y < H; y += 8) for (let x = (y / 8) % 2 ? -12 : 0; x < W; x += 24) px(x, y, 24, 8, ((x / 24 + y / 8) | 0) % 3 ? f1 : f2);
    g.fillStyle = 'rgba(10,6,20,0.25)'; g.fillRect(0, wallH, W, 4);

    if (tier === 1) {
      // garaj: raflar, kutular, lamba, tek masa
      px(W - 70, wallH - 34, 40, 34, '#6a5040'); for (let i = 0; i < 3; i++) { px(W - 68, wallH - 32 + i * 11, 36, 2, '#8a6a52'); px(W - 66 + i * 9, wallH - 30 + i * 11, 7, 8, ['#d9a066', '#c3a6ff', '#8fd3f2'][i]); }
      shadow(40, H - 10, 18, 4); px(24, H - 30, 30, 20, '#c99a6e'); px(24, H - 30, 30, 2, '#ddb48a'); px(28, H - 26, 8, 6, '#b5865a'); px(40, H - 24, 10, 8, '#b5865a');
      const r = state.rooms[0], p = membersOf(ctx, r)[0];
      if (p) p.shirt = pack.staffGen.shirt[p.spec];
      const z = Math.max(2, Math.min(4, Math.floor(Math.min(W / 90, (H - wallH) / 40))));
      const cx = Math.round(W / 2 - 13 * z), cy = Math.round(wallH + (H - wallH - 30 * z) / 2);
      const busy = roomBusy(ctx, r);
      g.save(); g.translate(cx, cy); g.scale(z, z); workstation(0, 0, p, frame, state, 'gelistirme', busy, night > 0.4); g.restore();
      if (p) { emote(p, cx + 6 * z, cy - 10, frame, state, false); if (busy && p.status === 'ok' && frame % 50 === 0) spawnBubble(cx + 9 * z, cy, r, p, state, pack); }
      plant(W - 30, H - 26);
      // tavan lambası
      px(W / 2 - 1, 0, 2, wallH * 0.4, '#2a2030'); px(W / 2 - 6, wallH * 0.4, 12, 4, '#ffd36f');
    } else {
      const total = slots(ctx), cap = roomSeats(ctx);
      const portrait = H > W;
      const cols = portrait ? (total <= 2 ? 1 : 2) : total <= 2 ? 2 : total <= 4 ? 2 : total <= 9 ? 3 : 4;
      const rows = Math.ceil(total / cols);
      const top = wallH + 6, gap = 6;
      const rw = Math.floor((W - 8 - gap * (cols - 1)) / cols), rh = Math.floor((H - top - 6 - gap * (rows - 1)) / rows);
      for (let i = 0; i < total; i++) {
        const x = 4 + (i % cols) * (rw + gap), y = top + Math.floor(i / cols) * (rh + gap);
        const r = state.rooms[i];
        if (r) room(x, y, rw, rh, r, membersOf(ctx, r), cap, frame, state, pack, roomBusy(ctx, r), night > 0.4);
        else emptySlot(x, y, rw, rh, frame);
      }
    }

    // kedi
    if (state.flags.kedi) {
      const cx = 20 + ((frame / 3) % (W - 40)), cy = H - 8;
      shadow(cx + 5, cy + 4, 6, 1.5);
      px(cx, cy, 9, 4, '#f29a4a'); px(cx + 7, cy - 4, 5, 5, '#f29a4a'); px(cx + 7, cy - 5, 1, 1, '#f29a4a'); px(cx + 11, cy - 5, 1, 1, '#f29a4a'); px(cx + 9, cy - 3, 1, 1, '#2a2030'); px(cx - 2, cy - 2 + (frame % 20 < 10 ? 0 : 1), 2, 1, '#f29a4a');
    }
    // kaos: kâğıtlar ve pizza kutuları
    if (kaos > t1) {
      const k = Math.floor((kaos - t1) / 3) + 3;
      for (let i = 0; i < k; i++) { const x = rnd() * (W - 8), y = wallH + 6 + rnd() * (H - wallH - 10); px(x, y, 5, 3, i % 3 ? '#f5f0e6' : '#d9a066'); px(x, y + 3, 5, 1, 'rgba(10,6,20,0.25)'); }
    }
    drawBubbles();
    // gece karartması (monitör ışıkları zaten 'lighter' ile parlıyor)
    if (night > 0.05) { g.fillStyle = `rgba(18,12,48,${0.32 * night})`; g.fillRect(0, 0, W, H); }
    if (kaos > t2 && (frame % 90 < 6 || (kaos > t3 && frame % 37 < 3))) { g.fillStyle = 'rgba(10,6,20,0.45)'; g.fillRect(0, 0, W, H); }
    if (kaos > t3) {
      const a = (Math.sin(frame / 6) + 1) / 2;
      g.fillStyle = `rgba(255,40,60,${0.08 + a * 0.12})`; g.fillRect(0, 0, W, H);
      px(W / 2 - 4, 1, 8, 3, a > 0.5 ? '#ff3b4f' : '#7a1f2a');
      for (let i = 0; i < 2; i++) { const fx = W * 0.15 + i * W * 0.6, fy = H - 14; px(fx, fy + 4, 7, 2, '#ff8a3d'); px(fx + 1, fy + 1 + (frame % 8 < 4 ? 0 : 1), 5, 4, '#ffd36f'); px(fx + 2, fy - 2, 3, 3, '#ff5a3d'); }
    }
    if (state.crunch) { g.fillStyle = 'rgba(40,20,90,0.15)'; g.fillRect(0, 0, W, H); }
    // vinyet: derinlik hissi
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(8,4,16,0.35)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  };
}

// Menü simgeleri: 7×7 piksel haritaları, data URL'ye çevrilir.
const MENU = {
  gelistir: ['.......', '.xxxxx.', 'x.x...x', 'xxx.x.x', 'x.x...x', '.xxxxx.', '.......'],
  personel: ['..xxx..', '..xxx..', '...x...', '.xxxxx.', 'x.xxx.x', '..x.x..', '..x.x..'],
  ofis: ['...x...', '..xxx..', '.xxxxx.', 'xxxxxxx', '.x...x.', '.x.x.x.', '.xxxxx.'],
  arge: ['..xxx..', '...x...', '...x...', '..x.x..', '.x...x.', 'xxxxxxx', 'xxxxxxx'],
  pazar: ['......x', '.....x.', 'x...x..', '.x.x...', '..x....', '.......', 'xxxxxxx'],
  finans: ['..xxx..', '.x.x.x.', '.x.x...', '..xxx..', '...x.x.', '.x.x.x.', '..xxx..'],
  gunluk: ['.xxxxx.', 'x.....x', 'x.xxx.x', 'x.....x', 'x.xx..x', 'x.....x', '.xxxxx.'],
};
export function menuIcon(name, color = '#f3e9ff') {
  const c = document.createElement('canvas');
  c.width = 7; c.height = 7;
  const g = c.getContext('2d');
  g.fillStyle = color;
  MENU[name].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'x') g.fillRect(x, y, 1, 1); }));
  return c.toDataURL();
}
