import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateStockDto {
  @ApiProperty({
    description: 'Mevcut stok miktarı',
    example: 100,
  })
  @IsInt()
  @Min(0)
  availableQuantity: number;

  @ApiProperty({
    description: 'Düşük stok eşiği',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number | null;
}
