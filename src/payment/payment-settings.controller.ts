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
import { PaymentSettingsPublicDto } from './dto/payment-settings-public.dto';

@ApiTags('Payment Settings')
@Controller('payment-settings')
export class PaymentSettingsController {
    constructor(private readonly paymentSettingsService: PaymentSettingsService) { }

    @Get()
    @ApiOperation({
        summary: 'Public ödeme bayrakları',
        description: 'Hangi ödeme yöntemleri açık; API anahtarları ve sırlar dönmez.',
    })
    @ApiResponse({
        status: 200,
        description: 'Özet ayarlar',
        type: PaymentSettingsPublicDto,
    })
    async getPublicSettings(): Promise<PaymentSettingsPublicDto> {
        return await this.paymentSettingsService.getPublicPaymentSettings();
    }

    @Get('admin')
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Admin: tam ödeme ayarları',
        description: 'Iyzico, IBAN ve QNBpay alanları dahil tüm kayıt (yalnızca ADMIN).',
    })
    @ApiResponse({
        status: 200,
        description: 'Ödeme ayarları',
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
    async getAdminSettings(): Promise<PaymentSettings> {
        return await this.paymentSettingsService.getSettings();
    }

    @Patch()
    @ApiBearerAuth()
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
