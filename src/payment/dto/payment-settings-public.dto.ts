/**
 * Mağaza ve anonim istemciler için güvenli ödeme ayarı özeti (gizli alan yok).
 */
export class PaymentSettingsPublicDto {
  iyzicoEnabled: boolean;
  ibanEftEnabled: boolean;
  qnbpayEnabled: boolean;
  qnbpayCheckoutMode: string;
  /** Varsa son 4 hane maskeli */
  qnbpayMerchantIdMasked: string | null;
}
