import { Temporal } from "@js-temporal/polyfill";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MustTestLocales } from "../../test";
import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
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

    // UTS #35 Part 4, Date Format Patterns: "Two adjacent single vertical
    // quotes (''), which represent a literal single quote, either inside or
    // outside quoted text."
    it.each`
      value                      | pattern                         | expected                 | why
      ${"2024-01-15'14:30:00"}   | ${"yyyy-MM-dd''HH:mm:ss"}       | ${"2024-01-15T14:30:00"} | ${"'' between fields is one literal quote"}
      ${"2024-01-1514:30:00"}    | ${"yyyy-MM-dd''HH:mm:ss"}       | ${""}                    | ${"the literal quote is missing from the value"}
      ${"'2024-01-15 14:30:00'"} | ${"''yyyy-MM-dd HH:mm:ss''"}    | ${"2024-01-15T14:30:00"} | ${"'' at the start and end of the pattern"}
      ${"2024-01-15''14:30:00"}  | ${"yyyy-MM-dd''''HH:mm:ss"}     | ${"2024-01-15T14:30:00"} | ${"'''' is two '' pairs, two literal quotes"}
      ${"2024-01-15'14:30:00"}   | ${"yyyy-MM-dd''''HH:mm:ss"}     | ${""}                    | ${"'''' needs two literal quotes, not one"}
      ${"2024-01-15'14:30:00"}   | ${"yyyy-MM-dd'''HH:mm:ss"}      | ${""}                    | ${"''' leaves the third quote unterminated"}
      ${"2024-01-15 at 'T14:30"} | ${"yyyy-MM-dd 'at' '''T'HH:mm"} | ${"2024-01-15T14:30:00"} | ${"''' after a quoted literal is a literal quote, then an opening quote"}
    `(
      'returns "$expected" for "$value" against "$pattern" ($why)',
      ({ value, pattern, expected }) => {
        expect(parseDateTimeWithPattern(value, pattern)).toBe(expected);
      },
    );

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

  describe("two-digit year (yy) resolves in the caller's yearWindow", () => {
    // Derived by hand: the one year in [yearWindow, yearWindow + 99] ending in yy; checked
    // against Temporal.PlainDateTime.from({ year, month: 3, day: 15 }).
    it.each`
      value               | yearWindow | expected
      ${"00-03-15 00:00"} | ${2000}    | ${"2000-03-15T00:00:00"}
      ${"99-03-15 00:00"} | ${2000}    | ${"2099-03-15T00:00:00"}
      ${"50-03-15 00:00"} | ${1950}    | ${"1950-03-15T00:00:00"}
      ${"99-03-15 00:00"} | ${1950}    | ${"1999-03-15T00:00:00"}
      ${"00-03-15 00:00"} | ${1950}    | ${"2000-03-15T00:00:00"}
      ${"49-03-15 00:00"} | ${1950}    | ${"2049-03-15T00:00:00"}
      ${"69-03-15 00:00"} | ${1969}    | ${"1969-03-15T00:00:00"}
      ${"68-03-15 00:00"} | ${1969}    | ${"2068-03-15T00:00:00"}
      ${"01-03-15 00:00"} | ${0}       | ${"0001-03-15T00:00:00"}
      ${"99-03-15 00:00"} | ${9900}    | ${"9999-03-15T00:00:00"}
    `(
      "parses $value against yy-MM-dd HH:mm with yearWindow $yearWindow to $expected",
      ({ value, yearWindow, expected }) => {
        expect(
          parseDateTimeWithPattern(value, "yy-MM-dd HH:mm", undefined, {
            yearWindow,
          }),
        ).toBe(expected);
      },
    );

    it.each`
      options                                     | description
      ${undefined}                                | ${"options omitted"}
      ${{}}                                       | ${"yearWindow absent"}
      ${{ yearWindow: null }}                     | ${"null"}
      ${{ yearWindow: 1.5 }}                      | ${"a non-integer"}
      ${{ yearWindow: -1 }}                       | ${"negative"}
      ${{ yearWindow: 9901 }}                     | ${"past the last four-digit window"}
      ${{ yearWindow: Number.NaN }}               | ${"NaN"}
      ${{ yearWindow: Number.POSITIVE_INFINITY }} | ${"Infinity"}
      ${{ yearWindow: "2000" }}                   | ${"a numeric string"}
      ${{ yearWindow: "Rolling" }}                | ${"wrong case"}
    `('returns "" for a yy pattern when $description', ({ options }) => {
      expect(
        parseDateTimeWithPattern(
          "24-03-15 14:30",
          "yy-MM-dd HH:mm",
          undefined,
          options,
        ),
      ).toBe("");
    });

    it.each`
      options | description
      ${null} | ${"null"}
      ${"x"}  | ${"a string"}
      ${1}    | ${"a number"}
    `(
      'returns "" when the options argument is $description, even for a yyyy pattern',
      ({ options }) => {
        expect(
          parseDateTimeWithPattern(
            "2024-03-15 14:30",
            "yyyy-MM-dd HH:mm",
            undefined,
            options,
          ),
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
      "a yyyy pattern gives 2024-03-15T14:30:00 with options $options: the window is ignored",
      ({ options }) => {
        expect(
          parseDateTimeWithPattern(
            "2024-03-15 14:30",
            "yyyy-MM-dd HH:mm",
            undefined,
            options,
          ),
        ).toBe("2024-03-15T14:30:00");
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
          parseDateTimeWithPattern(
            "24-03-15 14:30",
            "yy-MM-dd HH:mm",
            undefined,
            make() as never,
          ),
        ).toBe("");
        expect(
          parseDateTimeWithPattern(
            "2024-03-15 14:30",
            "yyyy-MM-dd HH:mm",
            undefined,
            make() as never,
          ),
        ).toBe("2024-03-15T14:30:00");
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
      parseDateTimeWithPattern(
        "24-03-15 14:30",
        "yy-MM-dd HH:mm",
        undefined,
        options,
      );
      expect(reads).toBe(1);
      parseDateTimeWithPattern(
        "2024-03-15 14:30",
        "yyyy-MM-dd HH:mm",
        undefined,
        options,
      );
      expect(reads).toBe(1);
    });

    it("reads a function carrying yearWindow as the options object it is", () => {
      expect(
        parseDateTimeWithPattern(
          "24-03-15 14:30",
          "yy-MM-dd HH:mm",
          undefined,
          Object.assign(() => undefined, { yearWindow: 2000 }),
        ),
      ).toBe("2024-03-15T14:30:00");
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

      // GMT rule: 50 years before the current UTC calendar year to 49 after it; 2050 - 50 = 2000.
      // The last two rows are instants whose local date and UTC date fall in different years
      // (22:00Z on 31 December 2049; 04:59:59Z on 1 January 2050): the UTC year decides.
      it.each`
        now                            | windowStart | ninetyNine
        ${"2026-10-07T12:00:00Z"}      | ${1976}     | ${"1999-03-15T14:30:00"}
        ${"2049-12-31T23:59:59Z"}      | ${1999}     | ${"1999-03-15T14:30:00"}
        ${"2050-01-01T00:00:00Z"}      | ${2000}     | ${"2099-03-15T14:30:00"}
        ${"2050-01-01T00:00:00+02:00"} | ${1999}     | ${"1999-03-15T14:30:00"}
        ${"2049-12-31T23:59:59-05:00"} | ${2000}     | ${"2099-03-15T14:30:00"}
      `(
        "at $now the rolling window starts $windowStart: 99 → $ninetyNine and both edges resolve; fixed 1950 still gives 1999",
        ({ now, windowStart, ninetyNine }) => {
          setNow(now);
          const rolling = { yearWindow: "rolling" as const };
          const yy = (year: number): string =>
            String(year % 100).padStart(2, "0");
          expect(
            parseDateTimeWithPattern(
              "99-03-15 14:30",
              "yy-MM-dd HH:mm",
              undefined,
              rolling,
            ),
          ).toBe(ninetyNine);
          expect(
            parseDateTimeWithPattern(
              `${yy(windowStart)}-03-15 14:30`,
              "yy-MM-dd HH:mm",
              undefined,
              rolling,
            ),
          ).toBe(`${windowStart}-03-15T14:30:00`);
          expect(
            parseDateTimeWithPattern(
              `${yy(windowStart + 99)}-03-15 14:30`,
              "yy-MM-dd HH:mm",
              undefined,
              rolling,
            ),
          ).toBe(`${windowStart + 99}-03-15T14:30:00`);
          expect(
            parseDateTimeWithPattern(
              "99-03-15 14:30",
              "yy-MM-dd HH:mm",
              undefined,
              { yearWindow: 1950 },
            ),
          ).toBe("1999-03-15T14:30:00");
        },
      );

      // The rolling window holds 2024 from UTC 1975 (1925–2024) through UTC 2074 (2024–2123): 24
      // is 1924 one second before that span and 2124 one second after it.
      it.each`
        now                       | window         | expected
        ${"1974-12-31T23:59:59Z"} | ${"1924–2023"} | ${"1924-03-15T14:30:00"}
        ${"1975-01-01T00:00:00Z"} | ${"1925–2024"} | ${"2024-03-15T14:30:00"}
        ${"2074-12-31T23:59:59Z"} | ${"2024–2123"} | ${"2024-03-15T14:30:00"}
        ${"2075-01-01T00:00:00Z"} | ${"2025–2124"} | ${"2124-03-15T14:30:00"}
      `(
        "at $now the rolling window is $window: 24-03-15 14:30 against yy-MM-dd HH:mm is $expected",
        ({ now, expected }) => {
          setNow(now);
          expect(
            parseDateTimeWithPattern(
              "24-03-15 14:30",
              "yy-MM-dd HH:mm",
              undefined,
              { yearWindow: "rolling" },
            ),
          ).toBe(expected);
        },
      );

      // A pattern with no yy token never reads the option, so the clock a rolling window needs
      // is never read for it: the result is the one the same call gives with no options.
      it("a yyyy pattern gives 2024-03-15T14:30:00 with a rolling window when the clock cannot be read", () => {
        mockTemporalNowInstantThrow();
        expect(
          parseDateTimeWithPattern(
            "2024-03-15 14:30",
            "yyyy-MM-dd HH:mm",
            undefined,
            {
              yearWindow: "rolling",
            },
          ),
        ).toBe("2024-03-15T14:30:00");
      });

      it('returns "" for a rolling window when the clock cannot be read', () => {
        mockTemporalNowInstantThrow();
        expect(
          parseDateTimeWithPattern(
            "24-03-15 14:30",
            "yy-MM-dd HH:mm",
            undefined,
            { yearWindow: "rolling" },
          ),
        ).toBe("");
      });
    });
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

  // ECMA-402 CanonicalizeLocaleList: the pattern's names are read from the first tag of a locale list
  // with locale data; a malformed tag anywhere in the list is invalid input.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"2024-05-19T10:20:00"}
    ${[MustTestLocales.enUS, MustTestLocales.frFR]} | ${""}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `(
    "returns $expected for a French month name with locale list $locale",
    ({ locale, expected }) => {
      expect(
        parseDateTimeWithPattern(
          "19 mai 2024 10:20",
          "d MMMM yyyy HH:mm",
          locale,
        ),
      ).toBe(expected);
    },
  );
});

/** A getter that throws, for an options bag that cannot be read. */
function throwing(): never {
  throw new Error("hostile getter");
}
