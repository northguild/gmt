/**
 * The pictures the two EDI timestamp widgets draw (INT-15): a value taken apart
 * into its fields, and one shared UTC timeline for the zones a reader chose.
 *
 * Pure helpers and one small layout function; the builders under
 * `src/widgets/families/edi/` draw them. Nothing here reads the
 * clock or imports the library: a code's fields are read off what a formatter
 * the caller passes in writes for a probe (`shapeOf`), and the instants are ones
 * the library already returned. The
 * timeline's positions are drawing only, from the polyfill's epoch milliseconds,
 * as `markPositions` always was.
 */
import { Temporal } from "@js-temporal/polyfill";

// ---------------------------------------------------------------------------
// The layout of a code, read off the formatter's own output
// ---------------------------------------------------------------------------

/** The fields a mask holds, as the standards name them (`MI` is the minute, which
 *  the standards also write `MM`). `ZHHMM` is a signed hours-and-minutes offset;
 *  `ZZZ` is the three-character field that holds a signed hour, `UTC` or `GMT`. */
type ShapePart = "CCYY" | "MM" | "DD" | "HH" | "MI" | "SS" | "ZHHMM" | "ZZZ";

/** What a field belongs to, which sets its group's mark. */
type ShapeGroup = "date" | "time" | "offset";

interface ShapeField {
  part: ShapePart;
  /** Characters the field takes. */
  width: number;
  group: ShapeGroup;
}

interface Shape {
  /** The value's fields, or a period's first half. */
  start: readonly ShapeField[];
  /** A period's second half. */
  end?: readonly ShapeField[];
  /** What sits between a period's halves: `""` for UN/EDIFACT, `"-"` for X12. */
  separator: string;
}

/**
 * How a value of a kind is probed: house values whose every field differs, so a
 * digit run in what the formatter writes names its field. The kind comes from the
 * classifier; the formatter is the library's. The site holds no table of codes:
 * a code's layout is whatever its formatter writes for these values.
 *
 * The start half is the year 1987, month 03, day 14, hour 15, minute 26, second 48
 * and an offset of +07:30; a period's end half is 1991, 05, 22, 08, 11 and 37.
 */
type ProbeFamily = "date" | "time" | "dateTime" | "offsetDateTime";

const PROBES: Record<ProbeFamily, readonly [string, string][]> = {
  date: [["1987-03-14", "1991-05-22"]],
  time: [["15:26:48", "08:11:37"]],
  dateTime: [["1987-03-14T15:26:48", "1991-05-22T08:11:37"]],
  // Whole-hour offsets for the codes that hold only a signed hour.
  offsetDateTime: [
    ["1987-03-14T15:26:48+07:30", "1991-05-22T08:11:37+07:30"],
    ["1987-03-14T15:26:48+07:00", "1991-05-22T08:11:37+07:00"],
  ],
};

/** The probe family of a classifier kind. */
export function probeFamily(kind: string): ProbeFamily {
  if (kind === "time") return "time";
  if (
    kind === "dateTime" ||
    kind === "dateTimePeriod" ||
    kind === "dateTimeRange"
  ) {
    return "dateTime";
  }
  if (kind === "offsetDateTime") return "offsetDateTime";
  return "date";
}

type Token = {
  text: string;
  half: 0 | 1;
  part: ShapePart;
  group: ShapeGroup;
};

const TOKENS: readonly Token[] = [
  { text: "1987", half: 0, part: "CCYY", group: "date" },
  { text: "03", half: 0, part: "MM", group: "date" },
  { text: "14", half: 0, part: "DD", group: "date" },
  { text: "15", half: 0, part: "HH", group: "time" },
  { text: "26", half: 0, part: "MI", group: "time" },
  { text: "48", half: 0, part: "SS", group: "time" },
  { text: "1991", half: 1, part: "CCYY", group: "date" },
  { text: "05", half: 1, part: "MM", group: "date" },
  { text: "22", half: 1, part: "DD", group: "date" },
  { text: "08", half: 1, part: "HH", group: "time" },
  { text: "11", half: 1, part: "MI", group: "time" },
  { text: "37", half: 1, part: "SS", group: "time" },
];

/** Reads a written probe back into fields; `null` when some of it is not a field
 *  of the probe, so a shape is never half-read. */
function readFields(written: string): Shape | null {
  const halves: ShapeField[][] = [[]];
  let separator = "";
  let i = 0;
  while (i < written.length) {
    const here = written.slice(i);
    const current = halves[halves.length - 1]!;
    if ((here[0] === "+" || here[0] === "-") && here.slice(1, 3) === "07") {
      if (here.slice(3, 5) === "30") {
        current.push({ part: "ZHHMM", width: 5, group: "offset" });
        i += 5;
      } else {
        current.push({ part: "ZZZ", width: 3, group: "offset" });
        i += 3;
      }
      continue;
    }
    const token = TOKENS.find((t) => here.startsWith(t.text));
    if (token !== undefined) {
      if (token.half === 1 && halves.length === 1) halves.push([]);
      halves[token.half]!.push({
        part: token.part,
        width: token.text.length,
        group: token.group,
      });
      i += token.text.length;
      continue;
    }
    if (
      /^[^0-9A-Za-z]/.test(here) &&
      halves.length === 1 &&
      current.length > 0
    ) {
      separator = here[0]!;
      halves.push([]);
      i += 1;
      continue;
    }
    return null;
  }
  const [start, end] = halves;
  if (start === undefined || start.length === 0) return null;
  if (end !== undefined && end.length === 0) return null;
  return { start, ...(end === undefined ? {} : { end }), separator };
}

