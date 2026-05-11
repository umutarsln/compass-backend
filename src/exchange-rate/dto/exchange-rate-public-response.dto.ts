import { ApiProperty } from '@nestjs/swagger';

/** Mağaza ve ayarlar özeti için güvenli kur bilgisi (sırlar içermez). */
export class ExchangeRatePublicResponseDto {
  @ApiProperty({ description: 'Kullanılan USD/TRY kuru', example: 42.123456 })
  usdTryRate: number;

  @ApiProperty({
    description: 'Manuel kur tanımlı mı?',
    example: false,
  })
  isManualOverride: boolean;

  @ApiProperty({
    description: 'Son otomatik güncelleme zamanı',
    nullable: true,
  })
  fetchedAt: Date | null;

  @ApiProperty({
    description: 'Son kur kaynağı (ör. API hostname)',
    nullable: true,
  })
  fetchSource: string | null;
}
