import { ApiProperty } from '@nestjs/swagger';

export class StoreProductGalleryDto {
  @ApiProperty({ nullable: true })
  mainImage: {
    id: string;
    s3Url: string;
    displayName: string | null;
    filename: string;
  } | null;

  @ApiProperty({ nullable: true })
  thumbnailImage: {
    id: string;
    s3Url: string;
    displayName: string | null;
    filename: string;
  } | null;

  @ApiProperty()
  detailImages: Array<{
    id: string;
    s3Url: string;
    displayName: string | null;
    filename: string;
  }>;
}

export class StoreProductDto {
  @ApiProperty()
  id: string; // Product ID veya VariantCombination ID

  @ApiProperty()
  productId: string; // Her zaman product ID

  @ApiProperty({ nullable: true })
  variantCombinationId: string | null; // Varyasyon kombinasyonu ID'si (varsa)

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  price: number; // Hesaplanmış fiyat (basePrice + variant deltas + discount)

  @ApiProperty()
  basePrice: number; // Orijinal base price

  @ApiProperty()
  isOnSale: boolean;

  @ApiProperty({ nullable: true })
  discountPercent: number | null;

  @ApiProperty({ nullable: true })
  sku: string | null;

  @ApiProperty()
  stock: {
    availableQuantity: number;
    reservedQuantity: number;
    usableQuantity: number; // availableQuantity - reservedQuantity
  };

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

  @ApiProperty()
  variantValues: Array<{
    id: string;
    value: string;
    colorCode: string | null;
    variantOption: {
      id: string;
      name: string;
      type: 'COLOR' | 'TEXT';
    };
  }>; // Varyasyon kombinasyonu için variant değerleri

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class StoreProductListResponseDto {
  @ApiProperty({ type: [StoreProductDto] })
  products: StoreProductDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
