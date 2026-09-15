import {
  coalesceIntervalNanoseconds,
  type IntervalNanoseconds,
  parseIntervalNanoseconds,
  parseIntervalNanosecondsList,
} from "./intervalNanoseconds";

// 2024-01-01 (unix2024Jan01T000000Ms); times of day override the canonical midnight because
// interval endpoints are the scenario under test.
const nineZ = "2024-01-01T09:00:00Z";
const seventeenZ = "2024-01-01T17:00:00Z";
const nineNy = "2024-01-01T04:00:00-05:00";

describe("parseIntervalNanoseconds", () => {
  it.each`
    start     | end           | expectedStart           | expectedEnd
    ${nineZ}  | ${seventeenZ} | ${1704099600000000000n} | ${1704128400000000000n}
    ${nineZ}  | ${nineZ}      | ${1704099600000000000n} | ${1704099600000000000n}
    ${nineNy} | ${nineZ}      | ${1704099600000000000n} | ${1704099600000000000n}
  `(
    "parses { start: $start, end: $end } to $expectedStart to $expectedEnd with the texts echoed",
    ({ start, end, expectedStart, expectedEnd }) => {
      expect(parseIntervalNanoseconds({ start, end })).toEqual({
        start: expectedStart,
        end: expectedEnd,
        startText: start,
        endText: end,
      });
    },
  );

  it("ignores extra keys and accepts class instances", () => {
    class Shift {
      start = nineZ;
      end = seventeenZ;
      crew = "night";
    }

    expect(parseIntervalNanoseconds(new Shift())).toEqual({
      start: 1704099600000000000n,
      end: 1704128400000000000n,
      startText: nineZ,
      endText: seventeenZ,
    });
  });

  it("reads each endpoint exactly once so a getter cannot change the echoed text", () => {
    let reads = 0;
    const value = {
      get start() {
        reads += 1;
        return reads === 1 ? nineZ : "invalid";
      },
      end: seventeenZ,
    };

    expect(parseIntervalNanoseconds(value)?.startText).toBe(nineZ);
    expect(reads).toBe(1);
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${"x"}
    ${123}
    ${[]}
  `("returns null when $value is non-object input", ({ value }) => {
    expect(parseIntervalNanoseconds(value)).toBeNull();
  });

  it.each`
    start                     | end                            | reason
    ${nineZ}                  | ${undefined}                   | ${"missing end"}
    ${1}                      | ${nineZ}                       | ${"non-string start"}
    ${seventeenZ}             | ${nineZ}                       | ${"inverted"}
    ${"2024-01-01T09:30:00Z"} | ${"2024-01-01T10:00:00+01:00"} | ${"inverted by instant, ascending as text"}
    ${"2016-12-31T23:59:60Z"} | ${"2017-01-01T00:00:00Z"}      | ${"leap second"}
    ${"2024-01-01T09:00:00"}  | ${seventeenZ}                  | ${"zoneless"}
  `("returns null when the record is invalid ($reason)", ({ start, end }) => {
    expect(parseIntervalNanoseconds({ start, end })).toBeNull();
  });
});

describe("parseIntervalNanosecondsList", () => {
  it("parses every element in input order", () => {
    expect(
      parseIntervalNanosecondsList([
        { start: seventeenZ, end: seventeenZ },
        { start: nineZ, end: seventeenZ },
      ]),
    ).toEqual([
      {
        start: 1704128400000000000n,
        end: 1704128400000000000n,
        startText: seventeenZ,
        endText: seventeenZ,
      },
      {
        start: 1704099600000000000n,
        end: 1704128400000000000n,
        startText: nineZ,
        endText: seventeenZ,
      },
    ]);
  });

  it("returns an empty list for an empty array", () => {
    expect(parseIntervalNanosecondsList([])).toEqual([]);
  });

  it.each`
    values                                                                    | reason
    ${"x"}                                                                    | ${"non-array string"}
    ${null}                                                                   | ${"null"}
    ${{}}                                                                     | ${"plain object"}
    ${[{ start: nineZ, end: seventeenZ }, null]}                              | ${"null element"}
    ${[{ start: nineZ, end: seventeenZ }, { start: seventeenZ, end: nineZ }]} | ${"inverted element"}
    ${Array.from({ length: 1 })}                                              | ${"undefined element, as a sparse hole reads"}
  `("returns null when the list is invalid ($reason)", ({ values }) => {
    expect(parseIntervalNanosecondsList(values)).toBeNull();
  });
});

describe("coalesceIntervalNanoseconds", () => {
  const record = (
    start: bigint,
    end: bigint,
    startText = `s${start}`,
    endText = `e${end}`,
  ): IntervalNanoseconds => ({ start, end, startText, endText });

  it("returns [] for no records", () => {
    expect(coalesceIntervalNanoseconds([])).toEqual([]);
  });

  it.each`
    records                                                          | expected                            | reason
    ${[record(5n, 9n), record(1n, 3n)]}                              | ${[record(1n, 3n), record(5n, 9n)]} | ${"sorts disjoint records"}
    ${[record(1n, 3n), record(3n, 5n)]}                              | ${[record(1n, 5n)]}                 | ${"touching coalesces"}
    ${[record(1n, 3n), record(4n, 5n)]}                              | ${[record(1n, 3n), record(4n, 5n)]} | ${"1 ns gap stays apart"}
    ${[record(1n, 9n), record(2n, 3n)]}                              | ${[record(1n, 9n)]}                 | ${"contained is absorbed"}
    ${[record(4n, 4n)]}                                              | ${[]}                               | ${"stranded empty dropped"}
    ${[record(3n, 3n, "first"), record(3n, 5n, "second")]}           | ${[record(3n, 5n, "first")]}        | ${"equal starts keep input order"}
    ${[record(1n, 5n, "a", "first"), record(2n, 5n, "b", "second")]} | ${[record(1n, 5n, "a", "first")]}   | ${"first to reach the max end keeps its text"}
  `("coalesces $records to $expected ($reason)", ({ records, expected }) => {
    expect(coalesceIntervalNanoseconds(records)).toEqual(expected);
  });

  it("copies runs instead of mutating the input records", () => {
    const first = record(1n, 3n);
    const second = record(2n, 5n);

    coalesceIntervalNanoseconds([first, second]);

    expect(first).toEqual(record(1n, 3n));
  });
});
