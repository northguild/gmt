/**
 * The converter bench's library calls, free of the DOM and of any stylesheet.
 *
 * The mount draws from `converterFacts` and the page's WebMCP tool answers with it, so the two
 * cannot disagree. `ConverterLib` comes in from the caller (`loadConverterLib` in `zones-lib.ts`).
 */

/** One part of a formatted date, as `formatZonedToParts` returns it. */
export interface FormatPart {
  type: string;
  value: string;
}

/** What the bench's three sections need from gmt. */
export interface ConverterLib {
  convertZonedToZoned(value: string, timeZone: string): string;
  formatZonedToParts(value: string, locale?: string): FormatPart[];
  formatRelativeZoned(value: string, locale?: string): string;
  regexes: Record<string, RegExp>;
}

/** An exported pattern of `@northguild/gmt/regex`. */
export interface RegexConst {
  name: string;
  pattern: RegExp;
}

/** The inputs of one redraw: two value boxes (they hold the same text until a reader edits one). */
export interface ConverterState {
  convertValue: string;
  target: string;
  formatValue: string;
  locale: string;
  regexInput: string;
}

export interface ConverterFacts {
  /** `convertZonedToZoned(convertValue, target)`; `""` when the library refused. */
  converted: string;
  /** `formatZonedToParts(formatValue, locale)`; `[]` when the library refused. */
  parts: FormatPart[];
  /** `formatRelativeZoned(formatValue, locale)`; `""` when the library refused. */
  relative: string;
  /** Every exported pattern, in name order, and whether it matches `regexInput`. */
  regexMatches: { name: string; matched: boolean }[];
}

/** The exported patterns, sorted by name; the barrel's own bookkeeping keys are left out. */
export function getRegexList(regexes: Record<string, RegExp>): RegexConst[] {
  const exclude = ["__esModule"];
  return Object.keys(regexes)
    .filter((k) => !exclude.includes(k) && regexes[k] instanceof RegExp)
    .map((k) => ({ name: k, pattern: regexes[k] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every library call the bench's redraw makes, returned unchanged. */
export function converterFacts(
  state: ConverterState,
  lib: ConverterLib,
): ConverterFacts {
  const converted = lib.convertZonedToZoned(state.convertValue, state.target);
  const parts = lib.formatZonedToParts(state.formatValue, state.locale);
  const relative = lib.formatRelativeZoned(state.formatValue, state.locale);
  const regexMatches = getRegexList(lib.regexes).map(({ name, pattern }) => ({
    name,
    matched: pattern.test(state.regexInput),
  }));
  return { converted, parts, relative, regexMatches };
}

/* London and Sydney sit in opposite hemispheres, so their clocks change in
   opposite seasons. On 15 March London is on GMT and Sydney on daylight time. */
/** The bench's starting values: what the page opens on, and what its tool falls back to. */
export const CONVERTER_DEFAULTS = {
  value: "2024-03-15T14:30:00.000+00:00[Europe/London]",
  from: "Europe/London",
  to: "Australia/Sydney",
  locale: "en",
  regexInput: "2024-03-15T14:30:00",
} as const;
