import { describe, expect, it } from "vitest";
import type { DutyLogEntry } from "./dutyLog";
import {
  countEvents,
  countInRange,
  createRunStore,
  entryHolding,
  firstEntryIn,
  interruptionResetAt,
  lastAtLeastUntil,
  lastEntryBefore,
  latestPairFrom,
  latestAtLeast,
  logStartBefore,
  runEndingAt,
  runIndex,
  runsUntil,
  timeInBefore,
} from "./dutyRunIndex";

// A log in small whole units, worked by hand:
//   off [0,10)  on [10,11)  driving [11,16)  off [16,17)  (gap 17-20)
//   driving [20,25)  off [25,30)
// Runs of "off": [0,10) [16,17) [25,30). Runs outside "off": [10,16) [20,25).
const entry = (status: string, start: bigint, end: bigint): DutyLogEntry => ({
  status,
  start,
  end,
});
const log: DutyLogEntry[] = [
  entry("off", 0n, 10n),
  entry("on", 10n, 11n),
  entry("driving", 11n, 16n),
  entry("off", 16n, 17n),
  entry("driving", 20n, 25n),
  entry("off", 25n, 30n),
];
const off = new Set(["off"]);
const driving = new Set(["driving"]);
const store = createRunStore(log);
const offIndex = runIndex(store, off);

describe("timeInBefore", () => {
  it.each`
    case                                      | from   | to      | at      | expected
    ${"an entry straddles at"}                | ${0n}  | ${100n} | ${27n}  | ${13n}
    ${"to is past at"}                        | ${0n}  | ${100n} | ${12n}  | ${10n}
    ${"from is the end of an entry"}          | ${10n} | ${30n}  | ${30n}  | ${6n}
    ${"from is inside an entry"}              | ${4n}  | ${16n}  | ${100n} | ${6n}
    ${"from equals to"}                       | ${5n}  | ${5n}   | ${100n} | ${0n}
    ${"to is before from"}                    | ${9n}  | ${3n}   | ${100n} | ${0n}
    ${"at is before the first entry"}         | ${0n}  | ${50n}  | ${0n}   | ${0n}
    ${"the range is inside a gap of the log"} | ${17n} | ${20n}  | ${100n} | ${0n}
  `("$case: from $from to $to at $at is $expected", (row) => {
    const { from, to, at, expected } = row as {
      from: bigint;
      to: bigint;
      at: bigint;
      expected: bigint;
    };
    expect(timeInBefore(offIndex, from, to, at)).toBe(expected);
  });

  it("is zero on an empty log", () => {
    const empty = runIndex(createRunStore([]), off);
    expect(timeInBefore(empty, 0n, 10n, 10n)).toBe(0n);
  });

  it("counts the complement of a set", () => {
    // outside off: [10,16) and [20,25), cut at 22 -> 6 + 2
    const outside = runIndex(store, { not: off });
    expect(timeInBefore(outside, 0n, 100n, 22n)).toBe(8n);
  });
});

describe("runsUntil", () => {
  it.each`
    case                | at     | count | last
    ${"before the log"} | ${0n}  | ${0}  | ${undefined}
    ${"in a gap"}       | ${12n} | ${1}  | ${{ start: 0n, end: 10n }}
    ${"at a run start"} | ${16n} | ${1}  | ${{ start: 0n, end: 10n }}
    ${"at a run end"}   | ${17n} | ${2}  | ${{ start: 16n, end: 17n }}
    ${"inside a run"}   | ${26n} | ${3}  | ${{ start: 25n, end: 26n }}
    ${"after the log"}  | ${99n} | ${3}  | ${{ start: 25n, end: 30n }}
  `("$case: at $at keeps $count runs", (row) => {
    const { at, count, last } = row as {
      at: bigint;
      count: number;
      last: { start: bigint; end: bigint } | undefined;
    };
    const view = runsUntil(offIndex, at);
    expect(view.count).toBe(count);
    expect(view.last).toEqual(last);
  });

  it("holds no runs on an empty log", () => {
    const view = runsUntil(runIndex(createRunStore([]), off), 5n);
    expect(view.count).toBe(0);
    expect(view.last).toBeUndefined();
  });
});

