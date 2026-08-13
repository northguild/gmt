import { Temporal } from "@js-temporal/polyfill";
import { mockSystemTimeZone } from "../../test/timeZoneMatrix";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { endOfUnix } from "./endOfUnix";

describe("endOfUnix", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = mockSystemTimeZone("UTC");
  });

  afterEach(() => {
    cleanup();
  });

  it.each`
    value         | unit        | expected
    ${1706659200} | ${"year"}   | ${1735689599}
    ${1706659200} | ${"month"}  | ${1706745599}
    ${1706659200} | ${"day"}    | ${1706745599}
    ${1706659200} | ${"hour"}   | ${1706662799}
    ${1706659200} | ${"minute"} | ${1706659259}
    ${1706659200} | ${"second"} | ${1706659200}
  `(
    "returns $expected for value $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(endOfUnix(value, unit, { epochUnit: "seconds" })).toBe(expected);
    },
  );

  it.each`
    value         | unit      | weekStartsOn | expected
    ${1706659200} | ${"week"} | ${"monday"}  | ${1707091199}
    ${1706659200} | ${"week"} | ${"sunday"}  | ${1707004799}
  `(
    "supports weekStartsOn $weekStartsOn returning $expected for value $value and unit $unit",
    ({ value, unit, weekStartsOn, expected }) => {
      expect(
        endOfUnix(value, unit, { epochUnit: "seconds", weekStartsOn }),
      ).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${1.5}
    ${null}
    ${undefined}
  `("returns null for invalid value $invalidValue", ({ invalidValue }) => {
    expect(endOfUnix(invalidValue as never, "day" as never)).toBeNull();
  });

  it.each`
    invalidUnit
    ${"invalid-unit"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid unit $invalidUnit", ({ invalidUnit }) => {
    expect(endOfUnix(1706659200, invalidUnit as never)).toBeNull();
  });

  // disambiguation: fall-back overlap — source sits in the second, repeated 1:45am
  it.each`
    disambiguation  | expected
    ${undefined}    | ${1730613599999}
    ${"compatible"} | ${1730613599999}
    ${"earlier"}    | ${1730613599999}
    ${"later"}      | ${1730617199999}
    ${"reject"}     | ${null}
  `(
    "with disambiguation $disambiguation on a fall-back overlap, returns $expected",
    ({ disambiguation, expected }) => {
      const optionsArg =
        disambiguation === undefined
          ? { timeZone: "America/New_York" }
          : { timeZone: "America/New_York", disambiguation };
      expect(endOfUnix(1730616300000, "hour", optionsArg)).toBe(expected);
    },
  );

  // offset controls whether disambiguation takes effect at all
  it.each`
    offset       | expected
    ${undefined} | ${null}
    ${"ignore"}  | ${null}
    ${"prefer"}  | ${1730617199999}
  `(
    "with disambiguation reject and offset $offset, returns $expected",
    ({ offset, expected }) => {
      const optionsArg =
        offset === undefined
          ? { timeZone: "America/New_York", disambiguation: "reject" as const }
          : {
              timeZone: "America/New_York",
              disambiguation: "reject" as const,
              offset,
            };
      expect(endOfUnix(1730616300000, "hour", optionsArg)).toBe(expected);
    },
  );

  it("returns null when Temporal.Instant.fromEpochMilliseconds throws", () => {
    vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(
      () => {
        throw new Error("simulated failure");
      },
    );
    expect(endOfUnix(1706659200, "day")).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(endOfUnix(1706659200, "month")).toBeNull();
  });
});
