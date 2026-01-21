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

## Önemli Notlar

1. **Guest Cart**: Guest kullanıcılar için cart ID localStorage'da saklanır.
2. **User Cart**: Authenticated kullanıcılar için cart userId ile ilişkilendirilir.
3. **Cart Status**: Cart'lar `ACTIVE` veya `ORDERED` durumunda olabilir.
4. **Stok Kontrolü**: Sepete ekleme sırasında stok kontrolü yapılır.
5. **Varyasyonlu Ürünler**: Varyasyonlu ürünler için `variantCombinationId` zorunludur.
