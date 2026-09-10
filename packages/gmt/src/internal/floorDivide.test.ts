import { floorDivide } from "./floorDivide";

describe("floorDivide", () => {
  it.each`
    value     | divisor  | expected
    ${0n}     | ${100n}  | ${0n}
    ${99n}    | ${100n}  | ${0n}
    ${100n}   | ${100n}  | ${1n}
    ${150n}   | ${100n}  | ${1n}
    ${-1n}    | ${100n}  | ${-1n}
    ${-99n}   | ${100n}  | ${-1n}
    ${-100n}  | ${100n}  | ${-1n}
    ${-101n}  | ${100n}  | ${-2n}
    ${-150n}  | ${100n}  | ${-2n}
    ${1500n}  | ${1000n} | ${1n}
    ${-1500n} | ${1000n} | ${-2n}
    ${7n}     | ${1n}    | ${7n}
    ${-7n}    | ${1n}    | ${-7n}
  `(
    "floors $value / $divisor toward negative infinity to $expected",
    ({ value, divisor, expected }) => {
      expect(floorDivide(value, divisor)).toBe(expected);
    },
  );

  it("differs from BigInt truncating division either side of zero", () => {
    expect(-150n / 100n).toBe(-1n);
    expect(floorDivide(-150n, 100n)).toBe(-2n);
  });

  it("keeps the unit grid uniform across zero", () => {
    // Every 100 consecutive values must map to one bucket, on both sides of zero.
    const buckets = [-201n, -200n, -101n, -100n, -1n, 0n, 99n, 100n].map(
      (value) => floorDivide(value, 100n),
    );

    expect(buckets).toEqual([-3n, -2n, -2n, -1n, -1n, 0n, 0n, 1n]);
  });
});
