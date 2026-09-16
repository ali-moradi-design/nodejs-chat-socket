/**
 * Token-bucket style rate limiter keyed by socket id.
 * Allows `ratePerSec` tokens per second with a small burst equal to rate.
 */
export class SocketRateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();

  constructor(
    private readonly ratePerSec: number,
    private readonly burst: number = ratePerSec,
  ) {}

  /** Returns true if the action is allowed. */
  tryConsume(socketId: string, cost = 1): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(socketId);
    if (!bucket) {
      bucket = { tokens: this.burst, lastRefill: now };
      this.buckets.set(socketId, bucket);
    }

    const elapsed = (now - bucket.lastRefill) / 1000;
    if (elapsed > 0) {
      bucket.tokens = Math.min(
        this.burst,
        bucket.tokens + elapsed * this.ratePerSec,
      );
      bucket.lastRefill = now;
    }

    if (bucket.tokens < cost) return false;
    bucket.tokens -= cost;
    return true;
  }

  remove(socketId: string): void {
    this.buckets.delete(socketId);
  }
}
