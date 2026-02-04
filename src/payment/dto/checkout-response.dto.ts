import { PaymentProvider } from '../../common/enums/payment-provider.enum';

export class CheckoutResponseDto {
  attemptId: string;
  provider: PaymentProvider;
  redirectUrl: string;
  token?: string;
  /** true ise tutar 0 (örn. %100 kupon), ödeme alınmadan sipariş ödendi kabul edildi; müşteri başarı sayfasına yönlendirilmeli */
  paymentNotRequired?: boolean;
}
