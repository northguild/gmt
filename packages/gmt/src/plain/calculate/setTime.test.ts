import { setTime } from "./setTime";

describe("setTime", () => {
  it.each`
    value         | fields                     | expected
    ${"12:00:00"} | ${{ hour: 9 }}             | ${"09:00:00"}
    ${"12:00:00"} | ${{ minute: 45 }}          | ${"12:45:00"}
    ${"12:00:00"} | ${{ second: 30 }}          | ${"12:00:30"}
    ${"12:00:00"} | ${{ millisecond: 250 }}    | ${"12:00:00.25"}
    ${"12:00:00"} | ${{ microsecond: 500 }}    | ${"12:00:00.0005"}
    ${"12:00:00"} | ${{ nanosecond: 999 }}     | ${"12:00:00.000000999"}
    ${"12:00:00"} | ${{ hour: 9, minute: 45 }} | ${"09:45:00"}
    ${"12:00:00"} | ${{}}                      | ${"12:00:00"}
  `(
    "returns $expected for $value with fields $fields",
    ({ value, fields, expected }) => {
      expect(setTime(value, fields)).toBe(expected);
    },
  );

  it.each`
    invalidTime
    ${"24:00:00"}
    ${"not-a-time"}
    ${"23:60:00"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"2024-03-10"}
  `(
    "returns an empty string for an invalid time $invalidTime",
    ({ invalidTime }) => {
      expect(setTime(invalidTime, { hour: 9 })).toBe("");
    },
  );

  // overflow has a real effect here, unlike addTime's arithmetic wraparound
  it.each`
    value         | fields            | overflow       | expected
    ${"12:00:00"} | ${{ hour: 25 }}   | ${undefined}   | ${"23:00:00"}
    ${"12:00:00"} | ${{ hour: 25 }}   | ${"constrain"} | ${"23:00:00"}
    ${"12:00:00"} | ${{ hour: 25 }}   | ${"reject"}    | ${""}
    ${"12:00:00"} | ${{ minute: 90 }} | ${undefined}   | ${"12:59:00"}
    ${"12:00:00"} | ${{ minute: 90 }} | ${"reject"}    | ${""}
  `(
    "returns $expected for $value with fields $fields and overflow $overflow",
    ({ value, fields, overflow, expected }) => {
      expect(
        setTime(
          value,
          fields,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );

  it("returns an empty string when the with() call throws for a malformed fields object", () => {
    expect(setTime("12:00:00", { hour: Number.NaN })).toBe("");
  });
});
