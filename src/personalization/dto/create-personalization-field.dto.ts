import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PersonalizationFieldType } from '../../common/enums/personalization-field-type.enum';

export class CreatePersonalizationFieldDto {
  @ApiProperty({
    description: 'Form ID',
    example: 'uuid',
  })
  @IsUUID()
  formId: string;

  @ApiProperty({
    description: 'Field key (unique per form)',
    example: 'customer_name',
  })
  @IsString()
  key: string;

  @ApiProperty({
    description: 'Field title',
    example: 'Müşteri Adı',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Field subtitle',
    example: 'Lambanızda görünecek isim',
  })
  @IsOptional()
  @IsString()
  subtitle?: string | null;

  @ApiPropertyOptional({
    description: 'Helper text',
    example: 'En fazla 50 karakter',
  })
  @IsOptional()
  @IsString()
  helperText?: string | null;

  @ApiPropertyOptional({
    description: 'Is field required',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiProperty({
    description: 'Field type',
    enum: PersonalizationFieldType,
    example: PersonalizationFieldType.TEXT,
  })
  @IsEnum(PersonalizationFieldType)
  type: PersonalizationFieldType;

  @ApiPropertyOptional({
    description: 'Default value (JSON)',
    example: null,
  })
  @IsOptional()
  @IsObject()
  defaultValue?: any;

  @ApiPropertyOptional({
    description: 'Validation rules (JSON)',
    example: { minLength: 3, maxLength: 50 },
  })
  @IsOptional()
  @IsObject()
  validationRules?: any;

  @ApiPropertyOptional({
    description: 'Pricing rules (JSON)',
    example: { type: 'FLAT_IF_FILLED', amount: 50 },
  })
  @IsOptional()
  @IsObject()
  pricingRules?: any;

  @ApiPropertyOptional({
    description: 'Field-specific configuration (JSON)',
    example: { options: ['option1', 'option2'] },
  })
  @IsOptional()
  @IsObject()
  config?: any;

  @ApiPropertyOptional({
    description: 'Display order',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}
