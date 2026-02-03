import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { Product } from '../product/product.entity';

@Entity('product_analytics_daily')
@Unique(['productId', 'date'])
export class ProductAnalyticsDaily {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    productId: string;

    @ManyToOne(() => Product, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'productId' })
    product: Product;

    @Column({ type: 'date' })
    date: string;

    @Column({ type: 'int', default: 0 })
    viewCount: number;

    @Column({ type: 'int', default: 0 })
    totalTimeSeconds: number;

    @Column({ type: 'int', default: 0 })
    cartAddCount: number;

    @Column({ type: 'int', default: 0 })
    orderCount: number;
}
