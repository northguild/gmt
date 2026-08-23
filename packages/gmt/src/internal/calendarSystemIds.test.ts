import { isCalendarSystem, temporalCalendarIds } from "./calendarSystemIds";

describe("temporalCalendarIds", () => {
  it.each`
    calendar                 | temporalId
    ${"gregorian"}           | ${"iso8601"}
    ${"hebrew"}              | ${"hebrew"}
    ${"islamic-civil"}       | ${"islamic-civil"}
    ${"islamic-tabular"}     | ${"islamic-tbla"}
    ${"islamic-umalqura"}    | ${"islamic-umalqura"}
    ${"japanese"}            | ${"japanese"}
    ${"buddhist"}            | ${"buddhist"}
    ${"taiwan"}              | ${"roc"}
    ${"persian"}             | ${"persian"}
    ${"indian"}              | ${"indian"}
    ${"ethiopic"}            | ${"ethiopic"}
    ${"ethiopic-amete-alem"} | ${"ethioaa"}
    ${"coptic"}              | ${"coptic"}
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
        | "indian"
        | "ethiopic"
        | "ethiopic-amete-alem"
        | "coptic";
      temporalId: string;
    }) => {
      expect(temporalCalendarIds[calendar]).toBe(temporalId);
    },
  );

  it("exposes exactly the CalendarSystem identifiers, no more and no fewer", () => {
    expect(Object.keys(temporalCalendarIds).sort()).toEqual([
      "buddhist",
      "coptic",
      "ethiopic",
      "ethiopic-amete-alem",
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
    ${"ethiopic"}
    ${"ethiopic-amete-alem"}
    ${"coptic"}
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
    ${"ethioaa"}
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
