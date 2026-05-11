import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  InitializeCheckoutInput,
  NormalizedPaymentResult,
  NormalizedWebhookResult,
} from '../payment-provider.interface';
import { PaymentSettings } from '../../payment-settings.entity';
import { QnbpayHttpClient, joinQnbpayUrl } from './qnbpay.http';
import {
  buildCheckStatusHashPlain,
  buildPaymentHashPlain,
  generateHashKey,
  validateHashKey,
} from './qnbpay-hash.util';
import { QnbpayCheckStatusRow } from './qnbpay.types';

/**
 * purchase/link veya 400 ProblemDetails gövdesinden okunabilir hata metni üretir.
 */
function formatQnbpayLinkFailure(res: Record<string, unknown>): string {
  const sd = res.status_description;
  if (typeof sd === 'string' && sd.trim()) {
    return sd.trim();
  }
  const title = res.title;
  const errors = res.errors;
  if (typeof title === 'string' && errors && typeof errors === 'object') {
    const errs = errors as Record<string, string[] | string>;
    const lines = Object.entries(errs).map(([k, v]) => {
      const msg = Array.isArray(v) ? v.join(', ') : String(v);
      return `${k}: ${msg}`;
    });
    return `${title} — ${lines.join('; ')}`;
  }
  const code = res.status_code;
  return typeof code === 'number' ? `QNBpay link alınamadı (${code})` : 'QNBpay link alınamadı';
}

/** Admin ayarı veya varsayılan checkout modu. */
export type QnbpayCheckoutMode = 'hosted_link' | 'pay_smart_3d';

/**
 * QNBpay ödeme sağlayıcısı (hosted link ve paySmart3D form alanları).
 */
@Injectable()
export class QnbpayProvider implements PaymentProvider {
  private readonly logger = new Logger(QnbpayProvider.name);
  private settings: PaymentSettings | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Veritabanı ve env birleşimi ile ayarları uygular.
   */
  setSettings(settings: PaymentSettings): void {
    this.settings = settings;
  }

  /**
   * Aktif HTTP istemcisi ve kimlik bilgilerini döndürür.
   */
  private getClient(): {
    http: QnbpayHttpClient;
    merchantKey: string;
    merchantId?: string;
    appSecret: string;
  } {
    const s = this.settings;
    const baseUrl =
      s?.qnbpayBaseUrl ||
      this.configService.get<string>('QNBPAY_BASE_URL') ||
      'https://test.qnbpay.com.tr/ccpayment';
    const appId = s?.qnbpayAppId || this.configService.get<string>('QNBPAY_APP_ID') || '';
    const appSecret = s?.qnbpayAppSecret || this.configService.get<string>('QNBPAY_APP_SECRET') || '';
    const merchantKey = s?.qnbpayMerchantKey || this.configService.get<string>('QNBPAY_MERCHANT_KEY') || '';
    const merchantId = s?.qnbpayMerchantId || this.configService.get<string>('QNBPAY_MERCHANT_ID') || undefined;
    if (!appId || !appSecret || !merchantKey) {
      throw new BadRequestException('QNBpay kimlik bilgileri eksik (app_id, app_secret, merchant_key)');
    }
    const http = new QnbpayHttpClient(baseUrl, appId, appSecret, this.logger);
    return { http, merchantKey, merchantId, appSecret };
  }

  /**
   * Ödeme ayarından checkout modunu okur.
   */
  private getCheckoutMode(): QnbpayCheckoutMode {
    const raw = this.settings?.qnbpayCheckoutMode || 'hosted_link';
    if (raw === 'pay_smart_3d') {
      return 'pay_smart_3d';
    }
    return 'hosted_link';
  }

  /**
   * Sepet satırlarını QNB kalemlerine çevirir (hosted items: name + description; 3D: name + description).
   */
  private mapBasketToLineItems(input: InitializeCheckoutInput): Array<{
    name: string;
    description: string;
    quantity: number;
    price: number;
  }> {
    return input.basketItems.map((b) => {
      const name = b.name.slice(0, 200);
      return {
        name,
        description: name,
        quantity: 1,
        price: Math.round(b.price * 100) / 100,
      };
    });
  }

