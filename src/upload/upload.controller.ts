import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  Headers,
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
import { Public } from '../common/decorators/public.decorator';
import { UploadOwnerType } from '../common/enums/upload-owner-type.enum';
import { Role } from '../common/enums/role.enum';

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
    const ownerType = req.user ? UploadOwnerType.USER : null;
    const ownerId = userId || null;
    return await this.uploadService.create(file, createUploadDto, userId, ownerType, ownerId);
  }

  @Post('guest')
  @Public()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Guest dosya yükle (public)' })
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
          description: 'Görünen isim (opsiyonel)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Dosya başarıyla yüklendi',
    type: Upload,
  })
  async uploadGuest(
    @UploadedFile() file: Express.Multer.File,
    @Body() createUploadDto: CreateUploadDto,
    @Request() req: any,
    @Headers('x-guest-id') guestIdHeader?: string | string[],
    @Headers('x-cart-id') cartIdHeader?: string | string[],
  ): Promise<Upload> {
    console.log('[UploadController] uploadGuest called', {
      hasFile: !!file,
      fileName: file?.originalname,
      fileSize: file?.size,
      fileMimeType: file?.mimetype,
      guestIdHeader,
      cartIdHeader,
      createUploadDto,
      headers: req.headers,
    });

    if (!file) {
      console.error('[UploadController] No file provided');
      throw new BadRequestException('Dosya yüklenmedi');
    }

    // guestId sadece header'dan alınır, body'den değil
    const guestId = Array.isArray(guestIdHeader) ? guestIdHeader[0] : guestIdHeader;
    console.log('[UploadController] Guest ID extracted', { guestId, guestIdHeader });
    
    if (!guestId) {
      console.error('[UploadController] Guest ID is missing');
      throw new BadRequestException('Guest ID is required in x-guest-id header');
    }

    // cartId header'dan al (opsiyonel)
    let cartId: string | null = null;
    if (cartIdHeader) {
      const extractedCartId = Array.isArray(cartIdHeader) ? cartIdHeader[0] : cartIdHeader;
      // Boş string kontrolü yap
      if (extractedCartId && extractedCartId.trim() !== '') {
        cartId = extractedCartId.trim();
      }
    }
    console.log('[UploadController] Cart ID extracted', { 
      cartId, 
      cartIdHeader,
      isArray: Array.isArray(cartIdHeader),
      isEmpty: cartId === null || cartId === '',
    });

    try {
      console.log('[UploadController] Calling uploadService.create', {
        fileName: file.originalname,
        fileSize: file.size,
        guestId,
        cartId: cartId || null,
        hasCartId: !!cartId,
      });

      // Guest upload'lar için createdById null olur (ownerType ve ownerId ile sahiplik takip edilir)
      const result = await this.uploadService.create(
        file,
        createUploadDto,
        null, // Guest upload'lar için createdById null
        UploadOwnerType.GUEST,
        guestId,
        cartId, // Cart ID (opsiyonel, null olabilir)
      );

      console.log('[UploadController] Upload successful', {
        uploadId: result.id,
        fileName: result.filename,
        s3Key: result.s3Key,
        folderId: result.folderId,
      });

      return result;
    } catch (error: any) {
      console.error('[UploadController] Upload failed', {
        error,
        errorMessage: error?.message,
        errorStack: error?.stack,
        errorName: error?.name,
        errorStatus: error?.status,
        errorResponse: error?.response,
      });
      throw error;
    }
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
  @Public()
  @ApiOperation({ summary: 'Dosya detayını getir (public - kişiselleştirme için)' })
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
  @Public() // Guest upload'lar için de erişilebilir olmalı
  @ApiOperation({ summary: 'Dosyayı sil (S3\'ten de silinir)' })
  @ApiResponse({
    status: 200,
    description: 'Dosya başarıyla silindi',
  })
  @ApiResponse({ status: 404, description: 'Dosya bulunamadı' })
  @ApiResponse({ status: 403, description: 'Bu dosyayı silme yetkiniz yok' })
  @ApiResponse({ status: 409, description: 'Dosya kullanılıyor, silinemez' })
  async remove(
    @Param('id') id: string,
    @Request() req: any,
    @Headers('x-guest-id') guestIdHeader?: string | string[],
  ): Promise<{ message: string }> {
    console.log('[UploadController] remove called', {
      id,
      hasUser: !!req.user,
      guestIdHeader,
    });

    // Dosyayı bul (folder bilgisiyle birlikte)
    const upload = await this.uploadService.findOne(id);

    console.log('[UploadController] Upload details', {
      id: upload.id,
      s3Key: upload.s3Key,
      folderId: upload.folderId,
      folderS3Prefix: upload.folder?.s3Prefix,
      ownerType: upload.ownerType,
      ownerId: upload.ownerId,
    });

    // Yetki kontrolü: Guest upload'lar için ownerId kontrolü, authenticated kullanıcılar için createdById kontrolü
    const user = req.user as { userId: string; roles?: Role[] } | undefined;
    const guestId = Array.isArray(guestIdHeader) ? guestIdHeader[0] : guestIdHeader;

    // Authenticated kullanıcı kontrolü
    if (user) {
      const isAdmin = user.roles?.includes(Role.ADMIN) ?? false;

      // Admin tüm medya dosyalarını; diğer kullanıcılar sadece kendi oluşturduğu dosyaları silebilir.
      if (!isAdmin && upload.createdById !== user.userId) {
        console.error('[UploadController] User does not own this file', {
          userId: user.userId,
          userRoles: user.roles,
          fileCreatedById: upload.createdById,
        });
        throw new BadRequestException('Bu dosyayı silme yetkiniz yok');
      }
    } else if (guestId) {
      // Guest kullanıcı için sahiplik kontrolü
      // Guest upload'lar için sahiplik kontrolünü gevşetiyoruz çünkü:
      // 1. Kişiselleştirme dosyaları cart'a bağlı ve guest ID değişebilir
      // 2. Dosyalar zaten relation kontrolünden geçiyor (product galleries, categories)
      // 3. Kişiselleştirme dosyaları için relation kontrolü yapmıyoruz, bu yüzden güvenli
      
      if (upload.ownerType === UploadOwnerType.GUEST) {
        // Tüm guest upload'lar silinebilir (kişiselleştirme dosyaları için)
        // Relation kontrolü zaten yapılıyor, bu yüzden güvenli
        console.log('[UploadController] Guest upload file, allowing deletion', {
          guestId,
          fileOwnerId: upload.ownerId,
          s3Key: upload.s3Key,
          folderId: upload.folderId,
          folderS3Prefix: upload.folder?.s3Prefix,
        });
      } else {
        // Guest ID var ama dosya guest upload değil
        console.error('[UploadController] File is not a guest upload', {
          guestId,
          fileOwnerType: upload.ownerType,
          fileOwnerId: upload.ownerId,
        });
        throw new BadRequestException('Bu dosyayı silme yetkiniz yok');
      }
    } else {
      // Ne authenticated ne de guest ID var
      console.error('[UploadController] No authentication provided');
      throw new BadRequestException('Bu işlem için kimlik doğrulama gerekli');
    }

    // Relation kontrolü (sadece product galleries ve categories için)
    // Kişiselleştirme dosyaları için relation kontrolü yapmıyoruz çünkü onlar cart/order'da kullanılıyor
    // ve silinebilir olmalılar
    const relations = await this.uploadService.checkRelations(id);
    if (relations.hasRelations) {
      throw new BadRequestException(
        'Bu dosya kullanılıyor ve silinemez. Önce ilgili ürün veya kategori ilişkilerini kaldırın.',
      );
    }

    console.log('[UploadController] Removing file', { id, s3Key: upload.s3Key });
    await this.uploadService.remove(id);
    console.log('[UploadController] File removed successfully', { id });
    return { message: 'Dosya başarıyla silindi' };
  }
}
