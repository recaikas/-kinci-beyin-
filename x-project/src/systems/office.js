// Kalıcı mekân, satın alma ve üretim koşulları. DOM/Phaser'a bağlı değildir.
import { calendar, clamp } from '../kernel.js';
import { CATALOG, SKU, FURNITURE, expectedGeneration } from '../data/office.js';
export { CATALOG, SKU, FURNITURE };
export const CELL = 32, ROOM_W = 12, ROOM_H = 12;
export const DOOR = { x: 5, y: 10 }; // Eski yerleşim kayıtları için varsayılan.
export const year = (ctx) => calendar(ctx.state, ctx.pack).tableYear;
export const sizeOf = (r) => ({ w: r.w || ROOM_W, h: r.h || ROOM_H });
export const doorOf = (r) => ({ x: r.door ?? Math.floor(sizeOf(r).w / 2), y: sizeOf(r).h - 2 });
export const roomOrigin = (r) => ({ x: r.x ?? 1 + (r.slot % 2) * 14, y: r.y ?? 2 + Math.floor(r.slot / 2) * 14 });
export const dimensions = (item) => { const t = FURNITURE[item.type]; return item.rotation % 2 ? { w: t.h, h: t.w } : { w: t.w, h: t.h }; };
export function usePoint(item) {
  const { w, h } = dimensions(item);
  return item.rotation === 1 ? { x: item.x + w, y: item.y } : item.rotation === 2 ? { x: item.x, y: item.y - 1 } : item.rotation === 3 ? { x: item.x - 1, y: item.y } : { x: item.x, y: item.y + h };
}
const key = (p) => `${p.x},${p.y}`;
const inside = (r, x, y) => x >= 1 && y >= 1 && x < sizeOf(r).w - 1 && y < sizeOf(r).h - 1;
export function occupied(items, exceptId, walking = false) {
  const cells = new Set();
  for (const f of items) {
    if (exceptId !== undefined && f.id === exceptId || walking && FURNITURE[f.type].walkable) continue;
    const { w, h } = dimensions(f);
    for (let y = f.y; y < f.y + h; y++) for (let x = f.x; x < f.x + w; x++) cells.add(`${x},${y}`);
  }
  return cells;
}
function bfs(start, goal, allowed) {
  if (!allowed(start.x, start.y) || !allowed(goal.x, goal.y)) return null;
  const queue = [start], prev = new Map([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (key(p) === key(goal)) { const out = []; for (let q = p; q; q = prev.get(key(q))) out.push(q); return out.reverse(); }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (!prev.has(key(q)) && allowed(q.x, q.y)) { prev.set(key(q), p); queue.push(q); }
    }
  }
  return null;
}
export function findPath(room, start, goal, blocked = occupied(room.items, undefined, true)) {
  return bfs(start, goal, (x, y) => inside(room, x, y) && !blocked.has(`${x},${y}`));
}
export function canPlace(room, item) {
  if (!item || !Object.hasOwn(FURNITURE, item.type) || ![0, 1, 2, 3].includes(item.rotation) || !Number.isInteger(item.x) || !Number.isInteger(item.y)) return { ok: false, msg: 'Geçersiz eşya konumu.' };
  const { w, h } = dimensions(item), door = doorOf(room);
  if (!inside(room, item.x, item.y) || !inside(room, item.x + w - 1, item.y + h - 1)) return { ok: false, msg: 'Eşya odanın içinde kalmalı.' };
  const filled = occupied(room.items, item.id);
  for (let y = item.y; y < item.y + h; y++) for (let x = item.x; x < item.x + w; x++) {
    if (filled.has(`${x},${y}`)) return { ok: false, msg: 'Burada başka bir eşya var.' };
    if (x === door.x && y === door.y) return { ok: false, msg: 'Kapının önü boş kalmalı.' };
  }
  const next = { ...room, items: [...room.items.filter((f) => f.id !== item.id), item] }, blocked = occupied(next.items, undefined, true);
  for (const f of next.items) if (FURNITURE[f.type].usable && !findPath(next, door, usePoint(f), blocked)) return { ok: false, msg: 'Kapıdan bütün kullanım noktalarına ulaşılmalı.' };
  return { ok: true };
}
export function freePosition(room, type, rotation = 0) {
  const { w, h } = sizeOf(room);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const item = { type, rotation, x, y }; if (canPlace(room, item).ok) return item; }
  return null;
}
const insert = (room, item) => { const f = { ...item, id: `f${room.roomId}-${room.nextId++}` }; room.items.push(f); return f; };
export const buildingRooms = (state, building) => Object.values(state.officeWorld?.rooms || {}).filter((r) => r.building === building).sort((a, b) => a.roomId - b.roomId);
export function plotSize(state, building = 'ana') {
  const base = [[24, 20], [36, 30], [48, 40], [60, 48 + (state.office.floors || 0) * 10]][state.office.tier - 1];
  const old = state.officeWorld?.plots?.[building];
  return { w: Math.max(base[0], old?.w || 0), h: Math.max(base[1], old?.h || 0) };
}
export function roomSite(ctx, type, proposal = {}, exceptId) {
  const building = proposal.building || ctx.pack.buildings.find((b) => b.types.includes(type))?.id || 'ana';
  const b = ctx.pack.buildings.find((x) => x.id === building), plot = plotSize(ctx.state, building);
  if (!b || !b.types.includes(type) || (b.minTier || 1) > ctx.state.office.tier) return { ok: false, msg: 'Bu oda bu binada kurulamaz.' };
  const w = proposal.w ?? (type === 'tuvalet' ? 6 : 8), h = proposal.h ?? (type === 'tuvalet' ? 6 : 8), door = proposal.door ?? Math.floor(w / 2), floor = proposal.floor || (type === 'tuvalet' ? 'tile' : 'wood');
  if (![w, h, door].every(Number.isInteger) || w < 6 || h < 6 || w > 20 || h > 20 || door < 1 || door > w - 2 || !['wood', 'tile', 'carpet'].includes(floor)) return { ok: false, msg: 'Oda 6–20 hücre arasında; kapı alt duvarda olmalı.' };
  const valid = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 1 && y >= 2 && x + w < plot.w && y + h < plot.h && buildingRooms(ctx.state, building).every((r) => {
    if (r.roomId === exceptId) return true;
    const p = roomOrigin(r), s = sizeOf(r);
    return x + w < p.x || p.x + s.w < x || y + h < p.y || p.y + s.h < y;
  });
  if (proposal.x != null || proposal.y != null) return valid(proposal.x, proposal.y) ? { ok: true, site: { x: proposal.x, y: proposal.y, w, h, door, floor, building } } : { ok: false, msg: 'Alan dışı veya başka odayla çakışıyor. Odalar arasında bir hücre koridor bırak.' };
  for (let y = 2; y + h < plot.h; y++) for (let x = 1; x + w < plot.w; x++) if (valid(x, y)) return { ok: true, site: { x, y, w, h, door, floor, building } };
  return { ok: false, msg: 'Bu büyüklükte boş alan yok. Daha küçük oda seç veya ofisi büyüt.' };
}
export function previewRoom(ctx, type, proposal, id) {
  const q = roomSite(ctx, type, proposal, id); if (!q.ok) return q;
  const old = id && ctx.state.officeWorld.rooms[id], t = ctx.pack.rooms.types.find((r) => r.id === type);
  if (old) for (const f of old.items) { const valid = canPlace({ ...old, ...q.site }, f); if (!valid.ok) return { ok: false, msg: `${FURNITURE[f.type].name}: ${valid.msg}` }; }
  const cost = old ? Math.max(0, q.site.w * q.site.h - old.w * old.h) * 12 + (q.site.floor !== old.floor ? q.site.w * q.site.h * 2 : 0) : Math.round(t.cost * q.site.w * q.site.h / 64 * Math.pow(ctx.pack.economy.inflation, (year(ctx) - ctx.pack.meta.startYear) * 0.5));
  return ctx.state.cash < cost ? { ok: false, msg: `${cost.toLocaleString('tr-TR')} $ gerekli.`, cost } : { ...q, cost };
}
export function registerRoom(state, model, site) {
  const room = { roomId: model.id, ...site, nextId: 1, items: [] };
  state.officeWorld.rooms[model.id] = room; state.officeWorld.revision++; return room;
}
function grantWorkplace(room, computer, index = 0) {
  const candidate = { type: 'desk', x: 2 + index % 3 * 3, y: 2 + Math.floor(index / 3) * 4, rotation: 0 };
  const pos = canPlace(room, candidate).ok ? candidate : freePosition(room, 'desk');
  if (!pos) return;
  const desk = insert(room, { ...pos, sku: 'desk-basic', computer, paid: 0, computerPaid: 0 });
  const chair = { type: 'chair', ...usePoint(desk), rotation: desk.rotation, sku: 'chair-basic', paid: 0 };
  if (canPlace(room, chair).ok) insert(room, chair);
}
export function ensureOffice(state, pack) {
  const legacy = !state.officeWorld || state.officeWorld.version < 2;
  state.officeWorld ||= { version: 2, revision: 0, rooms: {}, plots: {} };
  const world = state.officeWorld; world.plots ||= {};
  const ids = new Set(state.rooms.map((r) => String(r.id)));
  for (const id of Object.keys(world.rooms)) if (!ids.has(id)) { delete world.rooms[id]; world.revision++; }
  const currentYear = calendar(state, pack).tableYear;
  const computers = CATALOG.filter((s) => s.type === 'computer' && s.year <= currentYear && s.generation <= (state.stationTier || 0));
  const pc = computers.filter((p) => p.grade === 1).sort((a, b) => b.generation - a.generation || b.year - a.year)[0]?.id || 'pc-kit-76';
  for (const model of state.rooms) {
    let room = world.rooms[model.id];
    if (!room) {
      const building = pack.buildings.find((b) => b.types.includes(model.type))?.id || 'ana';
      const count = buildingRooms(state, building).length;
      room = registerRoom(state, model, { building, x: 1 + count % 2 * 14, y: 2 + Math.floor(count / 2) * 14, w: ROOM_W, h: ROOM_H, door: 5, floor: model.type === 'tuvalet' ? 'tile' : 'wood' });
      if (legacy && model.type !== 'tuvalet') {
        const capacity = Math.max(pack.offices.find((o) => o.tier === state.office.tier).roomSeats, state.staff.filter((p) => p.room === model.id).length);
        for (let i = 0; i < capacity; i++) if (model.type === 'mola') { const pos = freePosition(room, 'sofa'); if (pos) insert(room, { ...pos, sku: 'sofa-basic', paid: 0 }); } else grantWorkplace(room, pc, i);
      }
    }
    if (legacy) {
      const p = roomOrigin(room); Object.assign(room, p, sizeOf(room)); room.door ??= 5; room.floor ||= 'wood';
      for (const f of [...room.items]) {
        f.sku ||= CATALOG.find((s) => s.type === f.type)?.id; f.paid ||= 0;
        if (f.type === 'desk') {
          f.computer ||= pc; f.computerPaid ||= 0;
          const chair = { type: 'chair', ...usePoint(f), rotation: f.rotation, sku: 'chair-basic', paid: 0 };
          if (!room.items.some((x) => x.type === 'chair' && x.x === chair.x && x.y === chair.y) && canPlace(room, chair).ok) insert(room, chair);
        }
      }
      const bounds = world.plots[room.building] ||= { w: 0, h: 0 };
      bounds.w = Math.max(bounds.w, room.x + room.w + 2); bounds.h = Math.max(bounds.h, room.y + room.h + 2);
    }
  }
  if (legacy) { world.version = 2; world.revision++; }
  return world;
}
export function seedStarter(ctx) {
  ensureOffice(ctx.state, ctx.pack);
  const model = ctx.state.rooms[0];
  const room = ctx.state.officeWorld.rooms[model.id];
  if (!room.items.length) { room.w = 10; room.h = 9; room.door = 5; grantWorkplace(room, 'pc-kit-76'); ctx.state.officeWorld.revision++; }
}
export const price = (ctx, sku) => Math.round((SKU[sku]?.cost || 0) * Math.pow(ctx.pack.economy.inflation, (year(ctx) - ctx.pack.meta.startYear) * 0.35));
export function catalog(ctx, roomId) {
  const model = ctx.state.rooms.find((r) => r.id === roomId);
  return CATALOG.filter((s) => (!s.rooms || s.rooms.includes(model?.type)) && (!s.roles || s.roles.includes(model?.type)) && (model?.type !== 'tuvalet' || ['toilet', 'sink', 'fan', 'ac', 'plant'].includes(s.type)));
}
export function previewPlacement(ctx, roomId, proposal) {
  const room = ctx.state.officeWorld?.rooms[roomId], model = ctx.state.rooms.find((r) => r.id === roomId);
  if (!room || !model) return { ok: false, msg: 'Oda yok.' };
  const old = proposal?.id && room.items.find((f) => f.id === proposal.id);
  if (proposal?.id && !old) return { ok: false, msg: 'Eşya artık yok.' };
  const sku = proposal?.sku || old?.sku, product = SKU[sku];
  if (!product || product.type === 'computer' || product.type !== proposal.type || old && old.type !== proposal.type) return { ok: false, msg: 'Eşya modeli geçersiz.' };
  if ((!old || old.sku !== sku) && (!catalog(ctx, roomId).includes(product) || product.year > year(ctx))) return { ok: false, msg: product.year > year(ctx) ? `${product.name} ${product.year} yılında satışa çıkacak.` : 'Bu ekipman bu oda türüne uygun değil.' };
  if (!old && room.items.length >= 80) return { ok: false, msg: 'Bu odada eşya sınırına ulaştın.' };
  const computer = proposal.computer === undefined ? old?.computer || null : proposal.computer;
  const pc = computer && SKU[computer];
  if (computer && (product.type !== 'desk' || pc?.type !== 'computer')) return { ok: false, msg: 'Bilgisayar bir çalışma masasına kurulmalı.' };
  if (computer !== old?.computer && pc && pc.year > year(ctx)) return { ok: false, msg: `${pc.name} ${pc.year} yılında satışa çıkacak.` };
  const item = { ...(old || {}), type: product.type, sku, x: proposal.x, y: proposal.y, rotation: proposal.rotation, ...(old ? { id: old.id } : {}), ...(product.type === 'desk' ? { computer } : {}) };
  const valid = canPlace(room, item); if (!valid.ok) return valid;
  const newFloor = !old || old.sku !== sku, newPC = product.type === 'desk' && computer !== (old?.computer || null);
  const cost = (newFloor ? price(ctx, sku) : 0) + (newPC && pc ? price(ctx, pc.id) : 0);
  const refund = Math.round(((newFloor ? old?.paid || 0 : 0) + (newPC ? old?.computerPaid || 0 : 0)) * 0.35);
  item.paid = newFloor ? price(ctx, sku) : old.paid || 0;
  if (product.type === 'desk') item.computerPaid = newPC ? pc ? price(ctx, pc.id) : 0 : old?.computerPaid || 0;
  if (ctx.state.cash < cost - refund) return { ok: false, msg: `Satın alma için ${(cost - refund).toLocaleString('tr-TR')} $ gerekli.`, cost, refund };
  return { ok: true, item, cost, refund, net: cost - refund };
}
export function placeFurniture(ctx, roomId, proposal) {
  const q = previewPlacement(ctx, roomId, proposal); if (!q.ok) return q;
  const room = ctx.state.officeWorld.rooms[roomId];
  if (q.cost) ctx.ledger.post('ofis_donanim', -q.cost, SKU[q.item.sku].name);
  if (q.refund) ctx.ledger.post('ofis_esya_satis', q.refund, 'Eski ekipman takası');
  const old = q.item.id && room.items.find((f) => f.id === q.item.id);
  if (old) Object.assign(old, q.item); else insert(room, q.item);
  ctx.state.officeWorld.revision++; return { ok: true, cost: q.net };
}
export function removeFurniture(ctx, roomId, id) {
  const room = ctx.state.officeWorld?.rooms[roomId], item = room?.items.find((f) => f.id === id);
  if (!item) return { ok: false, msg: 'Eşya yok.' };
  const refund = Math.round(((item.paid || 0) + (item.computerPaid || 0)) * 0.35);
  if (refund) ctx.ledger.post('ofis_esya_satis', refund, SKU[item.sku]?.name || item.type);
  room.items = room.items.filter((f) => f.id !== id); ctx.state.officeWorld.revision++; return { ok: true, refund };
}
export function suggestFurniture(ctx, roomId, sku) {
  const room = ctx.state.officeWorld?.rooms[roomId], product = SKU[sku];
  if (!room || !product || product.type === 'computer') return null;
  const pos = freePosition(room, product.type); return pos ? { ...pos, sku } : null;
}
export function configureRoom(ctx, id, proposal) {
  const model = ctx.state.rooms.find((r) => r.id === id), old = ctx.state.officeWorld.rooms[id];
  if (!model || !old) return { ok: false, msg: 'Oda yok.' };
  const result = previewRoom(ctx, model.type, { ...old, ...proposal }, id); if (!result.ok) return result;
  const cost = result.cost;
  if (cost) ctx.ledger.post('ofis_tadilat', -cost, 'Oda alanı ve zemin');
  Object.assign(old, result.site); ctx.state.officeWorld.revision++; return { ok: true, cost };
}

