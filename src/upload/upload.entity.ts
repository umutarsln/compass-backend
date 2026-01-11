import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';
import { Folder } from '../folder/folder.entity';

@Entity('uploads')
export class Upload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string; // Orijinal dosya adı

  @Column({ type: 'varchar', nullable: true })
  displayName: string | null; // Görünen isim

  @Column()
  mimeType: string; // Dosya tipi

  @Column('bigint')
  size: number; // Dosya boyutu (bytes)

  @Column('decimal', { precision: 10, scale: 2 })
  sizeMB: number; // MB cinsinden boyut

  @Column()
  s3Key: string; // S3'teki key (path)

  @Column()
  s3Bucket: string; // S3 bucket adı

  @Column()
  s3Url: string; // S3 URL'i

  @Column({ unique: true })
  hash: string; // Dosya hash'i (SHA-256) - tekrar kontrolü için

  @Column({ type: 'uuid', nullable: true })
  folderId: string | null; // Hangi klasörde (nullable, root için null)

  @ManyToOne(() => Folder, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'folderId' })
  folder: Folder | null;

  @Column({ type: 'varchar', nullable: true })
  seoTitle: string | null; // SEO başlık

  @Column({ type: 'text', nullable: true })
  seoDescription: string | null; // SEO açıklama

  @Column({ type: 'simple-array', nullable: true })
  seoKeywords: string[] | null; // SEO anahtar kelimeler

  @Column()
  createdById: string; // Yükleyen kullanıcı

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
