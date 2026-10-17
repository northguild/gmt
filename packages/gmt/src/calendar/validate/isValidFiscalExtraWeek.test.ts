import { isValidFiscalExtraWeek } from "./isValidFiscalExtraWeek";

describe("isValidFiscalExtraWeek", () => {
  it.each`
    extraWeek        | description
    ${"firstPeriod"} | ${"the week goes to period 1, as ONS (UK) adds a five-week January"}
    ${"lastPeriod"}  | ${"the week goes to period 12, as NRF (US) adds it to the end"}
  `("returns true for $extraWeek ($description)", ({ extraWeek }) => {
    expect(isValidFiscalExtraWeek(extraWeek)).toBe(true);
  });

  it.each`
    extraWeek        | reason
    ${"FirstPeriod"} | ${"wrong case"}
    ${"lastQuarter"} | ${"quarter wording, not one of the two values"}
    ${"middle"}      | ${"no peer puts the week in a middle period"}
    ${"lastPeriod "} | ${"trailing whitespace"}
    ${""}            | ${"empty string"}
  `("returns false for the string $extraWeek ($reason)", ({ extraWeek }) => {
    expect(isValidFiscalExtraWeek(extraWeek)).toBe(false);
  });

  it.each`
    nonString
    ${1}
    ${12}
    ${true}
    ${null}
    ${undefined}
    ${{}}
    ${["lastPeriod"]}
    ${new String("lastPeriod")}
  `("returns false when $nonString is non-string", ({ nonString }) => {
    expect(isValidFiscalExtraWeek(nonString)).toBe(false);
  });
});
