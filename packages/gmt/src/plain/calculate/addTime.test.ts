import { addTime } from "./addTime";

describe("addTime", () => {
  it.each`
    value         | units                    | expected
    ${"12:00:00"} | ${{ hours: 1 }}          | ${"13:00:00"}
    ${"12:00:00"} | ${{ minutes: 30 }}       | ${"12:30:00"}
    ${"23:59:30"} | ${{ seconds: 45 }}       | ${"00:00:15"}
    ${"12:00:00"} | ${{ milliseconds: 250 }} | ${"12:00:00.25"}
    ${"12:00:00"} | ${{ microseconds: 500 }} | ${"12:00:00.0005"}
    ${"12:00:00"} | ${{ nanoseconds: 1000 }} | ${"12:00:00.000001"}
  `("returns $expected for $value + $units", ({ value, units, expected }) => {
    expect(addTime(value, units)).toBe(expected);
  });

  it.each`
    negativeUnits       | expectedTime
    ${{ minutes: -1 }}  | ${"11:59:00"}
    ${{ minutes: -30 }} | ${"11:30:00"}
    ${{ minutes: -90 }} | ${"10:30:00"}
  `(
    "returns $expectedTime for 12:00:00 + $negativeUnits",
    ({
      negativeUnits,
      expectedTime,
    }: {
      negativeUnits: Partial<
        Record<
          | "hours"
          | "minutes"
          | "seconds"
          | "milliseconds"
          | "microseconds"
          | "nanoseconds",
          number
        >
      >;
      expectedTime: string;
    }) => {
      expect(addTime("12:00:00", negativeUnits)).toBe(expectedTime);
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
      expect(addTime(nonStringInput, { minutes: 30 })).toBe("");
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
      expect(addTime("12:00:00", { minutes: invalidAmount } as never)).toBe("");
    },
  );

  // The options argument (only `overflow`) was removed in 1.16.0: Temporal `PlainTime#add` takes no
  // options and always wraps around the clock (native: 23:30 + 2h = 01:30 for every overflow value).
  // Passing one is a type error, and a JavaScript caller's stray argument changes nothing.
  it("treats the removed options argument as a type error and ignores it at runtime", () => {
    expect(
      // @ts-expect-error -- the `overflow` options argument was removed in 1.16.0
      addTime("23:00:00", { hours: 2 }, { overflow: "reject" }),
    ).toBe("01:00:00");
  });
});
