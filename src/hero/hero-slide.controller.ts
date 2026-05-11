import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateHeroSlideDto } from './dto/create-hero-slide.dto';
import { UpdateHeroSlideDto } from './dto/update-hero-slide.dto';
import { HeroSlide } from './hero-slide.entity';
import { HeroSlideService } from './hero-slide.service';

@ApiTags('Hero Slides')
@Controller('hero-slides')
export class HeroSlideController {
  constructor(private readonly heroSlideService: HeroSlideService) {}

  /** Store ana sayfası için yayındaki hero slaytlarını döndürür. */
  @Get()
  @ApiOperation({ summary: 'Public hero slaytlarını listele' })
  @ApiResponse({ status: 200, description: 'Aktif hero slaytları', type: [HeroSlide] })
  async findPublic(): Promise<HeroSlide[]> {
    return await this.heroSlideService.findPublic();
  }

  /** Admin paneli için aktif/pasif tüm hero slaytlarını döndürür. */
  @Get('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin hero slaytlarını listele' })
  @ApiResponse({ status: 200, description: 'Tüm hero slaytları', type: [HeroSlide] })
  async findAdmin(): Promise<HeroSlide[]> {
    return await this.heroSlideService.findAdmin();
  }

  /** Admin panelinden yeni hero slaytı oluşturur. */
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hero slaytı oluştur' })
  @ApiResponse({ status: 201, description: 'Hero slaytı oluşturuldu', type: HeroSlide })
  async create(@Body() createHeroSlideDto: CreateHeroSlideDto): Promise<HeroSlide> {
    return await this.heroSlideService.create(createHeroSlideDto);
  }

  /** Admin panelinden mevcut hero slaytını günceller. */
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hero slaytını güncelle' })
  @ApiResponse({ status: 200, description: 'Hero slaytı güncellendi', type: HeroSlide })
  async update(
    @Param('id') id: string,
    @Body() updateHeroSlideDto: UpdateHeroSlideDto,
  ): Promise<HeroSlide> {
    return await this.heroSlideService.update(id, updateHeroSlideDto);
  }

  /** Admin panelinden hero slaytını siler. */
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hero slaytını sil' })
  @ApiResponse({ status: 200, description: 'Hero slaytı silindi' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return await this.heroSlideService.remove(id);
  }
}
