# Favorite Module Documentation

## Genel Bakış

Favorite modülü, kullanıcıların favori ürünlerini yönetmesini sağlar. Authenticated kullanıcılar ürünleri favorilerine ekleyip çıkarabilir.

## Endpoint'ler

### 1. Favorileri Listele

**GET** `/me/favorites`

**Authentication**: USER veya ADMIN rolü gerekli

**Response (200 OK)**: Favorite array

```json
[
  {
    "id": "uuid",
    "productId": "uuid",
    "product": { /* Product entity */ },
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### 2. Favori Ekle

**POST** `/me/favorites`

**Authentication**: USER veya ADMIN rolü gerekli

**Request Body**:

```json
{
  "productId": "uuid"
}
```

**Response (201 Created)**: Favorite entity

---

### 3. Favori Sil

**DELETE** `/me/favorites/:productId`

**Authentication**: USER veya ADMIN rolü gerekli

**Response (200 OK)**: `{ message: "Favorite removed" }`

---

## Önemli Notlar

1. **User-Specific**: Her kullanıcının kendi favori listesi vardır.
2. **Product Relationship**: Favoriler product ile ilişkilendirilir.
3. **Duplicate Prevention**: Aynı ürün birden fazla kez favorilere eklenemez.
