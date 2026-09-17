import { isValidUnixMilliseconds, isValidUnixSeconds } from "../validate";
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
    expect(getUnixNow(options as never)).toBeNull();
  });
});
