import { vi } from "vitest";
import { MustTestLocales } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { formatRelativeZoned } from "./formatRelativeZoned";

// All tests use a fixed reference so output is deterministic regardless of
// when the suite runs. 2024-02-29T00:00:00+00:00[UTC] = leap day midnight UTC.
const REF = "2024-02-29T00:00:00+00:00[UTC]";
// Same instant as a plain UTC ISO string — used to test UTC-string references.
const REF_UTC = "2024-02-29T00:00:00Z";
// Same instant as a unix epoch milliseconds — used to test numeric references.
const REF_MS = 1709164800000;

describe("formatRelativeZoned", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Auto unit selection
  // The function picks second/minute/hour/day based on the magnitude of the
  // difference. Values are in UTC zone for clarity.
  // ---------------------------------------------------------------------------
  describe("auto unit selection", () => {
    it.each`
      value                               | expected
      ${"2024-02-28T23:59:30+00:00[UTC]"} | ${"30 seconds ago"}
      ${"2024-02-29T00:00:30+00:00[UTC]"} | ${"in 30 seconds"}
      ${"2024-02-28T23:30:00+00:00[UTC]"} | ${"30 minutes ago"}
      ${"2024-02-29T00:30:00+00:00[UTC]"} | ${"in 30 minutes"}
      ${"2024-02-28T21:00:00+00:00[UTC]"} | ${"3 hours ago"}
      ${"2024-02-29T03:00:00+00:00[UTC]"} | ${"in 3 hours"}
      ${"2024-02-26T00:00:00+00:00[UTC]"} | ${"3 days ago"}
      ${"2024-03-03T00:00:00+00:00[UTC]"} | ${"in 3 days"}
    `("formats $value relative to REF as $expected", ({ value, expected }) => {
      expect(
        formatRelativeZoned(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // ±1 and 0 permutations
  // Covers the "yesterday"/"tomorrow"/"now" special cases that numeric:"auto"
  // produces, and the singular vs plural boundary.
  // ---------------------------------------------------------------------------
  describe("±1 and 0 permutations", () => {
    it.each`
      value                               | expected
      ${"2024-02-29T00:00:00+00:00[UTC]"} | ${"now"}
      ${"2024-02-29T00:00:01+00:00[UTC]"} | ${"in 1 second"}
      ${"2024-02-28T23:59:59+00:00[UTC]"} | ${"1 second ago"}
      ${"2024-02-29T00:01:00+00:00[UTC]"} | ${"in 1 minute"}
      ${"2024-02-28T23:59:00+00:00[UTC]"} | ${"1 minute ago"}
      ${"2024-02-29T01:00:00+00:00[UTC]"} | ${"in 1 hour"}
      ${"2024-02-28T23:00:00+00:00[UTC]"} | ${"1 hour ago"}
      ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"tomorrow"}
      ${"2024-02-28T00:00:00+00:00[UTC]"} | ${"yesterday"}
    `("formats $value (en-US, auto) as $expected", ({ value, expected }) => {
      expect(
        formatRelativeZoned(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // Locale coverage — 30 minutes in the past, default options
  // ---------------------------------------------------------------------------
  describe("locale coverage — 30 minutes past", () => {
    const value = "2024-02-28T23:30:00+00:00[UTC]"; // 30m before REF

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
      expect(formatRelativeZoned(value, locale, { reference: REF })).toBe(
        expected,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Locale coverage — 30 minutes in the future
  // ---------------------------------------------------------------------------
  describe("locale coverage — 30 minutes future", () => {
    const value = "2024-02-29T00:30:00+00:00[UTC]"; // 30m after REF

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
      expect(formatRelativeZoned(value, locale, { reference: REF })).toBe(
        expected,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // style option
  // ---------------------------------------------------------------------------
  describe("style option", () => {
    const value = "2024-02-28T23:30:00+00:00[UTC]"; // 30m before REF

    it.each`
      style       | expected
      ${"long"}   | ${"30 minutes ago"}
      ${"short"}  | ${"30 min. ago"}
      ${"narrow"} | ${"30m ago"}
    `("style:$style formats -30m as $expected", ({ style, expected }) => {
      expect(
        formatRelativeZoned(value, MustTestLocales.enUS, {
          reference: REF,
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
      value                               | numeric     | expected
      ${"2024-02-29T00:00:00+00:00[UTC]"} | ${"auto"}   | ${"now"}
      ${"2024-02-29T00:00:00+00:00[UTC]"} | ${"always"} | ${"in 0 seconds"}
      ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"auto"}   | ${"tomorrow"}
      ${"2024-03-01T00:00:00+00:00[UTC]"} | ${"always"} | ${"in 1 day"}
      ${"2024-02-28T00:00:00+00:00[UTC]"} | ${"auto"}   | ${"yesterday"}
      ${"2024-02-28T00:00:00+00:00[UTC]"} | ${"always"} | ${"1 day ago"}
    `(
      "numeric:$numeric for $value → $expected",
      ({ value, numeric, expected }) => {
        expect(
          formatRelativeZoned(value, MustTestLocales.enUS, {
            reference: REF,
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
      value                               | largestUnit | expected
      ${"2024-02-28T23:59:30+00:00[UTC]"} | ${"minute"} | ${"0 minutes ago"}
      ${"2024-02-28T21:00:00+00:00[UTC]"} | ${"minute"} | ${"180 minutes ago"}
      ${"2024-02-28T23:30:00+00:00[UTC]"} | ${"hour"}   | ${"0 hours ago"}
      ${"2024-02-28T21:00:00+00:00[UTC]"} | ${"hour"}   | ${"3 hours ago"}
      ${"2024-02-26T00:00:00+00:00[UTC]"} | ${"day"}    | ${"3 days ago"}
      ${"2024-03-03T00:00:00+00:00[UTC]"} | ${"day"}    | ${"in 3 days"}
    `(
      "largestUnit:$largestUnit for $value → $expected",
      ({ value, largestUnit, expected }) => {
        expect(
          formatRelativeZoned(value, MustTestLocales.enUS, {
            reference: REF,
            largestUnit,
            numeric: "always",
          }),
        ).toBe(expected);
      },
    );

    it("largestUnit:month — 2 months ago (2023-12-29)", () => {
      expect(
        formatRelativeZoned(
          "2023-12-29T00:00:00+00:00[UTC]",
          MustTestLocales.enUS,
          { reference: REF, largestUnit: "month" },
        ),
      ).toBe("2 months ago");
    });

    it("largestUnit:month — in 2 months (2024-04-29)", () => {
      expect(
        formatRelativeZoned(
          "2024-04-29T00:00:00+00:00[UTC]",
          MustTestLocales.enUS,
          { reference: REF, largestUnit: "month" },
        ),
      ).toBe("in 2 months");
    });

    it("largestUnit:year — last year (2023-02-28)", () => {
      expect(
        formatRelativeZoned(
          "2023-02-28T00:00:00+00:00[UTC]",
          MustTestLocales.enUS,
          { reference: REF, largestUnit: "year" },
        ),
      ).toBe("last year");
    });

    it("largestUnit:year — next year (2025-03-01)", () => {
      expect(
        formatRelativeZoned(
          "2025-03-01T00:00:00+00:00[UTC]",
          MustTestLocales.enUS,
          { reference: REF, largestUnit: "year" },
        ),
      ).toBe("next year");
    });
  });

  // ---------------------------------------------------------------------------
  // reference type variants
  // The reference can be a ZonedDateTime string, a UTC ISO string, or a
  // unix epoch in milliseconds. All three represent the same instant.
  // ---------------------------------------------------------------------------
  describe("reference type variants", () => {
    const value = "2024-02-28T23:30:00+00:00[UTC]"; // 30m before REF

    it("accepts a ZonedDateTime string reference", () => {
      expect(
        formatRelativeZoned(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe("30 minutes ago");
    });

    it("accepts a UTC ISO string reference", () => {
      expect(
        formatRelativeZoned(value, MustTestLocales.enUS, {
          reference: REF_UTC,
        }),
      ).toBe("30 minutes ago");
    });

    it("accepts a unix epoch (ms) reference", () => {
      expect(
        formatRelativeZoned(value, MustTestLocales.enUS, {
          reference: REF_MS,
        }),
      ).toBe("30 minutes ago");
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-zone values
  // The value's embedded zone is authoritative. Different zones representing
  // the same UTC instant produce the same relative output.
  // ---------------------------------------------------------------------------
  describe("cross-zone values", () => {
    // 30 min before REF (UTC midnight) — same instant expressed in different zones:
    // Tokyo (JST = UTC+9):    23:30 UTC-prev-day = 08:30+09:00 next day
    // New York (EST = UTC-5): 23:30 UTC-prev-day = 18:30-05:00 same day
    // Paris (CET = UTC+1):    23:30 UTC-prev-day = 00:30+01:00 same day
    it.each`
      value                                            | expected
      ${"2024-02-29T08:30:00+09:00[Asia/Tokyo]"}       | ${"30 minutes ago"}
      ${"2024-02-28T18:30:00-05:00[America/New_York]"} | ${"30 minutes ago"}
      ${"2024-02-29T00:30:00+01:00[Europe/Paris]"}     | ${"30 minutes ago"}
    `("same UTC instant in $value → $expected", ({ value, expected }) => {
      expect(
        formatRelativeZoned(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });

    it("cross-zone ZonedDateTime reference (same instant, different zone)", () => {
      // REF as Tokyo time: 2024-02-29T09:00:00+09:00[Asia/Tokyo] = same UTC midnight
      expect(
        formatRelativeZoned(
          "2024-02-28T23:30:00+00:00[UTC]",
          MustTestLocales.enUS,
          { reference: "2024-02-29T09:00:00+09:00[Asia/Tokyo]" },
        ),
      ).toBe("30 minutes ago");
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid inputs — must return ""
  // ---------------------------------------------------------------------------
  describe("invalid inputs", () => {
    it.each`
      value
      ${""}
      ${"not-a-datetime"}
      ${"2024-02-29T00:00:00Z"}
      ${"2024-02-29T00:00:00"}
      ${"2024-02-29"}
      ${null}
      ${undefined}
      ${42}
      ${true}
    `("returns '' for invalid value $value", ({ value }) => {
      expect(formatRelativeZoned(value as never, MustTestLocales.enUS)).toBe(
        "",
      );
    });

    it("returns '' when string reference is not ZonedDateTime or UTC", () => {
      expect(
        formatRelativeZoned(
          "2024-02-28T23:30:00+00:00[UTC]",
          MustTestLocales.enUS,
          { reference: "not-a-date" },
        ),
      ).toBe("");
    });

    it("returns '' when string reference is an empty string", () => {
      expect(
        formatRelativeZoned(
          "2024-02-28T23:30:00+00:00[UTC]",
          MustTestLocales.enUS,
          { reference: "" },
        ),
      ).toBe("");
    });

    it("returns '' when numeric reference is NaN", () => {
      expect(
        formatRelativeZoned(
          "2024-02-28T23:30:00+00:00[UTC]",
          MustTestLocales.enUS,
          { reference: NaN },
        ),
      ).toBe("");
    });

    it("returns '' when numeric reference is Infinity", () => {
      expect(
        formatRelativeZoned(
          "2024-02-28T23:30:00+00:00[UTC]",
          MustTestLocales.enUS,
          { reference: Infinity },
        ),
      ).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Temporal failures — internal errors must not throw, must return ""
  // ---------------------------------------------------------------------------
  describe("Temporal failures", () => {
    it("returns '' when Temporal.Now.zonedDateTimeISO throws (no reference provided)", () => {
      mockTemporalNowZonedDateTimeISOThrow();
      expect(
        formatRelativeZoned(
          "2024-02-28T23:30:00+00:00[UTC]",
          MustTestLocales.enUS,
        ),
      ).toBe("");
    });
  });
});
