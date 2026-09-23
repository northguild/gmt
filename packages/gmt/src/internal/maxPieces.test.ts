import {
  DEFAULT_MAX_PIECES,
  exceedsPieceLimit,
  MAX_ARRAY_LENGTH,
  resolveMaxPieces,
} from "./maxPieces";

describe("DEFAULT_MAX_PIECES", () => {
  it("is one million (owner decision A2, CORE-8)", () => {
    expect(DEFAULT_MAX_PIECES).toBe(1_000_000);
  });
});

describe("MAX_ARRAY_LENGTH", () => {
  // ECMA-262 §10.4.2 Array exotic objects: a length is at most 2^32 - 1.
  it("is 2^32 - 1", () => {
    expect(MAX_ARRAY_LENGTH).toBe(4_294_967_295);
  });
});

describe("resolveMaxPieces", () => {
  it.each`
    label                           | options                                   | expected
    ${"omitted options"}            | ${undefined}                              | ${1_000_000}
    ${"empty options"}              | ${{}}                                     | ${1_000_000}
    ${"maxPieces undefined"}        | ${{ maxPieces: undefined }}               | ${1_000_000}
    ${"maxPieces 1"}                | ${{ maxPieces: 1 }}                       | ${1}
    ${"maxPieces 5"}                | ${{ maxPieces: 5 }}                       | ${5}
    ${"maxPieces MAX_SAFE_INTEGER"} | ${{ maxPieces: Number.MAX_SAFE_INTEGER }} | ${Number.MAX_SAFE_INTEGER}
  `("returns $expected for $label", ({ options, expected }) => {
    expect(resolveMaxPieces(options)).toBe(expected);
  });

  // Temporal GetOptionsObject: a non-object options argument is a TypeError, which GMT maps to
  // the sentinel. A limit must be a positive safe integer.
  it.each`
    label                   | options
    ${"null options"}       | ${null}
    ${"number options"}     | ${5}
    ${"string options"}     | ${"5"}
    ${"maxPieces 0"}        | ${{ maxPieces: 0 }}
    ${"maxPieces -1"}       | ${{ maxPieces: -1 }}
    ${"maxPieces 1.5"}      | ${{ maxPieces: 1.5 }}
    ${"maxPieces NaN"}      | ${{ maxPieces: Number.NaN }}
    ${"maxPieces Infinity"} | ${{ maxPieces: Number.POSITIVE_INFINITY }}
    ${"maxPieces 2^53"}     | ${{ maxPieces: 2 ** 53 }}
    ${"maxPieces string"}   | ${{ maxPieces: "5" }}
    ${"maxPieces null"}     | ${{ maxPieces: null }}
  `("returns null for $label", ({ options }) => {
    expect(resolveMaxPieces(options as never)).toBeNull();
  });
});

describe("exceedsPieceLimit", () => {
  it.each`
    count          | maxPieces    | expected
    ${0}           | ${1}         | ${false}
    ${1}           | ${1}         | ${false}
    ${2}           | ${1}         | ${true}
    ${1_000_000}   | ${1_000_000} | ${false}
    ${1_000_001}   | ${1_000_000} | ${true}
    ${2 ** 32 - 1} | ${2 ** 40}   | ${false}
    ${2 ** 32}     | ${2 ** 40}   | ${true}
  `(
    "returns $expected for count $count against maxPieces $maxPieces",
    ({ count, maxPieces, expected }) => {
      expect(exceedsPieceLimit(count, maxPieces)).toBe(expected);
    },
  );
});
