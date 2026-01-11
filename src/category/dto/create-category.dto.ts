import { IsNotEmpty, IsString, IsOptional, IsUUID, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Kategori adı',
    example: 'Elektronik',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Kategori açıklaması',
    example: 'Elektronik ürünler kategorisi',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Üst kategori ID (root kategori için boş bırakın)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty({
    description: 'Kategori görseli (Upload ID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  imageId?: string;

  @ApiProperty({
    description: 'SEO başlık',
    example: 'Elektronik Ürünler - SEO Başlık',
    required: false,
  })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiProperty({
    description: 'SEO açıklama',
    example: 'Elektronik ürünler için SEO açıklaması',
    required: false,
  })
  @IsOptional()
  @IsString()
  seoDescription?: string;

  @ApiProperty({
    description: 'SEO anahtar kelimeler',
    example: ['elektronik', 'teknoloji', 'ürünler'],
    required: false,
    type: [String],
  })
  @IsOptional()
  seoKeywords?: string[];

  @ApiProperty({
    description: 'Kategori aktif mi?',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Görüntülenme sırası',
    example: 0,
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
