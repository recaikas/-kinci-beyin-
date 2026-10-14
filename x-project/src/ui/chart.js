// SVG grafikler ve üzerine gelince çizgi + değer.
import { esc, fmt, bar } from './util.js';

export function make(u) {
  const { app, root } = u;
  // ---------- GRAFİKLER: tek seri, ortak bir y ekseni, üzerine gelince çizgi + değer (kayıtlı veri app.charts'ta)
  function chart(id, values, { labels = [], fmtv = fmt, color = 'var(--sky)', kind = 'line', h = 150, barCls = '' } = {}) {
    if (!values.length) return '<p class="muted small">Henüz veri yok.</p>';
    app.charts[id] = { values, labels, fmtv };
    const W = 600, H = h, pl = 54, pr = 10, pt = 10, pb = 22;
    const max = Math.max(1, ...values), min = Math.min(0, ...values);
    const x = (i) => pl + (values.length === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (values.length - 1));
    const y = (v) => pt + ((max - v) * (H - pt - pb)) / (max - min || 1);
    const ticks = (min < 0 ? [max, 0, min] : [max, max / 2, 0]).map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pl - 6}" y="${y(v) + 4}" class="ax" text-anchor="end">${esc(fmtv(v))}</text>`).join('');
    let marks = '';
    if (kind === 'bar') {
      const bw = Math.max(4, Math.min(28, (W - pl - pr) / values.length - 4));
      marks = values.map((v, i) => { const x0 = pl + ((i + 0.5) * (W - pl - pr)) / values.length - bw / 2; const top = Math.min(y(v), y(0)), hh = Math.max(1, Math.abs(y(v) - y(0))); return `<rect x="${x0}" y="${top}" width="${bw}" height="${hh}" rx="2" class="${barCls || (v < 0 ? 'neg' : 'pos')}"/>`; }).join('');
    } else {
      const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      marks = `<polygon points="${pl},${y(Math.max(0, min))} ${pts} ${x(values.length - 1)},${y(Math.max(0, min))}" fill="${color}" opacity="0.14"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>
        <circle cx="${x(values.length - 1)}" cy="${y(values[values.length - 1])}" r="4" fill="${color}" stroke="var(--panel-2)" stroke-width="2"/>`;
    }
    const lab = labels.length ? `<text x="${pl}" y="${H - 6}" class="ax">${esc(labels[0])}</text><text x="${W - pr}" y="${H - 6}" class="ax" text-anchor="end">${esc(labels[labels.length - 1])}</text>` : '';
    return `<div class="chart" data-chart="${id}" data-kind="${kind}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(id)}">${ticks}${marks}${lab}<line class="cross" x1="0" x2="0" y1="${pt}" y2="${H - pb}" visibility="hidden"/></svg><div class="tip" hidden></div></div>`;
  }
  const spark = (vals) => {
    if (!vals || vals.length < 2) return '';
    const max = Math.max(1, ...vals);
    return `<svg class="spark" viewBox="0 0 60 16" preserveAspectRatio="none" aria-hidden="true"><polyline points="${vals.map((v, i) => `${(i * 60) / (vals.length - 1)},${15 - (v / max) * 14}`).join(' ')}" fill="none" stroke="var(--sky)" stroke-width="1.5"/></svg>`;
  };
  root.addEventListener('pointermove', (e) => {
    const box = e.target.closest?.('.chart');
    if (!box) return;
    const data = app.charts[box.dataset.chart];
    if (!data) return;
    const svg = box.querySelector('svg'), r = svg.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width * 600;
    const n = data.values.length, pl = 54, pr = 10;
    const i = box.dataset.kind === 'bar' ? Math.floor(((fx - pl) / (600 - pl - pr)) * n) : Math.round(((fx - pl) / (600 - pl - pr)) * (n - 1));
    const k = Math.max(0, Math.min(n - 1, i));
    const cx = box.dataset.kind === 'bar' ? pl + ((k + 0.5) * (600 - pl - pr)) / n : pl + (n === 1 ? 0 : (k * (600 - pl - pr)) / (n - 1));
    const cross = svg.querySelector('.cross'); cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    const tip = box.querySelector('.tip');
    tip.hidden = false; tip.textContent = `${data.labels[k] ?? ''} · ${data.fmtv(data.values[k])}`;
    tip.style.left = `${Math.min(r.width - 140, Math.max(0, (cx / 600) * r.width - 60))}px`;
  });
  root.addEventListener('pointerleave', (e) => {
    const box = e.target.closest?.('.chart');
    if (box) { box.querySelector('.tip').hidden = true; box.querySelector('.cross').setAttribute('visibility', 'hidden'); }
  }, true);

  return { chart, spark };
}
