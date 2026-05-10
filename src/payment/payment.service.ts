import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentAttempt } from './payment-attempt.entity';
import { PaymentProvider } from '../common/enums/payment-provider.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { OrderService } from '../order/order.service';
import { Order } from '../order/order.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import {
    PaymentProvider as PaymentProviderInterface,
    NormalizedPaymentResult,
} from './providers/payment-provider.interface';
import { IyzicoProvider } from './providers/iyzico/iyzico.provider';
import { IbanEftProvider } from './providers/iban-eft/iban-eft.provider';
import { QnbpayProvider } from './providers/qnbpay/qnbpay.provider';
import { PaymentSettingsService } from './payment-settings.service';
import { CartService } from '../cart/cart.service';
import { CouponService } from '../coupon/coupon.service';
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
        private couponService: CouponService,
        private mailService: MailService,
        private configService: ConfigService,
        private paymentSettingsService: PaymentSettingsService,
        private iyzicoProvider: IyzicoProvider,
        private ibanEftProvider: IbanEftProvider,
        private qnbpayProvider: QnbpayProvider,
    ) {
        // Register providers
        this.providers = new Map();
        this.providers.set(PaymentProvider.IYZICO, iyzicoProvider);
        this.providers.set(PaymentProvider.IBAN_EFT, ibanEftProvider);
        this.providers.set(PaymentProvider.QNBPAY, qnbpayProvider);
        this.logger.log('PaymentService initialized with providers: IYZICO, IBAN_EFT, QNBPAY');

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

            if (this.qnbpayProvider && typeof (this.qnbpayProvider as any).setSettings === 'function') {
                (this.qnbpayProvider as any).setSettings(settings);
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
    async createCheckout(
        checkoutDto: CheckoutDto,
        options?: { clientIp?: string },
    ): Promise<CheckoutResponseDto> {
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

            const orderTotal = typeof orderEntity.total === 'string' ? parseFloat(orderEntity.total) : Number(orderEntity.total);
            if (orderTotal <= 0) {
                this.logger.log(`[createCheckout] Order ${checkoutDto.orderId} total is ${orderTotal} – treating as free order, marking PAID without payment provider`);
                if (orderTotal < 0) {
                    orderEntity.total = 0;
                    await this.orderRepository.save(orderEntity);
                }
                const freeAttempt = this.paymentAttemptRepository.create({
                    orderId: checkoutDto.orderId,
                    provider: PaymentProvider.FREE_ORDER,
                    status: PaymentStatus.SUCCESS,
                    conversationId: this.generateConversationId(),
                    amount: 0,
                    currency: orderEntity.currency,
                });
                const savedFreeAttempt = await this.paymentAttemptRepository.save(freeAttempt);
                await this.orderService.markOrderAsPaid(checkoutDto.orderId, 'FREE_ORDER', savedFreeAttempt.id);
                if (orderEntity.couponId) {
                    try {
                        await this.couponService.incrementUsage(orderEntity.couponId);
                        this.logger.log(`[createCheckout] Coupon ${orderEntity.couponId} usage incremented (free order)`);
                    } catch (e: any) {
                        this.logger.warn(`[createCheckout] Failed to increment coupon usage: ${e?.message}`);
                    }
                }
                if (orderEntity.cartId) {
                    try {
                        await this.cartService.clearCart(orderEntity.cartId);
                        this.logger.log(`[createCheckout] Cart ${orderEntity.cartId} cleared (free order)`);
                    } catch (e: any) {
                        this.logger.warn(`[createCheckout] Failed to clear cart: ${e?.message}`);
                    }
                }
                return {
                    attemptId: savedFreeAttempt.id,
                    provider: PaymentProvider.FREE_ORDER,
                    redirectUrl: '',
                    paymentNotRequired: true,
                };
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
            } else if (provider === PaymentProvider.QNBPAY) {
                if (this.qnbpayProvider && typeof (this.qnbpayProvider as any).setSettings === 'function') {
                    (this.qnbpayProvider as any).setSettings(settings);
                }
            }

            if (provider === PaymentProvider.QNBPAY && !settings.qnbpayEnabled) {
                this.logger.warn(`[createCheckout] QNBpay kapalı, sipariş: ${checkoutDto.orderId}`);
                throw new BadRequestException('QNBpay ödeme yöntemi şu an kullanılamıyor');
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

            // Get callback URLs (sağlayıcıya göre)
            const appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL') || '';
            let callbackUrl = '';
            let webhookUrl = '';
            let cancelUrl: string | undefined;

            if (provider === PaymentProvider.IYZICO) {
                const callbackPath =
                    this.configService.get<string>('IYZICO_PAYMENT_CALLBACK_PATH') ||
                    '/payments/iyzico/callback';
                const webhookPath =
                    this.configService.get<string>('IYZICO_PAYMENT_WEBHOOK_PATH') ||
                    '/payments/iyzico/webhook';
                callbackUrl = `${appPublicUrl}${callbackPath}`;
                webhookUrl = `${appPublicUrl}${webhookPath}`;
            } else if (provider === PaymentProvider.QNBPAY) {
                const returnPath =
                    this.configService.get<string>('QNBPAY_RETURN_PATH') || '/payments/qnbpay/return';
                const cancelPath =
                    this.configService.get<string>('QNBPAY_CANCEL_PATH') || '/payments/qnbpay/cancel';
                const webhookPath =
                    this.configService.get<string>('QNBPAY_WEBHOOK_PATH') || '/payments/qnbpay/webhook';
                callbackUrl = `${appPublicUrl}${returnPath}`;
                cancelUrl = `${appPublicUrl}${cancelPath}`;
                webhookUrl = `${appPublicUrl}${webhookPath}`;
            } else {
                const callbackPath =
                    this.configService.get<string>('IYZICO_PAYMENT_CALLBACK_PATH') ||
                    '/payments/iyzico/callback';
                const webhookPath =
                    this.configService.get<string>('IYZICO_PAYMENT_WEBHOOK_PATH') ||
                    '/payments/iyzico/webhook';
                callbackUrl = `${appPublicUrl}${callbackPath}`;
                webhookUrl = `${appPublicUrl}${webhookPath}`;
            }

            this.logger.debug(
                `[createCheckout] Callback URLs: callbackUrl=${callbackUrl}, webhookUrl=${webhookUrl}, cancelUrl=${cancelUrl || 'n/a'}`,
            );

            // Initialize checkout
            // Convert Decimal values to numbers
            let totalAmount = typeof orderEntity.total === 'string'
                ? parseFloat(orderEntity.total)
                : Number(orderEntity.total);

            this.logger.debug(`[createCheckout] Total amount calculated: ${totalAmount} ${orderEntity.currency}`);

            // Order totals (for basketItems to match Iyzico requirement: sum(basketItems) === price)
            const orderSubtotal = typeof orderEntity.subtotal === 'string'
                ? parseFloat(orderEntity.subtotal)
                : Number(orderEntity.subtotal);
            const orderShipping = typeof orderEntity.shippingCost === 'string'
                ? parseFloat(orderEntity.shippingCost)
                : Number(orderEntity.shippingCost);
            const orderDiscount = typeof orderEntity.discount === 'string'
                ? parseFloat(orderEntity.discount)
                : Number(orderEntity.discount);

            // Iyzico requires all basket item prices to be positive. Distribute order discount
            // across product items so we don't send a negative "İndirim" line.
            type BasketItem = { id: string; name: string; category1: string; category2?: string; itemType: 'PHYSICAL' | 'VIRTUAL'; price: number };
            this.logger.debug(`[createCheckout] Preparing ${orderEntity.items.length} basket items...`);

            const productsTotalAfterDiscount = Math.round((orderSubtotal - orderDiscount) * 100) / 100;

            const basketItems: BasketItem[] = orderEntity.items.map((item, index) => {
                const itemTotalPrice = typeof item.totalPrice === 'string'
                    ? parseFloat(item.totalPrice)
                    : Number(item.totalPrice);

                if (isNaN(itemTotalPrice) || itemTotalPrice <= 0) {
                    this.logger.error(`[createCheckout] Invalid total price for item ${item.productName}: ${item.totalPrice}`);
                    throw new BadRequestException(`Invalid total price for item ${item.productName}`);
                }

                const product = item.product;
                const categories = product?.categories || [];
                const category1 = categories[0]?.name || 'Product';
                const category2 = categories[1]?.name || categories[0]?.parent?.name || undefined;
                const basketItemId = item.id;

                // Distribute discount proportionally: item price = (item / subtotal) * (subtotal - discount)
                const itemPrice = orderSubtotal > 0
                    ? Math.round((itemTotalPrice / orderSubtotal) * productsTotalAfterDiscount * 100) / 100
                    : 0;
                const price = Math.max(0.01, itemPrice); // Iyzico requires positive price

                this.logger.debug(`[createCheckout] Basket item ${index + 1}: ${item.productName}, quantity: ${item.quantity}, totalPrice: ${itemTotalPrice}, price after discount: ${price}, category1: ${category1}, category2: ${category2 || 'N/A'}`);

                return {
                    id: basketItemId,
                    name: item.productName,
                    category1: category1,
                    ...(category2 && { category2: category2 }),
                    itemType: 'PHYSICAL' as const,
                    price,
                };
            });

            // Fix rounding: ensure product items sum exactly to productsTotalAfterDiscount (adjust last item)
            const productSum = basketItems.reduce((sum, item) => sum + item.price, 0);
            const productDiff = Math.round((productsTotalAfterDiscount - productSum) * 100) / 100;
            if (basketItems.length > 0 && Math.abs(productDiff) > 0) {
                basketItems[basketItems.length - 1].price = Math.round((basketItems[basketItems.length - 1].price + productDiff) * 100) / 100;
                if (basketItems[basketItems.length - 1].price < 0.01) {
                    basketItems[basketItems.length - 1].price = 0.01;
                }
            }

            // Add shipping as basket item so sum(basketItems) === order.total
            if (orderShipping > 0) {
                basketItems.push({
                    id: `shipping-${orderEntity.id}`,
                    name: 'Kargo',
                    category1: 'Shipping',
                    itemType: 'VIRTUAL' as const,
                    price: Math.round(orderShipping * 100) / 100,
                });
            }

            // Validate that basketItems total equals order total (no negative discount line - Iyzico rejects it)
            const basketItemsTotal = Math.round(basketItems.reduce((sum, item) => sum + item.price, 0) * 100) / 100;
            this.logger.debug(`[createCheckout] Basket items total: ${basketItemsTotal}, Order total: ${totalAmount} (subtotal: ${orderSubtotal}, shipping: ${orderShipping}, discount: ${orderDiscount})`);

            const difference = Math.abs(basketItemsTotal - totalAmount);
            if (difference > 0.01) {
                this.logger.error(`[createCheckout] Basket items total (${basketItemsTotal}) does not match order total (${totalAmount}), difference: ${difference}`);
                throw new BadRequestException(`Basket items total (${basketItemsTotal.toFixed(2)}) does not match order total (${totalAmount.toFixed(2)}). Difference: ${difference.toFixed(2)}`);
            } else if (difference > 0) {
                this.logger.warn(`[createCheckout] Small rounding difference: ${difference.toFixed(4)}. Adjusting total to match basket.`);
                totalAmount = basketItemsTotal;
            }

            this.logger.log(`[createCheckout] Iyzico'ya gidecek payload - amount: ${totalAmount} ${orderEntity.currency}, basketItemsCount: ${basketItems.length}`);
            this.logger.log(`[createCheckout] Basket items: ${JSON.stringify(basketItems.map((i) => ({ id: i.id, name: i.name.substring(0, 40), price: i.price, category1: i.category1, itemType: i.itemType })))}`);

            this.logger.log(`[createCheckout] Calling provider.initializeCheckout for order ${checkoutDto.orderId}...`);
            const result = await providerInstance.initializeCheckout({
                orderId: checkoutDto.orderId,
                conversationId,
                paymentAttemptId: provider === PaymentProvider.QNBPAY ? attempt.id : undefined,
                amount: totalAmount,
                currency: orderEntity.currency,
                callbackUrl,
                cancelUrl,
                webhookUrl,
                clientIp: options?.clientIp,
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

            const response: CheckoutResponseDto = {
                attemptId: attempt.id,
                provider,
                redirectUrl: result.redirectUrl || '',
                token: result.token,
                formAction: result.formAction,
                formMethod: result.formMethod,
                formFields: result.formFields,
                checkoutMode: result.checkoutMode,
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
     * UUID biçiminde mi kontrol eder (QNBpay invoice_id = deneme id).
     */
    private isUuidShape(value: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }

    /**
     * Ödeme denemesi kaydedildikten sonra sipariş, sepet ve e-posta yan etkilerini çalıştırır.
     */
    private async runPostPaymentSideEffectsAfterSavedAttempt(
        attempt: PaymentAttempt,
        result: NormalizedPaymentResult,
        logCtx: string,
    ): Promise<{ success: boolean; orderId: string; redirectUrl: string }> {
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
            this.logger.error(`${logCtx} Order not found: ${attempt.orderId}`);
            throw new NotFoundException('Order not found');
        }

        if (result.status === 'SUCCESS') {
            this.logger.log(`${logCtx} Marking order ${attempt.orderId} as paid...`);
            await this.orderService.markOrderAsPaid(
                attempt.orderId,
                result.providerPaymentId || '',
                attempt.id,
            );
            this.logger.log(`${logCtx} Order ${attempt.orderId} marked as paid successfully`);

            if (order.couponId) {
                try {
                    await this.couponService.incrementUsage(order.couponId);
                    this.logger.log(`${logCtx} Coupon ${order.couponId} usage incremented`);
                } catch (error: any) {
                    this.logger.error(`${logCtx} Failed to increment coupon usage: ${error.message}`, error.stack);
                }
            }

            if (order.cartId) {
                this.logger.log(`${logCtx} Clearing cart ${order.cartId} after successful payment...`);
                try {
                    await this.cartService.clearCart(order.cartId);
                    this.logger.log(`${logCtx} Cart ${order.cartId} cleared successfully`);
                } catch (error: any) {
                    this.logger.error(`${logCtx} Failed to clear cart ${order.cartId}: ${error.message}`, error.stack);
                }
            }

            try {
                this.logger.log(`${logCtx} Preparing to send success email for order ${order.orderNo}...`);
                const itemsWithImages: OrderItemWithImage[] = order.items.map((item) => {
                    let imageUrl: string | null = null;
                    let imageAlt: string = item.productName;

                    if (item.variant && item.variant.galleries && item.variant.galleries.length > 0) {
                        const gallery = item.variant.galleries[0];
                        imageUrl = gallery.thumbnailImage?.s3Url || gallery.mainImage?.s3Url || null;
                    } else if (item.product && item.product.galleries && item.product.galleries.length > 0) {
                        const gallery = item.product.galleries[0];
                        imageUrl = gallery.thumbnailImage?.s3Url || gallery.mainImage?.s3Url || null;
                    }

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

                await this.mailService.sendOrderSuccessEmail(order, itemsWithImages);
                this.logger.log(`${logCtx} Success email sent successfully for order ${order.orderNo}`);
            } catch (error: any) {
                this.logger.error(`${logCtx} Failed to send success email for order ${order.orderNo}: ${error.message}`, error.stack);
            }
        } else {
            if (order.cartId) {
                this.logger.log(`${logCtx} Reactivating cart ${order.cartId} after payment failure...`);
                try {
                    await this.cartService.reactivateCart(order.cartId);
                    this.logger.log(`${logCtx} Cart ${order.cartId} reactivated successfully`);
                } catch (error: any) {
                    this.logger.error(`${logCtx} Failed to reactivate cart ${order.cartId}: ${error.message}`, error.stack);
                }
            }

            try {
                await this.mailService.sendOrderFailedEmail(order, result.errorMessage || null);
                this.logger.log(`${logCtx} Failed email sent for order ${order.orderNo}`);
            } catch (error: any) {
                this.logger.error(`${logCtx} Failed to send failed email: ${error.message}`, error.stack);
            }
        }

        const frontendSuccessUrl = this.configService.get<string>('FRONTEND_SUCCESS_URL') || '';
        const frontendFailUrl = this.configService.get<string>('FRONTEND_FAIL_URL') || '';

        if (result.status === 'SUCCESS') {
            const redirectUrl = `${frontendSuccessUrl}?orderId=${attempt.orderId}`;
            this.logger.log(`${logCtx} Callback processed successfully. Redirecting to: ${redirectUrl}`);
            return {
                success: true,
                orderId: attempt.orderId,
                redirectUrl,
            };
        }
        const redirectUrl = `${frontendFailUrl}?orderId=${attempt.orderId}&error=${encodeURIComponent(result.errorMessage || 'Payment failed')}`;
        this.logger.warn(`${logCtx} Callback processed with failure. Redirecting to: ${redirectUrl}`);
        return {
            success: false,
            orderId: attempt.orderId,
            redirectUrl,
        };
    }

    /**
     * QNBpay dönüş URL’si: hash doğrulama + checkstatus + sipariş tamamlama.
     */
    async handleQnbPayReturn(
        merged: Record<string, string | string[] | undefined>,
    ): Promise<{ success: boolean; orderId: string; redirectUrl: string }> {
        const pick = (k: string): string | undefined => {
            const v = merged[k];
            if (Array.isArray(v)) {
                return v[0];
            }
            return v as string | undefined;
        };
        const invoiceId = pick('invoice_id') || pick('invoiceId');
        if (!invoiceId) {
            throw new BadRequestException('invoice_id gerekli');
        }

        const attempt = await this.paymentAttemptRepository.findOne({
            where: { id: invoiceId, provider: PaymentProvider.QNBPAY },
            relations: ['order'],
        });

        if (!attempt) {
            throw new NotFoundException('Ödeme denemesi bulunamadı');
        }

        if (attempt.status === PaymentStatus.SUCCESS) {
            const frontendSuccessUrl = this.configService.get<string>('FRONTEND_SUCCESS_URL') || '';
            return {
                success: true,
                orderId: attempt.orderId,
                redirectUrl: `${frontendSuccessUrl}?orderId=${attempt.orderId}`,
            };
        }

        const orderRow = await this.orderRepository.findOne({ where: { id: attempt.orderId } });
        if (!orderRow) {
            throw new NotFoundException('Sipariş bulunamadı');
        }

        const settings = await this.paymentSettingsService.getSettings();
        this.qnbpayProvider.setSettings(settings);

        const total =
            typeof orderRow.total === 'string' ? parseFloat(orderRow.total) : Number(orderRow.total);
        const result = await this.qnbpayProvider.finalizeReturnQuery({
            query: merged,
            expectedInvoiceId: attempt.id,
            expectedTotal: total,
            expectedCurrency: orderRow.currency,
        });

        const previousStatus = attempt.status;
        attempt.status =
            result.status === 'SUCCESS'
                ? PaymentStatus.SUCCESS
                : result.status === 'FAILURE'
                    ? PaymentStatus.FAILURE
                    : PaymentStatus.INITIATED;
        attempt.providerPaymentId = result.providerPaymentId ?? attempt.providerPaymentId;
        attempt.errorCode = result.errorCode ?? null;
        attempt.errorMessage = result.errorMessage ?? null;
        attempt.rawProviderResponse = result.raw;
        await this.paymentAttemptRepository.save(attempt);
        this.logger.log(
            `[handleQnbPayReturn] Attempt ${attempt.id} status ${previousStatus} -> ${attempt.status}`,
        );

        return this.runPostPaymentSideEffectsAfterSavedAttempt(attempt, result, '[handleQnbPayReturn]');
    }

    /**
     * QNBpay iptal yönlendirmesi: denemeyi başarısız işaretler ve mağaza hata sayfasına yönlendirir.
     */
    async handleQnbPayCancel(
        merged: Record<string, string | string[] | undefined>,
    ): Promise<{ success: boolean; orderId: string; redirectUrl: string }> {
        const pick = (k: string): string | undefined => {
            const v = merged[k];
            if (Array.isArray(v)) {
                return v[0];
            }
            return v as string | undefined;
        };
        const invoiceId = pick('invoice_id') || pick('invoiceId');
        const frontendFailUrl = this.configService.get<string>('FRONTEND_FAIL_URL') || '';

        if (!invoiceId) {
            return {
                success: false,
                orderId: '',
                redirectUrl: `${frontendFailUrl}?error=${encodeURIComponent('Ödeme iptal')}`,
            };
        }

        const attempt = await this.paymentAttemptRepository.findOne({
            where: { id: invoiceId, provider: PaymentProvider.QNBPAY },
        });
        if (attempt && attempt.status !== PaymentStatus.SUCCESS) {
            attempt.status = PaymentStatus.FAILURE;
            attempt.errorMessage = attempt.errorMessage || 'Kullanıcı iptal / QNBpay cancel_url';
            await this.paymentAttemptRepository.save(attempt);
        }

        const orderId = attempt?.orderId || '';
        const redirectUrl = orderId
            ? `${frontendFailUrl}?orderId=${orderId}&error=${encodeURIComponent('Ödeme iptal edildi')}`
            : `${frontendFailUrl}?error=${encodeURIComponent('Ödeme iptal edildi')}`;
        return { success: false, orderId, redirectUrl };
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
            const settingsCb = await this.paymentSettingsService.getSettings();
            if (this.iyzicoProvider && typeof (this.iyzicoProvider as any).setSettings === 'function') {
                (this.iyzicoProvider as any).setSettings(settingsCb);
            }
            if (this.qnbpayProvider && typeof (this.qnbpayProvider as any).setSettings === 'function') {
                (this.qnbpayProvider as any).setSettings(settingsCb);
            }

            let attempt: PaymentAttempt | null = null;
            if (provider === PaymentProvider.QNBPAY && this.isUuidShape(token)) {
                attempt = await this.paymentAttemptRepository.findOne({
                    where: { id: token, provider },
                    relations: ['order'],
                });
            }
            if (!attempt) {
                attempt = await this.paymentAttemptRepository.findOne({
                    where: { token, provider },
                    relations: ['order'],
                });
            }

            if (!attempt) {
                this.logger.error(`[handleCallback] Payment attempt not found for token: ${token?.substring(0, 20)}...`);
                throw new NotFoundException('Payment attempt not found');
            }

            this.logger.debug(`[handleCallback] Payment attempt found: ${attempt.id}, orderId: ${attempt.orderId}, current status: ${attempt.status}`);

            if (attempt.status === PaymentStatus.SUCCESS) {
                this.logger.log(`[handleCallback] Payment attempt ${attempt.id} already processed successfully`);
                const frontendSuccessUrl = this.configService.get<string>('FRONTEND_SUCCESS_URL') || '';
                return {
                    success: true,
                    orderId: attempt.orderId,
                    redirectUrl: `${frontendSuccessUrl}?orderId=${attempt.orderId}`,
                };
            }

            if (provider === PaymentProvider.QNBPAY) {
                this.logger.warn(
                    '[handleCallback] QNBpay için doğrudan callback yerine /payments/qnbpay/return kullanılmalı; checkstatus ile sınırlı doğrulama yapılıyor.',
                );
            }

            this.logger.log(`[handleCallback] Retrieving payment status from provider ${provider}...`);
            const providerInstance = this.getProvider(provider);
            const result = await providerInstance.retrieveCheckout(token, attempt.conversationId);
            this.logger.log(`[handleCallback] Provider returned status: ${result.status}, paymentId: ${result.providerPaymentId || 'N/A'}`);

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

            return this.runPostPaymentSideEffectsAfterSavedAttempt(attempt, result, '[handleCallback]');
        } catch (error: any) {
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
            const settings = await this.paymentSettingsService.getSettings();
            if (this.iyzicoProvider && typeof (this.iyzicoProvider as any).setSettings === 'function') {
                (this.iyzicoProvider as any).setSettings(settings);
            }
            if (this.qnbpayProvider && typeof (this.qnbpayProvider as any).setSettings === 'function') {
                (this.qnbpayProvider as any).setSettings(settings);
            }

            const providerInstance = this.getProvider(provider);
            this.logger.debug(`[handleWebhook] Calling provider.handleWebhook...`);
            const result = await providerInstance.handleWebhook(payload);
            this.logger.log(`[handleWebhook] Provider returned status: ${result.status}, paymentId: ${result.providerPaymentId || 'N/A'}`);

            const where: FindOptionsWhere<PaymentAttempt>[] = [];
            if (result.providerPaymentId) {
                where.push({ providerPaymentId: result.providerPaymentId, provider });
            }
            if (payload?.conversationId) {
                where.push({ conversationId: payload.conversationId, provider });
            }
            if (result.conversationId) {
                where.push({ conversationId: result.conversationId, provider });
                if (this.isUuidShape(result.conversationId)) {
                    where.push({ id: result.conversationId, provider });
                }
            }

            this.logger.debug(
                `[handleWebhook] Searching payment attempt, ${where.length} eşleşme kriteri`,
            );
            const attempt =
                where.length > 0
                    ? await this.paymentAttemptRepository.findOne({ where })
                    : null;

            if (!attempt) {
                this.logger.error(
                    `[handleWebhook] Payment attempt not found (conversationId: ${payload?.conversationId}, result.conversationId: ${result.conversationId}, paymentId: ${result.providerPaymentId})`,
                );
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
