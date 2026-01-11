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
import { Product } from './product.entity';

@ApiTags('Products')
@Controller('products')
@ApiBearerAuth('JWT-auth')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

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
}
