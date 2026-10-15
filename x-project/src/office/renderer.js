import Phaser from 'phaser/dist/phaser.js';
import { CELL, ROOM_W, ROOM_H, DOOR, FURNITURE, buildingRooms, roomOrigin, dimensions, usePoint, findPath, canPlace, suggestFurniture } from '../systems/office.js';
import { roomBusy, slots } from '../systems/staff.js';
import { makeFurnitureTextures, characterTexture } from './assets.js';

// Phaser yalnız sahne/girdi/görsel saati yönetir. Haftalık üretimi mevcut game.js ilerletir.
export function makeOfficeRenderer(canvas, bridge, { type } = {}) {
  // Phaser mevcut canvas ile AUTO kabul etmez. Ayrı bir probla açık render türü seç.
  if (type == null) {
    let webgl = false;
    try { webgl = typeof window.WebGLRenderingContext !== 'undefined' && !!document.createElement('canvas').getContext('webgl'); } catch { /* Canvas geri dönüşü */ }
    type = webgl ? Phaser.WEBGL : Phaser.CANVAS;
  }
  let scene = null;
  class OfficeScene extends Phaser.Scene {
    constructor() { super('office'); }
    create() {
      scene = this;
      this.worldObjects = []; this.workers = new Map(); this.furniture = [];
      this.draft = null; this.roomId = null; this.signature = null; this.elapsed = 0;
      this.cameraPositions = new Map(); this.building = null; this.ready = true;
      makeFurnitureTextures(this);
      this.overlay = this.add.graphics().setDepth(100000);
      this.input.on('pointerdown', (p) => this.pointerDown(p));
      this.input.on('pointermove', (p) => this.pointerMove(p));
      this.input.on('pointerup', (p) => this.pointerUp(p));
      this.input.on('pointerupoutside', () => { this.gesture = null; });
      this.input.on('wheel', (_p, _over, _dx, dy) => this.zoomBy(dy > 0 ? 0.9 : 1.1));
      this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      this.events.once('shutdown', () => { this.workers.clear(); scene = null; });
      bridge.onReady?.();
    }
    view() { return bridge.view(); }
    update(_time, delta) {
      const view = this.view();
      if (!view.game) { this.cameras.main.setVisible(false); return; }
      this.cameras.main.setVisible(true);
      const { state } = view.game;
      const sig = `${state.seed}:${state.officeWorld.revision}:${view.building}:${state.office.tier}`;
      if (this.lastState !== state || this.signature !== sig) {
        const newCareer = this.lastState !== state;
        this.lastState = state; this.signature = sig;
        if (newCareer) {
          this.cameraPositions.clear(); this.building = null; this.draft = null;
          for (const a of this.workers.values()) this.destroyWorker(a);
          this.workers.clear();
        }
        this.rebuild(view);
      }
      const dt = view.paused ? 0 : Math.min(delta, 100) / 1000 * view.speed;
      this.elapsed += dt;
      this.syncWorkers(view);
      for (const actor of this.workers.values()) this.walk(actor, dt, view);
      this.drawOverlay(view);
    }
    keep(obj) { this.worldObjects.push(obj); return obj; }
    text(x, y, text, size = 14, color = '#40505b') {
      return this.keep(this.add.text(x, y, text, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: `${size}px`, color, fontStyle: 'bold', padding: { x: 2, y: 2 } }).setDepth(y + 1));
    }
    rebuild(view) {
      for (const obj of this.worldObjects) obj.destroy();
      this.worldObjects = []; this.furniture = [];
      const { state, pack } = view.game;
      this.rooms = buildingRooms(state, view.building);
      const changedBuilding = this.building !== view.building;
      if (changedBuilding && this.building) {
        const c = this.cameras.main;
        this.cameraPositions.set(this.building, { x: c.midPoint.x, y: c.midPoint.y, zoom: c.zoom });
      }
      if (changedBuilding) { this.draft = null; this.roomId = this.rooms[0]?.roomId ?? null; }
      if (!this.rooms.some((r) => r.roomId === this.roomId)) { this.roomId = this.rooms[0]?.roomId ?? null; this.draft = null; }
      this.building = view.building;
      let right = ROOM_W + 2, bottom = ROOM_H + 4;
      const floor = this.keep(this.add.graphics().setDepth(-10));
      for (const room of this.rooms) {
        const origin = roomOrigin(room), x = origin.x * CELL, y = origin.y * CELL;
        right = Math.max(right, origin.x + ROOM_W + 1); bottom = Math.max(bottom, origin.y + ROOM_H + 2);
        const model = state.rooms.find((r) => r.id === room.roomId), type = pack.rooms.types.find((t) => t.id === model.type);
        floor.fillStyle(0x23313c, 0.16); floor.fillRoundedRect(x + 7, y + 7, ROOM_W * CELL, ROOM_H * CELL, 4);
        for (let row = 0; row < ROOM_H; row++) for (let col = 0; col < ROOM_W; col++) {
          const wall = row === 0 || row === ROOM_H - 1 || col === 0 || col === ROOM_W - 1;
          const door = row === ROOM_H - 1 && col === DOOR.x;
          floor.fillStyle(wall && !door ? 0xe6d7b7 : (row + col) % 2 ? 0xd2b68f : 0xdac29f);
          floor.fillRect(x + col * CELL, y + row * CELL, CELL - 1, CELL - 1);
          if (row === 0) { floor.fillStyle(0xb6aa92); floor.fillRect(x + col * CELL, y + CELL - 6, CELL, 5); }
        }
        floor.fillStyle(0xf2e7cc); floor.fillRect(x, y - 20, ROOM_W * CELL, 20);
        for (const wx of [2, 7]) {
          floor.fillStyle(0x8bb6bd); floor.fillRect(x + wx * CELL, y - 16, 60, 38);
          floor.fillStyle(0xdce8d9); floor.fillRect(x + wx * CELL + 4, y - 12, 23, 29);
          floor.fillRect(x + wx * CELL + 32, y - 12, 23, 29);
        }
        this.text(x + 7, y - 46, `${type.name} · ${state.staff.filter((p) => p.room === room.roomId).length}/${room.capacity}`);
        this.text(x + DOOR.x * CELL - 3, y + (ROOM_H - 1) * CELL + 4, 'GİRİŞ', 9, '#897656');
        for (const item of room.items) {
          const { w, h } = dimensions(item), px = (origin.x + item.x + w / 2) * CELL, py = (origin.y + item.y + h) * CELL;
          if (item.type === 'desk') {
            const seat = usePoint(item);
            this.keep(this.add.image((origin.x + seat.x + 0.5) * CELL, (origin.y + seat.y + 1) * CELL, 'chair').setOrigin(0.5, 1).setDepth((origin.y + seat.y + 1) * CELL - 2));
          }
          const image = this.keep(this.add.image(px, py + 4, `${item.type}-${item.rotation}`).setOrigin(0.5, 1).setDepth(py));
          this.furniture.push({ room, item, image });
        }
      }
      this.worldBounds = { width: right * CELL, height: bottom * CELL };
      this.cameras.main.setBackgroundColor('#e8e1cf');
      if (!this.rooms.length) this.text(64, 160, 'Bu binada henüz oda yok.\nOda kurmak için boş alana dokun.', 18);
      const spare = slots(view.game.ctx) - state.rooms.length;
      this.buildSign = this.text(40, bottom * CELL - 20, spare > 0 ? '+ ODA KUR' : 'OFİSİ BÜYÜT', 13, '#587880');
      this.buildSign.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (!this.view().blocked && !this.view().editing) bridge.onHit({ kind: spare > 0 ? 'slot' : 'locked', building: this.building });
      });
      for (const actor of this.workers.values()) { actor.path = null; actor.wait = 0; }
      if (changedBuilding) {
        const saved = this.cameraPositions.get(view.building);
        if (saved) { this.cameras.main.setZoom(saved.zoom); this.cameras.main.centerOn(saved.x, saved.y); }
        else this.fitCamera();
      }
      this.notify();
    }
    fitCamera() {
      if (!this.worldBounds) return;
      const c = this.cameras.main, b = this.worldBounds;
      c.setZoom(Math.max(0.12, Math.min(1.5, (c.width - 20) / b.width, Math.max(60, c.height - 80) / b.height)));
      c.centerOn(b.width / 2, b.height / 2);
    }
    zoomBy(factor) {
      if (!this.view().game || this.view().blocked) return;
      const c = this.cameras.main;
      c.setZoom(Phaser.Math.Clamp(c.zoom * factor, 0.18, 2.8));
    }
    syncWorkers(view) {
      const { state, pack } = view.game, present = new Set();
      for (const room of this.rooms) {
        const model = state.rooms.find((r) => r.id === room.roomId);
        const seats = room.items.filter((f) => f.type === (model.type === 'mola' ? 'sofa' : 'desk'));
        state.staff.filter((p) => p.room === room.roomId && ['ok', 'egitim'].includes(p.status)).forEach((p, index) => {
          present.add(p.id);
          let actor = this.workers.get(p.id);
          if (actor && actor.roomId !== room.roomId) { this.destroyWorker(actor); this.workers.delete(p.id); actor = null; }
          const tex = characterTexture(this, p, pack), o = roomOrigin(room);
          if (!actor) {
            actor = { id: p.id, roomId: room.roomId, x: DOOR.x, y: DOOR.y, path: null, wait: 0, mode: 'work' };
            actor.shadow = this.add.ellipse(0, 0, 22, 8, 0x24323c, 0.15);
            actor.sprite = this.add.sprite(0, 0, tex, 0).setOrigin(0.5, 1);
            actor.status = this.add.text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '13px', color: '#5a6172', backgroundColor: '#fff8e5', padding: { x: 3, y: 2 } }).setOrigin(0.5, 1);
            this.workers.set(p.id, actor);
          }
          if (actor.sprite.texture.key !== tex) actor.sprite.setTexture(tex, 0);
          actor.person = p; actor.room = room; actor.origin = o; actor.seat = seats[index];
          actor.busy = roomBusy(view.game.ctx, model); actor.resting = model.type === 'mola';
        });
      }
      for (const [id, actor] of this.workers) if (!present.has(id)) { this.destroyWorker(actor); this.workers.delete(id); }
    }
    destroyWorker(actor) { actor.sprite.destroy(); actor.shadow.destroy(); actor.status.destroy(); }
    walk(actor, dt, view) {
      const room = actor.room;
      if (!actor.path && dt && actor.seat) {
        const start = { x: Math.round(actor.x), y: Math.round(actor.y) };
        const goal = usePoint(actor.seat);
        actor.path = findPath(room, start, goal) || findPath(room, DOOR, goal) || [];
        if (actor.path.length && (start.x !== actor.path[0].x || start.y !== actor.path[0].y)) { actor.x = DOOR.x; actor.y = DOOR.y; }
        actor.path.shift();
      }
      let budget = dt * 2.2;
      const moving = !!actor.path?.length;
      while (budget > 0 && actor.path?.length) {
        const target = actor.path[0], dx = target.x - actor.x, dy = target.y - actor.y, distance = Math.hypot(dx, dy);
        if (distance <= budget) { actor.x = target.x; actor.y = target.y; actor.path.shift(); budget -= distance; }
        else { actor.x += dx / distance * budget; actor.y += dy / distance * budget; budget = 0; }
        if (dx) actor.sprite.setFlipX(dx < 0);
      }
      if (dt && actor.path && !actor.path.length) {
        actor.wait += dt;
        if (actor.wait > 16 + actor.id % 13) {
          const coffee = room.items.find((f) => f.type === 'coffee');
          const destination = actor.mode === 'break' || !coffee ? actor.seat : coffee;
          if (destination) actor.path = findPath(room, { x: Math.round(actor.x), y: Math.round(actor.y) }, usePoint(destination))?.slice(1) || [];
          actor.mode = actor.mode === 'break' ? 'work' : 'break'; actor.wait = 0;
        }
      }
      const x = (actor.origin.x + actor.x + 0.5) * CELL, y = (actor.origin.y + actor.y + 1) * CELL;
      actor.sprite.setPosition(x, y).setDepth(y + 1);
      // Görsel saat delta süresine ve oyun hızına bağlı; duraklatınca kare değişmez.
      actor.sprite.setFrame(moving ? Math.floor(this.elapsed * 6 + actor.id) % 4 : Math.floor(this.elapsed / 3 + actor.id) % 2 * 2);
      actor.shadow.setPosition(x, y - 2).setDepth(y - 3);
      const badge = actor.resting || actor.mode === 'break' ? '☕' : actor.person.stress > 75 ? '!' : actor.busy ? '···' : '';
      actor.status.setText(badge).setPosition(x, y - 44).setDepth(y + 2).setVisible(!!badge);
    }
    position(pointer) { return this.cameras.main.getWorldPoint(pointer.x, pointer.y); }
    roomAt(point) {
      return this.rooms.find((r) => { const o = roomOrigin(r); return point.x >= o.x * CELL && point.x < (o.x + ROOM_W) * CELL && point.y >= o.y * CELL && point.y < (o.y + ROOM_H) * CELL; });
    }
    itemAt(point) {
      return [...this.furniture].sort((a, b) => b.image.depth - a.image.depth).find((f) => f.image.getBounds().contains(point.x, point.y));
    }
    pointerDown(p) {
      const view = this.view();
      if (!view.game || view.blocked) return;
      const pos = this.position(p), room = this.roomAt(pos);
      this.gesture = { x: p.x, y: p.y, lastX: p.x, lastY: p.y, moved: false, item: null };
      if (view.editing && room) {
        if (this.roomId !== room.roomId) { this.draft = null; this.roomId = room.roomId; }
        const hit = this.itemAt(pos);
        if (hit) { this.draft = { ...hit.item }; this.gesture.item = hit.item.id; }
        else if (this.draft) { this.gesture.item = this.draft.id || 'new'; this.pointerMove(p); }
        this.notify();
      }
    }
    pointerMove(p) {
      const view = this.view(), gesture = this.gesture;
      if (!gesture || !p.isDown || view.blocked) return;
      if (Math.hypot(p.x - gesture.x, p.y - gesture.y) > 6) gesture.moved = true;
      if (gesture.item && this.draft) {
        const room = this.rooms.find((r) => r.roomId === this.roomId), o = roomOrigin(room), point = this.position(p), size = dimensions(this.draft);
        this.draft.x = Math.floor(point.x / CELL - o.x - size.w / 2 + 0.5);
        this.draft.y = Math.floor(point.y / CELL - o.y - size.h / 2 + 0.5);
        this.notify();
      } else if (gesture.moved) {
        const c = this.cameras.main;
        c.scrollX -= (p.x - gesture.lastX) / c.zoom; c.scrollY -= (p.y - gesture.lastY) / c.zoom;
      }
      gesture.lastX = p.x; gesture.lastY = p.y;
    }
    pointerUp(p) {
      const gesture = this.gesture; this.gesture = null;
      const view = this.view();
      if (!gesture || gesture.moved || view.blocked || view.editing) return;
      const point = this.position(p);
      const person = [...this.workers.values()].sort((a, b) => b.sprite.depth - a.sprite.depth).find((a) => a.sprite.getBounds().contains(point.x, point.y));
      if (person) return bridge.onHit({ kind: person.person.founder ? 'boss' : 'person', id: person.id, room: person.roomId });
      const room = this.roomAt(point);
      if (room) return bridge.onHit({ kind: 'room', id: room.roomId });
      if (!this.rooms.length) bridge.onHit({ kind: 'slot', building: view.building });
    }
    drawOverlay(view) {
      this.overlay.clear();
      for (const f of this.furniture) f.image.setAlpha(this.draft?.id === f.item.id ? 0.3 : 1);
      if (this.ghost) this.ghost.setVisible(false);
      if (!view.editing) return;
      const room = this.rooms.find((r) => r.roomId === this.roomId);
      if (!room) return;
      const o = roomOrigin(room), g = this.overlay;
      g.lineStyle(1, 0xffffff, 0.28);
      for (let x = 1; x < ROOM_W; x++) g.lineBetween((o.x + x) * CELL, (o.y + 1) * CELL, (o.x + x) * CELL, (o.y + ROOM_H - 1) * CELL);
      for (let y = 1; y < ROOM_H; y++) g.lineBetween((o.x + 1) * CELL, (o.y + y) * CELL, (o.x + ROOM_W - 1) * CELL, (o.y + y) * CELL);
      if (this.draft) {
        const { w, h } = dimensions(this.draft), x = (o.x + this.draft.x) * CELL, y = (o.y + this.draft.y) * CELL;
        const valid = canPlace(room, this.draft).ok, color = valid ? 0x438967 : 0xc35752;
        g.fillStyle(color, 0.35); g.fillRect(x, y, w * CELL, h * CELL);
        g.lineStyle(2, color, 1); g.strokeRect(x, y, w * CELL, h * CELL);
        if (!this.ghost) this.ghost = this.add.image(0, 0, `${this.draft.type}-${this.draft.rotation}`).setOrigin(0.5, 1).setDepth(99999).setAlpha(0.75);
        this.ghost.setTexture(`${this.draft.type}-${this.draft.rotation}`).setPosition(x + w * CELL / 2, y + h * CELL + 4).setVisible(true);
      }
    }
    notify() {
      const room = this.rooms?.find((r) => r.roomId === this.roomId);
      const valid = this.draft && room ? canPlace(room, this.draft) : null;
      const info = { roomId: this.roomId, draft: this.draft ? { ...this.draft } : null, valid, rooms: this.rooms || [] };
      const sig = JSON.stringify([info.roomId, info.draft, valid, info.rooms.map((r) => r.roomId)]);
      if (sig !== this.editSignature) { this.editSignature = sig; bridge.onEditChange?.(info); }
      return info;
    }
    action(action, value) {
      if (!this.view().editing) return;
      const { game } = this.view();
      if (action === 'room') { this.roomId = +value; this.draft = null; const r = this.rooms.find((x) => x.roomId === this.roomId); if (r) { const o = roomOrigin(r); this.cameras.main.centerOn((o.x + ROOM_W / 2) * CELL, (o.y + ROOM_H / 2) * CELL); } }
      if (action === 'add') {
        const item = suggestFurniture(game.ctx, this.roomId, value);
        if (!item) return bridge.onMessage('Bu odada bu eşya için uygun boşluk yok.');
        this.draft = item;
      }
      if (action === 'rotate' && this.draft) this.draft.rotation = (this.draft.rotation + 1) % 4;
      if (action === 'cancel') this.draft = null;
      if (action === 'confirm' && this.draft) { const res = bridge.onPlace(this.roomId, this.draft); if (res.ok) this.draft = null; }
      if (action === 'remove' && this.draft?.id) { const res = bridge.onRemove(this.roomId, this.draft.id); if (res.ok) this.draft = null; }
      this.notify();
    }
  }
  const game = new Phaser.Game({
    type, canvas, width: 800, height: 600, backgroundColor: '#e8e1cf',
    render: { pixelArt: true, antialias: false, roundPixels: true },
    audio: { noAudio: true }, input: { activePointers: 2 },
    scale: { mode: Phaser.Scale.NONE }, scene: OfficeScene,
    banner: false, fps: { target: 60 },
  });
  return {
    game,
    resize(w, h) { if (w > 0 && h > 0) { game.scale.resize(Math.round(w), Math.round(h)); scene?.fitCamera(); } },
    action: (action, value) => scene?.action(action, value),
    setEditing() { if (scene) { scene.draft = null; scene.notify(); } },
    zoom: (factor) => scene?.zoomBy(factor),
    fit: () => scene?.fitCamera(),
    destroy: () => game.destroy(false),
    // Başsız entegrasyon testinin sahnenin hazır olmasını gözlemesine izin verir.
    getScene: () => scene,
  };
}
