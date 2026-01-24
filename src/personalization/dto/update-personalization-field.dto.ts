import { PartialType } from '@nestjs/swagger';
import { CreatePersonalizationFieldDto } from './create-personalization-field.dto';

export class UpdatePersonalizationFieldDto extends PartialType(
  CreatePersonalizationFieldDto,
) {}
