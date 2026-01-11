import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './category.entity';

@ApiTags('Categories')
@Controller('categories')
@ApiBearerAuth('JWT-auth')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiOperation({ summary: 'Yeni kategori oluştur' })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({
    status: 201,
    description: 'Kategori başarıyla oluşturuldu',
    type: Category,
  })
  @ApiResponse({ status: 404, description: 'Üst kategori bulunamadı' })
  async create(@Body() createCategoryDto: CreateCategoryDto): Promise<Category> {
    return await this.categoryService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Tüm kategorileri listele' })
  @ApiResponse({
    status: 200,
    description: 'Kategori listesi başarıyla döndürüldü',
    type: [Category],
  })
  async findAll(): Promise<Category[]> {
    return await this.categoryService.findAll();
  }

  @Get('tree')
  @ApiOperation({ summary: 'Kategorileri tree yapısında listele' })
  @ApiResponse({
    status: 200,
    description: 'Kategori tree yapısı başarıyla döndürüldü',
    type: [Category],
  })
  async findTree(): Promise<Category[]> {
    return await this.categoryService.findTree();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kategori detayını getir' })
  @ApiResponse({
    status: 200,
    description: 'Kategori detayı başarıyla döndürüldü',
    type: Category,
  })
  @ApiResponse({ status: 404, description: 'Kategori bulunamadı' })
  async findOne(@Param('id') id: string): Promise<Category> {
    return await this.categoryService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Kategori bilgilerini güncelle' })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiResponse({
    status: 200,
    description: 'Kategori başarıyla güncellendi',
    type: Category,
  })
  @ApiResponse({ status: 404, description: 'Kategori bulunamadı' })
  @ApiResponse({ status: 400, description: 'Geçersiz işlem' })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    return await this.categoryService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Kategoriyi sil' })
  @ApiResponse({
    status: 200,
    description: 'Kategori başarıyla silindi',
  })
  @ApiResponse({ status: 404, description: 'Kategori bulunamadı' })
  @ApiResponse({
    status: 409,
    description: 'Kategoride alt kategori var',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.categoryService.remove(id);
    return { message: 'Kategori başarıyla silindi' };
  }
}
