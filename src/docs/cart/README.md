# Cart Module Documentation

## Genel Bakış

Cart modülü, sepet işlemlerini yönetir. Hem authenticated kullanıcılar hem de guest (misafir) kullanıcılar için sepet desteği sağlar.

## Endpoint'ler

### 1. Guest Sepet Oluştur

**POST** `/carts/guest`

**Authentication**: Public

**Response (201 Created)**: `CartResponseDto`

---

### 2. Sepet Getir

**GET** `/carts/:id`

**Authentication**: Public (guest cart guard ile)

**Response (200 OK)**: `CartResponseDto` (items, totals dahil)

---

### 3. Sepete Ürün Ekle

**POST** `/carts/:id/items`

**Authentication**: Public (guest/user cart guard ile)

**Request Body**: `AddItemDto`

```json
{
  "productId": "uuid",
  "variantCombinationId": "uuid", // Varyasyonlu ürünler için
  "quantity": 2
}
```

**Response (201 Created)**: `CartResponseDto`

---

### 4. Sepet Ürününü Güncelle

**PATCH** `/carts/:id/items/:itemId`

**Authentication**: Public (guest/user cart guard ile)

**Request Body**: `UpdateItemDto`

```json
{
  "quantity": 3
}
```

**Response (200 OK)**: `CartResponseDto`

---

### 5. Sepet Ürününü Sil

**DELETE** `/carts/:id/items/:itemId`

**Authentication**: Public (guest/user cart guard ile)

**Response (200 OK)**: `CartResponseDto`

---

### 6. Sepeti Temizle

**DELETE** `/carts/:id/items`

**Authentication**: Public (guest/user cart guard ile)

**Response (200 OK)**: `CartResponseDto`

---

### 7. Sepete Kupon Uygula

**POST** `/carts/:id/coupon`

**Authentication**: Public (guest cart guard ile)

**Request Body**: `ApplyCouponDto`

```json
{
  "code": "HOSGELDIN20"
}
```

**Response (200 OK)**: `CartResponseDto` (subtotal, discountAmount, total, appliedCoupon dahil)

---

### 8. Sepetten Kupon Kaldır

**DELETE** `/carts/:id/coupon`

**Authentication**: Public (guest cart guard ile)

**Response (200 OK)**: `CartResponseDto`

---

## Sepet Cevabı (CartResponseDto)

Sepet cevabında aşağıdaki toplam alanları döner:

- **subtotal**: Ürünler toplamı (kargo ve kupon öncesi)
- **discountAmount**: Kupon indirimi tutarı
- **total**: Genel toplam (subtotal - discountAmount)
- **appliedCoupon**: Uygulanan kupon bilgisi (id, code, name, type, discountValue, discountAmount) veya null

---

## Önemli Notlar

1. **Guest Cart**: Guest kullanıcılar için cart ID localStorage'da saklanır.
2. **User Cart**: Authenticated kullanıcılar için cart userId ile ilişkilendirilir.
3. **Cart Status**: Cart'lar `ACTIVE` veya `ORDERED` durumunda olabilir.
4. **Stok Kontrolü**: Sepete ekleme sırasında stok kontrolü yapılır.
5. **Varyasyonlu Ürünler**: Varyasyonlu ürünler için `variantCombinationId` zorunludur.
6. **Kupon**: Her sepette en fazla bir kupon uygulanabilir. Kupon detayları için Coupon modülü dokümantasyonuna bakın.
