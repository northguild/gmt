import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { rollDate } from "./rollDate";

// May 2024 ends on Friday the 31st, which this calendar closes. 30 May is a Thursday,
// 1 June a Saturday, 2 June a Sunday, 3 June a Monday.
const mayEndsClosed = {
  weekend: [6, 7],
  holidays: ["2024-05-31"],
  timeZone: "America/New_York",
};
const satSunNoHolidays = { weekend: [6, 7], holidays: [], timeZone: "UTC" };
const fridaySaturday = {
  weekend: [5, 6],
  holidays: [],
  timeZone: "Asia/Riyadh",
};

describe("rollDate", () => {
  // A month-end Friday that is a holiday: rolling forward would leave May, so the modified
  // conventions turn round. This is the case the whole convention exists for.
  it.each`
    convention             | expected        | description
    ${"following"}         | ${"2024-06-03"} | ${"forward past the weekend into June"}
    ${"modifiedFollowing"} | ${"2024-05-30"} | ${"backward, because forward leaves May"}
    ${"preceding"}         | ${"2024-05-30"} | ${"backward to Thursday"}
    ${"modifiedPreceding"} | ${"2024-05-30"} | ${"backward, which stays in May"}
    ${"endOfMonth"}        | ${"2024-05-30"} | ${"May's last working day"}
    ${"none"}              | ${"2024-05-31"} | ${"unadjusted"}
  `(
    "rolls the month-end holiday 2024-05-31 to $expected under $convention — $description",
    ({ convention, expected }) => {
      expect(rollDate("2024-05-31", convention, mayEndsClosed)).toBe(expected);
    },
  );

  // 1 June is a Saturday, so rolling back lands in May and modifiedPreceding turns round.
  it.each`
    convention             | expected        | description
    ${"following"}         | ${"2024-06-03"} | ${"forward to Monday"}
    ${"modifiedFollowing"} | ${"2024-06-03"} | ${"forward, which stays in June"}
    ${"preceding"}         | ${"2024-05-30"} | ${"backward past the closed Friday into May"}
    ${"modifiedPreceding"} | ${"2024-06-03"} | ${"forward, because backward leaves June"}
    ${"endOfMonth"}        | ${"2024-06-28"} | ${"June's last working day"}
    ${"none"}              | ${"2024-06-01"} | ${"unadjusted"}
  `(
    "rolls the Saturday 2024-06-01 to $expected under $convention — $description",
    ({ convention, expected }) => {
      expect(rollDate("2024-06-01", convention, mayEndsClosed)).toBe(expected);
    },
  );

  // Every convention but endOfMonth leaves a working day alone.
  it.each`
    convention
    ${"following"}
    ${"modifiedFollowing"}
    ${"preceding"}
    ${"modifiedPreceding"}
    ${"none"}
  `(
    "leaves the working day 2024-05-29 unchanged under $convention",
    ({ convention }) => {
      expect(rollDate("2024-05-29", convention, mayEndsClosed)).toBe(
        "2024-05-29",
      );
    },
  );

  // endOfMonth snaps to the month's last working day wherever in the month it starts —
  // that is the primitive a month-end anchor needs, not a second modifiedFollowing.
  it.each`
    value           | calendar            | expected        | description
    ${"2024-05-15"} | ${mayEndsClosed}    | ${"2024-05-30"} | ${"mid-month, 31 May closed"}
    ${"2024-05-01"} | ${mayEndsClosed}    | ${"2024-05-30"} | ${"first of the month"}
    ${"2024-05-30"} | ${mayEndsClosed}    | ${"2024-05-30"} | ${"already the last working day"}
    ${"2024-07-15"} | ${satSunNoHolidays} | ${"2024-07-31"} | ${"month ending on a Wednesday"}
    ${"2024-03-15"} | ${satSunNoHolidays} | ${"2024-03-29"} | ${"month ending on a Sunday"}
    ${"2024-02-10"} | ${satSunNoHolidays} | ${"2024-02-29"} | ${"leap February, ending Thursday"}
    ${"2025-02-10"} | ${satSunNoHolidays} | ${"2025-02-28"} | ${"common February, ending Friday"}
    ${"2024-12-01"} | ${satSunNoHolidays} | ${"2024-12-31"} | ${"year end, a Tuesday"}
  `(
    "rolls $value to $expected under endOfMonth — $description",
    ({ value, calendar, expected }) => {
      expect(rollDate(value, "endOfMonth", calendar)).toBe(expected);
    },
  );

  // A Friday–Saturday weekend rolls the other way round from a Saturday–Sunday one.
  it.each`
    value           | convention             | expected        | description
    ${"2024-07-05"} | ${"following"}         | ${"2024-07-07"} | ${"Friday forward to Sunday"}
    ${"2024-07-05"} | ${"preceding"}         | ${"2024-07-04"} | ${"Friday back to Thursday"}
    ${"2024-07-06"} | ${"modifiedFollowing"} | ${"2024-07-07"} | ${"Saturday forward, staying in July"}
    ${"2024-06-29"} | ${"modifiedFollowing"} | ${"2024-06-30"} | ${"Saturday forward to Sunday, a working day here, staying in June"}
    ${"2024-07-31"} | ${"endOfMonth"}        | ${"2024-07-31"} | ${"31 July is a Wednesday, a working day"}
  `(
    "rolls $value to $expected under $convention with a Friday–Saturday weekend",
    ({ value, convention, expected }) => {
      expect(rollDate(value, convention, fridaySaturday)).toBe(expected);
    },
  );

  // `none` never moves the date, working day or not.
  it.each`
    value           | description
    ${"2024-05-31"} | ${"a holiday"}
    ${"2024-06-01"} | ${"a Saturday"}
    ${"2024-06-02"} | ${"a Sunday"}
    ${"2024-05-29"} | ${"a working day"}
  `(
    "returns $value unchanged under none when it is $description",
    ({ value }) => {
      expect(rollDate(value, "none", mayEndsClosed)).toBe(value);
    },
  );

  it.each`
    convention              | description
    ${"Following"}          | ${"wrong case"}
    ${"modified_following"} | ${"snake case"}
    ${"nearest"}            | ${"a convention GMT does not implement"}
    ${""}                   | ${"an empty string"}
    ${null}                 | ${"null"}
    ${undefined}            | ${"undefined"}
    ${1}                    | ${"a number"}
    ${{}}                   | ${"an object"}
  `(
    "returns an empty string for the $description convention $convention",
    ({ convention }) => {
      expect(rollDate("2024-05-31", convention as never, mayEndsClosed)).toBe(
        "",
      );
    },
  );

  it.each`
    value                    | description
    ${"invalid"}             | ${"an unparseable date"}
    ${"2024-02-30"}          | ${"a date that does not exist"}
    ${"2024-05-31T00:00:00"} | ${"a datetime"}
    ${""}                    | ${"an empty string"}
    ${" 2024-05-31 "}        | ${"padded whitespace"}
    ${null}                  | ${"null"}
    ${undefined}             | ${"undefined"}
    ${12}                    | ${"a number"}
  `("returns an empty string for $description $value", ({ value }) => {
    expect(rollDate(value as never, "following", mayEndsClosed)).toBe("");
  });

  it.each`
    calendar                                                             | description
    ${{ weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }}       | ${"an unknown timeZone"}
    ${{ weekend: [1, 2, 3, 4, 5, 6, 7], holidays: [], timeZone: "UTC" }} | ${"no business day at all"}
    ${{ weekend: [6, 8], holidays: [], timeZone: "UTC" }}                | ${"a weekday out of range"}
    ${{ weekend: [6, 7], holidays: ["2024-02-30"], timeZone: "UTC" }}    | ${"a holiday that does not exist"}
    ${{}}                                                                | ${"no fields"}
    ${null}                                                              | ${"null"}
    ${undefined}                                                         | ${"undefined"}
  `(
    "returns an empty string when the calendar has $description",
    ({ calendar }) => {
      expect(rollDate("2024-05-31", "following", calendar as never)).toBe("");
    },
  );

  // A works shutdown can close a whole month. endOfMonth then walks out of it, which is the
  // documented behaviour, not a sentinel.
  it("walks out of a month that is closed end to end under endOfMonth", () => {
    const augustShutdown = {
      weekend: [6, 7],
      holidays: Array.from(
        { length: 31 },
        (_, day) => `2024-08-${String(day + 1).padStart(2, "0")}`,
      ),
      timeZone: "Europe/Berlin",
    };

    // 31 July 2024 is a Wednesday, the last working day before the shutdown.
    expect(rollDate("2024-08-15", "endOfMonth", augustShutdown)).toBe(
      "2024-07-31",
    );
  });

  it("returns an empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(rollDate("2024-05-31", "following", mayEndsClosed)).toBe("");
  });
});
