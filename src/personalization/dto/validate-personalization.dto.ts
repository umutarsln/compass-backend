import { IsUUID, IsOptional, IsObject, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidatePersonalizationDto {
  @ApiProperty({
    description: 'Product ID',
    example: 'uuid',
  })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    description: 'Variant combination ID (for variant products)',
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({
    description: 'Form values (key-value pairs)',
    example: { customer_name: 'John Doe', style: 'premium' },
  })
  @IsObject()
  formValues: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Uploaded file IDs',
    example: ['uuid1', 'uuid2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  fileIds?: string[];
}
