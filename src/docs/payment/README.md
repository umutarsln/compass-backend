# Payment Module Documentation

## Genel Bakış

Payment modülü, ödeme işlemlerini yönetir. Iyzico payment gateway entegrasyonu ile ödeme işlemleri gerçekleştirilir.

## Endpoint'ler

### 1. Checkout Başlat

**POST** `/payments/checkout`

**Authentication**: Public

**Request Body**: `CheckoutDto`

```json
{
  "orderId": "uuid",
  "provider": "IYZICO"
}
```

**Response (200 OK)**: `CheckoutResponseDto`

```json
{
  "attemptId": "uuid",
  "redirectUrl": "https://sandbox-api.iyzipay.com/...",
  "status": "PENDING"
}
```

**Önemli**: Frontend'de kullanıcı `redirectUrl`'e yönlendirilmelidir.

---

### 2. Iyzico Callback

**POST** `/payments/iyzico/callback`

**Authentication**: Public (Iyzico'dan gelen callback)

**Request**: Iyzico form data (token parametresi)

**Response**: HTML redirect (success veya failure sayfasına)

**Önemli Notlar**:
- Callback başarılı olursa: cart `ORDERED` olur, kullanıcıya success email gönderilir
- Callback başarısız olursa: cart `ACTIVE` kalır, kullanıcıya failure email gönderilir

---

## Ödeme Akışı

1. **Order Oluştur**: `/orders` endpoint'i ile sipariş oluşturulur
2. **Checkout Başlat**: `/payments/checkout` endpoint'i ile ödeme başlatılır
3. **Iyzico'ya Yönlendir**: `redirectUrl`'e kullanıcı yönlendirilir
4. **Ödeme İşlemi**: Kullanıcı Iyzico'da ödeme yapar
5. **Callback**: Iyzico ödeme sonucunu callback endpoint'ine gönderir
6. **Sonuç**: Kullanıcı success veya failure sayfasına yönlendirilir

---

## Önemli Notlar

1. **Cart Status**: Ödeme başarılı olunca cart `ORDERED` durumuna geçer, başarısız olursa `ACTIVE` kalır.
2. **Email Notifications**: Ödeme başarılı/başarısız durumunda kullanıcıya email gönderilir.
3. **Order Status**: Ödeme başarılı olunca order `PAID` durumuna geçer.
4. **Price Validation**: Iyzico'ya gönderilen toplam tutar, item fiyatlarının toplamına eşit olmalıdır.
5. **Guest Checkout**: Guest kullanıcılar için `buyerId` olarak `guestId` (UUID) gönderilir.
