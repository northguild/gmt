/**
 * The Timetable Reader widget (TRAN-9), mountable on its tool page and in the
 * chat rail.
 *
 * A timetable prints wall times with no offset; `scheduleDelivery`'s
 * `startTimeZone` is what turns each printed departure into an exact instant.
 * Every row is its own single-leg call — the library decides whether a
 * printed time occurs once, twice (and which pass) or never, and this widget
 * draws that decision, never arithmetic of its own.
 *
 * Section 1 is the controls line, one local-day track with a handle per row
 * (the Interval Visualizer's `.gmt-handle` pattern), and four bracketed row
 * frames side by side. Section 2 is the two-clocks chart, which joins each
 * printed wall time to the exact instant it names and draws each run as a bar,
 * above the table. Section 3 is the call and its result.
 *
 * A handle changes a row's printed time and never its offset. Nothing moves
 * while a handle moves: heights are fixed, and a cell whose content comes and
 * goes holds its size with a hidden sizer (`.gmt-timetable-hold`).
 *
 * Follows the Connection Checker's split: every listener is delegated on the
 * root, so the host dropping the subtree is a complete teardown. The two width
 * watchers are the exception, and `destroy` disposes them.
 */
import {
  CUSTOM_PRESET_ID,
  MAX_ROWS,
  TIMETABLE_PRESETS,
  arrivalChipText,
  arrivalChipPlacement,
  bandChipText,
  bandsFor,
  chartLayout,
  chartSummary,
  chartWindow,
  classify,
  exactTickLabel,
  handleValueText,
  hhmmOfMinute,
  jumpMinute,
  laneState,
  matchPreset,
  minuteAtPointer,
  newChartMemo,
  offsetChoices,
  offsetReason,
  LONGEST_REASON,
  optionsOf,
  permalinkOf,
  pointerStep,
  readArgs,
  rowBadge,
  rowFacts,
  rowLeg,
  rowMinute,
  rowResult,
  shapeOf,
  stepMinute,
  tagText,
  tickStepHours,
  trackDate,
  windowPct,
  withMinute,
  zonedParts,
  type ChartLayout,
  type ChartWindow,
  type DayBand,
  type OffsetChoice,
  type RowFacts,
  type TimetableLib,
  type TimetableReaderArgs,
  type TimetableRow,
  type TimetableState,
} from "./timetable-reader";
import { codeFrameHtml } from "./code-frame";
import {
  layoutWidth,
  onWidthChange,
  placeLabel,
  thinTickLabels,
} from "./label-fit";
import { setPresetDescription } from "./punctuality-widgets";
import { loadTimetableLib } from "./transport-lib";
import {
  TRANSPORT_ZONES,
  formatSchedule,
  scheduleCallSource,
  zoneOptionsHtml,
} from "./transport-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  renderAside,
  renderCallLine,
  renderWidgetOutput,
  setControlValue,
  wireCopyButtons,
} from "./widget-ui";

export type { TimetableReaderArgs } from "./timetable-reader";

let whyCount = 0;

