import { divisionBoundary } from "./divisionBoundary";

describe("divisionBoundary", () => {
  // Expected values are round-half-up of total · index / count, worked by hand: 1e9 / 3 =
  // 333,333,333.33 and 2e9 / 3 = 666,666,666.67; 1 / 2 = 0.5 rounds up; 365 d + 3 ns over 3 is
  // 10,512,000,000,000,000,001 exactly; index 0 and index count are the span's own ends.
  it.each`
    total                          | index | count | expected
    ${1_000_000_000n}              | ${1}  | ${3}  | ${333_333_333n}
    ${1_000_000_000n}              | ${2}  | ${3}  | ${666_666_667n}
    ${1n}                          | ${1}  | ${2}  | ${1n}
    ${31_536_000_000_000_000_003n} | ${1}  | ${3}  | ${10_512_000_000_000_000_001n}
    ${31_536_000_000_000_000_003n} | ${2}  | ${3}  | ${21_024_000_000_000_000_002n}
    ${17_280_000_000_000_000_000n} | ${0}  | ${7}  | ${0n}
    ${17_280_000_000_000_000_000n} | ${7}  | ${7}  | ${17_280_000_000_000_000_000n}
  `(
    "returns $expected for boundary $index of $count over a span of $total",
    ({ total, index, count, expected }) => {
      expect(divisionBoundary(total, index, count)).toBe(expected);
    },
  );
});
