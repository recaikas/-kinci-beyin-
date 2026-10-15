# X Project: yeni sanat ve arayüz

Bu çalışma yalnız `codex/x-project-office-ui` dalındadır. `claude/x-project` yedeği korunur.

## Kaynaklar

Yerleşik görsel üretim aracı kullanıldı. Yeni mobilya atlası `assets/studio-furniture.png`, karakter atlası `assets/studio-characters.png`, açılış illüstrasyonu `assets/studio-opening.png`. Orijinal PNG alfa kanalları korunur. Görsel atlas kareleri oyun içinde Canvas dokularına dönüştürülür; bütün eşyalar fiziksel hücre ölçülerine uyar. Açılış görseli bir illüstrasyondur; oynanış ekran görüntüsü değildir.

Dört karakter görünümü, her biri dört animasyon karesi; masa, sandalye, kitaplık, bitki, koltuk, çay, kahve, pervane, klima, klozet, lavabo, departman ekipmanı; üç dönem bilgisayar görünümü ve pano çizildi. UI simgeleri özgün SVG olarak yenilendi.

## Arayüz

Orman yeşili çerçeve, krem paneller, pirinç renkli vurgu; sistem yazı tipleri ile okunaklı metinler. Başlangıç ekranında temel alanlar açık, ayrıntılı kariyer seçenekleri katlanır. Mağaza görselli ürün kartlarıdır. Donat / Oda / Durum sekmeleri; bağımsız yerleştirme çubuğu. Dar ekranda altta 262 px çekmece, geniş ekranda sağ panel; kamera görünür alanı buna göre ayarlanır. Personel kartları canlı sahneyle aynı portreleri kullanır. Bütün görseller yereldir; CDN gerekmez.

Yeni kariyer daha küçük 8×7 garajla başlar; hazır istasyon sayısı yine birdir. Mevcut kayıtların oda ölçüsü değiştirilmez.

## Sınırlar

Bu, mevcut oyunun görsel yenilemesidir. Sanatın bütün açılardaki varyasyonları ve ilerleyen dönemlerdeki bütün eşya modelleri ayrı ayrı çizilmiş değildir. Dört temel karakter tipi kullanılır. Mobilyaların dört fiziksel yönü atlas görüntüsünden normalleştirilir; her yön için ayrı perspektif çizimi yoktur. Genel denge sorunları bu görsel değişiklikle giderilmiş sayılmaz.

Gerçek tarayıcı/telefon oturumu bu ortamda yapılamadı. Node testleri gerçek PNG'leri çözüp Phaser CanvasRenderer ile sahneyi çizer; jsdom etkileşimleri gerçek mobil oynama doğrulaması değildir.

## Üretim istemleri

### Mobilya atlası

Use case: stylized-concept. Asset type: production game sprite atlas for a cozy 1976 game studio tycoon. Create ONE square 1024x1024 transparent PNG atlas, EXACTLY four columns and four rows of equally sized 256px cells. No drawn grid, no labels, no text, no background. Each object isolated and centered in its own cell, completely inside the cell with at least 32px empty margin, base aligned at cell y=220. Orthographic three-quarter FRONT view, front and top visible, horizontal edges horizontal (NOT diamond isometric), all facing down toward viewer. Beautiful original Japanese handheld management game pixel art, chunky 2px clusters, warm rich caramel wood, moss greens, cream plastic, teal upholstery, dark umber outlines, small careful highlights, top-left light, charming compact shapes. Pixel edges crisp; no watercolor, no blur, no 3D render. All objects same artistic family and scale. Each cell contains ONLY its named item. ORDER row1 left-right: bare wooden two-person work desk WITHOUT computer or chair; padded teal desk chair; lush leafy terracotta potted plant; wooden bookcase filled with colorful books. row2: cozy two-seat moss-teal sofa; tea kettle on small oak counter with two cups; retro filter coffee machine on small oak counter; oscillating metal pedestal fan. row3: cream window air-conditioning unit; clean white toilet; small cream washbasin vanity with metal tap; retro electronic engineering workbench with colorful dials. row4: beige 1976 CRT computer and keyboard with green screen; beige 1982 home computer with keyboard and blue CRT screen; modern dark flat-screen computer and keyboard; wooden noticeboard with pinned paper and tiny colored squares. Match object footprint: desk, sofa, shelf, AC, equipment wider; others compact. Real alpha transparent background, no checkerboard, no drop-shadow rectangles.

### Karakter atlası

Use case: stylized-concept. Asset type: animated CHARACTER SPRITE SHEET for cozy pixel art game studio management game, same warm 1976 caramel wood/moss green/cream aesthetic. ONE square 1024x1024 PNG with actual transparent background. EXACTLY 4 columns x 4 rows of 256x256 cells, no grid or labels or text. Every character fully within cell with 48px blank padding. Base foot baseline at cell y=224, all characters same height around 160px and width100px. Orthographic 3/4 FRONT, faces toward viewer. Row1 SAME young male founder in all4 cells: warm skin, wavy dark brown hair, round square glasses, teal sweater over cream shirt, brown trousers, brown shoes; tiny golden star pin (no crown). Row2 SAME female artist all4 cells: warm light skin, red-brown bobbed hair, mustard cardigan, cream blouse, green trousers. Row3 SAME male programmer all4 cells: darker brown skin, curly black hair, cream shirt with rolled sleeves, green vest, navy trousers. Row4 SAME female audio engineer all4cells: light skin, long dark brown hair, terracotta sweater, teal trousers, cream headphones around neck. For EACH row columns are animation frames: column1 neutral standing both feet; column2 walking left foot forward right arm forward; column3 neutral standing slight blink; column4 walking right foot forward left arm forward. Maintain character identity, head size, costume and position exactly across row. Beautiful charming original Japanese handheld management game pixel art, large expressive faces, compact bodies, carefully shaded volumes, crisp pixel clusters with dark umber 1-2px outlines. NOT stick figures, NOT emoji, NOT realistic, NOT vector. True alpha background, no checkerboard, no floor. All16 cells occupied exactly one character. No other objects.

### Açılış illüstrasyonu

Use case: illustration-story. Asset type: opening/title-screen illustration for X Project, an original cozy 1976 game studio tycoon game. Create a landscape 1536x1024 illustration, NO text NO logos NO UI NO letters. Charming lovingly detailed pixel art with restrained 16-bit palette, warm honey afternoon sunlight, caramel oak, moss green and teal, cream plastic. Cutaway dollhouse view of a tiny lived-in garage converted into an indie game studio. Front and right wall removed, back wall with two bright windows, honey parquet floor, one wooden work desk at back-left with a beige green-screen CRT and keyboard, teal padded chair, a young curly brown-haired founder with glasses and teal sweater concentrating at keyboard. Small full bookshelf, lush potted plants, paper sketches, a kettle and two mugs on little cabinet at right, rolled game design sketches and a plant on windowsill, simple cork noticeboard. Exterior visible around the garage with soft green garden, little paving path, golden dust motes. A sleepy orange cat on rug by the door. Carefully composed and polished original Japanese handheld simulation aesthetic, readable silhouettes, consistent orthographic 3/4 game art, not photorealistic, not vector, no gradients that destroy pixel character. Scene fills the frame, welcoming and aspirational, cozy small beginnings. No modern laptop, no neon, no purple, no generic futuristic office. No decorative border.

