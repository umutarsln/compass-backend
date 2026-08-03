import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  resolveRedisConnectionOptions,
  type RedisConnectionOptions,
} from '../config/resolve-redis-options';

/** Nest cache-manager yapılandırma nesnesi. */
export type CacheModuleOptions = {
  store?: unknown;
  ttl: number;
  max?: number;
};

/**
 * Redis sunucusuna kısa süreli ping atarak erişilebilir olup olmadığını kontrol eder.
 */
export async function isRedisReachable(
  options: RedisConnectionOptions,
  timeoutMs = 3000,
): Promise<boolean> {
  const { createClient } = await import('redis');
  const client = createClient({
    socket: {
      host: options.host,
      port: options.port,
      connectTimeout: timeoutMs,
      reconnectStrategy: false,
    },
    password: options.password || undefined,
    database: options.db ?? 0,
  });

  try {
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis bağlantı zaman aşımı')), timeoutMs),
      ),
    ]);
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  } finally {
    try {
      if (client.isOpen) {
        await client.quit();
      } else {
        await client.disconnect();
      }
    } catch {
      /* yut */
    }
  }
}

/**
 * Redis varsa redis-yet store, yoksa bellek içi store ile cache yapılandırması üretir.
 */
export async function createCacheModuleOptions(
  configService: ConfigService,
): Promise<CacheModuleOptions> {
  const logger = new Logger('CacheModule');
  const redisOptions = resolveRedisConnectionOptions(configService);
  const reachable = await isRedisReachable(redisOptions);

  if (!reachable) {
    logger.warn(
      `[CacheModule] Redis erişilemiyor (${redisOptions.host}:${redisOptions.port}); bellek içi cache kullanılıyor.`,
    );
    return {
      ttl: 3600 * 1000,
      max: 1000,
    };
  }

  const { redisStore } = await import('cache-manager-redis-yet');
  logger.log(
    `[CacheModule] Redis store: ${redisOptions.host}:${redisOptions.port}, DB: ${redisOptions.db ?? 0}`,
  );

  return {
    store: await redisStore({
      socket: {
        host: redisOptions.host,
        port: redisOptions.port,
        connectTimeout: 5000,
      },
      password: redisOptions.password,
      database: redisOptions.db ?? 0,
    }),
    ttl: 3600 * 1000,
  };
}
