# Auth Modülü Kullanım Kılavuzu

## Genel Bakış

Auth modülü, kullanıcı kimlik doğrulama ve yetkilendirme işlemlerini yönetir. JWT (JSON Web Token) tabanlı authentication sistemi kullanır ve Access Token + Refresh Token mekanizması ile çalışır.

## Özellikler

- **Kullanıcı Kaydı**: Yeni kullanıcılar sisteme kaydedilebilir
- **Kullanıcı Girişi**: Email ve şifre ile giriş yapılabilir
- **Token Yenileme**: Refresh token ile access token yenilenebilir
- **Kullanıcı Çıkışı**: Refresh token iptal edilerek çıkış yapılabilir
- **Role-Based Access Control**: USER ve ADMIN rolleri desteklenir

## Endpoint'ler

### 1. Kullanıcı Kaydı

**POST** `/auth/register`

Yeni bir kullanıcı kaydı oluşturur.

**Request Body:**
```json
{
  "firstname": "Ahmet",
  "lastname": "Yılmaz",
  "email": "ahmet@example.com",
  "password": "password123",
  "phone": "+905551234567"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "firstname": "Ahmet",
    "lastname": "Yılmaz",
    "email": "ahmet@example.com",
    "phone": "+905551234567",
    "role": "USER",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a1b2c3d4e5f6..."
}
```

### 2. Kullanıcı Girişi

**POST** `/auth/login`

Email ve şifre ile giriş yapar.

**Request Body:**
```json
{
  "email": "ahmet@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a1b2c3d4e5f6..."
}
```

### 3. Token Yenileme

**POST** `/auth/refresh`

Refresh token kullanarak yeni access token alır.

**Request Body:**
```json
{
  "refreshToken": "a1b2c3d4e5f6..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "new_refresh_token..."
}
```

### 4. Kullanıcı Çıkışı

**POST** `/auth/logout`

Refresh token'ı iptal ederek çıkış yapar. Bearer token gerektirir.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "refreshToken": "a1b2c3d4e5f6..."
}
```

**Response (200):**
```json
{
  "message": "Başarıyla çıkış yapıldı"
}
```

## Token Kullanımı

### Access Token

- Süre: 15 dakika (varsayılan)
- Kullanım: Korunan endpoint'lere erişim için
- Header formatı: `Authorization: Bearer <access_token>`

### Refresh Token

- Süre: 7 gün
- Kullanım: Yeni access token almak için
- Saklama: Güvenli bir yerde saklanmalı (localStorage, httpOnly cookie vb.)

## Güvenlik Notları

1. **Password**: Minimum 6 karakter olmalıdır
2. **Email**: Geçerli bir email formatı olmalıdır
3. **Phone**: Geçerli bir telefon numarası formatı olmalıdır (uluslararası format)
4. **Token Güvenliği**: 
   - Access token'lar kısa süreli olmalı
   - Refresh token'lar güvenli bir şekilde saklanmalı
   - HTTPS kullanılmalı

## Hata Kodları

- `400`: Geçersiz istek (validasyon hatası)
- `401`: Yetkilendirme hatası (geçersiz token veya kimlik bilgileri)
- `409`: Çakışma (email zaten kullanılıyor)
- `404`: Bulunamadı

## Örnek Kullanım Senaryosu

1. Kullanıcı kaydı yapılır → Access token ve refresh token alınır
2. Access token ile korunan endpoint'lere erişilir
3. Access token süresi dolduğunda refresh token ile yeni access token alınır
4. Çıkış yapılırken refresh token iptal edilir

## Decorator'lar

### @Public()

Endpoint'i public yapar, JWT kontrolü yapılmaz.

```typescript
@Public()
@Post('register')
async register() { ... }
```

### @Roles()

Endpoint'e belirli rollere sahip kullanıcılar erişebilir.

```typescript
@Roles(Role.ADMIN)
@Get('admin-only')
async adminOnly() { ... }
```
