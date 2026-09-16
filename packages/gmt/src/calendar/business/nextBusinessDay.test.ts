import { addBusinessDays } from "../../plain/calculate";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { nextBusinessDay } from "./nextBusinessDay";

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

describe("nextBusinessDay", () => {
  // Strictly after the input — a working day still moves on to the next one.
  it.each`
    value           | expected        | description
    ${"2024-07-02"} | ${"2024-07-03"} | ${"Tue to Wed, both working days"}
    ${"2024-07-03"} | ${"2024-07-05"} | ${"Wed over the Thu holiday"}
    ${"2024-07-04"} | ${"2024-07-05"} | ${"from the holiday itself"}
    ${"2024-07-05"} | ${"2024-07-08"} | ${"Fri over the weekend"}
    ${"2024-07-06"} | ${"2024-07-08"} | ${"from a Saturday"}
    ${"2024-07-07"} | ${"2024-07-08"} | ${"from a Sunday"}
  `("returns $expected for $value — $description", ({ value, expected }) => {
    expect(nextBusinessDay(value, usIndependence)).toBe(expected);
  });

  it.each`
    value           | calendar           | expected        | description
    ${"2024-07-04"} | ${fridaySaturday}  | ${"2024-07-07"} | ${"Thu over a Fri-Sat weekend to Sun"}
    ${"2024-07-07"} | ${fridaySaturday}  | ${"2024-07-08"} | ${"Sun to Mon"}
    ${"2024-07-05"} | ${sundayOnly}      | ${"2024-07-06"} | ${"Sat is a working day"}
    ${"2024-07-06"} | ${sundayOnly}      | ${"2024-07-08"} | ${"only Sun closes"}
    ${"2024-07-03"} | ${noWeeklyClosure} | ${"2024-07-05"} | ${"holiday only, no weekend"}
    ${"2024-07-05"} | ${noWeeklyClosure} | ${"2024-07-06"} | ${"Sat works with no weekly closure"}
    ${"2024-07-03"} | ${bridgedHoliday}  | ${"2024-07-08"} | ${"two holidays bridging into the weekend"}
  `(
    "returns $expected for $value — $description",
    ({ value, calendar, expected }) => {
      expect(nextBusinessDay(value, calendar)).toBe(expected);
    },
  );

  // It is exactly one business day forward.
  it.each`
    value
    ${"2024-07-03"}
    ${"2024-07-04"}
    ${"2024-07-05"}
    ${"2024-07-06"}
  `("agrees with addBusinessDays($value, 1) ", ({ value }) => {
    expect(nextBusinessDay(value, usIndependence)).toBe(
      addBusinessDays(value, 1, usIndependence),
    );
  });

  it.each`
    value                    | description
    ${"invalid"}             | ${"an unparseable date"}
    ${"2024-02-30"}          | ${"a date that does not exist"}
    ${"2024-07-03T00:00:00"} | ${"a datetime"}
    ${""}                    | ${"an empty string"}
    ${" 2024-07-03 "}        | ${"padded whitespace"}
    ${null}                  | ${"null"}
    ${undefined}             | ${"undefined"}
    ${12}                    | ${"a number"}
  `("returns an empty string for $description $value", ({ value }) => {
    expect(nextBusinessDay(value as never, usIndependence)).toBe("");
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
      expect(nextBusinessDay("2024-07-03", calendar as never)).toBe("");
    },
  );

  it("returns an empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(nextBusinessDay("2024-07-03", usIndependence)).toBe("");
  });
});
