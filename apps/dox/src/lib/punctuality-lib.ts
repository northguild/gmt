/**
 * Loads the real gmt functions the three punctuality widgets need, at module
 * granularity, and hands them back as a `PunctualityLib`
 * (`punctuality-widgets.ts`).
 *
 * `scheduleDeviation` and `classifyPunctuality` live in `transport/compare`;
 * `punctualityRate`, `bestAvailable`, `estimateDrift` and `nextDeparture` in
 * `transport/calculate`. Nothing else is loaded.
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * each widget's mount reaches it, inside its own `try`, so a failed import
 * becomes a `WidgetLoadError` rather than a dead control.
 *
 * Deliberately its own loader rather than an extension of `loadCutoffLib` or
 * `loadTransportLib`: those load modules these widgets never call.
 */
import { GMT_MODULES } from "./gmt-modules";
import type { PunctualityLib } from "./punctuality-widgets";

export async function loadPunctualityLib(): Promise<PunctualityLib> {
  const [compare, calculate] = await Promise.all([
    GMT_MODULES["transport/compare"](),
    GMT_MODULES["transport/calculate"](),
  ]);
  return {
    scheduleDeviation: compare[
      "scheduleDeviation"
    ] as PunctualityLib["scheduleDeviation"],
    classifyPunctuality: compare[
      "classifyPunctuality"
    ] as PunctualityLib["classifyPunctuality"],
    punctualityRate: calculate[
      "punctualityRate"
    ] as PunctualityLib["punctualityRate"],
    bestAvailable: calculate[
      "bestAvailable"
    ] as PunctualityLib["bestAvailable"],
    estimateDrift: calculate[
      "estimateDrift"
    ] as PunctualityLib["estimateDrift"],
    nextDeparture: calculate[
      "nextDeparture"
    ] as PunctualityLib["nextDeparture"],
  };
}
