import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { VariantOption } from './variant-option.entity';
import { VariantValue } from './variant-value.entity';
import { VariantCombination } from './variant-combination.entity';
import { BundleItem } from './bundle-item.entity';
import { ProductGallery } from './product-gallery.entity';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { Category } from '../category/category.entity';
import { Tag } from '../tag/tag.entity';
import { Upload } from '../upload/upload.entity';
import { Stock } from '../stock/stock.entity';
import { StockModule } from '../stock/stock.module';
import { CacheModule } from '../cache/cache.module';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module';

@Module({
  imports: [
    CacheModule,
    ExchangeRateModule,
    TypeOrmModule.forFeature([
      Product,
      VariantOption,
      VariantValue,
      VariantCombination,
      BundleItem,
      ProductGallery,
      Category,
      Tag,
      Upload,
      Stock,
    ]),
    StockModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
