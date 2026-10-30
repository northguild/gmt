/**
 * clockLadder: the eight clocks as rungs on one vertical scale of seconds ahead of UTC.
 *
 * One drawing and eight rows. The drawing (an inline SVG, sized in pixels from `LADDER`) is the
 * rail: a tick for each second of the scale, lit from the UTC baseline up to TAI, which is the
 * top rail. Each row is a clock, placed beside its rung by `--clad-top`. A clock with no place
 * on the scale sits in a group under the stage, in flow, so no row on the stage stands at a
 * height that is not its lead. Nothing here is a time: every lead and reading is what the
 * library returned, placed by `ladderLayout`.
 *
 * The figure is one named image (its label is the ladder in words) with the rows as its
 * picture; a hidden list beside it holds one sentence for each clock, so a reader can reach the
 * readings. The stage and the off group reserve their height (`--clad-h`, `--clad-off-n`), so a
 * drag never moves what is below. A lost reading draws the amber NO SIGNAL slot, which is always
 * there (invisible when not lost), so showing it moves nothing.
 */
import {
  CLOCK_GLYPHS,
  LADDER,
  LADDER_NO_SIGNAL,
  type ClockKey,
  type ClockTie,
  type LadderLayout,
} from "~/lib/satellite-clock-converter";
import { gateAttr, type GateOption } from "../../builders/gate";
import { html, raw, type SafeHtml } from "../../builders/html";
import styles from "./clock-ladder.module.css";

/** The ladder's drawing is this wide; the rows start just past it. */
const DRAWING_WIDTH = LADDER.axis + LADDER.rail + LADDER.gutter;

export interface ClockLadderRow {
  key: ClockKey;
  /** The top of its row on the stage, or `null` when it has no place on the scale. */
  top: number | null;
  tie: ClockTie;
  /** What the row says beside its name: "baseline", "tied to TAI". */
  tieText: string;
  /** The lead, in the chip. */
  chip: string;
  /** The reading under the name, or the words for a clock with none. */
  reading: string;
  yours: boolean;
  /** The row as a sentence, for a pointer hover. */
  title: string;
}

interface ClockLadderOptions extends GateOption {
  /** The ladder in words: the figure's name. Required. */
  label: string;
  layout: LadderLayout;
  rows: readonly ClockLadderRow[];
  /** One sentence for each clock, or none when there is no reading. */
  sentences: readonly string[];
  /** The reading is the library's sentinel. */
  lost: boolean;
  /** The most clocks any stop leaves off the scale: the off group reserves that many rows. */
  offReserve: number;
}

const unit = (n: number): number => Math.round(n * 100) / 100;

function glyph(key: ClockKey): SafeHtml {
  return html`<span class="${styles.glyph}" aria-hidden="true"
    ><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${raw(CLOCK_GLYPHS[key])}</svg></span
  >`;
}

