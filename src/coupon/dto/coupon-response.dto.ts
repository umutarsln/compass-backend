import { ApiProperty } from '@nestjs/swagger';
import { CouponType } from '../../common/enums/coupon-type.enum';

export class CouponResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ enum: CouponType })
  type: CouponType;

  @ApiProperty()
  discountValue: number;

  @ApiProperty()
  usageCount: number;

  @ApiProperty({ nullable: true })
  usageLimit: number | null;

  @ApiProperty({ nullable: true })
  minOrderAmount: number | null;

  @ApiProperty({ nullable: true })
  validFrom: Date | null;

  @ApiProperty({ nullable: true })
  validTo: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
