import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter } from "../src/rate-limiter.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RateLimiter", () => {
  it("first call resolves immediately", async () => {
    const limiter = new RateLimiter(5);
    const before = Date.now();
    await limiter.wait();
    const elapsed = Date.now() - before;
    expect(elapsed).toBe(0);
  });

  it("allows up to maxPerMinute calls without waiting", async () => {
    const limiter = new RateLimiter(3);
    const before = Date.now();

    await limiter.wait();
    await limiter.wait();
    await limiter.wait();

    const elapsed = Date.now() - before;
    expect(elapsed).toBe(0);
  });
});
