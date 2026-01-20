import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';
import { IyzicoCheckoutFormInitializeRequest, IyzicoCheckoutFormInitializeResponse, IyzicoCheckoutFormRetrieveRequest, IyzicoCheckoutFormRetrieveResponse } from './iyzico.types';

export class IyzicoHttpClient {
    private readonly logger: Logger;
    private apiKey: string;
    private secretKey: string;
    private baseUrl: string;

    constructor(apiKey: string, secretKey: string, baseUrl: string, logger?: Logger) {
        this.apiKey = apiKey;
        this.secretKey = secretKey;
        this.baseUrl = baseUrl;
        this.logger = logger || new Logger(IyzicoHttpClient.name);
        this.logger.debug(`IyzicoHttpClient initialized - baseUrl: ${baseUrl}`);
    }

    /**
     * Generate Iyzico authorization header (IYZWSv2 format)
     * Based on Python SDK implementation
     * Format: IYZWSv2 {base64(apiKey:{apiKey}&randomKey:{randomStr}&signature:{signature})}
     * Signature = HMAC-SHA256(randomStr + url + bodyStr, secretKey)
     */
    private generateAuthorizationHeader(url: string, requestBody: string, randomString: string): string {
        // Remove query parameters from URL for signature calculation
        const cleanUrl = url.split('?')[0];
        
        // Calculate HMAC-SHA256 signature
        const message = (randomString + cleanUrl + requestBody).toString();
        const signature = crypto
            .createHmac('sha256', this.secretKey)
            .update(message)
            .digest('hex');
        
        // Build authorization params string
        const authParams = [
            `apiKey:${this.apiKey}`,
            `randomKey:${randomString}`,
            `signature:${signature}`
        ].join('&');
        
        // Base64 encode the authorization params
        const encodedAuth = Buffer.from(authParams).toString('base64');
        
        return `IYZWSv2 ${encodedAuth}`;
    }

    /**
     * Generate random string for authorization (8 characters like Python SDK)
     */
    private generateRandomString(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Make request to Iyzico API
     */
    private async makeRequest<T>(
        endpoint: string,
        requestBody: any,
    ): Promise<T> {
        const bodyString = JSON.stringify(requestBody);
        // Generate random string once and use it for both authorization and header
        const randomString = this.generateRandomString();
        const fullUrl = `${this.baseUrl}${endpoint}`;
        const authorization = this.generateAuthorizationHeader(endpoint, bodyString, randomString);

        this.logger.debug(`[makeRequest] Making request to Iyzico API - endpoint: ${endpoint}`);
        this.logger.debug(`[makeRequest] Request URL: ${fullUrl}`);
        this.logger.debug(`[makeRequest] Random string: ${randomString}`);
        this.logger.debug(`[makeRequest] Request body: ${bodyString}`);
        this.logger.debug(`[makeRequest] Authorization header: ${authorization.substring(0, 50)}...`);

        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': authorization,
                'x-iyzi-rnd': randomString,
                'x-iyzi-client-version': 'iyzipay-node-2.0.50',
            },
            body: bodyString,
        });

        const responseText = await response.text();
        this.logger.debug(`[makeRequest] Response status: ${response.status} ${response.statusText}`);
        this.logger.debug(`[makeRequest] Response body: ${responseText}`);

        if (!response.ok) {
            this.logger.error(`[makeRequest] HTTP error: ${response.status} ${response.statusText}`);
            throw new Error(`Iyzico API error: ${response.status} ${response.statusText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (error) {
            this.logger.error(`[makeRequest] Failed to parse Iyzico response: ${responseText}`, error.stack);
            throw new Error(`Iyzico response parse error: ${error.message}`);
        }

        if (data.status === 'failure') {
            // Log detailed error information
            this.logger.error(`[makeRequest] Iyzico API error response: ${JSON.stringify(data, null, 2)}`);
            const errorMessage = data.errorMessage || data.errorCode || 'Unknown error';
            const errorGroup = data.errorGroup || '';
            const errorCode = data.errorCode || '';
            this.logger.error(`[makeRequest] Iyzico error - Code: ${errorCode}, Message: ${errorMessage}, Group: ${errorGroup}`);
            throw new Error(`Iyzico error: ${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ''}${errorGroup ? ` (Group: ${errorGroup})` : ''}`);
        }

        this.logger.debug(`[makeRequest] Request successful - status: ${data.status}`);
        return data as T;
    }

    /**
     * Initialize checkout form
     * Endpoint matches Python SDK: /payment/iyzipos/checkoutform/initialize/ecom
     */
    async initializeCheckoutForm(
        request: IyzicoCheckoutFormInitializeRequest,
    ): Promise<IyzicoCheckoutFormInitializeResponse> {
        this.logger.log(`[initializeCheckoutForm] Initializing checkout form - conversationId: ${request.conversationId}, basketId: ${request.basketId}`);
        return this.makeRequest<IyzicoCheckoutFormInitializeResponse>(
            '/payment/iyzipos/checkoutform/initialize/ecom',
            request,
        );
    }

    /**
     * Retrieve checkout form result
     * Endpoint matches Python SDK: /payment/iyzipos/checkoutform/auth/ecom/detail
     */
    async retrieveCheckoutForm(
        request: IyzicoCheckoutFormRetrieveRequest,
    ): Promise<IyzicoCheckoutFormRetrieveResponse> {
        this.logger.log(`[retrieveCheckoutForm] Retrieving checkout form - token: ${request.token.substring(0, 20)}..., conversationId: ${request.conversationId}`);
        return this.makeRequest<IyzicoCheckoutFormRetrieveResponse>(
            '/payment/iyzipos/checkoutform/auth/ecom/detail',
            request,
        );
    }
}
