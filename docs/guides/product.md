# Product Modülü Kullanım Kılavuzu

## Genel Bakış

Product modülü, e-ticaret sisteminin temel modülüdür. 3 tip ürün destekler: SIMPLE, VARIANT, ve BUNDLE. Her ürün tipi farklı özelliklere sahiptir.

## Ürün Tipleri

### 1. SIMPLE Product
- Tek fiyat
- Tek stok
- Tek galeri
- Varyasyon yok

### 2. VARIANT Product
- Birden fazla varyasyon seçeneği (Color, Size, vb.)
- Her varyasyon değeri için fiyat farkı
- Her kombinasyon için ayrı stok ve galeri

### 3. BUNDLE Product
- Birden fazla ürünün paketlenmiş hali
- Kendi fiyatı var
- İçindeki ürünlerin stokları ayrı takip edilir

## Özellikler

- **Markdown Description**: Ürün açıklamaları Markdown formatında
- **SEO Desteği**: SEO alanları (title, description, keywords)
- **Category & Tag İlişkileri**: Many-to-Many ilişkiler
- **Gallery Sistemi**: Upload entity üzerinden görsel yönetimi
- **Pricing Logic**: Tip bazlı fiyat hesaplama
- **Stock Integration**: Otomatik stok kaydı oluşturma

## Endpoint'ler

### 1. Ürün Oluştur

**POST** `/products`

Yeni bir ürün oluşturur.

**Request Body:**
```json
{
  "type": "SIMPLE",
  "name": "Örnek Ürün",
  "description": "# Ürün Açıklaması\n\nDetaylı bilgi...",
  "basePrice": 99.99,
  "sku": "PRD-001",
  "isActive": true,
  "isFeatured": false,
  "isOnSale": false,
  "discountPercent": null,
  "seoTitle": "Örnek Ürün - SEO",
  "seoDescription": "SEO açıklaması",
  "seoKeywords": ["ürün", "e-ticaret"],
  "categoryIds": ["uuid"],
  "tagIds": ["uuid"]
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "type": "SIMPLE",
  "name": "Örnek Ürün",
  "slug": "ornek-urun",
  "description": "# Ürün Açıklaması\n\nDetaylı bilgi...",
  "basePrice": 99.99,
  "sku": "PRD-001",
  "categories": [...],
  "tags": [...],
  ...
}
```

**Yetkilendirme:** ADMIN

**Notlar:**
- SIMPLE product oluşturulduğunda otomatik stok kaydı oluşturulur
- Slug otomatik oluşturulur
- SKU unique olmalı

### 2. Ürünleri Listele

**GET** `/products`

Tüm ürünleri listeler.

**Query Parameters:**
- `type`: Ürün tipi filtresi (SIMPLE, VARIANT, BUNDLE)
- `categoryId`: Kategori ID filtresi

**Response (200):**
```json
[
  {
    "id": "uuid",
    "type": "SIMPLE",
    "name": "Örnek Ürün",
    "slug": "ornek-urun",
    "basePrice": 99.99,
    "categories": [...],
    "tags": [...],
    ...
  }
]
```

**Yetkilendirme:** Public (herkes erişebilir)

### 3. Ürün Detayı

**GET** `/products/:id`

Belirli bir ürünün detaylarını getirir.

**Response (200):**
```json
{
  "id": "uuid",
  "type": "SIMPLE",
  "name": "Örnek Ürün",
  "description": "# Markdown içerik",
  "basePrice": 99.99,
  "categories": [...],
  "tags": [...],
  "createdBy": {...},
  ...
}
```

**Yetkilendirme:** Public (herkes erişebilir)

### 4. Ürün Güncelle

**PATCH** `/products/:id`

Ürün bilgilerini günceller.

**Request Body:**
```json
{
  "name": "Güncellenmiş Ürün",
  "basePrice": 149.99,
  "isOnSale": true,
  "discountPercent": 10.5,
  "categoryIds": ["uuid"],
  "tagIds": ["uuid"]
}
```

**Yetkilendirme:** ADMIN

### 5. Ürün Sil

**DELETE** `/products/:id`

Ürünü siler.

**Response (200):**
```json
{
  "message": "Ürün başarıyla silindi"
}
```

**Yetkilendirme:** ADMIN

## Fiyat Hesaplama

### SIMPLE Product
```
finalPrice = basePrice * (1 - discountPercent / 100)
```

### VARIANT Product
```
finalPrice = basePrice + sum(variantValue.priceDelta)
// veya
finalPrice = variantCombination.priceOverride (eğer varsa)
```

### BUNDLE Product
```
finalPrice = bundlePrice (fixed veya calculated discount)
```

## Önemli Notlar

- Ürün açıklamaları Markdown formatında saklanır
- Gallery sistemi Upload entity üzerinden çalışır
- Variant ve Bundle sistemleri ayrı endpoint'ler ile yönetilir
- Stock sistemi polymorphic yapı ile çalışır
- Slug'lar otomatik oluşturulur ve unique'dir
- SKU unique olmalı
