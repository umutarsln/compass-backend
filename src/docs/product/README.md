# Product Module Documentation

## Genel Bakış

Product modülü, e-ticaret sistemindeki ürün yönetimini sağlar. Basit ürünler (SIMPLE), varyasyonlu ürünler (VARIANT) ve paket ürünler (BUNDLE) desteklenir. Ürünlerin kategorileri, tag'leri, galerileri, varyasyon seçenekleri ve kombinasyonları yönetilebilir.

## Module Yapısı

```
backend/src/product/
├── product.controller.ts          # Product endpoint'leri
├── product.service.ts             # Product iş mantığı
├── product.module.ts              # Product module tanımı
├── product.entity.ts              # Product entity
├── product-gallery.entity.ts      # Product gallery entity
├── variant-option.entity.ts       # Variant option entity
├── variant-value.entity.ts        # Variant value entity
├── variant-combination.entity.ts  # Variant combination entity
├── bundle-item.entity.ts          # Bundle item entity
└── dto/
    ├── create-product.dto.ts
    ├── update-product.dto.ts
    ├── create-product-gallery.dto.ts
    ├── update-product-gallery.dto.ts
    └── ... (diğer DTO'lar)
```

## Ürün Tipleri

### 1. SIMPLE (Basit Ürün)
Tek bir SKU ve fiyatı olan basit ürünler.

### 2. VARIANT (Varyasyonlu Ürün)
Farklı varyasyon seçenekleri (renk, beden, vb.) olan ürünler. Her kombinasyon ayrı bir SKU ve fiyatı olabilir.

### 3. BUNDLE (Paket Ürün)
Birden fazla ürünün bir araya geldiği paket ürünler.

## Endpoint'ler

### Ürün Yönetimi

#### 1. Ürün Oluştur

**POST** `/products`

Yeni ürün oluşturur.

**Authentication**: ADMIN rolü gerekli

**Request Body**: `CreateProductDto`

```json
{
  "type": "SIMPLE",
  "name": "Ürün Adı",
  "subtitle": "Ürün Alt Başlığı",
  "slug": "urun-adi",
  "description": "Ürün açıklaması",
  "basePrice": 100.00,
  "sku": "SKU-001",
  "isActive": true,
  "isFeatured": false,
  "isOnSale": false,
  "discountedPrice": null,
  "categoryIds": ["uuid1", "uuid2"],
  "tagIds": ["uuid1"]
}
```

**Response (201 Created)**: `Product` entity

---

#### 2. Ürünleri Listele

**GET** `/products`

Tüm ürünleri listeler.

**Authentication**: Public (authentication gerekmez)

**Query Parameters**:
- `type` (optional): Ürün tipi filtresi (SIMPLE, VARIANT, BUNDLE)
- `categoryId` (optional): Kategori ID filtresi

**Response (200 OK)**: `Product[]` array

---

#### 3. Ürün Detayı (ID ile)

**GET** `/products/:id`

Ürün detayını getirir.

**Authentication**: Public

**Response (200 OK)**: `Product` entity (gallery, categories, tags, variant options dahil)

---

#### 4. Ürün Detayı (Slug ile)

**GET** `/products/slug/:slug`

Slug ile ürün detayını getirir.

**Authentication**: Public

**Response (200 OK)**: `Product` entity

---

#### 5. Ürün Güncelle

**PATCH** `/products/:id`

Ürün bilgilerini günceller.

**Authentication**: ADMIN rolü gerekli

**Request Body**: `UpdateProductDto` (tüm alanlar optional)

**Response (200 OK)**: Güncellenmiş `Product` entity

---

#### 6. Ürün Sil

**DELETE** `/products/:id`

Ürünü siler.

**Authentication**: ADMIN rolü gerekli

**Response (200 OK)**: `{ message: "Ürün başarıyla silindi" }`

---

### Ürün Galeri Yönetimi

#### 7. Ürün Galerisi Oluştur

**POST** `/products/:productId/gallery`

Basit ürün için galeri oluşturur.

**Authentication**: ADMIN rolü gerekli

**Request Body**: `CreateProductGalleryDto`

```json
{
  "productId": "uuid",
  "mainImageId": "uuid",
  "thumbnailImageId": "uuid",
  "detailImageIds": ["uuid1", "uuid2"],
  "displayOrder": 0
}
```

---

#### 8. Varyasyon Kombinasyonu Galerisi Oluştur

**POST** `/products/variants/:variantCombinationId/gallery`

