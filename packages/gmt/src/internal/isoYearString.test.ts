import { Temporal } from "@js-temporal/polyfill";
import { isoYearString } from "./isoYearString";

describe("isoYearString", () => {
  // TC39 Temporal `PadISOYear ( y )`, §3.5.10: four digits from 0 to 9999, otherwise a sign and
  // six digits.
  // -271821 and 275760 are the years of Temporal's first and last instants.
  it.each`
    year       | expected
    ${-271821} | ${"-271821"}
    ${-10000}  | ${"-010000"}
    ${-5}      | ${"-000005"}
    ${-1}      | ${"-000001"}
    ${0}       | ${"0000"}
    ${5}       | ${"0005"}
    ${99}      | ${"0099"}
    ${2024}    | ${"2024"}
    ${9999}    | ${"9999"}
    ${10000}   | ${"+010000"}
    ${275760}  | ${"+275760"}
  `("writes year $year as $expected", ({ year, expected }) => {
    expect(isoYearString(year)).toBe(expected);
  });

  it.each`
    year
    ${-271821}
    ${-5}
    ${0}
    ${5}
    ${9999}
    ${10000}
    ${275760}
  `("writes year $year as Temporal.PlainDate writes it", ({ year }) => {
    expect(
      Temporal.PlainDate.from({ year, month: 6, day: 15 }).toString(),
    ).toBe(`${isoYearString(year)}-06-15`);
  });
});
