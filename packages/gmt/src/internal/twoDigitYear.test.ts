import { twoDigitYear } from "./twoDigitYear";

describe("twoDigitYear", () => {
  // The one year in [windowStart, windowStart + 99] whose last two digits are yy. Derived by
  // hand: the window names a hundred consecutive years, so exactly one of them ends in yy.
  it.each`
    yy    | windowStart | expected | description
    ${0}  | ${2000}     | ${2000}  | ${"first year of a century-aligned window"}
    ${99} | ${2000}     | ${2099}  | ${"last year of a century-aligned window"}
    ${24} | ${2000}     | ${2024}  | ${"an ordinary year inside the window"}
    ${69} | ${1969}     | ${1969}  | ${"first year of the POSIX %y window"}
    ${68} | ${1969}     | ${2068}  | ${"last year of the POSIX %y window"}
    ${0}  | ${1969}     | ${2000}  | ${"yy 00 in the POSIX window"}
    ${99} | ${1969}     | ${1999}  | ${"yy 99 in the POSIX window"}
    ${50} | ${1950}     | ${1950}  | ${"first year of a window that straddles a century"}
    ${49} | ${1950}     | ${2049}  | ${"last year of a window that straddles a century"}
    ${99} | ${1950}     | ${1999}  | ${"yy 99 falls in the first century of a straddling window"}
    ${0}  | ${1950}     | ${2000}  | ${"yy 00 falls in the second century of a straddling window"}
    ${1}  | ${0}        | ${1}     | ${"window starting at year 0"}
    ${0}  | ${1}        | ${100}   | ${"yy 00 in a window starting at year 1"}
    ${0}  | ${9900}     | ${9900}  | ${"first year of the highest four-digit window"}
    ${99} | ${9900}     | ${9999}  | ${"last year of the highest four-digit window"}
  `(
    "resolves $yy in the window from $windowStart to $expected ($description)",
    ({ yy, windowStart, expected }) => {
      expect(twoDigitYear(yy, windowStart)).toBe(expected);
    },
  );

  it.each`
    windowStart
    ${1969}
    ${2000}
    ${1950}
    ${1}
  `(
    "returns a year inside [$windowStart, $windowStart + 99] ending in yy for every yy",
    ({ windowStart }) => {
      for (let yy = 0; yy < 100; yy++) {
        const year = twoDigitYear(yy, windowStart);
        expect(year).toBeGreaterThanOrEqual(windowStart);
        expect(year).toBeLessThanOrEqual(windowStart + 99);
        expect(year % 100).toBe(yy);
      }
    },
  );
});
