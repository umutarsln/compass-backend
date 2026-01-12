import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductGalleryDto {
  @ApiProperty({
    description: 'Ürün ID (basit ürünler için)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => !o.variantCombinationId)
  @IsUUID('4')
  productId?: string;

  @ApiProperty({
    description: 'Varyasyon kombinasyonu ID (variant ürünler için)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => !o.productId)
  @IsUUID('4')
  variantCombinationId?: string;

  @ApiProperty({
    description: 'Ana resim ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID('4')
  mainImageId: string;

  @ApiProperty({
    description: 'Thumbnail resim ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID('4')
  thumbnailImageId: string;

  @ApiProperty({
    description: 'Detay resim ID\'leri',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '223e4567-e89b-12d3-a456-426614174001',
    ],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  detailImageIds?: string[];

  @ApiProperty({
    description: 'Görüntülenme sırası',
    example: 0,
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