function presetOptions(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    TIMETABLE_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

/** Escapes `text` and inserts `<wbr>` at its only break points: immediately
 *  before the bracketed zone (`[America/New_York]`) and after each `/` inside
 *  it. Each part is a `nowrap` token, because the browser also breaks after a
 *  hyphen (`2024-11-` / `03T00:30:00`), and `overflow-wrap: anywhere` split
 *  `-05:00` into `-05:0` / `0`. */
function wbrBeforeOffsetAndBracket(text: string): string {
  return zonedHtml(zonedParts(text), (p) => escapeHtml(p), "");
}

/** The parts of a zoned value as markup. The bracketed zone is one
 *  `inline-block`, so it drops to the next line whole when it does not fit
 *  beside the date-time (`…-04:00` / `[America/New_York]`), and breaks after a
 *  `/` only when it cannot fit a line by itself. `tok` renders one part; the
 *  sizer passes a `data-t` attribute instead of text. */
function zonedHtml(
  parts: string[],
  tok: (p: string) => string,
  attr: string,
): string {
  const span = (p: string) =>
    attr
      ? `<span class="gmt-timetable-tok" data-t="${escapeAttr(p)}"></span>`
      : `<span class="gmt-timetable-tok">${tok(p)}</span>`;
  const at = parts.findIndex((p) => p.startsWith("["));
  const head = at === -1 ? parts : parts.slice(0, at);
  const zone = at === -1 ? [] : parts.slice(at);
  return (
    head.map(span).join("") +
    (zone.length > 0
      ? `<wbr><span class="gmt-timetable-zone">${zone.map(span).join("<wbr>")}</span>`
      : "")
  );
}

/** A zoned instant string as a compact, readable cell: the local `HH:MM
 *  ±hh:mm` at normal size, with the full value underneath in smaller, muted
 *  text — never dropped, so the exact value stays visible without wrapping
 *  the table into long ISO prose. */
function timeCell(iso: string): string {
  const m = /T(\d{2}:\d{2})(?::\d{2})?([+-]\d{2}:\d{2}|Z)/.exec(iso);
  const short = m ? `${m[1]}${m[2] === "Z" ? " Z" : ` ${m[2]}`}` : iso;
  return (
    `<span class="gmt-timetable-time">${escapeHtml(short)}</span>` +
    `<span class="gmt-timetable-time-full">${wbrBeforeOffsetAndBracket(iso)}</span>`
  );
}

/** A cell that holds the size of the tallest thing it can contain: a hidden
 *  sizer and the live content stacked in one grid cell. */
function holdHtml(sizer: string, live: string): string {
  return `<div class="gmt-timetable-hold">${sizer}<div class="gmt-timetable-live">${live}</div></div>`;
}

function noteSizerHtml(): string {
  return `<span class="gmt-timetable-sizer" aria-hidden="true"><span class="gmt-transport-badge" data-t="${escapeAttr(shapeOf.note())}"></span></span>`;
}

function timeSizerHtml(zone: string): string {
  const { short, parts } = shapeOf.time(zone);
  return (
    `<span class="gmt-timetable-sizer" aria-hidden="true">` +
    `<span class="gmt-timetable-time" data-t="${escapeAttr(short)}"></span>` +
    `<span class="gmt-timetable-time-full">${zonedHtml(parts, (p) => p, "data-t")}</span>` +
    `</span>`
  );
}

/**
 * The Offset field's options: what the library says this row can mean, plus
 * whatever the row already holds.
 *
 * The field was free text, which left the reader guessing at a format and at
 * which values did anything at all — most do nothing, because an offset only
 * picks a pass of a repeated hour. `choices` is empty before the library
 * loads, so the server renders the blank option and the row's own value and
 * the mount fills the rest in; `current` is always present as an option even
 * when it is not among the choices, because a permalink may carry an offset
 * for a row whose printed time has since changed, and a `<select>` silently
 * drops a value it has no option for.
 */
function offsetOptionsHtml(choices: OffsetChoice[], current: string): string {
  const list = choices.length === 0 ? [{ value: "", label: "None" }] : choices;
  const all = list.some((c) => c.value === current)
    ? list
    : [...list, { value: current, label: current }];
  return all
    .map(
      (c) =>
        `<option value="${escapeAttr(c.value)}"${c.value === current ? " selected" : ""}>${escapeHtml(c.label)}</option>`,
    )
    .join("");
}

function rowGroup(i: number, row: TimetableRow): string {
  const n = i + 1;
  return (
    `<fieldset class="gmt-transport-leg gmt-transport-leg--brackets gmt-timetable-row" data-role="row-${n}" data-series="${n}">` +
    `<legend><span class="gmt-cutoff-series-swatch" aria-hidden="true"></span>Row ${n}</legend>` +
    `<div class="gmt-field-grid gmt-timetable-fields">` +
    `<label class="gmt-label">${labelTextHtml("Printed departure")}` +
    `<input class="gmt-input" data-role="departure-${n}" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(row.departure)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Offset", { optional: true })}` +
    `<select class="gmt-select" data-role="offset-${n}">${offsetOptionsHtml([], row.offset)}</select></label>` +
    `</div>` +
    `<div class="gmt-timetable-hold gmt-timetable-why-slot">` +
    `<span class="gmt-timetable-sizer" aria-hidden="true"><span class="gmt-timetable-why" data-t="${escapeAttr(LONGEST_REASON)}"></span></span>` +
    `<p class="gmt-timetable-why" data-role="why-${n}"></p>` +
    `</div>` +
    `</fieldset>`
  );
}

/** One lane per row, always four: a lane that came and went with its row would
 *  be an un-eased jump of section 1 on a preset change. */
function laneHtml(n: number): string {
  return (
    `<div class="gmt-timetable-lane" data-role="lane-${n}" data-series="${n}">` +
    `<div class="gmt-handle" data-role="handle-${n}" tabindex="0" role="slider" aria-orientation="horizontal" aria-label="Row ${n} printed time" aria-valuemin="0" aria-valuemax="1435" hidden></div>` +
    `<span class="gmt-cutoff-chip gmt-timetable-tag" data-role="tag-${n}" aria-hidden="true" hidden></span>` +
    `</div>`
  );
}

const LEGEND = [
  ["solid", "printed time to its instant"],
  ["dashed", "a skipped time, read forward"],
  ["bar", "run time to arrival"],
  ["twice", "an hour that repeats"],
  ["skipped", "an hour that is skipped"],
] as const;

export function renderTimetableReaderTemplate(
  args: TimetableReaderArgs = {},
): string {
  const seeded = args.departures !== undefined || args.departure1 !== undefined;
  const state: TimetableState = seeded
    ? readArgs(args)
    : {
        startTimeZone: TIMETABLE_PRESETS[0]!.startTimeZone,
        duration: TIMETABLE_PRESETS[0]!.duration,
        timeZone: TIMETABLE_PRESETS[0]!.timeZone,
        rows: [
          TIMETABLE_PRESETS[0]!.rows[0] ?? { departure: "", offset: "" },
          TIMETABLE_PRESETS[0]!.rows[1] ?? { departure: "", offset: "" },
          TIMETABLE_PRESETS[0]!.rows[2] ?? { departure: "", offset: "" },
          TIMETABLE_PRESETS[0]!.rows[3] ?? { departure: "", offset: "" },
        ],
      };
  const presetId = matchPreset(state);
  const preset = TIMETABLE_PRESETS.find((p) => p.id === presetId);

  return (
    `<div class="gmt-timetable gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. The timetable</h4>` +
    `<div class="gmt-timetable-split">` +
    `<div class="gmt-field-grid gmt-timetable-top">` +
    `<label class="gmt-label gmt-timetable-preset">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptions(presetId)}</select></label>` +
    `<label class="gmt-label">${labelTextHtml("Printed in")}` +
    `<select class="gmt-select" data-role="start-zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.startTimeZone)}</select></label>` +
    `<label class="gmt-label">${labelTextHtml("Run time")}` +
    `<input class="gmt-input" data-role="duration" type="text" spellcheck="false" autocomplete="off" value="${escapeAttr(state.duration)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Arrives in")}` +
    `<select class="gmt-select" data-role="zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.timeZone)}</select></label>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>` +
    `<div class="gmt-timetable-pane">` +
    `<div class="gmt-timetable-day" data-role="day">` +
    `<div class="gmt-timetable-day-status">` +
    `<span class="gmt-timetable-day-caption" data-role="day-caption"></span>` +
    `<span class="gmt-cutoff-chip gmt-cutoff-chip--dim" data-role="band-chip"></span>` +
    `</div>` +
    `<div class="gmt-timetable-lanes" data-role="day-track" role="group" aria-label="Printed times on the local day">` +
    `<div class="gmt-timetable-bands" data-role="bands" aria-hidden="true"></div>` +
    [1, 2, 3, 4].map(laneHtml).join("") +
    `</div>` +
    `<div class="gmt-timetable-day-ticks" data-role="day-ticks" aria-hidden="true"></div>` +
    `</div>` +
    `<p class="gmt-widget-hint">Drag a handle, or focus it and use the arrow keys, to move that row's printed time. Page Up and Page Down move an hour. The shaded hour is where the clock repeats or skips.</p>` +
    `</div>` +
    `<div class="gmt-timetable-pane">` +
    `<div class="gmt-timetable-rowset" data-role="rowset">` +
    state.rows.map((row, i) => rowGroup(i, row)).join("") +
    `</div>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. What each printed time means</h4>` +
    `<div class="gmt-timetable-split">` +
    `<div class="gmt-timetable-pane">` +
    `<div class="gmt-timetable-chart" data-role="two-clocks" role="img" aria-label="Type a printed departure in a row to draw the two clocks.">` +
    `<div class="gmt-timetable-plot" data-role="plot" data-window-start="0" data-window-end="360"></div>` +
    `<p class="gmt-timetable-chart-caption" data-role="chart-caption"></p>` +
    `<ul class="gmt-timetable-legend" data-role="chart-legend">` +
    LEGEND.map(
      ([kind, text]) =>
        `<li><span class="gmt-timetable-swatch gmt-timetable-swatch--${kind}" aria-hidden="true"></span>${escapeHtml(text)}</li>`,
    ).join("") +
    `</ul>` +
    `</div>` +
    `</div>` +
    `<div class="gmt-timetable-pane">` +
    `<table class="gmt-timetable-rows" data-role="rows" role="table">` +
    `<thead role="rowgroup"><tr role="row"><th role="columnheader">Printed</th><th role="columnheader">Leaves (exact)</th><th role="columnheader">Note</th><th role="columnheader">Local arrival</th></tr></thead>` +
    `<tbody data-role="rows-body" role="rowgroup"></tbody>` +
    `</table>` +
    `<p class="gmt-widget-hint">For the general rule behind a repeated or skipped hour, see the <a href="/tools/dst-inspector/">DST Inspector</a>.</p>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. What <code>scheduleDelivery</code> returns</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Show the call for")}` +
    `<select class="gmt-select" data-role="row-pick"></select></label>` +
    `</div>` +
    codeFrameHtml("timetable") +
    `<div class="gmt-timetable-hold">` +
    `<span class="gmt-widget-output gmt-timetable-sizer" aria-hidden="true" data-t=""></span>` +
    `<output class="gmt-widget-output" data-role="timetable-output">&nbsp;</output>` +
    `</div>` +
    `<div class="gmt-transport-reason" data-role="reason-aside"></div>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** Percent to four places, which is what the tests and the eye can tell apart. */
const pct = (n: number): number => Number(n.toFixed(4));

/** `HH:MM` of a zoned instant string. */
const hhmmIn = (iso: string | null): string | null => {
  const m = iso ? /T(\d{2}:\d{2})/.exec(iso) : null;
  return m ? m[1]! : null;
};

const NO_DAY_CAPTION = "Type a printed departure in a row to draw its day.";
const NO_CHART_CHIP =
  "Type a printed departure in a row to draw the two clocks.";

function setupWidget(
  root: HTMLElement,
  lib: TimetableLib,
): (() => void) | null {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;

  const presetEl = q<HTMLSelectElement>("preset");
  const startZoneEl = q<HTMLSelectElement>("start-zone");
  const durationEl = q<HTMLInputElement>("duration");
  const zoneEl = q<HTMLSelectElement>("zone");
  const rowPickEl = q<HTMLSelectElement>("row-pick");
  const trackEl = q<HTMLElement>("day-track");
  const bandsEl = q<HTMLElement>("bands");
  const tickRowEl = q<HTMLElement>("day-ticks");
  const plotEl = q<HTMLElement>("plot");
  const chartEl = q<HTMLElement>("two-clocks");
  const rowInputs = [1, 2, 3, 4].map((n) => ({
    departure: q<HTMLInputElement>(`departure-${n}`),
    offset: q<HTMLSelectElement>(`offset-${n}`),
    handle: q<HTMLElement>(`handle-${n}`),
    tag: q<HTMLElement>(`tag-${n}`),
    lane: q<HTMLElement>(`lane-${n}`),
  }));
  /* The reason line under each Offset select, tied to it for assistive tech. */
  const whyBase = `ttr-why-${++whyCount}`;
  const rowWhy = [1, 2, 3, 4].map((n) => {
    const el = q<HTMLElement>(`why-${n}`);
    if (el) {
      el.id = `${whyBase}-${n}`;
      q<HTMLSelectElement>(`offset-${n}`)?.setAttribute(
        "aria-describedby",
        el.id,
      );
    }
    return el;
  });
  if (
    !presetEl ||
    !startZoneEl ||
    !durationEl ||
    !zoneEl ||
    !rowPickEl ||
    !trackEl ||
    !bandsEl ||
    !tickRowEl ||
    !plotEl ||
    !chartEl ||
    rowWhy.some((w) => !w) ||
    rowInputs.some(
      (r) => !r.departure || !r.offset || !r.handle || !r.tag || !r.lane,
    )
  ) {
    return null;
  }

  const memo = newChartMemo();

  function state(): TimetableState {
    return {
      startTimeZone: startZoneEl!.value.trim(),
      duration: durationEl!.value.trim(),
      timeZone: zoneEl!.value.trim(),
      rows: rowInputs.map((r) => ({
        departure: r.departure!.value.trim(),
        offset: r.offset!.value.trim(),
      })) as TimetableState["rows"],
    };
  }

  function syncPreset(): void {
    presetEl!.value = matchPreset(state());
    const desc = q("preset-description");
    if (desc) {
      setPresetDescription(
        desc,
        TIMETABLE_PRESETS.find((p) => p.id === presetEl!.value)?.description ??
          "",
      );
    }
  }

  // ---- The day track ----

  let bandsHtml = "";
  function drawBands(bands: readonly DayBand[]): void {
    const html = bands
      .map(
        (b) =>
          `<div class="gmt-timetable-band" data-kind="${b.kind}" data-from="${escapeAttr(b.from)}" data-to="${escapeAttr(b.to)}" style="left:${pct((b.startMinute / 1440) * 100)}%;width:${pct(((b.endMinute - b.startMinute) / 1440) * 100)}%"></div>`,
      )
      .join("");
    if (html === bandsHtml) return;
    bandsHtml = html;
    bandsEl!.innerHTML = html;
  }

  let tickKey = "";
  function drawDayTicks(): void {
    const step = tickStepHours(layoutWidth(trackEl!) / 24, 44);
    const key = `${step}`;
    if (key !== tickKey) {
      tickKey = key;
      let html = "";
      for (let h = 0; h < 24; h += step) {
        html += `<span class="gmt-cutoff-axis-tick" style="left:${pct((h / 24) * 100)}%">${String(h).padStart(2, "0")}:00</span>`;
      }
      tickRowEl!.innerHTML = html;
    }
    thinTickLabels(tickRowEl!);
  }

  function drawDay(
    s: TimetableState,
    date: string | null,
    bands: readonly DayBand[],
    facts: readonly RowFacts[],
  ): void {
    const zone = s.startTimeZone;
    const caption = q("day-caption");
    if (caption) {
      caption.textContent =
        date === null ? NO_DAY_CAPTION : `Local day ${date} in ${zone}`;
    }
    const chip = q("band-chip");
    if (chip) {
      chip.textContent = date === null ? "" : bandChipText(bands);
      chip.classList.toggle(
        "gmt-cutoff-chip--dim",
        date === null || bands.length === 0,
      );
      chip.hidden = date === null;
      if (bands.length === 1) chip.dataset.kind = bands[0]!.kind;
      else delete chip.dataset.kind;
    }
    drawBands(bands);

    const trackPx = layoutWidth(trackEl!);
    for (let i = 0; i < MAX_ROWS; i++) {
      const n = i + 1;
      const { handle, tag } = rowInputs[i]!;
      const handleEl = handle!;
      const tagEl = tag!;
      const lane = laneState(s, i, date ?? "", lib);
      const dim = (text: string): void => {
        tagEl.textContent = text;
        tagEl.hidden = false;
        tagEl.classList.add("gmt-cutoff-chip--dim");
        tagEl.dataset.pinned = "true";
        delete tagEl.dataset.kind;
        delete tagEl.dataset.side;
        tagEl.style.left = "";
      };
      if (lane.state === "on") {
        const hhmm = hhmmOfMinute(lane.minute);
        const offset = s.rows[i]!.offset;
        const position = pct((lane.minute / 1440) * 100);
        handleEl.hidden = false;
        handleEl.style.left = `${position}%`;
        handleEl.setAttribute(
          "aria-valuenow",
          String(Math.min(lane.minute, 1435)),
        );
        handleEl.setAttribute(
          "aria-valuetext",
          handleValueText(
            hhmm,
            lane.kind,
            offset,
            hhmmIn(facts[i]?.leaves ?? null),
          ),
        );
        if (lane.kind === "twice" || lane.kind === "skipped") {
          handleEl.dataset.kind = lane.kind;
          tagEl.dataset.kind = lane.kind;
        } else {
          delete handleEl.dataset.kind;
          delete tagEl.dataset.kind;
        }
        tagEl.textContent = tagText(n, hhmm, lane.kind);
        tagEl.hidden = false;
        tagEl.classList.remove("gmt-cutoff-chip--dim");
        delete tagEl.dataset.pinned;
        tagEl.style.left = `${position}%`;
        tagEl.dataset.side = placeLabel({
          atPx: (lane.minute / 1440) * trackPx,
          labelPx: layoutWidth(tagEl),
          trackPx,
          offsetPx: 14,
        });
        continue;
      }
      handleEl.hidden = true;
      delete handleEl.dataset.kind;
      if (lane.state === "blank") {
        if (date === null) {
          tagEl.hidden = true;
          tagEl.textContent = "";
        } else dim(`${n} · click to add`);
      } else if (lane.state === "off") {
        dim(`${n} · on ${lane.date}`);
      } else {
        dim(`${n} · not a date and time`);
      }
    }
  }

  // ---- The two-clocks chart ----

  let lastChart: { layout: ChartLayout | null; win: ChartWindow | null } = {
    layout: null,
    win: null,
  };

  function ticksHtml(
    layout: ChartLayout,
    win: ChartWindow,
    stepHours: number,
    wall: boolean,
  ): string {
    const stepMin = stepHours * 60;
    let html = "";
    for (
      let m = Math.ceil(win.start / stepMin) * stepMin;
      m <= win.end;
      m += stepMin
    ) {
      if (wall && m > 1440) break;
      const label = wall ? hhmmOfMinute(m % 1440) : exactTickLabel(layout, m);
      html += `<span class="gmt-cutoff-axis-tick" style="left:${pct(windowPct(m, win))}%">${escapeHtml(label)}</span>`;
    }
    return html;
  }

  function chartHtml(
    layout: ChartLayout,
    win: ChartWindow,
    stepHours: number,
  ): string {
    const x = (m: number): number => pct(windowPct(m, win));
    const mille = (m: number): number =>
      Number((((m - win.start) / (win.end - win.start)) * 1000).toFixed(3));
    const bandWords = bandChipText(layout.bands);
    const chipKind =
      layout.bands.length === 1 ? ` data-kind="${layout.bands[0]!.kind}"` : "";
    const dimChip = layout.bands.length === 0 ? " gmt-cutoff-chip--dim" : "";

    // wall axis: line, bands, printed squares
    const wallLeft = Math.max(0, x(0));
    const wallRight = Math.min(100, x(1440));
    let wall = `<span class="gmt-timetable-axisline" style="left:${wallLeft}%;width:${Math.max(0, pct(wallRight - wallLeft))}%"></span>`;
    for (const f of layout.fans) {
      wall += `<span class="gmt-timetable-wband" data-role="wall-band" data-kind="${f.kind}" style="left:${x(f.wallStart)}%;width:${pct(x(f.wallEnd) - x(f.wallStart))}%"></span>`;
    }
    for (const r of layout.rows) {
      const hollow =
        r.instantMinute === null ? " gmt-timetable-sq--hollow" : "";
      wall += `<span class="gmt-timetable-sq${hollow}" data-role="printed-${r.n}" data-series="${r.n}" style="left:${x(r.printedMinute)}%"></span>`;
    }

    // the fan: wedges, then the connectors
    let fan = "";
    for (const f of layout.fans) {
      const w0 = mille(f.wallStart);
      const w1 = mille(f.wallEnd);
      if (f.kind === "twice") {
        const [e0, e1, e2] = f.exact.map(mille) as [number, number, number];
        fan += `<polygon class="gmt-timetable-wedge" data-kind="twice" data-pass="earlier" points="${w0},0 ${w1},0 ${e1},100 ${e0},100"/>`;
        fan += `<polygon class="gmt-timetable-wedge" data-kind="twice" data-pass="later" points="${w0},0 ${w1},0 ${e2},100 ${e1},100"/>`;
      } else {
        const e0 = mille(f.exact[0]!);
        fan += `<polygon class="gmt-timetable-wedge" data-kind="skipped" points="${w0},0 ${w1},0 ${e0},100"/>`;
      }
    }
    for (const r of layout.rows) {
      if (r.instantMinute === null || r.leaves === null) continue;
      fan += `<line class="gmt-timetable-link${r.dashed ? " gmt-timetable-link--dashed" : ""}" data-role="link-${r.n}" data-series="${r.n}" x1="${mille(r.printedMinute)}" y1="0" x2="${mille(r.instantMinute)}" y2="100" data-instant="${escapeAttr(r.leaves)}" data-printed="${escapeAttr(hhmmOfMinute(r.printedMinute))}"/>`;
    }

    // exact axis: line, the repeated stretch, instant squares
    let exact = `<span class="gmt-timetable-axisline" style="left:0;width:100%"></span>`;
    for (const f of layout.fans) {
      if (f.kind === "twice") {
        exact += `<span class="gmt-timetable-eline" data-kind="twice" style="left:${x(f.exact[0]!)}%;width:${pct(x(f.exact[2]!) - x(f.exact[0]!))}%"></span>`;
        exact += `<span class="gmt-timetable-etick" data-kind="twice" style="left:${x(f.exact[1]!)}%"></span>`;
      } else {
        exact += `<span class="gmt-timetable-etick" data-kind="skipped" style="left:${x(f.exact[0]!)}%"></span>`;
      }
    }
    for (const r of layout.rows) {
      if (r.instantMinute === null) continue;
      exact += `<span class="gmt-timetable-sq" data-role="instant-${r.n}" data-series="${r.n}" style="left:${x(r.instantMinute)}%"></span>`;
    }

    // the offset strip
    let strip = "";
    layout.segments.forEach((seg, k) => {
      const from = Math.max(win.start, seg.from);
      const to = Math.min(win.end, seg.to);
      if (to <= from) return;
      strip += `<span class="gmt-cutoff-chip gmt-cutoff-chip--dim gmt-timetable-offset" data-seg="${k}" data-from="${x(from)}" data-to="${x(to)}">UTC${escapeHtml(seg.offset.replace("-", "−"))}</span>`;
    });

    // journeys
    let journeys = "";
    for (const r of layout.rows) {
      let inner: string;
      if (r.instantMinute === null || r.leaves === null) {
        inner = `<span class="gmt-cutoff-chip gmt-cutoff-chip--dim gmt-timetable-noinstant">no instant</span>`;
      } else {
        const startPct = x(r.instantMinute);
        const endMinute = r.arrivalMinute ?? r.instantMinute;
        const clipped = r.open || endMinute > win.end;
        const endPct = x(Math.min(endMinute, win.end));
        const left = Math.max(0, startPct);
        const width = Math.max(0, pct(endPct - left));
        const arrival =
          r.localArrival !== null
            ? arrivalChipText(r.localArrival, layout.date)
            : "";
        inner =
          `<span class="gmt-timetable-bar${clipped ? " gmt-timetable-bar--open" : ""}" data-role="bar-${r.n}" data-leaves="${escapeAttr(r.leaves)}" data-arrival="${escapeAttr(r.localArrival ?? "")}" style="left:${startPct}%;width:${width}%"></span>` +
          (arrival
            ? `<span class="gmt-cutoff-chip gmt-timetable-arrival" data-role="arrival-${r.n}" data-side="start" data-start="${startPct}" data-end="${endPct}" style="left:${endPct}%">${escapeHtml(arrival)}</span>`
            : "");
      }
      journeys += `<div class="gmt-timetable-prow gmt-timetable-pjourney" data-role="journey-${r.n}" data-series="${r.n}"><span class="gmt-timetable-pgutter"><span class="gmt-cutoff-chip">${r.n}</span></span><div class="gmt-timetable-px">${inner}</div></div>`;
    }

    return (
      `<div class="gmt-timetable-pcap"><span>Printed clock · ${escapeHtml(layout.startTimeZone)}</span><span class="gmt-cutoff-chip${dimChip}"${chipKind}>${escapeHtml(bandWords)}</span></div>` +
      `<div class="gmt-timetable-prow gmt-timetable-pticks" data-role="wall-ticks"><span class="gmt-timetable-pgutter"></span><div class="gmt-timetable-px">${ticksHtml(layout, win, stepHours, true)}</div></div>` +
      `<div class="gmt-timetable-prow gmt-timetable-paxis" data-role="wall-axis"><span class="gmt-timetable-pgutter"></span><div class="gmt-timetable-px">${wall}</div></div>` +
      `<div class="gmt-timetable-prow gmt-timetable-pfan" data-role="fan"><span class="gmt-timetable-pgutter"></span><div class="gmt-timetable-px"><svg class="gmt-timetable-fan" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${fan}</svg></div></div>` +
      `<div class="gmt-timetable-prow gmt-timetable-paxis gmt-timetable-paxis--exact" data-role="exact-axis"><span class="gmt-timetable-pgutter"></span><div class="gmt-timetable-px">${exact}</div></div>` +
      `<div class="gmt-timetable-prow gmt-timetable-pticks" data-role="exact-ticks"><span class="gmt-timetable-pgutter"></span><div class="gmt-timetable-px">${ticksHtml(layout, win, stepHours, false)}</div></div>` +
      `<div class="gmt-timetable-prow gmt-timetable-poffsets" data-role="offsets"><span class="gmt-timetable-pcap-text">Exact time · UTC</span><span class="gmt-timetable-pgutter"></span><div class="gmt-timetable-px">${strip}</div></div>` +
      journeys
    );
  }

  /** Measure, then toggle: thin the tick labels, flip an arrival chip that
   *  would leave the plot, and hide an offset chip that does not fit. */
  function fitChart(): void {
    for (const row of plotEl!.querySelectorAll<HTMLElement>(
      '[data-role="wall-ticks"] > .gmt-timetable-px, [data-role="exact-ticks"] > .gmt-timetable-px',
    )) {
      thinTickLabels(row);
    }
    for (const chip of plotEl!.querySelectorAll<HTMLElement>(
      ".gmt-timetable-arrival",
    )) {
      const px = chip.parentElement!;
      const trackPx = layoutWidth(px);
      const start = Number(chip.dataset.start);
      const end = Number(chip.dataset.end);
      const { side, leftPx } = arrivalChipPlacement({
        startPx: (start / 100) * trackPx,
        endPx: (end / 100) * trackPx,
        labelPx: layoutWidth(chip),
        trackPx,
        offsetPx: 8,
      });
      chip.dataset.side = side;
      chip.style.left = trackPx > 0 ? `${(leftPx / trackPx) * 100}%` : "0";
    }
    const strip = plotEl!.querySelector<HTMLElement>(
      '[data-role="offsets"] > .gmt-timetable-px',
    );
    const caption = plotEl!.querySelector<HTMLElement>(
      '[data-role="offsets"] > .gmt-timetable-pcap-text',
    );
    if (strip && caption) {
      const px = layoutWidth(strip);
      const origin = strip.getBoundingClientRect().left;
      const captionRight = caption.getBoundingClientRect().right - origin;
      for (const chip of strip.querySelectorAll<HTMLElement>(
        ".gmt-timetable-offset",
      )) {
        chip.hidden = false;
        const w = layoutWidth(chip);
        if (px === 0 || w === 0) continue;
        const from = (Number(chip.dataset.from) / 100) * px;
        const to = (Number(chip.dataset.to) / 100) * px;
        const lowest = Math.max(from + 4, captionRight + 8);
        const highest = to - w - 4;
        if (highest < lowest) {
          chip.hidden = true;
          continue;
        }
        const left = Math.min(
          highest,
          Math.max(lowest, (from + to) / 2 - w / 2),
        );
        chip.style.left = `${pct((left / px) * 100)}%`;
      }
    }
  }

  function drawChart(
    layout: ChartLayout | null,
    win: ChartWindow | null,
  ): void {
    lastChart = { layout, win };
    if (layout === null || win === null) {
      plotEl!.innerHTML = `<span class="gmt-cutoff-chip gmt-cutoff-chip--dim gmt-timetable-plot-empty">${NO_CHART_CHIP}</span>`;
      chartEl!.setAttribute("aria-label", NO_CHART_CHIP);
      plotEl!.dataset.windowStart = "0";
      plotEl!.dataset.windowEnd = "360";
      const cap = q("chart-caption");
      if (cap) cap.textContent = "";
      return;
    }
    plotEl!.dataset.windowStart = String(win.start);
    plotEl!.dataset.windowEnd = String(win.end);
    chartEl!.setAttribute("aria-label", chartSummary(layout));
    /* Two passes: the tick step depends on the width the first pass lays out. */
    plotEl!.innerHTML = chartHtml(layout, win, 1);
    const px = plotEl!.querySelector<HTMLElement>(".gmt-timetable-px");
    const step = px
      ? tickStepHours(layoutWidth(px) / ((win.end - win.start) / 60), 52)
      : 12;
    if (step !== 1) plotEl!.innerHTML = chartHtml(layout, win, step);
    fitChart();
    const cap = q("chart-caption");
    if (cap) {
      cap.textContent =
        `Arrival times are in ${layout.timeZone}.` +
        (layout.timeZone !== layout.startTimeZone
          ? ` The timetable is printed in ${layout.startTimeZone}.`
          : "");
    }
  }

  // ---- The table ----

  function drawTable(s: TimetableState, facts: readonly RowFacts[]): void {
    const body = q("rows-body");
    if (!body) return;
    const rowsHtml: string[] = [];
    for (let i = 0; i < MAX_ROWS; i++) {
      const row = s.rows[i]!;
      if (row.departure === "") continue;
      const n = i + 1;
      const kind = classify(row.departure, s.startTimeZone, lib);
      const badge = rowBadge(kind, row.offset !== "");
      const f = facts[i]!;
      const local = f.result?.legTimes[0]?.localArrival ?? null;
      const cell = (iso: string | null, zone: string): string =>
        holdHtml(
          timeSizerHtml(zone),
          iso
            ? timeCell(iso)
            : `<span class="gmt-timetable-time" data-sentinel></span>`,
        );
      rowsHtml.push(
        `<tr data-role="row-${n}-display" data-series="${n}" role="row">` +
          `<td data-label="Printed" role="cell"><span class="gmt-timetable-printed"><span class="gmt-cutoff-series-swatch" aria-hidden="true"></span><span class="gmt-timetable-rownum">${n}</span> <span class="gmt-timetable-printed-text">${wbrBeforeOffsetAndBracket(row.departure + row.offset)}</span></span></td>` +
          `<td data-label="Leaves (exact)" role="cell">${cell(f.leaves, s.startTimeZone)}</td>` +
          `<td data-label="Note" role="cell">${holdHtml(noteSizerHtml(), badge ? `<span class="gmt-transport-badge" data-role="badge-${n}">${escapeHtml(badge)}</span>` : "")}</td>` +
          `<td data-label="Local arrival" role="cell">${cell(local, s.timeZone)}</td>` +
          `</tr>`,
      );
    }
    body.innerHTML = rowsHtml.join("");
    for (const el of body.querySelectorAll<HTMLElement>("[data-sentinel]")) {
      renderWidgetOutput(el, "NO SIGNAL", "sentinel");
    }
  }

  // ---- Render ----

  let win: ChartWindow | null = null;

  /** `refit` re-fits the chart's window to the rows. A moving handle passes
   *  false: the chart keeps its window until the change settles, so a mark
   *  that leaves it is clipped at the plot's edge rather than the axis
   *  sliding under the reader's pointer. */
  function render(refit = true): void {
    const s = state();
    /* The choices depend on the printed time and the zone, so they are rebuilt
       whenever either moves — not once at mount. The select is available only
       where it matters: a row that holds an offset keeps it enabled, so the
       reader can always clear it. */
    for (let i = 0; i < MAX_ROWS; i++) {
      const el = rowInputs[i]!.offset!;
      const row = s.rows[i]!;
      const choices = offsetChoices(row.departure, s.startTimeZone, lib);
      const html = offsetOptionsHtml(choices, row.offset);
      if (el.innerHTML !== html) {
        el.innerHTML = html;
        el.value = row.offset;
      }
      el.disabled = choices.length <= 1 && row.offset === "";
      const why = rowWhy[i]!;
      const text = offsetReason(
        row.departure,
        s.startTimeZone,
        row.offset,
        lib,
      );
      if (why.textContent !== text) why.textContent = text;
    }

    const facts: RowFacts[] = [];
    for (let i = 0; i < MAX_ROWS; i++) {
      facts.push(
        s.rows[i]!.departure === ""
          ? { leaves: null, result: null }
          : rowFacts(s, i, lib),
      );
    }
    const date = trackDate(s, lib);
    const layout = chartLayout(s, lib, facts, memo);
    const bands =
      layout?.bands ??
      (date === null ? [] : bandsFor(s.startTimeZone, date, lib, memo));
    drawDay(s, date, bands, facts);
    if (layout === null) win = null;
    else if (refit || win === null) win = chartWindow(layout);
    drawChart(layout, win);
    drawTable(s, facts);

    const nonBlankRows: number[] = [];
    for (let i = 0; i < MAX_ROWS; i++)
      if (s.rows[i]!.departure !== "") nonBlankRows.push(i);
    const currentPick = rowPickEl!.value;
    const pickHtml = nonBlankRows
      .map(
        (i) =>
          `<option value="${i}">Row ${i + 1}${s.rows[i]!.departure ? ` (${escapeHtml(s.rows[i]!.departure)})` : ""}</option>`,
      )
      .join("");
    if (rowPickEl!.innerHTML !== pickHtml) rowPickEl!.innerHTML = pickHtml;
    const pickedIndex = nonBlankRows.includes(Number.parseInt(currentPick, 10))
      ? Number.parseInt(currentPick, 10)
      : (nonBlankRows[0] ?? 0);
    rowPickEl!.value = String(pickedIndex);

    const leg = rowLeg(s, pickedIndex);
    const options = optionsOf(s);
    const [callHtml, callPlain] = scheduleCallSource(leg ? [leg] : [], options);
    renderCallLine(
      q("call-timetable"),
      "scheduleDelivery",
      callHtml,
      callPlain,
    );

    const out = q("timetable-output");
    const { result, reason } = rowResult(s, pickedIndex, lib);
    if (out) {
      if (result === null) renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(out, formatSchedule(result), "live");
      const sizer = out.parentElement?.querySelector<HTMLElement>(
        ".gmt-timetable-sizer",
      );
      if (sizer) sizer.dataset.t = shapeOf.output(s.timeZone);
    }

    const aside = q("reason-aside");
    if (aside) {
      if (reason) {
        renderAside(
          aside,
          "caution",
          "Why null",
          `<p>${escapeHtml(reason)}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }
  }

  function applyPreset(): void {
    const preset = TIMETABLE_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    startZoneEl!.value = preset.startTimeZone;
    durationEl!.value = preset.duration;
    zoneEl!.value = preset.timeZone;
    for (let i = 0; i < MAX_ROWS; i++) {
      const row = preset.rows[i] ?? { departure: "", offset: "" };
      rowInputs[i]!.departure!.value = row.departure;
      /* The offset's options come from the previous render, so the preset's own
         may be missing; a bare `.value =` would drop it. */
      setControlValue(rowInputs[i]!.offset!, row.offset);
    }
    syncPreset();
    render();
  }

  // ---- Handles: pointer and keyboard ----

  let dragging: number | null = null;
  let keyMoved = false;

  const handleOf = (target: EventTarget | null): number => {
    const el = (target as HTMLElement | null)?.closest?.(
      '[data-role^="handle-"]',
    );
    if (!el) return -1;
    return rowInputs.findIndex((r) => r.handle === el);
  };

  /** Writes row `i`'s printed time at `minute` on the track's date. Changes
   *  nothing else: the offset is the reader's own choice. */
  function moveRow(i: number, minute: number, date: string): void {
    const next = withMinute(date, minute);
    const input = rowInputs[i]!.departure!;
    if (input.value === next) return;
    input.value = next;
    syncPreset();
    render(false);
  }

  function minuteFromPointer(e: PointerEvent): number {
    const rect = trackEl!.getBoundingClientRect();
    return minuteAtPointer(
      e.clientX,
      rect.left,
      rect.width,
      pointerStep(rect.width),
    );
  }

  function capture(i: number, e: PointerEvent): void {
    try {
      rowInputs[i]!.handle!.setPointerCapture(e.pointerId);
    } catch {
      /* Capture can throw (a pointer that is already gone); the drag still works
         through the events that bubble to the root. */
    }
  }

  function endDrag(): void {
    if (dragging === null) return;
    dragging = null;
    render();
  }

  root.addEventListener("pointerdown", (e) => {
    const ev = e as PointerEvent;
    const i = handleOf(ev.target);
    if (i >= 0) {
      dragging = i;
      capture(i, ev);
      return;
    }
    const lane = (ev.target as HTMLElement).closest?.('[data-role^="lane-"]');
    if (!lane) return;
    const row = rowInputs.findIndex((r) => r.lane === lane);
    if (row < 0 || rowInputs[row]!.departure!.value.trim() !== "") return;
    const date = trackDate(state(), lib);
    if (date === null) return;
    dragging = row;
    moveRow(row, minuteFromPointer(ev), date);
    capture(row, ev);
  });

  root.addEventListener("pointermove", (e) => {
    if (dragging === null) return;
    const date = trackDate(state(), lib);
    if (date === null) return;
    moveRow(dragging, minuteFromPointer(e as PointerEvent), date);
  });

  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);
  root.addEventListener("lostpointercapture", endDrag);

  root.addEventListener("keydown", (e) => {
    const ev = e as KeyboardEvent;
    const i = handleOf(ev.target);
    if (i < 0) return;
    const current = rowMinute(rowInputs[i]!.departure!.value);
    if (current === null) return;
    let next: number | null = null;
    switch (ev.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = ev.shiftKey ? jumpMinute(current, 1) : stepMinute(current, 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = ev.shiftKey ? jumpMinute(current, -1) : stepMinute(current, -1);
        break;
      case "PageUp":
        next = jumpMinute(current, 1);
        break;
      case "PageDown":
        next = jumpMinute(current, -1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = 1435;
        break;
    }
    if (next === null) return;
    ev.preventDefault();
    const date = trackDate(state(), lib);
    if (date === null) return;
    keyMoved = true;
    moveRow(i, next, date);
  });

  /* A key move settles on that key's keyup, or when the handle loses focus. */
  const settleKeys = (): void => {
    if (!keyMoved) return;
    keyMoved = false;
    render();
  };
  root.addEventListener("keyup", (e) => {
    if (handleOf(e.target) >= 0) settleKeys();
  });
  root.addEventListener("focusout", (e) => {
    if (handleOf(e.target) >= 0) settleKeys();
  });

  root.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (
      target === durationEl ||
      rowInputs.some((r) => r.departure === target || r.offset === target)
    ) {
      syncPreset();
      render(false);
    }
  });

  root.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    if (target === presetEl) {
      applyPreset();
      return;
    }
    if (target === rowPickEl) {
      render(false);
      return;
    }
    if (
      target === startZoneEl ||
      target === zoneEl ||
      target === durationEl ||
      rowInputs.some((r) => r.departure === target || r.offset === target)
    ) {
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);
  render();
  drawDayTicks();

  /* Refit what depends on a width: the day's ticks, the chart's ticks and
     labels, and the tags. Once more when the fonts arrive, because a label
     measured in a fallback face is the wrong width. */
  const refit = (): void => {
    drawDayTicks();
    render(false);
  };
  const stopTrack = onWidthChange(trackEl, refit);
  const stopPlot = onWidthChange(plotEl, () => {
    drawChart(lastChart.layout, lastChart.win);
  });
  void document.fonts?.ready.then(() => {
    if (root.isConnected) refit();
  });
  return () => {
    stopTrack();
    stopPlot();
  };
}

