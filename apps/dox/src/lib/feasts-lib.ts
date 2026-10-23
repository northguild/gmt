/**
 * Loads the real gmt functions Moving Feasts calls: the holiday family's
 * (`holiday-lib.ts`) and `diffDate` from `plain/calculate`.
 *
 * The extra module lives here, not in the family loader, so the Holiday Rule
 * Builder and the Observance Comparator never load it. The page's mount is the
 * only importer; a module that fails to load, or a name it no longer exports,
 * becomes a `WidgetLoadError` rather than a dead control.
 */
import { loadHolidayLib, type HolidayLib } from "./holiday-lib";
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

/** The family's functions, and the one more Moving Feasts calls. */
export interface FeastsLib extends HolidayLib {
  // plain/calculate
  diffDate(a: string, b: string, unit: "days"): number;
}

export async function loadFeastsLib(): Promise<FeastsLib> {
  try {
    const [base, calculate] = await Promise.all([
      loadHolidayLib(),
      GMT_MODULES["plain/calculate"](),
    ]);
    if (typeof calculate["diffDate"] !== "function") {
      throw new Error("The library module has no diffDate.");
    }
    return { ...base, diffDate: calculate["diffDate"] } as unknown as FeastsLib;
  } catch (cause) {
    // `loadHolidayLib` already wrapped its own failure; do not wrap it twice.
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
}
