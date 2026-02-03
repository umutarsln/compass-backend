import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from './coupon.entity';
import { CouponType } from '../common/enums/coupon-type.enum';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

export interface ValidateCouponResult {
  coupon: Coupon;
  discountAmount: number;
}

@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(Coupon)
    private couponRepository: Repository<Coupon>,
  ) { }

  async create(dto: CreateCouponDto): Promise<Coupon> {
    if (dto.type === CouponType.PERCENTAGE && (dto.discountValue < 0 || dto.discountValue > 100)) {
      throw new BadRequestException('Yüzdelik indirim 0-100 arasında olmalıdır');
    }
    if (dto.type === CouponType.FIXED && dto.discountValue < 0) {
      throw new BadRequestException('Sabit indirim 0 veya pozitif olmalıdır');
    }

    const existing = await this.couponRepository.findOne({
      where: { code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException('Bu kupon kodu zaten mevcut');
    }

    const coupon = this.couponRepository.create({
      code: dto.code.trim().toUpperCase(),
      name: dto.name,
      description: dto.description ?? null,
      type: dto.type,
      discountValue: dto.discountValue,
      usageLimit: dto.usageLimit ?? null,
      minOrderAmount: dto.minOrderAmount ?? null,
      validFrom: dto.validFrom ?? null,
      validTo: dto.validTo ?? null,
    });
    return await this.couponRepository.save(coupon);
  }

  async findAll(): Promise<Coupon[]> {
    return await this.couponRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Kupon bulunamadı');
    }
    return coupon;
  }

  async findByCode(code: string): Promise<Coupon | null> {
    return await this.couponRepository.findOne({
      where: { code: code.trim().toUpperCase() },
    });
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    const coupon = await this.findOne(id);
    if (dto.type === CouponType.PERCENTAGE && dto.discountValue != null && (dto.discountValue < 0 || dto.discountValue > 100)) {
      throw new BadRequestException('Yüzdelik indirim 0-100 arasında olmalıdır');
    }
    if (dto.code != null) {
      const existing = await this.couponRepository.findOne({
        where: { code: dto.code.trim().toUpperCase() },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Bu kupon kodu zaten mevcut');
      }
      coupon.code = dto.code.trim().toUpperCase();
    }
    if (dto.name != null) coupon.name = dto.name;
    if (dto.description !== undefined) coupon.description = dto.description ?? null;
    if (dto.type != null) coupon.type = dto.type;
    if (dto.discountValue != null) coupon.discountValue = dto.discountValue;
    if (dto.usageLimit !== undefined) coupon.usageLimit = dto.usageLimit ?? null;
    if (dto.minOrderAmount !== undefined) coupon.minOrderAmount = dto.minOrderAmount ?? null;
    if (dto.validFrom !== undefined) coupon.validFrom = dto.validFrom ?? null;
    if (dto.validTo !== undefined) coupon.validTo = dto.validTo ?? null;
    return await this.couponRepository.save(coupon);
  }

  async remove(id: string): Promise<void> {
    const coupon = await this.findOne(id);
    await this.couponRepository.remove(coupon);
  }

  /**
   * Validates coupon for a cart subtotal and returns coupon + discount amount.
   * Throws BadRequestException if invalid.
   */
  async validateForCart(couponCode: string, subtotal: number): Promise<ValidateCouponResult> {
    const coupon = await this.findByCode(couponCode);
    if (!coupon) {
      throw new BadRequestException('Geçersiz kupon kodu');
    }

    const now = new Date();
    if (coupon.validFrom != null && now < new Date(coupon.validFrom)) {
      throw new BadRequestException('Kupon henüz geçerli değil');
    }
    if (coupon.validTo != null && now > new Date(coupon.validTo)) {
      throw new BadRequestException('Kuponun geçerlilik süresi dolmuş');
    }

    if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('Kupon kullanım limiti dolmuş');
    }

    const minOrder = coupon.minOrderAmount != null ? Number(coupon.minOrderAmount) : null;
    if (minOrder != null && subtotal < minOrder) {
      throw new BadRequestException(
        `Bu kupon için minimum sepet tutarı ${minOrder} TL olmalıdır`,
      );
    }

    let discountAmount = 0;
    if (coupon.type === CouponType.PERCENTAGE) {
      const value = Number(coupon.discountValue);
      discountAmount = Math.round((subtotal * value) / 100 * 100) / 100;
    } else {
      discountAmount = Math.min(Number(coupon.discountValue), subtotal);
      discountAmount = Math.round(discountAmount * 100) / 100;
    }

    return { coupon, discountAmount };
  }

  /**
   * Increment usage count (transaction-safe). Call after successful payment.
   */
  async incrementUsage(couponId: string): Promise<void> {
    await this.couponRepository.increment({ id: couponId }, 'usageCount', 1);
  }
}
