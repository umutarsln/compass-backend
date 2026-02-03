import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyCouponDto {
  @ApiProperty({ description: 'Kupon kodu', example: 'HOSGELDIN20' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
