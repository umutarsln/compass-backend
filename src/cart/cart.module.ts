import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from './cart.entity';
import { CartItem } from './cart-item.entity';
import { Product } from '../product/product.entity';
import { VariantCombination } from '../product/variant-combination.entity';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { GuestCartGuard } from './guards/guest-cart.guard';
import { UserCartGuard } from './guards/user-cart.guard';
import { PersonalizationModule } from '../personalization/personalization.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cart,
      CartItem,
      Product,
      VariantCombination,
    ]),
    PersonalizationModule,
  ],
  controllers: [CartController],
  providers: [CartService, GuestCartGuard, UserCartGuard],
  exports: [CartService],
})
export class CartModule {}
