import { describe, expect, it } from "vitest";
import { getLocaleMeridiems } from "../locale/getLocaleMeridiems";
import { MustTestLocales } from "../../test";
import { parseTimeWithPattern } from "./parseTimeWithPattern";

describe("parseTimeWithPattern", () => {
  describe("numeric tokens", () => {
    it("parses HH (exactly 2 digits, zero-padded) individually", () => {
      expect(parseTimeWithPattern("09:00:00", "HH:mm:ss")).toBe("09:00:00");
    });

    it("parses H (1-2 digits) individually", () => {
      expect(parseTimeWithPattern("9:00:00", "H:mm:ss")).toBe("09:00:00");
    });

    it("parses hh (exactly 2 digits, zero-padded, 01-12) individually", () => {
      expect(parseTimeWithPattern("09:00:00 AM", "hh:mm:ss a")).toBe(
        "09:00:00",
      );
    });

    it("parses h (1-2 digits, 1-12) individually", () => {
      expect(parseTimeWithPattern("9:00:00 AM", "h:mm:ss a")).toBe("09:00:00");
    });

    it("parses mm (exactly 2 digits, zero-padded) individually", () => {
      expect(parseTimeWithPattern("00:05:00", "HH:mm:ss")).toBe("00:05:00");
    });

    it("parses m (1-2 digits) individually", () => {
      expect(parseTimeWithPattern("00:5:00", "HH:m:ss")).toBe("00:05:00");
    });

    it("parses ss (exactly 2 digits, zero-padded) individually", () => {
      expect(parseTimeWithPattern("00:00:09", "HH:mm:ss")).toBe("00:00:09");
    });

    it("parses s (1-2 digits) individually", () => {
      expect(parseTimeWithPattern("00:00:9", "HH:mm:s")).toBe("00:00:09");
    });

    it("parses SSS (exactly 3 digits) individually", () => {
      expect(parseTimeWithPattern("00:00:00.123", "HH:mm:ss.SSS")).toBe(
        "00:00:00.123",
      );
    });
  });

  describe("meridiem token (a) — 12h to 24h resolution", () => {
    it.each`
      value            | expected
      ${"12:30:45 AM"} | ${"00:30:45"}
      ${"01:30:45 AM"} | ${"01:30:45"}
      ${"11:30:45 AM"} | ${"11:30:45"}
      ${"12:30:45 PM"} | ${"12:30:45"}
      ${"01:30:45 PM"} | ${"13:30:45"}
      ${"11:30:45 PM"} | ${"23:30:45"}
    `(
      "resolves $value against hh:mm:ss a to $expected",
      ({ value, expected }) => {
        expect(parseTimeWithPattern(value, "hh:mm:ss a")).toBe(expected);
      },
    );

    it("defaults to AM (12 -> 0) when hh is used without an a token", () => {
      expect(parseTimeWithPattern("12:30:45", "hh:mm:ss")).toBe("00:30:45");
      expect(parseTimeWithPattern("05:30:45", "hh:mm:ss")).toBe("05:30:45");
    });

    it("defaults to en-US when locale is omitted but the a token is present", () => {
      expect(parseTimeWithPattern("02:30:45 PM", "hh:mm:ss a")).toBe(
        "14:30:45",
      );
    });
  });

  describe("meridiem token (a) — 17-locale matrix", () => {
    // AM/PM labels are looked up live via getLocaleMeridiems (the same
    // lookup parseTimeWithPattern uses internally) rather than hardcoded,
    // so this stays correct across ICU/CLDR wording differences between
    // Node versions (see context/testing-standards — pt-PT's day period
    // wording in particular is documented to vary by ICU build).
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
    `("resolves 12-hour PM label for $locale to hour + 12", ({ locale }) => {
      const [am, pm] = getLocaleMeridiems(locale);
      expect(parseTimeWithPattern(`02:30:45 ${pm}`, "hh:mm:ss a", locale)).toBe(
        "14:30:45",
      );
      expect(parseTimeWithPattern(`02:30:45 ${am}`, "hh:mm:ss a", locale)).toBe(
        "02:30:45",
      );
    });
  });

  describe("literal text", () => {
    it("matches a literal separator not requiring quoting", () => {
      expect(parseTimeWithPattern("14.30.45", "HH.mm.ss")).toBe("14:30:45");
    });

    it("matches a quoted literal segment verbatim", () => {
      expect(parseTimeWithPattern("Time: 14:30:45", "'Time: 'HH:mm:ss")).toBe(
        "14:30:45",
      );
    });

    it("matches a doubled '' inside a quoted segment as one literal quote character", () => {
      expect(
        parseTimeWithPattern("o'clock 14:30:45", "'o''clock' HH:mm:ss"),
      ).toBe("14:30:45");
    });

    it('returns "" for an unterminated quote (malformed pattern)', () => {
      expect(parseTimeWithPattern("14:30:45", "HH:mm:ss'")).toBe("");
    });
  });

  describe("shape-valid but time-invalid input (Temporal handoff regression)", () => {
    it('returns "" for hour 25 against HH:mm', () => {
      expect(parseTimeWithPattern("25:00", "HH:mm")).toBe("");
    });

    it('returns "" for minute 60 against HH:mm', () => {
      expect(parseTimeWithPattern("10:60", "HH:mm")).toBe("");
    });
  });

  describe("value not matching pattern", () => {
    it.each`
      value           | pattern
      ${"14-30-45"}   | ${"HH:mm:ss"}
      ${"not a time"} | ${"HH:mm:ss"}
      ${"14:30:45x"}  | ${"HH:mm:ss"}
    `(
      'returns "" when $value does not match $pattern',
      ({ value, pattern }) => {
        expect(parseTimeWithPattern(value, pattern)).toBe("");
      },
    );
  });

  describe("malformed pattern", () => {
    it.each`
      description                       | pattern
      ${"unrecognized letter Q"}        | ${"HH:QQ:ss"}
      ${"unsupported width hhh"}        | ${"hhh:mm:ss"}
      ${"unsupported width SS"}         | ${"HH:mm:ss.SS"}
      ${"unsupported width aa"}         | ${"hh:mm:ss aa"}
      ${"duplicate field (H and hh)"}   | ${"HH hh:mm:ss a"}
      ${"date token y in time pattern"} | ${"yyyy HH:mm:ss"}
      ${"date token M in time pattern"} | ${"MM HH:mm:ss"}
      ${"date token E in time pattern"} | ${"EEEE HH:mm:ss"}
      ${"empty pattern"}                | ${""}
    `('returns "" for $description', ({ pattern }) => {
      expect(parseTimeWithPattern("14:30:45", pattern)).toBe("");
    });
  });

  describe("invalid input", () => {
    it.each`
      description                  | value         | pattern       | locale
      ${"non-string value"}        | ${123}        | ${"HH:mm:ss"} | ${undefined}
      ${"non-string value (null)"} | ${null}       | ${"HH:mm:ss"} | ${undefined}
      ${"non-string pattern"}      | ${"14:30:45"} | ${123}        | ${undefined}
      ${"non-string locale"}       | ${"14:30:45"} | ${"HH:mm:ss"} | ${42}
      ${"empty value"}             | ${""}         | ${"HH:mm:ss"} | ${undefined}
    `('returns "" when $description', ({ value, pattern, locale }) => {
      expect(
        parseTimeWithPattern(
          value as unknown as string,
          pattern as unknown as string,
          locale as unknown as string,
        ),
      ).toBe("");
    });
  });
});
