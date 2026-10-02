import { mockTemporalDurationFromThrow } from "../test/mocks";
import {
  exactDurationNanoseconds,
  nonNegativeExactDurationNanoseconds,
} from "./exactDuration";

describe("exactDurationNanoseconds", () => {
  // By hand: 1 h = 3.6e12 ns, 1 min = 6e10 ns, a day is 24 h exactly (TC39 Temporal: a day
  // without a relativeTo is 24 hours). Checked against Temporal.Duration#total("nanoseconds").
  it.each`
    duration                  | expected                      | why
    ${"PT1H"}                 | ${3_600_000_000_000n}         | ${"one hour"}
    ${"-PT5M"}                | ${-300_000_000_000n}          | ${"negative five minutes keeps its sign"}
    ${"P1D"}                  | ${86_400_000_000_000n}        | ${"a day is 24 hours"}
    ${"P1DT2H"}               | ${93_600_000_000_000n}        | ${"26 hours"}
    ${"-P2DT0.5S"}            | ${-172_800_500_000_000n}      | ${"negative days and a fraction"}
    ${"PT0.000000001S"}       | ${1n}                         | ${"one nanosecond"}
    ${"PT1H30M15.123456789S"} | ${5_415_123_456_789n}         | ${"5415 s and every sub-second unit"}
    ${"-PT0S"}                | ${0n}                         | ${"negative zero is zero"}
    ${"P0Y0M0W1D"}            | ${86_400_000_000_000n}        | ${"zero calendar components change nothing"}
    ${"PT4800000000H"}        | ${17280000000000000000000n}   | ${"the whole instant range, past 2^53"}
    ${"pt1h"}                 | ${3_600_000_000_000n}         | ${"lower-case designators, as Temporal reads them"}
    ${"PT0,5H"}               | ${1_800_000_000_000n}         | ${"a comma decimal sign (ISO 8601): half an hour"}
    ${"PT9007199254740991S"}  | ${9007199254740991000000000n} | ${"the largest whole seconds Temporal allows (2^53 − 1 s), exact in bigint"}
  `("reads $duration as $expected ns ($why)", ({ duration, expected }) => {
    expect(exactDurationNanoseconds(duration)).toBe(expected);
  });

  it.each`
    duration                 | why
    ${"P1W"}                 | ${"weeks need a reference point"}
    ${"P1M"}                 | ${"months need a reference point"}
    ${"P1Y"}                 | ${"years need a reference point"}
    ${"P1Y2M3DT4H"}          | ${"any calendar component refuses the whole duration"}
    ${"2 hours"}             | ${"not a duration"}
    ${""}                    | ${"empty"}
    ${"PT9007199254740992S"} | ${"past Temporal's duration limit: 2^53 seconds"}
  `("returns null for $duration ($why)", ({ duration }) => {
    expect(exactDurationNanoseconds(duration)).toBeNull();
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${3600}
    ${{}}
    ${Symbol("x")}
  `("returns null for the non-string $value", ({ value }) => {
    expect(exactDurationNanoseconds(value)).toBeNull();
  });

  it("returns null when the duration parse throws", () => {
    mockTemporalDurationFromThrow();
    expect(exactDurationNanoseconds("PT1H")).toBeNull();
  });
});

describe("nonNegativeExactDurationNanoseconds", () => {
  // exactDurationNanoseconds, with anything below zero refused; -PT0S is zero, not negative.
  it.each`
    duration   | expected               | why
    ${"PT15M"} | ${900_000_000_000n}    | ${"a positive duration"}
    ${"P1D"}   | ${86_400_000_000_000n} | ${"a day is 24 hours"}
    ${"PT0S"}  | ${0n}                  | ${"zero is allowed"}
    ${"-PT0S"} | ${0n}                  | ${"negative zero is zero"}
  `("reads $duration as $expected ns ($why)", ({ duration, expected }) => {
    expect(nonNegativeExactDurationNanoseconds(duration)).toBe(expected);
  });

  it.each`
    duration             | why
    ${"-PT15M"}          | ${"a negative duration"}
    ${"-PT0.000000001S"} | ${"one nanosecond below zero"}
    ${"P1W"}             | ${"a calendar unit"}
    ${"15 minutes"}      | ${"not a duration"}
    ${null}              | ${"a non-string"}
  `("returns null for $duration ($why)", ({ duration }) => {
    expect(nonNegativeExactDurationNanoseconds(duration)).toBeNull();
  });
});
