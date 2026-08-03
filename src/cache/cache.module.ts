import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createCacheModuleOptions } from './create-cache-module-options';
import { CacheService } from './cache.service';
import { CacheController } from './cache.controller';

/** Global cache; Redis yoksa bellek içi store ile bootstrap bloklanmaz. */
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        createCacheModuleOptions(configService),
      inject: [ConfigService],
      isGlobal: true,
    }),
  ],
  controllers: [CacheController],
  providers: [CacheService],
  exports: [NestCacheModule, CacheService],
})
export class CacheModule {}