// Tam iş istasyonu = masa + doğru yerde sandalye + bilgisayar. Bir sandalye tek kişiye aittir.
export function workstations(ctx, roomId) {
  const room = ctx.state.officeWorld?.rooms[roomId]; if (!room) return [];
  const used = new Set(), out = [];
  for (const desk of room.items.filter((f) => f.type === 'desk')) {
    const at = usePoint(desk), pc = SKU[desk.computer];
    const chair = room.items.find((f) => f.type === 'chair' && !used.has(f.id) && f.x === at.x && f.y === at.y && f.rotation === desk.rotation);
    if (chair && pc?.type === 'computer') { used.add(chair.id); out.push({ desk, chair, pc, point: at }); }
  }
  return out;
}
export function capacity(ctx, model) {
  if (model.type === 'tuvalet') return 0;
  const room = ctx.state.officeWorld?.rooms[model.id]; if (!room) return 0;
  return model.type === 'mola' ? room.items.filter((f) => f.type === 'sofa').reduce((a, f) => a + (SKU[f.sku]?.seats || 2), 0) : workstations(ctx, model.id).length;
}
export function workplace(ctx, person) {
  const index = ctx.state.staff.filter((p) => p.room === person.room).findIndex((p) => p.id === person.id);
  return workstations(ctx, person.room)[index] || null;
}
export const maxTech = (ctx, roomId) => roomId == null ? Math.max(0, ...ctx.state.rooms.filter((r) => r.type === 'gelistirme').map((r) => maxTech(ctx, r.id))) : Math.max(0, ...workstations(ctx, roomId).map((s) => s.pc.tech));

