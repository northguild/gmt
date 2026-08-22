import { describe, expect, it } from "vitest";
import { MustTestLocales } from "../../test";
import { getLocaleEraNames } from "../locale/getLocaleEraNames";
import { getLocaleWeekdayNames } from "../locale/getLocaleWeekdayNames";
import { parseDateWithPattern } from "./parseDateWithPattern";

describe("parseDateWithPattern", () => {
  describe("numeric tokens", () => {
    it.each`
      value           | pattern         | expected
      ${"2024"}       | ${"yyyy"}       | ${""}
      ${"2024-03"}    | ${"yyyy-MM"}    | ${""}
      ${"03/15/24"}   | ${"MM/dd/yy"}   | ${"2024-03-15"}
      ${"03/15/2024"} | ${"MM/dd/yyyy"} | ${"2024-03-15"}
      ${"3/5/2024"}   | ${"M/d/yyyy"}   | ${"2024-03-05"}
      ${"3/15/2024"}  | ${"M/d/yyyy"}   | ${"2024-03-15"}
    `(
      "parses $value against $pattern to $expected",
      ({ value, pattern, expected }) => {
        expect(parseDateWithPattern(value, pattern)).toBe(expected);
      },
    );

    it("parses MM (exactly 2 digits, zero-padded) individually", () => {
      expect(parseDateWithPattern("2024-03-01", "yyyy-MM-dd")).toBe(
        "2024-03-01",
      );
    });

    it("parses M (1-2 digits) individually", () => {
      expect(parseDateWithPattern("2024-3-01", "yyyy-M-dd")).toBe("2024-03-01");
    });

    it("parses dd (exactly 2 digits, zero-padded) individually", () => {
      expect(parseDateWithPattern("2024-03-05", "yyyy-MM-dd")).toBe(
        "2024-03-05",
      );
    });

    it("parses d (1-2 digits) individually", () => {
      expect(parseDateWithPattern("2024-03-5", "yyyy-MM-d")).toBe("2024-03-05");
    });

    it("parses yyyy (exactly 4 digits) individually", () => {
      expect(parseDateWithPattern("0044-01-01", "yyyy-MM-dd")).toBe(
        "0044-01-01",
      );
    });
  });

  describe("two-digit year pivot (yy)", () => {
    it.each`
      value         | expected
      ${"00-03-15"} | ${"2000-03-15"}
      ${"68-03-15"} | ${"2068-03-15"}
      ${"69-03-15"} | ${"1969-03-15"}
      ${"99-03-15"} | ${"1999-03-15"}
      ${"24-03-15"} | ${"2024-03-15"}
    `(
      "parses two-digit year $value against yy-MM-dd to $expected",
      ({ value, expected }) => {
        expect(parseDateWithPattern(value, "yy-MM-dd")).toBe(expected);
      },
    );
  });

  describe("month name tokens (MMMM / MMM) — 17-locale matrix", () => {
    it.each`
      locale                  | long       | short
      ${MustTestLocales.enUS} | ${"March"} | ${"Mar"}
      ${MustTestLocales.enGB} | ${"March"} | ${"Mar"}
      ${MustTestLocales.deDE} | ${"März"}  | ${"Mär"}
      ${MustTestLocales.frFR} | ${"mars"}  | ${"mars"}
      ${MustTestLocales.esES} | ${"marzo"} | ${"mar"}
      ${MustTestLocales.itIT} | ${"marzo"} | ${"mar"}
      ${MustTestLocales.ptPT} | ${"março"} | ${"mar."}
      ${MustTestLocales.svSE} | ${"mars"}  | ${"mars"}
      ${MustTestLocales.isIS} | ${"mars"}  | ${"mar."}
      ${MustTestLocales.zhCN} | ${"三月"}  | ${"3月"}
      ${MustTestLocales.zhTW} | ${"3月"}   | ${"3月"}
      ${MustTestLocales.jaJP} | ${"3月"}   | ${"3月"}
      ${MustTestLocales.koKR} | ${"3월"}   | ${"3월"}
      ${MustTestLocales.arSA} | ${"مارس"}  | ${"مارس"}
      ${MustTestLocales.heIL} | ${"מרץ"}   | ${"מרץ"}
      ${MustTestLocales.ruRU} | ${"март"}  | ${"март"}
      ${MustTestLocales.trTR} | ${"Mart"}  | ${"Mar"}
    `(
      "resolves MMMM/MMM month name for $locale to month 03",
      ({ locale, long, short }) => {
        expect(
          parseDateWithPattern(`${long} 15, 2024`, "MMMM d, yyyy", locale),
        ).toBe("2024-03-15");
        expect(
          parseDateWithPattern(`${short} 15, 2024`, "MMM d, yyyy", locale),
        ).toBe("2024-03-15");
      },
    );

    it("defaults to en-US when locale is omitted but a name token is present", () => {
      expect(parseDateWithPattern("March 15, 2024", "MMMM d, yyyy")).toBe(
        "2024-03-15",
      );
    });
  });

  describe("weekday name tokens (EEEE / EEE) — consumed, not cross-validated", () => {
    // Weekday names are looked up live via getLocaleWeekdayNames (the
    // same lookup parseDateWithPattern uses internally) rather than
    // hardcoded, so this stays correct across ICU/CLDR wording
    // differences between Node versions.
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
      "accepts any locale weekday name for $locale without checking it against the parsed date",
      ({ locale }) => {
        const long = getLocaleWeekdayNames(locale, "long")[0];
        const short = getLocaleWeekdayNames(locale, "short")[0];
        // 2024-03-15 is actually a Friday — using an arbitrary (possibly
        // mismatched) weekday name still parses successfully, proving
        // EEEE/EEE are consumed but not cross-validated.
        expect(
          parseDateWithPattern(
            `${long}, 2024-03-15`,
            "EEEE, yyyy-MM-dd",
            locale,
          ),
        ).toBe("2024-03-15");
        expect(
          parseDateWithPattern(
            `${short}, 2024-03-15`,
            "EEE, yyyy-MM-dd",
            locale,
          ),
        ).toBe("2024-03-15");
      },
    );

    it("documents the deliberate mismatch: 'Monday' against an actual Friday still parses", () => {
      // 2024-03-15's real ISO weekday is Friday (dayOfWeek 5).
      expect(
        parseDateWithPattern("Monday, 2024-03-15", "EEEE, yyyy-MM-dd"),
      ).toBe("2024-03-15");
    });
  });

  describe("era name tokens (GG / GGGG) — 17-locale matrix", () => {
    // Era labels are looked up live via getLocaleEraNames (the same
    // lookup parseDateWithPattern uses internally) rather than hardcoded,
    // so this stays correct across ICU/CLDR wording differences between
    // Node versions.
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
      "resolves BCE year = 1 - parsedYear, CE year unchanged for $locale",
      ({ locale }) => {
        const [bceLong, ceLong] = getLocaleEraNames(locale, "long");
        const [bceShort, ceShort] = getLocaleEraNames(locale, "short");

        // CE always leaves the parsed year unchanged.
        expect(
          parseDateWithPattern(
            `0044-01-01 ${ceLong}`,
            "yyyy-MM-dd GGGG",
            locale,
          ),
        ).toBe("0044-01-01");
        expect(
          parseDateWithPattern(
            `0044-01-01 ${ceShort}`,
            "yyyy-MM-dd GG",
            locale,
          ),
        ).toBe("0044-01-01");

        // A minority of locales render the same label for both BCE and
        // CE (e.g. de-DE, zh-CN) — there the BCE branch is inherently
        // indistinguishable from CE, so resolution deliberately treats it
        // as CE (no adjustment) rather than guessing "always BCE". Only
        // locales with genuinely distinct labels can prove the year
        // subtraction.
        if (bceLong.toLowerCase() !== ceLong.toLowerCase()) {
          expect(
            parseDateWithPattern(
              `0044-01-01 ${bceLong}`,
              "yyyy-MM-dd GGGG",
              locale,
            ),
          ).toBe("-000043-01-01");
        }
        if (bceShort.toLowerCase() !== ceShort.toLowerCase()) {
          expect(
            parseDateWithPattern(
              `0044-01-01 ${bceShort}`,
              "yyyy-MM-dd GG",
              locale,
            ),
          ).toBe("-000043-01-01");
        }
      },
    );
  });

  describe("literal text", () => {
    it("matches a literal separator not requiring quoting", () => {
      expect(parseDateWithPattern("2024/03/15", "yyyy/MM/dd")).toBe(
        "2024-03-15",
      );
    });

    it("matches a quoted literal segment verbatim", () => {
      expect(
        parseDateWithPattern("Date: 2024-03-15", "'Date: 'yyyy-MM-dd"),
      ).toBe("2024-03-15");
    });

    it("matches a doubled '' inside a quoted segment as one literal quote character", () => {
      expect(
        parseDateWithPattern("it's 2024-03-15", "'it''s' yyyy-MM-dd"),
      ).toBe("2024-03-15");
    });

    it('returns "" for an unterminated quote (malformed pattern)', () => {
      expect(parseDateWithPattern("2024-03-15", "yyyy-MM-dd'")).toBe("");
    });
  });

  describe("shape-valid but calendar-invalid input (Temporal handoff regression)", () => {
    it('returns "" for 02/31/2024 against MM/dd/yyyy — regex matches the shape, Temporal rejects the date', () => {
      expect(parseDateWithPattern("02/31/2024", "MM/dd/yyyy")).toBe("");
    });

    it('returns "" for a February 30th', () => {
      expect(parseDateWithPattern("2024-02-30", "yyyy-MM-dd")).toBe("");
    });

    it('returns "" for month 13', () => {
      expect(parseDateWithPattern("2024-13-01", "yyyy-MM-dd")).toBe("");
    });
  });

  describe("ambiguous adjacent variable-width tokens", () => {
    it("documents the actual (greedy/backtracking) resolution of 'Mdyyyy' against '1122024'", () => {
      // With no literal separator, the regex engine's alternation order
      // resolves this as month=01, day=12 — not the "obvious" month=11,
      // day=2 a reader might expect. This is the documented behavior,
      // not a guarantee; zero-padded tokens or a separator avoid it.
      expect(parseDateWithPattern("1122024", "Mdyyyy")).toBe("2024-01-12");
    });

    it("resolves unambiguously when zero-padded tokens are used instead", () => {
      expect(parseDateWithPattern("11022024", "MMddyyyy")).toBe("2024-11-02");
    });
  });

  describe("value not matching pattern", () => {
    it.each`
      value            | pattern
      ${"03-15-2024"}  | ${"MM/dd/yyyy"}
      ${"not a date"}  | ${"MM/dd/yyyy"}
      ${"2024-03-15"}  | ${"MM/dd/yyyy"}
      ${"03/15/2024x"} | ${"MM/dd/yyyy"}
    `(
      'returns "" when $value does not match $pattern',
      ({ value, pattern }) => {
        expect(parseDateWithPattern(value, pattern)).toBe("");
      },
    );
  });

  describe("malformed pattern", () => {
    it.each`
      description                          | pattern
      ${"unrecognized letter Q"}           | ${"yyyy-QQ-dd"}
      ${"unsupported width yyy"}           | ${"yyy-MM-dd"}
      ${"unsupported width MMMMM"}         | ${"MMMMM d, yyyy"}
      ${"unsupported width ddd"}           | ${"yyyy-MM-ddd"}
      ${"duplicate field (two yyyy runs)"} | ${"yyyy-yyyy-MM-dd"}
      ${"time token H in date pattern"}    | ${"yyyy-MM-dd HH"}
      ${"time token m in date pattern"}    | ${"yyyy-MM-dd mm"}
      ${"time token a in date pattern"}    | ${"yyyy-MM-dd a"}
      ${"empty pattern"}                   | ${""}
    `('returns "" for $description', ({ pattern }) => {
      expect(parseDateWithPattern("2024-03-15", pattern)).toBe("");
    });
  });

  describe("invalid input", () => {
    it.each`
      description                  | value           | pattern         | locale
      ${"non-string value"}        | ${123}          | ${"yyyy-MM-dd"} | ${undefined}
      ${"non-string value (null)"} | ${null}         | ${"yyyy-MM-dd"} | ${undefined}
      ${"non-string pattern"}      | ${"2024-03-15"} | ${123}          | ${undefined}
      ${"non-string locale"}       | ${"2024-03-15"} | ${"yyyy-MM-dd"} | ${42}
      ${"empty value"}             | ${""}           | ${"yyyy-MM-dd"} | ${undefined}
    `('returns "" when $description', ({ value, pattern, locale }) => {
      expect(
        parseDateWithPattern(
          value as unknown as string,
          pattern as unknown as string,
          locale as unknown as string,
        ),
      ).toBe("");
    });
  });
});
