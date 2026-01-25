/**
 * Redis Bağlantı Test Scripti
 * 
 * Kullanım: node test-redis.js
 * 
 * Bu script, .env dosyasındaki Redis ayarlarını kullanarak
 * Redis sunucusuna bağlanmayı test eder.
 */

require('dotenv').config();
const redis = require('redis');

// Redis yapılandırması
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
};

console.log('='.repeat(60));
console.log('Redis Bağlantı Testi');
console.log('='.repeat(60));
console.log('Yapılandırma:');
console.log(`  Host: ${redisConfig.host}`);
console.log(`  Port: ${redisConfig.port}`);
console.log(`  DB: ${redisConfig.db}`);
console.log(`  Password: ${redisConfig.password ? '*** (ayarlanmış)' : 'Yok'}`);
console.log('='.repeat(60));
console.log('');

// Redis client oluştur
const client = redis.createClient({
    socket: {
        host: redisConfig.host,
        port: redisConfig.port,
    },
    password: redisConfig.password,
    database: redisConfig.db,
});

// Hata event'lerini dinle
client.on('error', (err) => {
    console.error('❌ Redis Hata:', err.message);
    console.error('   Hata Kodu:', err.code || 'Yok');
    console.error('   Hata Tipi:', err.name || 'Bilinmeyen');
    if (err.stack) {
        console.error('   Stack:', err.stack);
    }
    process.exit(1);
});

client.on('connect', () => {
    console.log('📡 Redis bağlantısı kuruldu...');
});

client.on('ready', () => {
    console.log('✅ Redis hazır!');
});

// Test fonksiyonu
async function testRedisConnection() {
    try {
        console.log('🔄 Redis\'e bağlanılıyor...');
        console.log('');

        // Bağlantıyı bekle
        await client.connect();
        console.log('✅ Redis\'e başarıyla bağlanıldı!');
        console.log('');

        // PING testi
        console.log('🔄 PING testi yapılıyor...');
        const pingResult = await client.ping();
        if (pingResult === 'PONG') {
            console.log('✅ PING başarılı! (PONG alındı)');
        } else {
            console.log(`⚠️  PING beklenmeyen yanıt: ${pingResult}`);
        }
        console.log('');

        // SET/GET testi
        console.log('🔄 SET/GET testi yapılıyor...');
        const testKey = 'test:connection:' + Date.now();
        const testValue = 'test-value-' + Date.now();
        
        await client.set(testKey, testValue, {
            EX: 10, // 10 saniye TTL
        });
        console.log(`✅ SET başarılı! Key: ${testKey}, Value: ${testValue}`);
        
        const retrievedValue = await client.get(testKey);
        if (retrievedValue === testValue) {
            console.log(`✅ GET başarılı! Alınan değer: ${retrievedValue}`);
        } else {
            console.log(`❌ GET başarısız! Beklenen: ${testValue}, Alınan: ${retrievedValue}`);
        }
        
        // Test key'i temizle
        await client.del(testKey);
        console.log(`✅ Test key temizlendi: ${testKey}`);
        console.log('');

        // INFO komutu ile Redis bilgilerini al
        console.log('🔄 Redis server bilgileri alınıyor...');
        const info = await client.info('server');
        const versionMatch = info.match(/redis_version:([\d.]+)/);
        const version = versionMatch ? versionMatch[1] : 'bilinmiyor';
        console.log(`✅ Redis versiyonu: ${version}`);
        console.log('');

        // DB bilgisi
        const dbSize = await client.dbSize();
        console.log(`📊 Veritabanı boyutu: ${dbSize} key`);
        console.log('');

        console.log('='.repeat(60));
        console.log('✅ TÜM TESTLER BAŞARILI!');
        console.log('✅ Redis bağlantısı çalışıyor.');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('');
        console.error('='.repeat(60));
        console.error('❌ REDIS BAĞLANTI HATASI');
        console.error('='.repeat(60));
        console.error(`Hata Mesajı: ${error.message}`);
        console.error(`Hata Tipi: ${error.name || 'Bilinmeyen'}`);
        console.error(`Hata Kodu: ${error.code || 'Yok'}`);
        if (error.stack) {
            console.error('');
            console.error('Stack Trace:');
            console.error(error.stack);
        }
        console.error('');
        console.error('Kontrol Listesi:');
        console.error('  1. Redis sunucusu çalışıyor mu?');
        console.error(`  2. ${redisConfig.host}:${redisConfig.port} adresine erişilebiliyor mu?`);
        console.error('  3. REDIS_HOST, REDIS_PORT, REDIS_PASSWORD doğru mu?');
        console.error('  4. Firewall/network ayarları Redis erişimine izin veriyor mu?');
        console.error('  5. Redis şifresi doğru mu?');
        console.error('='.repeat(60));
        process.exit(1);
    } finally {
        // Bağlantıyı kapat
        if (client.isOpen) {
            await client.quit();
            console.log('🔌 Redis bağlantısı kapatıldı.');
        }
    }
}

// Script'i çalıştır
testRedisConnection()
    .then(() => {
        console.log('');
        console.log('✅ Test tamamlandı!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('');
        console.error('❌ Test sırasında beklenmeyen hata:', error);
        process.exit(1);
    });
