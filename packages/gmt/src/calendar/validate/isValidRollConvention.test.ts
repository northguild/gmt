import { isValidRollConvention } from "./isValidRollConvention";

describe("isValidRollConvention", () => {
  it.each`
    convention
    ${"following"}
    ${"modifiedFollowing"}
    ${"preceding"}
    ${"modifiedPreceding"}
    ${"endOfMonth"}
    ${"none"}
  `("returns true for $convention", ({ convention }) => {
    expect(isValidRollConvention(convention)).toBe(true);
  });

  it.each`
    convention              | description
    ${"Following"}          | ${"wrong case"}
    ${"modified_following"} | ${"snake case"}
    ${"modifiedfollowing"}  | ${"lower case"}
    ${"eom"}                | ${"an abbreviation"}
    ${"nearest"}            | ${"a convention GMT does not implement"}
    ${""}                   | ${"an empty string"}
    ${" following "}        | ${"padded whitespace"}
    ${null}                 | ${"null"}
    ${undefined}            | ${"undefined"}
    ${1}                    | ${"a number"}
    ${true}                 | ${"a boolean"}
    ${{}}                   | ${"an object"}
    ${[]}                   | ${"an array"}
  `("returns false for $description $convention", ({ convention }) => {
    expect(isValidRollConvention(convention)).toBe(false);
  });
});
