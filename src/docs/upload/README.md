# Upload Module Documentation

## Genel Bakış

Upload modülü, dosya yükleme ve yönetimini sağlar. Dosyalar S3'e yüklenir ve klasör yapısında organize edilir.

## Endpoint'ler

### 1. Dosya Yükle

**POST** `/uploads`

**Authentication**: ADMIN rolü gerekli

**Request**: `multipart/form-data`

**Form Data**:
- `file`: Yüklenecek dosya (binary)
- `displayName` (optional): Görünen isim
- `folderId` (optional): Klasör ID

**Response (201 Created)**: `Upload` entity

```json
{
  "id": "uuid",
  "filename": "image.jpg",
  "displayName": "Ürün Resmi",
  "mimeType": "image/jpeg",
  "size": 1024000,
  "s3Url": "https://s3.amazonaws.com/...",
  "folderId": "uuid",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 2. Dosyaları Listele

**GET** `/uploads`

**Authentication**: ADMIN rolü gerekli

**Response (200 OK)**: `Upload[]` array

---

### 3. Klasördeki Dosyaları Listele

**GET** `/uploads/folder/:id`

**Authentication**: ADMIN rolü gerekli

**Response (200 OK)**: `Upload[]` array

---

### 4. Dosya Detayı

**GET** `/uploads/:id`

**Authentication**: ADMIN rolü gerekli

**Response (200 OK)**: `Upload` entity

---

### 5. Dosya İndirme URL'i

**GET** `/uploads/:id/download`

**Authentication**: ADMIN rolü gerekli

**Response (200 OK)**: `{ downloadUrl: "https://..." }`

---

### 6. Dosya Güncelle

**PATCH** `/uploads/:id`

**Authentication**: ADMIN rolü gerekli

**Request Body**: `UpdateUploadDto`

```json
{
  "displayName": "Yeni İsim"
}
```

**Response (200 OK)**: Güncellenmiş `Upload` entity

---

### 7. Dosya Sil

**DELETE** `/uploads/:id`

**Authentication**: ADMIN rolü gerekli

**Response (200 OK)**: `{ message: "Dosya başarıyla silindi" }`

---

## Önemli Notlar

1. **S3 Storage**: Dosyalar AWS S3'e yüklenir.
2. **MIME Type**: Dosya tipi otomatik olarak algılanır.
3. **Klasör Organizasyonu**: Dosyalar klasörlerde organize edilebilir.
4. **URL**: Yüklenen dosyalar için S3 URL'i döner.
