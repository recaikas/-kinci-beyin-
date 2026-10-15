// Node entegrasyon ortamı: gerçek tarayıcı değildir. Phaser'ın Canvas çizicisini yerel raster ile çalıştırır.
import { JSDOM } from 'jsdom';
import { createCanvas, Image } from '@napi-rs/canvas';

export function canvasDOM(html = '<canvas id="scene"></canvas>') {
  const dom = new JSDOM(html, { url: 'https://x-project.test/', pretendToBeVisual: true });
  const { window } = dom;
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator, Image,
    HTMLCanvasElement: window.HTMLCanvasElement, HTMLVideoElement: window.HTMLVideoElement, HTMLImageElement: Image,
    Element: window.Element, screen: window.screen, self: window,
    requestAnimationFrame: window.requestAnimationFrame.bind(window), cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  })) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  window.Image = Image; window.focus = () => {}; window.scrollTo = () => {};
  const canvases = new WeakMap(), contexts = new WeakMap();
  for (const dimension of ['width', 'height']) {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLCanvasElement.prototype, dimension);
    Object.defineProperty(window.HTMLCanvasElement.prototype, dimension, {
      ...descriptor,
      set(value) { descriptor.set.call(this, value); const c = canvases.get(this); if (c) c[dimension] = this[dimension] || 1; },
    });
  }
  function native(element) {
    if (!canvases.has(element)) canvases.set(element, createCanvas(element.width || 1, element.height || 1));
    const c = canvases.get(element);
    if (c.width !== (element.width || 1)) c.width = element.width || 1;
    if (c.height !== (element.height || 1)) c.height = element.height || 1;
    return c;
  }
  window.HTMLCanvasElement.prototype.getContext = function (type) {
    if (type !== '2d') return null;
    const c = native(this);
    if (!contexts.has(this)) {
      const element = this, target = c.getContext('2d');
      contexts.set(this, new Proxy(target, {
        get(g, key) {
          if (key === 'canvas') return element;
          if (key === 'drawImage' || key === 'createPattern') return (source, ...args) => g[key](source instanceof window.HTMLCanvasElement ? native(source) : source, ...args);
          const value = g[key]; return typeof value === 'function' ? value.bind(g) : value;
        },
        set(g, key, value) { g[key] = value; return true; },
      }));
    }
    return contexts.get(this);
  };
  window.HTMLCanvasElement.prototype.toDataURL = function (...args) { return native(this).toDataURL(...args); };
  return { window, dom, native };
}
