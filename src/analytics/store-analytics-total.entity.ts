import {
    Entity,
    Column,
    PrimaryColumn,
} from 'typeorm';

@Entity('store_analytics_total')
export class StoreAnalyticsTotal {
    @PrimaryColumn({ type: 'varchar', length: 32, default: 'default' })
    id: string;

    @Column({ type: 'int', default: 0 })
    totalPageViews: number;

    @Column({ type: 'int', default: 0 })
    totalProductViews: number;

    @Column({ type: 'int', default: 0 })
    totalCartAdds: number;

    @Column({ type: 'int', default: 0 })
    totalOrders: number;

    @Column('decimal', { precision: 12, scale: 2, default: 0 })
    totalRevenue: number;

    @Column({ type: 'timestamptz', nullable: true })
    lastAggregationAt: Date | null;
}
