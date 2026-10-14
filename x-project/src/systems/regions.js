// Bölgeler (Konu C): ana bölge, dağıtım ağı, bölgesel hayran, dil ve yerelleştirme, yayıncı erişimi, korsanlık,
// yaş kurulları, bölgesel takvim ve bayramlar, dönem olayları, kur, bölge ofisi. Veri: data/regions.js.
// Bir oyunun bölgelere erişimi yayında game.reach'e yazılır; satış formülü (models.peakWeekly) onu okur.
import { clamp, lerpTable } from '../kernel.js';
import { REGIONS, HOMES, NET_LEVELS, LOC_LEVELS, TEXT_LOAD, BAD_LOC, HOLIDAYS, REGION_EVENTS, BOARDS } from '../data/regions.js';
import { tableYear, inflation, platformById, regionShares, regionBias, regionPref } from '../models.js';

export { REGIONS, HOMES, NET_LEVELS, LOC_LEVELS, HOLIDAYS, REGION_EVENTS, BOARDS };
export const R = (id) => REGIONS.find((r) => r.id === id);
export const IDS = REGIONS.map((r) => r.id);
export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const VIOLENT = ['askeri', 'zombi', 'korku', 'mafya', 'kiyamet', 'kurtadam'];
const DIGITAL_KINDS = ['pc', 'mobil', 'bulut'];
const fmt$ = (n) => `${Math.round(n).toLocaleString('tr-TR')} $`;

// ---------- Durum
export function ensure(state) {
  state.home ||= 'na';
  state.net ||= {};
  state.fanMix ||= { [state.home]: 1 };
  state.regMods ||= []; state.fxMods ||= []; state.bans ||= []; state.pirAdd ||= {}; state.regFired ||= {}; state.regRules ||= {};
  state.holiLast ??= -99;
  return state;
}
// Eski kayıtlar: 4 bölgeli dünyadan altı bölgeye. İngilizce sürüm her yere gidiyordu; ağ buna göre kurulur.
export function migrate(state) {
  const fresh = !state.home;
  ensure(state);
  if (!fresh) return;
  const d = state.research?.done || {};
  state.net = { eu: 2, jp: d.yerel_jp ? 2 : 0, latam: d.yerel_dunya ? 2 : 0, asya: d.yerel_dunya ? 2 : 0, tr: d.yerel_dunya ? 2 : 0 };
  state.fanMix = { na: 0.6, eu: 0.3, jp: d.yerel_jp ? 0.1 : 0 };
  const fix = (o) => {
    if (!o) return;
    if (Array.isArray(o.regions) && o.regions.includes('row')) o.regions = [...o.regions.filter((r) => r !== 'row'), 'latam', 'asya', 'tr'];
    if (o.regions && !o.loc) o.loc = Object.fromEntries(o.regions.filter((r) => r !== 'na').map((r) => [r, 1]));
    for (const k of ['regionSplit', 'regionSold']) if (o[k]?.row != null) { const v = o[k].row; delete o[k].row; o[k].asya = v * 0.6; o[k].latam = v * 0.3; o[k].tr = v * 0.1; }
  };
  for (const g of state.games || []) fix(g);
  for (const pj of state.projects || []) fix(pj);
}
export const home = (ctx) => ctx.state.home || 'na';
export const studioLang = (ctx) => ({ na: 'en', eu: 'en', jp: 'ja', tr: 'tr' })[home(ctx)] || 'en';
export const isNative = (ctx, rid) => rid === home(ctx) || R(rid).lang === studioLang(ctx);
export const netLevel = (ctx, rid) => (rid === home(ctx) ? 4 : ctx.state.net?.[rid] || 0);
const Y = (ctx) => tableYear(ctx);
const weeksFor = (ctx, w) => Math.round(w * (ctx.state.lengthMult || 1));

// Ana bölgenin maaş ve kira çarpanı (kur krizinde Türkiye maaşları dolar olarak ucuzlar)
export function payMult(ctx) {
  const r = R(home(ctx));
  let k = lerpTable(r.pay, Y(ctx));
  for (const f of ctx.state.fxMods || []) if (f.rid === r.id && f.pay && f.until > ctx.state.week) k *= f.v;
  return k;
}
export const rentMult = (ctx) => R(home(ctx)).rent;

