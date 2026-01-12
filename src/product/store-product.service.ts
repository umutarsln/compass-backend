import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Product } from './product.entity';
import { VariantCombination } from './variant-combination.entity';
import { ProductGallery } from './product-gallery.entity';
import { Stock } from '../stock/stock.entity';
import { StoreProductQueryDto } from './dto/store-product-query.dto';
import { StoreProductDto, StoreProductListResponseDto, StoreProductGalleryDto } from './dto/store-product-response.dto';
import { ProductType } from '../common/enums/product-type.enum';

@Injectable()
export class StoreProductService {
    constructor(
        @InjectRepository(Product)
        private productRepository: Repository<Product>,
        @InjectRepository(VariantCombination)
        private variantCombinationRepository: Repository<VariantCombination>,
    ) { }

    /**
     * Mağaza için ürünleri getir
     * Basit ürünler ve varyasyonlu ürünlerin aktif kombinasyonları ayrı ürünler olarak döner
     */
    async getAll(query: StoreProductQueryDto): Promise<StoreProductListResponseDto> {
        const {
            search,
            categoryId,
            tagIds,
            minPrice,
            maxPrice,
            orderBy = 'created_at_desc',
            page = 1,
            limit = 20,
        } = query;

        // Basit ürünleri getir
        const simpleProducts = await this.getSimpleProducts({
            ...query,
            minPrice: undefined, // Fiyat filtresini sonra uygulayacağız
            maxPrice: undefined,
        });

        // Varyasyonlu ürünlerin kombinasyonlarını getir
        const variantProducts = await this.getVariantCombinations({
            ...query,
            minPrice: undefined, // Fiyat filtresini sonra uygulayacağız
            maxPrice: undefined,
        });

        // Tüm ürünleri birleştir (fiyatlar zaten hesaplanmış durumda)
        let allProducts = [...simpleProducts, ...variantProducts];

        // Fiyat filtresi (tüm ürünler üzerinde - discount uygulanmış final fiyatlar üzerinde)
        // 
        // Basit ürünler için:
        //   - basePrice'dan discount düşülür: finalPrice = basePrice - (basePrice * discountPercent / 100)
        //   - Örnek: basePrice = 100, discountPercent = 20 -> finalPrice = 80
        //
        // Varyasyon kombinasyonları için:
        //   - basePrice + sum(priceDelta'lar) hesaplanır
        //   - Sonra discount uygulanır: finalPrice = (basePrice + deltas) - ((basePrice + deltas) * discountPercent / 100)
        //   - Örnek: basePrice = 100, deltas = [10, 5], discountPercent = 20
        //            -> priceWithDeltas = 115, discountAmount = 23, finalPrice = 92
        //
        // NOT: product.price zaten calculatePrice() veya calculateVariantPrice() ile hesaplanmış final fiyatı içerir
        if (minPrice !== undefined || maxPrice !== undefined) {
            allProducts = allProducts.filter((product) => {
                // product.price zaten discount uygulanmış final fiyatı içerir
                const finalPrice = typeof product.price === 'number' ? product.price : Number(product.price);

                // Geçersiz fiyat kontrolü
                if (isNaN(finalPrice) || finalPrice < 0) {
                    console.warn(`[StoreProductService] Invalid price for product ${product.id}:`, product.price);
                    return false;
                }

                // Fiyat aralığı kontrolü (discount uygulanmış final fiyat üzerinden)
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

        return {
            products: paginatedProducts,
            total,
            page,
            limit,
            totalPages,
        };
    }

    /**
     * Basit ürünleri getir
     */
    private async getSimpleProducts(query: StoreProductQueryDto): Promise<StoreProductDto[]> {
        const { search, categoryId, tagIds } = query;

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

        // Search filtresi
        if (search) {
            qb.andWhere(
                new Brackets((qb) => {
                    qb.where('product.name ILIKE :search', { search: `%${search}%` })
                        .orWhere('product.description ILIKE :search', { search: `%${search}%` });
                }),
            );
        }

        // Kategori filtresi
        if (categoryId) {
            qb.andWhere('category.id = :categoryId', { categoryId });
        }

        // Tag filtresi
        if (tagIds) {
            const tagIdArray = tagIds.split(',').map((id) => id.trim());
            qb.andWhere('tag.id IN (:...tagIds)', { tagIds: tagIdArray });
        }

        const products = await qb.getMany();

        return products.map((product) => this.mapSimpleProductToStoreProduct(product));
    }

    /**
     * Varyasyonlu ürünlerin aktif kombinasyonlarını getir
     */
    private async getVariantCombinations(query: StoreProductQueryDto): Promise<StoreProductDto[]> {
        const { search, categoryId, tagIds } = query;

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

        // Search filtresi
        if (search) {
            qb.andWhere(
                new Brackets((qb) => {
                    qb.where('product.name ILIKE :search', { search: `%${search}%` })
                        .orWhere('product.description ILIKE :search', { search: `%${search}%` });
                }),
            );
        }

        // Kategori filtresi
        if (categoryId) {
            qb.andWhere('category.id = :categoryId', { categoryId });
        }

        // Tag filtresi
        if (tagIds) {
            const tagIdArray = tagIds.split(',').map((id) => id.trim());
            qb.andWhere('tag.id IN (:...tagIds)', { tagIds: tagIdArray });
        }

        const combinations = await qb.getMany();

        return combinations.map((combination) =>
            this.mapVariantCombinationToStoreProduct(combination),
        );
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
            slug: product.slug,
            description: product.description,
            price,
            basePrice: Number(product.basePrice),
            isOnSale: product.isOnSale,
            discountPercent: product.discountPercent ? Number(product.discountPercent) : null,
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
    private mapVariantCombinationToStoreProduct(
        combination: VariantCombination,
    ): StoreProductDto {
        const product = combination.product;
        const price = this.calculateVariantPrice(product, combination);

        // Kombinasyonun kendi galerisi varsa onu kullan, yoksa product'ın galerisini kullan
        const gallery = this.getVariantCombinationGallery(combination, product);

        return {
            id: combination.id, // Kombinasyon ID'si
            productId: product.id,
            variantCombinationId: combination.id,
            name: product.name,
            slug: `${product.slug}-${combination.id.substring(0, 8)}`, // Unique slug
            description: product.description,
            price,
            basePrice: Number(product.basePrice),
            isOnSale: product.isOnSale,
            discountPercent: product.discountPercent ? Number(product.discountPercent) : null,
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
     * Formül: basePrice - (basePrice * discountPercent / 100)
     * Örnek: basePrice = 100, discountPercent = 20 -> finalPrice = 80
     */
    private calculatePrice(product: Product): number {
        const basePrice = Number(product.basePrice);

        if (isNaN(basePrice) || basePrice < 0) {
            console.warn(`[StoreProductService] Invalid basePrice for product ${product.id}:`, product.basePrice);
            return 0;
        }

        // Discount varsa uygula
        if (product.isOnSale && product.discountPercent) {
            const discountPercent = Number(product.discountPercent);
            if (!isNaN(discountPercent) && discountPercent > 0 && discountPercent <= 100) {
                const discountAmount = basePrice * (discountPercent / 100);
                const finalPrice = basePrice - discountAmount;
                return Math.max(0, Math.round(finalPrice * 100) / 100);
            }
        }

        // Discount yoksa basePrice'ı döndür
        return Math.round(basePrice * 100) / 100;
    }

    /**
     * Varyasyon kombinasyonu fiyatını hesapla
     * Formül: (basePrice + sum(priceDelta'lar)) - ((basePrice + sum(priceDelta'lar)) * discountPercent / 100)
     * Örnek: basePrice = 100, priceDelta'lar = [10, 5], discountPercent = 20
     * -> priceWithDeltas = 115, discountAmount = 23, finalPrice = 92
     */
    private calculateVariantPrice(product: Product, combination: VariantCombination): number {
        // Base price'ı al
        const basePrice = Number(product.basePrice);

        if (isNaN(basePrice) || basePrice < 0) {
            console.warn(`[StoreProductService] Invalid basePrice for product ${product.id}:`, product.basePrice);
            return 0;
        }

        // Variant value'ların priceDelta'larını topla
        let totalPriceDelta = 0;
        if (combination.variantValues && combination.variantValues.length > 0) {
            totalPriceDelta = combination.variantValues.reduce(
                (sum, value) => {
                    const delta = value.priceDelta != null ? Number(value.priceDelta) : 0;
                    if (isNaN(delta)) {
                        console.warn(`[StoreProductService] Invalid priceDelta for variantValue ${value.id}:`, value.priceDelta);
                        return sum;
                    }
                    return sum + delta;
                },
                0,
            );
        }

        // Base price + priceDelta'lar = toplam fiyat
        const priceWithDeltas = basePrice + totalPriceDelta;

        // Discount varsa uygula
        if (product.isOnSale && product.discountPercent) {
            const discountPercent = Number(product.discountPercent);
            if (!isNaN(discountPercent) && discountPercent > 0 && discountPercent <= 100) {
                const discountAmount = priceWithDeltas * (discountPercent / 100);
                const finalPrice = priceWithDeltas - discountAmount;
                return Math.max(0, Math.round(finalPrice * 100) / 100);
            }
        }

        // Discount yoksa basePrice + priceDelta'ları döndür
        return Math.round(priceWithDeltas * 100) / 100;
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
    private getVariantCombinationGallery(
        combination: VariantCombination,
        product: Product,
    ): StoreProductGalleryDto {
        // Önce kombinasyonun kendi galerisine bak
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

        // Kombinasyonun galerisi yoksa product'ın galerisini kullan
        return this.getProductGallery(product);
    }

    /**
     * Ürünleri sırala
     * Stokta olmayan ürünler her zaman en sonda gelir
     */
    private sortProducts(products: StoreProductDto[], orderBy: string): StoreProductDto[] {
        // Önce stokta olan ve olmayan ürünleri ayır
        const inStock = products.filter((p) => p.stock.usableQuantity > 0);
        const outOfStock = products.filter((p) => p.stock.usableQuantity === 0);

        // Stokta olan ürünleri sırala
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

        // Stokta olmayan ürünleri de aynı sıralamaya göre sırala
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

        // Stokta olanlar önce, stokta olmayanlar sonra
        return [...sortedInStock, ...sortedOutOfStock];
    }
}
