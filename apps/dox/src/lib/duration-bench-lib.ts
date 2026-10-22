/**
 * Loads the six real gmt functions the Duration Parser Bench calls, at module
 * granularity, and hands them back as a `DurationBenchLib`.
 *
 * `parseHumanDuration` and `parseDuration` live in `duration/parse`,
 * `formatHumanDuration` and `formatDuration` in `duration/format`, and
 * `getDurationUnit` and `totalDuration` in `duration/calculate`. Each name is
 * picked from its module and nothing else is read.
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * the widget's mount reaches it, so a rejected import, or a name a module no
 * longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

/** The functions the bench calls, as the library declares them. */
export interface DurationBenchLib {
  parseHumanDuration(text: string): string;
  parseDuration(value: string): string;
  formatHumanDuration(duration: string): string;
  formatDuration(value: string, locale?: string): string;
  getDurationUnit(value: string, unit: string): number | null;
  totalDuration(
    value: string,
    unit: string,
    options?: { relativeTo?: string },
  ): number | null;
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

export async function loadDurationBenchLib(): Promise<DurationBenchLib> {
  try {
    const [parse, format, calculate] = await Promise.all([
      GMT_MODULES["duration/parse"](),
      GMT_MODULES["duration/format"](),
      GMT_MODULES["duration/calculate"](),
    ]);
    return {
      ...pick(parse, ["parseHumanDuration", "parseDuration"]),
      ...pick(format, ["formatHumanDuration", "formatDuration"]),
      ...pick(calculate, ["getDurationUnit", "totalDuration"]),
    } as unknown as DurationBenchLib;
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
}
