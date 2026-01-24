import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PersonalizationForm } from './personalization-form.entity';
import { PersonalizationFormVersion } from './personalization-form-version.entity';
import { PersonalizationField } from './personalization-field.entity';
import { PersonalizationCondition } from './personalization-condition.entity';
import { CreatePersonalizationFormDto } from './dto/create-personalization-form.dto';
import { UpdatePersonalizationFormDto } from './dto/update-personalization-form.dto';
import { CreatePersonalizationFieldDto } from './dto/create-personalization-field.dto';
import { UpdatePersonalizationFieldDto } from './dto/update-personalization-field.dto';
import { CreatePersonalizationConditionDto } from './dto/create-personalization-condition.dto';
import { UpdatePersonalizationConditionDto } from './dto/update-personalization-condition.dto';
import { PersonalizationFormVersionStatus } from '../common/enums/personalization-form-version-status.enum';
import { generateSlug } from '../common/utils/slug.util';

@Injectable()
export class PersonalizationService {
  constructor(
    @InjectRepository(PersonalizationForm)
    private formRepository: Repository<PersonalizationForm>,
    @InjectRepository(PersonalizationFormVersion)
    private versionRepository: Repository<PersonalizationFormVersion>,
    @InjectRepository(PersonalizationField)
    private fieldRepository: Repository<PersonalizationField>,
    @InjectRepository(PersonalizationCondition)
    private conditionRepository: Repository<PersonalizationCondition>,
    private dataSource: DataSource,
  ) {}

  // ==================== FORM CRUD ====================

