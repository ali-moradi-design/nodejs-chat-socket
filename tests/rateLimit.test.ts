import { describe, expect, it } from 'vitest';
import { SocketRateLimiter } from '../src/middleware/rateLimit.js';

describe('SocketRateLimiter', () => {
  it('allows up to burst then rejects', () => {
    const limiter = new SocketRateLimiter(5, 5);
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume('s1')).toBe(true);
    }
    expect(limiter.tryConsume('s1')).toBe(false);
  });

  it('isolates sockets', () => {
    const limiter = new SocketRateLimiter(2, 2);
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(false);
    expect(limiter.tryConsume('b')).toBe(true);
  });

  it('remove clears bucket', () => {
    const limiter = new SocketRateLimiter(1, 1);
    expect(limiter.tryConsume('x')).toBe(true);
    expect(limiter.tryConsume('x')).toBe(false);
    limiter.remove('x');
    expect(limiter.tryConsume('x')).toBe(true);
  });
});
