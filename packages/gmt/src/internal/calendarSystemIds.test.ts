import {
  calendarSystems,
  canonicalCalendarSystem,
  computationCalendarId,
  isCalendarSystem,
} from "./calendarSystemIds";

// Canonical ids: CLDR common/bcp47/calendar.xml types, restricted to the rows of the Intl Era and
// Month Code proposal's table-calendar-types (plus "iso8601") that GMT supports. GMT does not
// support "chinese" or "dangi"; "islamic" and "islamic-rgsa" are not in the proposal's table.
describe("calendarSystems", () => {
  it("lists exactly the canonical ids GMT supports", () => {
    expect([...calendarSystems].sort()).toEqual([
      "buddhist",
      "coptic",
      "ethioaa",
      "ethiopic",
      "gregory",
      "hebrew",
      "indian",
      "islamic-civil",
      "islamic-tbla",
      "islamic-umalqura",
      "iso8601",
      "japanese",
      "persian",
      "roc",
    ]);
  });
});

describe("isCalendarSystem", () => {
  it.each(calendarSystems.map((value) => ({ value })))(
    "returns true for the canonical id $value",
    ({ value }) => {
      expect(isCalendarSystem(value)).toBe(true);
    },
  );

  it.each`
    value                    | reason
    ${"gregorian"}           | ${"CLDR alias, not a Temporal calendar id"}
    ${"taiwan"}              | ${"GMT's pre-1.16.0 name for roc"}
    ${"islamic-tabular"}     | ${"GMT's pre-1.16.0 name for islamic-tbla"}
    ${"ethiopic-amete-alem"} | ${"alias of ethioaa, not canonical"}
    ${"islamicc"}            | ${"deprecated alias of islamic-civil, not canonical"}
    ${"Hebrew"}              | ${"not ASCII-lowercase"}
    ${"islamic"}             | ${"not in the proposal's calendar table"}
    ${"chinese"}             | ${"not supported by GMT"}
    ${"martian"}             | ${"unknown"}
    ${""}                    | ${"empty"}
  `("returns false for $value ($reason)", ({ value }) => {
    expect(isCalendarSystem(value)).toBe(false);
  });
});

describe("canonicalCalendarSystem", () => {
  // Temporal CanonicalizeCalendar: ASCII-lowercase membership in AvailableCalendars, then
  // CanonicalizeUValue("ca", id), which maps the CLDR aliases to their preferred type.
  it.each`
    value                    | expected
    ${"hebrew"}              | ${"hebrew"}
    ${"HEBREW"}              | ${"hebrew"}
    ${"ethiopic-amete-alem"} | ${"ethioaa"}
    ${"islamicc"}            | ${"islamic-civil"}
    ${"ISO8601"}             | ${"iso8601"}
    ${"gregory"}             | ${"gregory"}
    ${"roc"}                 | ${"roc"}
  `("canonicalizes $value to $expected", ({ value, expected }) => {
    expect(canonicalCalendarSystem(value)).toBe(expected);
  });

  it.each`
    value                | reason
    ${"gregorian"}       | ${"Temporal rejects the CLDR alias"}
    ${"taiwan"}          | ${"not a calendar id"}
    ${"islamic-tabular"} | ${"not a calendar id"}
    ${"islamic"}         | ${"not in the proposal's calendar table"}
    ${"islamic-rgsa"}    | ${"not in the proposal's calendar table"}
    ${"chinese"}         | ${"not supported by GMT"}
    ${"dangi"}           | ${"not supported by GMT"}
    ${"martian"}         | ${"unknown"}
    ${""}                | ${"empty"}
  `("returns null for $value ($reason)", ({ value }) => {
    expect(canonicalCalendarSystem(value)).toBeNull();
  });
});

describe("computationCalendarId", () => {
  // The Ethiopic family computes through "ethioaa" (polyfill 0.5.1 cannot read ethiopic or coptic
  // fields under ICU 78); every other calendar computes in itself.
  it.each`
    calendar      | expected
    ${"ethiopic"} | ${"ethioaa"}
    ${"coptic"}   | ${"ethioaa"}
    ${"ethioaa"}  | ${"ethioaa"}
    ${"hebrew"}   | ${"hebrew"}
    ${"iso8601"}  | ${"iso8601"}
    ${"gregory"}  | ${"gregory"}
    ${"roc"}      | ${"roc"}
  `("computes $calendar in $expected", ({ calendar, expected }) => {
    expect(computationCalendarId(calendar)).toBe(expected);
  });
});
