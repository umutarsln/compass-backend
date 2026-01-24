import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  IsObject,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePersonalizationConditionDto {
  @ApiProperty({
    description: 'Form ID',
    example: 'uuid',
  })
  @IsUUID()
  formId: string;

  @ApiPropertyOptional({
    description: 'Field ID (null for form-level condition)',
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  fieldId?: string | null;

  @ApiProperty({
    description: 'Condition if clause (JSON)',
    example: { fieldKey: 'style', operator: 'eq', value: 'premium' },
  })
  @IsObject()
  ifJson: any;

  @ApiProperty({
    description: 'Condition then clause (JSON)',
    example: { action: 'SHOW', targetFieldKeys: ['note'] },
  })
  @IsObject()
  thenJson: any;

  @ApiPropertyOptional({
    description: 'Display order',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}
