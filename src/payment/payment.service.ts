import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
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
import { IbanEftProvider } from './providers/iban-eft/iban-eft.provider';
import { PaymentSettingsService } from './payment-settings.service';
import { CartService } from '../cart/cart.service';
import { MailService, OrderItemWithImage } from '../mail/mail.service';
import * as crypto from 'crypto';

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);
    private providers: Map<PaymentProvider, PaymentProviderInterface>;

    constructor(
        @InjectRepository(PaymentAttempt)
        private paymentAttemptRepository: Repository<PaymentAttempt>,
        @InjectRepository(Order)
        private orderRepository: Repository<Order>,
        private orderService: OrderService,
        private cartService: CartService,
        private mailService: MailService,
        private configService: ConfigService,
        private paymentSettingsService: PaymentSettingsService,
        private iyzicoProvider: IyzicoProvider,
        private ibanEftProvider: IbanEftProvider,
    ) {
        // Register providers
        this.providers = new Map();
        this.providers.set(PaymentProvider.IYZICO, iyzicoProvider);
        this.providers.set(PaymentProvider.IBAN_EFT, ibanEftProvider);
        this.logger.log('PaymentService initialized with providers: IYZICO, IBAN_EFT');
        
        // Initialize providers with settings
        this.initializeProviders();
    }

    /**
     * Initialize providers with payment settings
     */
    private async initializeProviders(): Promise<void> {
        try {
            const settings = await this.paymentSettingsService.getSettings();
            
            // Iyzico provider'a settings'i set et
            if (this.iyzicoProvider && typeof (this.iyzicoProvider as any).setSettings === 'function') {
                (this.iyzicoProvider as any).setSettings(settings);
            }
            
            // IBAN EFT provider'a settings'i set et
            if (this.ibanEftProvider && typeof (this.ibanEftProvider as any).setSettings === 'function') {
                (this.ibanEftProvider as any).setSettings(settings);
            }
            
            this.logger.log('[initializeProviders] Providers initialized with settings');
        } catch (error: any) {
            this.logger.warn('[initializeProviders] Failed to initialize providers with settings:', error.message);
        }
    }

    /**
     * Get provider instance
     */
    private getProvider(provider: PaymentProvider): PaymentProviderInterface {
        this.logger.debug(`Getting provider instance for: ${provider}`);
        const providerInstance = this.providers.get(provider);
        if (!providerInstance) {
            this.logger.error(`Payment provider ${provider} is not available`);
            throw new BadRequestException(`Payment provider ${provider} is not available`);
        }
        this.logger.debug(`Provider ${provider} instance retrieved successfully`);
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
        this.logger.log(`[createCheckout] Starting checkout process for orderId: ${checkoutDto.orderId}`);
        this.logger.debug(`[createCheckout] Checkout DTO: ${JSON.stringify(checkoutDto)}`);

        let attempt: PaymentAttempt | undefined;

        try {
            // Get order entity with user relation for email access
            this.logger.debug(`[createCheckout] Fetching order entity with relations...`);
            const orderEntity = await this.orderRepository.findOne({
                where: { id: checkoutDto.orderId },
                relations: ['user', 'items', 'items.product', 'items.product.categories', 'items.product.categories.parent', 'items.variant'],
            });

            if (!orderEntity) {
                this.logger.error(`[createCheckout] Order not found: ${checkoutDto.orderId}`);
                throw new NotFoundException('Order not found');
            }

            this.logger.debug(`[createCheckout] Order entity found: ${orderEntity.id}, status: ${orderEntity.status}, total: ${orderEntity.total}, currency: ${orderEntity.currency}`);
            this.logger.debug(`[createCheckout] Order has ${orderEntity.items?.length || 0} items`);

            if (orderEntity.status !== OrderStatus.PENDING) {
                this.logger.warn(`[createCheckout] Order ${checkoutDto.orderId} is ${orderEntity.status}, cannot initiate payment`);
                throw new BadRequestException(`Order is ${orderEntity.status}, cannot initiate payment`);
            }

            // Get order DTO for response
            this.logger.debug(`[createCheckout] Getting order DTO...`);
            const order = await this.orderService.getOrder(checkoutDto.orderId, null, false);
            this.logger.debug(`[createCheckout] Order DTO retrieved: ${JSON.stringify({ id: order.id, total: order.total, currency: order.currency })}`);

            // Check if there's already a successful payment attempt
            this.logger.debug(`[createCheckout] Checking for existing payment attempts...`);
            const existingAttempt = await this.paymentAttemptRepository.findOne({
                where: {
                    orderId: checkoutDto.orderId,
                    status: PaymentStatus.SUCCESS,
                },
            });

            if (existingAttempt) {
                this.logger.warn(`[createCheckout] Order ${checkoutDto.orderId} already has a successful payment attempt: ${existingAttempt.id}`);
                throw new BadRequestException('Order is already paid');
            }

            // Determine provider
            const provider =
                checkoutDto.provider ||
                (this.configService.get<string>('PAYMENT_PROVIDER_DEFAULT') as PaymentProvider) ||
                PaymentProvider.IYZICO;

            this.logger.log(`[createCheckout] Using payment provider: ${provider}`);

            // Provider için settings'i güncelle
            const settings = await this.paymentSettingsService.getSettings();
            
            if (provider === PaymentProvider.IYZICO) {
                if (this.iyzicoProvider && typeof (this.iyzicoProvider as any).setSettings === 'function') {
                    (this.iyzicoProvider as any).setSettings(settings);
                }
            } else if (provider === PaymentProvider.IBAN_EFT) {
                if (this.ibanEftProvider && typeof (this.ibanEftProvider as any).setSettings === 'function') {
                    (this.ibanEftProvider as any).setSettings(settings);
                }
            }

            const providerInstance = this.getProvider(provider);

            // Create payment attempt
            const conversationId = this.generateConversationId();
            this.logger.debug(`[createCheckout] Generated conversation ID: ${conversationId}`);

            attempt = this.paymentAttemptRepository.create({
                orderId: checkoutDto.orderId,
                provider,
                status: PaymentStatus.INITIATED,
                conversationId,
                amount: orderEntity.total,
                currency: orderEntity.currency,
            });

            this.logger.debug(`[createCheckout] Created payment attempt: ${JSON.stringify({ id: attempt.id, orderId: attempt.orderId, provider: attempt.provider, conversationId: attempt.conversationId })}`);
            attempt = await this.paymentAttemptRepository.save(attempt);
            this.logger.log(`[createCheckout] Payment attempt saved: ${attempt.id}`);

            // Prepare buyer info
            this.logger.debug(`[createCheckout] Preparing buyer information...`);
            // For authenticated users, use user email from relation
            // For guest users, use guest email
            const userEmail = orderEntity.user?.email || orderEntity.guestEmail;
            const userPhone = orderEntity.shippingAddress?.phone || orderEntity.guestPhone;
            const buyerName = orderEntity.shippingAddress?.firstName || orderEntity.guestFirstName;
            const buyerSurname = orderEntity.shippingAddress?.lastName || orderEntity.guestLastName;

            this.logger.debug(`[createCheckout] Buyer info extracted: email=${userEmail ? '***' : 'MISSING'}, phone=${userPhone ? '***' : 'MISSING'}, name=${buyerName || 'MISSING'}, surname=${buyerSurname || 'MISSING'}`);

            if (!userEmail) {
                this.logger.error(`[createCheckout] Email is missing for order ${checkoutDto.orderId}`);
                throw new BadRequestException('Email is required for checkout');
            }
            if (!userPhone) {
                this.logger.error(`[createCheckout] Phone is missing for order ${checkoutDto.orderId}`);
                throw new BadRequestException('Phone is required for checkout');
            }
            if (!buyerName) {
                this.logger.error(`[createCheckout] First name is missing for order ${checkoutDto.orderId}`);
                throw new BadRequestException('First name is required for checkout');
            }
            if (!buyerSurname) {
                this.logger.error(`[createCheckout] Last name is missing for order ${checkoutDto.orderId}`);
                throw new BadRequestException('Last name is required for checkout');
            }
            if (!order.shippingAddress?.city) {
                this.logger.error(`[createCheckout] City is missing for order ${checkoutDto.orderId}`);
                throw new BadRequestException('City is required for checkout');
            }
            if (!order.shippingAddress?.address) {
                this.logger.error(`[createCheckout] Address is missing for order ${checkoutDto.orderId}`);
                throw new BadRequestException('Address is required for checkout');
            }
            if (!order.shippingAddress?.postalCode) {
                this.logger.error(`[createCheckout] Postal code is missing for order ${checkoutDto.orderId}`);
                throw new BadRequestException('Postal code is required for checkout');
            }

            // Generate buyerId: use userId if authenticated, otherwise generate UUID for guest
            const buyerId = orderEntity.userId || crypto.randomUUID();
            this.logger.debug(`[createCheckout] Buyer ID: ${buyerId} (${orderEntity.userId ? 'authenticated user' : 'guest user'})`);

            const buyerInfo = {
                id: buyerId,
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

            this.logger.debug(`[createCheckout] Buyer info prepared: ${JSON.stringify({ ...buyerInfo, email: '***', phone: '***' })}`);

            // Get callback URLs
            const appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL');
            const callbackPath =
                this.configService.get<string>('IYZICO_PAYMENT_CALLBACK_PATH') ||
                '/payments/iyzico/callback';
            const webhookPath =
                this.configService.get<string>('IYZICO_PAYMENT_WEBHOOK_PATH') ||
                '/payments/iyzico/webhook';
            const callbackUrl = `${appPublicUrl}${callbackPath}`;
            const webhookUrl = `${appPublicUrl}${webhookPath}`;

            this.logger.debug(`[createCheckout] Callback URLs: callbackUrl=${callbackUrl}, webhookUrl=${webhookUrl}`);

            // Initialize checkout
            // Convert Decimal values to numbers
            let totalAmount = typeof orderEntity.total === 'string'
                ? parseFloat(orderEntity.total)
                : Number(orderEntity.total);

            this.logger.debug(`[createCheckout] Total amount calculated: ${totalAmount} ${orderEntity.currency}`);

            // Prepare basket items
            this.logger.debug(`[createCheckout] Preparing ${orderEntity.items.length} basket items...`);
            const basketItems = orderEntity.items.map((item, index) => {
                // Iyzico requires basketItems[].price to be the total price for that item
                // Use item.totalPrice which is already calculated (unitPrice * quantity or discountedPrice * quantity)
                const itemTotalPrice = typeof item.totalPrice === 'string'
                    ? parseFloat(item.totalPrice)
                    : Number(item.totalPrice);

                if (isNaN(itemTotalPrice) || itemTotalPrice <= 0) {
                    this.logger.error(`[createCheckout] Invalid total price for item ${item.productName}: ${item.totalPrice}`);
                    throw new BadRequestException(`Invalid total price for item ${item.productName}`);
                }

                // Get category information from product
                const product = item.product;
                const categories = product?.categories || [];
                // Use first category as category1, or 'Product' as fallback
                const category1 = categories[0]?.name || 'Product';
                // Use second category, or first category's parent, or undefined
                const category2 = categories[1]?.name || categories[0]?.parent?.name || undefined;

                // Use orderItem.id as basket item ID (Iyzico accepts UUID)
                // Iyzico example uses short IDs like "BI101", but UUID should work too
                const basketItemId = item.id;

                this.logger.debug(`[createCheckout] Basket item ${index + 1}: ${item.productName}, quantity: ${item.quantity}, totalPrice: ${itemTotalPrice}, category1: ${category1}, category2: ${category2 || 'N/A'}`);

                return {
                    id: basketItemId,
                    name: item.productName,
                    category1: category1,
                    ...(category2 && { category2: category2 }),
                    itemType: 'PHYSICAL' as const,
                    price: itemTotalPrice, // Total price for this item (already includes quantity)
                };
            });

            // Validate that basketItems total equals order total
            // Iyzico requires: sum(basketItems[].price) == price == paidPrice
            const basketItemsTotal = basketItems.reduce((sum, item) => sum + item.price, 0);
            this.logger.debug(`[createCheckout] Basket items total: ${basketItemsTotal}, Order total: ${totalAmount}`);
            
            // Allow small rounding differences (0.01 tolerance) due to floating point precision
            const difference = Math.abs(basketItemsTotal - totalAmount);
            if (difference > 0.01) {
                this.logger.error(`[createCheckout] Basket items total (${basketItemsTotal}) does not match order total (${totalAmount}), difference: ${difference}`);
                throw new BadRequestException(`Basket items total (${basketItemsTotal.toFixed(2)}) does not match order total (${totalAmount.toFixed(2)}). Difference: ${difference.toFixed(2)}`);
            } else if (difference > 0) {
                this.logger.warn(`[createCheckout] Small rounding difference detected: ${difference.toFixed(4)}. Adjusting order total to match basket items total.`);
                // Adjust totalAmount to match basketItemsTotal to avoid Iyzico error
                totalAmount = basketItemsTotal;
            }

            this.logger.log(`[createCheckout] Calling provider.initializeCheckout for order ${checkoutDto.orderId}...`);
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
                basketItems,
            });

            this.logger.log(`[createCheckout] Provider checkout initialized successfully. Token: ${result.token?.substring(0, 20)}..., Redirect URL: ${result.redirectUrl?.substring(0, 50)}...`);

            // Update attempt with token and redirect URL
            attempt.token = result.token;
            attempt.paymentPageUrl = result.redirectUrl;
            attempt.status = PaymentStatus.REDIRECTED;
            await this.paymentAttemptRepository.save(attempt);
            this.logger.log(`[createCheckout] Payment attempt ${attempt.id} updated with token and redirect URL`);

            const response = {
                attemptId: attempt.id,
                provider,
                redirectUrl: result.redirectUrl,
                token: result.token,
            };

            this.logger.log(`[createCheckout] Checkout completed successfully for order ${checkoutDto.orderId}. Attempt ID: ${attempt?.id || 'N/A'}`);
            return response;
        } catch (error) {
            this.logger.error(`[createCheckout] Error during checkout for order ${checkoutDto.orderId}: ${error.message}`, error.stack);
            if (attempt) {
                attempt.status = PaymentStatus.FAILURE;
                attempt.errorMessage = (error as Error).message;
                const savedAttempt = await this.paymentAttemptRepository.save(attempt);
                this.logger.error(`[createCheckout] Payment attempt ${savedAttempt.id} marked as FAILURE`);
            } else {
                this.logger.warn(`[createCheckout] Payment attempt not created yet, cannot mark as failure`);
            }
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
        this.logger.log(`[handleCallback] Processing callback for token: ${token?.substring(0, 20)}..., provider: ${provider}`);

        try {
            // Find attempt by token
            this.logger.debug(`[handleCallback] Searching for payment attempt with token...`);
            const attempt = await this.paymentAttemptRepository.findOne({
                where: { token, provider },
                relations: ['order'],
            });

            if (!attempt) {
                this.logger.error(`[handleCallback] Payment attempt not found for token: ${token?.substring(0, 20)}...`);
                throw new NotFoundException('Payment attempt not found');
            }

            this.logger.debug(`[handleCallback] Payment attempt found: ${attempt.id}, orderId: ${attempt.orderId}, current status: ${attempt.status}`);

            // If already processed, return existing result
            if (attempt.status === PaymentStatus.SUCCESS) {
                this.logger.log(`[handleCallback] Payment attempt ${attempt.id} already processed successfully`);
                const frontendSuccessUrl = this.configService.get<string>('FRONTEND_SUCCESS_URL') || '';
                return {
                    success: true,
                    orderId: attempt.orderId,
                    redirectUrl: `${frontendSuccessUrl}?orderId=${attempt.orderId}`,
                };
            }

            // Retrieve payment status from provider
            this.logger.log(`[handleCallback] Retrieving payment status from provider ${provider}...`);
            const providerInstance = this.getProvider(provider);
            const result = await providerInstance.retrieveCheckout(token, attempt.conversationId);
            this.logger.log(`[handleCallback] Provider returned status: ${result.status}, paymentId: ${result.providerPaymentId || 'N/A'}`);

            // Update attempt
            const previousStatus = attempt.status;
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
            this.logger.log(`[handleCallback] Payment attempt ${attempt.id} status updated from ${previousStatus} to ${attempt.status}`);

            // Get order with all relations for email
            const order = await this.orderRepository.findOne({
                where: { id: attempt.orderId },
                relations: [
                    'user',
                    'items',
                    'items.product',
                    'items.product.galleries',
                    'items.product.galleries.mainImage',
                    'items.product.galleries.thumbnailImage',
                    'items.variant',
                    'items.variant.galleries',
                    'items.variant.galleries.mainImage',
                    'items.variant.galleries.thumbnailImage',
                    'items.variant.variantValues',
                    'items.variant.variantValues.variantOption',
                ],
            });

            if (!order) {
                this.logger.error(`[handleCallback] Order not found: ${attempt.orderId}`);
                throw new NotFoundException('Order not found');
            }

            // If successful, mark order as paid and clear cart
            if (result.status === 'SUCCESS') {
                this.logger.log(`[handleCallback] Marking order ${attempt.orderId} as paid...`);
                await this.orderService.markOrderAsPaid(
                    attempt.orderId,
                    result.providerPaymentId || '',
                    attempt.id,
                );
                this.logger.log(`[handleCallback] Order ${attempt.orderId} marked as paid successfully`);

                // Clear cart after successful payment
                if (order.cartId) {
                    this.logger.log(`[handleCallback] Clearing cart ${order.cartId} after successful payment...`);
                    try {
                        await this.cartService.clearCart(order.cartId);
                        this.logger.log(`[handleCallback] Cart ${order.cartId} cleared successfully`);
                    } catch (error) {
                        this.logger.error(`[handleCallback] Failed to clear cart ${order.cartId}: ${error.message}`, error.stack);
                        // Don't throw, just log the error
                    }
                }

                // Send success email
                try {
                    this.logger.log(`[handleCallback] Preparing to send success email for order ${order.orderNo}...`);
                    this.logger.debug(`[handleCallback] Order userId: ${order.userId}, user: ${order.user ? 'loaded' : 'not loaded'}, guestEmail: ${order.guestEmail || 'null'}`);

                    if (order.user) {
                        this.logger.debug(`[handleCallback] User email: ${order.user.email || 'null'}`);
                    }

                    const itemsWithImages: OrderItemWithImage[] = order.items.map((item) => {
                        // Get product image from gallery
                        let imageUrl: string | null = null;
                        let imageAlt: string = item.productName;

                        if (item.variant && item.variant.galleries && item.variant.galleries.length > 0) {
                            const gallery = item.variant.galleries[0];
                            imageUrl = gallery.thumbnailImage?.s3Url || gallery.mainImage?.s3Url || null;
                        } else if (item.product && item.product.galleries && item.product.galleries.length > 0) {
                            const gallery = item.product.galleries[0];
                            imageUrl = gallery.thumbnailImage?.s3Url || gallery.mainImage?.s3Url || null;
                        }

                        // Get variant values
                        const variantValues =
                            item.variant && item.variant.variantValues
                                ? item.variant.variantValues.map((vv) => ({
                                    value: vv.value,
                                    variantOption: vv.variantOption
                                        ? {
                                            name: vv.variantOption.name,
                                            type: vv.variantOption.type as 'COLOR' | 'TEXT',
                                        }
                                        : null,
                                    colorCode: vv.colorCode || null,
                                }))
                                : undefined;

                        return {
                            id: item.id,
                            productName: item.productName,
                            quantity: item.quantity,
                            unitPrice: Number(item.unitPrice),
                            discountedPrice: item.discountedPrice ? Number(item.discountedPrice) : null,
                            totalPrice: Number(item.totalPrice),
                            currency: item.currency,
                            image: imageUrl
                                ? {
                                    url: imageUrl,
                                    alt: imageAlt,
                                }
                                : null,
                            variantValues,
                        };
                    });

                    this.logger.log(`[handleCallback] Calling mailService.sendOrderSuccessEmail for order ${order.orderNo}...`);
                    await this.mailService.sendOrderSuccessEmail(order, itemsWithImages);
                    this.logger.log(`[handleCallback] Success email sent successfully for order ${order.orderNo}`);
                } catch (error) {
                    this.logger.error(`[handleCallback] Failed to send success email for order ${order.orderNo}: ${error.message}`, error.stack);
                    this.logger.error(`[handleCallback] Error details: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
                    // Don't throw, just log the error
                }
            } else {
                // If payment failed, reactivate cart
                if (order.cartId) {
                    this.logger.log(`[handleCallback] Reactivating cart ${order.cartId} after payment failure...`);
                    try {
                        await this.cartService.reactivateCart(order.cartId);
                        this.logger.log(`[handleCallback] Cart ${order.cartId} reactivated successfully`);
                    } catch (error) {
                        this.logger.error(`[handleCallback] Failed to reactivate cart ${order.cartId}: ${error.message}`, error.stack);
                        // Don't throw, just log the error
                    }
                }

                // Send failed email
                try {
                    await this.mailService.sendOrderFailedEmail(order, result.errorMessage || null);
                    this.logger.log(`[handleCallback] Failed email sent for order ${order.orderNo}`);
                } catch (error) {
                    this.logger.error(`[handleCallback] Failed to send failed email: ${error.message}`, error.stack);
                    // Don't throw, just log the error
                }
            }

            // Get redirect URLs
            const frontendSuccessUrl = this.configService.get<string>('FRONTEND_SUCCESS_URL') || '';
            const frontendFailUrl = this.configService.get<string>('FRONTEND_FAIL_URL') || '';

            if (result.status === 'SUCCESS') {
                const redirectUrl = `${frontendSuccessUrl}?orderId=${attempt.orderId}`;
                this.logger.log(`[handleCallback] Callback processed successfully. Redirecting to: ${redirectUrl}`);
                return {
                    success: true,
                    orderId: attempt.orderId,
                    redirectUrl,
                };
            } else {
                const redirectUrl = `${frontendFailUrl}?orderId=${attempt.orderId}&error=${encodeURIComponent(result.errorMessage || 'Payment failed')}`;
                this.logger.warn(`[handleCallback] Callback processed with failure. Error: ${result.errorMessage}, Redirecting to: ${redirectUrl}`);
                return {
                    success: false,
                    orderId: attempt.orderId,
                    redirectUrl,
                };
            }
        } catch (error) {
            this.logger.error(`[handleCallback] Error processing callback for token ${token?.substring(0, 20)}...: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Handle webhook
     */
    async handleWebhook(
        payload: any,
        provider: PaymentProvider = PaymentProvider.IYZICO,
    ): Promise<void> {
        this.logger.log(`[handleWebhook] Processing webhook for provider: ${provider}`);
        this.logger.debug(`[handleWebhook] Webhook payload: ${JSON.stringify(payload)}`);

        try {
            const providerInstance = this.getProvider(provider);
            this.logger.debug(`[handleWebhook] Calling provider.handleWebhook...`);
            const result = await providerInstance.handleWebhook(payload);
            this.logger.log(`[handleWebhook] Provider returned status: ${result.status}, paymentId: ${result.providerPaymentId || 'N/A'}`);

            // Find attempt by conversationId or paymentId
            this.logger.debug(`[handleWebhook] Searching for payment attempt with conversationId: ${payload.conversationId} or paymentId: ${result.providerPaymentId}`);
            const attempt = await this.paymentAttemptRepository.findOne({
                where: [
                    { conversationId: payload.conversationId },
                    { providerPaymentId: result.providerPaymentId },
                ],
            });

            if (!attempt) {
                this.logger.error(`[handleWebhook] Payment attempt not found for conversationId: ${payload.conversationId} or paymentId: ${result.providerPaymentId}`);
                throw new NotFoundException('Payment attempt not found');
            }

            this.logger.debug(`[handleWebhook] Payment attempt found: ${attempt.id}, orderId: ${attempt.orderId}, current status: ${attempt.status}`);

            // Idempotency check: if already successful, ignore
            if (attempt.status === PaymentStatus.SUCCESS) {
                this.logger.log(`[handleWebhook] Payment attempt ${attempt.id} already processed successfully, ignoring webhook`);
                return;
            }

            // Update attempt
            const previousStatus = attempt.status;
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
            this.logger.log(`[handleWebhook] Payment attempt ${attempt.id} status updated from ${previousStatus} to ${attempt.status}`);

            // If successful, mark order as paid
            if (result.status === 'SUCCESS') {
                this.logger.log(`[handleWebhook] Marking order ${attempt.orderId} as paid...`);
                await this.orderService.markOrderAsPaid(
                    attempt.orderId,
                    result.providerPaymentId || '',
                    attempt.id,
                );
                this.logger.log(`[handleWebhook] Order ${attempt.orderId} marked as paid successfully`);
            }

            this.logger.log(`[handleWebhook] Webhook processed successfully for attempt ${attempt.id}`);
        } catch (error) {
            this.logger.error(`[handleWebhook] Error processing webhook: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Get IBAN information for IBAN EFT payment
     */
    async getIbanInfo(): Promise<{
        iban: string;
        accountName: string;
        bankName: string;
        whatsappNumber: string | null;
    } | null> {
        this.logger.log('[getIbanInfo] Getting IBAN EFT information');
        
        try {
            // Settings'i güncelle
            const settings = await this.paymentSettingsService.getSettings();
            if (this.ibanEftProvider && typeof (this.ibanEftProvider as any).setSettings === 'function') {
                (this.ibanEftProvider as any).setSettings(settings);
            }
            
            // IBAN bilgilerini al
            if (this.ibanEftProvider && typeof (this.ibanEftProvider as any).getIbanInfo === 'function') {
                return (this.ibanEftProvider as any).getIbanInfo();
            }
            
            return null;
        } catch (error: any) {
            this.logger.error(`[getIbanInfo] Error getting IBAN info: ${error.message}`);
            throw error;
        }
    }
}
