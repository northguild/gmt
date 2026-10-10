import { Temporal } from "@js-temporal/polyfill";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MustTestLocales } from "../../test";
import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { getLocaleEraNames } from "../locale/getLocaleEraNames";
import { getLocaleWeekdayNames } from "../locale/getLocaleWeekdayNames";
import { parseDateWithPattern } from "./parseDateWithPattern";

describe("parseDateWithPattern", () => {
  describe("numeric tokens", () => {
    it.each`
      value           | pattern         | expected
      ${"2024"}       | ${"yyyy"}       | ${""}
      ${"2024-03"}    | ${"yyyy-MM"}    | ${""}
      ${"03/15/24"}   | ${"MM/dd/yy"}   | ${""}
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

  describe("two-digit year (yy) resolves in the caller's yearWindow", () => {
    // The window names a hundred consecutive years; exactly one ends in yy. Derived by hand and
    // checked against Temporal.PlainDate.from({ year, month: 3, day: 15 }) for each row.
    it.each`
      value         | yearWindow | expected
      ${"00-03-15"} | ${2000}    | ${"2000-03-15"}
      ${"99-03-15"} | ${2000}    | ${"2099-03-15"}
      ${"24-03-15"} | ${2000}    | ${"2024-03-15"}
      ${"50-03-15"} | ${1950}    | ${"1950-03-15"}
      ${"99-03-15"} | ${1950}    | ${"1999-03-15"}
      ${"00-03-15"} | ${1950}    | ${"2000-03-15"}
      ${"49-03-15"} | ${1950}    | ${"2049-03-15"}
      ${"69-03-15"} | ${1969}    | ${"1969-03-15"}
      ${"68-03-15"} | ${1969}    | ${"2068-03-15"}
      ${"01-03-15"} | ${0}       | ${"0001-03-15"}
      ${"99-03-15"} | ${9900}    | ${"9999-03-15"}
    `(
      "parses $value against yy-MM-dd with yearWindow $yearWindow to $expected",
      ({ value, yearWindow, expected }) => {
        expect(
          parseDateWithPattern(value, "yy-MM-dd", undefined, { yearWindow }),
        ).toBe(expected);
      },
    );

    it.each`
      options                                     | description
      ${undefined}                                | ${"options omitted"}
      ${{}}                                       | ${"yearWindow absent"}
      ${{ yearWindow: undefined }}                | ${"yearWindow undefined"}
      ${{ yearWindow: null }}                     | ${"null"}
      ${{ yearWindow: 1.5 }}                      | ${"a non-integer"}
      ${{ yearWindow: -1 }}                       | ${"negative"}
      ${{ yearWindow: 9901 }}                     | ${"past the last four-digit window"}
      ${{ yearWindow: Number.NaN }}               | ${"NaN"}
      ${{ yearWindow: Number.POSITIVE_INFINITY }} | ${"Infinity"}
      ${{ yearWindow: "2000" }}                   | ${"a numeric string"}
      ${{ yearWindow: "Rolling" }}                | ${"wrong case"}
      ${{ yearWindow: "roll" }}                   | ${"a prefix of rolling"}
    `('returns "" for a yy pattern when $description', ({ options }) => {
      expect(
        parseDateWithPattern("24-03-15", "yy-MM-dd", undefined, options),
      ).toBe("");
    });

    it.each`
      options | description
      ${null} | ${"null"}
      ${"x"}  | ${"a string"}
      ${1}    | ${"a number"}
      ${true} | ${"a boolean"}
    `(
      'returns "" when the options argument is $description, even for a yyyy pattern',
      ({ options }) => {
        expect(
          parseDateWithPattern("2024-03-15", "yyyy-MM-dd", undefined, options),
        ).toBe("");
      },
    );

    it.each`
      options
      ${undefined}
      ${{}}
      ${{ yearWindow: 2000 }}
      ${{ yearWindow: 1950 }}
      ${{ yearWindow: "rolling" }}
      ${{ yearWindow: 9901 }}
    `(
      "a yyyy pattern gives 2024-03-15 with options $options: the window is ignored",
      ({ options }) => {
        expect(
          parseDateWithPattern("2024-03-15", "yyyy-MM-dd", undefined, options),
        ).toBe("2024-03-15");
      },
    );

    // A hostile bag is an Object, so it passes the GetOptionsObject guard; reading `yearWindow`
    // from it throws. Only a yy pattern reads it.
    it.each`
      make                                                                | kind
      ${() => hostileProxy()}                                             | ${"a Proxy that throws on any trap"}
      ${() => revokedProxy()}                                             | ${"a revoked Proxy"}
      ${() => Object.defineProperty({}, "yearWindow", { get: throwing })} | ${"an object whose yearWindow getter throws"}
    `(
      'returns "" for a yy pattern with options that are $kind, and never reads them for a yyyy pattern',
      ({ make }) => {
        expect(
          parseDateWithPattern(
            "24-03-15",
            "yy-MM-dd",
            undefined,
            make() as never,
          ),
        ).toBe("");
        expect(
          parseDateWithPattern(
            "2024-03-15",
            "yyyy-MM-dd",
            undefined,
            make() as never,
          ),
        ).toBe("2024-03-15");
      },
    );

    it("reads yearWindow once per call for a yy pattern, and never for a yyyy pattern", () => {
      let reads = 0;
      const options = {
        get yearWindow(): number {
          reads += 1;
          return 2000;
        },
      };
      parseDateWithPattern("24-03-15", "yy-MM-dd", undefined, options);
      expect(reads).toBe(1);
      parseDateWithPattern("2024-03-15", "yyyy-MM-dd", undefined, options);
      expect(reads).toBe(1);
    });

    it("reads a function carrying yearWindow as the options object it is", () => {
      expect(
        parseDateWithPattern(
          "24-03-15",
          "yy-MM-dd",
          undefined,
          Object.assign(() => undefined, { yearWindow: 2000 }),
        ),
      ).toBe("2024-03-15");
    });

    describe('yearWindow "rolling" is the hundred years around the current UTC year', () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      function setNow(instant: string): void {
        vi.spyOn(Temporal.Now, "instant").mockReturnValue(
          Temporal.Instant.from(instant),
        );
      }

      // GMT rule: the window runs from 50 years before the current UTC calendar year to 49
      // after it. 2050 - 50 = 2000, so at the UTC new year 2050 the window becomes 2000–2099
      // and 99 moves from 1999 to 2099. A fixed window gives the same answer at every date.
      // The last two rows are instants whose local date and UTC date fall in different years
      // (22:00Z on 31 December 2049; 04:59:59Z on 1 January 2050): the UTC year decides.
      it.each`
        now                            | windowStart | ninetyNine      | first           | last
        ${"2026-10-07T12:00:00Z"}      | ${1976}     | ${"1999-03-15"} | ${"1976-03-15"} | ${"2075-03-15"}
        ${"2049-12-31T23:59:59Z"}      | ${1999}     | ${"1999-03-15"} | ${"1999-03-15"} | ${"2098-03-15"}
        ${"2050-01-01T00:00:00Z"}      | ${2000}     | ${"2099-03-15"} | ${"2000-03-15"} | ${"2099-03-15"}
        ${"2050-01-01T00:00:00+02:00"} | ${1999}     | ${"1999-03-15"} | ${"1999-03-15"} | ${"2098-03-15"}
        ${"2049-12-31T23:59:59-05:00"} | ${2000}     | ${"2099-03-15"} | ${"2000-03-15"} | ${"2099-03-15"}
      `(
        "at $now the rolling window starts $windowStart: 99 → $ninetyNine, edges $first and $last; fixed 1950 still gives 1999",
        ({ now, windowStart, ninetyNine, first, last }) => {
          setNow(now);
          const rolling = { yearWindow: "rolling" as const };
          const yy = (year: number): string =>
            String(year % 100).padStart(2, "0");
          expect(
            parseDateWithPattern("99-03-15", "yy-MM-dd", undefined, rolling),
          ).toBe(ninetyNine);
          expect(
            parseDateWithPattern(
              `${yy(windowStart)}-03-15`,
              "yy-MM-dd",
              undefined,
              rolling,
            ),
          ).toBe(first);
          expect(
            parseDateWithPattern(
              `${yy(windowStart + 99)}-03-15`,
              "yy-MM-dd",
              undefined,
              rolling,
            ),
          ).toBe(last);
          expect(
            parseDateWithPattern("99-03-15", "yy-MM-dd", undefined, {
              yearWindow: 1950,
            }),
          ).toBe("1999-03-15");
        },
      );

      // The rolling window holds 2024 from UTC 1975 (1925–2024) through UTC 2074 (2024–2123): 24
      // is 1924 one second before that span and 2124 one second after it.
      it.each`
        now                       | window         | expected
        ${"1974-12-31T23:59:59Z"} | ${"1924–2023"} | ${"1924-03-15"}
        ${"1975-01-01T00:00:00Z"} | ${"1925–2024"} | ${"2024-03-15"}
        ${"2074-12-31T23:59:59Z"} | ${"2024–2123"} | ${"2024-03-15"}
        ${"2075-01-01T00:00:00Z"} | ${"2025–2124"} | ${"2124-03-15"}
      `(
        "at $now the rolling window is $window: 03/15/24 against MM/dd/yy is $expected",
        ({ now, expected }) => {
          setNow(now);
          expect(
            parseDateWithPattern("03/15/24", "MM/dd/yy", undefined, {
              yearWindow: "rolling",
            }),
          ).toBe(expected);
        },
      );

      // A pattern with no yy token never reads the option, so the clock a rolling window needs
      // is never read for it: the result is the one the same call gives with no options.
      it("a yyyy pattern gives 2024-03-15 with a rolling window when the clock cannot be read", () => {
        mockTemporalNowInstantThrow();
        expect(
          parseDateWithPattern("2024-03-15", "yyyy-MM-dd", undefined, {
            yearWindow: "rolling",
          }),
        ).toBe("2024-03-15");
      });

      it('returns "" for a rolling window when the clock cannot be read', () => {
        mockTemporalNowInstantThrow();
        expect(
          parseDateWithPattern("24-03-15", "yy-MM-dd", undefined, {
            yearWindow: "rolling",
          }),
        ).toBe("");
      });
    });
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

    // UTS #35 Part 4, Date Format Patterns: "Two adjacent single vertical
    // quotes (''), which represent a literal single quote, either inside or
    // outside quoted text."
    it.each`
      value               | pattern                 | expected        | why
      ${"2024'01'15"}     | ${"yyyy''MM''dd"}       | ${"2024-01-15"} | ${"'' between fields is one literal quote"}
      ${"20240115"}       | ${"yyyy''MM''dd"}       | ${""}           | ${"the literal quotes are missing from the value"}
      ${"'2024-01-15'"}   | ${"''yyyy-MM-dd''"}     | ${"2024-01-15"} | ${"'' at the start and end of the pattern"}
      ${"2024-01-15"}     | ${"''yyyy-MM-dd''"}     | ${""}           | ${"the leading and trailing quotes are missing"}
      ${"''2024-01-15"}   | ${"''''yyyy-MM-dd"}     | ${"2024-01-15"} | ${"'''' is two '' pairs, two literal quotes"}
      ${"'2024-01-15"}    | ${"''''yyyy-MM-dd"}     | ${""}           | ${"'''' needs two literal quotes, not one"}
      ${"'T2024-01-15"}   | ${"'''T'yyyy-MM-dd"}    | ${"2024-01-15"} | ${"''' is a literal quote, then an opening quote"}
      ${"'2024-01-15"}    | ${"'''yyyy-MM-dd"}      | ${""}           | ${"''' leaves the third quote unterminated"}
      ${"a'' 2024-01-15"} | ${"'a'''' 'yyyy-MM-dd"} | ${"2024-01-15"} | ${"two '' pairs inside quoted text"}
    `(
      'returns "$expected" for "$value" against "$pattern" ($why)',
      ({ value, pattern, expected }) => {
        expect(parseDateWithPattern(value, pattern)).toBe(expected);
      },
    );

    it("reads the UTS #35 pattern example table row, '' before yy, with a window", () => {
      expect(
        parseDateWithPattern(
          "Wed, Jul 10, '96",
          "EEE, MMM d, ''yy",
          undefined,
          {
            yearWindow: 1950,
          },
        ),
      ).toBe("1996-07-10");
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

  // ECMA-402 CanonicalizeLocaleList: the pattern's names are read from the first tag of a locale list
  // with locale data; a malformed tag anywhere in the list is invalid input.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"2024-05-19"}
    ${[MustTestLocales.enUS, MustTestLocales.frFR]} | ${""}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `(
    "returns $expected for a French month name with locale list $locale",
    ({ locale, expected }) => {
      expect(parseDateWithPattern("19 mai 2024", "d MMMM yyyy", locale)).toBe(
        expected,
      );
    },
  );
});

/** A getter that throws, for an options bag that cannot be read. */
function throwing(): never {
  throw new Error("hostile getter");
}
