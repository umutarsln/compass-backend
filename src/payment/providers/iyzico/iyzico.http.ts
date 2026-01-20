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
     */
    private generateAuthorizationHeader(requestBody: string): string {
        const randomString = this.generateRandomString();
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
        const authorization = this.generateAuthorizationHeader(bodyString);
        const randomString = this.generateRandomString();

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

        if (!response.ok) {
            throw new Error(`Iyzico API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status === 'failure') {
            throw new Error(`Iyzico error: ${data.errorMessage || data.errorCode || 'Unknown error'}`);
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
