import { resolveOverflow } from "./resolveOverflow";

describe("resolveOverflow", () => {
  it.each`
    overflow       | expected
    ${undefined}   | ${"constrain"}
    ${null}        | ${"constrain"}
    ${"constrain"} | ${"constrain"}
    ${"reject"}    | ${"reject"}
    ${"throw"}     | ${"throw"}
  `("returns $expected for overflow $overflow", ({ overflow, expected }) => {
    expect(resolveOverflow(overflow as never)).toBe(expected);
  });
});