describe("lastAtLeastUntil", () => {
  it.each`
    case                                   | at     | minimum | expected
    ${"the cut last run is too short"}     | ${27n} | ${5n}   | ${{ start: 0n, end: 10n }}
    ${"the last run is long enough whole"} | ${30n} | ${5n}   | ${{ start: 25n, end: 30n }}
    ${"the last run, cut, is long enough"} | ${30n} | ${2n}   | ${{ start: 25n, end: 30n }}
    ${"no run is long enough"}             | ${30n} | ${11n}  | ${undefined}
    ${"no run has started"}                | ${0n}  | ${1n}   | ${undefined}
  `("$case: at $at, minimum $minimum", (row) => {
    const { at, minimum, expected } = row as {
      at: bigint;
      minimum: bigint;
      expected: { start: bigint; end: bigint } | undefined;
    };
    expect(lastAtLeastUntil(runsUntil(offIndex, at), minimum)).toEqual(
      expected,
    );
  });

  it("looks only at the first runs asked for", () => {
    const view = runsUntil(offIndex, 99n);
    // Of the first two runs (10 and 1 long), the latest of at least 5 is [0,10).
    expect(latestAtLeast(view, 2, 5n)).toEqual({ start: 0n, end: 10n });
    expect(latestAtLeast(view, 0, 1n)).toBeUndefined();
  });
});

describe("runEndingAt", () => {
  it.each`
    case                   | at     | t      | expected
    ${"an earlier run"}    | ${99n} | ${17n} | ${{ start: 16n, end: 17n }}
    ${"the cut last run"}  | ${27n} | ${27n} | ${{ start: 25n, end: 27n }}
    ${"no run ends there"} | ${99n} | ${18n} | ${undefined}
  `("$case: ending at $t, as at $at", (row) => {
    const { at, t, expected } = row as {
      at: bigint;
      t: bigint;
      expected: { start: bigint; end: bigint } | undefined;
    };
    expect(runEndingAt(runsUntil(offIndex, at), t)).toEqual(expected);
  });
});

describe("countEvents", () => {
  const sizes = { minimum: 1n, maximum: 6n };

  it.each`
    case                                              | at     | from   | to      | skip    | expected
    ${"whole runs and a cut last one"}                | ${27n} | ${0n}  | ${null} | ${null} | ${2}
    ${"the last run is going on"}                     | ${27n} | ${0n}  | ${null} | ${27n}  | ${1}
    ${"a start range excludes the last"}              | ${27n} | ${0n}  | ${20n}  | ${null} | ${1}
    ${"a start range from a start"}                   | ${99n} | ${16n} | ${25n}  | ${null} | ${1}
    ${"a whole last run, before the next one starts"} | ${25n} | ${0n}  | ${null} | ${null} | ${1}
  `("$case: at $at from $from", (row) => {
    const { at, from, to, skip, expected } = row as {
      at: bigint;
      from: bigint;
      to: bigint | null;
      skip: bigint | null;
      expected: number;
    };
    expect(
      countEvents(runsUntil(offIndex, at), sizes, { from, to }, skip),
    ).toBe(expected);
  });

  // At least 3 units: [0,10) is too long and [16,17) too short at any time. The run from 25 is
  // 5 units whole, but only 2 when cut at 27.
  it.each`
    case                                     | at     | expected
    ${"the cut last run is too short"}       | ${27n} | ${0}
    ${"the same run, whole, is long enough"} | ${99n} | ${1}
  `("$case: at $at, 3 to 6 units", (row) => {
    const { at, expected } = row as { at: bigint; expected: number };
    expect(
      countEvents(
        runsUntil(offIndex, at),
        { minimum: 3n, maximum: 6n },
        { from: 0n, to: null },
        null,
      ),
    ).toBe(expected);
  });

  it("is zero on an empty log", () => {
    const view = runsUntil(runIndex(createRunStore([]), off), 5n);
    expect(countEvents(view, sizes, { from: 0n, to: null }, null)).toBe(0);
  });
});

