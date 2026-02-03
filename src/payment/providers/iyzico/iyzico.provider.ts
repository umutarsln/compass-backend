import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
    PaymentProvider,
    InitializeCheckoutInput,
    NormalizedPaymentResult,
    NormalizedWebhookResult,
} from '../payment-provider.interface';
import { IyzicoHttpClient } from './iyzico.http';
import {
    IyzicoCheckoutFormInitializeRequest,
    IyzicoCheckoutFormRetrieveResponse,
} from './iyzico.types';

@Injectable()
export class IyzicoProvider implements PaymentProvider {
    private readonly logger = new Logger(IyzicoProvider.name);
    private httpClient: IyzicoHttpClient;
    private callbackUrl: string;
    private webhookUrl: string;
    private settings: any = null;

    constructor(private configService: ConfigService) {
        // İlk başta config service'ten al (fallback)
        const apiKey = this.configService.get<string>('IYZICO_API_KEY');
        const secretKey = this.configService.get<string>('IYZICO_SECRET_KEY');
        const baseUrl = this.configService.get<string>('IYZICO_BASE_URL') || 'https://api.iyzipay.com';
        const appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL');
        const callbackPath = this.configService.get<string>('IYZICO_PAYMENT_CALLBACK_PATH') || '/payments/iyzico/callback';
        const webhookPath = this.configService.get<string>('IYZICO_PAYMENT_WEBHOOK_PATH') || '/payments/iyzico/webhook';

        // Eğer config'de varsa kullan, yoksa settings'ten alınacak
        if (apiKey && secretKey) {
            this.httpClient = new IyzicoHttpClient(apiKey, secretKey, baseUrl, this.logger);
            this.callbackUrl = `${appPublicUrl}${callbackPath}`;
            this.webhookUrl = `${appPublicUrl}${webhookPath}`;
            this.logger.log(`IyzicoProvider initialized from config - baseUrl: ${baseUrl}`);
        } else {
            this.logger.log('IyzicoProvider initialized - settings will be set later');
        }
    }

    /**
     * Set payment settings (called from PaymentService)
     */
    setSettings(settings: any): void {
        this.settings = settings;

        // Settings'ten Iyzico bilgilerini al
        const apiKey = settings.iyzicoApiKey || this.configService.get<string>('IYZICO_API_KEY');
        const secretKey = settings.iyzicoSecretKey || this.configService.get<string>('IYZICO_SECRET_KEY');
        const baseUrl = settings.iyzicoBaseUrl || this.configService.get<string>('IYZICO_BASE_URL') || 'https://api.iyzipay.com';
        const appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL');
        const callbackPath = this.configService.get<string>('IYZICO_PAYMENT_CALLBACK_PATH') || '/payments/iyzico/callback';
        const webhookPath = this.configService.get<string>('IYZICO_PAYMENT_WEBHOOK_PATH') || '/payments/iyzico/webhook';

        if (apiKey && secretKey) {
            this.httpClient = new IyzicoHttpClient(apiKey, secretKey, baseUrl, this.logger);
            this.callbackUrl = `${appPublicUrl}${callbackPath}`;
            this.webhookUrl = `${appPublicUrl}${webhookPath}`;
            this.logger.log(`IyzicoProvider settings updated - baseUrl: ${baseUrl}`);
        } else {
            this.logger.warn('IyzicoProvider settings incomplete - API key or secret key missing');
        }
    }

    /**
     * Normalize country code to Iyzico format (full country name)
     * Iyzico expects "Turkey" instead of "TR"
     */
    private normalizeCountry(country: string): string {
        const countryMap: Record<string, string> = {
            'TR': 'Turkey',
            'US': 'United States',
            'GB': 'United Kingdom',
            'DE': 'Germany',
            'FR': 'France',
            'IT': 'Italy',
            'ES': 'Spain',
            'NL': 'Netherlands',
            'BE': 'Belgium',
            'AT': 'Austria',
            'CH': 'Switzerland',
            'SE': 'Sweden',
            'NO': 'Norway',
            'DK': 'Denmark',
            'FI': 'Finland',
            'PL': 'Poland',
            'CZ': 'Czech Republic',
            'GR': 'Greece',
            'PT': 'Portugal',
            'IE': 'Ireland',
        };

        // If already a full country name, return as is
        if (country.length > 2) {
            return country;
        }

        // Convert ISO code to full country name
        return countryMap[country.toUpperCase()] || country;
    }

