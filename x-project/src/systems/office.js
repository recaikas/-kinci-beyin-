// Kalıcı ofis dünyası. Koordinatlar oda içindeki hücrelerdir; kamera/ekran boyutu kayda girmez.
// Bu modül DOM veya Phaser kullanmaz; ekonomi ve üretim kapasitesini değiştirmez.
export const CELL = 32;
export const ROOM_W = 12;
export const ROOM_H = 12;
export const DOOR = { x: 5, y: ROOM_H - 2 };
export const FURNITURE = {
  desk: { name: 'Çalışma masası', w: 2, h: 1, usable: true, removable: false },
  plant: { name: 'Bitki', w: 1, h: 1, removable: true },
  shelf: { name: 'Kitaplık', w: 2, h: 1, removable: true },
  sofa: { name: 'Kanepe', w: 2, h: 1, usable: true, removable: true },
  coffee: { name: 'Kahve köşesi', w: 1, h: 1, usable: true, removable: true },
};
export const dimensions = (item) => {
  const t = FURNITURE[item.type];
  return item.rotation % 2 ? { w: t.h, h: t.w } : { w: t.w, h: t.h };
};
export function usePoint(item) {
  const { w, h } = dimensions(item);
  switch (item.rotation) {
    case 1: return { x: item.x + w, y: item.y };
    case 2: return { x: item.x, y: item.y - 1 };
    case 3: return { x: item.x - 1, y: item.y };
    default: return { x: item.x, y: item.y + h };
  }
}
export function occupied(items, exceptId) {
  const cells = new Set();
  for (const item of items) {
    if (exceptId !== undefined && item.id === exceptId) continue;
    const { w, h } = dimensions(item);
    for (let y = item.y; y < item.y + h; y++) for (let x = item.x; x < item.x + w; x++) cells.add(`${x},${y}`);
  }
  return cells;
}
const inside = (x, y) => x >= 1 && y >= 1 && x < ROOM_W - 1 && y < ROOM_H - 1;
const key = (p) => `${p.x},${p.y}`;

