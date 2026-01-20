import { OrderStatus } from '../../common/enums/order-status.enum';
import { Currency } from '../../common/enums/currency.enum';

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
  createdAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}
