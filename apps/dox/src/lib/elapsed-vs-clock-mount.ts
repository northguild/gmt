/**
 * The Elapsed vs. Clock Difference widget (MAR-16), mountable on its tool page
 * and in the chat rail.
 *
 * Two UTC readings, and two ways to subtract them. The clock difference counts
 * no inserted second; the seconds that passed, read through TAI, count every
 * one. Two rulers share one scale, the counted seconds mark both, and a hatched
 * sliver on the second ruler is the second the clock never counted. A native
 * range moves the end by day.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. Every
 * listener is delegated on the root, so the host dropping the subtree is a
 * complete teardown apart from the width observer. Every printed call and
 * result is the real one; the drawing only places them.
 */
import { getUnixNow } from "@northguild/gmt/unix/get";
import { codeFrameHtml } from "./code-frame";
import { renderCalls } from "./edi-render";
import { asideSizer, callSizer, holdHtml, outputSizer } from "./edi-picture";
import { NO_RESULT_TITLE } from "./edi-widgets";
import {
  BEFORE_1972_TEXT,
  CLOCK_REFUSES_TEXT,
  CUSTOM_PRESET_ID,
  ELAPSED_LINKS,
  ELAPSED_PRESETS,
  NOT_INSERTED_TEXT,
  NOT_INSTANT_TEXT,
  blankPlates,
  canDrawRulers,
  elapsedHandoffs,
  elapsedPlates,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readElapsed,
  resultsText,
  rulerMarks,
  summaryText,
  type ElapsedRead,
  type ElapsedState,
  type ElapsedVsClockArgs,
} from "./elapsed-vs-clock";
import { layoutWidth, onWidthChange, thinTickLabels } from "./label-fit";
import {
  drawMs,
  sliderDate,
  sliderMax,
  sliderPosition,
} from "./leap-second-timeline";
import { descriptionHoldHtml, plateHtml, platesHtml } from "./ledger-widgets";
import { setPresetDescription } from "./punctuality-widgets";
import type { TimescaleLib } from "./timescale-lib";
import { loadTimescaleLib } from "./timescale-lib";
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

export type { ElapsedVsClockArgs } from "./elapsed-vs-clock";

/** The text of an output with nothing to read: a blank field makes no call. */
const BLANK_TEXT = "Not read: the field is blank.";

/** The sentence of the list when the span holds no inserted second. */
const NONE_COUNTED_TEXT = "No second was inserted between these two.";
const NOT_READ_TEXT = "Not read: there is no count.";

const LONG = "2016-12-31T23:59:60.000000000+09:00";

/** The longest call each group prints, so its region holds one height. */
const CALL_SIZERS = {
  clock: `spanNs("${LONG}", "${LONG}")`,
  elapsed: `toTAI("${LONG}")\ntoTAI("${LONG}")\nspanNs("2017-01-01T00:00:36Z", "2017-01-01T00:00:37Z")`,
  count: `leapSecondsBetween("${LONG}", "${LONG}")`,
} as const;

const OUTPUT_SIZERS = {
  clock: "-757382400000000000n",
  elapsed:
    '"2017-01-01T00:00:36 TAI"\n"2017-01-01T00:00:37 TAI"\n-757382405000000000n',
  count: "-27",
} as const;

const GROUPS = [
  { id: "clock", heading: "Clock difference", calls: "spanNs" },
  {
    id: "elapsed",
    heading: "Seconds that passed",
    calls: "toTAI, spanNs",
  },
  { id: "count", heading: "Leap seconds between", calls: "leapSecondsBetween" },
] as const;

