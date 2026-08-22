import { vi } from "vitest";
import {
  MustTestLocales,
  battleTestTimeZones,
  expectDateTimeEqual,
} from "../../test";
import { mockTemporalNowInstantThrow } from "../../test/mocks";
import { formatCalendarUtc } from "./formatCalendarUtc";

const REF = "2024-03-15T13:00:00Z"; // 09:00 in America/New_York
const VAL = "2024-03-16T18:30:00Z"; // 14:30 in America/New_York

describe("formatCalendarUtc", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // ±1 and 0 permutations
  // ---------------------------------------------------------------------------
  describe("±1 and 0 permutations", () => {
    it.each`
      value                     | expected
      ${"2024-03-15T18:30:00Z"} | ${"today at 2:30 PM"}
      ${VAL}                    | ${"tomorrow at 2:30 PM"}
      ${"2024-03-14T18:30:00Z"} | ${"yesterday at 2:30 PM"}
    `("formats $value relative to REF as $expected", ({ value, expected }) => {
      expect(
        formatCalendarUtc(value, MustTestLocales.enUS, {
          timeZone: "America/New_York",
          reference: REF,
        }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // Beyond the ±6-day threshold — absolute fallback
  // ---------------------------------------------------------------------------
  describe("beyond threshold — absolute fallback", () => {
    it("6 days out stays relative, 7 days out flips to absolute", () => {
      expect(
        formatCalendarUtc("2024-03-21T18:30:00Z", MustTestLocales.enUS, {
          timeZone: "America/New_York",
          reference: REF,
        }),
      ).toBe("in 6 days at 2:30 PM");
      expect(
        formatCalendarUtc("2024-03-22T18:30:00Z", MustTestLocales.enUS, {
          timeZone: "America/New_York",
          reference: REF,
        }),
      ).toBe("March 22, 2024 at 2:30 PM");
    });
  });

  // ---------------------------------------------------------------------------
  // battleTestTimeZones — same fixed instant, rendered per zone; zones far
  // enough ahead of UTC roll the wall-clock date forward an extra day.
  // ---------------------------------------------------------------------------
  describe("battleTestTimeZones", () => {
    it.each`
      timeZone                 | expected
      ${"UTC"}                 | ${"tomorrow at 6:30 PM"}
      ${"GMT"}                 | ${"tomorrow at 6:30 PM"}
      ${"Etc/GMT"}             | ${"tomorrow at 6:30 PM"}
      ${"America/Nome"}        | ${"tomorrow at 10:30 AM"}
      ${"Asia/Anadyr"}         | ${"tomorrow at 6:30 AM"}
      ${"Europe/Lisbon"}       | ${"tomorrow at 6:30 PM"}
      ${"Europe/Dublin"}       | ${"tomorrow at 6:30 PM"}
      ${"Europe/Berlin"}       | ${"tomorrow at 7:30 PM"}
      ${"Europe/Helsinki"}     | ${"tomorrow at 8:30 PM"}
      ${"Europe/Istanbul"}     | ${"tomorrow at 9:30 PM"}
      ${"Asia/Kolkata"}        | ${"in 2 days at 12:00 AM"}
      ${"Asia/Kathmandu"}      | ${"in 2 days at 12:15 AM"}
      ${"Asia/Shanghai"}       | ${"in 2 days at 2:30 AM"}
      ${"Australia/Lord_Howe"} | ${"tomorrow at 5:30 AM"}
      ${"Pacific/Chatham"}     | ${"tomorrow at 8:15 AM"}
      ${"Pacific/Apia"}        | ${"tomorrow at 7:30 AM"}
      ${"Pacific/Niue"}        | ${"tomorrow at 7:30 AM"}
      ${"America/New_York"}    | ${"tomorrow at 2:30 PM"}
      ${"America/Chicago"}     | ${"tomorrow at 1:30 PM"}
      ${"America/Phoenix"}     | ${"tomorrow at 11:30 AM"}
    `(
      "formats the fixed instant in $timeZone as $expected",
      ({ timeZone, expected }) => {
        expect(
          formatCalendarUtc(VAL, MustTestLocales.enUS, {
            timeZone,
            reference: REF,
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
        formatCalendarUtc(VAL, locale, {
          timeZone: "America/New_York",
          reference: REF,
        }),
        expected,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // timeZone default and reference handling
  // ---------------------------------------------------------------------------
  describe("options", () => {
    it("defaults timeZone to UTC when omitted", () => {
      expect(
        formatCalendarUtc(VAL, MustTestLocales.enUS, { reference: REF }),
      ).toBe("tomorrow at 6:30 PM");
    });

    it("defaults timeZone to UTC for an invalid timeZone string", () => {
      expect(
        formatCalendarUtc(VAL, MustTestLocales.enUS, {
          reference: REF,
          timeZone: "Not/AZone",
        }),
      ).toBe("tomorrow at 6:30 PM");
    });

    it("defaults reference to 'now' when omitted", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(REF));
      try {
        expect(
          formatCalendarUtc(VAL, MustTestLocales.enUS, {
            timeZone: "America/New_York",
          }),
        ).toBe("tomorrow at 2:30 PM");
      } finally {
        vi.useRealTimers();
      }
    });

    it("returns '' when reference is provided but invalid", () => {
      expect(
        formatCalendarUtc(VAL, MustTestLocales.enUS, {
          reference: "not-a-date",
        }),
      ).toBe("");
    });

    it("returns '' when reference is an empty string", () => {
      expect(
        formatCalendarUtc(VAL, MustTestLocales.enUS, { reference: "" }),
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
      expect(formatCalendarUtc(value as never, MustTestLocales.enUS)).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Temporal failures — internal errors must not throw, must return ""
  // ---------------------------------------------------------------------------
  describe("Temporal failures", () => {
    it("returns '' when Temporal.Now.instant throws (no reference provided)", () => {
      mockTemporalNowInstantThrow();
      expect(formatCalendarUtc(VAL, MustTestLocales.enUS)).toBe("");
    });
  });
});
