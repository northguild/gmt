import { checkRateLimit, resetRateLimitState } from "./rate-limit";
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_SECONDS,
} from "../src/lib/chat-constants";

const POLICY = {
  max: RATE_LIMIT_MAX,
  windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
};

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimitState());

  it("allows requests up to RATE_LIMIT_MAX within the window", () => {
    let now = 0;
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(checkRateLimit("1.2.3.4", now, POLICY).allowed).toBe(true);
    }
  });

  it("blocks the request after RATE_LIMIT_MAX within the same window", () => {
    const now = 0;
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit("1.2.3.4", now, POLICY);
    }
    const result = checkRateLimit("1.2.3.4", now, POLICY);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks each client independently", () => {
    const now = 0;
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit("1.2.3.4", now, POLICY);
    }
    expect(checkRateLimit("1.2.3.4", now, POLICY).allowed).toBe(false);
    expect(checkRateLimit("5.6.7.8", now, POLICY).allowed).toBe(true);
  });

  it("resets the count once the window has elapsed", () => {
    const start = 0;
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit("1.2.3.4", start, POLICY);
    }
    expect(checkRateLimit("1.2.3.4", start, POLICY).allowed).toBe(false);

    const afterWindow = start + RATE_LIMIT_WINDOW_SECONDS * 1000 + 1;
    expect(checkRateLimit("1.2.3.4", afterWindow, POLICY).allowed).toBe(true);
  });

  it("sweeps expired entries rather than growing unbounded", () => {
    checkRateLimit("client-a", 0, POLICY);
    checkRateLimit("client-b", 0, POLICY);
    // Far beyond both clients' windows — a fresh check should sweep both
    // expired entries as a side effect, not merely ignore them.
    const farFuture = (RATE_LIMIT_WINDOW_SECONDS + 100) * 1000;
    const result = checkRateLimit("client-c", farFuture, POLICY);
    expect(result.allowed).toBe(true);
  });

  it("takes its limit and window from the policy argument", () => {
    const small = { max: 2, windowSeconds: 5 };
    expect(checkRateLimit("p", 0, small).allowed).toBe(true);
    expect(checkRateLimit("p", 0, small).allowed).toBe(true);
    const blocked = checkRateLimit("p", 1000, small);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(4);
    expect(checkRateLimit("p", 5001, small).allowed).toBe(true);
  });

  it("keeps one bucket per key, so a prefix separates two callers of one client", () => {
    const one = { max: 1, windowSeconds: 60 };
    expect(checkRateLimit("chat:1.2.3.4", 0, one).allowed).toBe(true);
    expect(checkRateLimit("chat:1.2.3.4", 0, one).allowed).toBe(false);
    expect(checkRateLimit("canada:1.2.3.4", 0, one).allowed).toBe(true);
  });
});
