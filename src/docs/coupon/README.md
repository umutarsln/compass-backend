# Coupon Module Documentation

## Genel Bakış

Coupon modülü, e-ticaret sitesinde kupon (indirim kodu) yönetimini sağlar. Sadece **ADMIN** rolüne sahip kullanıcılar kupon oluşturabilir, güncelleyebilir, listeler ve silebilir. Müşteriler sepete **tek bir kupon** uygulayabilir; sipariş oluşturulurken kupon **tekrar doğrulanır**, ödeme başarılı olduğunda kupon **kullanım adedi** artırılır.

## Module Yapısı

```
backend/src/coupon/
├── coupon.entity.ts              # Coupon entity
├── coupon.service.ts             # Kupon iş mantığı (CRUD, validateForCart, incrementUsage)
├── coupon.controller.ts         # Admin endpoint'leri
├── coupon.module.ts              # Modül tanımı
└── dto/
    ├── create-coupon.dto.ts      # Kupon oluşturma isteği
    ├── update-coupon.dto.ts      # Kupon güncelleme isteği
    ├── apply-coupon.dto.ts       # Sepete kupon uygulama isteği (Cart tarafında kullanılır)
    └── coupon-response.dto.ts    # Kupon cevap DTO
```

## Kupon Türleri (CouponType)

| Değer | Açıklama |
|-------|----------|
| `PERCENTAGE` | Yüzdelik indirim. `discountValue` 0–100 arası; indirim sepet ara toplamı (subtotal) üzerinden hesaplanır. |
| `FIXED` | Sabit TL indirim. `discountValue` TL cinsinden; indirim tutarı bu değeri geçemez (subtotal’dan fazla indirim yapılmaz). |

## DTO Alanları

### CreateCouponDto (Kupon oluşturma)

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `code` | string | Evet | Kupon kodu. Benzersiz olmalıdır; kayıt sırasında büyük harfe çevrilir. |
| `name` | string | Evet | Kupon adı (gösterim için). |
| `description` | string | Hayır | Açıklama. |
| `type` | enum | Evet | `PERCENTAGE` veya `FIXED`. |
| `discountValue` | number | Evet | İndirim değeri. PERCENTAGE için 0–100, FIXED için TL (≥ 0). |
| `usageLimit` | number | Hayır | Maksimum kullanım sayısı. Verilmezse sınırsız. En az 1. |
| `minOrderAmount` | number | Hayır | Minimum sepet tutarı (TL). Bu tutarın altındaki sepetlere uygulanmaz. |
| `validFrom` | Date (ISO 8601) | Hayır | Geçerlilik başlangıç tarihi. |
| `validTo` | Date (ISO 8601) | Hayır | Geçerlilik bitiş tarihi. |

### UpdateCouponDto (Kupon güncelleme)

Tüm alanlar **opsiyonel**. Sadece gönderilen alanlar güncellenir.

| Alan | Tip | Açıklama |
|------|-----|----------|
| `code` | string | Kupon kodu (benzersiz kalmalı). |
| `name` | string | Kupon adı. |
| `description` | string | Açıklama. |
| `type` | enum | `PERCENTAGE` veya `FIXED`. |
| `discountValue` | number | İndirim değeri (≥ 0). |
| `usageLimit` | number \| null | Maksimum kullanım; `null` = sınırsız. |
| `minOrderAmount` | number \| null | Minimum sepet tutarı (TL); `null` = kısıt yok. |
| `validFrom` | Date \| null | Geçerlilik başlangıç; `null` = kısıt yok. |
| `validTo` | Date \| null | Geçerlilik bitiş; `null` = kısıt yok. |

### ApplyCouponDto (Sepete kupon uygulama)

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `code` | string | Evet | Uygulanacak kupon kodu. |

### CouponResponseDto (Cevap)

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | string (UUID) | Kupon ID. |
| `code` | string | Kupon kodu. |
| `name` | string | Kupon adı. |
| `description` | string \| null | Açıklama. |
| `type` | CouponType | PERCENTAGE veya FIXED. |
| `discountValue` | number | İndirim değeri. |
| `usageCount` | number | Toplam kullanım sayısı (sadece okunur). |
| `usageLimit` | number \| null | Maksimum kullanım; null = sınırsız. |
| `minOrderAmount` | number \| null | Minimum sepet tutarı (TL). |
| `validFrom` | Date \| null | Geçerlilik başlangıç. |
| `validTo` | Date \| null | Geçerlilik bitiş. |
| `createdAt` | Date | Oluşturulma tarihi. |
| `updatedAt` | Date | Güncellenme tarihi. |

---

## Admin Endpoint'ler

Tüm admin endpoint'leri **ADMIN** rolü ve **JWT Bearer** token gerektirir.

### 1. Kupon Oluştur

**POST** `/coupons`

Yeni kupon oluşturur.

#### Request Body

`CreateCouponDto` (yukarıdaki tabloya bakın).

#### Örnek İstek

```json
{
  "code": "HOSGELDIN20",
  "name": "Hoş geldin indirimi",
  "description": "İlk alışverişte %20 indirim",
  "type": "PERCENTAGE",
  "discountValue": 20,
  "usageLimit": 100,
  "minOrderAmount": 100,
  "validFrom": "2024-01-01T00:00:00.000Z",
  "validTo": "2024-12-31T23:59:59.000Z"
}
```

