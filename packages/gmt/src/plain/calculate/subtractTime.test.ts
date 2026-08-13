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
    "returns $expectedTime for $value - $negativeAmount minutes",
    ({ negativeAmount, expectedTime }) => {
      expect(subtractTime("12:00:00", { minutes: negativeAmount })).toBe(
        expectedTime,
      );
    },
  );

  it.each`
    nonStringInput
    ${"not-a-time"}
    ${"2024-02-30T14:30:00"}
    ${"2024-02-30T14:30:00Z"}
    ${"2024-02-30"}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
    ${""}
  `(
    "returns an empty string for non-string input $nonStringInput",
    ({ nonStringInput }) => {
      expect(subtractTime(nonStringInput as never, { minutes: 30 })).toBe("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty string for an invalid unit: $invalidUnit",
    ({ invalidUnit }) => {
      expect(subtractTime("14:30:00", { [invalidUnit as never]: 1 })).toBe("");
    },
  );

  it.each`
    invalidAmount
    ${"not-a-number"}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
    ${""}
  `(
    "returns an empty string for an invalid amount: $invalidAmount",
    ({ invalidAmount }) => {
      expect(
        subtractTime("14:30:00", { minutes: invalidAmount } as never),
      ).toBe("");
    },
  );

  it("produces the same wrapped result regardless of overflow (PlainTime always wraps around the clock)", () => {
    expect(
      subtractTime("01:00:00", { hours: 2 }, { overflow: "constrain" }),
    ).toBe("23:00:00");
    expect(subtractTime("01:00:00", { hours: 2 }, { overflow: "reject" })).toBe(
      "23:00:00",
    );
    expect(
      subtractTime("01:00:00", { hours: 24 }, { overflow: "constrain" }),
    ).toBe("01:00:00");
    expect(
      subtractTime("01:00:00", { hours: 24 }, { overflow: "reject" }),
    ).toBe("01:00:00");
  });
});