  /**
   * Checkout başlatır: hosted link veya 3D form gövdesi.
   */
  async initializeCheckout(input: InitializeCheckoutInput): Promise<{
    token: string;
    redirectUrl: string;
    providerRef?: string;
    formAction?: string;
    formMethod?: 'POST';
    formFields?: Record<string, string>;
    checkoutMode?: string;
  }> {
    const invoiceId = input.paymentAttemptId;
    if (!invoiceId) {
      throw new BadRequestException('QNBpay için paymentAttemptId (fatura no) zorunludur');
    }
    if (!input.cancelUrl) {
      throw new BadRequestException('QNBpay için cancelUrl zorunludur');
    }

    const { http, merchantKey, merchantId, appSecret } = this.getClient();
    const totalStr = input.amount.toFixed(2);
    const currency = (input.currency || 'TRY').toUpperCase();
    const lineItems = this.mapBasketToLineItems(input);
    const itemsSum = lineItems.reduce((s, i) => s + i.quantity * i.price, 0);
    const diff = Math.abs(itemsSum - input.amount);
    if (diff > 0.02) {
      this.logger.warn(
        `[initializeCheckout] QNB kalemler toplamı (${itemsSum}) tutardan (${input.amount}) farklı; API reddedebilir.`,
      );
    }

    const mode = this.getCheckoutMode();
    const saleWh = this.settings?.qnbpaySaleWebhookKey || this.configService.get<string>('QNBPAY_SALE_WEBHOOK_KEY') || undefined;

    if (mode === 'hosted_link') {
      const body: Parameters<QnbpayHttpClient['postPurchaseLink']>[0] = {
        merchant_key: merchantKey,
        currency_code: currency,
        ...(merchantId ? { merchant_id: merchantId } : {}),
        name: input.buyerInfo.name,
        surname: input.buyerInfo.surname,
        invoice: {
          invoice_id: invoiceId,
          invoice_description: `Sipariş ${input.orderId.slice(0, 8)}`,
          total: totalStr,
          return_url: input.callbackUrl,
          cancel_url: input.cancelUrl,
          response_method: 'POST',
          items: lineItems.map(({ name, description, quantity, price }) => ({
            name,
            description,
            quantity,
            price,
          })),
        },
      };
      if (saleWh) {
        body.sale_web_hook_key = saleWh;
      }
      const res = await http.postPurchaseLink(body);
      const code = res.status_code;
      const link = res.link || res.data?.link;
      const orderId = res.order_id ?? res.data?.order_id;
      if (code !== 100 || !link) {
        throw new BadRequestException(
          formatQnbpayLinkFailure(res as unknown as Record<string, unknown>),
        );
      }
      const orderRef = orderId != null ? String(orderId) : '';
      return {
        token: orderRef,
        redirectUrl: link,
        providerRef: orderRef,
        checkoutMode: mode,
      };
    }

    // pay_smart_3d — kart alanları FE tarafında doldurulur; hash ve sabit alanlar sunucuda.
    const installment = '1';
    const plain = buildPaymentHashPlain({
      total: totalStr,
      installment,
      currencyCode: currency,
      merchantKey,
      invoiceId,
    });
    const hashKey = generateHashKey(plain, appSecret);
    const itemsJson = JSON.stringify(
      lineItems.map((i) => ({
        name: i.name,
        description: i.description,
        quantity: i.quantity,
        price: i.price,
      })),
    );
    const ip = input.clientIp?.trim() || '0.0.0.0';
    const billName = input.billingAddress.contactName.split(' ')[0] || input.buyerInfo.name;
    const billSurname = input.billingAddress.contactName.split(' ').slice(1).join(' ') || input.buyerInfo.surname;

    const formFields: Record<string, string> = {
      merchant_key: merchantKey,
      invoice_id: invoiceId,
      invoice_description: `Sipariş ${input.orderId.slice(0, 8)}`,
      total: totalStr,
      currency_code: currency,
      installments_number: installment,
      items: itemsJson,
      name: input.buyerInfo.name,
      surname: input.buyerInfo.surname,
      hash_key: hashKey,
      cancel_url: input.cancelUrl,
      return_url: input.callbackUrl,
      bill_street1: input.billingAddress.address.slice(0, 200),
      bill_city: input.billingAddress.city,
      bill_country: input.billingAddress.country || 'TR',
      bill_postal_code: input.billingAddress.zipCode,
      bill_email: input.buyerInfo.email,
      bill_phone: input.buyerInfo.phone,
      ip,
      transaction_type: 'Auth',
      response_method: 'GET',
    };
    if (saleWh) {
      formFields.sale_web_hook_key = saleWh;
    }

    const baseUrl =
      this.settings?.qnbpayBaseUrl ||
      this.configService.get<string>('QNBPAY_BASE_URL') ||
      'https://test.qnbpay.com.tr/ccpayment';
    const formAction = joinQnbpayUrl(baseUrl, '/api/paySmart3D');

    return {
      token: '',
      redirectUrl: '',
      formAction,
      formMethod: 'POST',
      formFields,
      checkoutMode: mode,
    };
  }

