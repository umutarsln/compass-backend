/**
 * Saklanan USD tutarını müşteri gösterimi için TL'ye çevirir (100'lük dilime yukarı yuvarlar).
 */
export function usdAmountToDisplayTry(
  usdAmount: number,
  usdTryRate: number,
): number {
  const tl = Number(usdAmount) * Number(usdTryRate);
  return Math.ceil(tl / 100) * 100;
}

/**
 * Admin tarafından girilen TL tutarını USD saklama biçimine çevirir (2 ondalık).
 */
export function tryAmountToUsdStorage(
  tryAmount: number,
  usdTryRate: number,
): number {
  if (!usdTryRate || usdTryRate <= 0) {
    throw new Error('Geçersiz USD/TRY kuru');
  }
  const usd = Number(tryAmount) / Number(usdTryRate);
  return Math.round(usd * 100) / 100;
}
