import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CouponType } from '../../common/enums/coupon-type.enum';
import { Type } from 'class-transformer';

export class UpdateCouponDto {
  @ApiProperty({ description: 'Kupon kodu', required: false })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ description: 'Kupon adı', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Açıklama', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: CouponType, required: false })
  @IsOptional()
  @IsEnum(CouponType)
  type?: CouponType;

  @ApiProperty({ description: 'İndirim değeri', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountValue?: number;

  @ApiProperty({ description: 'Maksimum kullanım sayısı (null = sınırsız)', required: false })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  usageLimit?: number | null;

  @ApiProperty({ description: 'Minimum sepet tutarı (TL)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minOrderAmount?: number | null;

  @ApiProperty({ description: 'Geçerlilik başlangıç tarihi', required: false })
  @IsOptional()
  @Type(() => Date)
  validFrom?: Date | null;

  @ApiProperty({ description: 'Geçerlilik bitiş tarihi', required: false })
  @IsOptional()
  @Type(() => Date)
  validTo?: Date | null;
}
