/**
 * Loads the real gmt functions the IoT tools call, at module granularity, and hands them
 * back as an `IotLib`.
 *
 * The PTP Clock Converter reads and writes with `iot/convert` (`ptpToUtc`, `utcToPtp`), asks
 * `iot/validate` whether a record is in range, and checks the announced offset against the
 * leap-second table with `timescale/calculate` (`taiMinusUtc`). The "PTP now" readout reads
 * the clock with `utc/get` (`getUtcNow`). Each name is picked from its
 * module and nothing else is read.
 *
 * A heavy module: only a tool's mount imports it. A module that fails to load, or a name it
 * no longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import type { PtpTimestamp } from "@northguild/gmt/types";
import { GMT_MODULES } from "./gmt-modules";
import { pickFunctions } from "./gmt-pick";
import { WidgetLoadError } from "./widget-mount";

/** The functions the IoT tools call, as the library declares them. */
export interface IotLib {
  // iot/convert
  ptpToUtc(
    timestamp: PtpTimestamp | { seconds: number; nanoseconds: number },
    currentUtcOffset: number,
  ): string;
  utcToPtp(value: string, currentUtcOffset: number): PtpTimestamp | null;
  // iot/validate
  isValidPtpTimestamp(
    value: unknown,
  ): value is PtpTimestamp | { seconds: number; nanoseconds: number };
  // timescale/calculate
  taiMinusUtc(isoString: string): number | null;
  // utc/get
  getUtcNow(): string;
}

export async function loadIotLib(): Promise<IotLib> {
  try {
    const [convert, validate, calculate, utcGet] = await Promise.all([
      GMT_MODULES["iot/convert"](),
      GMT_MODULES["iot/validate"](),
      GMT_MODULES["timescale/calculate"](),
      GMT_MODULES["utc/get"](),
    ]);
    return {
      ...pickFunctions(convert, ["ptpToUtc", "utcToPtp"]),
      ...pickFunctions(validate, ["isValidPtpTimestamp"]),
      ...pickFunctions(calculate, ["taiMinusUtc"]),
      ...pickFunctions(utcGet, ["getUtcNow"]),
    } as unknown as IotLib;
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}
