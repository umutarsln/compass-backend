import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { Currency } from '../common/enums/currency.enum';
import { Cart } from './cart.entity';
import { Product } from '../product/product.entity';
import { VariantCombination } from '../product/variant-combination.entity';

@Entity('cart_items')
@Unique('unique_cart_product_variant', ['cartId', 'productId', 'variantId'])
export class CartItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    cartId: string;

    @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'cartId' })
    cart: Cart;

    @Column({ type: 'uuid' })
    productId: string;

    @ManyToOne(() => Product, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'productId' })
    product: Product;

    @Column({ type: 'uuid', nullable: true })
    variantId: string | null;

    @ManyToOne(() => VariantCombination, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'variantId' })
    variant: VariantCombination | null;

    @Column({ type: 'int', default: 1 })
    quantity: number;

    @Column('decimal', { precision: 10, scale: 2 })
    basePrice: number; // Price snapshot at add time

    @Column('decimal', { precision: 10, scale: 2, nullable: true })
    discountedPrice: number | null; // Discounted price snapshot at add time

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
