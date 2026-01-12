import { IsString, IsEnum, IsInt, IsBoolean, Min, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVariantOptionDto {
  @ApiProperty({ description: 'Varyasyon seçeneği adı', example: 'Renk' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Varyasyon tipi',
    enum: ['COLOR', 'TEXT'],
    example: 'COLOR',
  })
  @IsEnum(['COLOR', 'TEXT'])
  type: 'COLOR' | 'TEXT';

  @ApiPropertyOptional({ description: 'Görüntülenme sırası', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Zorunlu mu?', default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
