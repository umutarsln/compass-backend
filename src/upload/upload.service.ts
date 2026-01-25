import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Upload } from './upload.entity';
import { CreateUploadDto } from './dto/create-upload.dto';
import { UpdateUploadDto } from './dto/update-upload.dto';
import { S3Service } from './s3/s3.service';
import { Folder } from '../folder/folder.entity';
import { FolderService } from '../folder/folder.service';
import { UploadOwnerType } from '../common/enums/upload-owner-type.enum';
import { UserService } from '../user/user.service';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class UploadService {
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    @InjectRepository(Folder)
    private folderRepository: Repository<Folder>,
    private s3Service: S3Service,
    private configService: ConfigService,
    private dataSource: DataSource,
    @Inject(forwardRef(() => FolderService))
    private folderService: FolderService,
    private userService: UserService,
  ) {
    // Env'den dosya boyutu limitini al (default: 10MB)
    this.maxFileSize =
      parseInt(this.configService.get('MAX_FILE_SIZE_MB') || '10') *
      1024 *
      1024;

    // İzin verilen dosya tipleri (env'den alınabilir, şimdilik default)
    const allowedTypes =
      this.configService.get('ALLOWED_FILE_TYPES') ||
      'image/jpeg,image/png,image/gif,image/webp,application/pdf';
    // Eğer "*" veya boş ise tüm dosya tiplerine izin ver
    if (allowedTypes === '*' || allowedTypes === '' || !allowedTypes) {
      this.allowedMimeTypes = [];
    } else {
      this.allowedMimeTypes = allowedTypes.split(',').map(type => type.trim());
    }
  }

  /**
   * Dosya hash'ini hesaplar (SHA-256)
   */
  private calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Dosya boyutunu MB'ye çevirir
   */
  private bytesToMB(bytes: number): number {
    return parseFloat((bytes / (1024 * 1024)).toFixed(2));
  }

  /**
   * Sistem klasörleri için admin user ID'yi bulur veya ilk admin user'ı döndürür
   */
  private async getSystemUserId(): Promise<string> {
    console.log('[UploadService] getSystemUserId called');
    try {
      console.log('[UploadService] Finding admin users...');
      const admins = await this.userService.findAllAdmins();
      console.log('[UploadService] Admin users found', { count: admins.length });
      
      if (admins.length > 0) {
        console.log('[UploadService] Using first admin user', { adminId: admins[0].id });
        return admins[0].id;
      }
      
      // Eğer admin yoksa, ilk user'ı bul (fallback)
      console.log('[UploadService] No admin found, trying to find any user...');
      const users = await this.userService.findAll();
      console.log('[UploadService] Users found', { count: users.length });
      
      if (users.length > 0) {
        console.log('[UploadService] Using first user as fallback', { userId: users[0].id });
        return users[0].id;
      }
      
      console.error('[UploadService] No users found in system');
      throw new BadRequestException('Sistem klasörleri için kullanıcı bulunamadı');
    } catch (error: any) {
      console.error('[UploadService] getSystemUserId failed', {
        error,
        errorMessage: error?.message,
        errorStack: error?.stack,
      });
      throw error;
    }
  }

  /**
   * S3 key'ini oluşturur
   */
  private generateS3Key(
    folder: Folder | null,
    filename: string,
    hash: string,
  ): string {
    const extension = filename.split('.').pop();
    // Folder varsa s3Prefix kullan, yoksa default uploads/ kullan
    const folderPrefix = folder ? folder.s3Prefix : 'uploads/';
    console.log('[UploadService] generateS3Key', {
      hasFolder: !!folder,
      folderPrefix,
      folderId: folder?.id,
      folderName: folder?.name,
    });
    // Hash'in ilk 8 karakterini kullanarak unique dosya adı oluştur
    const uniqueFilename = `${hash.substring(0, 8)}-${Date.now()}.${extension}`;
    const s3Key = `${folderPrefix}${uniqueFilename}`;
    console.log('[UploadService] Generated S3 key', { s3Key });
    return s3Key;
  }

  /**
   * Dosya validasyonu
   */
  private validateFile(file: Express.Multer.File): void {
    // Boyut kontrolü
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `Dosya boyutu çok büyük. Maksimum: ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    // MIME type kontrolü (eğer allowedMimeTypes boş ise tüm tiplere izin ver)
    if (this.allowedMimeTypes.length > 0 && !this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Bu dosya tipi desteklenmiyor. İzin verilen tipler: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }

  async create(
    file: Express.Multer.File,
    createUploadDto: CreateUploadDto,
    createdById: string | null,
    ownerType?: UploadOwnerType | null,
    ownerId?: string | null,
    cartId?: string | null,
  ): Promise<Upload> {
    console.log('[UploadService] create called', {
      fileName: file.originalname,
      fileSize: file.size,
      fileMimeType: file.mimetype,
      createdById,
      ownerType,
      ownerId,
      cartId,
      folderId: createUploadDto.folderId,
    });

    try {
      // Dosya validasyonu
      console.log('[UploadService] Validating file...');
      this.validateFile(file);
      console.log('[UploadService] File validation passed');

      // Hash hesapla
      console.log('[UploadService] Calculating file hash...');
      const hash = this.calculateHash(file.buffer);
      console.log('[UploadService] File hash calculated', { hash: hash.substring(0, 16) + '...' });

      // Aynı hash'e sahip dosya var mı kontrol et
      console.log('[UploadService] Checking for existing file with same hash...');
      const existingUpload = await this.uploadRepository.findOne({
        where: { hash },
        relations: ['folder', 'createdBy'],
      });

      if (existingUpload) {
        console.log('[UploadService] Existing file found, returning it', {
          uploadId: existingUpload.id,
          s3Key: existingUpload.s3Key,
        });
        // Mevcut dosyayı döndür (yeni upload yapma)
        return existingUpload;
      }
      console.log('[UploadService] No existing file found, proceeding with new upload');

      // Folder kontrolü
      let folder: Folder | null = null;
      
      // Cart ID varsa, Sepetler klasörü yapısını oluştur
      // cartId null, undefined veya boş string değilse klasör oluştur
      if (cartId && cartId.trim() !== '') {
        console.log('[UploadService] Cart ID provided, creating/finding cart folder', { 
          cartId,
          cartIdLength: cartId.length,
          cartIdType: typeof cartId,
        });
        console.log('[UploadService] Getting system user ID...');
        const systemUserId = await this.getSystemUserId();
        console.log('[UploadService] System user ID obtained', { systemUserId });
        
        // "Sepetler" klasörünü bul veya oluştur
        console.log('[UploadService] Finding/creating "Sepetler" folder...');
        const sepetlerFolder = await this.folderService.findOrCreateFolder(
          null,
          'Sepetler',
          systemUserId,
        );
        console.log('[UploadService] "Sepetler" folder ready', {
          folderId: sepetlerFolder.id,
          s3Prefix: sepetlerFolder.s3Prefix,
        });
        
        // "Sepetler/{cartId}" klasörünü bul veya oluştur
        console.log('[UploadService] Finding/creating cart folder', { cartId });
        folder = await this.folderService.findOrCreateFolder(
          'Sepetler',
          cartId.trim(), // Trim yapılmış cartId kullan
          systemUserId,
        );
        console.log('[UploadService] Cart folder ready', {
          folderId: folder.id,
          folderName: folder.name,
          s3Prefix: folder.s3Prefix,
        });
        
        // Klasör oluşturma işleminin tamamlandığından emin ol
        if (!folder || !folder.id || !folder.s3Prefix) {
          console.error('[UploadService] Folder creation failed or incomplete', { folder });
          throw new BadRequestException('Klasör oluşturulamadı veya eksik bilgi');
        }
        
        console.log('[UploadService] Folder verified and ready for file upload', {
          folderId: folder.id,
          s3Prefix: folder.s3Prefix,
        });
      } else {
        console.log('[UploadService] No cart ID provided', { 
          cartId,
          cartIdType: typeof cartId,
          hasFolderId: !!createUploadDto.folderId,
        });
        
        if (createUploadDto.folderId) {
          console.log('[UploadService] Folder ID provided in DTO', { folderId: createUploadDto.folderId });
          folder = await this.folderRepository.findOne({
            where: { id: createUploadDto.folderId },
          });

          if (!folder) {
            console.error('[UploadService] Folder not found', { folderId: createUploadDto.folderId });
            throw new NotFoundException('Klasör bulunamadı');
          }
          console.log('[UploadService] Folder found', { folderId: folder.id, s3Prefix: folder.s3Prefix });
        } else {
          console.log('[UploadService] No folder specified, will use default uploads/ prefix');
        }
      }

      // S3 key oluştur
      console.log('[UploadService] Generating S3 key...');
      const s3Key = this.generateS3Key(folder, file.originalname, hash);
      console.log('[UploadService] S3 key generated', { s3Key });

      // S3'e yükle
      console.log('[UploadService] Uploading to S3...', {
        s3Key,
        fileSize: file.size,
        mimeType: file.mimetype,
      });
      const s3Url = await this.s3Service.uploadFile(
        s3Key,
        file.buffer,
        file.mimetype,
      );
      console.log('[UploadService] S3 upload successful', { s3Url });

      // Upload entity oluştur
      console.log('[UploadService] Creating upload entity...', {
        folderId: folder?.id || createUploadDto.folderId || null,
        folderName: folder?.name,
        s3Key,
      });
      const upload = this.uploadRepository.create({
        filename: file.originalname,
        displayName: createUploadDto.displayName || file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        sizeMB: this.bytesToMB(file.size),
        s3Key,
        s3Bucket: this.configService.get('AWS_S3_BUCKET') || '',
        s3Url,
        hash,
        folderId: folder?.id || createUploadDto.folderId || null, // Folder ID'yi kaydet
        seoTitle: createUploadDto.seoTitle,
        seoDescription: createUploadDto.seoDescription,
        seoKeywords: createUploadDto.seoKeywords,
        createdById,
        ownerType: ownerType || null,
        ownerId: ownerId || null,
      });

      console.log('[UploadService] Saving upload entity to database...', {
        uploadId: upload.id,
        folderId: upload.folderId,
        s3Key: upload.s3Key,
      });
      const savedUpload = await this.uploadRepository.save(upload);
      console.log('[UploadService] Upload entity saved successfully', {
        uploadId: savedUpload.id,
        fileName: savedUpload.filename,
        s3Url: savedUpload.s3Url,
        folderId: savedUpload.folderId,
      });

      return savedUpload;
    } catch (error: any) {
      console.error('[UploadService] create failed', {
        error,
        errorMessage: error?.message,
        errorStack: error?.stack,
        errorName: error?.name,
        fileName: file?.originalname,
        cartId,
      });
      throw error;
    }
  }

  async findAll(): Promise<Upload[]> {
    return await this.uploadRepository.find({
      relations: ['folder', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Upload> {
    const upload = await this.uploadRepository.findOne({
      where: { id },
      relations: ['folder', 'createdBy'],
    });

    if (!upload) {
      throw new NotFoundException('Dosya bulunamadı');
    }

    return upload;
  }

  async findByFolder(folderId: string): Promise<Upload[]> {
    return await this.uploadRepository.find({
      where: { folderId },
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, updateUploadDto: UpdateUploadDto): Promise<Upload> {
    const upload = await this.findOne(id);

    // Folder değişikliği
    if (updateUploadDto.folderId !== undefined) {
      if (updateUploadDto.folderId) {
        const folder = await this.folderRepository.findOne({
          where: { id: updateUploadDto.folderId },
        });

        if (!folder) {
          throw new NotFoundException('Klasör bulunamadı');
        }
      }

      upload.folderId = updateUploadDto.folderId || null;
    }

    // Diğer alanları güncelle
    if (updateUploadDto.displayName !== undefined) {
      upload.displayName = updateUploadDto.displayName;
    }

    if (updateUploadDto.seoTitle !== undefined) {
      upload.seoTitle = updateUploadDto.seoTitle;
    }

    if (updateUploadDto.seoDescription !== undefined) {
      upload.seoDescription = updateUploadDto.seoDescription;
    }

    if (updateUploadDto.seoKeywords !== undefined) {
      upload.seoKeywords = updateUploadDto.seoKeywords;
    }

    return await this.uploadRepository.save(upload);
  }

  async remove(id: string): Promise<void> {
    const upload = await this.findOne(id);

    // S3'ten sil
    await this.s3Service.deleteFile(upload.s3Key);

    // Veritabanından sil
    await this.uploadRepository.remove(upload);
  }

  /**
   * Dosya indirme URL'i oluşturur (presigned URL)
   */
  async getDownloadUrl(id: string, expiresIn: number = 3600): Promise<string> {
    const upload = await this.findOne(id);
    return await this.s3Service.generatePresignedUrl(upload.s3Key, expiresIn);
  }

  /**
   * Hash ile dosya kontrolü
   */
  async findByHash(hash: string): Promise<Upload | null> {
    return await this.uploadRepository.findOne({
      where: { hash },
    });
  }

  /**
   * Upload'ın kullanıldığı relation'ları kontrol eder
   */
  async checkRelations(id: string): Promise<{
    hasRelations: boolean;
    relations: {
      productGalleries: number;
      categories: number;
    };
  }> {
    const upload = await this.findOne(id);

    // ProductGallery'lerde mainImage veya thumbnailImage olarak kullanılıyor mu?
    // TypeORM snake_case kullanır, bu yüzden main_image_id ve thumbnail_image_id
    const mainThumbnailCount = await this.dataSource
      .query(
        `SELECT COUNT(*) as count FROM product_galleries 
         WHERE "mainImageId" = $1 OR "thumbnailImageId" = $1`,
        [id],
      )
      .then((result) => parseInt(result[0]?.count || '0', 10));

    // ProductGallery detailImages'da kullanılıyor mu?
    // Join table'da kolon adları genellikle camelCase olarak saklanır
    const detailImagesCount = await this.dataSource
      .query(
        `SELECT COUNT(*) as count FROM product_gallery_detail_images 
         WHERE "uploadId" = $1`,
        [id],
      )
      .then((result) => parseInt(result[0]?.count || '0', 10));

    const productGalleriesCount = mainThumbnailCount + detailImagesCount;

    // Category'lerde kullanılıyor mu?
    const categoriesCount = await this.dataSource
      .query(`SELECT COUNT(*) as count FROM categories WHERE "imageId" = $1`, [id])
      .then((result) => parseInt(result[0]?.count || '0', 10));

    const hasRelations = productGalleriesCount > 0 || categoriesCount > 0;

    return {
      hasRelations,
      relations: {
        productGalleries: productGalleriesCount,
        categories: categoriesCount,
      },
    };
  }
}
