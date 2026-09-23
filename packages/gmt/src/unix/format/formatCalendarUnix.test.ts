import { vi } from "vitest";
import { MustTestDstTimeZones, MustTestLocales, battleTestTimeZones, expectDateTimeEqual, utcMs } from "../../test";
import { mockTemporalNowInstantThrow } from "../../test/mocks";
import {
  formatCalendarUnix,
  type FormatCalendarUnixOptions,
} from "./formatCalendarUnix";

const REF_MS = utcMs("2024-03-15T13:00:00Z"); // 2024-03-15T09:00:00-04:00[America/New_York]
const VAL_MS = utcMs("2024-03-16T18:30:00Z"); // 2024-03-16T14:30:00-04:00[America/New_York]

// Expected values per battle-test timeZone, verified against @js-temporal/polyfill.
const calendarLabelByZone = {
  UTC: "tomorrow at 6:30 PM",
  GMT: "tomorrow at 6:30 PM",
  "Etc/GMT": "tomorrow at 6:30 PM",
  "America/Nome": "tomorrow at 10:30 AM",
  "Asia/Anadyr": "tomorrow at 6:30 AM",
  "Europe/Lisbon": "tomorrow at 6:30 PM",
  "Europe/Dublin": "tomorrow at 6:30 PM",
  "Europe/Berlin": "tomorrow at 7:30 PM",
  "Europe/Helsinki": "tomorrow at 8:30 PM",
  "Europe/Istanbul": "tomorrow at 9:30 PM",
  "Asia/Kolkata": "in 2 days at 12:00 AM",
  "Asia/Kathmandu": "in 2 days at 12:15 AM",
  "Asia/Shanghai": "in 2 days at 2:30 AM",
  "Australia/Lord_Howe": "tomorrow at 5:30 AM",
  "Pacific/Chatham": "tomorrow at 8:15 AM",
  "Pacific/Apia": "tomorrow at 7:30 AM",
  "Pacific/Niue": "tomorrow at 7:30 AM",
  "America/New_York": "tomorrow at 2:30 PM",
  "America/Chicago": "tomorrow at 1:30 PM",
  "America/Phoenix": "tomorrow at 11:30 AM",
} satisfies Record<keyof typeof MustTestDstTimeZones, string>;

