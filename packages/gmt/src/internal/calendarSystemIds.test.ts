import { isCalendarSystem, temporalCalendarIds } from "./calendarSystemIds";

describe("temporalCalendarIds", () => {
  it.each`
    calendar              | temporalId
    ${"gregorian"}        | ${"iso8601"}
    ${"hebrew"}           | ${"hebrew"}
    ${"islamic-civil"}    | ${"islamic-civil"}
    ${"islamic-tabular"}  | ${"islamic-tbla"}
    ${"islamic-umalqura"} | ${"islamic-umalqura"}
    ${"japanese"}         | ${"japanese"}
    ${"buddhist"}         | ${"buddhist"}
    ${"taiwan"}           | ${"roc"}
    ${"persian"}          | ${"persian"}
    ${"indian"}           | ${"indian"}
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
        | "islamic-umalqura"
        | "japanese"
        | "buddhist"
        | "taiwan"
        | "persian"
        | "indian";
      temporalId: string;
    }) => {
      expect(temporalCalendarIds[calendar]).toBe(temporalId);
    },
  );

  it("exposes exactly the CalendarSystem identifiers, no more and no fewer", () => {
    expect(Object.keys(temporalCalendarIds).sort()).toEqual([
      "buddhist",
      "gregorian",
      "hebrew",
      "indian",
      "islamic-civil",
      "islamic-tabular",
      "islamic-umalqura",
      "japanese",
      "persian",
      "taiwan",
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
    ${"japanese"}
    ${"buddhist"}
    ${"taiwan"}
    ${"persian"}
    ${"indian"}
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
    ${"roc"}
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
