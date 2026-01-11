import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SellableType } from '../common/enums/sellable-type.enum';

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

  @Column({ type: 'int', default: 0 })
  availableQuantity: number;

  @Column({ type: 'int', default: 0 })
  reservedQuantity: number;

  @Column({ type: 'int', nullable: true })
  lowStockThreshold: number | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