// ---------- Erişim
export function distReach(ctx, rid, plats = []) {
  if (rid === home(ctx)) return 1.15; // yerli bonusu
  let v = NET_LEVELS[Math.min(3, netLevel(ctx, rid))].reach;
  const y = Y(ctx), kinds = plats.map((id) => platformById(ctx, id)?.kind).filter(Boolean);
  if (y >= 2014 || (y >= 2008 && kinds.some((k) => DIGITAL_KINDS.includes(k)))) v = Math.max(v, NET_LEVELS[2].reach); // dijital mağaza
  return v;
}
// Çevirisiz erişim: İngilizce oyun dünyada kısmen anlaşılır; diğer dillerde yalnız az metinli oyun (aksiyon, casual) geçer.
export function langReach(ctx, rid, loc = {}, genre = null) {
  if (isNative(ctx, rid)) return 1;
  const lv = loc?.[rid] || 0;
  if (lv >= 1) return LOC_LEVELS[lv].mult;
  const text = genre ? clamp(1.3 - 0.5 * (TEXT_LOAD[genre] ?? 1), 0.25, 1) : 1;
  return (studioLang(ctx) === 'en' ? lerpTable(R(rid).eng, Y(ctx)) : 0.35) * text;
}
export const pubCov = (pub, rid) => (!pub?.region ? 0.5 : pub.region[0] === rid ? 1 : pub.region.includes(rid) ? 0.7 : 0.3);
export function regionFans(ctx, rid) { return Math.round((ctx.state.fans || 0) * (ctx.state.fanMix?.[rid] || 0)); }
export function regionPower(ctx, rid) {
  const s = ctx.pack.sales, st = ctx.state;
  const room = st.rooms?.some((r) => r.type === 'pazarlama') ? ctx.pack.rooms.selfPublishBonus : 0;
  // Ün sınır tanımaz: hayranların bir kısmı her bölgede tanınırlık sayılır, gerisi o bölgede kazanılır
  const fans = 0.4 * (st.fans || 0) + 0.6 * regionFans(ctx, rid);
  return Math.min(100, Math.min(s.selfPublishPowerCap, s.selfPublishPowerBase + fans / s.selfPublishFansPerPower) + room);
}
export const selfY = (ctx, power) => ctx.pack.sales.selfA + ctx.pack.sales.selfB * (power / 100) ** ctx.pack.sales.selfExp;
const pubY = (ctx, power) => (ctx.pack.sales.yA + ctx.pack.sales.yB * power / 100) * (ctx.pack.sales.pubReach ?? 1);
export function boardActive(ctx, rid) { return BOARDS.find((b) => b.region === rid && Y(ctx) >= b.year) || null; }
export function ratingK(ctx, g, rid, loc = {}) {
  if ((loc?.[rid] || 0) >= 3) return 1;
  const y = Y(ctx), adult = ['aksiyon', 'nisanci', 'dovus'].includes(g.genre) && g.audience === 'yetiskin';
  if (rid === 'eu' && ctx.state.regRules?.siddet && adult) return 0.85;
  if (rid === 'jp' && y >= 1990 && adult && VIOLENT.includes(g.topic)) return 0.9;
  if (rid === 'asya' && y >= 2004 && (g.mmo || g.sub === 'mmorpg')) return 0.7;
  return 1;
}
const pirRate = (ctx, rid) => clamp(lerpTable(R(rid).piracy, Y(ctx)) + (ctx.state.pirAdd?.[rid] || 0), 0, 0.95);
export function pirK(ctx, g, rid) {
  const prot = g.model === 'f2p' || g.mmo ? 0.15 : ctx.state.research?.done?.kopya_koruma ? 0.6 : 1;
  const w = regionShares(ctx);
  const avg = IDS.reduce((a, r) => a + (w[r] || 0) * pirRate(ctx, r) * prot, 0);
  return clamp((1 - pirRate(ctx, rid) * prot) / Math.max(0.2, 1 - avg), 0.2, 1.6);
}
export const topicK = (g, rid) => (g.topic && R(rid).topics[g.topic]) || 1;

