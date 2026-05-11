#!/usr/bin/env node
/**
 * Mevcut products / variant_values tablolarındaki tutarları TRY kabul edip USD'ye böler.
 *
 * Çalıştırma (köşe: shawk-ecommerce-backend):
 *   MIGRATE_USD_TRY_RATE=44 npm run migrate:try-prices-to-usd
 *
 * Kur verilmezse önce open.er-api.com'dan USD/TRY çekilir; başarısız olursa script hata verir.
 *
 * UYARI: Yedek alın. İşlem geri alınmaz (manuel restore gerekir).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

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
    /* .env yok */
  }
  return out;
}

/**
 * Postgres bağlantı yapılandırmasını üretir.
 * @param {Record<string, string>} env
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
 * İnternetten USD/TRY kurunu alır.
 * @returns {Promise<number>}
 */
async function fetchUsdTryFromApi() {
  const response = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!response.ok) throw new Error(`open.er-api HTTP ${response.status}`);
  const data = await response.json();
  const tryRate = data?.rates?.TRY;
  if (data?.result !== 'success' || !tryRate || Number.isNaN(Number(tryRate))) {
    throw new Error('Geçersiz kur API yanıtı');
  }
  return Number(tryRate);
}

async function main() {
  const envPath = path.resolve(__dirname, '../.env');
  const env = { ...loadEnvFile(envPath), ...process.env };

  let rate = env.MIGRATE_USD_TRY_RATE
    ? Number(env.MIGRATE_USD_TRY_RATE)
    : NaN;
  if (!rate || Number.isNaN(rate) || rate <= 0) {
    console.log('MIGRATE_USD_TRY_RATE yok; internetten kur çekiliyor...');
    rate = await fetchUsdTryFromApi();
  }
  console.log(`Kullanılacak USD/TRY: ${rate}`);

  const client = new pg.Client(buildPgConfig(env));
  await client.connect();

  try {
    await client.query('BEGIN');

    const pRes = await client.query(
      `UPDATE products
       SET "basePrice" = ROUND(("basePrice"::numeric / $1)::numeric, 2),
           "discountedPrice" = CASE
             WHEN "discountedPrice" IS NULL THEN NULL
             ELSE ROUND(("discountedPrice"::numeric / $1)::numeric, 2)
           END`,
      [rate],
    );
    console.log(`products güncellendi, satır: ${pRes.rowCount ?? '?'}`);

    const vRes = await client.query(
      `UPDATE variant_values
       SET "priceDelta" = ROUND(("priceDelta"::numeric / $1)::numeric, 2)`,
      [rate],
    );
    console.log(`variant_values güncellendi, satır: ${vRes.rowCount ?? '?'}`);

    await client.query('COMMIT');
    console.log('Tamamlandı.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
