import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { generateSlug } from '../common/utils/slug.util';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  /**
   * Benzersiz slug oluşturur
   */
  private async generateUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.categoryRepository.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    // Slug oluştur
    const baseSlug = generateSlug(createCategoryDto.name);
    const slug = await this.generateUniqueSlug(baseSlug);

    // Parent kontrolü
    if (createCategoryDto.parentId) {
      const parent = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parentId },
      });

      if (!parent) {
        throw new NotFoundException('Üst kategori bulunamadı');
      }
    }

    // Image kontrolü (eğer imageId varsa)
    // Upload entity kontrolü yapılabilir ama şimdilik sadece UUID kontrolü yeterli

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      slug,
    });

    return await this.categoryRepository.save(category);
  }

  async findAll(): Promise<Category[]> {
    return await this.categoryRepository.find({
      relations: ['parent', 'children', 'image'],
      order: { displayOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  /**
   * Tree yapısında kategorileri döndürür
   */
  async findTree(): Promise<Category[]> {
    const allCategories = await this.categoryRepository.find({
      relations: ['parent', 'children', 'image'],
      order: { displayOrder: 'ASC', createdAt: 'DESC' },
    });

    // Root kategorileri bul (parentId null olanlar)
    const rootCategories = allCategories.filter((c) => !c.parentId);

    // Her root kategori için children'ları ekle
    const buildTree = (parent: Category): Category => {
      const children = allCategories.filter((c) => c.parentId === parent.id);
      return {
        ...parent,
        children: children.map((child) => buildTree(child)),
      };
    };

    return rootCategories.map((root) => buildTree(root));
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['parent', 'children', 'image'],
    });

    if (!category) {
      throw new NotFoundException('Kategori bulunamadı');
    }

    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(id);

    // Name değiştiyse slug'ı güncelle
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const baseSlug = generateSlug(updateCategoryDto.name);
      category.slug = await this.generateUniqueSlug(baseSlug);
      category.name = updateCategoryDto.name;
    }

    // Parent değiştiyse kontrol et
    if (
      updateCategoryDto.parentId !== undefined &&
      updateCategoryDto.parentId !== category.parentId
    ) {
      // Kendisini parent olarak seçemez
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException(
          'Bir kategori kendisinin üst kategorisi olamaz',
        );
      }

      // Parent'ın alt kategorilerinden biri olamaz (circular reference önleme)
      if (updateCategoryDto.parentId) {
        const parent = await this.categoryRepository.findOne({
          where: { id: updateCategoryDto.parentId },
        });

        if (!parent) {
          throw new NotFoundException('Üst kategori bulunamadı');
        }

        // Parent'ın path'ini kontrol et - eğer bu kategorinin altında ise circular reference
        const isDescendant = await this.isDescendant(
          updateCategoryDto.parentId,
          id,
        );

        if (isDescendant) {
          throw new BadRequestException(
            'Bir kategori kendi alt kategorisinin altına taşınamaz',
          );
        }
      }

      category.parentId = updateCategoryDto.parentId || null;
    }

    // Diğer alanları güncelle
    Object.assign(category, updateCategoryDto);

    return await this.categoryRepository.save(category);
  }

  /**
   * Bir kategori, başka bir kategorinin alt kategorisi mi kontrol eder
   */
  private async isDescendant(
    ancestorId: string,
    descendantId: string,
  ): Promise<boolean> {
    const category = await this.categoryRepository.findOne({
      where: { id: descendantId },
      relations: ['parent'],
    });

    if (!category || !category.parentId) {
      return false;
    }

    if (category.parentId === ancestorId) {
      return true;
    }

    return await this.isDescendant(ancestorId, category.parentId);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);

    // Alt kategorileri kontrol et
    const children = await this.categoryRepository.find({
      where: { parentId: id },
    });

    if (children.length > 0) {
      throw new ConflictException(
        'Bu kategorinin alt kategorileri var. Önce alt kategorileri silin.',
      );
    }

    await this.categoryRepository.remove(category);
  }
}
