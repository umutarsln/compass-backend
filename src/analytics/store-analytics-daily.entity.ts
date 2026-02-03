import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('store_analytics_daily')
export class StoreAnalyticsDaily {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'date', unique: true })
    date: string;

    @Column({ type: 'int', default: 0 })
    pageViewCount: number;

    @Column({ type: 'int', default: 0 })
    productViewCount: number;

    @Column({ type: 'int', default: 0 })
    cartAddCount: number;

    @Column({ type: 'int', default: 0 })
    orderCount: number;

    @Column('decimal', { precision: 12, scale: 2, default: 0 })
    totalRevenue: number;

    @Column({ type: 'jsonb', nullable: true })
    pageBreakdown: Record<string, number> | null;
}
