import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({
    description: 'Tag adı',
    example: 'Yeni Ürün',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Tag açıklaması',
    example: 'Yeni ürünler için tag',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Tag rengi (hex code)',
    example: '#FF5733',
    required: false,
  })
  @IsOptional()
  @IsString()
  color?: string;
}
