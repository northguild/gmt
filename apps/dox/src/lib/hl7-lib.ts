/**
 * Loads the functions the HL7 Timestamp Reader needs, at module granularity, and hands them back
 * as an `Hl7Lib`.
 *
 * Four modules: `healthcare/parse` (`parseHL7`), `healthcare/format` (`formatHL7`),
 * `instant/convert` (`resolveLocal`, `classifyLocal`, `toOffsetInstant`, `fromOffsetInstant`) and `utc/calculate`
 * (`minUtc`, `maxUtc`, `diffUtcAsDuration`). Each name is picked and nothing else is read.
 * `Hl7Lib` is a superset of what `resolveInZone` and `widestGap` take (`edi-widgets.ts`).
 *
 * A heavy module: it is never imported statically from the chat island. Only the widget's mount
 * reaches it, so a rejected import, or a name a module no longer exports, becomes a
 * `WidgetLoadError` rather than a dead control.
 */
import type { Hl7DateTime, Hl7FormatOptions } from "@northguild/gmt/types";
import type { EdiLib } from "./edi-widgets";
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

/** The functions the Reader calls, as the library declares them. */
export interface Hl7Lib extends Pick<
  EdiLib,
  | "resolveLocal"
  | "classifyLocal"
  | "toOffsetInstant"
  | "fromOffsetInstant"
  | "minUtc"
  | "maxUtc"
  | "diffUtcAsDuration"
> {
  parseHL7(value: string): Hl7DateTime | null;
  formatHL7(value: string, options?: Hl7FormatOptions): string;
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

export async function loadHl7Lib(): Promise<Hl7Lib> {
  try {
    const [parse, format, convert, utcCalculate] = await Promise.all([
      GMT_MODULES["healthcare/parse"](),
      GMT_MODULES["healthcare/format"](),
      GMT_MODULES["instant/convert"](),
      GMT_MODULES["utc/calculate"](),
    ]);
    return {
      ...pick(parse, ["parseHL7"]),
      ...pick(format, ["formatHL7"]),
      ...pick(convert, [
        "resolveLocal",
        "classifyLocal",
        "toOffsetInstant",
        "fromOffsetInstant",
      ]),
      ...pick(utcCalculate, ["minUtc", "maxUtc", "diffUtcAsDuration"]),
    } as unknown as Hl7Lib;
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}
