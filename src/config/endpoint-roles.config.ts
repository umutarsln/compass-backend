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

    // Gelecekte eklenecek endpoint'ler için örnekler:
    // 'GET /products': [], // Public
    // 'POST /products': [Role.ADMIN],
    // 'GET /orders': [Role.USER, Role.ADMIN],
    // 'POST /orders': [Role.USER, Role.ADMIN],
    // 'GET /admin/stats': [Role.ADMIN],
};

/**
 * Endpoint path'ini normalize eder
 * Örnek: '/users/123' => '/users/:id'
 * Örnek: '/users/me' => '/users/me' (değişmez)
 */
export function normalizeEndpointPath(path: string): string {
    // Özel endpoint'leri koru (me, stats, profile, tree, recursive, download, vb.)
    const specialPaths = ['/me', '/stats', '/profile', '/tree', '/recursive', '/download'];
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
