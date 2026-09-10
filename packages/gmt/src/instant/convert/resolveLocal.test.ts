import { Temporal } from "@js-temporal/polyfill";
import { localDstEdgeBattleCases } from "../../test";
import {
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalZonedDateTimeFromThrow,
} from "../../test/mocks";
import { classifyLocal } from "./classifyLocal";
import { resolveLocal } from "./resolveLocal";

const disambiguations = ["compatible", "earlier", "later", "reject"] as const;

const zonesWithTransitions = localDstEdgeBattleCases.filter(
  ({ nonexistent }) => nonexistent !== null,
);
const zonesWithoutTransitions = localDstEdgeBattleCases.filter(
  ({ nonexistent }) => nonexistent === null,
);

/** Nanoseconds between two instant strings — the unit an offset shift is measured in. */
function nanosecondsBetween(from: string, to: string): bigint {
  return (
    Temporal.Instant.from(to).epochNanoseconds -
    Temporal.Instant.from(from).epochNanoseconds
  );
}

/** The offset shift a zone's transition applies, read off the zone itself. */
function shiftNanoseconds(timeZone: string, localDateTime: string): bigint {
  const wallClock = Temporal.PlainDateTime.from(localDateTime);
  return (
    wallClock.toZonedDateTime(timeZone, { disambiguation: "later" })
      .epochNanoseconds -
    wallClock.toZonedDateTime(timeZone, { disambiguation: "earlier" })
      .epochNanoseconds
  );
}