// Oyunun her bölgedeki erişimi. Kendi yayınında: dağıtım ağı × bölgesel yayın gücü × dil; yayıncıda: yayıncının bölge kapsamı × gücü.
// Bölgesel haklarda (deal.regions) yayıncının bölgeleri yayıncıdan, diğerleri kendi ağından satılır.
export function computeReach(ctx, g, { pub = null, deal = null } = {}) {
  const loc = g.loc || {}, out = {}, inDeal = {};
  const hasOwn = !!ctx.state.research?.done?.oz_yayin || g.kind === 'ek' || g.expansion;
  for (const rid of IDS) {
    const covered = deal && (deal.bargain || !deal.regions || deal.regions.includes(rid));
    let k;
    if (deal && covered) {
      inDeal[rid] = true;
      const cov = deal.bargain ? 0.5 : pubCov(pub, rid);
      const lang = pub?.region?.includes(rid) || deal.bargain ? 1 : langReach(ctx, rid, loc, g.genre);
      k = cov * lang * pubY(ctx, deal.bargain ? deal.power : pub?.power ?? deal.power ?? 50) * (rid === home(ctx) ? 1.15 : 1);
    } else if (!deal || hasOwn) {
      k = distReach(ctx, rid, g.platforms || []) * selfY(ctx, regionPower(ctx, rid)) * langReach(ctx, rid, loc, g.genre);
    } else k = NET_LEVELS[0].reach * 0.3;
    k *= ratingK(ctx, g, rid, loc) * pirK(ctx, g, rid) * topicK(g, rid) * (g.badLoc?.[rid] || 1);
    out[rid] = Math.round(k * 10000) / 10000;
  }
  return { reach: out, inDeal };
}
export function applyReach(ctx, g, pub, deal) {
  const { reach, inDeal } = computeReach(ctx, g, { pub, deal });
  g.reach = reach; g.inDeal = Object.keys(inDeal);
  return g;
}
// Satışın bölgelere dağılımından yayıncıya düşen pay (bölgesel haklarda gelir ayrımı için)
export function dealShare(g) {
  if (!g.deal || !g.deal.regions || !g.regionSplit) return 1;
  return g.deal.regions.reduce((a, r) => a + (g.regionSplit[r] || 0), 0);
}
// Proje için beklenen bölge dağılımı (takvim ve mevsim hesabı)
export function projectSplit(ctx, pj) {
  const w = regionShares(ctx);
  const reach = pj.reach || computeReach(ctx, { ...pj, selfPub: true }, pj.deal ? { deal: pj.deal, pub: { region: pj.deal.region, power: pj.deal.power } } : {}).reach;
  const raw = Object.fromEntries(IDS.map((r) => [r, (w[r] || 0) * regionPref(ctx, R(r), pj.genre) * (reach[r] || 0)]));
  const sum = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  for (const r in raw) raw[r] /= sum;
  return raw;
}
const splitOf = (ctx, g) => g.regionSplit || g.split || projectSplit(ctx, g);

