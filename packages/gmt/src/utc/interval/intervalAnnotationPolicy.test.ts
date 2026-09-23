import { intervalAbutsUtc } from "./intervalAbutsUtc";
import { intervalContainsUtc } from "./intervalContainsUtc";
import { intervalCountUtc } from "./intervalCountUtc";
import { intervalDifferenceUtc } from "./intervalDifferenceUtc";
import { intervalDivideEquallyUtc } from "./intervalDivideEquallyUtc";
import { intervalEngulfsUtc } from "./intervalEngulfsUtc";
import { intervalFromDurationUtc } from "./intervalFromDurationUtc";
import { intervalIntersectionUtc } from "./intervalIntersectionUtc";
import { intervalLengthUtc } from "./intervalLengthUtc";
import { intervalOverlappingDaysUtc } from "./intervalOverlappingDaysUtc";
import { intervalSplitAtUtc } from "./intervalSplitAtUtc";
import { intervalUnionUtc } from "./intervalUnionUtc";
import { intervalXorAllUtc } from "./intervalXorAllUtc";
import { intervalXorUtc } from "./intervalXorUtc";
import { intervalsOverlapUtc } from "./intervalsOverlapUtc";
import { mergeIntervalsUtc } from "./mergeIntervalsUtc";
import { splitIntervalByUnitUtc } from "./splitIntervalByUnitUtc";
import { isValidUtcInterval } from "./validate";

// Validator mirror (#22) — a UTC interval endpoint accepts exactly what `isValidUtc`
// accepts, so the annotation rules are tested once as a policy over every UTC interval function.
// `Temporal.Instant.from` (proposal-temporal ParseTemporalInstantString; RFC 9557 §3.3) ignores a
// time zone annotation, any calendar annotation (critical or not — an instant has no calendar) and
// an elective unknown annotation, and rejects an unknown critical annotation. Native Temporal
// (Chromium 153): `2024-01-01T09:00:00Z[u-ca=iso8601]`, `…T12:00:00Z[!u-ca=hebrew]`,
// `…T12:00:00Z[foo=bar]` and `…T12:00:00Z[UTC]` give the same epoch nanoseconds as the unannotated
// strings; `…Z[!foo=bar]` throws a RangeError. So each accepted row's expected value is the
// unannotated inputs' value (the JSDoc example values of each function), and outputs are
// `Temporal.Instant#toString()`'s canonical strings, annotation dropped.
const ICA = "[u-ca=iso8601]";
const EL = "[foo=bar]";
const HEB = "[!u-ca=hebrew]";
const TZ = "[Asia/Tokyo]";
const CRIT = "[!foo=bar]";
const z = (time: string, annotation = "", date = "2024-01-01") =>
  `${date}T${time}Z${annotation}`;

