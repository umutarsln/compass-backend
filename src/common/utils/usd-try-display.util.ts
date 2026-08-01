/**
 * Saklanan USD tutarını müşteri gösterimi için tam TL değerine çevirir.
 */
export function usdAmountToDisplayTry(
  usdAmount: number,
  usdTryRate: number,
): number {
  const tl = Number(usdAmount) * Number(usdTryRate);
  return Math.round(tl);
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
