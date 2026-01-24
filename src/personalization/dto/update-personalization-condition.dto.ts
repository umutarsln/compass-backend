import { PartialType } from '@nestjs/swagger';
import { CreatePersonalizationConditionDto } from './create-personalization-condition.dto';

export class UpdatePersonalizationConditionDto extends PartialType(
  CreatePersonalizationConditionDto,
) {}
