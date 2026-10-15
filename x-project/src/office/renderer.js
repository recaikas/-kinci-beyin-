import Phaser from 'phaser/dist/phaser.js';
import * as Office from '../systems/office.js';
const { CELL, FURNITURE, buildingRooms, roomOrigin, dimensions, usePoint, suggestFurniture, sizeOf, doorOf, globalPoint, worldPath } = Office;
import { roomBusy } from '../systems/staff.js';
import { makeFurnitureTextures, characterTexture, computerTexture } from './assets.js';

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
      this.draft = null; this.roomDraft = null; this.roomId = null; this.signature = null; this.elapsed = 0;
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
      if (changedBuilding) { this.draft = null; this.roomDraft = null; this.roomId = this.rooms.some((r) => r.roomId === this.requestedRoom) ? this.requestedRoom : this.rooms[0]?.roomId ?? null; this.requestedRoom = null; }
      if (!this.rooms.some((r) => r.roomId === this.roomId)) { this.roomId = this.rooms[0]?.roomId ?? null; this.draft = null; }
      this.building = view.building;
      const plot = Office.plotSize(state, view.building); let right = plot.w, bottom = plot.h;
      const floor = this.keep(this.add.graphics().setDepth(-10));
      for (const room of this.rooms) {
        const origin = roomOrigin(room), x = origin.x * CELL, y = origin.y * CELL, { w: rw, h: rh } = sizeOf(room), door = doorOf(room);
        right = Math.max(right, origin.x + rw + 1); bottom = Math.max(bottom, origin.y + rh + 2);
        const model = state.rooms.find((r) => r.id === room.roomId), type = pack.rooms.types.find((t) => t.id === model.type);
        floor.fillStyle(0x23313c, 0.16); floor.fillRoundedRect(x + 7, y + 7, rw * CELL, rh * CELL, 4);
        for (let row = 0; row < rh; row++) for (let col = 0; col < rw; col++) {
          const wall = row === 0 || row === rh - 1 || col === 0 || col === rw - 1;
          const isDoor = row === rh - 1 && col === door.x;
          floor.fillStyle(wall && !isDoor ? 0xe6d7b7 : room.floor === 'tile' ? ((row + col) % 2 ? 0xc5d5ce : 0xdce4d9) : room.floor === 'carpet' ? ((row + col) % 2 ? 0x92a4a0 : 0x9daea7) : (row + col) % 2 ? 0xd2b68f : 0xdac29f);
          floor.fillRect(x + col * CELL, y + row * CELL, CELL - 1, CELL - 1);
          if (row === 0) { floor.fillStyle(0xb6aa92); floor.fillRect(x + col * CELL, y + CELL - 6, CELL, 5); }
        }
        floor.fillStyle(0xf2e7cc); floor.fillRect(x, y - 20, rw * CELL, 20);
        for (const wx of [2, ...(rw > 9 ? [7] : [])]) {
          floor.fillStyle(0x8bb6bd); floor.fillRect(x + wx * CELL, y - 16, 60, 38);
          floor.fillStyle(0xdce8d9); floor.fillRect(x + wx * CELL + 4, y - 12, 23, 29);
          floor.fillRect(x + wx * CELL + 32, y - 12, 23, 29);
        }
        const capacity = Office.capacity(view.game.ctx, model);
        const usage = model.type === 'tuvalet' ? `${room.items.filter((f) => f.type === 'toilet').length} klozet` : model.type === 'mola' ? `${capacity} dinlenme yeri` : `${state.staff.filter((p) => p.room === room.roomId).length}/${capacity}`;
        this.text(x + 7, y - 46, `${type.name} · ${usage}`);
        this.text(x + door.x * CELL - 3, y + (rh - 1) * CELL + 4, 'GİRİŞ', 9, '#897656');
        for (const item of room.items) {
          const { w, h } = dimensions(item), px = (origin.x + item.x + w / 2) * CELL, py = (origin.y + item.y + h) * CELL;
          const image = this.keep(this.add.image(px, py + 4, `${item.type}-${item.rotation}`).setOrigin(0.5, 1).setDepth(py));
          if (item.computer) {
            const pcKey = computerTexture(this, item.computer);
            if (pcKey) this.keep(this.add.image(px + (item.rotation % 2 ? 0 : 10), py - 17, pcKey).setOrigin(0.5, 1).setDepth(py + 0.2));
          }
          this.furniture.push({ room, item, image });
        }
      }
      this.worldBounds = { width: right * CELL, height: bottom * CELL };
      const shown = this.rooms.length ? this.rooms : [{ x: 1, y: 2, w: 12, h: 12 }];
      this.viewBounds = { width: Math.max(...shown.map((r) => roomOrigin(r).x + sizeOf(r).w + 2)) * CELL, height: Math.max(...shown.map((r) => roomOrigin(r).y + sizeOf(r).h + 2)) * CELL };
      if (this.roomDraft) this.viewBounds = this.worldBounds;
      this.cameras.main.setBackgroundColor('#e8e1cf');
      if (!this.rooms.length) this.text(64, 160, 'Bu binada henüz oda yok.\nOda kurmak için boş alana dokun.', 18);
      const spare = Office.roomSite(view.game.ctx, 'mola', { building: view.building, w: 6, h: 6 }).ok ? 1 : 0;
      this.buildSign = this.text(40, this.viewBounds.height - 20, spare > 0 ? '+ ODA KUR' : 'OFİSİ BÜYÜT', 13, '#587880');
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
      const c = this.cameras.main, b = this.roomDraft ? this.worldBounds : this.viewBounds;
      c.setZoom(Math.max(0.12, Math.min(1.5, (c.width - 20) / b.width, Math.max(60, c.height - 80) / b.height)));
      c.centerOn(b.width / 2, b.height / 2);
    }
    zoomBy(factor) {
      if (!this.view().game || this.view().blocked) return;
      const c = this.cameras.main;
      c.setZoom(Phaser.Math.Clamp(c.zoom * factor, 0.18, 2.8));
    }
    syncWorkers(view) {
      const { state, pack, ctx } = view.game, present = new Set();
      for (const room of this.rooms) {
        const model = state.rooms.find((r) => r.id === room.roomId);
        state.staff.filter((p) => p.room === room.roomId && ['ok', 'egitim'].includes(p.status)).forEach((p) => {
          present.add(p.id);
          let actor = this.workers.get(p.id);
          if (actor && actor.roomId !== room.roomId) { this.destroyWorker(actor); this.workers.delete(p.id); actor = null; }
          const tex = characterTexture(this, p, pack), entry = globalPoint(room, doorOf(room));
          if (!actor) {
            actor = { id: p.id, roomId: room.roomId, x: entry.x, y: entry.y, path: null, wait: 0, mode: 'work', visit: 0 };
            actor.shadow = this.add.ellipse(0, 0, 22, 8, 0x24323c, 0.15);
            actor.sprite = this.add.sprite(0, 0, tex, 0).setOrigin(0.5, 1);
            actor.status = this.add.text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '12px', color: '#5a6172', backgroundColor: '#fff8e5', padding: { x: 3, y: 2 } }).setOrigin(0.5, 1);
            this.workers.set(p.id, actor);
          }
          if (actor.sprite.texture.key !== tex) actor.sprite.setTexture(tex, 0);
          actor.person = p; actor.room = room; actor.report = Office.workReport(ctx, p); actor.seat = actor.report.station?.desk;
          actor.busy = roomBusy(ctx, model); actor.resting = model.type === 'mola';
        });
      }
      for (const [id, actor] of this.workers) if (!present.has(id)) { this.destroyWorker(actor); this.workers.delete(id); }
    }
    destroyWorker(actor) { actor.sprite.destroy(); actor.shadow.destroy(); actor.status.destroy(); }
    walk(actor, dt, view) {
      const home = actor.report.station ? globalPoint(actor.room, actor.report.station.point) : globalPoint(actor.room, doorOf(actor.room));
      if (!actor.path && dt) {
        const start = { x: Math.round(actor.x), y: Math.round(actor.y) };
        actor.path = worldPath(view.game.state, this.building, start, home)?.slice(1) || [];
        actor.mode = 'work';
      }
      let budget = dt * 2.2; const moving = !!actor.path?.length;
      while (budget > 0 && actor.path?.length) {
        const target = actor.path[0], dx = target.x - actor.x, dy = target.y - actor.y, d = Math.hypot(dx, dy);
        if (d <= budget) { actor.x = target.x; actor.y = target.y; actor.path.shift(); budget -= d; }
        else { actor.x += dx / d * budget; actor.y += dy / d * budget; budget = 0; }
        if (dx) actor.sprite.setFlipX(dx < 0);
      }
      if (dt && actor.path && !actor.path.length) {
        actor.wait += dt;
        if (actor.wait > (actor.mode === 'work' ? 18 + actor.id % 11 : 4)) {
          const visits = actor.report.visits.filter((v) => v.building === this.building);
          const visit = actor.mode === 'work' ? visits[actor.visit++ % Math.max(1, visits.length)] : null;
          const destination = visit?.point || home;
          actor.path = worldPath(view.game.state, this.building, { x: Math.round(actor.x), y: Math.round(actor.y) }, destination)?.slice(1) || [];
          actor.mode = visit?.kind || 'work'; actor.wait = 0;
        }
      }
      const x = (actor.x + 0.5) * CELL, y = (actor.y + 1) * CELL;
      const privateVisit = actor.mode === 'Tuvalet' && !actor.path?.length;
      actor.sprite.setPosition(x, y).setDepth(y + 1).setVisible(!privateVisit);
      if (dt) actor.sprite.setFrame(moving ? Math.floor(this.elapsed * 6 + actor.id) % 4 : Math.floor(this.elapsed / 3 + actor.id) % 2 * 2);
      actor.shadow.setPosition(x, y - 2).setDepth(y - 3).setVisible(!privateVisit);
      const badge = !actor.seat ? 'Çalışma yeri yok' : actor.mode !== 'work' ? actor.mode : actor.person.stress > 75 ? '!' : actor.busy ? '···' : '';
      actor.status.setText(badge).setPosition(x, y - 44).setDepth(y + 2).setVisible(!!badge && !privateVisit);
    }
    position(pointer) { return this.cameras.main.getWorldPoint(pointer.x, pointer.y); }
    roomAt(point) {
      return this.rooms.find((r) => { const o = roomOrigin(r), d = sizeOf(r); return point.x >= o.x * CELL && point.x < (o.x + d.w) * CELL && point.y >= o.y * CELL && point.y < (o.y + d.h) * CELL; });
    }
    itemAt(point) {
      const ordered = [...this.furniture].sort((a, b) => b.image.depth - a.image.depth);
      return ordered.find((f) => { const o = roomOrigin(f.room), s = dimensions(f.item); return point.x >= (o.x + f.item.x) * CELL && point.x < (o.x + f.item.x + s.w) * CELL && point.y >= (o.y + f.item.y) * CELL && point.y < (o.y + f.item.y + s.h) * CELL; }) || ordered.find((f) => f.image.getBounds().contains(point.x, point.y));
    }
    pointerDown(p) {
      const view = this.view();
      if (!view.game || view.blocked) return;
      const pos = this.position(p), room = this.roomAt(pos);
      this.gesture = { x: p.x, y: p.y, lastX: p.x, lastY: p.y, moved: false, item: null };
      if (view.editing && this.roomDraft) { this.gesture.room = true; this.pointerMove(p); return; }
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
      if (gesture.room && this.roomDraft) {
        const point = this.position(p); this.roomDraft.x = Math.round(point.x / CELL - this.roomDraft.w / 2); this.roomDraft.y = Math.round(point.y / CELL - this.roomDraft.h / 2); this.notify();
      } else if (gesture.item && this.draft) {
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
      bridge.onHit({ kind: 'slot', building: view.building });
    }
    drawOverlay(view) {
      const g = this.overlay; g.clear();
      for (const f of this.furniture) f.image.setAlpha(this.draft?.id === f.item.id ? 0.3 : 1);
      if (this.ghost) this.ghost.setVisible(false);
      if (!view.editing) return;
      if (this.roomDraft) {
        const d = this.roomDraft, result = Office.previewRoom(view.game.ctx, d.type, d, d.roomId), color = result.ok ? 0x438967 : 0xc35752;
        g.fillStyle(color, 0.18); g.fillRect(d.x * CELL, d.y * CELL, d.w * CELL, d.h * CELL);
        g.lineStyle(3, color); g.strokeRect(d.x * CELL, d.y * CELL, d.w * CELL, d.h * CELL); return;
      }
      const room = this.rooms.find((r) => r.roomId === this.roomId); if (!room) return;
      const o = roomOrigin(room), { w: rw, h: rh } = sizeOf(room);
      g.lineStyle(1, 0xffffff, 0.28);
      for (let x = 1; x < rw; x++) g.lineBetween((o.x + x) * CELL, (o.y + 1) * CELL, (o.x + x) * CELL, (o.y + rh - 1) * CELL);
      for (let y = 1; y < rh; y++) g.lineBetween((o.x + 1) * CELL, (o.y + y) * CELL, (o.x + rw - 1) * CELL, (o.y + y) * CELL);
      for (const desk of room.items.filter((f) => f.type === 'desk')) {
        const p = usePoint(desk); g.lineStyle(2, 0x538b6d); g.strokeRect((o.x + p.x) * CELL + 3, (o.y + p.y) * CELL + 3, CELL - 6, CELL - 6);
      }
      if (this.draft) {
        const { w, h } = dimensions(this.draft), x = (o.x + this.draft.x) * CELL, y = (o.y + this.draft.y) * CELL;
        const valid = Office.previewPlacement(view.game.ctx, this.roomId, this.draft).ok, color = valid ? 0x438967 : 0xc35752;
        g.fillStyle(color, 0.35); g.fillRect(x, y, w * CELL, h * CELL); g.lineStyle(2, color); g.strokeRect(x, y, w * CELL, h * CELL);
        if (!this.ghost) this.ghost = this.add.image(0, 0, `${this.draft.type}-${this.draft.rotation}`).setOrigin(0.5, 1).setDepth(99999).setAlpha(0.75);
        this.ghost.setTexture(`${this.draft.type}-${this.draft.rotation}`).setPosition(x + w * CELL / 2, y + h * CELL + 4).setVisible(true);
        if (this.draft.type === 'desk') { const p = usePoint(this.draft); g.lineStyle(3, 0x538b6d); g.strokeRect((o.x + p.x) * CELL + 3, (o.y + p.y) * CELL + 3, CELL - 6, CELL - 6); }
      }
    }
    notify() {
      const room = this.rooms?.find((r) => r.roomId === this.roomId), view = this.view();
      const valid = this.roomDraft ? Office.previewRoom(view.game.ctx, this.roomDraft.type, this.roomDraft, this.roomDraft.roomId) : this.draft && room ? Office.previewPlacement(view.game.ctx, this.roomId, this.draft) : null;
      const info = { roomId: this.roomId, draft: this.draft ? { ...this.draft } : null, roomDraft: this.roomDraft ? { ...this.roomDraft } : null, valid, rooms: this.rooms || [] };
      const sig = JSON.stringify([info.roomId, info.draft, info.roomDraft, valid, info.rooms.map((r) => r.roomId), view.game?.state.week, view.game?.state.officeWorld.revision]);
      if (sig !== this.editSignature) { this.editSignature = sig; bridge.onEditChange?.(info); }
      return info;
    }
    action(action, value) {
      if (!this.view().editing) return;
      const { game } = this.view();
      if (action === 'room') { this.requestedRoom = +value; this.roomId = +value; this.draft = null; this.roomDraft = null; const r = this.rooms.find((x) => x.roomId === this.roomId); if (r) { const o = roomOrigin(r), d = sizeOf(r); this.cameras.main.centerOn((o.x + d.w / 2) * CELL, (o.y + d.h / 2) * CELL); } }
      if (action === 'build') {
        const q = Office.roomSite(game.ctx, value.type, value); if (!q.ok) return bridge.onMessage(q.msg);
        this.draft = null; this.roomDraft = { ...q.site, type: value.type }; this.fitCamera();
      }
      if (action === 'room-move') { const r = this.rooms.find((x) => x.roomId === this.roomId); if (r) this.roomDraft = { ...r, type: game.state.rooms.find((m) => m.id === r.roomId).type }; this.draft = null; }
      if (action === 'renovate') { const res = bridge.onConfigure(this.roomId, value); if (!res.ok) bridge.onMessage(res.msg); }
      if (action === 'add') {
        const product = Office.SKU[value]; if (!product) return;
        if (product.year > Office.year(game.ctx)) return bridge.onMessage(`${product.year} yılından önce satın alınamaz.`);
        this.roomDraft = null;
        if (product.type === 'computer') {
          if (!this.draft?.id || this.draft.type !== 'desk') return bridge.onMessage('Bilgisayarı kurmak için önce sahnede bir masa seç.');
          this.draft.computer = product.id;
        } else if (this.draft?.id && this.draft.type === product.type) this.draft.sku = product.id;
        else {
          const item = suggestFurniture(game.ctx, this.roomId, value);
          if (!item) return bridge.onMessage('Bu eşya için uygun boşluk yok.');
          this.draft = item;
        }
      }
      if (action === 'rotate' && this.draft) this.draft.rotation = (this.draft.rotation + 1) % 4;
      if (action === 'cancel') { this.draft = null; this.roomDraft = null; }
      if (action === 'confirm') {
        if (this.roomDraft) { const d = this.roomDraft, res = d.roomId ? bridge.onConfigure(d.roomId, d) : bridge.onBuild(d.type, d); if (res.ok) { this.roomDraft = null; this.roomId = res.roomId || d.roomId; } else bridge.onMessage(res.msg); }
        else if (this.draft) { const res = bridge.onPlace(this.roomId, this.draft); if (res.ok) this.draft = null; }
      }
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
    setEditing() { if (scene) { scene.draft = null; scene.roomDraft = null; scene.notify(); } },
    zoom: (factor) => scene?.zoomBy(factor),
    fit: () => scene?.fitCamera(),
    destroy: () => game.destroy(false),
    // Başsız entegrasyon testinin sahnenin hazır olmasını gözlemesine izin verir.
    getScene: () => scene,
  };
}