// ---------- Takvim ve bayramlar
export const weekIdx = (ctx, w = ctx.state.week) => w % 48; // 0..47 = ay*4 + hafta
function moveDay(kind, year) {
  if (kind === 'ramazan') return (((267 - 10.875 * (year - 1976)) % 365) + 365) % 365;
  if (kind === 'kurban') return (((337 - 10.875 * (year - 1976)) % 365) + 365) % 365;
  if (kind === 'ayyili') return 21 + ((year * 11) % 30);
  return 0;
}
export function holidayStart(h, year) {
  if (h.move) { const d = moveDay(h.move, year), m = Math.min(11, Math.floor(d / 30.42)); return m * 4 + Math.min(3, Math.floor((d - m * 30.42) / 7.61)); }
  return h.when.m * 4 + h.when.w;
}
export function holidayOn(h, year) { return year >= (h.from || 0) && (!h.every || (year - (h.from || 1976)) % h.every === 0); }
// Bu hafta (ya da verilen haftada) süren bayramlar
export function activeHolidays(ctx, w = ctx.state.week) {
  const year = Math.floor(Y(ctx)), i = w % 48;
  return HOLIDAYS.filter((h) => !h.fairNote && holidayOn(h, year) && i >= holidayStart(h, year) && i < holidayStart(h, year) + (h.weeks || 1));
}
export function upcomingHolidays(ctx, n = 6) {
  const year = Math.floor(Y(ctx)), i = weekIdx(ctx);
  return HOLIDAYS.filter((h) => !h.fairNote && holidayOn(h, year)).map((h) => ({ h, in: holidayStart(h, year) - i })).filter((x) => x.in >= 0).sort((a, b) => a.in - b.in).slice(0, n);
}
function holidayK(ctx, g, rid, list) {
  let k = 1;
  for (const h of list) {
    if (h.region !== rid && h.region !== 'all' && !h.also?.[rid]) continue;
    k *= h.demand || 1;
    if (h.topics?.[g.topic]) k *= h.topics[g.topic];
    if (h.aud?.[g.audience]) k *= h.aud[g.audience];
  }
  return k;
}
function modK(ctx, rid, key) {
  let k = 1;
  for (const m of ctx.state.regMods || []) if (m.rid === rid && m.until > ctx.state.week) k *= m[key] ?? 1;
  return k;
}
function banK(ctx, g, rid) {
  const ban = (ctx.state.bans || []).find((b) => b.rid === rid && Y(ctx) < b.until);
  if (!ban) return 1;
  const kinds = (g.platforms || []).map((id) => platformById(ctx, id)?.kind);
  const hit = kinds.filter((k) => ban.kinds.includes(k)).length / Math.max(1, kinds.length);
  return 1 - 0.95 * hit;
}
const dyn = (ctx, g, rid, list) => holidayK(ctx, g, rid, list) * modK(ctx, rid, 'demand') * banK(ctx, g, rid);
// Bu haftanın bölgesel talep çarpanı (bayram, kampanya, yasak) — satış dağılımıyla ağırlıklı
export function weekK(ctx, g) {
  const sp = splitOf(ctx, g), list = activeHolidays(ctx);
  return IDS.reduce((a, r) => a + (sp[r] || 0) * dyn(ctx, g, r, list), 0) || 1;
}
// Kopya başı gelir çarpanı: bölgenin fiyat endeksi, kur ve kampanya indirimi (dünya ortalamasına göre)
export function revK(ctx, g) {
  const sp = splitOf(ctx, g), list = activeHolidays(ctx), w = regionShares(ctx);
  const avgPrice = IDS.reduce((a, r) => a + (w[r] || 0) * R(r).price, 0) || 1;
  let num = 0, den = 0;
  for (const r of IDS) {
    const u = (sp[r] || 0) * dyn(ctx, g, r, list);
    let fx = 1;
    for (const f of ctx.state.fxMods || []) if (f.rid === r && f.until > ctx.state.week) fx *= f.v;
    num += u * (R(r).price / avgPrice) * fx * modK(ctx, r, 'rev'); den += u;
  }
  return den ? num / den : 1;
}
// Bölgesel mevsim: aylık talep, satış dağılımıyla ağırlıklı (charts.seasonMult bunu kullanır)
export function seasonK(ctx, g, m) {
  const sp = splitOf(ctx, g);
  return IDS.reduce((a, r) => a + (sp[r] || 0) * R(r).season[m], 0) || 1;
}

