// Konsol savaşı: oyuncunun konsolları aynı segmentteki (ev konsolu, el konsolu, salon…) tarihsel platformlardan
// oyuncu çalar. Pay büyüdükçe rakip donanım şirketleri tepki verir (fiyat kırma, özel oyun, reklam savaşı), zayıf olanlar
// donanımdan çekilir. Üçüncü parti yayıncılar payına göre senin konsoluna da oyun çıkarır; özel oyun anlaşması yapılabilir.
import { clamp } from '../kernel.js';
import { tableYear, inflation, segmentOf, platformBaseRaw, ownPlatforms } from '../models.js';
import { companyById, companyRep } from './world.js';
import * as Platform from './platform.js';

const W = (ctx) => ctx.pack.war;
const liveOwn = (state) => (state.consoles || []).filter((k) => k.launched && !k.retired);

// Segment payları (aylık): her segmentte senin kurulu tabanın / (tarihsel tabanlar + senin taban).
export function updateShares(ctx) {
  const { state, pack } = ctx;
  const y = tableYear(ctx);
  const own = ownPlatforms(ctx).filter((p) => liveOwn(state).some((k) => k.id === p.id));
  const war = {};
  for (const p of own) {
    const seg = segmentOf(p);
    const k = state.consoles.find((x) => x.id === p.id);
    (war[seg] ||= { own: 0, hist: 0, share: 0, rivals: [] }).own += k.base || 0;
  }
  for (const seg in war) {
    const hist = pack.platforms.filter((p) => segmentOf(p) === seg).map((p) => ({ p, b: platformBaseRaw(ctx, p, y) })).filter((x) => x.b > 0);
    war[seg].hist = hist.reduce((a, x) => a + x.b, 0);
    war[seg].share = war[seg].own / Math.max(1e-9, war[seg].own + war[seg].hist);
    war[seg].rivals = hist.sort((a, b) => b.b - a.b).map((x) => ({ id: x.p.id, name: x.p.name, owner: x.p.owner, base: x.b }));
  }
  state.war = war;
  return war;
}

export function segmentShares(ctx, seg) {
  const w = ctx.state.war?.[seg];
  if (!w) return [];
  const steal = W(ctx).steal * w.share;
  const rows = w.rivals.map((r) => ({ name: r.name, owner: r.owner, base: r.base * (1 - steal) }));
  for (const p of ownPlatforms(ctx).filter((x) => segmentOf(x) === seg)) {
    const k = ctx.state.consoles.find((x) => x.id === p.id);
    if (k && !k.retired) rows.push({ name: k.name, base: k.base || 0, own: true });
  }
  const tot = rows.reduce((a, r) => a + r.base, 0) || 1;
  return rows.map((r) => ({ ...r, share: r.base / tot })).sort((a, b) => b.share - a.share);
}

