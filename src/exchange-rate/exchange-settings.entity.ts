import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Tek satırlık merkezi döviz ayarı (USD/TRY).
 */
@Entity('exchange_settings')
export class ExchangeSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Son başarılı internet çekiminden gelen kur (manuel override yoksa kullanılır). */
  @Column('decimal', { precision: 14, scale: 6, nullable: true })
  fetchedUsdTryRate: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fetchedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  fetchSource: string | null;

  /** Doluysa `fetchedUsdTryRate` yerine bu kur kullanılır. */
  @Column('decimal', { precision: 14, scale: 6, nullable: true })
  manualUsdTryRate: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
