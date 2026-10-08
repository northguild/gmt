/**
 * The pictures the two EDI timestamp widgets draw (INT-15): a value taken apart
 * into its fields, and one shared UTC timeline for the zones a reader chose.
 *
 * Pure string builders and one small layout function. Nothing here calls the
 * library or reads the clock: the fields come from `edi-shape.ts` (probed from
 * the formatter) and the instants are ones the library already returned. The
 * timeline's positions are drawing only, from the polyfill's epoch milliseconds,
 * as `markPositions` always was.
 *
 * Every interpolation goes through `escapeHtml` or `escapeAttr`. Colour is the
 * stylesheet's: a field names its group (`date`, `time`, `offset`), a mark names
 * its series, and no text is coloured by either.
 */
import { Temporal } from "@js-temporal/polyfill";
import {
  maskOf,
  partWord,
  type ShapeGroup,
  type ValueCells,
} from "./edi-shape";
import { escapeAttr, escapeHtml } from "./widget-ui";

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

/** The characters a box shows. A space is shown as a middle dot so an empty-looking
 *  box is never empty. */
function boxText(text: string): string {
  return text === "" ? "·" : text;
}

/** The width, in characters, a field's box reserves: its text or its mask. */
function fieldChars(f: PicField): number {
  return Math.max(f.text.length, f.mask.length, 1);
}

function fieldHtml(f: PicField): string {
  return (
    `<span class="gmt-edi-field" data-group="${escapeAttr(f.group)}" style="--n:${fieldChars(f)}">` +
    `<span class="gmt-edi-box${f.group === "none" ? " gmt-edi-box--none" : ""}">${escapeHtml(boxText(f.text))}</span>` +
    `<span class="gmt-edi-mask">${escapeHtml(f.mask === "" ? " " : f.mask)}</span>` +
    `</span>`
  );
}

/** The bracket's label under a run of same-group fields. */
function groupLabel(group: PicGroup, fields: readonly PicField[]): string {
  const given = fields.find((f) => f.bracket !== undefined)?.bracket;
  if (given !== undefined) return given;
  if (group === "neutral" || group === "none") return "";
  if (group === "offset") {
    return fields.some((f) => f.mask === "ZZZ") ? "zone" : "offset";
  }
  return group;
}

/** Splits a half's fields into runs of one group. */
function runsOf(fields: readonly PicField[]): PicField[][] {
  const runs: PicField[][] = [];
  for (const f of fields) {
    const last = runs[runs.length - 1];
    if (last !== undefined && last[0]!.group === f.group) last.push(f);
    else runs.push([f]);
  }
  return runs;
}

function groupHtml(fields: readonly PicField[]): string {
  const group = fields[0]!.group;
  return (
    `<span class="gmt-edi-group" data-group="${escapeAttr(group)}">` +
    `<span class="gmt-edi-fields">${fields.map(fieldHtml).join("")}</span>` +
    `<span class="gmt-edi-bracket"><span class="gmt-edi-bracket-label">${groupLabel(group, fields) === "" ? "&nbsp;" : escapeHtml(groupLabel(group, fields))}</span></span>` +
    `</span>`
  );
}

/**
 * The value taken apart: each half a row of groups, each group its fields' boxes
 * with the mask letters beneath and a bracket under it. `closing` is the words
 * for a half's end when the code states no offset (`no offset`), drawn as an
 * empty group so the row holds the same shape every time. `separator` is what
 * the standard sends between a period's halves.
 */
