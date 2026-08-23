import { isCalendarSystem, temporalCalendarIds } from "./calendarSystemIds";

describe("temporalCalendarIds", () => {
  it.each`
    calendar              | temporalId
    ${"gregorian"}        | ${"iso8601"}
    ${"hebrew"}           | ${"hebrew"}
    ${"islamic-civil"}    | ${"islamic-civil"}
    ${"islamic-tabular"}  | ${"islamic-tbla"}
    ${"islamic-umalqura"} | ${"islamic-umalqura"}
  `(
    "maps $calendar to Temporal calendar id $temporalId",
    ({
      calendar,
      temporalId,
    }: {
      calendar:
        | "gregorian"
        | "hebrew"
        | "islamic-civil"
        | "islamic-tabular"
        | "islamic-umalqura";
      temporalId: string;
    }) => {
      expect(temporalCalendarIds[calendar]).toBe(temporalId);
    },
  );

  it("exposes exactly the CalendarSystem identifiers, no more and no fewer", () => {
    expect(Object.keys(temporalCalendarIds).sort()).toEqual([
      "gregorian",
      "hebrew",
      "islamic-civil",
      "islamic-tabular",
      "islamic-umalqura",
    ]);
  });
});

describe("isCalendarSystem", () => {
  it.each`
    value
    ${"gregorian"}
    ${"hebrew"}
    ${"islamic-civil"}
    ${"islamic-tabular"}
    ${"islamic-umalqura"}
  `(
    "returns true for supported calendar: $value",
    ({ value }: { value: string }) => {
      expect(isCalendarSystem(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"islamic-tbla"}
    ${"islamic"}
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
