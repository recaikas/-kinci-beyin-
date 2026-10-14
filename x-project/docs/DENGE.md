# Denge raporu

Akıllı bot (`test/smartbot.mjs`), 50 yıl (1976–2025), tohumlar: 3, 11, 19, 27, 35, 43, 51, 59. Üreten: `node tools/balance.mjs 8 --md docs/DENGE.md`.

| Zorluk | Ayakta | Kasa (medyan) | Şirket değeri | Oyun | Son 10 oyun notu | Yılın Oyunu | Tür ödülü | En büyük kadro | Konsol | Halka arz | Batanlar |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Çok kolay | 8/8 | 4810.7 M $ | 5084.3 M $ | 78 | 79 | 27 | 13 | 84 | 14 | 8/8 | — |
| Kolay | 8/8 | 1411.4 M $ | 1632.2 M $ | 81 | 76 | 21 | 13 | 86 | 14 | 8/8 | — |
| Orta | 8/8 | 572.6 M $ | 619.0 M $ | 77 | 69 | 10 | 11 | 85 | 14 | 8/8 | — |
| Zor | 5/8 | 180.5 M $ | 259.7 M $ | 67 | 68 | 3 | 9 | 78 | 12 | 6/8 | iflas@2025 iflas@2004 iflas@1998 |
| Çok zor | 3/8 | -0.2 M $ | 8.3 M $ | 34 | 56 | 0 | 3 | 16 | 0 | 1/8 | iflas@2005 iflas@2022 iflas@2003 iflas@2009 iflas@1999 |
| Efsanevi | 5/8 | 0.6 M $ | 5.3 M $ | 29 | 37 | 0 | 1 | 16 | 0 | 0/8 | iflas@2019 iflas@2021 iflas@2009 |

## Nasıl okunur

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
