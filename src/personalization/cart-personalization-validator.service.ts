import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PersonalizationFormVersion } from './personalization-form-version.entity';
import { Upload } from '../upload/upload.entity';
import { UploadOwnerType } from '../common/enums/upload-owner-type.enum';
import { PersonalizationConditionAction } from '../common/enums/personalization-condition-action.enum';
import { PersonalizationConditionOperator } from '../common/enums/personalization-condition-operator.enum';

@Injectable()
export class CartPersonalizationValidatorService {
  constructor(
    @InjectRepository(PersonalizationFormVersion)
    private versionRepository: Repository<PersonalizationFormVersion>,
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    private dataSource: DataSource,
  ) {}

  async validate(
    productId: string,
    variantId: string | null | undefined,
    formValues: Record<string, any>,
    fileIds: string[] | undefined,
    userId: string | null,
    guestId: string | null,
  ): Promise<void> {
    // Get product's published form version
    const product = await this.dataSource
      .getRepository('Product')
      .findOne({ where: { id: productId } });

    if (!product || !product.personalizationFormId) {
      throw new BadRequestException('Product does not have a personalization form');
    }

    const form = await this.dataSource
      .getRepository('PersonalizationForm')
      .findOne({
        where: { id: product.personalizationFormId },
        relations: ['currentPublishedVersion'],
      });

    if (!form || !form.currentPublishedVersion) {
      throw new NotFoundException('Published form version not found');
    }

    const version = form.currentPublishedVersion;
    const schema = version.schemaSnapshot;

    if (!schema || !schema.fields) {
      throw new BadRequestException('Invalid form schema');
    }

    // Evaluate conditions to determine visible/required fields
    const visibleFields = this.evaluateConditions(
      schema.fields,
      schema.conditions || [],
      formValues,
    );

    // Validate required fields
    const requiredFields = visibleFields.filter((f) => f.required);
    for (const field of requiredFields) {
      const value = formValues[field.key];
      if (value === undefined || value === null || value === '') {
        throw new BadRequestException(
          `Required field "${field.title}" (${field.key}) is missing`,
        );
      }
    }

    // Validate field values based on type and validation rules
    for (const field of visibleFields) {
      const value = formValues[field.key];
      if (value !== undefined && value !== null && value !== '') {
        this.validateFieldValue(field, value);
      }
    }

    // Validate file uploads
    if (fileIds && fileIds.length > 0) {
      await this.validateFileUploads(
        fileIds,
        schema.fields,
        formValues,
        userId,
        guestId,
      );
    }
  }

  private evaluateConditions(
    fields: any[],
    conditions: any[],
    formValues: Record<string, any>,
  ): any[] {
    // Start with all fields
    let visibleFields = [...fields];
    const requiredFields = new Set<string>();

    // Evaluate each condition
    for (const condition of conditions) {
      const ifClause = condition.ifJson;
      const thenClause = condition.thenJson;

      if (!ifClause || !thenClause) continue;

      const conditionMet = this.evaluateIfClause(ifClause, formValues);

      if (conditionMet) {
        const action = thenClause.action;
        const targetKeys = thenClause.targetFieldKeys || [];

        for (const targetKey of targetKeys) {
          const targetField = visibleFields.find((f) => f.key === targetKey);
          if (!targetField) continue;

          if (action === PersonalizationConditionAction.SHOW) {
            // Field is visible (already in visibleFields)
          } else if (action === PersonalizationConditionAction.HIDE) {
            // Remove from visible fields
            visibleFields = visibleFields.filter((f) => f.key !== targetKey);
            requiredFields.delete(targetKey);
          } else if (action === PersonalizationConditionAction.REQUIRE) {
            // Mark as required
            requiredFields.add(targetKey);
            targetField.required = true;
          }
        }
      }
    }

    // Update required status
    visibleFields.forEach((field) => {
      if (requiredFields.has(field.key)) {
        field.required = true;
      }
    });

    return visibleFields;
  }

  private evaluateIfClause(
    ifClause: any,
    formValues: Record<string, any>,
  ): boolean {
    const { fieldKey, operator, value } = ifClause;

    if (!fieldKey || !operator) {
      return false;
    }

    const fieldValue = formValues[fieldKey];

    switch (operator) {
      case PersonalizationConditionOperator.EQ:
        return fieldValue === value;
      case PersonalizationConditionOperator.NEQ:
        return fieldValue !== value;
      case PersonalizationConditionOperator.IN:
        return Array.isArray(value) && value.includes(fieldValue);
      case PersonalizationConditionOperator.FILLED:
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
      case PersonalizationConditionOperator.CONTAINS:
        return (
          typeof fieldValue === 'string' &&
          typeof value === 'string' &&
          fieldValue.includes(value)
        );
      default:
        return false;
    }
  }

