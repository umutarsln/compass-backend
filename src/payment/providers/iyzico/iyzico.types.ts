export interface IyzicoCheckoutFormInitializeRequest {
    locale: string;
    conversationId: string;
    price: string; // String format as per Python SDK example
    paidPrice: string; // String format as per Python SDK example
    currency: string;
    basketId: string;
    paymentGroup?: string;
    callbackUrl: string;
    enabledInstallments?: string[];
    buyer: {
        id?: string;
        name: string;
        surname: string;
        gsmNumber: string;
        email: string;
        identityNumber?: string;
        lastLoginDate?: string;
        registrationDate?: string;
        registrationAddress?: string;
        ip?: string;
        city?: string;
        country?: string;
        zipCode?: string;
    };
    shippingAddress: {
        contactName: string;
        city: string;
        country: string;
        address: string;
        zipCode: string;
    };
    billingAddress: {
        contactName: string;
        city: string;
        country: string;
        address: string;
        zipCode: string;
    };
    basketItems: Array<{
        id: string;
        name: string;
        category1?: string;
        category2?: string;
        itemType: 'PHYSICAL' | 'VIRTUAL';
        price: string; // String format as per Python SDK example
    }>;
}

export interface IyzicoCheckoutFormInitializeResponse {
    status: string;
    locale: string;
    systemTime: number;
    conversationId: string;
    checkoutFormContent?: string;
    token?: string;
    tokenExpireTime?: number;
    paymentPageUrl?: string;
    errorCode?: string;
    errorMessage?: string;
    errorGroup?: string;
}

export interface IyzicoCheckoutFormRetrieveRequest {
    locale: string;
    conversationId: string;
    token: string;
}

export interface IyzicoCheckoutFormRetrieveResponse {
    status: string;
    locale: string;
    systemTime: number;
    conversationId: string;
    token: string;
    paymentStatus: string;
    errorCode?: string;
    errorMessage?: string;
    errorGroup?: string;
    paymentId?: string;
    fraudStatus?: number;
    merchantCommissionRate?: string;
    merchantCommissionRateAmount?: string;
    iyziCommissionRateAmount?: string;
    iyziCommissionFee?: string;
    cardType?: string;
    cardAssociation?: string;
    cardFamily?: string;
    binNumber?: string;
    lastFourDigits?: string;
    basketId?: string;
    currency?: string;
    itemTransactions?: Array<{
        itemId: string;
        paymentTransactionId: string;
        transactionStatus: number;
        price: string;
        paidPrice: string;
        merchantCommissionRate: string;
        merchantCommissionRateAmount: string;
        iyziCommissionRateAmount: string;
        iyziCommissionFee: string;
        blockageRate: string;
        blockageRateAmountMerchant: string;
        blockageRateAmountSubMerchant: string;
        subMerchantKey: string;
        subMerchantPrice: string;
        subMerchantPayoutRate: string;
        subMerchantPayoutAmount: string;
        merchantPayoutAmount: string;
        convertedPayout: {
            paidPrice: string;
            iyziCommissionRateAmount: string;
            iyziCommissionFee: string;
            blockageRateAmountMerchant: string;
            merchantPayoutAmount: string;
            iyziConversionRate: string;
            iyziConversionRateAmount: string;
            currency: string;
        };
    }>;
    connectorName?: string;
    authCode?: string;
    phase?: string;
    hostReference?: string;
}
