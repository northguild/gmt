import { localDstEdgeBattleCases } from "../../test";
import {
  mockTemporalPlainDateTimeFromThrow,
  mockTemporalZonedDateTimeFromThrow,
} from "../../test/mocks";
import { classifyLocal } from "./classifyLocal";

const zonesWithTransitions = localDstEdgeBattleCases.filter(
  ({ nonexistent }) => nonexistent !== null,
);
const zonesWithoutTransitions = localDstEdgeBattleCases.filter(
  ({ nonexistent }) => nonexistent === null,
);

describe("classifyLocal", () => {
  it.each`
    localDateTime                      | timeZone              | expected
    ${"2024-07-15T12:00:00"}           | ${"America/New_York"} | ${"unique"}
    ${"2024-01-15T12:00:00"}           | ${"America/New_York"} | ${"unique"}
    ${"2024-11-03T01:30:00"}           | ${"America/New_York"} | ${"ambiguous"}
    ${"2024-11-03T01:00:00"}           | ${"America/New_York"} | ${"ambiguous"}
    ${"2024-11-03T01:59:59.999999999"} | ${"America/New_York"} | ${"ambiguous"}
    ${"2024-11-03T02:00:00"}           | ${"America/New_York"} | ${"unique"}
    ${"2024-11-03T00:59:59"}           | ${"America/New_York"} | ${"unique"}
    ${"2024-03-10T02:30:00"}           | ${"America/New_York"} | ${"nonexistent"}
    ${"2024-03-10T02:00:00"}           | ${"America/New_York"} | ${"nonexistent"}
    ${"2024-03-10T02:59:59.999999999"} | ${"America/New_York"} | ${"nonexistent"}
    ${"2024-03-10T03:00:00"}           | ${"America/New_York"} | ${"unique"}
    ${"2024-03-10T01:59:59"}           | ${"America/New_York"} | ${"unique"}
  `(
    "classifies $localDateTime in $timeZone as $expected",
    ({ localDateTime, timeZone, expected }) => {
      expect(classifyLocal(localDateTime, timeZone)).toBe(expected);
    },
  );

  it.each`
    localDateTime            | timeZone                 | expected         | description
    ${"2024-04-07T01:45:00"} | ${"Australia/Lord_Howe"} | ${"ambiguous"}   | ${"a 30-minute fall-back overlap"}
    ${"2024-04-07T01:15:00"} | ${"Australia/Lord_Howe"} | ${"unique"}      | ${"before that overlap opens"}
    ${"2024-10-06T02:15:00"} | ${"Australia/Lord_Howe"} | ${"nonexistent"} | ${"a 30-minute spring-forward gap"}
    ${"2024-10-06T02:45:00"} | ${"Australia/Lord_Howe"} | ${"unique"}      | ${"after that gap closes"}
    ${"2024-04-07T03:15:00"} | ${"Pacific/Chatham"}     | ${"ambiguous"}   | ${"a 45-minute-offset zone's overlap"}
    ${"2024-09-29T03:15:00"} | ${"Pacific/Chatham"}     | ${"nonexistent"} | ${"a 45-minute-offset zone's gap"}
    ${"2024-09-29T02:30:00"} | ${"Pacific/Chatham"}     | ${"unique"}      | ${"the hand-picked 02:30 that misses that gap entirely"}
  `(
    "classifies $localDateTime in $timeZone as $expected ($description)",
    ({ localDateTime, timeZone, expected }) => {
      expect(classifyLocal(localDateTime, timeZone)).toBe(expected);
    },
  );

  it.each`
    localDateTime            | timeZone          | expected         | description
    ${"2011-12-30T12:00:00"} | ${"Pacific/Apia"} | ${"nonexistent"} | ${"the whole calendar day Samoa skipped crossing the date line"}
    ${"2011-12-30T00:00:00"} | ${"Pacific/Apia"} | ${"nonexistent"} | ${"the first instant of that skipped day"}
    ${"2011-12-29T23:59:59"} | ${"Pacific/Apia"} | ${"unique"}      | ${"the last real second before it"}
    ${"2011-12-31T00:00:00"} | ${"Pacific/Apia"} | ${"unique"}      | ${"the first real second after it"}
  `(
    "classifies $localDateTime in $timeZone as $expected ($description)",
    ({ localDateTime, timeZone, expected }) => {
      expect(classifyLocal(localDateTime, timeZone)).toBe(expected);
    },
  );

  it.each(zonesWithTransitions)(
    "classifies $timeZone's own gap midpoint $nonexistent as nonexistent",
    ({ timeZone, nonexistent }) => {
      expect(classifyLocal(nonexistent as string, timeZone)).toBe(
        "nonexistent",
      );
    },
  );

  it.each(zonesWithTransitions)(
    "classifies $timeZone's own overlap midpoint $ambiguous as ambiguous",
    ({ timeZone, ambiguous }) => {
      expect(classifyLocal(ambiguous as string, timeZone)).toBe("ambiguous");
    },
  );

  it.each(localDstEdgeBattleCases)(
    "classifies local noon $unique in $timeZone as unique",
    ({ timeZone, unique }) => {
      expect(classifyLocal(unique, timeZone)).toBe("unique");
    },
  );

  it.each(zonesWithoutTransitions)(
    "classifies every US transition wall time in $timeZone as unique, since it has no transitions",
    ({ timeZone }) => {
      expect(classifyLocal("2024-03-10T02:30:00", timeZone)).toBe("unique");
      expect(classifyLocal("2024-11-03T01:30:00", timeZone)).toBe("unique");
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
  `("returns null when localDateTime $description", ({ localDateTime }) => {
    expect(classifyLocal(localDateTime, "America/New_York")).toBeNull();
  });

  it.each`
    timeZone          | description
    ${"Invalid/Zone"} | ${"is not an IANA identifier"}
    ${"-05:00"}       | ${"is an offset, not a zone"}
    ${""}             | ${"is empty"}
  `("returns null when timeZone $description", ({ timeZone }) => {
    expect(classifyLocal("2024-11-03T01:30:00", timeZone)).toBeNull();
  });

  it.each`
    input        | description
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${20241103}  | ${"number"}
    ${true}      | ${"boolean"}
    ${[]}        | ${"array"}
    ${{}}        | ${"object"}
  `("returns null when either argument is $description", ({ input }) => {
    expect(classifyLocal(input as never, "America/New_York")).toBeNull();
    expect(classifyLocal("2024-11-03T01:30:00", input as never)).toBeNull();
  });

  it.each`
    localDateTime               | timeZone          | description
    ${"+275760-09-13T00:00:00"} | ${"Pacific/Niue"} | ${"the maximum PlainDateTime, which is past the last representable instant in a zone west of UTC"}
    ${"-271821-04-20T00:00:00"} | ${"Pacific/Apia"} | ${"the minimum PlainDateTime, which is before the first representable instant in a zone east of UTC"}
  `(
    "returns null for $localDateTime in $timeZone — $description",
    ({ localDateTime, timeZone }) => {
      expect(classifyLocal(localDateTime, timeZone)).toBeNull();
    },
  );

  it("returns null when Temporal.PlainDateTime.from throws", () => {
    mockTemporalPlainDateTimeFromThrow();
    expect(classifyLocal("2024-11-03T01:30:00", "America/New_York")).toBeNull();
  });

  it("returns null when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(classifyLocal("2024-11-03T01:30:00", "America/New_York")).toBeNull();
  });
});
