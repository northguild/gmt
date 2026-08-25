import { timeCycleFieldBounds } from "./timeCycleFieldBounds";

describe("timeCycleFieldBounds", () => {
  it.each`
    field            | expected
    ${"hour"}        | ${{ min: 0, max: 23 }}
    ${"minute"}      | ${{ min: 0, max: 59 }}
    ${"second"}      | ${{ min: 0, max: 59 }}
    ${"millisecond"} | ${{ min: 0, max: 999 }}
    ${"microsecond"} | ${{ min: 0, max: 999 }}
    ${"nanosecond"}  | ${{ min: 0, max: 999 }}
  `("returns $expected for $field", ({ field, expected }) => {
    expect(timeCycleFieldBounds(field)).toEqual(expected);
  });
});
