import { hostileProxy } from "../../test/hostileValues";
import { addUnix } from "../calculate/addUnix";
import { isValidUnixMilliseconds, isValidUnixSeconds } from "../validate";
import type { UnixUnit } from "../validate/isValidUnixUnit";
import { getUnixNow } from "./getUnixNow";

describe("getUnixNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.500Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 2024-02-29T00:00:00.500Z is 1709164800500 ms; seconds floor to 1709164800 (POSIX time_t).
  it.each`
    options                          | expected
    ${undefined}                     | ${1709164800500}
    ${{}}                            | ${1709164800500}
    ${{ epochUnit: undefined }}      | ${1709164800500}
    ${{ epochUnit: "milliseconds" }} | ${1709164800500}
    ${{ epochUnit: "millisecond" }}  | ${1709164800500}
    ${{ epochUnit: "seconds" }}      | ${1709164800}
    ${{ epochUnit: "second" }}       | ${1709164800}
  `("returns $expected for options $options", ({ options, expected }) => {
    const value = getUnixNow(options);

    expect(value).toBe(expected);
    expect(
      options?.epochUnit?.startsWith("second")
        ? isValidUnixSeconds(value)
        : isValidUnixMilliseconds(value),
    ).toBe(true);
  });

  it("reads explicit undefined options as omitted", () => {
    expect(getUnixNow(undefined)).toBe(1709164800500);
  });

  // An unknown unit, and a non-object options argument (the pre-1.16.0 positional "seconds"), are
  // invalid input: Temporal GetOptionsObject throws TypeError for a non-object.
  it.each`
    options
    ${{ epochUnit: "minutes" }}
    ${{ epochUnit: "" }}
    ${{ epochUnit: null }}
    ${"seconds"}
    ${"milliseconds"}
    ${null}
  `("returns null for options $options", ({ options }) => {
    expect(getUnixNow(options)).toBeNull();
  });

  it("feeds addUnix with no null check (Feb 29 plus one year constrains to Feb 28)", () => {
    // 2025-02-28T00:00:00.500Z, TC39 overflow "constrain".
    expect(addUnix(getUnixNow(), { years: 1 })).toBe(1740700800500);
  });

  // The outer catch stays: an argument that throws on access is invalid input, not an exception.
  it("returns null for an options object whose epochUnit getter throws", () => {
    const options = {
      get epochUnit(): never {
        throw new Error("hostile getter");
      },
    };
    expect(getUnixNow(options)).toBeNull();
  });

  it("returns null for a proxy that throws on any trap", () => {
    expect(getUnixNow(hostileProxy())).toBeNull();
  });

  describe("types", () => {
    const unit = "seconds" as UnixUnit;
    const text: string = "seconds";
    const anything: unknown = "seconds";

    it("returns number when the call cannot fail", () => {
      expectTypeOf(getUnixNow()).toEqualTypeOf<number>();
      expectTypeOf(getUnixNow(undefined)).toEqualTypeOf<number>();
      expectTypeOf(getUnixNow({})).toEqualTypeOf<number>();
      expectTypeOf(
        getUnixNow({ epochUnit: undefined }),
      ).toEqualTypeOf<number>();
      expectTypeOf(
        getUnixNow({ epochUnit: "seconds" }),
      ).toEqualTypeOf<number>();
      expectTypeOf(getUnixNow({ epochUnit: "second" })).toEqualTypeOf<number>();
      expectTypeOf(
        getUnixNow({ epochUnit: "milliseconds" }),
      ).toEqualTypeOf<number>();
      expectTypeOf(
        getUnixNow({ epochUnit: "millisecond" }),
      ).toEqualTypeOf<number>();
      expectTypeOf(getUnixNow({ epochUnit: unit })).toEqualTypeOf<number>();
    });

    it("returns number | null for a value outside the options type", () => {
      expectTypeOf(getUnixNow(anything)).toEqualTypeOf<number | null>();
      expectTypeOf(getUnixNow({ epochUnit: text })).toEqualTypeOf<
        number | null
      >();
      expectTypeOf(getUnixNow({ epochUnit: "minutes" })).toEqualTypeOf<
        number | null
      >();
      expectTypeOf(getUnixNow("seconds")).toEqualTypeOf<number | null>();
    });
  });
});
