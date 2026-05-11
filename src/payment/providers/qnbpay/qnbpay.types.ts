/** QNBpay /api/token yanıtı (özet). */
export interface QnbpayTokenResponse {
  status_code: number;
  status_description?: string;
  data?: {
    token: string;
    is_3d?: number;
    expires_at?: string;
  };
}

/** Hosted ödeme linki yanıtı. */
export interface QnbpayPurchaseLinkResponse {
  status?: string;
  status_code: number;
  status_description?: string;
  success_message?: string;
  link?: string;
  order_id?: string | number;
  data?: { link?: string; order_id?: string | number };
}

/** checkstatus yanıt satırı. */
export interface QnbpayCheckStatusRow {
  status_code?: number;
  status_description?: string;
  transaction_status?: string;
  order_id?: string | number;
  transaction_id?: string;
  invoice_id?: string;
  transaction_amount?: string | number;
  md_status?: string | number;
}

export interface QnbpayCheckStatusResponse {
  status_code?: number;
  status_description?: string;
  data?: QnbpayCheckStatusRow | QnbpayCheckStatusRow[];
}

/** purchase/link invoice.items satırı (name ve description zorunlu). */
export interface QnbpayPurchaseOrderItem {
  name: string;
  description: string;
  quantity: number;
  price: number;
}

/**
 * purchase/link içindeki invoice — JSON anahtarı küçük `invoice`; satırlar `items` (OrderItems değil).
 */
export interface QnbpayPurchaseLinkInvoiceSnake {
  invoice_id: string;
  invoice_description: string;
  total: string;
  return_url: string;
  cancel_url: string;
  response_method: string;
  items: QnbpayPurchaseOrderItem[];
}

/** paySmart3D JSON items (çoğunlukla name; gerektiğinde description da eklenir). */
export interface QnbpayInvoiceItem {
  name: string;
  quantity: number;
  price: number;
  description?: string;
}