describe("UTC intervals: annotations Temporal.Instant.from ignores are accepted", () => {
  it.each`
    name                            | call                                                                                                                                          | expected
    ${"isValidUtcInterval"}         | ${() => isValidUtcInterval(z("09:00:00", ICA), z("17:00:00", HEB))}                                                                           | ${true}
    ${"intervalAbutsUtc"}           | ${() => intervalAbutsUtc(z("09:00:00", ICA), z("12:00:00", EL), z("12:00:00", HEB), z("17:00:00", TZ))}                                       | ${true}
    ${"intervalContainsUtc"}        | ${() => intervalContainsUtc(z("09:00:00", ICA), z("17:00:00", EL), z("12:00:00", HEB))}                                                       | ${true}
    ${"intervalContainsUtc (4)"}    | ${() => intervalContainsUtc(z("09:00:00", ICA), z("17:00:00", EL), z("12:00:00", HEB), z("13:00:00", TZ))}                                    | ${true}
    ${"intervalCountUtc"}           | ${() => intervalCountUtc(z("23:59:00", ICA), z("00:01:00", HEB, "2024-01-02"), "day")}                                                        | ${2}
    ${"intervalDifferenceUtc"}      | ${() => intervalDifferenceUtc(z("09:00:00", ICA), z("17:00:00", EL), z("12:00:00", HEB), z("13:00:00", TZ))}                                  | ${[{ start: z("09:00:00"), end: z("12:00:00") }, { start: z("13:00:00"), end: z("17:00:00") }]}
    ${"intervalDivideEquallyUtc"}   | ${() => intervalDivideEquallyUtc(z("09:00:00", ICA), z("13:00:00", HEB), 2)}                                                                  | ${[{ start: z("09:00:00"), end: z("11:00:00") }, { start: z("11:00:00"), end: z("13:00:00") }]}
    ${"intervalEngulfsUtc"}         | ${() => intervalEngulfsUtc(z("09:00:00", ICA), z("17:00:00", EL), z("12:00:00", HEB), z("13:00:00", TZ))}                                     | ${true}
    ${"intervalFromDurationUtc"}    | ${() => intervalFromDurationUtc(z("00:00:00", HEB), "P1D", "start")}                                                                          | ${{ start: z("00:00:00"), end: z("00:00:00", "", "2024-01-02") }}
    ${"intervalIntersectionUtc"}    | ${() => intervalIntersectionUtc(z("09:00:00", ICA), z("13:00:00", EL), z("12:00:00", HEB), z("17:00:00", TZ))}                                | ${{ start: z("12:00:00"), end: z("13:00:00") }}
    ${"intervalLengthUtc"}          | ${() => intervalLengthUtc(z("23:59:00", ICA), z("00:01:00", HEB, "2024-01-02"), "minute")}                                                    | ${2}
    ${"intervalOverlappingDaysUtc"} | ${() => intervalOverlappingDaysUtc(z("23:59:00", ICA), z("00:01:00", EL, "2024-01-02"), z("23:59:00", HEB), z("00:01:00", TZ, "2024-01-02"))} | ${2}
    ${"intervalSplitAtUtc"}         | ${() => intervalSplitAtUtc(z("09:00:00", ICA), z("17:00:00", EL), [z("12:00:00", HEB)])}                                                      | ${[{ start: z("09:00:00"), end: z("12:00:00") }, { start: z("12:00:00"), end: z("17:00:00") }]}
    ${"intervalUnionUtc"}           | ${() => intervalUnionUtc(z("09:00:00", ICA), z("13:00:00", EL), z("12:00:00", HEB), z("17:00:00", TZ))}                                       | ${{ start: z("09:00:00"), end: z("17:00:00") }}
    ${"intervalXorAllUtc"}          | ${() => intervalXorAllUtc([{ start: z("09:00:00", ICA), end: z("13:00:00", EL) }, { start: z("12:00:00", HEB), end: z("17:00:00", TZ) }])}    | ${[{ start: z("09:00:00"), end: z("12:00:00") }, { start: z("13:00:00"), end: z("17:00:00") }]}
    ${"intervalXorUtc"}             | ${() => intervalXorUtc(z("09:00:00", ICA), z("13:00:00", EL), z("12:00:00", HEB), z("17:00:00", TZ))}                                         | ${[{ start: z("09:00:00"), end: z("12:00:00") }, { start: z("13:00:00"), end: z("17:00:00") }]}
    ${"intervalsOverlapUtc"}        | ${() => intervalsOverlapUtc(z("09:00:00", ICA), z("13:00:00", EL), z("12:00:00", HEB), z("17:00:00", TZ))}                                    | ${true}
    ${"mergeIntervalsUtc"}          | ${() => mergeIntervalsUtc([{ start: z("09:00:00", ICA), end: z("12:00:00", EL) }, { start: z("12:00:00", HEB), end: z("17:00:00", TZ) }])}    | ${[{ start: z("09:00:00"), end: z("17:00:00") }]}
    ${"splitIntervalByUnitUtc"}     | ${() => splitIntervalByUnitUtc(z("00:00:00", ICA), z("01:30:00", HEB), "hour", 1)}                                                            | ${[{ start: z("00:00:00"), end: z("01:00:00") }, { start: z("01:00:00"), end: z("01:30:00") }]}
  `(
    "$name reads annotated endpoints as their unannotated instants and returns $expected",
    ({ call, expected }) => {
      expect((call as () => unknown)()).toEqual(expected);
    },
  );

  it.each`
    name                            | call                                                                                                                                      | sentinel
    ${"isValidUtcInterval"}         | ${() => isValidUtcInterval(z("09:00:00", CRIT), z("17:00:00"))}                                                                           | ${false}
    ${"intervalAbutsUtc"}           | ${() => intervalAbutsUtc(z("09:00:00"), z("12:00:00"), z("12:00:00"), z("17:00:00", CRIT))}                                               | ${false}
    ${"intervalContainsUtc"}        | ${() => intervalContainsUtc(z("09:00:00"), z("17:00:00"), z("12:00:00", CRIT))}                                                           | ${false}
    ${"intervalContainsUtc (4)"}    | ${() => intervalContainsUtc(z("09:00:00"), z("17:00:00"), z("12:00:00"), z("13:00:00", CRIT))}                                            | ${false}
    ${"intervalCountUtc"}           | ${() => intervalCountUtc(z("23:59:00"), z("00:01:00", CRIT, "2024-01-02"), "day")}                                                        | ${null}
    ${"intervalDifferenceUtc"}      | ${() => intervalDifferenceUtc(z("09:00:00"), z("17:00:00"), z("12:00:00", CRIT), z("13:00:00"))}                                          | ${[]}
    ${"intervalDivideEquallyUtc"}   | ${() => intervalDivideEquallyUtc(z("09:00:00", CRIT), z("13:00:00"), 2)}                                                                  | ${[]}
    ${"intervalEngulfsUtc"}         | ${() => intervalEngulfsUtc(z("09:00:00"), z("17:00:00"), z("12:00:00"), z("13:00:00", CRIT))}                                             | ${false}
    ${"intervalFromDurationUtc"}    | ${() => intervalFromDurationUtc(z("00:00:00", CRIT), "P1D", "start")}                                                                     | ${null}
    ${"intervalIntersectionUtc"}    | ${() => intervalIntersectionUtc(z("09:00:00"), z("13:00:00"), z("12:00:00"), z("17:00:00", CRIT))}                                        | ${null}
    ${"intervalLengthUtc"}          | ${() => intervalLengthUtc(z("23:59:00", CRIT), z("00:01:00", "", "2024-01-02"), "minute")}                                                | ${null}
    ${"intervalOverlappingDaysUtc"} | ${() => intervalOverlappingDaysUtc(z("23:59:00"), z("00:01:00", "", "2024-01-02"), z("23:59:00", CRIT), z("00:01:00", "", "2024-01-02"))} | ${null}
    ${"intervalSplitAtUtc"}         | ${() => intervalSplitAtUtc(z("09:00:00"), z("17:00:00"), [z("12:00:00", CRIT)])}                                                          | ${[]}
    ${"intervalUnionUtc"}           | ${() => intervalUnionUtc(z("09:00:00"), z("13:00:00"), z("12:00:00"), z("17:00:00", CRIT))}                                               | ${null}
    ${"intervalXorAllUtc"}          | ${() => intervalXorAllUtc([{ start: z("09:00:00"), end: z("13:00:00") }, { start: z("12:00:00", CRIT), end: z("17:00:00") }])}            | ${[]}
    ${"intervalXorUtc"}             | ${() => intervalXorUtc(z("09:00:00"), z("13:00:00"), z("12:00:00", CRIT), z("17:00:00"))}                                                 | ${[]}
    ${"intervalsOverlapUtc"}        | ${() => intervalsOverlapUtc(z("09:00:00", CRIT), z("13:00:00"), z("12:00:00"), z("17:00:00"))}                                            | ${false}
    ${"mergeIntervalsUtc"}          | ${() => mergeIntervalsUtc([{ start: z("09:00:00"), end: z("12:00:00") }, { start: z("12:00:00"), end: z("17:00:00", CRIT) }])}            | ${[]}
    ${"splitIntervalByUnitUtc"}     | ${() => splitIntervalByUnitUtc(z("00:00:00"), z("01:30:00", CRIT), "hour", 1)}                                                            | ${[]}
  `(
    "$name returns $sentinel for an unknown critical annotation",
    ({ call, sentinel }) => {
      expect((call as () => unknown)()).toEqual(sentinel);
    },
  );
});
