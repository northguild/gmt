import { formatUtcOffset } from "../../internal/utcOffsetString";
import { Temporal } from "../../internal/temporal";
import { localNoonBattleCases, sameInstantBattleCases } from "../../test";
import type { StoredZonedClassification } from "../../types";
import { classifyStoredZoned } from "./classifyStoredZoned";

type Row = { input: string; expected: StoredZonedClassification };

const valid = (
  input: string,
  instant: string,
  atStoredOffset: string = instant,
): Row => ({ input, expected: { kind: "valid", instant, atStoredOffset } });

const validInOverlap = (
  input: string,
  instant: string,
  earlier: string,
  later: string,
  atStoredOffset: string,
): Row => ({
  input,
  expected: { kind: "validInOverlap", instant, earlier, later, atStoredOffset },
});

const ambiguous = (
  input: string,
  earlier: string,
  later: string,
  atStoredOffset: string,
): Row => ({
  input,
  expected: { kind: "ambiguous", earlier, later, atStoredOffset },
});

const nonexistent = (
  input: string,
  earlier: string,
  later: string,
  atStoredOffset: string,
): Row => ({
  input,
  expected: { kind: "nonexistent", earlier, later, atStoredOffset },
});

const offsetMismatch = (
  input: string,
  storedOffset: string,
  zoneOffset: string,
  atStoredOffset: string,
  atZoneOffset: string,
): Row => ({
  input,
  expected: {
    kind: "offsetMismatch",
    storedOffset,
    zoneOffset,
    atStoredOffset,
    atZoneOffset,
  },
});

// Europe/Istanbul: Turkey moved to permanent +03 on 2016-09-07 (tzdb 2016g).
const istanbul: Row[] = [
  validInOverlap(
    "2015-11-08T03:30:00+03:00[Europe/Istanbul]",
    "2015-11-08T00:30:00Z",
    "2015-11-08T00:30:00Z",
    "2015-11-08T01:30:00Z",
    "2015-11-08T00:30:00Z",
  ),
  validInOverlap(
    "2015-11-08T03:30:00+02:00[Europe/Istanbul]",
    "2015-11-08T01:30:00Z",
    "2015-11-08T00:30:00Z",
    "2015-11-08T01:30:00Z",
    "2015-11-08T01:30:00Z",
  ),
  ambiguous(
    "2015-11-08T03:30:00+01:00[Europe/Istanbul]",
    "2015-11-08T00:30:00Z",
    "2015-11-08T01:30:00Z",
    "2015-11-08T02:30:00Z",
  ),
  nonexistent(
    "2016-03-27T03:30:00+03:00[Europe/Istanbul]",
    "2016-03-27T00:30:00Z",
    "2016-03-27T01:30:00Z",
    "2016-03-27T00:30:00Z",
  ),
  offsetMismatch(
    "2016-10-30T03:30:00+02:00[Europe/Istanbul]",
    "+02:00",
    "+03:00",
    "2016-10-30T01:30:00Z",
    "2016-10-30T00:30:00Z",
  ),
  offsetMismatch(
    "2016-12-01T09:00:00+02:00[Europe/Istanbul]",
    "+02:00",
    "+03:00",
    "2016-12-01T07:00:00Z",
    "2016-12-01T06:00:00Z",
  ),
  valid("2016-12-01T09:00:00+03:00[Europe/Istanbul]", "2016-12-01T06:00:00Z"),
];

// Africa/Casablanca: Morocco moved to permanent +01 on 2018-10-28 (tzdb 2018g).
const casablanca: Row[] = [
  nonexistent(
    "2018-06-17T02:30:00+00:00[Africa/Casablanca]",
    "2018-06-17T01:30:00Z",
    "2018-06-17T02:30:00Z",
    "2018-06-17T02:30:00Z",
  ),
  offsetMismatch(
    "2018-10-28T02:30:00+00:00[Africa/Casablanca]",
    "+00:00",
    "+01:00",
    "2018-10-28T02:30:00Z",
    "2018-10-28T01:30:00Z",
  ),
  offsetMismatch(
    "2018-12-01T09:00:00+00:00[Africa/Casablanca]",
    "+00:00",
    "+01:00",
    "2018-12-01T09:00:00Z",
    "2018-12-01T08:00:00Z",
  ),
  valid("2018-12-01T09:00:00+01:00[Africa/Casablanca]", "2018-12-01T08:00:00Z"),
  validInOverlap(
    "2019-05-05T02:30:00+00:00[Africa/Casablanca]",
    "2019-05-05T02:30:00Z",
    "2019-05-05T01:30:00Z",
    "2019-05-05T02:30:00Z",
    "2019-05-05T02:30:00Z",
  ),
  ambiguous(
    "2019-05-05T02:30:00+02:00[Africa/Casablanca]",
    "2019-05-05T01:30:00Z",
    "2019-05-05T02:30:00Z",
    "2019-05-05T00:30:00Z",
  ),
  nonexistent(
    "2019-06-09T02:30:00+01:00[Africa/Casablanca]",
    "2019-06-09T01:30:00Z",
    "2019-06-09T02:30:00Z",
    "2019-06-09T01:30:00Z",
  ),
];

