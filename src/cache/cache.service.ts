import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

@Injectable()
export class CacheService implements OnModuleInit {
    private readonly logger = new Logger(CacheService.name);

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private configService: ConfigService,
    ) { }

    async onModuleInit() {
        console.log("REDIS_HOST", this.configService.get<string>('REDIS_HOST'));
        console.log("REDIS_PORT", this.configService.get<string>('REDIS_PORT'));
        console.log("REDIS_PASSWORD", this.configService.get<string>('REDIS_PASSWORD'));
        console.log("REDIS_HOST", this.configService.get<string>('REDIS_DB'));
        await this.checkRedisConnection();
    }

    /**
     * Redis bağlantısını kontrol et ve logla
     * Önce direkt Redis client ile bağlantıyı test ediyoruz
     * Sonra cache-manager'ın da çalıştığını doğruluyoruz
     */
    private async checkRedisConnection(): Promise<void> {
        this.logger.log('[CacheService] Redis bağlantısı kontrol ediliyor...');

        const redisHost = this.configService.get<string>('REDIS_HOST');
        const redisPort = this.configService.get<number>('REDIS_PORT');
        const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
        const redisDb = this.configService.get<number>('REDIS_DB');

        this.logger.log(`[CacheService] Redis yapılandırması: ${redisHost}:${redisPort}, DB: ${redisDb}`);

        // ÖNCE: Direkt Redis client ile gerçek bağlantıyı test et
        let testClient: any = null;
        try {
            this.logger.log('[CacheService] Direkt Redis client ile bağlantı test ediliyor...');
            
            testClient = createClient({
                socket: {
                    host: redisHost,
                    port: redisPort,
                },
                password: redisPassword || undefined,
                database: redisDb,
            });

            // Hata event'lerini dinle
            testClient.on('error', (err: Error) => {
                this.logger.error(`[CacheService] ❌ Redis client hatası: ${err.message}`);
            });

            // Bağlantıyı bekle
            await testClient.connect();
            this.logger.log('[CacheService] ✅ Direkt Redis client bağlantısı başarılı!');

            // PING testi
            const pingResult = await testClient.ping();
            if (pingResult === 'PONG') {
                this.logger.log('[CacheService] ✅ Redis PING başarılı!');
            } else {
                throw new Error(`PING beklenmeyen yanıt: ${pingResult}`);
            }

            // SET/GET testi
            const testKey = 'cache:connection:test:' + Date.now();
            const testValue = 'test-connection-' + Date.now();
            
            await testClient.set(testKey, testValue, { EX: 5 });
            this.logger.log('[CacheService] ✅ Direkt Redis SET başarılı!');
            
            const retrievedValue = await testClient.get(testKey);
            if (retrievedValue === testValue) {
                this.logger.log('[CacheService] ✅ Direkt Redis GET başarılı!');
            } else {
                throw new Error(`GET başarısız: Beklenen "${testValue}", alınan "${retrievedValue}"`);
            }

            await testClient.del(testKey);
            await testClient.quit();
            this.logger.log('[CacheService] ✅ Direkt Redis bağlantı testi tamamlandı!');
            this.logger.log('');

        } catch (directError: any) {
            if (testClient && testClient.isOpen) {
                await testClient.quit().catch(() => {});
            }
            
            this.logger.error('='.repeat(60));
            this.logger.error('[CacheService] ❌❌❌ REDIS DİREKT BAĞLANTI HATASI ❌❌❌');
            this.logger.error(`[CacheService] Hata mesajı: ${directError.message}`);
            this.logger.error(`[CacheService] Hata tipi: ${directError.name || 'Bilinmeyen'}`);
            this.logger.error(`[CacheService] Hata kodu: ${directError.code || 'Yok'}`);
            if (directError.stack) {
                this.logger.error(`[CacheService] Stack trace: ${directError.stack}`);
            }
            this.logger.error('[CacheService] ⚠️  Redis\'e direkt bağlanılamadı!');
            this.logger.error('[CacheService] ⚠️  Bu, cache-manager\'ın da çalışmayacağı anlamına gelir.');
            this.logger.error('[CacheService] ⚠️  Lütfen şunları kontrol edin:');
            this.logger.error(`[CacheService]   1. Redis sunucusu ${redisHost}:${redisPort} adresinde çalışıyor mu?`);
            this.logger.error('[CacheService]   2. REDIS_HOST, REDIS_PORT, REDIS_PASSWORD doğru mu?');
            this.logger.error('[CacheService]   3. Firewall/network ayarları Redis erişimine izin veriyor mu?');
            this.logger.error('[CacheService]   4. Redis şifresi doğru mu? (WRONGPASS hatası alıyorsanız şifre yanlış)');
            this.logger.error('='.repeat(60));
            throw directError; // Direkt bağlantı başarısızsa hata fırlat
        }

        // SONRA: cache-manager'ın da çalıştığını doğrula
        try {
            this.logger.log('[CacheService] Cache-manager ile Redis bağlantısı test ediliyor...');
            const testKey = 'cache:connection:test:' + Date.now();
            const testValue = 'test-connection-' + Date.now();

            // Set işlemi
            await this.cacheManager.set(testKey, testValue, 5000);
            this.logger.log('[CacheService] ✅ Cache-manager SET başarılı!');

            // Bekleme
            await new Promise(resolve => setTimeout(resolve, 500));

            // Get işlemi
            const retrievedValue = await this.cacheManager.get<string>(testKey);
            
            if (retrievedValue === testValue) {
                this.logger.log('[CacheService] ✅ Cache-manager GET başarılı!');
            } else {
                throw new Error(`Cache-manager GET başarısız: Beklenen "${testValue}", alınan "${retrievedValue || 'null'}"`);
            }

            // Test key'i temizle
            await this.cacheManager.del(testKey);

            // Redis client'a erişmeyi dene (opsiyonel - ek bilgi için)
            try {
                const cacheStore = (this.cacheManager as any).store;
                
                if (cacheStore) {
                    this.logger.log('[CacheService] Cache store bulundu, Redis client bilgileri alınıyor...');
                    
                    // Redis client'ı al - farklı yapılar için deneme
                    let client: any = null;
                    if (typeof cacheStore.getClient === 'function') {
                        client = cacheStore.getClient();
                    } else if (cacheStore.client) {
                        client = cacheStore.client;
                    } else if ((cacheStore as any).redis) {
                        client = (cacheStore as any).redis;
                    } else if (cacheStore._redis) {
                        client = cacheStore._redis;
                    }

                    if (client) {
                        this.logger.log('[CacheService] Redis client bulundu');
                        
                        // Redis server bilgilerini al
                        try {
                            const info = await new Promise<string>((resolve, reject) => {
                                const timeout = setTimeout(() => {
                                    reject(new Error('INFO timeout'));
                                }, 3000);

                                if (typeof client.info === 'function') {
                                    client.info('server', (err: Error | null, info: string) => {
                                        clearTimeout(timeout);
                                        if (err) reject(err);
                                        else resolve(info);
                                    });
                                } else {
                                    clearTimeout(timeout);
                                    reject(new Error('INFO komutu bulunamadı'));
                                }
                            });

                            // Redis version bilgisini parse et
                            const versionMatch = info.match(/redis_version:([\d.]+)/);
                            const version = versionMatch ? versionMatch[1] : 'bilinmiyor';

                            this.logger.log(`[CacheService] ✅ Redis versiyonu: ${version}`);
                        } catch (infoError: any) {
                            this.logger.warn(`[CacheService] ⚠️  Redis INFO komutu başarısız: ${infoError.message}`);
                            // INFO başarısız olsa bile bağlantı çalışıyor demektir
                        }
                    } else {
                        this.logger.debug('[CacheService] Redis client bulunamadı, ancak cache işlemleri çalışıyor');
                    }
                } else {
                    this.logger.debug('[CacheService] Cache store bulunamadı, ancak cache işlemleri çalışıyor');
                }
            } catch (clientError: any) {
                // Client erişimi başarısız olsa bile cache çalışıyor demektir
                this.logger.debug(`[CacheService] Redis client erişimi başarısız: ${clientError.message}`);
            }

            this.logger.log('[CacheService] ✅ Redis bağlantısı ve cache işlemleri başarıyla test edildi!');

        } catch (error: any) {
            this.logger.error('='.repeat(60));
            this.logger.error('[CacheService] ❌❌❌ REDIS BAĞLANTI HATASI ❌❌❌');
            this.logger.error(`[CacheService] Hata mesajı: ${error.message}`);
            this.logger.error(`[CacheService] Hata tipi: ${error.name || 'Bilinmeyen'}`);
            this.logger.error(`[CacheService] Hata kodu: ${error.code || 'Yok'}`);
            if (error.stack) {
                this.logger.error(`[CacheService] Stack trace: ${error.stack}`);
            }
            this.logger.error('[CacheService] ⚠️  Redis bağlantısı kurulamadı! Cache sistemi çalışmayabilir.');
            this.logger.error('[CacheService] ⚠️  Lütfen şunları kontrol edin:');
            this.logger.error(`[CacheService]   1. Redis sunucusu ${redisHost}:${redisPort} adresinde çalışıyor mu?`);
            this.logger.error('[CacheService]   2. REDIS_HOST, REDIS_PORT, REDIS_PASSWORD doğru mu?');
            this.logger.error('[CacheService]   3. Firewall/network ayarları Redis erişimine izin veriyor mu?');
            this.logger.error('[CacheService]   4. Redis şifresi doğru mu?');
            this.logger.error('='.repeat(60));
            // Hata durumunda exception fırlatma - uygulama çalışmaya devam etsin
            // Ancak log'da açıkça görünsün
        }
    }
}
