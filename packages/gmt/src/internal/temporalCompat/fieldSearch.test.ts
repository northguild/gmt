import { floorDateForFields, isoForFields } from "./fieldSearch";

// The search algorithm is called directly so it stays covered whether or not the installed
// polyfill still needs it (CORE-6 spec §4.5). Expected ISO dates are Chromium 152 native reads
// (q2-xscan-chromium152.json edge rows) and test262 extreme-dates.js.
describe("isoForFields", () => {
  it.each`
    calendarId            | year       | month | day   | expectedIso        | source
    ${"hebrew"}           | ${279517}  | ${10} | ${11} | ${"+275760-09-13"} | ${"test262 max"}
    ${"hebrew"}           | ${279517}  | ${10} | ${6}  | ${"+275760-09-08"} | ${"Chromium, max - 5 d"}
    ${"hebrew"}           | ${279517}  | ${6}  | ${9}  | ${"+275760-05-16"} | ${"Chromium, M05L"}
    ${"buddhist"}         | ${276303}  | ${8}  | ${13} | ${"+275760-08-13"} | ${"Chromium, max - 31 d"}
    ${"islamic-civil"}    | ${283583}  | ${5}  | ${23} | ${"+275760-09-13"} | ${"test262 max"}
    ${"islamic-civil"}    | ${-280804} | ${3}  | ${21} | ${"-271821-04-19"} | ${"test262 min"}
    ${"islamic-civil"}    | ${-280804} | ${12} | ${30} | ${"-271820-01-19"} | ${"Chromium, min + 275 d"}
    ${"islamic-tbla"}     | ${-280804} | ${12} | ${30} | ${"-271820-01-18"} | ${"Chromium, min + 274 d"}
    ${"islamic-umalqura"} | ${283583}  | ${5}  | ${15} | ${"+275760-09-05"} | ${"Chromium, max - 8 d"}
    ${"persian"}          | ${-272442} | ${12} | ${29} | ${"-271820-04-09"} | ${"Chromium, min + 356 d"}
    ${"persian"}          | ${-272442} | ${1}  | ${9}  | ${"-271821-04-19"} | ${"test262 min"}
    ${"ethioaa"}          | ${281247}  | ${5}  | ${22} | ${"+275760-09-13"} | ${"test262 max"}
  `(
    "finds $calendarId $year-$month-$day at ISO $expectedIso ($source)",
    ({ calendarId, year, month, day, expectedIso }) => {
      expect(isoForFields(calendarId, { year, month, day })?.toString()).toBe(
        expectedIso,
      );
    },
  );

  it.each`
    calendarId         | year       | month | day   | reason
    ${"hebrew"}        | ${279517}  | ${10} | ${12} | ${"one day past the maximum"}
    ${"islamic-civil"} | ${-280804} | ${3}  | ${20} | ${"one day before the minimum"}
    ${"hebrew"}        | ${279517}  | ${10} | ${31} | ${"day 31 does not exist"}
    ${"islamic-civil"} | ${283583}  | ${13} | ${1}  | ${"month 13 does not exist"}
  `(
    "returns null for $calendarId $year-$month-$day ($reason)",
    ({ calendarId, year, month, day }) => {
      expect(isoForFields(calendarId, { year, month, day })).toBeNull();
    },
  );
});

describe("floorDateForFields", () => {
  it.each`
    calendarId         | year       | month | day   | expectedIso        | reason
    ${"hebrew"}        | ${279517}  | ${10} | ${99} | ${"+275760-09-13"} | ${"past the maximum clamps to the last representable day"}
    ${"islamic-civil"} | ${-280804} | ${12} | ${99} | ${"-271820-01-19"} | ${"day 99 floors to the last day of month 12 (30)"}
  `(
    "floors $calendarId $year-$month-$day to $expectedIso ($reason)",
    ({ calendarId, year, month, day, expectedIso }) => {
      expect(
        floorDateForFields(calendarId, { year, month, day })?.toString(),
      ).toBe(expectedIso);
    },
  );

  it("returns null when the target precedes the first representable date", () => {
    expect(
      floorDateForFields("islamic-civil", { year: -280804, month: 1, day: 1 }),
    ).toBeNull();
  });
});
