import { Temporal } from "../../internal/temporal";
import { MustTestLocales } from "../../test/localeMatrix";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { NON_STRINGS } from "../../test/nonStrings";
import { SSIM_SENTINEL_ROWS, SSIM_VALID_ROWS } from "../../test/ssimDateRows";
import { formatSsimDate } from "../format/formatSsimDate";
import { parseSsimDate } from "../parse/parseSsimDate";
import { isValidSsimDate } from "./isValidSsimDate";

interface Sweep {
  count: number;
  first: string[];
}

/** Collects up to three failure descriptions, so one assertion shows what broke. */
function sweep(): { sweep: Sweep; fail: (what: string) => void } {
  const result: Sweep = { count: 0, first: [] };
  return {
    sweep: result,
    fail(what) {
      result.count += 1;
      if (result.first.length < 3) {
        result.first.push(what);
      }
    },
  };
}

/** Every date from `start` to `end` inclusive, built by adding one day to the previous. */
function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  let day = Temporal.PlainDate.from(start);
  const last = Temporal.PlainDate.from(end);
  while (Temporal.PlainDate.compare(day, last) <= 0) {
    days.push(day.toString());
    day = day.add({ days: 1 });
  }
  return days;
}

/** Asserts `parse(format(d, w), w) === d` for each date, collecting failures. */
function roundTrip(dates: string[], yearWindow: number): Sweep {
  const { sweep: result, fail } = sweep();
  for (const date of dates) {
    const text = formatSsimDate(date, { yearWindow });
    const back = parseSsimDate(text, { yearWindow });
    if (text === "" || back !== date) {
      fail(`${date} -> '${text}' -> '${back}'`);
    }
  }
  return result;
}

/**
 * Every expected value is decided from the grammar: a value is valid when `parseSsimDate` gives
 * a date, and the shared rows state by hand which values those are.
 */
