import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/game.js';
import { PACK } from '../src/data/pack.js';
import { ensureOffice, canPlace, occupied, findPath, usePoint, DOOR, FURNITURE, roomOrigin, suggestFurniture } from '../src/systems/office.js';

const fresh = () => newGame({ seed: 1976, difficulty: 'orta', length: 50 });
const first = (g) => g.state.officeWorld.rooms[g.state.rooms[0].id];
const validateRoom = (room) => {
  let expected = 0;
  for (const item of room.items) {
    expected += FURNITURE[item.type].w * FURNITURE[item.type].h;
    assert.equal(canPlace(room, item).ok, true, JSON.stringify(item));
    if (FURNITURE[item.type].usable) assert.ok(findPath(room, DOOR, usePoint(item)));
  }
  assert.equal(occupied(room.items).size, expected, 'eşyalar üst üste binmez');
};

test('eski v3 kaydı mekâna dönüşür; tekrar yükleme yerleşimi değiştirmez', () => {
  const g = fresh(), old = JSON.parse(g.save());
  delete old.officeWorld;
  const restored = loadGame(JSON.stringify(old));
  validateRoom(first(restored));
  assert.equal(first(restored).items.filter((f) => f.type === 'desk').length, 1);
  assert.equal(loadGame(restored.save()).save(), restored.save());
});

test('bütün ofis kademeleri ve oda türlerinde başlangıç eşyaları erişilebilir', () => {
  for (const office of PACK.offices) for (const type of PACK.rooms.types) {
    const g = fresh(); g.state.office.tier = office.tier; g.state.rooms[0].type = type.id; delete g.state.officeWorld;
    const cash = g.state.cash, rng = g.state.rng;
    ensureOffice(g.state, g.pack);
    validateRoom(first(g));
    assert.equal(first(g).items.filter((f) => f.type === (type.id === 'mola' ? 'sofa' : 'desk')).length, office.roomSeats);
    assert.equal(g.state.cash, cash); assert.equal(g.state.rng, rng);
  }
});

test('duvar, eşya çakışması, kapı ve erişilemeyen kullanım noktası reddedilir', () => {
  const g = fresh(), room = first(g), desk = room.items.find((f) => f.type === 'desk');
  for (const proposal of [
    { type: 'plant', x: 0, y: 1, rotation: 0 },
    { type: 'plant', x: desk.x, y: desk.y, rotation: 0 },
    { type: 'plant', ...DOOR, rotation: 0 },
    { type: 'plant', ...usePoint(desk), rotation: 0 },
    { type: 'desk', x: 4, y: 1, rotation: 2 },
    { type: 'plant', x: 2.3, y: 3, rotation: 0 },
    { type: 'plant', x: 2, y: 3, rotation: 4 },
  ]) assert.equal(canPlace(room, proposal).ok, false, JSON.stringify(proposal));
});

test('yeni eşyanın kendisi yol bulmada engeldir; kapalı masa koridoru kabul edilmez', () => {
  const room = { items: [{ id: 'desk', type: 'desk', x: 2, y: 2, rotation: 0 }] };
  // Masanın kullanım noktası 2,3: üç yanını kapat, son yanı yeni eşyayla kapatmayı dene.
  for (const [id, x, y] of [['left', 1, 3], ['right', 3, 3]]) room.items.push({ id, type: 'plant', x, y, rotation: 0 });
  assert.equal(canPlace(room, { type: 'plant', x: 2, y: 4, rotation: 0 }).ok, false);
});

test('taşıma ve döndürme kalıcıdır; reddedilen yerleşim kayda dokunmaz', () => {
  const g = fresh(), room = first(g), desk = room.items.find((f) => f.type === 'desk');
  const cash = g.state.cash, rng = g.state.rng;
  assert.equal(g.placeFurniture(room.roomId, { ...desk, x: 5, y: 4, rotation: 1 }).ok, true);
  const save = g.save();
  assert.equal(g.placeFurniture(room.roomId, { ...desk, x: 0 }).ok, false);
  assert.equal(g.save(), save);
  const loaded = loadGame(save);
  assert.deepEqual(first(loaded).items.find((f) => f.id === desk.id), desk);
  assert.equal(g.state.cash, cash); assert.equal(g.state.rng, rng);
});

test('ekle/kaldır iş istasyonlarını korur; öneri önizlemesi kaydı değiştirmez', () => {
  const g = fresh(), room = first(g), before = g.save();
  const proposal = suggestFurniture(g.ctx, room.roomId, 'shelf');
  assert.ok(proposal); assert.equal(g.save(), before);
  assert.equal(g.placeFurniture(room.roomId, proposal).ok, true);
  const added = room.items.at(-1);
  assert.equal(g.removeFurniture(room.roomId, added.id).ok, true);
  assert.equal(g.removeFurniture(room.roomId, room.items.find((f) => f.type === 'desk').id).ok, false);
  assert.equal(g.placeFurniture(room.roomId, { ...proposal, id: 'yok' }).ok, false);
});

test('ofis yükseltmesi kişisel masa konumunu koruyarak yeni koltukları ekler', () => {
  const g = fresh(), room = first(g), desk = room.items.find((f) => f.type === 'desk');
  assert.ok(g.placeFurniture(room.roomId, { ...desk, x: 1, y: 1 }).ok);
  g.state.cash = 1e8;
  assert.ok(g.moveOffice().ok);
  assert.equal(room.items.filter((f) => f.type === 'desk').length, 3);
  assert.equal(desk.x, 1); assert.equal(desk.y, 1);
  validateRoom(room);
});

test('oda ekleme/yıkma diğer odaların dünya konumunu değiştirmez', () => {
  const g = fresh(); g.state.cash = 1e8; g.moveOffice();
  const room = first(g), origin = roomOrigin(room);
  assert.ok(g.buildRoom('gelistirme').ok);
  const removed = g.state.rooms.at(-1).id;
  assert.ok(g.demolishRoom(removed).ok);
  assert.equal(g.state.officeWorld.rooms[removed], undefined);
  assert.deepEqual(roomOrigin(room), origin);
  validateRoom(room);
});

test('yerleşim haftalık ekonomi ve üretim sonucunu değiştirmez', () => {
  const a = fresh(), b = loadGame(a.save()), room = first(b), desk = room.items.find((f) => f.type === 'desk');
  assert.ok(b.placeFurniture(room.roomId, { ...desk, x: 5, y: 4 }).ok);
  for (const g of [a, b]) {
    g.startProject({ name: 'Uzay', genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' });
    for (let i = 0; i < 16; i++) { while (g.state.pending.length) g.resolve(0); g.tick(); }
  }
  const strip = (g) => { const s = JSON.parse(g.save()); delete s.officeWorld; return s; };
  assert.deepEqual(strip(a), strip(b));
});
