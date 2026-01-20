import * as crypto from 'crypto';
import { IyzicoCheckoutFormInitializeRequest, IyzicoCheckoutFormInitializeResponse, IyzicoCheckoutFormRetrieveRequest, IyzicoCheckoutFormRetrieveResponse } from './iyzico.types';

export class IyzicoHttpClient {
    private apiKey: string;
    private secretKey: string;
    private baseUrl: string;

    constructor(apiKey: string, secretKey: string, baseUrl: string) {
        this.apiKey = apiKey;
        this.secretKey = secretKey;
        this.baseUrl = baseUrl;
    }

    /**
     * Generate Iyzico authorization header
     * Format: IYZWS apiKey:hash
     * Hash = SHA256(apiKey + randomString + secretKey + requestBody) in base64
     */
    private generateAuthorizationHeader(requestBody: string, randomString: string): string {
        const dataToEncrypt = this.apiKey + randomString + this.secretKey + requestBody;
        const hash = crypto.createHash('sha256').update(dataToEncrypt).digest('base64');
        return `IYZWS ${this.apiKey}:${hash}`;
    }

    /**
     * Generate random string for authorization
     */
    private generateRandomString(): string {
        return crypto.randomBytes(16).toString('base64');
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
        const authorization = this.generateAuthorizationHeader(bodyString, randomString);

        // Log request for debugging
        console.log('Iyzico request body:', bodyString);
        console.log('Iyzico request URL:', `${this.baseUrl}${endpoint}`);
        console.log('Iyzico random string:', randomString);
        console.log('Iyzico authorization header:', authorization);

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authorization,
                'x-iyzi-rnd': randomString,
                'x-iyzi-client-version': 'iyzipay-node-2.0.50',
            },
            body: bodyString,
        });

        const responseText = await response.text();
        console.log('Iyzico response status:', response.status);
        console.log('Iyzico response body:', responseText);

        if (!response.ok) {
            throw new Error(`Iyzico API error: ${response.status} ${response.statusText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (error) {
            console.error('Failed to parse Iyzico response:', responseText);
            throw new Error(`Iyzico response parse error: ${error.message}`);
        }

        if (data.status === 'failure') {
            // Log detailed error information
            console.error('Iyzico API error response:', JSON.stringify(data, null, 2));
            const errorMessage = data.errorMessage || data.errorCode || 'Unknown error';
            const errorGroup = data.errorGroup || '';
            const errorCode = data.errorCode || '';
            throw new Error(`Iyzico error: ${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ''}${errorGroup ? ` (Group: ${errorGroup})` : ''}`);
        }

        return data as T;
    }

    /**
     * Initialize checkout form
     */
    async initializeCheckoutForm(
        request: IyzicoCheckoutFormInitializeRequest,
    ): Promise<IyzicoCheckoutFormInitializeResponse> {
        return this.makeRequest<IyzicoCheckoutFormInitializeResponse>(
            '/payment/checkoutform/initialize',
            request,
        );
    }

    /**
     * Retrieve checkout form result
     */
    async retrieveCheckoutForm(
        request: IyzicoCheckoutFormRetrieveRequest,
    ): Promise<IyzicoCheckoutFormRetrieveResponse> {
        return this.makeRequest<IyzicoCheckoutFormRetrieveResponse>(
            '/payment/checkoutform/auth/ecom/detail',
            request,
        );
    }
}
