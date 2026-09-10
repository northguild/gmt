/// <reference types="vitest/globals" />
import { checkRateLimit, resetRateLimitState } from "./rate-limit";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS } from "../src/lib/chat-constants";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimitState());

  it("allows requests up to RATE_LIMIT_MAX within the window", () => {
    let now = 0;
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(checkRateLimit("1.2.3.4", now).allowed).toBe(true);
    }
  });

  it("blocks the request after RATE_LIMIT_MAX within the same window", () => {
    const now = 0;
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit("1.2.3.4", now);
    }
    const result = checkRateLimit("1.2.3.4", now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks each client independently", () => {
    const now = 0;
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit("1.2.3.4", now);
    }
    expect(checkRateLimit("1.2.3.4", now).allowed).toBe(false);
    expect(checkRateLimit("5.6.7.8", now).allowed).toBe(true);
  });

  it("resets the count once the window has elapsed", () => {
    const start = 0;
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit("1.2.3.4", start);
    }
    expect(checkRateLimit("1.2.3.4", start).allowed).toBe(false);

    const afterWindow = start + RATE_LIMIT_WINDOW_SECONDS * 1000 + 1;
    expect(checkRateLimit("1.2.3.4", afterWindow).allowed).toBe(true);
  });

  it("sweeps expired entries rather than growing unbounded", () => {
    checkRateLimit("client-a", 0);
    checkRateLimit("client-b", 0);
    // Far beyond both clients' windows — a fresh check should sweep both
    // expired entries as a side effect, not merely ignore them.
    const farFuture = (RATE_LIMIT_WINDOW_SECONDS + 100) * 1000;
    const result = checkRateLimit("client-c", farFuture);
    expect(result.allowed).toBe(true);
  });
});
