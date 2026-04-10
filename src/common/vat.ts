/**
 * Türkiye için uygulanan KDV oranı (%20).
 */
export const VAT_RATE = 0.2;

/**
 * KDV hariç tutara %20 KDV ekleyerek iki ondalık basamağa yuvarlar.
 * @param amountExVat KDV hariç tutar
 * @returns KDV dahil tutar
 */
export function addVat(amountExVat: number): number {
  return Math.round(amountExVat * (1 + VAT_RATE) * 100) / 100;
}
