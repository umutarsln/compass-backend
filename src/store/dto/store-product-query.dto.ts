import { IsOptional, IsString, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum StoreProductOrderBy {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NAME_ASC = 'name_asc',
  NAME_DESC = 'name_desc',
  CREATED_AT_DESC = 'created_at_desc',
  CREATED_AT_ASC = 'created_at_asc',
}

export class StoreProductQueryDto {
  @ApiPropertyOptional({ description: 'Arama terimi (ürün adı, açıklama)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Kategori ID filtresi' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Tag ID filtresi (virgülle ayrılmış)' })
  @IsOptional()
  @IsString()
  tagIds?: string;

  @ApiPropertyOptional({ description: 'Minimum fiyat' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maksimum fiyat' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ 
    description: 'Sıralama',
    enum: StoreProductOrderBy,
    default: StoreProductOrderBy.CREATED_AT_DESC
  })
  @IsOptional()
  @IsEnum(StoreProductOrderBy)
  orderBy?: StoreProductOrderBy;

  @ApiPropertyOptional({ description: 'Sayfa numarası', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Sayfa başına kayıt sayısı', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
