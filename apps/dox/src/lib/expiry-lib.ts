/**
 * Loads the real gmt functions the Expiry Calculator calls, at module granularity, and hands
 * them back as an `ExpiryLib`.
 *
 * `durationFromUnits`, `totalDuration` and `ttlFromNow` live in `duration/calculate`;
 * `addUnix` in `unix/calculate`; `addUtc` in `utc/calculate`; `convertUtcToUnix` and
 * `convertUtcToZoned` in `utc/convert`; `formatHttpDate` in `utc/format`; `getUtcIn` in
 * `utc/get`; `isValidUtc` in `utc/validate`. Each name is picked from its module and nothing
 * else is read.
 *
 * A heavy module: only the tool's mount imports it. A module that fails to load, or a name it
 * no longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import { GMT_MODULES } from "./gmt-modules";
import { pickFunctions } from "./gmt-pick";
import { WidgetLoadError } from "./widget-mount";

/** The unit amounts the tool passes: one unit at a time. */
export type ExpiryUnits = Partial<
  Record<"years" | "months" | "weeks" | "days" | "hours" | "minutes", number>
>;

/** What `ttlFromNow` returns: one clock read, in each form a receiver wants. */
export interface ExpiryTtl {
  seconds: number;
  milliseconds: number;
  epochSeconds: number;
  httpDate: string;
  iso: string;
}

/** The functions the tool calls, as the library declares them. */
export interface ExpiryLib {
  // duration/calculate
  durationFromUnits(units: ExpiryUnits): string;
  totalDuration(
    duration: string,
    unit: "seconds",
    options: { relativeTo: string },
  ): number | null;
  ttlFromNow(units: ExpiryUnits): ExpiryTtl | null;
  // unix/calculate
  addUnix(
    epoch: number,
    units: ExpiryUnits,
    options: { epochUnit: "seconds" },
  ): number | null;
  // utc/calculate
  addUtc(value: string, units: Record<string, number>): string;
  // utc/convert
  convertUtcToUnix(
    value: string,
    options: { epochUnit: "seconds" },
  ): number | null;
  convertUtcToZoned(value: string, timeZone: string): string;
  // utc/format
  formatHttpDate(value: string): string;
  // utc/get
  getUtcIn(units: Record<string, number>): string;
  // utc/validate
  isValidUtc(value: unknown): boolean;
}

export async function loadExpiryLib(): Promise<ExpiryLib> {
  try {
    const [
      duration,
      unixCalc,
      utcCalc,
      utcConvert,
      utcFormat,
      utcGet,
      utcValid,
    ] = await Promise.all([
      GMT_MODULES["duration/calculate"](),
      GMT_MODULES["unix/calculate"](),
      GMT_MODULES["utc/calculate"](),
      GMT_MODULES["utc/convert"](),
      GMT_MODULES["utc/format"](),
      GMT_MODULES["utc/get"](),
      GMT_MODULES["utc/validate"](),
    ]);
    return {
      ...pickFunctions(duration, [
        "durationFromUnits",
        "totalDuration",
        "ttlFromNow",
      ]),
      ...pickFunctions(unixCalc, ["addUnix"]),
      ...pickFunctions(utcCalc, ["addUtc"]),
      ...pickFunctions(utcConvert, ["convertUtcToUnix", "convertUtcToZoned"]),
      ...pickFunctions(utcFormat, ["formatHttpDate"]),
      ...pickFunctions(utcGet, ["getUtcIn"]),
      ...pickFunctions(utcValid, ["isValidUtc"]),
    } as unknown as ExpiryLib;
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}
