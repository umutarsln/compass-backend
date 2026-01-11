import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Folder } from './folder.entity';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { Upload } from '../upload/upload.entity';

@Injectable()
export class FolderService {
  constructor(
    @InjectRepository(Folder)
    private folderRepository: Repository<Folder>,
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
  ) {}

  /**
   * Slug oluşturur (URL-friendly string)
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Özel karakterleri kaldır
      .replace(/[\s_-]+/g, '-') // Boşlukları tire ile değiştir
      .replace(/^-+|-+$/g, ''); // Başta ve sonda tire varsa kaldır
  }

  /**
   * Klasör path'ini hesaplar
   */
  private async calculatePath(folder: Folder): Promise<string> {
    if (!folder.parentId) {
      return `/${folder.slug}`;
    }

    const parent = await this.folderRepository.findOne({
      where: { id: folder.parentId },
    });

    if (!parent) {
      throw new NotFoundException('Üst klasör bulunamadı');
    }

    const parentPath = parent.path;
    return `${parentPath}/${folder.slug}`;
  }

  /**
   * S3 prefix'ini hesaplar
   */
  private async calculateS3Prefix(folder: Folder): Promise<string> {
    const path = await this.calculatePath(folder);
    // Başlangıçtaki / karakterini kaldır ve sonuna / ekle
    return path.substring(1) + '/';
  }

  /**
   * Benzersiz slug oluşturur (eğer varsa sayı ekler)
   */
  private async generateUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.folderRepository.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  async create(
    createFolderDto: CreateFolderDto,
    createdById: string,
  ): Promise<Folder> {
    // Slug oluştur
    const baseSlug = this.generateSlug(createFolderDto.name);
    const slug = await this.generateUniqueSlug(baseSlug);

    // Parent kontrolü
    let parent: Folder | null = null;
    if (createFolderDto.parentId) {
      parent = await this.folderRepository.findOne({
        where: { id: createFolderDto.parentId },
      });

      if (!parent) {
        throw new NotFoundException('Üst klasör bulunamadı');
      }
    }

    // Klasör oluştur
    const folder = this.folderRepository.create({
      name: createFolderDto.name,
      slug,
      description: createFolderDto.description,
      parentId: createFolderDto.parentId || null,
      createdById,
    });

    // Path ve S3 prefix hesapla
    folder.path = await this.calculatePath(folder);
    folder.s3Prefix = await this.calculateS3Prefix(folder);

    return await this.folderRepository.save(folder);
  }

  async findAll(): Promise<Folder[]> {
    return await this.folderRepository.find({
      relations: ['parent', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Tree yapısında klasörleri döndürür
   */
  async findTree(): Promise<Folder[]> {
    const allFolders = await this.folderRepository.find({
      relations: ['parent', 'createdBy'],
      order: { path: 'ASC' },
    });

    // Root klasörleri bul (parentId null olanlar)
    const rootFolders = allFolders.filter((f) => !f.parentId);

    // Her root klasör için children'ları ekle
    const buildTree = (parent: Folder): Folder => {
      const children = allFolders.filter((f) => f.parentId === parent.id);
      return {
        ...parent,
        children: children.map((child) => buildTree(child)),
      };
    };

    return rootFolders.map((root) => buildTree(root));
  }

  async findOne(id: string): Promise<Folder> {
    const folder = await this.folderRepository.findOne({
      where: { id },
      relations: ['parent', 'children', 'createdBy'],
    });

    if (!folder) {
      throw new NotFoundException('Klasör bulunamadı');
    }

    // Klasördeki dosyaları da getir
    const uploads = await this.uploadRepository.find({
      where: { folderId: id },
      relations: ['createdBy'],
    });

    return {
      ...folder,
      uploads: uploads as any, // TypeORM relation olarak tanımlanmadı ama döndürüyoruz
    } as Folder;
  }

  async update(
    id: string,
    updateFolderDto: UpdateFolderDto,
  ): Promise<Folder> {
    const folder = await this.findOne(id);

    // Name değiştiyse slug'ı güncelle
    if (updateFolderDto.name && updateFolderDto.name !== folder.name) {
      const baseSlug = this.generateSlug(updateFolderDto.name);
      folder.slug = await this.generateUniqueSlug(baseSlug);
      folder.name = updateFolderDto.name;
    }

    // Parent değiştiyse kontrol et
    if (
      updateFolderDto.parentId !== undefined &&
      updateFolderDto.parentId !== folder.parentId
    ) {
      // Kendisini parent olarak seçemez
      if (updateFolderDto.parentId === id) {
        throw new BadRequestException(
          'Bir klasör kendisinin üst klasörü olamaz',
        );
      }

      // Parent'ın alt klasörlerinden biri olamaz (circular reference önleme)
      if (updateFolderDto.parentId) {
        const parent = await this.folderRepository.findOne({
          where: { id: updateFolderDto.parentId },
        });

        if (!parent) {
          throw new NotFoundException('Üst klasör bulunamadı');
        }

        // Parent'ın path'ini kontrol et - eğer bu klasörün path'ini içeriyorsa circular reference
        if (parent.path.startsWith(folder.path)) {
          throw new BadRequestException(
            'Bir klasör kendi alt klasörünün altına taşınamaz',
          );
        }
      }

      folder.parentId = updateFolderDto.parentId || null;
    }

    // Description güncelle
    if (updateFolderDto.description !== undefined) {
      folder.description = updateFolderDto.description;
    }

    // Path ve S3 prefix'i yeniden hesapla
    folder.path = await this.calculatePath(folder);
    folder.s3Prefix = await this.calculateS3Prefix(folder);

    return await this.folderRepository.save(folder);
  }

  async remove(id: string): Promise<void> {
    const folder = await this.findOne(id);

    // Alt klasörleri kontrol et
    const children = await this.folderRepository.find({
      where: { parentId: id },
    });

    if (children.length > 0) {
      throw new ConflictException(
        'Bu klasörün alt klasörleri var. Önce alt klasörleri silin.',
      );
    }

    // Klasördeki dosyaları kontrol et
    const uploads = await this.uploadRepository.find({
      where: { folderId: id },
    });

    if (uploads.length > 0) {
      throw new ConflictException(
        'Bu klasörde dosyalar var. Önce dosyaları silin.',
      );
    }

    await this.folderRepository.remove(folder);
  }

  /**
   * Klasörü ve içindeki tüm dosyaları siler (recursive)
   */
  async removeRecursive(id: string): Promise<void> {
    const folder = await this.findOne(id);

    // Alt klasörleri bul
    const children = await this.folderRepository.find({
      where: { parentId: id },
    });

    // Alt klasörleri recursive olarak sil
    for (const child of children) {
      await this.removeRecursive(child.id);
    }

    // Klasördeki dosyaları sil (S3'ten de silinmeli - bu UploadService'te yapılacak)
    const uploads = await this.uploadRepository.find({
      where: { folderId: id },
    });

    // Upload'ları sil (S3 entegrasyonu UploadService'te olacak)
    await this.uploadRepository.remove(uploads);

    // Klasörü sil
    await this.folderRepository.remove(folder);
  }
}
