/**
 * Loads the real gmt functions the three cut-off widgets need, at module
 * granularity, and hands them back as a `CutoffLib` (`cutoff-widgets.ts`).
 *
 * A heavy module (C-x): it is never imported statically from the chat island
 * — only each widget's mount reaches it, inside its own `try`, so a failed
 * import becomes a `WidgetLoadError` rather than a dead control.
 *
 * Deliberately its own loader rather than an extension of
 * `transport-lib.ts`/`loadTransportLib`: that loader's five modules serve the
 * four TRAN-9 widgets, and none of the three here calls `scheduleDelivery` or
 * `crossingTime` — extending it would load modules the cut-off widgets never
 * use.
 */
import { GMT_MODULES } from "./gmt-modules";
import type { CutoffLib } from "./cutoff-widgets";

export async function loadCutoffLib(): Promise<CutoffLib> {
  const [
    transportCalculate,
    transportCompare,
    transportConvert,
    calendarBusiness,
    zonedValidate,
    plainValidate,
    utcGet,
  ] = await Promise.all([
    GMT_MODULES["transport/calculate"](),
    GMT_MODULES["transport/compare"](),
    GMT_MODULES["transport/convert"](),
    GMT_MODULES["calendar/business"](),
    GMT_MODULES["zoned/validate"](),
    GMT_MODULES["plain/validate"](),
    GMT_MODULES["utc/get"](),
  ]);

  return {
    cutoffAt: transportCalculate["cutoffAt"] as CutoffLib["cutoffAt"],
    cutoffSchedule: transportCalculate[
      "cutoffSchedule"
    ] as CutoffLib["cutoffSchedule"],
    isPastCutoff: transportCompare["isPastCutoff"] as CutoffLib["isPastCutoff"],
    timeToCutoff: transportCompare["timeToCutoff"] as CutoffLib["timeToCutoff"],
    etaAtZone: transportConvert["etaAtZone"] as CutoffLib["etaAtZone"],
    rollDate: calendarBusiness["rollDate"] as CutoffLib["rollDate"],
    isValidTimeZone: zonedValidate[
      "isValidTimeZone"
    ] as CutoffLib["isValidTimeZone"],
    isValidDateTime: plainValidate[
      "isValidDateTime"
    ] as CutoffLib["isValidDateTime"],
    getUtcNow: utcGet["getUtcNow"] as CutoffLib["getUtcNow"],
  };
}
