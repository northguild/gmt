/**
 * Loads the real gmt functions every multi-leg scheduling widget needs, at
 * module granularity, and hands them back as a `TransportLib`
 * (`transport-widgets.ts`).
 *
 * A heavy module (C-x): it is never imported statically from the chat island
 * — only each widget's mount reaches it, inside its own `try`, so a failed
 * import becomes a `WidgetLoadError` rather than a dead control.
 */
import { GMT_MODULES } from "./gmt-modules";
import type { TimetableLib } from "./timetable-reader";
import type { TransportLib } from "./transport-widgets";

export async function loadTransportLib(): Promise<TransportLib> {
  const [
    transportCalculate,
    transportConvert,
    zonedValidate,
    plainValidate,
    instantConvert,
  ] = await Promise.all([
    GMT_MODULES["transport/calculate"](),
    GMT_MODULES["transport/convert"](),
    GMT_MODULES["zoned/validate"](),
    GMT_MODULES["plain/validate"](),
    GMT_MODULES["instant/convert"](),
  ]);

  return {
    scheduleDelivery: transportCalculate[
      "scheduleDelivery"
    ] as TransportLib["scheduleDelivery"],
    transitTime: transportCalculate[
      "transitTime"
    ] as TransportLib["transitTime"],
    etaAtZone: transportConvert["etaAtZone"] as TransportLib["etaAtZone"],
    crossingTime: transportCalculate[
      "crossingTime"
    ] as TransportLib["crossingTime"],
    isValidTimeZone: zonedValidate[
      "isValidTimeZone"
    ] as TransportLib["isValidTimeZone"],
    isValidDateTime: plainValidate[
      "isValidDateTime"
    ] as TransportLib["isValidDateTime"],
    resolveLocal: instantConvert[
      "resolveLocal"
    ] as TransportLib["resolveLocal"],
  };
}

/**
 * `loadTransportLib` plus the two calls the Timetable Reader draws its day
 * with: `getDstTransitions` (the clock changes on the track's date) and
 * `classifyLocal` (whether a printed time happens once, twice or never).
 * `loadTransportLib` and `TransportLib` are unchanged, so the other multi-leg
 * widgets do not load these two modules.
 */
export async function loadTimetableLib(): Promise<TimetableLib> {
  const [transport, zonedGet, instantConvert] = await Promise.all([
    loadTransportLib(),
    GMT_MODULES["zoned/get"](),
    GMT_MODULES["instant/convert"](),
  ]);
  return {
    ...transport,
    getDstTransitions: zonedGet[
      "getDstTransitions"
    ] as TimetableLib["getDstTransitions"],
    classifyLocal: instantConvert[
      "classifyLocal"
    ] as TimetableLib["classifyLocal"],
  };
}
