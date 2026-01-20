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
  amount: number;
  currency: string;
  callbackUrl: string;
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
  }>;

  retrieveCheckout(token: string): Promise<NormalizedPaymentResult>;

  handleWebhook(payload: any): Promise<NormalizedWebhookResult>;
}
