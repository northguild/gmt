/**
 * The Satellite Clock Converter, mountable on its tool page and in the chat rail.
 *
 * A time on any one clock goes in: a UTC instant, or a reading on TAI or on one
 * of the six satellite systems. Out come the same instant on every clock and
 * each clock's lead over UTC:
 *
 * 1. the controls (the value, a slider through the leap seconds, a preset);
 * 2. the clock ladder: eight clocks as rungs on one vertical scale of seconds
 *    ahead of UTC, TAI as the top rail, beside three plates (UTC, TAI minus
 *    UTC, the next change);
 * 3. the table of every clock, always eight rows;
 * 4. the calls made and what they returned.
 *
 * The mount never computes a time. Every instant and lead comes from
 * `readClocks` (satellite-clock-converter.ts), which calls the library; the
 * ladder only places what those calls returned.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. Every
 * listener is delegated on the root, so the host dropping the subtree is a
 * complete teardown. The one drag handle is a native range, and the value field
 * is its typed equivalent. The plates, the ladder's stage, its eight rows and
 * the table's eight rows keep their boxes from one reading to the next.
 */
import { codeFrameHtml } from "./code-frame";
import { renderCallResults, renderCalls } from "./edi-render";
import {
  asideSizer,
  callSizer,
  holdHtml,
  outputSizer,
  textSizers,
} from "./edi-picture";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { loadGnssLib, type GnssLib } from "./gnss-lib";
import { descriptionHoldHtml, plateHtml, platesHtml } from "./ledger-widgets";
import { setPresetDescription } from "./punctuality-widgets";
import {
  CLOCK_GLYPHS,
  CLOCK_KEYS,
  CLOCK_LINKS,
  CLOCK_PRESETS,
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  GLO_NOTE,
  IRN_NOTE,
  LADDER,
  LADDER_NONE_NOTE,
  LADDER_NO_SIGNAL,
  BEFORE_FIRST_INSTANT_NOTE,
  SENTENCES,
  PLATE_NO_SIGNAL,
  offReserve,
  MAX_VALUE_LENGTH,
  NO_RESULT_TEXT,
  clockHandoffs,
  clockTies,
  emptyRead,
  isSeeded,
  ladderAria,
  ladderChip,
  ladderLayout,
  ladderSpan,
  matchPreset,
  permalinkOf,
  platesOf,
  presetState,
  readArgs,
  readClocks,
  rowSentence,
  sliderPositions,
  summaryText,
  tieTag,
  type ClockRead,
  type ClockTie,
  type LadderLayout,
  type ClockKey,
  type ClockRow,
  type ClockState,
  type SatelliteClockConverterArgs,
} from "./satellite-clock-converter";
import type { GnssSystem } from "./gnss-names";
import { INTEGER_UTC_FROM } from "./timescale-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { handoffHref } from "./widget-permalink";
import {
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  rangeFieldHtml,
  renderAside,
  renderWidgetOutput,
  setControlValue,
  setToolLink,
  syncRange,
  toolLinksHtml,
  wireCopyButtons,
  wrapInstantsAtT,
} from "./widget-ui";

export type { SatelliteClockConverterArgs } from "./satellite-clock-converter";

const NBSP = "&nbsp;";

/** The calls an answered reading makes: one per clock. Both the call frame and
 *  its result hold this many lines, so they keep one height from the first paint. */
const CALL_LINES = 10;

const CALL_SIZER = Array.from(
  { length: CALL_LINES },
  () => 'fromGpsWeek("GPS", 2295, 345600, "2024-01-01T00:00:00Z")',
).join("\n");

const OUTPUT_SIZER = Array.from(
  { length: CALL_LINES },
  () => "2024-01-01T00:00:37 TAI",
).join("\n");

/** The longest footnote: every clock without a reading. */
const FOOTNOTE_SIZERS = [
  `GPS, GAL, BDT, QZS, GLO, IRN: ${BEFORE_FIRST_INSTANT_NOTE}.`,
];

const TABLE_COLUMNS = ["Clock", "Reading", "Ahead of UTC"] as const;

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    CLOCK_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

/** The ladder's drawing is this wide; the rows start just past it. */
const DRAWING_WIDTH = LADDER.axis + LADDER.rail + LADDER.gutter;