function drawing(layout: LadderLayout): SafeHtml {
  const { axis, rail, gutter, step } = LADDER;
  const { base, scaleTop, taiY, height } = layout;
  const edge = axis + rail;
  const centre = axis + rail / 2;
  const lit = taiY === null ? base : taiY;
  const ticks: SafeHtml[] = [];
  const labels: SafeHtml[] = [];
  for (let s = 0; base - s * step >= scaleTop - 0.001; s++) {
    const y = base - s * step;
    const major = s % 5 === 0;
    ticks.push(
      html`<path class="${styles.tick}" data-lit="${String(y >= lit - 0.001)}" data-major="${String(major)}" d="${`M${axis} ${y}h${major ? 8 : 4}`}"/>`,
    );
    if (s % 10 === 0) {
      labels.push(
        html`<text class="${styles.axis}" x="${axis - 6}" y="${y}" text-anchor="end" dominant-baseline="central">${s === 0 ? "0" : `+${s}`}</text>`,
      );
    }
  }
  const rungs = layout.rungs.map((r) => {
    const cy = r.top + (r.keys.length * LADDER.row) / 2;
    const bend = edge + gutter / 2;
    return html`<path class="${styles.leader}" d="${`M${edge} ${r.y}H${bend}L${DRAWING_WIDTH} ${cy}`}"/><rect class="${styles.mark}" x="${centre - 4}" y="${r.y - 4}" width="8" height="8"/>`;
  });
  return html`<svg class="${styles.svg}" aria-hidden="true" focusable="false" width="${DRAWING_WIDTH}" height="${unit(height)}" viewBox="${`0 0 ${DRAWING_WIDTH} ${unit(height)}`}"
    ><rect class="${styles.track}" x="${axis}" y="${scaleTop}" width="${rail}" height="${base - scaleTop}"/>${
      taiY === null
        ? ""
        : html`<rect class="${styles.lit}" x="${axis}" y="${taiY}" width="${rail}" height="${base - taiY}"/>`
    }${ticks}${labels}<path class="${styles.baseline}" d="${`M${axis - 4} ${base}H${DRAWING_WIDTH}`}"/>${
      taiY === null
        ? ""
        : html`<path class="${styles.toprail}" d="${`M${axis - 4} ${taiY}H${DRAWING_WIDTH}`}"/>`
    }${rungs}</svg
  >`;
}

function row(r: ClockLadderRow): SafeHtml {
  const off = r.top === null;
  return html`<div
    class="${styles.row}"
    data-row="${r.key}"
    data-off="${String(off)}"
    data-tie="${r.tie ?? ""}"
    data-yours="${String(r.yours)}"
    style="${off ? "" : `--clad-top: ${unit(r.top!)}px`}"
    title="${r.title}"
    >${glyph(r.key)}<span class="${styles.key}">${r.key}</span
    ><span class="${styles.tie}">${r.tieText === "" ? raw("&nbsp;") : r.tieText}</span
    ><span class="${styles.lead}">${r.chip === "" ? raw("&nbsp;") : r.chip}</span
    ><span class="${styles.reading}">${r.reading === "" ? raw("&nbsp;") : r.reading}</span></div
  >`;
}

export function clockLadder(o: ClockLadderOptions): SafeHtml {
  const stage = o.rows.filter((r) => r.top !== null);
  const off = o.rows.filter((r) => r.top === null);
  const reserved = Math.max(o.offReserve, off.length);
  return html`<div class="${styles.root}" data-lost="${String(o.lost)}"
    ><div class="${styles.figure}" role="img" ${gateAttr(o.gate)} aria-label="${o.label}"
      ><div class="${styles.stage}" style="${`--clad-h: ${unit(o.layout.height)}px; --clad-w: ${DRAWING_WIDTH}px`}"
        >${drawing(o.layout)}${stage.map(row)}</div
      ><div class="${styles.off}" data-empty="${String(off.length === 0)}" data-reserved="${String(reserved > 0)}" style="${`--clad-off-n: ${reserved}`}"
        ><p class="${styles.offTitle}">No place on the scale</p>${off.map(row)}</div
      ></div
    ><span class="${styles.noSignal}">${LADDER_NO_SIGNAL}</span
    ><ul class="${styles.list}">${o.sentences.map((s) => html`<li>${s}</li>`)}</ul></div
  >`;
}

/** What the ladder's two kinds of mark mean, in words and in outline. */
export function clockLegend(): SafeHtml {
  return html`<div class="${styles.legend}"
    ><p class="${styles.legendTitle}">Seconds ahead of UTC</p
    ><p class="${styles.legendItem}" data-tie="tai"><span class="${styles.glyph}" aria-hidden="true"></span>Tied to TAI: climbs one second each time UTC inserts one.</p
    ><p class="${styles.legendItem}" data-tie="utc"><span class="${styles.glyph}" aria-hidden="true"></span>Follows UTC: stays level with it.</p></div
  >`;
}
