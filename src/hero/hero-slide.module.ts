import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Upload } from '../upload/upload.entity';
import { HeroSlideController } from './hero-slide.controller';
import { HeroSlide } from './hero-slide.entity';
import { HeroSlideService } from './hero-slide.service';

@Module({
  imports: [TypeOrmModule.forFeature([HeroSlide, Upload])],
  controllers: [HeroSlideController],
  providers: [HeroSlideService],
  exports: [HeroSlideService],
})
export class HeroSlideModule {}
