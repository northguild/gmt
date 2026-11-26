/**
 * Loads the functions and patterns the FHIR Date Checker needs, at module granularity, and hands
 * them back as a `FhirLib`.
 *
 * Six modules: `healthcare/parse` (`parseFHIR`), `healthcare/validate` (`isValidFHIR`),
 * `healthcare/format` (`formatFHIR`), `regex` (`fhirDate`, `fhirDateTime`, `fhirInstant`: the
 * namespace barrel is its narrowest import), `instant/convert` (`toOffsetInstant`) and
 * `timescale/validate` (`isLeapSecond`). Each name is picked and nothing else is read.
 *
 * A heavy module: it is never imported statically from the chat island. Only the widget's mount
 * reaches it, so a rejected import, or a name a module no longer exports, becomes a
 * `WidgetLoadError` rather than a dead control.
 */
import type {
  FhirDateTime,
  FhirDateType,
  FhirFormatOptions,
} from "@northguild/gmt/types";
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";

/** The functions and patterns the Checker uses, as the library declares them. */
export interface FhirLib {
  parseFHIR(value: string): FhirDateTime | null;
  isValidFHIR(value: string, type: FhirDateType): boolean;
  formatFHIR(
    value: string,
    type: FhirDateType,
    options?: FhirFormatOptions,
  ): string;
  toOffsetInstant(value: string): { instant: string; offset: string } | null;
  isLeapSecond(value: string): boolean;
  fhirDate: RegExp;
  fhirDateTime: RegExp;
  fhirInstant: RegExp;
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

/** Reads each pattern from a module, and fails loudly on a name that is not a `RegExp`. */
function pickPatterns(
  module: Record<string, unknown>,
  names: readonly string[],
) {
  return Object.fromEntries(
    names.map((name) => {
      if (!(module[name] instanceof RegExp)) {
        throw new Error(`The library module has no pattern ${name}.`);
      }
      return [name, module[name]];
    }),
  );
}

export async function loadFhirLib(): Promise<FhirLib> {
  try {
    const [parse, validate, format, regex, convert, timescale] =
      await Promise.all([
        GMT_MODULES["healthcare/parse"](),
        GMT_MODULES["healthcare/validate"](),
        GMT_MODULES["healthcare/format"](),
        GMT_MODULES["regex"](),
        GMT_MODULES["instant/convert"](),
        GMT_MODULES["timescale/validate"](),
      ]);
    return {
      ...pick(parse, ["parseFHIR"]),
      ...pick(validate, ["isValidFHIR"]),
      ...pick(format, ["formatFHIR"]),
      ...pickPatterns(regex, ["fhirDate", "fhirDateTime", "fhirInstant"]),
      ...pick(convert, ["toOffsetInstant"]),
      ...pick(timescale, ["isLeapSecond"]),
    } as unknown as FhirLib;
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}
