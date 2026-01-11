import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { VariantCombination } from './variant-combination.entity';

@Entity('bundle_items')
export class BundleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  bundleProductId: string; // Bundle product'ın ID'si

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bundleProductId' })
  bundleProduct: Product;

  @Column()
  productId: string; // Bundle'a dahil edilen ürün

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'uuid', nullable: true })
  variantCombinationId: string | null; // Eğer variant product ise

  @ManyToOne(() => VariantCombination, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variantCombinationId' })
  variantCombination: VariantCombination | null;

  @Column({ type: 'int', default: 1 })
  quantity: number; // Kaç adet dahil edilecek

  @Column({ default: true })
  isRequired: boolean; // Zorunlu mu yoksa opsiyonel mi

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
