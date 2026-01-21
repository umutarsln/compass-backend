# Mail Module Documentation

## Genel Bakış

Mail modülü, email gönderme işlemlerini yönetir. Gmail SMTP ile OAuth2 authentication kullanarak email gönderir. Özellikle sipariş başarılı/başarısız durumlarında kullanıcılara email gönderilir.

## Module Yapısı

```
backend/src/mail/
├── mail.module.ts              # Mail module (Gmail OAuth2 config)
├── mail.service.ts             # Mail service (email gönderme)
└── templates/
    ├── order-success.template.ts  # Sipariş başarılı email template
    └── order-failed.template.ts    # Sipariş başarısız email template
```

## Kullanım

Mail service, diğer module'lar tarafından inject edilerek kullanılır. Örneğin Payment service, ödeme başarılı/başarısız durumlarında mail service'i kullanarak email gönderir.

## Email Tipleri

### 1. Sipariş Başarılı Email

**Method**: `sendOrderSuccessEmail(order: Order, itemsWithImages: OrderItemWithImage[])`

**İçerik**:
- Sipariş numarası
- Müşteri bilgileri
- Ürün listesi (resimler dahil)
- Toplam tutar
- Adres bilgileri

**Template**: `order-success.template.ts`

---

### 2. Sipariş Başarısız Email

**Method**: `sendOrderFailedEmail(order: Order, errorMessage?: string)`

**İçerik**:
- Sipariş numarası
- Müşteri bilgileri
- Hata mesajı (varsa)
- Tekrar deneme önerisi

**Template**: `order-failed.template.ts`

---

## Environment Variables

Mail modülü aşağıdaki environment variable'ları kullanır:

- `GOOGLE_CLIENT_ID`: Google OAuth2 Client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth2 Client Secret
- `GOOGLE_REFRESH_TOKEN`: Google OAuth2 Refresh Token
- `EMAIL_USER`: Gmail email adresi

---

## Önemli Notlar

1. **OAuth2 Authentication**: Gmail SMTP için OAuth2 kullanılır.
2. **HTML Templates**: Email'ler HTML formatında gönderilir.
3. **Product Images**: Sipariş başarılı email'inde ürün resimleri gösterilir.
4. **Recipient Email**: Email, order'daki `user.email` veya `guestEmail` alanından alınır.
5. **Error Handling**: Email gönderme hataları log'lanır ancak işlem akışını durdurmaz.

---

## Örnek Kullanım

```typescript
// Payment service'de kullanım
await this.mailService.sendOrderSuccessEmail(order, itemsWithImages);

// Hata durumunda
await this.mailService.sendOrderFailedEmail(order, errorMessage);
```
