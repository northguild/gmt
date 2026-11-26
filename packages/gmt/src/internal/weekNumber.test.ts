import { Temporal } from "./temporal";
import { weekNumberOf } from "./weekNumber";

// ISO 8601-1 §5.2.4.3: week 1 holds the year's first Thursday, so 2024-12-30 (Monday) is week 1
// of 2025 and 2021-01-01 (Friday) is week 53 of 2020.
// UTS #35 week of year, Sunday first, minimal first week of 1 day: week 1 is the week whose
// Saturday falls in 1 to 7 January, so a Sunday-first week ending 1 to 7 January is week 1.
describe("weekNumberOf", () => {
  it.each`
    date               | weekStartsOn | expected | reason
    ${"2024-12-30"}    | ${"monday"}  | ${1}     | ${"Monday 30 December belongs to week 1 of the next ISO year"}
    ${"2021-01-01"}    | ${"monday"}  | ${53}    | ${"Friday 1 January belongs to week 53 of the previous ISO year"}
    ${"2023-01-01"}    | ${"monday"}  | ${52}    | ${"Sunday 1 January ends ISO week 52"}
    ${"2024-12-31"}    | ${"monday"}  | ${1}     | ${"Tuesday 31 December belongs to week 1 of the next ISO year"}
    ${"2020-12-31"}    | ${"monday"}  | ${53}    | ${"Thursday 31 December closes a 53-week ISO year"}
    ${"2024-12-31"}    | ${"sunday"}  | ${1}     | ${"its Saturday, 4 January, starts the next week-year"}
    ${"2023-01-01"}    | ${"sunday"}  | ${1}     | ${"its Saturday is 7 January"}
    ${"2022-01-02"}    | ${"sunday"}  | ${2}     | ${"its Saturday is 8 January"}
    ${"2021-12-31"}    | ${"sunday"}  | ${1}     | ${"its Saturday is 1 January of the next year"}
    ${"+275760-09-13"} | ${"monday"}  | ${37}    | ${"the latest date, a six-digit year"}
    ${"+275760-09-13"} | ${"sunday"}  | ${37}    | ${"the latest date, a Saturday, counted on the day of the year"}
  `(
    "'$date' with weeks starting on '$weekStartsOn' is week $expected ('$reason')",
    ({
      date,
      weekStartsOn,
      expected,
    }: {
      date: string;
      weekStartsOn: "monday" | "sunday";
      expected: number;
    }) => {
      expect(weekNumberOf(Temporal.PlainDate.from(date), weekStartsOn)).toBe(
        expected,
      );
    },
  );

  it.each`
    weekStartsOn
    ${"monday"}
    ${"sunday"}
  `(
    "is null for a Hebrew-calendar date when weeks start on '$weekStartsOn'",
    ({ weekStartsOn }: { weekStartsOn: "monday" | "sunday" }) => {
      expect(
        weekNumberOf(
          Temporal.PlainDate.from("2024-03-15[u-ca=hebrew]"),
          weekStartsOn,
        ),
      ).toBeNull();
    },
  );
});
