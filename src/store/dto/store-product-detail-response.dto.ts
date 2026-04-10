import { ApiProperty } from '@nestjs/swagger';
import { StoreProductDto, StoreProductGalleryDto } from './store-product-response.dto';

export class StoreVariantOptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['COLOR', 'TEXT'] })
  type: 'COLOR' | 'TEXT';

  @ApiProperty()
  displayOrder: number;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty({ type: [Object] })
  values: Array<{
    id: string;
    value: string;
    colorCode: string | null;
    priceDelta: number;
    isActive: boolean;
    displayOrder: number;
  }>;
}

export class StoreVariantCombinationDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  slug: string | null;

  @ApiProperty()
  sku: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isDisabled: boolean;

  @ApiProperty()
  price: number; // Hesaplanmış fiyat (discountedPrice + priceDelta veya basePrice + priceDelta)

  @ApiProperty()
  basePrice: number; // Base price + priceDelta'lar

  @ApiProperty({ nullable: true })
  discountedPrice: number | null; // Discounted price + priceDelta'lar (varsa)

  @ApiProperty()
  stock: {
    availableQuantity: number;
    reservedQuantity: number;
    usableQuantity: number;
  };

  @ApiProperty()
  gallery: StoreProductGalleryDto;

  @ApiProperty({ type: [Object] })
  variantValues: Array<{
    id: string;
    value: string;
    colorCode: string | null;
    variantOption: {
      id: string;
      name: string;
      type: 'COLOR' | 'TEXT';
    };
  }>;
}

export class StoreProductDetailResponseDto {
  @ApiProperty()
  productId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  subtitle: string | null;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  basePrice: number;

  @ApiProperty({ nullable: true })
  discountedPrice: number | null;

  @ApiProperty({ enum: ['SIMPLE', 'VARIANT', 'BUNDLE'] })
  type: 'SIMPLE' | 'VARIANT' | 'BUNDLE';

  @ApiProperty()
  gallery: StoreProductGalleryDto;

  @ApiProperty()
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;

  @ApiProperty()
  tags: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;

  @ApiProperty({ nullable: true })
  seoTitle: string | null;

  @ApiProperty({ nullable: true })
  seoDescription: string | null;

  @ApiProperty({ nullable: true })
  seoKeywords: string[] | null;

  // Basit ürün için
  @ApiProperty({ nullable: true })
  price: number | null; // Basit ürün için hesaplanmış fiyat

  @ApiProperty({ nullable: true })
  sku: string | null; // Basit ürün için SKU

  @ApiProperty({ nullable: true })
  stock: {
    availableQuantity: number;
    reservedQuantity: number;
    usableQuantity: number;
  } | null; // Basit ürün için stok

  // Varyasyonlu ürün için
  @ApiProperty({ nullable: true, type: [StoreVariantOptionDto] })
  variantOptions: StoreVariantOptionDto[] | null; // Varyasyon seçenekleri

  @ApiProperty({ nullable: true, type: [StoreVariantCombinationDto] })
  variantCombinations: StoreVariantCombinationDto[] | null; // Tüm aktif kombinasyonlar

  @ApiProperty({ nullable: true })
  selectedCombination: StoreVariantCombinationDto | null; // Seçili kombinasyon (variantCombinationId query param ile)

  @ApiProperty({ nullable: true, description: 'Personalization form data' })
  personalizationForm: {
    formId: string;
    versionId: string;
    version: number;
    schemaSnapshot: any;
  } | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
