# Folder Module Documentation

## Genel Bakış

Folder modülü, dosya klasörlerinin hiyerarşik yönetimini sağlar. Klasörler parent-child ilişkisi ile tree yapısında organize edilir.

## Endpoint'ler

### 1. Klasör Oluştur

**POST** `/folders`

**Authentication**: ADMIN rolü gerekli

**Request Body**: `CreateFolderDto`

```json
{
  "name": "Ürün Resimleri",
  "parentId": null
}
```

**Response (201 Created)**: `Folder` entity

---

### 2. Klasörleri Listele

**GET** `/folders`

**Authentication**: ADMIN rolü gerekli

**Response (200 OK)**: `Folder[]` array

---

### 3. Klasörleri Tree Yapısında Listele

**GET** `/folders/tree`

**Authentication**: ADMIN rolü gerekli

**Response (200 OK)**: Hiyerarşik tree yapısında `Folder[]` array

---

### 4. Klasör Detayı

**GET** `/folders/:id`

**Authentication**: ADMIN rolü gerekli

**Response (200 OK)**: `Folder` entity

---

### 5. Klasör Güncelle

**PATCH** `/folders/:id`

**Authentication**: ADMIN rolü gerekli

**Request Body**: `UpdateFolderDto`

```json
{
  "name": "Yeni Klasör Adı",
  "parentId": "uuid"
}
```

**Response (200 OK)**: Güncellenmiş `Folder` entity

---

### 6. Klasör Sil

**DELETE** `/folders/:id`

**Authentication**: ADMIN rolü gerekli

**Response (200 OK)**: `{ message: "Klasör başarıyla silindi" }`

---

### 7. Klasörü Recursive Sil

**DELETE** `/folders/:id/recursive`

**Authentication**: ADMIN rolü gerekli

**Response (200 OK)**: `{ message: "Klasör ve alt klasörleri başarıyla silindi" }`

**DİKKAT**: Alt klasörler ve içindeki dosyalar da silinir.

---

## Önemli Notlar

1. **Hiyerarşik Yapı**: Klasörler parent-child ilişkisi ile tree yapısında organize edilir.
2. **Recursive Delete**: Klasör silinirken alt klasörler ve dosyalar da silinir.
3. **Kullanıcı İlişkisi**: Klasörler kullanıcı ile ilişkilendirilir (createdBy).
