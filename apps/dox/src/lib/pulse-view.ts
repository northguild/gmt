/**
 * The rules `/pulse/` applies to a schedule and its run history: how a cron reads in words, which
 * of the last expected runs happened and how each ended, and when the history is too old to trust.
 *
 * Time is GMT's (`parseCronExpression`, `cronRuns`, `formatUtc`), never `Date`. Nothing here reads
 * a clock: every function takes the instants it needs, so the same inputs give the same page at
 * build and the same answer in a test.
 */
// The package root, not a subpath: see `upstream-summary.ts` for the dev-server alias trap.
import {
  addUtc,
  cronRuns,
  diffUtc,
  formatUtc,
  isBeforeUtc,
  parseCronExpression,
} from "@northguild/gmt";

/** How many expected runs a strip shows. */
export const BEAT_COUNT = 8;

/** A read older than this many days is not trusted: the strip says NO SIGNAL. */
export const STALE_AFTER_DAYS = 8;

/** How far back the expected runs are searched; wide enough for eight of any daily or weekly run. */
const LOOKBACK_DAYS = 70;

/** Any instant before the first run; the weekday of the next run after it names the weekday. */
const ANCHOR = "2000-01-01T00:00:00Z";

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * "Every Monday at 06:17 UTC" or "Every day at 06:00 UTC". Accepts a fixed minute and hour with the
 * day of the week `*` or one weekday, and throws on anything else, so a new kind of schedule is a
 * decision here and not a silently wrong sentence.
 */
export function cadenceText(cron: string): string {
  const e = parseCronExpression(cron);
  if (
    e === null ||
    e.minute.values.length !== 1 ||
    e.hour.values.length !== 1 ||
    !e.dayOfMonth.star ||
    !e.month.star
  ) {
    throw new Error(`pulse: cannot read the schedule "${cron}" in words`);
  }
  const time = `${pad2(e.hour.values[0]!)}:${pad2(e.minute.values[0]!)} UTC`;
  if (e.dayOfWeek.star && e.dayOfWeek.values.length === 7) {
    return `Every day at ${time}`;
  }
  if (e.dayOfWeek.values.length !== 1) {
    throw new Error(`pulse: cannot read the schedule "${cron}" in words`);
  }
  const next = cronRuns(
    e,
    "UTC",
    { after: ANCHOR, count: 1 },
    "crontabMatch",
  )[0];
  if (next === undefined) {
    throw new Error(`pulse: the schedule "${cron}" never runs`);
  }
  const weekday = formatUtc(next.instant, "en", {
    timeZone: "UTC",
    weekday: "long",
  });
  return `Every ${weekday} at ${time}`;
}

/** The first run after `after`, as an instant, or `null` when the schedule never fires again. */
export function nextRun(cron: string, after: string): string | null {
  const e = parseCronExpression(cron);
  if (e === null) return null;
  return (
    cronRuns(e, "UTC", { after, count: 1 }, "crontabMatch")[0]?.instant ?? null
  );
}

/** A run as the run history file holds it. */
export interface Run {
  startedAt: string;
  conclusion: string;
  url: string;
}

export type BeatResult = "passed" | "failed" | "unfinished" | "none";

/** The words a result is called, and how it is drawn. Never a colour word. */
export const RESULT_WORD: Readonly<Record<BeatResult, string>> = {
  passed: "Passed",
  failed: "Failed",
  unfinished: "Did not finish",
  none: "No run",
};

export const RESULT_PATTERN: Readonly<
  Record<BeatResult, "solid" | "cross" | "outline" | "dotted">
> = {
  passed: "solid",
  failed: "cross",
  unfinished: "outline",
  none: "dotted",
};

export interface Beat {
  /** The time the schedule said the run would start (UTC). */
  expected: string;
  result: BeatResult;
  /** The run that answered it, when there was one. */
  run: Run | null;
}

/** How GitHub's conclusion reads as one of the four results. */
export function resultOf(conclusion: string): BeatResult {
  switch (conclusion) {
    case "success":
    case "neutral":
      return "passed";
    case "failure":
    case "startup_failure":
      return "failed";
    default:
      return "unfinished";
  }
}

/**
 * The last `BEAT_COUNT` expected runs up to `runsRead`, oldest first, each with the run that
 * answered it. A run answers the expected time it started after and before the next one: GitHub may
 * start a scheduled run hours late, so a 13:00 start answers a 06:17 schedule. An expected time
 * with no run is `none`; a second run in the same gap is ignored in favour of the newest.
 * `runs` is newest first, as the history file holds it.
 */
export function beats(
  cron: string,
  runs: readonly Run[],
  runsRead: string,
): Beat[] {
  const e = parseCronExpression(cron);
  if (e === null) throw new Error(`pulse: cannot read the schedule "${cron}"`);
  const expected = cronRuns(
    e,
    "UTC",
    { start: addUtc(runsRead, { days: -LOOKBACK_DAYS }), end: runsRead },
    "crontabMatch",
  )
    .map((r) => r.instant)
    .slice(-BEAT_COUNT);
  return expected.map((time, i) => {
    const next = expected[i + 1];
    const answer =
      runs.find(
        (r) =>
          !isBeforeUtc(r.startedAt, time) &&
          (next === undefined || isBeforeUtc(r.startedAt, next)),
      ) ?? null;
    return {
      expected: time,
      result: answer === null ? "none" : resultOf(answer.conclusion),
      run: answer,
    };
  });
}

/** Why a strip cannot be read, in words, or `null` when it can. */
export type NoSignal =
  | { reason: "not-read"; text: string }
  | { reason: "stale"; text: string };

/**
 * Whether the strip can be shown. `runs: null` (no history was read in this build) is always no
 * signal. With `now` given, a read more than `STALE_AFTER_DAYS` old is too: the page was built long
 * ago and what it says about "recent" runs is not recent. Build time passes no `now`.
 */
export function noSignal(
  runs: readonly Run[] | null,
  runsRead: string | null,
  now?: string,
): NoSignal | null {
  if (runs === null || runsRead === null) {
    return { reason: "not-read", text: "Run history not read in this build" };
  }
  if (now !== undefined) {
    const gap = diffUtc(runsRead, now, "days");
    const days = typeof gap === "number" ? Math.floor(gap) : 0;
    if (days > STALE_AFTER_DAYS) {
      return { reason: "stale", text: `Run history is ${days} days old` };
    }
  }
  return null;
}

/** "9 November": the day of a run, in UTC. */
export const dayOf = (instant: string): string =>
  formatUtc(instant, "en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  });

/** "06:17 UTC". */
export const timeOf = (instant: string): string =>
  `${formatUtc(instant, "en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} UTC`;

/** "14 November 2026, 06:02 UTC". */
export const stampOf = (instant: string): string =>
  `${formatUtc(instant, "en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })}, ${timeOf(instant)}`;

/** What a beat says to a screen reader and in the text twin. */
export const beatLabel = (b: Beat): string =>
  b.result === "none"
    ? `${RESULT_WORD.none}, expected ${dayOf(b.expected)}`
    : `${RESULT_WORD[b.result]}, ${dayOf(b.expected)}`;

/** "Last 8 · latest Passed, 9 November". */
export function beatsCaption(list: readonly Beat[]): string {
  const latest = list.at(-1);
  return latest === undefined
    ? "No scheduled run is due yet"
    : `Last ${list.length} · latest ${beatLabel(latest)}`;
}
