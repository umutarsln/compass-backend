import {
    Entity,
    Column,
    PrimaryColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Product } from '../product/product.entity';

@Entity('product_analytics_total')
export class ProductAnalyticsTotal {
    @PrimaryColumn('uuid')
    productId: string;

    @ManyToOne(() => Product, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'productId' })
    product: Product;

    @Column({ type: 'int', default: 0 })
    viewCount: number;

    @Column({ type: 'int', default: 0 })
    totalTimeSeconds: number;

    @Column({ type: 'int', default: 0 })
    cartAddCount: number;

    @Column({ type: 'int', default: 0 })
    orderCount: number;
}
