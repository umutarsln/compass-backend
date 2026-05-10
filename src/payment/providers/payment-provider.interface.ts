export interface NormalizedPaymentResult {
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  providerPaymentId?: string;
  paidPrice?: number;
  currency?: string;
  errorCode?: string;
  errorMessage?: string;
  raw?: any;
}

export interface NormalizedWebhookResult {
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  /** Webhook sonrası deneme araması için (Iyzico conversationId, QNBpay invoice_id vb.) */
  conversationId?: string;
  providerPaymentId?: string;
  paidPrice?: number;
  currency?: string;
  errorCode?: string;
  errorMessage?: string;
  raw?: any;
}

export interface InitializeCheckoutInput {
  orderId: string;
  conversationId: string;
  /** QNBpay fatura numarası olarak kullanılan ödeme denemesi kimliği */
  paymentAttemptId?: string;
  amount: number;
  currency: string;
  callbackUrl: string;
  /** QNBpay iptal yönlendirmesi (hosted / 3D) */
  cancelUrl?: string;
  webhookUrl?: string;
  buyerInfo: {
    id?: string;
    name: string;
    surname: string;
    email: string;
    phone: string;
    identityNumber?: string;
    city: string;
    country: string;
    zipCode: string;
    address: string;
  };
  shippingAddress: {
    contactName: string;
    city: string;
    country: string;
    zipCode: string;
    address: string;
  };
  billingAddress: {
    contactName: string;
    city: string;
    country: string;
    zipCode: string;
    address: string;
  };
  /** paySmart3D için müşteri IP (yoksa sağlayıcı varsayılan kullanır). */
  clientIp?: string;
  basketItems: Array<{
    id: string;
    name: string;
    category1?: string;
    category2?: string;
    itemType: 'PHYSICAL' | 'VIRTUAL';
    price: number;
  }>;
}

export interface PaymentProvider {
  initializeCheckout(input: InitializeCheckoutInput): Promise<{
    token: string;
    redirectUrl: string;
    providerRef?: string;
    /** paySmart3D vb. için tarayıcı form POST */
    formAction?: string;
    formMethod?: 'POST';
    formFields?: Record<string, string>;
    checkoutMode?: string;
  }>;

  retrieveCheckout(token: string, conversationId?: string): Promise<NormalizedPaymentResult>;

  handleWebhook(payload: any): Promise<NormalizedWebhookResult>;
}
