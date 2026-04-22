/**
 * Mağaza statik katalog verisi (PostgreSQL seed için).
 * Kaynak ile senkron tutun: shawk-ecommerce-store/lib/static-product-details.ts (STATIC_DETAIL_SEEDS)
 * ve shawk-ecommerce-store/app/urunler/page.tsx (STATIC_CATEGORIES sırası).
 */

/** @typedef {{ name: string; slug: string; displayOrder: number }} StaticCatalogCategory */
/** @typedef {{ staticId: string; slug: string; name: string; subtitle: string; description: string; usdPrice: number; categorySlug: string; imagePaths: string[] }} StaticCatalogProduct */

/** @type {StaticCatalogCategory[]} */
export const STATIC_CATALOG_CATEGORIES = [
  { name: 'UV Baskı', slug: 'uv-baski', displayOrder: 0 },
  { name: 'Plotter Folyo Kesici', slug: 'plotter-folyo-kesici', displayOrder: 1 },
  { name: 'Etiket Kesim', slug: 'etiket-kesim', displayOrder: 2 },
  { name: 'Dijital Baskı', slug: 'dijital-baski', displayOrder: 3 },
  { name: 'Fiber Markalama', slug: 'fiber-markalama', displayOrder: 4 },
];

/** @type {StaticCatalogProduct[]} */
export const STATIC_CATALOG_PRODUCTS = [
  {
    staticId: 'eco-solvent-dijital',
    slug: 'eco-solvent-dijital-baski-makinesi',
    name: 'Epson i3200 Baskı Kafalı Eco Solvent Dijital Baskı Makinesi',
    subtitle: 'Vinil, branda ve iç/dış mekan uygulamaları için endüstriyel çözüm',
    description: `Vinil, branda, mesh ve afiş baskılarında yüksek çözünürlük sunan i3200 kafalı eco solvent dijital baskı çözümü.

- Araç kaplama, tabela ve geniş format reklam işleri için uygun
- İç ve dış mekanda solmaya dayanıklı eco solvent mürekkep uyumu
- Kırışıklık önleyici sürme sistemi
- Otomatik senkron toplama ile sürekli rulo baskı
- Düşük VOC’lu eco solvent mürekkeplerle çalışmaya uygun yapı`,
    usdPrice: 11500,
    categorySlug: 'dijital-baski',
    imagePaths: [
      '/urunler/folyokesim/epson-i3200-baski-kafali-sublimasyon-dijital-baski-makinesi/epson-i3200-baski-kafali-sublimasyon-dijital-baski-makinesi-01-67ff2857.png',
      '/urunler/folyokesim/epson-i3200-baski-kafali-sublimasyon-dijital-baski-makinesi/epson-i3200-baski-kafali-sublimasyon-dijital-baski-makinesi-02-7007b9a0.png',
      '/urunler/folyokesim/epson-i3200-baski-kafali-sublimasyon-dijital-baski-makinesi/epson-i3200-baski-kafali-sublimasyon-dijital-baski-makinesi-03-df521957.png',
    ],
  },
  {
    staticId: 'plotter-175-ppf-step',
    slug: '175-cm-ppf-folyo-kesim-makinesi-plotter-step-motor',
    name: '175 CM PPF/FOLYO KESİM MAKİNESİ PLOTTER (Step Motor)',
    subtitle: '175 cm net kesim alanı, optik kameralı — açık döngü step sürücü',
    description: `PPF, folyo ve etiket işlerinde uygun maliyetli profesyonel kesim için step motorlu plotter.

- Step motor: açık döngü sürüş; yüksek hızlarda tork düşüşü ve ağır malzemede adım kaçırma riski servoya göre daha yüksektir
- Küçük puntolu detay ve çok ince çizgilerde servo modellere kıyasla sınır daha belirgindir; geniş grafik ve günlük folyo işleri için yeterli performans
- 175 cm sınıfı net kesim alanı (ürün kullanımında 150 cm bandı vurgusu)
- Kamera destekli optik okuma (Bas-Kes)
- 800 mm/sn kesim hızı ve 20–1000 gr baskı kuvveti ayarı
- Corel Draw entegrasyonu ve Sign Master yazılım desteği`,
    usdPrice: 2750,
    categorySlug: 'plotter-folyo-kesici',
    imagePaths: [
      '/urunler/folyokesim/175-cm-ppf-folyo-kesim-makinesi-plotter/175-cm-ppf-folyo-kesim-makinesi-plotter-01-48d0a713.png',
    ],
  },
  {
    staticId: 'plotter-175-ppf-servo',
    slug: '175-cm-ppf-folyo-kesim-makinesi-plotter-servo-motor',
    name: '175 CM PPF/FOLYO KESİM MAKİNESİ PLOTTER (Servo Motor)',
    subtitle: '175 cm net kesim alanı, optik kameralı — kapalı döngü servo sürücü',
    description: `Yoğun PPF, ince detaylı folyo ve profesyonel atölye üretimi için servo motorlu plotter.

- Servo motor: enkoder ile kapalı döngü konum geri beslemesi; hedeflenen yol ile gerçek konum sürekli düzeltilir, “adım kaçırma” servo sistemde tipik değildir
- Yüksek hızda daha tutarlı tork ve genelde daha sessiz, daha akıcı hareket; küçük font ve karmaşık konturlarda daha net kesim
- İzleme (tracking) ve uzun baskılarda servo sürücüler genellikle step motorlu makinelere göre daha stabil kabul edilir
- 175 cm sınıfı net kesim alanı (ürün kullanımında 150 cm bandı vurgusu)
- Kamera destekli optik okuma (Bas-Kes)
- 800 mm/sn kesim hızı ve 20–1000 gr baskı kuvveti ayarı
- Corel Draw entegrasyonu ve Sign Master yazılım desteği`,
    usdPrice: 3300,
    categorySlug: 'plotter-folyo-kesici',
    imagePaths: [
      '/urunler/folyokesim/175-cm-ppf-folyo-kesim-makinesi-plotter/175-cm-ppf-folyo-kesim-makinesi-plotter-01-48d0a713.png',
    ],
  },
  {
    staticId: 'etiket-kesim-33x40',
    slug: '33x40-otomatik-beslemeli-etiket-kesim-makinesi-2',
    name: '33X40 OTOMATIK BESLEMELİ ETİKET KESİM MAKİNESİ',
    subtitle: 'Otomatik kontur konumlandırma ve besleme',
    description: `Etiket kesim süreçleri için otomatik beslemeli ve kontur odaklı yüksek hassasiyetli model.

- Entegre taşıyıcı kafa yapısı
- Dokunmatik ekran ile kolay kullanım
- Özel sabit kağıt besleme sistemi
- Otomatik kontur konumlandırma ve kağıt algılama
- Yüksek hassasiyetli kontur kesimi`,
    usdPrice: 2200,
    categorySlug: 'etiket-kesim',
    imagePaths: [
      '/urunler/folyokesim/33x40-otomatik-beslemeli-etiket-kesim-makinesi/33x40-otomatik-beslemeli-etiket-kesim-makinesi-01-2e12fba9.jpeg',
      '/urunler/folyokesim/33x40-otomatik-beslemeli-etiket-kesim-makinesi/33x40-otomatik-beslemeli-etiket-kesim-makinesi-02-65c9ad00.png',
    ],
  },
  {
    staticId: 'etiket-kesim-33x40-beyaz',
    slug: '33x40-otomatik-beslemeli-etiket-kesim-makinesi-beyaz',
    name: '33X40 OTOMATIK BESLEMELİ ETİKET KESİM MAKİNESİ (Beyaz)',
    subtitle: 'Otomatik kontur konumlandırma ve besleme',
    description: `33x40 otomatik beslemeli etiket kesim makinesinin beyaz kasa varyantı.

- Entegre taşıyıcı kafa
- Dokunmatik ekran
- Otomatik kontur konumlandırma
- Otomatik kağıt algılama
- Yüksek hassasiyetli kontur kesimi`,
    usdPrice: 2200,
    categorySlug: 'etiket-kesim',
    imagePaths: [
      '/urunler/folyokesim/33x40-otomatik-beslemeli-etiket-kesim-makinesi/33x40-otomatik-beslemeli-etiket-kesim-makinesi-01-62e9c175.jpeg',
    ],
  },
  {
    staticId: 'plotter-135-prof',
    slug: 'folyo-kesim-makinesi-plotter-optik-kamera-135cm-net-kesim-alani-profesyonel',
    name: 'Folyo Kesim Makinesi Plotter - Kamera 135cm',
    subtitle: 'Profesyonel kullanım için optik kameralı',
    description: `Dijital baskı kesimi, folyo etiket kesimi ve transfer işler için profesyonel optik kameralı model.

- Step/servo motor
- 124 cm net kesim alanı
- 6 tekerlekli pinç roller sistemi
- 10 metreye kadar düzgün medya takibi
- 800 mm/sn kesim hızı, 20-1000 gr basınç`,
    usdPrice: 1350,
    categorySlug: 'plotter-folyo-kesici',
    imagePaths: [
      '/urunler/folyokesim/folyo-kesim-makinesi-plotter-kamera-135cm-net-kesim-alani-profesyonel/folyo-kesim-makinesi-plotter-kamera-135cm-net-kesim-alani-profesyonel-02-55885071.png',
      '/urunler/folyokesim/folyo-kesim-makinesi-plotter-kamera-135cm-net-kesim-alani-profesyonel/folyo-kesim-makinesi-plotter-kamera-135cm-net-kesim-alani-profesyonel-01-26f9bad3.png',
      '/urunler/folyokesim/folyo-kesim-makinesi-plotter-kamera-135cm-net-kesim-alani-profesyonel/folyo-kesim-makinesi-plotter-kamera-135cm-net-kesim-alani-profesyonel-03-f64a9eee.png',
    ],
  },
  {
    staticId: 'plotter-folyo-kesici',
    slug: 'plotter-folyo-kesici',
    name: 'PLOTTER FOLYO KESİM MAKİNESİ',
    subtitle: 'Endüstriyel ve performans odaklı',
    description: `Folyo, etiket ve tekstil transfer kesimlerinde kullanılan profesyonel kesici plotter.

- Step motor
- 122 cm net kesim alanı
- ARM camera optik kesim (Bas-Kes)
- 800 mm/sn kesim hızı
- Corel Draw direkt kesim ve Sign Master lisanslı yazılım`,
    usdPrice: 1350,
    categorySlug: 'plotter-folyo-kesici',
    imagePaths: [
      '/urunler/folyokesim/plotter-folyo-kesim-makinesi/plotter-folyo-kesim-makinesi-01-49f93bc5.jpg',
    ],
  },
  {
    staticId: 'plotter-60cm',
    slug: 'plotter-folyo-kesici-60-cm-net-kesim-alani',
    name: 'PLOTTER FOLYO KESİM MAKİNESİ 60 cm net kesim alanı',
    subtitle: 'Kompakt 60 cm net kesim alanı',
    description: `Kompakt iş akışları için 60 cm net kesim alanına sahip plotter kesici.

- 4 teker sistemi ile kaydırmaz pinç roller
- ARM camera optik kesim
- 10 m medya takip
- 800 mm/sn kesim hızı
- Türkçe menü, dayanıklı dokunmatik panel`,
    usdPrice: 1300,
    categorySlug: 'plotter-folyo-kesici',
    imagePaths: [
      '/urunler/folyokesim/plotter-folyo-kesim-makinesi-60-cm-net-kesim-alani/plotter-folyo-kesim-makinesi-60-cm-net-kesim-alani-01-2160898a.jpg',
    ],
  },
  {
    staticId: 'plotter-135-a1',
    slug: 'plotter-folyo-kesim-makinesi-a1',
    name: 'Plotter Folyo Kesim Makinesi Kameralı – 135Cm',
    subtitle: 'A1 sınıf optik kameralı folyo kesim',
    description: `A1 sınıfında, yoğun folyo ve etiket işlerinde hassas kesim için optik kameralı model.

- Step/servo motor teknolojisi
- 124 cm net kesim alanı
- Bas-Kes optik okuma
- 800 mm/sn kesim hızı
- Reklam tabela, araç kaplama ve sticker uygulamalarına uygun`,
    usdPrice: 1350,
    categorySlug: 'plotter-folyo-kesici',
    imagePaths: [
      '/urunler/folyokesim/plotter-folyo-kesim-makinesi-kamerali-135cm-net-kesim-alani/plotter-folyo-kesim-makinesi-kamerali-135cm-net-kesim-alani-02-0ea18486.png',
      '/urunler/folyokesim/plotter-folyo-kesim-makinesi-kamerali-135cm-net-kesim-alani/plotter-folyo-kesim-makinesi-kamerali-135cm-net-kesim-alani-01-0926d2c4.png',
      '/urunler/folyokesim/plotter-folyo-kesim-makinesi-kamerali-135cm-net-kesim-alani/plotter-folyo-kesim-makinesi-kamerali-135cm-net-kesim-alani-03-14a26bf1.png',
    ],
  },
  {
    staticId: 'plotter-160-ppf',
    slug: 'plotter-folyo-kesim-makinesi-optik-kamerali-160cm-net-kesim-alani',
    name: 'Plotter PPF Folyo Kesim Makinesi Kameralı – 160Cm',
    subtitle: '160 cm net kesim alanı',
    description: `PPF ve folyo uygulamalarında geniş en için 160 cm sınıfı net kesim alanı sunan optik kameralı model.

- Step/servo motor teknolojisi
- Kamera destekli optik okuma
- 10 metreye kadar malzeme takibi
- 800 mm/sn kesim hızı
- Yüksek adetli reklam ve kaplama işlerine uygun`,
    usdPrice: 2500,
    categorySlug: 'plotter-folyo-kesici',
    imagePaths: [
      '/urunler/folyokesim/plotter-ppf-folyo-kesim-makinesi-kamerali-160cm-net-kesim-alani/plotter-ppf-folyo-kesim-makinesi-kamerali-160cm-net-kesim-alani-02-0ea18486.png',
      '/urunler/folyokesim/plotter-ppf-folyo-kesim-makinesi-kamerali-160cm-net-kesim-alani/plotter-ppf-folyo-kesim-makinesi-kamerali-160cm-net-kesim-alani-01-0926d2c4.png',
      '/urunler/folyokesim/plotter-ppf-folyo-kesim-makinesi-kamerali-160cm-net-kesim-alani/plotter-ppf-folyo-kesim-makinesi-kamerali-160cm-net-kesim-alani-03-14a26bf1.png',
    ],
  },
  {
    staticId: 'my-color-180cm',
    slug: 'dijital-baski-makinesi-my-color',
    name: 'Dijital Baskı Makinesi – 180 cm Genişlik, Yüksek Hız',
    subtitle: 'My Color 180 cm, I3200 destekli',
    description: `My Color serisi 180 cm dijital baskı makinesi, i3200 set desteğiyle hız ve kaliteyi bir araya getirir.

- 180 cm net baskı alanı
- 7-10 m²/saat baskı hızı
- Otomatik kafa temizleme/koruma
- Çift yönlü sarma motoru
- Isıtmalı kurutma sistemi (10-50 C)`,
    usdPrice: 6000,
    categorySlug: 'dijital-baski',
    imagePaths: [
      '/urunler/folyokesim/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite-01-756efd81.png',
      '/urunler/folyokesim/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite-02-aafc3f2b.jpg',
      '/urunler/folyokesim/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite-04-c54c90e7.jpg',
      '/urunler/folyokesim/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite-03-9321c166.jpg',
    ],
  },
  {
    staticId: 'canva-fiber-markalama',
    slug: 'canva-fiber-lazer-markalama-makinesi',
    name: 'CANVA Fiber Lazer Markalama Makinesi',
    subtitle: 'Metal ve endustriyel parcalar icin yuksek hizli kalici markalama',
    description: `CANVA Fiber Lazer Markalama Makinesi, metal ve teknik malzemelerde net, kontrastli ve kalici markalama icin tasarlanmistir.

- Paslanmaz celik, alüminyum, pirinc, bakir ve kaplamali yuzeylerde hassas markalama
- QR/Datamatrix, seri numarasi, logo ve barkod uygulamalarinda yuksek okunabilirlik
- Dusuk tuketim ve bakim ihtiyaci ile 7/24 endustriyel uretime uygun yapi
- Yuzeye temas etmeden isleme yaptigi icin parca deformasyonu ve asinmayi azaltir
- Otomotiv, elektronik, medikal cihaz, savunma ve promosyon urunlerinde yaygin kullanim`,
    usdPrice: 6900,
    categorySlug: 'fiber-markalama',
    imagePaths: [
      '/urunler/canva-fiber-markalama/MARKALAMA-MOCK-UP-YAN-WEB.gif',
      '/urunler/canva-fiber-markalama/f.m1.png',
      '/urunler/canva-fiber-markalama/f.b4.png',
      '/urunler/canva-fiber-markalama/f.b5.png',
      '/urunler/canva-fiber-markalama/f.b8.png',
      '/urunler/canva-fiber-markalama/f.png',
      '/urunler/canva-fiber-markalama/8e928de1-7955-44e8-a382-531884c8a2c4.jpg',
      '/urunler/canva-fiber-markalama/ab7cb341-4e1d-4bee-b440-a9a20f61f3aa.jpg',
      '/urunler/canva-fiber-markalama/d0a2d28f-1a29-4332-89b9-e07660ad2eed.jpg',
    ],
  },
];
