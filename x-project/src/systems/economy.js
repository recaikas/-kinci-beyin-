// Ekonomi: maaş, kira, kredi, iflas, ofis/istasyon yatırımı, motor lisansı, kaos ölçeri.
import { clamp, lerpTable } from '../kernel.js';
import { inflation, eraMult, salaryFor, tableYear, engineScore } from '../models.js';
import { seats, slots } from './staff.js';

export const office = (ctx) => ctx.pack.offices.find((o) => o.tier === ctx.state.office.tier);

export function rent(ctx) {
  const o = office(ctx);
  return Math.round((o.rent + (ctx.state.office.floors || 0) * (o.floorRent || 0)) * inflation(ctx) * ctx.state.rentMult * designRentMult(ctx));
}
// --- Ofis tasarımları: her binanın kendi tasarımı; kira çarpanı oda sayısına göre ağırlıklı.
export const designById = (ctx, id) => ctx.pack.designs.find((d) => d.id === id) || ctx.pack.designs[0];
export const buildingRooms = (ctx, bid) => { const b = ctx.pack.buildings.find((x) => x.id === bid); return ctx.state.rooms.filter((r) => b.types.includes(r.type)); };
export function designRentMult(ctx) {
  const rooms = ctx.state.rooms;
  if (!rooms.length) return 1;
  let sum = 0;
  for (const b of ctx.pack.buildings) sum += buildingRooms(ctx, b.id).length * designById(ctx, ctx.state.designs?.[b.id]).rentMult;
  return sum / rooms.length;
}
export const designCost = (ctx, bid, did) => Math.round(designById(ctx, did).cost * Math.max(1, buildingRooms(ctx, bid).length) * inflation(ctx) ** 0.5);
export function setDesign(ctx, bid, did) {
  const { state, ledger, pack } = ctx;
  const d = pack.designs.find((x) => x.id === did);
  if (!d || !pack.buildings.some((b) => b.id === bid)) return { ok: false, msg: 'Geçersiz.' };
  if ((state.designs?.[bid] || 'standart') === did) return { ok: true };
  const cost = designCost(ctx, bid, did);
  if (state.cash < cost) return { ok: false, msg: `${d.name} ${cost.toLocaleString('tr-TR')} $.` };
  if (cost) ledger.post('dekor', -cost, `${pack.buildings.find((b) => b.id === bid).name}: ${d.name}`);
  (state.designs ||= {})[bid] = did;
  ctx.news(`🛋️ ${pack.buildings.find((b) => b.id === bid).name} yeniden döşendi: ${d.name}.`, 'good');
  return { ok: true };
}

export function creditLimit(ctx) {
  const e = ctx.pack.economy;
  return Math.round((e.creditBase * inflation(ctx) + ctx.state.fans * e.creditPerFan) * (ctx.state.creditK ?? eraMult(ctx, 'creditMult')));
}

export function monthlyEconomy(ctx) {
  const { state, pack, ledger } = ctx;
  const wages = state.staff.reduce((s, p) => s + p.salary, 0);
  if (wages) ledger.post('maas', -wages, `${state.staff.length} kişi`);
  ledger.post('kira', -rent(ctx), office(ctx).name);
  // Lüks ofis ziyaretçileri etkiler (küçük prestij)
  for (const b of pack.buildings) { const d = designById(ctx, state.designs?.[b.id]); if (d.prestige && buildingRooms(ctx, b.id).length) state.prestige = Math.min(pack.prestige.max, state.prestige + d.prestige / 12); }
  for (const l of state.loans) {
    const pay = Math.min(l.remaining, l.monthly);
    ledger.post('kredi', -pay, 'Taksit');
    l.remaining -= pay;
  }
  state.loans = state.loans.filter((l) => l.remaining > 1);
  if (state.cash < 0) ledger.post('faiz', Math.round(state.cash * pack.economy.loanRateYear * 1.5 / 12), 'Kredili mevduat faizi');
  // Motor lisansı geliri
  const exp = lerpTable(pack.engine.expected, tableYear(ctx));
  for (const e of state.engines) {
    if (!e.licensed) continue;
    const sc = engineScore(ctx, e);
    if (exp > 0 && sc < exp * pack.engine.licenceMinRatio) continue;
    ledger.post('lisans', Math.round(sc * pack.engine.licenceIncomePerPoint * inflation(ctx) ** 0.5), e.name);
  }
}

export function weeklySolvency(ctx) {
  const { state, pack } = ctx;
  // Kriz dönemlerinde kredi limiti bir gecede değil, haftalar içinde daralır (oyuncu tepki verebilsin).
  const target = eraMult(ctx, 'creditMult');
  const k = state.creditK ?? 1;
  state.creditK = Math.abs(target - k) < pack.economy.creditStep ? target : k + Math.sign(target - k) * pack.economy.creditStep;
  if (state.cash < -creditLimit(ctx)) {
    state.debtWeeks++;
    if (state.debtWeeks === 1) ctx.news(`🚨 Kredi limitini aştın! ${pack.economy.bankruptWeeks} hafta içinde toparlanmazsan iflas.`, 'bad');
    if (state.debtWeeks >= pack.economy.bankruptWeeks) state.gameOver = { reason: 'iflas', text: 'Banka kapıya kilit vurdu. Sunucular kapandı, kedi bile gitti.' };
  } else state.debtWeeks = 0;
}

