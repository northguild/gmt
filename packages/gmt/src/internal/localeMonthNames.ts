import { getLocaleMonthNames } from "../plain/locale/getLocaleMonthNames";
import { cachedFormatter } from "./formatterCache";
import { Temporal } from "./temporal";

/**
 * A locale's twelve month names in both contexts, January first.
 *
 * UTS #35 Part 4, Date Field Symbol Table, Month rows: `M` is the format context and `L`
 * the stand-alone context; "patterns that combine month with day-of month (e.g. "d MMMM")
 * may require the month to be in genitive form".
 */
export interface LocaleMonthNames {
  /** Names as written next to a day number (`ru` "марта", `de` short "März"). */
  readonly format: readonly string[];
  /** Names as written alone (`ru` "март", `de` short "Mär"). */
  readonly standAlone: readonly string[];
}

const ALL_DIGITS = /^\p{Nd}+$/u;

/**
 * Read a locale's month names in the format and the stand-alone context.
 *
 * - The stand-alone list is {@link getLocaleMonthNames}. The format list comes from
 *   `formatToParts` on a month-and-day pattern, so the locale picks its own form.
 * - A locale that writes the month as a number beside a day (pt-PT short, zh-CN, zh-TW,
 *   ja-JP) has no format name there, so that month takes its stand-alone name.
 * - Returns `null` when one name, compared case-insensitively, names two different months
 *   across both lists: UTS #35 Part 4, Parsing Dates and Times, matches stand-alone forms
 *   only "if they are unique".
 * - The format formatter forces `numberingSystem: "latn"`: a `-u-nu-` locale such as `hanidec`
 *   prints a numeric month in letters (一, 二, 一〇) that `\p{Nd}` does not match, so a numeric
 *   month would be read as a name. With Latin digits it always reaches the stand-alone fallback.
 * - Never throws. The options carry no `year`, so no pattern with a year is formatted.
 *
 * @param locale A resolved BCP 47 tag
 * @param width `"long"` or `"short"`
 * @returns Both lists, or `null` for an unresolvable locale or an ambiguous name
 * @example localeMonthNames("ru-RU", "long") // { format: ["января", …, "марта", …], standAlone: ["январь", …, "март", …] }
 * @example localeMonthNames("not-a-locale-!!", "long") // null
 */
export function localeMonthNames(
  locale: string,
  width: "long" | "short",
): LocaleMonthNames | null {
  try {
    const standAlone = getLocaleMonthNames(locale, width);
    if (standAlone.length !== 12) return null;

    const formatter = cachedFormatter("DateTimeFormat", locale, {
      month: width,
      day: "numeric",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: "UTC",
    });
    const format: string[] = [];
    for (let month = 1; month <= 12; month++) {
      const epochMilliseconds = Temporal.PlainDate.from(
        `2024-${String(month).padStart(2, "0")}-15`,
      ).toZonedDateTime("UTC").epochMilliseconds;
      const part = formatter
        .formatToParts(epochMilliseconds)
        .find((candidate) => candidate.type === "month");
      const text = part?.value ?? "";
      format.push(
        text === "" || ALL_DIGITS.test(text)
          ? (standAlone[month - 1] as string)
          : text,
      );
    }

    // name (lower-cased) -> the month it names; a second month is a collision.
    const owner = new Map<string, number>();
    for (const list of [format, standAlone]) {
      for (const [index, name] of list.entries()) {
        const key = name.toLowerCase();
        const seen = owner.get(key);
        if (seen !== undefined && seen !== index) return null;
        owner.set(key, index);
      }
    }
    return { format, standAlone };
  } catch {
    return null;
  }
}
