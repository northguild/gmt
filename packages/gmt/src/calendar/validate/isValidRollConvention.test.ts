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
    convention              | description                              | label
    ${"Following"}          | ${"wrong case"}                          | ${"'Following'"}
    ${"modified_following"} | ${"snake case"}                          | ${"'modified_following'"}
    ${"modifiedfollowing"}  | ${"lower case"}                          | ${"'modifiedfollowing'"}
    ${"eom"}                | ${"an abbreviation"}                     | ${"'eom'"}
    ${"nearest"}            | ${"a convention GMT does not implement"} | ${"'nearest'"}
    ${""}                   | ${"an empty string"}                     | ${"''"}
    ${" following "}        | ${"padded whitespace"}                   | ${"' following '"}
    ${null}                 | ${"null"}                                | ${"null"}
    ${undefined}            | ${"undefined"}                           | ${"undefined"}
    ${1}                    | ${"a number"}                            | ${"1"}
    ${true}                 | ${"a boolean"}                           | ${"true"}
    ${{}}                   | ${"an object"}                           | ${"{}"}
    ${[]}                   | ${"an array"}                            | ${"[]"}
  `("returns false for $description $label", ({ convention }) => {
    expect(isValidRollConvention(convention)).toBe(false);
  });
});
