// Finans: genel tablo ve şirket/borsa.
import { Eco, Co } from '../game.js';
import { PACK } from '../data/pack.js';
import { money } from '../kernel.js';
import { esc, bar } from './util.js';

export function make(u) {
  const { G, ctx } = u;
  const chart = (...a) => u.chart(...a);
  // ---------- FİNANS
  function companyView() {
    const g = G(), s = g.state, c = ctx(), I = PACK.ipo;
    const co = Co.company(s), v = Co.valuation(c);
    const vh = co.valHist.slice(-120);
    const vchart = `<section class="box"><h3>Şirket değeri (aylık)</h3>${chart('val', vh, { labels: vh.map((_, i) => (i === vh.length - 1 ? 'şimdi' : `${vh.length - 1 - i} ay önce`)), fmtv: money, color: 'var(--amber)' })}</section>`;
    const head = `<section class="box"><div class="kv"><span>Şirket değeri</span><b class="num">${money(v)}</b><span>Son yıl faaliyet kârı</span><b class="num">${money(Co.operatingProfit(c, Math.floor(s.week / 48) - 1))}</b>
      <span>Durum</span><b>${co.listed ? `Borsada · halka açık %${Math.round(co.pct * 100)}` : 'Özel şirket'}</b>${co.listed ? `<span>Hisse fiyatı</span><b class="num">${co.price} $</b>` : ''}</div>
      <p class="muted small">Değer = nakit − borç + son 3 yılın ortalama kârı × ${I.profitMult} + hayran, marka (IP) ve prestij.</p></section>`;
    if (!co.listed) {
      const need = Co.ipoCheck(c);
      return head + `<section class="box ${need.length ? '' : 'hl'}"><h3>Halka arz</h3>
        <p class="small">Hisselerinin bir kısmını satıp kasaya büyük para koy. Karşılığında her çeyrek (12 hafta) faaliyet gelirinin son 4 çeyreğin ortalamasını %${(I.growthTarget * 100).toFixed(1)} aşması beklenir; tutmazsa yönetim kurulu baskısı artar, %100'de seni görevden alırlar.</p>
        ${need.length ? `<ul class="todo">${need.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<div class="btns">${I.sellPcts.map((p) => `<button data-act="ipo" data-id="${p}">%${Math.round(p * 100)} sat<small>${money(v * p * I.discount)}</small></button>`).join('')}</div>`}</section>` + vchart;
    }
    const ph = co.priceHist.slice(-104);
    const q = co.quarters.map((x) => `<tr><td>Y${Math.floor(x.w / 48) + 1} A${Math.floor((x.w % 48) / 4) + 1}</td><td class="num">${money(x.rev)}</td><td class="num">${money(x.target)}</td><td class="${x.beat ? 'up' : 'down'}">${x.beat ? 'Aşıldı' : 'Kaçtı'}</td></tr>`).join('');
    const left = I.quarterWeeks - (s.week - co.qStart);
    return head + `<section class="box ${co.pressure >= I.boardAt ? 'hl' : ''}"><div class="head"><h3>Yönetim kurulu baskısı</h3><span class="pill ${co.pressure >= I.boardAt ? 'warn' : ''}">%${Math.round(co.pressure)}</span></div>${bar(co.pressure, 's')}
      <p class="muted small">Bu çeyreğin bitmesine ${left} hafta. Hedef: ${money(Co.quarterTarget(c))} faaliyet geliri, son 4 çeyreğin ortalaması +%${(I.growthTarget * 100).toFixed(1)} (şu an ${money(Co.quarterRevenue(c))}).</p>
      <div class="btns"><button data-act="dividend">Temettü dağıt<small>${money(Math.max(0, s.cash) * I.dividendShare * co.pct)}</small></button><button data-act="buyback">%5 hisse geri al<small>${money(Co.buybackCost(c))}</small></button></div></section>
      <section class="box"><h3>Hisse fiyatı</h3>${chart('price', ph, { labels: ph.map((_, i) => (i === ph.length - 1 ? 'şimdi' : `${ph.length - 1 - i} hf önce`)), fmtv: (x) => `${(+x).toFixed(2)} $`, color: 'var(--sky)' })}</section>
      ${q ? `<div class="scroll"><table><thead><tr><th>Çeyrek</th><th>Gelir</th><th>Hedef</th><th></th></tr></thead><tbody>${q}</tbody></table></div>` : ''}` + vchart;
  }
  function winFinance(sub) {
    if (sub === 'sirket') return companyView();
    const g = G(), s = g.state, c = ctx();
    const y = Math.floor(s.week / 48), years = [y - 2, y - 1, y].filter((v) => v >= 0);
    const cats = [...new Set(years.flatMap((v) => Object.keys(s.ledger.byYear[v] || {})))].sort();
    const yearName = (v) => String(Math.floor(PACK.meta.startYear + v / s.lengthMult));
    const head = years.map((v) => `<th>${yearName(v)}</th>`).join('');
    const rows = cats.map((k) => `<tr><td>${k.replace('_', ' ')}</td>${years.map((v) => { const a = (s.ledger.byYear[v] || {})[k] || 0; return `<td class="num ${a < 0 ? 'neg' : ''}">${a ? money(a) : '—'}</td>`; }).join('')}</tr>`).join('');
    const tot = `<tr class="tot"><td>Net</td>${years.map((v) => { const a = g.ctx.ledger.yearProfit(v); return `<td class="num ${a < 0 ? 'neg' : ''}">${money(a)}</td>`; }).join('')}</tr>`;
    const owed = s.loans.reduce((a, l) => a + l.remaining, 0), avail = Math.max(0, Eco.creditLimit(c) * 3 - owed);
    const allYears = Array.from({ length: y + 1 }, (_, i) => i).slice(-15);
    const cash = s.cashHist.slice(-120);
    return `<section class="box"><div class="kv"><span>Aylık maaş</span><b class="num">${money(s.staff.reduce((a, p) => a + p.salary, 0))}</b><span>Aylık kira</span><b class="num">${money(Eco.rent(c))}</b>
      <span>Kredi limiti</span><b class="num">${money(Eco.creditLimit(c))}</b><span>Borç</span><b class="num">${money(owed)}</b></div>
      ${s.debtWeeks ? `<p class="neg">Limit aşımı: ${s.debtWeeks}/${PACK.economy.bankruptWeeks} hafta. Sonra iflas.</p>` : ''}
      <p class="muted small">Kredi: 24 ay, yıllık %${Math.round(PACK.economy.loanRateYear * 100)}.</p>
      <div class="btns">${[0.25, 0.5, 1].map((f) => `<button data-act="loan" data-id="${Math.round(avail * f)}" ${avail < 1000 ? 'disabled' : ''}>${money(avail * f)} çek</button>`).join('')}</div></section>
      <section class="box"><h3>Kasa (aylık, son 10 yıl)</h3>${chart('cash', cash, { labels: cash.map((_, i) => `${cash.length - i} ay önce`).map((l, i, a) => (i === a.length - 1 ? 'şimdi' : l)), fmtv: money, color: 'var(--candy)' })}</section>
      <section class="box"><h3>Yıllık net kâr / zarar</h3>${chart('net', allYears.map((v) => g.ctx.ledger.yearProfit(v)), { labels: allYears.map(yearName), fmtv: money, kind: 'bar' })}</section>
      <div class="scroll"><table><thead><tr><th>Kalem</th>${head}</tr></thead><tbody>${rows}${tot}</tbody></table></div>`;
  }
  return { companyView, winFinance };
}
