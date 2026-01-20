import { PaymentProvider } from '../../common/enums/payment-provider.enum';

export class CheckoutResponseDto {
  attemptId: string;
  provider: PaymentProvider;
  redirectUrl: string;
  token?: string;
}
