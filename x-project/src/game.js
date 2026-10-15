// Oyun çekirdeği: durum, haftalık tik ve oyuncu eylemleri (syscall'lar).
// Sistem sırası (P): takvim → personel/üretim → araştırma → satış → ekonomi → olaylar.
import { PACK } from './data/pack.js';
import { makeRng, makeBus, makeLedger, calendar, clamp } from './kernel.js';
import * as M from './models.js';
import * as Staff from './systems/staff.js';
import * as Prod from './systems/production.js';
import * as Market from './systems/market.js';
import * as Eco from './systems/economy.js';
import * as Ev from './systems/events.js';
import * as Con from './systems/console.js';
import * as Post from './systems/post.js';
import * as Know from './systems/knowledge.js';
import * as World from './systems/world.js';
import * as People from './systems/people.js';
import * as Co from './systems/company.js';
import * as War from './systems/war.js';
import * as Modern from './systems/modern.js';
import * as Charts from './systems/charts.js';
import * as Pub from './systems/publishers.js';
import * as Regions from './systems/regions.js';
import * as Genres from './systems/genres.js';
import * as Engines from './systems/engines.js';
import * as Platform from './systems/platform.js';
import * as Crew from './systems/crew.js';
import * as Office from './systems/office.js';

export function createState({ companyName = 'X Project Stüdyo', founderName = 'Sen', difficulty = 'orta', length = PACK.meta.defaultLength, seed = 1976, founderSpec = 'oyn', home = 'na', background = 'salon' } = {}) {
  const diff = PACK.difficulties.find((d) => d.id === difficulty);
  const state = {
    version: 3, seed, rng: seed >>> 0, week: 0, lengthYears: length, lengthMult: PACK.meta.gameLengths[length], difficulty,
    companyName, founderName, founderSpec, cash: 0, startCash: Math.round(diff.startCash * (Regions.R(home)?.startK ?? 1)),
    ledger: { byYear: {}, total: {}, recent: [] },
    office: { tier: 1, floors: 0 }, rooms: [], consoles: [], consoleJob: null, stationTier: 0, stationDown: 0, rentMult: 1,
    staff: [], applicants: [], nextId: 1,
    research: { done: {}, current: null, rp: 0 }, engines: [], engineJob: null, usedFeatures: {},
    projects: [], knowledge: {}, cashHist: [], salesHist: [], rivalGames: [], top: [], contract: null, contractOffers: [], games: [], ips: [], charts: [], awards: [],
    fans: 0, prestige: 0, reputation: 0, kaos: 0, heat: 0, crunch: false,
    marketMods: [], gameMods: [], erasFired: {}, trend: null, rivals: [],
    loans: [], debtWeeks: 0, flags: {},
    pending: [], eventCounts: {}, lastEvents: [], nextEventWeek: 20,
    news: [], gameOver: null, lastCombo: null,
    designs: {}, vacationPolicy: 'planli', rel: {},
    home, net: {}, fanMix: { [home]: 1 },
  };
  Genres.initState(state, PACK, background); // Konu D: kurucu geçmişi
  Engines.initState(state); // Konu E: temel teknoloji
  state.platLic = { pc: true }; // Konu H: başta yalnız Kişisel Bilgisayar lisanslı
  return state;
}

// Eski kayıtları taşı: tek proje → proje listesi (v3).
function migrate(state) {
  if (!state.projects) {
    const dev = (state.rooms || []).find((r) => r.type === 'gelistirme');
    state.projects = state.project ? [{ ...state.project, roomId: dev ? dev.id : null }] : [];
    delete state.project;
  }
  state.knowledge ||= {};
  state.cashHist ||= [];
  state.salesHist ||= [];
  state.rivalGames ||= [];
  state.top ||= [];
  state.designs ||= {};
  state.vacationPolicy ||= 'planli';
  state.rel ||= {};
  Charts.mkt(state);
  Regions.migrate(state);
  Pub.migrate(state);
  Genres.migrate(state, PACK);
  Engines.migrate(state);
  Platform.migrate(state);
  Crew.migrate(state);
  Office.ensureOffice(state, PACK);
  if (state.rivals?.length && !state.rivals.some((r) => r.cid)) state.rivals = state.rivals.filter((r) => r.acquired);
  state.version = 3;
}