/** One clock's row on the ladder, empty: its mark, name, tie, lead and reading. */
function ladderRowHtml(key: ClockKey, top: number): string {
  return (
    `<div class="gmt-clad-row" data-role="bar-row" data-row="${escapeAttr(key)}" style="top:${top}px">` +
    `<span class="gmt-clad-glyph" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${CLOCK_GLYPHS[key]}</svg></span>` +
    `<span class="gmt-gnss-label gmt-clad-key">${escapeHtml(key)}</span>` +
    `<span class="gmt-clad-tie" data-role="bar-tie">${escapeHtml(tieTag(key, null)) || NBSP}</span>` +
    `<span class="gmt-cutoff-chip gmt-clad-lead" data-role="bar-value">${NBSP}</span>` +
    `<span class="gmt-clad-reading" data-role="bar-reading">${NBSP}</span>` +
    `</div>`
  );
}

/**
 * The ladder's drawing: the rail with a tick for each second of the scale (lit
 * up to TAI), the baseline at UTC and TAI as the top rail, a marker on the rail
 * for every rung and a leader to its block of rows. Pixels, from `LADDER`.
 */
export function ladderSvgHtml(layout: LadderLayout): string {
  const { axis, rail, gutter, step } = LADDER;
  const { base, scaleTop, taiY, height } = layout;
  const edge = axis + rail;
  const centre = axis + rail / 2;
  const lit = taiY === null ? base : taiY;
  const ticks: string[] = [];
  const labels: string[] = [];
  for (let s = 0; base - s * step >= scaleTop - 0.001; s++) {
    const y = base - s * step;
    const major = s % 5 === 0;
    const on = y >= lit - 0.001;
    ticks.push(
      `<path class="gmt-clad-tick${on ? " is-lit" : ""}${major ? " is-major" : ""}" d="M${axis} ${y}h${major ? 8 : 4}"/>`,
    );
    if (s % 10 === 0) {
      labels.push(
        `<text class="gmt-clad-axis" x="${axis - 6}" y="${y}" text-anchor="end" dominant-baseline="central">${s === 0 ? "0" : `+${s}`}</text>`,
      );
    }
  }
  const rungs = layout.rungs
    .map((r) => {
      const cy = r.top + (r.keys.length * LADDER.row) / 2;
      const bend = edge + gutter / 2;
      return (
        `<path class="gmt-clad-leader" d="M${edge} ${r.y}H${bend}L${DRAWING_WIDTH} ${cy}"/>` +
        `<rect class="gmt-clad-mark" x="${centre - 4}" y="${r.y - 4}" width="8" height="8"/>`
      );
    })
    .join("");
  const unit = (n: number) => Math.round(n * 100) / 100;
  return (
    `<svg class="gmt-clad-svg" data-role="ladder-svg" aria-hidden="true" focusable="false" width="${DRAWING_WIDTH}" height="${unit(height)}" viewBox="0 0 ${DRAWING_WIDTH} ${unit(height)}">` +
    `<rect class="gmt-clad-track" x="${axis}" y="${scaleTop}" width="${rail}" height="${base - scaleTop}"/>` +
    (taiY === null
      ? ""
      : `<rect class="gmt-clad-lit" x="${axis}" y="${taiY}" width="${rail}" height="${base - taiY}"/>`) +
    ticks.join("") +
    labels.join("") +
    `<path class="gmt-clad-baseline" d="M${axis - 4} ${base}H${DRAWING_WIDTH}"/>` +
    (taiY === null
      ? ""
      : `<path class="gmt-clad-toprail" d="M${axis - 4} ${taiY}H${DRAWING_WIDTH}"/>`) +
    rungs +
    `</svg>`
  );
}

/** The ladder, empty: the stage, its drawing and the eight rows at rest. */
function ladderHtml(): string {
  const layout = ladderLayout(emptyRead(), 0);
  return (
    `<div class="gmt-clad" data-role="bars" role="img" aria-label="No ladder to draw">` +
    `<div class="gmt-clad-stage" data-role="ladder" style="--clad-h:${layout.height}px;--clad-w:${DRAWING_WIDTH}px">` +
    ladderSvgHtml(layout) +
    CLOCK_KEYS.map((key) => ladderRowHtml(key, layout.tops[key])).join("") +
    `</div>` +
    `<span class="gmt-clad-nosignal" data-role="ladder-sentinel" hidden>${LADDER_NO_SIGNAL}</span>` +
    `<div class="gmt-clad-off" data-role="ladder-off" data-empty hidden><p class="gmt-clad-off-title">No place on the scale</p></div>` +
    `<ul class="gmt-gnss-visually-hidden" data-role="bar-list"></ul>` +
    `</div>`
  );
}

