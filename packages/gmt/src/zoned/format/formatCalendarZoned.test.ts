import { vi } from "vitest";
import {
  MustTestLocales,
  battleTestTimeZones,
  expectDateTimeEqual,
} from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { formatCalendarZoned } from "./formatCalendarZoned";

const REF = "2024-03-15T09:00:00";

describe("formatCalendarZoned", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // ±1 and 0 permutations
  // ---------------------------------------------------------------------------
  describe("±1 and 0 permutations", () => {
    it.each`
      value                    | expected
      ${"2024-03-15T14:30:00"} | ${"today at 2:30 PM"}
      ${"2024-03-16T14:30:00"} | ${"tomorrow at 2:30 PM"}
      ${"2024-03-14T14:30:00"} | ${"yesterday at 2:30 PM"}
    `(
      "formats $value[America/New_York] relative to REF as $expected",
      ({ value, expected }) => {
        expect(
          formatCalendarZoned(
            `${value}-04:00[America/New_York]`,
            MustTestLocales.enUS,
            { reference: `${REF}-04:00[America/New_York]` },
          ),
        ).toBe(expected);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // Beyond the ±6-day threshold — absolute fallback
  // ---------------------------------------------------------------------------
  describe("beyond threshold — absolute fallback", () => {
    it("6 days out stays relative, 7 days out flips to absolute", () => {
      expect(
        formatCalendarZoned(
          "2024-03-21T14:30:00-04:00[America/New_York]",
          MustTestLocales.enUS,
          { reference: "2024-03-15T09:00:00-04:00[America/New_York]" },
        ),
      ).toBe("in 6 days at 2:30 PM");
      expect(
        formatCalendarZoned(
          "2024-03-22T14:30:00-04:00[America/New_York]",
          MustTestLocales.enUS,
          { reference: "2024-03-15T09:00:00-04:00[America/New_York]" },
        ),
      ).toBe("March 22, 2024 at 2:30 PM");
    });
  });

  // ---------------------------------------------------------------------------
  // battleTestTimeZones — every canonical zone renders the same "tomorrow"
  // label and correctly-zoned clock time.
  // ---------------------------------------------------------------------------
  describe("battleTestTimeZones", () => {
    it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
      "formats tomorrow correctly in $timeZone",
      ({ timeZone }) => {
        expect(
          formatCalendarZoned(
            `2024-03-16T14:30:00[${timeZone}]`,
            MustTestLocales.enUS,
            { reference: `2024-03-15T09:00:00[${timeZone}]` },
          ),
        ).toBe("tomorrow at 2:30 PM");
      },
    );
  });

  // ---------------------------------------------------------------------------
  // DST boundaries — America/Chicago and Europe/Berlin, spring-forward and
  // fall-back. The calendar-day diff must not be perturbed by a 23- or
  // 25-hour local day.
  // ---------------------------------------------------------------------------
  describe("DST boundaries", () => {
    it.each`
      timeZone             | reference                | value                    | label
      ${"America/Chicago"} | ${"2024-03-09T09:00:00"} | ${"2024-03-10T14:30:00"} | ${"spring-forward"}
      ${"America/Chicago"} | ${"2024-11-02T09:00:00"} | ${"2024-11-03T14:30:00"} | ${"fall-back"}
      ${"Europe/Berlin"}   | ${"2024-03-30T09:00:00"} | ${"2024-03-31T14:30:00"} | ${"spring-forward"}
      ${"Europe/Berlin"}   | ${"2024-10-26T09:00:00"} | ${"2024-10-27T14:30:00"} | ${"fall-back"}
    `(
      "$timeZone $label: still 'tomorrow' across the transition",
      ({ timeZone, reference, value }) => {
        expect(
          formatCalendarZoned(`${value}[${timeZone}]`, MustTestLocales.enUS, {
            reference: `${reference}[${timeZone}]`,
          }),
        ).toBe("tomorrow at 2:30 PM");
      },
    );
  });

  // ---------------------------------------------------------------------------
  // Per-locale coverage
  // ---------------------------------------------------------------------------
  describe("locale matrix", () => {
    it.each`
      locale                  | expected
      ${MustTestLocales.enUS} | ${"tomorrow at 2:30 PM"}
      ${MustTestLocales.enGB} | ${"tomorrow at 14:30"}
      ${MustTestLocales.deDE} | ${"morgen um 14:30"}
      ${MustTestLocales.frFR} | ${"demain à 14:30"}
      ${MustTestLocales.esES} | ${"mañana, 14:30"}
      ${MustTestLocales.itIT} | ${"domani alle ore 14:30"}
      ${MustTestLocales.ptPT} | ${"amanhã às 14:30"}
      ${MustTestLocales.svSE} | ${"i morgon kl. 14:30"}
      ${MustTestLocales.isIS} | ${"á morgun kl. 14:30"}
      ${MustTestLocales.zhCN} | ${"明天 14:30"}
      ${MustTestLocales.zhTW} | ${"明天 下午2:30"}
      ${MustTestLocales.jaJP} | ${"明日 14:30"}
      ${MustTestLocales.koKR} | ${"내일 오후 2:30"}
      ${MustTestLocales.arSA} | ${"غدًا في ٢:٣٠ م"}
      ${MustTestLocales.heIL} | ${"מחר בשעה 14:30"}
      ${MustTestLocales.ruRU} | ${"завтра в 14:30"}
      ${MustTestLocales.trTR} | ${"yarın 14:30"}
    `("formats tomorrow for $locale as $expected", ({ locale, expected }) => {
      expectDateTimeEqual(
        formatCalendarZoned(
          "2024-03-16T14:30:00-04:00[America/New_York]",
          locale,
          { reference: "2024-03-15T09:00:00-04:00[America/New_York]" },
        ),
        expected,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // reference option — string forms and cross-zone placement
  // ---------------------------------------------------------------------------
  describe("reference option", () => {
    it("accepts a UTC ISO string reference, placed into value's zone", () => {
      // 2024-03-15T13:00:00Z is 09:00 in America/New_York (-04:00 in March).
      expect(
        formatCalendarZoned(
          "2024-03-16T14:30:00-04:00[America/New_York]",
          MustTestLocales.enUS,
          { reference: "2024-03-15T13:00:00Z" },
        ),
      ).toBe("tomorrow at 2:30 PM");
    });

    it("accepts a numeric epoch-millisecond reference, placed into value's zone", () => {
      const referenceMs = Date.UTC(2024, 2, 15, 13, 0);
      expect(
        formatCalendarZoned(
          "2024-03-16T14:30:00-04:00[America/New_York]",
          MustTestLocales.enUS,
          { reference: referenceMs },
        ),
      ).toBe("tomorrow at 2:30 PM");
    });

    it("converts a ZonedDateTime reference from a different zone into value's zone", () => {
      // Same instant as 2024-03-15T09:00:00-04:00[America/New_York], expressed in UTC's zone.
      expect(
        formatCalendarZoned(
          "2024-03-16T14:30:00-04:00[America/New_York]",
          MustTestLocales.enUS,
          { reference: "2024-03-15T13:00:00+00:00[UTC]" },
        ),
      ).toBe("tomorrow at 2:30 PM");
    });

    it("defaults to 'now' in value's own zone when reference is omitted", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-03-15T13:00:00Z"));
      try {
        expect(
          formatCalendarZoned(
            "2024-03-16T14:30:00-04:00[America/New_York]",
            MustTestLocales.enUS,
          ),
        ).toBe("tomorrow at 2:30 PM");
      } finally {
        vi.useRealTimers();
      }
    });

    it("returns '' when a string reference is neither a valid ZonedDateTime nor a valid UTC string", () => {
      expect(
        formatCalendarZoned(
          "2024-03-16T14:30:00-04:00[America/New_York]",
          MustTestLocales.enUS,
          { reference: "not-a-date" },
        ),
      ).toBe("");
    });

    it("returns '' when a numeric reference is not finite", () => {
      expect(
        formatCalendarZoned(
          "2024-03-16T14:30:00-04:00[America/New_York]",
          MustTestLocales.enUS,
          { reference: Number.NaN },
        ),
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
      ${"2024-03-16T14:30:00"}
      ${null}
      ${undefined}
      ${42}
      ${true}
    `("returns '' for invalid value $value", ({ value }) => {
      expect(formatCalendarZoned(value as never, MustTestLocales.enUS)).toBe(
        "",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Temporal failures — internal errors must not throw, must return ""
  // ---------------------------------------------------------------------------
  describe("Temporal failures", () => {
    it("returns '' when Temporal.Now.zonedDateTimeISO throws (no reference provided)", () => {
      mockTemporalNowZonedDateTimeISOThrow();
      expect(
        formatCalendarZoned(
          "2024-03-16T14:30:00-04:00[America/New_York]",
          MustTestLocales.enUS,
        ),
      ).toBe("");
    });
  });
});
