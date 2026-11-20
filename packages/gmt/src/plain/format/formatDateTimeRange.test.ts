import { normalizeDateTime } from "../../internal";
import {
  expectOneOfIcu,
  localeDateTimeRangeInputByLocale,
  MustTestLocales,
  oneOfIcu,
  arSAGregorian,
  fixtureLocale,
} from "../../test";
import { hostPlainRangeText } from "../../test/hostIntl";
import { formatDateTimeRange } from "./formatDateTimeRange";

describe("formatDateTimeRange", () => {
  const rangeByLocale = localeDateTimeRangeInputByLocale;

  it.each`
    locale                  | options
    ${MustTestLocales.enUS} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.enUS} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.enUS} | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.enGB} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.enGB} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.enGB} | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.deDE} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.deDE} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.deDE} | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.frFR} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.frFR} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.frFR} | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.esES} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.esES} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.esES} | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.itIT} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.itIT} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.itIT} | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.ptPT} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.ptPT} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.ptPT} | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.svSE} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.svSE} | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.isIS} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.isIS} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.isIS} | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.zhCN} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.zhCN} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.zhCN} | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.jaJP} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.jaJP} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.jaJP} | ${{ hour: "numeric", minute: "numeric" }}
    ${arSAGregorian}        | ${{ dateStyle: "long", timeStyle: "long" }}
    ${arSAGregorian}        | ${{ dateStyle: "short", timeStyle: "short" }}
    ${arSAGregorian}        | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.heIL} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.heIL} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.heIL} | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.ruRU} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.ruRU} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.ruRU} | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.trTR} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.trTR} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.trTR} | ${{ hour: "numeric", minute: "numeric" }}
  `(
    "formats a valid datetime range for locale $locale with options $options in the host's wording",
    ({ locale, options }) => {
      const { start, end } = rangeByLocale[fixtureLocale(locale)];
      expect(formatDateTimeRange(start, end, locale, options)).toBe(
        hostPlainRangeText(locale, options, start, end),
      );
    },
  );

  // sv-SE long/long — ICU 77 (Node 22.16–22.22) renders the digit-adjacent en dash
  // with no surrounding space; ICU 78 (Node 22.23+, 24, 26) inserts a space around
  // it. Same CLDR range-separator spacing revision as formatDateRange's
  // en-GB/sv-SE cases.
  it("formats a valid datetime range for sv-SE with dateStyle/timeStyle long as one of the known ICU variants", () => {
    const { start, end } = rangeByLocale[MustTestLocales.svSE];
    expectOneOfIcu(
      formatDateTimeRange(start, end, MustTestLocales.svSE, {
        dateStyle: "long",
        timeStyle: "long",
      }),
      oneOfIcu(
        normalizeDateTime("3 februari 2024 14:30:45-16:46:15"),
        normalizeDateTime("3 februari 2024 14:30:45 - 16:46:15"),
      ),
    );
  });

  // zh-TW and ko-KR: the day period (下午/오후, or "PM" in some ICU builds) is the host's wording.
  it.each`
    locale                  | options
    ${MustTestLocales.zhTW} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.zhTW} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.zhTW} | ${{ hour: "numeric", minute: "numeric" }}
    ${MustTestLocales.koKR} | ${{ dateStyle: "long", timeStyle: "long" }}
    ${MustTestLocales.koKR} | ${{ dateStyle: "short", timeStyle: "short" }}
    ${MustTestLocales.koKR} | ${{ hour: "numeric", minute: "numeric" }}
  `(
    "formats a valid datetime range for locale $locale with options $options, day period in the host's wording",
    ({ locale, options }) => {
      const { start, end } = rangeByLocale[fixtureLocale(locale)];
      expect(formatDateTimeRange(start, end, locale, options)).toBe(
        hostPlainRangeText(locale, options, start, end),
      );
    },
  );

  it.each`
    scenario        | start                    | end                      | expected
    ${"same-day"}   | ${"2024-02-03T09:00:00"} | ${"2024-02-03T17:00:00"} | ${"February 3, 2024, 9:00 AM – 5:00 PM"}
    ${"same-month"} | ${"2024-02-03T09:00:00"} | ${"2024-02-10T17:00:00"} | ${"February 3, 2024 at 9:00 AM – February 10, 2024 at 5:00 PM"}
    ${"same-year"}  | ${"2024-02-03T09:00:00"} | ${"2024-06-10T17:00:00"} | ${"February 3, 2024 at 9:00 AM – June 10, 2024 at 5:00 PM"}
    ${"cross-year"} | ${"2024-11-03T09:00:00"} | ${"2025-02-10T17:00:00"} | ${"November 3, 2024 at 9:00 AM – February 10, 2025 at 5:00 PM"}
    ${"reversed"}   | ${"2024-02-10T17:00:00"} | ${"2024-02-03T09:00:00"} | ${"February 10, 2024 at 5:00 PM – February 3, 2024 at 9:00 AM"}
    ${"identical"}  | ${"2024-02-03T09:00:00"} | ${"2024-02-03T09:00:00"} | ${"February 3, 2024 at 9:00 AM"}
  `(
    "collapses/elides correctly for a $scenario range ($start -> $end)",
    ({ start, end, expected }) => {
      expect(
        formatDateTimeRange(start, end, MustTestLocales.enUS, {
          dateStyle: "long",
          timeStyle: "short",
        }),
      ).toBe(normalizeDateTime(expected));
    },
  );

  it.each`
    start                    | end                      | label
    ${"invalid"}             | ${"2024-02-05T17:00:00"} | ${"'invalid'"}
    ${"2024-02-03T09:00:00"} | ${"invalid"}             | ${"'2024-02-03T09:00:00'"}
    ${"invalid"}             | ${"invalid"}             | ${"'invalid'"}
    ${"2024-02-30T09:00:00"} | ${"2024-02-05T17:00:00"} | ${"'2024-02-30T09:00:00'"}
    ${""}                    | ${"2024-02-05T17:00:00"} | ${"''"}
    ${null}                  | ${"2024-02-05T17:00:00"} | ${"null"}
    ${undefined}             | ${"2024-02-05T17:00:00"} | ${"undefined"}
    ${123}                   | ${"2024-02-05T17:00:00"} | ${"123"}
  `(
    "returns empty string when either endpoint is invalid or non-string: $label -> $end",
    ({ start, end }) => {
      expect(
        formatDateTimeRange(start as never, end, MustTestLocales.enUS),
      ).toBe("");
    },
  );

  // Temporal ECMA-402 PlainDateTime format (GetDateTimeFormat ~any~, ~all~,
  // inherit ~relevant~): requested widths are kept, `era` alone still gets the
  // date and time defaults, and `timeZoneName` is not inherited. Expected
  // values: native Intl.DateTimeFormat#formatRange at UTC with the adjusted
  // options.
  it.each`
    locale                  | options                                                               | expected                                           | reason
    ${MustTestLocales.zhCN} | ${{ year: "numeric", month: "long" }}                                 | ${"2024年2月"}                                     | ${"requested long month kept"}
    ${MustTestLocales.zhCN} | ${{ year: "numeric", month: "numeric" }}                              | ${"2024/2"}                                        | ${"numeric fields give the pre-1.16.0 text"}
    ${MustTestLocales.enUS} | ${{ era: "long" }}                                                    | ${"2/3/2024 Anno Domini, 9:00:00 AM - 5:30:00 PM"} | ${"era alone gets the date and time defaults"}
    ${MustTestLocales.enUS} | ${{ era: "long", year: "numeric", month: "numeric", day: "numeric" }} | ${"2/3/2024 Anno Domini"}                          | ${"date fields give the pre-1.16.0 era text"}
    ${MustTestLocales.enUS} | ${{ timeZoneName: "short" }}                                          | ${"2/3/2024, 9:00:00 AM - 5:30:00 PM"}             | ${"timeZoneName is not inherited, defaults apply"}
    ${MustTestLocales.enUS} | ${{ dateStyle: "short", timeStyle: "full" }}                          | ${"2/3/24, 9:00:00 AM - 5:30:00 PM"}               | ${"short date width kept, zone field removed"}
  `(
    "formats 2024-02-03T09:00 to 2024-02-03T17:30 in $locale with $options to $expected ($reason)",
    ({ locale, options, expected }) => {
      expect(
        formatDateTimeRange(
          "2024-02-03T09:00",
          "2024-02-03T17:30",
          locale,
          options,
        ),
      ).toBe(expected);
    },
  );

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
  // is used, and a malformed tag anywhere in the list is invalid input. Expected strings from native
  // Intl with the same list.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"14:30 – 16:46"}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `("returns '$expected' for locale list $locale", ({ locale, expected }) => {
    expect(
      formatDateTimeRange(
        "2024-02-03T14:30:45",
        "2024-02-03T16:46:15",
        locale,
        { hour: "numeric", minute: "numeric" },
      ),
    ).toBe(normalizeDateTime(expected));
  });
});

