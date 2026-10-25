import { subtractTime } from "./subtractTime";

describe("subtractTime", () => {
  it.each`
    value         | units                    | expected
    ${"12:00:00"} | ${{ hours: 2 }}          | ${"10:00:00"}
    ${"12:00:00"} | ${{ minutes: 45 }}       | ${"11:15:00"}
    ${"00:00:30"} | ${{ seconds: 45 }}       | ${"23:59:45"}
    ${"12:00:00"} | ${{ milliseconds: 250 }} | ${"11:59:59.75"}
    ${"12:00:00"} | ${{ microseconds: 500 }} | ${"11:59:59.9995"}
    ${"12:00:00"} | ${{ nanoseconds: 1000 }} | ${"11:59:59.999999"}
  `("returns $expected for $value - $units", ({ value, units, expected }) => {
    expect(subtractTime(value, units)).toBe(expected);
  });

  it.each`
    negativeAmount | expectedTime
    ${-1}          | ${"12:01:00"}
    ${-30}         | ${"12:30:00"}
    ${-90}         | ${"13:30:00"}
  `(
    "returns $expectedTime for 12:00:00 - $negativeAmount minutes",
    ({ negativeAmount, expectedTime }) => {
      expect(subtractTime("12:00:00", { minutes: negativeAmount })).toBe(
        expectedTime,
      );
    },
  );

  it.each`
    nonStringInput            | label
    ${"not-a-time"}           | ${"'not-a-time'"}
    ${"2024-02-30T14:30:00"}  | ${"'2024-02-30T14:30:00'"}
    ${"2024-02-30T14:30:00Z"} | ${"'2024-02-30T14:30:00Z'"}
    ${"2024-02-30"}           | ${"'2024-02-30'"}
    ${NaN}                    | ${"NaN"}
    ${null}                   | ${"null"}
    ${undefined}              | ${"undefined"}
    ${true}                   | ${"true"}
    ${false}                  | ${"false"}
    ${""}                     | ${"''"}
  `(
    "returns an empty string for non-string input $label",
    ({ nonStringInput }) => {
      expect(subtractTime(nonStringInput as never, { minutes: 30 })).toBe("");
    },
  );

  it.each`
    invalidUnit  | label
    ${"invalid"} | ${"'invalid'"}
    ${""}        | ${"''"}
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
  `(
    "returns an empty string for an invalid unit: $label",
    ({ invalidUnit }) => {
      expect(subtractTime("14:30:00", { [invalidUnit as never]: 1 })).toBe("");
    },
  );

  it.each`
    invalidAmount     | label
    ${"not-a-number"} | ${"'not-a-number'"}
    ${NaN}            | ${"NaN"}
    ${null}           | ${"null"}
    ${undefined}      | ${"undefined"}
    ${true}           | ${"true"}
    ${false}          | ${"false"}
    ${""}             | ${"''"}
  `(
    "returns an empty string for an invalid amount: $label",
    ({ invalidAmount }) => {
      expect(
        subtractTime("14:30:00", { minutes: invalidAmount } as never),
      ).toBe("");
    },
  );

  // The options argument (only `overflow`) was removed in 1.16.0: Temporal `PlainTime#subtract`
  // takes no options and always wraps around the clock. Passing one is a type error, and a
  // JavaScript caller's stray argument changes nothing.
  it("treats the removed options argument as a type error and ignores it at runtime", () => {
    expect(
      // @ts-expect-error -- the `overflow` options argument was removed in 1.16.0
      subtractTime("01:00:00", { hours: 2 }, { overflow: "reject" }),
    ).toBe("23:00:00");
  });
});
