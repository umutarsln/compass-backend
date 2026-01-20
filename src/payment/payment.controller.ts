import {
    Controller,
    Post,
    Body,
    Req,
    Res,
    HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PaymentService } from './payment.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { PaymentProvider } from '../common/enums/payment-provider.enum';

@Controller('payments')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    /**
     * Start checkout process
     */
    @Post('checkout')
    async checkout(@Body() checkoutDto: CheckoutDto): Promise<CheckoutResponseDto> {
        return this.paymentService.createCheckout(checkoutDto);
    }

    /**
     * Iyzico callback endpoint
     * Note: Iyzico sends callback as application/x-www-form-urlencoded
     */
    @Post('iyzico/callback')
    async iyzicoCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
        // Iyzico sends token as form data
        const token = req.body?.token || req.query?.token;

        if (!token) {
            res.status(HttpStatus.BAD_REQUEST).send('Token is required');
            return;
        }

        try {
            const result = await this.paymentService.handleCallback(
                token as string,
                PaymentProvider.IYZICO,
            );

            // Redirect to frontend
            res.redirect(HttpStatus.FOUND, result.redirectUrl);
        } catch (error) {
            const frontendFailUrl = process.env.FRONTEND_FAIL_URL || '';
            res.redirect(
                HttpStatus.FOUND,
                `${frontendFailUrl}?error=${encodeURIComponent(error.message || 'Payment processing failed')}`,
            );
        }
    }

    /**
     * Iyzico webhook endpoint
     */
    @Post('iyzico/webhook')
    async iyzicoWebhook(@Req() req: Request, @Res() res: Response): Promise<void> {
        try {
            await this.paymentService.handleWebhook(req.body, PaymentProvider.IYZICO);
            res.status(HttpStatus.OK).send('OK');
        } catch (error) {
            // Log error but return 200 to prevent retries for invalid requests
            console.error('Webhook error:', error);
            res.status(HttpStatus.OK).send('OK');
        }
    }
}