// Plan #14: ECMA-402 CoerceOptionsToObject throws TypeError for null options and wraps any other
// primitive with ToObject, which carries no formatting fields, so a string or number formats with
// the defaults. Expected strings from native Chromium 153 (`toLocaleString("en-US", 1)` and
// `new Intl.DateTimeFormat("en-US", null)`, which throws); the en dash is written as `-`, as GMT normalizes
// every formatted string (internal/normalizeDateTime).
describe("formatDateTimeRange with primitive options", () => {
  it.each`
    options   | expected
    ${null}   | ${""}
    ${"long"} | ${"2/3/2024, 2:30:00 PM - 2/5/2024, 5:00:00 PM"}
    ${1}      | ${"2/3/2024, 2:30:00 PM - 2/5/2024, 5:00:00 PM"}
  `("returns '$expected' for options $options", ({ options, expected }) => {
    expect(
      formatDateTimeRange(
        "2024-02-03T14:30:00",
        "2024-02-05T17:00:00",
        MustTestLocales.enUS,
        options as never,
      ),
    ).toBe(expected);
  });
});

// ECMA-402 GetOption step 1 is Get(options, property), which follows the prototype chain, so an
// inherited option is read exactly as the same option held as an own property. Here the date is 15
// March 2024, a Friday, so dateStyle "full" in en-US names the weekday.
describe("formatDateTimeRange with inherited options", () => {
  it.each`
    label          | options
    ${"own"}       | ${{ dateStyle: "full" }}
    ${"inherited"} | ${Object.create({ dateStyle: "full" })}
  `(
    "formats with $label options { dateStyle: 'full' }, an inherited option being read like an own one",
    ({ options }) => {
      expect(
        formatDateTimeRange(
          "2024-03-15T20:00:00",
          "2024-03-17T20:00:00",
          "en-US",
          options,
        ),
      ).toBe("Friday, March 15 - Sunday, March 17, 2024");
    },
  );
});