export function findPath(room, start, goal, blocked = occupied(room.items)) {
  if (!inside(start.x, start.y) || !inside(goal.x, goal.y) || blocked.has(key(start)) || blocked.has(key(goal))) return null;
  const queue = [start], previous = new Map([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (p.x === goal.x && p.y === goal.y) {
      const path = [];
      for (let q = p; q; q = previous.get(key(q))) path.push(q);
      return path.reverse();
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const next = { x: p.x + dx, y: p.y + dy }, k = key(next);
      if (inside(next.x, next.y) && !blocked.has(k) && !previous.has(k)) { previous.set(k, p); queue.push(next); }
    }
  }
  return null;
}

export function canPlace(room, item) {
  if (!item || !FURNITURE[item.type] || ![0, 1, 2, 3].includes(item.rotation) || !Number.isInteger(item.x) || !Number.isInteger(item.y)) return { ok: false, msg: 'Geçersiz eşya konumu.' };
  const { w, h } = dimensions(item);
  if (!inside(item.x, item.y) || !inside(item.x + w - 1, item.y + h - 1)) return { ok: false, msg: 'Eşya odanın içinde kalmalı.' };
  const filled = occupied(room.items, item.id);
  for (let y = item.y; y < item.y + h; y++) for (let x = item.x; x < item.x + w; x++) {
    if (filled.has(`${x},${y}`)) return { ok: false, msg: 'Burada başka bir eşya var.' };
    if (x === DOOR.x && y === DOOR.y) return { ok: false, msg: 'Kapının önü boş kalmalı.' };
  }
  const next = { items: [...room.items.filter((f) => f.id !== item.id), item] }, blocked = occupied(next.items);
  for (const f of next.items) {
    if (FURNITURE[f.type].usable && !findPath(next, DOOR, usePoint(f), blocked)) return { ok: false, msg: 'Kapıdan bütün masa ve oturma alanlarına ulaşılmalı.' };
  }
  return { ok: true };
}

function freePosition(room, type, rotation = 0) {
  for (let y = 1; y < ROOM_H - 1; y++) for (let x = 1; x < ROOM_W - 1; x++) {
    const item = { type, rotation, x, y };
    if (canPlace(room, item).ok) return item;
  }
  return null;
}
function insert(room, item) {
  const placed = { ...item, id: `f${room.roomId}-${room.nextId++}` };
  room.items.push(placed);
  return placed;
}
function addWorkplaces(room, capacity, resting) {
  const type = resting ? 'sofa' : 'desk';
  let count = room.items.filter((f) => f.type === type).length;
  while (count < capacity) {
    const preferred = { type, x: 2 + (count % 3) * 3, y: 2 + Math.floor(count / 3) * 4, rotation: 0 };
    const item = canPlace(room, preferred).ok ? preferred : freePosition(room, type);
    if (!item) break; // Mevcut kişisel yerleşimi yükseltme sırasında sıfırlama.
    insert(room, item); count++;
  }
}

export function ensureOffice(state, pack) {
  state.officeWorld ||= { version: 1, revision: 0, rooms: {} };
  const world = state.officeWorld;
  const capacity = pack.offices.find((o) => o.tier === state.office.tier).roomSeats;
  const ids = new Set(state.rooms.map((r) => String(r.id)));
  for (const id of Object.keys(world.rooms)) if (!ids.has(id)) { delete world.rooms[id]; world.revision++; }
  for (const r of state.rooms) {
    let room = world.rooms[r.id];
    if (!room) {
      const building = pack.buildings.find((b) => b.types.includes(r.type))?.id || 'ana';
      const taken = new Set(Object.values(world.rooms).filter((x) => x.building === building).map((x) => x.slot));
      let slot = 0; while (taken.has(slot)) slot++;
      room = world.rooms[r.id] = { roomId: r.id, building, slot, nextId: 1, capacity: 0, items: [] };
      addWorkplaces(room, capacity, r.type === 'mola');
      for (const item of [{ type: 'plant', x: 10, y: 8, rotation: 0 }, { type: 'coffee', x: 8, y: 9, rotation: 0 }]) {
        if (canPlace(room, item).ok) insert(room, item);
      }
      room.capacity = capacity; world.revision++;
    } else if (room.capacity < capacity) {
      addWorkplaces(room, capacity, r.type === 'mola');
      room.capacity = capacity; world.revision++;
    }
  }
  return world;
}

export function placeFurniture(ctx, roomId, proposal) {
  const world = ensureOffice(ctx.state, ctx.pack), room = world.rooms[roomId];
  if (!room) return { ok: false, msg: 'Oda yok.' };
  const old = proposal.id && room.items.find((f) => f.id === proposal.id);
  if (proposal.id && !old) return { ok: false, msg: 'Eşya artık yok.' };
  if (old && old.type !== proposal.type) return { ok: false, msg: 'Eşya türü değiştirilemez.' };
  if (!old && (!FURNITURE[proposal.type]?.removable || room.items.length >= 24)) return { ok: false, msg: 'Bu odaya daha fazla dekor eklenemez.' };
  const item = { type: proposal.type, x: proposal.x, y: proposal.y, rotation: proposal.rotation, ...(old ? { id: old.id } : {}) };
  const valid = canPlace(room, item);
  if (!valid.ok) return valid;
  if (old) Object.assign(old, item); else insert(room, item);
  world.revision++;
  return { ok: true };
}
export function removeFurniture(ctx, roomId, id) {
  const world = ensureOffice(ctx.state, ctx.pack), room = world.rooms[roomId], item = room?.items.find((f) => f.id === id);
  if (!item || !FURNITURE[item.type].removable || item.type === 'sofa' && ctx.state.rooms.find((r) => r.id === roomId)?.type === 'mola') return { ok: false, msg: 'Çalışma ve mola koltukları kaldırılamaz.' };
  room.items = room.items.filter((f) => f.id !== id); world.revision++;
  return { ok: true };
}
export function suggestFurniture(ctx, roomId, type) {
  const room = ctx.state.officeWorld?.rooms[roomId];
  return room && FURNITURE[type]?.removable ? freePosition(room, type) : null;
}
export const roomOrigin = (room) => ({ x: 1 + (room.slot % 2) * (ROOM_W + 2), y: 2 + Math.floor(room.slot / 2) * (ROOM_H + 2) });
export function buildingRooms(state, building) {
  return Object.values(state.officeWorld.rooms).filter((r) => r.building === building).sort((a, b) => a.slot - b.slot);
}
