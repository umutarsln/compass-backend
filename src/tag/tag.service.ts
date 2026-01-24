import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from './tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { generateSlug } from '../common/utils/slug.util';

@Injectable()
export class TagService {
  constructor(
    @InjectRepository(Tag)
    private tagRepository: Repository<Tag>,
  ) {}

  /**
   * Benzersiz slug oluşturur
   */
  private async generateUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.tagRepository.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  async create(createTagDto: CreateTagDto): Promise<Tag> {
    // Slug oluştur
    const baseSlug = generateSlug(createTagDto.name);
    const slug = await this.generateUniqueSlug(baseSlug);

    const tag = this.tagRepository.create({
      ...createTagDto,
      slug,
    });

    return await this.tagRepository.save(tag);
  }

  async findAll(): Promise<Tag[]> {
    return await this.tagRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Tag> {
    const tag = await this.tagRepository.findOne({
      where: { id },
    });

    if (!tag) {
      throw new NotFoundException('Tag bulunamadı');
    }

    return tag;
  }

  async update(id: string, updateTagDto: UpdateTagDto): Promise<Tag> {
    const tag = await this.findOne(id);

    // Name değiştiyse slug'ı güncelle
    if (updateTagDto.name && updateTagDto.name !== tag.name) {
      const baseSlug = generateSlug(updateTagDto.name);
      tag.slug = await this.generateUniqueSlug(baseSlug);
      tag.name = updateTagDto.name;
    }

    // Diğer alanları güncelle
    Object.assign(tag, updateTagDto);

    return await this.tagRepository.save(tag);
  }

  async remove(id: string): Promise<void> {
    const tag = await this.findOne(id);
    await this.tagRepository.remove(tag);
  }
}
