import { Temporal } from "@js-temporal/polyfill";
import { mockSystemTimeZone } from "../../test/timeZoneMatrix";
import { isBetweenUnix } from "./isBetweenUnix";

describe("isBetweenUnix", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = mockSystemTimeZone("UTC");
  });

  afterEach(() => {
    cleanup();
  });

  it.each`
    value         | start         | end           | expected
    ${1706659200} | ${1704067200} | ${1709155200} | ${true}
    ${1704067200} | ${1704067200} | ${1709155200} | ${true}
    ${1709155200} | ${1704067200} | ${1709155200} | ${true}
    ${1700000000} | ${1704067200} | ${1709155200} | ${false}
  `(
    "returns $expected for value $value between $start and $end",
    ({ value, start, end, expected }) => {
      expect(isBetweenUnix(value, start, end, { epochUnit: "seconds" })).toBe(
        expected,
      );
    },
  );

  it.each`
    value         | start         | end           | inclusiveStart | inclusiveEnd | expected
    ${1704067200} | ${1704067200} | ${1709155200} | ${false}       | ${true}      | ${false}
    ${1706659200} | ${1704067200} | ${1706652800} | ${true}        | ${false}     | ${false}
    ${1704067200} | ${1704067200} | ${1709155200} | ${false}       | ${false}     | ${false}
    ${1706659200} | ${1704067200} | ${1709155200} | ${false}       | ${false}     | ${true}
  `(
    "supports inclusive options for value $value between $start and $end",
    ({ value, start, end, inclusiveStart, inclusiveEnd, expected }) => {
      expect(
        isBetweenUnix(value, start, end, {
          epochUnit: "seconds",
          inclusiveStart,
          inclusiveEnd,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    value         | start         | end
    ${"invalid"}  | ${1704067200} | ${1709155200}
    ${1706659200} | ${"invalid"}  | ${1709155200}
    ${1706659200} | ${1704067200} | ${"invalid"}
  `(
    "returns false for invalid inputs: $value | $start | $end",
    ({ value, start, end }) => {
      expect(isBetweenUnix(value as never, start as never, end as never)).toBe(
        false,
      );
    },
  );

  it("returns false when start is after end", () => {
    expect(isBetweenUnix(1706659200, 1709155200, 1704067200)).toBe(false);
  });

  it("returns false when Temporal.Instant.fromEpochMilliseconds throws", () => {
    vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(
      () => {
        throw new Error("simulated failure");
      },
    );
    expect(isBetweenUnix(1706659200, 1704067200, 1709155200)).toBe(false);
  });
});

describe("isBetweenUnix with an unrecognised epochUnit", () => {
  // isValidUnixUnit defines the domain ("seconds" | "milliseconds"): any other value is invalid
  // input and returns the sentinel, never a silent read as milliseconds.
  it.each`
    epochUnit
    ${"second"}
    ${"SECONDS"}
    ${"ms"}
    ${""}
    ${1000}
  `("returns false for epochUnit $epochUnit", ({ epochUnit }) => {
    expect(
      isBetweenUnix(1_706_659_200, 1_706_659_200, 1_706_659_200, {
        epochUnit: epochUnit as never,
        timeZone: "UTC",
      }),
    ).toBe(false);
  });
});
