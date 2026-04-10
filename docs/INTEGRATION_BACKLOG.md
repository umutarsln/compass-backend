# Entegrasyon backlog (Store / Admin / Backend)

Kod envanteri ve `npm run verify:integration` ile uyumlu takip maddeleri. Tamamlanan işler buradan silinip CHANGELOG veya PR açıklamasına taşınabilir.

## Mağaza (shawk-ecommerce-store)

1. **Ana sayfa vitrin** — `app/page.tsx` şu an yalnızca statik `getStaticFrontendProducts` kullanıyor; admin’den eklenen ürünler otomatik görünmez. Hedef: `GET /store/products` (ör. `isFeatured`, limit) ile beslemek.
2. **Ana sayfa kategori kutuları** — `components/home/index-sections.tsx` içinde sabit `categories` dizisi; `GET /store/categories` ile hizalanmalı.
3. **Blog** — `app/blog/page.tsx` statik içerik; backend’de blog/CMS uçları yok. Hedef: içerik API’si veya MD tabanlı build.
4. **Hakkımızda** — Statik bileşenler; istenirse sayfa içeriği için CMS veya yapılandırılabilir API.

## Backend

1. **BUNDLE ürün tipi** — Mağaza transformer ve `GET /store/products` yanıtının BUNDLE ile tutarlılığı ayrı test edilmeli.
2. **Redis** — Cache modülü Redis olmadan hata logları üretebilir; geliştirme için opsiyonel mod veya docker-compose dokümantasyonu değerlendirilebilir.

## Doğrulama

- Genel GET kontrolleri: backend ayrı terminalde çalışırken `cd shawk-ecommerce-backend && npm run verify:integration` (gerekirse `API_BASE_URL=http://127.0.0.1:4141` veya `API_PORT=4141`)
- Tam admin akışı: `VERIFY_ADMIN_EMAIL=... VERIFY_ADMIN_PASSWORD=... npm run verify:integration`

Manuel curl (backend çalışırken):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:4141/store/products
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:4141/store/categories
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:4141/store/tags
```

## Ortam

- **Store** `npm run dev` → port `3000` (CORS’ta tanımlı).
- **Admin** `npm run dev` → port `3001` (CORS’ta tanımlı).
- **API**: backend `.env` `PORT=4141`; store/admin `NEXT_PUBLIC_API_URL=http://localhost:4141`.
