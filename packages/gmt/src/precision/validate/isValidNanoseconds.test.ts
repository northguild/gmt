import { truncateNanoseconds } from "../calculate/truncateNanoseconds";
import { fromNanoseconds } from "../convert/fromNanoseconds";
import { isValidNanoseconds } from "./isValidNanoseconds";

describe("isValidNanoseconds", () => {
  it.each`
    value                       | expected | reason
    ${0n}                       | ${true}  | ${"the epoch"}
    ${1710072000123456789n}     | ${true}  | ${"a modern instant"}
    ${-1000000000n}             | ${true}  | ${"pre-epoch"}
    ${8640000000000000000000n}  | ${true}  | ${"the maximum"}
    ${-8640000000000000000000n} | ${true}  | ${"the minimum"}
    ${8640000000000000000001n}  | ${false} | ${"one past the maximum"}
    ${-8640000000000000000001n} | ${false} | ${"one before the minimum"}
    ${17280000000000000000000n} | ${false} | ${"a full-range span, which is a duration not an instant"}
    ${0}                        | ${false} | ${"number, not bigint"}
    ${1710072000123456789}      | ${false} | ${"number, not bigint"}
    ${"0"}                      | ${false} | ${"string"}
    ${null}                     | ${false} | ${"null"}
    ${undefined}                | ${false} | ${"undefined"}
    ${true}                     | ${false} | ${"boolean"}
    ${[]}                       | ${false} | ${"array"}
    ${{}}                       | ${false} | ${"object"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(isValidNanoseconds(value)).toBe(expected);
  });

  it("narrows to bigint", () => {
    const value: unknown = 1710072000123456789n;

    if (isValidNanoseconds(value)) {
      expect(fromNanoseconds(value)).toBe("2024-03-10T12:00:00.123456789Z");
    } else {
      expect.unreachable("in-range bigint should have narrowed");
    }
  });

  it("is the predicate that disambiguates truncateNanoseconds' 0n", () => {
    expect(isValidNanoseconds(0n)).toBe(true);
    expect(truncateNanoseconds(0n, "ms")).toBe(0n);

    expect(isValidNanoseconds(8640000000000000000001n)).toBe(false);
    expect(truncateNanoseconds(8640000000000000000001n, "ms")).toBe(0n);
  });

  it("accepts exactly what fromNanoseconds can render", () => {
    for (const value of [
      0n,
      -8640000000000000000000n,
      8640000000000000000000n,
    ]) {
      expect(isValidNanoseconds(value)).toBe(true);
      expect(fromNanoseconds(value)).not.toBe("");
    }
    for (const value of [8640000000000000000001n, -8640000000000000000001n]) {
      expect(isValidNanoseconds(value)).toBe(false);
      expect(fromNanoseconds(value)).toBe("");
    }
  });
});
