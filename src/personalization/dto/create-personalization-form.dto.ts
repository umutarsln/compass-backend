import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePersonalizationFormDto {
  @ApiProperty({
    description: 'Form title',
    example: 'Kişiye Özel Lamba Formu',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Form subtitle',
    example: 'Lambanızı kişiselleştirin',
  })
  @IsOptional()
  @IsString()
  subtitle?: string | null;

  @ApiPropertyOptional({
    description: 'Form description',
    example: 'Bu form ile lambanızı tamamen kişiselleştirebilirsiniz',
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Is form active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
