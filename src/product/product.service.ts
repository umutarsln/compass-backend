import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Category } from '../category/category.entity';
import { Tag } from '../tag/tag.entity';
import { ProductType } from '../common/enums/product-type.enum';
import { SellableType } from '../common/enums/sellable-type.enum';
import { StockService } from '../stock/stock.service';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
    private stockService: StockService,
  ) {}

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

    // Discount uygula
    if (product.isOnSale && product.discountPercent) {
      price = price * (1 - product.discountPercent / 100);
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

    // SIMPLE product için stock kaydı oluştur
    if (savedProduct.type === ProductType.SIMPLE) {
      await this.stockService.findOrCreate(
        SellableType.PRODUCT,
        savedProduct.id,
      );
    }

    return savedProduct;
  }

  async findAll(): Promise<Product[]> {
    return await this.productRepository.find({
      relations: ['categories', 'tags', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['categories', 'tags', 'createdBy'],
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
    Object.assign(product, {
      ...updateProductDto,
      categoryIds: undefined,
      tagIds: undefined,
    });

    return await this.productRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
  }
}
