import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    private httpClient: IyzicoHttpClient;
    private callbackUrl: string;
    private webhookUrl: string;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('IYZICO_API_KEY');
        const secretKey = this.configService.get<string>('IYZICO_SECRET_KEY');
        const baseUrl = this.configService.get<string>('IYZICO_BASE_URL') || 'https://api.iyzipay.com';
        const appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL');
        const callbackPath = this.configService.get<string>('IYZICO_PAYMENT_CALLBACK_PATH') || '/payments/iyzico/callback';
        const webhookPath = this.configService.get<string>('IYZICO_PAYMENT_WEBHOOK_PATH') || '/payments/iyzico/webhook';

        if (!apiKey || !secretKey) {
            throw new Error('IYZICO_API_KEY and IYZICO_SECRET_KEY must be set');
        }

        this.httpClient = new IyzicoHttpClient(apiKey, secretKey, baseUrl);
        this.callbackUrl = `${appPublicUrl}${callbackPath}`;
        this.webhookUrl = `${appPublicUrl}${webhookPath}`;
    }

    async initializeCheckout(input: InitializeCheckoutInput): Promise<{
        token: string;
        redirectUrl: string;
        providerRef?: string;
    }> {
        // Validate required fields
        if (!input.buyerInfo.name || !input.buyerInfo.surname) {
            throw new Error('Buyer name and surname are required');
        }
        if (!input.buyerInfo.email) {
            throw new Error('Buyer email is required');
        }
        if (!input.buyerInfo.phone) {
            throw new Error('Buyer phone is required');
        }
        if (!input.shippingAddress.contactName || !input.shippingAddress.city || !input.shippingAddress.address || !input.shippingAddress.zipCode) {
            throw new Error('Shipping address fields are required');
        }
        if (!input.billingAddress.contactName || !input.billingAddress.city || !input.billingAddress.address || !input.billingAddress.zipCode) {
            throw new Error('Billing address fields are required');
        }

        // Ensure amount is a number
        const amount = typeof input.amount === 'string' ? parseFloat(input.amount) : Number(input.amount);

        if (isNaN(amount) || amount <= 0) {
            throw new Error('Invalid amount: amount must be a positive number');
        }

        const request: IyzicoCheckoutFormInitializeRequest = {
            locale: 'tr',
            conversationId: input.conversationId,
            price: amount.toFixed(2),
            paidPrice: amount.toFixed(2),
            currency: input.currency,
            basketId: input.orderId,
            callbackUrl: input.callbackUrl || this.callbackUrl,
            buyer: {
                ...(input.buyerInfo.id && { id: input.buyerInfo.id }),
                name: input.buyerInfo.name,
                surname: input.buyerInfo.surname,
                gsmNumber: input.buyerInfo.phone,
                email: input.buyerInfo.email,
                ...(input.buyerInfo.identityNumber && { identityNumber: input.buyerInfo.identityNumber }),
                ...(input.buyerInfo.city && { city: input.buyerInfo.city }),
                ...(input.buyerInfo.country && { country: input.buyerInfo.country }),
                ...(input.buyerInfo.zipCode && { zipCode: input.buyerInfo.zipCode }),
            },
            shippingAddress: {
                contactName: input.shippingAddress.contactName,
                city: input.shippingAddress.city,
                country: input.shippingAddress.country || 'TR',
                address: input.shippingAddress.address,
                zipCode: input.shippingAddress.zipCode,
            },
            billingAddress: {
                contactName: input.billingAddress.contactName,
                city: input.billingAddress.city,
                country: input.billingAddress.country || 'TR',
                address: input.billingAddress.address,
                zipCode: input.billingAddress.zipCode,
            },
            basketItems: input.basketItems.map((item) => {
                // Ensure price is a number
                const itemPrice = typeof item.price === 'string' ? parseFloat(item.price) : Number(item.price);
                if (isNaN(itemPrice) || itemPrice <= 0) {
                    throw new Error(`Invalid item price for ${item.name}: price must be a positive number`);
                }
                return {
                    id: item.id,
                    name: item.name,
                    category1: item.category1 || 'Product',
                    ...(item.category2 && { category2: item.category2 }),
                    itemType: item.itemType,
                    price: itemPrice.toFixed(2),
                };
            }),
        };

        console.log('Iyzico checkout request:', request);

        const response = await this.httpClient.initializeCheckoutForm(request);

        if (!response.token || !response.paymentPageUrl) {
            throw new Error(`Iyzico initialization failed: ${response.errorMessage || response.errorCode || 'Unknown error'}`);
        }

        // Log for debugging (remove in production if needed)
        console.log('Iyzico checkout initialized:', {
            token: response.token,
            paymentPageUrl: response.paymentPageUrl,
            conversationId: response.conversationId,
        });

        return {
            token: response.token,
            redirectUrl: response.paymentPageUrl,
            providerRef: response.conversationId,
        };
    }

    async retrieveCheckout(token: string): Promise<NormalizedPaymentResult> {
        const response = await this.httpClient.retrieveCheckoutForm({ token });

        const status = response.paymentStatus === 'SUCCESS' ? 'SUCCESS' :
            response.paymentStatus === 'FAILURE' ? 'FAILURE' : 'PENDING';

        return {
            status,
            providerPaymentId: response.paymentId,
            paidPrice: response.currency ? parseFloat(response.itemTransactions?.[0]?.paidPrice || '0') : undefined,
            currency: response.currency,
            errorCode: response.errorCode,
            errorMessage: response.errorMessage,
            raw: response,
        };
    }

    async handleWebhook(payload: any): Promise<NormalizedWebhookResult> {
        // Iyzico webhook typically contains token, retrieve the payment
        if (payload.token) {
            return this.retrieveCheckout(payload.token);
        }

        // If webhook contains payment details directly
        const status = payload.paymentStatus === 'SUCCESS' ? 'SUCCESS' :
            payload.paymentStatus === 'FAILURE' ? 'FAILURE' : 'PENDING';

        return {
            status,
            providerPaymentId: payload.paymentId,
            paidPrice: payload.paidPrice ? parseFloat(payload.paidPrice) : undefined,
            currency: payload.currency,
            errorCode: payload.errorCode,
            errorMessage: payload.errorMessage,
            raw: payload,
        };
    }
}
