import * as getLocaleEraNamesModule from "../plain/locale/getLocaleEraNames";
import * as getLocaleMeridiemsModule from "../plain/locale/getLocaleMeridiems";
import * as getLocaleMonthNamesModule from "../plain/locale/getLocaleMonthNames";
import * as getLocaleWeekdayNamesModule from "../plain/locale/getLocaleWeekdayNames";
import { MustTestLocales } from "../test/localeMatrix";
import {
  DATE_PATTERN_FIELDS,
  DATE_TIME_PATTERN_FIELDS,
  parseValueWithPattern,
  TIME_PATTERN_FIELDS,
} from "./patternToken";

describe("parseValueWithPattern", () => {
  describe("field sets", () => {
    it("DATE_PATTERN_FIELDS contains only date-shaped fields", () => {
      expect([...DATE_PATTERN_FIELDS].sort()).toEqual(
        ["day", "era", "month", "weekday", "year"].sort(),
      );
    });

    it("TIME_PATTERN_FIELDS contains only time-shaped fields", () => {
      expect([...TIME_PATTERN_FIELDS].sort()).toEqual(
        ["hour", "meridiem", "millisecond", "minute", "second"].sort(),
      );
    });

    it("DATE_TIME_PATTERN_FIELDS is the union of the other two", () => {
      const union = new Set([...DATE_PATTERN_FIELDS, ...TIME_PATTERN_FIELDS]);
      expect([...DATE_TIME_PATTERN_FIELDS].sort()).toEqual([...union].sort());
    });
  });

  describe("resolves numeric fields", () => {
    it("returns the parsed year/month/day for a simple date pattern", () => {
      expect(
        parseValueWithPattern(
          "2024-03-15",
          "yyyy-MM-dd",
          undefined,
          DATE_PATTERN_FIELDS,
        ),
      ).toEqual({ year: 2024, month: 3, day: 15 });
    });

    it("returns the parsed hour/minute/second for a simple time pattern", () => {
      expect(
        parseValueWithPattern(
          "14:30:45",
          "HH:mm:ss",
          undefined,
          TIME_PATTERN_FIELDS,
        ),
      ).toEqual({ hour: 14, minute: 30, second: 45 });
    });
  });

  describe("malformed pattern returns null", () => {
    it.each`
      description                    | pattern
      ${"letter outside vocabulary"} | ${"yyyy-QQ-dd"}
      ${"unsupported width"}         | ${"yyy-MM-dd"}
      ${"duplicate field"}           | ${"yyyy-yyyy-MM-dd"}
      ${"field outside allowed set"} | ${"yyyy-MM-dd HH"}
      ${"empty pattern"}             | ${""}
      ${"unterminated quote"}        | ${"yyyy-MM-dd'"}
    `("returns null for $description", ({ pattern }) => {
      expect(
        parseValueWithPattern(
          "2024-03-15",
          pattern,
          undefined,
          DATE_PATTERN_FIELDS,
        ),
      ).toBeNull();
    });
  });

  // UTS #35 Part 4, Date Format Patterns: "Two adjacent single vertical
  // quotes (''), which represent a literal single quote, either inside or
  // outside quoted text."
  describe("single quotes in a pattern", () => {
    it.each`
      value             | pattern              | expected                             | why
      ${"2024'01'15"}   | ${"yyyy''MM''dd"}    | ${{ year: 2024, month: 1, day: 15 }} | ${"'' outside quoted text is one literal quote"}
      ${"20240115"}     | ${"yyyy''MM''dd"}    | ${null}                              | ${"the literal quotes are missing from the value"}
      ${"''2024-01"}    | ${"''''yyyy-MM"}     | ${{ year: 2024, month: 1 }}          | ${"'''' is two literal quotes"}
      ${"'2024-01"}     | ${"''''yyyy-MM"}     | ${null}                              | ${"'''' needs two literal quotes, not one"}
      ${"it's 2024-01"} | ${"'it''s' yyyy-MM"} | ${{ year: 2024, month: 1 }}          | ${"'' inside quoted text is one literal quote"}
      ${"at 2024-01"}   | ${"'at' yyyy-MM"}    | ${{ year: 2024, month: 1 }}          | ${"quoted letters are literal text"}
      ${"'2024-01"}     | ${"'''yyyy-MM"}      | ${null}                              | ${"''' leaves the third quote unterminated"}
      ${"2024-01"}      | ${"yyyy-MM'"}        | ${null}                              | ${"a lone trailing quote is unterminated"}
      ${"2024-01'"}     | ${"yyyy-MM'"}        | ${null}                              | ${"an unterminated quote is not a literal quote"}
    `(
      'resolves "$value" against "$pattern" ($why)',
      ({ value, pattern, expected }) => {
        expect(
          parseValueWithPattern(value, pattern, undefined, DATE_PATTERN_FIELDS),
        ).toEqual(expected);
      },
    );
  });

  describe("invalid input returns null", () => {
    it("returns null for a non-matching value", () => {
      expect(
        parseValueWithPattern(
          "not a date",
          "yyyy-MM-dd",
          undefined,
          DATE_PATTERN_FIELDS,
        ),
      ).toBeNull();
    });

    it("returns null for an empty value", () => {
      expect(
        parseValueWithPattern("", "yyyy-MM-dd", undefined, DATE_PATTERN_FIELDS),
      ).toBeNull();
    });

    it("returns null for a non-string locale", () => {
      expect(
        parseValueWithPattern(
          "2024-03-15",
          "yyyy-MM-dd",
          42 as unknown as string,
          DATE_PATTERN_FIELDS,
        ),
      ).toBeNull();
    });

    it("returns null for an invalid locale when the pattern needs one (name-based token)", () => {
      expect(
        parseValueWithPattern(
          "March 15, 2024",
          "MMMM d, yyyy",
          "!!!not-a-locale!!!",
          DATE_PATTERN_FIELDS,
        ),
      ).toBeNull();
    });
  });

  // None of the 17 MustTestLocales render identical AM/PM or BCE/CE labels
  // (verified 2026-08-22 via Intl.DateTimeFormat), so the "labels coincide"
  // branches in resolvePatternFields are unreachable through real locale
  // data. Mock the locale lookups (per the "Never Monkey-Patch Real
  // Functions" rule — vi.spyOn, not a hand reassignment) to exercise them
  // directly.
  describe("meridiem/era label coincidence guard", () => {
    it("does not treat the match as PM when a locale's AM and PM labels are identical", () => {
      const spy = vi
        .spyOn(getLocaleMeridiemsModule, "getLocaleMeridiems")
        .mockReturnValue(["Period", "Period"]);
      try {
        expect(
          parseValueWithPattern(
            "02:30:45 Period",
            "hh:mm:ss a",
            "en-US",
            TIME_PATTERN_FIELDS,
          ),
        ).toEqual({ hour: 2, minute: 30, second: 45 });
      } finally {
        spy.mockRestore();
      }
    });

    it("does not treat the match as BCE when a locale's BCE and CE labels are identical", () => {
      const spy = vi
        .spyOn(getLocaleEraNamesModule, "getLocaleEraNames")
        .mockReturnValue(["Era", "Era"]);
      try {
        expect(
          parseValueWithPattern(
            "0044-01-01 Era",
            "yyyy-MM-dd GGGG",
            "en-US",
            DATE_PATTERN_FIELDS,
          ),
        ).toEqual({ year: 44, month: 1, day: 1 });
      } finally {
        spy.mockRestore();
      }
    });
  });

  // CLDR's `en` carries every English month, weekday, era and day-period
  // name; `en-US` adds none of its own (checked on ICU 78.3 / CLDR 48).
  // The default names the language, not one country
  // (coding-standards § International authority first).
  describe("name tokens default to the en locale", () => {
    it.each`
      token     | locale
      ${"MMMM"} | ${undefined}
      ${"MMM"}  | ${undefined}
      ${"EEEE"} | ${undefined}
      ${"EEE"}  | ${undefined}
      ${"a"}    | ${undefined}
      ${"GGGG"} | ${undefined}
      ${"GG"}   | ${undefined}
      ${"MMMM"} | ${[]}
      ${"a"}    | ${[]}
      ${"GG"}   | ${[]}
    `(
      "looks up $token names in en when the locale is $locale",
      ({ token, locale }: { token: string; locale: undefined | [] }) => {
        const spies = [
          vi.spyOn(getLocaleMonthNamesModule, "getLocaleMonthNames"),
          vi.spyOn(getLocaleWeekdayNamesModule, "getLocaleWeekdayNames"),
          vi.spyOn(getLocaleMeridiemsModule, "getLocaleMeridiems"),
          vi.spyOn(getLocaleEraNamesModule, "getLocaleEraNames"),
        ];
        try {
          parseValueWithPattern("x", token, locale, DATE_TIME_PATTERN_FIELDS);
          const locales = spies.flatMap((spy) =>
            spy.mock.calls.map((call) => call[0]),
          );
          expect(locales).toEqual(["en"]);
        } finally {
          for (const spy of spies) spy.mockRestore();
        }
      },
    );

    it.each`
      value                     | pattern              | expected
      ${"January 2024"}         | ${"MMMM yyyy"}       | ${{ year: 2024, month: 1 }}
      ${"February 2024"}        | ${"MMMM yyyy"}       | ${{ year: 2024, month: 2 }}
      ${"March 2024"}           | ${"MMMM yyyy"}       | ${{ year: 2024, month: 3 }}
      ${"April 2024"}           | ${"MMMM yyyy"}       | ${{ year: 2024, month: 4 }}
      ${"May 2024"}             | ${"MMMM yyyy"}       | ${{ year: 2024, month: 5 }}
      ${"June 2024"}            | ${"MMMM yyyy"}       | ${{ year: 2024, month: 6 }}
      ${"July 2024"}            | ${"MMMM yyyy"}       | ${{ year: 2024, month: 7 }}
      ${"August 2024"}          | ${"MMMM yyyy"}       | ${{ year: 2024, month: 8 }}
      ${"September 2024"}       | ${"MMMM yyyy"}       | ${{ year: 2024, month: 9 }}
      ${"October 2024"}         | ${"MMMM yyyy"}       | ${{ year: 2024, month: 10 }}
      ${"November 2024"}        | ${"MMMM yyyy"}       | ${{ year: 2024, month: 11 }}
      ${"December 2024"}        | ${"MMMM yyyy"}       | ${{ year: 2024, month: 12 }}
      ${"Jan 2024"}             | ${"MMM yyyy"}        | ${{ year: 2024, month: 1 }}
      ${"Feb 2024"}             | ${"MMM yyyy"}        | ${{ year: 2024, month: 2 }}
      ${"Mar 2024"}             | ${"MMM yyyy"}        | ${{ year: 2024, month: 3 }}
      ${"Apr 2024"}             | ${"MMM yyyy"}        | ${{ year: 2024, month: 4 }}
      ${"May 2024"}             | ${"MMM yyyy"}        | ${{ year: 2024, month: 5 }}
      ${"Jun 2024"}             | ${"MMM yyyy"}        | ${{ year: 2024, month: 6 }}
      ${"Jul 2024"}             | ${"MMM yyyy"}        | ${{ year: 2024, month: 7 }}
      ${"Aug 2024"}             | ${"MMM yyyy"}        | ${{ year: 2024, month: 8 }}
      ${"Sep 2024"}             | ${"MMM yyyy"}        | ${{ year: 2024, month: 9 }}
      ${"Oct 2024"}             | ${"MMM yyyy"}        | ${{ year: 2024, month: 10 }}
      ${"Nov 2024"}             | ${"MMM yyyy"}        | ${{ year: 2024, month: 11 }}
      ${"Dec 2024"}             | ${"MMM yyyy"}        | ${{ year: 2024, month: 12 }}
      ${"Monday 2024-03-11"}    | ${"EEEE yyyy-MM-dd"} | ${{ year: 2024, month: 3, day: 11 }}
      ${"Tuesday 2024-03-12"}   | ${"EEEE yyyy-MM-dd"} | ${{ year: 2024, month: 3, day: 12 }}
      ${"Wednesday 2024-03-13"} | ${"EEEE yyyy-MM-dd"} | ${{ year: 2024, month: 3, day: 13 }}
      ${"Thursday 2024-03-14"}  | ${"EEEE yyyy-MM-dd"} | ${{ year: 2024, month: 3, day: 14 }}
      ${"Friday 2024-03-15"}    | ${"EEEE yyyy-MM-dd"} | ${{ year: 2024, month: 3, day: 15 }}
      ${"Saturday 2024-03-16"}  | ${"EEEE yyyy-MM-dd"} | ${{ year: 2024, month: 3, day: 16 }}
      ${"Sunday 2024-03-17"}    | ${"EEEE yyyy-MM-dd"} | ${{ year: 2024, month: 3, day: 17 }}
      ${"Mon 2024-03-11"}       | ${"EEE yyyy-MM-dd"}  | ${{ year: 2024, month: 3, day: 11 }}
      ${"Tue 2024-03-12"}       | ${"EEE yyyy-MM-dd"}  | ${{ year: 2024, month: 3, day: 12 }}
      ${"Wed 2024-03-13"}       | ${"EEE yyyy-MM-dd"}  | ${{ year: 2024, month: 3, day: 13 }}
      ${"Thu 2024-03-14"}       | ${"EEE yyyy-MM-dd"}  | ${{ year: 2024, month: 3, day: 14 }}
      ${"Fri 2024-03-15"}       | ${"EEE yyyy-MM-dd"}  | ${{ year: 2024, month: 3, day: 15 }}
      ${"Sat 2024-03-16"}       | ${"EEE yyyy-MM-dd"}  | ${{ year: 2024, month: 3, day: 16 }}
      ${"Sun 2024-03-17"}       | ${"EEE yyyy-MM-dd"}  | ${{ year: 2024, month: 3, day: 17 }}
      ${"09:30 AM"}             | ${"hh:mm a"}         | ${{ hour: 9, minute: 30 }}
      ${"09:30 PM"}             | ${"hh:mm a"}         | ${{ hour: 21, minute: 30 }}
      ${"12:00 AM"}             | ${"hh:mm a"}         | ${{ hour: 0, minute: 0 }}
      ${"12:00 PM"}             | ${"hh:mm a"}         | ${{ hour: 12, minute: 0 }}
      ${"0044 Before Christ"}   | ${"yyyy GGGG"}       | ${{ year: -43 }}
      ${"2024 Anno Domini"}     | ${"yyyy GGGG"}       | ${{ year: 2024 }}
      ${"0044 BC"}              | ${"yyyy GG"}         | ${{ year: -43 }}
      ${"2024 AD"}              | ${"yyyy GG"}         | ${{ year: 2024 }}
    `(
      "parses $value against $pattern to $expected with the locale omitted, en and en-US",
      ({ value, pattern, expected }) => {
        for (const locale of [undefined, "en", MustTestLocales.enUS]) {
          expect(
            parseValueWithPattern(
              value,
              pattern,
              locale,
              DATE_TIME_PATTERN_FIELDS,
            ),
          ).toEqual(expected);
        }
      },
    );
  });

  describe("a yy token resolves only in the caller's window", () => {
    // The window names a hundred consecutive years; exactly one ends in yy.
    it.each`
      value         | options                 | expected
      ${"24-03-15"} | ${{ yearWindow: 2000 }} | ${{ year: 2024, month: 3, day: 15 }}
      ${"99-03-15"} | ${{ yearWindow: 1950 }} | ${{ year: 1999, month: 3, day: 15 }}
      ${"49-03-15"} | ${{ yearWindow: 1950 }} | ${{ year: 2049, month: 3, day: 15 }}
      ${"24-03-15"} | ${{}}                   | ${null}
      ${"24-03-15"} | ${undefined}            | ${null}
    `(
      "resolves $value against yy-MM-dd with options $options to $expected",
      ({ value, options, expected }) => {
        expect(
          parseValueWithPattern(
            value,
            "yy-MM-dd",
            undefined,
            DATE_PATTERN_FIELDS,
            options,
          ),
        ).toEqual(expected);
      },
    );

    it("reads yearWindow once for a yy pattern and never for a yyyy pattern", () => {
      let reads = 0;
      const options = {
        get yearWindow(): number {
          reads += 1;
          return 2000;
        },
      };
      expect(
        parseValueWithPattern(
          "2024-03-15",
          "yyyy-MM-dd",
          undefined,
          DATE_PATTERN_FIELDS,
          options,
        ),
      ).toEqual({ year: 2024, month: 3, day: 15 });
      expect(reads).toBe(0);
      expect(
        parseValueWithPattern(
          "24-03-15",
          "yy-MM-dd",
          undefined,
          DATE_PATTERN_FIELDS,
          options,
        ),
      ).toEqual({ year: 2024, month: 3, day: 15 });
      expect(reads).toBe(1);
    });

    it("does not read yearWindow when the value does not match the pattern", () => {
      let reads = 0;
      const options = {
        get yearWindow(): number {
          reads += 1;
          return 2000;
        },
      };
      expect(
        parseValueWithPattern(
          "not a date",
          "yy-MM-dd",
          undefined,
          DATE_PATTERN_FIELDS,
          options,
        ),
      ).toBeNull();
      expect(reads).toBe(0);
    });
  });
});
