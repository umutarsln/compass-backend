import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { StoreProductService } from './store-product.service';
import { StoreProductQueryDto } from './dto/store-product-query.dto';
import { StoreProductListResponseDto } from './dto/store-product-response.dto';

@ApiTags('Store - Products')
@Controller('store/products')
export class StoreProductController {
  constructor(private readonly storeProductService: StoreProductService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Mağaza için ürünleri getir',
    description: 'Basit ürünler ve varyasyonlu ürünlerin aktif kombinasyonları ayrı ürünler olarak döner. Search, kategori, tag, fiyat aralığı filtreleri ve sıralama desteklenir.'
  })
  @ApiResponse({
    status: 200,
    description: 'Ürün listesi başarıyla döndürüldü',
    type: StoreProductListResponseDto,
  })
  async getAll(@Query() query: StoreProductQueryDto): Promise<StoreProductListResponseDto> {
    return await this.storeProductService.getAll(query);
  }
}