// America/Sao_Paulo: Brazil ended DST in 2019 (tzdb 2019b).
const saoPaulo: Row[] = [
  nonexistent(
    "2018-11-04T00:30:00-03:00[America/Sao_Paulo]",
    "2018-11-04T02:30:00Z",
    "2018-11-04T03:30:00Z",
    "2018-11-04T03:30:00Z",
  ),
  validInOverlap(
    "2019-02-16T23:30:00-02:00[America/Sao_Paulo]",
    "2019-02-17T01:30:00Z",
    "2019-02-17T01:30:00Z",
    "2019-02-17T02:30:00Z",
    "2019-02-17T01:30:00Z",
  ),
  validInOverlap(
    "2019-02-16T23:30:00-03:00[America/Sao_Paulo]",
    "2019-02-17T02:30:00Z",
    "2019-02-17T01:30:00Z",
    "2019-02-17T02:30:00Z",
    "2019-02-17T02:30:00Z",
  ),
  ambiguous(
    "2019-02-16T23:30:00-04:00[America/Sao_Paulo]",
    "2019-02-17T01:30:00Z",
    "2019-02-17T02:30:00Z",
    "2019-02-17T03:30:00Z",
  ),
  valid("2019-11-03T00:30:00-03:00[America/Sao_Paulo]", "2019-11-03T03:30:00Z"),
  offsetMismatch(
    "2020-01-15T12:00:00-02:00[America/Sao_Paulo]",
    "-02:00",
    "-03:00",
    "2020-01-15T14:00:00Z",
    "2020-01-15T15:00:00Z",
  ),
];

// The issue's `use` rows, and half-hour, 45-minute and whole-day gaps.
const gapsAndOverlaps: Row[] = [
  nonexistent(
    "2026-03-08T02:30:00-03:00[America/Los_Angeles]",
    "2026-03-08T09:30:00Z",
    "2026-03-08T10:30:00Z",
    "2026-03-08T05:30:00Z",
  ),
  ambiguous(
    "2026-11-01T01:30:00-03:00[America/Los_Angeles]",
    "2026-11-01T08:30:00Z",
    "2026-11-01T09:30:00Z",
    "2026-11-01T04:30:00Z",
  ),
  validInOverlap(
    "2026-11-01T01:30:00-08:00[America/Los_Angeles]",
    "2026-11-01T09:30:00Z",
    "2026-11-01T08:30:00Z",
    "2026-11-01T09:30:00Z",
    "2026-11-01T09:30:00Z",
  ),
  validInOverlap(
    "2026-11-01T01:30:00-07:00[America/Los_Angeles]",
    "2026-11-01T08:30:00Z",
    "2026-11-01T08:30:00Z",
    "2026-11-01T09:30:00Z",
    "2026-11-01T08:30:00Z",
  ),
  nonexistent(
    "2024-10-06T02:15:00+10:30[Australia/Lord_Howe]",
    "2024-10-05T15:15:00Z",
    "2024-10-05T15:45:00Z",
    "2024-10-05T15:45:00Z",
  ),
  validInOverlap(
    "2024-04-07T01:45:00+10:30[Australia/Lord_Howe]",
    "2024-04-06T15:15:00Z",
    "2024-04-06T14:45:00Z",
    "2024-04-06T15:15:00Z",
    "2024-04-06T15:15:00Z",
  ),
  ambiguous(
    "2024-04-07T01:45:00+10:00[Australia/Lord_Howe]",
    "2024-04-06T14:45:00Z",
    "2024-04-06T15:15:00Z",
    "2024-04-06T15:45:00Z",
  ),
  nonexistent(
    "2024-09-29T03:15:00+12:45[Pacific/Chatham]",
    "2024-09-28T13:30:00Z",
    "2024-09-28T14:30:00Z",
    "2024-09-28T14:30:00Z",
  ),
  nonexistent(
    "2024-09-29T03:15:00+13:45[Pacific/Chatham]",
    "2024-09-28T13:30:00Z",
    "2024-09-28T14:30:00Z",
    "2024-09-28T13:30:00Z",
  ),
  // A deleted day: Samoa skipped 2011-12-30.
  nonexistent(
    "2011-12-30T12:00:00+14:00[Pacific/Apia]",
    "2011-12-29T22:00:00Z",
    "2011-12-30T22:00:00Z",
    "2011-12-29T22:00:00Z",
  ),
  nonexistent(
    "2011-12-30T12:00:00-10:00[Pacific/Apia]",
    "2011-12-29T22:00:00Z",
    "2011-12-30T22:00:00Z",
    "2011-12-30T22:00:00Z",
  ),
  // A zone with no DST.
  valid("2024-07-15T12:00:00+09:00[Asia/Tokyo]", "2024-07-15T03:00:00Z"),
];