describe("isValidSsimDate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each`
    value        | options                 | expected
    ${"01JAN26"} | ${{ yearWindow: 2000 }} | ${true}
    ${"01jan26"} | ${{ yearWindow: 2000 }} | ${false}
    ${"31APR26"} | ${{ yearWindow: 2000 }} | ${false}
    ${"01JAN26"} | ${{}}                   | ${false}
    ${26}        | ${{ yearWindow: 2000 }} | ${false}
    ${null}      | ${{ yearWindow: 2000 }} | ${false}
    ${"29FEB00"} | ${{ yearWindow: 2000 }} | ${true}
    ${"29FEB00"} | ${{ yearWindow: 1900 }} | ${false}
  `(
    "returns $expected for $value with options $options",
    ({ value, options, expected }) => {
      expect(isValidSsimDate(value, options)).toBe(expected);
    },
  );

  describe("rolling window", () => {
    // The clock is pinned: a rolling window moves with the UTC year, so an unpinned row only
    // holds while the real year is in a fixed range.
    it.each`
      now                       | value        | expected
      ${"2026-06-01T00:00:00Z"} | ${"01JAN26"} | ${true}
      ${"2026-06-01T00:00:00Z"} | ${"29FEB00"} | ${true}
      ${"2051-06-01T00:00:00Z"} | ${"29FEB00"} | ${false}
      ${"2026-12-31T23:59:59Z"} | ${"29FEB00"} | ${true}
      ${"2051-01-01T00:00:00Z"} | ${"29FEB00"} | ${false}
      ${"2026-06-01T00:00:00Z"} | ${"01jan26"} | ${false}
    `(
      "returns $expected for '$value' in a rolling window when now is $now",
      ({ now, value, expected }) => {
        vi.spyOn(Temporal.Now, "instant").mockReturnValue(
          Temporal.Instant.from(now),
        );
        expect(isValidSsimDate(value, { yearWindow: "rolling" })).toBe(
          expected,
        );
      },
    );
  });

  describe("agrees with the parser", () => {
    function disagreements(): Sweep {
      const { sweep: result, fail } = sweep();
      const rows: [string, number, boolean][] = [
        ...SSIM_VALID_ROWS.map(
          ([value, yearWindow]) =>
            [value, yearWindow, true] as [string, number, boolean],
        ),
        ...SSIM_SENTINEL_ROWS.map(
          ([value, yearWindow]) =>
            [value, yearWindow, false] as [string, number, boolean],
        ),
      ];
      for (const [value, yearWindow, expected] of rows) {
        const options = { yearWindow };
        const actual = isValidSsimDate(value, options);
        if (actual !== (parseSsimDate(value, options) !== "")) {
          fail(`${value} (${yearWindow}): differs from parseSsimDate`);
        }
        if (actual !== expected) {
          fail(`${value} (${yearWindow}): expected ${expected}`);
        }
      }
      return result;
    }

    it("matches parseSsimDate and the expected value on every shared row", () => {
      expect(disagreements()).toStrictEqual({ count: 0, first: [] });
    });

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
      "agrees on every shared row under the ambient locale $locale",
      ({ locale }) => {
        stubLocale(locale);
        expect(disagreements()).toStrictEqual({ count: 0, first: [] });
      },
    );
  });

  describe("arguments", () => {
    it("returns false for every non-string value", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(
          isValidSsimDate(make() as string, { yearWindow: 2000 }),
          kind,
        ).toBe(false);
      }
    });

    it("returns false for a String object", () => {
      expect(
        isValidSsimDate(new String("01JAN26") as string, { yearWindow: 2000 }),
      ).toBe(false);
    });

    it("returns false for omitted options", () => {
      expect(isValidSsimDate("01JAN26", undefined as never)).toBe(false);
    });

    it.each`
      options
      ${null}
      ${"x"}
      ${1}
      ${true}
    `("returns false for the non-object options $options", ({ options }) => {
      expect(isValidSsimDate("01JAN26", options)).toBe(false);
    });

    it("returns false when the yearWindow getter throws", () => {
      const options = {
        get yearWindow(): number {
          throw new Error("hostile getter");
        },
      };
      expect(isValidSsimDate("01JAN26", options)).toBe(false);
    });

    it("returns false when Temporal.PlainDate.from throws", () => {
      mockTemporalPlainDateFromThrow();
      expect(isValidSsimDate("01JAN26", { yearWindow: 2000 })).toBe(false);
    });
  });

  /**
   * A sample, not every day of a window: three polyfill calls on 36,525 days would break the
   * 0.3 s budget (AV-97 index.md, Decisions item 2).
   */
  describe("round trip", () => {
    it("returns every day of leap year 2024 unchanged in window 2000", () => {
      expect(
        roundTrip(eachDay("2024-01-01", "2024-12-31"), 2000),
      ).toStrictEqual({ count: 0, first: [] });
    });

    it("returns every day of common year 2025 unchanged in window 2000", () => {
      expect(
        roundTrip(eachDay("2025-01-01", "2025-12-31"), 2000),
      ).toStrictEqual({ count: 0, first: [] });
    });

    it("counts 731 dates in 2024 and 2025", () => {
      expect(
        eachDay("2024-01-01", "2024-12-31").length +
          eachDay("2025-01-01", "2025-12-31").length,
      ).toBe(731);
    });

    function monthEnds(fromYear: number, toYear: number): string[] {
      const dates: string[] = [];
      for (let year = fromYear; year <= toYear; year++) {
        for (let month = 1; month <= 12; month++) {
          const first = Temporal.PlainDate.from({ year, month, day: 1 });
          dates.push(
            first.toString(),
            first.with({ day: first.daysInMonth }).toString(),
          );
        }
      }
      return dates;
    }

    it("returns the month ends of 1950 to 1999 unchanged in window 1950", () => {
      const dates = monthEnds(1950, 1999);
      expect(dates).toHaveLength(1200);
      expect(roundTrip(dates, 1950)).toStrictEqual({ count: 0, first: [] });
    });

    it("returns the month ends of 2000 to 2049 unchanged in window 1950", () => {
      const dates = monthEnds(2000, 2049);
      expect(dates).toHaveLength(1200);
      expect(dates).toContain("2000-02-29");
      expect(roundTrip(dates, 1950)).toStrictEqual({ count: 0, first: [] });
    });

    it.each`
      yearWindow | first           | last
      ${0}       | ${"0000-01-01"} | ${"0099-12-31"}
      ${9900}    | ${"9900-01-01"} | ${"9999-12-31"}
    `(
      "returns the edges $first and $last unchanged in window $yearWindow",
      ({ yearWindow, first, last }) => {
        expect(roundTrip([first, last], yearWindow)).toStrictEqual({
          count: 0,
          first: [],
        });
      },
    );

    it("reads back every DD<MMM>YY that parses as the same text", () => {
      const letters = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
      ];
      const { sweep: result, fail } = sweep();
      let parsed = 0;
      for (const yy of ["00", "24", "25", "99"]) {
        for (let day = 1; day <= 31; day++) {
          for (const letter of letters) {
            const text = `${String(day).padStart(2, "0")}${letter}${yy}`;
            const options = { yearWindow: 2000 };
            const iso = parseSsimDate(text, options);
            if (iso === "") {
              continue;
            }
            parsed += 1;
            const back = formatSsimDate(iso, options);
            if (back !== text) {
              fail(`${text} -> ${iso} -> ${back}`);
            }
          }
        }
      }
      // Per year: 7 x 31 + 4 x 30 = 337 days outside February, plus 29 (2000, 2024) or 28
      // (2025, 2099) February days: 366 + 366 + 365 + 365.
      expect(parsed).toBe(1462);
      expect(result).toStrictEqual({ count: 0, first: [] });
    });

    it.each`
      value           | reason
      ${"1999-12-31"} | ${"the day before the window"}
      ${"2100-01-01"} | ${"the first day after the window"}
    `("writes nothing for $value in window 2000: $reason", ({ value }) => {
      expect(formatSsimDate(value, { yearWindow: 2000 })).toBe("");
    });
  });
});
