// Geçici, kodla üretilen sprite atlası. Nihai çizimler aynı texture anahtarlarıyla değiştirilebilir.
// Oyun durumuna yazmaz; bütün odalarda aynı ölçek, ışık yönü ve ayak noktası kullanılır.
import { FURNITURE } from '../systems/office.js';

function texture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return scene.textures.get(key);
  const t = scene.textures.createCanvas(key, w, h);
  draw(t.context); t.refresh();
  return t;
}
const rect = (g, x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
const shadow = (g, x, y, w, h) => { g.fillStyle = '#22283830'; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, 2 * Math.PI); g.fill(); };

export function makeFurnitureTextures(scene) {
  for (const type of Object.keys(FURNITURE)) for (let rotation = 0; rotation < 4; rotation++) {
    const vertical = rotation % 2 && FURNITURE[type].w > 1;
    const w = vertical ? 32 : FURNITURE[type].w * 32, h = (vertical ? 64 : 32) + 38;
    texture(scene, `${type}-${rotation}`, w, h, (g) => {
      const ground = h - 5;
      shadow(g, w / 2, ground, w / 2 - 2, 5);
      if (type === 'desk') {
        rect(g, 5, ground - 12, w - 10, 13, '#644c43');
        rect(g, 2, ground - 25, w - 4, 15, '#b78355');
        rect(g, 2, ground - 25, w - 4, 3, '#dfb47b');
        rect(g, 5, ground - 10, 4, 13, '#4f4240'); rect(g, w - 9, ground - 10, 4, 13, '#4f4240');
        const mx = rotation === 3 ? 5 : w - 27;
        rect(g, mx, ground - 47, 22, 23, '#343f4a');
        rect(g, mx + 3, ground - 44, 16, 16, rotation === 2 ? '#53606b' : '#92c9b4');
        if (rotation !== 2) { rect(g, mx + 5, ground - 41, 10, 2, '#d3ecd6'); rect(g, mx + 5, ground - 37, 6, 2, '#d3ecd6'); }
        rect(g, mx + 9, ground - 24, 4, 4, '#343f4a');
        rect(g, 7, ground - 21, Math.min(20, w - 12), 5, '#e3ded0');
        if (!vertical) { rect(g, 8, ground - 36, 9, 11, '#f2ead4'); rect(g, 8, ground - 38, 9, 3, '#ae6f54'); }
      } else if (type === 'plant') {
        rect(g, 8, ground - 18, 17, 18, '#a96f51'); rect(g, 6, ground - 20, 21, 5, '#d2a07a');
        rect(g, 14, ground - 44, 4, 26, '#4d805a');
        for (const [x, y, c] of [[3, -44, '#68946b'], [15, -48, '#7fa176'], [1, -33, '#4e805f'], [16, -35, '#69986d']]) {
          rect(g, x, ground + y, 13, 11, c); rect(g, x + 3, ground + y - 3, 7, 3, c);
        }
      } else if (type === 'shelf') {
        rect(g, 3, ground - 49, w - 6, 50, '#775d4d'); rect(g, 6, ground - 47, w - 12, 44, '#b18c60');
        for (const y of [ground - 44, ground - 23]) {
          for (let x = 8; x < w - 9; x += 7) rect(g, x, y + (x % 3), 5, 15 - x % 3, ['#688f96', '#c09069', '#8d83a5', '#c2b787'][Math.floor(x / 7) % 4]);
          rect(g, 5, y + 16, w - 10, 4, '#785d47');
        }
      } else if (type === 'sofa') {
        rect(g, 4, ground - 35, w - 8, 34, '#416e75'); rect(g, 7, ground - 32, w - 14, 16, '#7faca8');
        rect(g, 7, ground - 16, w - 14, 13, '#648e90'); rect(g, 2, ground - 23, 6, 22, '#416e75'); rect(g, w - 8, ground - 23, 6, 22, '#416e75');
        rect(g, 8, ground, 4, 4, '#4b4243'); rect(g, w - 12, ground, 4, 4, '#4b4243');
      } else if (type === 'coffee') {
        rect(g, 4, ground - 27, 24, 28, '#9d784e'); rect(g, 2, ground - 30, 28, 5, '#dec59c');
        rect(g, 7, ground - 50, 18, 20, '#485b62'); rect(g, 10, ground - 47, 12, 10, '#8faeb0');
        rect(g, 13, ground - 37, 6, 5, '#362e2c'); rect(g, 15, ground - 32, 5, 3, '#f2e9d6');
      }
    });
  }
  texture(scene, 'chair', 28, 32, (g) => {
    shadow(g, 14, 28, 12, 3); rect(g, 6, 5, 16, 17, '#384751'); rect(g, 8, 7, 12, 12, '#66848a');
    rect(g, 5, 21, 18, 6, '#465e68'); rect(g, 12, 26, 4, 5, '#3b414b');
  });
}

export function characterTexture(scene, person, pack) {
  const skin = person.look?.skin || '#e4b98f', hair = person.look?.hair || '#5b443c';
  const shirt = pack.staffGen.shirt[person.spec] || '#678c9a';
  const style = person.persona || String(person.id % 5);
  const key = `worker-${skin}-${hair}-${shirt}-${style}-${!!person.founder}`;
  if (scene.textures.exists(key)) return key;
  const t = texture(scene, key, 24 * 4, 42, (g) => {
    for (let frame = 0; frame < 4; frame++) {
      const x = frame * 24, foot = frame === 1 ? 1 : frame === 3 ? -1 : 0;
      rect(g, x + 5, 35 + foot, 6, 5, '#374653'); rect(g, x + 14, 35 - foot, 6, 5, '#374653');
      rect(g, x + 6, 29, 13, 8, '#59616a');
      rect(g, x + 5, 20, 15, 12, shirt); rect(g, x + 3, 23 + foot, 4, 9, skin); rect(g, x + 19, 23 - foot, 3, 9, skin);
      rect(g, x + 9, 18, 7, 5, skin); rect(g, x + 4, 5, 17, 14, hair);
      rect(g, x + 5, 10, 15, 10, skin); rect(g, x + 7, 19, 11, 3, skin);
      rect(g, x + 4, 5, 17, 5, hair); rect(g, x + 4, 8, 4, 7, hair);
      if (['anne', 'sanatci', 'hayal', 'dedikodu'].includes(style)) { rect(g, x + 2, 7, 3, 17, hair); rect(g, x + 20, 7, 3, 17, hair); }
      if (['tekno', 'mukemmel', 'filozof'].includes(style)) { rect(g, x + 6, 12, 6, 5, '#354653'); rect(g, x + 14, 12, 6, 5, '#354653'); }
      rect(g, x + 8, 13, 2, frame === 2 ? 1 : 2, '#343743'); rect(g, x + 16, 13, 2, frame === 2 ? 1 : 2, '#343743');
      rect(g, x + 11, 18, 4, 1, '#9b6256');
      if (person.founder) { rect(g, x + 6, 2, 13, 4, '#deb957'); for (const cx of [6, 12, 17]) rect(g, x + cx, 0, 2, 4, '#efd17b'); }
    }
  });
  for (let i = 0; i < 4; i++) t.add(i, 0, i * 24, 0, 24, 42);
  return key;
}