  /**
   * checkstatus yanıt satırını tek nesneye indirger.
   */
  private normalizeCheckRow(data: unknown): QnbpayCheckStatusRow | null {
    if (!data) {
      return null;
    }
    if (Array.isArray(data)) {
      return (data[0] as QnbpayCheckStatusRow) || null;
    }
    return data as QnbpayCheckStatusRow;
  }

  /**
   * Fatura numarası ile işlem durumunu sorgular ve normalize eder.
   */
  async retrieveCheckout(token: string, conversationId?: string): Promise<NormalizedPaymentResult> {
    const invoiceId = token || conversationId;
    if (!invoiceId) {
      return { status: 'FAILURE', errorMessage: 'invoice_id eksik', raw: {} };
    }
    return this.confirmByInvoiceId(invoiceId);
  }

  /**
   * Sunucu tarafı işlem teyidi (hash doğrulaması return URL’de ayrıca yapılır).
   */
  async confirmByInvoiceId(invoiceId: string): Promise<NormalizedPaymentResult> {
    const { http, merchantKey, merchantId, appSecret } = this.getClient();
    const hashPlain = buildCheckStatusHashPlain(invoiceId, merchantKey);
    const hashKey = generateHashKey(hashPlain, appSecret);
    const res = await http.postCheckStatus({
      merchant_key: merchantKey,
      invoice_id: invoiceId,
      include_pending_status: true,
      hash_key: hashKey,
    });
    const row = this.normalizeCheckRow(res.data);
    const responseCode = res.status_code ?? row?.status_code;
    const txStatus = (row?.transaction_status || '').toLowerCase();
    const statusDescription = row?.status_description || res.status_description;
    const statusDescriptionSuccess = (statusDescription || '').toLowerCase() === 'success';
    const ok =
      responseCode === 100 &&
      (txStatus === 'completed' ||
        txStatus === 'success' ||
        row?.transaction_status === 'Completed' ||
        (!txStatus && statusDescriptionSuccess));
    if (ok && !txStatus && statusDescriptionSuccess) {
      this.logger.log(
        `[confirmByInvoiceId] QNBpay checkstatus transaction_status olmadan Success döndü; başarılı kabul edildi: invoice=${invoiceId}`,
      );
    }
    if (!ok) {
      this.logger.warn(
        `[confirmByInvoiceId] QNBpay checkstatus başarısız: invoice=${invoiceId}, status_code=${responseCode ?? 'yok'}, transaction_status=${row?.transaction_status ?? 'yok'}, status_description=${statusDescription ?? 'yok'}`,
      );
    }
    const orderRef = row?.order_id != null ? String(row.order_id) : undefined;
    return {
      status: ok ? 'SUCCESS' : 'FAILURE',
      providerPaymentId: orderRef,
      paidPrice: row?.transaction_amount != null ? Number(row.transaction_amount) : undefined,
      errorMessage:
        ok
          ? undefined
          : statusDescription ||
            `İşlem tamamlanmadı (status_code=${responseCode ?? 'yok'}, transaction_status=${row?.transaction_status ?? 'yok'})`,
      raw: res,
    };
  }

