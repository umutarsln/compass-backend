import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, In } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { Product } from '../product/product.entity';
import { VariantCombination } from '../product/variant-combination.entity';
import { VariantOption } from '../product/variant-option.entity';
import { VariantValue } from '../product/variant-value.entity';
import { Category } from '../category/category.entity';
import { Tag } from '../tag/tag.entity';
import { Stock } from '../stock/stock.entity';
import { StoreProductQueryDto, StoreProductOrderBy } from './dto/store-product-query.dto';
import { StoreProductDto, StoreProductListResponseDto, StoreProductGalleryDto } from './dto/store-product-response.dto';
import { StoreProductDetailResponseDto, StoreVariantOptionDto, StoreVariantCombinationDto } from './dto/store-product-detail-response.dto';
import { ProductType } from '../common/enums/product-type.enum';
import { generateSlug } from '../common/utils/slug.util';
import { PersonalizationService } from '../personalization/personalization.service';

@Injectable()
export class StoreService {
    private readonly CACHE_PREFIX = 'store:';
    private readonly CACHE_TTL = 3600; // 1 saat (saniye)

    constructor(
        @InjectRepository(Product)
        private productRepository: Repository<Product>,
        @InjectRepository(VariantCombination)
        private variantCombinationRepository: Repository<VariantCombination>,
        @InjectRepository(VariantOption)
        private variantOptionRepository: Repository<VariantOption>,
        @InjectRepository(Category)
        private categoryRepository: Repository<Category>,
        @InjectRepository(Tag)
        private tagRepository: Repository<Tag>,
        private personalizationService: PersonalizationService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private configService: ConfigService,
    ) { }

    /**
     * Mağaza için ürünleri getir
     * Basit ürünler ve varyasyonlu ürünlerin aktif kombinasyonları ayrı ürünler olarak döner
     */
    async getProducts(query: StoreProductQueryDto): Promise<StoreProductListResponseDto> {
        const {
            search,
            categorySlugs,
            tagSlugs,
            minPrice,
            maxPrice,
            orderBy = 'created_at_desc',
            page = 1,
            limit = 20,
        } = query;

        // Cache key oluştur
        const cacheKey = `${this.CACHE_PREFIX}products:${JSON.stringify(query)}`;


        // Cache'den kontrol et
        const cached = await this.cacheManager.get<StoreProductListResponseDto>(cacheKey);
        if (cached) {
            return cached;
        }

        // Kategori slug'larını ID'lere çevir ve tüm parent/child ID'lerini topla
        let allCategoryIds: string[] = [];
        if (categorySlugs) {
            const selectedCategorySlugs = categorySlugs.split(',').map((slug) => slug.trim()).filter(Boolean);
            allCategoryIds = await this.expandCategorySlugs(selectedCategorySlugs);
        }

        // Tag slug'larını ID'lere çevir
        let tagIds: string[] = [];
        if (tagSlugs) {
            const selectedTagSlugs = tagSlugs.split(',').map((slug) => slug.trim()).filter(Boolean);
            const tags = await this.tagRepository.find({
                where: { slug: In(selectedTagSlugs) },
            });
            tagIds = tags.map(tag => tag.id);
        }

        // Basit ürünleri getir
        const simpleProducts = await this.getSimpleProducts({
            search,
            categoryIds: allCategoryIds.length > 0 ? allCategoryIds.join(',') : undefined,
            tagIds: tagIds.length > 0 ? tagIds.join(',') : undefined,
            minPrice: undefined, // Fiyat filtresini sonra uygulayacağız
            maxPrice: undefined,
        });

        // Varyasyonlu ürünlerin kombinasyonlarını getir
        const variantProducts = await this.getVariantCombinations({
            search,
            categoryIds: allCategoryIds.length > 0 ? allCategoryIds.join(',') : undefined,
            tagIds: tagIds.length > 0 ? tagIds.join(',') : undefined,
            minPrice: undefined, // Fiyat filtresini sonra uygulayacağız
            maxPrice: undefined,
        });

        // Tüm ürünleri birleştir (fiyatlar zaten hesaplanmış durumda)
        let allProducts = [...simpleProducts, ...variantProducts];

        // Fiyat filtresi (tüm ürünler üzerinde - discount uygulanmış final fiyatlar üzerinde)
        if (minPrice !== undefined || maxPrice !== undefined) {
            allProducts = allProducts.filter((product) => {
                const finalPrice = typeof product.price === 'number' ? product.price : Number(product.price);

                if (isNaN(finalPrice) || finalPrice < 0) {
                    console.warn(`[StoreService] Invalid price for product ${product.id}:`, product.price);
                    return false;
                }

                if (minPrice !== undefined && finalPrice < minPrice) {
                    return false;
                }
                if (maxPrice !== undefined && finalPrice > maxPrice) {
                    return false;
                }
                return true;
            });
        }

        // Sıralama
        allProducts = this.sortProducts(allProducts, orderBy);

        // Pagination
        const total = allProducts.length;
        const totalPages = Math.ceil(total / limit);
        const skip = (page - 1) * limit;
        const paginatedProducts = allProducts.slice(skip, skip + limit);

        const result = {
            products: paginatedProducts,
            total,
            page,
            limit,
            totalPages,
        };

        // Cache'e kaydet
        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL * 1000);

