import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { FolderModule } from './folder/folder.module';
import { UploadModule } from './upload/upload.module';
import { CategoryModule } from './category/category.module';
import { TagModule } from './tag/tag.module';
import { StockModule } from './stock/stock.module';
import { ProductModule } from './product/product.module';
import { StoreModule } from './store/store.module';
import { CartModule } from './cart/cart.module';
import { FavoriteModule } from './favorite/favorite.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { MailModule } from './mail/mail.module';
import { DocsModule } from './docs/docs.module';
import { PersonalizationModule } from './personalization/personalization.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true, // Production'da false yapılmalı
      }),
      inject: [ConfigService],
    }),
    UserModule,
    AuthModule,
    FolderModule,
    UploadModule,
    CategoryModule,
    TagModule,
    StockModule,
    ProductModule,
    StoreModule,
    CartModule,
    FavoriteModule,
    OrderModule,
    PaymentModule,
    MailModule,
    DocsModule,
    PersonalizationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