// Aylık: rakip tepkileri ve donanımdan çekilme.
export function monthlyWar(ctx) {
  const { state, rng } = ctx;
  const c = W(ctx);
  const war = updateShares(ctx);
  const y = tableYear(ctx);
  for (const [seg, w] of Object.entries(war)) {
    const rivalOwners = [...new Set(w.rivals.map((r) => r.owner).filter(Boolean))];
    if (!rivalOwners.length) continue;
    for (const [at, kind, p] of c.reactAt) {
      if (w.share < at || !rng.chance(p)) continue;
      const who = companyById(rng.pick(rivalOwners));
      const name = who?.name || 'Bir rakip';
      const mod = kind === 'fiyat' ? c.priceCut : kind === 'ozel' ? c.exclusive : c.adWar;
      (state.consoleMods ||= []).push({ mult: mod.mult, untilWeek: state.week + mod.weeks, seg });
      ctx.news(kind === 'fiyat' ? `⚔️ ${name} konsolunun fiyatını kırdı. Konsol savaşı kızışıyor.`
        : kind === 'ozel' ? `⚔️ ${name}, büyük bir yayıncının yeni oyununu kendi konsoluna özel yaptı.`
          : `⚔️ ${name} senin konsolunla dalga geçen bir reklam kampanyası başlattı.`, 'warn');
      break;
    }
    // Zayıf rakip donanımdan çekilir (Segga'nın 2001'deki kaderi gibi): platformları erken biter, yayıncı olarak sana oyun yapar.
    if (w.share >= c.exitAt) {
      for (const owner of rivalOwners) {
        const co = companyById(owner);
        if (!co || companyRep(co, y) >= c.exitRepBelow || !rng.chance(c.exitChance)) continue;
        for (const r of w.rivals.filter((x) => x.owner === owner)) (state.platformEnd ||= {})[r.id] = Math.min(y + 0.5, ctx.pack.platforms.find((p) => p.id === r.id).to);
        for (const k of liveOwn(state).filter((x) => segmentOf({ kind: ctx.pack.console.types.find((t) => t.id === x.type)?.kind }) === seg)) k.thirdParty = (k.thirdParty || 0) + 5;
        ctx.news(`🏳️ ${co.name} konsol savaşını kaybetti ve donanımdan çekiliyor. Artık senin konsoluna da oyun yapacak!`, 'tarih');
        ctx.bus.fire('hwExit', co); // Konu G: stüdyoları satılık
        break;
      }
    }
  }
}

// Bir rakip oyun çıktığında: payın ve platform oranının çekiciliği kadar olasılıkla senin konsoluna da gelir (Konu G: satıştan yüzde).
export function thirdPartyRelease(ctx, studioName, gameName, big = false) {
  const { state, rng } = ctx;
  const c = W(ctx);
  const war = state.war || {};
  for (const k of liveOwn(state)) {
    const seg = segmentOf({ kind: ctx.pack.console.types.find((t) => t.id === k.type)?.kind });
    const share = war[seg]?.share || 0;
    if (!share || (k.thirdParty || 0) >= c.thirdPartyCap || !rng.chance(clamp(share * c.thirdPartyK * Platform.attract(ctx), 0, 0.9))) continue;
    k.thirdParty = (k.thirdParty || 0) + 1;
    Platform.tpRelease(ctx, k, studioName, gameName, big);
    if (big) ctx.news(`🎮 ${studioName}, "${gameName}" oyununu ${k.name} için de çıkardı.`, 'good');
  }
}

// Özel oyun anlaşması: büyük bir yayıncıya para verip konsoluna özel oyunlar aldırmak.
export const dealCost = (ctx) => Math.round(W(ctx).dealCost * inflation(ctx) ** 0.5);
export function exclusiveDeal(ctx, consoleId) {
  const { state, ledger } = ctx;
  const c = W(ctx);
  const k = state.consoles.find((x) => x.id === consoleId && x.launched && !x.retired);
  if (!k) return { ok: false, msg: 'Piyasada konsol yok.' };
  if (k.dealUntil && state.week < k.dealUntil + c.dealCooldown) return { ok: false, msg: 'Yayıncılar yeni anlaşma için biraz beklemek istiyor.' };
  const cost = dealCost(ctx);
  if (state.cash < cost) return { ok: false, msg: `Anlaşma ${cost.toLocaleString('tr-TR')} $.` };
  const pubs = state.rivals.filter((r) => r.pub && !r.hw && !r.acquired).sort((a, b) => b.rep - a.rep);
  const pub = pubs[0];
  ledger.post('konsol_anlasma', -cost, `${pub?.name || 'Yayıncı'} özel oyun anlaşması`);
  (state.consoleMods ||= []).push({ mult: c.dealMult, untilWeek: state.week + c.dealWeeks, console: k.id });
  k.thirdParty = (k.thirdParty || 0) + c.dealThirdParty;
  k.dealUntil = state.week + c.dealWeeks;
  ctx.news(`🤝 ${pub?.name || 'Büyük bir yayıncı'} yeni oyunlarını yalnızca ${k.name} için çıkaracak.`, 'good');
  return { ok: true };
}
