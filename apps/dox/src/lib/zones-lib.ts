/**
 * Loads the real gmt functions the zone widgets need, at module granularity, for the widget's
 * mount and for its WebMCP tool.
 *
 * A heavy module: it is never imported statically from the chat island. Each loader turns a
 * failed import into a `WidgetLoadError` itself, because the mount and the tool both call it and
 * neither needs to wrap the cause.
 */
import type { ConverterLib } from "./converter-bench";
import type { DstLib } from "./dst-inspector";
import { GMT_MODULES } from "./gmt-modules";
import {
  INTERVAL_OPERATIONS,
  type IntervalFn,
  type IntervalLib,
  type IntervalOperationId,
} from "./interval-visualizer";
import { WidgetLoadError } from "./widget-mount";

/** `convertZonedToZoned`, the two formatters and the regex constants. */
export async function loadConverterLib(): Promise<ConverterLib> {
  try {
    const [convMod, fmtMod, regexMod] = await Promise.all([
      GMT_MODULES["zoned/convert"](),
      GMT_MODULES["zoned/format"](),
      GMT_MODULES["regex"](),
    ]);
    return {
      convertZonedToZoned: convMod[
        "convertZonedToZoned"
      ] as ConverterLib["convertZonedToZoned"],
      formatZonedToParts: fmtMod[
        "formatZonedToParts"
      ] as ConverterLib["formatZonedToParts"],
      formatRelativeZoned: fmtMod[
        "formatRelativeZoned"
      ] as ConverterLib["formatRelativeZoned"],
      regexes: regexMod as Record<string, RegExp>,
    };
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}

/** `getDstTransitions` and `convertPlainDateTimeToZoned`. */
export async function loadDstLib(): Promise<DstLib> {
  try {
    const [getMod, convertMod] = await Promise.all([
      GMT_MODULES["zoned/get"](),
      GMT_MODULES["zoned/convert"](),
    ]);
    return {
      getDstTransitions: getMod[
        "getDstTransitions"
      ] as DstLib["getDstTransitions"],
      convertPlainDateTimeToZoned: convertMod[
        "convertPlainDateTimeToZoned"
      ] as DstLib["convertPlainDateTimeToZoned"],
    };
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}

/** The four interval operations and the two checks that say why one refused. */
export async function loadIntervalLib(): Promise<IntervalLib> {
  try {
    const [intervalMod, validateMod] = await Promise.all([
      GMT_MODULES["zoned/interval"](),
      GMT_MODULES["zoned/validate"](),
    ]);
    const fns = {} as Record<IntervalOperationId, IntervalFn>;
    for (const op of INTERVAL_OPERATIONS) {
      fns[op.id] = intervalMod[op.fnName] as IntervalFn;
    }
    return {
      fns,
      isValidZonedDateTime: validateMod[
        "isValidZonedDateTime"
      ] as IntervalLib["isValidZonedDateTime"],
      isValidZonedRange: validateMod[
        "isValidZonedRange"
      ] as IntervalLib["isValidZonedRange"],
    };
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}
