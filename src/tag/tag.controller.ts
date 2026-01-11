import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { TagService } from './tag.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Tag } from './tag.entity';

@ApiTags('Tags')
@Controller('tags')
@ApiBearerAuth('JWT-auth')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Post()
  @ApiOperation({ summary: 'Yeni tag oluştur' })
  @ApiBody({ type: CreateTagDto })
  @ApiResponse({
    status: 201,
    description: 'Tag başarıyla oluşturuldu',
    type: Tag,
  })
  async create(@Body() createTagDto: CreateTagDto): Promise<Tag> {
    return await this.tagService.create(createTagDto);
  }

  @Get()
  @ApiOperation({ summary: 'Tüm tag\'leri listele' })
  @ApiResponse({
    status: 200,
    description: 'Tag listesi başarıyla döndürüldü',
    type: [Tag],
  })
  async findAll(): Promise<Tag[]> {
    return await this.tagService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Tag detayını getir' })
  @ApiResponse({
    status: 200,
    description: 'Tag detayı başarıyla döndürüldü',
    type: Tag,
  })
  @ApiResponse({ status: 404, description: 'Tag bulunamadı' })
  async findOne(@Param('id') id: string): Promise<Tag> {
    return await this.tagService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Tag bilgilerini güncelle' })
  @ApiBody({ type: UpdateTagDto })
  @ApiResponse({
    status: 200,
    description: 'Tag başarıyla güncellendi',
    type: Tag,
  })
  @ApiResponse({ status: 404, description: 'Tag bulunamadı' })
  async update(
    @Param('id') id: string,
    @Body() updateTagDto: UpdateTagDto,
  ): Promise<Tag> {
    return await this.tagService.update(id, updateTagDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Tag\'i sil' })
  @ApiResponse({
    status: 200,
    description: 'Tag başarıyla silindi',
  })
  @ApiResponse({ status: 404, description: 'Tag bulunamadı' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.tagService.remove(id);
    return { message: 'Tag başarıyla silindi' };
  }
}
