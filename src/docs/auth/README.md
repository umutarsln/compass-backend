# Auth Module Documentation

## Genel Bakış

Auth modülü, kullanıcı kimlik doğrulama ve yetkilendirme işlemlerini yönetir. JWT (JSON Web Token) tabanlı stateless authentication sistemi kullanır. Kullanıcılar kayıt olabilir, giriş yapabilir, token yenileyebilir ve çıkış yapabilir.

## Module Yapısı

```
backend/src/auth/
├── auth.controller.ts          # Auth endpoint'leri
├── auth.service.ts             # Auth iş mantığı
├── auth.module.ts              # Auth module tanımı
├── store-auth.controller.ts    # Store frontend için auth endpoint'leri
├── store-auth.service.ts       # Store auth iş mantığı
├── dto/
│   ├── login.dto.ts           # Login request DTO
│   └── refresh-token.dto.ts    # Refresh token request DTO
├── guards/
│   ├── jwt-auth.guard.ts      # JWT authentication guard
│   ├── roles.guard.ts         # Role-based authorization guard
│   └── endpoint-roles.guard.ts # Endpoint-role mapping guard
└── strategies/
    └── jwt.strategy.ts         # Passport JWT strategy
```

## Endpoint'ler

### 1. Kullanıcı Kaydı

**POST** `/auth/register`

Yeni kullanıcı kaydı oluşturur ve otomatik olarak giriş yapar (access token ve refresh token döner).

#### Request Body

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `firstname` | string | Evet | Kullanıcı adı |
| `lastname` | string | Evet | Kullanıcı soyadı |
| `email` | string | Evet | Email adresi (unique) |
| `password` | string | Evet | Şifre (minimum 6 karakter) |
| `phone` | string | Evet | Telefon numarası (uluslararası format, örn: +905551234567) |

#### Response (201 Created)

```json
{
  "user": {
    "id": "uuid",
    "firstname": "Ahmet",
    "lastname": "Yılmaz",
    "email": "ahmet@example.com",
    "phone": "+905551234567",
    "roles": ["USER"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Hata Durumları

- **409 Conflict**: Email zaten kullanılıyor
- **400 Bad Request**: Geçersiz veri formatı

#### Örnek cURL

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "Ahmet",
    "lastname": "Yılmaz",
    "email": "ahmet@example.com",
    "password": "password123",
    "phone": "+905551234567"
  }'
```

---

### 2. Kullanıcı Girişi

**POST** `/auth/login`

Email ve şifre ile kullanıcı girişi yapar.

#### Request Body

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `email` | string | Evet | Email adresi |
| `password` | string | Evet | Şifre |

#### Response (200 OK)

```json
{
  "user": {
    "id": "uuid",
    "firstname": "Ahmet",
    "lastname": "Yılmaz",
    "email": "ahmet@example.com",
    "phone": "+905551234567",
    "roles": ["USER"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Hata Durumları

- **401 Unauthorized**: Email veya şifre hatalı

#### Örnek cURL

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmet@example.com",
    "password": "password123"
  }'
```

---

### 3. Token Yenileme

**POST** `/auth/refresh`

Access token'ın süresi dolduğunda, refresh token kullanarak yeni access token ve refresh token alır.

#### Request Body

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `refreshToken` | string | Evet | Refresh token |

#### Response (200 OK)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Hata Durumları

- **401 Unauthorized**: Geçersiz veya süresi dolmuş refresh token

#### Örnek cURL

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

---

### 4. Kullanıcı Çıkışı

**POST** `/auth/logout`

Kullanıcı çıkışı yapar. **Not**: Stateless sistemde logout sadece client-side'da token'ları silmek yeterlidir. Bu endpoint sadece bilgilendirme amaçlıdır.

#### Headers

| Header | Değer | Açıklama |
|--------|-------|----------|
| `Authorization` | `Bearer {accessToken}` | JWT access token |

#### Response (200 OK)

```json
{
  "message": "Başarıyla çıkış yapıldı. Lütfen token'ları client-side'da silin."
}
```

#### Hata Durumları

- **401 Unauthorized**: Geçersiz veya eksik token

#### Örnek cURL

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Authentication/Authorization

### Public Endpoints

