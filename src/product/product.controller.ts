import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  Query,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductGalleryDto } from './dto/create-product-gallery.dto';
import { UpdateProductGalleryDto } from './dto/update-product-gallery.dto';
import { CreateVariantOptionDto } from './dto/create-variant-option.dto';
import { UpdateVariantOptionDto } from './dto/update-variant-option.dto';
import { CreateVariantValueDto } from './dto/create-variant-value.dto';
import { UpdateVariantValueDto } from './dto/update-variant-value.dto';
import { Product } from './product.entity';
import { ProductGallery } from './product-gallery.entity';
import { VariantOption } from './variant-option.entity';
import { VariantValue } from './variant-value.entity';
import { VariantCombination } from './variant-combination.entity';
import { CreateVariantCombinationDto } from './dto/create-variant-combination.dto';
import { UpdateVariantCombinationDto } from './dto/update-variant-combination.dto';

@ApiTags('Products')
@Controller('products')
@ApiBearerAuth('JWT-auth')
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  @Post()
  @ApiOperation({ summary: 'Yeni ürün oluştur' })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({
    status: 201,
    description: 'Ürün başarıyla oluşturuldu',
    type: Product,
  })
  @ApiResponse({ status: 409, description: 'SKU zaten kullanılıyor' })
  async create(
    @Body() createProductDto: CreateProductDto,
    @Request() req: any,
  ): Promise<Product> {
    const userId = req.user?.userId;
    return await this.productService.create(createProductDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Tüm ürünleri listele' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Ürün tipi filtresi',
    enum: ['SIMPLE', 'VARIANT', 'BUNDLE'],
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Kategori ID filtresi',
  })
  @ApiResponse({
    status: 200,
    description: 'Ürün listesi başarıyla döndürüldü',
    type: [Product],
  })
  async findAll(
    @Query('type') type?: string,
    @Query('categoryId') categoryId?: string,
  ): Promise<Product[]> {
    return await this.productService.findAll();
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Slug ile ürün detayını getir' })
  @ApiResponse({
    status: 200,
    description: 'Ürün detayı başarıyla döndürüldü',
    type: Product,
  })
  @ApiResponse({ status: 404, description: 'Ürün bulunamadı' })
  async findBySlug(@Param('slug') slug: string): Promise<Product> {
    return await this.productService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ürün detayını getir' })
  @ApiResponse({
    status: 200,
    description: 'Ürün detayı başarıyla döndürüldü',
    type: Product,
  })
  @ApiResponse({ status: 404, description: 'Ürün bulunamadı' })
  async findOne(@Param('id') id: string): Promise<Product> {
    return await this.productService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ürün bilgilerini güncelle' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({
    status: 200,
    description: 'Ürün başarıyla güncellendi',
    type: Product,
  })
  @ApiResponse({ status: 404, description: 'Ürün bulunamadı' })
  @ApiResponse({ status: 409, description: 'SKU zaten kullanılıyor' })
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    return await this.productService.update(id, updateProductDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Ürünü sil' })
  @ApiResponse({
    status: 200,
    description: 'Ürün başarıyla silindi',
  })
  @ApiResponse({ status: 404, description: 'Ürün bulunamadı' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.productService.remove(id);
    return { message: 'Ürün başarıyla silindi' };
  }

  // ==================== ProductGallery Endpoints ====================

  @Post(':productId/gallery')
  @ApiOperation({ summary: 'Basit ürün için ProductGallery oluştur' })
  @ApiBody({ type: CreateProductGalleryDto })
  @ApiResponse({
    status: 201,
    description: 'ProductGallery başarıyla oluşturuldu',
    type: ProductGallery,
  })
  @ApiResponse({ status: 404, description: 'Ürün bulunamadı' })
  @ApiResponse({ status: 409, description: 'Bu ürün için zaten bir ProductGallery mevcut' })
  async createProductGallery(
    @Param('productId') productId: string,
    @Body() createProductGalleryDto: CreateProductGalleryDto,
  ): Promise<ProductGallery> {
    // productId'yi DTO'ya ekle
    createProductGalleryDto.productId = productId;
    return await this.productService.createProductGallery(createProductGalleryDto);
  }

  @Post('variants/:variantCombinationId/gallery')
  @ApiOperation({ summary: 'Varyasyon kombinasyonu için ProductGallery oluştur' })
  @ApiBody({ type: CreateProductGalleryDto })
  @ApiResponse({
    status: 201,
    description: 'ProductGallery başarıyla oluşturuldu',
    type: ProductGallery,
  })
  @ApiResponse({ status: 404, description: 'Varyasyon kombinasyonu bulunamadı' })
  @ApiResponse({ status: 409, description: 'Bu varyasyon kombinasyonu için zaten bir ProductGallery mevcut' })
  async createVariantCombinationGallery(
    @Param('variantCombinationId') variantCombinationId: string,
    @Body() createProductGalleryDto: CreateProductGalleryDto,
  ): Promise<ProductGallery> {
    // variantCombinationId'yi DTO'ya ekle
    createProductGalleryDto.variantCombinationId = variantCombinationId;
    return await this.productService.createProductGallery(createProductGalleryDto);
  }

  @Get(':productId/gallery')
  @ApiOperation({ summary: 'Ürünün ProductGallery\'sini getir (SIMPLE ürünler için tek gallery)' })
  @ApiResponse({
    status: 200,
    description: 'ProductGallery başarıyla döndürüldü',
    type: ProductGallery,
  })
  @ApiResponse({ status: 404, description: 'Ürün veya ProductGallery bulunamadı' })
  async getProductGalleryByProduct(
    @Param('productId') productId: string,
  ): Promise<ProductGallery> {
    const gallery = await this.productService.findProductGalleryByProduct(productId);
    if (!gallery) {
      throw new NotFoundException('ProductGallery bulunamadı');
    }
    return gallery;
  }

  @Get('variants/:variantCombinationId/gallery')
  @ApiOperation({ summary: 'Varyasyon kombinasyonunun ProductGallery\'sini getir' })
  @ApiResponse({
    status: 200,
    description: 'ProductGallery başarıyla döndürüldü',
    type: ProductGallery,
  })
  @ApiResponse({ status: 404, description: 'Varyasyon kombinasyonu veya ProductGallery bulunamadı' })
  async getProductGalleryByVariantCombination(
    @Param('variantCombinationId') variantCombinationId: string,
  ): Promise<ProductGallery> {
    const gallery = await this.productService.findProductGalleryByVariantCombination(variantCombinationId);
    if (!gallery) {
      throw new NotFoundException('ProductGallery bulunamadı');
    }
    return gallery;
  }

  @Get('gallery/:galleryId')
  @ApiOperation({ summary: 'ProductGallery detayını getir' })
  @ApiResponse({
    status: 200,
    description: 'ProductGallery detayı başarıyla döndürüldü',
    type: ProductGallery,
  })
  @ApiResponse({ status: 404, description: 'ProductGallery bulunamadı' })
  async getProductGallery(
    @Param('galleryId') galleryId: string,
  ): Promise<ProductGallery> {
    return await this.productService.findProductGallery(galleryId);
  }

  @Patch('gallery/:galleryId')
  @ApiOperation({ summary: 'ProductGallery bilgilerini güncelle' })
  @ApiBody({ type: UpdateProductGalleryDto })
  @ApiResponse({
    status: 200,
    description: 'ProductGallery başarıyla güncellendi',
    type: ProductGallery,
  })
  @ApiResponse({ status: 404, description: 'ProductGallery bulunamadı' })
  @ApiResponse({ status: 409, description: 'Çakışma hatası' })
  async updateProductGallery(
    @Param('galleryId') galleryId: string,
    @Body() updateProductGalleryDto: UpdateProductGalleryDto,
  ): Promise<ProductGallery> {
    return await this.productService.updateProductGallery(
      galleryId,
      updateProductGalleryDto,
    );
  }

  @Delete('gallery/:galleryId')
  @ApiOperation({ summary: 'ProductGallery\'yi sil' })
  @ApiResponse({
    status: 200,
    description: 'ProductGallery başarıyla silindi',
  })
  @ApiResponse({ status: 404, description: 'ProductGallery bulunamadı' })
  async removeProductGallery(
    @Param('galleryId') galleryId: string,
  ): Promise<{ message: string }> {
    await this.productService.removeProductGallery(galleryId);
    return { message: 'ProductGallery başarıyla silindi' };
  }

  @Post('reset')
  @ApiOperation({
    summary: 'Tüm ürün verilerini temizle (RESET)',
    description: 'Tüm ürünleri, varyasyonları, stok bilgilerini ve product gallery\'leri siler. Users, Categories, Tags ve Uploads\'a dokunmaz. DİKKAT: Bu işlem geri alınamaz!',
  })
  @ApiResponse({
    status: 200,
    description: 'Tüm ürün verileri başarıyla temizlendi',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        deleted: {
          type: 'object',
          properties: {
            deletedProducts: { type: 'number' },
            deletedVariantCombinations: { type: 'number' },
            deletedVariantOptions: { type: 'number' },
            deletedVariantValues: { type: 'number' },
            deletedProductGalleries: { type: 'number' },
            deletedStocks: { type: 'number' },
            deletedBundleItems: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Sunucu hatası' })
  async resetAllProducts(): Promise<{
    message: string;
    deleted: {
      deletedProducts: number;
      deletedVariantCombinations: number;
      deletedVariantOptions: number;
      deletedVariantValues: number;
      deletedProductGalleries: number;
      deletedStocks: number;
      deletedBundleItems: number;
    };
  }> {
    const deleted = await this.productService.resetAllProducts();
    return {
      message: 'Tüm ürün verileri başarıyla temizlendi',
      deleted,
    };
  }

  // ==================== VARIANT OPTION ENDPOINTS ====================

  @Post(':productId/variant-options')
  @ApiOperation({ summary: 'Varyasyon seçeneği oluştur' })
  @ApiBody({ type: CreateVariantOptionDto })
  @ApiResponse({
    status: 201,
    description: 'Varyasyon seçeneği başarıyla oluşturuldu',
    type: VariantOption,
  })
  async createVariantOption(
    @Param('productId') productId: string,
    @Body() createVariantOptionDto: CreateVariantOptionDto,
  ): Promise<VariantOption> {
    return await this.productService.createVariantOption(
      productId,
      createVariantOptionDto,
    );
  }

  @Get(':productId/variant-options')
  @ApiOperation({ summary: 'Ürünün varyasyon seçeneklerini getir' })
  @ApiResponse({
    status: 200,
    description: 'Varyasyon seçenekleri başarıyla döndürüldü',
    type: [VariantOption],
  })
  async getVariantOptionsByProduct(
    @Param('productId') productId: string,
  ): Promise<VariantOption[]> {
    return await this.productService.getVariantOptionsByProduct(productId);
  }

  @Patch('variant-options/:id')
  @ApiOperation({ summary: 'Varyasyon seçeneğini güncelle' })
  @ApiBody({ type: UpdateVariantOptionDto })
  @ApiResponse({
    status: 200,
    description: 'Varyasyon seçeneği başarıyla güncellendi',
    type: VariantOption,
  })
  async updateVariantOption(
    @Param('id') id: string,
    @Body() updateVariantOptionDto: UpdateVariantOptionDto,
  ): Promise<VariantOption> {
    return await this.productService.updateVariantOption(id, updateVariantOptionDto);
  }

  @Delete('variant-options/:id')
  @ApiOperation({ summary: 'Varyasyon seçeneğini sil' })
  @ApiResponse({ status: 200, description: 'Varyasyon seçeneği başarıyla silindi' })
  async deleteVariantOption(@Param('id') id: string): Promise<{ message: string }> {
    await this.productService.deleteVariantOption(id);
    return { message: 'Varyasyon seçeneği başarıyla silindi' };
  }

  // ==================== VARIANT VALUE ENDPOINTS ====================

  @Post('variant-options/:variantOptionId/variant-values')
  @ApiOperation({ summary: 'Varyasyon değeri oluştur' })
  @ApiBody({ type: CreateVariantValueDto })
  @ApiResponse({
    status: 201,
    description: 'Varyasyon değeri başarıyla oluşturuldu',
    type: VariantValue,
  })
  async createVariantValue(
    @Param('variantOptionId') variantOptionId: string,
    @Body() createVariantValueDto: CreateVariantValueDto,
  ): Promise<VariantValue> {
    return await this.productService.createVariantValue(
      variantOptionId,
      createVariantValueDto,
    );
  }

  @Get('variant-options/:variantOptionId/variant-values')
  @ApiOperation({ summary: 'Varyasyon seçeneğinin değerlerini getir' })
  @ApiResponse({
    status: 200,
    description: 'Varyasyon değerleri başarıyla döndürüldü',
    type: [VariantValue],
  })
  async getVariantValuesByOption(
    @Param('variantOptionId') variantOptionId: string,
  ): Promise<VariantValue[]> {
    return await this.productService.getVariantValuesByOption(variantOptionId);
  }

  @Patch('variant-values/:id')
  @ApiOperation({ summary: 'Varyasyon değerini güncelle' })
  @ApiBody({ type: UpdateVariantValueDto })
  @ApiResponse({
    status: 200,
    description: 'Varyasyon değeri başarıyla güncellendi',
    type: VariantValue,
  })
  async updateVariantValue(
    @Param('id') id: string,
    @Body() updateVariantValueDto: UpdateVariantValueDto,
  ): Promise<VariantValue> {
    return await this.productService.updateVariantValue(id, updateVariantValueDto);
  }

  @Delete('variant-values/:id')
  @ApiOperation({ summary: 'Varyasyon değerini sil' })
  @ApiResponse({ status: 200, description: 'Varyasyon değeri başarıyla silindi' })
  async deleteVariantValue(@Param('id') id: string): Promise<{ message: string }> {
    await this.productService.deleteVariantValue(id);
    return { message: 'Varyasyon değeri başarıyla silindi' };
  }

  // ==================== VARIANT COMBINATION ENDPOINTS ====================

  @Post(':productId/variant-combinations/generate')
  @ApiOperation({ summary: 'Tüm varyasyon kombinasyonlarını otomatik oluştur' })
  @ApiResponse({
    status: 201,
    description: 'Varyasyon kombinasyonları başarıyla oluşturuldu',
    type: [VariantCombination],
  })
  async generateAllVariantCombinations(
    @Param('productId') productId: string,
  ): Promise<VariantCombination[]> {
    return await this.productService.generateAllVariantCombinations(productId);
  }

  @Get(':productId/variant-combinations')
  @ApiOperation({ summary: 'Ürünün varyasyon kombinasyonlarını getir' })
  @ApiResponse({
    status: 200,
    description: 'Varyasyon kombinasyonları başarıyla döndürüldü',
    type: [VariantCombination],
  })
  async getVariantCombinationsByProduct(
    @Param('productId') productId: string,
  ): Promise<VariantCombination[]> {
    return await this.productService.getVariantCombinationsByProduct(productId);
  }

  @Post(':productId/variant-combinations')
  @ApiOperation({ summary: 'Varyasyon kombinasyonu oluştur' })
  @ApiBody({ type: CreateVariantCombinationDto })
  @ApiResponse({
    status: 201,
    description: 'Varyasyon kombinasyonu başarıyla oluşturuldu',
    type: VariantCombination,
  })
  async createVariantCombination(
    @Param('productId') productId: string,
    @Body() createVariantCombinationDto: CreateVariantCombinationDto,
  ): Promise<VariantCombination> {
    return await this.productService.createVariantCombination(
      productId,
      createVariantCombinationDto,
    );
  }

  @Patch('variant-combinations/:id')
  @ApiOperation({ summary: 'Varyasyon kombinasyonunu güncelle' })
  @ApiBody({ type: UpdateVariantCombinationDto })
  @ApiResponse({
    status: 200,
    description: 'Varyasyon kombinasyonu başarıyla güncellendi',
    type: VariantCombination,
  })
  async updateVariantCombination(
    @Param('id') id: string,
    @Body() updateVariantCombinationDto: UpdateVariantCombinationDto,
  ): Promise<VariantCombination> {
    return await this.productService.updateVariantCombination(id, updateVariantCombinationDto);
  }

  @Get(':productId/variant-combinations/total-stock')
  @ApiOperation({ summary: 'Ürünün toplam stokunu hesapla (tüm kombinasyonların toplamı)' })
  @ApiResponse({
    status: 200,
    description: 'Toplam stok bilgisi başarıyla döndürüldü',
  })
  async getProductTotalStock(
    @Param('productId') productId: string,
  ): Promise<{
    totalAvailable: number;
    totalReserved: number;
    totalAvailableAfterReserve: number;
    combinations: Array<{
      combinationId: string;
      availableQuantity: number;
      reservedQuantity: number;
    }>;
  }> {
    return await this.productService.getProductTotalStock(productId);
  }

  // Not: Varyasyon kombinasyonları silinemez - çünkü bir kombinasyon yoksa sistem çalışmaz
}
