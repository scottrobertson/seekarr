export class RateLimiter {
  private timestamps: number[] = [];
  private maxPerMinute: number;

  constructor(maxPerMinute: number) {
    this.maxPerMinute = maxPerMinute;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 60_000;

    this.timestamps = this.timestamps.filter((t) => t > windowStart);

    if (this.timestamps.length >= this.maxPerMinute) {
      const oldestInWindow = this.timestamps[0];
      const waitMs = oldestInWindow + 60_000 - now;
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      return this.wait();
    }

    this.timestamps.push(Date.now());
  }
}
