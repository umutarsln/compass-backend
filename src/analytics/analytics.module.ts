import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEvent } from './analytics-event.entity';
import { ProductAnalyticsDaily } from './product-analytics-daily.entity';
import { ProductAnalyticsTotal } from './product-analytics-total.entity';
import { StoreAnalyticsDaily } from './store-analytics-daily.entity';
import { StoreAnalyticsTotal } from './store-analytics-total.entity';
import { Order } from '../order/order.entity';
import { OrderItem } from '../order/order-item.entity';
import { Product } from '../product/product.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { StoreAnalyticsController } from './store-analytics.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            AnalyticsEvent,
            ProductAnalyticsDaily,
            ProductAnalyticsTotal,
            StoreAnalyticsDaily,
            StoreAnalyticsTotal,
            Order,
            OrderItem,
            Product,
        ]),
    ],
    controllers: [AnalyticsController, StoreAnalyticsController],
    providers: [AnalyticsService],
    exports: [AnalyticsService],
})
export class AnalyticsModule { }