// `Z` is exact (RFC 9557 §3.4 Figure 2) and `-00:00` is a numeric offset (Temporal §6.5.2).
const zAndZero: Row[] = [
  valid("2022-07-08T00:14:07Z[Europe/London]", "2022-07-08T00:14:07Z"),
  // 01:30 read as New York wall time is in an overlap, but `Z` names no wall time to check.
  valid("2024-11-03T01:30:00Z[America/New_York]", "2024-11-03T01:30:00Z"),
  offsetMismatch(
    "2022-07-08T00:14:07+00:00[!Europe/London]",
    "+00:00",
    "+01:00",
    "2022-07-08T00:14:07Z",
    "2022-07-07T23:14:07Z",
  ),
  offsetMismatch(
    "2022-07-08T00:14:07-00:00[Europe/London]",
    "+00:00",
    "+01:00",
    "2022-07-08T00:14:07Z",
    "2022-07-07T23:14:07Z",
  ),
];

// Minute-rounded offsets (rule 9) and offsets written with seconds (D12).
const subMinute: Row[] = [
  valid(
    "1960-01-01T00:20:00-00:45[Africa/Monrovia]",
    "1960-01-01T01:04:30Z",
    "1960-01-01T01:05:00Z",
  ),
  valid(
    "1960-01-01T00:20:00-00:44:30[Africa/Monrovia]",
    "1960-01-01T01:04:30Z",
  ),
  offsetMismatch(
    "1960-01-01T00:20:00-00:46[Africa/Monrovia]",
    "-00:46",
    "-00:44:30",
    "1960-01-01T01:06:00Z",
    "1960-01-01T01:04:30Z",
  ),
  // Written with seconds, so it matches exactly and `-00:45:00` is not the zone's `-00:44:30`.
  offsetMismatch(
    "1960-01-01T00:20:00-00:45:00[Africa/Monrovia]",
    "-00:45:00",
    "-00:44:30",
    "1960-01-01T01:05:00Z",
    "1960-01-01T01:04:30Z",
  ),
  // storedOffset keeps the seconds as written: `:00` stays, and a nonzero seconds part is exact.
  offsetMismatch(
    "1960-01-01T00:20:00-00:44:31[Africa/Monrovia]",
    "-00:44:31",
    "-00:44:30",
    "1960-01-01T01:04:31Z",
    "1960-01-01T01:04:30Z",
  ),
  offsetMismatch(
    "2022-07-08T00:14:07+00:00:00[Europe/London]",
    "+00:00:00",
    "+01:00",
    "2022-07-08T00:14:07Z",
    "2022-07-07T23:14:07Z",
  ),
  // Written with seconds and equal to the zone's offset: valid, and no storedOffset to report.
  valid("2022-07-08T00:14:07+01:00:00[Europe/London]", "2022-07-07T23:14:07Z"),
  // The first pass wins for a minute-rounded offset.
  validInOverlap(
    "1952-10-15T23:59:59-11:20[Pacific/Niue]",
    "1952-10-16T11:19:39Z",
    "1952-10-16T11:19:39Z",
    "1952-10-16T11:19:59Z",
    "1952-10-16T11:19:59Z",
  ),
  // An exact match names the second pass.
  validInOverlap(
    "1952-10-15T23:59:59-11:20:00[Pacific/Niue]",
    "1952-10-16T11:19:59Z",
    "1952-10-16T11:19:39Z",
    "1952-10-16T11:19:59Z",
    "1952-10-16T11:19:59Z",
  ),
];

