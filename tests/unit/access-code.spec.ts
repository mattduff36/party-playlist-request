import {
  generateAccessCode,
  generateSecureAccessCode,
  generateSixDigitAccessCode,
  isSecureAccessCode,
  isSixDigitAccessCode,
  isValidAccessCodeFormat,
  guestRequestUrl,
  guestDisplayUrl,
} from '@/lib/access-code';

describe('access-code helpers', () => {
  it('generates 6-digit default codes', () => {
    const code = generateSixDigitAccessCode();
    expect(isSixDigitAccessCode(code)).toBe(true);
    expect(code).toHaveLength(6);
  });

  it('generates 8-char secure codes', () => {
    const code = generateSecureAccessCode();
    expect(isSecureAccessCode(code)).toBe(true);
    expect(code).toHaveLength(8);
  });

  it('generateAccessCode respects secure flag', () => {
    expect(isSixDigitAccessCode(generateAccessCode(false))).toBe(true);
    expect(isSecureAccessCode(generateAccessCode(true))).toBe(true);
  });

  it('accepts legacy 4-digit format', () => {
    expect(isValidAccessCodeFormat('4829')).toBe(true);
  });

  it('builds guest URLs', () => {
    expect(guestRequestUrl('https://example.com', 'dj1', '101234')).toBe(
      'https://example.com/dj1/101234/request'
    );
    expect(guestDisplayUrl('https://example.com', 'dj1', '101234')).toBe(
      'https://example.com/dj1/101234/display'
    );
  });
});
