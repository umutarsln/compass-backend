import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { FolderService } from './folder.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { Folder } from './folder.entity';

@ApiTags('Folders')
@Controller('folders')
@ApiBearerAuth('JWT-auth')
export class FolderController {
  private readonly logger = new Logger(FolderController.name);

  constructor(private readonly folderService: FolderService) { }

  @Post()
  @ApiOperation({ summary: 'Yeni klasör oluştur' })
  @ApiBody({ type: CreateFolderDto })
  @ApiResponse({
    status: 201,
    description: 'Klasör başarıyla oluşturuldu',
    type: Folder,
  })
  @ApiResponse({ status: 404, description: 'Üst klasör bulunamadı' })
  async create(
    @Body() createFolderDto: CreateFolderDto,
    @Request() req: any,
  ): Promise<Folder> {
    const userId = req.user?.userId;
    return await this.folderService.create(createFolderDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Tüm klasörleri listele' })
  @ApiResponse({
    status: 200,
    description: 'Klasör listesi başarıyla döndürüldü',
    type: [Folder],
  })
  async findAll(): Promise<Folder[]> {
    return await this.folderService.findAll();
  }

  @Get('tree')
  @ApiOperation({ summary: 'Klasörleri tree yapısında listele' })
  @ApiResponse({
    status: 200,
    description: 'Klasör tree yapısı başarıyla döndürüldü',
    type: [Folder],
  })
  async findTree(): Promise<Folder[]> {
    return await this.folderService.findTree();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Klasör detayını getir' })
  @ApiResponse({
    status: 200,
    description: 'Klasör detayı başarıyla döndürüldü',
    type: Folder,
  })
  @ApiResponse({ status: 404, description: 'Klasör bulunamadı' })
  async findOne(@Param('id') id: string): Promise<Folder> {
    return await this.folderService.findOne(id);
  }

  @Get(':id/total-size')
  @ApiOperation({ summary: 'Klasör ve alt klasörlerindeki toplam dosya boyutunu hesapla (MB)' })
  @ApiResponse({
    status: 200,
    description: 'Toplam dosya boyutu başarıyla hesaplandı',
    schema: {
      type: 'object',
      properties: {
        totalSizeMB: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Klasör bulunamadı' })
  async getTotalSize(@Param('id') id: string): Promise<{ totalSizeMB: number }> {
    const totalSizeMB = await this.folderService.calculateTotalSize(id);
    return { totalSizeMB };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Klasör bilgilerini güncelle' })
  @ApiBody({ type: UpdateFolderDto })
  @ApiResponse({
    status: 200,
    description: 'Klasör başarıyla güncellendi',
    type: Folder,
  })
  @ApiResponse({ status: 404, description: 'Klasör bulunamadı' })
  @ApiResponse({ status: 400, description: 'Geçersiz işlem' })
  async update(
    @Param('id') id: string,
    @Body() updateFolderDto: UpdateFolderDto,
    @Request() req: any,
  ): Promise<Folder> {
    const userId = req.user?.userId || 'unknown';
    this.logger.log(
      `[PATCH /folders/:id] İstek alındı - Folder ID: ${id}, User ID: ${userId}`,
    );
    this.logger.debug(
      `[PATCH /folders/:id] Request Body: ${JSON.stringify(updateFolderDto)}`,
    );

    try {
      const result = await this.folderService.update(id, updateFolderDto);
      this.logger.log(
        `[PATCH /folders/:id] Başarılı - Folder ID: ${id}, Name: ${result.name}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[PATCH /folders/:id] Hata - Folder ID: ${id}, Error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Klasörü sil' })
  @ApiResponse({
    status: 200,
    description: 'Klasör başarıyla silindi',
  })
  @ApiResponse({ status: 404, description: 'Klasör bulunamadı' })
  @ApiResponse({
    status: 409,
    description: 'Klasörde dosya veya alt klasör var',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.folderService.remove(id);
    return { message: 'Klasör başarıyla silindi' };
  }

  @Delete(':id/recursive')
  @ApiOperation({
    summary: 'Klasörü ve içindeki tüm dosyaları recursive olarak sil',
  })
  @ApiResponse({
    status: 200,
    description: 'Klasör ve içindeki tüm dosyalar başarıyla silindi',
  })
  @ApiResponse({ status: 404, description: 'Klasör bulunamadı' })
  async removeRecursive(
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    await this.folderService.removeRecursive(id);
    return { message: 'Klasör ve içindeki tüm dosyalar başarıyla silindi' };
  }
}
