import { Order } from '../../order/order.entity';
import { ConfigService } from '@nestjs/config';

interface ProductImageInfo {
  url: string;
  alt: string;
}

interface OrderItemWithImage {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountedPrice: number | null;
  totalPrice: number;
  currency: string;
  image: ProductImageInfo | null;
  variantValues?: Array<{
    value: string;
    variantOption: {
      name: string;
      type: 'COLOR' | 'TEXT';
    } | null;
    colorCode: string | null;
  }>;
}

export function generateOrderSuccessEmailHtml(
  order: Order,
  itemsWithImages: OrderItemWithImage[],
  configService: ConfigService,
): string {
  const appPublicUrl = configService.get<string>('APP_PUBLIC_URL') || 'https://shawk.com.tr';
  const customerName = order.userId
    ? `${order.user?.firstname || ''} ${order.user?.lastname || ''}`.trim() || 'Değerli Müşterimiz'
    : `${order.guestFirstName || ''} ${order.guestLastName || ''}`.trim() || 'Değerli Müşterimiz';
  const customerEmail = order.userId ? order.user?.email : order.guestEmail;
  const orderDate = new Date(order.createdAt).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: order.currency || 'TRY',
    }).format(price);
  };

  const itemsHtml = itemsWithImages
    .map(
      (item) => `
    <tr>
      <td style="padding: 20px; border-bottom: 1px solid #e5e5e5;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="120" style="vertical-align: top;">
              ${
                item.image
                  ? `<img src="${item.image.url}" alt="${item.image.alt}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;" />`
                  : '<div style="width: 100px; height: 100px; background-color: #f5f5f5; border-radius: 8px;"></div>'
              }
            </td>
            <td style="padding-left: 20px; vertical-align: top;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
                ${item.productName}
              </h3>
              ${
                item.variantValues && item.variantValues.length > 0
                  ? `<div style="margin-bottom: 8px; font-size: 14px; color: #666;">
                      ${item.variantValues
                        .map((vv) => {
                          if (vv.variantOption?.type === 'COLOR' && vv.colorCode) {
                            return `<span style="display: inline-flex; align-items: center; gap: 4px; margin-right: 8px;">
                              <span style="display: inline-block; width: 16px; height: 16px; border-radius: 50%; background-color: ${vv.colorCode}; border: 1px solid #ddd;"></span>
                              <span>${vv.variantOption.name}: ${vv.value}</span>
                            </span>`;
                          }
                          return `<span style="margin-right: 8px;">${vv.variantOption?.name || 'Seçenek'}: ${vv.value}</span>`;
                        })
                        .join('')}
                    </div>`
                  : ''
              }
              <p style="margin: 0; font-size: 14px; color: #666;">Adet: ${item.quantity}</p>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
                ${formatPrice(item.totalPrice)}
              </p>
              ${
                item.discountedPrice && item.discountedPrice < item.unitPrice
                  ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #999; text-decoration: line-through;">
                      ${formatPrice(item.unitPrice * item.quantity)}
                    </p>`
                  : ''
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `,
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sipariş Onayı</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Siparişiniz Alındı!</h1>
              <p style="margin: 10px 0 0 0; color: #e0e0e0; font-size: 16px;">Ödemeniz başarıyla tamamlandı</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1a1a1a;">
                Merhaba ${customerName},
              </p>
              <p style="margin: 0 0 30px 0; font-size: 16px; color: #666; line-height: 1.6;">
                Siparişiniz başarıyla alındı ve ödeme işleminiz tamamlandı. Siparişiniz en kısa sürede hazırlanıp kargoya verilecektir.
              </p>

              <!-- Order Info -->
              <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h2 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">Sipariş Bilgileri</h2>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #666;">Sipariş No:</td>
                    <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1a1a1a; text-align: right;">${order.orderNo}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #666;">Sipariş Tarihi:</td>
                    <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1a1a1a; text-align: right;">${orderDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #666;">E-posta:</td>
                    <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1a1a1a; text-align: right;">${customerEmail}</td>
                  </tr>
                </table>
              </div>

              <!-- Products -->
              <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">Sipariş Detayları</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
                ${itemsHtml}
              </table>

              <!-- Order Summary -->
              <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e5e5;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0; font-size: 14px; color: #666;">Ara Toplam:</td>
                    <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1a1a1a; text-align: right;">${formatPrice(Number(order.subtotal))}</td>
                  </tr>
                  ${Number(order.shippingCost) > 0
                    ? `<tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #666;">Kargo:</td>
                        <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1a1a1a; text-align: right;">${formatPrice(Number(order.shippingCost))}</td>
                      </tr>`
                    : ''
                  }
                  ${Number(order.discount) > 0
                    ? `<tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #666;">İndirim:</td>
                        <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: #1a1a1a; text-align: right;">-${formatPrice(Number(order.discount))}</td>
                      </tr>`
                    : ''
                  }
                  <tr>
                    <td style="padding: 12px 0; font-size: 18px; font-weight: 700; color: #1a1a1a; border-top: 1px solid #e5e5e5;">Toplam:</td>
                    <td style="padding: 12px 0; font-size: 18px; font-weight: 700; color: #1a1a1a; text-align: right; border-top: 1px solid #e5e5e5;">${formatPrice(Number(order.total))}</td>
                  </tr>
                </table>
              </div>

              <!-- Shipping Address -->
              ${order.shippingAddress
                ? `<div style="margin-top: 30px; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
                    <h2 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">Teslimat Adresi</h2>
                    <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.8;">
                      ${order.shippingAddress.address || ''}<br>
                      ${order.shippingAddress.district || ''} / ${order.shippingAddress.city || ''}<br>
                      ${order.shippingAddress.postalCode || ''}
                    </p>
                  </div>`
                : ''
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 15px 0; font-size: 14px; color: #666;">
                Siparişinizle ilgili herhangi bir sorunuz varsa, lütfen bizimle iletişime geçin.
              </p>
              <p style="margin: 0; font-size: 12px; color: #999;">
                Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
