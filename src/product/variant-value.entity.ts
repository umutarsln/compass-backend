import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { VariantOption } from './variant-option.entity';

@Entity('variant_values')
export class VariantValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  variantOptionId: string;

  @ManyToOne(() => VariantOption, (option) => option.values, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variantOptionId' })
  variantOption: VariantOption;

  @Column()
  value: string; // Örn: "Red", "Large"

  @Column({ type: 'varchar', nullable: true })
  colorCode: string | null; // Renk kodu (hex format: #FF0000) - sadece COLOR tipinde kullanılır

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  priceDelta: number; // Fiyat farkı

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @ManyToMany('VariantCombination', 'variantValues')
  @JoinTable({
    name: 'variant_combination_values',
    joinColumn: { name: 'variantValueId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'variantCombinationId', referencedColumnName: 'id' },
  })
  combinations: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
