#!/usr/bin/env node
/**
 * İlk admin kullanıcısını PostgreSQL `users` tablosuna yazar (bcrypt ile uyumlu).
 *
 * Çalıştırma (proje kökü: shawk-ecommerce-backend):
 *   npm run seed:admin
 *
 * Ortam değişkenleri (isteğe bağlı):
 *   ADMIN_SEED_EMAIL    — varsayılan: admin@compass.local
 *   ADMIN_SEED_PASSWORD — varsayılan: CompassAdmin123!  (üretimde mutlaka değiştir)
 *
 * DB bağlantısı .env içinden: DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import pg from 'pg';
import bcrypt from 'bcrypt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * .env dosyasından KEY=VALUE satırlarını okur (basit ayrıştırıcı).
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
    /* .env yoksa atlanır */
  }
  return out;
}

/**
 * Postgres bağlantı yapılandırmasını .env + process.env birleşiminden üretir.
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
 * Admin satırını ekler veya aynı e-postada şifre/rol günceller.
 * @param {import('pg').Client} client
 * @param {{ id: string; email: string; passwordHash: string; firstname: string; lastname: string }} row
 */
async function upsertAdmin(client, row) {
  const sql = `
    INSERT INTO users (id, firstname, lastname, email, password, phone, roles, "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, NULL, $6, NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET
      password = EXCLUDED.password,
      roles = EXCLUDED.roles,
      firstname = EXCLUDED.firstname,
      lastname = EXCLUDED.lastname,
      "updatedAt" = NOW()
  `;
  await client.query(sql, [
    row.id,
    row.firstname,
    row.lastname,
    row.email,
    row.passwordHash,
    row.roles,
  ]);
}

async function main() {
  const rootDir = path.join(__dirname, '..');
  const fileEnv = loadEnvFile(path.join(rootDir, '.env'));
  const env = { ...fileEnv, ...process.env };

  const email = env.ADMIN_SEED_EMAIL || 'admin@compass.local';
  const plainPassword =
    env.ADMIN_SEED_PASSWORD || 'CompassAdmin123!';

  if (plainPassword.length < 6) {
    throw new Error('ADMIN_SEED_PASSWORD en az 6 karakter olmalı (CreateUserDto ile uyumlu).');
  }

  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const id = crypto.randomUUID();
  /** TypeORM simple-array: tek rol için virgülsüz enum metni */
  const roles = 'ADMIN';

  const client = new pg.Client(buildPgConfig(env));
  await client.connect();
  try {
    await upsertAdmin(client, {
      id,
      email,
      passwordHash,
      firstname: 'Yönetici',
      lastname: 'Admin',
      roles,
    });
  } finally {
    await client.end();
  }

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  Admin kullanıcı hazır.');
  console.log(`  E-posta: ${email}`);
  console.log('  Şifre: bu komutta kullandığınız ADMIN_SEED_PASSWORD (varsayılanı değiştirdiyseniz o).');
  console.log('  Giriş: POST /auth/login (admin panel)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');
}

main().catch((e) => {
  console.error('[seed-admin] Hata:', e.message || e);
  process.exit(1);
});
