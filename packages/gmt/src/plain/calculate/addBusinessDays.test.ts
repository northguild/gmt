import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { addBusinessDays } from "./addBusinessDays";

const testDay = "2024-02-29"; // This date is a Monday

describe("addBusinessDays", () => {
  it.each`
    value      | amount | expected
    ${testDay} | ${1}   | ${"2024-03-01"}
    ${testDay} | ${2}   | ${"2024-03-04"}
    ${testDay} | ${5}   | ${"2024-03-07"}
    ${testDay} | ${20}  | ${"2024-03-28"}
    ${testDay} | ${50}  | ${"2024-05-09"}
  `(
    "returns $expected for $value + $amount business days",
    ({ value, amount, expected }) => {
      expect(addBusinessDays(value, amount)).toBe(expected);
    },
  );

  it.each`
    value      | amount | expected
    ${testDay} | ${-1}  | ${"2024-02-28"}
    ${testDay} | ${-2}  | ${"2024-02-27"}
    ${testDay} | ${-5}  | ${"2024-02-22"}
    ${testDay} | ${-10} | ${"2024-02-15"}
  `(
    "returns $expected when adding a negative amount: $amount",
    ({ value, amount, expected }) => {
      expect(addBusinessDays(value, amount)).toBe(expected);
    },
  );

  it.each`
    value      | amount | expected
    ${testDay} | ${1}   | ${"2024-03-01"}
    ${testDay} | ${2}   | ${"2024-03-04"}
    ${testDay} | ${3}   | ${"2024-03-05"}
    ${testDay} | ${4}   | ${"2024-03-06"}
    ${testDay} | ${5}   | ${"2024-03-07"}
    ${testDay} | ${10}  | ${"2024-03-14"}
  `(
    "returns $expected for Thursday start $value + $amount business days",
    ({ value, amount, expected }) => {
      expect(addBusinessDays(value, amount)).toBe(expected);
    },
  );

  it.each`
    value      | amount | expected
    ${testDay} | ${2}   | ${"2024-03-04"}
    ${testDay} | ${2}   | ${"2024-03-04"}
    ${testDay} | ${3}   | ${"2024-03-05"}
    ${testDay} | ${3}   | ${"2024-03-05"}
    ${testDay} | ${100} | ${"2024-07-18"}
  `(
    "returns $expected for boundary-crossing $value + $amount business days",
    ({ value, amount, expected }) => {
      expect(addBusinessDays(value, amount)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid-date"}
    ${"2024-02-30"}
    ${""}
    ${null}
    ${undefined}
    ${"2024-13-01"}
    ${"2024-00-01"}
    ${"not-a-date"}
    ${"2024/03/15"}
    ${"15-03-2024"}
  `(
    "returns an empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(addBusinessDays(invalidValue as never, 1)).toBe("");
    },
  );

  it.each`
    invalidAmount
    ${NaN}
    ${Infinity}
    ${-Infinity}
    ${null}
    ${undefined}
    ${"string"}
    ${"5"}
    ${{}}
    ${[]}
    ${true}
    ${false}
  `(
    "returns an empty string for invalid amount $invalidAmount",
    ({ invalidAmount }) => {
      expect(addBusinessDays("2024-03-15", invalidAmount as never)).toBe("");
    },
  );

  it("returns an empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(addBusinessDays("2024-03-15", 1)).toBe("");
  });
});
