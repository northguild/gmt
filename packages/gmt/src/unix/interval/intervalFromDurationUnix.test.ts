import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones, mockSystemTimeZone } from "../../test/timeZoneMatrix";
import { intervalFromDurationUnix } from "./intervalFromDurationUnix";

// Epoch values used below, in ISO 8601 UTC:
// 1704067200000 is 2024-01-01T00:00:00Z
// 1704153600000 is 2024-01-02T00:00:00Z
// 1706659200000 is 2024-01-31T00:00:00Z
// 1709164800000 is 2024-02-29T00:00:00Z
// 1710046800000 is 2024-03-10T00:00:00-05:00[America/New_York] (spring-forward day)
// 1710129600000 is 2024-03-11T00:00:00-04:00[America/New_York]

describe("intervalFromDurationUnix", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = mockSystemTimeZone("UTC");
  });

  afterEach(() => {
    cleanup();
  });

  it.each`
    value             | duration    | anchor      | expected
    ${1704067200000}  | ${"P1D"}    | ${"start"}  | ${{ start: 1704067200000, end: 1704153600000 }}
    ${1704153600000}  | ${"P1D"}    | ${"end"}    | ${{ start: 1704067200000, end: 1704153600000 }}
    ${1704067200000}  | ${"P0D"}    | ${"start"}  | ${{ start: 1704067200000, end: 1704067200000 }}
    ${1704067200000}  | ${"PT0S"}   | ${"end"}    | ${{ start: 1704067200000, end: 1704067200000 }}
    ${"1704067200000"}| ${"P1D"}    | ${"start"}  | ${{ start: 1704067200000, end: 1704153600000 }}
  `(
    "returns $expected for $value with duration $duration anchored at $anchor (default system timeZone = UTC)",
    ({ value, duration, anchor, expected }) => {
      expect(intervalFromDurationUnix(value, duration, anchor)).toEqual(
        expected,
      );
    },
  );

  it.each`
    value          | duration | anchor     | options                                                   | expected
    ${1704067200}  | ${"P1D"} | ${"start"} | ${{ epochUnit: "seconds" }}                              | ${{ start: 1704067200, end: 1704153600 }}
    ${1706659200000}| ${"P1M"} | ${"start"} | ${{ timeZone: "UTC" }}                                   | ${{ start: 1706659200000, end: 1709164800000 }}
    ${1706659200000}| ${"P1M"} | ${"start"} | ${{ timeZone: "UTC", overflow: "constrain" }}            | ${{ start: 1706659200000, end: 1709164800000 }}
    ${1706659200000}| ${"P1M"} | ${"start"} | ${{ timeZone: "UTC", overflow: "reject" }}               | ${null}
    ${1704067200000}| ${"P1D"} | ${"start"} | ${{ timeZone: "UTC", overflow: "reject" }}               | ${{ start: 1704067200000, end: 1704153600000 }}
  `(
    "returns $expected for $value + $duration anchored at $anchor with options $options",
    ({ value, duration, anchor, options, expected }) => {
      expect(intervalFromDurationUnix(value, duration, anchor, options)).toEqual(
        expected,
      );
    },
  );

  it("counts a spring-forward local day as 23 real hours in America/New_York", () => {
    expect(
      intervalFromDurationUnix(1710046800000, "P1D", "start", {
        timeZone: "America/New_York",
      }),
    ).toEqual({ start: 1710046800000, end: 1710129600000 });
  });

  it("resolves calendar-unit durations across every battleTestTimeZone", () => {
    for (const timeZone of battleTestTimeZones) {
      const point = Temporal.ZonedDateTime.from({
        year: 2024,
        month: 1,
        day: 31,
        hour: 0,
        timeZone,
      });
      const expectedEnd = point
        .add(Temporal.Duration.from("P1M"))
        .epochMilliseconds;

      expect(
        intervalFromDurationUnix(point.epochMilliseconds, "P1M", "start", {
          timeZone,
        }),
        `P1M from ${timeZone}`,
      ).toEqual({ start: point.epochMilliseconds, end: expectedEnd });
    }
  });

  it.each`
    value             | duration   | anchor
    ${1704067200000}  | ${"-P10D"} | ${"start"}
    ${1704067200000}  | ${"-P10D"} | ${"end"}
  `(
    "returns null when $duration anchored at $anchor inverts the span from $value",
    ({ value, duration, anchor }) => {
      expect(intervalFromDurationUnix(value, duration, anchor)).toBeNull();
    },
  );

  it.each`
    value            | duration | anchor
    ${NaN}           | ${"P1D"} | ${"start"}
    ${Infinity}       | ${"P1D"} | ${"start"}
    ${1.5}            | ${"P1D"} | ${"start"}
    ${"not-a-number"} | ${"P1D"} | ${"start"}
    ${null}           | ${"P1D"} | ${"start"}
    ${true}           | ${"P1D"} | ${"start"}
    ${[]}             | ${"P1D"} | ${"start"}
  `("returns null for invalid value $value", ({ value, duration, anchor }) => {
    expect(
      intervalFromDurationUnix(value as never, duration, anchor),
    ).toBeNull();
  });

  it.each`
    value             | duration       | anchor
    ${1704067200000}  | ${"not-a-dur"} | ${"start"}
    ${1704067200000}  | ${""}          | ${"start"}
    ${1704067200000}  | ${123}         | ${"start"}
    ${1704067200000}  | ${null}        | ${"start"}
  `(
    "returns null for invalid duration $duration",
    ({ value, duration, anchor }) => {
      expect(
        intervalFromDurationUnix(value, duration as never, anchor),
      ).toBeNull();
    },
  );

  it.each`
    value             | duration | anchor
    ${1704067200000}  | ${"P1D"} | ${"middle"}
    ${1704067200000}  | ${"P1D"} | ${""}
    ${1704067200000}  | ${"P1D"} | ${null}
    ${1704067200000}  | ${"P1D"} | ${undefined}
  `(
    "returns null for invalid anchor $anchor",
    ({ value, duration, anchor }) => {
      expect(
        intervalFromDurationUnix(value, duration, anchor as never),
      ).toBeNull();
    },
  );

  it("returns null for an invalid timeZone option", () => {
    expect(
      intervalFromDurationUnix(1704067200000, "P1D", "start", {
        timeZone: "not-a-timezone",
      }),
    ).toBeNull();
  });

  it("returns null when the system timeZone is unavailable", () => {
    cleanup();
    cleanup = mockSystemTimeZone("");

    expect(intervalFromDurationUnix(1704067200000, "P1D", "start")).toBeNull();
  });

  it("returns null when Temporal.Instant.fromEpochMilliseconds throws", () => {
    vi.spyOn(Temporal.Instant, "fromEpochMilliseconds").mockImplementation(
      () => {
        throw new Error("simulated failure");
      },
    );
    expect(
      intervalFromDurationUnix(1704067200000, "P1D", "start", {
        timeZone: "UTC",
      }),
    ).toBeNull();
  });
});
