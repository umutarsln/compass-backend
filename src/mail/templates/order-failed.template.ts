import { Order } from '../../order/order.entity';
import { ConfigService } from '@nestjs/config';

export function generateOrderFailedEmailHtml(
  order: Order,
  errorMessage: string | null,
  configService: ConfigService,
): string {
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

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ödeme Başarısız</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Ödeme İşlemi Başarısız</h1>
              <p style="margin: 10px 0 0 0; color: #fee2e2; font-size: 16px;">Ödeme işleminiz tamamlanamadı</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1a1a1a;">
                Merhaba ${customerName},
              </p>
              <p style="margin: 0 0 30px 0; font-size: 16px; color: #666; line-height: 1.6;">
                Maalesef siparişiniz (Sipariş No: <strong>${order.orderNo}</strong>) için ödeme işlemi tamamlanamadı. 
                Siparişiniz iptal edilmiştir ve sepetiniz tekrar aktif hale getirilmiştir.
              </p>

              ${errorMessage
                ? `<div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
                    <p style="margin: 0; font-size: 14px; color: #991b1b; font-weight: 600;">Hata Detayı:</p>
                    <p style="margin: 5px 0 0 0; font-size: 14px; color: #7f1d1d;">${errorMessage}</p>
                  </div>`
                : ''
              }

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
                </table>
              </div>

              <!-- Help Text -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 30px; border-radius: 4px;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #92400e;">Ne Yapabilirsiniz?</h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #78350f; line-height: 1.8;">
                  <li>Kart bilgilerinizi kontrol edin</li>
                  <li>Kart limitinizin yeterli olduğundan emin olun</li>
                  <li>Farklı bir ödeme yöntemi deneyin</li>
                  <li>Sepetinize geri dönüp tekrar deneyin</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin-top: 30px;">
                <a href="${configService.get<string>('FRONTEND_SUCCESS_URL')?.replace('/basarili', '/sepet') || 'https://shawk.com.tr/sepet'}" 
                   style="display: inline-block; padding: 14px 32px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Sepetime Dön
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 15px 0; font-size: 14px; color: #666;">
                Herhangi bir sorunuz varsa, lütfen bizimle iletişime geçin.
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
