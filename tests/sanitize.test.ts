import { describe, expect, it } from 'vitest';
import {
  sanitizeDisplayName,
  sanitizePlainText,
  sanitizeRoomName,
} from '../src/validation/sanitize.js';

describe('sanitizePlainText', () => {
  it('strips control characters', () => {
    expect(sanitizePlainText('hello\u0000world\u0007!', 100)).toBe(
      'helloworld!',
    );
  });

  it('trims and truncates', () => {
    expect(sanitizePlainText('  abc  ', 100)).toBe('abc');
    expect(sanitizePlainText('abcdefghij', 5)).toBe('abcde');
  });

  it('normalizes newlines', () => {
    expect(sanitizePlainText('a\r\nb\rc', 100)).toBe('a\nb\nc');
  });
});

describe('sanitizeDisplayName', () => {
  it('collapses whitespace and caps length', () => {
    expect(sanitizeDisplayName('  Ali   Moradi  ')).toBe('Ali Moradi');
    expect(sanitizeDisplayName('x'.repeat(100)).length).toBe(32);
  });
});

describe('sanitizeRoomName', () => {
  it('sanitizes room names', () => {
    expect(sanitizeRoomName('  Dev  Chat ')).toBe('Dev Chat');
  });
});