// Wall clocks on and next to a transition: 2026-03-08 gap 02:00-03:00 (PST to PDT at 10:00Z)
// and 2026-11-01 overlap 01:00-02:00 (PDT to PST at 09:00Z), both from the US rule since 2007.
const transitionEdges: Row[] = [
  nonexistent(
    "2026-03-08T02:00:00-08:00[America/Los_Angeles]",
    "2026-03-08T09:00:00Z",
    "2026-03-08T10:00:00Z",
    "2026-03-08T10:00:00Z",
  ),
  valid(
    "2026-03-08T03:00:00-07:00[America/Los_Angeles]",
    "2026-03-08T10:00:00Z",
  ),
  validInOverlap(
    "2026-11-01T01:00:00-07:00[America/Los_Angeles]",
    "2026-11-01T08:00:00Z",
    "2026-11-01T08:00:00Z",
    "2026-11-01T09:00:00Z",
    "2026-11-01T08:00:00Z",
  ),
  valid(
    "2026-11-01T02:00:00-08:00[America/Los_Angeles]",
    "2026-11-01T10:00:00Z",
  ),
  // `Z` is exact inside a gap as well as inside an overlap.
  valid("2026-03-08T02:30:00Z[America/Los_Angeles]", "2026-03-08T02:30:00Z"),
];

// A fraction of a second is kept in every reading.
const fractions: Row[] = [
  valid(
    "2022-07-08T00:14:07.123456789+01:00[Europe/London]",
    "2022-07-07T23:14:07.123456789Z",
  ),
  offsetMismatch(
    "2022-07-08T00:14:07.123456789+00:00[Europe/London]",
    "+00:00",
    "+01:00",
    "2022-07-08T00:14:07.123456789Z",
    "2022-07-07T23:14:07.123456789Z",
  ),
];

// The first and last instants of the range, and the local dates next to the first. The first
// instant is -271821-04-20T00:00:00Z. New York's pre-1883 offset is -04:56:02 (tzdb LMT), so
// 04:56:00 local there is 09:52:02Z, and 00:00 local there is 04:56:02Z.
const rangeEdge: Row[] = [
  valid("+275760-09-13T00:00:00+00:00[UTC]", "+275760-09-13T00:00:00Z"),
  valid("+275760-09-12T23:59:00+00:00[UTC]", "+275760-09-12T23:59:00Z"),
  valid("-271821-04-20T00:00:00+00:00[UTC]", "-271821-04-20T00:00:00Z"),
  valid("-271821-04-20T00:00:00Z[UTC]", "-271821-04-20T00:00:00Z"),
  // `Z` is exact (Temporal §6.5.2) and §6.5.1 step 4 checks the range of the UTC date only, so
  // `Z[zone]` is valid at both limits, though the zone's wall clock falls outside the range.
  ...[
    "Asia/Tokyo",
    "Pacific/Apia",
    "America/Los_Angeles",
    "America/New_York",
    "UTC",
  ].flatMap((zone) =>
    ["-271821-04-20T00:00:00Z", "+275760-09-13T00:00:00Z"].map((instant) =>
      valid(`${instant}[${zone}]`, instant),
    ),
  ),
  // A local date next to the refused one, in a zone west of Greenwich.
  valid(
    "-271821-04-20T04:56:00-04:56[America/New_York]",
    "-271821-04-20T09:52:02Z",
    "-271821-04-20T09:52:00Z",
  ),
  offsetMismatch(
    "-271821-04-20T00:00:00-04:00[America/New_York]",
    "-04:00",
    "-04:56:02",
    "-271821-04-20T04:00:00Z",
    "-271821-04-20T04:56:02Z",
  ),
];

