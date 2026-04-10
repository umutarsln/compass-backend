import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class CacheService implements OnModuleInit {
    private readonly logger = new Logger(CacheService.name);

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private configService: ConfigService,
    ) { }

    /**
     * Açılışta Redis’i dener; başarısız olsa bile Nest bootstrap tamamlanır (HTTP dinler).
     */
    async onModuleInit() {
        await this.checkRedisConnection();
    }

    /**
     * Test Redis istemcisini kapatır (quit veya disconnect).
     * @param client Kapatılacak istemci veya null
     */
    private async disposeTestClient(client: RedisClientType | null): Promise<void> {
        if (!client) return;
        try {
            if (client.isOpen) {
                await client.quit();
            } else {
                await client.disconnect();
            }
        } catch {
            try {
                await client.disconnect();
            } catch {
                /* yut */
            }
        }
    }

    /**
     * Redis bağlantısını kısa sürede dener; yoksa uyarı verir ve HTTP’nin ayağa kalkmasını engellemez.
     */
    private async checkRedisConnection(): Promise<void> {
        const redisHost = this.configService.get<string>('REDIS_HOST');
        const redisPort = this.configService.get<number>('REDIS_PORT');
        const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
        const redisDb = this.configService.get<number>('REDIS_DB');

        this.logger.log(
            `[CacheService] Redis kontrolü: ${redisHost}:${redisPort}, DB: ${redisDb ?? 0}`,
        );

        let testClient: RedisClientType | null = null;
        const connectTimeoutMs = 5000;

        try {
            testClient = createClient({
                socket: {
                    host: redisHost,
                    port: redisPort,
                    connectTimeout: connectTimeoutMs,
                    reconnectStrategy: false,
                },
                password: redisPassword || undefined,
                database: redisDb ?? 0,
            });

            await Promise.race([
                testClient.connect(),
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () =>
                            reject(
                                new Error(`Redis bağlantı zaman aşımı (${connectTimeoutMs}ms)`),
                            ),
                        connectTimeoutMs + 500,
                    ),
                ),
            ]);

            const pingResult = await testClient.ping();
            if (pingResult !== 'PONG') {
                throw new Error(`PING beklenmeyen yanıt: ${pingResult}`);
            }

            const testKey = 'cache:connection:test:' + Date.now();
            const testValue = 'test-connection-' + Date.now();
            await testClient.set(testKey, testValue, { EX: 5 });
            const retrievedValue = await testClient.get(testKey);
            if (retrievedValue !== testValue) {
                throw new Error('Redis GET doğrulaması başarısız');
            }
            await testClient.del(testKey);
            await this.disposeTestClient(testClient);
            testClient = null;

            this.logger.log('[CacheService] Redis doğrudan bağlantı testi başarılı.');
        } catch (directError: unknown) {
            await this.disposeTestClient(testClient);
            const msg = directError instanceof Error ? directError.message : String(directError);
            this.logger.warn(
                `[CacheService] Redis şu an kullanılamıyor (${redisHost}:${redisPort}): ${msg}. Uygulama yine de başlayacak; cache işlemleri başarısız olabilir.`,
            );
            return;
        }

        try {
            this.logger.log('[CacheService] cache-manager Redis testi...');
            const testKey = 'cache:connection:test:' + Date.now();
            const testValue = 'test-connection-' + Date.now();
            await this.cacheManager.set(testKey, testValue, 5000);
            await new Promise((resolve) => setTimeout(resolve, 300));
            const retrievedValue = await this.cacheManager.get<string>(testKey);
            if (retrievedValue !== testValue) {
                throw new Error(
                    `cache-manager GET uyuşmazlığı: beklenen "${testValue}", gelen "${retrievedValue ?? 'null'}"`,
                );
            }
            await this.cacheManager.del(testKey);
            this.logger.log('[CacheService] cache-manager Redis testi başarılı.');
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(
                `[CacheService] cache-manager Redis testi başarısız: ${msg}. Önbellek uçları hata verebilir.`,
            );
        }
    }

    /**
     * Cache'i temizle
     * Belirtilen prefix'e sahip tüm cache key'lerini siler
     * @param prefix Temizlenecek cache key'lerinin prefix'i (örn: "store:", "product:"). Belirtilmezse tüm cache temizlenir.
     * @returns Silinen key sayısı
     */
    async clearCache(prefix?: string): Promise<number> {
        this.logger.log(`[CacheService] Cache temizleme başlıyor... (prefix: ${prefix || 'tüm cache'})`);

        try {
            await this.cacheManager.clear();
            this.logger.log('[CacheService] ✅ Cache başarıyla temizlendi');
            return -1;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`[CacheService] ❌ Cache temizleme hatası: ${message}`);
            if (stack) {
                this.logger.error(`[CacheService] Stack: ${stack}`);
            }
            throw error;
        }
    }
}
