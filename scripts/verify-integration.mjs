#!/usr/bin/env node
/**
 * Store mağaza uçlarını ve isteğe bağlı olarak admin ürün+kategori akışını doğrular.
 *
 * Kullanım:
 *   npm run start:dev  # ayrı terminalde backend ayakta olmalı
 *   npm run verify:integration
 *
 *   API_BASE_URL=http://127.0.0.1:4141 node scripts/verify-integration.mjs
 *   API_PORT=4141 node scripts/verify-integration.mjs  # → http://127.0.0.1:4141
 *
 * Not: Shell'deki PORT=4141 sadece sayıdır; tam URL için API_BASE_URL veya API_PORT kullanın.
 *
 * Admin akışı için (isteğe bağlı):
 *   VERIFY_ADMIN_EMAIL=... VERIFY_ADMIN_PASSWORD=... npm run verify:integration
 */

/**
 * İstek taban URL'ini çözer (API_BASE_URL öncelikli; yoksa API_PORT ile host).
 * @returns {string}
 */
function resolveBaseUrl() {
  const explicit = process.env.API_BASE_URL;
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const port = process.env.API_PORT || '4141';
  return `http://127.0.0.1:${port}`;
}

const BASE = resolveBaseUrl();

/**
 * fetch hatasını okunur metne çevirir (ECONNREFUSED, adres vb.).
 * @param {unknown} e
 * @returns {string}
 */
function describeFetchError(e) {
  const parts = [e?.message || String(e)];
  const c = e?.cause;
  if (c && typeof c === 'object') {
    if (c.code) parts.push(`code=${c.code}`);
    if (c.address != null && c.port != null) {
      parts.push(`${c.address}:${c.port}`);
    }
  }
  return parts.join(' | ');
}

/**
 * GET isteği yapar ve JSON döner.
 * @param {string} path
 * @returns {Promise<{ ok: boolean; status: number; data: unknown }>}
 */
async function getJson(path) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`);
  } catch (e) {
    throw new Error(
      `Bağlantı hatası ${BASE}${path}: ${describeFetchError(e)}. Backend çalışıyor mu? (örn. ayrı terminalde: npm run start:dev)`,
    );
  }
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

/**
 * JSON gövdeli istek atar.
 * @param {string} method
 * @param {string} path
 * @param {Record<string, string>} headers
 * @param {object} [body]
 */
async function requestJson(method, path, headers, body) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(
      `Bağlantı hatası ${method} ${BASE}${path}: ${describeFetchError(e)}. Backend çalışıyor mu? (npm run start:dev)`,
    );
  }
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Mağaza GET uçlarının 200 ve beklenen gövde yapısını kontrol eder.
 */
async function verifyStoreGetEndpoints() {
  console.log(`[verify] baseUrl=${BASE}`);

  const products = await getJson('/store/products');
  if (!products.ok) {
    throw new Error(`/store/products HTTP ${products.status}`);
  }
  if (!products.data || typeof products.data !== 'object' || !Array.isArray(products.data.products)) {
    throw new Error('/store/products gövdesi { products: [] } bekleniyor');
  }
  console.log(
    `[verify] GET /store/products OK (products=${products.data.products.length}, total=${products.data.total ?? '?'})`,
  );

  const categories = await getJson('/store/categories');
  if (!categories.ok) {
    throw new Error(`/store/categories HTTP ${categories.status}`);
  }
  if (!Array.isArray(categories.data)) {
    throw new Error('/store/categories dizi dönmeli');
  }
  console.log(`[verify] GET /store/categories OK (count=${categories.data.length})`);

  const tags = await getJson('/store/tags');
  if (!tags.ok) {
    throw new Error(`/store/tags HTTP ${tags.status}`);
  }
  if (!Array.isArray(tags.data)) {
    throw new Error('/store/tags dizi dönmeli');
  }
  console.log(`[verify] GET /store/tags OK (count=${tags.data.length})`);
}

/**
 * Admin token ile kategori + SIMPLE ürün oluşturur; mağaza listesinde ve detayda doğrular.
 * @param {string} accessToken
 */
async function verifyAdminProductFlow(accessToken) {
  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  const suffix = Date.now();
  const categoryName = `Integration Cat ${suffix}`;

  const catRes = await requestJson('POST', '/categories', authHeaders, {
    name: categoryName,
    description: 'verify-integration',
    isActive: true,
  });
  if (!catRes.ok || !catRes.data?.id) {
    throw new Error(`Kategori oluşturulamadı: ${catRes.status} ${JSON.stringify(catRes.data)}`);
  }
  const categoryId = catRes.data.id;
  console.log(`[verify] POST /categories OK id=${categoryId}`);

  const productName = `Integration Product ${suffix}`;
  const prodRes = await requestJson('POST', '/products', authHeaders, {
    type: 'SIMPLE',
    name: productName,
    description: 'verify-integration',
    basePrice: 1,
    isActive: true,
    categoryIds: [categoryId],
  });
  if (!prodRes.ok || !prodRes.data?.slug) {
    throw new Error(`Ürün oluşturulamadı: ${prodRes.status} ${JSON.stringify(prodRes.data)}`);
  }
  const slug = prodRes.data.slug;
  console.log(`[verify] POST /products OK slug=${slug}`);

  const list = await getJson('/store/products?search=' + encodeURIComponent(productName));
  if (!list.ok) {
    throw new Error(`/store/products (arama) HTTP ${list.status}`);
  }
  const found = list.data.products.some((p) => p.slug === slug || p.name === productName);
  if (!found) {
    throw new Error('Mağaza ürün listesinde yeni ürün bulunamadı (search)');
  }
  console.log('[verify] Mağaza listesinde ürün göründü');

  const detail = await getJson(`/store/products/${encodeURIComponent(slug)}`);
  if (!detail.ok) {
    throw new Error(`/store/products/:slug HTTP ${detail.status}`);
  }
  if (!detail.data || detail.data.slug !== slug) {
    throw new Error('Mağaza ürün detayı slug eşleşmedi');
  }
  console.log('[verify] GET /store/products/:slug OK');
}

async function main() {
  await verifyStoreGetEndpoints();

  const email = process.env.VERIFY_ADMIN_EMAIL;
  const password = process.env.VERIFY_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('[verify] Admin ürün akışı atlandı (VERIFY_ADMIN_EMAIL / VERIFY_ADMIN_PASSWORD yok).');
    process.exit(0);
  }

  const login = await requestJson('POST', '/auth/login', {}, { email, password });
  if (!login.ok || !login.data?.accessToken) {
    throw new Error(`Admin girişi başarısız: ${login.status} ${JSON.stringify(login.data)}`);
  }
  console.log('[verify] POST /auth/login OK');
  await verifyAdminProductFlow(login.data.accessToken);

  console.log('[verify] Tüm kontroller tamam.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[verify] HATA:', err.message || err);
  process.exit(1);
});
