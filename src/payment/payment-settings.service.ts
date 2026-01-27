import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentSettings } from './payment-settings.entity';

@Injectable()
export class PaymentSettingsService {
    private readonly logger = new Logger(PaymentSettingsService.name);
    private settingsCache: PaymentSettings | null = null;

    constructor(
        @InjectRepository(PaymentSettings)
        private paymentSettingsRepository: Repository<PaymentSettings>,
    ) {}

    /**
     * Get payment settings (singleton - only one settings record)
     */
    async getSettings(): Promise<PaymentSettings> {
        // Cache'den kontrol et
        if (this.settingsCache) {
            return this.settingsCache;
        }

        let settings = await this.paymentSettingsRepository.findOne({
            where: {},
            order: { createdAt: 'ASC' }, // İlk kaydı al
        });

        // Eğer settings yoksa, varsayılan bir tane oluştur
        if (!settings) {
            this.logger.log('[getSettings] No settings found, creating default settings');
            settings = this.paymentSettingsRepository.create({
                iyzicoEnabled: false,
                ibanEftEnabled: false,
            });
            settings = await this.paymentSettingsRepository.save(settings);
        }

        this.settingsCache = settings;
        return settings;
    }

    /**
     * Update payment settings
     */
    async updateSettings(updates: Partial<PaymentSettings>): Promise<PaymentSettings> {
        const settings = await this.getSettings();

        // Güncellemeleri uygula
        Object.assign(settings, updates);

        const updated = await this.paymentSettingsRepository.save(settings);
        
        // Cache'i temizle
        this.settingsCache = null;

        this.logger.log('[updateSettings] Payment settings updated');
        return updated;
    }

    /**
     * Clear cache (settings değiştiğinde çağrılmalı)
     */
    clearCache(): void {
        this.settingsCache = null;
    }
}