export function takeLoan(ctx, amount) {
  const { state, pack, ledger } = ctx;
  const e = pack.economy;
  const max = creditLimit(ctx) * 3;
  const owed = state.loans.reduce((s, l) => s + l.remaining, 0);
  if (amount <= 0 || owed + amount > max) return { ok: false, msg: `Banka en fazla ${Math.max(0, max - owed).toLocaleString('tr-TR')} $ veriyor.` };
  const r = e.loanRateYear / 12;
  const monthly = Math.round((amount * r) / (1 - Math.pow(1 + r, -e.loanMonths)));
  state.loans.push({ amount, monthly, remaining: monthly * e.loanMonths });
  ledger.post('kredi', amount, 'Kredi çekildi');
  ctx.news(`🏦 ${amount.toLocaleString('tr-TR')} $ kredi çekildi. Aylık taksit ${monthly.toLocaleString('tr-TR')} $.`, 'info');
  return { ok: true };
}

export function moveOffice(ctx) {
  const { state, pack, ledger } = ctx;
  const next = pack.offices.find((o) => o.tier === state.office.tier + 1);
  if (!next) return buyFloor(ctx);
  const cost = Math.round(next.cost * inflation(ctx) ** 0.5);
  if (state.cash < cost) return { ok: false, msg: `${next.name} için ${cost.toLocaleString('tr-TR')} $ gerekli.` };
  ledger.post('ofis', -cost, next.name);
  state.office.tier = next.tier;
  state.rentMult = 1;
  ctx.news(`🏠 Yeni mekân: ${next.name}! ${next.slots} oda alanı, oda başına ${next.roomSeats} koltuk. Ofis sekmesinden oda kur.`, 'good');
  ctx.bus.fire('facilityUpgraded', next);
  for (const p of state.staff) p.morale = clamp(p.morale + 10, 0, 100);
  return { ok: true };
}

export function buyFloor(ctx) {
  const { state, ledger } = ctx;
  const o = office(ctx);
  if (!o.floorCost || state.office.floors >= o.maxFloors) return { ok: false, msg: 'Daha fazla büyüyemezsin.' };
  const cost = Math.round(o.floorCost * inflation(ctx) ** 0.5);
  if (state.cash < cost) return { ok: false, msg: `Yeni kat ${cost.toLocaleString('tr-TR')} $.` };
  ledger.post('ofis', -cost, 'Yeni kat');
  state.office.floors++;
  ctx.news(`🏗️ Kampüse yeni kat eklendi. Toplam ${slots(ctx)} oda alanı.`, 'good');
  return { ok: true };
}

export function stationUpgradeCost(ctx) {
  const ws = ctx.pack.workstations;
  const next = ctx.state.stationTier + 1;
  if (next >= ws.tiers.length) return null;
  // Koltuk başına birkaç aylık maaş: kademe arttıkça pahalılaşır ama dönemini yakalamak her stüdyo için mümkün kalır.
  const perSeat = ws.costSalaryMonths * salaryFor(ctx, 50) * (1 + ws.costTierK * next);
  return Math.round(perSeat * seats(ctx));
}
export function upgradeStations(ctx) {
  const { state, pack, ledger } = ctx;
  const cost = stationUpgradeCost(ctx);
  if (cost == null) return { ok: false, msg: 'En iyi istasyonlara sahipsin.' };
  if (state.cash < cost) return { ok: false, msg: `Yükseltme ${cost.toLocaleString('tr-TR')} $.` };
  ledger.post('donanim', -cost, 'İş istasyonları');
  state.stationTier++;
  ctx.news(`🖥️ Yeni bilgisayarlar: ${pack.workstations.tiers[state.stationTier].name}`, 'good');
  return { ok: true };
}

// Kaos ölçeri: kadro, yıl, crunch, borç, stres ve skandal ısısından.
export function weeklyChaos(ctx) {
  const { state, pack } = ctx;
  const c = pack.chaos;
  const n = state.staff.length;
  const avgStress = n ? state.staff.reduce((s, p) => s + p.stress, 0) / n : 0;
  const traitChaos = state.staff.reduce((s, p) => {
    return s + [p.trait, p.trait2].reduce((a, id) => a + ((id && pack.traits.find((x) => x.id === id)?.chaos) || 0), 0);
  }, 0);
  state.heat = Math.max(0, state.heat - c.heatDecay);
  const years = tableYear(ctx) - pack.meta.startYear;
  const raw = c.base + n * c.perStaff + years * c.perYear + (state.crunch ? c.crunch : 0) + (state.cash < 0 || state.loans.length ? c.debt : 0) + avgStress * c.stressK + traitChaos + state.heat;
  state.kaos = clamp(raw, 0, c.max);
  if (state.stationDown > 0) state.stationDown--;
}