const geometryCache = new WeakMap();
export function worldPath(state, building, start, goal) {
  let cached = geometryCache.get(state);
  const revision = `${state.officeWorld.revision}:${state.office.tier}:${state.office.floors || 0}`;
  if (!cached || cached.rev !== revision) { cached = { rev: revision, blocked: new Map(), paths: new Map() }; geometryCache.set(state, cached); }
  const cacheKey = `${building}:${key(start)}:${key(goal)}`; if (cached.paths.has(cacheKey)) return cached.paths.get(cacheKey);
  let blocked = cached.blocked.get(building);
  if (!blocked) {
    blocked = new Set();
    for (const r of buildingRooms(state, building)) {
      const o = roomOrigin(r), { w, h } = sizeOf(r), d = doorOf(r);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x === 0 || y === 0 || x === w - 1 || y === h - 1) && !(x === d.x && y === h - 1)) blocked.add(`${o.x + x},${o.y + y}`);
      for (const cell of occupied(r.items, undefined, true)) { const [x, y] = cell.split(',').map(Number); blocked.add(`${o.x + x},${o.y + y}`); }
    }
    cached.blocked.set(building, blocked);
  }
  const plot = plotSize(state, building), result = bfs(start, goal, (x, y) => x >= 0 && y >= 0 && x < plot.w && y < plot.h && !blocked.has(`${x},${y}`));
  cached.paths.set(cacheKey, result); return result;
}
export const globalPoint = (room, local) => ({ x: roomOrigin(room).x + local.x, y: roomOrigin(room).y + local.y });
function facilities(ctx, types) {
  return Object.values(ctx.state.officeWorld.rooms).flatMap((r) => r.items.filter((f) => types.includes(f.type)).map((f) => ({ room: r, item: f, point: globalPoint(r, usePoint(f)) })));
}
const reportCache = new WeakMap();
export function workReport(ctx, person) {
  const signature = `${ctx.state.week}|${ctx.state.officeWorld?.revision}|${ctx.state.stationDown}|${ctx.state.office.tier}|${ctx.state.staff.map((p) => `${p.id}:${p.room}`).join(',')}`;
  let c = reportCache.get(ctx.state);
  if (!c || c.signature !== signature) { c = { signature, people: new Map() }; reportCache.set(ctx.state, c); }
  if (!c.people.has(person.id)) c.people.set(person.id, computeWorkReport(ctx, person));
  return c.people.get(person.id);
}
function computeWorkReport(ctx, person) {
  const room = ctx.state.officeWorld?.rooms[person.room], model = ctx.state.rooms.find((r) => r.id === person.room), station = workplace(ctx, person);
  if (!room || !model || !station) return { factor: 0, equipment: 0, conditions: 0, workShare: 0, temperature: 22, reasons: ['Tamamlanmış çalışma yeri yok: masa, sandalye ve bilgisayar gerekli.'], visits: [] };
  const currentYear = year(ctx), expected = expectedGeneration(currentYear), pc = station.pc;
  const computer = ctx.state.stationDown > 0 ? 0.45 : pc.power * (pc.reliability || 1) * Math.max(0.45, Math.pow(0.83, Math.max(0, expected - pc.generation)));
  const deskK = SKU[station.desk.sku]?.quality || 1, chairK = SKU[station.chair.sku]?.quality || 1;
  const department = Math.min(0.25, room.items.reduce((a, f) => a + (SKU[f.sku]?.roles?.includes(model.type) ? SKU[f.sku].bonus : 0), 0));
  const books = Math.min(0.03, room.items.filter((f) => f.type === 'shelf').length * 0.03);
  const plants = Math.min(0.03, room.items.filter((f) => f.type === 'plant').length * 0.01);
  const heat = room.items.filter((f) => f.type === 'desk').reduce((a, f) => a + (SKU[f.computer]?.heat || 0), 0);
  const cooling = Math.min(12, room.items.reduce((a, f) => a + (SKU[f.sku]?.cooling || 0), 0));
  const season = Math.sin((ctx.state.week % 48) / 48 * Math.PI * 2 - Math.PI / 2);
  const temperature = Math.max(20, 25 + season * 5 + heat * 0.65 - cooling);
  const thermal = clamp(1 - Math.max(0, temperature - 25) * 0.025, 0.7, 1);
  const n = ctx.state.staff.length, shared = ctx.state.office.tier === 1 && n <= 1;
  const toilets = facilities(ctx, ['toilet']).filter((x) => x.room.items.some((f) => f.type === 'sink'));
  const drinks = facilities(ctx, ['tea', 'coffee']), rests = facilities(ctx, ['sofa']);
  const available = new Map();
  const reasons = [], visits = [], from = globalPoint(room, station.point);
  let walkCells = 0;
  for (const [kind, candidates] of [['Tuvalet', toilets], ['Çay/kahve', drinks], ['Dinlenme', rests]]) {
    const reachable = candidates.map((f) => {
      const route = f.room.building === room.building ? worldPath(ctx.state, room.building, from, f.point) : null;
      return { ...f, distance: route ? route.length - 1 : f.room.building !== room.building ? 45 : Infinity };
    }).filter((f) => Number.isFinite(f.distance)).sort((a, b) => a.distance - b.distance);
    available.set(kind, reachable);
    if (reachable[0]) { const f = reachable[0]; walkCells += f.distance * 2; visits.push({ kind, roomId: f.room.roomId, itemId: f.item.id, building: f.room.building, point: f.point }); }
  }
  const toiletCap = available.get('Tuvalet').reduce((a, x) => a + (SKU[x.item.sku]?.service || 6), 0);
  const drinkCap = available.get('Çay/kahve').reduce((a, x) => a + (SKU[x.item.sku]?.service || 5), 0);
  const restCap = available.get('Dinlenme').reduce((a, x) => a + (SKU[x.item.sku]?.seats || 2), 0);
  const queue = shared ? 0 : (toiletCap ? Math.max(0, n / toiletCap - 1) * 0.025 : 0.08) + (drinkCap ? Math.max(0, n / drinkCap - 1) * 0.015 : 0.02);
  const rest = shared ? 1 : 0.94 + Math.min(0.06, restCap / Math.max(1, n) * 0.06);
  const workShare = clamp(1 - Math.min(0.1, walkCells * 0.0005) - Math.min(0.2, queue), 0.6, 1);
  const conditions = thermal * rest * (1 + plants);
  if (pc.generation < expected) reasons.push(`${pc.name}: döneminin gerisinde.`);
  if (temperature > 26) reasons.push(`Oda sıcak: ${Math.round(temperature)}°C. Pervane veya klima yardımcı olur.`);
  if (!shared && !toiletCap) reasons.push('Klozet ve lavabosu olan tuvalet yok.');
  if (!shared && restCap < n) reasons.push('Dinlenme koltukları yetersiz.');
  if (!shared && drinkCap < n) reasons.push('Çay/kahve hizmet kapasitesi yetersiz.');
  if (queue > 0.01) reasons.push('Hizmet bekleme süresi çalışma payını azaltıyor.');
  return { factor: computer * deskK * chairK * (1 + department + books) * conditions * workShare, equipment: computer * deskK * chairK * (1 + department + books), conditions, workShare, temperature, reasons, visits, station, shared, stress: (temperature > 26 ? 1 : 0) + (!shared && !restCap ? 1 : 0) - (restCap >= n ? 1 : 0) };
}
export function monthlyCost(ctx) {
  return Math.round(Object.values(ctx.state.officeWorld.rooms).reduce((a, r) => a + r.items.reduce((s, f) => s + (SKU[f.sku]?.running || 0) + (SKU[f.computer]?.running || 0), 0), 0) * Math.pow(ctx.pack.economy.inflation, (year(ctx) - ctx.pack.meta.startYear) * 0.35));
}
export function weekly(ctx) {
  ensureOffice(ctx.state, ctx.pack);
  if (ctx.state.week % 4 === 0) { const cost = monthlyCost(ctx); if (cost) ctx.ledger.post('ofis_isletme', -cost, 'Elektrik, su ve içecek giderleri'); }
}