  /**
   * 3D / hosted dönüş query parametrelerini hash ve tutar ile doğrular, ardından checkstatus çalıştırır.
   */
  async finalizeReturnQuery(params: {
    query: Record<string, string | string[] | undefined>;
    expectedInvoiceId: string;
    expectedTotal: number;
    expectedCurrency: string;
  }): Promise<NormalizedPaymentResult> {
    const q = params.query;
    const pick = (k: string): string => {
      const v = q[k];
      if (Array.isArray(v)) {
        return v[0] || '';
      }
      return (v as string) || '';
    };
    const hashKey = pick('hash_key');
    const invoiceFromQuery = pick('invoice_id') || pick('invoiceId');
    const orderNo = pick('order_no') || pick('order_id') || pick('orderId');
    const { appSecret } = this.getClient();

    if (!hashKey) {
      this.logger.warn('[finalizeReturnQuery] hash_key yok; yalnızca checkstatus ile teyit ediliyor');
      const check = await this.confirmByInvoiceId(params.expectedInvoiceId);
      return {
        ...check,
        providerPaymentId: orderNo || check.providerPaymentId,
        raw: { ...check.raw, orderNo, hashSkipped: true },
      };
    }

    const decrypted = validateHashKey(hashKey, appSecret);
    const totalOk =
      decrypted.total &&
      Math.abs(parseFloat(decrypted.total) - params.expectedTotal) < 0.02;
    const currencyOk =
      !decrypted.currency_code ||
      decrypted.currency_code.toUpperCase() === params.expectedCurrency.toUpperCase();
    const invoiceOk =
      decrypted.invoice_id === params.expectedInvoiceId ||
      invoiceFromQuery === params.expectedInvoiceId;
    if (!invoiceOk || !totalOk || !currencyOk) {
      this.logger.warn(
        `[finalizeReturnQuery] Hash veya tutar uyuşmazlığı: inv=${invoiceFromQuery} dec=${decrypted.invoice_id}`,
      );
      return {
        status: 'FAILURE',
        errorMessage: 'Ödeme dönüşü doğrulanamadı',
        raw: { decrypted, invoiceFromQuery, orderNo },
      };
    }
    const check = await this.confirmByInvoiceId(params.expectedInvoiceId);
    if (check.status !== 'SUCCESS') {
      return check;
    }
    return {
      ...check,
      providerPaymentId: orderNo || check.providerPaymentId,
      raw: { ...check.raw, decrypted, orderNo },
    };
  }

  /**
   * Satış webhook: hash_key ile doğrulama ve durum eşlemesi.
   */
  async handleWebhook(payload: any): Promise<NormalizedWebhookResult> {
    const hashKey = payload?.hash_key || payload?.hashKey;
    const { appSecret } = this.getClient();
    const decrypted = validateHashKey(typeof hashKey === 'string' ? hashKey : '', appSecret);
    const statusRaw = (payload?.status || decrypted.status || '').toString().toUpperCase();
    const success = statusRaw === 'COMPLETED' || statusRaw === '1' || statusRaw === 'SUCCESS';
    const fail = statusRaw === 'FAIL' || statusRaw === 'FAILURE' || statusRaw === '0';
    const invoiceId = decrypted.invoice_id || payload?.invoice_id || payload?.invoiceId || '';
    return {
      status: success ? 'SUCCESS' : fail ? 'FAILURE' : 'PENDING',
      conversationId: invoiceId || undefined,
      providerPaymentId: payload?.order_id != null ? String(payload.order_id) : payload?.order_no,
      raw: payload,
      errorMessage: fail ? payload?.status_description || 'Webhook: başarısız' : undefined,
    };
  }
}
