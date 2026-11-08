/**
 * Loads the real gmt functions the TAI64N Log Reader needs, at module granularity, and hands
 * them back as a `Tai64nLib`.
 *
 * `fromTai64n`, `toTai64n` and `toTAI` live in `timescale/convert`, `taiMinusUtc` in
 * `timescale/calculate` and `isLeapSecond` in `timescale/validate`. Each name is picked from
 * its module and nothing else is read.
 *
 * A heavy module: it is never imported statically from the chat island. Only the widget's
 * mount reaches it, so a rejected import, or a name a module no longer exports, becomes a
 * `WidgetLoadError` rather than a dead control.
 */
import { GMT_MODULES } from "./gmt-modules";
import { pickFunctions } from "./gmt-pick";
import { WidgetLoadError } from "./widget-mount";

/** The functions the tool calls, as the library declares them. */
export interface Tai64nLib {
  fromTai64n(label: string): string;
  toTai64n(isoString: string): string;
  toTAI(isoString: string): string;
  taiMinusUtc(isoString: string): number | null;
  isLeapSecond(isoString: string): boolean;
}

export async function loadTai64nLib(): Promise<Tai64nLib> {
  try {
    const [convert, calculate, validate] = await Promise.all([
      GMT_MODULES["timescale/convert"](),
      GMT_MODULES["timescale/calculate"](),
      GMT_MODULES["timescale/validate"](),
    ]);
    return {
      ...pickFunctions(convert, ["fromTai64n", "toTai64n", "toTAI"]),
      ...pickFunctions(calculate, ["taiMinusUtc"]),
      ...pickFunctions(validate, ["isLeapSecond"]),
    } as unknown as Tai64nLib;
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
}
