# Tag Modülü Kullanım Kılavuzu

## Genel Bakış

Tag modülü, ürünleri etiketlemek için kullanılır. Tag'ler ürünleri kategorize etmek ve filtrelemek için kullanılabilir. Her tag bir renk ile ilişkilendirilebilir (UI için).

## Özellikler

- **Basit Yapı**: Tag'ler flat yapıdadır (hierarchical değil)
- **Renk Desteği**: Her tag için hex color code
- **Slug Otomatik Oluşturma**: URL-friendly slug'lar otomatik oluşturulur
- **Ürün İlişkilendirme**: Tag'ler ürünlere Many-to-Many ilişki ile bağlanır

## Endpoint'ler

### 1. Tag Oluştur

**POST** `/tags`

Yeni bir tag oluşturur.

**Request Body:**
```json
{
  "name": "Yeni Ürün",
  "description": "Yeni ürünler için tag",
  "color": "#FF5733"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Yeni Ürün",
  "slug": "yeni-urun",
  "description": "Yeni ürünler için tag",
  "color": "#FF5733",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Yetkilendirme:** ADMIN

### 2. Tüm Tag'leri Listele

**GET** `/tags`

Tüm tag'leri listeler.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Yeni Ürün",
    "slug": "yeni-urun",
    "color": "#FF5733",
    ...
  }
]
```

**Yetkilendirme:** Public (herkes erişebilir)

### 3. Tag Detayı

**GET** `/tags/:id`

Belirli bir tag'in detaylarını getirir.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Yeni Ürün",
  "slug": "yeni-urun",
  "description": "Yeni ürünler için tag",
  "color": "#FF5733",
  ...
}
```

**Yetkilendirme:** Public (herkes erişebilir)

### 4. Tag Güncelle

**PATCH** `/tags/:id`

Tag bilgilerini günceller.

**Request Body:**
```json
{
  "name": "Güncellenmiş Tag",
  "color": "#33FF57"
}
```

**Yetkilendirme:** ADMIN

### 5. Tag Sil

**DELETE** `/tags/:id`

Tag'i siler.

**Response (200):**
```json
{
  "message": "Tag başarıyla silindi"
}
```

**Yetkilendirme:** ADMIN

## Önemli Notlar

- Tag'ler ürünlere Many-to-Many ilişki ile bağlanır
- Tag silindiğinde ürün-tag ilişkileri otomatik silinir (TypeORM cascade)
- Slug'lar otomatik oluşturulur ve unique'dir
