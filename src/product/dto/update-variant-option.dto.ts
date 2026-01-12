import { PartialType } from '@nestjs/swagger';
import { CreateVariantOptionDto } from './create-variant-option.dto';

export class UpdateVariantOptionDto extends PartialType(CreateVariantOptionDto) {}
