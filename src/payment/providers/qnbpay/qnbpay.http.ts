import { Logger } from '@nestjs/common';
import {
  QnbpayTokenResponse,
  QnbpayPurchaseLinkResponse,
  QnbpayCheckStatusResponse,
  QnbpayPurchaseLinkInvoiceSnake,
} from './qnbpay.types';

/**
 * Base URL ile göreli yolu birleştirir (çift slash önlenir).
 */
export function joinQnbpayUrl(baseUrl: string, path: string): string {
  const b = baseUrl.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

/**
 * QNBpay REST çağrıları ve Bearer token önbelleği.
 */
export class QnbpayHttpClient {
  private cachedToken: string | null = null;
  private tokenExpiresAtMs = 0;

  /**
   * @param baseUrl Örn. https://test.qnbpay.com.tr/ccpayment
   * @param appId APP KEY
   * @param appSecret APP SECRET
   */
  constructor(
    private readonly baseUrl: string,
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly logger: Logger,
  ) {}

  /**
   * JSON POST isteği gönderir (Bearer hariç).
   */
  private async postJson<T>(path: string, body: unknown, bearer?: string): Promise<T> {
    const url = joinQnbpayUrl(this.baseUrl, path);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (bearer) {
      headers.Authorization = `Bearer ${bearer}`;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      this.logger.error(`[QnbpayHttp] JSON parse error: ${text.slice(0, 500)}`);
      throw new Error('QNBpay yanıtı çözümlenemedi');
    }
    if (!res.ok) {
      this.logger.warn(`[QnbpayHttp] HTTP ${res.status} ${path}: ${text.slice(0, 300)}`);
    }
    return data;
  }

  /**
   * Erişim token'ı alır veya önbellekten döner.
   */
  async getBearerToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAtMs - 60_000) {
      return this.cachedToken;
    }
    const raw = await this.postJson<QnbpayTokenResponse>('/api/token', {
      app_id: this.appId,
      app_secret: this.appSecret,
    });
    if (raw.status_code !== 100 || !raw.data?.token) {
      throw new Error(raw.status_description || `QNBpay token alınamadı: ${raw.status_code}`);
    }
    this.cachedToken = raw.data.token;
    if (raw.data.expires_at) {
      const t = Date.parse(raw.data.expires_at);
      this.tokenExpiresAtMs = Number.isFinite(t) ? t : now + 7_200_000;
    } else {
      this.tokenExpiresAtMs = now + 7_200_000;
    }
    return this.cachedToken;
  }

  /**
   * Hosted ödeme linki üretir (purchase/link — /api öneki yok).
   */
  async postPurchaseLink(body: {
    merchant_key: string;
    merchant_id?: string;
    currency_code: string;
    name: string;
    surname: string;
    /** purchase/link için invoice gövdesi */
    invoice: QnbpayPurchaseLinkInvoiceSnake;
    sale_web_hook_key?: string;
    selected_installments?: number[];
  }): Promise<QnbpayPurchaseLinkResponse> {
    const bearer = await this.getBearerToken();
    return this.postJson<QnbpayPurchaseLinkResponse>('/purchase/link', body, bearer);
  }

  /**
   * İşlem durumu sorgusu.
   */
  async postCheckStatus(body: {
    merchant_key: string;
    invoice_id: string;
    include_pending_status: boolean;
    hash_key: string;
  }): Promise<QnbpayCheckStatusResponse> {
    const bearer = await this.getBearerToken();
    return this.postJson<QnbpayCheckStatusResponse>('/api/checkstatus', body, bearer);
  }
}
