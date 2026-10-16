/**
 * The Satellite Clock Converter, mountable on its tool page and in the chat rail.
 *
 * A time on any one clock goes in: a UTC instant, or a reading on TAI or on one
 * of the six satellite systems. Out come the same instant on every clock and
 * each clock's lead over UTC:
 *
 * 1. the controls (the value, a slider through the leap seconds, a preset);
 * 2. three plates (UTC, TAI minus UTC, the next change) over a bar for each
 *    clock, drawn from UTC to its lead on one scale;
 * 3. the table of every clock, always eight rows;
 * 4. the calls made and what they returned.
 *
 * The mount never computes a time. Every instant and lead comes from
 * `readClocks` (satellite-clock-converter.ts), which calls the library; the
 * bars only place what those calls returned.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. Every
 * listener is delegated on the root, so the host dropping the subtree is a
 * complete teardown. The one drag handle is a native range, and the value field
 * is its typed equivalent. The plates, the eight bars and the eight rows keep
 * their boxes from one reading to the next.
 */
import { codeFrameHtml } from "./code-frame";
import { callResultsText, renderCalls } from "./edi-render";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { loadGnssLib, type GnssLib } from "./gnss-lib";
import { descriptionHoldHtml, plateHtml, platesHtml } from "./ledger-widgets";
import { setPresetDescription } from "./punctuality-widgets";
import {
  CLOCK_KEYS,
  CLOCK_LINKS,
  CLOCK_PRESETS,
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  GLO_NOTE,
  IRN_NOTE,
  MAX_VALUE_LENGTH,
  NO_RESULT_TEXT,
  barsAria,
  clockHandoffs,
  isSeeded,
  matchPreset,
  permalinkOf,
  platesOf,
  presetState,
  readArgs,
  readClocks,
  rowSentence,
  sliderPositions,
  summaryText,
  type ClockRead,
  type ClockRow,
  type ClockState,
  type SatelliteClockConverterArgs,
} from "./satellite-clock-converter";
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
} from "./widget-ui";

export type { SatelliteClockConverterArgs } from "./satellite-clock-converter";

const NBSP = "&nbsp;";

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

/** One bar, empty: the label, a track with a hidden fill, and the value chip. */
function barRowHtml(key: string): string {
  return (
    `<div class="gmt-gnss-bar-row" data-role="bar-row" data-row="${escapeAttr(key)}">` +
    `<span class="gmt-gnss-label">${escapeHtml(key)}</span>` +
    `<div class="gmt-gnss-track"><i class="gmt-gnss-bar" data-role="bar-fill" hidden></i></div>` +
    `<span class="gmt-cutoff-chip gmt-gnss-value" data-role="bar-value">${NBSP}</span>` +
    `</div>`
  );
}

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
    `<div class="gmt-gnss-bars" data-role="bars" role="img" aria-label="No bars to draw">` +
    CLOCK_KEYS.map(barRowHtml).join("") +
    `<ul class="gmt-gnss-visually-hidden" data-role="bar-list"></ul>` +
    `</div>` +
    `</div>` +
    `<p class="gmt-gnss-visually-hidden" data-role="summary" aria-live="polite"></p>` +
    `<div data-role="reason-aside" data-grow="slot"></div>` +
    `</div>` +
    // 3. The same instant on every clock
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. The same instant on every clock</h4>` +
    `<div class="gmt-gnss-table-box">` +
    `<table class="gmt-gnss-table" data-role="clocks-table" role="table">` +
    `<thead role="rowgroup"><tr role="row">${TABLE_COLUMNS.map((c) => `<th role="columnheader">${escapeHtml(c)}</th>`).join("")}</tr></thead>` +
    `<tbody role="rowgroup" data-role="clocks-body">${CLOCK_KEYS.map(tableRowHtml).join("")}</tbody>` +
    `</table></div>` +
    `<p class="gmt-widget-hint" data-role="footnote" data-grow="slot">${NBSP}</p>` +
    `<p class="gmt-widget-hint" data-role="glo-note">${escapeHtml(GLO_NOTE)}</p>` +
    `<p class="gmt-widget-hint" data-role="irn-note">${escapeHtml(IRN_NOTE)}</p>` +
    `</div>` +
    // 4. The calls
    `<div class="gmt-widget-section">` +
    `<h4>4. What the library returns</h4>` +
    codeFrameHtml("clocks") +
    `<output class="gmt-widget-output" data-role="clocks-output">${NBSP}</output>` +
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

function setupWidget(root: HTMLElement, lib: GnssLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const qa = <T extends HTMLElement>(role: string) =>
    [...root.querySelectorAll(`[data-role="${role}"]`)] as T[];
  const presetEl = q<HTMLSelectElement>("preset")!;
  const valueEl = q<HTMLInputElement>("value")!;
  const sliderEl = q<HTMLInputElement>("moment-slider")!;

  const positions = sliderPositions(lib);
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
    if (heroes) heroes.innerHTML = read.plates.map(plateHtml).join("");
  }

  function drawBars(read: ClockRead): void {
    qa<HTMLElement>("bar-row").forEach((el, i) => {
      const row = read.rows[i]!;
      const fill = el.querySelector<HTMLElement>('[data-role="bar-fill"]')!;
      const size = row.bar ?? 0;
      fill.hidden = size === 0;
      fill.style.setProperty("--size", `${size}%`);
      if (row.yours) {
        el.setAttribute("data-series", "1");
        fill.setAttribute("data-series", "1");
      } else {
        el.removeAttribute("data-series");
        fill.removeAttribute("data-series");
      }
      el.querySelector<HTMLElement>('[data-role="bar-value"]')!.textContent =
        read.status === "ok" ? row.leadText : " ";
    });
    q("bars")?.setAttribute("aria-label", barsAria(read));
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
    drawBars(read);
    drawTable(read);

    renderCalls(q("call-clocks"), read.calls);
    const out = q("clocks-output");
    if (out) {
      if (read.status === "sentinel") {
        renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      } else if (read.status === "empty") {
        renderWidgetOutput(out, " ", "empty");
      } else {
        renderWidgetOutput(out, callResultsText(read.calls), "live");
      }
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
