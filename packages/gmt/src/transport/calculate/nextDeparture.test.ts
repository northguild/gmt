import { Temporal } from "@js-temporal/polyfill";
import { localNoonBattleCases } from "../../test";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import {
  mockTemporalDurationFromThrow,
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalInstantFromThrow,
  mockTemporalZonedDateTimeFromThrow,
} from "../../test/mocks";
import { nextDeparture } from "./nextDeparture";

/** A ferry timetable for Saturday 15 June 2024, in UTC. */
const ferries = [
  "2024-06-15T08:00:00Z",
  "2024-06-15T09:30:00Z",
  "2024-06-15T11:00:00Z",
];

/** A 20-minute shuttle from 06:00 up to (not including) 09:00, UTC. */
const shuttle = {
  headway: "PT20M",
  from: "2024-06-15T06:00:00Z",
  to: "2024-06-15T09:00:00Z",
};

describe("nextDeparture — list form", () => {
  // The earliest entry at or after after + minimumConnection, echoed as written.
  it.each`
    after                          | minimumConnection      | expected                  | why
    ${"2024-06-15T09:00:00Z"}      | ${undefined}           | ${"2024-06-15T09:30:00Z"} | ${"the next departure after 09:00"}
    ${"2024-06-15T09:00:00Z"}      | ${"PT45M"}             | ${"2024-06-15T11:00:00Z"} | ${"a 45-minute connection skips the 09:30 departure"}
    ${"2024-06-15T09:00:00Z"}      | ${"PT30M"}             | ${"2024-06-15T09:30:00Z"} | ${"a connection that lands exactly on a departure makes it"}
    ${"2024-06-15T09:00:00Z"}      | ${"PT30M0.000000001S"} | ${"2024-06-15T11:00:00Z"} | ${"a connection one nanosecond longer misses the 09:30 departure"}
    ${"2024-06-15T09:30:00Z"}      | ${undefined}           | ${"2024-06-15T09:30:00Z"} | ${"at or after: a departure at the arrival instant counts"}
    ${"2024-06-15T09:30:00Z"}      | ${"PT0S"}              | ${"2024-06-15T09:30:00Z"} | ${"an explicit zero connection is the default"}
    ${"2024-06-15T07:00:00Z"}      | ${undefined}           | ${"2024-06-15T08:00:00Z"} | ${"before the first departure"}
    ${"2024-06-15T11:00:00Z"}      | ${"PT1S"}              | ${""}                     | ${"no departure is late enough"}
    ${"2024-06-14T09:00:00Z"}      | ${"P1D"}               | ${"2024-06-15T09:30:00Z"} | ${"a day of connection is 24 hours"}
    ${"2024-06-15T18:00:00+09:00"} | ${"PT1H"}              | ${"2024-06-15T11:00:00Z"} | ${"after is read as an instant: 18:00 +09:00 is 09:00Z"}
  `(
    "from $after with connection $minimumConnection gives '$expected' ($why)",
    ({ after, minimumConnection, expected }) => {
      expect(nextDeparture(after, ferries, { minimumConnection })).toBe(
        expected,
      );
    },
  );

  it.each`
    timetable                                                                   | expected                                         | why
    ${["2024-06-15T11:00:00Z", "2024-06-15T08:00:00Z", "2024-06-15T09:30:00Z"]} | ${"2024-06-15T09:30:00Z"}                        | ${"an unordered timetable"}
    ${["2024-06-15T11:30:00+02:00", "2024-06-15T09:30:00Z"]}                    | ${"2024-06-15T11:30:00+02:00"}                   | ${"a tie goes to the first index, echoed as written"}
    ${["2024-06-15T09:30:00Z", "2024-06-15T11:30:00+02:00"]}                    | ${"2024-06-15T09:30:00Z"}                        | ${"the same tie, the other way round"}
    ${["2024-06-15T05:30:00-04:00[America/New_York]", "2024-06-15T12:00:00Z"]}  | ${"2024-06-15T05:30:00-04:00[America/New_York]"} | ${"a zoned entry is echoed as written"}
    ${["2024-06-15T15:00:00+05:30:15", "2024-06-15T12:00:00Z"]}                 | ${"2024-06-15T15:00:00+05:30:15"}                | ${"a sub-minute offset is echoed as written (09:29:45Z)"}
    ${[]}                                                                       | ${""}                                            | ${"an empty timetable has no departure"}
  `("picks '$expected' from $timetable ($why)", ({ timetable, expected }) => {
    expect(nextDeparture("2024-06-15T09:00:00Z", timetable)).toBe(expected);
  });

  // New York fell back at 02:00 EDT on 3 November 2024 and sprang forward at 02:00 EST on
  // 10 March 2024. 01:30 EDT is 05:30Z; 01:15 EST is 06:15Z, a later instant although its wall
  // clock reads earlier. 01:30 EST is 06:30Z, and 30 minutes later is 07:00Z, 03:00 EDT.
  it.each`
    after                                            | minimumConnection | timetable                                                                                         | expected                                         | transition
    ${"2024-11-03T01:30:00-04:00[America/New_York]"} | ${undefined}      | ${["2024-11-03T01:15:00-04:00[America/New_York]", "2024-11-03T01:15:00-05:00[America/New_York]"]} | ${"2024-11-03T01:15:00-05:00[America/New_York]"} | ${"fall-back: the repeated hour's second pass is later"}
    ${"2024-11-03T01:30:00-04:00[America/New_York]"} | ${"PT45M"}        | ${["2024-11-03T01:15:00-05:00[America/New_York]", "2024-11-03T01:45:00-05:00[America/New_York]"]} | ${"2024-11-03T01:15:00-05:00[America/New_York]"} | ${"fall-back: 45 minutes from 01:30 EDT is exactly 01:15 EST"}
    ${"2024-03-10T01:30:00-05:00[America/New_York]"} | ${"PT30M"}        | ${["2024-03-10T03:00:00-04:00[America/New_York]", "2024-03-10T03:30:00-04:00[America/New_York]"]} | ${"2024-03-10T03:00:00-04:00[America/New_York]"} | ${"spring-forward: 30 minutes from 01:30 EST is exactly 03:00 EDT"}
  `(
    "compares departures across the $transition as instants",
    ({ after, minimumConnection, timetable, expected }) => {
      expect(nextDeparture(after, timetable, { minimumConnection })).toBe(
        expected,
      );
    },
  );

  it("reads the instant range limits without leaving them", () => {
    expect(
      nextDeparture("+275760-09-12T23:59:59.999999999Z", [
        "+275760-09-13T00:00:00Z",
      ]),
    ).toBe("+275760-09-13T00:00:00Z");
    expect(
      nextDeparture("+275760-09-13T00:00:00Z", ["+275760-09-13T00:00:00Z"], {
        minimumConnection: "PT1S",
      }),
    ).toBe("");
    expect(
      nextDeparture("-271821-04-20T00:00:00Z", ["-271821-04-20T00:00:00Z"]),
    ).toBe("-271821-04-20T00:00:00Z");
  });

  it.each`
    timetable                                                      | why
    ${[...ferries, "2024-06-15T12:00:00"]}                         | ${"a zoneless entry: every entry needs an offset"}
    ${[...ferries, "2024-06-15T12:00:00[America/New_York]"]}       | ${"a zoned wall time without an offset: a repeated hour would be ambiguous"}
    ${[...ferries, "2024-06-15T12:00:00Z[Not/AZone]"]}             | ${"a named zone that does not exist"}
    ${[...ferries, "2024-06-15T12:00:00-05:00[America/New_York]"]} | ${"an offset that contradicts its zone"}
    ${[...ferries, "12:00"]}                                       | ${"a bare time"}
    ${[...ferries, null]}                                          | ${"a null entry"}
    ${[...ferries, "+275760-09-13T00:00:00.000000001Z"]}           | ${"an entry past the instant range"}
    ${Object.assign([], { 0: ferries[0], 2: ferries[2] })}         | ${"a sparse list: a hole is not an entry"}
  `("returns an empty string for $why", ({ timetable }) => {
    expect(nextDeparture("2024-06-15T09:00:00Z", timetable)).toBe("");
  });
});

