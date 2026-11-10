import { parseTimeScaleString } from "../../internal";
import { Temporal } from "../../internal/temporal";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalInstantFromThrow,
} from "../../test/mocks";
import { sameInstantBattleCases } from "../../test/timeZoneMatrix";
import { tcgMinusTt } from "../calculate/tcgMinusTt";
import { fromTCG } from "./fromTCG";
import { toTCG } from "./toTCG";
import { toTT } from "./toTT";

// Expected values come from exact bigint arithmetic on IERS TN 36 eq. (10.1), run outside the
// library: TCG − TT = floor(d × L_G / (1 − L_G)), d = TT − 1977-01-01T00:00:32.184, L_G =
// 6969290134 / 10^19 (IAU 2000 B1.9).
describe("toTCG", () => {
  it.each`
    isoString                              | expected                               | why
    ${"2026-01-01T00:00:00Z"}              | ${"2026-01-01T00:01:10.261661917 TCG"} | ${"TT 00:01:09.184, plus 1.077661917 s"}
    ${"2027-01-01T00:00:00Z"}              | ${"2027-01-01T00:01:10.28364027 TCG"}  | ${"plus 1.099640270 s, trailing zero dropped"}
    ${"2000-01-01T12:00:00Z"}              | ${"2000-01-01T12:01:04.68983333 TCG"}  | ${"TT 12:01:04.184, plus 0.505833330 s"}
    ${"1976-12-31T23:59:45Z"}              | ${"1977-01-01T00:00:32.184 TCG"}       | ${"the epoch: TCG = TT (TAI - UTC 15 s)"}
    ${"1975-06-15T12:34:56.789Z"}          | ${"1975-06-15T12:35:42.938950076 TCG"} | ${"TT 12:35:42.973, minus 0.034049924 s (floor of a negative)"}
    ${"1972-01-01T00:00:00Z"}              | ${"1972-01-01T00:00:42.07398781 TCG"}  | ${"TT 00:00:42.184, minus 0.110012190 s"}
    ${"2016-12-31T23:59:59Z"}              | ${"2017-01-01T00:01:08.063736306 TCG"} | ${"TT 00:01:07.184, plus 0.879736306 s"}
    ${"2026-01-01T00:00:00.000000001Z"}    | ${"2026-01-01T00:01:10.261661918 TCG"} | ${"nanoseconds kept"}
    ${"2026-01-01T01:00:00+01:00"}         | ${"2026-01-01T00:01:10.261661917 TCG"} | ${"offset read"}
    ${"2026-01-01T00:00:00Z[Europe/Oslo]"} | ${"2026-01-01T00:01:10.261661917 TCG"} | ${"bracketed zone ignored"}
    ${"9999-12-31T23:55:00Z"}              | ${"9999-12-31T23:59:05.633446526 TCG"} | ${"offset 176.449446526 s by then"}
    ${"9999-12-31T23:55:54.366553435Z"}    | ${"9999-12-31T23:59:59.999999999 TCG"} | ${"last UTC nanosecond whose TCG is in year 9999"}
    ${"9999-12-31T23:55:54.366553434Z"}    | ${"9999-12-31T23:59:59.999999998 TCG"} | ${"one nanosecond before the last"}
    ${"1972-01-01T00:00:00.000000001Z"}    | ${"1972-01-01T00:00:42.073987811 TCG"} | ${"1 ns after the table start; offset still -110012190 ns"}
    ${"2025-12-31T23:58:49.738338132Z"}    | ${"2026-01-01T00:00:00 TCG"}           | ${"whole-second TCG prints no fraction"}
    ${"2016-12-31T23:59:60.5Z"}            | ${"2017-01-01T00:01:09.563736307 TCG"} | ${"fraction inside the inserted second"}
    ${"2016-12-31T23:59:60.999999999Z"}    | ${"2017-01-01T00:01:10.063736306 TCG"} | ${"last nanosecond of the inserted second"}
    ${"2016-12-31T23:59:59.999999999Z"}    | ${"2017-01-01T00:01:09.063736306 TCG"} | ${"last nanosecond before the inserted second"}
    ${"2017-01-01T00:00:00Z"}              | ${"2017-01-01T00:01:10.063736307 TCG"} | ${"first nanosecond after the inserted second"}
    ${"2015-06-30T23:59:60Z"}              | ${"2015-07-01T00:01:08.030618239 TCG"} | ${"inserted second of 2015"}
    ${"1972-06-30T23:59:60Z"}              | ${"1972-07-01T00:00:42.08494688 TCG"}  | ${"first inserted second (TAI - UTC 10 s)"}
    ${"1972-12-31T23:59:60Z"}              | ${"1973-01-01T00:00:43.096026379 TCG"} | ${"inserted second of 1972-12-31 (TAI - UTC 11 s)"}
  `("returns $expected for $isoString ($why)", ({ isoString, expected }) => {
    expect(toTCG(isoString)).toBe(expected);
  });

  it("maps the inserted second 2016-12-31T23:59:60Z to its own TCG instant", () => {
    expect(toTCG("2016-12-31T23:59:60Z")).toBe(
      "2017-01-01T00:01:09.063736307 TCG",
    );
  });

  it.each`
    isoString                           | why
    ${"9999-12-31T23:56:00Z"}           | ${"TCG passes 10000-01-01 while TT does not"}
    ${"2017-12-31T23:59:60Z"}           | ${"second 60 with no insertion that day"}
    ${"1971-12-31T23:59:59Z"}           | ${"before 1972"}
    ${"+275760-09-13T00:00:00Z"}        | ${"Temporal's last instant"}
    ${"9999-12-31T23:55:54.366553436Z"} | ${"first UTC nanosecond whose TCG is 10000-01-01T00:00:00"}
    ${"1971-12-31T23:59:59.999999999Z"} | ${"1 ns before 1972-01-01"}
    ${"1972-12-31T23:59:60.5+01:00"}    | ${"second 60 where the offset-shifted instant is no leap second"}
    ${"2016-12-31T23:59:61Z"}           | ${"second 61"}
  `("returns '' for $isoString ($why)", ({ isoString }) => {
    expect(toTCG(isoString)).toBe("");
  });

  it.each`
    isoString                | label
    ${null}                  | ${"null"}
    ${undefined}             | ${"undefined"}
    ${123}                   | ${"123"}
    ${""}                    | ${"''"}
    ${"garbage"}             | ${"'garbage'"}
    ${"2026-01-01"}          | ${"'2026-01-01'"}
    ${"2026-01-01T00:00:00"} | ${"'2026-01-01T00:00:00'"}
  `("returns '' for the invalid $label", ({ isoString }) => {
    expect(toTCG(isoString)).toBe("");
  });

  it.each(sameInstantBattleCases)(
    "returns 2024-02-29T00:01:10.221197661 TCG for 2024-02-29T00:00:00Z written in $timeZone",
    ({ value }) => {
      expect(toTCG(value)).toBe("2024-02-29T00:01:10.221197661 TCG");
    },
  );

  it("returns '' when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(toTCG("2016-12-31T23:59:60Z")).toBe("");
  });

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws while writing", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(toTCG("2026-01-01T00:00:00Z")).toBe("");
  });
});