Varyasyon kombinasyonu için galeri oluşturur.

**Authentication**: ADMIN rolü gerekli

---

#### 9. Ürün Galerisi Getir

**GET** `/products/:productId/gallery`

Ürünün galerisini getirir.

**Authentication**: Public

---

#### 10. Varyasyon Kombinasyonu Galerisi Getir

**GET** `/products/variants/:variantCombinationId/gallery`

Varyasyon kombinasyonunun galerisini getirir.

**Authentication**: Public

---

#### 11. Galeri Güncelle

**PATCH** `/products/gallery/:galleryId`

Galeri bilgilerini günceller.

**Authentication**: ADMIN rolü gerekli

---

#### 12. Galeri Sil

**DELETE** `/products/gallery/:galleryId`

Galeriyi siler.

**Authentication**: ADMIN rolü gerekli

---

### Varyasyon Yönetimi

#### 13. Varyasyon Seçeneği Oluştur

**POST** `/products/:productId/variant-options`

Ürün için varyasyon seçeneği (örn: Renk, Beden) oluşturur.

**Authentication**: ADMIN rolü gerekli

**Request Body**: `CreateVariantOptionDto`

```json
{
  "name": "Renk",
  "type": "COLOR",
  "displayOrder": 0,
  "isRequired": true
}
```

**Varyasyon Tipleri**: `COLOR`, `TEXT`, `IMAGE`

---

#### 14. Varyasyon Seçeneklerini Listele

**GET** `/products/:productId/variant-options`

Ürünün tüm varyasyon seçeneklerini getirir.

**Authentication**: ADMIN rolü gerekli

---

#### 15. Varyasyon Seçeneği Güncelle

**PATCH** `/products/variant-options/:id`

Varyasyon seçeneğini günceller.

**Authentication**: ADMIN rolü gerekli

---

#### 16. Varyasyon Seçeneği Sil

**DELETE** `/products/variant-options/:id`

Varyasyon seçeneğini siler.

**Authentication**: ADMIN rolü gerekli

---

#### 17. Varyasyon Değeri Oluştur

**POST** `/products/variant-options/:variantOptionId/variant-values`

Varyasyon seçeneği için değer (örn: Kırmızı, Mavi) oluşturur.

**Authentication**: ADMIN rolü gerekli

**Request Body**: `CreateVariantValueDto`

```json
{
  "value": "Kırmızı",
  "colorCode": "#FF0000",
  "priceDelta": 10.00,
  "isActive": true,
  "displayOrder": 0
}
```

---

#### 18. Varyasyon Değerlerini Listele

**GET** `/products/variant-options/:variantOptionId/variant-values`

Varyasyon seçeneğinin tüm değerlerini getirir.

**Authentication**: ADMIN rolü gerekli

---

#### 19. Varyasyon Değeri Güncelle

**PATCH** `/products/variant-values/:id`

Varyasyon değerini günceller.

**Authentication**: ADMIN rolü gerekli

---

#### 20. Varyasyon Değeri Sil

**DELETE** `/products/variant-values/:id`

Varyasyon değerini siler.

**Authentication**: ADMIN rolü gerekli

---

#### 21. Varyasyon Kombinasyonları Oluştur (Otomatik)

**POST** `/products/:productId/variant-combinations/generate`

Tüm varyasyon kombinasyonlarını otomatik olarak oluşturur.

**Authentication**: ADMIN rolü gerekli

**Response**: Oluşturulan kombinasyon sayısı

---

#### 22. Varyasyon Kombinasyonlarını Listele

**GET** `/products/:productId/variant-combinations`

Ürünün tüm varyasyon kombinasyonlarını getirir.

**Authentication**: ADMIN rolü gerekli

---

#### 23. Varyasyon Kombinasyonu Oluştur (Manuel)

**POST** `/products/:productId/variant-combinations`

Manuel olarak varyasyon kombinasyonu oluşturur.

**Authentication**: ADMIN rolü gerekli

**Request Body**: `CreateVariantCombinationDto`

```json
{
  "variantValueIds": ["uuid1", "uuid2"],
  "sku": "SKU-001",
  "isActive": true,
  "isDisabled": false
}
```

---

#### 24. Varyasyon Kombinasyonu Güncelle

**PATCH** `/products/variant-combinations/:id`

Varyasyon kombinasyonunu günceller.

**Authentication**: ADMIN rolü gerekli

---

#### 25. Toplam Stok Getir

**GET** `/products/:productId/variant-combinations/total-stock`

