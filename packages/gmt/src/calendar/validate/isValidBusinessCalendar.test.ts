import { battleTestTimeZones } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { isValidBusinessCalendar } from "./isValidBusinessCalendar";

describe("isValidBusinessCalendar", () => {
  // Weekend shapes the world actually uses — Sat/Sun, Fri/Sat, one day, and none at all.
  it.each`
    weekend               | description
    ${[6, 7]}             | ${"Saturday–Sunday"}
    ${[5, 6]}             | ${"Friday–Saturday"}
    ${[7]}                | ${"Sunday only"}
    ${[]}                 | ${"no weekly closure"}
    ${[6, 6, 7]}          | ${"duplicates, which are ignored"}
    ${[1, 2, 3, 4, 5, 6]} | ${"six weekend days, leaving one business day"}
  `("returns true for a $description weekend $weekend", ({ weekend }) => {
    expect(
      isValidBusinessCalendar({ weekend, holidays: [], timeZone: "UTC" }),
    ).toBe(true);
  });

  it("returns true for a calendar carrying holidays", () => {
    expect(
      isValidBusinessCalendar({
        weekend: [6, 7],
        holidays: ["2024-07-04", "2024-12-25"],
        timeZone: "America/New_York",
      }),
    ).toBe(true);
  });

  // Every battle-test zone is a legitimate locality for a calendar.
  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "returns true for timeZone $timeZone",
    ({ timeZone }) => {
      expect(
        isValidBusinessCalendar({ weekend: [6, 7], holidays: [], timeZone }),
      ).toBe(true);
    },
  );

  // A calendar whose every weekday is weekend has no business day to walk to.
  it.each`
    weekend                     | description
    ${[1, 2, 3, 4, 5, 6, 7]}    | ${"all seven days"}
    ${[1, 1, 2, 3, 4, 5, 6, 7]} | ${"all seven days with a duplicate"}
  `("returns false when weekend is $description", ({ weekend }) => {
    expect(
      isValidBusinessCalendar({ weekend, holidays: [], timeZone: "UTC" }),
    ).toBe(false);
  });

  it.each`
    weekend       | description
    ${[0, 6]}     | ${"0, below Monday"}
    ${[6, 8]}     | ${"8, above Sunday"}
    ${[-1]}       | ${"negative"}
    ${[6.5]}      | ${"non-integer"}
    ${[NaN]}      | ${"NaN"}
    ${[Infinity]} | ${"Infinity"}
    ${["6"]}      | ${"a numeric string"}
    ${[null]}     | ${"null"}
    ${"6,7"}      | ${"a string, not an array"}
    ${undefined}  | ${"absent"}
    ${null}       | ${"null"}
    ${{}}         | ${"an object"}
  `("returns false when weekend is $description", ({ weekend }) => {
    expect(
      isValidBusinessCalendar({ weekend, holidays: [], timeZone: "UTC" }),
    ).toBe(false);
  });

  it.each`
    holidays                   | description
    ${["2024-02-30"]}          | ${"a date that does not exist"}
    ${["2024-07-04T00:00:00"]} | ${"a datetime, not a date"}
    ${["2024-12-31T23:59:60"]} | ${"a leap second"}
    ${["2024/07/04"]}          | ${"a non-ISO separator"}
    ${[" 2024-07-04 "]}        | ${"padded whitespace"}
    ${[""]}                    | ${"an empty string"}
    ${[null]}                  | ${"null"}
    ${[20240704]}              | ${"a number"}
    ${"2024-07-04"}            | ${"a string, not an array"}
    ${undefined}               | ${"absent"}
    ${null}                    | ${"null"}
  `("returns false when holidays contains $description", ({ holidays }) => {
    expect(
      isValidBusinessCalendar({ weekend: [6, 7], holidays, timeZone: "UTC" }),
    ).toBe(false);
  });

  it.each`
    timeZone          | description
    ${"Invalid/Zone"} | ${"an unknown identifier"}
    ${""}             | ${"an empty string"}
    ${" UTC "}        | ${"padded whitespace"}
    ${5}              | ${"a number"}
    ${null}           | ${"null"}
    ${undefined}      | ${"absent"}
  `("returns false when timeZone is $description", ({ timeZone }) => {
    expect(
      isValidBusinessCalendar({ weekend: [6, 7], holidays: [], timeZone }),
    ).toBe(false);
  });

  it.each`
    candidate
    ${null}
    ${undefined}
    ${"2024-07-04"}
    ${5}
    ${true}
    ${[]}
    ${[{ weekend: [6, 7], holidays: [], timeZone: "UTC" }]}
  `("returns false for non-object input $candidate", ({ candidate }) => {
    expect(isValidBusinessCalendar(candidate)).toBe(false);
  });

  it("returns false when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(
      isValidBusinessCalendar({
        weekend: [6, 7],
        holidays: ["2024-07-04"],
        timeZone: "UTC",
      }),
    ).toBe(false);
  });
});