describe("toTCG against eq. (10.1) in exact arithmetic", () => {
  const epoch = 220_924_832_184_000_000n; // 1977-01-01T00:00:32.184 as epoch-style nanoseconds
  const offset = (tt: bigint): bigint => {
    const numerator = (tt - epoch) * 6_969_290_134n;
    const denominator = 10n ** 19n - 6_969_290_134n;
    const quotient = numerator / denominator;
    return numerator % denominator !== 0n && numerator < 0n
      ? quotient - 1n
      : quotient;
  };

  it("TCG − TT at 2050-07-01T00:00:00.123456789Z is the floored eq. (10.1) offset", () => {
    const isoString = "2050-07-01T00:00:00.123456789Z";
    const tt = parseTimeScaleString(toTT(isoString), "TT")!.labelNanoseconds;
    const tcg = parseTimeScaleString(toTCG(isoString), "TCG")!.labelNanoseconds;
    expect(tcg - tt).toBe(offset(tt));
  });

  // 1977-01-01T00:00:00 TAI is 1976-12-31T23:59:45 UTC (TAI - UTC 15 s). The offset floor(d x L_G /
  // (1 - L_G)) steps 0 -> 1 ns at d = 1_434_866_364 ns and 1 -> 2 at d = 2_869_732_728 ns, and is
  // -1 ns for any d in [-1_434_866_364, -1], so the TCG nanosecond at the epoch minus 1 ns is skipped.
  it.each`
    isoString                           | expected
    ${"1976-12-31T23:59:44.999999998Z"} | ${"1977-01-01T00:00:32.183999997 TCG"}
    ${"1976-12-31T23:59:44.999999999Z"} | ${"1977-01-01T00:00:32.183999998 TCG"}
    ${"1976-12-31T23:59:45Z"}           | ${"1977-01-01T00:00:32.184 TCG"}
    ${"1976-12-31T23:59:46.434866363Z"} | ${"1977-01-01T00:00:33.618866363 TCG"}
    ${"1976-12-31T23:59:46.434866364Z"} | ${"1977-01-01T00:00:33.618866365 TCG"}
    ${"1976-12-31T23:59:47.869732727Z"} | ${"1977-01-01T00:00:35.053732728 TCG"}
    ${"1976-12-31T23:59:47.869732728Z"} | ${"1977-01-01T00:00:35.05373273 TCG"}
  `(
    "returns $expected for $isoString around the epoch",
    ({ isoString, expected }) => {
      expect(toTCG(isoString)).toBe(expected);
    },
  );
});