    async initializeCheckout(input: InitializeCheckoutInput): Promise<{
        token: string;
        redirectUrl: string;
        providerRef?: string;
    }> {
        this.logger.log(`[initializeCheckout] Starting Iyzico checkout for orderId: ${input.orderId}, conversationId: ${input.conversationId}`);
        this.logger.debug(`[initializeCheckout] Input: ${JSON.stringify({ ...input, buyerInfo: { ...input.buyerInfo, email: '***', phone: '***' } })}`);

        try {
            // Validate required fields
            this.logger.debug(`[initializeCheckout] Validating required fields...`);
            if (!input.buyerInfo.name || !input.buyerInfo.surname) {
                this.logger.error(`[initializeCheckout] Buyer name or surname is missing`);
                throw new Error('Buyer name and surname are required');
            }
            if (!input.buyerInfo.email) {
                this.logger.error(`[initializeCheckout] Buyer email is missing`);
                throw new Error('Buyer email is required');
            }
            if (!input.buyerInfo.phone) {
                this.logger.error(`[initializeCheckout] Buyer phone is missing`);
                throw new Error('Buyer phone is required');
            }
            if (!input.shippingAddress.contactName || !input.shippingAddress.city || !input.shippingAddress.address || !input.shippingAddress.zipCode) {
                this.logger.error(`[initializeCheckout] Shipping address fields are incomplete`);
                throw new Error('Shipping address fields are required');
            }
            if (!input.billingAddress.contactName || !input.billingAddress.city || !input.billingAddress.address || !input.billingAddress.zipCode) {
                this.logger.error(`[initializeCheckout] Billing address fields are incomplete`);
                throw new Error('Billing address fields are required');
            }

            // Ensure amount is a number, then convert to string with 2 decimal places
            const amount = typeof input.amount === 'string' ? parseFloat(input.amount) : Number(input.amount);

            if (isNaN(amount) || amount <= 0) {
                this.logger.error(`[initializeCheckout] Invalid amount: ${input.amount}`);
                throw new Error('Invalid amount: amount must be a positive number');
            }

            // Format price as string with 2 decimal places (matching Python SDK format)
            const priceString = amount.toFixed(2);
            this.logger.debug(`[initializeCheckout] Amount formatted: ${priceString} ${input.currency}`);

            const request: IyzicoCheckoutFormInitializeRequest = {
                locale: 'tr',
                conversationId: input.conversationId,
                price: priceString,
                paidPrice: priceString,
                currency: input.currency,
                basketId: input.orderId,
                paymentGroup: 'PRODUCT', // Iyzico example shows this field
                callbackUrl: input.callbackUrl || this.callbackUrl,
                enabledInstallments: ['2', '3', '6', '9', '12'], // Common installments for Turkey (as strings per Iyzico Python example)
                buyer: {
                    // Iyzico requires buyerId, use provided id or generate UUID for guest
                    id: input.buyerInfo.id || crypto.randomUUID(),
                    name: input.buyerInfo.name,
                    surname: input.buyerInfo.surname,
                    gsmNumber: input.buyerInfo.phone,
                    email: input.buyerInfo.email,
                    // Iyzico requires identityNumber field, send default value if not provided
                    identityNumber: input.buyerInfo.identityNumber || '11111111111',
                    // Iyzico requires registrationAddress, use shippingAddress
                    registrationAddress: input.shippingAddress.address,
                    city: input.shippingAddress.city,
                    country: this.normalizeCountry(input.shippingAddress.country || 'TR'),
                    zipCode: input.shippingAddress.zipCode,
                },
                shippingAddress: {
                    contactName: input.shippingAddress.contactName,
                    city: input.shippingAddress.city,
                    country: this.normalizeCountry(input.shippingAddress.country || 'TR'),
                    address: input.shippingAddress.address,
                    zipCode: input.shippingAddress.zipCode,
                },
                billingAddress: {
                    contactName: input.billingAddress.contactName,
                    city: input.billingAddress.city,
                    country: this.normalizeCountry(input.billingAddress.country || 'TR'),
                    address: input.billingAddress.address,
                    zipCode: input.billingAddress.zipCode,
                },
                basketItems: input.basketItems.map((item) => {
                    // Ensure price is a number, then convert to string with 2 decimal places
                    const itemPrice = typeof item.price === 'string' ? parseFloat(item.price) : Number(item.price);
                    if (isNaN(itemPrice) || itemPrice <= 0) {
                        throw new Error(`Invalid item price for ${item.name}: price must be a positive number`);
                    }
                    // Format price as string with 2 decimal places (matching Python SDK format)
                    const priceString = itemPrice.toFixed(2);
                    return {
                        id: item.id,
                        name: item.name,
                        category1: item.category1 || 'Product',
                        ...(item.category2 && { category2: item.category2 }),
                        itemType: item.itemType,
                        price: priceString, // Send as string, matching Python SDK format
                    };
                }),
            };

            const basketSum = request.basketItems.reduce((s, i) => s + parseFloat(i.price), 0);
            this.logger.log(`[initializeCheckout] Iyzico'ya giden istek - price/paidPrice: ${request.price} ${request.currency}, basketId: ${request.basketId}, basketItems toplamı: ${basketSum.toFixed(2)}, kalem sayısı: ${request.basketItems.length}`);
            this.logger.log(`[initializeCheckout] Iyzico basketItems: ${JSON.stringify(request.basketItems.map((i) => ({ id: i.id, name: i.name?.substring(0, 50), price: i.price, category1: i.category1, itemType: i.itemType })))}`);
            this.logger.debug(`[initializeCheckout] Iyzico full request (buyer masked): ${JSON.stringify({ ...request, buyer: { ...request.buyer, email: '***', gsmNumber: '***', identityNumber: '***' } })}`);

            this.logger.log(`[initializeCheckout] Calling Iyzico API initializeCheckoutForm...`);
            const response = await this.httpClient.initializeCheckoutForm(request);

            this.logger.log(`[initializeCheckout] Iyzico response - status: ${response.status}, errorCode: ${response.errorCode ?? 'yok'}, errorMessage: ${response.errorMessage ?? 'yok'}, token: ${response.token ? 'var' : 'yok'}, paymentPageUrl: ${response.paymentPageUrl ? 'var' : 'yok'}`);
            this.logger.debug(`[initializeCheckout] Iyzico full response: ${JSON.stringify(response)}`);

            if (!response.token || !response.paymentPageUrl) {
                this.logger.error(`[initializeCheckout] Iyzico initialization failed - token: ${response.token ? 'present' : 'MISSING'}, paymentPageUrl: ${response.paymentPageUrl ? 'present' : 'MISSING'}, errorCode: ${response.errorCode}, errorMessage: ${response.errorMessage}`);
                throw new Error(`Iyzico initialization failed: ${response.errorMessage || response.errorCode || 'Unknown error'}`);
            }

            this.logger.log(`[initializeCheckout] Iyzico checkout initialized successfully - token: ${response.token.substring(0, 20)}..., paymentPageUrl: ${response.paymentPageUrl.substring(0, 50)}...`);

            return {
                token: response.token,
                redirectUrl: response.paymentPageUrl,
                providerRef: response.conversationId,
            };
        } catch (error) {
            this.logger.error(`[initializeCheckout] Error initializing Iyzico checkout for orderId ${input.orderId}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async retrieveCheckout(token: string, conversationId?: string): Promise<NormalizedPaymentResult> {
        this.logger.log(`[retrieveCheckout] Retrieving checkout status for token: ${token.substring(0, 20)}..., conversationId: ${conversationId || 'N/A'}`);

        try {
            if (!conversationId) {
                this.logger.warn(`[retrieveCheckout] conversationId not provided, using default`);
            }

            this.logger.debug(`[retrieveCheckout] Calling Iyzico API retrieveCheckoutForm...`);
            const response = await this.httpClient.retrieveCheckoutForm({
                locale: 'tr',
                conversationId: conversationId || '',
                token
            });

            this.logger.debug(`[retrieveCheckout] Iyzico response: ${JSON.stringify({ status: response.status, paymentStatus: response.paymentStatus, paymentId: response.paymentId, errorCode: response.errorCode, errorMessage: response.errorMessage })}`);

            const status = response.paymentStatus === 'SUCCESS' ? 'SUCCESS' :
                response.paymentStatus === 'FAILURE' ? 'FAILURE' : 'PENDING';

            this.logger.log(`[retrieveCheckout] Checkout status retrieved: ${status}, paymentId: ${response.paymentId || 'N/A'}`);

            return {
                status,
                providerPaymentId: response.paymentId,
                paidPrice: response.currency ? parseFloat(response.itemTransactions?.[0]?.paidPrice || '0') : undefined,
                currency: response.currency,
                errorCode: response.errorCode,
                errorMessage: response.errorMessage,
                raw: response,
            };
        } catch (error) {
            this.logger.error(`[retrieveCheckout] Error retrieving checkout for token ${token.substring(0, 20)}...: ${error.message}`, error.stack);
            throw error;
        }
    }

    async handleWebhook(payload: any): Promise<NormalizedWebhookResult> {
        this.logger.log(`[handleWebhook] Processing Iyzico webhook`);
        this.logger.debug(`[handleWebhook] Webhook payload: ${JSON.stringify(payload)}`);

        try {
            // Iyzico webhook typically contains token, retrieve the payment
            if (payload.token) {
                this.logger.debug(`[handleWebhook] Webhook contains token, retrieving checkout...`);
                return this.retrieveCheckout(payload.token);
            }

            // If webhook contains payment details directly
            this.logger.debug(`[handleWebhook] Webhook contains payment details directly`);
            const status = payload.paymentStatus === 'SUCCESS' ? 'SUCCESS' :
                payload.paymentStatus === 'FAILURE' ? 'FAILURE' : 'PENDING';

            this.logger.log(`[handleWebhook] Webhook processed - status: ${status}, paymentId: ${payload.paymentId || 'N/A'}`);

            return {
                status,
                providerPaymentId: payload.paymentId,
                paidPrice: payload.paidPrice ? parseFloat(payload.paidPrice) : undefined,
                currency: payload.currency,
                errorCode: payload.errorCode,
                errorMessage: payload.errorMessage,
                raw: payload,
            };
        } catch (error) {
            this.logger.error(`[handleWebhook] Error processing webhook: ${error.message}`, error.stack);
            throw error;
        }
    }
}
