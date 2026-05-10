import { generateHashKey, validateHashKey, buildRefundHashPlain } from './qnbpay-hash.util';

describe('qnbpay-hash.util', () => {
  const appSecret = 'test-app-secret-fixture';

  /**
   * Şifreleme / çözümleme turunu doğrular.
   */
  it('generateHashKey ve validateHashKey turu tutarlıdır (3D dönüş boru formatı)', () => {
    const plain = '1|100.00|invoice-uuid|order-999|TRY';
    const hash = generateHashKey(plain, appSecret);
    const dec = validateHashKey(hash, appSecret);
    expect(dec.status).toBe('1');
    expect(dec.total).toBe('100.00');
    expect(dec.invoice_id).toBe('invoice-uuid');
    expect(dec.order_id).toBe('order-999');
    expect(dec.currency_code).toBe('TRY');
  });

  /**
   * İade hash düz metni biçimini sabitler.
   */
  it('buildRefundHashPlain total|invoice|merchant sırasını üretir', () => {
    expect(buildRefundHashPlain('99.90', 'inv1', 'mk')).toBe('99.90|inv1|mk');
  });

  /**
   * Geçersiz girdilerde boş yük döner.
   */
  it('validateHashKey boş hash için boş alanlar döner', () => {
    const dec = validateHashKey(undefined, appSecret);
    expect(dec.invoice_id).toBe('');
  });
});
