import { Temporal } from "../internal/temporal";

/**
 * Set the fake system clock to a moment whose sub-millisecond digits do not depend on test order.
 *
 * `temporal-polyfill` reads `Temporal.Now` as `Date.now()` in whole milliseconds, so `Temporal.Now`
 * under a fake clock has no sub-millisecond digits and the throwaway call below changes nothing.
 * The polyfill the swap check puts in its place (`swapEntry.ts`) builds `Temporal.Now` from
 * `Date.now()` plus a carried "bogus" nanosecond part, the previous call's `Date.now() % 1e6`, which
 * starts from the real clock; one `Temporal.Now.instant()` call right after the clock is set
 * replaces that noise with the fake time's own tail, so a row passes whichever polyfill runs it.
 *
 * Call it after `vi.useFakeTimers()`, in place of `vi.setSystemTime`.
 */
export function setFakeSystemTime(time: string | number | Date): void {
  vi.setSystemTime(time);
  Temporal.Now.instant();
}
