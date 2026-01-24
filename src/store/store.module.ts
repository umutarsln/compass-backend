import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../product/product.entity';
import { VariantCombination } from '../product/variant-combination.entity';
import { VariantOption } from '../product/variant-option.entity';
import { VariantValue } from '../product/variant-value.entity';
import { Category } from '../category/category.entity';
import { Tag } from '../tag/tag.entity';
import { Stock } from '../stock/stock.entity';
import { StoreService } from './store.service';
import { StoreController } from './store.controller';
import { PersonalizationModule } from '../personalization/personalization.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Product,
            VariantCombination,
            VariantOption,
            VariantValue,
            Category,
            Tag,
            Stock,
        ]),
        PersonalizationModule,
    ],
    controllers: [StoreController],
    providers: [StoreService],
    exports: [StoreService],
})
export class StoreModule { }