/**
 * The layout of a code: what `write` (the kind's formatter, with the code fixed)
 * writes for the family's probe, read back as fields. `write` takes the probe's
 * start and, for a period, its end. `null` when nothing is written.
 */
export function shapeOf(
  write: (start: string, end: string) => string,
  family: ProbeFamily,
): Shape | null {
  for (const [start, end] of PROBES[family]) {
    const written = write(start, end);
    if (written !== "") return readFields(written);
  }
  return null;
}

/** The characters a shape takes, halves and separator included. */
function shapeWidth(shape: Shape): number {
  const sum = (fields: readonly ShapeField[]): number =>
    fields.reduce((n, f) => n + f.width, 0);
  return (
    sum(shape.start) +
    (shape.end === undefined ? 0 : shape.separator.length + sum(shape.end))
  );
}

/** One field of a real value: its characters and the field they sit in. */
interface ValueCell {
  field: ShapeField;
  text: string;
}

/** A value cut along a shape: one list of cells per half. */
interface ValueCells {
  halves: ValueCell[][];
  separator: string;
}

/** Cuts a value along a shape. `null` when the value's length is not the shape's. */
export function cutValue(value: string, shape: Shape): ValueCells | null {
  if (value.length !== shapeWidth(shape)) return null;
  let at = 0;
  const take = (fields: readonly ShapeField[]): ValueCell[] =>
    fields.map((field) => {
      const text = value.slice(at, at + field.width);
      at += field.width;
      return { field, text };
    });
  const first = take(shape.start);
  if (shape.end === undefined) return { halves: [first], separator: "" };
  const gap = value.slice(at, at + shape.separator.length);
  if (gap !== shape.separator) return null;
  at += shape.separator.length;
  return { halves: [first, take(shape.end)], separator: shape.separator };
}

/** The mask letters of a part, as the standards print them. */
export function maskOf(part: ShapePart): string {
  return part === "MI" ? "MM" : part;
}

/** A part named in words, for the label a screen reader hears. */
export function partWord(part: ShapePart): string {
  switch (part) {
    case "CCYY":
      return "year";
    case "MM":
      return "month";
    case "DD":
      return "day";
    case "HH":
      return "hour";
    case "MI":
      return "minute";
    case "SS":
      return "second";
    case "ZHHMM":
      return "offset";
    case "ZZZ":
      return "zone";
  }
}

// ---------------------------------------------------------------------------
// The value, taken apart
// ---------------------------------------------------------------------------

/** What colours a field's mark. `neutral` is a refused value: no group claims it.
 *  `none` is an element that was not sent: a ghost box with words in it. */
export type PicGroup = ShapeGroup | "neutral" | "none";

export interface PicField {
  text: string;
  /** The standard's own mask letters, `""` when the field has none. */
  mask: string;
  group: PicGroup;
  /** The field in words, for the label a screen reader hears. */
  word: string;
  /** The words under its bracket, when they are not the group's name. */
  bracket?: string;
}

/** One half of a value: a whole value, or one end of a period. */
export interface PicHalf {
  /** `start` or `end` for a period, `""` for a single value. */
  label: string;
  fields: PicField[];
}

/** The fields of a cut value, in a group colour or neutral. */
export function picHalves(cut: ValueCells, neutral: boolean): PicHalf[] {
  const period = cut.halves.length > 1;
  return cut.halves.map((cells, i) => ({
    label: period ? (i === 0 ? "start" : "end") : "",
    fields: cells.map((c) => ({
      text: c.text,
      mask: maskOf(c.field.part),
      group: neutral ? "neutral" : c.field.group,
      word: partWord(c.field.part),
    })),
  }));
}

/** A value whose characters no shape cuts: one neutral box, no mask. */
export function plainHalves(text: string): PicHalf[] {
  return [
    {
      label: "",
      fields: [{ text, mask: "", group: "neutral", word: "text" }],
    },
  ];
}

// ---------------------------------------------------------------------------
// The parts a value arrives in
// ---------------------------------------------------------------------------

/** One part of a segment or an element list: its text, what it is, and the
 *  separator that follows it as sent. */
export interface PicPart {
  text: string;
  caption: string;
  /** The service character after the part, shown as sent. */
  after: string;
  /** A short mark of the part's kind, so a CSS rule can quiet the tag and the
   *  qualifier. */
  kind: "tag" | "plain" | "value" | "code";
}

/**
 * The picture's one spoken line: what each field holds, in words. `value` is the
 * whole value, `format` its code, and the clause list names each field in order.
 */
