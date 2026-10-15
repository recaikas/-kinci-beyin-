import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame, Staff } from '../src/game.js';
import { personWeekly } from '../src/models.js';
import * as O from '../src/systems/office.js';

const fresh = () => newGame({ seed: 1976, difficulty: 'orta', length: 50 });
const first = (g) => g.state.officeWorld.rooms[g.state.rooms[0].id];
const deskOf = (r) => r.items.find((f) => f.type === 'desk');
const buy = (g, room, sku, placement) => {
  const draft = placement ? { ...placement, sku, type: O.SKU[sku].type } : O.suggestFurniture(g.ctx, room.roomId, sku);
  assert.ok(draft, sku); const r = g.placeFurniture(room.roomId, draft); assert.ok(r.ok, `${sku}: ${r.msg}`);
  return draft.id ? room.items.find((f) => f.id === draft.id) : room.items.at(-1);
};
const equip = (g, room) => {
  const desk = buy(g, room, 'desk-basic', { x: 2, y: 2, rotation: 0 });
  buy(g, room, 'chair-basic', { ...O.usePoint(desk), rotation: 0 });
  assert.ok(g.placeFurniture(room.roomId, { ...desk, computer: 'pc-kit-76' }).ok); return desk;
};
const validateRoom = (room) => {
  let cells = 0;
  for (const item of room.items) {
    const s = O.dimensions(item); cells += s.w * s.h;
    assert.ok(O.canPlace(room, item).ok, JSON.stringify(item));
    if (O.FURNITURE[item.type].usable) assert.ok(O.findPath(room, O.doorOf(room), O.usePoint(item)));
  }
  assert.equal(O.occupied(room.items).size, cells);
};

test('garaj tek hazır istasyonla başlar; eski kayıt dönüşümü ve tekrar yükleme kararlıdır', () => {
  const g = fresh(), room = first(g);
  assert.equal(O.workstations(g.ctx, room.roomId).length, 1);
  assert.equal(O.workReport(g.ctx, g.state.staff[0]).factor, 1); validateRoom(room);
  for (const mode of ['missing', 'v1']) {
    const old = JSON.parse(g.save());
    if (mode === 'missing') delete old.officeWorld;
    else { old.officeWorld.version = 1; old.officeWorld.rooms[room.roomId].items = [{ id: 'old-desk', type: 'desk', x: 4, y: 2, rotation: 0 }]; }
    const restored = loadGame(JSON.stringify(old));
    assert.equal(restored.state.officeWorld.version, 2);
    assert.equal(O.workstations(restored.ctx, room.roomId).length, 1); validateRoom(first(restored));
    if (mode === 'v1') assert.equal(deskOf(first(restored)).x, 4);
    assert.equal(loadGame(restored.save()).save(), restored.save());
  }
});

test('yeni oda boştur; ofis yükseltmek hazır istasyon vermez', () => {
  const g = fresh(); g.state.cash = 1e7;
  const layout = JSON.stringify(first(g).items), oldPlot = O.plotSize(g.state);
  assert.ok(g.moveOffice().ok); assert.ok(O.plotSize(g.state).w > oldPlot.w);
  assert.equal(JSON.stringify(first(g).items), layout); assert.equal(Staff.seats(g.ctx), 1);
  const r = g.buildRoom('gelistirme', { w: 8, h: 8 }); assert.ok(r.ok, r.msg);
  assert.deepEqual(g.state.officeWorld.rooms[r.roomId].items, []);
  assert.equal(Staff.seats(g.ctx), 1);
  assert.equal(g.startProject({ roomId: r.roomId }).ok, false);
});

test('masa + bilgisayar + doğru yönlü sandalye kapasite oluşturur; her parça ücretlidir', () => {
  const g = fresh(); g.state.cash = 1e6;
  const id = g.buildRoom('gelistirme').roomId, room = g.state.officeWorld.rooms[id], startCash = g.state.cash;
  const desk = buy(g, room, 'desk-basic', { x: 2, y: 2, rotation: 0 });
  assert.equal(O.capacity(g.ctx, g.state.rooms.at(-1)), 0);
  assert.ok(g.placeFurniture(id, { ...desk, computer: 'pc-kit-76' }).ok);
  assert.equal(O.workstations(g.ctx, id).length, 0);
  const chair = buy(g, room, 'chair-basic', { ...O.usePoint(desk), rotation: 1 });
  assert.equal(O.workstations(g.ctx, id).length, 0);
  assert.ok(g.placeFurniture(id, { ...chair, rotation: 0 }).ok);
  assert.equal(O.workstations(g.ctx, id).length, 1);
  assert.equal(startCash - g.state.cash, 180 + 1100 + 65);
  assert.ok(g.removeFurniture(id, chair.id).ok); assert.equal(O.workstations(g.ctx, id).length, 0);
  assert.equal(g.moveStaff(g.state.staff[0].id, id).ok, false);
});

