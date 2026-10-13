// Çekirdek servisler: takvim, olay veriyolu, tohumlu RNG, defter (ledger), ara değer yardımcıları.
// DOM'a dokunmaz; Node ve tarayıcıda aynı çalışır.

// --- Tohumlu RNG (mulberry32). Durum state.rng içinde saklanır, kayıt/yükleme aynı sonucu verir.
export function makeRng(state) {
  return {
    next() {
      let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(a, b) { return a + (b - a) * this.next(); },
    int(a, b) { return Math.floor(this.range(a, b + 1)); },
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; },
    chance(p) { return this.next() < p; },
    normal(mean, sd) {
      const u = Math.max(1e-9, this.next()), v = this.next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
}

// --- Olay veriyolu
export function makeBus() {
  const subs = {};
  return {
    on(key, fn) { (subs[key] ||= []).push(fn); },
    off(key, fn) { subs[key] = (subs[key] || []).filter((f) => f !== fn); },
    fire(key, payload) { for (const fn of subs[key] || []) fn(payload); },
  };
}

// --- Defter: tüm para hareketleri buradan geçer.
export function makeLedger(state, bus) {
  return {
    post(category, amount, note = '') {
      if (!Number.isFinite(amount) || amount === 0) return;
      state.cash += amount;
      const y = Math.floor(state.week / 48);
      const row = (state.ledger.byYear[y] ||= {});
      row[category] = (row[category] || 0) + amount;
      state.ledger.total[category] = (state.ledger.total[category] || 0) + amount;
      state.ledger.recent.unshift({ w: state.week, c: category, a: Math.round(amount), n: note });
      if (state.ledger.recent.length > 60) state.ledger.recent.length = 60;
      bus.fire('ledgerPosted', { category, amount });
    },
    sum(category) { return state.ledger.total[category] || 0; },
    yearProfit(y) { return Object.values(state.ledger.byYear[y] || {}).reduce((a, b) => a + b, 0); },
  };
}

// --- Takvim (y/m/w). 1 ay = 4 hafta, 1 yıl = 48 hafta.
export function calendar(state, pack) {
  const w = state.week;
  const y = Math.floor(w / 48), m = Math.floor((w % 48) / 4), wk = w % 4;
  const start = pack.meta.startYear;
  const gameYear = start + w / 48;
  const tableYear = start + (gameYear - start) / state.lengthMult; // V: tablo yılı
  return { y: y + 1, m: m + 1, w: wk + 1, tableYear, label: `Y${y + 1} A${m + 1} H${wk + 1}`, era: Math.floor(tableYear) };
}

// --- Ara değer yardımcıları
export function lerpTable(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}

// Logaritmik ara değer; son aralığın eğimiyle dışa doğru devam eder.
export function logTable(points, x) {
  const n = points.length;
  let i = 1;
  while (i < n - 1 && x > points[i][0]) i++;
  if (x < points[0][0]) i = 1;
  const [x0, y0] = points[i - 1], [x1, y1] = points[i];
  const t = (x - x0) / (x1 - x0);
  return Math.exp(Math.log(y0) + t * (Math.log(y1) - Math.log(y0)));
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function money(n) {
  const s = Math.abs(n) >= 1e9 ? (n / 1e9).toFixed(2) + ' Mr' : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + ' M' : Math.abs(n) >= 1e4 ? (n / 1e3).toFixed(1) + ' B' : Math.round(n).toString();
  return s + ' $';
}
