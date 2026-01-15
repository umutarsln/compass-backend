import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductGallery } from './product-gallery.entity';
import { CreateProductGalleryDto } from './dto/create-product-gallery.dto';
import { UpdateProductGalleryDto } from './dto/update-product-gallery.dto';
import { Category } from '../category/category.entity';
import { Tag } from '../tag/tag.entity';
import { Upload } from '../upload/upload.entity';
import { VariantCombination } from './variant-combination.entity';
import { VariantOption } from './variant-option.entity';
import { VariantValue } from './variant-value.entity';
import { Stock } from '../stock/stock.entity';
import { ProductType } from '../common/enums/product-type.enum';
import { SellableType } from '../common/enums/sellable-type.enum';
import { StockService } from '../stock/stock.service';
import { CreateVariantOptionDto } from './dto/create-variant-option.dto';
import { UpdateVariantOptionDto } from './dto/update-variant-option.dto';
import { CreateVariantValueDto } from './dto/create-variant-value.dto';
import { UpdateVariantValueDto } from './dto/update-variant-value.dto';
import { CreateVariantCombinationDto } from './dto/create-variant-combination.dto';
import { UpdateVariantCombinationDto } from './dto/update-variant-combination.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    @InjectRepository(ProductGallery)
    private productGalleryRepository: Repository<ProductGallery>,
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    @InjectRepository(VariantCombination)
    private variantCombinationRepository: Repository<VariantCombination>,
    @InjectRepository(VariantOption)
    private variantOptionRepository: Repository<VariantOption>,
    @InjectRepository(VariantValue)
    private variantValueRepository: Repository<VariantValue>,
    @InjectRepository(Stock)
    private stockRepository: Repository<Stock>,
    private stockService: StockService,
    private dataSource: DataSource,
  ) { }

  /**
   * Slug oluşturur (URL-friendly string)
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Benzersiz slug oluşturur
   */
  private async generateUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.productRepository.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Ürün fiyatını hesaplar
   */
  calculatePrice(product: Product, variantValueIds?: string[]): number {
    let price = product.basePrice;

    // Discount uygula - eğer discountedPrice varsa onu kullan
    if (product.isOnSale && product.discountedPrice != null) {
      price = Number(product.discountedPrice);
    }

    // Variant product ise ve variant values verilmişse
    if (product.type === ProductType.VARIANT && variantValueIds) {
      // Variant value'ların priceDelta'larını ekle
      // Bu kısım VariantService'ten alınacak, şimdilik basePrice döndürüyoruz
    }

    return parseFloat(price.toFixed(2));
  }

  async create(
    createProductDto: CreateProductDto,
    createdById: string,
  ): Promise<Product> {
    // Slug oluştur
    const baseSlug = this.generateSlug(createProductDto.name);
    const slug = await this.generateUniqueSlug(baseSlug);

    // SKU kontrolü
    if (createProductDto.sku) {
      const existingProduct = await this.productRepository.findOne({
        where: { sku: createProductDto.sku },
      });

      if (existingProduct) {
        throw new ConflictException('Bu SKU zaten kullanılıyor');
      }
    }

    // Kategorileri yükle
    let categories: Category[] = [];
    if (createProductDto.categoryIds && createProductDto.categoryIds.length > 0) {
      categories = await this.categoryRepository.find({
        where: { id: In(createProductDto.categoryIds) },
      });

      if (categories.length !== createProductDto.categoryIds.length) {
        throw new NotFoundException('Bazı kategoriler bulunamadı');
      }
    }

    // Tag'leri yükle
    let tags: Tag[] = [];
    if (createProductDto.tagIds && createProductDto.tagIds.length > 0) {
      tags = await this.tagRepository.find({
        where: { id: In(createProductDto.tagIds) },
      });

      if (tags.length !== createProductDto.tagIds.length) {
        throw new NotFoundException('Bazı tag\'ler bulunamadı');
      }
    }

    // Ürün oluştur
    const product = this.productRepository.create({
      ...createProductDto,
      slug,
      createdById,
      categories,
      tags,
    });

    const savedProduct = await this.productRepository.save(product);

    // SIMPLE product için stock kaydı oluştur (relation ile)
    if (savedProduct.type === ProductType.SIMPLE) {
      const stock = this.stockRepository.create({
        sellableType: SellableType.PRODUCT,
        sellableId: savedProduct.id,
        productId: savedProduct.id,
        availableQuantity: 0,
        reservedQuantity: 0,
      });
      await this.stockRepository.save(stock);
    }

    // Stock relation'ı ile birlikte döndür
    return await this.productRepository.findOne({
      where: { id: savedProduct.id },
      relations: ['stock', 'categories', 'tags', 'createdBy'],
    }) || savedProduct;
  }

  async findAll(): Promise<Product[]> {
    return await this.productRepository.find({
      relations: ['categories', 'tags', 'createdBy', 'stock'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['categories', 'tags', 'createdBy', 'stock', 'galleries'],
    });

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { slug },
      relations: [
        'categories',
        'tags',
        'createdBy',
        'stock',
        'galleries',
        'galleries.mainImage',
        'galleries.thumbnailImage',
        'galleries.detailImages',
      ],
    });

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);

    // Name değiştiyse slug'ı güncelle
    if (updateProductDto.name && updateProductDto.name !== product.name) {
      const baseSlug = this.generateSlug(updateProductDto.name);
      product.slug = await this.generateUniqueSlug(baseSlug);
      product.name = updateProductDto.name;
    }

    // SKU kontrolü
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      const existingProduct = await this.productRepository.findOne({
        where: { sku: updateProductDto.sku },
      });

      if (existingProduct) {
        throw new ConflictException('Bu SKU zaten kullanılıyor');
      }
      product.sku = updateProductDto.sku;
    }

    // Kategorileri güncelle
    if (updateProductDto.categoryIds !== undefined) {
      if (updateProductDto.categoryIds.length > 0) {
        const categories = await this.categoryRepository.find({
          where: { id: In(updateProductDto.categoryIds) },
        });

        if (categories.length !== updateProductDto.categoryIds.length) {
          throw new NotFoundException('Bazı kategoriler bulunamadı');
        }

        product.categories = categories;
      } else {
        product.categories = [];
      }
    }

    // Tag'leri güncelle
    if (updateProductDto.tagIds !== undefined) {
      if (updateProductDto.tagIds.length > 0) {
        const tags = await this.tagRepository.find({
          where: { id: In(updateProductDto.tagIds) },
        });

        if (tags.length !== updateProductDto.tagIds.length) {
          throw new NotFoundException('Bazı tag\'ler bulunamadı');
        }

        product.tags = tags;
      } else {
        product.tags = [];
      }
    }

    // Diğer alanları güncelle
    // discountedPrice'ı özel olarak işle - sadece açıkça gönderildiğinde güncelle
    const { discountedPrice, categoryIds, tagIds, ...restUpdateData } = updateProductDto;
    
    Object.assign(product, restUpdateData);
    
    // discountedPrice açıkça gönderildiyse (null dahil) güncelle
    if (discountedPrice !== undefined) {
      product.discountedPrice = discountedPrice;
    }

    return await this.productRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
  }

  // ==================== ProductGallery Methods ====================

  /**
   * Yeni bir ProductGallery oluşturur
   */
  async createProductGallery(
    createProductGalleryDto: CreateProductGalleryDto,
  ): Promise<ProductGallery> {
    // productId veya variantCombinationId'den biri olmalı
    if (!createProductGalleryDto.productId && !createProductGalleryDto.variantCombinationId) {
      throw new BadRequestException(
        'productId veya variantCombinationId\'den biri belirtilmelidir',
      );
    }

    // İkisi de verilmişse hata
    if (
      createProductGalleryDto.productId &&
      createProductGalleryDto.variantCombinationId
    ) {
      throw new BadRequestException(
        'productId ve variantCombinationId aynı anda verilemez',
      );
    }

    // Product kontrolü
    if (createProductGalleryDto.productId) {
      const product = await this.productRepository.findOne({
        where: { id: createProductGalleryDto.productId },
      });

      if (!product) {
        throw new NotFoundException('Ürün bulunamadı');
      }

      // Basit ürün için zaten bir ProductGallery var mı kontrol et
      if (product.type === ProductType.SIMPLE) {
        const existingGallery = await this.productGalleryRepository.findOne({
          where: { productId: createProductGalleryDto.productId },
        });

        if (existingGallery) {
          throw new ConflictException(
            'Bu ürün için zaten bir ProductGallery mevcut',
          );
        }
      }
    }

    // VariantCombination kontrolü
    if (createProductGalleryDto.variantCombinationId) {
      const variantCombination =
        await this.variantCombinationRepository.findOne({
          where: { id: createProductGalleryDto.variantCombinationId },
        });

      if (!variantCombination) {
        throw new NotFoundException('Varyasyon kombinasyonu bulunamadı');
      }

      // Bu variant kombinasyonu için zaten bir ProductGallery var mı kontrol et
      const existingGallery = await this.productGalleryRepository.findOne({
        where: {
          variantCombinationId: createProductGalleryDto.variantCombinationId,
        },
      });

      if (existingGallery) {
        throw new ConflictException(
          'Bu varyasyon kombinasyonu için zaten bir ProductGallery mevcut',
        );
      }
    }

    // Upload'ları kontrol et
    const mainImage = await this.uploadRepository.findOne({
      where: { id: createProductGalleryDto.mainImageId },
    });

    if (!mainImage) {
      throw new NotFoundException('Ana resim bulunamadı');
    }

    const thumbnailImage = await this.uploadRepository.findOne({
      where: { id: createProductGalleryDto.thumbnailImageId },
    });

    if (!thumbnailImage) {
      throw new NotFoundException('Thumbnail resim bulunamadı');
    }

    // Detay resimlerini kontrol et
    let detailImages: Upload[] = [];
    if (
      createProductGalleryDto.detailImageIds &&
      createProductGalleryDto.detailImageIds.length > 0
    ) {
      detailImages = await this.uploadRepository.find({
        where: { id: In(createProductGalleryDto.detailImageIds) },
      });

      if (detailImages.length !== createProductGalleryDto.detailImageIds.length) {
        throw new NotFoundException('Bazı detay resimleri bulunamadı');
      }
    }

    // ProductGallery oluştur
    const productGallery = this.productGalleryRepository.create({
      productId: createProductGalleryDto.productId || null,
      variantCombinationId: createProductGalleryDto.variantCombinationId || null,
      mainImageId: createProductGalleryDto.mainImageId,
      thumbnailImageId: createProductGalleryDto.thumbnailImageId,
      detailImages,
      displayOrder: createProductGalleryDto.displayOrder || 0,
    });

    const savedGallery = await this.productGalleryRepository.save(productGallery);

    // Relation'ları yükle
    const galleryWithRelations = await this.productGalleryRepository.findOne({
      where: { id: savedGallery.id },
      relations: [
        'product',
        'variantCombination',
        'mainImage',
        'thumbnailImage',
        'detailImages',
      ],
    });

    if (!galleryWithRelations) {
      throw new NotFoundException('ProductGallery kaydedildi ancak yüklenemedi');
    }

    return galleryWithRelations;
  }

  /**
   * ProductGallery'yi ID ile getirir
   */
  async findProductGallery(id: string): Promise<ProductGallery> {
    const productGallery = await this.productGalleryRepository.findOne({
      where: { id },
      relations: [
        'product',
        'variantCombination',
        'mainImage',
        'thumbnailImage',
        'detailImages',
      ],
    });

    if (!productGallery) {
      throw new NotFoundException('ProductGallery bulunamadı');
    }

    return productGallery;
  }

  /**
   * Basit ürün için ProductGallery getirir
   */
  async findProductGalleryByProduct(
    productId: string,
  ): Promise<ProductGallery | null> {
    return await this.productGalleryRepository.findOne({
      where: { productId },
      relations: [
        'product',
        'mainImage',
        'thumbnailImage',
        'detailImages',
      ],
    });
  }

  /**
   * Variant kombinasyonu için ProductGallery getirir
   */
  async findProductGalleryByVariantCombination(
    variantCombinationId: string,
  ): Promise<ProductGallery | null> {
    return await this.productGalleryRepository.findOne({
      where: { variantCombinationId },
      relations: [
        'variantCombination',
        'mainImage',
        'thumbnailImage',
        'detailImages',
      ],
      cache: false, // Cache'i devre dışı bırak
    });
  }

  /**
   * Bir ürünün tüm ProductGallery'lerini getirir (variant ürünler için)
   */
  async findProductGalleriesByProduct(
    productId: string,
  ): Promise<ProductGallery[]> {
    // Önce ürünü kontrol et
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    // Variant ürün ise, tüm variant kombinasyonlarının ProductGallery'lerini getir
    if (product.type === ProductType.VARIANT) {
      const variantCombinations =
        await this.variantCombinationRepository.find({
          where: { productId },
        });

      const variantCombinationIds = variantCombinations.map((vc) => vc.id);

      if (variantCombinationIds.length === 0) {
        return [];
      }

      return await this.productGalleryRepository.find({
        where: { variantCombinationId: In(variantCombinationIds) },
        relations: [
          'variantCombination',
          'mainImage',
          'thumbnailImage',
          'detailImages',
        ],
        order: { displayOrder: 'ASC' },
      });
    }

    // Basit ürün ise, tek ProductGallery'yi getir
    const gallery = await this.findProductGalleryByProduct(productId);
    return gallery ? [gallery] : [];
  }

  /**
   * ProductGallery'yi günceller
   */
  async updateProductGallery(
    id: string,
    updateProductGalleryDto: UpdateProductGalleryDto,
  ): Promise<ProductGallery> {
    console.log('[ProductService] updateProductGallery - START');
    console.log('[ProductService] Gallery ID:', id);
    console.log('[ProductService] Update DTO:', JSON.stringify(updateProductGalleryDto, null, 2));

    const productGallery = await this.findProductGallery(id);
    console.log('[ProductService] Existing Gallery:', {
      id: productGallery.id,
      mainImageId: productGallery.mainImageId,
      thumbnailImageId: productGallery.thumbnailImageId,
      detailImageCount: productGallery.detailImages?.length || 0,
    });

    // productId veya variantCombinationId değişikliği kontrolü
    if (
      (updateProductGalleryDto.productId &&
        updateProductGalleryDto.variantCombinationId) ||
      (updateProductGalleryDto.productId &&
        productGallery.variantCombinationId) ||
      (updateProductGalleryDto.variantCombinationId && productGallery.productId)
    ) {
      throw new BadRequestException(
        'productId ve variantCombinationId aynı anda verilemez',
      );
    }

    // Product kontrolü
    if (updateProductGalleryDto.productId) {
      const product = await this.productRepository.findOne({
        where: { id: updateProductGalleryDto.productId },
      });

      if (!product) {
        throw new NotFoundException('Ürün bulunamadı');
      }

      // Başka bir ProductGallery ile çakışma kontrolü
      if (product.type === ProductType.SIMPLE) {
        const existingGallery = await this.productGalleryRepository.findOne({
          where: {
            productId: updateProductGalleryDto.productId,
          },
        });

        if (existingGallery && existingGallery.id !== id) {
          throw new ConflictException(
            'Bu ürün için zaten bir ProductGallery mevcut',
          );
        }
      }
    }

    // VariantCombination kontrolü
    if (updateProductGalleryDto.variantCombinationId) {
      const variantCombination =
        await this.variantCombinationRepository.findOne({
          where: { id: updateProductGalleryDto.variantCombinationId },
        });

      if (!variantCombination) {
        throw new NotFoundException('Varyasyon kombinasyonu bulunamadı');
      }

      // Başka bir ProductGallery ile çakışma kontrolü
      const existingGallery = await this.productGalleryRepository.findOne({
        where: {
          variantCombinationId: updateProductGalleryDto.variantCombinationId,
        },
      });

      if (existingGallery && existingGallery.id !== id) {
        throw new ConflictException(
          'Bu varyasyon kombinasyonu için zaten bir ProductGallery mevcut',
        );
      }
    }

    // Upload'ları kontrol et
    if (updateProductGalleryDto.mainImageId) {
      const mainImage = await this.uploadRepository.findOne({
        where: { id: updateProductGalleryDto.mainImageId },
      });

      if (!mainImage) {
        throw new NotFoundException('Ana resim bulunamadı');
      }
    }

    if (updateProductGalleryDto.thumbnailImageId) {
      const thumbnailImage = await this.uploadRepository.findOne({
        where: { id: updateProductGalleryDto.thumbnailImageId },
      });

      if (!thumbnailImage) {
        throw new NotFoundException('Thumbnail resim bulunamadı');
      }
    }

    // Detay resimlerini kontrol et
    if (updateProductGalleryDto.detailImageIds !== undefined) {
      if (updateProductGalleryDto.detailImageIds.length > 0) {
        const detailImages = await this.uploadRepository.find({
          where: { id: In(updateProductGalleryDto.detailImageIds) },
        });

        if (detailImages.length !== updateProductGalleryDto.detailImageIds.length) {
          throw new NotFoundException('Bazı detay resimleri bulunamadı');
        }

        productGallery.detailImages = detailImages;
      } else {
        productGallery.detailImages = [];
      }
    }

    // mainImageId ve thumbnailImageId'yi güncelle
    console.log('[ProductService] Updating mainImageId and thumbnailImageId...');

    // mainImage relation'ını güncelle
    if (updateProductGalleryDto.mainImageId) {
      console.log('[ProductService] mainImageId changed:', {
        old: productGallery.mainImageId,
        new: updateProductGalleryDto.mainImageId,
      });
      const newMainImage = await this.uploadRepository.findOne({
        where: { id: updateProductGalleryDto.mainImageId },
      });
      if (!newMainImage) {
        throw new NotFoundException('Ana resim bulunamadı');
      }
      productGallery.mainImageId = updateProductGalleryDto.mainImageId;
      productGallery.mainImage = newMainImage; // Relation'ı da güncelle
    } else {
      console.log('[ProductService] mainImageId not provided in DTO, keeping existing:', productGallery.mainImageId);
    }

    // thumbnailImage relation'ını güncelle
    if (updateProductGalleryDto.thumbnailImageId) {
      console.log('[ProductService] thumbnailImageId changed:', {
        old: productGallery.thumbnailImageId,
        new: updateProductGalleryDto.thumbnailImageId,
      });
      const newThumbnailImage = await this.uploadRepository.findOne({
        where: { id: updateProductGalleryDto.thumbnailImageId },
      });
      if (!newThumbnailImage) {
        throw new NotFoundException('Thumbnail resim bulunamadı');
      }
      productGallery.thumbnailImageId = updateProductGalleryDto.thumbnailImageId;
      productGallery.thumbnailImage = newThumbnailImage; // Relation'ı da güncelle
    } else {
      console.log('[ProductService] thumbnailImageId not provided in DTO, keeping existing:', productGallery.thumbnailImageId);
    }

    // Diğer alanları güncelle
    if (updateProductGalleryDto.displayOrder !== undefined) {
      productGallery.displayOrder = updateProductGalleryDto.displayOrder;
    }

    console.log('[ProductService] Gallery state before save:', {
      mainImageId: productGallery.mainImageId,
      mainImage: productGallery.mainImage ? { id: productGallery.mainImage.id, filename: productGallery.mainImage.filename } : null,
      thumbnailImageId: productGallery.thumbnailImageId,
      thumbnailImage: productGallery.thumbnailImage ? { id: productGallery.thumbnailImage.id, filename: productGallery.thumbnailImage.filename } : null,
      displayOrder: productGallery.displayOrder,
      detailImagesCount: productGallery.detailImages?.length || 0,
    });

    console.log('[ProductService] Saving gallery...');
    const savedGallery = await this.productGalleryRepository.save(productGallery);
    console.log('[ProductService] Gallery saved:', {
      id: savedGallery.id,
      mainImageId: savedGallery.mainImageId,
      thumbnailImageId: savedGallery.thumbnailImageId,
    });

    // Entity Manager'ı refresh et - cache sorununu çözmek için
    await this.productGalleryRepository.manager.connection.queryResultCache?.clear();

    // Relation'ları yükle - Query Builder kullanarak cache'i bypass et
    console.log('[ProductService] Loading relations with QueryBuilder...');

    const galleryWithRelations = await this.productGalleryRepository
      .createQueryBuilder('gallery')
      .where('gallery.id = :id', { id: savedGallery.id })
      .leftJoinAndSelect('gallery.product', 'product')
      .leftJoinAndSelect('gallery.variantCombination', 'variantCombination')
      .leftJoinAndSelect('gallery.mainImage', 'mainImage')
      .leftJoinAndSelect('gallery.thumbnailImage', 'thumbnailImage')
      .leftJoinAndSelect('gallery.detailImages', 'detailImages')
      .cache(false) // Cache'i devre dışı bırak
      .getOne();

    if (!galleryWithRelations) {
      console.error('[ProductService] ERROR: Gallery not found after save!');
      throw new NotFoundException('ProductGallery güncellendi ancak yüklenemedi');
    }

    console.log('[ProductService] Gallery with relations loaded:', {
      id: galleryWithRelations.id,
      mainImageId: galleryWithRelations.mainImageId,
      mainImage: galleryWithRelations.mainImage ? {
        id: galleryWithRelations.mainImage.id,
        filename: galleryWithRelations.mainImage.filename,
      } : null,
      thumbnailImageId: galleryWithRelations.thumbnailImageId,
      thumbnailImage: galleryWithRelations.thumbnailImage ? {
        id: galleryWithRelations.thumbnailImage.id,
        filename: galleryWithRelations.thumbnailImage.filename,
      } : null,
      detailImagesCount: galleryWithRelations.detailImages?.length || 0,
    });

    // Eğer relation'lar hala eski değerleri gösteriyorsa, manuel olarak düzelt
    // (TypeORM cache sorunu için fallback)
    if (galleryWithRelations.mainImageId !== savedGallery.mainImageId) {
      console.warn('[ProductService] WARNING: mainImageId mismatch after reload, fixing manually...');
      console.warn('[ProductService] Expected:', savedGallery.mainImageId, 'Got:', galleryWithRelations.mainImageId);
      const correctMainImage = await this.uploadRepository.findOne({
        where: { id: savedGallery.mainImageId },
      });
      if (correctMainImage) {
        galleryWithRelations.mainImage = correctMainImage;
        galleryWithRelations.mainImageId = savedGallery.mainImageId;
        console.log('[ProductService] Fixed mainImage relation manually');
      }
    }

    if (galleryWithRelations.thumbnailImageId !== savedGallery.thumbnailImageId) {
      console.warn('[ProductService] WARNING: thumbnailImageId mismatch after reload, fixing manually...');
      console.warn('[ProductService] Expected:', savedGallery.thumbnailImageId, 'Got:', galleryWithRelations.thumbnailImageId);
      const correctThumbnailImage = await this.uploadRepository.findOne({
        where: { id: savedGallery.thumbnailImageId },
      });
      if (correctThumbnailImage) {
        galleryWithRelations.thumbnailImage = correctThumbnailImage;
        galleryWithRelations.thumbnailImageId = savedGallery.thumbnailImageId;
        console.log('[ProductService] Fixed thumbnailImage relation manually');
      }
    }

    console.log('[ProductService] Final gallery state:', {
      id: galleryWithRelations.id,
      mainImageId: galleryWithRelations.mainImageId,
      mainImage: galleryWithRelations.mainImage ? {
        id: galleryWithRelations.mainImage.id,
        filename: galleryWithRelations.mainImage.filename,
      } : null,
      thumbnailImageId: galleryWithRelations.thumbnailImageId,
      thumbnailImage: galleryWithRelations.thumbnailImage ? {
        id: galleryWithRelations.thumbnailImage.id,
        filename: galleryWithRelations.thumbnailImage.filename,
      } : null,
    });
    console.log('[ProductService] updateProductGallery - END');

    return galleryWithRelations;
  }

  /**
   * ProductGallery'yi siler
   */
  async removeProductGallery(id: string): Promise<void> {
    const productGallery = await this.findProductGallery(id);
    await this.productGalleryRepository.remove(productGallery);
  }

  /**
   * Tüm ürün verilerini temizler (reset)
   * Silinecekler:
   * - Products
   * - VariantCombinations
   * - VariantOptions
   * - VariantValues
   * - ProductGalleries
   * - Stocks (PRODUCT ve VARIANT_COMBINATION tipindeki)
   * - BundleItems
   * 
   * Dokunulmayacaklar:
   * - Users
   * - Categories
   * - Tags
   * - Uploads
   */
  async resetAllProducts(): Promise<{
    deletedProducts: number;
    deletedVariantCombinations: number;
    deletedVariantOptions: number;
    deletedVariantValues: number;
    deletedProductGalleries: number;
    deletedStocks: number;
    deletedBundleItems: number;
  }> {
    console.log('[ProductService] resetAllProducts - START');

    // Transaction içinde tüm işlemleri yap
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let deletedProducts = 0;
      let deletedVariantCombinations = 0;
      let deletedVariantOptions = 0;
      let deletedVariantValues = 0;
      let deletedProductGalleries = 0;
      let deletedStocks = 0;
      let deletedBundleItems = 0;

      // 1. BundleItems sil (CASCADE ile Products silinince otomatik silinir ama manuel de silebiliriz)
      console.log('[ProductService] Deleting BundleItems...');
      const bundleItemsResult = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from('bundle_items')
        .execute();
      deletedBundleItems = bundleItemsResult.affected || 0;
      console.log(`[ProductService] Deleted ${deletedBundleItems} BundleItems`);

      // 2. ProductGalleries sil
      console.log('[ProductService] Deleting ProductGalleries...');
      const galleriesResult = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from('product_galleries')
        .execute();
      deletedProductGalleries = galleriesResult.affected || 0;
      console.log(`[ProductService] Deleted ${deletedProductGalleries} ProductGalleries`);

      // 3. Stocks sil (PRODUCT ve VARIANT_COMBINATION tipindeki)
      console.log('[ProductService] Deleting Stocks (PRODUCT and VARIANT_COMBINATION)...');
      const stocksResult = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from('stocks')
        .where('sellableType IN (:...types)', { types: ['PRODUCT', 'VARIANT_COMBINATION'] })
        .execute();
      deletedStocks = stocksResult.affected || 0;
      console.log(`[ProductService] Deleted ${deletedStocks} Stocks`);

      // 4. variant_combination_values join table'ını sil (ManyToMany ilişki tablosu)
      console.log('[ProductService] Deleting variant_combination_values join table...');
      const variantCombinationValuesResult = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from('variant_combination_values')
        .execute();
      const deletedVariantCombinationValues = variantCombinationValuesResult.affected || 0;
      console.log(`[ProductService] Deleted ${deletedVariantCombinationValues} variant_combination_values records`);

      // 5. VariantCombinations sil (join table silindikten sonra)
      console.log('[ProductService] Deleting VariantCombinations...');
      const variantCombinationsResult = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from('variant_combinations')
        .execute();
      deletedVariantCombinations = variantCombinationsResult.affected || 0;
      console.log(`[ProductService] Deleted ${deletedVariantCombinations} VariantCombinations`);

      // 6. VariantValues sil (CASCADE ile VariantOptions silinince otomatik silinir)
      console.log('[ProductService] Deleting VariantValues...');
      const variantValuesResult = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from('variant_values')
        .execute();
      deletedVariantValues = variantValuesResult.affected || 0;
      console.log(`[ProductService] Deleted ${deletedVariantValues} VariantValues`);

      // 7. VariantOptions sil (CASCADE ile Products silinince otomatik silinir ama manuel de silebiliriz)
      console.log('[ProductService] Deleting VariantOptions...');
      const variantOptionsResult = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from('variant_options')
        .execute();
      deletedVariantOptions = variantOptionsResult.affected || 0;
      console.log(`[ProductService] Deleted ${deletedVariantOptions} VariantOptions`);

      // 8. Products sil (en son, çünkü diğerleri CASCADE ile silinebilir)
      console.log('[ProductService] Deleting Products...');
      const productsResult = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from('products')
        .execute();
      deletedProducts = productsResult.affected || 0;
      console.log(`[ProductService] Deleted ${deletedProducts} Products`);

      // Transaction'ı commit et
      await queryRunner.commitTransaction();

      const result = {
        deletedProducts,
        deletedVariantCombinations,
        deletedVariantOptions,
        deletedVariantValues,
        deletedProductGalleries,
        deletedStocks,
        deletedBundleItems,
      };

      console.log('[ProductService] resetAllProducts - SUCCESS:', result);
      return result;
    } catch (error) {
      // Hata olursa rollback
      await queryRunner.rollbackTransaction();
      console.error('[ProductService] resetAllProducts - ERROR:', error);
      throw error;
    } finally {
      // QueryRunner'ı serbest bırak
      await queryRunner.release();
    }
  }

  // ==================== VARIANT OPTION METHODS ====================

  /**
   * Varyasyon seçeneği oluştur
   */
  async createVariantOption(
    productId: string,
    createVariantOptionDto: CreateVariantOptionDto,
  ): Promise<VariantOption> {
    // Ürünün var olduğunu kontrol et
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    if (product.type !== ProductType.VARIANT) {
      throw new BadRequestException('Bu ürün varyasyonlu ürün değil');
    }

    const variantOption = this.variantOptionRepository.create({
      ...createVariantOptionDto,
      productId,
      displayOrder: createVariantOptionDto.displayOrder ?? 0,
      isRequired: createVariantOptionDto.isRequired ?? true,
    });

    return await this.variantOptionRepository.save(variantOption);
  }

  /**
   * Ürünün tüm varyasyon seçeneklerini getir
   */
  async getVariantOptionsByProduct(productId: string): Promise<VariantOption[]> {
    return await this.variantOptionRepository.find({
      where: { productId },
      relations: ['values'],
      order: { displayOrder: 'ASC' },
    });
  }

  /**
   * Varyasyon seçeneğini güncelle
   */
  async updateVariantOption(
    id: string,
    updateVariantOptionDto: UpdateVariantOptionDto,
  ): Promise<VariantOption> {
    const variantOption = await this.variantOptionRepository.findOne({
      where: { id },
    });

    if (!variantOption) {
      throw new NotFoundException('Varyasyon seçeneği bulunamadı');
    }

    Object.assign(variantOption, updateVariantOptionDto);
    return await this.variantOptionRepository.save(variantOption);
  }

  /**
   * Varyasyon seçeneğini sil
   * Not: Bu seçeneğe ait tüm değerler ve bu değerleri içeren tüm kombinasyonlar da silinir
   */
  async deleteVariantOption(id: string): Promise<void> {
    const variantOption = await this.variantOptionRepository.findOne({
      where: { id },
      relations: ['values'],
    });

    if (!variantOption) {
      throw new NotFoundException('Varyasyon seçeneği bulunamadı');
    }

    // Bu seçeneğe ait tüm değerleri al (eğer relation yüklenmediyse manuel yükle)
    let variantValues = variantOption.values || [];
    if (!variantValues || variantValues.length === 0) {
      variantValues = await this.variantValueRepository.find({
        where: { variantOptionId: id },
      });
    }

    // Her değer için, o değeri içeren tüm kombinasyonları bul ve sil
    for (const variantValue of variantValues) {
      const valueId = typeof variantValue === 'string' ? variantValue : variantValue.id;

      // Bu değeri içeren tüm kombinasyonları bul
      const combinationsToDelete = await this.variantCombinationRepository
        .createQueryBuilder('combination')
        .innerJoin('combination.variantValues', 'value')
        .where('value.id = :valueId', { valueId })
        .leftJoinAndSelect('combination.stock', 'stock')
        .getMany();

      // Her kombinasyon için stok kaydını sil
      for (const combination of combinationsToDelete) {
        if (combination.stock) {
          await this.stockRepository.remove(combination.stock);
        }
      }

      // Kombinasyonları sil
      if (combinationsToDelete.length > 0) {
        await this.variantCombinationRepository.remove(combinationsToDelete);
      }
    }

    // Varyasyon seçeneğini sil (CASCADE ile değerler de silinir)
    await this.variantOptionRepository.remove(variantOption);
  }

  // ==================== VARIANT VALUE METHODS ====================

  /**
   * Varyasyon değeri oluştur
   */
  async createVariantValue(
    variantOptionId: string,
    createVariantValueDto: CreateVariantValueDto,
  ): Promise<VariantValue> {
    // Varyasyon seçeneğinin var olduğunu kontrol et
    const variantOption = await this.variantOptionRepository.findOne({
      where: { id: variantOptionId },
    });

    if (!variantOption) {
      throw new NotFoundException('Varyasyon seçeneği bulunamadı');
    }

    // COLOR tipinde colorCode zorunlu
    if (variantOption.type === 'COLOR' && !createVariantValueDto.colorCode) {
      throw new BadRequestException('Renk tipi varyasyonlar için renk kodu zorunludur');
    }

    const variantValue = this.variantValueRepository.create({
      ...createVariantValueDto,
      variantOptionId,
      priceDelta: createVariantValueDto.priceDelta ?? 0,
      isActive: createVariantValueDto.isActive ?? true,
      displayOrder: createVariantValueDto.displayOrder ?? 0,
    });

    return await this.variantValueRepository.save(variantValue);
  }

  /**
   * Varyasyon seçeneğinin tüm değerlerini getir
   */
  async getVariantValuesByOption(variantOptionId: string): Promise<VariantValue[]> {
    return await this.variantValueRepository.find({
      where: { variantOptionId },
      order: { displayOrder: 'ASC' },
    });
  }

  /**
   * Varyasyon değerini güncelle
   */
  async updateVariantValue(
    id: string,
    updateVariantValueDto: UpdateVariantValueDto,
  ): Promise<VariantValue> {
    const variantValue = await this.variantValueRepository.findOne({
      where: { id },
      relations: ['variantOption'],
    });

    if (!variantValue) {
      throw new NotFoundException('Varyasyon değeri bulunamadı');
    }

    // COLOR tipinde colorCode zorunlu
    if (
      variantValue.variantOption.type === 'COLOR' &&
      updateVariantValueDto.colorCode === null
    ) {
      throw new BadRequestException('Renk tipi varyasyonlar için renk kodu zorunludur');
    }

    Object.assign(variantValue, updateVariantValueDto);
    return await this.variantValueRepository.save(variantValue);
  }

  /**
   * Varyasyon değerini sil
   * Not: Bu değeri içeren tüm varyasyon kombinasyonları da silinir
   */
  async deleteVariantValue(id: string): Promise<void> {
    const variantValue = await this.variantValueRepository.findOne({
      where: { id },
    });

    if (!variantValue) {
      throw new NotFoundException('Varyasyon değeri bulunamadı');
    }

    // Bu değeri içeren tüm kombinasyonları bul
    // ManyToMany relation üzerinden sorgu yapıyoruz
    const combinationsToDelete = await this.variantCombinationRepository
      .createQueryBuilder('combination')
      .innerJoin('combination.variantValues', 'value')
      .where('value.id = :valueId', { valueId: id })
      .leftJoinAndSelect('combination.stock', 'stock')
      .getMany();

    // Her kombinasyon için stok kaydını sil
    for (const combination of combinationsToDelete) {
      if (combination.stock) {
        await this.stockRepository.remove(combination.stock);
      }
    }

    // Kombinasyonları sil
    if (combinationsToDelete.length > 0) {
      await this.variantCombinationRepository.remove(combinationsToDelete);
    }

    // Varyasyon değerini sil
    await this.variantValueRepository.remove(variantValue);
  }

  // ==================== VARIANT COMBINATION METHODS ====================

  /**
   * Tüm varyasyon kombinasyonlarını otomatik oluştur (Cartesian Product)
   */
  async generateAllVariantCombinations(productId: string): Promise<VariantCombination[]> {
    // Ürünün var olduğunu kontrol et
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    if (product.type !== ProductType.VARIANT) {
      throw new BadRequestException('Bu ürün varyasyonlu ürün değil');
    }

    // Tüm varyasyon seçeneklerini ve aktif değerlerini getir
    const variantOptions = await this.variantOptionRepository.find({
      where: { productId },
      relations: ['values'],
      order: { displayOrder: 'ASC' },
    });

    if (variantOptions.length === 0) {
      throw new BadRequestException('Varyasyon seçeneği bulunamadı');
    }

    // Her seçenek için aktif değerleri filtrele
    const activeValuesByOption = variantOptions.map((option) =>
      option.values.filter((value) => value.isActive),
    );

    // Eğer bir seçenekte aktif değer yoksa hata ver
    if (activeValuesByOption.some((values) => values.length === 0)) {
      throw new BadRequestException('Tüm varyasyon seçeneklerinde en az bir aktif değer olmalıdır');
    }

    // Cartesian Product hesapla
    const combinations: VariantValue[][] = [];
    const generateCombinations = (current: VariantValue[], remaining: VariantValue[][]) => {
      if (remaining.length === 0) {
        combinations.push([...current]);
        return;
      }

      const [first, ...rest] = remaining;
      for (const value of first) {
        generateCombinations([...current, value], rest);
      }
    };

    generateCombinations([], activeValuesByOption);

    // Mevcut kombinasyonları kontrol et
    const existingCombinations = await this.variantCombinationRepository.find({
      where: { productId },
      relations: ['variantValues'],
    });

    // Yeni kombinasyonları oluştur
    const newCombinations: VariantCombination[] = [];

    for (const variantValues of combinations) {
      // Bu kombinasyon zaten var mı kontrol et - her varyasyon seçeneğinden bir değer olmalı
      const variantValueIds = variantValues.map((v) => v.id).sort();
      const exists = existingCombinations.some((existing) => {
        if (!existing.variantValues || existing.variantValues.length === 0) {
          return false;
        }
        const existingIds = existing.variantValues.map((v) => v.id).sort();
        // Aynı sayıda değer ve aynı ID'ler olmalı
        if (existingIds.length !== variantValueIds.length) {
          return false;
        }
        return existingIds.every((id, index) => id === variantValueIds[index]);
      });

      if (!exists) {
        const combination = this.variantCombinationRepository.create({
          productId,
          variantValues,
          isActive: true,
          isDisabled: false,
        });
        newCombinations.push(combination);
      }
    }

    // Yeni kombinasyonları kaydet
    if (newCombinations.length > 0) {
      const savedCombinations = await this.variantCombinationRepository.save(newCombinations);

      // Her kombinasyon için stock kaydı oluştur (eğer yoksa)
      for (const combination of savedCombinations) {
        // Stock zaten var mı kontrol et
        const existingStock = await this.stockRepository.findOne({
          where: {
            sellableType: SellableType.VARIANT_COMBINATION,
            sellableId: combination.id,
          },
        });

        if (!existingStock) {
          // Stock oluştur - productId unique constraint'i nedeniyle null bırakıyoruz
          // Çünkü VARIANT_COMBINATION için aynı productId'ye sahip birden fazla stock olabilir
          const stock = this.stockRepository.create({
            sellableType: SellableType.VARIANT_COMBINATION,
            sellableId: combination.id,
            productId: null, // Unique constraint hatası vermemesi için null
            variantCombinationId: combination.id,
            availableQuantity: 0,
            reservedQuantity: 0,
          });
          await this.stockRepository.save(stock);
        }
      }
    }

    // Tüm kombinasyonları döndür
    return await this.variantCombinationRepository.find({
      where: { productId },
      relations: [
        'variantValues',
        'variantValues.variantOption',
        'galleries',
        'galleries.mainImage',
        'galleries.thumbnailImage',
        'galleries.detailImages',
        'stock',
      ],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Ürünün tüm varyasyon kombinasyonlarını getir
   */
  async getVariantCombinationsByProduct(
    productId: string,
  ): Promise<VariantCombination[]> {
    return await this.variantCombinationRepository.find({
      where: { productId },
      relations: [
        'variantValues',
        'variantValues.variantOption',
        'galleries',
        'galleries.mainImage',
        'galleries.thumbnailImage',
        'galleries.detailImages',
        'stock',
      ],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Varyasyon kombinasyonu oluştur
   */
  async createVariantCombination(
    productId: string,
    createVariantCombinationDto: CreateVariantCombinationDto,
  ): Promise<VariantCombination> {
    // Ürünün var olduğunu kontrol et
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    if (product.type !== ProductType.VARIANT) {
      throw new BadRequestException('Bu ürün varyasyonlu ürün değil');
    }

    // Varyasyon değerlerini yükle
    const variantValues = await this.variantValueRepository.find({
      where: { id: In(createVariantCombinationDto.variantValueIds) },
      relations: ['variantOption'],
    });

    if (variantValues.length !== createVariantCombinationDto.variantValueIds.length) {
      throw new NotFoundException('Bazı varyasyon değerleri bulunamadı');
    }

    // Aynı seçenekten birden fazla değer seçilmiş mi kontrol et
    const optionIds = variantValues.map((v) => v.variantOption.id);
    if (new Set(optionIds).size !== optionIds.length) {
      throw new BadRequestException('Aynı varyasyon seçeneğinden birden fazla değer seçilemez');
    }

    // Bu kombinasyon zaten var mı kontrol et
    const existingCombinations = await this.variantCombinationRepository.find({
      where: { productId },
      relations: ['variantValues'],
    });

    const variantValueIds = variantValues.map((v) => v.id).sort();
    const combinationExists = existingCombinations.some((existing) => {
      if (!existing.variantValues || existing.variantValues.length === 0) {
        return false;
      }
      const existingIds = existing.variantValues.map((v) => v.id).sort();
      if (existingIds.length !== variantValueIds.length) {
        return false;
      }
      return existingIds.every((id, index) => id === variantValueIds[index]);
    });

    if (combinationExists) {
      throw new ConflictException('Bu varyasyon kombinasyonu zaten mevcut');
    }

    // SKU kontrolü
    if (createVariantCombinationDto.sku) {
      const existingCombination = await this.variantCombinationRepository.findOne({
        where: { sku: createVariantCombinationDto.sku },
      });

      if (existingCombination) {
        throw new ConflictException('Bu SKU zaten kullanılıyor');
      }
    }

    const combination = this.variantCombinationRepository.create({
      productId,
      variantValues,
      sku: createVariantCombinationDto.sku || null,
      isActive: createVariantCombinationDto.isActive ?? true,
      isDisabled: createVariantCombinationDto.isDisabled ?? false,
    });

    const savedCombination = await this.variantCombinationRepository.save(combination);

    // Stock kaydı oluştur (eğer yoksa)
    const existingStock = await this.stockRepository.findOne({
      where: {
        sellableType: SellableType.VARIANT_COMBINATION,
        sellableId: savedCombination.id,
      },
    });

    if (!existingStock) {
      // Stock oluştur - productId unique constraint'i nedeniyle null bırakıyoruz
      // VARIANT_COMBINATION için variantCombinationId unique olduğu için yeterli
      const stock = this.stockRepository.create({
        sellableType: SellableType.VARIANT_COMBINATION,
        sellableId: savedCombination.id,
        productId: null, // Unique constraint hatası vermemesi için null
        variantCombinationId: savedCombination.id,
        availableQuantity: 0,
        reservedQuantity: 0,
      });
      await this.stockRepository.save(stock);
    }

    const result = await this.variantCombinationRepository.findOne({
      where: { id: savedCombination.id },
      relations: [
        'variantValues',
        'variantValues.variantOption',
        'galleries',
        'galleries.mainImage',
        'galleries.thumbnailImage',
        'galleries.detailImages',
        'stock',
      ],
    });

    if (!result) {
      throw new NotFoundException('Varyasyon kombinasyonu oluşturulduktan sonra bulunamadı');
    }

    return result;
  }

  /**
   * Varyasyon kombinasyonunu güncelle
   */
  async updateVariantCombination(
    id: string,
    updateVariantCombinationDto: UpdateVariantCombinationDto,
  ): Promise<VariantCombination> {
    const combination = await this.variantCombinationRepository.findOne({
      where: { id },
      relations: ['variantValues'],
    });

    if (!combination) {
      throw new NotFoundException('Varyasyon kombinasyonu bulunamadı');
    }

    // Varyasyon değerleri güncelleniyorsa
    if (updateVariantCombinationDto.variantValueIds) {
      const variantValues = await this.variantValueRepository.find({
        where: { id: In(updateVariantCombinationDto.variantValueIds) },
        relations: ['variantOption'],
      });

      if (variantValues.length !== updateVariantCombinationDto.variantValueIds.length) {
        throw new NotFoundException('Bazı varyasyon değerleri bulunamadı');
      }

      // Aynı seçenekten birden fazla değer seçilmiş mi kontrol et
      const optionIds = variantValues.map((v) => v.variantOption.id);
      if (new Set(optionIds).size !== optionIds.length) {
        throw new BadRequestException('Aynı varyasyon seçeneğinden birden fazla değer seçilemez');
      }

      combination.variantValues = variantValues;
    }

    // SKU kontrolü
    if (
      updateVariantCombinationDto.sku &&
      updateVariantCombinationDto.sku !== combination.sku
    ) {
      const existingCombination = await this.variantCombinationRepository.findOne({
        where: { sku: updateVariantCombinationDto.sku },
      });

      if (existingCombination) {
        throw new ConflictException('Bu SKU zaten kullanılıyor');
      }
    }

    // Diğer alanları güncelle
    if (updateVariantCombinationDto.sku !== undefined) {
      combination.sku = updateVariantCombinationDto.sku;
    }
    if (updateVariantCombinationDto.isActive !== undefined) {
      combination.isActive = updateVariantCombinationDto.isActive;
    }
    if (updateVariantCombinationDto.isDisabled !== undefined) {
      combination.isDisabled = updateVariantCombinationDto.isDisabled;
    }

    await this.variantCombinationRepository.save(combination);

    const result = await this.variantCombinationRepository.findOne({
      where: { id },
      relations: [
        'variantValues',
        'variantValues.variantOption',
        'galleries',
        'galleries.mainImage',
        'galleries.thumbnailImage',
        'galleries.detailImages',
        'stock',
      ],
    });

    if (!result) {
      throw new NotFoundException('Varyasyon kombinasyonu güncellendikten sonra bulunamadı');
    }

    return result;
  }

  /**
   * Varyasyon kombinasyonunu sil - DEVRE DIŞI
   * Not: Varyasyon kombinasyonları silinemez çünkü bir kombinasyon yoksa sistem çalışmaz
   */
  // async deleteVariantCombination(id: string): Promise<void> {
  //   throw new BadRequestException('Varyasyon kombinasyonları silinemez');
  // }

  /**
   * Ürünün toplam stokunu hesapla (tüm kombinasyonların stoklarının toplamı)
   */
  async getProductTotalStock(productId: string): Promise<{
    totalAvailable: number;
    totalReserved: number;
    totalAvailableAfterReserve: number;
    combinations: Array<{
      combinationId: string;
      availableQuantity: number;
      reservedQuantity: number;
    }>;
  }> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    if (product.type !== ProductType.VARIANT) {
      throw new BadRequestException('Bu ürün varyasyonlu ürün değil');
    }

    // Tüm kombinasyonları ve stoklarını getir
    const combinations = await this.variantCombinationRepository.find({
      where: { productId },
      relations: ['stock'],
    });

    let totalAvailable = 0;
    let totalReserved = 0;

    const combinationStocks = combinations.map((combination) => {
      const available = combination.stock?.availableQuantity || 0;
      const reserved = combination.stock?.reservedQuantity || 0;
      totalAvailable += available;
      totalReserved += reserved;

      return {
        combinationId: combination.id,
        availableQuantity: available,
        reservedQuantity: reserved,
      };
    });

    return {
      totalAvailable,
      totalReserved,
      totalAvailableAfterReserve: totalAvailable - totalReserved,
      combinations: combinationStocks,
    };
  }
}
