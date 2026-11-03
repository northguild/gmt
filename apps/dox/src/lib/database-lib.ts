/**
 * Loads the functions the Database Timestamp Reader needs, at module granularity, and hands them
 * back as a `DatabaseLib`.
 *
 * Thirteen modules: `instant/parse` (the SQL offset reader), `instant/convert` (`resolveLocal`,
 * `toOffsetInstant`), `plain/parse`, `plain/validate`, `plain/calculate`, `precision/convert`,
 * `unix/convert`, `utc/convert`, `utc/validate`, `duration/parse`, `duration/calculate`,
 * `zoned/parse` (`parseRfc3339`) and `zoned/validate` (`isValidTimeZone`). Each name is picked and
 * nothing else is read. Follows `identifier-lib.ts`.
 *
 * A heavy module: it is never imported statically from the chat island. Only the widget's mount
 * reaches it, so a rejected import, or a name a module no longer exports, becomes a
 * `WidgetLoadError` rather than a dead control.
 */
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

/** What `toOffsetInstant` returns on a valid value. */
export interface OffsetInstantResult {
  instant: string;
  offset: string;
  timeZone?: string;
}

type Units = Record<string, number>;

/** The functions the tool calls, as the library declares them. */
export interface DatabaseLib {
  parseSqlDateTime(value: string): string;
  parseSqlOffsetDateTime(value: string): string;
  fromPgMicroseconds(value: bigint): string;
  parseDuration(value: string): string;
  convertUnixToUtc(
    value: number | string,
    options?: { epochUnit?: string },
  ): string;
  resolveLocal(localDateTime: string, timeZone: string): string;
  durationFromUnits(units: Units): string;
  fromArrowTimestamp(value: bigint, unit: string): string;
  addDate(value: string, units: Units): string;
  fromNanoseconds(nanoseconds: bigint): string;
  convertUtcToPlainTime(value: string): string;
  isValidUtc(value: string): boolean;
  isValidDateTime(value: string): boolean;
  toOffsetInstant(value: string): OffsetInstantResult | null;
  parseRfc3339(value: string): string;
  isValidTimeZone(value: string): boolean;
}

/** Reads each name from a module, and fails loudly on a name it lacks. */
function pick(module: Record<string, unknown>, names: readonly string[]) {
  return Object.fromEntries(
    names.map((name) => {
      if (typeof module[name] !== "function") {
        throw new Error(`The library module has no ${name}.`);
      }
      return [name, module[name]];
    }),
  );
}

export async function loadDatabaseLib(): Promise<DatabaseLib> {
  try {
    const [
      instantParse,
      instantConvert,
      plainParse,
      plainValidate,
      plainCalculate,
      precisionConvert,
      unixConvert,
      utcConvert,
      utcValidate,
      durationParse,
      durationCalculate,
      zonedParse,
      zonedValidate,
    ] = await Promise.all([
      GMT_MODULES["instant/parse"](),
      GMT_MODULES["instant/convert"](),
      GMT_MODULES["plain/parse"](),
      GMT_MODULES["plain/validate"](),
      GMT_MODULES["plain/calculate"](),
      GMT_MODULES["precision/convert"](),
      GMT_MODULES["unix/convert"](),
      GMT_MODULES["utc/convert"](),
      GMT_MODULES["utc/validate"](),
      GMT_MODULES["duration/parse"](),
      GMT_MODULES["duration/calculate"](),
      GMT_MODULES["zoned/parse"](),
      GMT_MODULES["zoned/validate"](),
    ]);
    return {
      ...pick(instantParse, ["parseSqlOffsetDateTime"]),
      ...pick(instantConvert, ["resolveLocal", "toOffsetInstant"]),
      ...pick(plainParse, ["parseSqlDateTime"]),
      ...pick(plainValidate, ["isValidDateTime"]),
      ...pick(plainCalculate, ["addDate"]),
      ...pick(precisionConvert, [
        "fromPgMicroseconds",
        "fromArrowTimestamp",
        "fromNanoseconds",
      ]),
      ...pick(unixConvert, ["convertUnixToUtc"]),
      ...pick(utcConvert, ["convertUtcToPlainTime"]),
      ...pick(utcValidate, ["isValidUtc"]),
      ...pick(durationParse, ["parseDuration"]),
      ...pick(durationCalculate, ["durationFromUnits"]),
      ...pick(zonedParse, ["parseRfc3339"]),
      ...pick(zonedValidate, ["isValidTimeZone"]),
    } as unknown as DatabaseLib;
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
}
