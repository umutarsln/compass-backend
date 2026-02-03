import { Role } from '../common/enums/role.enum';

/**
 * Endpoint-Role Mapping Configuration
 * 
 * Bu dosya, hangi endpoint'in hangi rollere erişim izni verdiğini tanımlar.
 * Format: 'METHOD /path' => [Role.ADMIN, Role.USER]
 * 
 * ÖNEMLİ: 
 * - Eğer array boşsa ([]), endpoint PUBLIC'tir ve authentication gerektirmez
 * - Eğer array'de rol varsa, kullanıcının bu rollerden en az birine sahip olması gerekir
 * 
 * Kullanım:
 * - Endpoint eklerken bu dosyaya ekleyin
 * - Boş array ([]) = Public endpoint, auth gerekmez
 * - Rol array'i = Sadece belirtilen rollere sahip kullanıcılar erişebilir
 */
export const ENDPOINT_ROLES: Record<string, Role[]> = {
    // Auth Endpoints
    'POST /auth/register': [], // Public - herkes erişebilir (auth gerekmez)
    'POST /auth/login': [], // Public - herkes erişebilir (auth gerekmez)
    'POST /auth/refresh': [], // Public - herkes erişebilir (auth gerekmez)
    'POST /auth/logout': [Role.USER, Role.ADMIN], // Authenticated users (auth gerekli)

    // User Endpoints
    'GET /users/me': [Role.USER, Role.ADMIN], // Kullanıcı kendi bilgilerini görebilir (auth gerekli)
    'GET /users': [Role.ADMIN], // Sadece admin tüm kullanıcıları görebilir (auth gerekli)
    'GET /users/:id': [Role.USER, Role.ADMIN], // Kullanıcı kendi bilgilerini, admin herkesi görebilir (auth gerekli)
    'PATCH /users/:id': [Role.USER, Role.ADMIN], // Kullanıcı kendini, admin herkesi güncelleyebilir (auth gerekli)
    'DELETE /users/:id': [Role.ADMIN], // Sadece admin kullanıcı silebilir (auth gerekli)

    // Admin Management Endpoints (Sadece ADMIN)
    'GET /users/admins': [Role.ADMIN], // Admin listesi
    'POST /users/admins': [Role.ADMIN], // Admin oluştur
    'PATCH /users/admins/:id': [Role.ADMIN], // Admin güncelle
    'DELETE /users/admins/:id': [Role.ADMIN], // Admin sil

    // Customer Endpoints (Sadece ADMIN)
    'GET /users/customers': [Role.ADMIN], // Müşteri listesi

    // Folder Endpoints (Sadece ADMIN)
    'POST /folders': [Role.ADMIN], // Klasör oluştur
    'GET /folders': [Role.ADMIN], // Tüm klasörleri listele
    'GET /folders/tree': [Role.ADMIN], // Klasörleri tree yapısında listele
    'GET /folders/:id': [Role.ADMIN], // Klasör detayı
    'PATCH /folders/:id': [Role.ADMIN], // Klasör güncelle
    'DELETE /folders/:id': [Role.ADMIN], // Klasör sil
    'DELETE /folders/:id/recursive': [Role.ADMIN], // Klasörü recursive sil

    // Upload Endpoints (Sadece ADMIN)
    'POST /uploads': [Role.ADMIN], // Dosya yükle
    'GET /uploads': [Role.ADMIN], // Tüm dosyaları listele
    'GET /uploads/folder/:id': [Role.ADMIN], // Klasördeki dosyaları listele
    'GET /uploads/:id': [Role.ADMIN], // Dosya detayı
    'GET /uploads/:id/download': [Role.ADMIN], // Dosya indirme URL'i
    'PATCH /uploads/:id': [Role.ADMIN], // Dosya bilgilerini güncelle
    'DELETE /uploads/:id': [Role.ADMIN], // Dosya sil

    // Category Endpoints
    'POST /categories': [Role.ADMIN], // Kategori oluştur
    'GET /categories': [], // Public - herkes kategorileri görebilir
    'GET /categories/tree': [], // Public - tree yapısını görebilir
    'GET /categories/:id': [], // Public - kategori detayını görebilir
    'PATCH /categories/:id': [Role.ADMIN], // Kategori güncelle
    'DELETE /categories/:id': [Role.ADMIN], // Kategori sil

    // Tag Endpoints
    'POST /tags': [Role.ADMIN], // Tag oluştur
    'GET /tags': [], // Public - herkes tag'leri görebilir
    'GET /tags/:id': [], // Public - tag detayını görebilir
    'PATCH /tags/:id': [Role.ADMIN], // Tag güncelle
    'DELETE /tags/:id': [Role.ADMIN], // Tag sil

    // Coupon Endpoints (Admin)
    'POST /coupons': [Role.ADMIN], // Kupon oluştur
    'GET /coupons': [Role.ADMIN], // Kupon listesi
    'GET /coupons/:id': [Role.ADMIN], // Kupon detayı
    'PATCH /coupons/:id': [Role.ADMIN], // Kupon güncelle
    'DELETE /coupons/:id': [Role.ADMIN], // Kupon sil

    // Cart Endpoints (Public with cart guard)
    'POST /carts/guest': [], // Guest sepet oluştur
    'GET /carts/:id': [], // Sepet getir
    'POST /carts/:id/items': [], // Sepete ürün ekle
    'PATCH /carts/:id/items/:itemId': [], // Sepet ürünü güncelle
    'DELETE /carts/:id/items/:itemId': [], // Sepetten ürün sil
    'DELETE /carts/:id/items': [], // Sepeti temizle
    'POST /carts/:id/coupon': [], // Sepete kupon uygula
    'DELETE /carts/:id/coupon': [], // Sepetten kupon kaldır
    'POST /carts/:id/merge': [Role.USER, Role.ADMIN], // Guest sepeti user sepetine birleştir
    'GET /carts/me/cart': [Role.USER, Role.ADMIN], // Kullanıcı sepeti getir

    // Product Endpoints
    'POST /products': [Role.ADMIN], // Ürün oluştur
    'GET /products': [], // Public - herkes ürünleri görebilir
    'GET /products/slug/:slug': [], // Public - slug ile ürün detayını görebilir
    'GET /products/:id': [], // Public - ürün detayını görebilir
    'PATCH /products/:id': [Role.ADMIN], // Ürün güncelle
    'DELETE /products/:id': [Role.ADMIN], // Ürün sil
    'POST /products/reset': [Role.ADMIN], // Tüm ürün verilerini temizle (SADECE ADMIN)

    // Variant Option Endpoints
    'POST /products/:id/variant-options': [Role.ADMIN], // Varyasyon seçeneği oluştur
    'GET /products/:id/variant-options': [Role.ADMIN], // Ürünün varyasyon seçeneklerini getir
    'PATCH /products/variant-options/:id': [Role.ADMIN], // Varyasyon seçeneğini güncelle
    'DELETE /products/variant-options/:id': [Role.ADMIN], // Varyasyon seçeneğini sil

    // Variant Value Endpoints
    'POST /products/variant-options/:id/variant-values': [Role.ADMIN], // Varyasyon değeri oluştur
    'GET /products/variant-options/:id/variant-values': [Role.ADMIN], // Varyasyon seçeneğinin değerlerini getir
    'PATCH /products/variant-values/:id': [Role.ADMIN], // Varyasyon değerini güncelle
    'DELETE /products/variant-values/:id': [Role.ADMIN], // Varyasyon değerini sil

    // Variant Combination Endpoints
    'POST /products/:id/variant-combinations/generate': [Role.ADMIN], // Tüm kombinasyonları otomatik oluştur
    'GET /products/:id/variant-combinations': [Role.ADMIN], // Ürünün kombinasyonlarını getir
    'GET /products/:id/variant-combinations/total-stock': [Role.ADMIN], // Ürünün toplam stokunu hesapla
    'POST /products/:id/variant-combinations': [Role.ADMIN], // Varyasyon kombinasyonu oluştur
    'PATCH /products/variant-combinations/:id': [Role.ADMIN], // Varyasyon kombinasyonunu güncelle
    // Not: DELETE endpoint kaldırıldı - kombinasyonlar silinemez

    // Product Gallery Endpoints
    'POST /products/:id/gallery': [Role.ADMIN], // Ürün için ProductGallery oluştur
    'POST /products/variants/:id/gallery': [Role.ADMIN], // Varyasyon kombinasyonu için ProductGallery oluştur
    'GET /products/:id/gallery': [Role.ADMIN], // Ürünün ProductGallery'sini getir
    'GET /products/variants/:id/gallery': [Role.ADMIN], // Varyasyon kombinasyonunun ProductGallery'sini getir
    'GET /products/gallery/:id': [Role.ADMIN], // ProductGallery detayını getir
    'PATCH /products/gallery/:id': [Role.ADMIN], // ProductGallery güncelle
    'DELETE /products/gallery/:id': [Role.ADMIN], // ProductGallery sil

    // Stock Endpoints
    'GET /stock/:sellableType/:sellableId': [Role.ADMIN], // Stok bilgisi
    'PATCH /stock/:sellableType/:sellableId': [Role.ADMIN], // Stok güncelle
    'POST /stock/reserve': [Role.ADMIN], // Stok rezerve et
    'POST /stock/release': [Role.ADMIN], // Stok serbest bırak

    // Store Endpoints (Public - Authentication gerektirmez)
    'GET /store/products': [], // Public - Mağaza için ürün listesi (basit ürünler ve varyasyon kombinasyonları)
    'GET /store/products/:id': [], // Public - Ürün detayı (varyasyon seçimi ile)
    'GET /store/categories': [], // Public - Hiyerarşik ve orderlanmış kategoriler
    'GET /store/tags': [], // Public - Tag'ler renkleriyle birlikte

    // Cache Endpoints (Sadece ADMIN)
    'DELETE /cache': [Role.ADMIN], // Sadece admin - Cache'i temizle (prefix ile filtreleme yapılabilir)

    // Payment Endpoints
    'POST /payments/checkout': [], // Public - Guest ve authenticated kullanıcılar ödeme başlatabilir
    'POST /payments/iban-eft/info': [], // Public - IBAN EFT bilgilerini getir
    'POST /payments/iyzico/callback': [], // Public - Iyzico callback (iyzico'dan gelir)
    'POST /payments/iyzico/webhook': [], // Public - Iyzico webhook (iyzico'dan gelir)

    // Payment Settings Endpoints
    'GET /payment-settings': [], // Public - Ödeme ayarlarını getir (hangi ödeme yöntemleri aktif)
    'PATCH /payment-settings': [Role.ADMIN], // Sadece admin - Ödeme ayarlarını güncelle

    // Order Endpoints
    'POST /orders': [], // Public - Guest ve authenticated kullanıcılar sipariş oluşturabilir
    'GET /orders/:id': [], // Public - Guest ve authenticated kullanıcılar siparişlerini görebilir (orderId veya orderNo ile)
    'GET /orders/me/orders': [Role.USER, Role.ADMIN], // Authenticated kullanıcılar kendi siparişlerini görebilir
    'GET /orders': [Role.ADMIN], // Sadece admin tüm siparişleri görebilir
    'PATCH /orders/:id/status': [Role.ADMIN], // Sadece admin sipariş durumunu güncelleyebilir

    // Documentation Endpoints (Admin only)
    'GET /docs': [Role.ADMIN], // Documentation listesi
    'GET /docs/:module': [Role.ADMIN], // Belirli module documentation'ı

    // Gelecekte eklenecek endpoint'ler için örnekler:
    // 'GET /products': [], // Public
    // 'POST /products': [Role.ADMIN],
    // 'GET /admin/stats': [Role.ADMIN],
};

