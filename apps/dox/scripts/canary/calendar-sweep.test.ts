import { describe, expect, it } from "vitest";
import {
  SPAN_FROM,
  SPAN_THROUGH,
  sweepCalendars,
} from "../../../../scripts/lib/calendar-sweep.mjs";

/**
 * CORE-110: the calendar sweep. Unit rows use stand-in Temporal namespaces that model a calendar as
 * a function of the year; the expected values are written out by hand, never read back from the
 * module. The stand-in "iso" and "alt" calendars have years 1 to 3 for ISO -3000 to 5000 in this
 * fake, so a row stays small.
 */

type Facts = { iso: string; months: number; days: number };
type Table = Record<string, Record<number, Facts | "throws">>;

/** ISO year of the span's two ends, mapped to the stand-in calendars' years 1 and 3. */
const YEAR_OF: Record<string, number> = { [SPAN_FROM]: 1, [SPAN_THROUGH]: 3 };

const facts = (iso: string, months = 12, days = 365): Facts => ({
  iso,
  months,
  days,
});

/** A fake `Temporal`: `table[calendar][year]` is what a date's first day reads. */
function fake(table: Table, refusing: string[] = []) {
  return {
    PlainDate: {
      from(item: string | { calendar: string; year: number }) {
        if (typeof item === "string") {
          return {
            year: 0,
            monthsInYear: 0,
            daysInYear: 0,
            toString: () => item,
            withCalendar: () => ({
              year: YEAR_OF[item] ?? 0,
              toString: () => "",
            }),
          };
        }
        if (refusing.includes(item.calendar)) throw new RangeError("no");
        const row = table[item.calendar]?.[item.year];
        if (row === undefined) {
          // The accepts() probe reads year 2000, which every listed calendar answers.
          if (item.year === 2000 && table[item.calendar]) {
            return {
              year: 2000,
              monthsInYear: 12,
              daysInYear: 365,
              toString: () => "",
              withCalendar: () => ({
                year: 2000,
                toString: () => "2000-01-01",
              }),
            };
          }
          throw new RangeError("out of range");
        }
        if (row === "throws") throw new RangeError("bad year");
        return {
          year: item.year,
          monthsInYear: row.months,
          daysInYear: row.days,
          toString: () => "",
          withCalendar: () => ({ year: item.year, toString: () => row.iso }),
        };
      },
    },
  };
}

const same: Table = {
  iso: {
    1: facts("-003000-01-01"),
    2: facts("0001-01-01"),
    3: facts("5000-01-01"),
  },
};

describe("sweepCalendars", () => {
  it("reports a match: the fixed span, the compared calendars and the years read", () => {
    expect(
      sweepCalendars({
        candidate: fake(same),
        reference: fake(same),
        calendars: ["iso"],
      }),
    ).toEqual({
      status: "ran",
      from: "-003000-01-01",
      through: "+005000-12-31",
      calendars: 1,
      years: 3,
      differingCalendars: 0,
      differing: [],
      differingTruncated: false,
    });
  });

  it("names a calendar whose first day differs, with the count, the first year and an example", () => {
    const late: Table = {
      iso: {
        1: facts("-003000-01-01"),
        2: facts("0001-01-02"),
        3: facts("5000-01-02"),
      },
    };
    const result = sweepCalendars({
      candidate: fake(late),
      reference: fake(same),
      calendars: ["iso"],
    });
    expect(result.differingCalendars).toBe(1);
    expect(result.differing).toEqual([
      {
        calendar: "iso",
        years: 2,
        first: 2,
        example:
          "year 2: candidate 0001-01-02, 12 months, 365 days; reference 0001-01-01, 12 months, 365 days",
      },
    ]);
  });

  it.each`
    label               | candidate                       | reference
    ${"months in year"} | ${facts("0001-01-01", 13)}      | ${facts("0001-01-01", 12)}
    ${"days in year"}   | ${facts("0001-01-01", 12, 366)} | ${facts("0001-01-01", 12, 365)}
  `("a difference in the $label alone counts", ({ candidate, reference }) => {
    const result = sweepCalendars({
      candidate: fake({ iso: { ...same.iso, 2: candidate } }),
      reference: fake({ iso: { ...same.iso, 2: reference } }),
      calendars: ["iso"],
    });
    expect(result.differing).toMatchObject([
      { calendar: "iso", years: 1, first: 2 },
    ]);
  });

  it("counts one side throwing as a difference and both throwing as a skip", () => {
    const candidate = fake({
      iso: { ...same.iso, 2: "throws", 3: "throws" },
    });
    const reference = fake({
      iso: { ...same.iso, 2: facts("0001-01-01"), 3: "throws" },
    });
    const result = sweepCalendars({
      candidate,
      reference,
      calendars: ["iso"],
    });
    expect(result.years).toBe(2);
    expect(result.differing).toEqual([
      {
        calendar: "iso",
        years: 1,
        first: 2,
        example:
          "year 2: candidate throws RangeError; reference 0001-01-01, 12 months, 365 days",
      },
    ]);
  });

  it("reports a calendar only one side accepts, and skips one neither accepts", () => {
    const result = sweepCalendars({
      candidate: fake({ ...same, alt: same.iso }, []),
      reference: fake({ ...same, alt: same.iso }, ["alt", "none"]),
      calendars: ["iso", "alt", "none"],
    });
    expect(result.calendars).toBe(1);
    expect(result.differingCalendars).toBe(1);
    expect(result.differing).toEqual([
      {
        calendar: "alt",
        years: 0,
        first: null,
        example: "only the candidate accepts this calendar",
      },
    ]);
  });

  it("says which side is missing the calendar", () => {
    const result = sweepCalendars({
      candidate: fake({ ...same, alt: same.iso }, ["alt"]),
      reference: fake({ ...same, alt: same.iso }),
      calendars: ["alt"],
    });
    expect(result.differing[0]?.example).toBe(
      "only the reference accepts this calendar",
    );
  });

  it("lists at most 50 calendars and still counts them all", () => {
    const names = Array.from({ length: 60 }, (_, i) => `c${i}`);
    const table: Table = {};
    const other: Table = {};
    for (const name of names) {
      table[name] = same.iso;
      other[name] = { ...same.iso, 2: facts("0001-01-09") };
    }
    const result = sweepCalendars({
      candidate: fake(table),
      reference: fake(other),
      calendars: names,
    });
    expect(result.differingCalendars).toBe(60);
    expect(result.differing).toHaveLength(50);
    expect(result.differingTruncated).toBe(true);
  });

  it("throws when it is given no calendar", () => {
    expect(() =>
      sweepCalendars({
        candidate: fake(same),
        reference: fake(same),
        calendars: [],
      }),
    ).toThrow('Intl.supportedValuesOf("calendar") returned no calendars');
  });
});
