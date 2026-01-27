import { Injectable, Logger } from '@nestjs/common';
import {
    PaymentProvider,
    InitializeCheckoutInput,
    NormalizedPaymentResult,
    NormalizedWebhookResult,
} from '../payment-provider.interface';
import { PaymentSettings } from '../../payment-settings.entity';

@Injectable()
export class IbanEftProvider implements PaymentProvider {
    private readonly logger = new Logger(IbanEftProvider.name);
    private settings: PaymentSettings | null = null;

    /**
     * Set payment settings (called from PaymentService)
     */
    setSettings(settings: PaymentSettings): void {
        this.settings = settings;
        this.logger.log('[setSettings] IBAN EFT settings updated');
    }

    /**
     * Initialize checkout - IBAN EFT için direkt ödeme sayfası yok,
     * sadece IBAN bilgilerini döndürür
     */
    async initializeCheckout(input: InitializeCheckoutInput): Promise<{
        token: string;
        redirectUrl: string;
        providerRef?: string;
    }> {
        this.logger.log(`[initializeCheckout] Initializing IBAN EFT checkout for order: ${input.orderId}`);

        if (!this.settings || !this.settings.ibanEftEnabled) {
            throw new Error('IBAN EFT payment method is not enabled');
        }

        if (!this.settings.ibanNumber || !this.settings.accountName || !this.settings.bankName) {
            throw new Error('IBAN EFT settings are incomplete');
        }

        // IBAN EFT için token oluştur (orderId bazlı)
        const token = `iban_eft_${input.orderId}_${Date.now()}`;

        // Frontend'e yönlendirme URL'i (ödeme sayfası)
        // Frontend bu token ile IBAN bilgilerini gösterir
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const redirectUrl = `${frontendUrl}/odeme?token=${token}&method=iban-eft`;

        this.logger.log(`[initializeCheckout] IBAN EFT checkout initialized - token: ${token.substring(0, 20)}...`);

        return {
            token,
            redirectUrl,
            providerRef: token,
        };
    }

    /**
     * Retrieve checkout - IBAN EFT için ödeme durumu kontrol edilir
     * Admin dekontu onayladığında order status güncellenir
     */
    async retrieveCheckout(token: string, conversationId?: string): Promise<NormalizedPaymentResult> {
        this.logger.log(`[retrieveCheckout] Retrieving IBAN EFT checkout for token: ${token.substring(0, 20)}...`);

        // Token'dan orderId'yi çıkar
        const orderIdMatch = token.match(/iban_eft_([^_]+)_/);
        if (!orderIdMatch) {
            throw new Error('Invalid IBAN EFT token format');
        }

        // IBAN EFT için ödeme durumu order status'üne bağlı
        // Eğer order status CONFIRMED veya PROCESSING ise ödeme başarılı sayılır
        // Bu kontrol PaymentService'de yapılacak

        return {
            status: 'PENDING', // IBAN EFT için her zaman PENDING döner, admin onayı bekler
            providerPaymentId: token,
            raw: { token, conversationId },
        };
    }

    /**
     * Handle webhook - IBAN EFT için webhook yok
     * Ödeme admin tarafından manuel onaylanır
     */
    async handleWebhook(payload: any): Promise<NormalizedWebhookResult> {
        this.logger.log(`[handleWebhook] IBAN EFT does not support webhooks`);
        throw new Error('IBAN EFT does not support webhooks');
    }

    /**
     * Get IBAN information for frontend
     */
    getIbanInfo(): {
        iban: string;
        accountName: string;
        bankName: string;
        whatsappNumber: string | null;
    } | null {
        if (!this.settings || !this.settings.ibanEftEnabled) {
            return null;
        }

        return {
            iban: this.settings.ibanNumber || '',
            accountName: this.settings.accountName || '',
            bankName: this.settings.bankName || '',
            whatsappNumber: this.settings.whatsappNumber || null,
        };
    }
}
