import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { OrderStatus } from '../common/enums/order-status.enum';
import { Currency } from '../common/enums/currency.enum';
import { User } from '../user/user.entity';
import { OrderItem } from './order-item.entity';
import { Cart } from '../cart/cart.entity';
import { Coupon } from '../coupon/coupon.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 8, unique: true, nullable: false })
  orderNo: string; // 8 haneli unique sipariş numarası

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'uuid', nullable: true })
  cartId: string | null;

  @ManyToOne(() => Cart, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cartId' })
  cart: Cart | null;

  @Column({ type: 'uuid', nullable: true })
  couponId: string | null;

  @ManyToOne(() => Coupon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon | null;

  // Guest checkout için bilgiler
  @Column({ type: 'varchar', nullable: true })
  guestEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  guestPhone: string | null;

  @Column({ type: 'varchar', nullable: true })
  guestFirstName: string | null;

  @Column({ type: 'varchar', nullable: true })
  guestLastName: string | null;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number; // Ürün toplamı

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  shippingCost: number; // Kargo ücreti

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discount: number; // İndirim

  @Column('decimal', { precision: 10, scale: 2 })
  total: number; // Toplam (subtotal + shipping - discount)

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.TRY,
  })
  currency: Currency;

  // Teslimat adresi
  @Column({ type: 'jsonb', nullable: true })
  shippingAddress: any;

  // Fatura adresi
  @Column({ type: 'jsonb', nullable: true })
  billingAddress: any;

  @Column({ type: 'text', nullable: true })
  notes: string | null; // Sipariş notları

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
