# User Module Documentation

## Genel Bakış

User modülü, kullanıcı yönetimi işlemlerini yönetir. Kullanıcıların bilgilerini görüntüleme, güncelleme, silme ve admin yönetimi gibi işlemleri içerir. Admin kullanıcıları diğer kullanıcıları yönetebilir.

## Module Yapısı

```
backend/src/user/
├── user.controller.ts          # User endpoint'leri
├── user.service.ts             # User iş mantığı
├── user.module.ts              # User module tanımı
├── user.entity.ts              # User entity
└── dto/
    ├── create-user.dto.ts     # Kullanıcı oluşturma DTO
    ├── update-user.dto.ts     # Kullanıcı güncelleme DTO
    └── register.dto.ts         # Kayıt DTO (auth modülünde kullanılır)
```

## Endpoint'ler

### 1. Kullanıcı Bilgilerini Getir (Mevcut Kullanıcı)

**GET** `/users/me`

Authenticated kullanıcının kendi bilgilerini getirir.

#### Headers

| Header | Değer | Açıklama |
|--------|-------|----------|
| `Authorization` | `Bearer {accessToken}` | JWT access token |

#### Response (200 OK)

```json
{
  "id": "uuid",
  "firstname": "Ahmet",
  "lastname": "Yılmaz",
  "email": "ahmet@example.com",
  "phone": "+905551234567",
  "roles": ["USER"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Hata Durumları

- **401 Unauthorized**: Geçersiz veya eksik token

#### Örnek cURL

```bash
curl -X GET http://localhost:3000/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 2. Tüm Kullanıcıları Listele (Admin)

**GET** `/users`

Admin kullanıcılar tüm kullanıcıları listeler.

#### Headers

| Header | Değer | Açıklama |
|--------|-------|----------|
| `Authorization` | `Bearer {accessToken}` | JWT access token (ADMIN rolü gerekli) |

#### Response (200 OK)

```json
[
  {
    "id": "uuid",
    "firstname": "Ahmet",
    "lastname": "Yılmaz",
    "email": "ahmet@example.com",
    "phone": "+905551234567",
    "roles": ["USER"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "uuid",
    "firstname": "Admin",
    "lastname": "User",
    "email": "admin@example.com",
    "phone": "+905559876543",
    "roles": ["ADMIN"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Hata Durumları

- **401 Unauthorized**: Geçersiz veya eksik token
- **403 Forbidden**: ADMIN rolü gerekli

#### Örnek cURL

```bash
curl -X GET http://localhost:3000/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 3. Kullanıcı Detayı

**GET** `/users/:id`

Kullanıcı detayını getirir. Kullanıcılar kendi bilgilerini, admin'ler herkesin bilgilerini görebilir.

#### Path Parameters

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `id` | string (UUID) | Evet | Kullanıcı ID |

#### Headers

| Header | Değer | Açıklama |
|--------|-------|----------|
| `Authorization` | `Bearer {accessToken}` | JWT access token |

#### Response (200 OK)

```json
{
  "id": "uuid",
  "firstname": "Ahmet",
  "lastname": "Yılmaz",
  "email": "ahmet@example.com",
  "phone": "+905551234567",
  "roles": ["USER"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Hata Durumları

- **401 Unauthorized**: Geçersiz veya eksik token
- **403 Forbidden**: Kullanıcı başka bir kullanıcının bilgilerini görüntüleyemez (ADMIN değilse)
- **404 Not Found**: Kullanıcı bulunamadı

#### Örnek cURL

```bash
curl -X GET http://localhost:3000/users/uuid \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 4. Kullanıcı Güncelle

**PATCH** `/users/:id`

Kullanıcı bilgilerini günceller. Kullanıcılar kendi bilgilerini, admin'ler herkesin bilgilerini güncelleyebilir.

#### Path Parameters

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `id` | string (UUID) | Evet | Kullanıcı ID |

#### Request Body

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `firstname` | string | Hayır | Kullanıcı adı |
| `lastname` | string | Hayır | Kullanıcı soyadı |
| `email` | string | Hayır | Email adresi (unique olmalı) |
| `password` | string | Hayır | Şifre (minimum 6 karakter) |
| `phone` | string | Hayır | Telefon numarası (uluslararası format) |

#### Headers

| Header | Değer | Açıklama |
|--------|-------|----------|
| `Authorization` | `Bearer {accessToken}` | JWT access token |

#### Response (200 OK)

