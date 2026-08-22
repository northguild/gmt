import { describe, expect, it } from "vitest";
import { MustTestLocales } from "../../test";
import { getLocaleEraNames } from "../locale/getLocaleEraNames";
import { getLocaleMeridiems } from "../locale/getLocaleMeridiems";
import { getLocaleMonthNames } from "../locale/getLocaleMonthNames";
import { getLocaleWeekdayNames } from "../locale/getLocaleWeekdayNames";
import { parseDateTimeWithPattern } from "./parseDateTimeWithPattern";

describe("parseDateTimeWithPattern", () => {
  describe("combined numeric date + time tokens", () => {
    it.each`
      value                    | pattern                  | expected
      ${"03/15/2024 14:30:00"} | ${"MM/dd/yyyy HH:mm:ss"} | ${"2024-03-15T14:30:00"}
      ${"3/5/2024 9:5:3"}      | ${"M/d/yyyy H:m:s"}      | ${"2024-03-05T09:05:03"}
      ${"2024-03-15"}          | ${"yyyy-MM-dd"}          | ${"2024-03-15T00:00:00"}
    `(
      "parses $value against $pattern to $expected",
      ({ value, pattern, expected }) => {
        expect(parseDateTimeWithPattern(value, pattern)).toBe(expected);
      },
    );

    it('returns "" for a time-only pattern — year/month/day are required by Temporal.PlainDateTime.from, unlike PlainTime', () => {
      expect(parseDateTimeWithPattern("14:30:00", "HH:mm:ss")).toBe("");
    });

    it("parses hh (12h, zero-padded) combined with a individually", () => {
      expect(
        parseDateTimeWithPattern(
          "03/15/2024 02:30:00 PM",
          "MM/dd/yyyy hh:mm:ss a",
        ),
      ).toBe("2024-03-15T14:30:00");
    });

    it("parses h (12h, 1-2 digits) combined with a individually", () => {
      expect(
        parseDateTimeWithPattern(
          "03/15/2024 2:30:00 PM",
          "MM/dd/yyyy h:mm:ss a",
        ),
      ).toBe("2024-03-15T14:30:00");
    });

    it("parses SSS (milliseconds) individually", () => {
      expect(
        parseDateTimeWithPattern(
          "03/15/2024 14:30:00.123",
          "MM/dd/yyyy HH:mm:ss.SSS",
        ),
      ).toBe("2024-03-15T14:30:00.123");
    });

    it("defaults to AM (12 -> 0) when hh is used without an a token", () => {
      expect(
        parseDateTimeWithPattern("03/15/2024 12:30:00", "MM/dd/yyyy hh:mm:ss"),
      ).toBe("2024-03-15T00:30:00");
    });
  });

  describe("literal text", () => {
    it("matches a literal separator not requiring quoting", () => {
      expect(
        parseDateTimeWithPattern("2024/03/15 14.30.00", "yyyy/MM/dd HH.mm.ss"),
      ).toBe("2024-03-15T14:30:00");
    });

    it("matches a quoted literal segment verbatim", () => {
      expect(
        parseDateTimeWithPattern(
          "Date: 2024-03-15 14:30:00",
          "'Date: 'yyyy-MM-dd HH:mm:ss",
        ),
      ).toBe("2024-03-15T14:30:00");
    });

    it("matches a doubled '' inside a quoted segment as one literal quote character", () => {
      expect(
        parseDateTimeWithPattern(
          "it's 2024-03-15 14:30:00",
          "'it''s' yyyy-MM-dd HH:mm:ss",
        ),
      ).toBe("2024-03-15T14:30:00");
    });

    it('returns "" for an unterminated quote (malformed pattern)', () => {
      expect(
        parseDateTimeWithPattern("2024-03-15 14:30:00", "yyyy-MM-dd HH:mm:ss'"),
      ).toBe("");
    });
  });

  describe("name-based tokens combined (month, weekday, meridiem, era) — 17-locale matrix", () => {
    it.each`
      locale
      ${MustTestLocales.enUS}
      ${MustTestLocales.enGB}
      ${MustTestLocales.deDE}
      ${MustTestLocales.frFR}
      ${MustTestLocales.esES}
      ${MustTestLocales.itIT}
      ${MustTestLocales.ptPT}
      ${MustTestLocales.svSE}
      ${MustTestLocales.isIS}
      ${MustTestLocales.zhCN}
      ${MustTestLocales.zhTW}
      ${MustTestLocales.jaJP}
      ${MustTestLocales.koKR}
      ${MustTestLocales.arSA}
      ${MustTestLocales.heIL}
      ${MustTestLocales.ruRU}
      ${MustTestLocales.trTR}
    `(
      "resolves month name + weekday (consumed) + meridiem + era together for $locale",
      ({ locale }) => {
        const month = getLocaleMonthNames(locale, "long")[2]; // March
        const weekday = getLocaleWeekdayNames(locale, "long")[0];
        const [am, pm] = getLocaleMeridiems(locale);
        const [, ceLong] = getLocaleEraNames(locale, "long");
        const [, ceShort] = getLocaleEraNames(locale, "short");

        expect(
          parseDateTimeWithPattern(
            `${weekday}, ${month} 15, 2024 02:30 ${pm} ${ceLong}`,
            "EEEE, MMMM d, yyyy hh:mm a GGGG",
            locale,
          ),
        ).toBe("2024-03-15T14:30:00");

        expect(
          parseDateTimeWithPattern(
            `${weekday}, ${month} 15, 2024 02:30 ${am} ${ceLong}`,
            "EEEE, MMMM d, yyyy hh:mm a GGGG",
            locale,
          ),
        ).toBe("2024-03-15T02:30:00");

        // Era-short (GG) alongside a short month/weekday, proving GG
        // resolves the same way GGGG does above (not just the long form).
        const monthShort = getLocaleMonthNames(locale, "short")[2];
        const weekdayShort = getLocaleWeekdayNames(locale, "short")[0];
        expect(
          parseDateTimeWithPattern(
            `${weekdayShort}, ${monthShort} 15, 2024 02:30 ${pm} ${ceShort}`,
            "EEE, MMM d, yyyy hh:mm a GG",
            locale,
          ),
        ).toBe("2024-03-15T14:30:00");
      },
    );
  });

  describe("shape-valid but calendar/time-invalid input (Temporal handoff regression)", () => {
    it('returns "" for 02/31/2024 14:30:00 against MM/dd/yyyy HH:mm:ss', () => {
      expect(
        parseDateTimeWithPattern("02/31/2024 14:30:00", "MM/dd/yyyy HH:mm:ss"),
      ).toBe("");
    });

    it('returns "" for an invalid hour', () => {
      expect(
        parseDateTimeWithPattern("2024-03-15 25:00:00", "yyyy-MM-dd HH:mm:ss"),
      ).toBe("");
    });
  });

  describe("two-digit year pivot (yy)", () => {
    it.each`
      value               | expected
      ${"00-03-15 00:00"} | ${"2000-03-15T00:00:00"}
      ${"68-03-15 00:00"} | ${"2068-03-15T00:00:00"}
      ${"69-03-15 00:00"} | ${"1969-03-15T00:00:00"}
      ${"99-03-15 00:00"} | ${"1999-03-15T00:00:00"}
    `(
      "parses two-digit year $value against yy-MM-dd HH:mm to $expected",
      ({ value, expected }) => {
        expect(parseDateTimeWithPattern(value, "yy-MM-dd HH:mm")).toBe(
          expected,
        );
      },
    );
  });

  describe("ambiguous adjacent variable-width tokens", () => {
    it("documents the actual (greedy/backtracking) resolution of 'Mdyyyy HH:mm'", () => {
      expect(parseDateTimeWithPattern("1122024 14:30", "Mdyyyy HH:mm")).toBe(
        "2024-01-12T14:30:00",
      );
    });
  });

  describe("value not matching pattern", () => {
    it('returns "" when value does not match pattern', () => {
      expect(
        parseDateTimeWithPattern("not a datetime", "MM/dd/yyyy HH:mm:ss"),
      ).toBe("");
    });
  });

  describe("malformed pattern", () => {
    it.each`
      description                     | pattern
      ${"unrecognized letter Q"}      | ${"yyyy-MM-dd QQ"}
      ${"unsupported width yyy"}      | ${"yyy-MM-dd HH:mm"}
      ${"duplicate field (H and hh)"} | ${"yyyy-MM-dd HH hh a"}
      ${"empty pattern"}              | ${""}
      ${"unterminated quote"}         | ${"yyyy-MM-dd HH:mm:ss'"}
    `('returns "" for $description', ({ pattern }) => {
      expect(parseDateTimeWithPattern("2024-03-15 14:30:00", pattern)).toBe("");
    });
  });

  describe("invalid input", () => {
    it.each`
      description             | value                    | pattern                  | locale
      ${"non-string value"}   | ${123}                   | ${"yyyy-MM-dd HH:mm:ss"} | ${undefined}
      ${"non-string pattern"} | ${"2024-03-15 14:30:00"} | ${123}                   | ${undefined}
      ${"non-string locale"}  | ${"2024-03-15 14:30:00"} | ${"yyyy-MM-dd HH:mm:ss"} | ${42}
      ${"empty value"}        | ${""}                    | ${"yyyy-MM-dd HH:mm:ss"} | ${undefined}
    `('returns "" when $description', ({ value, pattern, locale }) => {
      expect(
        parseDateTimeWithPattern(
          value as unknown as string,
          pattern as unknown as string,
          locale as unknown as string,
        ),
      ).toBe("");
    });
  });
});