// ---------- Hamleler: dağıtım ağı ve yerelleştirme
export function netCost(ctx, rid, lv) { return Math.round((NET_LEVELS[lv].cost || 0) * inflation(ctx) ** 0.6 * (lv >= 2 ? 0.5 + 2 * (lerpTable(R(rid).weight, Y(ctx))) : 1)); }
export function netCheck(ctx, rid, lv) {
  const st = ctx.state, L = NET_LEVELS[lv];
  if (rid === home(ctx)) return { ok: false, why: 'Ana bölgen zaten senin.' };
  if (!L || lv !== netLevel(ctx, rid) + 1) return { ok: false, why: 'Önce bir önceki seviye.' };
  if (L.research && !st.research.done[L.research]) return { ok: false, why: '"İhracat ve posta siparişi" araştırması gerekli.' };
  if (lv === 2 && regionFans(ctx, rid) < L.fans * inflation(ctx) ** 0.2 && !ctx.pubKnowsRegion?.(rid)) return { ok: false, why: `O bölgede ${Math.round(L.fans * inflation(ctx) ** 0.2).toLocaleString('tr-TR')} hayran ya da o bölgeden "Tanıdık" bir yayıncı gerekli.` };
  if (lv === 3 && st.office.tier < L.office) return { ok: false, why: 'Bölge ofisi için en az ikinci ofis kademesi gerekli.' };
  const cost = netCost(ctx, rid, lv);
  if (st.cash < cost) return { ok: false, why: `${fmt$(cost)} gerekli.` };
  return { ok: true, cost };
}
export function buyNet(ctx, rid) {
  const lv = netLevel(ctx, rid) + 1, c = netCheck(ctx, rid, lv);
  if (!c.ok) return { ok: false, msg: c.why };
  ctx.ledger.post('dagitim', -c.cost, `${R(rid).name}: ${NET_LEVELS[lv].name}`);
  ctx.state.net[rid] = lv;
  const lines = { 1: `📮 ${R(rid).name}'ya posta siparişi başladı. ${R(rid).host}: "Kargo kutusu yolda, ama sabır gerek."`,
    2: `🚚 ${R(rid).name}'da bir distribütörle anlaştın. ${R(rid).host}: "Artık raflardasın!"`,
    3: `🏢 ${R(rid).name}'da bölge ofisi açıldı! Yerel ekip ve yerli bonusu.` };
  ctx.news(lines[lv], 'good');
  ctx.bus.fire('regionNet', { rid, lv });
  return { ok: true };
}
export function locCostOf(ctx, rid, pj, lv) {
  const size = ctx.pack.sizes.find((s) => s.id === pj.size);
  const r = R(rid), L = LOC_LEVELS[lv];
  if (!L?.k || isNative(ctx, rid)) return 0;
  const cur = pj.loc?.[rid] || 0;
  const prev = cur >= 1 ? LOC_LEVELS[cur].k : 0;
  return Math.round(Math.max(1500, r.locBase || 4000) * Math.max(0.3, size.devCost) * (TEXT_LOAD[pj.genre] || 1) * (L.k - prev) * inflation(ctx) ** 0.5 * (pj.kind === 'ek' ? 0.5 : 1));
}
export function locCheck(ctx, rid, pj, lv) {
  if (isNative(ctx, rid)) return { ok: false, why: 'Oyun zaten bu bölgenin dilinde.' };
  if ((pj.loc?.[rid] || 0) >= lv) return { ok: false, why: 'Bu seviye zaten var.' };
  const need = rid === 'jp' ? 'yerel_jp' : ['latam', 'asya'].includes(rid) ? 'yerel_dunya' : null;
  if (need && !ctx.state.research.done[need]) return { ok: false, why: need === 'yerel_jp' ? 'Japonca ekibi için araştırma gerekli.' : 'Dünya dilleri için araştırma gerekli.' };
  const cost = locCostOf(ctx, rid, pj, lv);
  if (ctx.state.cash < cost) return { ok: false, why: `${fmt$(cost)} gerekli.` };
  return { ok: true, cost };
}
// Yerelleştirme (projede: eş zamanlı çıkış; yayında: kademeli çıkış ve ikinci dalga)
export function localize(ctx, pid, rid, lv = 1, isGame = false) {
  const st = ctx.state;
  const o = isGame ? st.games.find((x) => x.id === pid) : st.projects.find((x) => x.id === pid);
  if (!o) return { ok: false, msg: 'Bulunamadı.' };
  if (isGame && !o.active) return { ok: false, msg: 'Oyun artık satışta değil.' };
  const c = locCheck(ctx, rid, o, lv);
  if (!c.ok) return { ok: false, msg: c.why };
  ctx.ledger.post('yerellestirme', -c.cost, `${o.name}: ${R(rid).name} · ${LOC_LEVELS[lv].name}`);
  if (isGame) o.postCost = (o.postCost || 0) + c.cost; else o.cost = (o.cost || 0) + c.cost;
  (o.loc ||= {})[rid] = lv;
  o.regions = [...new Set([...(o.regions || []), rid])];
  if (lv === 1 && ctx.rng.chance(0.15)) {
    const good = ctx.rng.chance(0.5);
    (o.badLoc ||= {})[rid] = good ? 1.1 : 0.9;
    ctx.news(`🤦 Çeviri hatası (${R(rid).name}): ${ctx.rng.pick(BAD_LOC)} ${good ? 'Hayranlar bayıldı, paylaşılıyor!' : 'Satışlar biraz etkilenecek.'}`, good ? 'good' : 'bad');
  } else if (o.badLoc?.[rid]) delete o.badLoc[rid];
  if (isGame) refreshGame(ctx, o, `🌍 "${o.name}" ${R(rid).name}'da çıktı: ikinci dalga başladı.`);
  return { ok: true };
}
// Yayındaki oyunun erişimi değişince (geç yerelleştirme, yeni ağ) zirve yeniden ölçeklenir.
export function refreshGame(ctx, g, msg, kick = 0.03) {
  if (!g.reach) return;
  const old = { ...g.reach };
  const pub = g.deal ? { power: g.deal.power, region: g.deal.region } : null;
  applyReach(ctx, g, pub, g.deal?.bargain ? g.deal : g.deal || null);
  const w = regionShares(ctx);
  const sum = (reach) => IDS.reduce((a, r) => a + (w[r] || 0) * regionPref(ctx, R(r), g.genre) * (reach[r] || 0), 0);
  const k = sum(g.reach) / Math.max(1e-6, sum(old));
  if (k > 1.001) {
    for (const id in g.peak) g.peak[id] *= k;
    if (g.dif) { g.dif.F = Math.max(0, g.dif.F * (1 / k)); g.dif.kick += kick; }
    if (msg) ctx.news(msg, 'good');
  }
}

