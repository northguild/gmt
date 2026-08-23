import { Temporal } from "@js-temporal/polyfill";
import { vi } from "vitest";
import { MustTestLocales, expectDateTimeEqual } from "../../test";
import { mockTemporalNowPlainDateTimeISOThrow } from "../../test/mocks";
import { formatCalendar } from "./formatCalendar";

const REF = "2024-03-15T09:00:00";

describe("formatCalendar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // ±1 and 0 permutations (today/tomorrow/yesterday)
  // ---------------------------------------------------------------------------
  describe("±1 and 0 permutations", () => {
    it.each`
      value                    | expected
      ${"2024-03-15T14:30:00"} | ${"today at 2:30 PM"}
      ${"2024-03-16T14:30:00"} | ${"tomorrow at 2:30 PM"}
      ${"2024-03-14T14:30:00"} | ${"yesterday at 2:30 PM"}
    `("formats $value relative to REF as $expected", ({ value, expected }) => {
      expect(
        formatCalendar(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // within-the-last-week / within-the-next-week (±2..6 days)
  // ---------------------------------------------------------------------------
  describe("within-the-last-week / within-the-next-week", () => {
    it.each`
      value                    | expected
      ${"2024-03-18T14:30:00"} | ${"in 3 days at 2:30 PM"}
      ${"2024-03-12T14:30:00"} | ${"3 days ago at 2:30 PM"}
      ${"2024-03-21T14:30:00"} | ${"in 6 days at 2:30 PM"}
      ${"2024-03-09T14:30:00"} | ${"6 days ago at 2:30 PM"}
    `("formats $value relative to REF as $expected", ({ value, expected }) => {
      expect(
        formatCalendar(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // Beyond the ±6-day threshold — absolute fallback, no relative wording
  // ---------------------------------------------------------------------------
  describe("beyond threshold — absolute fallback", () => {
    it.each`
      value                    | expected
      ${"2024-03-22T14:30:00"} | ${"March 22, 2024 at 2:30 PM"}
      ${"2024-03-08T14:30:00"} | ${"March 8, 2024 at 2:30 PM"}
      ${"2023-03-15T14:30:00"} | ${"March 15, 2023 at 2:30 PM"}
      ${"2025-03-15T14:30:00"} | ${"March 15, 2025 at 2:30 PM"}
    `("formats $value relative to REF as $expected", ({ value, expected }) => {
      expect(
        formatCalendar(value, MustTestLocales.enUS, { reference: REF }),
      ).toBe(expected);
    });

    it("the boundary sits at exactly 7 days: 6 days stays relative, 7 flips to absolute", () => {
      expect(
        formatCalendar("2024-03-21T14:30:00", MustTestLocales.enUS, {
          reference: REF,
        }),
      ).toBe("in 6 days at 2:30 PM");
      expect(
        formatCalendar("2024-03-22T14:30:00", MustTestLocales.enUS, {
          reference: REF,
        }),
      ).toBe("March 22, 2024 at 2:30 PM");
    });
  });

  // ---------------------------------------------------------------------------
  // Per-locale coverage — full 17-locale matrix, "tomorrow" case
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
        formatCalendar("2024-03-16T14:30:00", locale, { reference: REF }),
        expected,
      );
    });

    it.each`
      locale                  | expected
      ${MustTestLocales.enUS} | ${"March 22, 2024 at 2:30 PM"}
      ${MustTestLocales.deDE} | ${"22. März 2024 um 14:30"}
      ${MustTestLocales.frFR} | ${"22 mars 2024 à 14:30"}
      ${MustTestLocales.arSA} | ${"٢٢ مارس ٢٠٢٤ في ٢:٣٠ م"}
      ${MustTestLocales.ruRU} | ${"22 марта 2024 г. в 14:30"}
      ${MustTestLocales.trTR} | ${"22 Mart 2024 14:30"}
    `(
      "beyond-threshold absolute fallback for $locale as $expected",
      ({ locale, expected }) => {
        expect(
          formatCalendar("2024-03-22T14:30:00", locale, { reference: REF }),
        ).toBe(expected);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // Connector is never a hardcoded English word — proven per Definition of
  // Done, not just asserted by construction. ru-RU is included specifically
  // because its combined Intl pattern fuses a date-side suffix (" г.") into
  // the same literal as the real connector (" в ") — see
  // internal/joinDateTimeConnector.ts.
  // ---------------------------------------------------------------------------
  describe("connector is locale-native, not hardcoded English", () => {
    it.each`
      locale                  | mustContain
      ${MustTestLocales.deDE} | ${"um"}
      ${MustTestLocales.frFR} | ${"à"}
      ${MustTestLocales.itIT} | ${"alle ore"}
      ${MustTestLocales.ptPT} | ${"às"}
      ${MustTestLocales.svSE} | ${"kl."}
      ${MustTestLocales.arSA} | ${"في"}
      ${MustTestLocales.heIL} | ${"בשעה"}
      ${MustTestLocales.ruRU} | ${"в"}
    `(
      "$locale's connector contains '$mustContain', not English 'at'",
      ({ locale, mustContain }) => {
        const out = formatCalendar("2024-03-16T14:30:00", locale, {
          reference: REF,
        });
        expect(out).toContain(mustContain);
        expect(out).not.toMatch(/\bat\b/);
      },
    );

    it("ru-RU strips the date-side ' г.' suffix out of the connector rather than leaking it", () => {
      expect(
        formatCalendar("2024-03-16T14:30:00", MustTestLocales.ruRU, {
          reference: REF,
        }),
      ).not.toContain("г.");
    });
  });

  // ---------------------------------------------------------------------------
  // timeStyle option
  // ---------------------------------------------------------------------------
  describe("timeStyle option", () => {
    it.each`
      timeStyle    | expected
      ${undefined} | ${"tomorrow at 2:30 PM"}
      ${"short"}   | ${"tomorrow at 2:30 PM"}
      ${"medium"}  | ${"tomorrow at 2:30:00 PM"}
    `(
      "timeStyle:$timeStyle formats tomorrow as $expected",
      ({ timeStyle, expected }) => {
        expect(
          formatCalendar("2024-03-16T14:30:00", MustTestLocales.enUS, {
            reference: REF,
            timeStyle,
          }),
        ).toBe(expected);
      },
    );

    it("defaults to 'short' when timeStyle is omitted (matches explicit 'short')", () => {
      const omitted = formatCalendar(
        "2024-03-16T14:30:00",
        MustTestLocales.enUS,
        { reference: REF },
      );
      const explicit = formatCalendar(
        "2024-03-16T14:30:00",
        MustTestLocales.enUS,
        { reference: REF, timeStyle: "short" },
      );
      expect(omitted).toBe(explicit);
    });
  });

  // ---------------------------------------------------------------------------
  // reference option
  // ---------------------------------------------------------------------------
  describe("reference option", () => {
    it("defaults to 'now' when reference is omitted", () => {
      vi.spyOn(Temporal.Now, "plainDateTimeISO").mockReturnValue(
        Temporal.PlainDateTime.from(REF),
      );
      expect(formatCalendar("2024-03-16T14:30:00", MustTestLocales.enUS)).toBe(
        "tomorrow at 2:30 PM",
      );
    });

    it("returns '' when reference is provided but invalid", () => {
      expect(
        formatCalendar("2024-03-16T14:30:00", MustTestLocales.enUS, {
          reference: "not-a-date",
        }),
      ).toBe("");
    });

    it("returns '' when reference is an empty string", () => {
      expect(
        formatCalendar("2024-03-16T14:30:00", MustTestLocales.enUS, {
          reference: "",
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
      ${"2024-13-01T14:30:00"}
      ${"2024-02-30T14:30:00"}
      ${"2024-03-15"}
      ${null}
      ${undefined}
      ${42}
      ${true}
    `("returns '' for invalid value $value", ({ value }) => {
      expect(formatCalendar(value as never, MustTestLocales.enUS)).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Temporal failures — internal errors must not throw, must return ""
  // ---------------------------------------------------------------------------
  describe("Temporal failures", () => {
    it("returns '' when Temporal.Now.plainDateTimeISO throws (no reference provided)", () => {
      mockTemporalNowPlainDateTimeISOThrow();
      expect(formatCalendar("2024-03-16T14:30:00", MustTestLocales.enUS)).toBe(
        "",
      );
    });
  });
});
