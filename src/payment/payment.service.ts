import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentAttempt } from './payment-attempt.entity';
import { PaymentProvider } from '../common/enums/payment-provider.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { OrderService } from '../order/order.service';
import { Order } from '../order/order.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { PaymentProvider as PaymentProviderInterface } from './providers/payment-provider.interface';
import { IyzicoProvider } from './providers/iyzico/iyzico.provider';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
    private providers: Map<PaymentProvider, PaymentProviderInterface>;

    constructor(
        @InjectRepository(PaymentAttempt)
        private paymentAttemptRepository: Repository<PaymentAttempt>,
        @InjectRepository(Order)
        private orderRepository: Repository<Order>,
        private orderService: OrderService,
        private configService: ConfigService,
        private iyzicoProvider: IyzicoProvider,
    ) {
        // Register providers
        this.providers = new Map();
        this.providers.set(PaymentProvider.IYZICO, iyzicoProvider);
    }

    /**
     * Get provider instance
     */
    private getProvider(provider: PaymentProvider): PaymentProviderInterface {
        const providerInstance = this.providers.get(provider);
        if (!providerInstance) {
            throw new BadRequestException(`Payment provider ${provider} is not available`);
        }
        return providerInstance;
    }

    /**
     * Generate unique conversation ID
     */
    private generateConversationId(): string {
        return `order_${crypto.randomUUID()}`;
    }

    /**
     * Create checkout and initialize payment
     */
    async createCheckout(checkoutDto: CheckoutDto): Promise<CheckoutResponseDto> {
        // Get order entity with user relation for email access
        const orderEntity = await this.orderRepository.findOne({
            where: { id: checkoutDto.orderId },
            relations: ['user', 'items', 'items.product', 'items.variant'],
        });

        console.log('Order entity:', orderEntity)

        if (!orderEntity) {
            throw new NotFoundException('Order not found');
        }

        if (orderEntity.status !== OrderStatus.PENDING) {
            throw new BadRequestException(`Order is ${orderEntity.status}, cannot initiate payment`);
        }

        // Get order DTO for response
        const order = await this.orderService.getOrder(checkoutDto.orderId, null, false);
        console.log('Order:', order)

        // Check if there's already a successful payment attempt
        const existingAttempt = await this.paymentAttemptRepository.findOne({
            where: {
                orderId: checkoutDto.orderId,
                status: PaymentStatus.SUCCESS,
            },
        });

        console.log('Existing attempt:', existingAttempt)

        if (existingAttempt) {
            throw new BadRequestException('Order is already paid');
        }

        // Determine provider
        const provider =
            checkoutDto.provider ||
            (this.configService.get<string>('PAYMENT_PROVIDER_DEFAULT') as PaymentProvider) ||
            PaymentProvider.IYZICO;

        console.log('Provider:', provider)

        const providerInstance = this.getProvider(provider);

        console.log('Provider instance:', providerInstance)

        // Create payment attempt
        const conversationId = this.generateConversationId();

        console.log('Conversation ID:', conversationId)
        const attempt = this.paymentAttemptRepository.create({
            orderId: checkoutDto.orderId,
            provider,
            status: PaymentStatus.INITIATED,
            conversationId,
            amount: orderEntity.total,
            currency: orderEntity.currency,
        });

        console.log('Attempt:', attempt)

        await this.paymentAttemptRepository.save(attempt);

        try {
            // Prepare buyer info
            // For authenticated users, use user email from relation
            // For guest users, use guest email
            const userEmail = orderEntity.user?.email || orderEntity.guestEmail;
            const userPhone = orderEntity.shippingAddress?.phone || orderEntity.guestPhone;
            const buyerName = orderEntity.shippingAddress?.firstName || orderEntity.guestFirstName;
            const buyerSurname = orderEntity.shippingAddress?.lastName || orderEntity.guestLastName;

            if (!userEmail) {
                throw new BadRequestException('Email is required for checkout');
            }
            if (!userPhone) {
                throw new BadRequestException('Phone is required for checkout');
            }
            if (!buyerName) {
                throw new BadRequestException('First name is required for checkout');
            }
            if (!buyerSurname) {
                throw new BadRequestException('Last name is required for checkout');
            }
            if (!order.shippingAddress?.city) {
                throw new BadRequestException('City is required for checkout');
            }
            if (!order.shippingAddress?.address) {
                throw new BadRequestException('Address is required for checkout');
            }
            if (!order.shippingAddress?.postalCode) {
                throw new BadRequestException('Postal code is required for checkout');
            }

            const buyerInfo = {
                id: orderEntity.userId || undefined,
                name: buyerName,
                surname: buyerSurname,
                email: userEmail,
                phone: userPhone,
                identityNumber: undefined,
                city: orderEntity.shippingAddress.city,
                country: orderEntity.shippingAddress.country || 'TR',
                zipCode: orderEntity.shippingAddress.postalCode,
                address: orderEntity.shippingAddress.address,
            };

            // Get callback URLs
            const appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL');
            console.log('App public URL:', appPublicUrl)
            const callbackPath =
                this.configService.get<string>('IYZICO_PAYMENT_CALLBACK_PATH') ||
                '/payments/iyzico/callback';
            console.log('Callback path:', callbackPath)
            const webhookPath =
                this.configService.get<string>('IYZICO_PAYMENT_WEBHOOK_PATH') ||
                '/payments/iyzico/webhook';
            console.log('Webhook path:', webhookPath)
            const callbackUrl = `${appPublicUrl}${callbackPath}`;
            console.log('Callback URL:', callbackUrl)
            const webhookUrl = `${appPublicUrl}${webhookPath}`;
            console.log('Webhook URL:', webhookUrl)

            // Initialize checkout
            // Convert Decimal values to numbers
            const totalAmount = typeof orderEntity.total === 'string'
                ? parseFloat(orderEntity.total)
                : Number(orderEntity.total);

            console.log('Total amount:', totalAmount)

            const result = await providerInstance.initializeCheckout({
                orderId: checkoutDto.orderId,
                conversationId,
                amount: totalAmount,
                currency: orderEntity.currency,
                callbackUrl,
                webhookUrl,
                buyerInfo,
                shippingAddress: {
                    contactName: `${buyerInfo.name} ${buyerInfo.surname}`,
                    city: buyerInfo.city,
                    country: buyerInfo.country,
                    zipCode: buyerInfo.zipCode,
                    address: buyerInfo.address,
                },
                billingAddress: {
                    contactName: orderEntity.billingAddress
                        ? `${orderEntity.billingAddress.firstName || buyerInfo.name} ${orderEntity.billingAddress.lastName || buyerInfo.surname}`
                        : `${buyerInfo.name} ${buyerInfo.surname}`,
                    city: orderEntity.billingAddress?.city || buyerInfo.city,
                    country: orderEntity.billingAddress?.country || buyerInfo.country,
                    zipCode: orderEntity.billingAddress?.postalCode || buyerInfo.zipCode,
                    address: orderEntity.billingAddress?.address || buyerInfo.address,
                },
                basketItems: orderEntity.items.map((item) => {
                    // Convert Decimal unitPrice to number
                    const unitPrice = typeof item.unitPrice === 'string'
                        ? parseFloat(item.unitPrice)
                        : Number(item.unitPrice);
                    return {
                        id: item.productId,
                        name: item.productName,
                        category1: 'Product',
                        itemType: 'PHYSICAL' as const,
                        price: unitPrice,
                    };
                }),
            });

            // Update attempt with token and redirect URL
            attempt.token = result.token;
            attempt.paymentPageUrl = result.redirectUrl;
            attempt.status = PaymentStatus.REDIRECTED;
            await this.paymentAttemptRepository.save(attempt);

            return {
                attemptId: attempt.id,
                provider,
                redirectUrl: result.redirectUrl,
                token: result.token,
            };
        } catch (error) {
            attempt.status = PaymentStatus.FAILURE;
            attempt.errorMessage = error.message;
            await this.paymentAttemptRepository.save(attempt);
            throw error;
        }
    }

    /**
     * Handle payment callback
     */
    async handleCallback(
        token: string,
        provider: PaymentProvider = PaymentProvider.IYZICO,
    ): Promise<{ success: boolean; orderId: string; redirectUrl: string }> {
        // Find attempt by token
        const attempt = await this.paymentAttemptRepository.findOne({
            where: { token, provider },
            relations: ['order'],
        });

        if (!attempt) {
            throw new NotFoundException('Payment attempt not found');
        }

        // If already processed, return existing result
        if (attempt.status === PaymentStatus.SUCCESS) {
            const frontendSuccessUrl = this.configService.get<string>('FRONTEND_SUCCESS_URL') || '';
            return {
                success: true,
                orderId: attempt.orderId,
                redirectUrl: `${frontendSuccessUrl}?orderId=${attempt.orderId}`,
            };
        }

        // Retrieve payment status from provider
        const providerInstance = this.getProvider(provider);
        const result = await providerInstance.retrieveCheckout(token);

        // Update attempt
        attempt.status =
            result.status === 'SUCCESS'
                ? PaymentStatus.SUCCESS
                : result.status === 'FAILURE'
                    ? PaymentStatus.FAILURE
                    : PaymentStatus.INITIATED;
        attempt.providerPaymentId = result.providerPaymentId ?? null;
        attempt.errorCode = result.errorCode ?? null;
        attempt.errorMessage = result.errorMessage ?? null;
        attempt.rawProviderResponse = result.raw;
        await this.paymentAttemptRepository.save(attempt);

        // If successful, mark order as paid
        if (result.status === 'SUCCESS') {
            await this.orderService.markOrderAsPaid(
                attempt.orderId,
                result.providerPaymentId || '',
                attempt.id,
            );
        }

        // Get redirect URLs
        const frontendSuccessUrl = this.configService.get<string>('FRONTEND_SUCCESS_URL') || '';
        const frontendFailUrl = this.configService.get<string>('FRONTEND_FAIL_URL') || '';

        if (result.status === 'SUCCESS') {
            return {
                success: true,
                orderId: attempt.orderId,
                redirectUrl: `${frontendSuccessUrl}?orderId=${attempt.orderId}`,
            };
        } else {
            return {
                success: false,
                orderId: attempt.orderId,
                redirectUrl: `${frontendFailUrl}?orderId=${attempt.orderId}&error=${encodeURIComponent(result.errorMessage || 'Payment failed')}`,
            };
        }
    }

    /**
     * Handle webhook
     */
    async handleWebhook(
        payload: any,
        provider: PaymentProvider = PaymentProvider.IYZICO,
    ): Promise<void> {
        const providerInstance = this.getProvider(provider);
        const result = await providerInstance.handleWebhook(payload);

        // Find attempt by conversationId or paymentId
        const attempt = await this.paymentAttemptRepository.findOne({
            where: [
                { conversationId: payload.conversationId },
                { providerPaymentId: result.providerPaymentId },
            ],
        });

        if (!attempt) {
            throw new NotFoundException('Payment attempt not found');
        }

        // Idempotency check: if already successful, ignore
        if (attempt.status === PaymentStatus.SUCCESS) {
            return;
        }

        // Update attempt
        attempt.status =
            result.status === 'SUCCESS'
                ? PaymentStatus.SUCCESS
                : result.status === 'FAILURE'
                    ? PaymentStatus.FAILURE
                    : attempt.status;
        attempt.providerPaymentId = result.providerPaymentId || attempt.providerPaymentId;
        attempt.errorCode = result.errorCode ?? null;
        attempt.errorMessage = result.errorMessage ?? null;
        attempt.rawProviderResponse = result.raw;
        await this.paymentAttemptRepository.save(attempt);

        // If successful, mark order as paid
        if (result.status === 'SUCCESS') {
            await this.orderService.markOrderAsPaid(
                attempt.orderId,
                result.providerPaymentId || '',
                attempt.id,
            );
        }
    }
}
