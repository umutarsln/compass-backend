/**
 * UTF-8 uyumlu slug oluşturma utility fonksiyonu
 * Türkçe karakterleri düzgün şekilde handle eder
 * 
 * Örnek: "Kişiye Özel Lamba" -> "kisiye-ozel-lamba"
 */
export function generateSlug(text: string): string {
  if (!text) {
    return '';
  }

  // Türkçe karakter mapping
  const turkishCharMap: Record<string, string> = {
    'ş': 's', 'Ş': 's',
    'ğ': 'g', 'Ğ': 'g',
    'ü': 'u', 'Ü': 'u',
    'ö': 'o', 'Ö': 'o',
    'ç': 'c', 'Ç': 'c',
    'ı': 'i', 'İ': 'i',
  };

  // Türkçe karakterleri değiştir
  let slug = text;
  for (const [turkish, latin] of Object.entries(turkishCharMap)) {
    slug = slug.replace(new RegExp(turkish, 'g'), latin);
  }

  // Küçük harfe çevir
  slug = slug.toLowerCase();

  // Trim
  slug = slug.trim();

  // Özel karakterleri kaldır (sadece harf, rakam, boşluk ve tire bırak)
  slug = slug.replace(/[^\w\s-]/g, '');

  // Birden fazla boşluk, alt çizgi veya tireyi tek tireye çevir
  slug = slug.replace(/[\s_-]+/g, '-');

  // Başta ve sonda tire varsa kaldır
  slug = slug.replace(/^-+|-+$/g, '');

  return slug;
}