describe("resolveLocal", () => {
  it.each`
    localDateTime                      | timeZone              | expected
    ${"2024-07-15T12:00:00"}           | ${"America/New_York"} | ${"2024-07-15T16:00:00Z"}
    ${"2024-01-15T12:00:00"}           | ${"America/New_York"} | ${"2024-01-15T17:00:00Z"}
    ${"2024-02-29T12:00:00"}           | ${"UTC"}              | ${"2024-02-29T12:00:00Z"}
    ${"2024-02-29T12:00:00"}           | ${"Asia/Kathmandu"}   | ${"2024-02-29T06:15:00Z"}
    ${"2024-02-29T12:00:00"}           | ${"Pacific/Apia"}     | ${"2024-02-28T23:00:00Z"}
    ${"2024-02-29T12:00:00"}           | ${"Pacific/Niue"}     | ${"2024-02-29T23:00:00Z"}
    ${"2024-07-15T12:00:00.123456789"} | ${"America/New_York"} | ${"2024-07-15T16:00:00.123456789Z"}
    ${"2024-07-15T12:00"}              | ${"America/New_York"} | ${"2024-07-15T16:00:00Z"}
  `(
    "resolves unambiguous $localDateTime in $timeZone to $expected",
    ({ localDateTime, timeZone, expected }) => {
      expect(resolveLocal(localDateTime, timeZone)).toBe(expected);
    },
  );

  it.each`
    disambiguation  | expected
    ${undefined}    | ${"2024-11-03T05:30:00Z"}
    ${"compatible"} | ${"2024-11-03T05:30:00Z"}
    ${"earlier"}    | ${"2024-11-03T05:30:00Z"}
    ${"later"}      | ${"2024-11-03T06:30:00Z"}
    ${"reject"}     | ${""}
  `(
    "resolves the ambiguous 2024-11-03T01:30:00 in America/New_York to $expected with disambiguation $disambiguation",
    ({ disambiguation, expected }) => {
      expect(
        resolveLocal("2024-11-03T01:30:00", "America/New_York", {
          disambiguation,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    disambiguation  | expected
    ${undefined}    | ${"2024-03-10T07:30:00Z"}
    ${"compatible"} | ${"2024-03-10T07:30:00Z"}
    ${"earlier"}    | ${"2024-03-10T06:30:00Z"}
    ${"later"}      | ${"2024-03-10T07:30:00Z"}
    ${"reject"}     | ${""}
  `(
    "resolves the nonexistent 2024-03-10T02:30:00 in America/New_York to $expected with disambiguation $disambiguation",
    ({ disambiguation, expected }) => {
      expect(
        resolveLocal("2024-03-10T02:30:00", "America/New_York", {
          disambiguation,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    disambiguation  | expected
    ${undefined}    | ${"2024-07-15T16:00:00Z"}
    ${"compatible"} | ${"2024-07-15T16:00:00Z"}
    ${"earlier"}    | ${"2024-07-15T16:00:00Z"}
    ${"later"}      | ${"2024-07-15T16:00:00Z"}
    ${"reject"}     | ${"2024-07-15T16:00:00Z"}
  `(
    "leaves an unambiguous wall time at $expected with disambiguation $disambiguation, including reject",
    ({ disambiguation, expected }) => {
      expect(
        resolveLocal("2024-07-15T12:00:00", "America/New_York", {
          disambiguation,
        }),
      ).toBe(expected);
    },
  );

  it.each(zonesWithTransitions)(
    "resolves $timeZone's ambiguous $ambiguous one offset shift apart between earlier and later",
    ({ timeZone, ambiguous }) => {
      const localDateTime = ambiguous as string;
      const earlier = resolveLocal(localDateTime, timeZone, {
        disambiguation: "earlier",
      });
      const later = resolveLocal(localDateTime, timeZone, {
        disambiguation: "later",
      });

      expect(nanosecondsBetween(earlier, later)).toBe(
        shiftNanoseconds(timeZone, localDateTime),
      );
      expect(nanosecondsBetween(earlier, later)).toBeGreaterThan(0n);
      expect(resolveLocal(localDateTime, timeZone)).toBe(earlier);
      expect(
        resolveLocal(localDateTime, timeZone, {
          disambiguation: "reject",
        }),
      ).toBe("");
    },
  );

  it.each(zonesWithTransitions)(
    "resolves $timeZone's nonexistent $nonexistent one offset shift apart between earlier and later",
    ({ timeZone, nonexistent }) => {
      const localDateTime = nonexistent as string;
      const earlier = resolveLocal(localDateTime, timeZone, {
        disambiguation: "earlier",
      });
      const later = resolveLocal(localDateTime, timeZone, {
        disambiguation: "later",
      });

      expect(nanosecondsBetween(earlier, later)).toBe(
        shiftNanoseconds(timeZone, localDateTime),
      );
      expect(resolveLocal(localDateTime, timeZone)).toBe(later);
      expect(
        resolveLocal(localDateTime, timeZone, {
          disambiguation: "reject",
        }),
      ).toBe("");
    },
  );

  it.each(localDstEdgeBattleCases)(
    "resolves local noon $unique in $timeZone identically under every disambiguation",
    ({ timeZone, unique }) => {
      const resolved = disambiguations.map((disambiguation) =>
        resolveLocal(unique, timeZone, { disambiguation }),
      );

      expect(new Set([...resolved, resolveLocal(unique, timeZone)]).size).toBe(
        1,
      );
      expect(classifyLocal(unique, timeZone)).toBe("unique");
    },
  );

  it.each(zonesWithoutTransitions)(
    "resolves the US transition wall times in $timeZone under reject, since it has no transitions",
    ({ timeZone }) => {
      expect(
        resolveLocal("2024-03-10T02:30:00", timeZone, {
          disambiguation: "reject",
        }),
      ).not.toBe("");
      expect(
        resolveLocal("2024-11-03T01:30:00", timeZone, {
          disambiguation: "reject",
        }),
      ).not.toBe("");
    },
  );

  it.each(localDstEdgeBattleCases)(
    "resolves local noon in $timeZone to the instant Temporal reports for the same wall time",
    ({ timeZone, unique }) => {
      expect(resolveLocal(unique, timeZone)).toBe(
        Temporal.PlainDateTime.from(unique)
          .toZonedDateTime(timeZone)
          .toInstant()
          .toString(),
      );
    },
  );

  it.each`
    localDateTime                              | description
    ${"2024-11-03T01:30:00-04:00"}             | ${"carries an offset"}
    ${"2024-11-03T01:30:00Z"}                  | ${"carries a UTC designator"}
    ${"2024-11-03T01:30:00[America/New_York]"} | ${"carries a bracketed zone"}
    ${"2024-11-03 01:30:00"}                   | ${"uses a space separator"}
    ${"2024-11-03"}                            | ${"is a date with no time"}
    ${"2024-02-30T01:30:00"}                   | ${"is not a real date"}
    ${"2024-12-31T23:59:60"}                   | ${"is a leap second"}
    ${"invalid"}                               | ${"is not a datetime at all"}
    ${""}                                      | ${"is empty"}
  `('returns "" when localDateTime $description', ({ localDateTime }) => {
    expect(resolveLocal(localDateTime, "America/New_York")).toBe("");
  });

  it.each`
    timeZone          | description
    ${"Invalid/Zone"} | ${"is not an IANA identifier"}
    ${"-05:00"}       | ${"is an offset, not a zone"}
    ${""}             | ${"is empty"}
  `('returns "" when timeZone $description', ({ timeZone }) => {
    expect(resolveLocal("2024-11-03T01:30:00", timeZone)).toBe("");
  });

  it.each`
    disambiguation | description
    ${"fortnight"} | ${"is not a disambiguation value"}
    ${"EARLIER"}   | ${"is the right word in the wrong case"}
    ${123}         | ${"is a number"}
    ${{}}          | ${"is an object"}
    ${[]}          | ${"is an array"}
  `('returns "" when disambiguation $description', ({ disambiguation }) => {
    expect(
      resolveLocal("2024-11-03T01:30:00", "America/New_York", {
        disambiguation: disambiguation as never,
      }),
    ).toBe("");
  });

  it.each`
    optionsArg                          | description
    ${undefined}                        | ${"no options object"}
    ${{}}                               | ${"an empty options object"}
    ${{ disambiguation: undefined }}    | ${"an explicitly undefined disambiguation"}
    ${{ disambiguation: null }}         | ${"an explicitly null disambiguation"}
    ${{ disambiguation: "compatible" }} | ${'an explicit "compatible"'}
  `(
    "falls back to compatible for the ambiguous 2024-11-03T01:30:00 given $description",
    ({ optionsArg }) => {
      expect(
        resolveLocal("2024-11-03T01:30:00", "America/New_York", optionsArg),
      ).toBe("2024-11-03T05:30:00Z");
    },
  );

  it.each`
    input        | description
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${20241103}  | ${"number"}
    ${true}      | ${"boolean"}
    ${[]}        | ${"array"}
    ${{}}        | ${"object"}
  `('returns "" when either argument is $description', ({ input }) => {
    expect(resolveLocal(input as never, "America/New_York")).toBe("");
    expect(resolveLocal("2024-11-03T01:30:00", input as never)).toBe("");
  });

  it.each`
    localDateTime               | timeZone          | description
    ${"+275760-09-13T00:00:00"} | ${"Pacific/Niue"} | ${"the maximum PlainDateTime, which is past the last representable instant in a zone west of UTC"}
    ${"-271821-04-20T00:00:00"} | ${"Pacific/Apia"} | ${"the minimum PlainDateTime, which is before the first representable instant in a zone east of UTC"}
  `(
    'returns "" for $localDateTime in $timeZone — $description',
    ({ localDateTime, timeZone }) => {
      expect(resolveLocal(localDateTime, timeZone)).toBe("");
    },
  );

  it('returns "" when Temporal.ZonedDateTime.from throws', () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(resolveLocal("2024-11-03T01:30:00", "America/New_York")).toBe("");
  });

  it('returns "" when Temporal.PlainDateTime.from throws', () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(resolveLocal("2024-11-03T01:30:00", "America/New_York")).toBe("");
  });
});
