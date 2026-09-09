import { nanosecondsToJson } from "./nanosecondsToJson";

describe("nanosecondsToJson", () => {
  it.each`
    nanoseconds                 | expected
    ${0n}                       | ${"0"}
    ${1710072000123456789n}     | ${"1710072000123456789"}
    ${-1000000000n}             | ${"-1000000000"}
    ${-1710072000123456789n}    | ${"-1710072000123456789"}
    ${8640000000000000000000n}  | ${"8640000000000000000000"}
    ${-8640000000000000000000n} | ${"-8640000000000000000000"}
  `("returns $expected for $nanoseconds", ({ nanoseconds, expected }) => {
    expect(nanosecondsToJson(nanoseconds)).toBe(expected);
  });

  it("survives JSON.stringify, which throws on a raw bigint", () => {
    expect(() => JSON.stringify({ observedAt: 1710072000123456789n })).toThrow(
      TypeError,
    );

    expect(
      JSON.stringify({ observedAt: nanosecondsToJson(1710072000123456789n) }),
    ).toBe('{"observedAt":"1710072000123456789"}');
  });

  it.each`
    nanoseconds                 | reason
    ${8640000000000000000001n}  | ${"past the maximum instant"}
    ${-8640000000000000000001n} | ${"before the minimum instant"}
  `('returns "" for $nanoseconds ($reason)', ({ nanoseconds }) => {
    expect(nanosecondsToJson(nanoseconds)).toBe("");
  });

  it.each`
    nanoseconds
    ${0}
    ${1710072000123}
    ${"1710072000123456789"}
    ${null}
    ${undefined}
    ${true}
    ${[]}
    ${{}}
  `('returns "" when $nanoseconds is non-bigint input', ({ nanoseconds }) => {
    expect(nanosecondsToJson(nanoseconds as unknown as bigint)).toBe("");
  });
});
