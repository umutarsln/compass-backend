# Category Module Documentation

## Genel Bakış

Category modülü, ürün kategorilerinin hiyerarşik yönetimini sağlar. Kategoriler parent-child ilişkisi ile tree yapısında organize edilir.

## Endpoint'ler

### 1. Kategori Oluştur

**POST** `/categories`

**Authentication**: ADMIN rolü gerekli

**Request Body**: `CreateCategoryDto`

```json
{
  "name": "Elektronik",
  "slug": "elektronik",
  "description": "Elektronik ürünler",
  "parentId": null,
  "imageId": "uuid",
  "isActive": true,
  "displayOrder": 0
}
```

**Response (201 Created)**: `Category` entity

---

### 2. Kategorileri Listele

**GET** `/categories`

**Authentication**: Public

**Response (200 OK)**: `Category[]` array

---

### 3. Kategorileri Tree Yapısında Listele

**GET** `/categories/tree`

**Authentication**: Public

**Response (200 OK)**: Hiyerarşik tree yapısında `Category[]` array

---

### 4. Kategori Detayı

**GET** `/categories/:id`

**Authentication**: Public

**Response (200 OK)**: `Category` entity

---

### 5. Kategori Güncelle

**PATCH** `/categories/:id`

**Authentication**: ADMIN rolü gerekli

**Request Body**: `UpdateCategoryDto` (tüm alanlar optional)

**Response (200 OK)**: Güncellenmiş `Category` entity

---

### 6. Kategori Sil

**DELETE** `/categories/:id`

**Authentication**: ADMIN rolü gerekli

**Response (200 OK)**: `{ message: "Kategori başarıyla silindi" }`

**Hata**: Alt kategori varsa 409 Conflict döner

---

## Önemli Notlar

1. **Hiyerarşik Yapı**: Kategoriler parent-child ilişkisi ile tree yapısında organize edilir.
2. **Slug Uniqueness**: Slug unique olmalıdır.
3. **Alt Kategori Kontrolü**: Alt kategorisi olan kategori silinemez.
4. **Display Order**: Kategoriler `displayOrder` alanına göre sıralanır.
