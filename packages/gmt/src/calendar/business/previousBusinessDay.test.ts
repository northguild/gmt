import { subtractBusinessDays } from "../../plain/calculate";
import { battleTestTimeZones } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { previousBusinessDay } from "./previousBusinessDay";

// July 2024: 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat, 7 Sun, 8 Mon.
const usIndependence = {
  weekend: [6, 7],
  holidays: ["2024-07-04"],
  timeZone: "America/New_York",
};
const fridaySaturday = {
  weekend: [5, 6],
  holidays: [],
  timeZone: "Asia/Riyadh",
};
const sundayOnly = { weekend: [7], holidays: [], timeZone: "UTC" };
const noWeeklyClosure = {
  weekend: [],
  holidays: ["2024-07-04"],
  timeZone: "UTC",
};
const bridgedHoliday = {
  weekend: [6, 7],
  holidays: ["2024-07-04", "2024-07-05"],
  timeZone: "America/New_York",
};

describe("previousBusinessDay", () => {
  // Strictly before the input — a working day still moves back to the previous one.
  it.each`
    value           | expected        | description
    ${"2024-07-03"} | ${"2024-07-02"} | ${"Wed to Tue, both working days"}
    ${"2024-07-05"} | ${"2024-07-03"} | ${"Fri back over the Thu holiday"}
    ${"2024-07-04"} | ${"2024-07-03"} | ${"from the holiday itself"}
    ${"2024-07-08"} | ${"2024-07-05"} | ${"Mon back over the weekend"}
    ${"2024-07-06"} | ${"2024-07-05"} | ${"from a Saturday"}
    ${"2024-07-07"} | ${"2024-07-05"} | ${"from a Sunday"}
  `("returns $expected for $value — $description", ({ value, expected }) => {
    expect(previousBusinessDay(value, usIndependence)).toBe(expected);
  });

  it.each`
    value           | calendar           | expected        | description
    ${"2024-07-07"} | ${fridaySaturday}  | ${"2024-07-04"} | ${"Sun back over a Fri-Sat weekend to Thu"}
    ${"2024-07-08"} | ${fridaySaturday}  | ${"2024-07-07"} | ${"Mon to Sun"}
    ${"2024-07-07"} | ${sundayOnly}      | ${"2024-07-06"} | ${"Sat is a working day"}
    ${"2024-07-06"} | ${sundayOnly}      | ${"2024-07-05"} | ${"only Sun closes"}
    ${"2024-07-05"} | ${noWeeklyClosure} | ${"2024-07-03"} | ${"holiday only, no weekend"}
    ${"2024-07-06"} | ${noWeeklyClosure} | ${"2024-07-05"} | ${"Sat works with no weekly closure"}
    ${"2024-07-08"} | ${bridgedHoliday}  | ${"2024-07-03"} | ${"two holidays bridging into the weekend"}
  `(
    "returns $expected for $value — $description",
    ({ value, calendar, expected }) => {
      expect(previousBusinessDay(value, calendar)).toBe(expected);
    },
  );

  // It is exactly one business day backward.
  it.each`
    value
    ${"2024-07-05"}
    ${"2024-07-04"}
    ${"2024-07-08"}
    ${"2024-07-06"}
  `("agrees with subtractBusinessDays($value, 1) ", ({ value }) => {
    expect(previousBusinessDay(value, usIndependence)).toBe(
      subtractBusinessDays(value, 1, usIndependence),
    );
  });

  it.each`
    value                    | description
    ${"invalid"}             | ${"an unparseable date"}
    ${"2024-02-30"}          | ${"a date that does not exist"}
    ${"2024-07-05T00:00:00"} | ${"a datetime"}
    ${""}                    | ${"an empty string"}
    ${" 2024-07-05 "}        | ${"padded whitespace"}
    ${null}                  | ${"null"}
    ${undefined}             | ${"undefined"}
    ${12}                    | ${"a number"}
  `("returns an empty string for $description $value", ({ value }) => {
    expect(previousBusinessDay(value as never, usIndependence)).toBe("");
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
      expect(previousBusinessDay("2024-07-05", calendar as never)).toBe("");
    },
  );

  it("returns an empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(previousBusinessDay("2024-07-05", usIndependence)).toBe("");
  });

  // calendar.timeZone records locality; it never changes the answer for a local date.
  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "gives the same answer whatever calendar.timeZone says ($timeZone)",
    ({ timeZone }) => {
      expect(
        previousBusinessDay("2024-07-05", { ...usIndependence, timeZone }),
      ).toBe("2024-07-03");
    },
  );
});
