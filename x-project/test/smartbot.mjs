// Akıllı politika botu: denge ölçümü için oyunun tüm sistemlerini kullanır (sözleşme, işe alım, odalar, tatil,
// ofis tasarımı, yayıncı, bilgi, seri, konsol aileleri, halka arz, olay seçimi, kredi). Gerçek oyuncu değil;
// iyi ama kusursuz olmayan bir oyuncuyu taklit eder. Kurallar oyunun verisini okur, gizli bilgi kullanmaz
// (tek istisna: konu/tür uyum tablosu; deneyimli bir oyuncunun raporlardan öğreneceğini varsayar).
import { newGame } from '../src/game.js';
import * as M from '../src/models.js';
import { researchAvailable, researchInfo, devCapacity, projectCost, regionStatus, locCost } from '../src/systems/production.js';
import { stationUpgradeCost, creditLimit, rent, designCost } from '../src/systems/economy.js';
import * as Pub from '../src/systems/publishers.js';
import * as Regions from '../src/systems/regions.js';
import * as Staff from '../src/systems/staff.js';
import * as Con from '../src/systems/console.js';
import * as Co from '../src/systems/company.js';
import * as War from '../src/systems/war.js';
import * as Modern from '../src/systems/modern.js';
import * as Charts from '../src/systems/charts.js';
import * as Genres from '../src/systems/genres.js';
import * as Engines from '../src/systems/engines.js';
import { TIER } from '../src/data/genres.js';

const GAME_RESEARCH = ['ihracat', 'alt_tur', 'motor_ozel', 'boyut_orta', 'oz_yayin', 'tur_cas', 'tur_mac', 'tur_rpg', 'yerel_jp', 'pazarlama_kucuk', 'oda_qa', 'tur_nis', 'kopya_koruma', 'oda_uzman',
  'tur_sim', 'tur_str', 'tur_aks', 'tur_spo', 'tur_yar', 'tur_bul', 'tur_pla', 'tur_dov', 'boyut_buyuk', 'yerel_dunya', 'pazarlama_buyuk', 'boyut_aaa',
  'tur_rit', 'dlc', 'ia_satis', 'motor_lisans', 'sezon_karti', 'erken_erisim', 'uzaktan'];
// Tür seçimi ayarları (denge ölçümünde değiştirilebilir)
const BOT = { win: +(process.env.BOT_WIN ?? 1.5), know: +(process.env.BOT_KNOW ?? 0.02), rep: +(process.env.BOT_REP ?? 0.6), repStaff: +(process.env.BOT_REPSTAFF ?? 6) };
const ROOM_PLAN = ['gelistirme', 'qa', 'grafik', 'gelistirme', 'ses', 'mola', 'pazarlama', 'gelistirme', 'arastirma', 'musteri', 'gelistirme', 'grafik', 'gelistirme', 'ses', 'qa', 'gelistirme'];

