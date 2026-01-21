# Store Modülü Kullanım Kılavuzu

Bu dokümantasyon, Store modülünün nasıl çalıştığını, endpoint'lerini ve özelliklerini açıklar. Her değişiklikte bu dosya güncellenmelidir.

## Genel Bakış

Store modülü, e-ticaret mağazası için public (kimlik doğrulama gerektirmeyen) endpoint'ler sağlar. Bu modül, müşterilerin ürünleri görüntülemesi, filtrelemesi, sıralaması ve detaylarını incelemesi için tasarlanmıştır.

## Modül Yapısı

```
backend/src/store/
├── dto/
│   ├── store-product-query.dto.ts          # Ürün listesi query parametreleri
│   ├── store-product-response.dto.ts       # Ürün listesi response DTO'ları
│   └── store-product-detail-response.dto.ts # Ürün detay response DTO'ları
├── store.controller.ts                      # Store controller (endpoint'ler)
├── store.service.ts                         # Store service (iş mantığı)
├── store.module.ts                          # Store module (bağımlılıklar)
└── STORE_MODULE_GUIDE.md                   # Bu dokümantasyon
```

## Endpoint'ler

### 1. Ürün Listesi

**GET** `/store/products`

Mağaza için ürünleri getirir. Basit ürünler ve varyasyonlu ürünlerin aktif kombinasyonları ayrı ürünler olarak döner.

#### Query Parametreleri

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `search` | string | Hayır | Arama terimi (ürün adı, açıklama) |
| `categorySlugs` | string | Hayır | Kategori slug filtreleri (virgülle ayrılmış: `slug1,slug2,slug3`) |
| `tagSlugs` | string | Hayır | Tag slug filtreleri (virgülle ayrılmış: `slug1,slug2,slug3`) |
| `minPrice` | number | Hayır | Minimum fiyat filtresi (final fiyat üzerinden) |
| `maxPrice` | number | Hayır | Maksimum fiyat filtresi (final fiyat üzerinden) |
| `orderBy` | enum | Hayır | Sıralama (varsayılan: `created_at_desc`) |
| `page` | number | Hayır | Sayfa numarası (varsayılan: 1) |
| `limit` | number | Hayır | Sayfa başına kayıt sayısı (varsayılan: 20, max: 100) |

#### Sıralama Seçenekleri (`orderBy`)

- `price_asc`: Fiyata göre artan
- `price_desc`: Fiyata göre azalan
- `name_asc`: İsme göre artan
- `name_desc`: İsme göre azalan
- `created_at_asc`: Oluşturulma tarihine göre artan
- `created_at_desc`: Oluşturulma tarihine göre azalan (varsayılan)

#### Önemli Notlar

1. **Varyasyon Kombinasyonları**: Varyasyonlu ürünlerde, her aktif ve seçilebilir kombinasyon ayrı bir ürün olarak listelenir. Örneğin, "Kırmızı-L" ve "Mavi-M" kombinasyonları iki ayrı ürün olarak görünür.

2. **Kategori ve Tag Filtreleme**: 
   - Kategori ve tag filtreleme **slug** bazlıdır (ID değil).
   - Birden fazla kategori/tag seçilebilir (virgülle ayrılmış).
   - Bir kategori seçildiğinde, tüm parent ve child kategorileri de otomatik olarak filtreye dahil edilir.

