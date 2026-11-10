import { Temporal } from "../../internal/temporal";
import { countIntlConstructions } from "../../test/countIntlConstructions";
import { MustTestLocales } from "../../test/localeMatrix";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { NON_STRINGS } from "../../test/nonStrings";
import { isValidDate } from "../../plain/validate/isValidDate";
import { formatSsimDate } from "./formatSsimDate";

/**
 * Every expected value is read off the date by hand: the day, the month's letters, and the
 * year modulo 100.
 */
describe("formatSsimDate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const VALID = [
    ["2026-10-25", 2000, "25OCT26"],
    ["2026-01-01", 2000, "01JAN26"],
    ["2000-01-01", 2000, "01JAN00"],
    ["2099-12-31", 2000, "31DEC99"],
    ["2000-02-29", 2000, "29FEB00"],
    ["1950-01-01", 1950, "01JAN50"],
    ["2049-12-31", 1950, "31DEC49"],
    ["2010-04-05", 1950, "05APR10"],
    ["0000-01-01", 0, "01JAN00"],
    ["9999-12-31", 9900, "31DEC99"],
    ["2026-01-09", 2000, "09JAN26"],
    ["2026-02-09", 2000, "09FEB26"],
    ["2026-03-09", 2000, "09MAR26"],
    ["2026-04-09", 2000, "09APR26"],
    ["2026-05-09", 2000, "09MAY26"],
    ["2026-06-09", 2000, "09JUN26"],
    ["2026-07-09", 2000, "09JUL26"],
    ["2026-08-09", 2000, "09AUG26"],
    ["2026-09-09", 2000, "09SEP26"],
    ["2026-10-09", 2000, "09OCT26"],
    ["2026-11-09", 2000, "09NOV26"],
    ["2026-12-09", 2000, "09DEC26"],
    ["2026-01-01[u-ca=iso8601]", 2000, "01JAN26"],
    ["2026-10-25[Europe/Paris]", 2000, "25OCT26"],
  ] as const;

  it.each(VALID)(
    "writes '%s' in window %d as %s",
    (value, yearWindow, expected) => {
      expect(formatSsimDate(value, { yearWindow })).toBe(expected);
    },
  );

  it.each`
    value                          | yearWindow | reason
    ${"1999-12-31"}                | ${2000}    | ${"one year before a window from 2000"}
    ${"2100-01-01"}                | ${2000}    | ${"one year after a window from 2000"}
    ${"1949-12-31"}                | ${1950}    | ${"one year before a window from 1950"}
    ${"2050-01-01"}                | ${1950}    | ${"one year after a window from 1950"}
    ${"2026-10-25T10:00"}          | ${2000}    | ${"a date-time"}
    ${"2026-10-25T10:00:00Z"}      | ${2000}    | ${"an instant"}
    ${"2026-10-25[u-ca=japanese]"} | ${2000}    | ${"a non-ISO calendar"}
    ${"2026-10-25[!foo=bar]"}      | ${2000}    | ${"a critical unknown annotation"}
    ${"2026-02-30"}                | ${2000}    | ${"February has no day 30"}
    ${"2025-02-29"}                | ${2000}    | ${"2025 is not a leap year"}
    ${"2026-13-01"}                | ${2000}    | ${"there is no month 13"}
    ${"25OCT26"}                   | ${2000}    | ${"an SSIM date is not this input"}
    ${""}                          | ${2000}    | ${"empty"}
    ${" 2026-10-25"}               | ${2000}    | ${"leading space"}
    ${"+010000-01-01"}             | ${2000}    | ${"year 10000 is outside every window"}
  `(
    "returns '' for '$value' (window $yearWindow): $reason",
    ({ value, yearWindow }) => {
      expect(formatSsimDate(value, { yearWindow })).toBe("");
    },
  );

  it("agrees with isValidDate on the basic ISO format", () => {
    const expected = isValidDate("20261025") ? "25OCT26" : "";
    expect(formatSsimDate("20261025", { yearWindow: 2000 })).toBe(expected);
  });

  it.each`
    options                       | reason
    ${{}}                         | ${"no yearWindow"}
    ${{ yearWindow: -1 }}         | ${"below 0"}
    ${{ yearWindow: 9901 }}       | ${"above 9900"}
    ${{ yearWindow: 2000.5 }}     | ${"not an integer"}
    ${{ yearWindow: Number.NaN }} | ${"NaN"}
    ${{ yearWindow: "2000" }}     | ${"a numeric string"}
    ${{ yearWindow: null }}       | ${"null"}
    ${{ yearWindow: "Rolling" }}  | ${"a capitalised string is not 'rolling'"}
  `("returns '' for the window $reason", ({ options }) => {
    expect(formatSsimDate("2026-10-25", options)).toBe("");
  });

  describe("arguments", () => {
    it("returns '' for every non-string value", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(
          formatSsimDate(make() as string, { yearWindow: 2000 }),
          kind,
        ).toBe("");
      }
    });

    it("returns '' for a String object", () => {
      expect(
        formatSsimDate(new String("2026-10-25") as string, {
          yearWindow: 2000,
        }),
      ).toBe("");
    });

    it("returns '' for omitted options", () => {
      expect(formatSsimDate("2026-10-25", undefined as never)).toBe("");
    });

    it.each`
      options
      ${null}
      ${"x"}
      ${1}
      ${true}
    `("returns '' for the non-object options $options", ({ options }) => {
      expect(formatSsimDate("2026-10-25", options)).toBe("");
    });

    it("reads a function carrying yearWindow like any options bag", () => {
      const options = Object.assign(() => {}, { yearWindow: 2000 });
      expect(formatSsimDate("2026-10-25", options)).toBe("25OCT26");
    });

    it("returns '' when the yearWindow getter throws", () => {
      const options = {
        get yearWindow(): number {
          throw new Error("hostile getter");
        },
      };
      expect(formatSsimDate("2026-10-25", options)).toBe("");
    });

    it("returns '' when Temporal.PlainDate.from throws", () => {
      mockTemporalPlainDateFromThrow();
      expect(formatSsimDate("2026-10-25", { yearWindow: 2000 })).toBe("");
    });
  });

  describe("rolling window", () => {
    it.each`
      now                       | value           | expected
      ${"2026-06-01T00:00:00Z"} | ${"1976-01-01"} | ${"01JAN76"}
      ${"2026-06-01T00:00:00Z"} | ${"2075-12-31"} | ${"31DEC75"}
      ${"2026-06-01T00:00:00Z"} | ${"1975-12-31"} | ${""}
      ${"2026-06-01T00:00:00Z"} | ${"2076-01-01"} | ${""}
      ${"2077-06-01T00:00:00Z"} | ${"2027-01-01"} | ${"01JAN27"}
      ${"2077-06-01T00:00:00Z"} | ${"2126-12-31"} | ${"31DEC26"}
      ${"2077-06-01T00:00:00Z"} | ${"2026-12-31"} | ${""}
      ${"2026-12-31T23:59:59Z"} | ${"1976-01-01"} | ${"01JAN76"}
      ${"2027-01-01T00:00:00Z"} | ${"1976-01-01"} | ${""}
    `(
      "writes '$value' as '$expected' when now is $now",
      ({ now, value, expected }) => {
        vi.spyOn(Temporal.Now, "instant").mockReturnValue(
          Temporal.Instant.from(now),
        );
        expect(formatSsimDate(value, { yearWindow: "rolling" })).toBe(expected);
      },
    );
  });

  describe("locale independence", () => {
    function stubLocale(locale: string): void {
      vi.spyOn(
        Intl.DateTimeFormat.prototype,
        "resolvedOptions",
      ).mockReturnValue({
        locale,
      } as Intl.ResolvedDateTimeFormatOptions);
      if (typeof navigator !== "undefined") {
        vi.spyOn(navigator, "language", "get").mockReturnValue(locale);
      }
    }

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
      "gives the fixed answers under the ambient locale $locale",
      ({ locale }) => {
        stubLocale(locale);
        const options = { yearWindow: 2000 };
        expect(formatSsimDate("2026-10-25", options)).toBe("25OCT26");
        expect(formatSsimDate("2026-05-01", options)).toBe("01MAY26");
        expect(formatSsimDate("2026-12-31", options)).toBe("31DEC26");
      },
    );

    it("constructs no Intl formatter", () => {
      const run = (): void => {
        for (const [value, yearWindow] of VALID) {
          formatSsimDate(value, { yearWindow });
        }
      };
      expect(
        countIntlConstructions(["DateTimeFormat", "NumberFormat"], run, run),
      ).toBe(0);
    });

    it("calls no locale-sensitive string method", () => {
      const upper = vi.spyOn(String.prototype, "toLocaleUpperCase");
      const lower = vi.spyOn(String.prototype, "toLocaleLowerCase");
      const compare = vi.spyOn(String.prototype, "localeCompare");
      for (const [value, yearWindow] of VALID) {
        formatSsimDate(value, { yearWindow });
      }
      const calls = [
        upper.mock.calls.length,
        lower.mock.calls.length,
        compare.mock.calls.length,
      ];
      vi.restoreAllMocks();
      expect(calls).toStrictEqual([0, 0, 0]);
    });
  });
});
