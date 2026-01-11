# Stock Modülü Kullanım Kılavuzu

## Genel Bakış

Stock modülü, stok yönetimi için kullanılır. Polymorphic yapı kullanır, yani farklı tip sellable unit'ler (Product, VariantCombination, Bundle) için stok takibi yapılabilir.

## Özellikler

- **Polymorphic Yapı**: Farklı tip sellable unit'ler için stok takibi
- **Rezervasyon Sistemi**: Sipariş için stok rezerve edilebilir
- **Düşük Stok Uyarısı**: Low stock threshold ile uyarı sistemi
- **Stok Hareketleri**: Artırma, azaltma, rezerve etme, serbest bırakma

## Sellable Types

- `PRODUCT`: Simple product'lar için
- `VARIANT_COMBINATION`: Variant product combination'ları için
- `BUNDLE`: Bundle product'lar için

## Endpoint'ler

### 1. Stok Bilgisi Getir

**GET** `/stock/:sellableType/:sellableId`

Belirli bir sellable unit'in stok bilgisini getirir.

**Path Parameters:**
- `sellableType`: PRODUCT, VARIANT_COMBINATION, veya BUNDLE
- `sellableId`: Sellable unit'in UUID'si

**Response (200):**
```json
{
  "id": "uuid",
  "sellableType": "PRODUCT",
  "sellableId": "uuid",
  "availableQuantity": 100,
  "reservedQuantity": 5,
  "lowStockThreshold": 10,
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Yetkilendirme:** ADMIN

### 2. Stok Güncelle

**PATCH** `/stock/:sellableType/:sellableId`

Stok miktarını günceller.

**Request Body:**
```json
{
  "availableQuantity": 150,
  "lowStockThreshold": 15
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "availableQuantity": 150,
  "reservedQuantity": 5,
  "lowStockThreshold": 15,
  ...
}
```

**Yetkilendirme:** ADMIN

### 3. Stok Rezerve Et

**POST** `/stock/reserve`

Sipariş için stok rezerve eder.

**Request Body:**
```json
{
  "sellableType": "PRODUCT",
  "sellableId": "uuid",
  "quantity": 5
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "availableQuantity": 100,
  "reservedQuantity": 10,
  ...
}
```

**Yetkilendirme:** ADMIN

**Hata Durumları:**
- Yetersiz stok: 400 Bad Request

### 4. Rezerve Edilmiş Stoku Serbest Bırak

**POST** `/stock/release`

Rezerve edilmiş stoku serbest bırakır (sipariş iptal durumunda).

**Request Body:**
```json
{
  "sellableType": "PRODUCT",
  "sellableId": "uuid",
  "quantity": 5
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "availableQuantity": 100,
  "reservedQuantity": 0,
  ...
}
```

**Yetkilendirme:** ADMIN

**Hata Durumları:**
- Rezerve edilmiş stok yetersiz: 400 Bad Request

## Stok Hesaplama

- **Mevcut Stok**: `availableQuantity - reservedQuantity`
- **Toplam Stok**: `availableQuantity`
- **Rezerve Edilmiş**: `reservedQuantity`

## Önemli Notlar

- Stok kaydı yoksa otomatik oluşturulur (findOrCreate)
- Rezerve edilmiş stok, mevcut stoktan düşülür
- Sipariş tamamlandığında `commit` metodu kullanılmalı (reservedQuantity ve availableQuantity azaltılır)
- Low stock threshold, stok uyarıları için kullanılır
