import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canvasDOM } from './support/canvas-dom.mjs';

test('HTML menüler Phaser ile açılır; yeni kariyer, sihirbaz ve ofis araçları bağlanır', { timeout: 15000 }, async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const env = canvasDOM(html);
  const { window } = env, errors = [];
  window.addEventListener('error', (e) => { errors.push(e.error || e.message); e.preventDefault(); });
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: class { observe() {} disconnect() {} } });
  window.document.querySelector('#stage').getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 844, height: 500, right: 844, bottom: 500 });
  const timers = new Set(), originalSet = globalThis.setInterval;
  globalThis.setInterval = (...args) => { const timer = originalSet(...args); timers.add(timer); return timer; };
  let phaser;
  const click = (selector) => {
    const button = window.document.querySelector(selector);
    assert.ok(button, selector); assert.equal(button.disabled, false, selector);
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.deepEqual(errors, []);
  };
  try {
    const { boot } = await import('../src/ui/ui.js');
    phaser = (await import('phaser/dist/phaser.js')).default;
    boot(window.document.body);
    assert.match(window.document.querySelector('#modal').textContent, /garajı aç/);
    window.localStorage.setItem('xp-tut-done', '1');
    window.document.querySelector('#n-seed').value = '1976';
    click('[data-act=begin]');
    assert.equal(window.document.querySelector('#modal').hidden, true);
    assert.equal(window.document.querySelector('#win').hidden, false);
    click('[data-act=wiz][data-id="1"]');
    const choices = window.document.querySelectorAll('[data-plat]');
    assert.ok(choices.length > 0, 'platform adımı açıldı');
    click('[data-act=wiz][data-id="1"]');
    // Motor seçimi varsa teknoloji adımı; yoksa doğrudan onay.
    if (!window.document.querySelector('[data-act=start]')) click('[data-act=wiz][data-id="1"]');
    click('[data-act=start]');
    assert.match(window.document.querySelector('#modal').textContent, /zamanını/);
    click('[data-act=close-dialog]');
    if (!window.document.querySelector('#win').hidden) click('[data-act=close-win]');
    await new Promise((resolve) => setTimeout(resolve, 150));
    click('[data-office=edit]');
    assert.equal(window.document.querySelector('.office-edit').hidden, false);
    const group = window.document.querySelector('[data-office-group]');
    group.value = 'konfor'; group.dispatchEvent(new window.Event('change', { bubbles: true }));
    const product = window.document.querySelector('[data-office-product]');
    product.value = 'plant-basic'; product.dispatchEvent(new window.Event('change', { bubbles: true }));
    click('[data-office=buy]');
    assert.equal(window.document.querySelector('[data-office=confirm]').disabled, false);
    click('[data-office=confirm]');
    const save = JSON.parse(window.localStorage.getItem('xproject-save-v2'));
    assert.ok(save.officeWorld);
    assert.equal(Object.values(save.officeWorld.rooms)[0].items.filter((f) => f.type === 'plant').length, 1);
    click('[data-act=build-menu]');
    assert.ok(window.document.querySelector('#build-w'));
    click('[data-act=build][data-id=mola]');
    assert.equal(window.document.querySelector('[data-office=confirm]').disabled, false);
    click('[data-office=confirm]');
    const built = JSON.parse(window.localStorage.getItem('xproject-save-v2'));
    assert.equal(built.rooms.length, 2);
    assert.equal(built.officeWorld.rooms[built.rooms[1].id].items.length, 0);
    click('[data-office=edit]');
    assert.equal(window.document.querySelector('.office-edit').hidden, true);
    assert.deepEqual(errors, []);
  } finally {
    globalThis.setInterval = originalSet; for (const timer of timers) clearInterval(timer);
    for (const game of phaser?.GAMES || []) if (game && !game.isDestroyed) { game.destroy(true); game.runDestroy(); }
    env.window.close();
  }
});
