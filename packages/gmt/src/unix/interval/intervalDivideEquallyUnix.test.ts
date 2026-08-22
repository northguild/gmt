import { intervalDivideEquallyUnix } from "./intervalDivideEquallyUnix";

describe("intervalDivideEquallyUnix", () => {
  it.each`
    start | end          | n    | expected
    ${0}  | ${90000000}  | ${3} | ${[{ start: 0, end: 30000000 }, { start: 30000000, end: 60000000 }, { start: 60000000, end: 90000000 }]}
    ${0}  | ${90000000}  | ${1} | ${[{ start: 0, end: 90000000 }]}
    ${500} | ${500}      | ${2} | ${[{ start: 500, end: 500 }, { start: 500, end: 500 }]}
  `(
    "splits $start..$end into $n parts as $expected",
    ({ start, end, n, expected }) => {
      expect(intervalDivideEquallyUnix(start, end, n)).toEqual(expected);
    },
  );

  // 100000000 does not divide evenly by 3: boundaries are plain numeric arithmetic on the epoch
  // values, rounded. Verified: Math.round(100000000/3)=33333333, Math.round(200000000/3)=66666667.
  it("rounds boundaries to the nearest millisecond when the total does not divide evenly by n", () => {
    expect(intervalDivideEquallyUnix(0, 100000000, 3)).toEqual([
      { start: 0, end: 33333333 },
      { start: 33333333, end: 66666667 },
      { start: 66666667, end: 100000000 },
    ]);
  });

  it("accepts start/end as numeric strings", () => {
    expect(intervalDivideEquallyUnix("0", "90000000", 3)).toEqual([
      { start: 0, end: 30000000 },
      { start: 30000000, end: 60000000 },
      { start: 60000000, end: 90000000 },
    ]);
  });

  it.each`
    n
    ${0}
    ${-1}
    ${1.5}
    ${NaN}
    ${"3"}
    ${null}
    ${undefined}
    ${true}
  `("returns [] for invalid n = $n", ({ n }) => {
    expect(intervalDivideEquallyUnix(0, 90000000, n)).toEqual([]);
  });

  it.each`
    start       | end
    ${NaN}      | ${90000000}
    ${90000000} | ${0}
    ${1.5}      | ${90000000}
    ${null}     | ${90000000}
    ${{}}       | ${90000000}
    ${"not-a-number"} | ${90000000}
  `("returns [] for invalid $start, $end", ({ start, end }) => {
    expect(intervalDivideEquallyUnix(start, end, 3)).toEqual([]);
  });
});
