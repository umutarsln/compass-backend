import { PartialType } from '@nestjs/swagger';
import { CreateProductGalleryDto } from './create-product-gallery.dto';

export class UpdateProductGalleryDto extends PartialType(
  CreateProductGalleryDto,
) {}
