import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class UpdateFolderDto {
  @ApiProperty({
    description: 'Klasör adı',
    example: 'Güncellenmiş Klasör Adı',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Klasör açıklaması',
    example: 'Güncellenmiş açıklama',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Üst klasör ID (null ise ana dizine taşınır)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.parentId !== null && o.parentId !== undefined)
  @IsUUID()
  parentId?: string | null;
}
