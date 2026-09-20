import { resolveOverflow } from "./resolveOverflow";

describe("resolveOverflow", () => {
  // Only an omitted member defaults. Temporal reads any present value through ToString, so
  // `null` is the string "null": Chromium 153 answers `date.add({ months: 1 }, { overflow: null })`
  // with "RangeError: Value null out of range for Temporal.PlainDate.prototype.add options
  // property overflow". Passing it through unchanged is what lets the caller's `catch` return
  // the sentinel, exactly as the unrecognised "throw" row below already does.
  it.each`
    overflow       | expected
    ${undefined}   | ${"constrain"}
    ${null}        | ${null}
    ${"constrain"} | ${"constrain"}
    ${"reject"}    | ${"reject"}
    ${"throw"}     | ${"throw"}
  `("returns $expected for overflow $overflow", ({ overflow, expected }) => {
    expect(resolveOverflow(overflow as never)).toBe(expected);
  });
});
