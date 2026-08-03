/**
 * Şablondan kalan veya yanlış yüklenmiş hero görsel yolunu tespit eder.
 */
export function isDeprecatedHeroImageUrl(imageUrl: string): boolean {
  const normalized = decodeURIComponent(imageUrl).toLowerCase();
  return (
    normalized.includes('/hero/') ||
    normalized.includes('heromobil') ||
    normalized.includes('hero-section-image') ||
    normalized.includes('herosection-mobil')
  );
}

/**
 * Hero slayt listesinden alakasız görselleri ayıklar.
 */
export function filterPublicHeroSlides<T extends { imageUrl: string }>(slides: T[]): T[] {
  return slides.filter((slide) => slide.imageUrl && !isDeprecatedHeroImageUrl(slide.imageUrl));
}