function applyArgs(root: HTMLElement, args: TimetableReaderArgs): void {
  if (args.departures === undefined && args.departure1 === undefined) return;
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const s = readArgs(args);
  const set = (role: string, value: string) => {
    const el = q<HTMLInputElement | HTMLSelectElement>(role);
    setControlValue(el, value);
  };
  set("start-zone", s.startTimeZone);
  set("duration", s.duration);
  set("zone", s.timeZone);
  for (let i = 0; i < MAX_ROWS; i++) {
    set(`departure-${i + 1}`, s.rows[i]!.departure);
    set(`offset-${i + 1}`, s.rows[i]!.offset);
  }
  const presetEl = q<HTMLSelectElement>("preset");
  if (presetEl) {
    presetEl.value = matchPreset(s);
    const desc = q("preset-description");
    if (desc) {
      setPresetDescription(
        desc,
        TIMETABLE_PRESETS.find((p) => p.id === presetEl.value)?.description ??
          "",
      );
    }
  }
}

export const mountTimetableReader: MountFn<TimetableReaderArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: TimetableLib;
  try {
    lib = await loadTimetableLib();
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  applyArgs(root, args);
  const dispose = setupWidget(root, lib);

  return onceDestroy(
    () => {
      dispose?.();
    },
    () => {
      const q = <T extends HTMLElement>(role: string) =>
        root.querySelector(`[data-role="${role}"]`) as T | null;
      const startZoneEl = q<HTMLSelectElement>("start-zone");
      if (!startZoneEl) return null;
      const state: TimetableState = {
        startTimeZone: startZoneEl.value,
        duration: q<HTMLInputElement>("duration")?.value ?? "",
        timeZone: q<HTMLSelectElement>("zone")?.value ?? "",
        rows: [1, 2, 3, 4].map((n) => ({
          departure: q<HTMLInputElement>(`departure-${n}`)?.value ?? "",
          offset: q<HTMLInputElement>(`offset-${n}`)?.value ?? "",
        })) as TimetableState["rows"],
      };
      return permalinkOf(state);
    },
  );
};
