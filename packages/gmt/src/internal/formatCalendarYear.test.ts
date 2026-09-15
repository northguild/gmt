import { formatCalendarYear } from "./formatCalendarYear";

describe("formatCalendarYear", () => {
  // Temporal PadISOYear for negative years (sign + 6 digits); GMT's unsigned 4-6 digits otherwise.
  it.each`
    year       | expected
    ${0}       | ${"0000"}
    ${6}       | ${"0006"}
    ${5785}    | ${"5785"}
    ${279517}  | ${"279517"}
    ${-1}      | ${"-000001"}
    ${-911}    | ${"-000911"}
    ${-268058} | ${"-268058"}
    ${-0}      | ${"0000"}
  `("formats year $year as $expected", ({ year, expected }) => {
    expect(formatCalendarYear(year)).toBe(expected);
  });
});
