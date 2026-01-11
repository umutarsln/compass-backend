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
import { Product } from './product.entity';
import { VariantCombination } from './variant-combination.entity';
import { Upload } from '../upload/upload.entity';

@Entity('product_galleries')
export class ProductGallery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null; // Eğer product'a aitse

  @ManyToOne(() => Product, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product | null;

  @Column({ type: 'uuid', nullable: true })
  variantCombinationId: string | null; // Eğer variant combination'a aitse

  @ManyToOne(() => VariantCombination, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'variantCombinationId' })
  variantCombination: VariantCombination | null;

  @Column({ type: 'uuid' })
  mainImageId: string; // Main image

  @ManyToOne(() => Upload, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mainImageId' })
  mainImage: Upload;

  @Column({ type: 'uuid' })
  thumbnailImageId: string; // Thumbnail

  @ManyToOne(() => Upload, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thumbnailImageId' })
  thumbnailImage: Upload;

  @ManyToMany(() => Upload)
  @JoinTable({
    name: 'product_gallery_detail_images',
    joinColumn: { name: 'galleryId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'uploadId', referencedColumnName: 'id' },
  })
  detailImages: Upload[]; // Detail images array

  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
