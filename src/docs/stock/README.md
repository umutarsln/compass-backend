# Stock Module Documentation

## Genel Bakış

Stock modülü, stok yönetimini sağlar. Basit ürünler ve varyasyon kombinasyonları için stok takibi yapılır.

## Endpoint'ler

### 1. Stok Bilgisi Getir

**GET** `/stock/:sellableType/:sellableId`

**Authentication**: ADMIN rolü gerekli

**Path Parameters**:
- `sellableType`: `PRODUCT` veya `VARIANT_COMBINATION`
- `sellableId`: Product ID veya VariantCombination ID

**Response (200 OK)**: `Stock` entity

```json
{
  "id": "uuid",
  "sellableType": "PRODUCT",
  "sellableId": "uuid",
  "availableQuantity": 100,
  "reservedQuantity": 10,
  "usableQuantity": 90
}
```

---

### 2. Stok Güncelle

**PATCH** `/stock/:sellableType/:sellableId`

**Authentication**: ADMIN rolü gerekli

**Request Body**: `UpdateStockDto`

```json
{
  "availableQuantity": 150
}
```

**Response (200 OK)**: Güncellenmiş `Stock` entity

---

### 3. Stok Rezerve Et

**POST** `/stock/reserve`

**Authentication**: ADMIN rolü gerekli

**Request Body**: `ReserveStockDto`

```json
{
  "sellableType": "PRODUCT",
  "sellableId": "uuid",
  "quantity": 5
}
```

**Response (200 OK)**: Güncellenmiş `Stock` entity

**Hata**: Yetersiz stok varsa 400 Bad Request

---

### 4. Rezerve Edilmiş Stoku Serbest Bırak

**POST** `/stock/release`

**Authentication**: ADMIN rolü gerekli

**Request Body**: `ReleaseStockDto`

```json
{
  "sellableType": "PRODUCT",
  "sellableId": "uuid",
  "quantity": 5
}
```

**Response (200 OK)**: Güncellenmiş `Stock` entity

---

## Önemli Notlar

1. **Usable Quantity**: `availableQuantity - reservedQuantity` formülü ile hesaplanır.
2. **Stok Rezervasyonu**: Sepete ekleme sırasında stok rezerve edilir.
3. **Stok Serbest Bırakma**: Sipariş iptal edildiğinde veya ödeme başarısız olduğunda stok serbest bırakılır.
4. **Sellable Types**: `PRODUCT` (basit ürünler) ve `VARIANT_COMBINATION` (varyasyon kombinasyonları) desteklenir.