type GroupId = (typeof GROUPS)[number]["id"];

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    ELAPSED_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function groupHtml(g: (typeof GROUPS)[number]): string {
  const live = codeFrameHtml(g.id);
  return (
    `<div class="gmt-elapsed-group">` +
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
          CLOCK_REFUSES_TEXT,
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

function rulerHtml(
  id: "clock" | "elapsed",
  name: string,
  series: 1 | 2,
): string {
  return (
    `<div class="gmt-gnss-ruler-row">` +
    `<span class="gmt-gnss-label">${escapeHtml(name)}</span>` +
    `<div class="gmt-elapsed-ruler">` +
    `<div class="gmt-gnss-track" data-role="track-${id}">` +
    `<span class="gmt-gnss-span" data-role="span-${id}" data-series="${series}" hidden></span>` +
    `<div class="gmt-elapsed-marks" data-role="marks-${id}"></div>` +
    `</div>` +
    `<div class="gmt-gnss-flags" data-role="chips-${id}" aria-hidden="true"></div>` +
    `</div></div>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The plates, the drawing and the list are
 * drawn by `mount`, because they come from the real library calls.
 */
export function renderElapsedVsClockTemplate(
  args: ElapsedVsClockArgs = {},
): string {
  const state: ElapsedState = isSeeded(args)
    ? readArgs(args)
    : presetState(ELAPSED_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = ELAPSED_PRESETS.find((p) => p.id === presetId);

  return (
    `<div class="gmt-elapsed-vs-clock gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. The two readings
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. Set a start and an end</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      ELAPSED_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label">${labelTextHtml("Start")}` +
    `<input class="gmt-input" data-role="start" type="text" maxlength="64" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeAttr(state.start)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("End")}` +
    `<input class="gmt-input" data-role="end" type="text" maxlength="64" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeAttr(state.end)}"></label>` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Move the end")}` +
    rangeFieldHtml({
      role: "end-slider",
      chipRole: "end-value",
      min: 0,
      max: 1,
      step: 1,
      value: 0,
      valueText: "",
      ends: [INTEGER_UTC_FROM.slice(0, 10), "latest"],
    }) +
    `</label>` +
    `</div>` +
    `<p class="gmt-widget-hint">Both are UTC instants. A <code>23:59:60</code> is allowed on a day when a second was inserted.</p>` +
    `</div>` +
    // 2. The two rulers
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. The same span, counted two ways</h4>` +
    `<div class="gmt-gnss-frame" data-role="frame">` +
    platesHtml("heroes", blankPlates()) +
    `<div class="gmt-gnss-ruler" data-role="rulers" role="img" aria-label="">` +
    rulerHtml("clock", "UTC clock", 2) +
    rulerHtml("elapsed", "Elapsed", 1) +
    `<div class="gmt-gnss-ruler-row"><span class="gmt-gnss-label" aria-hidden="true"></span>` +
    `<div class="gmt-elapsed-ends" aria-hidden="true"><span data-role="ends-low"></span><span data-role="ends-high"></span></div></div>` +
    `</div>` +
    `<ul class="gmt-elapsed-legend" aria-label="Legend">` +
    `<li class="gmt-cutoff-chip"><i class="gmt-cutoff-series-swatch" data-series="2" aria-hidden="true"></i>the clock difference</li>` +
    `<li class="gmt-cutoff-chip"><i class="gmt-cutoff-series-swatch" data-series="1" aria-hidden="true"></i>the seconds that passed</li>` +
    `<li class="gmt-cutoff-chip"><i class="gmt-cutoff-series-swatch" aria-hidden="true"></i>an inserted second</li>` +
    `</ul>` +
    `</div>` +
    `<p class="gmt-gnss-visually-hidden" data-role="summary" aria-live="polite"></p>` +
    `<h5 class="gmt-elapsed-list-title">The seconds inserted between the two</h5>` +
    `<ul class="gmt-elapsed-list" data-role="insertions-list" tabindex="0" aria-label="Seconds inserted between the two"></ul>` +
    `</div>` +
    // 3. The calls
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. What the library returns</h4>` +
    GROUPS.map(groupHtml).join("") +
    toolLinksHtml(ELAPSED_LINKS) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): ElapsedState;
  apply(state: ElapsedState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

function setupWidget(root: HTMLElement, lib: TimescaleLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const presetEl = q<HTMLSelectElement>("preset")!;
  const startEl = q<HTMLInputElement>("start")!;
  const endEl = q<HTMLInputElement>("end")!;
  const sliderEl = q<HTMLInputElement>("end-slider")!;

  const readState = (): ElapsedState => ({
    start: startEl.value,
    end: endEl.value,
  });

  function syncPreset(): void {
    const id = matchPreset(readState());
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        ELAPSED_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  /** The slider follows the reader's today, so its range is set on each draw. */
  function drawSlider(state: ElapsedState, now: number): void {
    const max = sliderMax(now);
    sliderEl.max = String(max);
    const ends = root.querySelectorAll<HTMLElement>(
      ".gmt-range-field .gmt-range-ends > span",
    );
    if (ends[1]) ends[1].textContent = sliderDate(max).slice(0, 10);
    const position = sliderPosition(state.end, now);
    sliderEl.disabled = position === null;
    if (position === null) {
      syncRange(sliderEl, "no end");
      return;
    }
    sliderEl.value = String(position);
    syncRange(sliderEl, sliderDate(position).slice(0, 10));
  }

  function drawRulers(state: ElapsedState, read: ElapsedRead): void {
    const placed = canDrawRulers(state);
    const marks =
      placed && read.count !== null ? rulerMarks(lib, state, read) : [];
    for (const id of ["clock", "elapsed"] as const) {
      const span = q(`span-${id}`);
      const lit = id === "clock" ? read.clock !== null : read.elapsed !== null;
      if (span) {
        span.hidden = !(placed && lit);
        span.style.setProperty("--from", "0%");
        span.style.setProperty("--to", "100%");
      }
      const markEl = q(`marks-${id}`);
      if (markEl) {
        markEl.innerHTML = marks
          .map((m) =>
            id === "clock"
              ? `<span class="gmt-cutoff-mark" data-insertion="${escapeAttr(m.insertion)}" style="--at: ${m.pct}%"></span>`
              : `<span class="gmt-gnss-sliver gmt-gnss-hatch" data-series="1" data-insertion="${escapeAttr(m.insertion)}" style="--at: ${m.pct}%"></span>`,
          )
          .join("");
      }
      const chips = q(`chips-${id}`);
      if (chips) {
        chips.innerHTML = marks
          .map(
            (m) =>
              `<span class="gmt-gnss-flag" style="--at: ${m.pct}%"><span class="gmt-cutoff-chip">${id === "clock" ? escapeHtml(m.insertion.slice(0, 7)) : "+1 s"}</span></span>`,
          )
          .join("");
      }
    }
    const a = drawMs(state.start);
    const b = drawMs(state.end);
    const low = q("ends-low");
    const high = q("ends-high");
    if (low && high) {
      if (a === null || b === null) {
        low.textContent = "";
        high.textContent = "";
      } else {
        const first = a <= b ? state.start : state.end;
        const second = a <= b ? state.end : state.start;
        low.textContent = first.trim().slice(0, 10);
        high.textContent = second.trim().slice(0, 10);
      }
    }
  }

  function drawList(read: ElapsedRead): void {
    const list = q("insertions-list");
    if (!list) return;
    if (read.count === null) {
      list.innerHTML = `<li class="gmt-elapsed-list-note">${NOT_READ_TEXT}</li>`;
    } else if (read.counted.length === 0) {
      list.innerHTML = `<li class="gmt-elapsed-list-note">${NONE_COUNTED_TEXT}</li>`;
    } else {
      list.innerHTML = read.counted
        .map((s) => `<li><code>${escapeHtml(s)}</code></li>`)
        .join("");
    }
  }

  function drawGroup(
    id: GroupId,
    calls: ElapsedRead["clockCalls"],
    ok: boolean,
    reason: string,
  ): void {
    renderCalls(q(`call-${id}`), calls);
    const out = q(`${id}-output`);
    const aside = q(`${id}-aside`);
    if (out) {
      if (calls.length === 0) renderWidgetOutput(out, BLANK_TEXT, "empty");
      else if (!ok) renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(out, resultsText(calls), "live");
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
    for (const id of ["clock", "elapsed"]) {
      const row = q(`chips-${id}`);
      if (!row) continue;
      for (const flag of row.querySelectorAll<HTMLElement>(".gmt-gnss-flag")) {
        flag.dataset["side"] = "mid";
      }
      thinTickLabels(row, ".gmt-gnss-flag");
      // A chip at either end would leave the row, so it hangs inward.
      const trackPx = row.clientWidth;
      if (trackPx === 0) continue;
      for (const flag of row.querySelectorAll<HTMLElement>(".gmt-gnss-flag")) {
        const chip = flag.querySelector<HTMLElement>(".gmt-cutoff-chip");
        if (!chip) continue;
        const atPx =
          (parseFloat(flag.style.getPropertyValue("--at")) / 100) * trackPx;
        const half = layoutWidth(chip) / 2;
        flag.dataset["side"] =
          atPx - half < 0 ? "start" : atPx + half > trackPx ? "end" : "mid";
      }
    }
  }

  function render(): void {
    const state = readState();
    const now = getUnixNow() ?? 0;
    const read = readElapsed(lib, state);

    const heroes = q("heroes");
    if (heroes) {
      heroes.innerHTML = elapsedPlates(read, state).map(plateHtml).join("");
    }
    drawSlider(state, now);
    drawRulers(state, read);
    drawList(read);

    drawGroup("clock", read.clockCalls, read.clock !== null, read.clockReason);
    drawGroup(
      "elapsed",
      read.elapsedCalls,
      read.elapsed !== null,
      read.elapsedReason,
    );
    drawGroup("count", read.countCalls, read.count !== null, read.countReason);

    const handoffs = elapsedHandoffs(state, read);
    setToolLink(q("link-timeline"), handoffHref(handoffs.timeline));
    setToolLink(q("link-clocks"), handoffHref(handoffs.clocks));

    const text = summaryText(state, read);
    q("rulers")?.setAttribute("aria-label", text);
    const summary = q("summary");
    if (summary) summary.textContent = text;
    fit();
  }

  function apply(state: ElapsedState): void {
    setControlValue(startEl, state.start);
    setControlValue(endEl, state.end);
  }

  function applyPreset(): void {
    const preset = ELAPSED_PRESETS.find((p) => p.id === presetEl.value);
    if (!preset) return;
    apply(presetState(preset));
    syncPreset();
    render();
  }

  root.addEventListener("input", (e) => {
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (role === "end-slider") {
      setControlValue(endEl, sliderDate(Number(sliderEl.value)));
      syncPreset();
      render();
    } else if (role === "start" || role === "end") {
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

export const mountElapsedVsClock: MountFn<ElapsedVsClockArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: TimescaleLib;
  try {
    lib = await loadTimescaleLib();
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
