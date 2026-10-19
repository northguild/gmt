import { Temporal } from "../internal/temporal";

/**
 * Set the fake system clock to a moment whose sub-millisecond digits do not depend on test order.
 *
 * `@js-temporal/polyfill` builds `Temporal.Now` from `Date.now()` plus a carried "bogus" nanosecond
 * part: the previous call's `Date.now() % 1e6`, which starts from the real clock when the module
 * loads. The first `Temporal.Now` call in a file would therefore carry real-clock noise, and a row
 * that expects exact microsecond or nanosecond digits would fail whenever it ran first.
 *
 * One throwaway `Temporal.Now.instant()` call right after the clock is set replaces that noise with
 * the fake time's own `% 1e6`. The next `Temporal.Now` call then returns the fake millisecond plus
 * that many nanoseconds: `2024-02-29T00:00:00.000Z` is 1709164800000 ms, and 1709164800000 % 1e6 is
 * 800000, so the next call reads `.000800000`. Work the expected digits out from that rule.
 *
 * Call it after `vi.useFakeTimers()`, in place of `vi.setSystemTime`.
 */
export function setFakeSystemTime(time: string | number | Date): void {
  vi.setSystemTime(time);
  Temporal.Now.instant();
}
