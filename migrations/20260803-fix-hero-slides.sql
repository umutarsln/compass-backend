-- Yanlış şablon hero görsellerini kaldır, ürün yollarını WebP'ye güncelle
DELETE FROM hero_slides
WHERE "imageUrl" LIKE '%/hero/%'
   OR "imageUrl" ILIKE '%heromobil%'
   OR "imageUrl" ILIKE '%hero-section-image%'
   OR "imageUrl" ILIKE '%herosection-mobil%';

UPDATE hero_slides
SET "imageUrl" = '/urunler/folyokesim/epson-i3200-baski-kafali-sublimasyon-dijital-baski-makinesi/epson-i3200-baski-kafali-sublimasyon-dijital-baski-makinesi-01-67ff2857.webp'
WHERE "imageUrl" LIKE '%epson-i3200-baski-kafali-sublimasyon-dijital-baski-makinesi-01-67ff2857%';

UPDATE hero_slides
SET "imageUrl" = '/urunler/folyokesim/175-cm-ppf-folyo-kesim-makinesi-plotter/175-cm-ppf-folyo-kesim-makinesi-plotter-01-48d0a713.webp'
WHERE "imageUrl" LIKE '%175-cm-ppf-folyo-kesim-makinesi-plotter-01-48d0a713%';

UPDATE hero_slides
SET "imageUrl" = '/urunler/folyokesim/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite-01-756efd81.webp'
WHERE "imageUrl" LIKE '%dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite-01-756efd81%';

INSERT INTO hero_slides ("imageUrl", "altText", "sortOrder", "isActive")
SELECT *
FROM (
  VALUES
    ('/urunler/folyokesim/epson-i3200-baski-kafali-sublimasyon-dijital-baski-makinesi/epson-i3200-baski-kafali-sublimasyon-dijital-baski-makinesi-01-67ff2857.webp', 'Epson i3200 eco solvent dijital baskı makinesi', 0, true),
    ('/urunler/folyokesim/175-cm-ppf-folyo-kesim-makinesi-plotter/175-cm-ppf-folyo-kesim-makinesi-plotter-01-48d0a713.webp', '175 cm PPF ve folyo kesim plotter', 1, true),
    ('/urunler/folyokesim/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite-01-756efd81.webp', 'My Color 180 cm dijital baskı makinesi', 2, true)
) AS defaults("imageUrl", "altText", "sortOrder", "isActive")
WHERE NOT EXISTS (SELECT 1 FROM hero_slides WHERE "isActive" = true);
