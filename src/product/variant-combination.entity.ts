import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  OneToOne,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { Product } from './product.entity';
import { VariantValue } from './variant-value.entity';
import { Stock } from '../stock/stock.entity';

@Entity('variant_combinations')
export class VariantCombination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ unique: true, nullable: true })
  sku: string | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  priceOverride: number | null; // Varsa basePrice'ı override eder

  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => VariantValue, (value) => value.combinations)
  @JoinTable({
    name: 'variant_combination_values',
    joinColumn: { name: 'variantCombinationId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'variantValueId', referencedColumnName: 'id' },
  })
  variantValues: VariantValue[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