```json
{
  "id": "uuid",
  "firstname": "Ahmet",
  "lastname": "Yılmaz",
  "email": "ahmet@example.com",
  "phone": "+905551234567",
  "roles": ["USER"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Hata Durumları

- **401 Unauthorized**: Geçersiz veya eksik token
- **403 Forbidden**: Kullanıcı başka bir kullanıcının bilgilerini güncelleyemez (ADMIN değilse)
- **404 Not Found**: Kullanıcı bulunamadı
- **409 Conflict**: Email zaten kullanılıyor

#### Örnek cURL

```bash
curl -X PATCH http://localhost:3000/users/uuid \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "Mehmet",
    "phone": "+905559876543"
  }'
```

---

### 5. Kullanıcı Sil (Admin)

**DELETE** `/users/:id`

Kullanıcıyı siler. Sadece ADMIN rolüne sahip kullanıcılar kullanabilir.

#### Path Parameters

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `id` | string (UUID) | Evet | Kullanıcı ID |

#### Headers

| Header | Değer | Açıklama |
|--------|-------|----------|
| `Authorization` | `Bearer {accessToken}` | JWT access token (ADMIN rolü gerekli) |

#### Response (200 OK)

```json
{
  "message": "Kullanıcı başarıyla silindi"
}
```

#### Hata Durumları

- **401 Unauthorized**: Geçersiz veya eksik token
- **403 Forbidden**: ADMIN rolü gerekli
- **404 Not Found**: Kullanıcı bulunamadı

#### Örnek cURL

```bash
curl -X DELETE http://localhost:3000/users/uuid \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 6. Admin Listesi (Admin)

**GET** `/users/admins`

Tüm admin kullanıcılarını listeler.

#### Headers

| Header | Değer | Açıklama |
|--------|-------|----------|
| `Authorization` | `Bearer {accessToken}` | JWT access token (ADMIN rolü gerekli) |

#### Response (200 OK)

