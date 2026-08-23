import { isCalendarSystem, temporalCalendarIds } from "./calendarSystemIds";

describe("temporalCalendarIds", () => {
  it.each`
    calendar       | temporalId
    ${"gregorian"} | ${"iso8601"}
    ${"hebrew"}    | ${"hebrew"}
  `(
    "maps $calendar to Temporal calendar id $temporalId",
    ({
      calendar,
      temporalId,
    }: {
      calendar: "gregorian" | "hebrew";
      temporalId: string;
    }) => {
      expect(temporalCalendarIds[calendar]).toBe(temporalId);
    },
  );

  it("exposes exactly the CalendarSystem identifiers, no more and no fewer", () => {
    expect(Object.keys(temporalCalendarIds).sort()).toEqual([
      "gregorian",
      "hebrew",
    ]);
  });
});

describe("isCalendarSystem", () => {
  it.each`
    value
    ${"gregorian"}
    ${"hebrew"}
  `(
    "returns true for supported calendar: $value",
    ({ value }: { value: string }) => {
      expect(isCalendarSystem(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"islamic-civil"}
    ${"japanese"}
    ${"martian"}
    ${""}
    ${"Hebrew"}
  `(
    "returns false for unsupported calendar: $value",
    ({ value }: { value: string }) => {
      expect(isCalendarSystem(value)).toBe(false);
    },
  );
});
