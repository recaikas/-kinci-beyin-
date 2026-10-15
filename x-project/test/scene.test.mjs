import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasDOM } from './support/canvas-dom.mjs';
import { newGame } from '../src/game.js';
import { CELL, roomOrigin, dimensions, suggestFurniture } from '../src/systems/office.js';

test('Phaser Canvas sahnesi açılır; çalışan yürür, durur, düzenler ve yeniden boyutlanır', { timeout: 15000 }, async () => {
  const env = canvasDOM();
  const { makeOfficeRenderer } = await import('../src/office/renderer.js');
  const g = newGame({ seed: 1976, difficulty: 'orta', length: 50 });
  const view = { game: g, building: 'ana', paused: false, speed: 1, blocked: false, editing: false };
  let info;
  const renderer = makeOfficeRenderer(env.window.document.querySelector('#scene'), {
    view: () => view,
    onEditChange: (next) => { info = next; }, onHit: () => {}, onMessage: () => {},
    onBuild: (type, draft) => g.buildRoom(type, draft), onConfigure: (room, draft) => g.configureRoom(room, draft),
    onPlace: (room, draft) => g.placeFurniture(room, draft), onRemove: (room, id) => g.removeFurniture(room, id),
  }, { type: 1 }); // Phaser.CANVAS; WebGL/mobile ayrıca tarayıcıda doğrulanmalı.
  try {
    await new Promise((resolve, reject) => {
      const start = Date.now();
      const poll = () => renderer.getScene()?.signature ? resolve() : Date.now() - start > 8000 ? reject(new Error('Phaser sahnesi başlamadı')) : setTimeout(poll, 20);
      poll();
    });
    const scene = renderer.getScene();
    renderer.game.loop.stop();
    assert.equal(scene.rooms.length, 1);
    assert.equal(scene.workers.size, 1);
    const worker = [...scene.workers.values()][0], start = { x: worker.x, y: worker.y }, before = g.save();
    for (let i = 0; i < 50; i++) scene.update(i * 100, 100);
    assert.notDeepEqual({ x: worker.x, y: worker.y }, start);
    assert.equal(g.save(), before, 'çizim ve yürüyüş çekirdek verisini değiştirmez');
    view.paused = true;
    const frozen = { x: worker.x, y: worker.y, frame: worker.sprite.frame.name, elapsed: scene.elapsed };
    for (let i = 0; i < 10; i++) scene.update(i * 100, 100);
    assert.deepEqual({ x: worker.x, y: worker.y, frame: worker.sprite.frame.name, elapsed: scene.elapsed }, frozen);
    assert.equal(scene.textures.get('studio-furniture').getSourceImage().width, 1254);
    assert.ok(scene.textures.exists('studio-worker-0'));
    assert.match(renderer.thumbnail('desk-basic'), /^data:image\/png/);
    view.editing = true; renderer.setEditing(); scene.update(0, 0);
    assert.equal(scene.cameras.main.width, renderer.game.scale.width - 370, 'sağ panel için kamera alanı ayrıldı');
    scene.cameras.main.preRender();
    const desk = scene.rooms[0].items.find((f) => f.type === 'desk'), o = roomOrigin(scene.rooms[0]), size = dimensions(desk);
    const c = scene.cameras.main, corner = c.getWorldPoint(0, 0);
    const pointer = (x, y) => ({ x: ((o.x + x) * CELL - corner.x) * c.zoom, y: ((o.y + y) * CELL - corner.y) * c.zoom, isDown: true });
    scene.input.emit('pointerdown', pointer(desk.x + size.w / 2, desk.y + size.h / 2));
    scene.input.emit('pointermove', pointer(4 + size.w / 2, 4 + size.h / 2));
    scene.input.emit('pointerup', pointer(4 + size.w / 2, 4 + size.h / 2));
    assert.equal(info.draft.x, 4); assert.equal(info.draft.y, 4);
    assert.ok(info.valid.ok); assert.equal(g.save(), before, 'sürükleme önce yalnız taslak oluşturur');
    renderer.action('cancel');
    assert.equal(info.draft, null); assert.equal(g.save(), before, 'iptal ilk konumu korur');
    renderer.action('add', 'shelf-basic');
    assert.ok(info.draft); assert.ok(info.valid.ok);
    assert.equal(g.save(), before, 'önizleme kayda yazılmaz');
    renderer.action('confirm'); scene.update(0, 0);
    assert.equal(g.state.officeWorld.rooms[scene.roomId].items.at(-1).type, 'shelf');
    assert.equal(info.draft, null);
    g.state.cash = 1e6;
    renderer.action('build', { type: 'mola', w: 6, h: 6, building: 'ana' });
    assert.ok(info.roomDraft); assert.ok(info.valid.ok);
    const roomsBefore = g.state.rooms.length;
    renderer.action('confirm'); scene.update(0, 0);
    assert.equal(g.state.rooms.length, roomsBefore + 1);
    assert.equal(scene.rooms.length, 2);
    assert.equal(g.state.officeWorld.rooms[scene.roomId].items.length, 0);
    const lounge = g.state.officeWorld.rooms[scene.roomId];
    assert.ok(g.placeFurniture(lounge.roomId, suggestFurniture(g.ctx, lounge.roomId, 'sofa-basic')).ok);
    const wcId = g.buildRoom('tuvalet').roomId;
    for (const sku of ['toilet-basic', 'sink-basic']) assert.ok(g.placeFurniture(wcId, suggestFurniture(g.ctx, wcId, sku)).ok);
    view.editing = false; view.paused = false;
    let visitedRest = false, privateToilet = false;
    for (let i = 0; i < 2200; i++) {
      scene.update(i * 100, 100);
      if (worker.mode === 'Dinlenme' && !worker.path?.length) visitedRest = true;
      if (worker.mode === 'Tuvalet' && !worker.path?.length && !worker.sprite.visible) privateToilet = true;
    }
    assert.ok(visitedRest, 'çalışan odalar arasında dinlenme koltuğuna yürüdü');
    assert.ok(privateToilet, 'tuvalet kullanımında karakter gizlendi');
    const layout = JSON.stringify(g.state.officeWorld);
    view.editing = true; view.compact = true;
    renderer.resize(390, 620); scene.update(0, 0);
    assert.equal(scene.cameras.main.height, 334, 'mobil çekmece sahnenin üstüne çizilmez');
    view.compact = false;
    renderer.resize(844, 300); scene.update(0, 0);
    assert.equal(scene.cameras.main.width, 532, 'yatay ekranda katalog sağa geçer');
    assert.equal(JSON.stringify(g.state.officeWorld), layout);
    assert.ok(scene.cameras.main.zoom > 0);
    // Phaser'ın gerçek CanvasRenderer'ı bütün DisplayList'i boyasın.
    renderer.game.renderer.preRender(); scene.sys.render(renderer.game.renderer); renderer.game.renderer.postRender();
    const data = env.native(env.window.document.querySelector('#scene')).getContext('2d').getImageData(0, 0, 844, 300).data;
    const colors = new Set(); for (let i = 0; i < data.length; i += 4) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    assert.ok(colors.size > 20, 'sahne tek renk/boş değil');
  } finally { renderer.game.destroy(true); renderer.game.runDestroy(); env.window.close(); }
});