  private validateFieldValue(field: any, value: any): void {
    const validationRules = field.validationRules || {};

    // Type-specific validation
    switch (field.type) {
      case 'NUMBER':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          throw new BadRequestException(
            `Field "${field.title}" must be a number`,
          );
        }
        const numValue = Number(value);
        if (validationRules.min !== undefined && numValue < validationRules.min) {
          throw new BadRequestException(
            `Field "${field.title}" must be at least ${validationRules.min}`,
          );
        }
        if (validationRules.max !== undefined && numValue > validationRules.max) {
          throw new BadRequestException(
            `Field "${field.title}" must be at most ${validationRules.max}`,
          );
        }
        break;

      case 'EMAIL':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          throw new BadRequestException(
            `Field "${field.title}" must be a valid email`,
          );
        }
        break;

      case 'PHONE':
        // Basic phone validation
        if (typeof value !== 'string' || value.length < 10) {
          throw new BadRequestException(
            `Field "${field.title}" must be a valid phone number`,
          );
        }
        break;

      case 'SELECT':
      case 'RADIO':
        const options = field.config?.options || [];
        if (!options.includes(value)) {
          throw new BadRequestException(
            `Field "${field.title}" has invalid option`,
          );
        }
        break;

      case 'MULTISELECT':
      case 'CHECKBOX':
        if (!Array.isArray(value)) {
          throw new BadRequestException(
            `Field "${field.title}" must be an array`,
          );
        }
        const multiOptions = field.config?.options || [];
        for (const v of value) {
          if (!multiOptions.includes(v)) {
            throw new BadRequestException(
              `Field "${field.title}" has invalid option: ${v}`,
            );
          }
        }
        break;

      case 'TEXT':
      case 'TEXTAREA':
        if (typeof value !== 'string') {
          throw new BadRequestException(
            `Field "${field.title}" must be a string`,
          );
        }
        if (validationRules.minLength && value.length < validationRules.minLength) {
          throw new BadRequestException(
            `Field "${field.title}" must be at least ${validationRules.minLength} characters`,
          );
        }
        if (validationRules.maxLength && value.length > validationRules.maxLength) {
          throw new BadRequestException(
            `Field "${field.title}" must be at most ${validationRules.maxLength} characters`,
          );
        }
        break;
    }
  }

  private async validateFileUploads(
    fileIds: string[],
    fields: any[],
    formValues: Record<string, any>,
    userId: string | null,
    guestId: string | null,
  ): Promise<void> {
    // Get file upload fields
    const fileFields = fields.filter(
      (f) =>
        f.type === 'FILE_UPLOAD_SINGLE' ||
        f.type === 'FILE_UPLOAD_MULTI' ||
        f.type === 'IMAGE_PICKER_SINGLE' ||
        f.type === 'IMAGE_PICKER_MULTI',
    );

    for (const field of fileFields) {
      const fieldValue = formValues[field.key];

      if (!fieldValue) continue;

      const fieldFileIds = Array.isArray(fieldValue) ? fieldValue : [fieldValue];

      // Validate file count
      if (field.type === 'FILE_UPLOAD_SINGLE' || field.type === 'IMAGE_PICKER_SINGLE') {
        if (fieldFileIds.length > 1) {
          throw new BadRequestException(
            `Field "${field.title}" accepts only one file`,
          );
        }
      }

      // Validate file count for multiple file uploads
      if (field.type === 'FILE_UPLOAD_MULTI' || field.type === 'IMAGE_PICKER_MULTI') {
        const fileCount = fieldFileIds.length;
        const minFileCount = field.config?.minFileCount;
        const maxFileCount = field.config?.maxFileCount;

        if (minFileCount !== undefined && fileCount < minFileCount) {
          throw new BadRequestException(
            `Field "${field.title}" requires at least ${minFileCount} file(s), but ${fileCount} provided`,
          );
        }

        if (maxFileCount !== undefined && fileCount > maxFileCount) {
          throw new BadRequestException(
            `Field "${field.title}" accepts at most ${maxFileCount} file(s), but ${fileCount} provided`,
          );
        }
      }

      // Validate file ownership
      for (const fileId of fieldFileIds) {
        const upload = await this.uploadRepository.findOne({
          where: { id: fileId },
        });

        if (!upload) {
          throw new NotFoundException(`File ${fileId} not found`);
        }

        // Check ownership
        // USER tipindeki dosyalar için sahiplik kontrolü yap
        if (upload.ownerType === UploadOwnerType.USER) {
          if (!userId || upload.ownerId !== userId) {
            throw new BadRequestException(
              `File ${fileId} does not belong to the current user`,
            );
          }
        }
        // GUEST tipindeki dosyalar için sahiplik kontrolü yapma
        // Guest dosyalar herkese açık olabilir (kişiselleştirme formları için)
        // ownerId sadece takip amaçlı, erişim kontrolü için değil

        // Validate file type if specified in field config
        if (field.config?.allowedMimeTypes) {
          const allowedTypes = field.config.allowedMimeTypes;
          if (!allowedTypes.includes(upload.mimeType)) {
            throw new BadRequestException(
              `File ${fileId} has invalid type. Allowed: ${allowedTypes.join(', ')}`,
            );
          }
        }
      }
    }
  }
}
