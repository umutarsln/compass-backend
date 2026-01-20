import { IsString, IsEnum, IsOptional } from 'class-validator';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';

export class CheckoutDto {
  @IsString()
  orderId: string;

  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider;
}
