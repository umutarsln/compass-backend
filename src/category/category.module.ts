import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './category.entity';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { UploadModule } from '../upload/upload.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule, TypeOrmModule.forFeature([Category]), UploadModule],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