describe("interruptionResetAt", () => {
  const breaks = (at: bigint) => runsUntil(offIndex, at);

  it.each`
    case                                       | at     | minimum | split       | expected
    ${"a whole break is long enough"}          | ${27n} | ${5n}   | ${null}     | ${10n}
    ${"the cut last break is long enough"}     | ${30n} | ${5n}   | ${null}     | ${30n}
    ${"no break is long enough"}               | ${30n} | ${11n}  | ${null}     | ${null}
    ${"an ordered split completes"}            | ${17n} | ${20n}  | ${[1n, 1n]} | ${17n}
    ${"an ordered split is half done"}         | ${12n} | ${20n}  | ${[1n, 1n]} | ${null}
    ${"the cut last break starts a new split"} | ${27n} | ${20n}  | ${[1n, 1n]} | ${17n}
    ${"no breaks yet"}                         | ${0n}  | ${1n}   | ${null}     | ${null}
  `("$case: at $at", (row) => {
    const { at, minimum, split, expected } = row as {
      at: bigint;
      minimum: bigint;
      split: bigint[] | null;
      expected: bigint | null;
    };
    expect(interruptionResetAt(breaks(at), minimum, split)).toBe(expected);
  });
});

describe("entry queries", () => {
  it.each`
    case                   | at     | status
    ${"inside an entry"}   | ${12n} | ${"driving"}
    ${"at an entry start"} | ${16n} | ${"off"}
    ${"at an entry end"}   | ${17n} | ${undefined}
    ${"inside a gap"}      | ${18n} | ${undefined}
    ${"before the log"}    | ${-1n} | ${undefined}
  `("entryHolding $case: at $at", (row) => {
    const { at, status } = row as { at: bigint; status: string | undefined };
    expect(entryHolding(store, at)?.status).toBe(status);
  });

  it("cuts the last entry at the instant", () => {
    expect(lastEntryBefore(store, 27n)).toEqual(entry("off", 25n, 27n));
    expect(lastEntryBefore(store, 25n)).toEqual(entry("driving", 20n, 25n));
    expect(lastEntryBefore(store, 0n)).toBeUndefined();
  });

  it("finds the log start only once it has begun", () => {
    expect(logStartBefore(store, 0n)).toBeUndefined();
    expect(logStartBefore(store, 1n)).toBe(0n);
  });

  it.each`
    case                             | from    | at      | start
    ${"from the log start"}          | ${null} | ${100n} | ${11n}
    ${"from an entry start"}         | ${12n}  | ${100n} | ${20n}
    ${"the match starts at the cut"} | ${12n}  | ${20n}  | ${undefined}
    ${"nothing matches after"}       | ${21n}  | ${100n} | ${undefined}
  `("firstEntryIn $case", (row) => {
    const { from, at, start } = row as {
      from: bigint | null;
      at: bigint;
      start: bigint | undefined;
    };
    expect(firstEntryIn(store, driving, from, at)?.start).toBe(start);
  });

  it("answers every entry query on an empty log", () => {
    const empty = createRunStore([]);
    expect(entryHolding(empty, 1n)).toBeUndefined();
    expect(lastEntryBefore(empty, 1n)).toBeUndefined();
    expect(logStartBefore(empty, 1n)).toBeUndefined();
    expect(firstEntryIn(empty, driving, null, 5n)).toBeUndefined();
  });
});