/** What the ladder's two kinds of mark mean, in words and in outline. */
const LEGEND_HTML =
  `<div class="gmt-clad-legend" data-role="ladder-legend">` +
  `<p class="gmt-clad-legend-title">Seconds ahead of UTC</p>` +
  `<p class="gmt-clad-legend-item" data-tie="tai"><span class="gmt-clad-glyph" aria-hidden="true"></span>Tied to TAI: climbs one second each time UTC inserts one.</p>` +
  `<p class="gmt-clad-legend-item" data-tie="utc"><span class="gmt-clad-glyph" aria-hidden="true"></span>Follows UTC: stays level with it.</p>` +
  `</div>`;

/** One table row, empty. Every cell holds two lines so a row never changes height. */
function tableRowHtml(key: string): string {
  return (
    `<tr role="row" data-row="${escapeAttr(key)}">` +
    `<th role="rowheader" data-label="Clock"><span class="gmt-clock-line">${escapeHtml(key)}</span><span class="gmt-clock-line gmt-clock-sub">${key === "IRN" ? "derived" : NBSP}</span></th>` +
    `<td role="cell" data-label="Reading"><span class="gmt-clock-line">${NBSP}</span><span class="gmt-clock-line gmt-clock-sub">${NBSP}</span></td>` +
    `<td role="cell" data-label="Ahead of UTC"><span class="gmt-clock-line">${NBSP}</span><span class="gmt-clock-line gmt-clock-sub">${NBSP}</span></td>` +
    `</tr>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The plates, bars, rows and outputs are drawn
 * by `mount`, because they come from the real library calls.
 */
export function renderSatelliteClockConverterTemplate(
  args: SatelliteClockConverterArgs = {},
): string {
  const state: ClockState = isSeeded(args)
    ? readArgs(args)
    : presetState(DEFAULT_PRESET);
  const presetId = matchPreset(state);
  const preset = CLOCK_PRESETS.find((p) => p.id === presetId);

  return (
    `<div class="gmt-satellite-clock-converter gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. The reading
    `<div class="gmt-widget-section">` +
    `<h4>1. Say what a clock reads</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      CLOCK_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("A time on any clock")}` +
    `<input class="gmt-input" type="text" autocomplete="off" spellcheck="false" maxlength="${MAX_VALUE_LENGTH}" data-role="value" value="${escapeAttr(state.value)}"></label>` +
    `<p class="gmt-widget-hint gmt-field-wide">A UTC instant such as 2024-01-01T00:00:00Z, or a reading followed by a space and TAI, GPS, GAL, BDT, QZS, GLO or IRN.</p>` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Step through the leap seconds")}` +
    rangeFieldHtml({
      role: "moment-slider",
      chipRole: "moment-value",
      min: 0,
      max: 0,
      step: 1,
      value: 0,
      valueText: INTEGER_UTC_FROM,
      ends: [INTEGER_UTC_FROM.slice(0, 10), " "],
    }) +
    `</label>` +
    `</div>` +
    `</div>` +
    // 2. Every clock's lead
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. How far each clock is from UTC</h4>` +
    `<div class="gmt-gnss-frame" data-role="frame">` +
    platesHtml("heroes", platesOf(null)) +
    ladderHtml() +
    LEGEND_HTML +
    `</div>` +
    `<p class="gmt-gnss-visually-hidden" data-role="summary" aria-live="polite"></p>` +
    holdHtml(
      `<div data-role="reason-aside" data-grow="slot"></div>`,
      Object.values(SENTENCES).map((t) => asideSizer(NO_RESULT_TITLE, [t])),
      "gmt-ledger-hold",
    ) +
    `</div>` +
    // 3. The same instant on every clock
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. The same instant on every clock</h4>` +
    `<div class="gmt-gnss-table-box">` +
    `<table class="gmt-gnss-table" data-role="clocks-table" role="table">` +
    `<thead role="rowgroup"><tr role="row">${TABLE_COLUMNS.map((c) => `<th role="columnheader">${escapeHtml(c)}</th>`).join("")}</tr></thead>` +
    `<tbody role="rowgroup" data-role="clocks-body">${CLOCK_KEYS.map(tableRowHtml).join("")}</tbody>` +
    `</table></div>` +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="footnote" data-grow="slot">${NBSP}</p>`,
      textSizers("p", "gmt-widget-hint", FOOTNOTE_SIZERS),
      "gmt-ledger-hold",
    ) +
    `<p class="gmt-widget-hint" data-role="glo-note">${escapeHtml(GLO_NOTE)}</p>` +
    `<p class="gmt-widget-hint" data-role="irn-note">${escapeHtml(IRN_NOTE)}</p>` +
    `</div>` +
    // 4. The calls
    `<div class="gmt-widget-section">` +
    `<h4>4. What the library returns</h4>` +
    holdHtml(
      codeFrameHtml("clocks"),
      [callSizer(CALL_SIZER)],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<output class="gmt-widget-output" data-role="clocks-output">${NBSP}</output>`,
      [outputSizer("gmt-widget-output", OUTPUT_SIZER)],
      "gmt-ledger-hold",
    ) +
    toolLinksHtml(CLOCK_LINKS) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): ClockState;
  apply(state: ClockState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

/** A cell's two lines, text escaped; an empty line keeps its height. */
function linesHtml(first: string, second: string): string {
  const line = (text: string, sub: boolean) =>
    `<span class="gmt-clock-line${sub ? " gmt-clock-sub" : ""}">${text === "" ? NBSP : escapeHtml(text)}</span>`;
  return line(first, false) + line(second, true);
}

function rowHtml(row: ClockRow): string {
  return (
    `<tr role="row" data-row="${escapeAttr(row.key)}"${row.yours ? ' data-reading data-series="1"' : ""}>` +
    `<th role="rowheader" data-label="Clock">${linesHtml(row.key, row.tags.join(" · "))}</th>` +
    `<td role="cell" data-label="Reading">${linesHtml(
      row.none ? NO_RESULT_TEXT : row.reading,
      row.writtenAs === null ? "" : `written as ${row.writtenAs}`,
    )}</td>` +
    `<td role="cell" data-label="Ahead of UTC">${linesHtml(row.leadText, "")}</td>` +
    `</tr>`
  );
}

const TIE_ATTR = (tie: ClockTie) => tie ?? "";

function setupWidget(root: HTMLElement, lib: GnssLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const qa = <T extends HTMLElement>(role: string) =>
    [...root.querySelectorAll(`[data-role="${role}"]`)] as T[];
  const presetEl = q<HTMLSelectElement>("preset")!;
  const valueEl = q<HTMLInputElement>("value")!;
  const sliderEl = q<HTMLInputElement>("moment-slider")!;

  const positions = sliderPositions(lib);
  // How long the ladder gets, and which clocks climb it, from the library
  // at every stop of the slider.
  const span = ladderSpan(lib, positions);
  const reserve = offReserve(lib, positions);
  const ties = clockTies(lib, positions);
  sliderEl.min = "0";
  sliderEl.max = String(Math.max(0, positions.length - 1));
  const ends = root.querySelector<HTMLElement>(".gmt-range-ends");
  if (ends?.lastElementChild) {
    ends.lastElementChild.textContent = (positions.at(-1) ?? "").slice(0, 10);
  }

  function readState(): ClockState {
    return { value: valueEl.value };
  }

  /** Put the slider on `index` and say the instant it stands for. */
  function placeSlider(index: number): void {
    sliderEl.value = String(index);
    syncRange(sliderEl, positions[index] ?? "");
  }

  /** The slider follows a typed value only when that value is one of its stops. */
  function followValue(): void {
    const index = positions.indexOf(valueEl.value.trim());
    if (index >= 0) placeSlider(index);
  }

  function syncPreset(): void {
    const id = matchPreset(readState());
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        CLOCK_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  function apply(state: ClockState): void {
    setControlValue(valueEl, state.value);
    followValue();
  }

  function drawPlates(read: ClockRead): void {
    const heroes = q("heroes");
    if (!heroes) return;
    heroes.innerHTML = read.plates.map(plateHtml).join("");
    wrapInstantsAtT(heroes);
    if (read.status !== "sentinel") return;
    for (const none of heroes.querySelectorAll(".gmt-punct-hero-none")) {
      none.textContent = PLATE_NO_SIGNAL;
      none.classList.add("gmt-clad-plate-lost");
    }
  }

  function drawLadder(read: ClockRead): void {
    const layout = ladderLayout(read, span);
    const stage = q("ladder");
    if (stage) {
      stage.style.setProperty("--clad-h", `${layout.height}px`);
      const old = stage.querySelector('[data-role="ladder-svg"]');
      if (old) old.outerHTML = ladderSvgHtml(layout);
    }
    const group = q("ladder-off");
    const keyed = qa<HTMLElement>("bar-row");
    keyed.forEach((el) => {
      const row = read.rows.find((r) => r.key === el.dataset["row"])!;
      const parked = layout.off.includes(row.key);
      const home = parked ? group : q("ladder");
      if (home && el.parentElement !== home) home.appendChild(el);
      const ok = read.status === "ok";
      const tie: ClockTie =
        row.key === "UTC" || row.key === "TAI"
          ? null
          : ties[row.key as GnssSystem];
      el.style.top = parked ? "" : `${layout.tops[row.key]}px`;
      el.toggleAttribute("data-off", parked);
      if (tie === null) el.removeAttribute("data-tie");
      else el.setAttribute("data-tie", TIE_ATTR(tie));
      if (row.yours) el.setAttribute("data-series", "1");
      else el.removeAttribute("data-series");
      el.title = ok ? rowSentence(row) : "";
      el.querySelector<HTMLElement>('[data-role="bar-tie"]')!.textContent =
        tieTag(row.key, tie) || " ";
      el.querySelector<HTMLElement>('[data-role="bar-value"]')!.textContent = ok
        ? ladderChip(row)
        : " ";
      el.querySelector<HTMLElement>('[data-role="bar-reading"]')!.textContent =
        !ok ? " " : row.none ? LADDER_NONE_NOTE : row.reading;
    });
    if (group) {
      group.hidden = reserve === 0 && layout.off.length === 0;
      group.style.setProperty(
        "--clad-off-n",
        String(Math.max(reserve, layout.off.length)),
      );
      group.toggleAttribute("data-empty", layout.off.length === 0);
    }
    const lost = q("ladder-sentinel");
    if (lost) lost.hidden = read.status !== "sentinel";
    stage?.toggleAttribute("data-lost", read.status === "sentinel");
    q("bars")?.setAttribute("aria-label", ladderAria(read));
    const list = q("bar-list");
    if (list) {
      list.innerHTML =
        read.status === "ok"
          ? read.rows
              .map((r) => `<li>${escapeHtml(rowSentence(r))}</li>`)
              .join("")
          : "";
    }
  }

  function drawTable(read: ClockRead): void {
    const body = q("clocks-body");
    if (body) {
      body.innerHTML =
        read.status === "ok"
          ? read.rows.map(rowHtml).join("")
          : CLOCK_KEYS.map(tableRowHtml).join("");
    }
    const note = q("footnote");
    if (note) note.textContent = read.footnote === "" ? " " : read.footnote;
  }

  function render(): void {
    const read = readClocks(lib, readState());
    drawPlates(read);
    drawLadder(read);
    drawTable(read);

    renderCalls(q("call-clocks"), read.calls);
    const out = q("clocks-output");
    if (out) {
      if (read.status === "empty") renderWidgetOutput(out, " ", "empty");
      else renderCallResults(out, read.calls, read.status === "sentinel");
    }

    const summary = q("summary");
    if (summary) summary.textContent = summaryText(read);
    const handoffs = clockHandoffs(read);
    setToolLink(q("link-weeks"), handoffHref(handoffs.weeks));
    setToolLink(q("link-timeline"), handoffHref(handoffs.timeline));
    const aside = q("reason-aside");
    if (aside) {
      if (read.status === "sentinel") {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          `<p>${escapeHtml(read.failure ?? "")}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }
  }

  root.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (target === valueEl) {
      followValue();
      syncPreset();
      render();
      return;
    }
    if (target === sliderEl) {
      const index = Number(sliderEl.value);
      syncRange(sliderEl, positions[index] ?? "");
      setControlValue(valueEl, positions[index] ?? "");
      syncPreset();
      render();
    }
  });

  root.addEventListener("change", (e) => {
    if (e.target !== presetEl) return;
    const preset = CLOCK_PRESETS.find((p) => p.id === presetEl.value);
    if (!preset) return;
    apply(presetState(preset));
    syncPreset();
    render();
  });

  wireCopyButtons(root);
  // The slider opens on the latest stop unless the value is one of its stops.
  placeSlider(Math.max(0, positions.length - 1));
  followValue();
  syncPreset();
  render();

  return { readState, apply, render, syncPreset, release: () => {} };
}

export const mountSatelliteClockConverter: MountFn<
  SatelliteClockConverterArgs
> = async (root, args, signal) => {
  let lib: GnssLib;
  try {
    lib = await loadGnssLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib);
  if (isSeeded(args)) {
    widget.apply(readArgs(args));
    widget.syncPreset();
    widget.render();
  }

  return onceDestroy(
    () => widget.release(),
    () => permalinkOf(widget.readState()),
  );
};
