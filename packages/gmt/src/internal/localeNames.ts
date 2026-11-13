// The locale name lists behind `getLocaleMonthNames`, `getLocaleEraNames`, `getLocaleWeekdayNames`
// and `getLocaleMeridiems`. Each never throws and returns `[]` for an invalid locale.
import { cachedFormatter } from "./formatterCache";
import { getLocaleFirstDayOfWeek } from "./getLocaleFirstDayOfWeek";
import { resolveRequiredLocale } from "./resolveLocale";
import { Temporal } from "./temporal";
import { zonedDateTimeFrom } from "./zonedWallClock";
import type { LocaleNameStyle } from "../plain/locale/getLocaleMonthNames";

// Resolve the locale once, run `build` on it, and return `[]` for an invalid locale or any
// failure (Core Rule 3: a hostile argument is invalid input, not an exception).
function listFor(
  locale: string | string[],
  build: (resolvedLocale: string) => string[],
): string[] {
  try {
    const resolvedLocale = resolveRequiredLocale(locale);
    return resolvedLocale === null ? [] : build(resolvedLocale);
  } catch {
    return [];
  }
}

function widthOf(style: LocaleNameStyle): "long" | "short" | "narrow" {
  return style === "short" || style === "narrow" ? style : "long";
}

// The names of one locale; see the public function of the same name.
export function monthNamesFor(
  locale: string | string[],
  style: LocaleNameStyle = "long",
): string[] {
  return listFor(locale, (resolvedLocale) => {
    // One formatter for the twelve dates. A PlainDate formats its own wall-clock fields
    // (Temporal `PlainDate.prototype.toLocaleString`); the same date's UTC midnight in a
    // `timeZone: "UTC"` formatter shows the same fields.
    const formatter = cachedFormatter("DateTimeFormat", resolvedLocale, {
      month: widthOf(style),
      calendar: "gregory",
      timeZone: "UTC",
    });
    const names: string[] = [];
    for (let month = 1; month <= 12; month++) {
      const date = Temporal.PlainDate.from(
        `2024-${String(month).padStart(2, "0")}-15`,
      );
      names.push(
        formatter.format(date.toZonedDateTime("UTC").epochMilliseconds),
      );
    }
    return names;
  });
}

// The names of one locale; see the public function of the same name.
export function eraNamesFor(
  locale: string | string[],
  style: LocaleNameStyle = "long",
): string[] {
  return listFor(locale, (resolvedLocale) => {
    const formatter = cachedFormatter("DateTimeFormat", resolvedLocale, {
      calendar: "gregory",
      era: widthOf(style),
      timeZone: "UTC",
    });

    // Year 1 BC (proleptic Gregorian) is year 0 in Temporal; year 1 AD is year 1.
    const eraAt = (year: number): string =>
      formatter
        .formatToParts(
          zonedDateTimeFrom({
            year,
            month: 1,
            day: 1,
            hour: 12,
            timeZone: "UTC",
            calendar: "gregory",
          }).toInstant().epochMilliseconds,
        )
        .find((part) => part.type === "era")?.value ?? "";

    return [eraAt(0), eraAt(1)];
  });
}

// The names of one locale; see the public function of the same name.
export function meridiemsFor(locale: string | string[]): string[] {
  return listFor(locale, (resolvedLocale) => {
    const formatter = cachedFormatter("DateTimeFormat", resolvedLocale, {
      timeZone: "UTC",
      hour: "numeric",
      hour12: true,
    });
    const dayPeriodAt = (epochMilliseconds: number): string =>
      formatter
        .formatToParts(epochMilliseconds)
        .find((part) => part.type === "dayPeriod")?.value ?? "";
    return [dayPeriodAt(0), dayPeriodAt(12 * 60 * 60 * 1000)];
  });
}

// The names of one locale; see the public function of the same name.
export function weekdayNamesFor(
  locale: string | string[],
  style: LocaleNameStyle = "long",
): string[] {
  try {
    const resolvedLocale = resolveRequiredLocale(locale);
    if (resolvedLocale === null) return [];

    const firstDay = getLocaleFirstDayOfWeek(resolvedLocale);
    if (firstDay === null) return [];

    try {
      const resolved = widthOf(style);
      // Build the names in ISO order (Monday-first), then rotate so the
      // locale's first day of week sits at index 0.
      // One formatter for the seven dates: a PlainDate formats its own wall-clock fields, and
      // the same date's UTC midnight in a `timeZone: "UTC"` formatter shows the same fields.
      const formatter = cachedFormatter("DateTimeFormat", resolvedLocale, {
        weekday: resolved,
        timeZone: "UTC",
      });
      const isoOrder: string[] = [];
      for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
        const date = Temporal.PlainDate.from("2024-01-15").add({
          days: dayOfWeek - 1,
        });
        isoOrder.push(
          formatter.format(date.toZonedDateTime("UTC").epochMilliseconds),
        );
      }
      return isoOrder
        .slice(firstDay - 1)
        .concat(isoOrder.slice(0, firstDay - 1));
    } catch {
      return [];
    }
  } catch {
    // Never throws (Core Rule 3): a hostile
    // argument is invalid input, not an exception.
    return [];
  }
}
