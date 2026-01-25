import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Folder } from './folder.entity';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { Upload } from '../upload/upload.entity';
import { S3Service } from '../upload/s3/s3.service';
import { generateSlug } from '../common/utils/slug.util';

@Injectable()
export class FolderService {
  private readonly logger = new Logger(FolderService.name);

  constructor(
    @InjectRepository(Folder)
    private folderRepository: Repository<Folder>,
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    private s3Service: S3Service,
  ) { }

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
    const baseSlug = generateSlug(createFolderDto.name);
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

  /**
   * Klasörü bul veya oluştur (parent-child hiyerarşisi ile)
   * Sistem klasörleri için kullanılır (Sepetler, Siparişler vb.)
   * 
   * @param parentName Parent klasör adı (örn: "Sepetler", "Siparişler") veya null (root için)
   * @param childName Child klasör adı (örn: cartId UUID, orderNo) - UUID veya slug formatında olabilir
   * @param createdById Sistem kullanıcı ID'si
   */
  async findOrCreateFolder(
    parentName: string | null,
    childName: string,
    createdById: string,
  ): Promise<Folder> {
    this.logger.log(`[findOrCreateFolder] Called with parentName: ${parentName}, childName: ${childName}, createdById: ${createdById}`);
    
    let parentFolder: Folder | null = null;

    // Parent klasörü bul veya oluştur
    if (parentName) {
      this.logger.log(`[findOrCreateFolder] Looking for parent folder: ${parentName}`);
      const parentSlug = generateSlug(parentName);
      this.logger.log(`[findOrCreateFolder] Parent slug: ${parentSlug}`);
      
      parentFolder = await this.folderRepository.findOne({
        where: { slug: parentSlug, parentId: IsNull() },
      });

      if (!parentFolder) {
        this.logger.log(`[findOrCreateFolder] Parent folder not found, creating: ${parentName}`);
        // Parent klasörü oluştur
        const parentCreateDto: CreateFolderDto = {
          name: parentName,
          // parentId undefined for root folder
        };
        parentFolder = await this.create(parentCreateDto, createdById);
        this.logger.log(`[findOrCreateFolder] Parent klasör oluşturuldu: ${parentName}`, {
          folderId: parentFolder.id,
          slug: parentFolder.slug,
          s3Prefix: parentFolder.s3Prefix,
        });
      } else {
        this.logger.log(`[findOrCreateFolder] Parent folder found: ${parentName}`, {
          folderId: parentFolder.id,
          slug: parentFolder.slug,
          s3Prefix: parentFolder.s3Prefix,
        });
      }
    }

    // Child klasörü bul veya oluştur
    this.logger.log(`[findOrCreateFolder] Looking for child folder: ${childName}`);
    
    // UUID formatında mı kontrol et (cartId veya orderNo için)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(childName);
    // OrderNo formatında mı kontrol et (8 haneli)
    const isOrderNo = /^[0-9]{8}$/.test(childName);
    
    // UUID veya orderNo ise direkt kullan, değilse slug oluştur
    const childSlug = (isUUID || isOrderNo) ? childName : generateSlug(childName);
    this.logger.log(`[findOrCreateFolder] Child slug: ${childSlug} (isUUID: ${isUUID}, isOrderNo: ${isOrderNo})`);
    
    const parentId = parentFolder?.id;

    let childFolder = await this.folderRepository.findOne({
      where: parentId 
        ? { slug: childSlug, parentId }
        : { slug: childSlug, parentId: IsNull() },
    });

    if (!childFolder) {
      this.logger.log(`[findOrCreateFolder] Child folder not found, creating: ${childName}`);
      // Child klasörü oluştur
      const childCreateDto: CreateFolderDto = {
        name: childName, // Display name olarak orijinal ismi kullan
        parentId: parentId,
      };
      
      // UUID veya orderNo için slug'ı direkt kullan (zaten unique'ler)
      // Diğer durumlarda generateUniqueSlug kullanılacak
      if (isUUID || isOrderNo) {
        // UUID/orderNo için direkt slug kullan (unique oldukları için)
        childFolder = await this.createWithSlug(childCreateDto, createdById, childSlug);
      } else {
        // Normal isimler için create metodunu kullan (generateUniqueSlug otomatik çağrılacak)
        childFolder = await this.create(childCreateDto, createdById);
      }
      
      this.logger.log(
        `[findOrCreateFolder] Child klasör oluşturuldu: ${childName} (parent: ${parentName || 'root'})`,
        {
          folderId: childFolder.id,
          slug: childFolder.slug,
          s3Prefix: childFolder.s3Prefix,
          parentId: childFolder.parentId,
        },
      );
    } else {
      this.logger.log(`[findOrCreateFolder] Child folder found: ${childName}`, {
        folderId: childFolder.id,
        slug: childFolder.slug,
        s3Prefix: childFolder.s3Prefix,
        parentId: childFolder.parentId,
      });
    }

    return childFolder;
  }

