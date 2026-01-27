import {
    Controller,
    Get,
    Patch,
    Body,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentSettingsService } from './payment-settings.service';
import { PaymentSettings } from './payment-settings.entity';

@ApiTags('Payment Settings')
@Controller('payment-settings')
@ApiBearerAuth()
export class PaymentSettingsController {
    constructor(private readonly paymentSettingsService: PaymentSettingsService) { }

    @Get()
    @ApiOperation({
        summary: 'Ödeme ayarlarını getir',
        description: 'Iyzico ve IBAN EFT ödeme ayarlarını döndürür. Sadece admin kullanıcılar erişebilir.'
    })
    @ApiResponse({
        status: 200,
        description: 'Ödeme ayarları başarıyla döndürüldü',
        type: PaymentSettings,
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - Giriş yapmanız gerekiyor',
    })
    @ApiResponse({
        status: 403,
        description: 'Forbidden - Bu işlem için yetkiniz yok',
    })
    async getSettings(): Promise<PaymentSettings> {
        return await this.paymentSettingsService.getSettings();
    }

    @Patch()
    @ApiOperation({
        summary: 'Ödeme ayarlarını güncelle',
        description: 'Iyzico ve IBAN EFT ödeme ayarlarını günceller. Sadece admin kullanıcılar erişebilir.'
    })
    @ApiResponse({
        status: 200,
        description: 'Ödeme ayarları başarıyla güncellendi',
        type: PaymentSettings,
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - Giriş yapmanız gerekiyor',
    })
    @ApiResponse({
        status: 403,
        description: 'Forbidden - Bu işlem için yetkiniz yok',
    })
    async updateSettings(@Body() updates: Partial<PaymentSettings>): Promise<PaymentSettings> {
        const updated = await this.paymentSettingsService.updateSettings(updates);
        // Cache'i temizle
        this.paymentSettingsService.clearCache();
        return updated;
    }
}
