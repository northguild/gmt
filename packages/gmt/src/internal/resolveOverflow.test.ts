import { resolveOverflow } from "./resolveOverflow";

describe("resolveOverflow", () => {
  // Only an omitted member defaults. A string is passed through for Temporal to accept or reject
  // (the unrecognised "throw" row), and a value of another type is refused with a TypeError that
  // the caller's `catch` turns into its sentinel: GMT reads exactly the declared type, where
  // Temporal's GetOption would turn `null` into "null" and an object into its ToString.
  it.each`
    overflow       | expected
    ${undefined}   | ${"constrain"}
    ${"constrain"} | ${"constrain"}
    ${"reject"}    | ${"reject"}
    ${"throw"}     | ${"throw"}
  `("returns $expected for overflow $overflow", ({ overflow, expected }) => {
    expect(resolveOverflow(overflow as never)).toBe(expected);
  });

  it.each`
    overflow                        | label
    ${null}                         | ${"null"}
    ${1}                            | ${"a number"}
    ${true}                         | ${"a boolean"}
    ${{ toString: () => "reject" }} | ${"an object with a toString"}
  `("throws a TypeError for overflow $label", ({ overflow }) => {
    expect(() => resolveOverflow(overflow as never)).toThrow(TypeError);
  });
});
