import { describe, expect, it, vi } from "vitest";
import * as getLocaleEraNamesModule from "../plain/locale/getLocaleEraNames";
import * as getLocaleMeridiemsModule from "../plain/locale/getLocaleMeridiems";
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
});
