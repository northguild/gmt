import { cycleFieldValue } from "./cycleFieldValue";

describe("cycleFieldValue", () => {
  it.each`
    current | amount | bounds                 | expected
    ${5}    | ${1}   | ${{ min: 1, max: 12 }} | ${6}
    ${5}    | ${-1}  | ${{ min: 1, max: 12 }} | ${4}
    ${12}   | ${1}   | ${{ min: 1, max: 12 }} | ${1}
    ${1}    | ${-1}  | ${{ min: 1, max: 12 }} | ${12}
    ${31}   | ${1}   | ${{ min: 1, max: 31 }} | ${1}
    ${1}    | ${-1}  | ${{ min: 1, max: 31 }} | ${31}
    ${29}   | ${1}   | ${{ min: 1, max: 29 }} | ${1}
    ${23}   | ${1}   | ${{ min: 0, max: 23 }} | ${0}
    ${0}    | ${-1}  | ${{ min: 0, max: 23 }} | ${23}
    ${59}   | ${1}   | ${{ min: 0, max: 59 }} | ${0}
    ${0}    | ${-1}  | ${{ min: 0, max: 59 }} | ${59}
  `(
    "wraps $current by $amount within [$bounds.min, $bounds.max] to $expected",
    ({ current, amount, bounds, expected }) => {
      expect(cycleFieldValue(current, amount, bounds, false)).toBe(expected);
    },
  );

  it.each`
    current | amount | bounds                 | expected | label
    ${1}    | ${13}  | ${{ min: 1, max: 12 }} | ${2}     | ${"one full range past the range"}
    ${3}    | ${-25} | ${{ min: 1, max: 12 }} | ${2}     | ${"two full ranges past the range, negative"}
    ${1}    | ${100} | ${{ min: 1, max: 31 }} | ${8}     | ${"many ranges past the range"}
  `(
    "wraps amounts larger than the range ($label): $current by $amount -> $expected",
    ({ current, amount, bounds, expected }) => {
      expect(cycleFieldValue(current, amount, bounds, false)).toBe(expected);
    },
  );

  it.each`
    current | bounds                 | expected
    ${5}    | ${{ min: 1, max: 12 }} | ${5}
    ${2022} | ${null}                | ${2022}
  `(
    "returns $current unchanged when amount is 0",
    ({ current, bounds, expected }) => {
      expect(cycleFieldValue(current, 0, bounds, false)).toBe(expected);
      expect(cycleFieldValue(current, 0, bounds, true)).toBe(expected);
    },
  );

  it.each`
    current | amount | bounds  | expected
    ${2022} | ${5}   | ${null} | ${2027}
    ${2022} | ${-5}  | ${null} | ${2017}
  `(
    "adds plainly when bounds is null (unbounded year): $current by $amount -> $expected",
    ({ current, amount, bounds, expected }) => {
      expect(cycleFieldValue(current, amount, bounds, false)).toBe(expected);
    },
  );

  it.each`
    current | amount | bounds                 | round    | expected | label
    ${22}   | ${15}  | ${{ min: 0, max: 59 }} | ${true}  | ${30}    | ${"rounds up to the next multiple of 15"}
    ${22}   | ${-15} | ${{ min: 0, max: 59 }} | ${true}  | ${15}    | ${"rounds down to the previous multiple of 15"}
    ${22}   | ${15}  | ${{ min: 0, max: 59 }} | ${false} | ${37}    | ${"adds plainly without round"}
    ${22}   | ${-15} | ${{ min: 0, max: 59 }} | ${false} | ${7}     | ${"subtracts plainly without round"}
    ${2022} | ${5}   | ${null}                | ${true}  | ${2025}  | ${"rounds an unbounded field up"}
    ${2022} | ${-5}  | ${null}                | ${true}  | ${2020}  | ${"rounds an unbounded field down"}
  `(
    "round:$round for $current by $amount -> $expected ($label)",
    ({ current, amount, bounds, round, expected }) => {
      expect(cycleFieldValue(current, amount, bounds, round)).toBe(expected);
    },
  );

  it("wraps the rounded value when the stepped value exceeds max", () => {
    // 58 + sign(15) = 59; ceil(59/15)*15 = 60 > max(59), so it wraps to min(0).
    expect(cycleFieldValue(58, 15, { min: 0, max: 59 }, true)).toBe(0);
  });

  it("wraps the rounded value when the stepped value goes below min", () => {
    // 0 + sign(-15) = -1; -1 < min(0) so stepped becomes max(59); floor(59/15)*15 = 45.
    expect(cycleFieldValue(0, -15, { min: 0, max: 59 }, true)).toBe(45);
  });
});
