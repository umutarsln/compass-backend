import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Upload } from './upload.entity';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { S3Service } from './s3/s3.service';
import { Folder } from '../folder/folder.entity';
import { FolderModule } from '../folder/folder.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Upload, Folder]),
    forwardRef(() => FolderModule),
    UserModule,
  ],
  controllers: [UploadController],
  providers: [UploadService, S3Service],
  exports: [UploadService, S3Service],
})
export class UploadModule {}
