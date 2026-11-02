import { hostileProxy } from "../../test/hostileValues";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { secondsUntilUnix } from "./secondsUntilUnix";

// The fake clock is 2027-06-15T12:00:00Z, which is 1813060800 s (really 12:00:00.0008Z).
const NOW = "2027-06-15T12:00:00Z";

describe("secondsUntilUnix", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // A wait rounds up, so it never falls short; a past target counts down below zero.
  it.each`
    value            | options                          | expected          | why
    ${1813060920}    | ${{ epochUnit: "seconds" }}      | ${120}            | ${"two minutes on"}
    ${1813060800}    | ${{ epochUnit: "seconds" }}      | ${0}              | ${"the clock is 0.8 ms past the whole second: the target has been reached"}
    ${1813060740}    | ${{ epochUnit: "seconds" }}      | ${-60}            | ${"a minute past"}
    ${1813320000}    | ${{ epochUnit: "seconds" }}      | ${259200}         | ${"3 days x 86400"}
    ${"1813060920"}  | ${{ epochUnit: "seconds" }}      | ${120}            | ${"a digit string"}
    ${1813060920}    | ${{ epochUnit: "second" }}       | ${120}            | ${"singular unit name"}
    ${1813060920000} | ${undefined}                     | ${120}            | ${"default milliseconds"}
    ${1813060920000} | ${{ epochUnit: undefined }}      | ${120}            | ${"explicit undefined unit"}
    ${1813060800500} | ${undefined}                     | ${1}              | ${"half a second ahead rounds up"}
    ${1813060799500} | ${undefined}                     | ${0}              | ${"half a second past rounds toward zero, not -0"}
    ${1813060799000} | ${undefined}                     | ${-1}             | ${"1.0008 s past: -1.0008 rounds up to -1"}
    ${1813060919999} | ${undefined}                     | ${120}            | ${"119.9992 s ahead rounds up to 120"}
    ${1813060800001} | ${undefined}                     | ${1}              | ${"0.2 ms ahead rounds up to a whole second"}
    ${1813060800000} | ${undefined}                     | ${0}              | ${"0.8 ms past rounds toward zero, not -0"}
    ${1813060801}    | ${{ epochUnit: "seconds" }}      | ${1}              | ${"0.9992 s ahead rounds up to 1"}
    ${1813060802}    | ${{ epochUnit: "seconds" }}      | ${2}              | ${"1.9992 s ahead rounds up to 2"}
    ${1813060799}    | ${{ epochUnit: "seconds" }}      | ${-1}             | ${"1.0008 s past rounds up to -1"}
    ${1813060920000} | ${{ epochUnit: "milliseconds" }} | ${120}            | ${"explicit milliseconds"}
    ${8.64e15}       | ${undefined}                     | ${8638186939200}  | ${"the last millisecond Instant holds"}
    ${-8.64e15}      | ${undefined}                     | ${-8641813060800} | ${"the first millisecond Instant holds"}
    ${1813060920000} | ${{ epochUnit: "seconds" }}      | ${1811247859200}  | ${"milliseconds read as seconds land in year 59000: 1813060920000 s"}
  `(
    "returns $expected for $value with options $options ($why)",
    ({ value, options, expected }) => {
      expect(secondsUntilUnix(value, options)).toBe(expected);
    },
  );

  // 1813060800.5 is a fractional epoch; the way out is Math.floor.
  it.each`
    value                  | label
    ${1813060800.5}        | ${"1813060800.5"}
    ${"1813060800.5"}      | ${"'1813060800.5' (a fractional digit string)"}
    ${-1813060800.5}       | ${"-1813060800.5"}
    ${"1813060800."}       | ${"'1813060800.' (a trailing point)"}
    ${"1e9"}               | ${"'1e9'"}
    ${"0x10"}              | ${"'0x10'"}
    ${" 1813060920000"}    | ${"' 1813060920000' (a leading space)"}
    ${-Infinity}           | ${"-Infinity"}
    ${true}                | ${"true"}
    ${""}                  | ${"''"}
    ${"soon"}              | ${"'soon'"}
    ${Number.NaN}          | ${"NaN"}
    ${Infinity}            | ${"Infinity"}
    ${null}                | ${"null"}
    ${undefined}           | ${"undefined"}
    ${{}}                  | ${"{}"}
    ${8.64e15 + 1}         | ${"8.64e15 + 1"}
    ${"-8640000000000001"} | ${"'-8640000000000001'"}
  `("returns null for $label", ({ value }) => {
    expect(secondsUntilUnix(value)).toBeNull();
  });

  it.each`
    options
    ${{ epochUnit: "minutes" }}
    ${{ epochUnit: "microseconds" }}
    ${{ epochUnit: "nanoseconds" }}
    ${{ epochUnit: "" }}
    ${{ epochUnit: null }}
    ${{ epochUnit: 1 }}
    ${"seconds"}
    ${null}
  `("returns null for options $options", ({ options }) => {
    expect(secondsUntilUnix(1813060920, options)).toBeNull();
  });

  it("returns null for a hostile value or options", () => {
    expect(secondsUntilUnix(hostileProxy() as never)).toBeNull();
    expect(secondsUntilUnix(1, hostileProxy() as never)).toBeNull();
  });

  it("reads a seconds value as milliseconds and lands in 1970, long past", () => {
    expect(secondsUntilUnix(1813060920)).toBe(-1811247739);
  });

  it("follows the clock: the same target is shorter a minute later", () => {
    expect(secondsUntilUnix(1813060920, { epochUnit: "seconds" })).toBe(120);
    setFakeSystemTime("2027-06-15T12:01:00Z");
    expect(secondsUntilUnix(1813060920, { epochUnit: "seconds" })).toBe(60);
  });
});
