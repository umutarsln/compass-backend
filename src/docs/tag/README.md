# Tag Module Documentation

## Genel Bakış

Tag modülü, ürün etiketlerinin yönetimini sağlar. Tag'ler ürünleri kategorize etmek ve filtrelemek için kullanılır.

## Endpoint'ler

### 1. Tag Oluştur

**POST** `/tags`

**Authentication**: ADMIN rolü gerekli

**Request Body**: `CreateTagDto`

```json
{
  "name": "Yeni Ürün",
  "slug": "yeni-urun",
  "description": "Yeni ürünler için tag",
  "color": "#FF5733"
}
```

**Response (201 Created)**: `Tag` entity

---

### 2. Tag'leri Listele

**GET** `/tags`

**Authentication**: Public

**Response (200 OK)**: `Tag[]` array

---

### 3. Tag Detayı

**GET** `/tags/:id`

**Authentication**: Public

**Response (200 OK)**: `Tag` entity

---

### 4. Tag Güncelle

**PATCH** `/tags/:id`

**Authentication**: ADMIN rolü gerekli

**Request Body**: `UpdateTagDto` (tüm alanlar optional)

**Response (200 OK)**: Güncellenmiş `Tag` entity

---

### 5. Tag Sil

**DELETE** `/tags/:id`

**Authentication**: ADMIN rolü gerekli

**Response (200 OK)**: `{ message: "Tag başarıyla silindi" }`

---

## Önemli Notlar

1. **Slug Uniqueness**: Slug unique olmalıdır.
2. **Color**: Tag'ler hex formatında renk bilgisine sahiptir (örn: #FF5733).
3. **Ürün İlişkileri**: Tag'ler ürünlerle many-to-many ilişkiye sahiptir.
