CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "uploadId" uuid NULL,
  "imageUrl" text NOT NULL,
  title varchar NULL,
  "altText" varchar NOT NULL,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "FK_hero_slides_upload" FOREIGN KEY ("uploadId") REFERENCES uploads(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "IDX_hero_slides_active_order"
ON hero_slides ("isActive", "sortOrder", "createdAt");

INSERT INTO hero_slides ("imageUrl", "altText", "sortOrder", "isActive")
SELECT *
FROM (
  VALUES
    ('/urunler/folyokesim/epson-i3200-baski-kafali-sublimasyon-dijital-baski-makinesi/epson-i3200-baski-kafali-sublimasyon-dijital-baski-makinesi-01-67ff2857.webp', 'Epson i3200 eco solvent dijital baskı makinesi', 0, true),
    ('/urunler/folyokesim/175-cm-ppf-folyo-kesim-makinesi-plotter/175-cm-ppf-folyo-kesim-makinesi-plotter-01-48d0a713.webp', '175 cm PPF ve folyo kesim plotter', 1, true),
    ('/urunler/folyokesim/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite/dijital-baski-makinesi-180-cm-genislik-yuksek-hiz-endustriyel-kalite-01-756efd81.webp', 'My Color 180 cm dijital baskı makinesi', 2, true)
) AS defaults("imageUrl", "altText", "sortOrder", "isActive")
WHERE NOT EXISTS (SELECT 1 FROM hero_slides);
