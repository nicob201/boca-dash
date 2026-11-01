import { describe, expect, it } from 'vitest';
import { safeEqual } from './secure.js';

describe('safeEqual', () => {
  it('is true only for identical strings', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true);
    expect(safeEqual('abc123', 'abc124')).toBe(false);
    expect(safeEqual('abc', 'abc123')).toBe(false);
    expect(safeEqual('', 'abc')).toBe(false);
  });
});
