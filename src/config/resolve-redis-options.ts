import { ConfigService } from '@nestjs/config';

/** Redis bağlantısı için host/port veya URL parse sonucu. */
export type RedisConnectionOptions = {
  host: string;
  port: number;
  password?: string;
  db: number;
};

/**
 * REDIS_HOST ailesi eksikse Railway tarzı REDIS_URL veya REDIS_PUBLIC_URL değerini parse eder.
 * Hiçbiri yoksa yerel geliştirme için localhost:6379 döner.
 * @param configService Uygulama ortam değişkenlerini sağlayan ConfigService örneği.
 * @returns Redis istemci/cache yapılandırması için host, port, şifre ve DB numarası.
 */
export function resolveRedisConnectionOptions(
  configService: ConfigService,
): RedisConnectionOptions {
  const host = configService.get<string>('REDIS_HOST')?.trim();

  if (host) {
    return {
      host,
      port: Number(configService.get<string>('REDIS_PORT') || 6379),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      db: Number(configService.get<string>('REDIS_DB') || 0),
    };
  }

  const url =
    configService.get<string>('REDIS_URL')?.trim() ||
    configService.get<string>('REDIS_PUBLIC_URL')?.trim();

  if (!url) {
    return {
      host: 'localhost',
      port: 6379,
      db: 0,
    };
  }

  const parsed = new URL(url);
  const dbFromPath = parsed.pathname.replace(/^\//, '');

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: dbFromPath ? Number(dbFromPath) : 0,
  };
}
