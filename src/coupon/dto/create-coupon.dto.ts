import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CouponType } from '../../common/enums/coupon-type.enum';
import { Type } from 'class-transformer';

export class CreateCouponDto {
  @ApiProperty({ description: 'Kupon kodu', example: 'HOSGELDIN20' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Kupon adı', example: 'Hoş geldin indirimi' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Açıklama', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: CouponType, description: 'Kupon türü' })
  @IsEnum(CouponType)
  type: CouponType;

  @ApiProperty({
    description: 'İndirim değeri (yüzde için 0-100, sabit için TL)',
    example: 20,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountValue: number;

  @ApiProperty({ description: 'Maksimum kullanım sayısı', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  usageLimit?: number;

  @ApiProperty({
    description: 'Minimum sepet tutarı (TL)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minOrderAmount?: number;

  @ApiProperty({ description: 'Geçerlilik başlangıç tarihi', required: false })
  @IsOptional()
  @Type(() => Date)
  validFrom?: Date;

  @ApiProperty({ description: 'Geçerlilik bitiş tarihi', required: false })
  @IsOptional()
  @Type(() => Date)
  validTo?: Date;
}
