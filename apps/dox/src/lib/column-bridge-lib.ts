/**
 * Loads the functions the Column Timestamp Bridge needs, at module
 * granularity, and hands them back as a `ColumnBridgeLib`.
 *
 * Three modules: `precision/convert` holds the eight column converters and
 * `toNanoseconds` / `fromNanoseconds`, `precision/validate` holds
 * `isValidInstant` and `plain/validate` holds `isValidDateTime`. Each name is
 * picked and nothing else is read. Follows `identifier-lib.ts`.
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * the widget's mount reaches it, so a rejected import, or a name a module no
 * longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import type {
  ArrowTimestampOptions,
  ArrowTimestampValue,
  ParquetInt96,
  ProtoDuration,
  ProtoTimestamp,
} from "@northguild/gmt";
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

export type {
  ArrowTimestampOptions,
  ArrowTimestampValue,
  ParquetInt96,
  ProtoDuration,
  ProtoTimestamp,
};

/** The functions the tool calls, as the library declares them. */
export interface ColumnBridgeLib {
  toNanoseconds(iso: string): bigint;
  fromNanoseconds(ns: bigint, timeZone?: string): string;
  toParquetInt96(iso: string): ParquetInt96 | null;
  fromParquetInt96(value: ParquetInt96 | Uint8Array): string;
  toArrowTimestamp(iso: string, options: ArrowTimestampOptions): bigint;
  fromArrowTimestamp(
    value: bigint,
    options: ArrowTimestampOptions,
  ): ArrowTimestampValue | null;
  toProtoTimestamp(iso: string): ProtoTimestamp | null;
  fromProtoTimestamp(value: ProtoTimestamp): string;
  toProtoDuration(iso: string): ProtoDuration | null;
  fromProtoDuration(value: ProtoDuration): string;
  isValidInstant(value: string): boolean;
  isValidDateTime(value: string): boolean;
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
    const [convert, instantValidate, plainValidate] = await Promise.all([
      GMT_MODULES["precision/convert"](),
      GMT_MODULES["precision/validate"](),
      GMT_MODULES["plain/validate"](),
    ]);
    return {
      ...pick(convert, [
        "toNanoseconds",
        "fromNanoseconds",
        "toParquetInt96",
        "fromParquetInt96",
        "toArrowTimestamp",
        "fromArrowTimestamp",
        "toProtoTimestamp",
        "fromProtoTimestamp",
        "toProtoDuration",
        "fromProtoDuration",
      ]),
      ...pick(instantValidate, ["isValidInstant"]),
      ...pick(plainValidate, ["isValidDateTime"]),
    } as unknown as ColumnBridgeLib;
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
}