/**
 * Endpoint path'ini normalize eder
 * Örnek: '/users/123' => '/users/:id'
 * Örnek: '/users/me' => '/users/me' (değişmez)
 */
export function normalizeEndpointPath(path: string): string {
    // Özel endpoint'leri koru (me, stats, profile, tree, recursive, download, vb.)
    const specialPaths = ['/me', '/stats', '/profile', '/tree', '/recursive', '/download', '/reserve', '/release'];
    const hasSpecialPath = specialPaths.some(sp => path.includes(sp));

    if (hasSpecialPath) {
        // Özel path'leri olduğu gibi bırak, ama ID'leri normalize et
        // Örnek: /folders/123/tree => /folders/:id/tree
        return path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
            .replace(/\/\d+/g, '/:id');
    }

    // UUID veya sayısal ID'leri :id ile değiştir
    return path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
        .replace(/\/\d+/g, '/:id');
}

/**
 * Endpoint için gerekli rolleri döndürür
 * @param method HTTP method (GET, POST, etc.)
 * @param path Endpoint path
 * @returns Gerekli roller array'i
 *   - Boş array ([]) dönerse: Public endpoint, authentication gerektirmez
 *   - Rol array'i dönerse: Sadece belirtilen rollere sahip kullanıcılar erişebilir
 */
export function getRequiredRoles(method: string, path: string): Role[] {
    const normalizedPath = normalizeEndpointPath(path);
    const key = `${method.toUpperCase()} ${normalizedPath}`;
    const roles = ENDPOINT_ROLES[key];

    // Eğer config'de tanımlı değilse, boş array döndür (public endpoint)
    // Eğer config'de boş array varsa, yine boş array döndür (public endpoint)
    return roles || [];
}
