import { vi } from "vitest";
import { MustTestLocales } from "../../test";
import { mockTemporalNowInstantThrow } from "../../test/mocks";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { formatRelativeUtc } from "./formatRelativeUtc";

// All tests use a fixed reference so output is deterministic regardless of
// when the suite runs.
const REF = "2024-03-15T12:00:00Z";

describe("formatRelativeUtc", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Auto unit selection
  // The function picks second/minute/hour/day based on the magnitude of the
  // difference. These tests verify the threshold logic.
  // ---------------------------------------------------------------------------
  describe("auto unit selection", () => {
    it.each`
      value                     | expected
      ${"2024-03-15T11:59:30Z"} | ${"30 seconds ago"}
      ${"2024-03-15T12:00:30Z"} | ${"in 30 seconds"}
      ${"2024-03-15T11:30:00Z"} | ${"30 minutes ago"}
      ${"2024-03-15T12:30:00Z"} | ${"in 30 minutes"}
      ${"2024-03-15T09:00:00Z"} | ${"3 hours ago"}
      ${"2024-03-15T15:00:00Z"} | ${"in 3 hours"}
      ${"2024-03-12T12:00:00Z"} | ${"3 days ago"}
      ${"2024-03-18T12:00:00Z"} | ${"in 3 days"}
    `("formats $value relative to REF as $expected", ({ value, expected }) => {
      expect(
        formatRelativeUtc(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // ±1 and 0 permutations for each unit
  // Covers the "yesterday"/"tomorrow"/"now" special cases that numeric:"auto"
  // produces, and the singular vs plural boundary.
  // ---------------------------------------------------------------------------
  describe("±1 and 0 permutations", () => {
    it.each`
      value                     | expected
      ${"2024-03-15T12:00:00Z"} | ${"now"}
      ${"2024-03-15T12:00:01Z"} | ${"in 1 second"}
      ${"2024-03-15T11:59:59Z"} | ${"1 second ago"}
      ${"2024-03-15T12:01:00Z"} | ${"in 1 minute"}
      ${"2024-03-15T11:59:00Z"} | ${"1 minute ago"}
      ${"2024-03-15T13:00:00Z"} | ${"in 1 hour"}
      ${"2024-03-15T11:00:00Z"} | ${"1 hour ago"}
      ${"2024-03-16T12:00:00Z"} | ${"tomorrow"}
      ${"2024-03-14T12:00:00Z"} | ${"yesterday"}
    `("formats $value (en-US, auto) as $expected", ({ value, expected }) => {
      expect(
        formatRelativeUtc(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // Locale coverage — 30 minutes in the past, default options
  // One canonical case across all MustTestLocales to verify locale forwarding.
  // ---------------------------------------------------------------------------
  describe("locale coverage — 30 minutes past", () => {
    const value = "2024-03-15T11:30:00Z"; // 30m before REF

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
      expect(formatRelativeUtc(value, locale, { reference: REF })).toBe(
        expected,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Locale coverage — 30 minutes in the future
  // ---------------------------------------------------------------------------
  describe("locale coverage — 30 minutes future", () => {
    const value = "2024-03-15T12:30:00Z"; // 30m after REF

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
      expect(formatRelativeUtc(value, locale, { reference: REF })).toBe(
        expected,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // style option
  // ---------------------------------------------------------------------------
  describe("style option", () => {
    const value = "2024-03-15T11:30:00Z"; // 30m before REF

    it.each`
      style       | expected
      ${"long"}   | ${"30 minutes ago"}
      ${"short"}  | ${"30 min. ago"}
      ${"narrow"} | ${"30m ago"}
    `("style:$style formats -30m as $expected", ({ style, expected }) => {
      expect(
        formatRelativeUtc(value, MustTestLocales.enUS, {
          reference: REF,
          style,
        }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // numeric option
  // numeric:"auto" produces natural language ("yesterday", "now") while
  // numeric:"always" always uses a number ("in 0 seconds", "in 1 day").
  // ---------------------------------------------------------------------------
  describe("numeric option", () => {
    it.each`
      value                     | numeric     | expected
      ${"2024-03-15T12:00:00Z"} | ${"auto"}   | ${"now"}
      ${"2024-03-15T12:00:00Z"} | ${"always"} | ${"in 0 seconds"}
      ${"2024-03-16T12:00:00Z"} | ${"auto"}   | ${"tomorrow"}
      ${"2024-03-16T12:00:00Z"} | ${"always"} | ${"in 1 day"}
      ${"2024-03-14T12:00:00Z"} | ${"auto"}   | ${"yesterday"}
      ${"2024-03-14T12:00:00Z"} | ${"always"} | ${"1 day ago"}
    `(
      "numeric:$numeric for $value → $expected",
      ({ value, numeric, expected }) => {
        expect(
          formatRelativeUtc(value, MustTestLocales.enUS, {
            reference: REF,
            numeric,
          }),
        ).toBe(expected);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // explicit largestUnit
  // Overrides auto-detection to force a specific unit.
  // ---------------------------------------------------------------------------
  describe("explicit largestUnit", () => {
    it.each`
      value                     | largestUnit | expected
      ${"2024-03-15T11:59:30Z"} | ${"minute"} | ${"0 minutes ago"}
      ${"2024-03-15T09:00:00Z"} | ${"minute"} | ${"180 minutes ago"}
      ${"2024-03-15T11:30:00Z"} | ${"hour"}   | ${"0 hours ago"}
      ${"2024-03-15T09:00:00Z"} | ${"hour"}   | ${"3 hours ago"}
      ${"2024-03-12T12:00:00Z"} | ${"day"}    | ${"3 days ago"}
      ${"2024-03-18T12:00:00Z"} | ${"day"}    | ${"in 3 days"}
    `(
      "largestUnit:$largestUnit for $value → $expected",
      ({ value, largestUnit, expected }) => {
        expect(
          formatRelativeUtc(value, MustTestLocales.enUS, {
            reference: REF,
            largestUnit,
            numeric: "always",
          }),
        ).toBe(expected);
      },
    );

    it("largestUnit:month uses calendrical calculation (2 months ago)", () => {
      expect(
        formatRelativeUtc("2024-01-15T12:00:00Z", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "month",
        }),
      ).toBe("2 months ago");
    });

    it("largestUnit:month uses calendrical calculation (in 2 months)", () => {
      expect(
        formatRelativeUtc("2024-05-15T12:00:00Z", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "month",
        }),
      ).toBe("in 2 months");
    });

    it("largestUnit:year (last year)", () => {
      expect(
        formatRelativeUtc("2023-03-15T12:00:00Z", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "year",
        }),
      ).toBe("last year");
    });

    it("largestUnit:year (next year)", () => {
      expect(
        formatRelativeUtc("2025-03-15T12:00:00Z", MustTestLocales.enUS, {
          reference: REF,
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
      value                     | roundingMethod | expected
      ${"2024-03-15T09:42:00Z"} | ${"floor"}     | ${"3 hours ago"}
      ${"2024-03-15T09:42:00Z"} | ${"ceil"}      | ${"2 hours ago"}
      ${"2024-03-15T09:42:00Z"} | ${"round"}     | ${"2 hours ago"}
      ${"2024-03-15T14:18:00Z"} | ${"floor"}     | ${"in 2 hours"}
      ${"2024-03-15T14:18:00Z"} | ${"ceil"}      | ${"in 3 hours"}
      ${"2024-03-15T14:18:00Z"} | ${"round"}     | ${"in 2 hours"}
      ${"2024-03-15T09:30:00Z"} | ${"floor"}     | ${"3 hours ago"}
      ${"2024-03-15T09:30:00Z"} | ${"ceil"}      | ${"2 hours ago"}
      ${"2024-03-15T09:30:00Z"} | ${"round"}     | ${"2 hours ago"}
      ${"2024-03-15T09:00:00Z"} | ${"floor"}     | ${"3 hours ago"}
      ${"2024-03-15T09:00:00Z"} | ${"ceil"}      | ${"3 hours ago"}
      ${"2024-03-15T09:00:00Z"} | ${"round"}     | ${"3 hours ago"}
    `(
      "roundingMethod:$roundingMethod for $value → $expected",
      ({ value, roundingMethod, expected }) => {
        expect(
          formatRelativeUtc(value, MustTestLocales.enUS, {
            reference: REF,
            largestUnit: "hour",
            numeric: "always",
            roundingMethod,
          }),
        ).toBe(expected);
      },
    );

    it("defaults to 'round' when roundingMethod is omitted (matches explicit 'round')", () => {
      const value = "2024-03-15T09:00:00Z";
      const omitted = formatRelativeUtc(value, MustTestLocales.enUS, {
        reference: REF,
      });
      const explicit = formatRelativeUtc(value, MustTestLocales.enUS, {
        reference: REF,
        roundingMethod: "round",
      });
      expect(omitted).toBe("3 hours ago");
      expect(explicit).toBe(omitted);
    });

    it.each`
      roundingMethod | expected
      ${"floor"}     | ${"3 months ago"}
      ${"ceil"}      | ${"2 months ago"}
      ${"round"}     | ${"2 months ago"}
    `(
      "combines with largestUnit:month (calendrical branch): $roundingMethod → $expected",
      ({ roundingMethod, expected }) => {
        expect(
          formatRelativeUtc("2024-01-10T12:00:00Z", MustTestLocales.enUS, {
            reference: REF,
            largestUnit: "month",
            roundingMethod,
          }),
        ).toBe(expected);
      },
    );

    it("returns '' for an invalid roundingMethod", () => {
      expect(
        formatRelativeUtc("2024-03-15T09:42:00Z", MustTestLocales.enUS, {
          reference: REF,
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
    const value = "2024-03-15T11:30:00Z"; // 30 minutes before REF

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
          formatRelativeUtc(value, MustTestLocales.enUS, {
            reference: REF,
            timeZone,
          }),
        ).toBe(expected);
      },
    );

    it("falls back to UTC for an invalid timeZone (still returns relative string)", () => {
      expect(
        formatRelativeUtc(value, MustTestLocales.enUS, {
          reference: REF,
          timeZone: "Invalid/Zone",
        }),
      ).toBe("30 minutes ago");
    });

    it("uses getSystemTimeZone() when timeZone is 'local'", () => {
      vi.spyOn(getSystemTimeZoneModule, "getSystemTimeZone").mockReturnValue(
        "America/New_York",
      );
      expect(
        formatRelativeUtc(value, MustTestLocales.enUS, {
          reference: REF,
          timeZone: "local",
        }),
      ).toBe("30 minutes ago");
    });

    it("largestUnit:month respects explicit timeZone for relativeTo anchor", () => {
      // 2 calendar months before REF regardless of zone for this clean case
      expect(
        formatRelativeUtc("2024-01-15T12:00:00Z", MustTestLocales.enUS, {
          reference: REF,
          largestUnit: "month",
          timeZone: "America/New_York",
        }),
      ).toBe("2 months ago");
    });
  });

  // ---------------------------------------------------------------------------
  // date-only UTC strings
  // The utcDateTime regex requires a time component, so "2024-03-15Z" is
  // rejected by isValidUtc and the function returns "".
  // ---------------------------------------------------------------------------
  describe("date-only UTC strings", () => {
    it("returns '' for date-only value (no time component)", () => {
      expect(
        formatRelativeUtc("2024-03-15Z", MustTestLocales.enUS, {
          reference: REF,
        }),
      ).toBe("");
    });

    it("returns '' when reference is date-only", () => {
      expect(
        formatRelativeUtc(REF, MustTestLocales.enUS, {
          reference: "2024-03-15Z",
        }),
      ).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid inputs — must return ""
  // ---------------------------------------------------------------------------
  describe("invalid inputs", () => {
    it.each`
      value
      ${""}
      ${"not-a-date"}
      ${"2024-13-01T00:00:00Z"}
      ${"2024-02-30T00:00:00Z"}
      ${"2024-12-31T23:59:60Z"}
      ${null}
      ${undefined}
      ${42}
      ${true}
    `("returns '' for invalid value $value", ({ value }) => {
      expect(formatRelativeUtc(value as never, MustTestLocales.enUS)).toBe("");
    });

    it("returns '' when reference is provided but invalid", () => {
      expect(
        formatRelativeUtc("2024-03-15T12:00:00Z", MustTestLocales.enUS, {
          reference: "not-a-date",
        }),
      ).toBe("");
    });

    it("returns '' when reference is an empty string", () => {
      expect(
        formatRelativeUtc("2024-03-15T12:00:00Z", MustTestLocales.enUS, {
          reference: "",
        }),
      ).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Temporal failures — internal errors must not throw, must return ""
  // ---------------------------------------------------------------------------
  describe("Temporal failures", () => {
    it("returns '' when Temporal.Now.instant throws (no reference provided)", () => {
      mockTemporalNowInstantThrow();
      expect(
        formatRelativeUtc("2024-03-15T12:00:00Z", MustTestLocales.enUS),
      ).toBe("");
    });
  });
});
