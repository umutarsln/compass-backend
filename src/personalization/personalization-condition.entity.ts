import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PersonalizationForm } from './personalization-form.entity';
import { PersonalizationField } from './personalization-field.entity';

@Entity('personalization_conditions')
export class PersonalizationCondition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  formId: string;

  @ManyToOne(() => PersonalizationForm, (form) => form.conditions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'formId' })
  form: PersonalizationForm;

  @Column({ type: 'uuid', nullable: true })
  fieldId: string | null; // Null means condition applies to entire form

  @ManyToOne(() => PersonalizationField, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fieldId' })
  field: PersonalizationField | null;

  @Column({ type: 'jsonb' })
  ifJson: any; // { fieldKey: string, operator: string, value: any }

  @Column({ type: 'jsonb' })
  thenJson: any; // { action: string, targetFieldKeys: string[] }

  @Column({ type: 'int', default: 0 })
  orderIndex: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
