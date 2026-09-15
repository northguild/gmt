import { Temporal } from "@js-temporal/polyfill";
import { closedIntervalsAbut } from "./closedAbuts";

const compareNumbers = (left: number, right: number): number => left - right;
const decrement = (value: number): number => value - 1;

const time = (value: string): Temporal.PlainTime =>
  Temporal.PlainTime.from(value);
const oneNanosecondEarlier = (value: Temporal.PlainTime): Temporal.PlainTime =>
  value.subtract({ nanoseconds: 1 });

describe("closedIntervalsAbut", () => {
  it.each`
    aStart | aEnd | bStart | bEnd | expected | reason
    ${1}   | ${3} | ${4}   | ${6} | ${true}  | ${"A ends one before B starts"}
    ${4}   | ${6} | ${1}   | ${3} | ${true}  | ${"B ends one before A starts"}
    ${2}   | ${2} | ${3}   | ${3} | ${true}  | ${"zero-length intervals one apart"}
    ${1}   | ${3} | ${5}   | ${6} | ${false} | ${"gap of one value"}
    ${1}   | ${4} | ${4}   | ${6} | ${false} | ${"share the value 4"}
    ${1}   | ${6} | ${2}   | ${3} | ${false} | ${"A contains B"}
    ${2}   | ${2} | ${2}   | ${2} | ${false} | ${"same single value"}
  `(
    "returns $expected for A=[$aStart, $aEnd] and B=[$bStart, $bEnd] ($reason)",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(
        closedIntervalsAbut(
          aStart,
          aEnd,
          bStart,
          bEnd,
          compareNumbers,
          decrement,
        ),
      ).toBe(expected);
    },
  );

  // PlainTime wraps: 23:59:59.999999999 + 1 ns is 00:00:00. Stepping down from the later start
  // never reaches the wrap, because a later start is never 00:00:00.
  it.each`
    aStart        | aEnd                    | bStart        | bEnd                    | expected
    ${"22:00:00"} | ${"23:59:59.999999999"} | ${"00:00:00"} | ${"01:00:00"}           | ${false}
    ${"00:00:00"} | ${"01:00:00"}           | ${"22:00:00"} | ${"23:59:59.999999999"} | ${false}
    ${"12:00:00"} | ${"23:59:59.999999999"} | ${"00:00:00"} | ${"11:59:59.999999999"} | ${true}
    ${"00:00:00"} | ${"11:59:59.999999999"} | ${"12:00:00"} | ${"23:59:59.999999999"} | ${true}
  `(
    "returns $expected for PlainTime A=[$aStart, $aEnd] and B=[$bStart, $bEnd] without wrapping",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(
        closedIntervalsAbut(
          time(aStart),
          time(aEnd),
          time(bStart),
          time(bEnd),
          Temporal.PlainTime.compare,
          oneNanosecondEarlier,
        ),
      ).toBe(expected);
    },
  );

  it("never steps up, so an end at the maximum PlainDate does not throw", () => {
    const day = (value: string): Temporal.PlainDate =>
      Temporal.PlainDate.from(value);

    expect(
      closedIntervalsAbut(
        day("+275760-09-13"),
        day("+275760-09-13"),
        day("+275760-09-10"),
        day("+275760-09-12"),
        Temporal.PlainDate.compare,
        (value) => value.subtract({ days: 1 }),
      ),
    ).toBe(true);
  });
});
