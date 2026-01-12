import { IsString, IsNumber, IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
