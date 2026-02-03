# Analytics Module

Mağaza ve ürün analitiği: ham event toplama, günlük/toplam özet tabloları ve raporlama API'leri.

## Event tipleri

| type | Açıklama | Zorunlu alanlar |
|------|----------|------------------|
| `PRODUCT_VIEW` | Ürün detay sayfası açıldı | productId |
| `PRODUCT_TIME` | Sayfada kalma süresi | productId, durationSeconds |
| `CART_ADD` | Sepete ekleme | productId |
| `PAGE_VIEW` | Sayfa ziyareti (home, cart, checkout vb.) | page |
| `ORDER_START` / `ORDER_COMPLETE` | İsteğe bağlı sipariş akışı | - |

Tüm event'lerde opsiyonel: `sessionId`, `userId`, `variantId`. `payload` içinde type'a göre ek alanlar (quantity, page, orderId vb.) saklanır.

## Store endpoint (Public)

### POST /store/analytics/events

Mağaza frontend'inden event batch gönderimi. Yanıt hemen 204 döner; kayıt fire-and-forget yapılır.

**Body:**

```json
{
  "events": [
    { "type": "PRODUCT_VIEW", "productId": "uuid", "variantId": null, "sessionId": "..." },
    { "type": "PRODUCT_TIME", "productId": "uuid", "durationSeconds": 45 },
    { "type": "CART_ADD", "productId": "uuid", "quantity": 1 },
    { "type": "PAGE_VIEW", "page": "home" }
  ]
}
```

- Max 50 event per request.
- Validasyon: type zorunlu; product_view/cart_add için productId; product_time için durationSeconds; page_view için page.

## Admin raporlama endpoint'leri

Tümü JWT + Admin rol gerekir.

- **GET /analytics/products/:productId** – Tek ürün raporu: toplam + son 30 gün günlük.
- **GET /analytics/products?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=20** – Tarih aralığına göre ürün bazlı özet (sayfalı).
- **GET /analytics/store/daily?from=YYYY-MM-DD&to=YYYY-MM-DD** – Mağaza günlük listesi.
- **GET /analytics/store/summary** – Mağaza toplam (tek kayıt).
- **GET /analytics/events?productId=&type=&from=&to=&limit=100** – Ham event listesi (filtreli; limit max 500).

## Cron

Her gece **00:00** (sunucu saati) çalışır:

1. Dünün `analytics_events` kayıtları okunur.
2. Ürün bazlı günlük: `product_analytics_daily` upsert (viewCount, totalTimeSeconds, cartAddCount, orderCount).
3. Mağaza günlük: `store_analytics_daily` upsert (pageViewCount, productViewCount, cartAddCount, orderCount, totalRevenue, pageBreakdown).
4. `product_analytics_total` ve `store_analytics_total` güncellenir.

Sipariş sayısı ve revenue: `orders` tablosundan dünün PAID/PROCESSING/SHIPPED/DELIVERED siparişleri; ürün bazlı orderCount: `order_items` gruplu toplam.
