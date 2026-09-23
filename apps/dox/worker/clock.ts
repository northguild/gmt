import { getUnixNow } from "@northguild/gmt";

/**
 * GMT's `getUnixNow()` with the Worker's answer to its `null`, in one place.
 *
 * `getUnixNow()` is typed `number | null` — null only if `Temporal.Now.instant()`
 * throws, which means the runtime is broken — and every caller here needs a
 * plain `number`. This exists so that fallback is decided once instead of four
 * times; it is the only reason to prefer it over calling `getUnixNow()` directly.
 *
 * 0 fails safe at both kinds of call site: the ledger is advisory by design
 * (see `usage.ts`) so a degenerate day bucket costs a badge digit and never an
 * allowance, and a dev token minted at the epoch reads as long expired.
 *
 * Note this is not the test seam — nothing fakes this module. What tests drive
 * is `createChatHandler`'s injectable `now`, for which this is just the default.
 */
export function getUnixNowMs(): number {
  return getUnixNow() ?? 0;
}
