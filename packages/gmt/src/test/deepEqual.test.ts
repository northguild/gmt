import { deepEqual } from "./deepEqual";

// Expected values are the comparison rules of Node's `util.isDeepStrictEqual` (strict mode of
// `assert.deepStrictEqual`): primitives by SameValue, then prototype, then own enumerable keys,
// then each value. They are written as literals so this file needs no Node module.
// oxlint-disable-next-line @northguild/gmt-oxlint/no-new-date -- unsupported-type fixture
const makeDate = () => new Date(0); // date-ban: a Date as the unsupported-type fixture

describe("deepEqual", () => {
  it.each`
    rule                                     | a                         | b                         | expected
    ${"same primitive"}                      | ${"x"}                    | ${"x"}                    | ${true}
    ${"null equals null"}                    | ${null}                   | ${null}                   | ${true}
    ${"empty string equals empty string"}    | ${""}                     | ${""}                     | ${true}
    ${"NaN equals NaN"}                      | ${Number.NaN}             | ${Number.NaN}             | ${true}
    ${"0 does not equal -0"}                 | ${0}                      | ${-0}                     | ${false}
    ${"no loose coercion: 1 and '1'"}        | ${1}                      | ${"1"}                    | ${false}
    ${"null does not equal undefined"}       | ${null}                   | ${undefined}              | ${false}
    ${"false does not equal 0"}              | ${false}                  | ${0}                      | ${false}
    ${"empty array equals empty array"}      | ${[]}                     | ${[]}                     | ${true}
    ${"array does not equal object"}         | ${[]}                     | ${{}}                     | ${false}
    ${"arrays compare element by element"}   | ${[1, [2, Number.NaN]]}   | ${[1, [2, Number.NaN]]}   | ${true}
    ${"arrays of different length"}          | ${[1]}                    | ${[1, 2]}                 | ${false}
    ${"objects compare key by key"}          | ${{ a: 1, b: { c: "" } }} | ${{ b: { c: "" }, a: 1 }} | ${true}
    ${"a missing key"}                       | ${{ a: 1 }}               | ${{ a: 1, b: undefined }} | ${false}
    ${"a different value under a key"}       | ${{ a: 1 }}               | ${{ a: 2 }}               | ${false}
    ${"different prototypes"}                | ${Object.create(null)}    | ${{}}                     | ${false}
    ${"a class instance and a plain object"} | ${new (class A {})()}     | ${{}}                     | ${false}
    ${"object does not equal null"}          | ${{}}                     | ${null}                   | ${false}
    ${"functions compare by identity"}       | ${() => 1}                | ${() => 1}                | ${false}
  `("$rule: returns $expected", ({ a, b, expected }) => {
    expect(deepEqual(a, b)).toBe(expected);
  });

  it("compares array length, not only the elements present", () => {
    const holes = (length: number): unknown[] => {
      const array: unknown[] = [];
      array.length = length;
      return array;
    };
    expect(deepEqual(holes(3), holes(2))).toBe(false);
    expect(deepEqual(holes(2), holes(2))).toBe(true);
  });

  // Maps, Sets, Dates and the like keep their state outside own properties, so a key-by-key walk
  // would call any two of them equal. No caller compares them, so they throw instead.
  it.each`
    kind            | make
    ${"Map"}        | ${() => new Map([[1, 2]])}
    ${"Set"}        | ${() => new Set([1])}
    ${"Date"}       | ${makeDate}
    ${"RegExp"}     | ${() => /a/u}
    ${"Number"}     | ${() => Object(1)}
    ${"Uint8Array"} | ${() => new Uint8Array(1)}
  `("throws a TypeError for a $kind", ({ make }) => {
    expect(() => deepEqual(make(), make())).toThrow(TypeError);
    expect(() => deepEqual({ inner: make() }, { inner: make() })).toThrow(
      TypeError,
    );
  });

  it("compares enumerable symbol keys and ignores non-enumerable ones", () => {
    const key = Symbol("k");
    const hidden = Object.defineProperty({}, "h", { value: 1 });
    expect(deepEqual({ [key]: 1 }, { [key]: 1 })).toBe(true);
    expect(deepEqual({ [key]: 1 }, { [key]: 2 })).toBe(false);
    expect(deepEqual(hidden, {})).toBe(true);
  });

  it("returns true for two cyclic structures of the same shape", () => {
    const a: { self?: unknown } = {};
    const b: { self?: unknown } = {};
    a.self = a;
    b.self = b;
    expect(deepEqual(a, b)).toBe(true);
  });
});
