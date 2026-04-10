#!/usr/bin/env node
/**
 * Store’daki statik ürün/kategori içeriğini PostgreSQL’e yazar (ürün, kategori, stok, uploads, galeri).
 *
 * Gereksinimler:
 *   - En az bir ADMIN kullanıcı (örn. npm run seed:admin)
 *   - .env: DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE
 *
 * Çalıştırma (backend kökü):
 *   npm run seed:store-static
 *
 * Ortam:
 *   STOREFRONT_PUBLIC_URL  — görsellerin tam URL’si (varsayılan: http://localhost:3000)
 *   SEED_USD_TRY_RATE      — statik sitedeki gibi USD→TRY (varsayılan: 39)
 *   SEED_SKIP_EXISTING     — "true" ise slug’ı zaten olan ürünleri atlar (varsayılan: true)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';
import {
  STATIC_CATALOG_CATEGORIES,
  STATIC_CATALOG_PRODUCTS,
} from './seed-store-static-catalog-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * .env dosyasından KEY=VALUE satırlarını okur.
 * @param {string} filePath
 * @returns {Record<string, string>}
 */
function loadEnvFile(filePath) {
  const out = {};
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
  } catch {
    /* yoksa atla */
  }
  return out;
}

/**
 * Postgres bağlantı yapılandırmasını üretir.
 * @param {Record<string, string>} env
 * @returns {import('pg').ClientConfig}
 */
function buildPgConfig(env) {
  const host = env.DB_HOST || 'localhost';
  const port = parseInt(env.DB_PORT || '5432', 10);
  const user = env.DB_USERNAME;
  const password = env.DB_PASSWORD ?? '';
  const database = env.DB_DATABASE;
  if (!user || !database) {
    throw new Error('DB_USERNAME ve DB_DATABASE .env içinde tanımlı olmalı.');
  }
  return { host, port, user, password, database };
}

/**
 * USD fiyatını TRY’ye çevirir (statik mağaza ile aynı mantık).
 * @param {number} usd
 * @param {number} rate
 * @returns {number}
 */
function usdToTry(usd, rate) {
  return Math.round(usd * rate * 100) / 100;
}

/**
 * Public dosya yolundan MIME tipi tahmin eder.
 * @param {string} p
 * @returns {string}
 */