```json
[
  {
    "id": "uuid",
    "firstname": "Admin",
    "lastname": "User",
    "email": "admin@example.com",
    "phone": "+905559876543",
    "roles": ["ADMIN"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Hata Durumları

- **401 Unauthorized**: Geçersiz veya eksik token
- **403 Forbidden**: ADMIN rolü gerekli

---

### 7. Admin Oluştur (Admin)

**POST** `/users/admins`

Yeni admin kullanıcı oluşturur.

#### Request Body

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `firstname` | string | Evet | Kullanıcı adı |
| `lastname` | string | Evet | Kullanıcı soyadı |
| `email` | string | Evet | Email adresi (unique) |
| `password` | string | Evet | Şifre (minimum 6 karakter) |
| `phone` | string | Evet | Telefon numarası (uluslararası format) |

#### Headers

| Header | Değer | Açıklama |
|--------|-------|----------|
| `Authorization` | `Bearer {accessToken}` | JWT access token (ADMIN rolü gerekli) |

#### Response (201 Created)

```json
{
  "id": "uuid",
  "firstname": "Admin",
  "lastname": "User",
  "email": "admin@example.com",
  "phone": "+905559876543",
  "roles": ["ADMIN"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Hata Durumları

- **401 Unauthorized**: Geçersiz veya eksik token
- **403 Forbidden**: ADMIN rolü gerekli
- **409 Conflict**: Email zaten kullanılıyor

---

### 8. Admin Güncelle (Admin)

**PATCH** `/users/admins/:id`

Admin kullanıcı bilgilerini günceller.

#### Path Parameters

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `id` | string (UUID) | Evet | Admin kullanıcı ID |

#### Request Body

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `firstname` | string | Hayır | Kullanıcı adı |
| `lastname` | string | Hayır | Kullanıcı soyadı |
| `email` | string | Hayır | Email adresi |
| `password` | string | Hayır | Şifre |
| `phone` | string | Hayır | Telefon numarası |

#### Headers

| Header | Değer | Açıklama |
|--------|-------|----------|
| `Authorization` | `Bearer {accessToken}` | JWT access token (ADMIN rolü gerekli) |

#### Response (200 OK)

```json
{
  "id": "uuid",
  "firstname": "Admin",
  "lastname": "User",
  "email": "admin@example.com",
  "phone": "+905559876543",
  "roles": ["ADMIN"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 9. Admin Sil (Admin)

**DELETE** `/users/admins/:id`

Admin kullanıcıyı siler.

#### Path Parameters

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `id` | string (UUID) | Evet | Admin kullanıcı ID |

#### Headers

| Header | Değer | Açıklama |
|--------|-------|----------|
| `Authorization` | `Bearer {accessToken}` | JWT access token (ADMIN rolü gerekli) |

#### Response (200 OK)

```json
{
  "message": "Admin kullanıcı başarıyla silindi"
}
```

---

### 10. Müşteri Listesi (Admin)

**GET** `/users/customers`

Tüm müşteri (USER rolü) kullanıcılarını listeler.

#### Headers

| Header | Değer | Açıklama |
|--------|-------|----------|
| `Authorization` | `Bearer {accessToken}` | JWT access token (ADMIN rolü gerekli) |

#### Response (200 OK)

```json
[
  {
    "id": "uuid",
    "firstname": "Ahmet",
    "lastname": "Yılmaz",
    "email": "ahmet@example.com",
    "phone": "+905551234567",
    "roles": ["USER"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

## Authentication/Authorization

### Public Endpoints

Bu modülde public endpoint yoktur. Tüm endpoint'ler authentication gerektirir.

### Protected Endpoints

#### USER veya ADMIN Rolü Gerektiren Endpoint'ler

- `GET /users/me` - Kullanıcı kendi bilgilerini görebilir
- `GET /users/:id` - Kullanıcı kendi bilgilerini, admin herkesi görebilir
- `PATCH /users/:id` - Kullanıcı kendini, admin herkesi güncelleyebilir

#### Sadece ADMIN Rolü Gerektiren Endpoint'ler

- `GET /users` - Tüm kullanıcıları listele
- `DELETE /users/:id` - Kullanıcı sil
- `GET /users/admins` - Admin listesi
- `POST /users/admins` - Admin oluştur
- `PATCH /users/admins/:id` - Admin güncelle
- `DELETE /users/admins/:id` - Admin sil
- `GET /users/customers` - Müşteri listesi

---

## Önemli Notlar

1. **Password Hashing**: Şifreler bcrypt ile hash'lenir ve veritabanında düz metin olarak saklanmaz.

2. **Email Uniqueness**: Email adresi unique olmalıdır. Aynı email ile kullanıcı oluşturulamaz.

3. **Phone Validation**: Telefon numarası uluslararası format olmalıdır (örn: +905551234567).

4. **Role Management**: Kullanıcılar `USER` veya `ADMIN` rolüne sahip olabilir. Roller array olarak saklanır.

5. **Self-Service**: Kullanıcılar kendi bilgilerini görüntüleyebilir ve güncelleyebilir, ancak başka kullanıcıların bilgilerine erişemezler (ADMIN değilse).

6. **Password Update**: Şifre güncellenirken yeni şifre hash'lenir ve eski şifre ile değiştirilir.

7. **Soft Delete**: Kullanıcı silme işlemi hard delete'dir. Kullanıcı veritabanından tamamen silinir.

---

## Örnek Kullanımlar

### 1. Kullanıcı Bilgilerini Görüntüleme

```typescript
// Kullanıcı kendi bilgilerini getir
const response = await fetch('http://localhost:3000/users/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const user = await response.json();
console.log(user);
```

### 2. Kullanıcı Bilgilerini Güncelleme

```typescript
// Kullanıcı kendi bilgilerini güncelle
const response = await fetch('http://localhost:3000/users/me', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    firstname: 'Mehmet',
    phone: '+905559876543'
  })
});

const updatedUser = await response.json();
```

### 3. Admin: Tüm Kullanıcıları Listeleme

```typescript
// Admin tüm kullanıcıları listele
const response = await fetch('http://localhost:3000/users', {
  headers: {
    'Authorization': `Bearer ${adminAccessToken}`
  }
});

const users = await response.json();
```

### 4. Admin: Yeni Admin Oluşturma

```typescript
// Admin yeni admin oluştur
const response = await fetch('http://localhost:3000/users/admins', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminAccessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    firstname: 'Admin',
    lastname: 'User',
    email: 'admin@example.com',
    password: 'admin123',
    phone: '+905559876543'
  })
});

const newAdmin = await response.json();
```

---

## Entity Yapısı

### User Entity

```typescript
{
  id: string;              // UUID
  firstname: string;       // Kullanıcı adı
  lastname: string;         // Kullanıcı soyadı
  email: string;            // Email (unique)
  password: string;         // Hash'lenmiş şifre
  phone: string;            // Telefon (unique)
  roles: Role[];           // Roller array (USER, ADMIN)
  createdAt: Date;         // Oluşturulma tarihi
  updatedAt: Date;         // Güncellenme tarihi
}
```

---

## Hata Yönetimi

### 401 Unauthorized

- Geçersiz veya eksik token
- Token süresi dolmuş

### 403 Forbidden

- Kullanıcı başka bir kullanıcının bilgilerine erişmeye çalışıyor (ADMIN değilse)
- ADMIN rolü gerektiren endpoint'e USER rolü ile erişim

### 404 Not Found

- Kullanıcı bulunamadı

### 409 Conflict

- Email zaten kullanılıyor
- Telefon numarası zaten kullanılıyor

### 400 Bad Request

- Geçersiz veri formatı
- Eksik zorunlu alanlar
- Şifre minimum uzunluk gereksinimini karşılamıyor
