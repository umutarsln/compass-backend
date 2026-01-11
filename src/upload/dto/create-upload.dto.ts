import { IsOptional, IsString, IsUUID, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUploadDto {
  @ApiProperty({
    description: 'Görünen isim',
    example: 'Ürün Resmi 1',
    required: false,
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({
    description: 'Hangi klasörde (root için boş bırakın)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @ApiProperty({
    description: 'SEO başlık',
    example: 'Ürün Resmi - SEO Başlık',
    required: false,
  })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiProperty({
    description: 'SEO açıklama',
    example: 'Bu ürün resminin SEO açıklaması',
    required: false,
  })
  @IsOptional()
  @IsString()
  seoDescription?: string;

  @ApiProperty({
    description: 'SEO anahtar kelimeler',
    example: ['ürün', 'resim', 'e-ticaret'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seoKeywords?: string[];
}
