import { PartialType } from '@nestjs/swagger';
import { CreateVariantValueDto } from './create-variant-value.dto';

export class UpdateVariantValueDto extends PartialType(CreateVariantValueDto) {}
