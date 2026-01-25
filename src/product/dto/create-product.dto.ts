import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProductType } from '../../common/enums/product-type.enum';

export class CreateProductDto {
  @ApiProperty({
    description: 'Ürün tipi',
    enum: ProductType,
    example: ProductType.SIMPLE,
  })
  @IsNotEmpty()
  @IsEnum(ProductType)
  type: ProductType;

  @ApiProperty({
    description: 'Ürün adı',
    example: 'Örnek Ürün',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Ürün alt başlığı (liste görünümünde gösterilir)',
    example: 'Kısa ve öz ürün açıklaması',
    required: false,
  })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty({
    description: 'Ürün açıklaması (Markdown formatında)',
    example: '# Ürün Açıklaması\n\nBu ürün hakkında detaylı bilgi...',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Temel fiyat',
    example: 99.99,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({
    description: 'SKU (Stok Kodu)',
    example: 'PRD-001',
    required: false,
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({
    description: 'Ürün aktif mi?',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Öne çıkan ürün mü?',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({
    description: 'İndirimli fiyat (varsa bu fiyat kullanılır)',
    example: 89.99,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountedPrice?: number;

  @ApiProperty({
    description: 'SEO başlık',
    example: 'Örnek Ürün - SEO Başlık',
    required: false,
  })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiProperty({
    description: 'SEO açıklama',
    example: 'Bu ürün için SEO açıklaması',
    required: false,
  })
  @IsOptional()
  @IsString()
  seoDescription?: string;

  @ApiProperty({
    description: 'SEO anahtar kelimeler',
    example: ['ürün', 'e-ticaret', 'satış'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seoKeywords?: string[];

  @ApiProperty({
    description: 'Kategori ID\'leri',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiProperty({
    description: 'Tag ID\'leri',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @ApiProperty({
    description: 'Kişiselleştirme Form ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  personalizationFormId?: string | null;
}