describe("nextDeparture — headway form", () => {
  // Departures at from + k × headway while before to: 06:00, 06:20, …, 08:40.
  it.each`
    after                               | minimumConnection      | expected                  | why
    ${"2024-06-15T06:05:00Z"}           | ${undefined}           | ${"2024-06-15T06:20:00Z"} | ${"the first multiple of 20 minutes after 06:05"}
    ${"2024-06-15T06:20:00Z"}           | ${undefined}           | ${"2024-06-15T06:20:00Z"} | ${"at or after: a departure at the arrival instant counts"}
    ${"2024-06-15T06:20:00.000000001Z"} | ${undefined}           | ${"2024-06-15T06:40:00Z"} | ${"one nanosecond late misses it"}
    ${"2024-06-15T05:00:00Z"}           | ${undefined}           | ${"2024-06-15T06:00:00Z"} | ${"before from: the first departure"}
    ${"2024-06-15T06:00:00Z"}           | ${undefined}           | ${"2024-06-15T06:00:00Z"} | ${"from itself is a departure"}
    ${"2024-06-15T08:40:00Z"}           | ${undefined}           | ${"2024-06-15T08:40:00Z"} | ${"the last departure before to"}
    ${"2024-06-15T08:40:00.000000001Z"} | ${undefined}           | ${""}                     | ${"the next would be 09:00, which is to: excluded"}
    ${"2024-06-15T09:00:00Z"}           | ${undefined}           | ${""}                     | ${"an arrival exactly at to"}
    ${"2024-06-15T10:00:00Z"}           | ${undefined}           | ${""}                     | ${"after to"}
    ${"2024-06-15T06:05:00Z"}           | ${"PT10M"}             | ${"2024-06-15T06:20:00Z"} | ${"a 10-minute connection from 06:05 still makes 06:20"}
    ${"2024-06-15T06:15:00Z"}           | ${"PT10M"}             | ${"2024-06-15T06:40:00Z"} | ${"a 10-minute connection from 06:15 misses 06:20"}
    ${"2024-06-15T06:05:00Z"}           | ${"PT15M"}             | ${"2024-06-15T06:20:00Z"} | ${"a connection that lands exactly on a departure makes it"}
    ${"2024-06-15T06:05:00Z"}           | ${"PT15M0.000000001S"} | ${"2024-06-15T06:40:00Z"} | ${"a connection one nanosecond longer misses it"}
    ${"2024-06-15T08:50:00Z"}           | ${"PT10M"}             | ${""}                     | ${"a connection that lands exactly on to: excluded"}
    ${"2024-06-15T08:30:00Z"}           | ${"PT15M"}             | ${""}                     | ${"a connection that pushes past the last departure"}
  `(
    "from $after with connection $minimumConnection gives '$expected' ($why)",
    ({ after, minimumConnection, expected }) => {
      expect(nextDeparture(after, shuttle, { minimumConnection })).toBe(
        expected,
      );
    },
  );

  it.each`
    timetable                                                                                                                       | after                               | expected                                         | why
    ${{ headway: "PT25M", from: "2024-06-15T06:00:00Z", to: "2024-06-15T07:00:00Z" }}                                               | ${"2024-06-15T06:30:00Z"}           | ${"2024-06-15T06:50:00Z"}                        | ${"a headway that does not divide the window"}
    ${{ headway: "PT25M", from: "2024-06-15T06:00:00Z", to: "2024-06-15T07:00:00Z" }}                                               | ${"2024-06-15T06:51:00Z"}           | ${""}                                            | ${"the next would be 07:15, past to"}
    ${{ headway: "P1D", from: "2024-06-10T08:00:00Z", to: "2024-06-20T08:00:00Z" }}                                                 | ${"2024-06-15T09:00:00Z"}           | ${"2024-06-16T08:00:00Z"}                        | ${"a daily service: a day is 24 hours"}
    ${{ headway: "PT20M", from: "2024-06-15T06:00:00+09:00", to: "2024-06-15T09:00:00+09:00" }}                                     | ${"2024-06-14T21:05:00Z"}           | ${"2024-06-15T06:20:00+09:00"}                   | ${"the result keeps from's offset"}
    ${{ headway: "PT20M", from: "2024-06-15T06:00:00+05:30:15", to: "2024-06-15T09:00:00Z" }}                                       | ${"2024-06-15T00:45:00Z"}           | ${"2024-06-15T06:20:00+05:30:15"}                | ${"a sub-minute offset is kept as written (06:00 is 00:29:45Z, 06:20 is 00:49:45Z)"}
    ${{ headway: "PT20M", from: "2024-06-15T06:00:00-04:00[America/New_York]", to: "2024-06-15T09:00:00-04:00[America/New_York]" }} | ${"2024-06-15T10:05:00Z"}           | ${"2024-06-15T06:20:00-04:00[America/New_York]"} | ${"the result keeps from's zone"}
    ${{ headway: "PT20M", from: "2024-06-15T06:00:00Z[UTC]", to: "2024-06-15T09:00:00Z" }}                                          | ${"2024-06-15T06:05:00Z"}           | ${"2024-06-15T06:20:00+00:00[UTC]"}              | ${"a UTC bracket is a zone, written as Temporal writes it"}
    ${{ headway: "PT20M", from: "2024-06-15T06:00:00Z[foo=bar]", to: "2024-06-15T09:00:00Z" }}                                      | ${"2024-06-15T06:05:00Z"}           | ${"2024-06-15T06:20:00Z"}                        | ${"an elective unknown annotation is ignored"}
    ${{ headway: "PT0.000000001S", from: "2024-06-15T06:00:00Z", to: "2024-06-15T09:00:00Z" }}                                      | ${"2024-06-15T08:30:00.123456789Z"} | ${"2024-06-15T08:30:00.123456789Z"}              | ${"a one-nanosecond headway over three hours, computed without stepping"}
    ${{ headway: "PT1H", from: "2024-06-15T06:00:00Z", to: "2024-06-15T06:00:00.000000001Z" }}                                      | ${"2024-06-15T05:00:00Z"}           | ${"2024-06-15T06:00:00Z"}                        | ${"a one-nanosecond window still holds from"}
  `(
    "gives '$expected' from $after ($why)",
    ({ timetable, after, expected }) => {
      expect(nextDeparture(after, timetable)).toBe(expected);
    },
  );

  // New York fell back at 02:00 EDT on 3 November 2024 and sprang forward at 02:00 EST on
  // 10 March 2024. Hourly departures are exact hours from the anchor: across the fall-back they
  // run 01:00 EDT, 01:00 EST, 02:00 EST; across the spring-forward 01:00 EST, 03:00 EDT.
  it.each`
    timetable                                                                                                                      | after                                            | expected                                         | transition
    ${{ headway: "PT1H", from: "2024-11-03T00:00:00-04:00[America/New_York]", to: "2024-11-03T04:00:00-05:00[America/New_York]" }} | ${"2024-11-03T01:30:00-04:00[America/New_York]"} | ${"2024-11-03T01:00:00-05:00[America/New_York]"} | ${"fall-back: after 01:30 EDT the next is 01:00 EST, one hour later"}
    ${{ headway: "PT1H", from: "2024-03-10T00:00:00-05:00[America/New_York]", to: "2024-03-10T07:00:00-04:00[America/New_York]" }} | ${"2024-03-10T01:30:00-05:00[America/New_York]"} | ${"2024-03-10T03:00:00-04:00[America/New_York]"} | ${"spring-forward: after 01:30 EST the next is 03:00 EDT"}
    ${{ headway: "PT1H", from: "1883-11-18T10:00:00-04:56:02[America/New_York]", to: "1883-11-18T20:00:00Z" }}                     | ${"1883-11-18T17:30:00Z"}                        | ${"1883-11-18T12:56:02-05:00[America/New_York]"} | ${"end of local mean time (-04:56:02, 17:00Z): 13:00 LMT is 17:56:02Z, 12:56:02 EST"}
  `(
    "counts the headway in exact time across the $transition",
    ({ timetable, after, expected }) => {
      expect(nextDeparture(after, timetable)).toBe(expected);
    },
  );

  it.each(localNoonBattleCases)(
    "keeps from's zone and steps the headway in exact time in $timeZone",
    ({ value }) => {
      const from = Temporal.ZonedDateTime.from(value);
      const after = from.toInstant().add({ minutes: 5 }).toString();
      expect(
        nextDeparture(after, {
          headway: "PT20M",
          from: value,
          to: from.add({ hours: 3 }).toString(),
        }),
      ).toBe(from.add({ minutes: 20 }).toString());
    },
  );

  // The instant range is ±8.64e21 ns, 4,800,000,000 hours end to end. A headway of half of it
  // from the first instant lands on the epoch; the next step would be to itself, excluded.
  it.each`
    timetable                                                                                                                   | after                                  | expected
    ${{ headway: "PT2400000000H", from: "-271821-04-20T00:00:00Z", to: "+275760-09-13T00:00:00Z" }}                             | ${"-271821-04-20T00:00:00Z"}           | ${"-271821-04-20T00:00:00Z"}
    ${{ headway: "PT2400000000H", from: "-271821-04-20T00:00:00Z", to: "+275760-09-13T00:00:00Z" }}                             | ${"-271821-04-20T00:00:00.000000001Z"} | ${"1970-01-01T00:00:00Z"}
    ${{ headway: "PT2400000000H", from: "-271821-04-20T00:00:00Z", to: "+275760-09-13T00:00:00Z" }}                             | ${"1970-01-01T00:00:00.000000001Z"}    | ${""}
    ${{ headway: "PT2400000000H", from: "-271821-04-19T19:00:00-05:00", to: "+275760-09-13T10:00:00+10:00[Australia/Sydney]" }} | ${"1969-12-31T00:00:00Z"}              | ${"1969-12-31T19:00:00-05:00"}
    ${{ headway: "PT4800000000H", from: "-271821-04-20T00:00:00Z", to: "+275760-09-13T00:00:00Z" }}                             | ${"+275760-09-13T00:00:00Z"}           | ${""}
    ${{ headway: "PT1H", from: "+275760-09-12T22:00:00Z", to: "+275760-09-13T00:00:00Z" }}                                      | ${"+275760-09-12T22:30:00Z"}           | ${"+275760-09-12T23:00:00Z"}
    ${{ headway: "PT1H", from: "+275760-09-12T22:00:00Z", to: "+275760-09-13T00:00:00Z" }}                                      | ${"+275760-09-13T00:00:00Z"}           | ${""}
    ${{ headway: "PT1H", from: "-271821-04-20T00:00:00Z", to: "-271821-04-20T03:00:00Z" }}                                      | ${"-271821-04-20T00:00:00.000000001Z"} | ${"-271821-04-20T01:00:00Z"}
  `(
    "reads the range limits: from $after gives '$expected'",
    ({ timetable, after, expected }) => {
      expect(nextDeparture(after, timetable)).toBe(expected);
    },
  );

  it("returns an empty string when the connection carries the threshold past the last instant", () => {
    // 23:30 + 1 h is 00:30 on 13 September +275760, past +275760-09-13T00:00:00Z.
    expect(
      nextDeparture(
        "+275760-09-12T23:30:00Z",
        {
          headway: "PT1H",
          from: "+275760-09-12T22:00:00Z",
          to: "+275760-09-13T00:00:00Z",
        },
        { minimumConnection: "PT1H" },
      ),
    ).toBe("");
  });

  it.each`
    timetable                                                            | why
    ${{ ...shuttle, headway: "PT0S" }}                                   | ${"a zero headway"}
    ${{ ...shuttle, headway: "-PT20M" }}                                 | ${"a negative headway"}
    ${{ ...shuttle, headway: "P1W" }}                                    | ${"weeks need a reference point"}
    ${{ ...shuttle, headway: "20 minutes" }}                             | ${"not a duration"}
    ${{ ...shuttle, headway: 1200 }}                                     | ${"headway_secs as a number"}
    ${{ ...shuttle, to: "2024-06-15T06:00:00Z" }}                        | ${"to equal to from: an empty window"}
    ${{ ...shuttle, to: "2024-06-15T05:00:00Z" }}                        | ${"to before from"}
    ${{ headway: "PT20M", from: "2024-06-15T06:00:00Z" }}                | ${"no to"}
    ${{ ...shuttle, from: "2024-06-15T06:00:00" }}                       | ${"a zoneless from"}
    ${{ ...shuttle, to: "09:00" }}                                       | ${"a bare time for to"}
    ${{ ...shuttle, from: "2024-06-15T06:00:00[UTC]" }}                  | ${"a zoned from without an offset"}
    ${{ ...shuttle, from: "2024-06-15T06:00:00Z[Not/AZone]" }}           | ${"a from naming a zone that does not exist"}
    ${{ ...shuttle, to: "2024-06-15T09:00:00-05:00[America/New_York]" }} | ${"a to whose offset contradicts its zone"}
  `("returns an empty string for $why", ({ timetable }) => {
    expect(nextDeparture("2024-06-15T06:05:00Z", timetable)).toBe("");
  });
});

