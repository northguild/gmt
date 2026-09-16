import { isBusinessDay } from "../../plain/compare";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { mergeCalendars } from "./mergeCalendars";

// 4 July 2024 is a Thursday, 6 May 2024 a Monday — both midweek, so only the holiday rule
// can exclude them.
const unitedStates = {
  weekend: [6, 7],
  holidays: ["2024-07-04"],
  timeZone: "America/New_York",
};
const unitedKingdom = {
  weekend: [6, 7],
  holidays: ["2024-05-06"],
  timeZone: "Europe/London",
};
const fridaySaturday = {
  weekend: [5, 6],
  holidays: [],
  timeZone: "Asia/Riyadh",
};

describe("mergeCalendars", () => {
  it("unions the holidays of two jurisdictions", () => {
    expect(mergeCalendars([unitedStates, unitedKingdom])).toEqual({
      weekend: [6, 7],
      holidays: ["2024-05-06", "2024-07-04"],
      timeZone: "America/New_York",
    });
  });

  it("unions weekend rules that disagree", () => {
    expect(
      mergeCalendars([
        { weekend: [6, 7], holidays: [], timeZone: "UTC" },
        fridaySaturday,
      ]),
    ).toEqual({ weekend: [5, 6, 7], holidays: [], timeZone: "UTC" });
  });

  it("sorts and de-duplicates both lists", () => {
    expect(
      mergeCalendars([
        {
          weekend: [7, 6],
          holidays: ["2024-07-04", "2024-01-01"],
          timeZone: "UTC",
        },
        { weekend: [6], holidays: ["2024-07-04"], timeZone: "Europe/London" },
      ]),
    ).toEqual({
      weekend: [6, 7],
      holidays: ["2024-01-01", "2024-07-04"],
      timeZone: "UTC",
    });
  });

  it("returns a normalised copy of a single calendar", () => {
    expect(mergeCalendars([unitedStates])).toEqual({
      weekend: [6, 7],
      holidays: ["2024-07-04"],
      timeZone: "America/New_York",
    });
  });

  it("keeps the first calendar's timeZone when they differ", () => {
    expect(mergeCalendars([unitedKingdom, unitedStates])?.timeZone).toBe(
      "Europe/London",
    );
    expect(mergeCalendars([unitedStates, unitedKingdom])?.timeZone).toBe(
      "America/New_York",
    );
  });

  // The point of merging: a date has to be a working day in every input to survive.
  it.each`
    value           | expected | description
    ${"2024-07-03"} | ${true}  | ${"a Wednesday neither closes"}
    ${"2024-07-04"} | ${false} | ${"a holiday in the first calendar only"}
    ${"2024-05-06"} | ${false} | ${"a holiday in the second calendar only"}
    ${"2024-07-06"} | ${false} | ${"a Saturday, weekend in both"}
  `(
    "makes $value a working day: $expected — $description",
    ({ value, expected }) => {
      const merged = mergeCalendars([unitedStates, unitedKingdom]);

      expect(merged).not.toBe(null);
      expect(isBusinessDay(value, merged as never)).toBe(expected);
    },
  );

  // A Saturday–Sunday and a Friday–Saturday calendar leave Sunday through Thursday.
  it.each`
    value           | expected | description
    ${"2024-07-04"} | ${true}  | ${"Thursday, working in both"}
    ${"2024-07-05"} | ${false} | ${"Friday, weekend in the second"}
    ${"2024-07-06"} | ${false} | ${"Saturday, weekend in both"}
    ${"2024-07-07"} | ${false} | ${"Sunday, weekend in the first"}
  `(
    "makes $value a working day: $expected under merged weekend rules — $description",
    ({ value, expected }) => {
      const merged = mergeCalendars([
        { weekend: [6, 7], holidays: [], timeZone: "UTC" },
        fridaySaturday,
      ]);

      expect(isBusinessDay(value, merged as never)).toBe(expected);
    },
  );

  it("returns null for an empty list, which names no timeZone", () => {
    expect(mergeCalendars([])).toBe(null);
  });

  it("returns null when the merged weekend leaves no working day", () => {
    expect(
      mergeCalendars([
        { weekend: [1, 2, 3, 4], holidays: [], timeZone: "UTC" },
        { weekend: [5, 6, 7], holidays: [], timeZone: "UTC" },
      ]),
    ).toBe(null);
  });

  it.each`
    invalid                                                              | description
    ${{ weekend: [6, 7], holidays: [], timeZone: "Invalid/Zone" }}       | ${"an unknown timeZone"}
    ${{ weekend: [1, 2, 3, 4, 5, 6, 7], holidays: [], timeZone: "UTC" }} | ${"no business day at all"}
    ${{ weekend: [6, 8], holidays: [], timeZone: "UTC" }}                | ${"a weekday out of range"}
    ${{ weekend: [6, 7], holidays: ["2024-02-30"], timeZone: "UTC" }}    | ${"a holiday that does not exist"}
    ${{}}                                                                | ${"no fields"}
    ${null}                                                              | ${"null"}
    ${"UTC"}                                                             | ${"a string"}
  `("returns null when an element has $description", ({ invalid }) => {
    expect(mergeCalendars([unitedStates, invalid] as never)).toBe(null);
  });

  it.each`
    candidate       | description
    ${null}         | ${"null"}
    ${undefined}    | ${"undefined"}
    ${unitedStates} | ${"a single calendar, not an array"}
    ${"2024-07-04"} | ${"a string"}
    ${12}           | ${"a number"}
  `("returns null for non-array input $description", ({ candidate }) => {
    expect(mergeCalendars(candidate as never)).toBe(null);
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(mergeCalendars([unitedStates, unitedKingdom])).toBe(null);
  });
});