// The same log, at the edges of each search. Runs of "off": [0,10) [16,17) [25,30).
describe("run index boundaries", () => {
  it.each`
    case                         | from   | to      | at      | expected
    ${"at is an entry end"}      | ${0n}  | ${100n} | ${10n}  | ${10n}
    ${"at is an entry start"}    | ${0n}  | ${100n} | ${16n}  | ${10n}
    ${"to is an entry start"}    | ${0n}  | ${16n}  | ${100n} | ${10n}
    ${"from is an entry start"}  | ${16n} | ${100n} | ${100n} | ${6n}
    ${"one whole entry"}         | ${16n} | ${17n}  | ${100n} | ${1n}
    ${"from past the log end"}   | ${30n} | ${99n}  | ${100n} | ${0n}
    ${"to at the log end"}       | ${0n}  | ${30n}  | ${100n} | ${16n}
    ${"to before the first run"} | ${-9n} | ${0n}   | ${100n} | ${0n}
    ${"from before the log"}     | ${-9n} | ${5n}   | ${100n} | ${5n}
  `("timeInBefore $case: [$from, $to) at $at is $expected", (row) => {
    const { from, to, at, expected } = row as {
      from: bigint;
      to: bigint;
      at: bigint;
      expected: bigint;
    };
    expect(timeInBefore(offIndex, from, to, at)).toBe(expected);
  });

  it.each`
    case                          | at      | count | last
    ${"before the first instant"} | ${-5n}  | ${0}  | ${undefined}
    ${"one into the first run"}   | ${1n}   | ${1}  | ${{ start: 0n, end: 1n }}
    ${"exactly a run end"}        | ${10n}  | ${1}  | ${{ start: 0n, end: 10n }}
    ${"exactly the last start"}   | ${25n}  | ${2}  | ${{ start: 16n, end: 17n }}
    ${"exactly the log end"}      | ${30n}  | ${3}  | ${{ start: 25n, end: 30n }}
    ${"one past the log end"}     | ${31n}  | ${3}  | ${{ start: 25n, end: 30n }}
    ${"far past the log end"}     | ${999n} | ${3}  | ${{ start: 25n, end: 30n }}
  `("runsUntil $case: at $at", (row) => {
    const { at, count, last } = row as {
      at: bigint;
      count: number;
      last: { start: bigint; end: bigint } | undefined;
    };
    const view = runsUntil(offIndex, at);
    expect(view.count).toBe(count);
    expect(view.last).toEqual(last);
  });

  it.each`
    case                                 | at     | minimum | expected
    ${"minimum is exactly a run length"} | ${99n} | ${10n}  | ${{ start: 0n, end: 10n }}
    ${"minimum is one over a run"}       | ${99n} | ${11n}  | ${undefined}
    ${"minimum is exactly the cut last"} | ${27n} | ${2n}   | ${{ start: 25n, end: 27n }}
    ${"a run of one, exactly minimum"}   | ${17n} | ${1n}   | ${{ start: 16n, end: 17n }}
    ${"cut at a run start drops it"}     | ${25n} | ${2n}   | ${{ start: 0n, end: 10n }}
    ${"later equal minimum wins"}        | ${99n} | ${5n}   | ${{ start: 25n, end: 30n }}
    ${"on a view with no runs"}          | ${-1n} | ${1n}   | ${undefined}
  `("lastAtLeastUntil $case: at $at, minimum $minimum", (row) => {
    const { at, minimum, expected } = row as {
      at: bigint;
      minimum: bigint;
      expected: { start: bigint; end: bigint } | undefined;
    };
    expect(lastAtLeastUntil(runsUntil(offIndex, at), minimum)).toEqual(
      expected,
    );
  });

  it.each`
    case                                | at     | t      | expected
    ${"the first run"}                  | ${99n} | ${10n} | ${{ start: 0n, end: 10n }}
    ${"the last run, whole"}            | ${99n} | ${30n} | ${{ start: 25n, end: 30n }}
    ${"a run start is not an end"}      | ${99n} | ${16n} | ${undefined}
    ${"before every run"}               | ${99n} | ${0n}  | ${undefined}
    ${"past every run"}                 | ${99n} | ${31n} | ${undefined}
    ${"the run's full end after a cut"} | ${17n} | ${30n} | ${undefined}
    ${"the cut end at a run start"}     | ${16n} | ${16n} | ${undefined}
    ${"the end of the run kept whole"}  | ${10n} | ${10n} | ${{ start: 0n, end: 10n }}
  `("runEndingAt $case: ending at $t, as at $at", (row) => {
    const { at, t, expected } = row as {
      at: bigint;
      t: bigint;
      expected: { start: bigint; end: bigint } | undefined;
    };
    expect(runEndingAt(runsUntil(offIndex, at), t)).toEqual(expected);
  });

  it("finds no run ending on an empty index", () => {
    const view = runsUntil(runIndex(createRunStore([]), off), 5n);
    expect(runEndingAt(view, 5n)).toBeUndefined();
    expect(lastAtLeastUntil(view, 1n)).toBeUndefined();
  });

  // Runs of "off" are 10, 1 and 5 long, starting at 0, 16 and 25.
  it.each`
    case                                 | at     | min    | max     | from   | to      | skip    | expected
    ${"from is exactly a start"}         | ${99n} | ${1n}  | ${6n}   | ${16n} | ${null} | ${null} | ${2}
    ${"from is one past a start"}        | ${99n} | ${1n}  | ${6n}   | ${17n} | ${null} | ${null} | ${1}
    ${"to is exactly a start"}           | ${99n} | ${1n}  | ${6n}   | ${0n}  | ${25n}  | ${null} | ${1}
    ${"to is one past a start"}          | ${99n} | ${1n}  | ${6n}   | ${0n}  | ${26n}  | ${null} | ${2}
    ${"maximum is exclusive"}            | ${99n} | ${1n}  | ${5n}   | ${0n}  | ${null} | ${null} | ${1}
    ${"minimum is inclusive"}            | ${99n} | ${5n}  | ${null} | ${0n}  | ${null} | ${null} | ${2}
    ${"no maximum counts the longest"}   | ${99n} | ${1n}  | ${null} | ${0n}  | ${null} | ${null} | ${3}
    ${"skip matches the last run's end"} | ${99n} | ${1n}  | ${null} | ${0n}  | ${null} | ${30n}  | ${2}
    ${"skip matches no run end"}         | ${99n} | ${1n}  | ${null} | ${0n}  | ${null} | ${29n}  | ${3}
    ${"skip never reaches a whole run"}  | ${99n} | ${1n}  | ${null} | ${0n}  | ${null} | ${17n}  | ${3}
    ${"no run is long enough"}           | ${99n} | ${11n} | ${null} | ${0n}  | ${null} | ${null} | ${0}
    ${"before the first run"}            | ${0n}  | ${1n}  | ${null} | ${0n}  | ${null} | ${null} | ${0}
    ${"cut at the first run's start+1"}  | ${1n}  | ${1n}  | ${null} | ${0n}  | ${null} | ${null} | ${1}
    ${"from past every start"}           | ${99n} | ${1n}  | ${null} | ${26n} | ${null} | ${null} | ${0}
  `("countEvents $case", (row) => {
    const { at, min, max, from, to, skip, expected } = row as {
      at: bigint;
      min: bigint;
      max: bigint | null;
      from: bigint;
      to: bigint | null;
      skip: bigint | null;
      expected: number;
    };
    expect(
      countEvents(
        runsUntil(offIndex, at),
        { minimum: min, maximum: max },
        { from, to },
        skip,
      ),
    ).toBe(expected);
  });

  it.each`
    case                                      | at     | minimum | split        | expected
    ${"a break of exactly the minimum"}       | ${99n} | ${10n}  | ${null}      | ${10n}
    ${"one over every break"}                 | ${99n} | ${11n}  | ${null}      | ${null}
    ${"the last of two long breaks wins"}     | ${99n} | ${5n}   | ${null}      | ${30n}
    ${"a split completing on the last break"} | ${99n} | ${20n}  | ${[1n, 1n]}  | ${17n}
    ${"a split restarting after a reset"}     | ${99n} | ${20n}  | ${[5n, 1n]}  | ${17n}
    ${"a split the first break cannot start"} | ${10n} | ${20n}  | ${[11n, 1n]} | ${null}
  `("interruptionResetAt $case: at $at", (row) => {
    const { at, minimum, split, expected } = row as {
      at: bigint;
      minimum: bigint;
      split: bigint[] | null;
      expected: bigint | null;
    };
    expect(interruptionResetAt(runsUntil(offIndex, at), minimum, split)).toBe(
      expected,
    );
  });

  it("keeps one index for one set and for the same complement", () => {
    expect(runIndex(store, off)).toBe(offIndex);
    expect(runIndex(store, { not: off })).toBe(runIndex(store, { not: off }));
    expect(runIndex(store, { not: off, within: null })).toBe(
      runIndex(store, { not: off }),
    );
    expect(runIndex(store, { not: off, within: driving })).not.toBe(
      runIndex(store, { not: off }),
    );
  });

  // Driving is [11,16) and [20,25): 5 + 2 up to 22.
  it("counts a complement narrowed to another set", () => {
    const narrowed = runIndex(store, { not: off, within: driving });
    expect(timeInBefore(narrowed, 0n, 100n, 22n)).toBe(7n);
    expect(timeInBefore(narrowed, 0n, 100n, 100n)).toBe(10n);
    expect(narrowed.runs).toEqual([
      { start: 11n, end: 16n },
      { start: 20n, end: 25n },
    ]);
  });

  it("joins touching entries into one run", () => {
    // on [10,11) touches driving [11,16): outside off, one run [10,16).
    expect(runIndex(store, { not: off }).runs[0]).toEqual({
      start: 10n,
      end: 16n,
    });
  });

  it.each`
    case                                     | at      | status
    ${"the first instant"}                   | ${0n}   | ${"off"}
    ${"an entry end that is the next start"} | ${10n}  | ${"on"}
    ${"the last instant held"}               | ${29n}  | ${"off"}
    ${"the log end"}                         | ${30n}  | ${undefined}
    ${"far past the log"}                    | ${999n} | ${undefined}
  `("entryHolding $case: at $at", (row) => {
    const { at, status } = row as { at: bigint; status: string | undefined };
    expect(entryHolding(store, at)?.status).toBe(status);
  });

  it("lastEntryBefore at the edges of the log", () => {
    expect(lastEntryBefore(store, 1n)).toEqual(entry("off", 0n, 1n));
    expect(lastEntryBefore(store, 10n)).toEqual(entry("off", 0n, 10n));
    expect(lastEntryBefore(store, 11n)).toEqual(entry("on", 10n, 11n));
    expect(lastEntryBefore(store, 18n)).toEqual(entry("off", 16n, 17n));
    expect(lastEntryBefore(store, 30n)).toEqual(entry("off", 25n, 30n));
    expect(lastEntryBefore(store, 999n)).toEqual(entry("off", 25n, 30n));
  });

  it.each`
    case                              | from    | at      | start
    ${"from exactly a match start"}   | ${20n}  | ${100n} | ${20n}
    ${"from one past a match start"}  | ${21n}  | ${100n} | ${undefined}
    ${"from past every entry"}        | ${999n} | ${999n} | ${undefined}
    ${"cut one past the match start"} | ${12n}  | ${21n}  | ${20n}
    ${"cut before the log"}           | ${null} | ${0n}   | ${undefined}
  `("firstEntryIn $case", (row) => {
    const { from, at, start } = row as {
      from: bigint | null;
      at: bigint;
      start: bigint | undefined;
    };
    expect(firstEntryIn(store, driving, from, at)?.start).toBe(start);
  });

  it("finds no entry of a set the log never holds", () => {
    expect(
      firstEntryIn(store, new Set(["sleeper"]), null, 999n),
    ).toBeUndefined();
  });
});

