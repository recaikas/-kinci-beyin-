import * as Office from '../systems/office.js';
import { GROUPS } from '../data/office.js';
import { money } from '../kernel.js';
import { esc } from './util.js';
const short = { calisma: 'Çalışma', bilgisayar: 'Bilgisayar', konfor: 'Konfor & mola', hizmet: 'Tuvalet', departman: 'Ekipman' };
export function catalogHTML(ctx, roomId, group, selected, thumbnail) {
  const list = Office.catalog(ctx, roomId), y = Office.year(ctx);
  const groups = Object.entries(GROUPS).filter(([id]) => list.some((p) => p.group === id));
  if (!groups.some(([id]) => id === group)) group = groups[0]?.[0];
  const products = list.filter((p) => p.group === group);
  if (!products.some((p) => p.id === selected)) selected = products.find((p) => p.year <= y)?.id || products[0]?.id;
  return { group, selected,
    categories: groups.map(([id,name]) => `<button type="button" data-office="category" data-value="${id}" aria-label="${esc(name)}" aria-pressed="${id === group}">${short[id]}</button>`).join(''),
    products: products.map((p) => { const image = thumbnail(p.id); return `<button type="button" class="catalog-product" data-office="product" data-value="${p.id}" aria-pressed="${p.id === selected}" ${p.year > y ? 'disabled' : ''}><span class="product-picture">${image ? `<img src="${image}" alt="" width="76" height="62">` : '<span aria-hidden="true">◇</span>'}</span><strong>${esc(p.name)}</strong><span class="product-price">${p.year > y ? `${p.year} yılında` : money(Office.price(ctx, p.id))}</span><span class="product-year">${p.year}</span></button>`; }).join('') || '<p class="muted small">Bu odaya uygun eşya yok.</p>',
  };
}
export function conditionHTML(ctx, roomId) {
  const model = ctx.state.rooms.find((r) => r.id === roomId);
  if (!model) return { metrics:'', needs:'' };
  const people = ctx.state.staff.filter((p) => p.room === roomId), reports = people.map((p) => Office.workReport(ctx,p));
  const mean = (key) => reports.reduce((s,r) => s + r[key],0) / Math.max(1,reports.length);
  const metrics = [[Office.workstations(ctx,roomId).length,'Hazır çalışma yeri'],[people.length,'Çalışan'],[reports.length ? `%${Math.round(mean('factor')*100)}` : '—','Üretim katsayısı'],[reports.length ? `${Math.round(mean('temperature'))}°` : '—','Oda sıcaklığı']];
  const reasons = [...new Set(reports.flatMap((r) => r.reasons))];
  return { metrics:metrics.map(([v,k]) => `<div class="office-metric"><b>${v}</b><span>${k}</span></div>`).join(''), needs: reasons.map((r) => `<p class="need-line">${esc(r)}</p>`).join('') || `<p class="need-line">${people.length ? 'Çalışanların ihtiyaçları karşılanıyor.' : 'Odayı donattıktan sonra çalışan atayabilirsin.'}</p>` };
}
