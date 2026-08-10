import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { subtractBusinessDays } from "./subtractBusinessDays";

const testDay = "2024-02-29"; // Thursday

describe("subtractBusinessDays", () => {
  it.each`
    value      | amount | expected
    ${testDay} | ${1}   | ${"2024-02-28"}
    ${testDay} | ${10}  | ${"2024-02-15"}
    ${testDay} | ${0}   | ${"2024-02-29"}
    ${testDay} | ${5}   | ${"2024-02-22"}
    ${testDay} | ${20}  | ${"2024-02-01"}
    ${testDay} | ${50}  | ${"2023-12-21"}
  `(
    "returns $expected for $value - $amount business days",
    ({ value, amount, expected }) => {
      expect(subtractBusinessDays(value, amount)).toBe(expected);
    },
  );

  it.each`
    value      | amount | expected
    ${testDay} | ${-1}  | ${"2024-03-01"}
    ${testDay} | ${-5}  | ${"2024-03-07"}
    ${testDay} | ${-10} | ${"2024-03-14"}
  `(
    "returns $expected when subtracting a negative amount: $amount",
    ({ value, amount, expected }) => {
      expect(subtractBusinessDays(value, amount)).toBe(expected);
    },
  );

  it.each`
    value      | amount | expected
    ${testDay} | ${1}   | ${"2024-02-28"}
    ${testDay} | ${2}   | ${"2024-02-27"}
  `(
    "returns $expected for $value - $amount business days",
    ({ value, amount, expected }) => {
      expect(subtractBusinessDays(value, amount)).toBe(expected);
    },
  );

  it.each`
    value      | amount | expected
    ${testDay} | ${1}   | ${"2024-02-28"}
    ${testDay} | ${2}   | ${"2024-02-27"}
    ${testDay} | ${3}   | ${"2024-02-26"}
    ${testDay} | ${4}   | ${"2024-02-23"}
    ${testDay} | ${5}   | ${"2024-02-22"}
    ${testDay} | ${10}  | ${"2024-02-15"}
  `(
    "returns $expected for $value - $amount business days",
    ({ value, amount, expected }) => {
      expect(subtractBusinessDays(value, amount)).toBe(expected);
    },
  );

  it.each`
    value      | amount | expected
    ${testDay} | ${2}   | ${"2024-02-27"}
    ${testDay} | ${5}   | ${"2024-02-22"}
    ${testDay} | ${10}  | ${"2024-02-15"}
    ${testDay} | ${20}  | ${"2024-02-01"}
    ${testDay} | ${50}  | ${"2023-12-21"}
    ${testDay} | ${100} | ${"2023-10-12"}
  `(
    "returns $expected for boundary-crossing $value - $amount business days",
    ({ value, amount, expected }) => {
      expect(subtractBusinessDays(value, amount)).toBe(expected);
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
    ${"2024/03/18"}
    ${"18-03-2024"}
  `(
    "returns an empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(subtractBusinessDays(invalidValue as never, 1)).toBe("");
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
      expect(subtractBusinessDays("2024-03-18", invalidAmount as never)).toBe(
        "",
      );
    },
  );

  it("returns an empty string when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(subtractBusinessDays("2024-03-18", 1)).toBe("");
  });
});
