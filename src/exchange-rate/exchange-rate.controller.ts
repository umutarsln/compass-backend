import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ExchangeRateService } from './exchange-rate.service';
import { ExchangeRatePublicResponseDto } from './dto/exchange-rate-public-response.dto';
import { UpdateManualExchangeRateDto } from './dto/update-manual-exchange-rate.dto';
import { ExchangeSettings } from './exchange-settings.entity';

@ApiTags('Exchange Rate')
@Controller('exchange-rate')
export class ExchangeRateController {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  /**
   * Mağaza ve anonim istemciler için güncel efektif kur özeti.
   */
  @Get()
  @ApiOperation({ summary: 'USD/TRY efektif kur özeti (public)' })
  @ApiResponse({ status: 200, type: ExchangeRatePublicResponseDto })
  async getPublic(): Promise<ExchangeRatePublicResponseDto> {
    return await this.exchangeRateService.getPublicSnapshot();
  }

  /**
   * Admin panel için tam ayar satırı (manuel kur dahil).
   */
  @Get('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: tam döviz ayarı kaydı' })
  @ApiResponse({ status: 200, type: ExchangeSettings })
  async getAdmin(): Promise<ExchangeSettings> {
    return await this.exchangeRateService.getOrCreateSettings();
  }

  /**
   * Manuel kur güncelleme veya kaldırma.
   */
  @Patch('manual')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: manuel USD/TRY kurunu ayarla veya kaldır' })
  @ApiResponse({ status: 200, type: ExchangeRatePublicResponseDto })
  async patchManual(
    @Body() body: UpdateManualExchangeRateDto,
  ): Promise<ExchangeRatePublicResponseDto> {
    return await this.exchangeRateService.setManualUsdTryRate(
      body.manualUsdTryRate,
    );
  }

  /**
   * İnternetten kur çek ve kaydet.
   */
  @Post('refresh')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: internetten USD/TRY kurunu yenile' })
  @ApiResponse({ status: 200, type: ExchangeRatePublicResponseDto })
  async refresh(): Promise<ExchangeRatePublicResponseDto> {
    return await this.exchangeRateService.refreshFromInternet();
  }
}