  /**
   * Belirli bir slug ile klasör oluştur (UUID veya orderNo için)
   * UUID ve orderNo zaten unique olduğu için generateUniqueSlug kullanmaz
   */
  private async createWithSlug(
    createFolderDto: CreateFolderDto,
    createdById: string,
    customSlug: string,
  ): Promise<Folder> {
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

    // Klasör oluştur (customSlug'ı direkt kullan)
    const folder = this.folderRepository.create({
      name: createFolderDto.name,
      slug: customSlug, // UUID/orderNo için direkt kullan
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

  /**
   * Klasör ve tüm alt klasörlerindeki toplam dosya boyutunu hesaplar (MB)
   */
  async calculateTotalSize(id: string): Promise<number> {
    // Tüm alt klasörleri bul (recursive)
    const getAllSubfolderIds = async (parentId: string): Promise<string[]> => {
      const children = await this.folderRepository.find({
        where: { parentId },
        select: ['id'],
      });

      const allIds = [parentId];
      for (const child of children) {
        const subIds = await getAllSubfolderIds(child.id);
        allIds.push(...subIds);
      }

      return allIds;
    };

    const allFolderIds = await getAllSubfolderIds(id);

    // Tüm klasörlerdeki dosyaların toplam boyutunu hesapla
    const result = await this.uploadRepository
      .createQueryBuilder('upload')
      .select('SUM(upload.sizeMB)', 'totalSizeMB')
      .where('upload.folderId IN (:...folderIds)', { folderIds: allFolderIds })
      .getRawOne();

    return parseFloat(result?.totalSizeMB || '0');
  }

  async update(
    id: string,
    updateFolderDto: UpdateFolderDto,
  ): Promise<Folder> {
    this.logger.log(`[UPDATE] Başlangıç - Folder ID: ${id}`);
    this.logger.debug(`[UPDATE] Update DTO: ${JSON.stringify(updateFolderDto)}`);

    const folder = await this.findOne(id);
    this.logger.debug(`[UPDATE] Mevcut klasör bilgileri: ${JSON.stringify({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      path: folder.path,
    })}`);

    // Name değiştiyse slug'ı güncelle
    if (updateFolderDto.name && updateFolderDto.name !== folder.name) {
      this.logger.log(`[UPDATE] İsim değişiyor: "${folder.name}" -> "${updateFolderDto.name}"`);
      const baseSlug = generateSlug(updateFolderDto.name);
      folder.slug = await this.generateUniqueSlug(baseSlug);
      folder.name = updateFolderDto.name;
      this.logger.debug(`[UPDATE] Yeni slug: ${folder.slug}`);
    }

    // Parent değiştiyse kontrol et
    const isParentChanging =
      updateFolderDto.parentId !== undefined &&
      updateFolderDto.parentId !== folder.parentId;

    if (isParentChanging) {
      this.logger.log(
        `[UPDATE] Parent değişiyor: "${folder.parentId || 'null'}" -> "${updateFolderDto.parentId || 'null'}"`,
      );

      // Kendisini parent olarak seçemez
      if (updateFolderDto.parentId === id) {
        this.logger.error(`[UPDATE] HATA: Klasör kendisini parent olarak seçemez - ID: ${id}`);
        throw new BadRequestException(
          'Bir klasör kendisinin üst klasörü olamaz',
        );
      }

      // Parent'ın alt klasörlerinden biri olamaz (circular reference önleme)
      if (updateFolderDto.parentId) {
        this.logger.debug(`[UPDATE] Parent klasör kontrol ediliyor: ${updateFolderDto.parentId}`);
        const parent = await this.folderRepository.findOne({
          where: { id: updateFolderDto.parentId },
        });

        if (!parent) {
          this.logger.error(`[UPDATE] HATA: Parent klasör bulunamadı - ID: ${updateFolderDto.parentId}`);
          throw new NotFoundException('Üst klasör bulunamadı');
        }

        this.logger.debug(`[UPDATE] Parent klasör bulundu: ${JSON.stringify({
          id: parent.id,
          name: parent.name,
          path: parent.path,
        })}`);

        // Parent'ın path'ini kontrol et - eğer bu klasörün path'ini içeriyorsa circular reference
        if (parent.path.startsWith(folder.path)) {
          this.logger.error(
            `[UPDATE] HATA: Circular reference tespit edildi - Parent path: "${parent.path}", Folder path: "${folder.path}"`,
          );
          throw new BadRequestException(
            'Bir klasör kendi alt klasörünün altına taşınamaz',
          );
        }

        this.logger.debug(`[UPDATE] Circular reference kontrolü başarılı`);
      } else {
        this.logger.log(`[UPDATE] Ana dizine taşınıyor (parentId: null)`);
      }

      const oldParentId = folder.parentId;
      const newParentId = updateFolderDto.parentId ?? null;

      // Önce parentId'yi veritabanında güncelle
      await this.folderRepository.update(id, {
        parentId: newParentId,
      });
      this.logger.log(
        `[UPDATE] parentId veritabanında güncellendi: "${oldParentId || 'null'}" -> "${newParentId || 'null'}"`,
      );

      // Entity'yi güncelle
      folder.parentId = newParentId;

      // Entity'yi veritabanından yeniden yükle (güncel parentId ile)
      const reloadedFolder = await this.folderRepository.findOne({
        where: { id },
      });
      if (reloadedFolder) {
        // Sadece parentId'yi al, diğer alanları koru
        folder.parentId = reloadedFolder.parentId;
      }

      this.logger.debug(
        `[UPDATE] folder.parentId değeri: ${folder.parentId}, updateFolderDto.parentId: ${updateFolderDto.parentId}`,
      );
    } else {
      this.logger.debug(`[UPDATE] Parent değişmiyor (mevcut: ${folder.parentId || 'null'})`);
    }

    // Description güncelle
    if (updateFolderDto.description !== undefined) {
      this.logger.debug(
        `[UPDATE] Açıklama güncelleniyor: "${folder.description || 'null'}" -> "${updateFolderDto.description || 'null'}"`,
      );
      folder.description = updateFolderDto.description;
    }

    // Path ve S3 prefix'i yeniden hesapla
    this.logger.debug(`[UPDATE] Path ve S3 prefix yeniden hesaplanıyor...`);
    this.logger.debug(
      `[UPDATE] calculatePath çağrılmadan önce folder.parentId: ${folder.parentId}`,
    );
    const oldPath = folder.path;
    const oldS3Prefix = folder.s3Prefix;
    folder.path = await this.calculatePath(folder);
    folder.s3Prefix = await this.calculateS3Prefix(folder);
    this.logger.log(
      `[UPDATE] Path güncellendi: "${oldPath}" -> "${folder.path}"`,
    );
    this.logger.log(
      `[UPDATE] S3 Prefix güncellendi: "${oldS3Prefix}" -> "${folder.s3Prefix}"`,
    );

    this.logger.debug(`[UPDATE] Klasör veritabanına kaydediliyor...`);
    this.logger.debug(
      `[UPDATE] Kaydedilmeden önce folder.parentId: ${folder.parentId}`,
    );

    // Tüm alanları update ile güncelle (save yerine)
    const updateData: any = {
      path: folder.path,
      s3Prefix: folder.s3Prefix,
    };

    if (updateFolderDto.name && updateFolderDto.name !== folder.name) {
      updateData.name = folder.name;
      updateData.slug = folder.slug;
    }

    if (updateFolderDto.description !== undefined) {
      updateData.description = folder.description;
    }

    // parentId zaten update ile güncellendi, tekrar güncellemeye gerek yok
    // Ama emin olmak için tekrar ekleyelim
    if (isParentChanging) {
      updateData.parentId = folder.parentId;
    }

    await this.folderRepository.update(id, updateData);
    this.logger.log(`[UPDATE] Klasör update ile güncellendi - ID: ${id}`);

    // Güncellenmiş klasörü veritabanından oku
    const savedFolder = await this.folderRepository.findOne({
      where: { id },
    });

    if (!savedFolder) {
      throw new NotFoundException('Klasör bulunamadı');
    }

    this.logger.log(`[UPDATE] Klasör başarıyla kaydedildi - ID: ${savedFolder.id}`);
    this.logger.log(
      `[UPDATE] Kaydedildikten sonra savedFolder.parentId: ${savedFolder.parentId || 'null'}`,
    );

    // Eğer parent değiştiyse, tüm alt klasörlerin path'lerini de güncelle (recursive)
    if (isParentChanging) {
      this.logger.log(
        `[UPDATE] Alt klasörlerin path'leri recursive olarak güncelleniyor...`,
      );
      const startTime = Date.now();
      await this.updateChildrenPaths(savedFolder.id);
      const duration = Date.now() - startTime;
      this.logger.log(
        `[UPDATE] Alt klasörlerin path'leri güncellendi (${duration}ms)`,
      );

      // Bu klasörün içindeki upload'ların s3Key değerlerini güncelle
      this.logger.log(
        `[UPDATE] Bu klasörün içindeki upload'ların s3Key değerleri güncelleniyor...`,
      );
      const uploadsInFolder = await this.uploadRepository.find({
        where: { folderId: savedFolder.id },
      });
      this.logger.debug(
        `[UPDATE] Bu klasörde ${uploadsInFolder.length} dosya bulundu`,
      );

      for (const upload of uploadsInFolder) {
        const oldS3Key = upload.s3Key;
        // Yeni s3Key'i oluştur (klasörün yeni s3Prefix'ini kullanarak)
        // Dosya adını koru (hash ve timestamp'i değiştirme, sadece prefix'i değiştir)
        const filename = oldS3Key.split('/').pop() || upload.filename;
        const newS3Key = `${savedFolder.s3Prefix}${filename}`;

        // Eğer s3Key zaten aynıysa (aynı klasöre taşınıyorsa veya zaten taşınmışsa) atla
        if (oldS3Key === newS3Key) {
          this.logger.debug(
            `[UPDATE] Upload s3Key değişmedi - ID: ${upload.id}, s3Key: "${oldS3Key}"`,
          );
          continue;
        }

        try {
          // Önce eski dosyanın S3'te var olup olmadığını kontrol et
          const oldFileExists = await this.s3Service.checkFileExists(oldS3Key);

          if (!oldFileExists) {
            this.logger.warn(
              `[UPDATE] Eski dosya S3'te bulunamadı - ID: ${upload.id}, Old: "${oldS3Key}". Yeni konumda olabilir, sadece veritabanını güncelliyoruz.`,
            );
            // Dosya zaten taşınmış olabilir, sadece veritabanını güncelle
            const newS3Url = this.s3Service.getFileUrl(newS3Key);
            upload.s3Key = newS3Key;
            upload.s3Url = newS3Url;
            await this.uploadRepository.save(upload);
            this.logger.log(
              `[UPDATE] Upload veritabanı güncellendi (dosya zaten taşınmış) - ID: ${upload.id}, New: "${newS3Key}"`,
            );
            continue;
          }

          // Yeni konumda dosya var mı kontrol et
          const newFileExists = await this.s3Service.checkFileExists(newS3Key);
          if (newFileExists) {
            this.logger.warn(
              `[UPDATE] Yeni konumda dosya zaten var - ID: ${upload.id}, New: "${newS3Key}". Eski dosyayı siliyoruz.`,
            );
            // Yeni konumda zaten var, eski dosyayı sil
            await this.s3Service.deleteFile(oldS3Key);
            const newS3Url = this.s3Service.getFileUrl(newS3Key);
            upload.s3Key = newS3Key;
            upload.s3Url = newS3Url;
            await this.uploadRepository.save(upload);
            this.logger.log(
              `[UPDATE] Upload güncellendi (dosya zaten yeni konumda) - ID: ${upload.id}, New: "${newS3Key}"`,
            );
            continue;
          }

          // S3'teki dosyayı yeni konuma taşı
          this.logger.debug(
            `[UPDATE] S3'teki dosya taşınıyor - Old: "${oldS3Key}", New: "${newS3Key}"`,
          );
          const newS3Url = await this.s3Service.moveFile(oldS3Key, newS3Key);

          // Veritabanındaki s3Key ve s3Url'i güncelle
          upload.s3Key = newS3Key;
          upload.s3Url = newS3Url;
          await this.uploadRepository.save(upload);

          this.logger.log(
            `[UPDATE] Upload taşındı - ID: ${upload.id}, Old: "${oldS3Key}", New: "${newS3Key}"`,
          );
        } catch (error) {
          this.logger.error(
            `[UPDATE] Upload taşıma hatası - ID: ${upload.id}, Error: ${error.message}`,
            error.stack,
          );
          // Hata olsa bile devam et
        }
      }

      this.logger.log(
        `[UPDATE] ${uploadsInFolder.length} upload'un s3Key değeri güncellendi`,
      );
    }

    this.logger.log(`[UPDATE] Tamamlandı - Folder ID: ${id}`);
    return savedFolder;
  }

  /**
   * Alt klasörlerin path'lerini recursive olarak günceller
   */
  private async updateChildrenPaths(parentId: string): Promise<void> {
    this.logger.debug(`[UPDATE_CHILDREN_PATHS] Başlangıç - Parent ID: ${parentId}`);
    const children = await this.folderRepository.find({
      where: { parentId },
    });

    this.logger.debug(
      `[UPDATE_CHILDREN_PATHS] ${children.length} alt klasör bulundu`,
    );

    for (const child of children) {
      const oldPath = child.path;
      const oldS3Prefix = child.s3Prefix;

      // Path ve S3 prefix'i yeniden hesapla
      child.path = await this.calculatePath(child);
      child.s3Prefix = await this.calculateS3Prefix(child);
      await this.folderRepository.save(child);

      this.logger.debug(
        `[UPDATE_CHILDREN_PATHS] Alt klasör güncellendi - ID: ${child.id}, Path: "${oldPath}" -> "${child.path}"`,
      );

      // Bu alt klasörün içindeki upload'ların s3Key değerlerini güncelle
      const uploadsInChild = await this.uploadRepository.find({
        where: { folderId: child.id },
      });
      this.logger.debug(
        `[UPDATE_CHILDREN_PATHS] Alt klasör (${child.id}) içinde ${uploadsInChild.length} dosya bulundu`,
      );

      for (const upload of uploadsInChild) {
        const oldS3Key = upload.s3Key;
        // Dosya adını koru (hash ve timestamp'i değiştirme, sadece prefix'i değiştir)
        const filename = oldS3Key.split('/').pop() || upload.filename;
        const newS3Key = `${child.s3Prefix}${filename}`;

        try {
          // S3'teki dosyayı yeni konuma taşı
          this.logger.debug(
            `[UPDATE_CHILDREN_PATHS] S3'teki dosya taşınıyor - Old: "${oldS3Key}", New: "${newS3Key}"`,
          );
          const newS3Url = await this.s3Service.moveFile(oldS3Key, newS3Key);

          // Veritabanındaki s3Key ve s3Url'i güncelle
          upload.s3Key = newS3Key;
          upload.s3Url = newS3Url;
          await this.uploadRepository.save(upload);

          this.logger.debug(
            `[UPDATE_CHILDREN_PATHS] Upload taşındı - ID: ${upload.id}, Old: "${oldS3Key}", New: "${newS3Key}"`,
          );
        } catch (error) {
          this.logger.error(
            `[UPDATE_CHILDREN_PATHS] Upload taşıma hatası - ID: ${upload.id}, Error: ${error.message}`,
            error.stack,
          );
          // Hata olsa bile devam et
        }
      }

      // Alt klasörlerin path'lerini de güncelle (recursive)
      await this.updateChildrenPaths(child.id);
    }

    this.logger.debug(`[UPDATE_CHILDREN_PATHS] Tamamlandı - Parent ID: ${parentId}`);
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
