// Menü simgeleri. Ofis sahnesi src/office/renderer.js içindeki Phaser oyunudur.
const MENU = {
  bilgisayar: ['xxxxxxx', 'x.....x', 'x.xx..x', 'x.....x', 'xxxxxxx', '...x...', '.xxxxx.'],
  gelistir: ['.......', '.xxxxx.', 'x.x...x', 'xxx.x.x', 'x.x...x', '.xxxxx.', '.......'],
  personel: ['..xxx..', '..xxx..', '...x...', '.xxxxx.', 'x.xxx.x', '..x.x..', '..x.x..'],
  ofis: ['...x...', '..xxx..', '.xxxxx.', 'xxxxxxx', '.x...x.', '.x.x.x.', '.xxxxx.'],
  arge: ['..xxx..', '...x...', '...x...', '..x.x..', '.x...x.', 'xxxxxxx', 'xxxxxxx'],
  pazar: ['......x', '.....x.', 'x...x..', '.x.x...', '..x....', '.......', 'xxxxxxx'],
  finans: ['..xxx..', '.x.x.x.', '.x.x...', '..xxx..', '...x.x.', '.x.x.x.', '..xxx..'],
  gunluk: ['.xxxxx.', 'x.....x', 'x.xxx.x', 'x.....x', 'x.xx..x', 'x.....x', '.xxxxx.'],
  kaydet: ['xxxxxx.', 'x.xx.xx', 'x.xx..x', 'xxxxxxx', 'x.....x', 'x.xxx.x', 'xxxxxxx'],
  tanitim: ['.....xx', '...xx.x', 'xxx...x', 'x.x...x', 'xxx...x', '...xx.x', '.....xx'],
};
export function menuIcon(name, color = '#f3e9ff') {
  const c = document.createElement('canvas');
  c.width = 7; c.height = 7;
  const g = c.getContext('2d');
  g.fillStyle = color;
  MENU[name].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'x') g.fillRect(x, y, 1, 1); }));
  return c.toDataURL();
}
