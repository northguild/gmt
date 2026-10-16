/**
 * The Leap Second Timeline widget (MAR-16), mountable on its tool page and in
 * the chat rail.
 *
 * Every second UTC has inserted, on one axis, with TAI - UTC as a step line.
 * The reader gives a date (its offset and the next insertion), two dates (the
 * leap seconds between them, lit on the axis and in the table) and a written
 * second 60 (was one really inserted). A native range moves the date by day.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. Every
 * listener is delegated on the root, so the host dropping the subtree is a
 * complete teardown apart from the width observer. Every printed call and
 * result is the real one; the drawing only places them.
 */
import { getUnixNow } from "@northguild/gmt/unix/get";
import { codeFrameHtml } from "./code-frame";
import { callResultsText, renderCalls } from "./edi-render";
import { asideSizer, callSizer, holdHtml, outputSizer } from "./edi-picture";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { layoutWidth, onWidthChange, thinTickLabels } from "./label-fit";
import {
  BEFORE_1972_TEXT,
  CUSTOM_PRESET_ID,
  NOT_INSERTED_TEXT,
  NOT_INSTANT_TEXT,
  TIMELINE_PRESETS,
  axisPercent,
  axisTicks,
  blankPlates,
  continuousPercent,
  drawMs,
  isSeeded,
  matchPreset,
  offsetRange,
  permalinkOf,
  presetState,
  readArgs,
  readTimeline,
  sliderDate,
  sliderMax,
  sliderPosition,
  summaryText,
  timelinePlates,
  type LeapSecondTimelineArgs,
  type TimelineRead,
  type TimelineState,
} from "./leap-second-timeline";
import { descriptionHoldHtml, plateHtml, platesHtml } from "./ledger-widgets";
import { setPresetDescription } from "./punctuality-widgets";
import type { TimescaleLib } from "./timescale-lib";
import { loadTimescaleLib } from "./timescale-lib";
import { CONTINUOUS_UTC_FROM, INTEGER_UTC_FROM } from "./timescale-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  rangeFieldHtml,
  renderAside,
  renderWidgetOutput,
  setControlValue,
  syncRange,
  wireCopyButtons,
} from "./widget-ui";

export type { LeapSecondTimelineArgs } from "./leap-second-timeline";

/** The text of an output with nothing to read: a blank field makes no call. */
const BLANK_TEXT = "Not read: the field is blank.";

/** The longest call each group prints, so its region holds one height. */
const CALL_SIZERS = {
  offset:
    'taiMinusUtc("2016-12-31T23:59:60.000000000+09:00")\nnextLeapSecond("2016-12-31T23:59:60.000000000+09:00")',
  between:
    'leapSecondsBetween("2016-12-31T23:59:60.000000000+09:00", "2016-12-31T23:59:60.000000000+09:00")',
  check:
    'hasSecond60("2016-12-31T23:59:60.000000000+09:00")\nisLeapSecond("2016-12-31T23:59:60.000000000+09:00")\nisValidInstant("2016-12-31T23:59:60.000000000+09:00")',
} as const;

const OUTPUT_SIZERS = {
  offset: '37\n"2016-12-31T23:59:60Z"',
  between: "-27",
  check: "true\ntrue\nfalse",
} as const;

