import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  OneToOne,
  OneToMany,
  JoinColumn,
  JoinTable,
  Unique,
} from 'typeorm';
import { Product } from './product.entity';
import { VariantValue } from './variant-value.entity';
import { ProductGallery } from './product-gallery.entity';
import { Stock } from '../stock/stock.entity';

@Entity('variant_combinations')
@Unique('uq_variant_combination_slug', ['slug'])
export class VariantCombination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'varchar', unique: true, nullable: true })
  sku: string | null;

  @Column({ type: 'varchar', nullable: true })
  slug: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isDisabled: boolean; // Bu kombinasyon disabled mı? (örneğin: plastik + kırmızı = disabled)

  @ManyToMany(() => VariantValue, (value) => value.combinations)
  @JoinTable({
    name: 'variant_combination_values',
    joinColumn: { name: 'variantCombinationId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'variantValueId', referencedColumnName: 'id' },
  })
  variantValues: VariantValue[];

  @OneToMany(() => ProductGallery, (gallery) => gallery.variantCombination)
  galleries: ProductGallery[];

  @OneToOne(() => Stock, (stock) => stock.variantCombination)
  stock: Stock | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
