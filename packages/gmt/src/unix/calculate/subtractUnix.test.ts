import { Temporal } from "@js-temporal/polyfill";
import { mockSystemTimeZone } from "../../test/timeZoneMatrix";
import { subtractUnix } from "./subtractUnix";

describe("subtractUnix", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = mockSystemTimeZone("UTC");
  });

  afterEach(() => {
    cleanup();
  });

  it.each`
    value            | units          | options                          | expected
    ${1709251200000} | ${{ days: 1 }} | ${undefined}                     | ${1709164800000}
    ${1709251200000} | ${{ days: 1 }} | ${{ epochUnit: "milliseconds" }} | ${1709164800000}
    ${1709251200}    | ${{ days: 1 }} | ${{ epochUnit: "seconds" }}      | ${1709164800}
    ${86400}         | ${{ days: 1 }} | ${{ epochUnit: "seconds" }}      | ${0}
  `(
    "returns $expected for $value with $units",
    ({ value, units, options, expected }) => {
      expect(subtractUnix(value, units, options)).toBe(expected);
    },
  );

  it.each`
    value            | units                 | options
    ${"invalid"}     | ${{ days: 1 }}        | ${undefined}
    ${1.5}           | ${{ days: 1 }}        | ${undefined}
    ${null}          | ${{ days: 1 }}        | ${undefined}
    ${1709164800000} | ${{ invalidUnit: 1 }} | ${undefined}
    ${1709164800000} | ${{ days: "1" }}      | ${undefined}
  `("returns null for invalid input", ({ value, units, options }) => {
    expect(subtractUnix(value as never, units as never, options)).toBeNull();
  });

  it.each`
    value            | units            | options                                                    | expected
    ${1711886400000} | ${{ months: 1 }} | ${undefined}                                               | ${1709208000000}
    ${1711886400000} | ${{ months: 1 }} | ${{ overflow: "constrain" }}                               | ${1709208000000}
    ${1711886400000} | ${{ months: 1 }} | ${{ overflow: "reject" }}                                  | ${null}
    ${1711886400000} | ${{ months: 1 }} | ${{ overflow: "constrain", timeZone: "America/New_York" }} | ${1709211600000}
    ${1711886400000} | ${{ months: 1 }} | ${{ overflow: "reject", timeZone: "America/New_York" }}    | ${null}
    ${1711886400}    | ${{ months: 1 }} | ${{ overflow: "constrain", epochUnit: "seconds" }}         | ${1709208000}
    ${1711886400}    | ${{ months: 1 }} | ${{ overflow: "reject", epochUnit: "seconds" }}            | ${null}
    ${1711886400000} | ${{ days: 1 }}   | ${{ overflow: "reject" }}                                  | ${1711800000000}
  `(
    "returns $expected for $value - $units with options $options",
    ({ value, units, options, expected }) => {
      expect(subtractUnix(value, units, options)).toBe(expected);
    },
  );

  it.each`
    value            | units             | overflow       | expected
    ${1711886400000} | ${{ months: -1 }} | ${undefined}   | ${1714478400000}
    ${1711886400000} | ${{ months: -1 }} | ${"constrain"} | ${1714478400000}
    ${1711886400000} | ${{ months: -1 }} | ${"reject"}    | ${null}
  `(
    "returns $expected for negative amount $units on $value with overflow $overflow",
    ({ value, units, overflow, expected }) => {
      expect(
        subtractUnix(
          value,
          units,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );

  it("returns null when Temporal.Instant.fromEpochMilliseconds throws", () => {
    vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(
      () => {
        throw new Error("simulated failure");
      },
    );
    expect(subtractUnix(1709251200000, { days: 1 })).toBeNull();
  });
});

describe("subtractUnix at the maximum instant", () => {
  it.each`
    value                    | units           | timeZone              | expected
    ${8_639_999_913_600_000} | ${{ days: -1 }} | ${"Australia/Sydney"} | ${8_640_000_000_000_000}
  `(
    "subtracts $units from $value in $timeZone giving $expected",
    ({ value, units, timeZone, expected }) => {
      expect(subtractUnix(value, units, { timeZone })).toBe(expected);
    },
  );
});

describe("subtractUnix with an unrecognised epochUnit", () => {
  // isValidUnixUnit defines the domain ("seconds" | "milliseconds", singular or plural): any other value is invalid
  // input and returns the sentinel, never a silent read as milliseconds.
  it.each`
    epochUnit
    ${"nanoseconds"}
    ${"SECONDS"}
    ${"ms"}
    ${""}
    ${1000}
  `("returns null for epochUnit $epochUnit", ({ epochUnit }) => {
    expect(
      subtractUnix(
        1_706_659_200,
        { days: 1 },
        { epochUnit: epochUnit as never, timeZone: "UTC" },
      ),
    ).toBe(null);
  });
});

describe("subtractUnix invalid-input @example", () => {
  it("returns null for subtractUnix(1.5, { days: 1 })", () => {
    expect(subtractUnix(1.5, { days: 1 })).toBe(null);
  });
});