const GROUPS = [
  {
    id: "offset",
    heading: "Offset on the date",
    calls: "taiMinusUtc, nextLeapSecond",
  },
  {
    id: "between",
    heading: "Between the two dates",
    calls: "leapSecondsBetween",
  },
  {
    id: "check",
    heading: "Your second 60",
    calls: "hasSecond60, isLeapSecond, isValidInstant",
  },
] as const;

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    TIMELINE_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function groupHtml(g: (typeof GROUPS)[number]): string {
  const live = codeFrameHtml(g.id);
  return (
    `<div class="gmt-leap-group">` +
    `<p class="gmt-widget-hint">${escapeHtml(g.heading)}: <code>${escapeHtml(g.calls)}</code></p>` +
    holdHtml(live, [callSizer(CALL_SIZERS[g.id])], "gmt-ledger-hold") +
    holdHtml(
      `<output class="gmt-widget-output" data-role="${g.id}-output">&nbsp;</output>`,
      [outputSizer("gmt-widget-output", OUTPUT_SIZERS[g.id])],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<div data-role="${g.id}-aside"></div>`,
      [
        asideSizer(NO_RESULT_TITLE, [
          BEFORE_1972_TEXT,
          NOT_INSERTED_TEXT,
          NOT_INSTANT_TEXT,
        ]),
      ],
      "gmt-ledger-hold",
    ) +
    `</div>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The plates, the drawing and the table are
 * drawn by `mount`, because they come from the real library calls.
 */
export function renderLeapSecondTimelineTemplate(
  args: LeapSecondTimelineArgs = {},
): string {
  const state: TimelineState = isSeeded(args)
    ? readArgs(args)
    : presetState(TIMELINE_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = TIMELINE_PRESETS.find((p) => p.id === presetId);

  return (
    `<div class="gmt-leap-second-timeline gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. The dates
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. Set a date, a span and a second 60</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      TIMELINE_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Date", { optional: true })}` +
    `<input class="gmt-input" data-role="date" type="text" maxlength="64" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeAttr(state.date)}"></label>` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Move the date")}` +
    rangeFieldHtml({
      role: "date-slider",
      chipRole: "date-value",
      min: 0,
      max: 1,
      step: 1,
      value: 0,
      valueText: "",
      ends: [INTEGER_UTC_FROM.slice(0, 10), "latest"],
    }) +
    `</label>` +
    `<label class="gmt-label">${labelTextHtml("Count from", { optional: true })}` +
    `<input class="gmt-input" data-role="from" type="text" maxlength="64" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeAttr(state.from)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Count to", { optional: true })}` +
    `<input class="gmt-input" data-role="to" type="text" maxlength="64" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeAttr(state.to)}"></label>` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("A second 60 to check", { optional: true })}` +
    `<input class="gmt-input" data-role="check" type="text" maxlength="64" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeAttr(state.check)}"></label>` +
    `</div>` +
    `<p class="gmt-widget-hint">A blank field is left out: its call is not made. The count includes the first date and leaves out the second.</p>` +
    `</div>` +
    // 2. The timeline
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. Every inserted second</h4>` +
    `<div class="gmt-gnss-frame" data-role="frame">` +
    platesHtml("heroes", blankPlates()) +
    `<div class="gmt-gnss-track gmt-leap-plot" data-role="plot" role="img" aria-label="">` +
    `<svg class="gmt-leap-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><polyline data-role="step-line" points="" fill="none" vector-effect="non-scaling-stroke"></polyline></svg>` +
    `<span class="gmt-gnss-span gmt-gnss-hatch gmt-leap-continuous" data-role="continuous-span" data-edge="dashed" style="--from: 100%; --to: 100%"></span>` +
    `<span class="gmt-gnss-span gmt-gnss-hatch" data-role="band" data-series="2" hidden></span>` +
    `<div class="gmt-leap-marks" data-role="marks"></div>` +
    `<span class="gmt-gnss-rule" data-role="pin" data-series="1" hidden></span>` +
    `</div>` +
    `<div class="gmt-leap-axis" data-role="axis" aria-hidden="true"></div>` +
    `<div class="gmt-gnss-flags" data-role="chips-insertions" aria-hidden="true"></div>` +
    `<div class="gmt-gnss-flags" data-role="chips-pin" aria-hidden="true"><span class="gmt-gnss-flag" data-role="pin-flag" hidden><span class="gmt-cutoff-chip" data-role="pin-chip"></span></span></div>` +
    `<div class="gmt-gnss-flags" data-role="chips-continuous" aria-hidden="true"><span class="gmt-gnss-flag" data-role="continuous-flag"><span class="gmt-cutoff-chip" data-role="continuous-chip">continuous UTC from ${escapeHtml(CONTINUOUS_UTC_FROM)}</span></span></div>` +
    `<ul class="gmt-leap-legend" aria-label="Legend">` +
    `<li class="gmt-cutoff-chip"><i class="gmt-cutoff-series-swatch" aria-hidden="true"></i>an inserted second</li>` +
    `<li class="gmt-cutoff-chip"><i class="gmt-cutoff-series-swatch" data-series="1" aria-hidden="true"></i>the date</li>` +
    `<li class="gmt-cutoff-chip"><i class="gmt-cutoff-series-swatch" data-series="2" aria-hidden="true"></i>counted between the two dates</li>` +
    `<li class="gmt-cutoff-chip"><i class="gmt-cutoff-series-swatch" data-series="3" aria-hidden="true"></i>your second 60</li>` +
    `</ul>` +
    `</div>` +
    `<ul class="gmt-gnss-visually-hidden" data-role="timeline-list"></ul>` +
    `<p class="gmt-gnss-visually-hidden" data-role="summary" aria-live="polite"></p>` +
    `<div class="gmt-gnss-table-box">` +
    `<table class="gmt-gnss-table" data-role="insertions-table">` +
    `<thead><tr><th scope="col">Inserted second</th><th scope="col">TAI − UTC after</th></tr></thead>` +
    `<tbody data-role="insertions-body"></tbody>` +
    `</table></div>` +
    `</div>` +
    // 3. The calls
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. What the library returns</h4>` +
    GROUPS.map(groupHtml).join("") +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): TimelineState;
  apply(state: TimelineState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

function setupWidget(root: HTMLElement, lib: TimescaleLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const presetEl = q<HTMLSelectElement>("preset")!;
  const dateEl = q<HTMLInputElement>("date")!;
  const checkEl = q<HTMLInputElement>("check")!;
  const fromEl = q<HTMLInputElement>("from")!;
  const toEl = q<HTMLInputElement>("to")!;
  const sliderEl = q<HTMLInputElement>("date-slider")!;

  const readState = (): TimelineState => ({
    date: dateEl.value,
    check: checkEl.value,
    from: fromEl.value,
    to: toEl.value,
  });

  function syncPreset(): void {
    const id = matchPreset(readState());
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        TIMELINE_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  /** The slider follows the reader's today, so its range is set on each draw. */
  function drawSlider(state: TimelineState, now: number): void {
    const max = sliderMax(now);
    sliderEl.max = String(max);
    const ends = root.querySelectorAll<HTMLElement>(
      ".gmt-range-field .gmt-range-ends > span",
    );
    if (ends[1]) ends[1].textContent = sliderDate(max).slice(0, 10);
    const position = sliderPosition(state.date, now);
    sliderEl.disabled = position === null;
    if (position === null) {
      syncRange(sliderEl, "no date");
      return;
    }
    sliderEl.value = String(position);
    syncRange(sliderEl, sliderDate(position).slice(0, 10));
  }

  function drawStepLine(read: TimelineRead, now: number): void {
    const line = q("step-line");
    if (!line) return;
    const { low, high } = offsetRange(read);
    const y = (v: number) =>
      Math.round((100 - ((v - low) / (high - low)) * 100) * 100) / 100;
    const points: string[] = [];
    let level = read.startOffset;
    if (level !== null) points.push(`0,${y(level)}`);
    for (const step of read.steps) {
      if (step.ms === null || step.offset === null || level === null) continue;
      const x = axisPercent(step.ms, now).pct;
      points.push(`${x},${y(level)}`, `${x},${y(step.offset)}`);
      level = step.offset;
    }
    if (level !== null) points.push(`100,${y(level)}`);
    line.setAttribute("points", points.join(" "));
  }

  function drawMarks(
    read: TimelineRead,
    counted: Set<string>,
    now: number,
  ): void {
    const marks = q("marks");
    const chips = q("chips-insertions");
    if (!marks || !chips) return;
    const { low, high } = offsetRange(read);
    let markHtml = "";
    let chipHtml = "";
    for (const step of read.steps) {
      if (step.ms === null || step.offset === null) continue;
      const at = axisPercent(step.ms, now).pct;
      const level =
        Math.round(((step.offset - low) / (high - low)) * 10000) / 100;
      const isChecked = read.check.insertion === step.insertion;
      const isCounted = counted.has(step.insertion);
      const series = isChecked ? 3 : isCounted ? 2 : 0;
      const lit = series === 0 ? "" : ` data-series="${series}" data-lit`;
      markHtml +=
        `<span class="gmt-cutoff-mark gmt-leap-mark${series === 0 ? " gmt-cutoff-mark--hollow" : ""}"${lit}` +
        ` data-insertion="${escapeAttr(step.insertion)}" style="--at: ${at}%; --level: ${level}%"></span>`;
      chipHtml +=
        `<span class="gmt-gnss-flag" style="--at: ${at}%">` +
        `<span class="gmt-cutoff-chip"${lit}>${escapeHtml(step.insertion.slice(0, 7))}</span></span>`;
    }
    marks.innerHTML = markHtml;
    chips.innerHTML = chipHtml;
  }

  function drawAxis(now: number): void {
    const axis = q("axis");
    if (!axis) return;
    axis.innerHTML = axisTicks(now)
      .map(
        (t) =>
          `<span class="gmt-leap-axis-tick" style="--at: ${t.pct}%">${t.year}</span>`,
      )
      .join("");
  }

  function drawPinAndBand(
    state: TimelineState,
    read: TimelineRead,
    now: number,
  ): void {
    const pin = q("pin");
    const flag = q("pin-flag");
    const chip = q("pin-chip");
    const ms = drawMs(state.date);
    const placed = ms === null ? null : axisPercent(ms, now);
    if (pin) {
      pin.hidden = placed === null;
      if (placed) pin.style.setProperty("--at", `${placed.pct}%`);
    }
    if (flag && chip) {
      flag.hidden = placed === null;
      if (placed) {
        flag.style.setProperty("--at", `${placed.pct}%`);
        const day = state.date.trim().slice(0, 10);
        chip.textContent =
          placed.beyond === null
            ? day
            : `${day} (${placed.beyond === "after" ? "past" : "before"} the axis)`;
      }
    }
    const band = q("band");
    if (band) {
      const a = drawMs(state.from);
      const b = drawMs(state.to);
      const show = read.between.count !== null && a !== null && b !== null;
      band.hidden = !show;
      if (show) {
        const pa = axisPercent(a, now).pct;
        const pb = axisPercent(b, now).pct;
        band.style.setProperty("--from", `${Math.min(pa, pb)}%`);
        band.style.setProperty("--to", `${Math.max(pa, pb)}%`);
      }
    }
    const span = q("continuous-span");
    const cflag = q("continuous-flag");
    const at = continuousPercent(now);
    span?.style.setProperty("--from", `${at}%`);
    span?.style.setProperty("--to", "100%");
    cflag?.style.setProperty("--at", `${at}%`);
  }

  function drawTable(read: TimelineRead, counted: Set<string>): void {
    const body = q("insertions-body");
    if (!body) return;
    body.innerHTML = read.steps
      .map((step) => {
        const isChecked = read.check.insertion === step.insertion;
        const isCounted = counted.has(step.insertion);
        const series = isChecked ? 3 : isCounted ? 2 : 0;
        const tag = isChecked ? "your second 60" : isCounted ? "counted" : "";
        return (
          `<tr${series === 0 ? "" : ` data-reading data-series="${series}"`}>` +
          `<th scope="row" data-label="Inserted second">${escapeHtml(step.insertion)}${tag === "" ? "" : ` <span class="gmt-cutoff-chip">${tag}</span>`}</th>` +
          `<td data-label="TAI − UTC after">${step.offset === null ? "no result" : `${step.offset} s`}</td>` +
          `</tr>`
        );
      })
      .join("");
  }

  function drawList(read: TimelineRead): void {
    const list = q("timeline-list");
    if (!list) return;
    list.innerHTML = read.steps
      .map(
        (s) =>
          `<li>${escapeHtml(s.insertion)}: TAI − UTC ${s.offset === null ? "no result" : `${s.offset} s`} after.</li>`,
      )
      .join("");
  }

  function drawGroup(
    id: "offset" | "between" | "check",
    calls: TimelineRead["offset"]["calls"],
    ok: boolean,
    reason: string,
  ): void {
    renderCalls(q(`call-${id}`), calls);
    const out = q(`${id}-output`);
    const aside = q(`${id}-aside`);
    if (out) {
      if (calls.length === 0) renderWidgetOutput(out, BLANK_TEXT, "empty");
      else if (!ok) renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(out, callResultsText(calls), "live");
    }
    if (aside) {
      if (calls.length > 0 && !ok && reason !== "") {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          `<p>${escapeHtml(reason)}</p>`,
        );
      } else aside.innerHTML = "";
    }
  }

  /** Chip rows are fitted against the measured width; the drawing is not redrawn. */
  function fit(): void {
    const axis = q("axis");
    if (axis) thinTickLabels(axis, ".gmt-leap-axis-tick");
    const chips = q("chips-insertions");
    if (chips) thinTickLabels(chips, ".gmt-gnss-flag");
    for (const role of ["chips-pin", "chips-continuous"]) {
      const row = q(role);
      const flag = row?.querySelector<HTMLElement>(".gmt-gnss-flag");
      const chip = flag?.querySelector<HTMLElement>(".gmt-cutoff-chip");
      if (!row || !flag || !chip) continue;
      flag.dataset["side"] = "start";
      const trackPx = row.clientWidth;
      if (trackPx === 0) continue;
      const atPx =
        (parseFloat(flag.style.getPropertyValue("--at")) / 100) * trackPx;
      if (atPx + layoutWidth(chip) > trackPx) flag.dataset["side"] = "end";
    }
  }

  function render(): void {
    const state = readState();
    const now = getUnixNow() ?? 0;
    const read = readTimeline(lib, state);
    const counted = new Set(read.between.counted);

    const heroes = q("heroes");
    if (heroes) heroes.innerHTML = timelinePlates(read).map(plateHtml).join("");
    drawSlider(state, now);
    drawStepLine(read, now);
    drawMarks(read, counted, now);
    drawAxis(now);
    drawPinAndBand(state, read, now);
    drawTable(read, counted);
    drawList(read);

    drawGroup(
      "offset",
      read.offset.calls,
      read.offset.offset !== null,
      read.offset.reason,
    );
    drawGroup(
      "between",
      read.between.calls,
      read.between.count !== null,
      read.between.reason,
    );
    drawGroup(
      "check",
      read.check.calls,
      read.check.verdict !== null,
      read.check.reason,
    );

    const text = summaryText(state, read);
    q("plot")?.setAttribute("aria-label", text);
    const summary = q("summary");
    if (summary) summary.textContent = text;
    fit();
  }

  function apply(state: TimelineState): void {
    setControlValue(dateEl, state.date);
    setControlValue(checkEl, state.check);
    setControlValue(fromEl, state.from);
    setControlValue(toEl, state.to);
  }

  function applyPreset(): void {
    const preset = TIMELINE_PRESETS.find((p) => p.id === presetEl.value);
    if (!preset) return;
    apply(presetState(preset));
    syncPreset();
    render();
  }

  root.addEventListener("input", (e) => {
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (role === "date-slider") {
      setControlValue(dateEl, sliderDate(Number(sliderEl.value)));
      syncPreset();
      render();
    } else if (
      role === "date" ||
      role === "check" ||
      role === "from" ||
      role === "to"
    ) {
      syncPreset();
      render();
    }
  });

  root.addEventListener("change", (e) => {
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (role === "preset") applyPreset();
  });

  wireCopyButtons(root);

  const frame = q<HTMLElement>("frame");
  const disposeWidth = frame ? onWidthChange(frame, fit) : () => {};

  syncPreset();
  render();

  return {
    readState,
    apply,
    render,
    syncPreset,
    release: disposeWidth,
  };
}

export const mountLeapSecondTimeline: MountFn<LeapSecondTimelineArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: TimescaleLib;
  try {
    lib = await loadTimescaleLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
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
