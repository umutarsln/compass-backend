import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsArray } from 'class-validator';
import { CreateUploadDto } from './create-upload.dto';

export class UpdateUploadDto extends PartialType(CreateUploadDto) {
  @ApiProperty({
    description: 'Görünen isim',
    example: 'Güncellenmiş Dosya Adı',
    required: false,
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({
    description: 'Hangi klasörde',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  folderId?: string;

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
  @IsArray()
  @IsString({ each: true })
  seoKeywords?: string[];
}
