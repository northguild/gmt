import { fixedFromIso } from "./fixedDay";
import {
  hebrewFieldsFromFixed,
  hebrewNewYear,
  isHebrewLeapYear,
} from "./hebrewArithmetic";

// Called directly so the arithmetic stays covered whether or not the runtime still needs it
// (CORE-6 spec §4.5). Expected fields: Chromium 152 native reads (q2-xscan-chromium152.json,
// q2-spec-probe) and test262 extreme-dates.js — never the polyfill or Node's ICU4C.
describe("hebrewFieldsFromFixed", () => {
  it.each`
    iso                         | year       | month | monthCode | day   | source
    ${[-271821, 4, 19]}         | ${-268058} | ${11} | ${"M11"}  | ${4}  | ${"test262 min"}
    ${[-271821, 4, 20]}         | ${-268058} | ${11} | ${"M11"}  | ${5}  | ${"Chromium, min + 1 d"}
    ${[-271821, 11, 5]}         | ${-268057} | ${5}  | ${"M05"}  | ${28} | ${"Chromium (Node ICU4C: 27)"}
    ${[-100000, 1, 1]}          | ${-96239}  | ${6}  | ${"M06"}  | ${23} | ${"Chromium, common negative year"}
    ${[-3761, 9, 1]}            | ${0}       | ${1}  | ${"M01"}  | ${13} | ${"Chromium, year 0"}
    ${[2024, 10, 3]}            | ${5785}    | ${1}  | ${"M01"}  | ${1}  | ${"Chromium, modern control"}
    ${[275760, 5, 16]}          | ${279517}  | ${6}  | ${"M05L"} | ${9}  | ${"Chromium, leap month"}
    ${[275760, 9, 13]}          | ${279517}  | ${10} | ${"M09"}  | ${11} | ${"test262 max"}
  `(
    "reads ISO $iso as Hebrew $year-$monthCode-$day ($source)",
    ({ iso, year, month, monthCode, day }) => {
      const [isoYear, isoMonth, isoDay] = iso as [number, number, number];
      expect(
        hebrewFieldsFromFixed(fixedFromIso(isoYear, isoMonth, isoDay)),
      ).toEqual({ year, month, monthCode, day });
    },
  );
});

describe("hebrewNewYear", () => {
  // Tishri 1, AM 1 is 7 October 3761 BCE (Julian) = -003760-09-07 proleptic Gregorian.
  it("puts Tishri 1 of year 1 on ISO -003760-09-07", () => {
    expect(hebrewNewYear(1)).toBe(fixedFromIso(-3760, 9, 7));
  });
});

describe("isHebrewLeapYear", () => {
  // (7y + 1) mod 19 < 7, with a floored modulo.
  it.each`
    year      | expected | derivation
    ${5784}   | ${true}  | ${"(7*5784+1) mod 19 = 0"}
    ${5783}   | ${false} | ${"(7*5783+1) mod 19 = 12"}
    ${-6240}  | ${true}  | ${"(7*-6240+1) mod 19 = 2"}
    ${-96239} | ${false} | ${"(7*-96239+1) mod 19 = 11"}
  `(
    "returns $expected for year $year ($derivation)",
    ({ year, expected }) => {
      expect(isHebrewLeapYear(year)).toBe(expected);
    },
  );
});
