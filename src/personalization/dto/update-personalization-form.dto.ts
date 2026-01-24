import { PartialType } from '@nestjs/swagger';
import { CreatePersonalizationFormDto } from './create-personalization-form.dto';

export class UpdatePersonalizationFormDto extends PartialType(
  CreatePersonalizationFormDto,
) {}