#### Response (201 Created)

`CouponResponseDto` (id, code, name, type, discountValue, usageCount, usageLimit, minOrderAmount, validFrom, validTo, createdAt, updatedAt).

#### Hata Durumları

- **400 Bad Request**: Yüzdelik indirim 0–100 dışında; sabit indirim negatif; veya geçersiz veri.
- **409 Conflict**: Bu kupon kodu zaten mevcut.

---

### 2. Kuponları Listele

**GET** `/coupons`

Tüm kuponları oluşturulma tarihine göre azalan sırada listeler.

#### Response (200 OK)

`CouponResponseDto[]` array.

---

### 3. Kupon Detayı

**GET** `/coupons/:id`

**Path Parametre**: `id` — Kupon UUID.

#### Response (200 OK)

Tekil `CouponResponseDto`.

#### Hata Durumları

- **404 Not Found**: Kupon bulunamadı.

---

### 4. Kupon Güncelle

**PATCH** `/coupons/:id`

**Path Parametre**: `id` — Kupon UUID.

Sadece gönderilen alanlar güncellenir. `UpdateCouponDto` kullanılır.

#### Örnek İstek

```json
{
  "usageLimit": 200,
  "validTo": "2025-06-30T23:59:59.000Z"
}
```

#### Response (200 OK)

Güncellenmiş `CouponResponseDto`.

#### Hata Durumları

- **400 Bad Request**: Yüzde 0–100 dışında veya geçersiz veri.
- **404 Not Found**: Kupon bulunamadı.
- **409 Conflict**: Yeni `code` başka bir kupon tarafından kullanılıyor.

---

### 5. Kupon Sil

**DELETE** `/coupons/:id`

**Path Parametre**: `id` — Kupon UUID.

#### Response (200 OK)

```json
{
  "message": "Kupon başarıyla silindi"
}
```

#### Hata Durumları

- **404 Not Found**: Kupon bulunamadı.

---

## Sepet Kupon Endpoint'leri (Cart)

Bu endpoint'ler **public**'tir (guest cart guard ile); kimlik doğrulama zorunlu değildir. Detaylar için [Cart Module Documentation](../cart/README.md) dosyasına bakın.

### Sepete Kupon Uygula

**POST** `/carts/:id/coupon`

**Path Parametre**: `id` — Sepet UUID.

#### Request Body

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `code` | string | Evet | Kupon kodu. |

Örnek: `{ "code": "HOSGELDIN20" }`

#### Response (200 OK)

Güncel `CartResponseDto`. İçinde `subtotal`, `discountAmount`, `total` ve `appliedCoupon` alanları bulunur.

#### Hata Durumları

- **400 Bad Request**: Geçersiz kupon kodu; kupon süresi dolmuş; kullanım limiti dolmuş; veya sepet tutarı minimum tutarın altında.
- **404 Not Found**: Sepet bulunamadı.

### Sepetten Kupon Kaldır

**DELETE** `/carts/:id/coupon`

**Path Parametre**: `id` — Sepet UUID.

#### Response (200 OK)

Güncel `CartResponseDto` (appliedCoupon null, discountAmount 0).

---

## İş Kuralları

1. **Tek kupon**: Her sepette en fazla **bir** kupon uygulanabilir. Yeni kupon uygulandığında önceki kuponun yerini alır.
2. **Kod benzersizliği**: Kupon kodu veritabanında benzersizdir; kayıt ve güncellemede büyük harfe çevrilir.
3. **Siparişte doğrulama**: Sipariş oluşturulurken sepetteki kupon **tekrar doğrulanır**. Geçersizse (süre, limit, min tutar) sipariş oluşturma **400 Bad Request** ile reddedilir.
4. **Kullanım adedi**: `usageCount` yalnızca **ödeme başarılı** olduktan sonra (payment callback) 1 artırılır.
5. **Yüzdelik kupon**: `type: PERCENTAGE` iken `discountValue` 0–100 arasında olmalıdır.
6. **Sabit indirim**: FIXED kuponlarda indirim tutarı sepet ara toplamını geçemez.

---

## Hata Yönetimi Özeti

| HTTP | Durum |
|------|--------|
| 400 | Geçersiz kupon, süre/limit/min tutar uyumsuz, veya hatalı istek verisi. |
| 404 | Kupon veya sepet bulunamadı. |
| 409 | Kupon kodu zaten kullanılıyor (create/update). |

---

## Örnek cURL (Admin)

```bash
# Kupon oluştur
curl -X POST http://localhost:3000/coupons \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "HOSGELDIN20",
    "name": "Hoş geldin indirimi",
    "type": "PERCENTAGE",
    "discountValue": 20,
    "minOrderAmount": 100
  }'

# Kuponları listele
curl -X GET http://localhost:3000/coupons \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Sepete kupon uygula (public)
curl -X POST http://localhost:3000/carts/CART_UUID/coupon \
  -H "Content-Type: application/json" \
  -d '{ "code": "HOSGELDIN20" }'
```
