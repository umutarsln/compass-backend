import { IsString, IsNumber, IsBoolean, IsInt, IsOptional, Min, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PriceInputCurrency } from '../../common/enums/price-input-currency.enum';


export class CreateVariantValueDto {
  @ApiProperty({ description: 'Varyasyon değeri', example: 'Kırmızı' })
  @IsString()
  value: string;

  @ApiPropertyOptional({
    description: 'Renk kodu (hex format: #FF0000) - sadece COLOR tipinde kullanılır',
    example: '#FF0000',
  })
  @IsOptional()
  @IsString()
  colorCode?: string | null;

  @ApiPropertyOptional({
    description: 'Fiyat farkı',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  priceDelta?: number;

  @ApiPropertyOptional({
    description: 'priceDelta için giriş para birimi (varsayılan TRY)',
    enum: PriceInputCurrency,
    default: PriceInputCurrency.TRY,
  })
  @IsOptional()
  @IsEnum(PriceInputCurrency)
  priceDeltaCurrency?: PriceInputCurrency;

  @ApiPropertyOptional({ description: 'Aktif mi?', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Görüntülenme sırası', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
