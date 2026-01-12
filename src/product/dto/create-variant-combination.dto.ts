import { IsString, IsNumber, IsBoolean, IsArray, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVariantCombinationDto {
  @ApiProperty({
    description: 'Varyasyon değer ID\'leri',
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @IsString({ each: true })
  variantValueIds: string[];

  @ApiPropertyOptional({ description: 'SKU', example: 'PROD-RED-L' })
  @IsOptional()
  @IsString()
  sku?: string | null;

  @ApiPropertyOptional({ description: 'Satışta mı?', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Disabled mı?', default: false })
  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;
}
