import {
    Controller,
    Post,
    All,
    Body,
    Req,
    Res,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PaymentService } from './payment.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { PaymentProvider } from '../common/enums/payment-provider.enum';

@Controller('payments')
export class PaymentController {
    private readonly logger = new Logger(PaymentController.name);

    constructor(private readonly paymentService: PaymentService) { }

    /**
     * QNBpay dönüşünde query + body alanlarını birleştirir.
     */
    private mergeQnbPayParams(req: Request): Record<string, string | string[] | undefined> {
        return { ...(req.query as Record<string, string | string[]>), ...(req.body || {}) };
    }

    /**
     * Start checkout process
     */
    @Post('checkout')
    async checkout(@Body() checkoutDto: CheckoutDto, @Req() req: Request): Promise<CheckoutResponseDto> {
        this.logger.log(`[checkout] POST /payments/checkout - orderId: ${checkoutDto.orderId}, provider: ${checkoutDto.provider || 'default'}`);
        try {
            const xf = req.headers['x-forwarded-for'];
            const clientIp =
                typeof xf === 'string'
                    ? xf.split(',')[0].trim()
                    : req.socket?.remoteAddress || undefined;
            const result = await this.paymentService.createCheckout(checkoutDto, { clientIp });
            this.logger.log(`[checkout] Checkout successful - attemptId: ${result.attemptId}, redirectUrl: ${result.redirectUrl?.substring(0, 50)}...`);
            return result;
        } catch (error) {
            this.logger.error(`[checkout] Checkout failed for orderId ${checkoutDto.orderId}: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Iyzico callback endpoint
     * Note: Iyzico sends callback as application/x-www-form-urlencoded
     */
    @Post('iyzico/callback')
    async iyzicoCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
        this.logger.log(`[iyzicoCallback] POST /payments/iyzico/callback received`);
        this.logger.debug(`[iyzicoCallback] Request body: ${JSON.stringify(req.body)}, query: ${JSON.stringify(req.query)}`);

        // Iyzico sends token as form data
        const token = req.body?.token || req.query?.token;

        this.logger.debug(`[iyzicoCallback] Token extracted: ${token ? token.substring(0, 20) + '...' : 'MISSING'}`);

        if (!token) {
            this.logger.error(`[iyzicoCallback] Token is missing in request`);
            res.status(HttpStatus.BAD_REQUEST).send('Token is required');
            return;
        }

        try {
            this.logger.log(`[iyzicoCallback] Processing callback for token: ${token.substring(0, 20)}...`);
            const result = await this.paymentService.handleCallback(
                token as string,
                PaymentProvider.IYZICO,
            );

            this.logger.log(`[iyzicoCallback] Callback processed successfully. Redirecting to: ${result.redirectUrl}`);
            // Redirect to frontend
            res.redirect(HttpStatus.FOUND, result.redirectUrl);
        } catch (error) {
            this.logger.error(`[iyzicoCallback] Error processing callback: ${error.message}`, error.stack);
            const frontendFailUrl = process.env.FRONTEND_FAIL_URL || '';
            this.logger.debug(`[iyzicoCallback] Frontend fail URL: ${frontendFailUrl}`);
            const errorUrl = `${frontendFailUrl}?error=${encodeURIComponent(error.message || 'Payment processing failed')}`;
            this.logger.warn(`[iyzicoCallback] Redirecting to error page: ${errorUrl}`);
            res.redirect(HttpStatus.FOUND, errorUrl);
        }
    }

    /**
     * QNBpay başarılı dönüş (GET veya POST).
     */
    @All('qnbpay/return')
    async qnbpayReturn(@Req() req: Request, @Res() res: Response): Promise<void> {
        this.logger.log(`[qnbpayReturn] ${req.method} /payments/qnbpay/return`);
        try {
            const result = await this.paymentService.handleQnbPayReturn(this.mergeQnbPayParams(req));
            res.redirect(HttpStatus.FOUND, result.redirectUrl);
        } catch (error: any) {
            this.logger.error(`[qnbpayReturn] ${error.message}`, error.stack);
            const frontendFailUrl = process.env.FRONTEND_FAIL_URL || '';
            res.redirect(
                HttpStatus.FOUND,
                `${frontendFailUrl}?error=${encodeURIComponent(error.message || 'Ödeme işlenemedi')}`,
            );
        }
    }

    /**
     * QNBpay iptal dönüşü.
     */
    @All('qnbpay/cancel')
    async qnbpayCancel(@Req() req: Request, @Res() res: Response): Promise<void> {
        this.logger.log(`[qnbpayCancel] ${req.method} /payments/qnbpay/cancel`);
        try {
            const result = await this.paymentService.handleQnbPayCancel(this.mergeQnbPayParams(req));
            res.redirect(HttpStatus.FOUND, result.redirectUrl);
        } catch (error: any) {
            const frontendFailUrl = process.env.FRONTEND_FAIL_URL || '';
            res.redirect(
                HttpStatus.FOUND,
                `${frontendFailUrl}?error=${encodeURIComponent(error.message || 'İptal')}`,
            );
        }
    }

    /**
     * QNBpay satış webhook.
     */
    @Post('qnbpay/webhook')
    async qnbpayWebhook(@Req() req: Request, @Res() res: Response): Promise<void> {
        this.logger.log(`[qnbpayWebhook] POST /payments/qnbpay/webhook`);
        try {
            await this.paymentService.handleWebhook(req.body, PaymentProvider.QNBPAY);
            res.status(HttpStatus.OK).send('OK');
        } catch (error: any) {
            this.logger.error(`[qnbpayWebhook] ${error.message}`, error.stack);
            res.status(HttpStatus.OK).send('OK');
        }
    }

    /**
     * Iyzico webhook endpoint
     */
    @Post('iyzico/webhook')
    async iyzicoWebhook(@Req() req: Request, @Res() res: Response): Promise<void> {
        this.logger.log(`[iyzicoWebhook] POST /payments/iyzico/webhook received`);
        this.logger.debug(`[iyzicoWebhook] Webhook payload: ${JSON.stringify(req.body)}`);

        try {
            await this.paymentService.handleWebhook(req.body, PaymentProvider.IYZICO);
            this.logger.log(`[iyzicoWebhook] Webhook processed successfully`);
            res.status(HttpStatus.OK).send('OK');
        } catch (error) {
            // Log error but return 200 to prevent retries for invalid requests
            this.logger.error(`[iyzicoWebhook] Error processing webhook: ${error.message}`, error.stack);
            this.logger.warn(`[iyzicoWebhook] Returning 200 OK to prevent retries`);
            res.status(HttpStatus.OK).send('OK');
        }
    }

    /**
     * Get IBAN information for IBAN EFT payment
     */
    @Post('iban-eft/info')
    async getIbanInfo(): Promise<{
        iban: string;
        accountName: string;
        bankName: string;
        whatsappNumber: string | null;
    } | null> {
        this.logger.log(`[getIbanInfo] Getting IBAN EFT information`);
        return await this.paymentService.getIbanInfo();
    }
}
