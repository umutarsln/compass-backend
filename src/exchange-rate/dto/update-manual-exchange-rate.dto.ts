import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

/** Manuel USD/TRY kurunu ayarlar veya kaldırır (null = otomatik kura dön). */
export class UpdateManualExchangeRateDto {
  @ApiPropertyOptional({
    description: 'Manuel USD/TRY kuru; null gönderilirse manuel override silinir',
    example: 44.5,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  manualUsdTryRate?: number | null;
}
