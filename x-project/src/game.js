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

export function createState({ companyName = 'X Project Stüdyo', founderName = 'Sen', difficulty = 'orta', length = PACK.meta.defaultLength, seed = 1976, founderSpec = 'oyn' } = {}) {
  const diff = PACK.difficulties.find((d) => d.id === difficulty);
  return {
    version: 1, seed, rng: seed >>> 0, week: 0, lengthYears: length, lengthMult: PACK.meta.gameLengths[length], difficulty,
    companyName, founderName, founderSpec, cash: 0, startCash: diff.startCash,
    ledger: { byYear: {}, total: {}, recent: [] },
    office: { tier: 1, floors: 0 }, stationTier: 0, stationDown: 0, rentMult: 1,
    staff: [], applicants: [], nextId: 1,
    research: { done: {}, current: null, rp: 0 }, engines: [], engineJob: null, usedFeatures: {},
    project: null, contract: null, contractOffers: [], games: [], ips: [], charts: [], awards: [],
    fans: 0, prestige: 0, reputation: 0, kaos: 0, heat: 0, crunch: false,
    marketMods: [], gameMods: [], erasFired: {}, trend: null, rivals: [],
    loans: [], debtWeeks: 0, flags: {},
    pending: [], eventCounts: {}, lastEvents: [], nextEventWeek: 20,
    news: [], gameOver: null, lastCombo: null,
  };
}

export function makeGame(state, pack = PACK) {
  const bus = makeBus();
  const rng = makeRng(state);
  const ledger = makeLedger(state, bus);
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

  const api = {
    ctx, state, pack, bus,
    cal: () => calendar(state, pack),

    init() {
      ledger.post('sermaye', state.startCash, 'Başlangıç sermayesi');
      const founder = Staff.makePerson(ctx, { skill: pack.production.founderSkill, spec: state.founderSpec, founder: true, name: state.founderName });
      state.staff.push(founder);
      Staff.genApplicants(ctx);
      Prod.genContracts(ctx);
      Market.initRivals(ctx);
      Market.weeklyTrend(ctx);
      ctx.news(`🏚️ ${state.companyName} bir garajda kuruldu. Masada tek bir bilgisayar, kafada büyük hayaller.`, 'info');
      return api;
    },

    // Bir hafta ilerlet. Bekleyen karar varsa durur.
    tick() {
      if (state.gameOver || state.pending.length) return false;
      state.week++;
      const newMonth = state.week % 4 === 0;
      const newYear = state.week % 48 === 0;
      // personel / üretim
      Staff.weeklyStaff(ctx);
      Prod.weeklyProject(ctx);
      Prod.weeklyContract(ctx);
      // araştırma
      Prod.weeklyResearch(ctx);
      // satış
      Market.weeklySales(ctx);
      Market.weeklyTrend(ctx);
      Market.weeklyRivals(ctx);
      // ekonomi
      if (newMonth) {
        Eco.monthlyEconomy(ctx);
        Market.monthlyMmo(ctx);
        Market.monthlySubsidiaries(ctx);
        Staff.genApplicants(ctx);
        if (!state.contract || state.contractOffers.length === 0) Prod.genContracts(ctx);
        bus.fire('monthProceeded', state.week);
      }
      if (newYear) {
        state.prestige = Math.max(0, state.prestige - pack.prestige.decayPerYear);
        bus.fire('yearProceeded', state.week);
      }
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

    // --- Proje
    startProject(o) {
      if (state.project) return { ok: false, msg: 'Zaten bir proje var.' };
      const size = pack.sizes.find((s) => s.id === o.size);
      if (size.research && !state.research.done[size.research]) return { ok: false, msg: 'Bu boyut için araştırma gerekli.' };
      if (state.office.tier < size.office) return { ok: false, msg: `Bu boyut için en az "${pack.offices[size.office - 1].name}" gerekli.` };
      if (!o.platforms?.length) return { ok: false, msg: 'En az bir platform seç.' };
      const maxTech = pack.workstations.tiers[state.stationTier].maxTech;
      const locked = o.platforms.map((id) => pack.platforms.find((p) => p.id === id)).filter((p) => p.tech > maxTech);
      if (locked.length) return { ok: false, msg: `${locked[0].name} için daha iyi iş istasyonu lazım.` };
      const cost = Prod.projectCost(ctx, o);
      if (state.cash - cost < -Eco.creditLimit(ctx)) return { ok: false, msg: `Geliştirme maliyeti ${cost.toLocaleString('tr-TR')} $; bütçe yetmiyor.` };
      ledger.post('gelistirme', -cost, `${o.name}: lisans ve kitler`);
      state.project = Prod.newProject(ctx, o);
      bus.fire('projectStarted', state.project);
      ctx.news(`🎮 Yeni proje: "${o.name}"`, 'info');
      return { ok: true };
    },
    setAlloc(i, v) { if (state.project) state.project.alloc[i] = clamp(v, 0, 100); },
    cancelProject() {
      if (!state.project) return;
      ctx.news(`🗑️ "${state.project.name}" iptal edildi. Ekip sessizce masaya bakıyor.`, 'bad');
      for (const p of state.staff) p.morale = clamp(p.morale - 10, 0, 100);
      bus.fire('gameDefinitionCanceled', state.project);
      state.project = null; state.crunch = false;
    },
    release(o) { return Market.release(ctx, o); },
    previewReview() { return state.project ? M.review({ ...ctx, rng: makeRng({ rng: 7 }) }, state.project) : null; },
    campaign(id) {
      const c = pack.hype.campaigns.find((x) => x.id === id);
      if (!state.project) return { ok: false, msg: 'Pazarlanacak proje yok.' };
      if (c.research && !state.research.done[c.research]) return { ok: false, msg: 'Araştırma gerekli.' };
      ledger.post('pazarlama', -Math.round(c.cost * M.inflation(ctx) ** 0.7), c.name);
      state.project.hype = clamp(state.project.hype + c.hype, 0, pack.hype.max);
      return { ok: true };
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
    assign(id, role) { const p = state.staff.find((x) => x.id === id); if (p) p.assign = role; },
    assignAll(role) { for (const p of state.staff) p.assign = role; },

    // --- Sözleşme, araştırma, motor
    acceptContract: (id) => Prod.acceptContract(ctx, id),
    startResearch: (id) => Prod.startResearch(ctx, id),
    buildEngine: (name, features) => Prod.buildEngine(ctx, name, features),
    toggleLicence(id) {
      if (!state.research.done.motor_lisans) return { ok: false, msg: 'Motor lisanslama araştırması gerekli.' };
      const e = state.engines.find((x) => x.id === id); if (e) e.licensed = !e.licensed; return { ok: true };
    },

    // --- Ekonomi
    moveOffice: () => Eco.moveOffice(ctx),
    upgradeStations: () => Eco.upgradeStations(ctx),
    takeLoan: (a) => Eco.takeLoan(ctx, a),
    acquireRival: (id) => Market.acquireRival(ctx, id),

    finalScore() {
      const s = pack.score;
      const avg = state.games.length ? state.games.reduce((a, g) => a + g.score, 0) / state.games.length : 0;
      return Math.round(Math.max(0, state.cash) / s.cashDiv + state.fans / s.fansDiv + avg * state.games.length / s.gameScoreDiv + state.prestige * s.prestigeMult + state.awards.length * s.prestigeMult);
    },
    save() { return JSON.stringify(state); },
  };
  return api;
}

export function newGame(opts) { return makeGame(createState(opts)).init(); }
export function loadGame(json) { return makeGame(JSON.parse(json)); }
export { M, Prod, Eco, Market, Staff };
