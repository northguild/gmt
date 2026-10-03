import { describe, expect, it } from "vitest";
import { optionOrDefault } from "./optionOrDefault";

describe("optionOrDefault", () => {
  // ECMA-402 GetOption: only undefined takes the default; every other value is returned for the
  // caller to validate, falsy values and null included.
  it.each`
    value        | fallback        | expected        | why
    ${undefined} | ${"compatible"} | ${"compatible"} | ${"undefined is absent"}
    ${"later"}   | ${"compatible"} | ${"later"}      | ${"a value is kept"}
    ${null}      | ${true}         | ${null}         | ${"null is a value"}
    ${false}     | ${true}         | ${false}        | ${"false is a value"}
    ${0}         | ${9}            | ${0}            | ${"0 is a value"}
    ${""}        | ${"long"}       | ${""}           | ${"an empty string is a value"}
  `(
    "returns $expected for value $value with default $fallback ($why)",
    ({ value, fallback, expected }) => {
      expect(optionOrDefault(value, fallback)).toBe(expected);
    },
  );
});
