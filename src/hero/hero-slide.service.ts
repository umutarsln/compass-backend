import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Upload } from '../upload/upload.entity';
import { CreateHeroSlideDto } from './dto/create-hero-slide.dto';
import { UpdateHeroSlideDto } from './dto/update-hero-slide.dto';
import { HeroSlide } from './hero-slide.entity';
import { filterPublicHeroSlides } from './hero-slide.utils';

@Injectable()
export class HeroSlideService {
  constructor(
    @InjectRepository(HeroSlide)
    private readonly heroSlideRepository: Repository<HeroSlide>,
    @InjectRepository(Upload)
    private readonly uploadRepository: Repository<Upload>,
  ) {}

  /** Mağazada gösterilecek aktif hero slaytlarını sıralı olarak döndürür. */
  async findPublic(): Promise<HeroSlide[]> {
    const slides = await this.heroSlideRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return filterPublicHeroSlides(slides);
  }

  /** Admin paneli için tüm hero slaytlarını görsel ilişkisiyle birlikte listeler. */
  async findAdmin(): Promise<HeroSlide[]> {
    return await this.heroSlideRepository.find({
      relations: ['upload'],
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /** Yeni hero slaytı oluşturur ve seçilen medya görselinin URL bilgisini kaydeder. */
  async create(createHeroSlideDto: CreateHeroSlideDto): Promise<HeroSlide> {
    const slide = this.heroSlideRepository.create({
      title: createHeroSlideDto.title?.trim() || null,
      altText: createHeroSlideDto.altText?.trim() || '',
      sortOrder: createHeroSlideDto.sortOrder ?? 0,
      isActive: createHeroSlideDto.isActive ?? true,
    });

    await this.applyImageFields(slide, createHeroSlideDto);

    if (!slide.altText) {
      slide.altText = slide.title || 'Ana sayfa hero görseli';
    }

    return await this.heroSlideRepository.save(slide);
  }

  /** Mevcut hero slaytını günceller; upload değişirse görsel URL bilgisini yeniler. */
  async update(id: string, updateHeroSlideDto: UpdateHeroSlideDto): Promise<HeroSlide> {
    const slide = await this.heroSlideRepository.findOne({ where: { id } });
    if (!slide) {
      throw new NotFoundException('Hero slaytı bulunamadı');
    }

    if (updateHeroSlideDto.title !== undefined) {
      slide.title = updateHeroSlideDto.title?.trim() || null;
    }
    if (updateHeroSlideDto.altText !== undefined) {
      slide.altText = updateHeroSlideDto.altText?.trim() || 'Ana sayfa hero görseli';
    }
    if (updateHeroSlideDto.sortOrder !== undefined) {
      slide.sortOrder = updateHeroSlideDto.sortOrder;
    }
    if (updateHeroSlideDto.isActive !== undefined) {
      slide.isActive = updateHeroSlideDto.isActive;
    }

    await this.applyImageFields(slide, updateHeroSlideDto);

    return await this.heroSlideRepository.save(slide);
  }

  /** Hero slaytını kalıcı olarak siler; medya dosyasına dokunmaz. */
  async remove(id: string): Promise<{ message: string }> {
    const slide = await this.heroSlideRepository.findOne({ where: { id } });
    if (!slide) {
      throw new NotFoundException('Hero slaytı bulunamadı');
    }

    await this.heroSlideRepository.remove(slide);
    return { message: 'Hero slaytı silindi' };
  }

  /** Upload veya doğrudan URL girdisini slaytın görsel alanlarına uygular. */
  private async applyImageFields(
    slide: HeroSlide,
    dto: CreateHeroSlideDto | UpdateHeroSlideDto,
  ): Promise<void> {
    if (dto.uploadId) {
      const upload = await this.uploadRepository.findOne({ where: { id: dto.uploadId } });
      if (!upload) {
        throw new NotFoundException('Seçilen görsel bulunamadı');
      }

      slide.uploadId = upload.id;
      slide.imageUrl = upload.s3Url;

      if (!slide.altText) {
        slide.altText = upload.seoTitle || upload.displayName || upload.filename;
      }
      return;
    }

    if (dto.imageUrl !== undefined) {
      const imageUrl = dto.imageUrl.trim();
      if (!imageUrl) {
        throw new BadRequestException('Hero görseli zorunludur');
      }

      slide.imageUrl = imageUrl;
      slide.uploadId = dto.uploadId === undefined ? slide.uploadId : null;
    }

    if (!slide.imageUrl) {
      throw new BadRequestException('Hero görseli zorunludur');
    }
  }
}