Aşağıdaki endpoint'ler authentication gerektirmez (public):

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`

### Protected Endpoints

Aşağıdaki endpoint'ler authentication gerektirir:

- `POST /auth/logout` - USER veya ADMIN rolü

### Token Yapısı

#### Access Token Payload

```json
{
  "email": "ahmet@example.com",
  "sub": "user-uuid",
  "roles": ["USER"],
  "type": "access",
  "iat": 1234567890,
  "exp": 1234568790
}
```

#### Refresh Token Payload

```json
{
  "sub": "user-uuid",
  "type": "refresh",
  "iat": 1234567890,
  "exp": 1234571490
}
```

### Token Süreleri

- **Access Token**: Varsayılan 15 dakika (`.env` dosyasında `JWT_EXPIRES_IN` ile ayarlanabilir)
- **Refresh Token**: Varsayılan 7 gün (`.env` dosyasında `JWT_REFRESH_EXPIRES_IN` ile ayarlanabilir)

### Token Kullanımı

Protected endpoint'lere istek yaparken, `Authorization` header'ında Bearer token gönderilmelidir:

```
Authorization: Bearer {accessToken}
```

---

## Önemli Notlar

1. **Stateless Authentication**: Sistem stateless çalışır. Token'lar veritabanında saklanmaz, sadece JWT secret ile doğrulanır.

2. **Password Hashing**: Şifreler bcrypt ile hash'lenir ve veritabanında düz metin olarak saklanmaz.

3. **Token Refresh**: Access token süresi dolduğunda, refresh token kullanarak yeni token'lar alınabilir. Refresh token da süresi dolduğunda kullanıcı tekrar giriş yapmalıdır.

4. **Logout**: Stateless sistemde logout işlemi sadece client-side'da token'ları silmek yeterlidir. Backend'de herhangi bir işlem yapılmaz.

5. **Role-Based Access**: Kullanıcılar `USER` veya `ADMIN` rolüne sahip olabilir. Roller token payload'ında bulunur ve endpoint'lerde kontrol edilir.

6. **Email Uniqueness**: Email adresi unique olmalıdır. Aynı email ile kayıt yapılamaz.

7. **Phone Validation**: Telefon numarası uluslararası format olmalıdır (örn: +905551234567).

---

## Örnek Kullanımlar

### 1. Kayıt ve Otomatik Giriş

```typescript
// 1. Kullanıcı kaydı
const registerResponse = await fetch('http://localhost:3000/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    firstname: 'Ahmet',
    lastname: 'Yılmaz',
    email: 'ahmet@example.com',
    password: 'password123',
    phone: '+905551234567'
  })
});

const { user, accessToken, refreshToken } = await registerResponse.json();

// Token'ları localStorage'a kaydet
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
```

### 2. Giriş ve Token Yönetimi

```typescript
// 1. Giriş yap
const loginResponse = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'ahmet@example.com',
    password: 'password123'
  })
});

const { accessToken, refreshToken } = await loginResponse.json();

// 2. Protected endpoint'e istek yap
const protectedResponse = await fetch('http://localhost:3000/users/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### 3. Token Yenileme

```typescript
// Access token süresi dolduğunda
const refreshResponse = await fetch('http://localhost:3000/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refreshToken: localStorage.getItem('refreshToken')
  })
});

const { accessToken, refreshToken } = await refreshResponse.json();

// Yeni token'ları güncelle
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
```

### 4. Çıkış

```typescript
// Logout endpoint'ini çağır (opsiyonel)
await fetch('http://localhost:3000/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});

// Token'ları client-side'da sil
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
```

---

## Environment Variables

Auth modülü aşağıdaki environment variable'ları kullanır:

- `JWT_SECRET`: JWT token imzalama için secret key (zorunlu)
- `JWT_EXPIRES_IN`: Access token süresi (varsayılan: `15m`)
- `JWT_REFRESH_EXPIRES_IN`: Refresh token süresi (varsayılan: `7d`)

---

## Hata Yönetimi

### 401 Unauthorized

- Geçersiz email/şifre kombinasyonu
- Geçersiz veya süresi dolmuş token
- Eksik Authorization header

### 409 Conflict

- Email zaten kullanılıyor (register endpoint'i)

### 400 Bad Request

- Geçersiz veri formatı
- Eksik zorunlu alanlar
- Şifre minimum uzunluk gereksinimini karşılamıyor

---

## Güvenlik Notları

1. **HTTPS Kullanımı**: Production ortamında mutlaka HTTPS kullanılmalıdır.

2. **Token Storage**: Token'lar güvenli bir şekilde saklanmalıdır (httpOnly cookies veya secure storage).

3. **Token Expiration**: Access token'lar kısa süreli olmalıdır (15 dakika önerilir).

4. **Refresh Token Rotation**: Güvenlik için refresh token rotation implementasyonu önerilir.

5. **Rate Limiting**: Brute force saldırılarına karşı rate limiting uygulanmalıdır.
