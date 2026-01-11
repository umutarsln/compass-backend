import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsBoolean, IsInt } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiProperty({
    description: 'Kategori adı',
    example: 'Güncellenmiş Kategori Adı',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Kategori açıklaması',
    example: 'Güncellenmiş açıklama',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Üst kategori ID',
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
    example: 'Güncellenmiş SEO Başlık',
    required: false,
  })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiProperty({
    description: 'SEO açıklama',
    example: 'Güncellenmiş SEO açıklama',
    required: false,
  })
  @IsOptional()
  @IsString()
  seoDescription?: string;

  @ApiProperty({
    description: 'SEO anahtar kelimeler',
    example: ['yeni', 'anahtar', 'kelimeler'],
    required: false,
    type: [String],
  })
  @IsOptional()
  seoKeywords?: string[];

  @ApiProperty({
    description: 'Kategori aktif mi?',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Görüntülenme sırası',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