test('duvar, çakışma, kapı ve kapanan kullanım yolu reddedilir', () => {
  const g = fresh(), room = first(g), desk = deskOf(room);
  for (const p of [
    { x: 0, y: 1 }, { x: desk.x, y: desk.y }, O.doorOf(room), O.usePoint(desk), { x: 2.3, y: 4 },
  ]) assert.equal(O.canPlace(room, { type: 'plant', rotation: 0, ...p }).ok, false);
  const blocked = { w: 8, h: 8, items: [{ id: 'd', type: 'desk', x: 2, y: 2, rotation: 0 }, { id: 'l', type: 'plant', x: 1, y: 3, rotation: 0 }, { id: 'r', type: 'plant', x: 3, y: 3, rotation: 0 }] };
  assert.equal(O.canPlace(blocked, { type: 'plant', x: 2, y: 4, rotation: 0 }).ok, false);
});

test('oda taşıma, kapı ve zemin değişimi kalıcıdır; geçersiz tadilat atomiktir', () => {
  const g = fresh(); g.state.cash = 1e6;
  const room = first(g), id = room.roomId, before = g.save();
  assert.equal(g.configureRoom(id, { x: 0 }).ok, false);
  assert.equal(g.configureRoom(id, { w: 6, h: 6, door: 0 }).ok, false);
  assert.equal(g.save(), before);
  assert.ok(g.configureRoom(id, { x: 2, y: 2, floor: 'carpet', door: 4 }).ok);
  assert.equal(room.x, 2); assert.equal(room.door, 4); validateRoom(room);
  const next = g.buildRoom('mola', { w: 6, h: 6 }); assert.ok(next.ok);
  const r2 = g.state.officeWorld.rooms[next.roomId], cash = g.state.cash;
  assert.equal(g.configureRoom(id, { x: r2.x, y: r2.y }).ok, false); assert.equal(g.state.cash, cash);
  const loaded = loadGame(g.save());
  assert.deepEqual(loaded.state.officeWorld, g.state.officeWorld);
  assert.equal(loadGame(loaded.save()).save(), loaded.save());
});

test('katalog yılları, bilgisayar yaşlanması ve takas bedeli gerçek satın alıma bağlıdır', () => {
  const g = fresh(), room = first(g), desk = deskOf(room), before = g.save();
  assert.equal(g.placeFurniture(room.roomId, { ...desk, computer: 'pc-c64-82' }).ok, false);
  assert.equal(g.save(), before);
  g.state.week = 6 * 48;
  const oldPower = O.workReport(g.ctx, g.state.staff[0]).equipment;
  assert.equal(oldPower, 0.83); assert.equal(O.year(g.ctx), 1982);
  assert.ok(g.placeFurniture(room.roomId, { ...desk, computer: 'pc-c64-82' }).ok);
  assert.equal(O.workReport(g.ctx, g.state.staff[0]).equipment, 1);
  const paid = desk.computerPaid, cash = g.state.cash;
  const q = O.previewPlacement(g.ctx, room.roomId, { ...desk, computer: 'pc-pro-82' });
  assert.equal(q.refund, Math.round(paid * 0.35)); assert.equal(g.state.cash, cash);
  assert.ok(g.placeFurniture(room.roomId, { ...desk, computer: 'pc-pro-82' }).ok);
  assert.equal(g.state.cash, cash - q.net);
});

test('önizleme RNG ve kaydı değiştirmez; yetersiz para, bozuk ürün ve yanlış oda reddedilir', () => {
  const g = fresh(), room = first(g), save = g.save();
  const proposal = O.suggestFurniture(g.ctx, room.roomId, 'plant-basic');
  assert.ok(O.previewPlacement(g.ctx, room.roomId, proposal).ok); assert.equal(g.save(), save);
  g.state.cash = 0; const empty = g.save();
  assert.equal(g.placeFurniture(room.roomId, proposal).ok, false);
  assert.equal(g.placeFurniture(room.roomId, { ...proposal, sku: 'fake' }).ok, false);
  assert.equal(g.placeFurniture(room.roomId, { ...proposal, sku: 'toilet-basic', type: 'toilet' }).ok, false);
  assert.equal(g.save(), empty);
});

