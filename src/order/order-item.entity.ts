import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Currency } from '../common/enums/currency.enum';
import { Order } from './order.entity';
import { Product } from '../product/product.entity';
import { VariantCombination } from '../product/variant-combination.entity';

@Entity('order_items')
export class OrderItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    orderId: string;

    @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'orderId' })
    order: Order;

    @Column({ type: 'uuid' })
    productId: string;

    @ManyToOne(() => Product, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'productId' })
    product: Product;

    @Column({ type: 'uuid', nullable: true })
    variantId: string | null;

    @ManyToOne(() => VariantCombination, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'variantId' })
    variant: VariantCombination | null;

    @Column()
    productName: string; // Snapshot at order time

    @Column({ type: 'int' })
    quantity: number;

    @Column('decimal', { precision: 10, scale: 2 })
    unitPrice: number; // Birim fiyat snapshot

    @Column('decimal', { precision: 10, scale: 2, nullable: true })
    discountedPrice: number | null; // İndirimli fiyat snapshot

    @Column('decimal', { precision: 10, scale: 2 })
    totalPrice: number; // Toplam fiyat (unitPrice * quantity veya discountedPrice * quantity)

    @Column({
        type: 'enum',
        enum: Currency,
        default: Currency.TRY,
    })
    currency: Currency;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
