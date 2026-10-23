/**
 * Loads the functions the Column Timestamp Bridge needs, at module
 * granularity, and hands them back as a `ColumnBridgeLib`.
 *
 * Four modules: `precision/convert` holds the column converters and
 * `toNanoseconds` / `fromNanoseconds`, `precision/validate` holds
 * `isValidInstant` and the two int64-nanosecond guards, `plain/validate` holds
 * `isValidDateTime` and `zoned/validate` holds `isValidTimeZone`. Each name is
 * picked and nothing else is read. Follows `identifier-lib.ts`.
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * the widget's mount reaches it, so a rejected import, or a name a module no
 * longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import type {
  ArrowTimeUnit,
  ParquetInt96,
  ProtoDuration,
  ProtoTimestamp,
} from "@northguild/gmt";
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

export type { ArrowTimeUnit, ParquetInt96, ProtoDuration, ProtoTimestamp };

/** The functions the tool calls, as the library declares them. */
export interface ColumnBridgeLib {
  toNanoseconds(iso: string): bigint;
  fromNanoseconds(ns: bigint, timeZone?: string): string;
  toParquetInt96(iso: string): ParquetInt96 | null;
  fromParquetInt96(value: ParquetInt96 | Uint8Array): string;
  toArrowTimestamp(iso: string, unit: ArrowTimeUnit): bigint;
  fromArrowTimestamp(value: bigint, unit: ArrowTimeUnit): string;
  toArrowLocalTimestamp(dateTime: string, unit: ArrowTimeUnit): bigint;
  fromArrowLocalTimestamp(value: bigint, unit: ArrowTimeUnit): string;
  toProtoTimestamp(iso: string): ProtoTimestamp | null;
  fromProtoTimestamp(value: ProtoTimestamp): string;
  toProtoDuration(iso: string): ProtoDuration | null;
  fromProtoDuration(value: ProtoDuration): string;
  isValidInstant(value: string): boolean;
  isValidDateTime(value: string): boolean;
  isValidInt64NanosecondInstant(value: string): boolean;
  isValidInt64NanosecondDateTime(value: string): boolean;
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

export async function loadColumnBridgeLib(): Promise<ColumnBridgeLib> {
  try {
    const [convert, instantValidate, plainValidate, zonedValidate] =
      await Promise.all([
        GMT_MODULES["precision/convert"](),
        GMT_MODULES["precision/validate"](),
        GMT_MODULES["plain/validate"](),
        GMT_MODULES["zoned/validate"](),
      ]);
    return {
      ...pick(convert, [
        "toNanoseconds",
        "fromNanoseconds",
        "toParquetInt96",
        "fromParquetInt96",
        "toArrowTimestamp",
        "fromArrowTimestamp",
        "toArrowLocalTimestamp",
        "fromArrowLocalTimestamp",
        "toProtoTimestamp",
        "fromProtoTimestamp",
        "toProtoDuration",
        "fromProtoDuration",
      ]),
      ...pick(instantValidate, [
        "isValidInstant",
        "isValidInt64NanosecondInstant",
        "isValidInt64NanosecondDateTime",
      ]),
      ...pick(plainValidate, ["isValidDateTime"]),
      ...pick(zonedValidate, ["isValidTimeZone"]),
    } as unknown as ColumnBridgeLib;
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
}
