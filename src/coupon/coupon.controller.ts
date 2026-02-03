import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { CouponResponseDto } from './dto/coupon-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Coupon')
@Controller('coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT-auth')
export class CouponController {
  constructor(private readonly couponService: CouponService) { }

  @Post()
  @ApiOperation({ summary: 'Create coupon (Admin)' })
  @ApiResponse({ status: 201, description: 'Coupon created' })
  async create(@Body() dto: CreateCouponDto) {
    const coupon = await this.couponService.create(dto);
    return this.mapToResponse(coupon);
  }

  @Get()
  @ApiOperation({ summary: 'List all coupons (Admin)' })
  @ApiResponse({ status: 200, description: 'List of coupons' })
  async findAll() {
    const coupons = await this.couponService.findAll();
    return coupons.map((c) => this.mapToResponse(c));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get coupon by ID (Admin)' })
  @ApiResponse({ status: 200, description: 'Coupon details' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async findOne(@Param('id') id: string) {
    const coupon = await this.couponService.findOne(id);
    return this.mapToResponse(coupon);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update coupon (Admin)' })
  @ApiResponse({ status: 200, description: 'Coupon updated' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    const coupon = await this.couponService.update(id, dto);
    return this.mapToResponse(coupon);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete coupon (Admin)' })
  @ApiResponse({ status: 200, description: 'Coupon deleted' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  async remove(@Param('id') id: string) {
    await this.couponService.remove(id);
    return { message: 'Kupon başarıyla silindi' };
  }

  private mapToResponse(coupon: any): CouponResponseDto {
    return {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      description: coupon.description ?? null,
      type: coupon.type,
      discountValue: Number(coupon.discountValue),
      usageCount: coupon.usageCount ?? 0,
      usageLimit: coupon.usageLimit ?? null,
      minOrderAmount: coupon.minOrderAmount != null ? Number(coupon.minOrderAmount) : null,
      validFrom: coupon.validFrom ?? null,
      validTo: coupon.validTo ?? null,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
    };
  }
}