  async findAll(): Promise<PersonalizationForm[]> {
    return await this.formRepository.find({
      relations: ['currentPublishedVersion'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<PersonalizationForm> {
    const form = await this.formRepository.findOne({
      where: { id },
      relations: [
        'currentPublishedVersion',
        'versions',
        'fields',
        'conditions',
      ],
      order: {
        versions: { createdAt: 'DESC' },
        fields: { orderIndex: 'ASC' },
        conditions: { orderIndex: 'ASC' },
      },
    });

    if (!form) {
      throw new NotFoundException('Personalization form not found');
    }

    return form;
  }

  async create(
    createDto: CreatePersonalizationFormDto,
  ): Promise<PersonalizationForm> {
    // Generate unique slug
    const baseSlug = generateSlug(createDto.title);
    let slug = baseSlug;
    let counter = 1;

    while (await this.formRepository.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const form = this.formRepository.create({
      ...createDto,
      slug,
      isActive: createDto.isActive ?? true,
    });

    return await this.formRepository.save(form);
  }

  async update(
    id: string,
    updateDto: UpdatePersonalizationFormDto,
  ): Promise<PersonalizationForm> {
    const form = await this.findOne(id);

    // If title changed, update slug
    if (updateDto.title && updateDto.title !== form.title) {
      const baseSlug = generateSlug(updateDto.title);
      let slug = baseSlug;
      let counter = 1;

      while (true) {
        const existing = await this.formRepository.findOne({
          where: { slug },
        });
        if (!existing || existing.id === id) {
          break;
        }
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      form.slug = slug;
    }

    Object.assign(form, updateDto);
    return await this.formRepository.save(form);
  }

  async remove(id: string): Promise<void> {
    const form = await this.findOne(id);
    await this.formRepository.remove(form);
  }

  // ==================== VERSION MANAGEMENT ====================

  async createVersion(formId: string): Promise<PersonalizationFormVersion> {
    const form = await this.findOne(formId);

    // Get latest version number
    const latestVersion = await this.versionRepository.findOne({
      where: { formId },
      order: { version: 'DESC' },
    });

    const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

    // Get current form schema (fields + conditions)
    const fields = await this.fieldRepository.find({
      where: { formId },
      order: { orderIndex: 'ASC' },
    });

    const conditions = await this.conditionRepository.find({
      where: { formId },
      order: { orderIndex: 'ASC' },
    });

    const schemaSnapshot = {
      fields: fields.map((f) => ({
        id: f.id,
        key: f.key,
        title: f.title,
        subtitle: f.subtitle,
        helperText: f.helperText,
        required: f.required,
        type: f.type,
        defaultValue: f.defaultValue,
        validationRules: f.validationRules,
        pricingRules: f.pricingRules,
        config: f.config,
        orderIndex: f.orderIndex,
      })),
      conditions: conditions.map((c) => ({
        id: c.id,
        fieldId: c.fieldId,
        ifJson: c.ifJson,
        thenJson: c.thenJson,
        orderIndex: c.orderIndex,
      })),
    };

    const version = this.versionRepository.create({
      formId,
      version: newVersionNumber,
      status: PersonalizationFormVersionStatus.DRAFT,
      schemaSnapshot,
    });

    return await this.versionRepository.save(version);
  }

  async publishVersion(versionId: string): Promise<PersonalizationFormVersion> {
    const version = await this.versionRepository.findOne({
      where: { id: versionId },
      relations: ['form'],
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    if (version.status !== PersonalizationFormVersionStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT versions can be published');
    }

    // Archive previous published version
    const previousPublished = await this.versionRepository.findOne({
      where: {
        formId: version.formId,
        status: PersonalizationFormVersionStatus.PUBLISHED,
      },
    });

    if (previousPublished) {
      previousPublished.status = PersonalizationFormVersionStatus.ARCHIVED;
      await this.versionRepository.save(previousPublished);
    }

    // Publish new version
    version.status = PersonalizationFormVersionStatus.PUBLISHED;
    await this.versionRepository.save(version);

    // Update form's currentPublishedVersionId
    const form = await this.formRepository.findOne({
      where: { id: version.formId },
    });
    if (form) {
      form.currentPublishedVersionId = version.id;
      await this.formRepository.save(form);
    }

    return version;
  }

  async archiveVersion(versionId: string): Promise<PersonalizationFormVersion> {
    const version = await this.versionRepository.findOne({
      where: { id: versionId },
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    if (version.status === PersonalizationFormVersionStatus.PUBLISHED) {
      throw new BadRequestException('Cannot archive published version');
    }

    version.status = PersonalizationFormVersionStatus.ARCHIVED;
    return await this.versionRepository.save(version);
  }

  async getPublishedVersionForProduct(
    productId: string,
  ): Promise<PersonalizationFormVersion | null> {
    // Get product's personalization form
    const product = await this.dataSource
      .getRepository('Product')
      .findOne({ where: { id: productId } });

    if (!product || !product.personalizationFormId) {
      return null;
    }

    const form = await this.formRepository.findOne({
      where: { id: product.personalizationFormId },
      relations: ['currentPublishedVersion'],
    });

    if (!form || !form.currentPublishedVersion) {
      return null;
    }

    return form.currentPublishedVersion;
  }

  // ==================== FIELD CRUD ====================

  async getFields(formId: string): Promise<PersonalizationField[]> {
    return await this.fieldRepository.find({
      where: { formId },
      order: { orderIndex: 'ASC' },
    });
  }

  async createField(
    createDto: CreatePersonalizationFieldDto,
  ): Promise<PersonalizationField> {
    // Check if key already exists for this form
    const existing = await this.fieldRepository.findOne({
      where: { formId: createDto.formId, key: createDto.key },
    });

    if (existing) {
      throw new ConflictException(
        `Field with key "${createDto.key}" already exists for this form`,
      );
    }

    const field = this.fieldRepository.create(createDto);
    return await this.fieldRepository.save(field);
  }

  async updateField(
    id: string,
    updateDto: UpdatePersonalizationFieldDto,
  ): Promise<PersonalizationField> {
    const field = await this.fieldRepository.findOne({ where: { id } });

    if (!field) {
      throw new NotFoundException('Field not found');
    }

    // If key changed, check uniqueness
    if (updateDto.key && updateDto.key !== field.key) {
      const existing = await this.fieldRepository.findOne({
        where: { formId: field.formId, key: updateDto.key },
      });

      if (existing) {
        throw new ConflictException(
          `Field with key "${updateDto.key}" already exists for this form`,
        );
      }
    }

    Object.assign(field, updateDto);
    return await this.fieldRepository.save(field);
  }

  async removeField(id: string): Promise<void> {
    const field = await this.fieldRepository.findOne({ where: { id } });

    if (!field) {
      throw new NotFoundException('Field not found');
    }

    await this.fieldRepository.remove(field);
  }

  // ==================== CONDITION CRUD ====================

  async getConditions(formId: string): Promise<PersonalizationCondition[]> {
    return await this.conditionRepository.find({
      where: { formId },
      order: { orderIndex: 'ASC' },
    });
  }

  async createCondition(
    createDto: CreatePersonalizationConditionDto,
  ): Promise<PersonalizationCondition> {
    const condition = this.conditionRepository.create(createDto);
    return await this.conditionRepository.save(condition);
  }

  async updateCondition(
    id: string,
    updateDto: UpdatePersonalizationConditionDto,
  ): Promise<PersonalizationCondition> {
    const condition = await this.conditionRepository.findOne({
      where: { id },
    });

    if (!condition) {
      throw new NotFoundException('Condition not found');
    }

    Object.assign(condition, updateDto);
    return await this.conditionRepository.save(condition);
  }

  async removeCondition(id: string): Promise<void> {
    const condition = await this.conditionRepository.findOne({ where: { id } });

    if (!condition) {
      throw new NotFoundException('Condition not found');
    }

    await this.conditionRepository.remove(condition);
  }
}