describe("latestPairFrom", () => {
  // Rests of 3, 2, 5, 1, 3, 3 hours long, each apart by one hour of work:
  //   R0 [0,3)  R1 [4,6)  R2 [7,12)  R3 [13,14)  R4 [15,18)  R5 [19,22)
  // Full rest 5, pair floors each 2, one 3, combined 5. Worked by hand: (R0, R1) pair (3 and 2:
  // longer 3 >= 3, together 5 >= 5); R2 is a full rest and pairs with nothing; R3 is under each
  // and is skipped; (R4, R5) pair (3 and 3).
  const pairLog: DutyLogEntry[] = [
    entry("off", 0n, 3n),
    entry("on", 3n, 4n),
    entry("off", 4n, 6n),
    entry("on", 6n, 7n),
    entry("off", 7n, 12n),
    entry("on", 12n, 13n),
    entry("off", 13n, 14n),
    entry("on", 14n, 15n),
    entry("off", 15n, 18n),
    entry("on", 18n, 19n),
    entry("off", 19n, 22n),
  ];
  const pairIndex = runIndex(createRunStore(pairLog), off);
  const floors = { each: 2n, one: 3n, combined: 5n };
  const pairAt = (at: bigint, from: number) =>
    latestPairFrom(runsUntil(pairIndex, at), from, 5n, floors);

  it.each`
    case                                       | at     | from | first                       | second
    ${"the whole log"}                         | ${99n} | ${0} | ${{ start: 15n, end: 18n }} | ${{ start: 19n, end: 22n }}
    ${"the last run is cut but still pairs"}   | ${21n} | ${0} | ${{ start: 15n, end: 18n }} | ${{ start: 19n, end: 21n }}
    ${"the cut last run is under each"}        | ${20n} | ${0} | ${{ start: 0n, end: 3n }}   | ${{ start: 4n, end: 6n }}
    ${"a cut run pairs with the one before"}   | ${11n} | ${0} | ${{ start: 4n, end: 6n }}   | ${{ start: 7n, end: 11n }}
    ${"the full rest, whole, pairs nothing"}   | ${12n} | ${0} | ${{ start: 0n, end: 3n }}   | ${{ start: 4n, end: 6n }}
    ${"the first rest is before from"}         | ${6n}  | ${1} | ${undefined}                | ${undefined}
    ${"a pair of runs from the second run on"} | ${99n} | ${1} | ${{ start: 15n, end: 18n }} | ${{ start: 19n, end: 22n }}
  `("$case: at $at from run $from", (row) => {
    const { at, from, first, second } = row as {
      at: bigint;
      from: number;
      first: { start: bigint; end: bigint } | undefined;
      second: { start: bigint; end: bigint } | undefined;
    };
    const found = pairAt(at, from);
    expect(found?.first).toEqual(first);
    expect(found?.second).toEqual(second);
  });

  it("finds no pair on an empty log", () => {
    const view = runsUntil(runIndex(createRunStore([]), off), 5n);
    expect(latestPairFrom(view, 0, 5n, floors)).toBeUndefined();
  });
});

describe("countInRange", () => {
  const sorted = [1n, 3n, 3n, 5n, 9n];

  it.each`
    case                              | low    | high   | expected
    ${"values inside, with a repeat"} | ${3n}  | ${6n}  | ${3}
    ${"nothing below the first"}      | ${0n}  | ${1n}  | ${0}
    ${"nothing past the last"}        | ${10n} | ${20n} | ${0}
    ${"low at high"}                  | ${3n}  | ${3n}  | ${0}
    ${"low past high"}                | ${6n}  | ${3n}  | ${0}
    ${"every value"}                  | ${0n}  | ${10n} | ${5}
  `("$case: [$low, $high)", (row) => {
    const { low, high, expected } = row as {
      low: bigint;
      high: bigint;
      expected: number;
    };
    expect(countInRange(sorted, low, high)).toBe(expected);
  });

  it("counts nothing in no values", () => {
    expect(countInRange([], 0n, 10n)).toBe(0);
  });
});