// ---------- Yayın: hayranlar bölgelere, haber ve etiketler
export function onRelease(ctx, g, dFans) {
  const st = ctx.state, sp = g.regionSplit || {};
  if (dFans > 0) addFans(ctx, dFans, sp);
  const tags = BOARDS.filter((b) => Y(ctx) >= b.year && (sp[b.region] || 0) > 0.02).map((b) => `${R(b.region).flag} ${b.name}: ${g.audience === 'yetiskin' ? '"Yetişkin"' : g.audience === 'genc' ? '"Genç"' : '"Herkes"'}`);
  const cut = IDS.filter((r) => ratingK(ctx, g, r, g.loc) < 1 && (sp[r] || 0) > 0.02);
  if (tags.length) ctx.news(`🏷️ Yaş etiketleri · ${tags.join(' · ')}${cut.length ? ` · ⚠️ ${cut.map((r) => R(r).name).join(', ')}'da kısıtlama: kültürelleştirme aşar.` : ''}`, cut.length ? 'warn' : 'info');
  const top = Object.entries(sp).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0.01).slice(0, 3);
  if (top.length) g.regionNote = top.map(([r, v]) => `${R(r).flag} %${Math.round(v * 100)}`).join(' ');
}
export function addFans(ctx, n, split) {
  const st = ctx.state, mix = st.fanMix || {};
  const tot = st.fans || 0, before = Math.max(0, tot - n);
  const out = {};
  for (const r of IDS) out[r] = ((mix[r] || 0) * before + (split[r] || 0) * n) / Math.max(1, tot);
  const s = Object.values(out).reduce((a, b) => a + b, 0) || 1;
  for (const r in out) out[r] /= s;
  st.fanMix = out;
}

