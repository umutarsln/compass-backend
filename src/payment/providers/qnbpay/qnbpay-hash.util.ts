import * as crypto from 'crypto';

/** QNBpay hash çözümünden dönen alanlar (3D yönlendirme / webhook). */
export interface QnbpayDecryptedHashPayload {
  status: string;
  total: string;
  invoice_id: string;
  order_id: string;
  currency_code: string;
}

/**
 * Kılavuzdaki CryptoJS örneğiyle uyumlu: SHA1(app_secret), SHA256(password+salt) hex’inin ilk 32 karakteri UTF-8 anahtar, AES-256-CBC, PKCS7.
 */
function buildAesKeyFromSecret(appSecret: string, salt: string): Buffer {
  const passwordHex = crypto.createHash('sha1').update(appSecret, 'utf8').digest('hex');
  const saltWithPasswordHex = crypto
    .createHash('sha256')
    .update(passwordHex + salt, 'utf8')
    .digest('hex')
    .substring(0, 32);
  return Buffer.from(saltWithPasswordHex, 'utf8');
}

/**
 * QNBpay hash_key değerini app_secret ile çözümler; boru ayracıyla alanları döndürür.
 */
export function validateHashKey(
  hashKey: string | undefined,
  appSecret: string,
): QnbpayDecryptedHashPayload {
  const empty: QnbpayDecryptedHashPayload = {
    status: '',
    total: '',
    invoice_id: '',
    order_id: '',
    currency_code: '',
  };
  if (!hashKey || !appSecret) {
    return empty;
  }
  const normalized = hashKey.replaceAll('__', '/');
  const firstColon = normalized.indexOf(':');
  const secondColon = normalized.indexOf(':', firstColon + 1);
  if (firstColon < 0 || secondColon < 0) {
    return empty;
  }
  const ivStr = normalized.slice(0, firstColon);
  const salt = normalized.slice(firstColon + 1, secondColon);
  const encryptedB64 = normalized.slice(secondColon + 1);
  if (ivStr.length < 16 || !encryptedB64) {
    return empty;
  }
  try {
    const key = buildAesKeyFromSecret(appSecret, salt);
    const iv = Buffer.from(ivStr.slice(0, 16), 'utf8');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(true);
    let decrypted = decipher.update(encryptedB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    if (!decrypted.includes('|')) {
      return empty;
    }
    const parts = decrypted.split('|');
    return {
      status: parts[0] ?? '',
      total: parts[1] ?? '',
      invoice_id: parts[2] ?? '',
      order_id: parts[3] ?? '',
      currency_code: parts[4] ?? '',
    };
  } catch {
    return empty;
  }
}

/**
 * QNBpay için iv:salt:cipher biçiminde hash_key üretir (ödeme / complete / checkstatus vb.).
 */
export function generateHashKey(plainData: string, appSecret: string): string {
  const ivStr = crypto
    .createHash('sha1')
    .update(crypto.randomBytes(32))
    .digest('hex')
    .substring(0, 16);
  const salt = crypto
    .createHash('sha1')
    .update(crypto.randomBytes(32))
    .digest('hex')
    .substring(0, 4);
  const key = buildAesKeyFromSecret(appSecret, salt);
  const iv = Buffer.from(ivStr.slice(0, 16), 'utf8');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(plainData, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const bundle = `${ivStr}:${salt}:${encrypted}`;
  return bundle.replaceAll('/', '__');
}

/**
 * Ödeme isteği hash düz metni: total|installment|currency|merchant_key|invoice_id
 */
export function buildPaymentHashPlain(params: {
  total: string;
  installment: string;
  currencyCode: string;
  merchantKey: string;
  invoiceId: string;
}): string {
  return `${params.total}|${params.installment}|${params.currencyCode}|${params.merchantKey}|${params.invoiceId}`;
}

/**
 * checkstatus hash düz metni: invoice_id|merchant_key
 */
export function buildCheckStatusHashPlain(invoiceId: string, merchantKey: string): string {
  return `${invoiceId}|${merchantKey}`;
}

/**
 * İade isteği hash düz metni (kılavuz): total|invoice_id|merchant_key — amount ile uyum entegrasyon testinde doğrulanmalı.
 */
export function buildRefundHashPlain(total: string, invoiceId: string, merchantKey: string): string {
  return `${total}|${invoiceId}|${merchantKey}`;
}
