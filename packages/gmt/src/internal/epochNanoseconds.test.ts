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
    value                       | expected | type
    ${0n}                       | ${true}  | ${"bigint"}
    ${1710072000123456789n}     | ${true}  | ${"bigint"}
    ${-1000000000n}             | ${true}  | ${"bigint"}
    ${8640000000000000000000n}  | ${true}  | ${"bigint"}
    ${-8640000000000000000000n} | ${true}  | ${"bigint"}
    ${8640000000000000000001n}  | ${false} | ${"bigint"}
    ${-8640000000000000000001n} | ${false} | ${"bigint"}
    ${0}                        | ${false} | ${"number"}
    ${"0"}                      | ${false} | ${"string"}
    ${null}                     | ${false} | ${"null"}
    ${undefined}                | ${false} | ${"undefined"}
    ${true}                     | ${false} | ${"boolean"}
    ${[]}                       | ${false} | ${"array"}
    ${{}}                       | ${false} | ${"object"}
  `("returns $expected for $value ($type)", ({ value, expected }) => {
    expect(isValidEpochNanoseconds(value)).toBe(expected);
  });
});