test('donanım üretimi değiştirir; çalışma yeri sökülünce çıktı ve proje ilerlemesi durur', () => {
  const g = fresh(), p = g.state.staff[0], room = first(g), desk = deskOf(room);
  const normal = personWeekly(g.ctx, p, 1);
  assert.ok(g.placeFurniture(room.roomId, { ...desk, computer: 'pc-pro-76' }).ok);
  assert.ok(personWeekly(g.ctx, p, 1) > normal);
  const start = g.startProject({ name: 'Uzay', genre: 'aksiyon', topic: 'uzay', audience: 'genc', platforms: ['pc'], size: 'kucuk' }); assert.ok(start.ok, start.msg);
  while (g.state.pending.length) g.resolve(0);
  const pj = g.state.projects[0], progress = JSON.stringify([pj.points, pj.phase, pj.week]);
  assert.ok(g.removeFurniture(room.roomId, room.items.find((f) => f.type === 'chair').id).ok);
  assert.equal(personWeekly(g.ctx, p, 1), 0); assert.deepEqual(Staff.weeklyOutput(g.ctx, () => true), []);
  g.tick(); assert.equal(JSON.stringify([pj.points, pj.phase, pj.week]), progress);
});

test('pervane yaz sıcağını azaltır, üretimi artırır ve işletme giderine eklenir', () => {
  const g = fresh(), room = first(g); g.state.week = 24;
  const before = O.workReport(g.ctx, g.state.staff[0]), cost = O.monthlyCost(g.ctx);
  buy(g, room, 'fan-basic'); const after = O.workReport(g.ctx, g.state.staff[0]);
  assert.equal(before.temperature - after.temperature, 2); assert.ok(after.factor > before.factor);
  assert.equal(O.monthlyCost(g.ctx), cost + 4);
  buy(g, room, 'ac-window'); assert.ok(O.workReport(g.ctx, g.state.staff[0]).temperature <= 25);
});

test('boş mola/tuvalet yetmez; gerçek koltuk, içecek, klozet ve lavabo koşulları iyileştirir', () => {
  const g = fresh(); g.state.cash = 1e6; assert.ok(g.moveOffice().ok);
  const p = g.state.staff[0], before = O.workReport(g.ctx, p);
  const lounge = g.state.officeWorld.rooms[g.buildRoom('mola', { w: 6, h: 6 }).roomId];
  const wc = g.state.officeWorld.rooms[g.buildRoom('tuvalet').roomId];
  assert.equal(O.workReport(g.ctx, p).factor, before.factor);
  buy(g, lounge, 'sofa-basic'); buy(g, lounge, 'tea-basic'); buy(g, wc, 'toilet-basic');
  assert.ok(O.workReport(g.ctx, p).reasons.some((s) => s.includes('lavabosu')));
  buy(g, wc, 'sink-basic'); const after = O.workReport(g.ctx, p);
  assert.equal(after.visits.length, 3); assert.ok(after.factor > before.factor);
  assert.ok(after.workShare < 1, 'yürüme süresi ücretsiz değildir');
  assert.equal(after.reasons.some((s) => s.includes('lavabosu')), false);
  for (const v of after.visits) assert.ok(O.worldPath(g.state, 'ana', O.globalPoint(first(g), O.workplace(g.ctx, p).point), v.point));
  assert.equal(Staff.seats(g.ctx), 1, 'dinlenme koltuğu işe alım kapasitesi değildir');
  const unchanged = g.save();
  assert.equal(g.demolishRoom(first(g).roomId).ok, false, 'koltuklar çalışanları iş odasından çıkarmak için kullanılamaz');
  assert.equal(g.save(), unchanged);
});

test('bitki katkısı sınırlıdır ve satılan eşya bedelinin yalnızca bir kısmı geri alınır', () => {
  const g = fresh(); g.state.cash = 1e6; const room = first(g), base = O.workReport(g.ctx, g.state.staff[0]).conditions;
  for (let i = 0; i < 3; i++) buy(g, room, 'plant-basic');
  const capped = O.workReport(g.ctx, g.state.staff[0]).conditions;
  assert.ok(Math.abs(capped / base - 1.03) < 1e-9);
  const plant = buy(g, room, 'plant-basic'); assert.equal(O.workReport(g.ctx, g.state.staff[0]).conditions, capped);
  const cash = g.state.cash; assert.ok(g.removeFurniture(room.roomId, plant.id).ok);
  assert.equal(g.state.cash - cash, 21);
});

test('oda yıkma diğer konumları korur; yeni kayıt aynı hafta sonuçlarını üretir', () => {
  const g = fresh(); g.state.cash = 1e6; const origin = O.roomOrigin(first(g));
  const id = g.buildRoom('gelistirme').roomId; equip(g, g.state.officeWorld.rooms[id]);
  assert.ok(g.demolishRoom(id).ok); assert.equal(g.state.officeWorld.rooms[id], undefined);
  assert.deepEqual(O.roomOrigin(first(g)), origin);
  const b = loadGame(g.save());
  for (const h of [g, b]) for (let i = 0; i < 8; i++) { while (h.state.pending.length) h.resolve(0); h.tick(); }
  assert.equal(g.save(), b.save());
});