// ---------- Haftalık akış: dönem olayları, bayram diyalogları, fuarlar
function presence(ctx, rid) {
  const st = ctx.state;
  if (rid === 'all' || rid === home(ctx)) return true;
  if ((st.fanMix?.[rid] || 0) >= 0.05 || netLevel(ctx, rid) >= 1) return true;
  return st.games.some((g) => g.active && (g.regionSplit?.[rid] || 0) >= 0.1);
}
function fireEvent(ctx, e) {
  const st = ctx.state;
  st.regFired[e.id] = true;
  if (e.mod) st.regMods.push({ rid: e.region, demand: e.mod.demand, rev: 1, until: st.week + weeksFor(ctx, e.mod.weeks), src: e.id });
  if (e.fx) st.fxMods.push({ rid: e.region, v: e.fx.v, until: st.week + weeksFor(ctx, e.fx.weeks), pay: !!e.payFx, src: e.id });
  if (e.ban) st.bans.push({ rid: e.region, kinds: e.ban.kinds, until: e.ban.until });
  if (e.rule) st.regRules[e.rule] = true;
  if (e.pirate) st.pirAdd[e.region] = (st.pirAdd[e.region] || 0) + e.pirate;
  if (e.fans && presence(ctx, e.region)) { st.fans += e.fans; addFans(ctx, e.fans, { [e.region]: 1 }); }
  const r = R(e.region);
  if (presence(ctx, e.region) && (e.region === home(ctx) || ctx.rng.chance(0.5)))
    ctx.queue({ id: 'region_' + e.id, title: `${r.flag} ${e.title}`, text: e.text, choices: [{ label: 'Anlaşıldı', effects: {} }] });
  else ctx.news(`${r.flag} ${e.title}: ${e.text}`, 'tarih');
}
function holidayDialogs(ctx) {
  const st = ctx.state, year = Math.floor(Y(ctx)), i = weekIdx(ctx);
  const starting = HOLIDAYS.filter((h) => !h.fairNote && holidayOn(h, year) && holidayStart(h, year) === i);
  for (const h of starting) {
    const rel = h.region === 'all' ? true : h.dialog === 'home' ? h.region === home(ctx) : presence(ctx, h.region);
    const rname = h.region === 'all' ? '🌍' : R(h.region).flag;
    if (!rel) continue;
    const canDialog = h.variants && st.week - st.holiLast >= 4 && !st.pending.some((p) => p.id?.startsWith('holiday_'))
      && (h.region === 'all' ? true : h.dialog === 'home' ? h.region === home(ctx) : true);
    const p = h.fair ? 0.9 : h.dialog === 'home' || h.region === 'all' ? 0.6 : 0.35;
    if (canDialog && ctx.rng.chance(p)) {
      const v = ctx.rng.pick(h.variants);
      st.holiLast = st.week;
      ctx.queue({ id: 'holiday_' + h.id, title: `${v.title}`, text: `${rname} ${h.name}. ${v.text}`, choices: v.choices });
    } else if ((h.demand || 1) >= 1.2 || h.region === home(ctx)) ctx.news(`${h.icon} ${rname} ${h.name}${h.demand && h.demand !== 1 ? `: o bölgede satış ×${String(h.demand).replace('.', ',')}` : ''}.`, 'info');
  }
}
export function weekly(ctx) {
  const st = ensure(ctx.state), y = Y(ctx);
  for (const e of REGION_EVENTS) if (!st.regFired[e.id] && y >= e.year) fireEvent(ctx, e);
  holidayDialogs(ctx);
  st.regMods = st.regMods.filter((m) => m.until > st.week);
  st.fxMods = st.fxMods.filter((m) => m.until > st.week);
  if (st.week % 4 === 0) monthly(ctx);
}
function monthly(ctx) {
  const st = ctx.state;
  // Hayran dağılımı, satılan bölgelere doğru kayar
  const sales = {};
  let tot = 0;
  for (const g of st.games) if (g.active && g.lastWeek && g.regionSplit) for (const r in g.regionSplit) { const v = g.lastWeek * g.regionSplit[r]; sales[r] = (sales[r] || 0) + v; tot += v; }
  if (tot > 0) {
    const mix = st.fanMix || {}, out = {};
    for (const r of IDS) out[r] = (mix[r] || 0) * 0.95 + 0.05 * (sales[r] || 0) / tot;
    const s = Object.values(out).reduce((a, b) => a + b, 0) || 1;
    for (const r in out) out[r] /= s;
    st.fanMix = out;
  }
  // Bölge ofislerinin kirası
  for (const r of IDS) if (netLevel(ctx, r) === 3) ctx.ledger.post('kira', -Math.round(NET_LEVELS[3].rent * inflation(ctx) * R(r).rent), `${R(r).name} ofisi`);
}
export const offices = (ctx) => IDS.filter((r) => netLevel(ctx, r) === 3);
export const sunK = (ctx) => (offices(ctx).length ? 1.15 : 1);
// Ofis bölgesinden aday: maaşı o bölgenin ücret düzeyine göre
export function payRatio(ctx, rid) { return lerpTable(R(rid).pay, Y(ctx)) / Math.max(0.1, lerpTable(R(home(ctx)).pay, Y(ctx))); }

// Olay seçeneklerindeki bölgesel efektler
export function wire(ctx) {
  ctx.bus.on('regMod', (m) => ctx.state.regMods.push({ rid: m.rid === 'home' ? home(ctx) : m.rid, demand: m.demand ?? 1, rev: m.rev ?? 1, until: ctx.state.week + (m.weeks || 1), src: 'kampanya' }));
  ctx.bus.on('regFans', (x) => { const n = Math.round(x.v * Math.max(1, inflation(ctx) ** 0.3)); ctx.state.fans += n; addFans(ctx, n, { [x.rid]: 1 }); });
}
