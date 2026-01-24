import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PersonalizationForm } from './personalization-form.entity';
import { PersonalizationFormVersionStatus } from '../common/enums/personalization-form-version-status.enum';

@Entity('personalization_form_versions')
export class PersonalizationFormVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  formId: string;

  @ManyToOne(() => PersonalizationForm, (form) => form.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'formId' })
  form: PersonalizationForm;

  @Column({ type: 'int' })
  version: number;

  @Column({
    type: 'enum',
    enum: PersonalizationFormVersionStatus,
    default: PersonalizationFormVersionStatus.DRAFT,
  })
  status: PersonalizationFormVersionStatus;

  @Column({ type: 'jsonb' })
  schemaSnapshot: any; // Stores the complete form schema at version time

  @CreateDateColumn()
  createdAt: Date;
}
