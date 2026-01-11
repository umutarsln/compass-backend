# Category Modülü Kullanım Kılavuzu

## Genel Bakış

Category modülü, ürün kategorilerini yönetmek için kullanılır. Hierarchical (hierarşik) yapı destekler, yani kategorilerin alt kategorileri olabilir. Her kategori bir Upload görseli ile ilişkilendirilebilir.

## Özellikler

- **Hierarchical Yapı**: Kategoriler parent-child ilişkisi ile organize edilir
- **Tree Yapısı**: Kategoriler tree formatında listelenebilir
- **SEO Desteği**: Her kategori için SEO alanları (title, description, keywords)
- **Görsel Desteği**: Kategori görseli Upload entity üzerinden yönetilir
- **Slug Otomatik Oluşturma**: URL-friendly slug'lar otomatik oluşturulur

## Endpoint'ler

### 1. Kategori Oluştur

**POST** `/categories`

Yeni bir kategori oluşturur.

**Request Body:**
```json
{
  "name": "Elektronik",
  "description": "Elektronik ürünler kategorisi",
  "parentId": null,
  "imageId": "123e4567-e89b-12d3-a456-426614174000",
  "seoTitle": "Elektronik Ürünler",
  "seoDescription": "Elektronik ürünler için kategori",
  "seoKeywords": ["elektronik", "teknoloji"],
  "isActive": true,
  "displayOrder": 0
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Elektronik",
  "slug": "elektronik",
  "description": "Elektronik ürünler kategorisi",
  "parentId": null,
  "imageId": "123e4567-e89b-12d3-a456-426614174000",
  "seoTitle": "Elektronik Ürünler",
  "seoDescription": "Elektronik ürünler için kategori",
  "seoKeywords": ["elektronik", "teknoloji"],
  "isActive": true,
  "displayOrder": 0,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Yetkilendirme:** ADMIN

### 2. Tüm Kategorileri Listele

**GET** `/categories`

Tüm kategorileri listeler.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Elektronik",
    "slug": "elektronik",
    "parent": null,
    "children": [],
    "image": {...},
    ...
  }
]
```

**Yetkilendirme:** Public (herkes erişebilir)

### 3. Tree Yapısında Listele

**GET** `/categories/tree`

Kategorileri hierarchical tree yapısında listeler.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Elektronik",
    "children": [
      {
        "id": "uuid",
        "name": "Telefon",
        "children": []
      }
    ]
  }
]
```

**Yetkilendirme:** Public (herkes erişebilir)

### 4. Kategori Detayı

**GET** `/categories/:id`

Belirli bir kategorinin detaylarını getirir.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Elektronik",
  "slug": "elektronik",
  "parent": {...},
  "children": [...],
  "image": {...},
  ...
}
```

**Yetkilendirme:** Public (herkes erişebilir)

### 5. Kategori Güncelle

**PATCH** `/categories/:id`

Kategori bilgilerini günceller.

**Request Body:**
```json
{
  "name": "Güncellenmiş Kategori",
  "description": "Yeni açıklama",
  "isActive": false
}
```

**Yetkilendirme:** ADMIN

### 6. Kategori Sil

**DELETE** `/categories/:id`

Kategoriyi siler. Alt kategorileri varsa hata döner.

**Response (200):**
```json
{
  "message": "Kategori başarıyla silindi"
}
```

**Yetkilendirme:** ADMIN

## Önemli Notlar

- Bir kategori kendisinin parent'ı olamaz (circular reference önleme)
- Bir kategori kendi alt kategorisinin altına taşınamaz
- Alt kategorileri olan bir kategori silinemez
- Slug'lar otomatik oluşturulur ve unique'dir
