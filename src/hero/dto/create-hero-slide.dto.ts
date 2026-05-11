import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateHeroSlideDto {
  @ApiPropertyOptional({ description: 'Medya kütüphanesindeki görsel ID değeri' })
  @IsOptional()
  @IsUUID()
  uploadId?: string;

  @ApiPropertyOptional({ description: 'Doğrudan kullanılacak görsel URL adresi' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Admin panelinde görünen kısa başlık' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Görsel erişilebilirlik açıklaması' })
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional({ description: 'Slayt sıralaması', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Slayt yayında mı?', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
