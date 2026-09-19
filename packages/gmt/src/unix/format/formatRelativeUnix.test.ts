import { vi } from "vitest";
import { MustTestLocales } from "../../test";
import { mockTemporalNowInstantThrow } from "../../test/mocks";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { formatRelativeUnix } from "./formatRelativeUnix";

// Base: 2024-02-29T00:00:00Z (leap day)
const REF_MS = 1709164800000;
const REF_S = 1709164800;
// Equivalent UTC ISO string — used to test string references
const REF_UTC = "2024-02-29T00:00:00Z";

describe("formatRelativeUnix", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Auto unit selection (millisecond epoch, fixed reference)
  // ---------------------------------------------------------------------------
  describe("auto unit selection", () => {
    it.each`
      value            | expected
      ${1709164770000} | ${"30 seconds ago"}
      ${1709164830000} | ${"in 30 seconds"}
      ${1709163000000} | ${"30 minutes ago"}
      ${1709166600000} | ${"in 30 minutes"}
      ${1709154000000} | ${"3 hours ago"}
      ${1709175600000} | ${"in 3 hours"}
      ${1708905600000} | ${"3 days ago"}
      ${1709424000000} | ${"in 3 days"}
    `(
      "formats $value (ms) relative to REF as $expected",
      ({ value, expected }) => {
        expect(
          formatRelativeUnix(value, MustTestLocales.enUS, {
            reference: REF_MS,
          }),
        ).toBe(expected);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // ±1 and 0 permutations
  // ---------------------------------------------------------------------------
  describe("±1 and 0 permutations", () => {
    it.each`
      value            | expected
      ${REF_MS}        | ${"now"}
      ${1709164801000} | ${"in 1 second"}
      ${1709164799000} | ${"1 second ago"}
      ${1709164860000} | ${"in 1 minute"}
      ${1709164740000} | ${"1 minute ago"}
      ${1709168400000} | ${"in 1 hour"}
      ${1709161200000} | ${"1 hour ago"}
      ${1709251200000} | ${"tomorrow"}
      ${1709078400000} | ${"yesterday"}
    `(
      "formats $value (ms) as $expected (en-US, auto)",
      ({ value, expected }) => {
        expect(
          formatRelativeUnix(value, MustTestLocales.enUS, {
            reference: REF_MS,
          }),
        ).toBe(expected);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // epochUnit: "seconds"
  // ---------------------------------------------------------------------------
  describe("epochUnit: seconds", () => {
    it.each`
      value            | expected
      ${REF_S}         | ${"now"}
      ${REF_S + 1}     | ${"in 1 second"}
      ${REF_S - 1}     | ${"1 second ago"}
      ${REF_S + 60}    | ${"in 1 minute"}
      ${REF_S - 60}    | ${"1 minute ago"}
      ${REF_S + 3600}  | ${"in 1 hour"}
      ${REF_S - 3600}  | ${"1 hour ago"}
      ${REF_S + 86400} | ${"tomorrow"}
      ${REF_S - 86400} | ${"yesterday"}
    `(
      "formats $value (s) as $expected (en-US, auto)",
      ({ value, expected }) => {
        expect(
          formatRelativeUnix(value, MustTestLocales.enUS, {
            epochUnit: "seconds",
            reference: REF_S,
          }),
        ).toBe(expected);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // Numeric string input
  // A string that looks like a number is accepted as a unix epoch.
  // ---------------------------------------------------------------------------
  describe("numeric string input", () => {
    it("accepts a numeric ms string as value", () => {
      expect(
        formatRelativeUnix(String(REF_MS - 1_800_000), MustTestLocales.enUS, {
          reference: REF_MS,
        }),
      ).toBe("30 minutes ago");
    });

    it("accepts a negative numeric string (pre-epoch)", () => {
      const past = REF_MS - 5 * 86_400_000; // 5 days before REF
      expect(
        formatRelativeUnix(String(past), MustTestLocales.enUS, {
          reference: REF_MS,
        }),
      ).toBe("5 days ago");
    });
  });

  // ---------------------------------------------------------------------------
  // String reference (UTC ISO or numeric epoch string)
  // ---------------------------------------------------------------------------
  describe("string reference", () => {
    it("accepts a UTC ISO string as reference", () => {
      expect(
        formatRelativeUnix(REF_MS - 1_800_000, MustTestLocales.enUS, {
          reference: REF_UTC,
        }),
      ).toBe("30 minutes ago");
    });

    it("accepts a numeric ms string as reference (symmetric with value)", () => {
      expect(
        formatRelativeUnix(REF_MS - 1_800_000, MustTestLocales.enUS, {
          reference: String(REF_MS),
        }),
      ).toBe("30 minutes ago");
    });

    it("accepts a numeric seconds string as reference with epochUnit: 'seconds'", () => {
      expect(
        formatRelativeUnix(REF_S - 1_800, MustTestLocales.enUS, {
          reference: String(REF_S),
          epochUnit: "seconds",
        }),
      ).toBe("30 minutes ago");
    });

    it("returns '' when string reference is neither numeric nor a valid UTC string", () => {
      expect(
        formatRelativeUnix(REF_MS, MustTestLocales.enUS, {
          reference: "not-a-date",
        }),
      ).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Locale coverage — 30 minutes past (ms epoch)
  // ---------------------------------------------------------------------------
  describe("locale coverage — 30 minutes past", () => {
    const value = REF_MS - 1_800_000; // 30m before REF

    it.each`
      locale                  | expected
      ${MustTestLocales.enUS} | ${"30 minutes ago"}
      ${MustTestLocales.enGB} | ${"30 minutes ago"}
      ${MustTestLocales.deDE} | ${"vor 30 Minuten"}
      ${MustTestLocales.frFR} | ${"il y a 30 minutes"}
      ${MustTestLocales.esES} | ${"hace 30 minutos"}
      ${MustTestLocales.itIT} | ${"30 minuti fa"}
      ${MustTestLocales.ptPT} | ${"há 30 minutos"}
      ${MustTestLocales.svSE} | ${"för 30 minuter sedan"}
      ${MustTestLocales.isIS} | ${"fyrir 30 mínútum"}
      ${MustTestLocales.zhCN} | ${"30分钟前"}
      ${MustTestLocales.zhTW} | ${"30 分鐘前"}
      ${MustTestLocales.jaJP} | ${"30 分前"}
      ${MustTestLocales.koKR} | ${"30분 전"}
      ${MustTestLocales.arSA} | ${"قبل ٣٠ دقيقة"}
      ${MustTestLocales.heIL} | ${"לפני 30 דקות"}
      ${MustTestLocales.ruRU} | ${"30 минут назад"}
      ${MustTestLocales.trTR} | ${"30 dakika önce"}
    `("formats for $locale as $expected", ({ locale, expected }) => {
      expect(formatRelativeUnix(value, locale, { reference: REF_MS })).toBe(
        expected,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Locale coverage — 30 minutes future (ms epoch)
  // ---------------------------------------------------------------------------
  describe("locale coverage — 30 minutes future", () => {
    const value = REF_MS + 1_800_000; // 30m after REF

    it.each`
      locale                  | expected
      ${MustTestLocales.enUS} | ${"in 30 minutes"}
      ${MustTestLocales.enGB} | ${"in 30 minutes"}
      ${MustTestLocales.deDE} | ${"in 30 Minuten"}
      ${MustTestLocales.frFR} | ${"dans 30 minutes"}
      ${MustTestLocales.esES} | ${"dentro de 30 minutos"}
      ${MustTestLocales.itIT} | ${"tra 30 minuti"}
      ${MustTestLocales.ptPT} | ${"dentro de 30 minutos"}
      ${MustTestLocales.svSE} | ${"om 30 minuter"}
      ${MustTestLocales.isIS} | ${"eftir 30 mínútur"}
      ${MustTestLocales.zhCN} | ${"30分钟后"}
      ${MustTestLocales.zhTW} | ${"30 分鐘後"}
      ${MustTestLocales.jaJP} | ${"30 分後"}
      ${MustTestLocales.koKR} | ${"30분 후"}
      ${MustTestLocales.arSA} | ${"خلال ٣٠ دقيقة"}
      ${MustTestLocales.heIL} | ${"בעוד 30 דקות"}
      ${MustTestLocales.ruRU} | ${"через 30 минут"}
      ${MustTestLocales.trTR} | ${"30 dakika sonra"}
    `("formats for $locale as $expected", ({ locale, expected }) => {
      expect(formatRelativeUnix(value, locale, { reference: REF_MS })).toBe(
        expected,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // style option
  // ---------------------------------------------------------------------------
  describe("style option", () => {
    const value = REF_MS - 1_800_000; // 30m before REF

    it.each`
      style       | expected
      ${"long"}   | ${"30 minutes ago"}
      ${"short"}  | ${"30 min. ago"}
      ${"narrow"} | ${"30m ago"}
    `("style:$style formats -30m as $expected", ({ style, expected }) => {
      expect(
        formatRelativeUnix(value, MustTestLocales.enUS, {
          reference: REF_MS,
          style,
        }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // numeric option
  // ---------------------------------------------------------------------------
  describe("numeric option", () => {
    it.each`
      value                | numeric     | expected
      ${REF_MS}            | ${"auto"}   | ${"now"}
      ${REF_MS}            | ${"always"} | ${"in 0 seconds"}
      ${REF_MS + 86400000} | ${"auto"}   | ${"tomorrow"}
      ${REF_MS + 86400000} | ${"always"} | ${"in 1 day"}
      ${REF_MS - 86400000} | ${"auto"}   | ${"yesterday"}
      ${REF_MS - 86400000} | ${"always"} | ${"1 day ago"}
    `(
      "numeric:$numeric for $value → $expected",
      ({ value, numeric, expected }) => {
        expect(
          formatRelativeUnix(value, MustTestLocales.enUS, {
            reference: REF_MS,
            numeric,
          }),
        ).toBe(expected);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // explicit largestUnit
  // ---------------------------------------------------------------------------
  describe("explicit largestUnit", () => {
    it.each`
      value                   | largestUnit | expected
      ${REF_MS - 30_000}      | ${"minute"} | ${"0 minutes ago"}
      ${REF_MS - 10_800_000}  | ${"minute"} | ${"180 minutes ago"}
      ${REF_MS - 1_800_000}   | ${"hour"}   | ${"0 hours ago"}
      ${REF_MS - 10_800_000}  | ${"hour"}   | ${"3 hours ago"}
      ${REF_MS - 259_200_000} | ${"day"}    | ${"3 days ago"}
      ${REF_MS + 259_200_000} | ${"day"}    | ${"in 3 days"}
    `(
      "largestUnit:$largestUnit for $value → $expected",
      ({ value, largestUnit, expected }) => {
        expect(
          formatRelativeUnix(value, MustTestLocales.enUS, {
            reference: REF_MS,
            largestUnit,
            numeric: "always",
          }),
        ).toBe(expected);
      },
    );

    it("largestUnit:month — 2 months ago (2023-12-29)", () => {
      expect(
        formatRelativeUnix(1703808000000, MustTestLocales.enUS, {
          reference: REF_MS,
          largestUnit: "month",
        }),
      ).toBe("2 months ago");
    });

    it("largestUnit:month — in 2 months (2024-04-29)", () => {
      expect(
        formatRelativeUnix(1714348800000, MustTestLocales.enUS, {
          reference: REF_MS,
          largestUnit: "month",
        }),
      ).toBe("in 2 months");
    });

    it("largestUnit:year — last year (2023-02-28)", () => {
      expect(
        formatRelativeUnix(1677542400000, MustTestLocales.enUS, {
          reference: REF_MS,
          largestUnit: "year",
        }),
      ).toBe("last year");
    });

    it("largestUnit:year — next year (2025-03-01)", () => {
      expect(
        formatRelativeUnix(1740787200000, MustTestLocales.enUS, {
          reference: REF_MS,
          largestUnit: "year",
        }),
      ).toBe("next year");
    });
  });

  // ---------------------------------------------------------------------------
  // roundingMethod option
  // Controls how the fractional distance rounds to the display unit.
  // "round" (default) matches current Math.round behavior; "floor"/"ceil"
  // apply directly to the signed value, so they respect past vs. future.
  // ---------------------------------------------------------------------------
  describe("roundingMethod option", () => {
    it.each`
      value                | roundingMethod | expected
      ${REF_MS - 8280000}  | ${"floor"}     | ${"3 hours ago"}
      ${REF_MS - 8280000}  | ${"ceil"}      | ${"2 hours ago"}
      ${REF_MS - 8280000}  | ${"round"}     | ${"2 hours ago"}
      ${REF_MS + 8280000}  | ${"floor"}     | ${"in 2 hours"}
      ${REF_MS + 8280000}  | ${"ceil"}      | ${"in 3 hours"}
      ${REF_MS + 8280000}  | ${"round"}     | ${"in 2 hours"}
      ${REF_MS - 9000000}  | ${"floor"}     | ${"3 hours ago"}
      ${REF_MS - 9000000}  | ${"ceil"}      | ${"2 hours ago"}
      ${REF_MS - 9000000}  | ${"round"}     | ${"2 hours ago"}
      ${REF_MS - 10800000} | ${"floor"}     | ${"3 hours ago"}
      ${REF_MS - 10800000} | ${"ceil"}      | ${"3 hours ago"}
      ${REF_MS - 10800000} | ${"round"}     | ${"3 hours ago"}
    `(
      "roundingMethod:$roundingMethod for $value → $expected",
      ({ value, roundingMethod, expected }) => {
        expect(
          formatRelativeUnix(value, MustTestLocales.enUS, {
            reference: REF_MS,
            largestUnit: "hour",
            numeric: "always",
            roundingMethod,
          }),
        ).toBe(expected);
      },
    );

    it("defaults to 'round' when roundingMethod is omitted (matches explicit 'round')", () => {
      const value = REF_MS - 10800000;
      const omitted = formatRelativeUnix(value, MustTestLocales.enUS, {
        reference: REF_MS,
      });
      const explicit = formatRelativeUnix(value, MustTestLocales.enUS, {
        reference: REF_MS,
        roundingMethod: "round",
      });
      expect(omitted).toBe("3 hours ago");
      expect(explicit).toBe(omitted);
    });

    it.each`
      roundingMethod | expected
      ${"floor"}     | ${"2 months ago"}
      ${"ceil"}      | ${"1 month ago"}
      ${"round"}     | ${"2 months ago"}
    `(
      "combines with largestUnit:month (calendrical branch): $roundingMethod → $expected",
      ({ roundingMethod, expected }) => {
        expect(
          formatRelativeUnix(1704888000000, MustTestLocales.enUS, {
            reference: REF_MS,
            largestUnit: "month",
            numeric: "always",
            roundingMethod,
          }),
        ).toBe(expected);
      },
    );

    it("returns '' for an invalid roundingMethod", () => {
      expect(
        formatRelativeUnix(REF_MS - 8280000, MustTestLocales.enUS, {
          reference: REF_MS,
          roundingMethod: "nonsense" as never,
        }),
      ).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // timezone handling
  // timeZone only affects calendrical (month/year) diffs via the relativeTo
  // anchor. For second/minute/hour/day the result is pure-seconds arithmetic
  // and is identical regardless of zone.
  // ---------------------------------------------------------------------------
  describe("timezone handling", () => {
    const value = REF_MS - 1_800_000; // 30 minutes before REF

    it.each`
      timeZone              | expected
      ${"UTC"}              | ${"30 minutes ago"}
      ${"America/New_York"} | ${"30 minutes ago"}
      ${"Europe/Paris"}     | ${"30 minutes ago"}
      ${"Asia/Tokyo"}       | ${"30 minutes ago"}
    `(
      "timeZone $timeZone: 30 min diff produces $expected",
      ({ timeZone, expected }) => {
        expect(
          formatRelativeUnix(value, MustTestLocales.enUS, {
            reference: REF_MS,
            timeZone,
          }),
        ).toBe(expected);
      },
    );

    // ECMA-402 and Temporal throw RangeError for an unknown zone, so a typo is the sentinel, never UTC.
    it.each`
      timeZone
      ${"Invalid/Zone"}
      ${""}
      ${null}
    `("returns '' for invalid timeZone $timeZone", ({ timeZone }) => {
      expect(
        formatRelativeUnix(value, MustTestLocales.enUS, {
          reference: REF_MS,
          timeZone,
        }),
      ).toBe("");
    });

    // Temporal GetOptionsObject throws TypeError for null (and any non-object), so it is invalid.
    it.each`
      options
      ${null}
      ${"UTC"}
      ${1}
    `("returns '' for options $options", ({ options }) => {
      expect(
        formatRelativeUnix(value, MustTestLocales.enUS, options as never),
      ).toBe("");
    });

    // Temporal §13.17: a plural unit name is the singular unit.
    it.each`
      largestUnit
      ${"minute"}
      ${"minutes"}
    `("formats with largestUnit $largestUnit", ({ largestUnit }) => {
      expect(
        formatRelativeUnix(value, MustTestLocales.enUS, {
          reference: REF_MS,
          largestUnit,
        }),
      ).toBe("30 minutes ago");
    });

    it("uses getSystemTimeZone() when timeZone is 'local'", () => {
      vi.spyOn(getSystemTimeZoneModule, "getSystemTimeZone").mockReturnValue(
        "America/New_York",
      );
      expect(
        formatRelativeUnix(value, MustTestLocales.enUS, {
          reference: REF_MS,
          timeZone: "local",
        }),
      ).toBe("30 minutes ago");
    });

    it("largestUnit:month respects explicit timeZone for relativeTo anchor", () => {
      // 2 months before REF_MS (2024-02-29): 2023-12-29 ms = 1703808000000
      expect(
        formatRelativeUnix(1703808000000, MustTestLocales.enUS, {
          reference: REF_MS,
          largestUnit: "month",
          timeZone: "America/New_York",
        }),
      ).toBe("2 months ago");
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid inputs — must return ""
  // ---------------------------------------------------------------------------
  describe("invalid inputs", () => {
    it.each`
      value
      ${"not-a-number"}
      ${"abc123"}
      ${NaN}
      ${Infinity}
      ${-Infinity}
      ${null}
      ${undefined}
      ${true}
    `("returns '' for invalid value $value", ({ value }) => {
      expect(
        formatRelativeUnix(value as never, MustTestLocales.enUS, {
          reference: REF_MS,
        }),
      ).toBe("");
    });

    it("returns '' when string reference is invalid", () => {
      expect(
        formatRelativeUnix(REF_MS, MustTestLocales.enUS, {
          reference: "not-a-date",
        }),
      ).toBe("");
    });

    it("returns '' when string reference is empty", () => {
      expect(
        formatRelativeUnix(REF_MS, MustTestLocales.enUS, { reference: "" }),
      ).toBe("");
    });

    it("returns '' when numeric reference is NaN", () => {
      expect(
        formatRelativeUnix(REF_MS, MustTestLocales.enUS, { reference: NaN }),
      ).toBe("");
    });

    it("returns '' when numeric reference is Infinity", () => {
      expect(
        formatRelativeUnix(REF_MS, MustTestLocales.enUS, {
          reference: Infinity,
        }),
      ).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Temporal failures
  // ---------------------------------------------------------------------------
  describe("Temporal failures", () => {
    it("returns '' when Temporal.Now.instant throws (no reference provided)", () => {
      mockTemporalNowInstantThrow();
      expect(formatRelativeUnix(REF_MS, MustTestLocales.enUS)).toBe("");
    });
  });
});

// The last representable instant, +275760-09-13T00:00:00Z, in epoch milliseconds (TC39 nsMaxInstant).
const MAX_MS = 8_640_000_000_000_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

describe("formatRelativeUnix months and years in the last month of the range", () => {
  // Reference max - 31d, value max - 5h. TC39 NudgeToCalendarUnit totals 30d 19h over the month from
  // the reference, 0.9932795698924731 months; in a zone ahead of UTC that month's end wall clock is
  // past +275760-09-13T00:00 but in range. Floor gives 0 ("this month"), ceil 1 ("next month").
  it.each`
    timeZone                | largestUnit | roundingMethod | expected
    ${"Australia/Sydney"}   | ${"month"}  | ${"floor"}     | ${"this month"}
    ${"Australia/Sydney"}   | ${"month"}  | ${"ceil"}      | ${"next month"}
    ${"Pacific/Kiritimati"} | ${"month"}  | ${"floor"}     | ${"this month"}
    ${"UTC"}                | ${"month"}  | ${"floor"}     | ${"this month"}
    ${"Australia/Sydney"}   | ${"year"}   | ${"floor"}     | ${""}
  `(
    "formats max - 5h against max - 31d in $timeZone by $largestUnit with $roundingMethod as $expected",
    ({ timeZone, largestUnit, roundingMethod, expected }) => {
      // A year total's window ends past the maximum, so Temporal throws and the result is "".
      expect(
        formatRelativeUnix(MAX_MS - 5 * HOUR_MS, MustTestLocales.enUS, {
          reference: MAX_MS - 31 * DAY_MS,
          timeZone,
          largestUnit,
          roundingMethod,
        }),
      ).toBe(expected);
    },
  );
});

// The first representable instant, -271821-04-20T00:00:00Z, in epoch milliseconds (TC39 nsMinInstant).
const MIN_MS = -MAX_MS;
// Local 20:00 on an LMT day: New York -04:56:02 is 00:56:02Z, Honolulu -10:31:26 is 06:31:26Z.
const NEW_YORK_20H_MS = 56 * 60_000 + 2_000;
const HONOLULU_20H_MS = 6 * HOUR_MS + 31 * 60_000 + 26_000;

describe("formatRelativeUnix months in the first month of the range", () => {
  // Value local -271821-04-24T20:00 (min + 5d) and reference local -271821-05-19T20:00 (min + 30d).
  // TC39 NudgeToCalendarUnit totals -25 days over the month back from the reference, whose end wall
  // clock, local -271821-04-19T20:00, is on the minimum's local date in a zone behind UTC but in
  // range: -25/30 months. Floor gives -1 ("last month"), ceil -0 ("this month").
  it.each`
    offset             | timeZone              | roundingMethod | expected
    ${NEW_YORK_20H_MS} | ${"America/New_York"} | ${"floor"}     | ${"last month"}
    ${NEW_YORK_20H_MS} | ${"America/New_York"} | ${"ceil"}      | ${"this month"}
    ${HONOLULU_20H_MS} | ${"Pacific/Honolulu"} | ${"floor"}     | ${"last month"}
  `(
    "formats min + 5d against min + 30d at local 20:00 in $timeZone with $roundingMethod as $expected",
    ({ offset, timeZone, roundingMethod, expected }) => {
      expect(
        formatRelativeUnix(MIN_MS + 5 * DAY_MS + offset, MustTestLocales.enUS, {
          reference: MIN_MS + 30 * DAY_MS + offset,
          timeZone,
          largestUnit: "month",
          roundingMethod,
        }),
      ).toBe(expected);
    },
  );
});

describe("formatRelativeUnix with an unrecognised epochUnit", () => {
  // isValidUnixUnit defines the domain ("seconds" | "milliseconds", singular or plural): any other value is invalid
  // input and returns the sentinel, never a silent read as milliseconds.
  it.each`
    epochUnit
    ${"nanoseconds"}
    ${"SECONDS"}
    ${"ms"}
    ${""}
    ${1000}
  `('returns "" for epochUnit $epochUnit', ({ epochUnit }) => {
    expect(
      formatRelativeUnix(1_706_659_200, "en-US", {
        epochUnit: epochUnit as never,
        reference: 1_706_659_200,
        timeZone: "UTC",
      }),
    ).toBe("");
  });
});

// Beyond a day, the unit is auto-picked with formatRelativeDate's thresholds: day under 7 days,
// week under 28, month under 365, year beyond. Totals are rounded (default "round") against the
// reference in UTC; labels from native Temporal + Intl.RelativeTimeFormat("en-US", { numeric:
// "auto" }) in Chromium 153. The reference 1709164800000 is 2024-02-29T00:00:00Z.
describe("formatRelativeUnix auto-picks week, month and year", () => {
  it.each`
    value            | expected           | reason
    ${1708905600000} | ${"3 days ago"}    | ${"2024-02-26, 3 days: day"}
    ${1708646401000} | ${"6 days ago"}    | ${"2024-02-23T00:00:01Z, just under 7 days: day"}
    ${1708560000000} | ${"last week"}     | ${"2024-02-22, 7 days: week"}
    ${1707955200000} | ${"2 weeks ago"}   | ${"2024-02-15, 14 days: week"}
    ${1706745601000} | ${"4 weeks ago"}   | ${"2024-02-01T00:00:01Z, just under 28 days: week"}
    ${1703808000000} | ${"2 months ago"}  | ${"2023-12-29, 62 days: month"}
    ${1677628801000} | ${"12 months ago"} | ${"2023-03-01T00:00:01Z, just under 365 days: month, 11.97 rounds to 12"}
    ${1740700800000} | ${"next year"}     | ${"2025-02-28, 365 days: year"}
    ${1614556800000} | ${"3 years ago"}   | ${"2021-03-01, 1095 days: year"}
  `(
    "formats $value against 1709164800000 as $expected ($reason)",
    ({ value, expected }) => {
      expect(
        formatRelativeUnix(value, "en-US", { reference: 1709164800000 }),
      ).toBe(expected);
    },
  );
});

// ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
// is used, and a malformed tag anywhere in the list is invalid input. Expected strings from native
// Intl with the same list (Chromium 153).
describe("formatRelativeUnix with a locale list", () => {
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"il y a 30 minutes"}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `("returns $expected for locale list $locale", ({ locale, expected }) => {
    expect(
      formatRelativeUnix(REF_MS - 1_800_000, locale as string[], {
        reference: REF_MS,
      }),
    ).toBe(expected);
  });
});