export function makeGame(state, pack = PACK) {
  migrate(state);
  const bus = makeBus();
  const rng = makeRng(state);
  const ledger = makeLedger(state, bus);
  bus.on('ledgerPosted', (p) => Co.trackRevenue({ state, pack }, p));
  bus.on('rivalRelease', (r) => War.thirdPartyRelease(ctx, r.studio, r.name, r.big));
  const ctx = {
    state, pack, bus, rng, ledger,
    infl: () => M.inflation(ctx),
    news(text, type = 'info') {
      state.news.unshift({ w: state.week, t: text, type });
      if (state.news.length > 80) state.news.length = 80;
      bus.fire('news', { text, type });
    },
    queue(ev) { state.pending.push(ev); bus.fire('pending', ev); },
  };
  Pub.wire(ctx);
  Regions.wire(ctx);
  Genres.wire(ctx);
  Engines.wire(ctx);
  Platform.wire(ctx);
  const contracts = () => { Prod.genContracts(ctx); Pub.addTrial(ctx); };

  const api = {
    ctx, state, pack, bus,
    cal: () => calendar(state, pack),

    init() {
      ledger.post('sermaye', state.startCash, 'Başlangıç sermayesi');
      state.rooms.push({ id: state.nextId++, type: 'gelistirme', mode: 'otomatik' });
      const founder = Staff.makePerson(ctx, { skill: pack.production.founderSkill, career: pack.careerRules.founderCareer[state.founderSpec], level: 1, founder: true, name: state.founderName });
      founder.room = state.rooms[0].id;
      Genres.assignTaste(ctx, founder, true);
      state.staff.push(founder);
      Office.seedStarter(ctx);
      if (Genres.bg(ctx).bonus.fans) state.fans += Genres.bg(ctx).bonus.fans;
      Staff.genApplicants(ctx);
      contracts();
      Market.initRivals(ctx);
      Market.weeklyTrend(ctx);
      ctx.news(`🏚️ ${state.companyName} bir garajda kuruldu. Masada tek bir bilgisayar, kafada büyük hayaller.`, 'info');
      Office.ensureOffice(state, pack);
      return api;
    },

    // Bir hafta ilerlet. Bekleyen karar varsa durur.
    tick() {
      if (state.gameOver || state.pending.length) return false;
      state.week++;
      Office.weekly(ctx);
      const newMonth = state.week % 4 === 0;
      const newYear = state.week % 48 === 0;
      // personel / üretim
      Staff.weeklyStaff(ctx);
      Prod.weeklyProject(ctx);
      Prod.weeklyContract(ctx);
      // araştırma
      Prod.weeklyResearch(ctx);
      Engines.weekly(ctx);
      Crew.weekly(ctx);
      Con.weeklyConsole(ctx);
      Platform.weekly(ctx);
      // satış
      Market.weeklySales(ctx);
      Modern.weeklyModern(ctx);
      Market.weeklyTrend(ctx);
      World.weeklyWorld(ctx);
      Charts.weeklyCalendar(ctx);
      Market.weeklyRivals(ctx);
      Market.weeklyCharts(ctx);
      Pub.weekly(ctx);
      Regions.weekly(ctx);
      Genres.weekly(ctx);
      // ekonomi
      if (newMonth) {
        Eco.monthlyEconomy(ctx);
        Engines.monthly(ctx);
        Market.monthlyMmo(ctx);
        Market.monthlySubsidiaries(ctx);
        Con.monthlyConsole(ctx);
        War.monthlyWar(ctx);
        Platform.monthly(ctx);
        Crew.monthly(ctx);
        Staff.genApplicants(ctx);
        if (!state.contract || state.contractOffers.length === 0) contracts();
        state.cashHist.push(Math.round(state.cash));
        if (state.cashHist.length > 480) state.cashHist.shift();
        bus.fire('monthProceeded', state.week);
      }
      if (newYear) {
        state.prestige = Math.max(0, state.prestige - pack.prestige.decayPerYear);
        bus.fire('yearProceeded', state.week);
      }
      Co.weeklyCompany(ctx);
      Eco.weeklyChaos(ctx);
      Eco.weeklySolvency(ctx);
      // olaylar
      Market.scheduled(ctx);
      Ev.weeklyEvents(ctx);
      bus.fire('weekProceeded', state.week);
      if (state.week >= state.lengthYears * 48 && !state.gameOver) state.gameOver = { reason: 'son', text: 'Kariyerin sona erdi. Emeklilik partisinde pasta piksel şeklindeydi.' };
      return true;
    },

    resolve(i) { Ev.resolvePending(ctx, i); },

    // --- Projeler (MGT: her geliştirme odası kendi oyununu yapar)
    projectById: (id) => state.projects.find((p) => p.id === id),
    freeDevRooms: () => Prod.freeDevRooms(ctx),
    startProject(o) {
      const free = Prod.freeDevRooms(ctx);
      const room = o.roomId ? free.find((r) => r.id === o.roomId) : free.find((r) => Office.workstations(ctx, r.id).length) || free[0];
      if (!room) return { ok: false, msg: 'Boş geliştirme odası yok. Ofis penceresinden yeni bir geliştirme odası kur.' };
      if (!Office.workstations(ctx, room.id).length) return { ok: false, msg: 'Bu odada masa, sandalye ve bilgisayarı tamamlanmış bir çalışma yeri kur.' };
      const size = pack.sizes.find((s) => s.id === o.size);
      if (size.research && !state.research.done[size.research]) return { ok: false, msg: 'Bu boyut için araştırma gerekli.' };
      if (state.office.tier < size.office) return { ok: false, msg: `Bu boyut için en az "${pack.offices[size.office - 1].name}" gerekli.` };
      if (!o.platforms?.length) return { ok: false, msg: 'En az bir platform seç.' };
      if (o.kind !== 'ek' && !Genres.knows(ctx, o.genre)) return { ok: false, msg: 'Bu türü henüz bilmiyorsun; önce araştır.' };
      if (o.kind !== 'ek' && o.sub && !Genres.subAvailable(ctx, o.sub)) return { ok: false, msg: 'Bu alt tür henüz yok ya da bilinmiyor.' };
      const maxTech = Office.maxTech(ctx, room.id);
      const locked = o.platforms.map((id) => M.platformById(ctx, id)).filter((p) => !p || (!p.own && p.tech > maxTech));
      if (locked.some((p) => !p)) return { ok: false, msg: 'Bu platform artık piyasada değil.' };
      if (locked.length) return { ok: false, msg: `${locked[0].name} için daha iyi iş istasyonu lazım.` };
      const unlic = o.kind === 'ek' ? [] : Crew.unlicensed(ctx, o.platforms); // Konu H: platform lisansı
      if (unlic.length) return { ok: false, msg: `${M.platformById(ctx, unlic[0])?.name || unlic[0]} lisansı yok (Geliştir › Platform lisansları).` };
      const engErr = o.kind === 'ek' ? null : Engines.checkStart(ctx, o); // Konu E: motor, lisans, ara yazılım
      if (engErr) return { ok: false, msg: engErr };
      const cost = Prod.projectCost(ctx, o), fees = o.kind === 'ek' ? 0 : Engines.startFees(ctx, o);
      if (state.cash - cost - fees < -Eco.creditLimit(ctx)) return { ok: false, msg: `Geliştirme maliyeti ${(cost + fees).toLocaleString('tr-TR')} $; bütçe yetmiyor.` };
      ledger.post('gelistirme', -cost, `${o.name}: lisans ve kitler`);
      const pj = Prod.newProject(ctx, { ...o, roomId: room.id });
      Engines.attach(ctx, pj, o, o.kind === 'ek');
      pj.totalWeeks = Math.round(pj.totalWeeks * M.techProfile(ctx, pj).load);
      pj.cost = cost + fees;
      state.projects.push(pj);
      for (const rid of o.regions || []) if (!Regions.isNative(ctx, rid)) Regions.localize(ctx, pj.id, rid, 1, false); // sihirbazda seçilen çeviriler
      bus.fire('projectStarted', pj);
      ctx.news(`🎮 Yeni proje: "${o.name}"`, 'info');
      return { ok: true, project: pj };
    },
    setAlloc(pid, i, v) { const pj = api.projectById(pid); if (pj) pj.alloc[i] = clamp(v, 0, 100); },
    cancelProject(pid) {
      const pj = api.projectById(pid);
      if (!pj) return { ok: false };
      ctx.news(`🗑️ "${pj.name}" iptal edildi. Ekip sessizce masaya bakıyor.`, 'bad');
      for (const p of state.staff) p.morale = clamp(p.morale - 10, 0, 100);
      bus.fire('gameDefinitionCanceled', pj);
      state.projects = state.projects.filter((x) => x !== pj);
      if (!state.projects.length) state.crunch = false;
      return { ok: true };
    },
    release(o) { return Market.release(ctx, o); },
    previewReview(pid) { const pj = api.projectById(pid); return pj ? M.review({ ...ctx, rng: makeRng({ rng: 7 }) }, pj) : null; },
    campaign: (pid, id) => Crew.campaign(ctx, pid, id), // Konu H: büyük kampanya pazarlama departmanı ister
    // --- Yayın sonrası
    patch: (id) => Post.patch(ctx, id),
    priceDrop: (id) => Post.priceDrop(ctx, id),
    port: (id, pid) => Post.port(ctx, id, pid),
    // --- Satış listesi hamleleri (Konu A)
    budgetLine: (id) => Charts.budgetLine(ctx, id),
    shelfPay: (id) => Charts.toggleShelfPay(ctx, id),
    festival: (id) => Charts.festival(ctx, id),
    bulkBuy: (id) => Charts.bulkBuy(ctx, id),
    buyCover: (id) => Charts.buyCover(ctx, id),
    reprint: (id) => Charts.reprint(ctx, id),
    printAuto: (id) => Charts.togglePrintAuto(ctx, id),
    announce: (pid, weeks) => Charts.announce(ctx, pid, weeks),
    // --- Yayıncılar (Konu B)
    publishers: () => Pub.list(ctx),
    pitch: (pid, pubIds, o) => Pub.pitch(ctx, pid, pubIds, o),
    signOffer: (id) => Pub.sign(ctx, id),
    declineOffer: (id) => Pub.decline(ctx, id),
    negotiate: (id, move) => Pub.negotiate(ctx, id, move),
    auction: (pid) => Pub.auction(ctx, pid),
    acceptChange: (id, yes) => Pub.acceptChange(ctx, id, yes),
    hireAgent: (tier) => Pub.hireAgent(ctx, tier),
    fireAgent: () => Pub.fireAgent(ctx),
    orderDraft: (id) => Pub.orderDraft(ctx, id),
    buyRights: (ipId) => Pub.buyRights(ctx, ipId),
    // --- Bölgeler (Konu C)
    buyNet: (rid) => Regions.buyNet(ctx, rid),
    // --- Türler (Konu D)
    invent: (sid) => Genres.invent(ctx, sid),
    focusGroup: (o) => Genres.focusGroup(ctx, o),
    localizeLevel: (pid, rid, lv) => Regions.localize(ctx, pid, rid, lv, false),
    localizeGame: (gid, rid, lv) => Regions.localize(ctx, gid, rid, lv, true),
    startExpansion(gid) {
      const g = state.games.find((x) => x.id === gid);
      if (!Post.expansionAllowed(ctx, g)) return { ok: false, msg: 'Bu oyuna ek paket yapılamaz (çok eski ya da zaten yapılıyor).' };
      return api.startProject(Post.expansionDraft(ctx, g));
    },
    toggleCrunch() {
      state.crunch = !state.crunch;
      ctx.news(state.crunch ? '🔥 CRUNCH başladı. Pizza kutuları birikiyor, gözler kızarıyor.' : '😮‍💨 Crunch bitti. Herkes 14 saat uyudu.', state.crunch ? 'bad' : 'good');
    },

    // --- Kadro
    hire: (id) => Staff.hire(ctx, id),
    fire: (id) => Staff.fire(ctx, id),
    train: (id, tid) => Staff.train(ctx, id, tid),
    raise: (id) => Staff.raise(ctx, id, pack.economy.raiseOnDemand),
    // --- Odalar ve kariyer
    buildRoom(type, proposal) { const res = Staff.buildRoom(ctx, type, proposal); if (res.ok) Office.ensureOffice(state, pack); return res; },
    configureRoom: (id, proposal) => Office.configureRoom(ctx, id, proposal),
    demolishRoom(id) { const res = Staff.demolishRoom(ctx, id); if (res.ok) Office.ensureOffice(state, pack); return res; },
    placeFurniture: (roomId, item) => Office.placeFurniture(ctx, roomId, item),
    removeFurniture: (roomId, id) => Office.removeFurniture(ctx, roomId, id),
    // mode: 'otomatik' | 'oyun' | 'sozlesme' | 'destek:<projeId>'
    setRoomMode(id, mode) {
      const r = state.rooms.find((x) => x.id === id);
      if (!r) return { ok: false };
      if (mode.startsWith('destek:')) {
        const pid = +mode.split(':')[1];
        if (!state.projects.some((p) => p.id === pid)) return { ok: false, msg: 'Proje yok.' };
        if (state.projects.some((p) => p.roomId === r.id)) return { ok: false, msg: 'Bu odanın kendi projesi var; önce onu bitir.' };
        r.mode = 'destek'; r.target = pid; return { ok: true };
      }
      if (pack.rooms.modes[mode]) { r.mode = mode; r.target = null; }
      return { ok: true };
    },
    moveStaff: (id, roomId) => Staff.moveStaff(ctx, id, roomId),
    // Destek odasını bir projeye ata (null = tüm projeler)
    setRoomTarget(id, pid) {
      const r = state.rooms.find((x) => x.id === id);
      if (!r || !pack.rooms.targetable.includes(r.type)) return { ok: false, msg: 'Bu oda projeye atanamaz.' };
      if (pid && !state.projects.some((p) => p.id === pid)) return { ok: false, msg: 'Proje yok.' };
      r.target = pid || null;
      return { ok: true };
    },
    playerReport: (id) => Know.playerReport(ctx, id),
    levelUp: (id) => Staff.levelUp(ctx, id),
    changeCareer: (id, cid) => Staff.changeCareer(ctx, id, cid),
    outsource: (pid, i) => Prod.outsource(ctx, pid, i),
    localize: (pid, rid) => Prod.localize(ctx, pid, rid),
    startConsole: (d) => Con.startConsole(ctx, d),
    exclusiveDeal: (id) => War.exclusiveDeal(ctx, id),
    // --- Modern dönem
    releaseDLC: (id) => Modern.releaseDLC(ctx, id),
    seasonPass: (id) => Modern.seasonPass(ctx, id),
    streamKeys: (id) => Modern.streamKeys(ctx, id),
    earlyAccess: (pid) => Modern.startEA(ctx, pid),
    crowdfund: (pid) => Modern.crowdfund(ctx, pid),

    // --- Sözleşme, araştırma, motor
    acceptContract: (id) => Prod.acceptContract(ctx, id),
    startResearch: (id) => Prod.startResearch(ctx, id),
    buildEngine: (name, features, fromId = null) => Engines.buildEngine(ctx, name, features, fromId),
    toggleLicence: (id) => Engines.setLicensed(ctx, id),
    // --- Konu G: platform, anlaşmalar, hisseler
    setPlatRate: (r) => Platform.setRate(ctx, r),
    toggleCart: () => Platform.toggleCart(ctx),
    signDeal: (offerId, type, consoleId) => Platform.signDeal(ctx, offerId, type, consoleId),
    buyStake: (rid, to) => Platform.buyStake(ctx, rid, to),
    sellStake: (rid) => Platform.sellStake(ctx, rid),
    orderGame: (rid, o) => Platform.orderGame(ctx, rid, o),
    setPolicy: (rid, pol) => Platform.setPolicy(ctx, rid, pol),
    setBoost: (rid, lvl) => Platform.setBoost(ctx, rid, lvl),
    mergeStudio: (rid) => Platform.merge(ctx, rid),
    // --- Konu H: müdürler, otomasyon, platform lisansları
    setManager: (roomId, pid) => Staff.setManager(ctx, roomId, pid),
    setAuto: (roomId, on) => Crew.setAuto(ctx, roomId, on),
    buyLicense: (id) => Crew.buyLicense(ctx, id),
    startTech: (fid) => Engines.startTech(ctx, fid),

    // --- Ekonomi
    moveOffice() { const res = Eco.moveOffice(ctx); if (res.ok) Office.ensureOffice(state, pack); return res; },
    upgradeStations: () => Eco.upgradeStations(ctx),
    takeLoan: (a) => Eco.takeLoan(ctx, a),
    acquireRival: (id) => Market.acquireRival(ctx, id),
    setDesign: (bid, did) => Eco.setDesign(ctx, bid, did),
    // --- Tatil ve şirket
    sendVacation: (id) => People.sendVacation(ctx, id),
    setVacationPolicy: (id) => People.setVacationPolicy(ctx, id),
    goPublic: (pct) => Co.goPublic(ctx, pct),
    dividend: () => Co.dividend(ctx),
    buyback: () => Co.buyback(ctx),

    finalScore() {
      const s = pack.score;
      const avg = state.games.length ? state.games.reduce((a, g) => a + g.score, 0) / state.games.length : 0;
      return Math.round(Math.max(0, state.cash) / s.cashDiv + state.fans / s.fansDiv + avg * state.games.length / s.gameScoreDiv + state.prestige * s.prestigeMult + state.awards.length * s.prestigeMult);
    },
    save() { Office.ensureOffice(state, pack); return JSON.stringify(state); },
  };
  return api;
}

export function newGame(opts) { return makeGame(createState(opts)).init(); }
export function loadGame(json) { return makeGame(JSON.parse(json)); }
export { M, Prod, Eco, Market, Staff, Con, Post, Know, World, People, Co, War, Modern, Charts, Pub, Regions, Genres, Engines, Platform, Crew };