export function runSmartBot({ seed = 1, difficulty = 'orta', years = 50, length = 50, consoles = true, ipo = true, verbose = false, home = 'na', background = 'salon' } = {}) {
  const g = newGame({ seed, difficulty, length, home, background });
  const { state, pack, ctx } = g;
  const stats = { pub: { self: 0, pub: 0, tek: 0, kelepir: 0, early: 0, byDecade: {} }, peakStaff: 0, consoles: 0, consoleSold: 0, ipo: null, loans: 0, contracts: 0, bankruptYear: null, firstHit: null, peakCash: 0 };
  let n = 0;
  const infl = () => M.inflation(ctx);
  const wages = () => state.staff.reduce((s, p) => s + p.salary, 0);
  const burn = () => wages() + rent(ctx); // aylık sabit gider
  // Son 12 ayda kasanın değişimi (kâr/zarar göstergesi)
  const trend12 = () => state.cashHist.length >= 12 ? state.cash - state.cashHist[state.cashHist.length - 12] : 0;
  const runway = () => state.cash / Math.max(1, burn()); // ay (krediye yaslanmadan)

  // --- Olay seçimi: etkileri dolara çevirip en iyisini seç
  function value(e = {}) {
    const i = infl(), c = pack.chaos, ns = state.staff.length;
    const scale = Math.min(c.eventScaleMax, Math.max(c.eventScaleMin, c.eventScaleBase + c.eventScalePerStaff * ns));
    let v = (e.cash || 0) * i * scale + (e.cashRaw || 0) + (e.cashPct || 0) * Math.max(0, state.cash);
    const money = v;
    const unit = 400 * i ** 0.5;
    v += (e.morale || 0) * ns * unit * 0.6 - (e.stress || 0) * ns * unit * 0.4;
    v += (e.fans || 0) * 1.5 * i ** 0.5 + (e.fansPct || 0) * state.fans * 1.5;
    v += (e.hype || 0) * unit * 4 + (e.prestige || 0) * 60000 * i ** 0.5 - (e.kaos || 0) * unit * 2;
    v += (e.progress || 0) * unit * 6 * Math.max(1, ns) + (e.rp || 0) * unit * 0.5 - (e.bugsPct || 0) * unit * 40;
    v -= ((e.quit || 0) + (e.poach ? 1 : 0)) * 15000 * i + (e.layoffPct || 0) * ns * 8000 * i + (e.salaryPct || 0) * wages() * 24 + (e.rentPct || 0) * rent(ctx) * 24;
    if (e.salesMult) v += (e.salesMult.mult - 1) * e.salesMult.weeks * (state.salesHist.at(-1)?.r || 0);
    if (e.consoleMult) v += (e.consoleMult.mult - 1) * e.consoleMult.weeks * 30000 * i ** 0.5 * state.consoles.filter((k) => k.launched && !k.retired).length;
    if (e.board) v -= e.board * (Co.company(state).pressure > 55 ? 40000 : 8000) * i ** 0.5;
    if (e.crunch) v -= ns * unit * 20;
    if (e.flag === 'lootbox') v -= state.fans * 0.08;
    if (e.chance) v += e.chance.p * value(e.chance.yes) + (1 - e.chance.p) * value(e.chance.no);
    // Yayıncı: dürüst ve iyi cevap; blöfü yalnız çok kazandırıyorsa; vitrin etkinlikleri ve tarih istekleri
    if (e.pubMeet) v += (e.pubMeet.v - (e.pubMeet.bluff ? 6 : 0)) * unit * 3;
    if (e.pubShow) v += ns >= 3 && runway() > 4 ? unit * 10 : -1;
    if (e.pubDate) v += e.pubDate.ok ? unit * 4 : 0;
    if (e.pubMulti) v += selfValue() < 0.12 ? unit * 5 : -unit * 5;
    if (e.pubFair) v += unit * 4;
    if (e.pubPrice) v += e.pubPrice.ok ? unit : 0;
    if (money < 0 && state.cash + money < burn() * 2) v -= 1e9; // kasayı riske atma
    return v;
  }
  const resolveAll = () => { while (state.pending.length) { const ch = state.pending[0].choices; let best = 0; ch.forEach((c, i) => { if (value(c.effects) > value(ch[best].effects)) best = i; }); g.resolve(best); } };

  // Sözleşme bitirilebilir mi: sözleşmeye çalışacak odaların kapasitesiyle süresinin %85'inde
  function feasible(o) {
    const dev = state.rooms.filter((r) => r.type === 'gelistirme');
    const lead = state.projects[0];
    const capW = devCapacity(ctx) * (lead ? (dev.length > 1 ? 1 / dev.length : 0) : 1);
    return Object.values(o.need).reduce((a, b) => a + b, 0) / Math.max(0.1, capW) <= o.weeks * 0.85;
  }
  // --- Proje planı
  // Konu E: motor seçimi. Kalite vekili (türün disiplin ağırlıklarıyla motor çarpanları × hız) eksi bedelin tahmini gelire oranı.
  function engineChoice(draft) {
    const y = M.tableYear(ctx), gn = pack.genres.find((x) => x.id === draft.genre);
    const recent = state.games.slice(-3);
    const estRev = Math.max(projectCost(ctx, draft) * 3, 60000 * infl(), recent.length ? recent.reduce((a, x) => a + x.revenue, 0) / recent.length : 0);
    const weeks = pack.sizes.find((z) => z.id === draft.size).weeks;
    const mws = Engines.mwAvailable(ctx).filter((m) => m.fee < estRev * 0.02).map((m) => m.id);
    const opts = [{ engineId: null, engineLic: null, mw: mws }];
    const own = Engines.families(ctx).sort((a, b) => b.builtYear - a.builtYear)[0];
    if (own) opts.push({ engineId: own.id, engineLic: null, mw: mws });
    for (const L of Engines.licAvailable(ctx)) if (Engines.licFits(L, draft)) opts.push({ engineId: null, engineLic: L.id, mw: [] });
    let best = null;
    for (const o of opts) {
      const pj = { ...draft, ...o, features: null };
      const tp = M.techProfile(ctx, pj), sp = M.engineSpeed(ctx, pj);
      if (o.engineId) sp.speed = Math.max(1, sp.speed); // kendi motoruna alışma bedelini bir kez öder
      const q = (gn.disc.oyn + gn.disc.gfx * tp.gfx + gn.disc.ses * tp.ses + gn.disc.tek * tp.tek) * sp.speed;
      const pen = M.techNotes(ctx, pj).filter((x) => x.v < 0).reduce((a, x) => a + x.v, 0);
      const L = o.engineLic && M.licById(o.engineLic), pay = L ? M.licPay(L, y) : {};
      const cost = Engines.startFees(ctx, pj) + (pay.royalty || 0) * Math.max(0, estRev - (pay.threshold || 0)) + (pay.seat || 0) * state.staff.length * weeks / 4 + wages() / 4 * weeks * (tp.load - 1) * 0.5; // uzayan süre: yarısı zaten kalite olarak geri döner
      const v = q + pen * 0.02 - cost / estRev;
      if (Engines.startFees(ctx, pj) > Math.max(0, state.cash) * 0.25) continue; // yalnız peşin bedel kasaya göre süzülür
      if (!best || v > best.v) best = { v, o };
    }
    return best ? best.o : {};
  }
  function planGame() {
    const y = M.tableYear(ctx);
    const genres = Genres.knownGenres(ctx);
    const topics = pack.topics.filter((t) => t[4] <= y);
    const maxTech = pack.workstations.tiers[state.stationTier].maxTech;
    const plats = M.activePlatforms(ctx).filter((p) => p.own || p.tech <= maxTech);
    const cands = [];
    const alt = !!state.research.done.alt_tur;
    for (const gn of genres) {
      const ms = M.mastery(ctx, gn.id);
      for (const t of topics) {
        if (`${t[0]}/${gn.id}` === state.lastCombo) continue;
        const ai = t[3].indexOf(Math.max(...t[3]));
        const sub = alt ? Genres.bestSubFor(ctx, gn.id, t[0]) : null;
        const c = M.combo(ctx, { topic: t[0], genre: gn.id, sub, audience: pack.audiences[ai].id });
        // Gelir tahmini: kitle × uyum × fiyat (mobilde oyun fiyatı düşük)
        const rv = (p) => M.platformBase(ctx, p) * M.platFit(ctx, p, gn.id, sub) * p.aud[ai] * ((p.priceRef || pack.sales.priceRef) / pack.sales.priceRef) ** 0.6;
        const ps = [...plats].sort((a, b) => rv(b) - rv(a));
        // Not eşdeğeri: uyum çarpanı + alt tür puanları + ustalık + yaşam döngüsü (satış ×k ≈ ln k / 0,09 puan) + öncülük
        const subPts = sub ? TIER[c.gs].sub + TIER[c.ts].ts : -pack.review.noSubgenrePenalty;
        const life = sub ? Math.log(Genres.phase(ctx, sub).k) / 0.09 : 0;
        const pioneer = sub && state.invented[sub] && !state.subUsed[sub] && y < Genres.SUB[sub].year ? 5 : 0;
        // Çeşitlilik (büyüyünce) ve bildiğine sadakat: deneyimli oyuncu önce bildiği türde büyür
        const rep = state.staff.length >= BOT.repStaff ? state.games.slice(-3).filter((x) => x.genre === gn.id).length : 0;
        const know = (M.genreXp(ctx, gn.id) - 40) * BOT.know;
        const v = 70 * Math.sqrt(TIER[c.kt].v / 10 * Math.min(t[3][ai], c.audCap ? TIER[c.audCap].v : 10) / 10) + subPts + ms.score + life + pioneer + know - rep * BOT.rep
          + (state.trend && (state.trend.genre === gn.id || state.trend.topic === t[0]) ? 2 : 0);
        cands.push({ gn, t, ai, ps, sub, v });
      }
    }
    cands.sort((a, b) => b.v - a.v);
    const top = cands.filter((x) => x.v >= cands[0].v - BOT.win).slice(0, 4); // yakın adaylar arasında dönüşümlü
    const pick = top[n % top.length];
    // Boyut: ekibin bitirebileceği en büyük boyut
    const out = devCapacity(ctx) + Staff.weeklyOutput(ctx, (r) => r.type === 'grafik' || r.type === 'ses').reduce((s, x) => s + x.w * pack.rooms.expertMult, 0);
    const sizes = pack.sizes.filter((s) => !s.mmo && (!s.research || state.research.done[s.research]) && state.office.tier >= s.office);
    let size = sizes[0], ratio = 0;
    for (const s of sizes) {
      const need = ['oyn', 'gfx', 'ses', 'tek'].reduce((a, d) => a + M.target(ctx, d, s.id), 0);
      const r = (out * s.weeks * 0.8) / need;
      if (s === sizes[0]) ratio = r;
      if (r >= 1.0) { size = s; ratio = r; }
    }
    const share = { oyn: 0, gfx: 0, ses: 0, tek: 0 };
    pack.missions.forEach((m) => (share[m.disc] += 1));
    const alloc = pack.missions.map((m, i) => Math.round(100 * pick.gn.disc[m.disc] / share[m.disc] * pick.gn.mission[i]));
    const draft = { name: `Oyun ${n + 1}`, genre: pick.gn.id, sub: pick.sub, topic: pick.t[0], audience: pack.audiences[pick.ai].id, size: size.id, alloc };
    draft.platforms = [];
    // Mini ve küçük oyunlar lisansı yüksek konsollara gitmez (lisans boyutla küçülmez)
    const cheap = (p) => p.own || p.licence <= Math.max(5000, (size.devCost || 1) * 50000 * infl() ** 0.5);
    for (const p of pick.ps.filter((x) => size.target >= 1 || cheap(x))) {
      if (draft.platforms.length >= 2) break;
      const cost = projectCost(ctx, { ...draft, platforms: [...draft.platforms, p.id] });
      if (cost < Math.max(0, state.cash) * 0.35 || p.own) draft.platforms.push(p.id);
    }
    if (!draft.platforms.length) draft.platforms = ['pc'];
    // Yerelleştirme: açık bölgelerden türe ilgisi yeterli ve bedeli kasaya göre küçük olanlar
    // Yerelleştirme: dağıtımı olan (ya da dijital) ve yeterince büyük bölgelere, bedeli kasaya göre küçükse
    const wsh = M.regionShares(ctx);
    draft.regions = pack.regions.list.filter((r) => { const st = regionStatus(ctx, r.id); if (!st.ok) return false; if (st.free) return true;
      const reachable = Regions.netLevel(ctx, r.id) >= 1 || y >= 2008;
      return reachable && wsh[r.id] >= 0.03 && M.regionPref(ctx, r, pick.gn.id) >= 0.85 && locCost(ctx, r.id, size.id, pick.gn.id) < Math.max(0, state.cash) * 0.04; }).map((r) => r.id);
    Object.assign(draft, engineChoice(draft)); // Konu E: kendi motoru, lisanslı motor ya da sıfırdan kod
    const ip = state.ips.filter((x) => x.value >= 1 && state.week - x.lastRelease >= pack.ip.waitWeeks).sort((a, b) => b.value - a.value)[0];
    if (ip && ip.rightsPub && selfValue() > 0.08) { /* hakları yayıncıda: kendi yayınına engel; yeni IP */ }
    else if (ip) { const base = state.games.find((x) => x.ipId === ip.id); if (base && base.genre === draft.genre) draft.sequelOf = ip.id; }
    return { draft, ratio };
  }

  // --- Yayıncı politikası (Konu B): kendi yayını daha kârlıysa kendin; değilse en iyi beklenen değerli 3 yayıncıya sun,
  // teklifleri bekle (değişiklik isteğini kabul, iki teklifte açık artırma, olasılık %60+ ise pay iste), en değerlisini imzala.
  // Hiç teklif gelmezse ve beklemek pahalıysa kelepir satış.
  const Ycur = (pw) => pack.sales.yA + pack.sales.yB * pw / 100;
  // Konu C: değerler bölgesel erişimle hesaplanır (pazar payı × tür ilgisi × o bölgedeki erişim)
  const GENERIC = { genre: 'aksiyon', platforms: ['pc'], loc: {} };
  function reachValue(pj, opts) {
    const w = M.regionShares(ctx);
    const reach = Regions.computeReach(ctx, { ...pj, loc: pj.loc || {} }, opts).reach;
    return Regions.IDS.reduce((a, r) => a + (w[r] || 0) * M.regionPref(ctx, Regions.R(r), pj.genre) * reach[r], 0);
  }
  function selfValue(pj = GENERIC) {
    if (!state.research.done.oz_yayin) return -1;
    return reachValue({ ...pj, selfPub: true }, {}) * (1 - pack.sales.retailCut - 0.08);
  }
  const pubValue = (pub, pay, pj = GENERIC) => reachValue(pj, { pub: { power: pub.power, region: pub.region }, deal: { pubId: pub.id || 'x', power: pub.power, regions: null } }) * pack.publishing.net * pay / 100;
  function pubPlan(pj, late) {
    const s = Pub.pubState(state);
    if (pj.deal) return pj.deal.pubId;
    if (pj.selfChosen) return null;
    const sv = selfValue(pj);
    const ipR = pj.sequelOf != null ? state.ips.find((x) => x.id === pj.sequelOf) : null;
    const locked = s.multi?.left > 0 || !!ipR?.rightsPub;
    const est = Pub.trueEstimate(ctx, pj);
    const scored = Pub.list(ctx).filter((p) => Pub.canPitch(ctx, pj, p).ok)
      .map((p) => { const pr = Pub.preview(ctx, p, pj); const pAcc = 1 / (1 + Math.exp(-(est - pr.E) / 5)); return { p, v: pubValue(p, pr.pay, pj), ev: pubValue(p, pr.pay, pj) * pAcc }; }).sort((a, b) => b.ev - a.ev);
    const bestV = Math.max(0, ...Pub.list(ctx).filter((p) => Pub.door(ctx, p).open).map((p) => pubValue(p, Pub.preview(ctx, p).pay, pj)));
    // Teklifler: değişikliği kabul, iki teklifte açık artırma, olasılığı yüksekse haklar ya da pay
    for (const o of s.offers.filter((x) => x.pid === pj.id && x.kind === 'degisiklik')) g.acceptChange(o.id, o.change !== 'kitle');
    const full = s.offers.filter((o) => o.pid === pj.id && o.kind === 'tam');
    if (full.length >= 2 && !full.some((o) => o.auction)) g.auction(pj.id);
    for (const o of s.offers.filter((x) => x.pid === pj.id && x.kind === 'tam' && x.mode === 'bitmis')) {
      const mv = Pub.negMoves(ctx, o);
      const m = mv.find((x) => x.id === 'rights' && x.p >= 50) || mv.find((x) => x.id === 'pay' && x.p >= 60);
      if (m) g.negotiate(o.id, m.id);
    }
    const live = s.offers.filter((o) => o.pid === pj.id && o.kind !== 'degisiklik');
    const pending = s.pitches.filter((x) => x.pid === pj.id);
    if (live.length && (!pending.length || late || live.some((o) => o.expires - state.week <= 1))) {
      const val = (o) => (o.kind === 'tek' ? o.buyout : o.expUnits * o.price * pack.publishing.net * o.pay / 100 * (o.dist ? 1.6 : 1)) * (o.rights === 'yayinci' ? 0.85 : 1);
      const best = [...live].sort((a, b) => val(b) - val(a))[0];
      if (!locked && sv > 0 && best.kind === 'tek' && sv >= pubValue(Pub.byId(ctx, best.pubId) || { power: 50 }, 12, pj) * 0.8) { for (const o of live) g.declineOffer(o.id); pj.selfChosen = true; return null; }
      if (g.signOffer(best.id).ok) return best.pubId;
    }
    if (pending.length || live.length) return 'wait';
    if (!locked && sv > 0 && sv >= bestV) { pj.selfChosen = true; return null; }
    if (!late && (pj.pitchTries || 0) < 3) {
      const pick = scored.filter((x) => x.ev > 0).slice(0, 3).map((x) => x.p.id);
      const cost = Pub.prepCost(ctx, true, true);
      if (pick.length && g.pitch(pj.id, pick, { doc: cost < state.cash * 0.02, note: cost < state.cash * 0.02 }).ok) { pj.pitchTries = (pj.pitchTries || 0) + 1; return 'wait'; }
      if (!pick.length && scored.length === 0 && Pub.list(ctx).some((p) => Pub.door(ctx, p).open && !Pub.canPitch(ctx, pj, p).ok && /hafta daha/.test(Pub.canPitch(ctx, pj, p).why))) return 'wait';
    }
    if (ipR?.rightsPub && g.buyRights(ipR.id).ok) return sv > 0 ? null : 'kelepir';
    return sv > 0 && !locked ? null : 'kelepir';
  }
  // Erken anlaşma: Ortak bir yayıncı varsa ve kasa darsa konsept bitince finansman iste
  function earlyPlan(pj) {
    // Finanse oyun telifle kapanır ve nadiren kâr getirir: yalnız kendi yayını zayıfken ya da kasa çok darken
    if (pj.deal || pj.status !== 'dev' || pj.phase < 1 || pj.earlyTried || runway() > (selfValue() > 0.08 ? 3 : 8)) return;
    const s = Pub.pubState(state);
    if (s.pitches.some((x) => x.pid === pj.id)) return;
    const cands = Pub.list(ctx).filter((p) => Pub.canPitch(ctx, pj, p, 'erken').ok).sort((a, b) => Ycur(b.power) - Ycur(a.power));
    pj.earlyTried = true;
    if (cands.length && g.pitch(pj.id, cands.slice(0, 2).map((p) => p.id), { mode: 'erken' }).ok) stats.pub.early++;
  }

  function hireFor(roomId, filter = () => true) {
    const cap = Staff.roomSeats(ctx);
    const room = state.rooms.find((r) => r.id === roomId);
    if (!room || Staff.membersOf(ctx, room).length >= cap) return false;
    const floor = M.marketSkill(ctx) * 0.75;
    const a = state.applicants.filter((p) => p.skill >= floor && filter(p)).sort((x, y) => y.skill / y.salary - x.skill / x.salary)[0];
    if (!a) return false;
    const r = g.hire(a.id);
    if (r.ok) g.moveStaff(state.staff[state.staff.length - 1].id, roomId);
    return r.ok;
  }

  // Donanım araştırması işe yarar mı: tercih edilen tiplerin bir kategorisinde şu ankinden daha yüksek teknolojili parça açıyorsa
  function hwUseful(rid) {
    const types = ['konsol', 'tasinabilir', 'melez'];
    if (pack.console.types.some((t) => t.research === rid)) return ['hw_el', 'hw_melez'].includes(rid);
    for (const type of types) {
      const t = Con.typeById(ctx, type);
      for (const cat of t.parts) {
        const list = pack.console.parts[cat].list;
        const best = Math.max(0, ...list.filter((p) => Con.partStatus(ctx, t, p).ok && !p.hwEng).map((p) => p.tech ?? (p.appeal || 1) * 3));
        if (list.some((p) => p.research === rid && (p.tech ?? (p.appeal || 1) * 3) > best)) return true;
      }
    }
    return false;
  }
  // --- Donanım: ailenin bir sonraki nesli ya da yeni aile
  function consolePlan() {
    if (!consoles || state.consoleJob || Con.consoleBlockers(ctx).length) return;
    const y = M.tableYear(ctx);
    const prefer = y < 1986 ? ['salon', 'konsol'] : y < 2015 ? ['konsol', 'tasinabilir'] : ['konsol', 'melez', 'tasinabilir'];
    for (const type of prefer) {
      const t = Con.typeById(ctx, type);
      if (!Con.typeStatus(ctx, t).ok) continue;
      const live = state.consoles.filter((k) => k.type === type && k.launched && !k.retired && !k.sunsetAt);
      const cur = live[live.length - 1];
      if (cur && !(cur.ended || cur.tech < Con.expectedTech(ctx, t) - 1.2)) continue;
      const parts = Con.consoleParts(ctx, type);
      const d = { type, series: cur?.seriesId ?? 'yeni', seriesName: `Bot ${type}`, price: 'normal', parts: {} };
      for (const [cat, list] of Object.entries(parts.cats)) { const ok = list.filter((x) => x.ok && !x.p.hwEng); d.parts[cat] = ok[ok.length - 1]?.p.id; }
      const q = Con.consoleQuote(ctx, d);
      if (!q || q.issues.length) continue;
      if (state.cash < Math.max(q.cost * 4, 15e6 * infl() ** 0.5) + burn() * 18 || state.staff.length < 12) return;
      if (g.startConsole(d).ok) stats.consoles++;
      return;
    }
  }

  while (state.week < years * 48 && !state.gameOver) {
    resolveAll();
    const y = M.tableYear(ctx);
    const monthly = state.week % 4 === 1;
    // Oyun mu sözleşme mi: son oyunların haftalık kârı ile sözleşmelerin haftalık ödemesi karşılaştırılır.
    const devRooms = state.rooms.filter((r) => r.type === 'gelistirme').length;
    const recent = state.games.filter((x) => !x.portOf).slice(-4);
    const gameRate = recent.length ? recent.reduce((a, x) => a + x.revenue - (x.devCost || 0), 0) / recent.reduce((a, x) => a + pack.sizes.find((z) => z.id === x.size).weeks, 0) : Infinity;
    const offers = state.contractOffers.filter(feasible);
    const contractRate = offers.length ? Math.max(...offers.map((o) => o.reward / o.weeks)) : 0;
    // Sözleşme atölyesi: oyunlar sözleşmeden az getiriyorsa, büyüyene kadar araştırma/motora para gömme
    const shop = gameRate < contractRate && state.cash < 40 * burn();
    // Araştırma: önce oyun, laboratuvar varsa donanım; kasa izin verirse
    if (!state.research.current) {
      const av = researchAvailable(ctx);
      let next = GAME_RESEARCH.map((id) => av.find((r) => r.id === id)).find(Boolean);
      const wantLab = consoles && state.office.tier >= 3 && state.staff.length >= 12 && !state.research.done.donanim_lab && state.cash > 15e6 * infl() ** 0.5;
      if (wantLab) next = av.find((r) => r.id === 'donanim_lab') || next;
      // Donanım araştırması yalnızca zenginken ve bir sonraki konsolu iyileştirecek parçalar için
      const rich = state.cash > 30e6 * infl() ** 0.5 && state.staff.length >= 15;
      if (!next && state.research.done.donanim_lab && consoles && rich) next = av.filter((r) => r.hw && hwUseful(r.id)).sort((a, b) => researchInfo(ctx, a).rp - researchInfo(ctx, b).rp)[0];
      const reserve = next?.hw ? 8 : 3;
      if (next && (!shop || researchInfo(ctx, next).cost < burn()) && state.research.rp >= researchInfo(ctx, next).rp && state.cash > researchInfo(ctx, next).cost * reserve + burn() * (next.hw ? 18 : 3)) g.startResearch(next.id);
    }
    // Konu D: usta olduğu türde, yakında doğacak bir alt türü icat et (kasa rahatsa)
    if (!state.inventJob && !shop && state.research.done.alt_tur) {
      const yy = M.tableYear(ctx);
      const cand = Genres.SUBGENRES.filter((s) => s.year > yy && Genres.inventInfo(ctx, s.id).ok).sort((a, b) => a.year - b.year)[0];
      if (cand && state.cash > Genres.inventInfo(ctx, cand.id).cost * 6 + burn() * 6) g.invent(cand.id);
    }
    // Konu E: teknoloji hattı (en ucuz yeni basamak) ve motor sürümü (yeni basamak birikince ya da motor eskiyince)
    if (Engines.techOpen(ctx) && !state.tech.current && !shop) {
      const next = Engines.techAvailable(ctx).map((f) => ({ f, i: M.featureStats(ctx, f.id) })).sort((a, b) => a.i.rp - b.i.rp)[0];
      if (next && state.research.rp >= next.i.rp + (state.research.current ? 0 : 20) && state.cash > next.i.cost * 6 + burn() * 6 && state.games.length >= 2) g.startTech(next.f.id);
    }
    if (state.research.done.motor_lisans) { // en yeni sürümü dışarıya lisansla, eskileri kapat
      const last = Engines.families(ctx).sort((a, b) => b.builtYear - a.builtYear)[0];
      for (const e of state.engines) if (e.licensed !== (e === last)) g.toggleLicence(e.id);
    }
    if (state.research.done.motor_ozel && !state.engineJob && !shop) {
      const feats = Engines.FEATURES.filter((f) => !f.base && Engines.techDone(ctx, f.id)).map((f) => f.id);
      const last = Engines.families(ctx).sort((a, b) => b.builtYear - a.builtYear)[0];
      const fresh = last ? feats.filter((f) => !last.features.includes(f)).length : feats.length;
      const old = last && M.tableYear(ctx) - last.builtYear >= 4;
      const b = Engines.buildCost(ctx, feats, last?.id ?? null);
      if ((fresh >= 3 || (old && fresh >= 1) || (!last && fresh >= 2)) && state.cash > b.cost * 4 + burn() * 4) g.buildEngine(last ? last.name : 'Garaj Motoru', feats, last?.id ?? null);
    }
    // Proje
    const contractTime = (devRooms === 1 && state.contract) || (contractRate > gameRate * 1.1 && state.week - (state.games.at(-1)?.releasedWeek || 0) < 72);
    if (!state.projects.length && g.freeDevRooms().length && !contractTime) {
      const { draft, ratio } = planGame();
      // Kalitesi düşük kalacak oyuna para gömme: sözleşmeler varsa ekip büyüyene kadar onlarla devam
      if (ratio >= 0.7 || !offers.length || gameRate > contractRate) { const r = g.startProject(draft); if (r.ok) n++; }
    }
    for (const pj of [...state.projects]) {
      if (pj.status === 'debug') {
        const pts = Object.values(pj.points).reduce((a, b) => a + b, 0);
        const late = state.week - pj.startedWeek > pj.totalWeeks + 6;
        const pubLate = state.week - pj.startedWeek > pj.totalWeeks + 16;
        if (!pj.deal && !pj.selfChosen && !(Modern.f2pAllowed(ctx) && pj.platforms.some((id) => M.platformById(ctx, id)?.kind === 'mobil'))) pubPlan(pj, pubLate); // içerik biter bitmez sun; teklif gelince imzala
        // Çıkış zamanlaması: aynı türde dev bir çıkışla çakışma ya da yılsonu yaklaşıyorsa biraz bekle (en çok 6 hafta)
        const clash = Charts.upcoming(ctx).some((h) => h.genre === pj.genre && h.rank < 4 && h.weeks <= 3);
        const mo = Charts.monthIdx(ctx), soonQ4 = mo === 9 && Charts.seasonMult(ctx, pj, 10) > Charts.seasonMult(ctx, pj, mo) * 1.2;
        pj.waited ||= 0;
        if (!late && pj.waited < 6 && runway() > 6 && (clash || soonQ4)) { pj.waited++; continue; }
        if (pj.bugs / Math.max(1, pts) < 0.02 || late) {
          const f2p = Modern.f2pAllowed(ctx) && pj.platforms.some((id) => M.platformById(ctx, id)?.kind === 'mobil');
          const pv = g.previewReview(pj.id).score;
          const offer = !f2p && pv < 72 ? Modern.serviceOffers(ctx, pj, pv).sort((a, b) => b.pay - a.pay)[0] : null;
          const price = Math.max(10, Math.round(20 * infl() ** 0.4));
          let publisherId;
          if (!f2p && !(pj.deal && !pj.hold)) {
            const choice = pubPlan(pj, pubLate);
            if (choice === 'wait') continue;
            publisherId = choice;
          }
          if (pj.hold && state.week < pj.hold) continue;
          const res = g.release({ projectId: pj.id, publisherId: f2p ? null : publisherId ?? null, price, model: f2p ? 'f2p' : 'satis', monet: 'dengeli', service: offer?.id || null });
          if (process.env.PUBDBG && res.ok) console.log(Math.floor(y), res.game.name, res.game.size, res.game.score, res.game.publisherName || 'self', 'sv', selfValue().toFixed(3), 'fans', state.fans, 'cash', Math.round(state.cash), 'dev', res.game.devCost);
          if (!res.ok && process.env.PUBDBG) console.log('release fail', res.msg);
          if (res.ok) { const d = res.game.deal, k = d ? (d.bargain ? 'kelepir' : d.kind === 'tek' ? 'tek' : 'pub') : 'self'; stats.pub[k]++; const dec = Math.floor(y / 10) * 10; (stats.pub.byDecade[dec] ||= { self: 0, n: 0 }).n++; if (k === 'self') stats.pub.byDecade[dec].self++; }
          if (res.ok && res.game.score >= 85 && stats.firstHit == null) stats.firstHit = Math.floor(y);
        }
      } else if (pj.status === 'dev') {
        earlyPlan(pj);
        for (const o of Pub.pubState(state).offers.filter((x) => x.pid === pj.id)) { if (o.kind === 'degisiklik') g.acceptChange(o.id, true); else if (o.kind === 'tam' && o.mode === 'erken') g.signOffer(o.id); }
        if (Modern.eaAllowed(ctx, pj) && pack.sizes.find((z) => z.id === pj.size).target >= 1) g.earlyAccess(pj.id);
        if (Modern.crowdAllowed(ctx, pj) && runway() < 24) g.crowdfund(pj.id);
      }
      if (pj.status === 'dev' && !pj.campaigned && pj.week > pj.totalWeeks / 2) {
        const camps = pack.hype.campaigns.filter((x) => (!x.research || state.research.done[x.research]) && (!x.minYear || y >= x.minYear));
        const best = [...camps].reverse().find((x) => x.cost * infl() ** 0.7 * 8 < state.cash - burn() * 6);
        if (best) pj.campaigned = g.campaign(pj.id, best.id).ok;
        else pj.campaigned = true;
      }
    }
    if (monthly) {
      // Dağıtım ağı (Konu C): büyük bölgelere önce posta, hayran birikince distribütör, zenginken ofis
      const wsh = M.regionShares(ctx);
      for (const rid of Regions.IDS.filter((r) => r !== Regions.home(ctx)).sort((a, b) => wsh[b] - wsh[a])) {
        const lv = Regions.netLevel(ctx, rid) + 1;
        if (lv > 3 || wsh[rid] < 0.02) continue;
        const c = Regions.netCheck(ctx, rid, lv);
        if (!c.ok) continue;
        const k = lv === 1 ? 5 : lv === 2 ? 4 : 12;
        if (lv === 3 && (state.staff.length < 20 || wsh[rid] < 0.15)) continue;
        if (state.cash > c.cost * k + burn() * 6 && g.buyNet(rid).ok) break;
      }
      // Çalışma koltukları: mola ve müşteri odası dışındakiler (mola odasına kimse yerleştirilmez)
      const seats = state.rooms.filter((r) => r.type !== 'mola' && r.type !== 'musteri').length * Staff.roomSeats(ctx);
      // Oda görevleri: ana proje + destek; kasa darsa bir oda sözleşmeye
      const dev = state.rooms.filter((r) => r.type === 'gelistirme');
      const lead = state.projects[0];
      const needCash = runway() < 8;
      for (const r of dev) {
        if (lead && r.id === lead.roomId) g.setRoomMode(r.id, 'otomatik');
        else if ((needCash || state.contract) && dev.length > 1 && r === dev.filter((x) => !lead || x.id !== lead.roomId).at(-1)) g.setRoomMode(r.id, 'sozlesme');
        else if (lead && !state.projects.some((p) => p.roomId === r.id)) g.setRoomMode(r.id, 'destek:' + lead.id);
        else g.setRoomMode(r.id, 'otomatik');
      }
      // Sözleşme: boşta oda varsa ya da kasa darsa, bitirilebilecek en kârlısı
      const freeForContract = !lead || dev.some((r) => r.mode === 'sozlesme' || (r.mode === 'otomatik' && !state.projects.some((p) => p.roomId === r.id)));
      if (!state.contract && freeForContract && state.contractOffers.length) {
        const ok = state.contractOffers.filter(feasible).sort((a, b) => b.reward - a.reward);
        if (ok[0] && g.acceptContract(ok[0].id).ok) stats.contracts++;
      }
      // İşe alım: 12 aylık pist kalıyorsa, en boş odaya (uzman odalara uygun yetenekle)
      if (state.staff.length < seats && runway() > 9 && (trend12() >= 0 || runway() > 15)) {
        const order = [...state.rooms].sort((a, b) => Staff.membersOf(ctx, a).length - Staff.membersOf(ctx, b).length);
        for (const r of order) {
          const key = { grafik: 'grafik', ses: 'ses', qa: 'test', pazarlama: 'pazar', arastirma: 'arge', donanim: 'donanim' }[r.type];
          if (r.type === 'mola' || r.type === 'musteri') continue;
          if (hireFor(r.id, (p) => !key || (p.skills?.[key] || 0) >= p.skill * 0.9)) break;
        }
      }
      // Oda kurma
      const free = Staff.slots(ctx) - state.rooms.length;
      if (free > 0 && state.staff.length >= seats - 1 && runway() > 9) {
        const counts = {};
        const contractShop = gameRate < contractRate && state.rooms.filter((r) => r.type === 'gelistirme').length < 4;
        const next = contractShop ? 'gelistirme' : (ROOM_PLAN.length > state.rooms.length ? null : ['gelistirme', 'grafik', 'gelistirme', 'ses', 'qa'][state.rooms.length % 5]) || ROOM_PLAN.find((t) => { counts[t] = (counts[t] || 0) + 1; const rt = pack.rooms.types.find((x) => x.id === t); return state.rooms.filter((r) => r.type === t).length < counts[t] && (!rt.research || state.research.done[rt.research]) && (!rt.office || state.office.tier >= rt.office); });
        if (next) g.buildRoom(next);
      }
      // Donanım laboratuvarı ve donanımcı
      if (consoles && state.research.done.donanim_lab && state.office.tier >= 3 && !state.rooms.some((r) => r.type === 'donanim') && free > 0 && state.cash > 2e6 * infl() ** 0.5) g.buildRoom('donanim');
      const lab = state.rooms.find((r) => r.type === 'donanim');
      if (lab && !Con.hwCapable(ctx).length) {
        const cand = [...state.staff].filter((p) => !p.founder).sort((a, b) => (b.skills?.donanim || 0) - (a.skills?.donanim || 0))[0];
        if (!(cand && cand.skills.donanim >= pack.console.hwSkillMin && g.moveStaff(cand.id, lab.id).ok)) hireFor(lab.id, (p) => (p.skills?.donanim || 0) >= pack.console.hwSkillMin);
      }
      if (lab) consolePlan();
      // Satış listesi: raftan inen iyi oyunu Ucuz Raf Serisi'ne al, dijitalde festivale katıl
      for (const gm of state.games.filter((x) => x.active && x.score >= 65)) {
        if (gm.offShelf && Charts.budgetAllowed(ctx, gm) && state.cash > Charts.budgetCost(ctx, gm) * 10 + burn() * 6) g.budgetLine(gm.id);
        if (Charts.festivalAllowed(ctx, gm)) g.festival(gm.id);
      }
      // Yayın sonrası: iyi oyunlara indirilebilir içerik (en fazla 2) ve yayıncı anahtarları
      for (const gm of state.games.filter((x) => x.active && x.score >= 75 && (x.dlcs || 0) < 2 && x.weeks > 8)) if (Modern.dlcAllowed(ctx, gm) && state.cash > Modern.dlcCost(ctx, gm) * 6 + burn() * 6) g.releaseDLC(gm.id);
      for (const gm of state.games.filter((x) => x.active && x.score >= 70 && x.weeks < 6 && !x.streamed)) if (M.tableYear(ctx) >= pack.modern.stream.year && state.cash > Modern.streamCost(ctx, gm) * 10 + burn() * 6) g.streamKeys(gm.id);
      // Konsol savaşı: zenginken özel oyun anlaşması
      for (const k of state.consoles.filter((x) => x.launched && !x.retired && !x.ended)) if (state.cash > War.dealCost(ctx) * 10 + burn() * 12) g.exclusiveDeal(k.id);
      // Ofis ve istasyonlar
      const nextOffice = pack.offices.find((o) => o.tier === state.office.tier + 1);
      const full = state.staff.length >= seats - 1 && state.rooms.length >= Staff.slots(ctx);
      const burnAfter = nextOffice ? (wages() + nextOffice.rent * infl() + 2 * M.salaryFor(ctx, M.marketSkill(ctx))) * 12 : 0;
      if (full && nextOffice && trend12() > -burn() * 3 && state.cash > nextOffice.cost * infl() ** 0.5 * 1.2 + burnAfter * 1.5) g.moveOffice();
      else if (full && !nextOffice && state.cash > pack.offices[3].floorCost * infl() ** 0.5 * 2 + burn() * 12) g.moveOffice();
      const sc = stationUpgradeCost(ctx);
      if (sc && M.expectedStationTier(ctx) > state.stationTier && state.cash > sc * 2 + burn() * 6) g.upgradeStations();
      // Tatil ve ofis tasarımı
      if (state.vacationPolicy !== 'planli') g.setVacationPolicy('planli');
      const avgStress = state.staff.reduce((a, p) => a + p.stress, 0) / Math.max(1, state.staff.length);
      for (const b of pack.buildings) {
        if (!state.rooms.some((r) => b.types.includes(r.type))) continue;
        const want = avgStress > 45 || b.id === 'yayin' ? 'konfor' : 'ergonomik';
        if ((state.designs[b.id] || 'standart') !== want && state.cash > designCost(ctx, b.id, want) * 15 + burn() * 12) g.setDesign(b.id, want);
      }
      // Kariyer seviyesi: araştırma bekleyen yoksa artan RP ile
      if (state.research.rp > 150 * infl() ** 0.3) {
        const p = [...state.staff].sort((a, b) => (a.careers[a.career] || 0) - (b.careers[b.career] || 0))[0];
        if (p) g.levelUp(p.id);
      }
      // Halka arz ve kurul
      if (ipo) {
        const co = Co.company(state);
        if (!co.listed && !Co.ipoCheck(ctx).length && Co.valuation(ctx) > 25e6 * infl() ** 0.5 && !stats.ipo) { if (g.goPublic(0.1).ok) stats.ipo = Math.floor(y); }
        if (co.listed && co.pressure > 45 && state.cash > burn() * 24) g.dividend();
        if (co.listed && co.pressure > 30 && state.cash > Co.buybackCost(ctx) * 4 + burn() * 24) g.buyback();
      }
      // Kötü gidişte küçül: 4 aydan az pist ve zarar varsa en verimsiz %15'i çıkar
      if (runway() < 4 && trend12() < 0 && state.staff.length > 3) {
        const k = Math.max(1, Math.floor(state.staff.length * 0.15));
        const cut = [...state.staff].filter((p) => !p.founder).sort((a, b) => a.skill / Math.max(1, a.salary) - b.skill / Math.max(1, b.salary)).slice(0, k);
        for (const p of cut) g.fire(p.id);
        stats.layoffs = (stats.layoffs || 0) + cut.length;
      }
      // Kurtarma kredisi
      if (state.cash < -creditLimit(ctx) * 0.7) {
        const owed = state.loans.reduce((s, l) => s + l.remaining, 0), avail = creditLimit(ctx) * 3 - owed;
        if (avail > 0 && g.takeLoan(Math.round(avail * 0.5)).ok) stats.loans++;
      }
    }
    stats.peakStaff = Math.max(stats.peakStaff, state.staff.length);
    stats.peakCash = Math.max(stats.peakCash, state.cash);
    if (verbose && state.week % 48 === 0) console.log(Math.floor(y), Math.round(state.cash), state.staff.length, state.games.slice(-3).map((x) => x.score).join('/'));
    resolveAll();
    g.tick();
  }
  if (state.gameOver?.reason === 'iflas') stats.bankruptYear = Math.floor(M.tableYear(ctx));
  const scores = state.games.map((x) => x.score);
  return {
    over: state.gameOver?.reason === 'son' ? null : state.gameOver?.reason || null,
    year: Math.floor(M.tableYear(ctx)), cash: Math.round(state.cash), value: Co.valuation(ctx), games: state.games.length,
    avgScore: scores.length ? Math.round(scores.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, scores.length)) : 0,
    goty: state.awards.filter((a) => a.type === 'goty').length, genreAwards: state.awards.filter((a) => a.type === 'tur').length,
    staff: state.staff.length, fans: state.fans, office: state.office.tier, sold: state.consoles.reduce((a, k) => a + k.sold, 0), ...stats, state,
  };
}
