// Konu H: departmanlar ve müdürler. Her iş kendi yerine bağlanır (büyük kampanya pazarlama departmanı ister),
// müdürü olan oda otomatik çalışabilir, platformlara Kairosoft gibi bir kez lisans alınır.
import { clamp } from '../kernel.js';
import { inflation, platformById, activePlatforms, tableYear } from '../models.js';
import { hasRoom, managerOf, managersOpen, roomType } from './staff.js';
import { researchAvailable, researchInfo, startResearch } from './production.js';
import { playerReport } from './knowledge.js';

const P = (ctx) => ctx.pack.crew;

export function ensure(state) {
  state.platLic ||= { pc: true };
}
// Eski kayıt: o an piyasadaki ve kullanılmış her platform lisanslı sayılır (oyuncu bir şey kaybetmez).
export function migrate(state, ctxLike) {
  if (state.platLic) return;
  state.platLic = { pc: true };
  for (const g of [...(state.games || []), ...(state.projects || [])]) for (const id of g.platforms || []) state.platLic[id] = true;
  state.platLicAll = true; // ilk ayda o anki tüm platformlar lisanslanır
}

// ---------- Kampanyalar: küçük reklamı kurucu verir, büyükleri pazarlama departmanı
export const campaignAllowed = (ctx, c) => !c.dept || hasRoom(ctx, 'pazarlama');
export const campaignCost = (ctx, c) => Math.round(c.cost * inflation(ctx) ** 0.7);
export function campaign(ctx, pid, id) {
  const { state, pack, ledger, rng } = ctx;
  const c = pack.hype.campaigns.find((x) => x.id === id);
  const pj = state.projects.find((p) => p.id === pid);
  if (!pj || !c) return { ok: false, msg: 'Pazarlanacak proje yok.' };
  if (c.research && !state.research.done[c.research]) return { ok: false, msg: 'Araştırma gerekli.' };
  if (!campaignAllowed(ctx, c)) return { ok: false, msg: `${c.name} için pazarlama departmanı gerekli.` };
  const cc = campaignCost(ctx, c);
  ledger.post('pazarlama', -cc, `${c.name}: ${pj.name}`);
  pj.cost = (pj.cost || 0) + cc;
  pj.hype = clamp(pj.hype + c.hype, 0, pack.hype.max);
  // Fenomenler: büyük tur viral olabilir ya da oyunu gömebilir
  if (c.viral && rng.chance(c.viral.p)) { pj.hype = clamp(pj.hype + c.viral.hype, 0, pack.hype.max); state.fans += c.viral.fans; ctx.news(`🔥 "${pj.name}" fenomen turunda viral oldu!`, 'good'); }
  else if (c.flop && rng.chance(c.flop.p)) { pj.hype = clamp(pj.hype + c.flop.hype, 0, pack.hype.max); ctx.news(`🥶 Bir mega fenomen "${pj.name}" için "sıkıcı" dedi. Kampanya geri tepti.`, 'bad'); }
  return { ok: true };
}

// ---------- Platform lisansları
export const isLicensed = (ctx, id) => { const p = platformById(ctx, id); return !!p && (p.own || !!ctx.state.platLic[id]); };
export const licenseFee = (ctx, id) => { const p = platformById(ctx, id); return p ? Math.round(p.licence + p.devCost * P(ctx).licenseDevK) : 0; };
export function buyLicense(ctx, id) {
  const { state, ledger } = ctx;
  const p = platformById(ctx, id);
  if (!p || p.own) return { ok: false, msg: 'Platform yok.' };
  if (state.platLic[id]) return { ok: false, msg: 'Lisans zaten var.' };
  if (!activePlatforms(ctx).some((x) => x.id === id)) return { ok: false, msg: `${p.name} artık piyasada değil.` };
  const fee = licenseFee(ctx, id);
  if (state.cash < fee) return { ok: false, msg: `${p.name} lisansı ${fee.toLocaleString('tr-TR')} $.` };
  if (fee) ledger.post('platform_lisansi', -fee, p.name);
  state.platLic[id] = true;
  ctx.news(`📜 ${p.name} geliştirici lisansı alındı. Artık bu platforma oyun yapabilirsin.`, 'good');
  return { ok: true, fee };
}
export const unlicensed = (ctx, platforms) => (platforms || []).filter((id) => !isLicensed(ctx, id));

