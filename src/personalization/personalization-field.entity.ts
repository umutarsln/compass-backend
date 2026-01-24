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
import { PersonalizationForm } from './personalization-form.entity';
import { PersonalizationFieldType } from '../common/enums/personalization-field-type.enum';

@Entity('personalization_fields')
@Unique('unique_form_field_key', ['formId', 'key'])
export class PersonalizationField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  formId: string;

  @ManyToOne(() => PersonalizationForm, (form) => form.fields, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'formId' })
  form: PersonalizationForm;

  @Column()
  key: string; // Unique per form

  @Column()
  title: string;

  @Column({ type: 'varchar', nullable: true })
  subtitle: string | null;

  @Column({ type: 'text', nullable: true })
  helperText: string | null;

  @Column({ default: false })
  required: boolean;

  @Column({
    type: 'enum',
    enum: PersonalizationFieldType,
  })
  type: PersonalizationFieldType;

  @Column({ type: 'jsonb', nullable: true })
  defaultValue: any;

  @Column({ type: 'jsonb', nullable: true })
  validationRules: any;

  @Column({ type: 'jsonb', nullable: true })
  pricingRules: any;

  @Column({ type: 'jsonb', nullable: true })
  config: any; // Field-specific configuration (options for SELECT, min/max for NUMBER, etc.)

  @Column({ type: 'int', default: 0 })
  orderIndex: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
