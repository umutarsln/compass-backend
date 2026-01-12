import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
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
   * S3 key'ini oluşturur
   */
  private generateS3Key(
    folder: Folder | null,
    filename: string,
    hash: string,
  ): string {
    const extension = filename.split('.').pop();
    const folderPrefix = folder ? folder.s3Prefix : 'uploads/';
    // Hash'in ilk 8 karakterini kullanarak unique dosya adı oluştur
    const uniqueFilename = `${hash.substring(0, 8)}-${Date.now()}.${extension}`;
    return `${folderPrefix}${uniqueFilename}`;
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
    createdById: string,
  ): Promise<Upload> {
    // Dosya validasyonu
    this.validateFile(file);

    // Hash hesapla
    const hash = this.calculateHash(file.buffer);

    // Aynı hash'e sahip dosya var mı kontrol et
    const existingUpload = await this.uploadRepository.findOne({
      where: { hash },
      relations: ['folder', 'createdBy'],
    });

    if (existingUpload) {
      // Mevcut dosyayı döndür (yeni upload yapma)
      return existingUpload;
    }

    // Folder kontrolü
    let folder: Folder | null = null;
    if (createUploadDto.folderId) {
      folder = await this.folderRepository.findOne({
        where: { id: createUploadDto.folderId },
      });

      if (!folder) {
        throw new NotFoundException('Klasör bulunamadı');
      }
    }

    // S3 key oluştur
    const s3Key = this.generateS3Key(folder, file.originalname, hash);

    // S3'e yükle
    const s3Url = await this.s3Service.uploadFile(
      s3Key,
      file.buffer,
      file.mimetype,
    );

    // Upload entity oluştur
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
      folderId: createUploadDto.folderId || null,
      seoTitle: createUploadDto.seoTitle,
      seoDescription: createUploadDto.seoDescription,
      seoKeywords: createUploadDto.seoKeywords,
      createdById,
    });

    return await this.uploadRepository.save(upload);
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
