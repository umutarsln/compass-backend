import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PersonalizationFormVersionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  formId: string;

  @ApiProperty()
  version: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  schemaSnapshot: any;

  @ApiProperty()
  createdAt: Date;
}

export class PersonalizationFieldResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  formId: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  subtitle?: string | null;

  @ApiPropertyOptional()
  helperText?: string | null;

  @ApiProperty()
  required: boolean;

  @ApiProperty()
  type: string;

  @ApiPropertyOptional()
  defaultValue?: any;

  @ApiPropertyOptional()
  validationRules?: any;

  @ApiPropertyOptional()
  pricingRules?: any;

  @ApiPropertyOptional()
  config?: any;

  @ApiProperty()
  orderIndex: number;
}

export class PersonalizationConditionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  formId: string;

  @ApiPropertyOptional()
  fieldId?: string | null;

  @ApiProperty()
  ifJson: any;

  @ApiProperty()
  thenJson: any;

  @ApiProperty()
  orderIndex: number;
}

export class PersonalizationFormResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  subtitle?: string | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  currentPublishedVersionId?: string | null;

  @ApiPropertyOptional({ type: PersonalizationFormVersionResponseDto })
  currentPublishedVersion?: PersonalizationFormVersionResponseDto | null;

  @ApiPropertyOptional({ type: [PersonalizationFormVersionResponseDto] })
  versions?: PersonalizationFormVersionResponseDto[];

  @ApiPropertyOptional({ type: [PersonalizationFieldResponseDto] })
  fields?: PersonalizationFieldResponseDto[];

  @ApiPropertyOptional({ type: [PersonalizationConditionResponseDto] })
  conditions?: PersonalizationConditionResponseDto[];
}