export function figureAria(
  value: string,
  format: string,
  halves: readonly PicHalf[],
  tail: string,
): string {
  const say = (fields: readonly PicField[]): string =>
    fields.map((f) => `${f.word} ${f.text}`).join(", ");
  const body =
    halves.length === 1
      ? say(halves[0]!.fields)
      : halves.map((h) => `${h.label}: ${say(h.fields)}`).join("; ");
  const under = format === "" ? "" : ` under code ${format}`;
  return `${value}${under}: ${body}${tail === "" ? "" : `; ${tail}`}`;
}

// ---------------------------------------------------------------------------
// The shared UTC timeline
// ---------------------------------------------------------------------------

const HOUR = 3_600_000;

/** One zone's mark: its row number (1 to 4), the zone and the resolved instant. */
export interface TimelineInput {
  n: number;
  zone: string;
  instant: string;
}

interface TimelineTick {
  /** 0 to 100, along the axis. */
  at: number;
  /** `HH:00` in UTC, or `""` when this tick carries no label. */
  label: string;
  /** `MM-DD` on a midnight tick, else `""`. */
  day: string;
}

interface TimelineMarkPos {
  n: number;
  at: number;
  lane: number;
}

export interface TimelineLayout {
  ticks: TimelineTick[];
  marks: TimelineMarkPos[];
  /** The outermost marks, as positions along the axis, when there are two. */
  span: { from: number; to: number } | null;
}

/** The marks nearer than this, in percent of the axis, share no lane. */
const LANE_GAP = 8;

/** How many tick labels the axis holds before it skips ticks. */
const MAX_LABELS = 8;

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Whole UTC hours and the day, from epoch milliseconds: drawing only. */
function utcHour(ms: number): { hour: number; day: string } {
  const z =
    Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO("UTC");
  return { hour: z.hour, day: `${pad2(z.month)}-${pad2(z.day)}` };
}

/**
 * Where each instant sits on one UTC axis, and where the hour ticks fall. The
 * axis runs from the whole hour before the earliest instant to the whole hour
 * after the latest (a few more for one instant alone), with a tick on every whole
 * hour and a label on every n-th so the labels never touch. A mark takes the
 * first lane in which the one before it is far enough away.
 */
export function timelineLayout(
  inputs: readonly { n: number; instant: string }[],
): TimelineLayout | null {
  if (inputs.length === 0) return null;
  const ms = inputs.map(
    (i) => Temporal.Instant.from(i.instant).epochMilliseconds,
  );
  const lowest = Math.min(...ms);
  const highest = Math.max(...ms);
  const hours = Math.max(0, Math.ceil((highest - lowest) / HOUR));
  const pad = inputs.length === 1 ? 3 : Math.max(1, Math.ceil(hours / 10));
  const from = Math.floor(lowest / HOUR) * HOUR - pad * HOUR;
  const to = Math.ceil(highest / HOUR) * HOUR + pad * HOUR;
  const total = to - from;
  const at = (v: number): number => ((v - from) / total) * 100;

  const count = Math.round(total / HOUR);
  const step = [1, 2, 3, 4, 6, 12].find((s) => count / s <= MAX_LABELS) ?? 12;
  const ticks: TimelineTick[] = [];
  for (let k = 0; k <= count; k++) {
    const t = from + k * HOUR;
    const { hour, day } = utcHour(t);
    const labelled = k % step === 0 || hour === 0;
    ticks.push({
      at: at(t),
      label: labelled ? `${pad2(hour)}:00` : "",
      day: hour === 0 ? day : "",
    });
  }

  const order = inputs
    .map((input, i) => ({ n: input.n, at: at(ms[i]!) }))
    .sort((a, b) => a.at - b.at || a.n - b.n);
  const laneEnds: number[] = [];
  const marks = order.map((m) => {
    let lane = laneEnds.findIndex((end) => m.at - end >= LANE_GAP);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = m.at;
    return { n: m.n, at: m.at, lane };
  });
  const span =
    inputs.length > 1 && highest > lowest
      ? { from: at(lowest), to: at(highest) }
      : null;
  return { ticks, marks, span };
}

/**
 * The timeline's spoken line, in words: each zone's instant in UTC, and the
 * widest gap when there is one.
 */
export function timelineAria(
  inputs: readonly TimelineInput[],
  gap: string,
  stated: string,
): string {
  if (stated !== "")
    return `The instant the value states, ${stated}, on a UTC timeline.`;
  const marks = inputs
    .filter((i) => i.instant !== "")
    .map((i) => `${i.n}, ${i.zone}, ${i.instant}`)
    .join("; ");
  return `A UTC timeline with ${inputs.length} ${inputs.length === 1 ? "zone" : "zones"} marked: ${marks}${gap === "" ? "" : `. ${gap}`}.`;
}

// ---------------------------------------------------------------------------
// Reserving a region's height: the hold
// ---------------------------------------------------------------------------

/** A literal field: shown as written, with no word of its own. */
export function lit(text: string, mask: string, group: PicGroup): PicField {
  return { text, mask, group, word: "" };
}