describe("formatCalendarUnix", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // ±1 and 0 permutations
  // ---------------------------------------------------------------------------
  describe("±1 and 0 permutations", () => {
    it.each`
      valueMs                          | expected
      ${utcMs("2024-03-15T18:30:00Z")} | ${"today at 2:30 PM"}
      ${VAL_MS}                        | ${"tomorrow at 2:30 PM"}
      ${utcMs("2024-03-14T18:30:00Z")} | ${"yesterday at 2:30 PM"}
    `(
      "formats epoch $valueMs relative to REF as $expected",
      ({ valueMs, expected }) => {
        expect(
          formatCalendarUnix(valueMs, MustTestLocales.enUS, {
            timeZone: "America/New_York",
            reference: REF_MS,
          }),
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
        formatCalendarUnix(
          utcMs("2024-03-21T18:30:00Z"),
          MustTestLocales.enUS,
          {
            timeZone: "America/New_York",
            reference: REF_MS,
          },
        ),
      ).toBe("in 6 days at 2:30 PM");
      expect(
        formatCalendarUnix(
          utcMs("2024-03-22T18:30:00Z"),
          MustTestLocales.enUS,
          {
            timeZone: "America/New_York",
            reference: REF_MS,
          },
        ),
      ).toBe("March 22, 2024 at 2:30 PM");
    });
  });

  // ---------------------------------------------------------------------------
  // battleTestTimeZones — same fixed instant, rendered (and calendar-diffed)
  // per zone; zones far enough ahead of UTC roll the wall-clock date forward
  // an extra day, which the day-label correctly reflects.
  // ---------------------------------------------------------------------------
  describe("battleTestTimeZones", () => {
    it.each(
      battleTestTimeZones.map((timeZone) => ({
        timeZone,
        expected: calendarLabelByZone[timeZone],
      })),
    )(
      "formats the fixed instant in $timeZone as $expected",
      ({ timeZone, expected }) => {
        expect(
          formatCalendarUnix(VAL_MS, MustTestLocales.enUS, {
            timeZone,
            reference: REF_MS,
          }),
        ).toBe(expected);
      },
    );

    it("covers every battle-test timezone", () => {
      expect(battleTestTimeZones.length).toBe(20);
    });
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
        formatCalendarUnix(VAL_MS, locale, {
          timeZone: "America/New_York",
          reference: REF_MS,
        }),
        expected,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // epochUnit / reference forms / timeZone default
  // ---------------------------------------------------------------------------
  describe("options", () => {
    it("epochUnit: 'seconds' interprets value and reference as seconds", () => {
      expect(
        formatCalendarUnix(Math.floor(VAL_MS / 1000), MustTestLocales.enUS, {
          timeZone: "America/New_York",
          reference: Math.floor(REF_MS / 1000),
          epochUnit: "seconds",
        }),
      ).toBe("tomorrow at 2:30 PM");
    });

    it("defaults epochUnit to 'milliseconds'", () => {
      expect(
        formatCalendarUnix(VAL_MS, MustTestLocales.enUS, {
          timeZone: "America/New_York",
          reference: REF_MS,
        }),
      ).toBe(
        formatCalendarUnix(VAL_MS, MustTestLocales.enUS, {
          timeZone: "America/New_York",
          reference: REF_MS,
          epochUnit: "milliseconds",
        }),
      );
    });

    it("accepts an integer-looking string epoch for value", () => {
      expect(
        formatCalendarUnix(String(VAL_MS), MustTestLocales.enUS, {
          timeZone: "America/New_York",
          reference: REF_MS,
        }),
      ).toBe("tomorrow at 2:30 PM");
    });

    it("accepts a UTC ISO string reference", () => {
      expect(
        formatCalendarUnix(VAL_MS, MustTestLocales.enUS, {
          timeZone: "America/New_York",
          reference: "2024-03-15T13:00:00Z",
        }),
      ).toBe("tomorrow at 2:30 PM");
    });

    it("defaults timeZone to UTC when omitted", () => {
      expect(
        formatCalendarUnix(VAL_MS, MustTestLocales.enUS, {
          reference: REF_MS,
        }),
      ).toBe("tomorrow at 6:30 PM");
    });

    // ECMA-402 and Temporal throw RangeError for an unknown zone, so a typo is the sentinel, never UTC.
    it.each`
      timeZone
      ${"Not/AZone"}
      ${""}
      ${null}
    `("returns '' for invalid timeZone $timeZone", ({ timeZone }) => {
      expect(
        formatCalendarUnix(VAL_MS, MustTestLocales.enUS, {
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
        formatCalendarUnix(VAL_MS, MustTestLocales.enUS, options as never),
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
      ${"not-a-number"}
      ${"12.5"}
      ${null}
      ${undefined}
      ${true}
      ${Number.NaN}
    `("returns '' for invalid value $value", ({ value }) => {
      expect(formatCalendarUnix(value as never, MustTestLocales.enUS)).toBe("");
    });

    it("returns '' when the string reference is neither numeric nor a valid UTC string", () => {
      expect(
        formatCalendarUnix(VAL_MS, MustTestLocales.enUS, {
          reference: "not-a-date",
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
      expect(formatCalendarUnix(VAL_MS, MustTestLocales.enUS)).toBe("");
    });
  });
});

describe("formatCalendarUnix with an unrecognised epochUnit", () => {
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
      formatCalendarUnix(1_706_659_200, "en-US", {
        epochUnit: epochUnit as never,
        reference: 1_706_659_200,
        timeZone: "UTC",
      }),
    ).toBe("");
  });
});

describe("FormatCalendarUnixOptions has no never-read members", () => {
  // style, numeric, largestUnit and roundingMethod were never read and are removed in 1.16.0;
  // a calendar label has no relative-time unit to choose or round.
  it("rejects style, numeric, largestUnit and roundingMethod at compile time", () => {
    const options: FormatCalendarUnixOptions = {
      reference: 1710685000000,
      timeZone: "UTC",
      // @ts-expect-error -- `style` was removed in 1.16.0
      style: "narrow",
    };
    const numeric: FormatCalendarUnixOptions = {
      // @ts-expect-error -- `numeric` was removed in 1.16.0
      numeric: "always",
    };
    const largestUnit: FormatCalendarUnixOptions = {
      // @ts-expect-error -- `largestUnit` was removed in 1.16.0
      largestUnit: "week",
    };
    const roundingMethod: FormatCalendarUnixOptions = {
      // @ts-expect-error -- `roundingMethod` was removed in 1.16.0
      roundingMethod: "ceil",
    };
    // 1710772200000 is 2024-03-18T14:30Z, one UTC calendar day after the reference.
    expect(formatCalendarUnix(1710772200000, "en-US", options)).toBe(
      "tomorrow at 2:30 PM",
    );
    expect([numeric, largestUnit, roundingMethod]).toHaveLength(3);
  });
});

// ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale data
// is used, and a malformed tag anywhere in the list is invalid input. Expected strings from native
// Intl with the same list (Chromium 153).
describe("formatCalendarUnix with a locale list", () => {
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"demain à 18:30"}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `("returns $expected for locale list $locale", ({ locale, expected }) => {
    expect(
      formatCalendarUnix(VAL_MS, locale as string[], { reference: REF_MS }),
    ).toBe(expected);
  });
});