describe("nextDeparture — arguments", () => {
  it.each`
    after                                            | options                            | why
    ${"2024-06-15T09:00:00"}                         | ${undefined}                       | ${"a zoneless after"}
    ${"2024-06-15T09:00:00Z[Not/AZone]"}             | ${undefined}                       | ${"an after naming a zone that does not exist"}
    ${"2024-06-15T05:00:00[America/New_York]"}       | ${undefined}                       | ${"a zoned after without an offset"}
    ${"2024-06-15T09:00:00-05:00[America/New_York]"} | ${undefined}                       | ${"an after whose offset contradicts its zone"}
    ${"not a date"}                                  | ${undefined}                       | ${"a malformed after"}
    ${"2024-06-15T09:00:00Z"}                        | ${{ minimumConnection: "-PT5M" }}  | ${"a negative connection"}
    ${"2024-06-15T09:00:00Z"}                        | ${{ minimumConnection: "P1M" }}    | ${"a calendar-unit connection"}
    ${"2024-06-15T09:00:00Z"}                        | ${{ minimumConnection: "45 min" }} | ${"a connection that is not a duration"}
    ${"2024-06-15T09:00:00Z"}                        | ${{ minimumConnection: null }}     | ${"a null connection is not absent"}
    ${"2024-06-15T09:00:00Z"}                        | ${null}                            | ${"null options"}
    ${"2024-06-15T09:00:00Z"}                        | ${"PT45M"}                         | ${"a bare duration for options"}
  `("returns an empty string for $why, in both forms", ({ after, options }) => {
    expect(nextDeparture(after, ferries, options)).toBe("");
    expect(nextDeparture(after, shuttle, options)).toBe("");
  });

  it.each`
    options                             | why
    ${undefined}                        | ${"no options"}
    ${{}}                               | ${"an empty options bag"}
    ${{ minimumConnection: undefined }} | ${"minimumConnection: undefined is absent"}
  `("treats $why as no connection time", ({ options }) => {
    expect(nextDeparture("2024-06-15T09:30:00Z", ferries, options)).toBe(
      "2024-06-15T09:30:00Z",
    );
  });

  // Options are read property by property, as Temporal reads an options bag (GetOption is a
  // [[Get]]): a null-prototype bag and an inherited property are read like a plain object, and
  // an array is an options bag with no minimumConnection.
  it.each`
    options                                                               | expected                  | why
    ${Object.assign(Object.create(null), { minimumConnection: "PT45M" })} | ${"2024-06-15T11:00:00Z"} | ${"a null-prototype options bag"}
    ${Object.create({ minimumConnection: "PT45M" })}                      | ${"2024-06-15T11:00:00Z"} | ${"a connection inherited from the prototype"}
    ${[]}                                                                 | ${"2024-06-15T09:30:00Z"} | ${"an array options bag"}
  `("reads $why like a plain object", ({ options, expected }) => {
    expect(nextDeparture("2024-06-15T09:00:00Z", ferries, options)).toBe(
      expected,
    );
  });

  it.each`
    timetable                                   | why
    ${"2024-06-15T09:30:00Z"}                   | ${"a string"}
    ${null}                                     | ${"null"}
    ${undefined}                                | ${"no timetable"}
    ${1200}                                     | ${"a number"}
    ${{ 0: "2024-06-15T09:30:00Z", length: 1 }} | ${"an array-like object, which is neither a list nor a headway"}
  `("returns an empty string for $why as the timetable", ({ timetable }) => {
    expect(nextDeparture("2024-06-15T09:00:00Z", timetable)).toBe("");
  });

  it.each`
    make                    | label
    ${() => hostileProxy()} | ${"a Proxy that throws on any trap"}
    ${() => revokedProxy()} | ${"a revoked Proxy"}
  `("returns an empty string for $label in any position", ({ make }) => {
    expect(nextDeparture(make(), ferries)).toBe("");
    expect(nextDeparture("2024-06-15T09:00:00Z", make())).toBe("");
    expect(nextDeparture("2024-06-15T09:00:00Z", [make()])).toBe("");
    expect(nextDeparture("2024-06-15T09:00:00Z", ferries, make())).toBe("");
    expect(
      nextDeparture("2024-06-15T09:00:00Z", { ...shuttle, headway: make() }),
    ).toBe("");
  });

  it("returns an empty string for a timetable whose getter throws", () => {
    const hostile = {
      headway: "PT20M",
      from: "2024-06-15T06:00:00Z",
      get to(): string {
        throw new Error("hostile getter");
      },
    };
    expect(nextDeparture("2024-06-15T06:05:00Z", hostile)).toBe("");
  });

  it("returns an empty string when the duration parse throws", () => {
    mockTemporalDurationFromThrow();
    expect(
      nextDeparture("2024-06-15T09:00:00Z", ferries, {
        minimumConnection: "PT45M",
      }),
    ).toBe("");
    expect(nextDeparture("2024-06-15T06:05:00Z", shuttle)).toBe("");
  });

  it("returns an empty string when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(nextDeparture("2024-06-15T09:00:00Z", ferries)).toBe("");
    expect(nextDeparture("2024-06-15T06:05:00Z", shuttle)).toBe("");
  });

  it("returns an empty string when the zoned parse throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      nextDeparture("2024-06-15T09:00:00Z", [
        "2024-06-15T05:30:00-04:00[America/New_York]",
      ]),
    ).toBe("");
  });

  it("returns an empty string when the epoch-nanosecond constructor throws", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(nextDeparture("2024-06-15T06:05:00Z", shuttle)).toBe("");
  });
});
