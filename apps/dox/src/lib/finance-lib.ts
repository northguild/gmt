/**
 * Loads the finance functions the finance tools need, at module granularity, and hands them
 * back as a `FinanceLib`.
 *
 * The FIX Timestamp Reader (FIN-95) reads `parseFixUtcTimestamp` from `finance/parse`,
 * `formatFixUtcTimestamp` from `finance/format` and `isValidFixUtcTimestamp` from
 * `finance/validate`. The SWIFT Value Date Reader (FIN-96) reads `parseSwiftDate`,
 * `formatSwiftDate` and `isValidSwiftDate` from the same three modules, and `isValidDate` from
 * `plain/validate`. Nothing else is read. Both tools are built and share this loader and
 * `FinanceLib` (`finance-widgets.ts`).
 *
 * A heavy module: it is never imported statically from the chat island. Only the widget's mount
 * reaches it, so a rejected import, or a name a module no longer exports, becomes a
 * `WidgetLoadError` rather than a dead control.
 */
import { GMT_MODULES } from "./gmt-modules";
import type { FinanceLib } from "./finance-widgets";
import { WidgetLoadError } from "./widget-mount";

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

export async function loadFinanceLib(): Promise<FinanceLib> {
  try {
    const [parse, format, validate, plainValidate] = await Promise.all([
      GMT_MODULES["finance/parse"](),
      GMT_MODULES["finance/format"](),
      GMT_MODULES["finance/validate"](),
      GMT_MODULES["plain/validate"](),
    ]);
    return {
      ...pick(parse, ["parseFixUtcTimestamp", "parseSwiftDate"]),
      ...pick(format, ["formatFixUtcTimestamp", "formatSwiftDate"]),
      ...pick(validate, ["isValidFixUtcTimestamp", "isValidSwiftDate"]),
      ...pick(plainValidate, ["isValidDate"]),
    } as unknown as FinanceLib;
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
}
