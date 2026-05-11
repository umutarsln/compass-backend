import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExchangeSettings } from './exchange-settings.entity';
import { ExchangeRatePublicResponseDto } from './dto/exchange-rate-public-response.dto';
import { CacheService } from '../cache/cache.service';

/** Kur servisi kapalıysa kullanılacak varsayılan USD/TRY. */
const FALLBACK_USD_TRY = 44;

/** Ücretsiz döviz API’si (USD bazlı TRY kuru). */
const OPEN_ER_API = 'https://open.er-api.com/v6/latest/USD';

/**
 * USD/TRY kurunu saklar, internetten yeniler ve mağaza/sepet dönüşümü için efektif kur döner.
 */
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  constructor(
    @InjectRepository(ExchangeSettings)
    private readonly exchangeRepo: Repository<ExchangeSettings>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Tek satırlık ayar kaydını getirir veya oluşturur.
   */
  async getOrCreateSettings(): Promise<ExchangeSettings> {
    const existing = await this.exchangeRepo.find({
      order: { createdAt: 'ASC' },
      take: 1,
    });
    if (existing.length > 0) {
      return existing[0];
    }
    const row = this.exchangeRepo.create({
      fetchedUsdTryRate: null,
      fetchedAt: null,
      fetchSource: null,
      manualUsdTryRate: null,
    });
    return await this.exchangeRepo.save(row);
  }

  /**
   * Manuel kur doluysa onu, değilse son çekilen kurarı; ikisi de yoksa fallback döner.
   */
  async getEffectiveUsdTryRate(): Promise<number> {
    const row = await this.getOrCreateSettings();
    const manual = row.manualUsdTryRate != null
      ? Number(row.manualUsdTryRate)
      : null;
    if (manual != null && !Number.isNaN(manual) && manual > 0) {
      return manual;
    }
    const fetched = row.fetchedUsdTryRate != null
      ? Number(row.fetchedUsdTryRate)
      : null;
    if (fetched != null && !Number.isNaN(fetched) && fetched > 0) {
      return fetched;
    }
    return FALLBACK_USD_TRY;
  }

  /**
   * Müşteri ve ayarlar ekranı için özet DTO üretir.
   */
  async getPublicSnapshot(): Promise<ExchangeRatePublicResponseDto> {
    const row = await this.getOrCreateSettings();
    const rate = await this.getEffectiveUsdTryRate();
    const isManual =
      row.manualUsdTryRate != null &&
      !Number.isNaN(Number(row.manualUsdTryRate)) &&
      Number(row.manualUsdTryRate) > 0;
    return {
      usdTryRate: rate,
      isManualOverride: isManual,
      fetchedAt: row.fetchedAt,
      fetchSource: row.fetchSource,
    };
  }

  /**
   * İnternetten USD/TRY kurunu çeker ve kaydeder; önbelleği temizler.
   */
  async refreshFromInternet(): Promise<ExchangeRatePublicResponseDto> {
    try {
      const response = await fetch(OPEN_ER_API, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        result?: string;
        rates?: Record<string, number>;
      };
      const tryRate = data?.rates?.TRY;
      if (data?.result !== 'success' || !tryRate || Number.isNaN(tryRate)) {
        throw new Error('Geçersiz API yanıtı');
      }
      const row = await this.getOrCreateSettings();
      row.fetchedUsdTryRate = String(tryRate);
      row.fetchedAt = new Date();
      row.fetchSource = 'open.er-api.com';
      await this.exchangeRepo.save(row);
      await this.invalidateStoreCaches();
      return await this.getPublicSnapshot();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[refreshFromInternet] başarısız: ${msg}`);
      throw new ServiceUnavailableException(
        'Döviz kuru şu an güncellenemedi; kayıtlı kur kullanılacak.',
      );
    }
  }

  /**
   * Manuel USD/TRY kurunu ayarlar veya kaldırır.
   */
  async setManualUsdTryRate(
    rate: number | null | undefined,
  ): Promise<ExchangeRatePublicResponseDto> {
    const row = await this.getOrCreateSettings();
    if (rate === null || rate === undefined) {
      row.manualUsdTryRate = null;
    } else if (Number.isNaN(rate) || rate <= 0) {
      throw new ServiceUnavailableException('Geçersiz kur değeri');
    } else {
      row.manualUsdTryRate = String(rate);
    }
    await this.exchangeRepo.save(row);
    await this.invalidateStoreCaches();
    return await this.getPublicSnapshot();
  }

  /**
   * Ürün listesi/detay önbelleğini temizler (kur değişince TL fiyatlar güncellenir).
   */
  private async invalidateStoreCaches(): Promise<void> {
    try {
      await this.cacheService.clearCache();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[invalidateStoreCaches] ${msg}`);
    }
  }

  /**
   * Haftalık otomatik kur güncellemesi — Pazar 00:00 UTC (CronExpression.EVERY_WEEK).
   * Başarısız olursa sessizce loglanır; kayıtlı kur kullanılmaya devam edilir.
   */
  @Cron(CronExpression.EVERY_WEEK)
  async scheduledRefresh(): Promise<void> {
    try {
      await this.refreshFromInternet();
      this.logger.log('[scheduledRefresh] USD/TRY güncellendi');
    } catch {
      /* Kayıtlı kur ile devam */
    }
  }
}