export function takenApartHtml(
  halves: readonly PicHalf[],
  separator: string,
  closing: string,
): string {
  const rows = halves.map((half, i) => {
    const last = i === halves.length - 1;
    const groups = runsOf(half.fields).map(groupHtml).join("");
    const none =
      last && closing !== ""
        ? `<span class="gmt-edi-group gmt-edi-group--none"><span class="gmt-edi-fields"><span class="gmt-edi-field" data-group="none" style="--n:${closing.length}"><span class="gmt-edi-box gmt-edi-box--none">${escapeHtml(closing)}</span><span class="gmt-edi-mask">&nbsp;</span></span></span><span class="gmt-edi-bracket"><span class="gmt-edi-bracket-label">&nbsp;</span></span></span>`
        : "";
    const sep =
      !last && separator !== ""
        ? `<span class="gmt-edi-sep" aria-hidden="true">${escapeHtml(separator)}</span>`
        : "";
    return (
      `<span class="gmt-edi-half">` +
      (half.label === ""
        ? ""
        : `<span class="gmt-edi-half-label">${escapeHtml(half.label)}</span>`) +
      `<span class="gmt-edi-groups">${groups}${none}</span>` +
      `</span>${sep}`
    );
  });
  return `<span class="gmt-edi-taken">${rows.join("")}</span>`;
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

/** The parts as a row of boxes with their captions beneath and the service
 *  characters between them. */
export function partsHtml(parts: readonly PicPart[]): string {
  return (
    `<span class="gmt-edi-parts">` +
    parts
      .map(
        (p) =>
          `<span class="gmt-edi-part" data-kind="${escapeAttr(p.kind)}">` +
          `<span class="gmt-edi-box">${escapeHtml(boxText(p.text))}</span>` +
          `<span class="gmt-edi-caption">${escapeHtml(p.caption)}</span>` +
          `</span>` +
          (p.after === ""
            ? ""
            : `<span class="gmt-edi-punct" aria-hidden="true">${escapeHtml(p.after)}</span>`),
      )
      .join("") +
    `</span>`
  );
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

export interface TimelineTick {
  /** 0 to 100, along the axis. */
  at: number;
  /** `HH:00` in UTC, or `""` when this tick carries no label. */
  label: string;
  /** `MM-DD` on a midnight tick, else `""`. */
  day: string;
}

export interface TimelineMarkPos {
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
  const z = Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO("UTC");
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
  const ms = inputs.map((i) => Temporal.Instant.from(i.instant).epochMilliseconds);
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

/** The lanes a timeline reserves: one for each of the four zones. */
export const TIMELINE_LANES = 4;

/**
 * The timeline's markup. `stated` draws the one instant a value states, with no
 * number; `marks` draws the numbered zones. `gap` is the bracket's label (`15 h`)
 * under the outermost marks.
 */
export function timelineHtml(
  layout: TimelineLayout,
  options: { stated: boolean; gap: string },
): string {
  const ticks = layout.ticks
    .map(
      (t) =>
        `<span class="gmt-edi-tl-tick" data-major="${t.label === "" ? "0" : "1"}" style="--x:${escapeAttr(t.at.toFixed(3))}%">` +
        (t.label === ""
          ? ""
          : `<span class="gmt-edi-tl-label">${escapeHtml(t.label)}${t.day === "" ? "" : `<span class="gmt-edi-tl-day">${escapeHtml(t.day)}</span>`}</span>`) +
        `</span>`,
    )
    .join("");
  const marks = layout.marks
    .map(
      (m) =>
        `<span class="gmt-edi-tl-mark" ${options.stated ? 'data-stated="1"' : `data-series="${m.n}"`} style="--x:${escapeAttr(m.at.toFixed(3))}%;--lane:${m.lane}">` +
        `<span class="gmt-edi-tl-pin">${options.stated ? "" : m.n}</span>` +
        `</span>`,
    )
    .join("");
  const bracket =
    layout.span === null
      ? ""
      : `<span class="gmt-edi-tl-bracket" style="--from:${escapeAttr(layout.span.from.toFixed(3))}%;--to:${escapeAttr(layout.span.to.toFixed(3))}%">` +
        `<span class="gmt-edi-tl-gap">${escapeHtml(options.gap)}</span></span>`;
  return (
    `<span class="gmt-edi-tl-axis"></span>` +
    `<span class="gmt-edi-tl-ticks">${ticks}</span>` +
    `<span class="gmt-edi-tl-marks">${marks}</span>` +
    bracket
  );
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
  if (stated !== "") return `The instant the value states, ${stated}, on a UTC timeline.`;
  const marks = inputs
    .filter((i) => i.instant !== "")
    .map((i) => `${i.n}, ${i.zone}, ${i.instant}`)
    .join("; ");
  return `A UTC timeline with ${inputs.length} ${inputs.length === 1 ? "zone" : "zones"} marked: ${marks}${gap === "" ? "" : `. ${gap}`}.`;
}

// ---------------------------------------------------------------------------
// Reserving a region's height: the hold
// ---------------------------------------------------------------------------

/**
 * A region whose text changes with the preset or the typed value reserves the
 * height of its tallest text at whatever width it is laid out, with no table of
 * widths: every text it can show is also drawn, hidden, in the same grid cell
 * (`.gmt-edi-hold`), so the cell is as tall as the tallest of them. The sizers are
 * `aria-hidden` and `visibility: hidden`, take no focus and are left out of the
 * search index; the live element is the only one a reader reaches.
 */
export function holdHtml(live: string, sizers: readonly string[]): string {
  return `<div class="gmt-edi-hold">${live}${sizers.join("")}</div>`;
}

/** One hidden sizer: the same element and class as the live one, holding a text
 *  the live one can show. */
export function sizerHtml(
  tag: string,
  className: string,
  inner: string,
): string {
  return `<${tag} class="${escapeAttr(className)} gmt-edi-sizer" aria-hidden="true" data-pagefind-ignore>${inner}</${tag}>`;
}

/** Sizers for a list of plain texts. */
export function textSizers(
  tag: string,
  className: string,
  texts: readonly string[],
): string[] {
  return [...new Set(texts)].map((t) => sizerHtml(tag, className, escapeHtml(t)));
}

/** The call frame's sizer: the longest call the region prints. */
export function callSizer(call: string): string {
  return `<div class="gmt-codeframe gmt-edi-sizer" aria-hidden="true" data-pagefind-ignore><pre class="gmt-codeframe-pre"><code>${escapeHtml(call)}</code></pre></div>`;
}

/** An output's sizer: the longest result the region prints. */
export function outputSizer(className: string, text: string): string {
  return sizerHtml("div", className, escapeHtml(text));
}

/** An aside's sizer, in the markup `renderAside` writes, holding the longest
 *  paragraphs the region can show. */
export function asideSizer(title: string, paragraphs: readonly string[]): string {
  return (
    `<aside class="starlight-aside starlight-aside--caution gmt-edi-sizer" aria-hidden="true" data-pagefind-ignore>` +
    `<p class="starlight-aside__title"><svg viewBox="0 0 24 24" width="16" height="16" class="starlight-aside__icon"></svg>${escapeHtml(title)}</p>` +
    `<div class="starlight-aside__content">${paragraphs.map((t) => `<p>${escapeHtml(t)}</p>`).join("")}</div>` +
    `</aside>`
  );
}

/**
 * A picture's sizer: the tallest pictures a tool draws, built from literal
 * fields (a layout reservation, not a table of codes), so the picture's box is
 * as tall as the tallest at the width it has.
 */
export function figureSizer(
  rows: readonly { parts?: readonly PicPart[]; halves: readonly PicHalf[]; separator: string; closing: string }[],
): string {
  return rows
    .map(
      (r) =>
        `<div class="gmt-edi-figure gmt-edi-sizer" aria-hidden="true" data-pagefind-ignore data-scale="${r.halves.length === 1 ? "lg" : "md"}">${r.parts === undefined ? "" : partsHtml(r.parts)}${takenApartHtml(r.halves, r.separator, r.closing)}</div>`,
    )
    .join("");
}

/** A literal field, for `figureSizer`. */
export function lit(text: string, mask: string, group: PicGroup): PicField {
  return { text, mask, group, word: "" };
}

/** A call frame with its result under it, as one sizer. */
export function callOutputSizer(call: string, output: string): string {
  return `<div class="gmt-edi-sizer" aria-hidden="true" data-pagefind-ignore><div class="gmt-codeframe"><pre class="gmt-codeframe-pre"><code>${escapeHtml(call)}</code></pre></div><div class="gmt-widget-output">${escapeHtml(output)}</div></div>`;
}
