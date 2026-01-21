# Order Module Documentation

## Genel Bakış

Order modülü, sipariş yönetimini sağlar. Hem authenticated kullanıcılar hem de guest kullanıcılar için sipariş oluşturma ve görüntüleme desteği sağlar.

## Endpoint'ler

### 1. Sipariş Oluştur

**POST** `/orders`

**Authentication**: Public (guest veya authenticated)

**Request Body**: `CreateOrderDto`

```json
{
  "cartId": "uuid",
  "guestEmail": "guest@example.com", // Guest için
  "guestPhone": "+905551234567",
  "guestFirstName": "Ahmet",
  "guestLastName": "Yılmaz",
  "shippingAddress": {
    "firstName": "Ahmet",
    "lastName": "Yılmaz",
    "phone": "+905551234567",
    "address": "Adres satırı",
    "city": "İstanbul",
    "district": "Kadıköy",
    "postalCode": "34000",
    "country": "Türkiye"
  },
  "billingAddress": { /* ... */ },
  "notes": "Sipariş notu"
}
```

**Response (201 Created)**: `OrderResponseDto` (8 haneli `orderNo` dahil)

---

### 2. Sipariş Detayı

**GET** `/orders/:id`

**Authentication**: Public (orderNo veya orderId ile erişilebilir)

**Path Parameters**:
- `id`: UUID (orderId) veya 8 haneli string (orderNo)

**Response (200 OK)**: `OrderResponseDto` (items, addresses, totals dahil)

---

### 3. Kullanıcının Siparişleri

**GET** `/orders/me/orders`

**Authentication**: USER veya ADMIN rolü gerekli

**Response (200 OK)**: `OrderResponseDto[]` array

---

### 4. Tüm Siparişleri Listele (Admin)

**GET** `/orders`

**Authentication**: ADMIN rolü gerekli

**Query Parameters**:
- `status` (optional): OrderStatus filtresi
- `limit` (optional): Sayfa başına kayıt (default: 50)
- `offset` (optional): Offset (default: 0)
- `search` (optional): Arama terimi (orderNo, email, telefon, isim, soyisim, adres)
- `sortBy` (optional): Sıralama alanı (createdAt, updatedAt, total, status, orderNo)
- `sortOrder` (optional): Sıralama yönü (ASC, DESC)

**Response (200 OK)**: `{ orders: OrderResponseDto[], total: number }`

---

### 5. Sipariş Durumu Güncelle (Admin)

**PATCH** `/orders/:id/status`

**Authentication**: ADMIN rolü gerekli

**Request Body**: `UpdateOrderStatusDto`

```json
{
  "status": "PROCESSING"
}
```

**OrderStatus Değerleri**: `PENDING`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `REFUNDED`

**Response (200 OK)**: Güncellenmiş `OrderResponseDto`

---

## Önemli Notlar

1. **OrderNo**: Her sipariş için 8 haneli unique `orderNo` oluşturulur.
2. **Guest Orders**: Guest kullanıcılar `orderNo` veya `orderId` ile siparişlerini görüntüleyebilir.
3. **Cart Status**: Sipariş oluşturulduktan sonra cart `ORDERED` durumuna geçer (ödeme başarılı olunca).
4. **Order Items**: Sipariş item'ları snapshot olarak saklanır (ürün fiyatı değişse bile değişmez).
5. **Search**: Admin panel'de müşteri bilgileriyle arama yapılabilir (orderNo, email, telefon, isim, soyisim, adres).
