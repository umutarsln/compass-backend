import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { EndpointRolesGuard } from './auth/guards/endpoint-roles.guard';

/**
 * .env / process.env.PORT üzerinden dinlenecek TCP portunu hesaplar.
 * @returns {{ listenPort: number; portRaw: string | undefined }}
 */
function resolveListenPort(): { listenPort: number; portRaw: string | undefined } {
  const portRaw = process.env.PORT;
  const port = portRaw !== undefined && portRaw !== '' ? Number(portRaw) : 4141;
  const listenPort = Number.isFinite(port) && port > 0 ? port : 4141;
  return { listenPort, portRaw };
}

/**
 * CORS izin listesini sabit yerel/domain origin'leri ve CORS_ORIGINS env değeriyle üretir.
 * @returns {string[]}
 */
function resolveCorsOrigins(): string[] {
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:7600',
    'http://localhost:7601',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3003',
    'http://127.0.0.1:7600',
    'http://127.0.0.1:7601',
    'https://compass.com.tr',
    'http://compass.com.tr',
    'https://admin.compass.com.tr',
    'http://admin.compass.com.tr',
    'https://www.compassreklam.com',
    'https://compassreklam.com',
    'https://www.ilevgroup.com',
    'https://ilevgroup.com',
    'https://compass-front-admin.vercel.app',
  ];

  const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(new Set([...defaultOrigins, ...envOrigins]));
}

/** Nest uygulamasını ayağa kaldırır: CORS, validasyon, Swagger ve global guard. */
async function bootstrap() {
  const { listenPort, portRaw } = resolveListenPort();
  const bootLogger = new Logger('Bootstrap');

  // app.listen öncesi: modül gürültüsünden önce port görünsün
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log(
    `  BACKEND HTTP PORT (hedef): ${listenPort}   |   env PORT=${portRaw ?? '(yok → 4141)'}`,
  );
  console.log(`  Örnek: http://127.0.0.1:${listenPort}   Swagger: /api`);
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  bootLogger.log(
    `Dinleme hazırlığı: port=${listenPort} (process.env.PORT=${portRaw ?? 'tanımsız'})`,
  );

  const app = await NestFactory.create(AppModule);
  const reflector = app.get(Reflector);

  const corsOrigins = resolveCorsOrigins();

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-guest-id', 'x-cart-id'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Config dosyasından endpoint yetkilendirmelerini kontrol eden guard
  app.useGlobalGuards(new EndpointRolesGuard(reflector));

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('E-Ticaret API')
    .setDescription('E-Ticaret backend API dokümantasyonu')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'JWT token giriniz',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(listenPort, '0.0.0.0');

  const server = app.getHttpServer();
  const addr = server.address();
  const boundPort =
    addr && typeof addr === 'object' && 'port' in addr ? addr.port : listenPort;

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  BACKEND AYAKTA — dinlenen port: ${boundPort}`);
  console.log(`  http://127.0.0.1:${boundPort}  |  http://localhost:${boundPort}`);
  console.log(`  Swagger: http://127.0.0.1:${boundPort}/api`);
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  bootLogger.log(
    `HTTP dinleniyor: 0.0.0.0:${boundPort} → http://127.0.0.1:${boundPort}`,
  );
  bootLogger.log(`Swagger UI: http://127.0.0.1:${boundPort}/api`);
  if (portRaw !== undefined && portRaw !== '' && listenPort !== Number(portRaw)) {
    bootLogger.warn(
      `PORT="${portRaw}" geçersiz veya 0; ${listenPort} kullanıldı.`,
    );
  }
}
bootstrap();
