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

    it("falls back to UTC for an invalid timeZone (still returns relative string)", () => {
      expect(
        formatRelativeUnix(value, MustTestLocales.enUS, {
          reference: REF_MS,
          timeZone: "Invalid/Zone",
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