// ---------- Otomasyon (yalnız müdürü olan odada)
export function setAuto(ctx, roomId, on) {
  const room = ctx.state.rooms.find((r) => r.id === roomId);
  if (!room) return { ok: false, msg: 'Oda yok.' };
  if (!managerOf(ctx, room)) return { ok: false, msg: 'Önce bu odaya bir müdür ata.' };
  if (!AUTO[room.type]) return { ok: false, msg: 'Bu odanın otomatik işi yok.' };
  room.auto = !!on;
  return { ok: true };
}
export const AUTO = {
  arastirma: 'Sıradaki en ucuz araştırmayı müdür başlatır',
  pazarlama: 'Hype düşükse müdür bütçeye uygun kampanya verir',
  gelistirme: 'Müdür faz dağılımını ayarlar, faz penceresi çıkmaz',
  musteri: 'Her oyunun 4. haftasında oyuncu raporu hazırlanır',
};
const autoOn = (ctx, type) => managersOpen(ctx) && ctx.state.rooms.some((r) => r.type === type && r.auto && managerOf(ctx, r));
export const devAuto = (ctx, pj) => { const r = ctx.state.rooms.find((x) => x.id === pj.roomId); return !!(r && r.auto && managersOpen(ctx) && managerOf(ctx, r)); };

export function weekly(ctx) {
  const { state, pack } = ctx;
  ensure(state);
  const p = P(ctx);
  if (autoOn(ctx, 'arastirma') && !state.research.current) {
    const next = researchAvailable(ctx).filter((r) => !r.hw).map((r) => ({ r, i: researchInfo(ctx, r) })).sort((a, b) => a.i.rp - b.i.rp)[0];
    if (next && state.research.rp >= next.i.rp && state.cash > next.i.cost * p.autoResearchCashK) { const ok = startResearch(ctx, next.r.id).ok; if (ok) ctx.news(`🔬 Araştırma müdürü "${next.r.name}" araştırmasını başlattı.`, 'info'); }
  }
  if (autoOn(ctx, 'pazarlama')) {
    for (const pj of state.projects.filter((x) => x.status === 'dev' && x.hype < p.autoAdHype && state.week - (x.autoAdWeek ?? -99) >= p.autoAdWeeks)) {
      const c = pack.hype.campaigns.filter((x) => (!x.research || state.research.done[x.research]) && (!x.minYear || tableYear(ctx) >= x.minYear) && campaignAllowed(ctx, x) && campaignCost(ctx, x) * p.autoAdCashK < state.cash)
        .sort((a, b) => b.hype / campaignCost(ctx, b) - a.hype / campaignCost(ctx, a))[0];
      pj.autoAdWeek = state.week;
      if (c && campaign(ctx, pj.id, c.id).ok) ctx.news(`📣 Pazarlama müdürü "${pj.name}" için ${c.name.toLowerCase()} verdi.`, 'info');
    }
  }
  if (autoOn(ctx, 'musteri')) for (const g of state.games.filter((x) => x.active && !x.playerReport && x.weeks >= pack.playerReport.minWeeks)) playerReport(ctx, g.id);
}
export function monthly(ctx) {
  const { state, ledger } = ctx;
  ensure(state);
  // Müdür primi
  if (managersOpen(ctx)) {
    const prem = state.rooms.map((r) => managerOf(ctx, r)).filter(Boolean).reduce((a, m) => a + (m.salary || 0) * P(ctx).premium, 0);
    if (prem) ledger.post('mudur_primi', -Math.round(prem), 'Müdür primleri');
  }
  // Yeni platform haberi (eski kayıtta ilk ay: piyasadakilerin hepsi lisanslı)
  const act = activePlatforms(ctx).filter((x) => !x.own);
  if (state.platLicAll) { for (const x of act) state.platLic[x.id] = true; delete state.platLicAll; }
  const seen = (state.platSeen ||= null);
  if (!seen) { state.platSeen = Object.fromEntries(act.map((x) => [x.id, 1])); return; }
  for (const x of act) if (!seen[x.id]) {
    seen[x.id] = 1;
    if (!state.platLic[x.id]) ctx.news(`🆕 Yeni platform: ${x.name}. Lisansı Geliştir › Platform lisansları'ndan (${licenseFee(ctx, x.id).toLocaleString('tr-TR')} $).`, 'tarih');
  }
}
export const roomName = (ctx, r) => roomType(ctx, r.type).name;
