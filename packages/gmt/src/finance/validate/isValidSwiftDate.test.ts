import { Temporal } from "../../internal/temporal";
import { NON_STRINGS } from "../../test/nonStrings";
import {
  SWIFT_SENTINEL_ROWS,
  SWIFT_VALID_ROWS,
} from "../../test/swiftDateRows";
import { formatSwiftDate } from "../format/formatSwiftDate";
import { parseSwiftDate } from "../parse/parseSwiftDate";
import { isValidSwiftDate } from "./isValidSwiftDate";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Every `YYMMDD` string for yy tens*10 to tens*10+9, MM 00-13 and DD 00-32. */
function sweepStrings(tens: number): string[] {
  const all: string[] = [];
  for (let yy = tens * 10; yy < tens * 10 + 10; yy++) {
    for (let mm = 0; mm <= 13; mm++) {
      for (let dd = 0; dd <= 32; dd++) {
        all.push(`${pad2(yy)}${pad2(mm)}${pad2(dd)}`);
      }
    }
  }
  return all;
}

// Days from 2001-01-01 to 2060-12-31 by the tens digit of YY, counted with a plain Temporal
// until(); they sum to 21,915. One test per group keeps each under the 0.3 s test cost.
const DAYS_BY_YY_TENS = [
  { tens: 0, days: 3287 },
  { tens: 1, days: 3652 },
  { tens: 2, days: 3653 },
  { tens: 3, days: 3652 },
  { tens: 4, days: 3653 },
  { tens: 5, days: 3652 },
  { tens: 6, days: 366 },
  { tens: 7, days: 0 },
  { tens: 8, days: 0 },
  { tens: 9, days: 0 },
] as const;

// The same days by decade of calendar year, for the date round trip.
const DAYS_BY_DECADE = [
  { first: 2001, last: 2009, days: 3287 },
  { first: 2010, last: 2019, days: 3652 },
  { first: 2020, last: 2029, days: 3653 },
  { first: 2030, last: 2039, days: 3652 },
  { first: 2040, last: 2049, days: 3653 },
  { first: 2050, last: 2059, days: 3652 },
  { first: 2060, last: 2060, days: 366 },
] as const;

/**
 * Every expected value is read off SWIFT _Standards MT General Information_ (Nov 2025) §6.3.1
 * (`YYMMDD`, 2001 to 2060) and §6.3.6 (`YY` 01 through 60, else T50), never off the code under
 * test.
 */
describe("isValidSwiftDate", () => {
  it.each`
    value       | expected
    ${"240615"} | ${true}
    ${"040229"} | ${true}
    ${"990615"} | ${false}
    ${"000229"} | ${false}
    ${"750101"} | ${false}
    ${"241315"} | ${false}
    ${"050229"} | ${false}
  `("returns $expected for '$value'", ({ value, expected }) => {
    expect(isValidSwiftDate(value)).toBe(expected);
  });

  it("agrees with parseSwiftDate and the expected value on every shared row", () => {
    const failures: string[] = [];
    for (const { value, expected } of SWIFT_VALID_ROWS) {
      if (!isValidSwiftDate(value) || parseSwiftDate(value) !== expected) {
        failures.push(`${value}: expected valid, ${expected}`);
      }
    }
    for (const { value } of SWIFT_SENTINEL_ROWS) {
      if (isValidSwiftDate(value) || parseSwiftDate(value) !== "") {
        failures.push(`${value}: expected invalid, ''`);
      }
    }
    expect(failures).toStrictEqual([]);
  });

  it.each(DAYS_BY_YY_TENS)(
    "agrees with parseSwiftDate and accepts $days of the strings for YY with tens digit $tens",
    ({ tens, days }) => {
      let valid = 0;
      const failures: string[] = [];
      for (const s of sweepStrings(tens)) {
        const actual = isValidSwiftDate(s);
        if (actual) {
          valid += 1;
        }
        if (actual !== (parseSwiftDate(s) !== "") && failures.length < 3) {
          failures.push(s);
        }
      }
      expect({ failures, valid }).toStrictEqual({ failures: [], valid: days });
    },
  );

  describe("arguments", () => {
    it("returns false for every non-string value", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(isValidSwiftDate(make() as string), kind).toBe(false);
      }
    });
  });

  describe("round trip", () => {
    it.each(DAYS_BY_DECADE)(
      "returns every date from $first to $last unchanged, $days of them",
      ({ first, last, days }) => {
        // Stepped from the anchor, never by repeated addition (coding-standards § 5).
        const start = Temporal.PlainDate.from({
          year: first,
          month: 1,
          day: 1,
        });
        const lastDate = `${last}-12-31`;
        const failures: string[] = [];
        let visited = 0;
        for (let i = 0; ; i++) {
          const date = start.add({ days: i }).toString();
          const text = formatSwiftDate(date);
          // The validator calls the parser, so its agreement is the sweep's job above.
          if (!/^[0-9]{6}$/.test(text) || parseSwiftDate(text) !== date) {
            if (failures.length < 3) {
              failures.push(`${date} -> '${text}'`);
            }
          }
          visited += 1;
          if (date === lastDate) {
            break;
          }
        }
        expect({ failures, visited }).toStrictEqual({
          failures: [],
          visited: days,
        });
      },
    );

    it.each(DAYS_BY_YY_TENS)(
      "writes back the same text for the $days valid strings for YY with tens digit $tens",
      ({ tens, days }) => {
        const failures: string[] = [];
        let checked = 0;
        for (const s of sweepStrings(tens)) {
          const date = parseSwiftDate(s);
          if (date === "") {
            continue;
          }
          checked += 1;
          if (formatSwiftDate(date) !== s && failures.length < 3) {
            failures.push(s);
          }
        }
        expect({ failures, checked }).toStrictEqual({
          failures: [],
          checked: days,
        });
      },
    );

    it.each`
      call                            | actual
      ${"formatSwiftDate 2000-12-31"} | ${() => formatSwiftDate("2000-12-31")}
      ${"formatSwiftDate 2061-01-01"} | ${() => formatSwiftDate("2061-01-01")}
      ${"parseSwiftDate 001231"}      | ${() => parseSwiftDate("001231")}
      ${"parseSwiftDate 610101"}      | ${() => parseSwiftDate("610101")}
    `("returns '' for $call, one step outside the range", ({ actual }) => {
      expect(actual()).toBe("");
    });
  });
});
