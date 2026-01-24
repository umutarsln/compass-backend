import { IsNotEmpty, IsInt, Min, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateItemDto {
  @ApiProperty({
    description: 'New quantity',
    example: 2,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Personalization data (form values + fileIds) - optional, only for updating personalization',
    example: { formValues: { customer_name: 'John' }, fileIds: ['uuid1'] },
  })
  @IsOptional()
  @IsObject()
  personalization?: {
    formValues: Record<string, any>;
    fileIds?: string[];
  };
}
