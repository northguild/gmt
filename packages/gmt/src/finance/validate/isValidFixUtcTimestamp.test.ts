import { LEAP_SECOND_STEPS } from "../../internal";
import { Temporal } from "../../internal/temporal";
import {
  ACCEPTED_FIX_UTC_TIMESTAMPS,
  REFUSED_FIX_LEAP_SECONDS,
  REFUSED_FIX_UTC_TIMESTAMPS,
} from "../../test/fixUtcTimestampCases";
import { arrives, NON_STRINGS } from "../../test/nonStrings";
import { isLeapSecond } from "../../timescale/validate/isLeapSecond";
import { parseFixUtcTimestamp } from "../parse/parseFixUtcTimestamp";
import { isValidFixUtcTimestamp } from "./isValidFixUtcTimestamp";

/** The 27 days whose last second was inserted: the second before each positive step (IERS). */
const INSERTION_DAYS = LEAP_SECOND_STEPS.at.slice(1).map((at) =>
  Temporal.Instant.fromEpochNanoseconds(at - 1_000_000_000n)
    .toString()
    .slice(0, 10),
);

describe("isValidFixUtcTimestamp", () => {
  it.each`
    value                         | valid    | why
    ${"20240615-14:30:00.123"}    | ${true}  | ${"milliseconds"}
    ${"20161231-23:59:60"}        | ${true}  | ${"the last inserted leap second"}
    ${"20171231-23:59:60"}        | ${false} | ${"no insertion on 2017-12-31"}
    ${"20240615-14:30:00.12"}     | ${false} | ${"two digits state no precision"}
    ${"2024-06-15T14:30:00Z"}     | ${false} | ${"ISO 8601, not FIX"}
    ${"20240615-14:30:00"}        | ${true}  | ${"whole seconds, no period"}
    ${"20240615-14:30:00.123456"} | ${true}  | ${"microseconds"}
    ${"20240615-14:30:00."}       | ${false} | ${"a period needs digits"}
    ${"20240230-00:00:00"}        | ${false} | ${"30 February"}
    ${"20240615-24:00:00"}        | ${false} | ${"hour 24"}
    ${""}                         | ${false} | ${"empty"}
  `("returns $valid for '$value' ($why)", ({ value, valid }) => {
    expect(isValidFixUtcTimestamp(value)).toBe(valid);
  });

  describe("agrees with parseFixUtcTimestamp", () => {
    it.each(ACCEPTED_FIX_UTC_TIMESTAMPS.map((value) => ({ value })))(
      "accepts '$value', as the parser does",
      ({ value }) => {
        expect(parseFixUtcTimestamp(value)).not.toBeNull();
        expect(isValidFixUtcTimestamp(value)).toBe(true);
      },
    );

    it.each([...REFUSED_FIX_UTC_TIMESTAMPS, ...REFUSED_FIX_LEAP_SECONDS])(
      "refuses '$value' ($why), as the parser does",
      ({ value }) => {
        expect(parseFixUtcTimestamp(value)).toBeNull();
        expect(isValidFixUtcTimestamp(value)).toBe(false);
      },
    );
  });

  describe("the 27 inserted leap seconds", () => {
    it("has 27 insertion days", () => {
      expect(INSERTION_DAYS).toHaveLength(27);
    });

    it.each(INSERTION_DAYS.map((day) => ({ day })))(
      "accepts 23:59:60 on $day, as isLeapSecond does",
      ({ day }) => {
        expect(isLeapSecond(`${day}T23:59:60Z`)).toBe(true);
        expect(
          isValidFixUtcTimestamp(`${day.replaceAll("-", "")}-23:59:60`),
        ).toBe(true);
      },
    );

    it.each(
      INSERTION_DAYS.map((day) => ({
        day: Temporal.PlainDate.from(day).add({ days: 1 }).toString(),
      })),
    )(
      "refuses 23:59:60 on $day, the day after an insertion, as isLeapSecond does",
      ({ day }) => {
        const isInsertion = isLeapSecond(`${day}T23:59:60Z`);
        expect(
          isValidFixUtcTimestamp(`${day.replaceAll("-", "")}-23:59:60`),
        ).toBe(isInsertion);
        // Consecutive insertion days (none exist) would break this; the table has gaps.
        expect(isInsertion).toBe(false);
      },
    );

    it.each`
      year
      ${2017}
      ${2018}
      ${2019}
      ${2020}
      ${2021}
      ${2022}
      ${2023}
      ${2024}
      ${2025}
      ${2026}
    `(
      "refuses 23:59:60 on 31 December $year, as isLeapSecond does",
      ({ year }: { year: number }) => {
        expect(isLeapSecond(`${year}-12-31T23:59:60Z`)).toBe(false);
        expect(isValidFixUtcTimestamp(`${year}1231-23:59:60`)).toBe(false);
      },
    );
  });

  describe("a value that is not a string", () => {
    it("returns false for each, and none throws", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(isValidFixUtcTimestamp(make()), kind).toBe(false);
      }
    });

    it("accepts them without a cast", () => {
      expect(isValidFixUtcTimestamp(undefined)).toBe(false);
      expect(isValidFixUtcTimestamp(null)).toBe(false);
      expect(isValidFixUtcTimestamp(20240615)).toBe(false);
      expect(isValidFixUtcTimestamp(Number.NaN)).toBe(false);
      expect(isValidFixUtcTimestamp({})).toBe(false);
      expect(isValidFixUtcTimestamp([])).toBe(false);
      expect(isValidFixUtcTimestamp(new String("20240615-14:30:00"))).toBe(
        false,
      );
      expect(isValidFixUtcTimestamp(Symbol("x"))).toBe(false);
    });
  });
});

describe("isValidFixUtcTimestamp types", () => {
  it("narrows a value typed unknown to string when it is valid", () => {
    const input = arrives("20240615-14:30:00.123");
    if (isValidFixUtcTimestamp(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    } else {
      expectTypeOf(input).toEqualTypeOf<unknown>();
    }
    expect(isValidFixUtcTimestamp(input)).toBe(true);
  });

  it("keeps a string a string when it is not valid", () => {
    const input: string = "invalid";
    if (!isValidFixUtcTimestamp(input)) {
      expectTypeOf(input).toEqualTypeOf<string>();
    }
    expect(isValidFixUtcTimestamp(input)).toBe(false);
  });

  it("leaves string | null as it is on both branches", () => {
    const check = (input: string | null): boolean => {
      if (isValidFixUtcTimestamp(input)) {
        expectTypeOf(input).toEqualTypeOf<string | null>();
        return true;
      }
      expectTypeOf(input).toEqualTypeOf<string | null>();
      return false;
    };
    expect(check("20240615-14:30:00.123")).toBe(true);
    expect(check(null)).toBe(false);
  });
});
