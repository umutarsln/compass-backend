import { IsNotEmpty, IsString, IsUUID, IsInt, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddItemDto {
  @ApiProperty({
    description: 'Product ID',
    example: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Variant combination ID (optional, for variant products)',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({
    description: 'Quantity to add',
    example: 1,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;
}
