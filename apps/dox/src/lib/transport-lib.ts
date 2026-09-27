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
