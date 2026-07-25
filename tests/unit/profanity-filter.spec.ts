/**
 * Unit tests for requester name profanity filter
 */

import { validateRequesterName } from '@/lib/profanity-filter';

describe('validateRequesterName', () => {
  it('accepts a clean nickname when filtering enabled', () => {
    const result = validateRequesterName('Alex', true);
    expect(result.isValid).toBe(true);
  });

  it('rejects extreme profanity when filtering enabled', () => {
    const result = validateRequesterName('fuck', true);
    expect(result.isValid).toBe(false);
  });

  it('allows anything when filtering disabled', () => {
    const result = validateRequesterName('fuck', false);
    expect(result.isValid).toBe(true);
  });

  it('rejects empty nicknames', () => {
    const result = validateRequesterName('   ', true);
    expect(result.isValid).toBe(false);
  });
});
