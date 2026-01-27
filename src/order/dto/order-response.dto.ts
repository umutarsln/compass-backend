import { OrderStatus } from '../../common/enums/order-status.enum';
import { Currency } from '../../common/enums/currency.enum';
import { PaymentProvider } from '../../common/enums/payment-provider.enum';

export class OrderItemResponseDto {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountedPrice: number | null;
  totalPrice: number;
  currency: Currency;
  personalization: any | null; // Personalization snapshot data
  createdAt: Date;
  product?: {
    id: string;
    slug: string;
    galleries?: Array<{
      mainImage?: {
        id: string;
        s3Url: string;
        filename: string;
        displayName: string | null;
      } | null;
      thumbnailImage?: {
        id: string;
        s3Url: string;
        filename: string;
        displayName: string | null;
      } | null;
    }>;
  } | null;
  variant?: {
    id: string;
    galleries?: Array<{
      mainImage?: {
        id: string;
        s3Url: string;
        filename: string;
        displayName: string | null;
      } | null;
      thumbnailImage?: {
        id: string;
        s3Url: string;
        filename: string;
        displayName: string | null;
      } | null;
    }>;
  } | null;
}

export class OrderResponseDto {
  id: string;
  orderNo: string; // 8 haneli unique sipariş numarası
  userId: string | null;
  cartId: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  guestFirstName: string | null;
  guestLastName: string | null;
  status: OrderStatus;
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  currency: Currency;
  shippingAddress: any;
  billingAddress: any;
  notes: string | null;
  items: OrderItemResponseDto[];
  paymentProvider: PaymentProvider | null; // Ödeme yöntemi
  createdAt: Date;
  updatedAt: Date;
}
