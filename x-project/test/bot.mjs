// Basit politika botu: duman testi ve denge ayarı için. Gerçek oyuncu değil.
import { newGame } from '../src/game.js';
import * as M from '../src/models.js';
import { researchAvailable, researchInfo } from '../src/systems/production.js';
import { stationUpgradeCost } from '../src/systems/economy.js';
import { publishersAvailable } from '../src/systems/market.js';
import * as Staff from '../src/systems/staff.js';

export function runBot({ seed = 1, difficulty = 'orta', years = 20, verbose = false } = {}) {
  const g = newGame({ seed, difficulty, length: 30 });
  const { state, pack, ctx } = g;
  const order = ['alt_tur', 'f_metin', 'motor_ozel', 'boyut_orta', 'f_sprite', 'tur_rpg', 'pazarlama_kucuk', 'f_renk', 'kopya_koruma', 'f_kaydirma', 'oz_yayin', 'tur_sim', 'tur_str', 'f_sescip', 'f_kayit', 'boyut_buyuk', 'pazarlama_buyuk', 'f_256', 'f_3d'];
  let n = 0;
  while (state.week < years * 48 && !state.gameOver) {
    while (state.pending.length) g.resolve(0);
    const y = M.tableYear(ctx);
    // araştırma
    if (!state.research.current) {
      const av = researchAvailable(ctx);
      const next = order.map((id) => av.find((r) => r.id === id)).find(Boolean);
      if (next && state.research.rp >= researchInfo(ctx, next).rp && state.cash > researchInfo(ctx, next).cost * 4) g.startResearch(next.id);
    }
    // motor
    if (state.research.done.motor_ozel && !state.engineJob) {
      const feats = pack.research.filter((r) => r.engine && state.research.done[r.id]).map((r) => r.id);
      const last = state.engines[state.engines.length - 1];
      if (feats.length && (!last || feats.length > last.features.length + 1) && state.cash > 300000 * M.inflation(ctx)) g.buildEngine(`Motor ${state.engines.length + 1}`, feats);
    }
    // proje
    if (!state.project) {
      const sizes = pack.sizes.filter((s) => !s.mmo && (!s.research || state.research.done[s.research]) && state.office.tier >= s.office);
      const size = sizes[sizes.length - 1];
      const genres = pack.genres.filter((x) => !x.research || state.research.done[x.research]);
      const genre = genres[n % genres.length];
      const topics = pack.topics.filter((t) => t[4] <= y);
      const gi = pack.genres.indexOf(genre);
      const topic = topics.filter((t) => t[2][gi] >= 9)[n % 3] || topics[0];
      const maxTech = pack.workstations.tiers[state.stationTier].maxTech;
      const plats = M.activePlatforms(ctx).filter((p) => p.tech <= maxTech).sort((a, b) => M.platformBase(ctx, b) - M.platformBase(ctx, a)).slice(0, 2).map((p) => p.id);
      const sub = state.research.done.alt_tur ? genre.good[0] : null;
      const share = { oyn: 0, gfx: 0, ses: 0, tek: 0 };
      pack.missions.forEach((m) => (share[m.disc] += 1));
      const alloc = pack.missions.map((m, i) => Math.round(100 * genre.disc[m.disc] / share[m.disc] * genre.mission[i]));
      const eng = state.engines[state.engines.length - 1];
      g.startProject({ name: `Oyun ${++n}`, genre: genre.id, sub, topic: topic[0], audience: 'herkes', platforms: plats, size: size.id, alloc, engineId: eng?.id });
    } else if (state.project.status === 'debug') {
      const pj = state.project;
      const pts = Object.values(pj.points).reduce((a, b) => a + b, 0);
      if (pj.bugs / pts < 0.02 || state.week - pj.startedWeek > pj.totalWeeks + 6) {
        const pubs = publishersAvailable(ctx).filter((p) => state.fans >= p.minFans).sort((a, b) => b.power - a.power);
        const self = state.research.done.oz_yayin && state.fans > 100000;
        g.release({ publisherId: self ? null : pubs[0]?.id, price: 30 });
      }
    } else if (!state.project.campaigned && state.project.week > state.project.totalWeeks / 2 && state.cash > 150000 * M.inflation(ctx)) state.project.campaigned = g.campaign(state.research.done.pazarlama_buyuk && state.cash > 2e6 ? 'tv' : state.research.done.pazarlama_kucuk ? 'dergi' : 'flyer');
    // kadro & ofis
    if (state.week % 4 === 1) {
      const wages = state.staff.reduce((s, p) => s + p.salary, 0) || 1000;
      const seats = Staff.seats(ctx);
      if (state.staff.length < seats && state.cash > wages * 18) {
        const best = [...state.applicants].sort((a, b) => b.skill / b.salary - a.skill / a.salary)[0];
        if (best) g.hire(best.id);
      }
      // Dolu odalar varsa yeni oda kur (sıra: geliştirme, QA, grafik, ses, geliştirme, araştırma, ...)
      if (state.staff.length >= seats && state.rooms.length < Staff.slots(ctx) && state.cash > wages * 12) {
        const want = ['gelistirme', 'qa', 'grafik', 'ses', 'gelistirme', 'arastirma', 'gelistirme', 'mola'];
        const counts = {};
        const next = want.find((t) => { counts[t] = (counts[t] || 0) + 1; const have = state.rooms.filter((r) => r.type === t).length; const rt = pack.rooms.types.find((x) => x.id === t); return have < counts[t] && (!rt.research || state.research.done[rt.research]); }) || 'gelistirme';
        g.buildRoom(next);
      }
      const nextOffice = pack.offices.find((o) => o.tier === state.office.tier + 1);
      const full = state.staff.length >= seats && state.rooms.length >= Staff.slots(ctx);
      if (!nextOffice && full && state.cash > 1500000 * M.inflation(ctx) ** 0.5 * 2) g.moveOffice();
      if (nextOffice && full && state.cash > nextOffice.cost * M.inflation(ctx) ** 0.5 * 1.15 + wages * 6) g.moveOffice();
      const sc = stationUpgradeCost(ctx);
      if (sc && M.expectedStationTier(ctx) > state.stationTier && state.cash > sc * 3) g.upgradeStations();
      if (!state.contract && state.cash < wages * 6 && state.contractOffers.length) g.acceptContract(state.contractOffers[0].id);
      const dev = state.rooms.filter((r) => r.type === 'gelistirme');
      for (const r of dev) r.mode = 'otomatik';
      if (state.contract) dev[dev.length > 1 ? dev.length - 1 : 0].mode = 'sozlesme';
      // Artan RP ile kariyer seviyesi
      if (state.research.rp > 120) {
        const p = [...state.staff].sort((a, b) => (a.careers[a.career] || 0) - (b.careers[b.career] || 0))[0];
        if (p) g.levelUp(p.id);
      }
    }
    if (verbose && state.week % 48 === 0) console.log(Math.floor(M.tableYear(ctx)), Math.round(state.cash), state.staff.length, state.games.slice(-3).map((x) => x.score).join('/'), JSON.stringify(state.ledger.byYear[state.week / 48 - 1] || {}));
    g.tick();
  }
  const scores = state.games.map((x) => x.score);
  const r = {
    over: state.gameOver?.reason || null, year: Math.floor(M.tableYear(ctx)), cash: Math.round(state.cash), games: state.games.length,
    avgScore: scores.length ? Math.round(scores.slice(-6).reduce((a, b) => a + b, 0) / Math.min(6, scores.length)) : 0,
    staff: state.staff.length, fans: state.fans, prestige: state.prestige, kaos: Math.round(state.kaos), office: state.office.tier,
  };
  if (verbose) console.log(r, state.ledger.total);
  return r;
}
