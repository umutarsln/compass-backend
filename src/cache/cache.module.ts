import { Module, Logger } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { CacheService } from './cache.service';

@Module({
    imports: [
        NestCacheModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const logger = new Logger('CacheModule');
                const redisHost = configService.get<string>('REDIS_HOST');
                const redisPort = configService.get<number>('REDIS_PORT');
                const redisPassword = configService.get<string>('REDIS_PASSWORD');
                const redisDb = configService.get<number>('REDIS_DB');

                logger.log(`[CacheModule] Redis yapılandırması: ${redisHost}:${redisPort}, DB: ${redisDb}`);
                if (redisPassword) {
                    logger.log('[CacheModule] Redis şifresi ayarlanmış');
                } else {
                    logger.log('[CacheModule] Redis şifresi yok (public)');
                }

                // cache-manager-redis-store yapılandırması
                const config: any = {
                    store: redisStore,
                    host: redisHost,
                    port: redisPort,
                    db: redisDb,
                    ttl: 3600, // 1 saat (saniye cinsinden)
                    max: 1000, // Maksimum cache item sayısı
                };

                // Şifre varsa auth_pass olarak ekle (cache-manager-redis-store için)
                if (redisPassword) {
                    config.auth_pass = redisPassword;
                }

                // Retry stratejisi
                config.retry_strategy = (options: any) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        logger.error('[CacheModule] Redis sunucusuna bağlanılamadı (ECONNREFUSED)');
                        return new Error('Redis sunucusu reddetti');
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        logger.error('[CacheModule] Redis bağlantı denemeleri 1 saatten fazla sürdü');
                        return new Error('Redis bağlantı denemeleri çok uzun sürdü');
                    }
                    if (options.attempt > 10) {
                        logger.error('[CacheModule] Redis bağlantı denemeleri 10\'u aştı');
                        return undefined; // Retry durdur
                    }
                    // Exponential backoff: 100ms, 200ms, 400ms, ...
                    return Math.min(options.attempt * 100, 3000);
                };

                logger.log(`[CacheModule] Redis store yapılandırması hazır: ${redisHost}:${redisPort}, DB: ${redisDb}`);

                return config;
            },
            inject: [ConfigService],
            isGlobal: true, // Global olarak kullanılabilir
        }),
    ],
    providers: [CacheService],
    exports: [NestCacheModule],
})
export class CacheModule { }
