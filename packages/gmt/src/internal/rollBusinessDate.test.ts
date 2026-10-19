import { parseBusinessCalendar } from "./businessCalendar";
import { rollBusinessDate } from "./rollBusinessDate";
import { Temporal } from "./temporal";

const calendar = parseBusinessCalendar({
  weekend: [6, 7],
  holidays: [],
  timeZone: "UTC",
})!;

describe("rollBusinessDate", () => {
  // June 2024: Sat 1st, Sun 2nd, Sun 30th, Fri 28th. Roll rules per ISDA business day conventions.
  it.each`
    date            | convention             | expected
    ${"2024-06-01"} | ${"following"}         | ${"2024-06-03"}
    ${"2024-06-01"} | ${"preceding"}         | ${"2024-05-31"}
    ${"2024-06-01"} | ${"modifiedPreceding"} | ${"2024-06-03"}
    ${"2024-06-30"} | ${"modifiedFollowing"} | ${"2024-06-28"}
    ${"2024-06-10"} | ${"endOfMonth"}        | ${"2024-06-28"}
    ${"2024-06-01"} | ${"none"}              | ${"2024-06-01"}
    ${"2024-06-05"} | ${"following"}         | ${"2024-06-05"}
  `(
    "rolls $date by $convention to $expected",
    ({ date, convention, expected }) => {
      expect(
        rollBusinessDate(
          Temporal.PlainDate.from(date),
          convention,
          calendar,
        )?.toString(),
      ).toBe(expected);
    },
  );

  // Month ends in 2024, Saturday/Sunday weekend: 31 Aug Sat, 1 Sep Sun, 30 Nov Sat, 31 Mar Sun,
  // 29 Feb Thu, 31 Dec Tue. Rolling out of the month is what the two modified rules turn back from.
  it.each`
    date            | convention             | expected
    ${"2024-08-31"} | ${"following"}         | ${"2024-09-02"}
    ${"2024-08-31"} | ${"modifiedFollowing"} | ${"2024-08-30"}
    ${"2024-08-31"} | ${"preceding"}         | ${"2024-08-30"}
    ${"2024-08-31"} | ${"modifiedPreceding"} | ${"2024-08-30"}
    ${"2024-09-01"} | ${"preceding"}         | ${"2024-08-30"}
    ${"2024-09-01"} | ${"modifiedPreceding"} | ${"2024-09-02"}
    ${"2024-09-01"} | ${"modifiedFollowing"} | ${"2024-09-02"}
    ${"2024-03-31"} | ${"following"}         | ${"2024-04-01"}
    ${"2024-03-31"} | ${"modifiedFollowing"} | ${"2024-03-29"}
    ${"2024-11-30"} | ${"modifiedFollowing"} | ${"2024-11-29"}
    ${"2024-12-31"} | ${"modifiedFollowing"} | ${"2024-12-31"}
    ${"2024-02-10"} | ${"endOfMonth"}        | ${"2024-02-29"}
    ${"2024-08-15"} | ${"endOfMonth"}        | ${"2024-08-30"}
    ${"2024-12-15"} | ${"endOfMonth"}        | ${"2024-12-31"}
  `(
    "month end: rolls $date by $convention to $expected",
    ({ date, convention, expected }) => {
      expect(
        rollBusinessDate(
          Temporal.PlainDate.from(date),
          convention,
          calendar,
        )?.toString(),
      ).toBe(expected);
    },
  );

  // 31 Dec 2024 and 1 Jan 2025 are holidays: the walk crosses the year end.
  const yearEnd = parseBusinessCalendar({
    weekend: [6, 7],
    holidays: ["2024-12-31", "2025-01-01"],
    timeZone: "UTC",
  })!;
  it.each`
    date            | convention             | expected
    ${"2024-12-31"} | ${"following"}         | ${"2025-01-02"}
    ${"2024-12-31"} | ${"modifiedFollowing"} | ${"2024-12-30"}
    ${"2024-12-31"} | ${"preceding"}         | ${"2024-12-30"}
    ${"2025-01-01"} | ${"modifiedPreceding"} | ${"2025-01-02"}
    ${"2024-12-10"} | ${"endOfMonth"}        | ${"2024-12-30"}
  `(
    "year end with holidays: rolls $date by $convention to $expected",
    ({ date, convention, expected }) => {
      expect(
        rollBusinessDate(
          Temporal.PlainDate.from(date),
          convention,
          yearEnd,
        )?.toString(),
      ).toBe(expected);
    },
  );
});
