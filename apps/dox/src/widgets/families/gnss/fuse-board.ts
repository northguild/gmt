/**
 * fuseBoard: the GNSS rollover checker's fuse timeline, its key and its mark chips.
 *
 * One track for each week counter on a shared scale of years, grouped by counter width.
 * Each wrap is a tick (the next one taller). The reading's own counter carries the window
 * the firmware reads right in (lit), the stretch it reports one counter period early
 * (hatched), the fuse still to burn and a spark where it goes wrong. The check date is a
 * pin and the reader's clock a dashed line through every track.
 *
 * The drawing is one named image (`role="img"`), so its words are the label and a hidden
 * list of the marks. Nothing inside takes focus. Every part is drawn for the eye; the
 * chips and the key beside it say the same in words, so a pattern is never the only signal.
 *
 * Positions are shares of the scale, 0 to 100, written as `--at`, `--from` and `--to` for
 * the module to read. A part outside the scale is not drawn.
 */
import { html, type SafeHtml } from "../../builders/html";
import type {
  Fuse,
  FuseTrack,
  FuseYear,
  Mark,
  Strip,
} from "~/lib/gnss-rollover-checker";
import styles from "./fuse-board.module.css";

/** How many counters each width group holds before the library has grouped them. */
const SKELETON_ROWS = [3, 1, 4] as const;

/** The chips under the drawing: the build date or era start, up to two wraps, the date it goes wrong, the check date. */
export const FUSE_CHIP_SLOTS = 5;

const NBSP = " ";

const clampPct = (n: number): number => Math.min(100, Math.max(0, n));

interface FuseBoardOptions {
  /** The drawing's name: the reading in words. Required. */
  label: string;
  years: readonly FuseYear[];
  /** The library's grouping, or `null` to draw the skeleton. */
  fuse: Fuse | null;
  /** The window on the receiver's own track, or `null` for none. */
  strip: Strip | null;
  /** The receiver's own counter, which carries the window. */
  counter: string;
  gate?: string;
}

function wrapTicks(track: FuseTrack): SafeHtml[] {
  return track.wraps.map(
    (w) =>
      html`<i class="${styles.tick}" data-state="${w.state}" style="--at: ${w.pos}%"></i>`,
  );
}

const SPARK = html`<svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-9 2-2 9 0 2 2 0 9-2 2-9 0-2-2Z" /><circle r="2.2" /></svg>`;

/** The window's four parts, each drawn only when it is on the scale. */
function windowParts(strip: Strip): SafeHtml {
  const { from, wrong, end } = strip.span;
  const f = strip.fuse;
  const lit = !(wrong <= 0 || from >= 100);
  const hatch = !(wrong >= 100 || end <= 0 || end <= wrong);
  const burn = f !== null && !(f.to <= 0 || f.from >= 100);
  const spark = !(wrong < 0 || wrong > 100);
  return html`${lit ? html`<i class="${styles.lit}" style="--from: ${clampPct(from)}%; --to: ${clampPct(wrong)}%"></i>` : ""}${hatch ? html`<i class="${styles.hatch}" style="--from: ${clampPct(wrong)}%; --to: ${clampPct(end)}%"></i>` : ""}${burn ? html`<i class="${styles.burn}" style="--from: ${clampPct(f.from)}%; --to: ${clampPct(f.to)}%"></i>` : ""}${spark ? html`<i class="${styles.spark}" style="--at: ${clampPct(wrong)}%">${SPARK}</i>` : ""}`;
}

function row(
  name: string,
  born: number,
  yours: boolean,
  ticks: SafeHtml | SafeHtml[],
  windowOf: SafeHtml,
): SafeHtml {
  return html`<div class="${styles.row}" data-counter="${name}" data-yours="${String(yours)}"
    ><span class="${styles.name}">${name === "" ? NBSP : name}</span
    ><div class="${styles.track}"
      ><i class="${styles.pre}" style="--to: ${born}%"></i
      >${ticks}${windowOf}</div
    ></div
  >`;
}