function guessMimeType(p) {
  const lower = p.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

/**
 * Dosya yolundan dosya adı çıkarır.
 * @param {string} p
 * @returns {string}
 */
function basenameFromPath(p) {
  const parts = p.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'file';
}

/**
 * information_schema’dan enum UDT adını güvenli şekilde okur.
 * @param {import('pg').Client} client
 * @param {string} tableName
 * @param {string} columnName
 * @returns {Promise<string | null>}
 */
async function getColumnUdtName(client, tableName, columnName) {
  const candidates = [columnName, columnName.toLowerCase()];
  for (const col of candidates) {
    const { rows } = await client.query(
      `SELECT udt_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [tableName, col],
    );
    const name = rows[0]?.udt_name;
    if (name && /^[a-z0-9_]+$/i.test(name)) return name;
  }
  return null;
}

/**
 * Upload satırı ekler veya aynı hash için mevcut id’yi döndürür.
 * @param {import('pg').Client} client
 * @param {string} adminId
 * @param {string} publicPath örn. /urunler/...
 * @param {string} baseUrl sondaki / olmadan
 * @returns {Promise<string>} upload uuid
 */
async function ensureUploadRecord(client, adminId, publicPath, baseUrl) {
  const hash = crypto.createHash('sha256').update(`seed-static:${publicPath}`).digest('hex');
  const existing = await client.query('SELECT id FROM uploads WHERE hash = $1', [hash]);
  if (existing.rows[0]) return existing.rows[0].id;

  const id = crypto.randomUUID();
  const filename = basenameFromPath(publicPath);
  const mimeType = guessMimeType(publicPath);
  const s3Url = `${baseUrl}${publicPath.startsWith('/') ? publicPath : `/${publicPath}`}`;
  const s3Key = `static-store${publicPath}`;
  const s3Bucket = 'static-store';

  await client.query(
    `INSERT INTO uploads (
      id, filename, "displayName", "mimeType", size, "sizeMB", "s3Key", "s3Bucket", "s3Url", hash,
      "folderId", "seoTitle", "seoDescription", "seoKeywords", "createdById", "ownerType", "ownerId",
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, 0, 0, $5, $6, $7, $8,
      NULL, NULL, NULL, NULL, $9, NULL, NULL,
      NOW(), NOW()
    )`,
    [id, filename, filename, mimeType, s3Key, s3Bucket, s3Url, hash, adminId],
  );
  return id;
}

/**
 * Slug’a göre kategori id’sini oluşturur veya günceller.
 * @param {import('pg').Client} client
 * @param {{ name: string; slug: string; displayOrder: number }} cat
 * @returns {Promise<string>}
 */
async function upsertCategory(client, cat) {
  const { rows } = await client.query(
    `INSERT INTO categories (id, name, slug, description, "parentId", "imageId", "seoTitle", "seoDescription", "seoKeywords", "isActive", "displayOrder", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, NULL, NULL, NULL, NULL, NULL, NULL, true, $3, NOW(), NOW())
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       "displayOrder" = EXCLUDED."displayOrder",
       "updatedAt" = NOW()
     RETURNING id`,
    [cat.name, cat.slug, cat.displayOrder],
  );
  return rows[0].id;
}

/**
 * Slug ile mevcut ürün var mı kontrol eder.
 * @param {import('pg').Client} client
 * @param {string} slug
 * @returns {Promise<boolean>}
 */
async function productSlugExists(client, slug) {
  const { rows } = await client.query('SELECT 1 FROM products WHERE slug = $1 LIMIT 1', [slug]);
  return rows.length > 0;
}

/**
 * Tek bir statik ürünü veritabanına yazar.
 * @param {import('pg').Client} client
 * @param {object} params
 * @returns {Promise<'inserted' | 'skipped'>}
 */
async function seedOneProduct(client, params) {
  const {
    product,
    categoryIdBySlug,
    adminId,
    baseUrl,
    usdTryRate,
    productsTypeUdt,
    stocksSellableUdt,
    skipExisting,
  } = params;

  if (skipExisting && (await productSlugExists(client, product.slug))) {
    console.log(`[seed] atlandı (slug var): ${product.slug}`);
    return 'skipped';
  }

  const categoryId = categoryIdBySlug.get(product.categorySlug);
  if (!categoryId) {
    throw new Error(`Kategori bulunamadı: ${product.categorySlug}`);
  }

  const basePrice = usdToTry(product.usdPrice, usdTryRate);
  const sku = `STATIC-${product.staticId}`;
  const productId = crypto.randomUUID();

  await client.query(
    `INSERT INTO products (
      id, type, name, subtitle, slug, description, "basePrice", sku, "isActive", "isFeatured",
      "discountedPrice", "seoTitle", "seoDescription", "seoKeywords", "createdById", "personalizationFormId",
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2::${productsTypeUdt}, $3, $4, $5, $6, $7, $8, true, false,
      NULL, $9, $10, NULL, $11, NULL,
      NOW(), NOW()
    )`,
    [
      productId,
      'SIMPLE',
      product.name,
      product.subtitle,
      product.slug,
      product.description,
      basePrice,
      sku,
      product.name,
      product.description.slice(0, 500),
      adminId,
    ],
  );

  await client.query(
    `INSERT INTO product_categories ("productId", "categoryId") VALUES ($1, $2)`,
    [productId, categoryId],
  );

  await client.query(
    `INSERT INTO stocks (id, "sellableType", "sellableId", "productId", "variantCombinationId", "availableQuantity", "reservedQuantity", "lowStockThreshold", "updatedAt")
     VALUES (gen_random_uuid(), $1::${stocksSellableUdt}, $2, $2, NULL, 1, 0, NULL, NOW())`,
    ['PRODUCT', productId],
  );

  const paths = product.imagePaths || [];
  if (paths.length === 0) {
    console.log(`[seed] ürün galeri yok: ${product.slug}`);
    return 'inserted';
  }

  const mainId = await ensureUploadRecord(client, adminId, paths[0], baseUrl);
  const thumbId =
    paths.length > 1
      ? await ensureUploadRecord(client, adminId, paths[1], baseUrl)
      : mainId;

  const galleryId = crypto.randomUUID();
  await client.query(
    `INSERT INTO product_galleries (id, "productId", "variantCombinationId", "mainImageId", "thumbnailImageId", "displayOrder", "createdAt", "updatedAt")
     VALUES ($1, $2, NULL, $3, $4, 0, NOW(), NOW())`,
    [galleryId, productId, mainId, thumbId],
  );

  const detailPaths = paths.slice(2);
  let order = 0;
  for (const dp of detailPaths) {
    const uploadId = await ensureUploadRecord(client, adminId, dp, baseUrl);
    await client.query(
      `INSERT INTO product_gallery_detail_images ("galleryId", "uploadId") VALUES ($1, $2)`,
      [galleryId, uploadId],
    );
    order += 1;
  }

  console.log(`[seed] eklendi: ${product.slug} (${productId})`);
  return 'inserted';
}

/**
 * İlk ADMIN kullanıcı id’sini döndürür.
 * @param {import('pg').Client} client
 * @returns {Promise<string>}
 */
async function getFirstAdminId(client) {
  const { rows } = await client.query(
    `SELECT id FROM users WHERE roles LIKE '%ADMIN%' ORDER BY "createdAt" ASC LIMIT 1`,
  );
  if (!rows[0]) {
    throw new Error('ADMIN rolünde kullanıcı yok. Önce npm run seed:admin çalıştırın.');
  }
  return rows[0].id;
}

async function main() {
  const rootEnv = path.join(__dirname, '..', '.env');
  const env = { ...loadEnvFile(rootEnv), ...process.env };

  const baseUrl = (env.STOREFRONT_PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
  const usdTryRate = Number.parseFloat(env.SEED_USD_TRY_RATE || '39') || 39;
  const skipExisting = (env.SEED_SKIP_EXISTING || 'true').toLowerCase() !== 'false';

  const client = new pg.Client({
    ...buildPgConfig(env),
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

  try {
    const adminId = await getFirstAdminId(client);
    const productsTypeUdt =
      (await getColumnUdtName(client, 'products', 'type')) || 'products_type_enum';
    const stocksSellableUdt =
      (await getColumnUdtName(client, 'stocks', 'sellableType')) || 'stocks_sellabletype_enum';

    console.log(`[seed] ADMIN createdById=${adminId}`);
    console.log(`[seed] STOREFRONT_PUBLIC_URL=${baseUrl}  SEED_USD_TRY_RATE=${usdTryRate}`);

    /** @type {Map<string, string>} */
    const categoryIdBySlug = new Map();
    for (const cat of STATIC_CATALOG_CATEGORIES) {
      const id = await upsertCategory(client, cat);
      categoryIdBySlug.set(cat.slug, id);
      console.log(`[seed] kategori: ${cat.slug} -> ${id}`);
    }

    let inserted = 0;
    let skipped = 0;
    for (const product of STATIC_CATALOG_PRODUCTS) {
      const r = await seedOneProduct(client, {
        product,
        categoryIdBySlug,
        adminId,
        baseUrl,
        usdTryRate,
        productsTypeUdt,
        stocksSellableUdt,
        skipExisting,
      });
      if (r === 'inserted') inserted += 1;
      else skipped += 1;
    }

    console.log(`[seed] bitti. yeni: ${inserted}, atlanan: ${skipped}`);
    console.log('[seed] İpucu: mağaza önbelleği için admin ile DELETE /cache?prefix=store: çağırabilirsiniz.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[seed] hata:', err.message || err);
  process.exit(1);
});
