import { spanNs } from "../../span";
import type { Interval } from "../../types";
import { intersectIntervals } from "./intersectIntervals";
import { mergeIntervals } from "./mergeIntervals";
import { subtractIntervals } from "./subtractIntervals";
import { sumIntervals } from "./sumIntervals";

// 2024-01-01 (unix2024Jan01T000000Ms); times of day override the canonical midnight because
// interval endpoints are the scenario under test. The NY spelling names the same instant as 17:00Z.
const at = (time: string) => `2024-01-01T${time}Z`;
const removalPool: Interval[] = [
  { start: at("08:00:00"), end: at("10:00:00") },
  { start: at("12:00:00"), end: at("13:00:00") },
  { start: at("12:30:00"), end: at("14:00:00") },
  { start: "2024-01-01T12:00:00-05:00", end: at("18:00:00") },
  { start: at("15:00:00"), end: at("15:00:00") },
];
const subsets: Interval[][] = Array.from(
  { length: 2 ** removalPool.length },
  (_, mask) => removalPool.filter((_, k) => (mask & (1 << k)) !== 0),
);

const totalNanoseconds = (pieces: Interval[]) =>
  pieces.reduce(
    (sum, piece) => sum + (spanNs(piece.start, piece.end) as bigint),
    0n,
  );

describe("interval algebra round trip", () => {
  it("enumerates 32 removal subsets", () => {
    expect(subsets).toHaveLength(32);
  });

  it.each`
    start             | end               | reason
    ${at("09:00:00")} | ${at("17:00:00")} | ${"working day"}
    ${at("12:00:00")} | ${at("12:00:00")} | ${"empty interval"}
  `(
    "subtract(i, r) plus i ∩ merge(r) re-covers [$start, $end) exactly for every subset ($reason)",
    ({ start, end }) => {
      const interval = { start, end };

      for (const remove of subsets) {
        const remaining = subtractIntervals(interval, remove);
        const removed = mergeIntervals(remove)
          .map((run) => intersectIntervals(interval, run))
          .filter((piece): piece is Interval => piece !== null);

        expect(totalNanoseconds(remaining) + totalNanoseconds(removed)).toBe(
          spanNs(start, end),
        );
        expect(sumIntervals([...remaining, ...removed])).toBe(
          sumIntervals([interval]),
        );
      }
    },
  );
});
