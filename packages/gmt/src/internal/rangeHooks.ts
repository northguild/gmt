/*
 * CORE-112: the seam between single formatting and range formatting. This file imports nothing, so
 * a bundle that formats single dates carries only these few lines; the range repairs (D25 to D29
 * in a range, the week-year in a range) live in modules that `rangeRepairs.ts` installs here (D29 sits
 * above this seam, in `rangeFields.ts`). Every library range function calls `ensureRangeHooks`
 * before it formats, so a range never runs with nothing installed; only a bundle with no range
 * function leaves the seam empty, and a formatter there has no range to answer.
 *
 * Importers: `weekYearGuard.ts`, `yearPrinting.ts` and `weekYearRange.ts` read the seam,
 * `yearPrintingRange.ts` takes its context type, and `rangeRepairs.ts` installs it. Removing the
 * range repairs (D24, D25, D27 and D29) deletes `rangeRepairs.ts` and this file.
 */

/** The state `yearPrinting.ts` hands to the range repair of a wrapped formatter. */
export interface YearRangeContext {
  /** The formatter the wrapper stands in for. */
  readonly formatter: Intl.DateTimeFormat;
  /** The options it was built with. */
  readonly options: Intl.DateTimeFormatOptions;
  /** Its resolved options. */
  readonly resolved: Intl.ResolvedDateTimeFormatOptions;
  /** The Gregorian twin used for dates before the first Japanese era (D25). */
  readonly twin: () => Intl.DateTimeFormat;
  /** The Gregorian era name of a date before 1873 (`AD`), or `null` when none applies. */
  readonly eraNameOf: (ms: number) => string | null;
  /**
   * The engine's japanese era names of an instant from 1873 on, longest first (`Shōwa`, `S`): a
   * range pattern may write an era in another width than the single pattern does.
   */
  readonly japaneseEraNames: (ms: number) => string[];
  /** The twin's text of a date before 1873, with the Gregorian era written where the pattern puts it. */
  readonly twinText: (ms: number) => string;
  /** Whether the pattern prints an era (D25 is on for this formatter). */
  readonly eraSeat: boolean;
  /** Whether the options use `dateStyle` or `timeStyle`. */
  readonly styled: boolean;
  /** Whether D27 pads the era year of this formatter. */
  readonly pad: boolean;
  /** The formatter's own single text of an instant, repaired. */
  readonly single: (ms: number) => string;
  /** The zero of the formatter's numbering system. */
  readonly zero: string;
  /** The digits of the formatter's numbering system. */
  readonly digitSet: ReadonlySet<string>;
  /** The instants shifted by whole years that keep date and time, or `null`. */
  readonly shiftOf: (ms: number) => number | null;
}

/** What `rangeRepairs.ts` installs. */
export interface RangeHooks {
  /** The engine's range text with the week-year repaired (`formatRangeChecked`). */
  readonly checked: (
    formatter: Intl.DateTimeFormat,
    options: Intl.DateTimeFormatOptions,
    startMs: number,
    endMs: number,
  ) => string | null;
  /** The range of a formatter D25 or D27 wraps; `before` says which ends precede 1873. */
  readonly yearRange: (
    context: YearRangeContext,
    startMs: number,
    endMs: number,
    before: readonly [boolean, boolean],
  ) => string | null;
  /** The range modules' own caches, forgotten with the formatters. */
  readonly forget: readonly (() => void)[];
}

let installed: RangeHooks | undefined;
/** Stand-ins whose own `formatRange` already repairs the year. */
const handled = new WeakSet<object>();

/** Install the range repairs (called once, by `ensureRangeHooks` in `rangeRepairs.ts`). */
export function registerRangeHooks(hooks: RangeHooks): void {
  installed = hooks;
}

/** The installed range repairs, or `undefined` in a bundle that formats no range. */
export function rangeHooks(): RangeHooks | undefined {
  return installed;
}

/** Record a stand-in whose `formatRange` is the installed `checked` already. */
export function markRangeHandled(standIn: object): void {
  handled.add(standIn);
}

/** Whether the stand-in repairs its own range. */
export function isRangeHandled(formatter: object): boolean {
  return handled.has(formatter);
}

/** Forget the range modules' caches, when any are installed. */
export function forgetRanges(): void {
  for (const forget of installed?.forget ?? []) {
    forget();
  }
}
