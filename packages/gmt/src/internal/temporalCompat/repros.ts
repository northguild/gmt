import { Temporal } from "../temporal";
import {
  type DefectId,
  type ProbeRepro,
  probeReproGroups,
} from "./probeRepros";

/*
 * Every upstream repro for each `temporal-polyfill` or runtime-ICU defect GMT works around, with
 * the spec-correct answer: the probe groups from `probeRepros.ts` plus the canary-only D9 group
 * below. No shipped module imports this file: a repro the shipped probes do not read lives here,
 * so it never reaches a bundle. It imports ONLY the polyfill (through `../temporal`) and
 * `probeRepros.ts`, so a canary script can load its compiled copy straight from `dist` and report
 * which workarounds are still needed.
 *
 * `expected` is test data, like a fixture: it is compared against `run()` and never read by a
 * fallback. Sources: test262, Chromium native Temporal (ICU4X) — never the polyfill or GMT. See
 * README.md for each defect.
 */

export type { DefectId } from "./probeRepros";

/**
 * Canary-only groups no capability probe gates. D9 (`monthRange.ts`): the guard is always on, and
 * a probe large enough to show the cost would be the cost itself.
 */
export type BoundedWorkDefectId = "D9";

export interface Repro extends Omit<ProbeRepro, "defect"> {
  defect: DefectId | BoundedWorkDefectId;
}

/**
 * D9, out-of-range half: a month amount past the date range throws RangeError, as the
 * specification requires, but only after work linear in the amount. Hebrew 2024-01-15 + 40,000,000
 * months and + 400,000,000 months both throw; bounded work takes about as long for the second as
 * for the first, linear work about ten times as long. The repro runs the first call and fails at
 * once, without the second, when it took longer than `D9_CEILING_MS` (5,000 ms): bounded work is
 * far under that, and the second call would cost ten times as much. Otherwise it passes when
 * `t2 < 3 × t1 + 10` ms (a ratio is independent of engine speed). Any result other than a
 * RangeError from either call fails it. GMT's `assertMonthsInRange` (`monthRange.ts`) throws first.
 * Cost on 1.0.8, the runtime GMT ships, measured on Node: the first call takes about 15 ms and
 * the second about 100 ms, so both pass the ceiling and the ratio fails the repro (linear work).
 * Polyfill 0.5.1 stops adding at the range limit, and its first call alone takes about 12 s to
 * 30 s, so the ceiling fails the repro at once.
 */
const D9_OUT_OF_RANGE_MONTHS = 40_000_000;
const D9_CEILING_MS = 5_000;
const D9_RATIO = 3;
const D9_SLACK_MS = 10;

function millisecondsToThrow(months: number): number | string {
  const start = Temporal.PlainDate.from("2024-01-15[u-ca=hebrew]");
  const before = performance.now();
  try {
    start.add({ months });
  } catch (error) {
    if (error instanceof RangeError) {
      return performance.now() - before;
    }
    return `${months} months threw ${String(error)}`;
  }
  return `${months} months did not throw`;
}

const d9OutOfRangeRepros: readonly Repro[] = [
  {
    defect: "D9",
    calendar: "hebrew",
    name: "outOfRangeMonthsThrowInBoundedTime",
    expected: "bounded",
    run: () => {
      const t1 = millisecondsToThrow(D9_OUT_OF_RANGE_MONTHS);
      if (typeof t1 === "string") {
        return t1;
      }
      if (t1 > D9_CEILING_MS) {
        return `${t1.toFixed(0)} ms for ${D9_OUT_OF_RANGE_MONTHS} months, over ${D9_CEILING_MS} ms`;
      }
      const t2 = millisecondsToThrow(D9_OUT_OF_RANGE_MONTHS * 10);
      if (typeof t2 === "string") {
        return t2;
      }
      return t2 < D9_RATIO * t1 + D9_SLACK_MS
        ? "bounded"
        : `${t1.toFixed(0)} ms, then ${t2.toFixed(0)} ms for ten times the months`;
    },
  },
];

export const repros: readonly Repro[] = [
  ...d9OutOfRangeRepros,
  ...probeReproGroups.d16,
  ...probeReproGroups.d17,
  ...probeReproGroups.d19,
  ...probeReproGroups.d22,
];

/** The repro with this defect, calendar and name, if any. */
export function findRepro(
  defect: DefectId | BoundedWorkDefectId,
  calendar: string,
  name: string,
): Repro | undefined {
  return repros.find(
    (repro) =>
      repro.defect === defect &&
      repro.calendar === calendar &&
      repro.name === name,
  );
}
