import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PersonalizationFormVersion } from './personalization-form-version.entity';
import { PersonalizationField } from './personalization-field.entity';
import { PersonalizationCondition } from './personalization-condition.entity';

@Entity('personalization_forms')
export class PersonalizationForm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'varchar', nullable: true })
  subtitle: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  currentPublishedVersionId: string | null;

  @ManyToOne(() => PersonalizationFormVersion, { nullable: true })
  @JoinColumn({ name: 'currentPublishedVersionId' })
  currentPublishedVersion: PersonalizationFormVersion | null;

  @OneToMany(() => PersonalizationFormVersion, (version) => version.form)
  versions: PersonalizationFormVersion[];

  @OneToMany(() => PersonalizationField, (field) => field.form)
  fields: PersonalizationField[];

  @OneToMany(() => PersonalizationCondition, (condition) => condition.form)
  conditions: PersonalizationCondition[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
