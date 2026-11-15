import { isJapaneseNumberingSystemCompatNeeded } from "./temporalCompat/capabilities";
import { showsEraOrYear } from "./yearPrinting";
import { digitRuns, digitSetOf } from "./weekYearText";

/*
 * CORE-112 slice 7, defect D27 (numbering system): the era year of a `ja` japanese formatter. It
 * sits under the week-year guard, so the guard reads the same digits in every field, and it is the
 * only place beside the range check that calls a formatter's `formatRange`. Deleting this file and
 * its hook in `formatterCache.ts` retires the repair with its probe.
 */

/**
 * The formatter itself, or a wrapper that writes the era year of a `ja` japanese formatter in the
 * formatter's numbering system (D27, ICU's `jpanyear` ignores `nu`; ECMA-402 FormatNumeric).
 *
 * `jpanyear` prints the era year in Latin digits while every other number honours `nu`, so each run
 * of Latin digits in the text is the era year: no parts are read from the text, and the week-year
 * guard above this wrapper sees the same digits in every field. `year: "2-digit"` becomes
 * `minimumIntegerDigits: 2`. 元 is a name, not a number, and stays.
 *
 * @param formatter the formatter to wrap (the engine's, before the week-year guard)
 * @param callerOptions the options it was built with
 * @returns the formatter, or its wrapper
 *
 * @example repairEraYearNumerals(new Intl.DateTimeFormat("en"), {}) // the same formatter
 * @example repairEraYearNumerals(new Intl.DateTimeFormat("ja-u-ca-japanese-nu-arab", { year: "numeric", timeZone: "UTC" }), { year: "numeric", timeZone: "UTC" }).format(Date.UTC(2024, 6, 10)) // "令和٦年" where the engine prints 令和6年
 */
export function repairEraYearNumerals(
  formatter: Intl.DateTimeFormat,
  callerOptions: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  let resolved: Intl.ResolvedDateTimeFormatOptions;
  try {
    resolved = formatter.resolvedOptions();
  } catch {
    return formatter;
  }
  const { calendar, numberingSystem } = resolved;
  if (
    calendar !== "japanese" ||
    numberingSystem === "latn" ||
    !showsEraOrYear(callerOptions) ||
    new Intl.Locale(resolved.locale).language !== "ja" ||
    !isJapaneseNumberingSystemCompatNeeded()
  ) {
    return formatter;
  }
  const latin = digitSetOf("latn");
  const yearDigits = new Intl.NumberFormat(resolved.locale, {
    numberingSystem,
    useGrouping: false,
    minimumIntegerDigits: callerOptions.year === "2-digit" ? 2 : 1,
  });
  const written = (text: string): string =>
    digitRuns(text, latin)
      .filter((run) => [...run.text].every((digit) => latin.has(digit)))
      .toReversed()
      .reduce(
        (out, run) =>
          out.slice(0, run.start) +
          yearDigits.format(Number(run.text)) +
          out.slice(run.start + run.text.length),
        text,
      );
  const writtenParts = (
    parts: Intl.DateTimeFormatPart[],
  ): Intl.DateTimeFormatPart[] =>
    parts.map((part) =>
      part.type === "year" ? { ...part, value: written(part.value) } : part,
    );
  return {
    format: (date?: Date | number): string => written(formatter.format(date)),
    formatToParts: (date?: Date | number): Intl.DateTimeFormatPart[] =>
      writtenParts(formatter.formatToParts(date)),
    formatRange: (start: Date | number, end: Date | number): string =>
      written(formatter.formatRange(start, end)),
    formatRangeToParts: (
      start: Date | number,
      end: Date | number,
    ): Intl.DateTimeRangeFormatPart[] =>
      writtenParts(
        formatter.formatRangeToParts(start, end),
      ) as Intl.DateTimeRangeFormatPart[],
    resolvedOptions: (): Intl.ResolvedDateTimeFormatOptions => resolved,
  } as Intl.DateTimeFormat;
}
