import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { CreateUploadDto } from './dto/create-upload.dto';
import { UpdateUploadDto } from './dto/update-upload.dto';
import { Upload } from './upload.entity';

@ApiTags('Uploads')
@Controller('uploads')
@ApiBearerAuth('JWT-auth')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Dosya yükle' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Yüklenecek dosya',
        },
        displayName: {
          type: 'string',
          description: 'Görünen isim',
          example: 'Ürün Resmi 1',
        },
        folderId: {
          type: 'string',
          format: 'uuid',
          description: 'Hangi klasörde (root için boş bırakın)',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
        seoTitle: {
          type: 'string',
          description: 'SEO başlık',
          example: 'Ürün Resmi - SEO Başlık',
        },
        seoDescription: {
          type: 'string',
          description: 'SEO açıklama',
          example: 'Bu ürün resminin SEO açıklaması',
        },
        seoKeywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'SEO anahtar kelimeler',
          example: ['ürün', 'resim', 'e-ticaret'],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Dosya başarıyla yüklendi',
    type: Upload,
  })
  @ApiResponse({ status: 400, description: 'Geçersiz dosya veya boyut' })
  @ApiResponse({ status: 404, description: 'Klasör bulunamadı' })
  @ApiResponse({ status: 409, description: 'Dosya zaten yüklenmiş' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() createUploadDto: CreateUploadDto,
    @Request() req: any,
  ): Promise<Upload> {
    if (!file) {
      throw new BadRequestException('Dosya yüklenmedi');
    }

    const userId = req.user?.userId;
    return await this.uploadService.create(file, createUploadDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Tüm dosyaları listele' })
  @ApiResponse({
    status: 200,
    description: 'Dosya listesi başarıyla döndürüldü',
    type: [Upload],
  })
  async findAll(): Promise<Upload[]> {
    return await this.uploadService.findAll();
  }

  @Get('folder/:folderId')
  @ApiOperation({ summary: 'Klasördeki dosyaları listele' })
  @ApiResponse({
    status: 200,
    description: 'Klasördeki dosyalar başarıyla döndürüldü',
    type: [Upload],
  })
  async findByFolder(@Param('folderId') folderId: string): Promise<Upload[]> {
    return await this.uploadService.findByFolder(folderId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Dosya detayını getir' })
  @ApiResponse({
    status: 200,
    description: 'Dosya detayı başarıyla döndürüldü',
    type: Upload,
  })
  @ApiResponse({ status: 404, description: 'Dosya bulunamadı' })
  async findOne(@Param('id') id: string): Promise<Upload> {
    return await this.uploadService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Dosya indirme URL\'i al (presigned URL)' })
  @ApiResponse({
    status: 200,
    description: 'İndirme URL\'i başarıyla oluşturuldu',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: 'https://...' },
        expiresIn: { type: 'number', example: 3600 },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Dosya bulunamadı' })
  async getDownloadUrl(
    @Param('id') id: string,
  ): Promise<{ url: string; expiresIn: number }> {
    const expiresIn = 3600; // 1 saat
    const url = await this.uploadService.getDownloadUrl(id, expiresIn);
    return { url, expiresIn };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Dosya bilgilerini güncelle (SEO, isim vb.)' })
  @ApiBody({ type: UpdateUploadDto })
  @ApiResponse({
    status: 200,
    description: 'Dosya başarıyla güncellendi',
    type: Upload,
  })
  @ApiResponse({ status: 404, description: 'Dosya bulunamadı' })
  async update(
    @Param('id') id: string,
    @Body() updateUploadDto: UpdateUploadDto,
  ): Promise<Upload> {
    return await this.uploadService.update(id, updateUploadDto);
  }

  @Get(':id/relations')
  @ApiOperation({ summary: 'Dosyanın kullanıldığı relation\'ları kontrol et' })
  @ApiResponse({
    status: 200,
    description: 'Relation bilgileri başarıyla döndürüldü',
    schema: {
      type: 'object',
      properties: {
        hasRelations: { type: 'boolean' },
        relations: {
          type: 'object',
          properties: {
            productGalleries: { type: 'number' },
            categories: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Dosya bulunamadı' })
  async checkRelations(@Param('id') id: string): Promise<{
    hasRelations: boolean;
    relations: {
      productGalleries: number;
      categories: number;
    };
  }> {
    return await this.uploadService.checkRelations(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Dosyayı sil (S3\'ten de silinir)' })
  @ApiResponse({
    status: 200,
    description: 'Dosya başarıyla silindi',
  })
  @ApiResponse({ status: 404, description: 'Dosya bulunamadı' })
  @ApiResponse({ status: 409, description: 'Dosya kullanılıyor, silinemez' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    // Relation kontrolü
    const relations = await this.uploadService.checkRelations(id);
    if (relations.hasRelations) {
      throw new BadRequestException(
        'Bu dosya kullanılıyor ve silinemez. Önce ilgili ürün veya kategori ilişkilerini kaldırın.',
      );
    }

    await this.uploadService.remove(id);
    return { message: 'Dosya başarıyla silindi' };
  }
}
