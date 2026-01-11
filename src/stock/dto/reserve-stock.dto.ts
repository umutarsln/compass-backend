import { IsEnum, IsUUID, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SellableType } from '../../common/enums/sellable-type.enum';

export class ReserveStockDto {
  @ApiProperty({
    description: 'Sellable tip',
    enum: SellableType,
    example: SellableType.PRODUCT,
  })
  @IsEnum(SellableType)
  sellableType: SellableType;

  @ApiProperty({
    description: 'Sellable ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  sellableId: string;

  @ApiProperty({
    description: 'Rezerve edilecek miktar',
    example: 5,
  })
  @IsInt()
  @Min(1)
  quantity: number;
}