// ECMA-402 GetOption would turn an object option into its ToString. A function accepts a
// string for a string option and nothing else, so it returns its sentinel and the caller's
// toString() is never run.
describe("formatDateTimeRange with an option that is an object", () => {
  it("returns the sentinel for month given as an object, and never calls its toString()", () => {
    let coercions = 0;
    const month = {
      toString() {
        coercions += 1;
        return coercions === 1 ? "long" : "narrow";
      },
    };
    const out = formatDateTimeRange(
      "2024-03-15T20:00:00",
      "2024-03-17T20:00:00",
      "en-US",
      { month, day: "numeric" } as never,
    );
    expect({ out, coercions }).toEqual({ out: "", coercions: 0 });
  });

  // D25: the same era widths for a range with times (the `-u-ca-gregory` twin's text).
  it("prints the Gregorian era in a ja japanese date-time range before 1873: 西暦1700/7/10 9:05～西暦1700/7/12 10:06", () => {
    expect(
      formatDateTimeRange(
        "1700-07-10T09:05:00",
        "1700-07-12T10:06:00",
        "ja-u-ca-japanese",
        {
          era: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
        } as Intl.DateTimeFormatOptions,
      ),
    ).toBe("西暦1700/7/10 9:05～西暦1700/7/12 10:06");
  });
});