const groups = {
  "Europe/Istanbul (tzdb 2016g)": istanbul,
  "Africa/Casablanca (tzdb 2018g)": casablanca,
  "America/Sao_Paulo (tzdb 2019b)": saoPaulo,
  "gaps and overlaps": gapsAndOverlaps,
  "Z and -00:00": zAndZero,
  "minute-rounded and seconds offsets": subMinute,
  "transition edges": transitionEdges,
  "fractional seconds": fractions,
  "range edge": rangeEdge,
};

const allRows = Object.values(groups).flat();

describe("classifyStoredZoned", () => {
  for (const [group, rows] of Object.entries(groups)) {
    describe(group, () => {
      for (const { input, expected } of rows) {
        it(`classifies ${input} as ${expected.kind}`, () => {
          expect(classifyStoredZoned(input)).toEqual(expected);
        });
      }
    });
  }

  it.each`
    input                                                            | why
    ${"2026-03-08T02:30:00[America/Los_Angeles]"}                    | ${"no offset"}
    ${"2026-03-08T02:30:00-08:00"}                                   | ${"no zone annotation"}
    ${"2026-03-08T02:30:00-08:00[-08:00]"}                           | ${"a bracketed offset, not an IANA zone"}
    ${"2026-03-08T02:30:00-08:00[Mars/Base]"}                        | ${"unknown zone"}
    ${"20260308T023000-0800[America/Los_Angeles]"}                   | ${"basic format"}
    ${"2026-03-08T02:30:00-08:00:00.5[America/Los_Angeles]"}         | ${"an offset finer than a second"}
    ${"2026-03-08T02:30:00-08:00[America/Los_Angeles][u-ca=hebrew]"} | ${"a calendar other than iso8601"}
    ${"2016-12-31T23:59:60+03:00[Europe/Istanbul]"}                  | ${"second 60"}
    ${"+275760-09-13T00:00:00-00:01[UTC]"}                           | ${"the stored reading is past the end of the instant range"}
    ${"-271821-04-19T23:59:00-00:01[Europe/London]"}                 | ${"a local date a zoned read refuses"}
    ${"-271821-04-19T20:00:00-04:00[America/New_York]"}              | ${"a refused local date, west of Greenwich"}
    ${"-271821-04-19T23:59:00Z[America/New_York]"}                   | ${"a refused local date with Z"}
    ${"-271821-04-20T00:00:00+00:01[Europe/London]"}                 | ${"the stored reading is before the start of the instant range"}
    ${"2022-07-08T00:14:07+01:00[Europe/London][!foo=bar]"}          | ${"an unknown critical annotation"}
    ${"2023-02-29T10:00:00+00:00[Europe/London]"}                    | ${"a date that does not exist"}
    ${""}                                                            | ${"empty string"}
    ${"not a date"}                                                  | ${"not a date"}
    ${null}                                                          | ${"null"}
    ${42}                                                            | ${"a number"}
  `("returns null for $input ($why)", ({ input }) => {
    expect(classifyStoredZoned(input as never)).toBeNull();
  });

  describe("reproduces each Temporal offset and disambiguation", () => {
    const offsets = ["use", "ignore", "prefer", "reject"] as const;
    const disambiguations = [
      "compatible",
      "earlier",
      "later",
      "reject",
    ] as const;
    const refused = "refused";

    // What Temporal gives for each kind, from the table in the spec (Temporal §6.5.1, §11.1.12).
    function expectedFor(
      result: StoredZonedClassification,
      offset: (typeof offsets)[number],
      disambiguation: (typeof disambiguations)[number],
    ): string | typeof refused {
      if (offset === "use") {
        return result.atStoredOffset;
      }
      if (result.kind === "valid") {
        return result.instant;
      }
      if (result.kind === "offsetMismatch") {
        return offset === "reject" ? refused : result.atZoneOffset;
      }
      // validInOverlap matches its offset, so reject and prefer keep `instant`
      if (result.kind === "validInOverlap" && offset !== "ignore") {
        return result.instant;
      }
      return offset === "reject" ? refused : pick(result, disambiguation);
    }

    function pick(
      result: { kind: string; earlier: string; later: string },
      disambiguation: (typeof disambiguations)[number],
    ): string | typeof refused {
      const gap = result.kind === "nonexistent";
      const byDisambiguation = {
        reject: refused,
        earlier: result.earlier,
        later: result.later,
        compatible: gap ? result.later : result.earlier,
      };
      return byDisambiguation[disambiguation];
    }

    // The polyfill's own answer, except in the two places 0.5.1 departs from the spec. There the
    // answer is the spec's, built from polyfill parts the defect does not touch.
    function temporalAnswer(
      input: string,
      offset: (typeof offsets)[number],
      disambiguation: (typeof disambiguations)[number],
    ): string | typeof refused {
      try {
        if (offset === "ignore" && endsInZ.test(input)) {
          return zIsExact(input);
        }
        const seconds = writtenWithSeconds.exec(input);
        if (seconds !== null && (offset === "prefer" || offset === "reject")) {
          return matchExactly(input, seconds, offset, disambiguation);
        }
        return Temporal.ZonedDateTime.from(input, { offset, disambiguation })
          .toInstant()
          .toString();
      } catch {
        return refused;
      }
    }

    // D15: a `Z` body is exact whatever `offset` says (TC39 §6.5.1 steps 3–4).
    const endsInZ = /[Zz]\[/;
    function zIsExact(input: string): string {
      return Temporal.Instant.from(
        input.slice(0, input.indexOf("[")),
      ).toString();
    }

    // D12: an offset written with seconds must match the zone exactly (TC39 §6.5.1 steps 7–12).
    const writtenWithSeconds = /([+-])(\d{2}):(\d{2}):(\d{2})\[/;
    function matchExactly(
      input: string,
      [, sign, hours, minutes, seconds]: RegExpExecArray,
      offset: "prefer" | "reject",
      disambiguation: (typeof disambiguations)[number],
    ): string | typeof refused {
      const offsetNanoseconds =
        (sign === "-" ? -1 : 1) *
        (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) *
        1e9;
      const timeZone = input.slice(input.indexOf("[") + 1, input.indexOf("]"));
      const wallClock = Temporal.PlainDateTime.from(input);
      if (Temporal.PlainDate.compare(wallClock, "-271821-04-20") < 0) {
        return refused;
      }
      // The possible instants are the two readings that keep the wall clock; a gap has none.
      const candidates = (["earlier", "later"] as const)
        .map((d) => wallClock.toZonedDateTime(timeZone, { disambiguation: d }))
        .filter((candidate) => candidate.toPlainDateTime().equals(wallClock));
      const match = candidates.find(
        (candidate) => candidate.offsetNanoseconds === offsetNanoseconds,
      );
      if (match !== undefined) {
        return match.toInstant().toString();
      }
      if (offset === "reject") {
        return refused;
      }
      return wallClock
        .toZonedDateTime(timeZone, { disambiguation })
        .toInstant()
        .toString();
    }

    for (const { input, expected } of allRows) {
      it(`${input} gives Temporal's answer for all 16 offset and disambiguation pairs`, () => {
        for (const offset of offsets) {
          for (const disambiguation of disambiguations) {
            expect(
              expectedFor(expected, offset, disambiguation),
              `${input} offset ${offset} disambiguation ${disambiguation}`,
            ).toBe(temporalAnswer(input, offset, disambiguation));
          }
        }
      });
    }
  });

  describe("matrix", () => {
    for (const { timeZone, value, utc } of sameInstantBattleCases) {
      it(`${timeZone}: its own string at ${utc} is valid`, () => {
        expect(classifyStoredZoned(value)).toEqual({
          kind: "valid",
          instant: utc,
          atStoredOffset: utc,
        });
      });
    }

    for (const { timeZone, value } of [
      ...sameInstantBattleCases,
      ...localNoonBattleCases,
    ]) {
      it(`${timeZone}: ${value} with one hour added to the offset is an offsetMismatch`, () => {
        const zoned = Temporal.ZonedDateTime.from(value);
        const storedOffset = formatUtcOffset(
          BigInt(zoned.offsetNanoseconds) + 3_600_000_000_000n,
        );
        const written = value.replace(
          /[+-]\d{2}:\d{2}(?::\d{2})?\[/,
          `${storedOffset}[`,
        );
        const result = classifyStoredZoned(written);
        expect(result?.kind).toBe("offsetMismatch");
        expect(result).toMatchObject({
          storedOffset,
          zoneOffset: zoned.offset,
          atZoneOffset: zoned.toInstant().toString(),
        });
      });
    }
  });
});
