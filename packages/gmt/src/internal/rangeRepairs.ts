import { forgetFallbackTemplates } from "./rangeFallback";
import { rangeHooks, registerRangeHooks } from "./rangeHooks";
import { forgetWeekYearRange, formatRangeChecked } from "./weekYearRange";
import { yearRangeText } from "./yearPrintingRange";

/*
 * CORE-112: the range repairs a range function carries, installed in one place. Each range
 * function (`formatRangeRepaired` for `formatDateRange` and `formatDateTimeRange`, and
 * `zonedRangeText` for `formatZonedRange`) calls `ensureRangeHooks` before it formats, which tells
 * `rangeHooks.ts` where the range half of D24, D25 and D27 lives; a bundle that formats single
 * dates never holds it. The call is explicit because the package declares `sideEffects: false`: a
 * bundler (rolldown, Vite 8) drops a module-level call nothing reads, so an install that ran on
 * load would vanish from a tree-shaken bundle (`rangeBundle.test.ts`). D29 (`rangeFields.ts`)
 * sits above this seam and is removed on its own.
 *
 * Retiring D24, D25 and D27 does not delete this file while D29 is live: `rangeFields.ts` imports
 * `ensureRangeHooks` and `formatRangeChecked` from it. It goes with the last of D24, D25, D27 and
 * D29, and `formatDateRange`, `formatDateTimeRange` and `formatZonedRange` then call `formatRange`
 * directly (README § Removal steps 24 to 29).
 */

/** Install the range repairs once; a second call changes nothing. */
export function ensureRangeHooks(): void {
  if (rangeHooks() === undefined) {
    registerRangeHooks({
      checked: formatRangeChecked,
      yearRange: yearRangeText,
      forget: [forgetWeekYearRange, forgetFallbackTemplates],
    });
  }
}

export { formatRangeChecked };