function rowsOf(o: FuseBoardOptions): SafeHtml {
  if (o.fuse === null) {
    return html`${SKELETON_ROWS.map(
      (n) =>
        html`<div class="${styles.head}">${NBSP}</div
          >${Array.from({ length: n }, () => row("", 0, false, [], html``))}`,
    )}`;
  }
  return html`${o.fuse.groups.map(
    (g) =>
      html`<div class="${styles.head}">${g.label}</div
        >${g.tracks.map((t) =>
          row(
            t.counter,
            t.born,
            t.yours,
            wrapTicks(t),
            o.strip !== null && t.counter === o.counter
              ? windowParts(o.strip)
              : html``,
          ),
        )}`,
  )}`;
}

/** The pin for the check date: a mark in the strip whose label is not "today". */
function checkAt(strip: Strip | null): number | null {
  if (strip === null) return null;
  const m = strip.marks.find(
    (k) => k.key === "check" && k.label !== "today" && k.pos !== null,
  );
  return m?.pos ?? null;
}

export function fuseBoard(
  o: FuseBoardOptions,
  sentences: readonly string[] = [],
): SafeHtml {
  const today = o.fuse?.today ?? null;
  const pin = checkAt(o.strip);
  return html`<div class="${styles.root}" data-gate="${o.gate ?? "drawn"}" role="img" aria-label="${o.label}"
    ><div class="${styles.axis}"
      >${o.years.map(
        (y) =>
          html`<span class="${styles.year}" data-major="${String(y.major)}" style="--at: ${y.pos}%">${y.year}</span>`,
      )}</div
    ><div class="${styles.board}"
      ><div class="${styles.grid}"
        >${o.years.map((y) => html`<i class="${styles.gridline}" style="--at: ${y.pos}%"></i>`)}</div
      ><div class="${styles.rows}">${rowsOf(o)}</div
      ><div class="${styles.pins}"
        >${today === null ? "" : html`<i class="${styles.today}" style="--at: ${today}%"></i>`}${pin === null ? "" : html`<i class="${styles.pin}" style="--at: ${pin}%"></i>`}</div
      ></div
    ><ul class="${styles.list}">${sentences.map((s) => html`<li>${s}</li>`)}</ul></div
  >`;
}

interface FuseKeyOptions {
  /** There is a window to explain. When not, its two entries keep their place unseen. */
  window: boolean;
}

/** What the lit and hatched parts, the spark, the next wrap and the two pins mean, in words. */
export function fuseKey(o: FuseKeyOptions): SafeHtml {
  const hidden = String(!o.window);
  return html`<ul class="${styles.key}" aria-label="Key to the timeline"
    ><li data-hidden="${hidden}"><i class="${styles.swatch}" data-kind="lit"></i>reads the right date</li
    ><li data-hidden="${hidden}"><i class="${styles.swatch}" data-kind="hatch"></i>reports one counter period early</li
    ><li><svg class="${styles.swatch}" data-kind="spark" viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-9 2-2 9 0 2 2 0 9-2 2-9 0-2-2Z" /></svg>wrong from</li
    ><li><i class="${styles.swatch}" data-kind="next"></i>next wrap</li
    ><li><i class="${styles.swatch}" data-kind="pin"></i>check date</li
    ><li><i class="${styles.swatch}" data-kind="today"></i>today</li></ul
  >`;
}

/** The five chip slots: each mark in words, with unused slots keeping their box. */
export function fuseChips(marks: readonly Mark[]): SafeHtml {
  return html`<ul class="${styles.chips}" aria-label="Marks on the timeline"
    >${Array.from({ length: FUSE_CHIP_SLOTS }, (_, i) => {
      const m = marks[i];
      return m === undefined
        ? html`<li class="${styles.chip}" data-blank="true" aria-hidden="true">${NBSP}</li>`
        : html`<li class="${styles.chip}" data-blank="false">${m.label} ${m.at}${m.pos === null ? " (outside)" : ""}</li>`;
    })}</ul
  >`;
}
