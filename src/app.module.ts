import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
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
import { CouponModule } from './coupon/coupon.module';
import { FavoriteModule } from './favorite/favorite.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { MailModule } from './mail/mail.module';
import { DocsModule } from './docs/docs.module';
import { PersonalizationModule } from './personalization/personalization.module';
import { CacheModule } from './cache/cache.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HeroSlideModule } from './hero/hero-slide.module';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module';

type DatabaseConnectionOptions = {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  url?: string;
};

/**
 * DB_HOST ailesi eksikse Railway tarzı DATABASE_PUBLIC_URL veya DATABASE_URL değerini kullanır.
 * @param configService Uygulama ortam değişkenlerini sağlayan ConfigService örneği.
 * @returns TypeORM bağlantı ayarlarının host/port veya url kısmı.
 */
function resolveDatabaseConnectionOptions(
  configService: ConfigService,
): DatabaseConnectionOptions {
  const host = configService.get<string>('DB_HOST')?.trim();
  const username = configService.get<string>('DB_USERNAME')?.trim();
  const database = configService.get<string>('DB_DATABASE')?.trim();

  if (host && username && database) {
    return {
      host,
      port: Number(configService.get<string>('DB_PORT') || 5432),
      username,
      password: configService.get<string>('DB_PASSWORD'),
      database,
    };
  }

  const url =
    configService.get<string>('DATABASE_PUBLIC_URL')?.trim() ||
    configService.get<string>('DATABASE_URL')?.trim();

  if (!url) {
    throw new Error(
      'PostgreSQL bağlantı ayarı eksik: DB_HOST/DB_USERNAME/DB_DATABASE veya DATABASE_PUBLIC_URL tanımlanmalı.',
    );
  }

  return { url };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CacheModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const connectionOptions =
          resolveDatabaseConnectionOptions(configService);

        return {
          type: 'postgres',
          ...connectionOptions,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize:
            configService.get<string>('DB_SYNCHRONIZE') !== 'false',
        };
      },
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
    CouponModule,
    FavoriteModule,
    OrderModule,
    PaymentModule,
    MailModule,
    DocsModule,
    PersonalizationModule,
    ScheduleModule.forRoot(),
    AnalyticsModule,
    HeroSlideModule,
    ExchangeRateModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