Ürünün tüm varyasyon kombinasyonlarının toplam stok bilgisini getirir.

**Authentication**: ADMIN rolü gerekli

---

### Diğer İşlemler

#### 26. Tüm Ürün Verilerini Temizle

**POST** `/products/reset`

**DİKKAT**: Tüm ürün verilerini siler (sadece test/development için).

**Authentication**: ADMIN rolü gerekli

**Response**: `{ message: "Tüm ürün verileri temizlendi" }`

---

## Authentication/Authorization

### Public Endpoints

- `GET /products` - Tüm ürünleri listele
- `GET /products/:id` - Ürün detayı
- `GET /products/slug/:slug` - Slug ile ürün detayı
- `GET /products/:productId/gallery` - Ürün galerisi
- `GET /products/variants/:variantCombinationId/gallery` - Varyasyon galerisi

### Admin Only Endpoints

Tüm diğer endpoint'ler ADMIN rolü gerektirir.

---

## Önemli Notlar

1. **Slug Uniqueness**: Ürün slug'ı unique olmalıdır.

2. **SKU Uniqueness**: SKU unique olmalıdır (basit ürünler için).

3. **Varyasyon Kombinasyonları**: Varyasyonlu ürünlerde, her kombinasyon ayrı bir SKU ve stok bilgisine sahiptir.

4. **Price Delta**: Varyasyon değerlerinde `priceDelta` kullanılır. Bu değer base price'a eklenir.

5. **Galeri Önceliği**: Varyasyon kombinasyonlarında, önce kombinasyonun kendi galerisi, yoksa ürünün galerisi kullanılır.

6. **Kategori ve Tag İlişkileri**: Ürünler birden fazla kategori ve tag'e sahip olabilir.

7. **SEO Ayarları**: Her ürün için `seoTitle`, `seoDescription`, `seoKeywords` alanları bulunur.

8. **Bundle Ürünler**: Bundle ürünlerde, `bundleItems` ile paket içeriği tanımlanır.

---

## Örnek Kullanımlar

### Basit Ürün Oluşturma

```typescript
const product = await fetch('http://localhost:3000/products', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'SIMPLE',
    name: 'Basit Ürün',
    slug: 'basit-urun',
    description: 'Açıklama',
    basePrice: 100.00,
    sku: 'SKU-001',
    isActive: true,
    categoryIds: ['category-uuid'],
    tagIds: ['tag-uuid']
  })
});
```

### Varyasyonlu Ürün Oluşturma

```typescript
// 1. Varyasyonlu ürün oluştur
const product = await fetch('http://localhost:3000/products', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'VARIANT',
    name: 'Varyasyonlu Ürün',
    slug: 'varyasyonlu-urun',
    basePrice: 100.00,
    isActive: true
  })
});

// 2. Varyasyon seçeneği oluştur (Renk)
const colorOption = await fetch(`http://localhost:3000/products/${product.id}/variant-options`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Renk',
    type: 'COLOR',
    isRequired: true
  })
});

// 3. Varyasyon değerleri oluştur
await fetch(`http://localhost:3000/products/variant-options/${colorOption.id}/variant-values`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    value: 'Kırmızı',
    colorCode: '#FF0000',
    priceDelta: 10.00
  })
});

// 4. Kombinasyonları otomatik oluştur
await fetch(`http://localhost:3000/products/${product.id}/variant-combinations/generate`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});
```

---

## Entity Yapıları

### Product Entity

```typescript
{
  id: string;
  type: 'SIMPLE' | 'VARIANT' | 'BUNDLE';
  name: string;
  subtitle: string | null;
  slug: string; // unique
  description: string;
  basePrice: number;
  sku: string | null; // unique (SIMPLE için)
  isActive: boolean;
  isFeatured: boolean;
  isOnSale: boolean;
  discountedPrice: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[] | null;
  categories: Category[];
  tags: Tag[];
  galleries: ProductGallery[];
  variantOptions: VariantOption[];
  variantCombinations: VariantCombination[];
  bundleItems: BundleItem[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Hata Yönetimi

### 404 Not Found
- Ürün bulunamadı
- Varyasyon seçeneği/değeri bulunamadı
- Galeri bulunamadı

### 409 Conflict
- SKU zaten kullanılıyor
- Slug zaten kullanılıyor

### 400 Bad Request
- Geçersiz veri formatı
- Eksik zorunlu alanlar
- Geçersiz varyasyon kombinasyonu

### 403 Forbidden
- ADMIN rolü gerekli
