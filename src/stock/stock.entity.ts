import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { SellableType } from '../common/enums/sellable-type.enum';
import { Product } from '../product/product.entity';
import { VariantCombination } from '../product/variant-combination.entity';

@Entity('stocks')
@Index(['sellableType', 'sellableId'], { unique: true })
export class Stock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: SellableType,
  })
  sellableType: SellableType;

  @Column({ type: 'uuid' })
  sellableId: string;

  // Product relation (SIMPLE ürünler için)
  @Column({ type: 'uuid', nullable: true, unique: true })
  productId: string | null;

  @OneToOne(() => Product, (product) => product.stock, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product | null;

  // VariantCombination relation (VARIANT ürünler için)
  @Column({ type: 'uuid', nullable: true, unique: true })
  variantCombinationId: string | null;

  @OneToOne(
    () => VariantCombination,
    (variantCombination) => variantCombination.stock,
    {
      nullable: true,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'variantCombinationId' })
  variantCombination: VariantCombination | null;

  @Column({ type: 'int', default: 0 })
  availableQuantity: number;

  @Column({ type: 'int', default: 0 })
  reservedQuantity: number;

  @Column({ type: 'int', nullable: true })
  lowStockThreshold: number | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