3. **Fiyat Hesaplama**: 
   - **Basit ürünler için**: 
     - `price`: Eğer `discountedPrice` varsa onu kullan, yoksa `basePrice` kullanılır
     - `basePrice`: Ürünün base fiyatı
     - `discountedPrice`: İndirimli fiyat (varsa)
   - **Varyasyon kombinasyonları için**: 
     - `price`: `(discountedPrice + priceDelta'lar)` veya `(basePrice + priceDelta'lar)`
     - `basePrice`: `basePrice + priceDelta'lar` (priceDelta'lar eklenmiş)
     - `discountedPrice`: `discountedPrice + priceDelta'lar` (varsa, priceDelta'lar eklenmiş)
   - Fiyat filtresi (`minPrice`, `maxPrice`), final fiyatlar (`price`) üzerinden çalışır.

4. **Stok Sıralaması**: Stokta olmayan ürünler (usableQuantity = 0) her zaman en sonda gelir, diğer sıralama kriterlerinden bağımsız olarak.

5. **Pagination**: Sonuçlar pagination ile döner. `total`, `page`, `limit`, `totalPages` bilgileri response'da bulunur.

#### Response Örneği

```json
{
  "products": [
    {
      "id": "uuid",
      "productId": "uuid",
      "variantCombinationId": null,
      "name": "Ürün Adı",
      "subtitle": "Ürün alt başlığı",
      "slug": "urun-adi",
      "description": "Ürün açıklaması",
      "price": 80.00,
      "basePrice": 100.00,
      "isOnSale": true,
      "discountedPrice": 80.00,
      "sku": "SKU-001",
      "stock": {
        "availableQuantity": 10,
        "reservedQuantity": 2,
        "usableQuantity": 8
      },
      "gallery": {
        "mainImage": { ... },
        "thumbnailImage": { ... },
        "detailImages": [ ... ]
      },
      "categories": [ ... ],
      "tags": [ ... ],
      "seoTitle": "...",
      "seoDescription": "...",
      "seoKeywords": [ ... ],
      "variantValues": [],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

---

### 2. Ürün Detayı

**GET** `/store/products/:id`

Ürün detayını getirir. Basit ürünler için direkt detay, varyasyonlu ürünler için varyasyon seçenekleri ve kombinasyonlar döner.

#### Path Parametreleri

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `id` | string | Evet | Ürün ID |

#### Query Parametreleri

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `variantCombinationId` | string | Hayır | Varyasyon kombinasyonu ID (opsiyonel) |

#### Önemli Notlar

1. **Basit Ürünler**: 
   - `type: "SIMPLE"`
   - `price`, `sku`, `stock` alanları dolu
   - `variantOptions`, `variantCombinations`, `selectedCombination` alanları `null`

2. **Varyasyonlu Ürünler**:
   - `type: "VARIANT"`
   - `price`, `sku`, `stock` alanları `null` (kombinasyon bazında)
   - `variantOptions`: Tüm varyasyon seçenekleri (Color, Size, vb.)
   - `variantCombinations`: Tüm aktif ve seçilebilir kombinasyonlar
   - `selectedCombination`: Eğer `variantCombinationId` query param verilmişse, seçili kombinasyon

3. **Varyasyon Seçimi**: Frontend'de kullanıcı varyasyon seçeneklerini değiştirdiğinde, ilgili kombinasyonu bulup `variantCombinationId` ile tekrar istek atabilir.

#### Response Örneği (Basit Ürün)

```json
{
  "productId": "uuid",
  "name": "Basit Ürün",
  "subtitle": "Ürün alt başlığı",
  "slug": "basit-urun",
  "description": "...",
  "basePrice": 100.00,
  "isOnSale": true,
  "discountedPrice": 80.00,
  "type": "SIMPLE",
  "price": 80.00,
  "sku": "SKU-001",
  "stock": {
    "availableQuantity": 10,
    "reservedQuantity": 2,
    "usableQuantity": 8
  },
  "gallery": { ... },
  "categories": [ ... ],
  "tags": [ ... ],
  "variantOptions": null,
  "variantCombinations": null,
  "selectedCombination": null,
  ...
}
```

#### Response Örneği (Varyasyonlu Ürün)

```json
{
  "productId": "uuid",
  "name": "Varyasyonlu Ürün",
  "subtitle": "Ürün alt başlığı",
  "slug": "varyasyonlu-urun",
  "description": "...",
  "basePrice": 100.00,
  "isOnSale": true,
  "discountedPrice": 80.00,
  "type": "VARIANT",
  "price": null,
  "sku": null,
  "stock": null,
  "gallery": { ... },
  "categories": [ ... ],
  "tags": [ ... ],
  "variantOptions": [
    {
      "id": "uuid",
      "name": "Renk",
      "type": "COLOR",
      "displayOrder": 0,
      "isRequired": true,
      "values": [
        {
          "id": "uuid",
          "value": "Kırmızı",
          "colorCode": "#FF0000",
          "priceDelta": 10.00,
          "isActive": true,
          "displayOrder": 0
        }
      ]
    }
  ],
  "variantCombinations": [
    {
      "id": "uuid",
      "sku": "SKU-001",
      "isActive": true,
      "isDisabled": false,
      "price": 95.00,
      "basePrice": 110.00,
      "discountedPrice": 95.00,
      "stock": { ... },
      "gallery": { ... },
      "variantValues": [ ... ]
    }
  ],
  "selectedCombination": { ... },
  ...
}
```

---

### 3. Kategoriler

**GET** `/store/categories`

Kategorileri hiyerarşik ve orderlanmış şekilde getirir.

#### Önemli Notlar

1. **Hiyerarşik Yapı**: Kategoriler parent-child ilişkisi ile tree yapısında döner.
2. **Sıralama**: `displayOrder` ve `createdAt` alanlarına göre sıralanır.
3. **Aktif Kategoriler**: Sadece `isActive: true` olan kategoriler döner.

#### Response Örneği

```json
[
  {
    "id": "uuid",
    "name": "Elektronik",
    "slug": "elektronik",
    "description": "...",
    "parentId": null,
    "parent": null,
    "children": [
      {
        "id": "uuid",
        "name": "Telefon",
        "slug": "telefon",
        "parentId": "uuid",
        "parent": { ... },
        "children": []
      }
    ],
    "image": { ... },
    "isActive": true,
    "displayOrder": 0,
    ...
  }
]
```

---

### 4. Tag'ler

**GET** `/store/tags`

Tag'leri renkleriyle birlikte getirir.

#### Önemli Notlar

1. **Renk Bilgisi**: Her tag'in `color` alanı (hex format) bulunur.
2. **Sıralama**: `createdAt` alanına göre azalan sırada döner.

#### Response Örneği

```json
[
  {
    "id": "uuid",
    "name": "Yeni Ürün",
    "slug": "yeni-urun",
    "description": "...",
    "color": "#FF5733",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

## Fiyat Hesaplama Mantığı

### Basit Ürünler

```
if (isOnSale && discountedPrice != null) {
  price = discountedPrice
} else {
  price = basePrice
}
```

**Örnek:**
- `basePrice = 100`
- `discountedPrice = 80` (isOnSale = true)
- `price = 80`
- `basePrice = 100` (değişmez)
- `discountedPrice = 80` (değişmez)

### Varyasyon Kombinasyonları

**Önemli**: Varyasyon kombinasyonlarında `priceDelta`'lar hem `basePrice` hem de `discountedPrice`'a eklenir.

```
totalPriceDelta = sum(variantValues.priceDelta)

// basePrice hesaplama
basePrice = product.basePrice + totalPriceDelta

// discountedPrice hesaplama (varsa)
discountedPrice = product.discountedPrice + totalPriceDelta

// Final price hesaplama
if (isOnSale && discountedPrice != null) {
  price = discountedPrice  // (zaten priceDelta'lar eklenmiş)
} else {
  price = basePrice  // (zaten priceDelta'lar eklenmiş)
}
```

**Örnek:**
- `product.basePrice = 100`
- `product.discountedPrice = 80` (isOnSale = true)
- `priceDelta'lar = [10, 5]` (toplam: 15)
- **Sonuç:**
  - `basePrice = 100 + 15 = 115`
  - `discountedPrice = 80 + 15 = 95`
  - `price = 95` (discountedPrice kullanıldı)

**Not**: API'den dönen tüm fiyatlar (`price`, `basePrice`, `discountedPrice`) `priceDelta`'lar eklenmiş halde gelir.

---

## Stok Yönetimi

### Stok Bilgisi

Her ürün/kombinasyon için stok bilgisi:

```typescript
{
  availableQuantity: number;  // Mevcut stok
  reservedQuantity: number;   // Rezerve edilmiş stok
  usableQuantity: number;    // Kullanılabilir stok (availableQuantity - reservedQuantity)
}
```

### Stok Sıralaması

- Stokta olan ürünler (`usableQuantity > 0`) her zaman önce gelir.
- Stokta olmayan ürünler (`usableQuantity = 0`) her zaman en sonda gelir.
- Bu kural, diğer sıralama kriterlerinden bağımsızdır.

---

## Galeri Yönetimi

### Basit Ürünler

- Ürünün kendi galerisi kullanılır.

### Varyasyon Kombinasyonları

1. **Öncelik 1**: Kombinasyonun kendi galerisi varsa onu kullan.
2. **Öncelik 2**: Kombinasyonun galerisi yoksa, product'ın galerisini kullan.

### Galeri Yapısı

```typescript
{
  mainImage: { id, s3Url, displayName, filename } | null;
  thumbnailImage: { id, s3Url, displayName, filename } | null;
  detailImages: Array<{ id, s3Url, displayName, filename }>;
}
```

---

## SEO Ayarları

Her ürün için SEO bilgileri:

- `seoTitle`: SEO başlığı
- `seoDescription`: SEO açıklaması
- `seoKeywords`: SEO anahtar kelimeleri (array)

**Not**: Varyasyon kombinasyonları, parent product'ın SEO ayarlarını miras alır.

---

## Yetkilendirme

Tüm Store endpoint'leri **PUBLIC**'tir. Authentication gerektirmez.

Endpoint roles config'de:
```typescript
'GET /store/products': [],
'GET /store/products/:id': [],
'GET /store/categories': [],
'GET /store/tags': [],
```

Boş array (`[]`) = Public endpoint, kimlik doğrulama gerektirmez.

---

## Hata Yönetimi

### 404 Not Found

- Ürün bulunamadığında: `GET /store/products/:id`

### 400 Bad Request

- Geçersiz query parametreleri
- Geçersiz fiyat aralığı

---

## Performans Notları

1. **Pagination**: Büyük veri setlerinde pagination kullanılmalıdır.
2. **Filtreleme**: Filtreler database seviyesinde uygulanır (TypeORM QueryBuilder).
3. **Eager Loading**: Gerekli relation'lar eager loading ile yüklenir.
4. **Sıralama**: Memory'de yapılır (küçük veri setleri için uygun).

---

## Güncelleme Notları

### 2024-01-XX - Slug Bazlı Filtreleme ve Fiyat Hesaplama Güncellemesi
- Kategori ve tag filtreleme slug bazlı hale getirildi (`categorySlugs`, `tagSlugs`)
- Hiyerarşik kategori filtreleme eklendi (parent/child otomatik dahil)
- Varyasyon kombinasyonları için fiyat hesaplama güncellendi:
  - `basePrice` ve `discountedPrice`'a `priceDelta`'lar eklendi
  - API'den dönen tüm fiyatlar `priceDelta`'lar eklenmiş halde
- `subtitle` alanı ürünlere eklendi
- `StoreVariantCombinationDto`'ya `basePrice` ve `discountedPrice` alanları eklendi

### 2024-01-XX - İlk Versiyon
- Store modülü oluşturuldu
- Ürün listesi endpoint'i eklendi
- Ürün detay endpoint'i eklendi
- Kategori endpoint'i eklendi
- Tag endpoint'i eklendi

---

## Gelecek Geliştirmeler

- [ ] Cache mekanizması eklenebilir
- [ ] Elasticsearch entegrasyonu
- [ ] Gelişmiş arama özellikleri
- [ ] Ürün karşılaştırma
- [ ] Favori ürünler
- [ ] Ürün yorumları ve puanları

---

## İletişim ve Destek

Sorularınız için: [Proje ekibi]
