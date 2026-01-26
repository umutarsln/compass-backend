import {
    Controller,
    Get,
    Query,
    Param,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiQuery,
    ApiParam,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { StoreService } from './store.service';
import { StoreProductQueryDto } from './dto/store-product-query.dto';
import { StoreProductListResponseDto } from './dto/store-product-response.dto';
import { StoreProductDetailResponseDto } from './dto/store-product-detail-response.dto';
import { Category } from '../category/category.entity';
import { Tag } from '../tag/tag.entity';

@ApiTags('Store')
@Controller('store')
export class StoreController {
    constructor(private readonly storeService: StoreService) { }

    @Get('products')
    @ApiOperation({
        summary: 'Mağaza için ürünleri getir',
        description: 'Basit ürünler ve varyasyonlu ürünlerin aktif kombinasyonları ayrı ürünler olarak döner. Search, kategori, tag, fiyat aralığı filtreleri ve sıralama desteklenir.'
    })
    @ApiResponse({
        status: 200,
        description: 'Ürün listesi başarıyla döndürüldü',
        type: StoreProductListResponseDto,
    })
    async getProducts(@Query() query: StoreProductQueryDto): Promise<StoreProductListResponseDto> {
        return await this.storeService.getProducts(query);
    }

    @Get('products/:id')
    @ApiOperation({
        summary: 'Ürün detayını getir',
        description: 'Basit ürünler için direkt detay, varyasyonlu ürünler için varyasyon seçenekleri ve kombinasyonlar döner. variantCombinationId query param ile belirli bir kombinasyon seçilebilir. id parametresi UUID veya slug olabilir.'
    })
    @ApiParam({ name: 'id', description: 'Ürün ID (UUID) veya slug' })
    @ApiResponse({
        status: 200,
        description: 'Ürün detayı başarıyla döndürüldü',
        type: StoreProductDetailResponseDto,
    })
    @ApiResponse({
        status: 404,
        description: 'Ürün bulunamadı',
    })
    async getProductDetail(
        @Param('id') productId: string,
    ): Promise<StoreProductDetailResponseDto> {
        return await this.storeService.getProductDetail(productId);
    }

    @Get('categories')
    @ApiOperation({
        summary: 'Kategorileri hiyerarşik ve orderlanmış şekilde getir',
        description: 'Aktif kategorileri hiyerarşik tree yapısında ve displayOrder değerine göre sıralanmış şekilde döner.'
    })
    @ApiResponse({
        status: 200,
        description: 'Kategori listesi başarıyla döndürüldü',
        type: [Category],
    })
    async getCategories(): Promise<Category[]> {
        return await this.storeService.getCategories();
    }

    @Get('tags')
    @ApiOperation({
        summary: 'Tag\'leri renkleriyle birlikte getir',
        description: 'Tüm tag\'leri renk bilgileriyle birlikte döner.'
    })
    @ApiResponse({
        status: 200,
        description: 'Tag listesi başarıyla döndürüldü',
        type: [Tag],
    })
    async getTags(): Promise<Tag[]> {
        return await this.storeService.getTags();
    }
}