// Wiring check only: both sides share tcgMinusTtNanoseconds. The independent proof is the exact
// eq. (10.1) block above.
describe("toTCG against toTT and tcgMinusTt", () => {
  it.each`
    isoString
    ${"2026-01-01T00:00:00Z"}
    ${"2027-01-01T00:00:00Z"}
    ${"2000-01-01T12:00:00Z"}
    ${"1976-12-31T23:59:45Z"}
    ${"1975-06-15T12:34:56.789Z"}
    ${"1972-01-01T00:00:00Z"}
    ${"2016-12-31T23:59:59Z"}
    ${"2016-12-31T23:59:60Z"}
    ${"2026-01-01T00:00:00.000000001Z"}
    ${"9999-12-31T23:55:00Z"}
  `("toTCG − toTT equals tcgMinusTt for $isoString", ({ isoString }) => {
    const tcg = parseTimeScaleString(toTCG(isoString), "TCG")!.labelNanoseconds;
    const tt = parseTimeScaleString(toTT(isoString), "TT")!.labelNanoseconds;
    expect(tcg - tt).toBe(BigInt(Math.round(tcgMinusTt(isoString)! * 1e9)));
  });
});

describe("toTCG and fromTCG round trip", () => {
  it.each`
    iso
    ${"2026-01-01T00:00:00Z"}
    ${"2027-01-01T00:00:00Z"}
    ${"2000-01-01T12:00:00Z"}
    ${"1976-12-31T23:59:45Z"}
    ${"1975-06-15T12:34:56.789Z"}
    ${"1972-01-01T00:00:00Z"}
    ${"2016-12-31T23:59:59Z"}
    ${"2016-12-31T23:59:60Z"}
    ${"2026-01-01T00:00:00.000000001Z"}
    ${"2026-01-01T00:00:00.999999999Z"}
    ${"2025-12-31T23:59:59.999999999Z"}
    ${"9999-12-31T23:55:00Z"}
    ${"9999-12-31T23:55:54.366553435Z"}
    ${"2016-12-31T23:59:60.5Z"}
    ${"2016-12-31T23:59:60.999999999Z"}
    ${"1972-01-01T00:00:00.000000001Z"}
    ${"1976-12-31T23:59:44.999999999Z"}
  `("fromTCG(toTCG($iso)) returns $iso", ({ iso }) => {
    expect(fromTCG(toTCG(iso))).toBe(iso);
  });

  it("fromTCG(toTCG(x)) is x for 1,000 instants from 1972 to 2100 with seeded nanoseconds", () => {
    const start = Temporal.Instant.from(
      "1972-01-01T00:00:00Z",
    ).epochNanoseconds;
    const end = Temporal.Instant.from("2100-01-01T00:00:00Z").epochNanoseconds;
    let seed = 123_456_789n;
    for (let i = 0n; i < 1000n; i += 1n) {
      seed =
        (seed * 6_364_136_223_846_793_005n + 1_442_695_040_888_963_407n) %
        2n ** 64n;
      const instant = Temporal.Instant.fromEpochNanoseconds(
        start + ((end - start) * i) / 1000n + (seed % 1_000_000_000n),
      ).toString();
      expect(fromTCG(toTCG(instant))).toBe(instant);
    }
  });
});
