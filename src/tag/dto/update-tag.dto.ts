import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateTagDto } from './create-tag.dto';

export class UpdateTagDto extends PartialType(CreateTagDto) {
  @ApiProperty({
    description: 'Tag adı',
    example: 'Güncellenmiş Tag Adı',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Tag açıklaması',
    example: 'Güncellenmiş açıklama',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Tag rengi (hex code)',
    example: '#33FF57',
    required: false,
  })
  @IsOptional()
  @IsString()
  color?: string;
}
