/**
 * What the Opening Hours Board says, as words: the two rows of plates (the verdict line is
 * `opening-hours-board-verdict.ts`).
 *
 * Pure: facts in, text out. A refused schedule reads "Schedule refused" across every plate, and a
 * valid schedule that has nothing to say (a closed week, no next opening in the horizon) reads in
 * plain words, never as the library's sentinel. The amber NO SIGNAL belongs to the verdict of a
 * refused schedule alone.
 */
import type { Plate } from "~/widgets/builders";
import {
  localText,
  type BoardFacts,
  type Deadline,
  type Moment,
} from "./opening-hours-board";

// ---------------------------------------------------------------------------
// Plates
// ---------------------------------------------------------------------------

const WORDS = {
  refused: "Schedule refused",
  notAsked: "not asked",
  fromRefused: "From refused",
  toRefused: "To refused",
  durationRefused: "Duration refused",
  withinRefused: "Within refused",
} as const;

/** The widest each plate can read, so a new reading never resizes one. */
const SAMPLES = {
  open: ["false", "true"],
  instant: ["88 May 88:88"],
  duration: ["PT9999H59M59S"],
} as const;

const wordList = Object.values(WORDS);

const plate = (
  caption: string,
  value: string | null,
  sample: readonly string[],
  series: 1 | 2 | 3 | 4,
): Plate => ({
  caption,
  value,
  lines: [],
  samples: [...sample, ...wordList],
  words: wordList,
  series,
});

function momentText(m: Moment, zone: string): string | null {
  switch (m.kind) {
    case "at":
      return localText(m.instant, zone);
    case "none":
      return null;
    case "within-refused":
      return WORDS.withinRefused;
  }
}

function deadlineText(d: Deadline, zone: string): string | null {
  switch (d.kind) {
    case "blank":
      return WORDS.notAsked;
    case "duration-refused":
      return WORDS.durationRefused;
    case "within-refused":
      return WORDS.withinRefused;
    case "none":
      return null;
    case "at":
      return localText(d.instant, zone);
  }
}

/** The two rows of plates for a reading, or `null` before there is one. */
export function boardPlates(
  facts: BoardFacts | null,
  zone: string,
): [Plate[], Plate[]] {
  const row = (
    values: readonly [string | null, string | null, string | null],
    second: readonly [string | null, string | null],
  ): [Plate[], Plate[]] => [
    [
      plate("isOpenAt", values[0], SAMPLES.open, 1),
      plate("nextOpenAt", values[1], SAMPLES.instant, 2),
      plate("nextCloseAt", values[2], SAMPLES.instant, 3),
    ],
    [
      plate("operatingTimeBetween", second[0], SAMPLES.duration, 1),
      plate("addOperatingTime", second[1], SAMPLES.instant, 2),
    ],
  ];
  if (facts === null) return row([null, null, null], [null, null]);
  if (facts.kind === "refused") {
    const r = WORDS.refused;
    return row([r, r, r], [r, r]);
  }
  const reading = facts.reading;
  if (reading.kind === "blank") {
    const n = WORDS.notAsked;
    return row([n, n, n], [n, n]);
  }
  if (reading.kind === "from-refused") {
    const r = WORDS.fromRefused;
    return row([r, r, r], [r, r]);
  }
  const between =
    reading.between.kind === "blank"
      ? WORDS.notAsked
      : reading.between.kind === "refused"
        ? WORDS.toRefused
        : reading.between.duration;
  return row(
    [
      String(reading.openAtFrom),
      momentText(reading.nextOpen, zone),
      momentText(reading.nextClose, zone),
    ],
    [between, deadlineText(reading.deadline, zone)],
  );
}
