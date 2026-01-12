import { PartialType } from '@nestjs/swagger';
import { CreateVariantCombinationDto } from './create-variant-combination.dto';

export class UpdateVariantCombinationDto extends PartialType(CreateVariantCombinationDto) {}