        return result;
    }

    /**
     * Ürün detayını getir
     * Basit ürünler için direkt detay, varyasyonlu ürünler için varyasyon seçenekleri ve kombinasyonlar
     * productId parametresi UUID, product slug veya variant combination slug olabilir
     */
    async getProductDetail(productId: string): Promise<StoreProductDetailResponseDto> {
        // Cache key oluştur
        const cacheKey = `${this.CACHE_PREFIX}product:${productId}`;

        // Cache'den kontrol et
        const cached = await this.cacheManager.get<StoreProductDetailResponseDto>(cacheKey);
        if (cached) {
            return cached;
        }
        // UUID formatını kontrol et (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);
        let product: Product | null = null;
        let selectedCombinationId: string | null = null; // Slug'dan bulunan kombinasyon ID'si

        if (isUUID) {
            // UUID ise önce product tablosundan dene (SIMPLE ve VARIANT için)
            product = await this.productRepository.findOne({
                where: { id: productId, isActive: true },
                relations: [
                    'categories',
                    'tags',
                    'galleries',
                    'galleries.mainImage',
                    'galleries.thumbnailImage',
                    'galleries.detailImages',
                    'stock',
                ],
            });


            // Eğer bulunamadıysa, variant_combinations tablosundan dene (combination ID olarak)
            if (!product) {
                const combination = await this.variantCombinationRepository.findOne({
                    where: { id: productId, isActive: true, isDisabled: false },
                    relations: ['product'],
                });

                if (combination && combination.product) {
                    product = await this.productRepository.findOne({
                        where: { id: combination.product.id, isActive: true },
                        relations: [
                            'categories',
                            'tags',
                            'galleries',
                            'galleries.mainImage',
                            'galleries.thumbnailImage',
                            'galleries.detailImages',
                            'stock',
                        ],
                    });
                    selectedCombinationId = combination.id; // UUID'den bulunan kombinasyon ID'sini sakla
                }
            }
        } else {

            // Slug ise, önce basit ürün olarak product tablosundan dene
            product = await this.productRepository.findOne({
                where: { slug: productId, isActive: true },
                relations: [
                    'categories',
                    'tags',
                    'galleries',
                    'galleries.mainImage',
                    'galleries.thumbnailImage',
                    'galleries.detailImages',
                    'stock',
                ],
            });


            // Eğer bulunamadıysa, variant_combinations tablosundan dene (combination slug'ı olarak)
            if (!product) {
                const combination = await this.variantCombinationRepository.findOne({
                    where: { slug: productId, isActive: true, isDisabled: false },
                    relations: ['product'],
                });

                if (combination && combination.product) {
                    product = await this.productRepository.findOne({
                        where: { id: combination.product.id, isActive: true },
                        relations: [
                            'categories',
                            'tags',
                            'galleries',
                            'galleries.mainImage',
                            'galleries.thumbnailImage',
                            'galleries.detailImages',
                            'stock',
                        ],
                    });
                    selectedCombinationId = combination.id; // Slug'dan bulunan kombinasyon ID'sini sakla
                }
            }
        }

        if (!product) {
            throw new NotFoundException('Ürün bulunamadı');
        }

        // Get personalization form if exists
        let personalizationForm: {
            formId: string;
            versionId: string;
            version: number;
            schemaSnapshot: any;
        } | null = null;
        if (product.personalizationFormId) {
            const version = await this.personalizationService.getPublishedVersionForProduct(product.id);
            if (version) {
                personalizationForm = {
                    formId: version.formId,
                    versionId: version.id,
                    version: version.version,
                    schemaSnapshot: version.schemaSnapshot,
                };
            }
        }

        // Basit ürün için
        if (product.type === ProductType.SIMPLE) {
            const baseGallery = this.getProductGallery(product);
            const price = this.calculatePrice(product);
            const result: StoreProductDetailResponseDto = {
                productId: product.id,
                name: product.name,
                subtitle: product.subtitle,
                slug: product.slug,
                description: product.description,
                basePrice: Number(product.basePrice),
                discountedPrice: product.discountedPrice ? Number(product.discountedPrice) : null,
                type: 'SIMPLE' as const,
                gallery: baseGallery,
                categories: (product.categories || []).map((cat) => ({
                    id: cat.id,
                    name: cat.name,
                    slug: cat.slug,
                })),
                tags: (product.tags || []).map((tag) => ({
                    id: tag.id,
                    name: tag.name,
                    color: tag.color || null,
                })),
                seoTitle: product.seoTitle,
                seoDescription: product.seoDescription,
                seoKeywords: product.seoKeywords,
                price,
                sku: product.sku,
                stock: {
                    availableQuantity: product.stock?.availableQuantity || 0,
                    reservedQuantity: product.stock?.reservedQuantity || 0,
                    usableQuantity:
                        (product.stock?.availableQuantity || 0) - (product.stock?.reservedQuantity || 0),
                },
                variantOptions: null,
                variantCombinations: null,
                selectedCombination: null,
                personalizationForm,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
            };

            // Cache'e kaydet
            await this.cacheManager.set(cacheKey, result, this.CACHE_TTL * 1000);

            return result;
        }

        // Varyasyonlu ürün için
        // Varyasyon seçeneklerini getir
        const variantOptions = await this.variantOptionRepository.find({
            where: { productId: product.id },
            relations: ['values'],
            order: { displayOrder: 'ASC' },
        });

        // Tüm aktif kombinasyonları getir
        const combinations = await this.variantCombinationRepository.find({
            where: {
                productId: product.id,
                isActive: true,
                isDisabled: false,
            },
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

        // Varyasyon seçeneklerini map et
        const mappedVariantOptions: StoreVariantOptionDto[] = variantOptions.map((option) => ({
            id: option.id,
            name: option.name,
            type: option.type,
            displayOrder: option.displayOrder,
            isRequired: option.isRequired,
            values: (option.values || [])
                .filter((value) => value.isActive)
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((value) => ({
                    id: value.id,
                    value: value.value,
                    colorCode: value.colorCode,
                    priceDelta: Number(value.priceDelta),
                    isActive: value.isActive,
                    displayOrder: value.displayOrder,
                })),
        }));

        // Kombinasyonları map et
        const mappedCombinations: StoreVariantCombinationDto[] = combinations.map((combination) => {
            const price = this.calculateVariantPrice(product, combination);
            const gallery = this.getVariantCombinationGallery(combination, product);

            // priceDelta'ları hesapla
            const totalPriceDelta = this.calculateVariantPriceDelta(combination);

            // basePrice'a priceDelta'ları ekle
            const basePriceWithDelta = Number(product.basePrice) + totalPriceDelta;

            // discountedPrice'a da priceDelta'ları ekle (varsa)
            const discountedPriceWithDelta = product.discountedPrice
                ? Number(product.discountedPrice) + totalPriceDelta
                : null;

            return {
                id: combination.id,
                slug: combination.slug,
                sku: combination.sku,
                isActive: combination.isActive,
                isDisabled: combination.isDisabled,
                price,
                basePrice: Math.round(basePriceWithDelta * 100) / 100,
                discountedPrice: discountedPriceWithDelta ? Math.round(discountedPriceWithDelta * 100) / 100 : null,
                stock: {
                    availableQuantity: combination.stock?.availableQuantity || 0,
                    reservedQuantity: combination.stock?.reservedQuantity || 0,
                    usableQuantity:
                        (combination.stock?.availableQuantity || 0) -
                        (combination.stock?.reservedQuantity || 0),
                },
                gallery,
                variantValues: (combination.variantValues || []).map((value) => ({
                    id: value.id,
                    value: value.value,
                    colorCode: value.colorCode,
                    variantOption: {
                        id: value.variantOption.id,
                        name: value.variantOption.name,
                        type: value.variantOption.type,
                    },
                })),
            };
        });

        // Seçili kombinasyonu bul (slug'dan bulunan kombinasyon ID'sine göre)
        let selectedCombination: StoreVariantCombinationDto | null = null;
        let displayGallery: StoreProductGalleryDto;

        if (selectedCombinationId) {
            selectedCombination = mappedCombinations.find(c => c.id === selectedCombinationId) || null;

            // Eğer seçili kombinasyon varsa, önce onun galerisi var mı kontrol et
            if (selectedCombination) {
                const selectedCombinationEntity = combinations.find(c => c.id === selectedCombinationId);
                if (selectedCombinationEntity) {
                    // Kombinasyonun kendi galerisi var mı kontrol et
                    const hasCombinationGallery =
                        selectedCombinationEntity.galleries &&
                        selectedCombinationEntity.galleries.length > 0;

                    if (hasCombinationGallery) {
                        // Kombinasyonun galerisi varsa, direkt onu kullan (base gallery hesaplamaya gerek yok)
                        // getVariantCombinationGallery içinde zaten kombinasyonun galerisini döndürür, getProductGallery çağırmaz
                        displayGallery = this.getVariantCombinationGallery(selectedCombinationEntity, product);
                    } else {
                        // Kombinasyonun galerisi yoksa, base gallery'yi hesapla
                        displayGallery = this.getProductGallery(product);
                    }
                } else {
                    // Entity bulunamadıysa base gallery kullan
                    displayGallery = this.getProductGallery(product);
                }
            } else {
                // Seçili kombinasyon bulunamadıysa base gallery kullan
                displayGallery = this.getProductGallery(product);
            }
        } else {
            // Seçili kombinasyon yoksa base gallery kullan
            displayGallery = this.getProductGallery(product);
        }

        const result: StoreProductDetailResponseDto = {
            productId: product.id,
            name: product.name,
            subtitle: product.subtitle,
            slug: product.slug,
            description: product.description,
            basePrice: Number(product.basePrice),
            discountedPrice: product.discountedPrice ? Number(product.discountedPrice) : null,
            type: 'VARIANT' as const,
            gallery: displayGallery,
            categories: (product.categories || []).map((cat) => ({
                id: cat.id,
                name: cat.name,
                slug: cat.slug,
            })),
            tags: (product.tags || []).map((tag) => ({
                id: tag.id,
                name: tag.name,
                color: tag.color || null,
            })),
            seoTitle: product.seoTitle,
            seoDescription: product.seoDescription,
            seoKeywords: product.seoKeywords,
            price: null,
            sku: null,
            stock: null,
            variantOptions: mappedVariantOptions,
            variantCombinations: mappedCombinations,
            selectedCombination,
            personalizationForm,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
        };

        // Cache'e kaydet
        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL * 1000);

        return result;
    }

    /**
     * Kategorileri hiyerarşik ve orderlanmış şekilde getir
     */
    async getCategories(): Promise<Category[]> {
        const cacheKey = `${this.CACHE_PREFIX}categories`;

        // Cache'den kontrol et
        const cached = await this.cacheManager.get<Category[]>(cacheKey);
        if (cached) {
            return cached;
        }

        const allCategories = await this.categoryRepository.find({
            where: { isActive: true },
            relations: ['parent', 'children', 'image'],
            order: { displayOrder: 'ASC', createdAt: 'DESC' },
        });

        // Root kategorileri bul (parentId null olanlar)
        const rootCategories = allCategories.filter((c) => !c.parentId);

        // Her root kategori için children'ları ekle
        const buildTree = (parent: Category): Category => {
            const children = allCategories
                .filter((c) => c.parentId === parent.id)
                .sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.getTime() - b.createdAt.getTime());
            return {
                ...parent,
                children: children.map((child) => buildTree(child)),
            };
        };

        const result = rootCategories.map((root) => buildTree(root));

        // Cache'e kaydet
        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL * 1000);

        return result;
    }

    /**
     * Tag'leri renkleriyle birlikte getir
     */
    async getTags(): Promise<Tag[]> {
        const cacheKey = `${this.CACHE_PREFIX}tags`;

        // Cache'den kontrol et
        const cached = await this.cacheManager.get<Tag[]>(cacheKey);
        if (cached) {
            return cached;
        }

        const result = await this.tagRepository.find({
            order: { createdAt: 'DESC' },
        });

        // Cache'e kaydet
        await this.cacheManager.set(cacheKey, result, this.CACHE_TTL * 1000);

        return result;
    }

    /**
     * Kategori slug'larını ID'lere çevir ve genişlet - seçilen kategorilerin tüm parent ve child'larını dahil et
     */
    private async expandCategorySlugs(categorySlugs: string[]): Promise<string[]> {
        if (categorySlugs.length === 0) return [];

        // Slug'lara göre kategorileri bul
        const categories = await this.categoryRepository.find({
            where: { slug: In(categorySlugs) },
            relations: ['parent', 'children'],
        });

        if (categories.length === 0) return [];

        const categoryIds = categories.map(cat => cat.id);

        // Tüm kategorileri yükle (parent/child ilişkileri için)
        const allCategories = await this.categoryRepository.find({
            relations: ['parent', 'children'],
        });

        const categoryMap = new Map<string, { parentId: string | null; childrenIds: string[] }>();
        allCategories.forEach(cat => {
            categoryMap.set(cat.id, {
                parentId: cat.parentId,
                childrenIds: cat.children?.map(c => c.id) || [],
            });
        });

        const expandedIds = new Set<string>();

        // Her seçili kategori için:
        for (const categoryId of categoryIds) {
            expandedIds.add(categoryId);

            // Tüm parent'ları ekle
            let current = categoryMap.get(categoryId);
            while (current?.parentId) {
                expandedIds.add(current.parentId);
                current = categoryMap.get(current.parentId);
            }

            // Tüm children'ları ekle (recursive)
            const addChildren = (id: string) => {
                const cat = categoryMap.get(id);
                if (cat) {
                    cat.childrenIds.forEach(childId => {
                        expandedIds.add(childId);
                        addChildren(childId);
                    });
                }
            };
            addChildren(categoryId);
        }

        return Array.from(expandedIds);
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Basit ürünleri getir
     * Not: Bu metod internal kullanım için categoryIds ve tagIds bekler (slug'lardan çevrilmiş)
     */
    private async getSimpleProducts(params: {
        search?: string;
        categoryIds?: string;
        tagIds?: string;
        minPrice?: number;
        maxPrice?: number;
        orderBy?: StoreProductOrderBy;
        page?: number;
        limit?: number;
    }): Promise<StoreProductDto[]> {
        const { search, categoryIds, tagIds } = params;

        const qb = this.productRepository
            .createQueryBuilder('product')
            .leftJoinAndSelect('product.categories', 'category')
            .leftJoinAndSelect('product.tags', 'tag')
            .leftJoinAndSelect('product.galleries', 'gallery')
            .leftJoinAndSelect('gallery.mainImage', 'mainImage')
            .leftJoinAndSelect('gallery.thumbnailImage', 'thumbnailImage')
            .leftJoinAndSelect('gallery.detailImages', 'detailImages')
            .leftJoinAndSelect('product.stock', 'stock')
            .where('product.type = :type', { type: ProductType.SIMPLE })
            .andWhere('product.isActive = :isActive', { isActive: true });

        if (search) {
            qb.andWhere(
                new Brackets((qb) => {
                    qb.where('product.name ILIKE :search', { search: `%${search}%` })
                        .orWhere('product.description ILIKE :search', { search: `%${search}%` });
                }),
            );
        }

        if (categoryIds) {
            const categoryIdArray = categoryIds.split(',').map((id) => id.trim()).filter(Boolean);
            if (categoryIdArray.length > 0) {
                qb.andWhere('category.id IN (:...categoryIds)', { categoryIds: categoryIdArray });
            }
        }

        if (tagIds) {
            const tagIdArray = tagIds.split(',').map((id) => id.trim()).filter(Boolean);
            if (tagIdArray.length > 0) {
                qb.andWhere('tag.id IN (:...tagIds)', { tagIds: tagIdArray });
            }
        }

        const products = await qb.getMany();
        return products.map((product) => this.mapSimpleProductToStoreProduct(product));
    }

    /**
     * Varyasyonlu ürünlerin aktif kombinasyonlarını getir
     * Not: Bu metod internal kullanım için categoryIds ve tagIds bekler (slug'lardan çevrilmiş)
     */
    private async getVariantCombinations(params: {
        search?: string;
        categoryIds?: string;
        tagIds?: string;
        minPrice?: number;
        maxPrice?: number;
        orderBy?: StoreProductOrderBy;
        page?: number;
        limit?: number;
    }): Promise<StoreProductDto[]> {
        const { search, categoryIds, tagIds } = params;

        const qb = this.variantCombinationRepository
            .createQueryBuilder('combination')
            .leftJoinAndSelect('combination.product', 'product')
            .leftJoinAndSelect('product.categories', 'category')
            .leftJoinAndSelect('product.tags', 'tag')
            .leftJoinAndSelect('combination.variantValues', 'variantValue')
            .leftJoinAndSelect('variantValue.variantOption', 'variantOption')
            .leftJoinAndSelect('combination.galleries', 'gallery')
            .leftJoinAndSelect('gallery.mainImage', 'mainImage')
            .leftJoinAndSelect('gallery.thumbnailImage', 'thumbnailImage')
            .leftJoinAndSelect('gallery.detailImages', 'detailImages')
            .leftJoinAndSelect('product.galleries', 'productGallery')
            .leftJoinAndSelect('productGallery.mainImage', 'productMainImage')
            .leftJoinAndSelect('productGallery.thumbnailImage', 'productThumbnailImage')
            .leftJoinAndSelect('productGallery.detailImages', 'productDetailImages')
            .leftJoinAndSelect('combination.stock', 'stock')
            .where('product.type = :type', { type: ProductType.VARIANT })
            .andWhere('product.isActive = :isActive', { isActive: true })
            .andWhere('combination.isActive = :isActive', { isActive: true })
            .andWhere('combination.isDisabled = :isDisabled', { isDisabled: false });

        if (search) {
            qb.andWhere(
                new Brackets((qb) => {
                    qb.where('product.name ILIKE :search', { search: `%${search}%` })
                        .orWhere('product.description ILIKE :search', { search: `%${search}%` });
                }),
            );
        }

        if (categoryIds) {
            const categoryIdArray = categoryIds.split(',').map((id) => id.trim()).filter(Boolean);
            if (categoryIdArray.length > 0) {
                qb.andWhere('category.id IN (:...categoryIds)', { categoryIds: categoryIdArray });
            }
        }

        if (tagIds) {
            const tagIdArray = tagIds.split(',').map((id) => id.trim()).filter(Boolean);
            if (tagIdArray.length > 0) {
                qb.andWhere('tag.id IN (:...tagIds)', { tagIds: tagIdArray });
            }
        }

        const combinations = await qb.getMany();
        return combinations.map((combination) => this.mapVariantCombinationToStoreProduct(combination));
    }

    /**
     * Basit ürünü StoreProductDto'ya map et
     */
    private mapSimpleProductToStoreProduct(product: Product): StoreProductDto {
        const price = this.calculatePrice(product);
        const gallery = this.getProductGallery(product);

        return {
            id: product.id,
            productId: product.id,
            variantCombinationId: null,
            name: product.name,
            subtitle: product.subtitle,
            slug: product.slug,
            description: product.description,
            price,
            basePrice: Number(product.basePrice),
            discountedPrice: product.discountedPrice ? Number(product.discountedPrice) : null,
            sku: product.sku,
            stock: {
                availableQuantity: product.stock?.availableQuantity || 0,
                reservedQuantity: product.stock?.reservedQuantity || 0,
                usableQuantity:
                    (product.stock?.availableQuantity || 0) - (product.stock?.reservedQuantity || 0),
            },
            gallery,
            categories: (product.categories || []).map((cat) => ({
                id: cat.id,
                name: cat.name,
                slug: cat.slug,
            })),
            tags: (product.tags || []).map((tag) => ({
                id: tag.id,
                name: tag.name,
                color: tag.color || null,
            })),
            seoTitle: product.seoTitle,
            seoDescription: product.seoDescription,
            seoKeywords: product.seoKeywords,
            variantValues: [],
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
        };
    }




    /**
     * Varyasyon kombinasyonunu StoreProductDto'ya map et
     */
    private mapVariantCombinationToStoreProduct(combination: VariantCombination): StoreProductDto {
        const product = combination.product;
        const price = this.calculateVariantPrice(product, combination);
        const gallery = this.getVariantCombinationGallery(combination, product);

        // priceDelta'ları hesapla
        const totalPriceDelta = this.calculateVariantPriceDelta(combination);

        // basePrice'a priceDelta'ları ekle
        const basePriceWithDelta = Number(product.basePrice) + totalPriceDelta;

        // discountedPrice'a da priceDelta'ları ekle (varsa)
        const discountedPriceWithDelta = product.discountedPrice
            ? Number(product.discountedPrice) + totalPriceDelta
            : null;

        // Slug her zaman kombinasyon slug'ı olmalı (getProductDetail ile uyumlu olması için)
        // Eğer slug yoksa, bu bir hata durumudur çünkü slug'lar generateAllVariantCombinations'da oluşturulmalı
        const combinationSlug = combination.slug;
        if (!combinationSlug) {
            console.warn(`[StoreService] Variant combination ${combination.id} has no slug. This should not happen.`);
        }

        return {
            id: combination.id,
            productId: product.id,
            variantCombinationId: combination.id,
            name: product.name,
            subtitle: product.subtitle,
            slug: combinationSlug || `${product.slug}-${combination.id.substring(0, 8)}`, // Fallback sadece hata durumunda
            description: product.description,
            price,
            basePrice: Math.round(basePriceWithDelta * 100) / 100,
            discountedPrice: discountedPriceWithDelta ? Math.round(discountedPriceWithDelta * 100) / 100 : null,
            sku: combination.sku || product.sku,
            stock: {
                availableQuantity: combination.stock?.availableQuantity || 0,
                reservedQuantity: combination.stock?.reservedQuantity || 0,
                usableQuantity:
                    (combination.stock?.availableQuantity || 0) -
                    (combination.stock?.reservedQuantity || 0),
            },
            gallery,
            categories: (product.categories || []).map((cat) => ({
                id: cat.id,
                name: cat.name,
                slug: cat.slug,
            })),
            tags: (product.tags || []).map((tag) => ({
                id: tag.id,
                name: tag.name,
                color: tag.color || null,
            })),
            seoTitle: product.seoTitle,
            seoDescription: product.seoDescription,
            seoKeywords: product.seoKeywords,
            variantValues: (combination.variantValues || []).map((value) => ({
                id: value.id,
                value: value.value,
                colorCode: value.colorCode,
                variantOption: {
                    id: value.variantOption.id,
                    name: value.variantOption.name,
                    type: value.variantOption.type,
                },
            })),
            createdAt: product.createdAt,
            updatedAt: combination.updatedAt,
        };
    }

    /**
     * Basit ürün fiyatını hesapla
     * Eğer discountedPrice varsa onu kullan, yoksa basePrice'ı kullan
     */
    private calculatePrice(product: Product): number {
        // Eğer discountedPrice varsa onu kullan
        if (product.discountedPrice != null) {
            const discountedPrice = Number(product.discountedPrice);
            if (!isNaN(discountedPrice) && discountedPrice >= 0) {
                return Math.round(discountedPrice * 100) / 100;
            }
        }

        // discountedPrice yoksa basePrice'ı kullan
        const basePrice = Number(product.basePrice);
        if (isNaN(basePrice) || basePrice < 0) {
            console.warn(`[StoreService] Invalid basePrice for product ${product.id}:`, product.basePrice);
            return 0;
        }

        return Math.round(basePrice * 100) / 100;
    }

    /**
     * Varyasyon kombinasyonunun priceDelta'larını hesapla
     */
    private calculateVariantPriceDelta(combination: VariantCombination): number {
        let totalPriceDelta = 0;

        if (!combination.variantValues) {
            console.warn(`[StoreService] variantValues not loaded for combination ${combination.id}. PriceDelta will be 0.`);
        } else if (Array.isArray(combination.variantValues) && combination.variantValues.length > 0) {
            totalPriceDelta = combination.variantValues.reduce(
                (sum, value) => {
                    if (!value) return sum;
                    const delta = value.priceDelta != null ? Number(value.priceDelta) : 0;
                    if (isNaN(delta)) {
                        console.warn(`[StoreService] Invalid priceDelta for variantValue ${value.id}:`, value.priceDelta);
                        return sum;
                    }
                    return sum + delta;
                },
                0,
            );
        }

        return totalPriceDelta;
    }

    /**
     * Varyasyon kombinasyonu fiyatını hesapla
     * discountedPrice sadece basePrice için geçerlidir, priceDelta'lar her zaman basePrice üzerine eklenir
     */
    private calculateVariantPrice(product: Product, combination: VariantCombination): number {
        // Base price'ı al
        const basePrice = Number(product.basePrice);
        if (isNaN(basePrice) || basePrice < 0) {
            console.warn(`[StoreService] Invalid basePrice for product ${product.id}:`, product.basePrice);
            return 0;
        }

        // priceDelta'ları hesapla
        const totalPriceDelta = this.calculateVariantPriceDelta(combination);

        // Base price'a priceDelta'ları ekle
        const basePriceWithDelta = basePrice + totalPriceDelta;

        // discountedPrice varsa onu kullan (sadece basePrice yerine), yoksa basePrice kullan
        let baseOrDiscountedPrice = basePriceWithDelta;
        if (product.discountedPrice != null) {
            const discountedPrice = Number(product.discountedPrice);
            if (!isNaN(discountedPrice) && discountedPrice >= 0) {
                // discountedPrice'a da priceDelta'ları ekle
                baseOrDiscountedPrice = discountedPrice + totalPriceDelta;
            }
        }

        // Final fiyat: (discountedPrice + priceDelta) veya (basePrice + priceDelta)
        return Math.max(0, Math.round(baseOrDiscountedPrice * 100) / 100);
    }

    /**
     * Basit ürün galerisini getir
     */
    private getProductGallery(product: Product): StoreProductGalleryDto {
        const gallery = product.galleries && product.galleries.length > 0 ? product.galleries[0] : null;

        return {
            mainImage: gallery?.mainImage
                ? {
                    id: gallery.mainImage.id,
                    s3Url: gallery.mainImage.s3Url,
                    displayName: gallery.mainImage.displayName,
                    filename: gallery.mainImage.filename,
                }
                : null,
            thumbnailImage: gallery?.thumbnailImage
                ? {
                    id: gallery.thumbnailImage.id,
                    s3Url: gallery.thumbnailImage.s3Url,
                    displayName: gallery.thumbnailImage.displayName,
                    filename: gallery.thumbnailImage.filename,
                }
                : null,
            detailImages: (gallery?.detailImages || []).map((img) => ({
                id: img.id,
                s3Url: img.s3Url,
                displayName: img.displayName,
                filename: img.filename,
            })),
        };
    }

    /**
     * Varyasyon kombinasyonu galerisini getir (varsa kombinasyonun, yoksa product'ın)
     */
    private getVariantCombinationGallery(combination: VariantCombination, product: Product): StoreProductGalleryDto {
        const combinationGallery =
            combination.galleries && combination.galleries.length > 0
                ? combination.galleries[0]
                : null;

        if (combinationGallery) {
            return {
                mainImage: combinationGallery.mainImage
                    ? {
                        id: combinationGallery.mainImage.id,
                        s3Url: combinationGallery.mainImage.s3Url,
                        displayName: combinationGallery.mainImage.displayName,
                        filename: combinationGallery.mainImage.filename,
                    }
                    : null,
                thumbnailImage: combinationGallery.thumbnailImage
                    ? {
                        id: combinationGallery.thumbnailImage.id,
                        s3Url: combinationGallery.thumbnailImage.s3Url,
                        displayName: combinationGallery.thumbnailImage.displayName,
                        filename: combinationGallery.thumbnailImage.filename,
                    }
                    : null,
                detailImages: (combinationGallery.detailImages || []).map((img) => ({
                    id: img.id,
                    s3Url: img.s3Url,
                    displayName: img.displayName,
                    filename: img.filename,
                })),
            };
        }

        return this.getProductGallery(product);
    }

    /**
     * Ürünleri sırala
     * Stokta olmayan ürünler her zaman en sonda gelir
     */
    private sortProducts(products: StoreProductDto[], orderBy: string): StoreProductDto[] {
        const inStock = products.filter((p) => p.stock.usableQuantity > 0);
        const outOfStock = products.filter((p) => p.stock.usableQuantity === 0);

        let sortedInStock = [...inStock];
        switch (orderBy) {
            case 'price_asc':
                sortedInStock.sort((a, b) => a.price - b.price);
                break;
            case 'price_desc':
                sortedInStock.sort((a, b) => b.price - a.price);
                break;
            case 'name_asc':
                sortedInStock.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name_desc':
                sortedInStock.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'created_at_asc':
                sortedInStock.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                break;
            case 'created_at_desc':
            default:
                sortedInStock.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                break;
        }

        let sortedOutOfStock = [...outOfStock];
        switch (orderBy) {
            case 'price_asc':
                sortedOutOfStock.sort((a, b) => a.price - b.price);
                break;
            case 'price_desc':
                sortedOutOfStock.sort((a, b) => b.price - a.price);
                break;
            case 'name_asc':
                sortedOutOfStock.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name_desc':
                sortedOutOfStock.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'created_at_asc':
                sortedOutOfStock.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                break;
            case 'created_at_desc':
            default:
                sortedOutOfStock.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                break;
        }

        return [...sortedInStock, ...sortedOutOfStock];
    }

}
