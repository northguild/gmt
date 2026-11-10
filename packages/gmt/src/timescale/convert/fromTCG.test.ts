import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { fromTCG } from "./fromTCG";
import { toTCG } from "./toTCG";

// Expected values come from exact bigint arithmetic outside the library: TT = TCG − floor((TCG −
// T₀) × 6969290134 / 10^19), T₀ = 1977-01-01T00:00:32.184, then UTC = TT − 32.184 s − (TAI − UTC).
describe("fromTCG", () => {
  it.each`
    tcgString                              | expected                            | why
    ${"2026-01-01T00:01:10.261661917 TCG"} | ${"2026-01-01T00:00:00Z"}           | ${"TT 00:01:09.184, 69.184 s"}
    ${"1977-01-01T00:00:32.184 TCG"}       | ${"1976-12-31T23:59:45Z"}           | ${"the epoch: TCG = TT"}
    ${"2026-01-01T00:00:00 TCG"}           | ${"2025-12-31T23:58:49.738338132Z"} | ${"TT 23:59:58.922338132"}
    ${"1972-01-01T00:00:42.07398781 TCG"}  | ${"1972-01-01T00:00:00Z"}           | ${"the first instant of the table"}
  `("returns $expected for $tcgString ($why)", ({ tcgString, expected }) => {
    expect(fromTCG(tcgString)).toBe(expected);
  });

  it("returns the inserted second 2016-12-31T23:59:60Z for 2017-01-01T00:01:09.063736307 TCG", () => {
    expect(fromTCG("2017-01-01T00:01:09.063736307 TCG")).toBe(
      "2016-12-31T23:59:60Z",
    );
  });

  // TCG - TT first steps 0 -> 1 ns every 1.43 s of TT, so one TCG nanosecond in 1.4e9 is skipped:
  // ...906 is never written by toTCG and reads as the instant of ...907.
  it.each`
    tcgString                              | expected
    ${"2026-01-01T00:01:10.977576905 TCG"} | ${"2026-01-01T00:00:00.715914988Z"}
    ${"2026-01-01T00:01:10.977576906 TCG"} | ${"2026-01-01T00:00:00.715914989Z"}
    ${"2026-01-01T00:01:10.977576907 TCG"} | ${"2026-01-01T00:00:00.715914989Z"}
  `(
    "returns $expected for the neighbour $tcgString of a skipped nanosecond",
    ({ tcgString, expected }) => {
      expect(fromTCG(tcgString)).toBe(expected);
    },
  );

  it("toTCG of the instant fromTCG gives for the skipped nanosecond is one nanosecond later", () => {
    expect(toTCG("2026-01-01T00:00:00.715914989Z")).toBe(
      "2026-01-01T00:01:10.977576907 TCG",
    );
  });

  // Inserted second of 2016-12-31 (TAI - UTC 36 s): TCG 00:01:09.063736307 to 00:01:10.063736306.
  it.each`
    tcgString                              | expected
    ${"2017-01-01T00:01:09.063736306 TCG"} | ${"2016-12-31T23:59:59.999999999Z"}
    ${"2017-01-01T00:01:09.563736307 TCG"} | ${"2016-12-31T23:59:60.5Z"}
    ${"2017-01-01T00:01:10.063736306 TCG"} | ${"2016-12-31T23:59:60.999999999Z"}
    ${"2017-01-01T00:01:10.063736307 TCG"} | ${"2017-01-01T00:00:00Z"}
    ${"2017-01-01T00:01:10.063736308 TCG"} | ${"2017-01-01T00:00:00.000000001Z"}
  `(
    "returns $expected for $tcgString around the 2016 leap second",
    ({ tcgString, expected }) => {
      expect(fromTCG(tcgString)).toBe(expected);
    },
  );

  // The epoch offset is -1 ns for d in [-1_434_866_364, -1], so the TCG nanosecond at the epoch
  // minus 1 ns is never written by toTCG and reads as the epoch's UTC instant.
  it.each`
    tcgString                              | expected
    ${"1977-01-01T00:00:32.183999998 TCG"} | ${"1976-12-31T23:59:44.999999999Z"}
    ${"1977-01-01T00:00:32.183999999 TCG"} | ${"1976-12-31T23:59:45Z"}
    ${"1977-01-01T00:00:32.184 TCG"}       | ${"1976-12-31T23:59:45Z"}
    ${"1977-01-01T00:00:32.184000001 TCG"} | ${"1976-12-31T23:59:45.000000001Z"}
  `(
    "returns $expected for $tcgString around the skipped nanosecond before the epoch",
    ({ tcgString, expected }) => {
      expect(fromTCG(tcgString)).toBe(expected);
    },
  );

  it.each`
    tcgString                              | expected
    ${"1972-01-01T00:00:42.073987811 TCG"} | ${"1972-01-01T00:00:00.000000001Z"}
    ${"1972-01-01T00:00:42.073987812 TCG"} | ${"1972-01-01T00:00:00.000000002Z"}
    ${"9999-12-31T23:59:59.999999999 TCG"} | ${"9999-12-31T23:55:54.366553435Z"}
    ${"9999-12-31T23:59:59.999999998 TCG"} | ${"9999-12-31T23:55:54.366553434Z"}
    ${"9999-12-31T23:59:05.633446526 TCG"} | ${"9999-12-31T23:55:00Z"}
    ${"2026-01-01T00:01:10.2616619 TCG"}   | ${"2025-12-31T23:59:59.999999983Z"}
  `(
    "returns $expected for $tcgString at a table or range edge",
    ({ tcgString, expected }) => {
      expect(fromTCG(tcgString)).toBe(expected);
    },
  );

  it.each`
    tcgString                               | why
    ${"1972-01-01T00:00:42.073987809 TCG"}  | ${"1 ns before the table's first instant"}
    ${"2026-01-01T00:01:10.261661917 TT"}   | ${"wrong token TT"}
    ${"2026-01-01T00:01:10.261661917 TCB"}  | ${"wrong token TCB"}
    ${"2026-01-01T00:01:10.261661917 TDB"}  | ${"wrong token TDB"}
    ${"2026-01-01T00:01:10.261661917 tcg"}  | ${"lower case"}
    ${"2016-12-31T23:59:60.5 TCG"}          | ${"second 60 with a fraction"}
    ${"2026-01-01T00:01:10.2616619170 TCG"} | ${"ten fraction digits"}
    ${"10000-01-01T00:00:00 TCG"}           | ${"five-digit year"}
    ${"2016-12-31T23:59:60 TCG"}            | ${"TCG has no second 60"}
    ${"2026-01-01T00:01:10.261661917TCG"}   | ${"no space"}
    ${"0000-01-01T00:00:00 TCG"}            | ${"before 1972"}
  `("returns '' for $tcgString ($why)", ({ tcgString }) => {
    expect(fromTCG(tcgString)).toBe("");
  });

  it.each`
    tcgString    | label
    ${123}       | ${"123"}
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${""}        | ${"''"}
  `("returns '' for the non-time-scale $label", ({ tcgString }) => {
    expect(fromTCG(tcgString)).toBe("");
  });

  it("returns '' when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(fromTCG("2026-01-01T00:01:10.261661917 TCG")).toBe("");
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(fromTCG("2026-01-01T00:01:10.261661917 TCG")).toBe("");
  });

  it("returns '' when Temporal.PlainTime.from throws while writing second 60", () => {
    mockTemporalPlainTimeFromThrow();
    expect(fromTCG("2017-01-01T00:01:09.063736307 TCG")).toBe("");
  });
});
