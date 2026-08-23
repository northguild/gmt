import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { convertDateToCalendar } from "./convertDateToCalendar";

describe("convertDateToCalendar", () => {
  it.each`
    value                        | calendar       | expected
    ${"2024-02-29"}              | ${"hebrew"}    | ${"5784-06-20[u-ca=hebrew]"}
    ${"2023-02-28"}              | ${"hebrew"}    | ${"5783-06-07[u-ca=hebrew]"}
    ${"2024-01-01"}              | ${"hebrew"}    | ${"5784-04-20[u-ca=hebrew]"}
    ${"2024-12-31"}              | ${"hebrew"}    | ${"5785-03-30[u-ca=hebrew]"}
    ${"2024-03-01"}              | ${"hebrew"}    | ${"5784-06-21[u-ca=hebrew]"}
    ${"2024-03-31"}              | ${"hebrew"}    | ${"5784-07-21[u-ca=hebrew]"}
    ${"2024-01-01"}              | ${"gregorian"} | ${"2024-01-01"}
    ${"5785-01-01[u-ca=hebrew]"} | ${"gregorian"} | ${"2024-10-03"}
    ${"5784-06-01[u-ca=hebrew]"} | ${"gregorian"} | ${"2024-02-10"}
    ${"5784-06-01[u-ca=hebrew]"} | ${"hebrew"}    | ${"5784-06-01[u-ca=hebrew]"}
  `(
    "converts $value to $calendar as $expected",
    ({
      value,
      calendar,
      expected,
    }: {
      value: string;
      calendar: "gregorian" | "hebrew";
      expected: string;
    }) => {
      expect(convertDateToCalendar(value, calendar)).toBe(expected);
    },
  );

  // All 12 month boundaries of non-leap year 5783 (2022-09-26..2023-09-15).
  it.each`
    lastIsoOfMonth  | expectedLast                 | firstIsoOfNextMonth | expectedNext
    ${"2022-10-25"} | ${"5783-01-30[u-ca=hebrew]"} | ${"2022-10-26"}     | ${"5783-02-01[u-ca=hebrew]"}
    ${"2022-11-24"} | ${"5783-02-30[u-ca=hebrew]"} | ${"2022-11-25"}     | ${"5783-03-01[u-ca=hebrew]"}
    ${"2022-12-24"} | ${"5783-03-30[u-ca=hebrew]"} | ${"2022-12-25"}     | ${"5783-04-01[u-ca=hebrew]"}
    ${"2023-01-22"} | ${"5783-04-29[u-ca=hebrew]"} | ${"2023-01-23"}     | ${"5783-05-01[u-ca=hebrew]"}
    ${"2023-02-21"} | ${"5783-05-30[u-ca=hebrew]"} | ${"2023-02-22"}     | ${"5783-06-01[u-ca=hebrew]"}
    ${"2023-03-22"} | ${"5783-06-29[u-ca=hebrew]"} | ${"2023-03-23"}     | ${"5783-07-01[u-ca=hebrew]"}
    ${"2023-04-21"} | ${"5783-07-30[u-ca=hebrew]"} | ${"2023-04-22"}     | ${"5783-08-01[u-ca=hebrew]"}
    ${"2023-05-20"} | ${"5783-08-29[u-ca=hebrew]"} | ${"2023-05-21"}     | ${"5783-09-01[u-ca=hebrew]"}
    ${"2023-06-19"} | ${"5783-09-30[u-ca=hebrew]"} | ${"2023-06-20"}     | ${"5783-10-01[u-ca=hebrew]"}
    ${"2023-07-18"} | ${"5783-10-29[u-ca=hebrew]"} | ${"2023-07-19"}     | ${"5783-11-01[u-ca=hebrew]"}
    ${"2023-08-17"} | ${"5783-11-30[u-ca=hebrew]"} | ${"2023-08-18"}     | ${"5783-12-01[u-ca=hebrew]"}
    ${"2023-09-15"} | ${"5783-12-29[u-ca=hebrew]"} | ${"2023-09-16"}     | ${"5784-01-01[u-ca=hebrew]"}
  `(
    "non-leap year 5783: $lastIsoOfMonth -> $expectedLast, $firstIsoOfNextMonth -> $expectedNext",
    ({
      lastIsoOfMonth,
      expectedLast,
      firstIsoOfNextMonth,
      expectedNext,
    }: {
      lastIsoOfMonth: string;
      expectedLast: string;
      firstIsoOfNextMonth: string;
      expectedNext: string;
    }) => {
      expect(convertDateToCalendar(lastIsoOfMonth, "hebrew")).toBe(
        expectedLast,
      );
      expect(convertDateToCalendar(firstIsoOfNextMonth, "hebrew")).toBe(
        expectedNext,
      );
    },
  );

  // All 13 month boundaries of leap year 5784 (2023-09-16..2024-10-02), including the
  // Adar I -> Adar II leap-month boundary (month 6 -> 7, at 2024-03-10 -> 2024-03-11).
  it.each`
    lastIsoOfMonth  | expectedLast                 | firstIsoOfNextMonth | expectedNext
    ${"2023-10-15"} | ${"5784-01-30[u-ca=hebrew]"} | ${"2023-10-16"}     | ${"5784-02-01[u-ca=hebrew]"}
    ${"2023-11-13"} | ${"5784-02-29[u-ca=hebrew]"} | ${"2023-11-14"}     | ${"5784-03-01[u-ca=hebrew]"}
    ${"2023-12-12"} | ${"5784-03-29[u-ca=hebrew]"} | ${"2023-12-13"}     | ${"5784-04-01[u-ca=hebrew]"}
    ${"2024-01-10"} | ${"5784-04-29[u-ca=hebrew]"} | ${"2024-01-11"}     | ${"5784-05-01[u-ca=hebrew]"}
    ${"2024-02-09"} | ${"5784-05-30[u-ca=hebrew]"} | ${"2024-02-10"}     | ${"5784-06-01[u-ca=hebrew]"}
    ${"2024-03-10"} | ${"5784-06-30[u-ca=hebrew]"} | ${"2024-03-11"}     | ${"5784-07-01[u-ca=hebrew]"}
    ${"2024-04-08"} | ${"5784-07-29[u-ca=hebrew]"} | ${"2024-04-09"}     | ${"5784-08-01[u-ca=hebrew]"}
    ${"2024-05-08"} | ${"5784-08-30[u-ca=hebrew]"} | ${"2024-05-09"}     | ${"5784-09-01[u-ca=hebrew]"}
    ${"2024-06-06"} | ${"5784-09-29[u-ca=hebrew]"} | ${"2024-06-07"}     | ${"5784-10-01[u-ca=hebrew]"}
    ${"2024-07-06"} | ${"5784-10-30[u-ca=hebrew]"} | ${"2024-07-07"}     | ${"5784-11-01[u-ca=hebrew]"}
    ${"2024-08-04"} | ${"5784-11-29[u-ca=hebrew]"} | ${"2024-08-05"}     | ${"5784-12-01[u-ca=hebrew]"}
    ${"2024-09-03"} | ${"5784-12-30[u-ca=hebrew]"} | ${"2024-09-04"}     | ${"5784-13-01[u-ca=hebrew]"}
    ${"2024-10-02"} | ${"5784-13-29[u-ca=hebrew]"} | ${"2024-10-03"}     | ${"5785-01-01[u-ca=hebrew]"}
  `(
    "leap year 5784: $lastIsoOfMonth -> $expectedLast, $firstIsoOfNextMonth -> $expectedNext",
    ({
      lastIsoOfMonth,
      expectedLast,
      firstIsoOfNextMonth,
      expectedNext,
    }: {
      lastIsoOfMonth: string;
      expectedLast: string;
      firstIsoOfNextMonth: string;
      expectedNext: string;
    }) => {
      expect(convertDateToCalendar(lastIsoOfMonth, "hebrew")).toBe(
        expectedLast,
      );
      expect(convertDateToCalendar(firstIsoOfNextMonth, "hebrew")).toBe(
        expectedNext,
      );
    },
  );

  it("round-trips a leap-year (13-month) date through hebrew and back to gregorian", () => {
    const converted = convertDateToCalendar("2024-02-10", "hebrew");
    expect(converted).toBe("5784-06-01[u-ca=hebrew]");
    expect(convertDateToCalendar(converted, "gregorian")).toBe("2024-02-10");
  });

  it("round-trips a non-leap-year (12-month) date through hebrew and back to gregorian", () => {
    const converted = convertDateToCalendar("2023-02-22", "hebrew");
    expect(converted).toBe("5783-06-01[u-ca=hebrew]");
    expect(convertDateToCalendar(converted, "gregorian")).toBe("2023-02-22");
  });

  it("round-trips an epoch-adjacent hebrew year 1 date to gregorian", () => {
    const converted = convertDateToCalendar("-003760-09-07", "hebrew");
    expect(converted).toBe("0001-01-01[u-ca=hebrew]");
    expect(convertDateToCalendar(converted, "gregorian")).toBe("-003760-09-07");
  });

  it.each`
    value           | calendar
    ${"invalid"}    | ${"hebrew"}
    ${"2024-02-30"} | ${"hebrew"}
    ${""}           | ${"hebrew"}
    ${null}         | ${"hebrew"}
    ${123}          | ${"hebrew"}
  `(
    "returns empty string for invalid input: $value",
    ({ value, calendar }: { value: unknown; calendar: "hebrew" }) => {
      expect(convertDateToCalendar(value as string, calendar)).toBe("");
    },
  );

  it("returns empty string for an unsupported calendar system", () => {
    expect(
      convertDateToCalendar("2024-10-03", "martian" as unknown as "hebrew"),
    ).toBe("");
  });

  it("returns empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(convertDateToCalendar("2024-10-03", "hebrew")).toBe("");
  });
});
