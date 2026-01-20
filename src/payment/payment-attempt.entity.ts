import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { PaymentProvider } from '../common/enums/payment-provider.enum';
import { Currency } from '../common/enums/currency.enum';
import { Order } from '../order/order.entity';

@Entity('payment_attempts')
@Index(['conversationId'], { unique: true })
@Index(['orderId'])
@Index(['token'])
export class PaymentAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
  })
  provider: PaymentProvider;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.INITIATED,
  })
  status: PaymentStatus;

  @Column({ type: 'varchar', unique: true })
  conversationId: string; // Internal reference sent to provider

  @Column({ type: 'varchar', nullable: true })
  token: string | null; // Provider token (e.g., iyzico CF token)

  @Column({ type: 'varchar', nullable: true })
  paymentPageUrl: string | null; // Redirect URL from provider

  @Column({ type: 'varchar', nullable: true })
  providerPaymentId: string | null; // Provider's payment ID

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.TRY,
  })
  currency: Currency;

  @Column({ type: 'varchar', nullable: true })
  errorCode: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  rawProviderResponse: any; // For debugging

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
