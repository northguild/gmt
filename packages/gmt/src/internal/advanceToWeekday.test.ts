import { Temporal } from "@js-temporal/polyfill";
import { advanceToWeekday } from "./advanceToWeekday";

describe("advanceToWeekday", () => {
  const friday = Temporal.PlainDate.from("2024-03-15");
  const monday = Temporal.PlainDate.from("2024-03-11");
  const sunday = Temporal.PlainDate.from("2024-03-31");
  const yearStart = Temporal.PlainDate.from("2024-01-01");
  const yearEnd = Temporal.PlainDate.from("2024-12-31");
  const leapDay = Temporal.PlainDate.from("2024-02-29");

  describe("forward (direction: 1)", () => {
    it.each`
      date       | dayOfWeek | inclusive | expected
      ${friday}  | ${5}      | ${true}   | ${"2024-03-15"}
      ${friday}  | ${5}      | ${false}  | ${"2024-03-22"}
      ${friday}  | ${1}      | ${false}  | ${"2024-03-18"}
      ${monday}  | ${5}      | ${false}  | ${"2024-03-15"}
      ${sunday}  | ${1}      | ${false}  | ${"2024-04-01"}
      ${yearEnd} | ${1}      | ${false}  | ${"2025-01-06"}
    `(
      "returns $expected for forward from $date to dayOfWeek $dayOfWeek (inclusive: $inclusive)",
      ({ date, dayOfWeek, inclusive, expected }) => {
        expect(advanceToWeekday(date, dayOfWeek, 1, inclusive).toString()).toBe(
          expected,
        );
      },
    );

    it.each`
      fromDate  | dayOfWeek | expected
      ${friday} | ${1}      | ${"2024-03-18"}
      ${friday} | ${2}      | ${"2024-03-19"}
      ${friday} | ${3}      | ${"2024-03-20"}
      ${friday} | ${4}      | ${"2024-03-21"}
      ${friday} | ${5}      | ${"2024-03-22"}
      ${friday} | ${6}      | ${"2024-03-16"}
      ${friday} | ${7}      | ${"2024-03-17"}
    `(
      "returns $expected for forward from $fromDate to dayOfWeek $dayOfWeek",
      ({ fromDate, dayOfWeek, expected }) => {
        expect(advanceToWeekday(fromDate, dayOfWeek, 1, false).toString()).toBe(
          expected,
        );
      },
    );
  });

  describe("backward (direction: -1)", () => {
    it.each`
      date         | dayOfWeek | inclusive | expected
      ${friday}    | ${5}      | ${true}   | ${"2024-03-15"}
      ${friday}    | ${5}      | ${false}  | ${"2024-03-08"}
      ${friday}    | ${1}      | ${false}  | ${"2024-03-11"}
      ${monday}    | ${5}      | ${false}  | ${"2024-03-08"}
      ${yearStart} | ${7}      | ${false}  | ${"2023-12-31"}
      ${leapDay}   | ${1}      | ${false}  | ${"2024-02-26"}
    `(
      "returns $expected for backward from $date to dayOfWeek $dayOfWeek (inclusive: $inclusive)",
      ({ date, dayOfWeek, inclusive, expected }) => {
        expect(
          advanceToWeekday(date, dayOfWeek, -1, inclusive).toString(),
        ).toBe(expected);
      },
    );

    it.each`
      fromDate  | dayOfWeek | expected
      ${friday} | ${1}      | ${"2024-03-11"}
      ${friday} | ${2}      | ${"2024-03-12"}
      ${friday} | ${3}      | ${"2024-03-13"}
      ${friday} | ${4}      | ${"2024-03-14"}
      ${friday} | ${5}      | ${"2024-03-08"}
      ${friday} | ${6}      | ${"2024-03-09"}
      ${friday} | ${7}      | ${"2024-03-10"}
    `(
      "returns $expected for backward from $fromDate to dayOfWeek $dayOfWeek",
      ({ fromDate, dayOfWeek, expected }) => {
        expect(
          advanceToWeekday(fromDate, dayOfWeek, -1, false).toString(),
        ).toBe(expected);
      },
    );
  });
});
