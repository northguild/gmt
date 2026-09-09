import {
  isValidEpochNanoseconds,
  MAX_EPOCH_NANOSECONDS,
  MIN_EPOCH_NANOSECONDS,
} from "./epochNanoseconds";

describe("epochNanoseconds", () => {
  it("bounds match the Temporal.Instant representable range", () => {
    expect(MAX_EPOCH_NANOSECONDS).toBe(8640000000000000000000n);
    expect(MIN_EPOCH_NANOSECONDS).toBe(-8640000000000000000000n);
  });

  it.each`
    value                       | expected
    ${0n}                       | ${true}
    ${1710072000123456789n}     | ${true}
    ${-1000000000n}             | ${true}
    ${8640000000000000000000n}  | ${true}
    ${-8640000000000000000000n} | ${true}
    ${8640000000000000000001n}  | ${false}
    ${-8640000000000000000001n} | ${false}
    ${0}                        | ${false}
    ${"0"}                      | ${false}
    ${null}                     | ${false}
    ${undefined}                | ${false}
    ${true}                     | ${false}
    ${[]}                       | ${false}
    ${{}}                       | ${false}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(isValidEpochNanoseconds(value)).toBe(expected);
  });
});
