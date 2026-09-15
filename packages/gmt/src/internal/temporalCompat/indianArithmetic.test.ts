import { fixedFromIso, isIsoLeapYear, mod } from "./fixedDay";
import { indianFieldsFromIso } from "./indianArithmetic";

// Called directly so the arithmetic stays covered whether or not the runtime still needs it
// (CORE-6 spec §4.5). Expected fields: Chromium 152 native reads and test262 extreme-dates.js,
// or a one-line derivation from the rule where noted.
describe("indianFieldsFromIso", () => {
  it.each`
    iso                 | year       | month | day   | source
    ${[-271821, 4, 19]} | ${-271899} | ${1}  | ${29} | ${"test262 min"}
    ${[-271821, 4, 20]} | ${-271899} | ${1}  | ${30} | ${"Chromium, min + 1 d: Chaitra has 30 days in a common year"}
    ${[-271821, 4, 21]} | ${-271899} | ${2}  | ${1}  | ${"Chromium, min + 2 d"}
    ${[-500, 6, 15]}    | ${-578}    | ${3}  | ${25} | ${"Chromium"}
    ${[1, 1, 1]}        | ${-78}     | ${10} | ${11} | ${"rule: Chaitra 1 of leap year 0 is 0000-03-21; day 286 is Pausha 11"}
    ${[2024, 3, 20]}    | ${1945}    | ${12} | ${30} | ${"rule: day before Chaitra 1 (March 21, leap 2024)"}
    ${[2024, 3, 21]}    | ${1946}    | ${1}  | ${1}  | ${"rule: Chaitra 1 is March 21 in a Gregorian leap year"}
    ${[2024, 10, 3]}    | ${1946}    | ${7}  | ${11} | ${"rule: day 196 = 6 x 31 + 10"}
    ${[275760, 9, 13]}  | ${275682}  | ${6}  | ${22} | ${"test262 max"}
  `(
    "reads ISO $iso as Saka $year-$month-$day ($source)",
    ({ iso, year, month, day }) => {
      const [isoYear, isoMonth, isoDay] = iso as [number, number, number];
      expect(indianFieldsFromIso(isoYear, isoMonth, isoDay)).toEqual({
        year,
        month,
        monthCode: `M${String(month).padStart(2, "0")}`,
        day,
      });
    },
  );
});

describe("fixedFromIso", () => {
  // R.D. day numbers: 0001-01-01 is day 1 and the Unix epoch is day 719163 (Dershowitz-Reingold).
  // The 2024 and minimum rows come from the independent oracle (Hinnant's days_from_civil):
  // 2024-10-03 is 739162, so 2024-03-01, 216 days earlier, is 738946.
  it.each`
    iso                 | expected
    ${[1, 1, 1]}        | ${1}
    ${[1970, 1, 1]}     | ${719_163}
    ${[0, 12, 31]}      | ${0}
    ${[2024, 3, 1]}     | ${738_946}
    ${[2024, 10, 3]}    | ${739_162}
    ${[-271821, 4, 19]} | ${-99_280_838}
  `("returns $expected for ISO $iso", ({ iso, expected }) => {
    const [year, month, day] = iso as [number, number, number];
    expect(fixedFromIso(year, month, day)).toBe(expected);
  });
});

describe("isIsoLeapYear / mod", () => {
  it.each`
    year      | expected
    ${2024}   | ${true}
    ${1900}   | ${false}
    ${2000}   | ${true}
    ${0}      | ${true}
    ${-500}   | ${false}
    ${-271820} | ${true}
  `("isIsoLeapYear($year) is $expected", ({ year, expected }) => {
    expect(isIsoLeapYear(year)).toBe(expected);
  });

  it("keeps the divisor's sign for a negative dividend", () => {
    expect(mod(-1, 19)).toBe(18);
  });
});
