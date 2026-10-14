// Denge raporu: akıllı bot her zorlukta birkaç tohumla 50 yıl (1976–2025) oynar.
// Çalıştır: node tools/balance.mjs [tohum sayısı] [--md docs/DENGE.md]
import { writeFileSync } from 'node:fs';
import { PACK } from '../src/data/pack.js';
import { runSmartBot } from '../test/smartbot.mjs';

const NOTES = `## Nasıl okunur

- Bot iyi ama kusursuz olmayan bir oyuncudur: oyun ile sözleşmenin haftalık getirisini karşılaştırır, ekibin yetiştirebileceği boyutu seçer,
  odaları ve işe alımı kasaya göre yapar, zor zamanda küçülür, olaylarda etkileri paraya çevirip seçim yapar, zenginken konsol ailesi kurar ve halka açılır.
- Orta ve altı: bot her tohumda 2025'e ulaşır. Zor ve üstü: birçok deneme 1990'ların "koşu bandında" (hedef puanlar ekipten hızlı büyür) düşer.
- Efsanevi kazanılabilir ama kazanan bot küçük, sözleşmelerle yaşayan bir stüdyodur. İyi bir insan oyuncunun daha iyisini yapması beklenir.

## Bu ölçümle bulunup düzeltilen sorunlar

1. Konsol gelirleri oyun gelirinin 10 katıydı (Orta'da 2,3 milyar $). Donanım kârı ve lisans geliri düşürüldü, satış pazar büyümesinin kareköküyle ölçeklenir.
2. Halka arz kurulu herkesi 30 yıl sonra kovuyordu: hedef son çeyreğe göre ve %5 bileşikti, konsol gelirini saymıyordu. Artık tüm faaliyet gelirleri, son 4 çeyreğin ortalaması +%2,5, baskı zamanla söner.
3. Dot-com ve 2008 krizleri kredi limitini bir gecede yarıya indirip krediyle çalışan herkesi 12 haftada iflas ettiriyordu. Limit artık haftada en fazla %3 daralır.
4. Platformların kurulu tabanı ömrü bitene kadar azalmıyordu; ölmekte olan konsollar en büyük pazar görünüyordu. Ömrün son %20'sinde aktif kullanıcı zirvenin %25'ine düşer.
5. İş istasyonu yükseltmesi koltuk başına 24–48 aylık maaştı; kimse yetişemiyor, verim %30 düşüyordu. Artık 2,25–4,5 aylık maaş.
6. Küçük ofisten büyük ofise geçiş duvarı (6 koltuk → 900 bin $) alçaltıldı: küçük ofis 9 koltuk, büyük ofis 600 bin $.
7. Verim eğrisi 1985–2010 arasında yükseltildi; hedef puan eğrisinin (V) koşu bandı yumuşadı.
8. Yeni "Mini" oyun boyutu: küçük ekiplerin geride kaldığında toparlanabileceği bağımsız/mobil ölçekli iş.
9. Sözleşme ödemeleri 2000 sonrası maaşın altına düşüyordu; son dönem primi eklendi.
10. Zor/Çok zor/Efsanevi satış çarpanları (Z) yükseltildi: Efsanevi'de 81 puanlık oyun 15 bin $ getiriyordu.
`;
const nSeeds = +process.argv[2] || 5;
const mdOut = process.argv.includes('--md') ? process.argv[process.argv.indexOf('--md') + 1] : null;
const seeds = Array.from({ length: nSeeds }, (_, i) => 3 + i * 8);
const M = (v) => `${(v / 1e6).toFixed(1)} M`;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const rows = [];
for (const d of PACK.difficulties) {
  const rs = seeds.map((seed) => { const r = runSmartBot({ seed, difficulty: d.id, years: 50 }); delete r.state; return r; });
  const alive = rs.filter((r) => !r.over);
  rows.push({
    d: d.name, alive: `${alive.length}/${rs.length}`,
    cash: M(med(rs.map((r) => r.cash))), value: M(med(rs.map((r) => r.value))),
    games: med(rs.map((r) => r.games)), score: med(rs.map((r) => r.avgScore)), goty: med(rs.map((r) => r.goty)), tur: med(rs.map((r) => r.genreAwards)),
    staff: med(rs.map((r) => r.peakStaff)), consoles: med(rs.map((r) => r.consoles)), ipo: rs.filter((r) => r.ipo).length,
    dead: rs.filter((r) => r.over).map((r) => `${r.over}@${r.bankruptYear ?? r.year}`).join(' ') || '—',
  });
  console.log(JSON.stringify(rows[rows.length - 1]));
}
if (mdOut) {
  const head = '| Zorluk | Ayakta | Kasa (medyan) | Şirket değeri | Oyun | Son 10 oyun notu | Yılın Oyunu | Tür ödülü | En büyük kadro | Konsol | Halka arz | Batanlar |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n';
  const body = rows.map((r) => `| ${r.d} | ${r.alive} | ${r.cash} $ | ${r.value} $ | ${r.games} | ${r.score} | ${r.goty} | ${r.tur} | ${r.staff} | ${r.consoles} | ${r.ipo}/${seeds.length} | ${r.dead} |`).join('\n');
  writeFileSync(mdOut, `# Denge raporu\n\nAkıllı bot (\`test/smartbot.mjs\`), 50 yıl (1976–2025), tohumlar: ${seeds.join(', ')}. Üreten: \`node tools/balance.mjs ${nSeeds} --md ${mdOut}\`.\n\n${head}${body}\n\n${NOTES}`);
  console.log('yazıldı:', mdOut);
}
