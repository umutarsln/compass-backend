import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    Index,
} from 'typeorm';
import { AnalyticsEventType } from '../common/enums/analytics-event-type.enum';

@Entity('analytics_events')
@Index(['eventType', 'createdAt'])
@Index(['productId', 'createdAt'])
@Index(['createdAt'])
export class AnalyticsEvent {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: AnalyticsEventType,
    })
    eventType: AnalyticsEventType;

    @Column({ type: 'uuid', nullable: true })
    productId: string | null;

    @Column({ type: 'uuid', nullable: true })
    variantId: string | null;

    @Column({ type: 'uuid', nullable: true })
    userId: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    sessionId: string | null;

    @Column({ type: 'jsonb', nullable: true })
    payload: Record<string, unknown> | null;

    @CreateDateColumn()
    createdAt: Date;
}
