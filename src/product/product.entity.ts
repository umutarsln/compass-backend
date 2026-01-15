import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  OneToMany,
  OneToOne,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { ProductType } from '../common/enums/product-type.enum';
import { User } from '../user/user.entity';
import { Category } from '../category/category.entity';
import { Tag } from '../tag/tag.entity';
import { ProductGallery } from './product-gallery.entity';
import { Stock } from '../stock/stock.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ProductType,
  })
  type: ProductType;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  subtitle: string | null;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text' })
  description: string; // Markdown content

  @Column('decimal', { precision: 10, scale: 2 })
  basePrice: number;

  @Column({ type: 'varchar', unique: true, nullable: true })
  sku: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: false })
  isOnSale: boolean;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  discountedPrice: number | null;

  @Column({ type: 'varchar', nullable: true })
  seoTitle: string | null;

  @Column({ type: 'text', nullable: true })
  seoDescription: string | null;

  @Column({ type: 'simple-array', nullable: true })
  seoKeywords: string[] | null;

  @Column()
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @ManyToMany(() => Category)
  @JoinTable({
    name: 'product_categories',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' },
  })
  categories: Category[];

  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'product_tags',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @OneToMany(() => ProductGallery, (gallery) => gallery.product)
  galleries: ProductGallery[];

  @OneToOne(() => Stock, (stock) => stock.product)
  stock: Stock | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
