import { Temporal } from "./temporal";
import {
  countWithin,
  epochDayOf,
  hasEpochDay,
  isoWeekdayOf,
  lowerBound,
  sortedUnique,
} from "./epochDay";

describe("isoWeekdayOf", () => {
  // -271821-04-19 is a Monday: Temporal.PlainDate.from("-271821-04-19").dayOfWeek is 1.
  // +275760-09-13 is a Saturday: its dayOfWeek is 6.
  it.each`
    epochDay                       | expected | description
    ${0}                           | ${4}     | ${"1970-01-01, a Thursday"}
    ${-1}                          | ${3}     | ${"1969-12-31, a Wednesday"}
    ${epochDayOf(-271_821, 4, 19)} | ${1}     | ${"the first PlainDate, a Monday"}
    ${epochDayOf(275_760, 9, 13)}  | ${6}     | ${"the last PlainDate, a Saturday"}
  `("gives $expected for $description", ({ epochDay, expected }) => {
    expect(isoWeekdayOf(epochDay)).toBe(expected);
  });

  it("agrees with PlainDate#dayOfWeek at the Temporal limits", () => {
    expect(Temporal.PlainDate.from("-271821-04-19").dayOfWeek).toBe(1);
    expect(Temporal.PlainDate.from("+275760-09-13").dayOfWeek).toBe(6);
  });
});

describe("countWithin", () => {
  it.each`
    from | to   | expected
    ${2} | ${5} | ${2}
    ${6} | ${9} | ${0}
    ${5} | ${4} | ${0}
    ${1} | ${5} | ${3}
  `(
    "counts $expected of [1, 3, 5] in [$from, $to]",
    ({ from, to, expected }) => {
      expect(countWithin(new Int32Array([1, 3, 5]), from, to)).toBe(expected);
    },
  );
});

describe("lowerBound and hasEpochDay", () => {
  it("returns 0 on an empty array", () => {
    expect(lowerBound(new Int32Array(0), 7)).toBe(0);
    expect(hasEpochDay(new Int32Array(0), 7)).toBe(false);
  });

  it.each`
    epochDay | index | has
    ${0}     | ${0}  | ${false}
    ${3}     | ${1}  | ${true}
    ${4}     | ${2}  | ${false}
    ${9}     | ${3}  | ${false}
  `(
    "finds $epochDay at index $index (member: $has)",
    ({ epochDay, index, has }) => {
      const days = new Int32Array([1, 3, 5]);

      expect(lowerBound(days, epochDay)).toBe(index);
      expect(hasEpochDay(days, epochDay)).toBe(has);
    },
  );
});

describe("sortedUnique", () => {
  it.each`
    input           | expected
    ${[]}           | ${[]}
    ${[1, 3, 5]}    | ${[1, 3, 5]}
    ${[5, 1, 3, 1]} | ${[1, 3, 5]}
    ${[2, 2, 2]}    | ${[2]}
    ${[-1, -10, 4]} | ${[-10, -1, 4]}
  `("turns $input into $expected", ({ input, expected }) => {
    expect(sortedUnique(new Int32Array(input))).toEqual(
      new Int32Array(expected),
    );
  });
});
