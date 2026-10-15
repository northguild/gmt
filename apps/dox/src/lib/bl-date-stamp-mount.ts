/**
 * The B/L Date Stamp widget (INT-14), mountable on its tool page and in the chat
 * rail.
 *
 * One moment has a different calendar date in each place, and a bill of lading
 * carries the local one. The reader types a moment, chooses the event and the
 * place, and the widget calls `bolTimestamp` for the place, for UTC (the naive
 * read) and for up to three other calendars. It draws the five dates as lanes of
 * local days on one time axis, with one gate line at the moment, and a native
 * range moves the moment in 15-minute steps across a 72-hour window.
 *
 * The window is set when a preset, a typed value or a zone settles, and never
 * while the slider moves, so the day columns do not slide under the pointer.
 * The slider writes the moment back in the form it was typed.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`, and the
 * ledger family's wiring: every listener is delegated on the root, so the host
 * dropping the subtree is a complete teardown apart from the width observer.
 * Every printed call and result is the real one; the drawing only places them.
 */
import { codeFrameHtml } from "./code-frame";
import {
  BL_DATE_PRESETS,
  CUSTOM_PRESET_ID,
  EVENT_OPTIONS,
  LANE_COUNT,
  SLIDER_MAX,
  blNullText,
  blPlates,
  blankPlates,
  isSeeded,
  laneAria,
  laneView,
  matchPreset,
  momentMs,
  momentText,
  permalinkOf,
  presetState,
  readArgs,
  readBlDate,
  sliderMoment,
  sliderPosition,
  sliderReadable,
  summaryText,
  utcClock,
  windowFor,
  type BlDateState,
  type BlDateStampArgs,
} from "./bl-date-stamp";
import { axisLabels, type LedgerCanvas } from "./dwell-ledger";
import { callResultsText, renderCalls } from "./edi-render";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { fitDayColumns, onWidthChange, thinTickLabels } from "./label-fit";
import { loadBlDateLib } from "./ledger-lib";
import type { BlDateLib } from "./ledger-lib";
import {
  descriptionHoldHtml,
  dayColumnFit,
  dayColumnsHtml,
  plateHtml,
  platesHtml,
  zoneWithOffsets,
} from "./ledger-widgets";
import {
  setPresetDescription,
  settledAnnouncer,
  writeLike,
} from "./punctuality-widgets";
import { zoneOptionsHtml } from "./transport-widgets";
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

export type { BlDateStampArgs } from "./bl-date-stamp";

/** The gate's chip sits to the left of the gate past this share of the track. */
const CHIP_FLIP_PERCENT = 55;

/**
 * `<option>`s for the event select. A selected value the list lacks (a seed the
 * form does not offer) is added as its own option, so it reaches the library as
 * given and is never silently replaced by one of the three.
 */
export function eventOptionsHtml(selected: string): string {
  const known = EVENT_OPTIONS.some((o) => o.value === selected);
  const list = known
    ? EVENT_OPTIONS
    : [
        ...EVENT_OPTIONS,
        { value: selected, label: selected === "" ? "not chosen" : selected },
      ];
  return list
    .map(
      (o) =>
        `<option value="${escapeAttr(o.value)}"${o.value === selected ? " selected" : ""}>${escapeHtml(o.label)}</option>`,
    )
    .join("");
}

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    BL_DATE_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function laneSkeletonHtml(index: number): string {
  const series = index >= 1 && index <= 4 ? ` data-series="${index}"` : "";
  const badge =
    index === 0
      ? ""
      : `<i class="gmt-bl-badge" aria-hidden="true">${index}</i>`;
  return (
    `<div class="gmt-ledger-lane gmt-bl-lane" role="listitem" data-role="lane-${index}" data-lane="${index}"${series}>` +
    `<span class="gmt-ledger-lane-label gmt-bl-lane-label">${badge}<span data-role="lane-label-${index}"></span></span>` +
    `<div class="gmt-ledger-lane-track" data-role="track-${index}">` +
    `<div class="gmt-ledger-days" data-role="cells-${index}" role="list" aria-label="Local days"></div>` +
    `<span class="gmt-cutoff-chip gmt-bl-note" data-role="note-${index}" hidden></span>` +
    `</div></div>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The lanes, the plates and the outputs are
 * drawn by `mount`, because they come from the real library calls.
 */
export function renderBlDateStampTemplate(args: BlDateStampArgs = {}): string {
  const state: BlDateState = isSeeded(args)
    ? readArgs(args)
    : presetState(BL_DATE_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = BL_DATE_PRESETS.find((p) => p.id === presetId);
  const lanes = Array.from({ length: LANE_COUNT }, (_, i) =>
    laneSkeletonHtml(i),
  ).join("");

  return (
    `<div class="gmt-bl-date-stamp gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. The moment and the place
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. Set the moment and the place</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select>` +
    `</label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      BL_DATE_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Moment")}` +
    `<input class="gmt-input" data-role="value" type="text" maxlength="64" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeAttr(state.value)}"></label>` +
    `<label class="gmt-label">${labelTextHtml("Event")}` +
    `<select class="gmt-select" data-role="event">${eventOptionsHtml(state.event)}</select>` +
    `</label>` +
    `<label class="gmt-label">${labelTextHtml("Place of the event")}` +
    `<select class="gmt-select" data-role="zone">${zoneOptionsHtml(zoneWithOffsets, state.timeZone, "No zone")}</select>` +
    `</label>` +
    [2, 3, 4]
      .map((n) => {
        const key = `zone${n}` as "zone2" | "zone3" | "zone4";
        return (
          `<label class="gmt-label">${labelTextHtml(`Calendar ${n}`, { optional: true })}` +
          `<select class="gmt-select" data-role="zone-${n}">${zoneOptionsHtml(zoneWithOffsets, state[key], "No zone")}</select>` +
          `</label>`
        );
      })
      .join("") +
    `<label class="gmt-label">${labelTextHtml("Latest date allowed", { optional: true })}` +
    `<input class="gmt-input" data-role="latest" type="date" value="${escapeAttr(state.latest)}"></label>` +
    `</div>` +
    `<p class="gmt-widget-hint">Every bill of lading date is the local one, so the place is required. The other calendars show the same moment's date elsewhere. The latest date is yours: the tool only compares against it.</p>` +
    `</div>` +
    // 2. The date in each place
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. The date in each place</h4>` +
    `<div class="gmt-ledger-frame" data-role="frame">` +
    platesHtml("heroes", blankPlates(state.event)) +
    `<div class="gmt-bl-plot" data-role="plot">` +
    `<div class="gmt-bl-lanes" role="list" aria-label="Calendars, one lane each">${lanes}</div>` +
    `<div class="gmt-bl-gate-layer" aria-hidden="true">` +
    `<div class="gmt-cutoff-gate" data-role="gate" hidden></div>` +
    `<span class="gmt-cutoff-chip gmt-bl-gate-chip" data-role="gate-chip" hidden></span>` +
    `</div>` +
    `</div>` +
    `<div class="gmt-ledger-axis" data-role="axis" aria-label="Time axis in UTC"><span></span><span></span><span></span></div>` +
    `<ul class="gmt-ledger-legend" aria-label="Legend">` +
    `<li class="gmt-cutoff-chip"><i class="gmt-ledger-swatch" data-state="lit" data-series="1" aria-hidden="true"></i>the day with the date</li>` +
    `<li class="gmt-cutoff-chip"><i class="gmt-ledger-swatch gmt-bl-swatch--utc" aria-hidden="true"></i>UTC, read naively</li>` +
    `<li class="gmt-cutoff-chip"><i class="gmt-bl-gate-key" aria-hidden="true"></i>the moment</li>` +
    `</ul>` +
    `</div>` +
    `<label class="gmt-label gmt-bl-slider">${labelTextHtml("Move the moment")}` +
    rangeFieldHtml({
      role: "moment-slider",
      chipRole: "moment-value",
      min: 0,
      max: SLIDER_MAX,
      step: 1,
      value: Math.floor(SLIDER_MAX / 2),
      valueText: "",
      ends: ["36 h earlier", "36 h later"],
    }) +
    `</label>` +
    `<p class="gmt-ledger-sr" data-role="summary" aria-live="polite"></p>` +
    `<div data-role="reason-aside" data-grow="slot"></div>` +
    `</div>` +
    // 3. What bolTimestamp returns
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. What <code>bolTimestamp</code> returns</h4>` +
    codeFrameHtml("bl") +
    `<output class="gmt-widget-output" data-role="bl-output">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): BlDateState;
  apply(state: BlDateState): void;
  render(recomputeWindow: boolean): void;
  syncPreset(): void;
  release(): void;
}

function setupWidget(root: HTMLElement, lib: BlDateLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const presetEl = q<HTMLSelectElement>("preset")!;
  const valueEl = q<HTMLInputElement>("value")!;
  const eventEl = q<HTMLSelectElement>("event")!;
  const zoneEl = q<HTMLSelectElement>("zone")!;
  const calendarEls = [2, 3, 4].map((n) => q<HTMLSelectElement>(`zone-${n}`)!);
  const latestEl = q<HTMLInputElement>("latest")!;
  const sliderEl = q<HTMLInputElement>("moment-slider")!;
  const announcer = settledAnnouncer(q("summary"));

  /** The window the day columns and the slider share. Set by `render(true)`. */
  let win: LedgerCanvas | null = null;
  /** A seeded latest date the native date input refused. The library judges it. */
  let refusedLatest = "";

  const readState = (): BlDateState => ({
    value: valueEl.value,
    event: eventEl.value,
    timeZone: zoneEl.value,
    zone2: calendarEls[0]!.value,
    zone3: calendarEls[1]!.value,
    zone4: calendarEls[2]!.value,
    latest: refusedLatest !== "" ? refusedLatest : latestEl.value,
  });

  function syncPreset(): void {
    const id = matchPreset(readState());
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        BL_DATE_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  function drawLanes(read: ReturnType<typeof readBlDate>, ms: number): void {
    const trackPx = q("track-1")?.clientWidth ?? 0;
    read.lanes.forEach((lane, i) => {
      const view = laneView(lane, win, ms);
      const el = q(`lane-${i}`);
      if (el) {
        el.setAttribute("aria-label", laneAria(lane));
        el.dataset["lit"] = view.lit ?? "";
      }
      const label = q(`lane-label-${i}`);
      if (label) label.textContent = view.label;
      const days = q(`cells-${i}`);
      if (days) {
        days.innerHTML =
          win === null ? "" : dayColumnsHtml(view.cells, win, view.marks);
        fitDayColumns(days, trackPx, dayColumnFit);
      }
      const note = q(`note-${i}`);
      if (note) {
        note.hidden = view.note === "";
        note.textContent = view.note;
      }
    });
  }

  function drawGate(ms: number): void {
    const gate = q("gate");
    const chip = q("gate-chip");
    if (!gate || !chip) return;
    if (win === null || Number.isNaN(ms)) {
      gate.hidden = true;
      chip.hidden = true;
      return;
    }
    const pct = Math.round(win.toPercent(ms) * 100) / 100;
    gate.hidden = false;
    gate.style.left = `${pct}%`;
    chip.hidden = false;
    chip.textContent = utcClock(ms);
    if (pct > CHIP_FLIP_PERCENT) {
      chip.style.left = "auto";
      chip.style.right = `calc(${100 - pct}% + 10px)`;
    } else {
      chip.style.right = "auto";
      chip.style.left = `calc(${pct}% + 10px)`;
    }
  }

  function drawSlider(
    state: BlDateState,
    ms: number,
    reposition: boolean,
  ): void {
    const usable = win !== null && sliderReadable(state.value);
    sliderEl.disabled = !usable;
    if (!usable || win === null) {
      syncRange(sliderEl, "no moment");
      return;
    }
    if (reposition) sliderEl.value = String(sliderPosition(win, ms));
    syncRange(sliderEl, momentText(ms));
  }

  /**
   * Reads the library and draws everything. The window is set only when
   * `recomputeWindow` is true (a preset, a typed value or a zone has settled);
   * a slider step, a width change and every other control keep it.
   */
  function render(recomputeWindow: boolean, settled = false): void {
    const s = readState();
    const read = readBlDate(s, lib);
    const ms = momentMs(s.value);
    if (recomputeWindow || win === null) {
      win = windowFor(ms, s.timeZone.trim());
    }

    const heroes = q("heroes");
    if (heroes) heroes.innerHTML = blPlates(s, read).map(plateHtml).join("");

    drawLanes(read, ms);
    drawGate(ms);
    drawSlider(s, ms, recomputeWindow);

    const axisEl = q("axis");
    if (axisEl) {
      const labels =
        win === null
          ? ["", "", ""]
          : axisLabels(win, "UTC").map((t) => (t === "" ? "" : `${t} UTC`));
      axisEl.querySelectorAll("span").forEach((span, i) => {
        span.textContent = labels[i] ?? "";
      });
      thinTickLabels(axisEl, "span");
    }

    // The calls made, and what they returned.
    renderCalls(q("call-bl"), read.calls);
    const out = q("bl-output");
    if (out) {
      if (read.bl === "") renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(out, callResultsText(read.calls), "live");
    }

    // Why the B/L date is missing, in one sentence the probe decided.
    const reason = read.bl === "" ? blNullText(s, lib) : "";
    const aside = q("reason-aside");
    if (aside) {
      if (reason !== "") {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          `<p>${escapeHtml(reason)}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }

    // The hidden sentence: right away for a typed change, after the slider has
    // been still for a moment for a drag, because the slider speaks each step.
    const summary = q("summary");
    if (summary) {
      const text = summaryText(s, read, reason);
      if (settled) announcer.say(() => text);
      else {
        announcer.cancel();
        summary.textContent = text;
      }
    }
  }

  function apply(state: BlDateState): void {
    setControlValue(valueEl, state.value);
    setEvent(state.event);
    setControlValue(zoneEl, state.timeZone);
    setControlValue(calendarEls[0]!, state.zone2);
    setControlValue(calendarEls[1]!, state.zone3);
    setControlValue(calendarEls[2]!, state.zone4);
    latestEl.value = state.latest;
    refusedLatest =
      state.latest !== "" && latestEl.value !== state.latest
        ? state.latest
        : "";
  }

  /** Set the event, adding a value the list lacks as its own option. */
  function setEvent(value: string): void {
    if (![...eventEl.options].some((o) => o.value === value)) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value === "" ? "not chosen" : value;
      eventEl.appendChild(opt);
    }
    eventEl.value = value;
  }

  function applyPreset(): void {
    const preset = BL_DATE_PRESETS.find((p) => p.id === presetEl.value);
    if (!preset) return;
    apply(presetState(preset));
    syncPreset();
    render(true);
  }

  function moveMoment(): void {
    if (win === null) return;
    const ms = sliderMoment(win, Number(sliderEl.value));
    const text = writeLike(valueEl.value.trim(), ms);
    if (text === "") return;
    setControlValue(valueEl, text);
    syncPreset();
    render(false, true);
  }

  root.addEventListener("input", (e) => {
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (role === "moment-slider") {
      moveMoment();
    } else if (role === "value") {
      syncPreset();
      render(true);
    } else if (role === "latest") {
      refusedLatest = "";
      syncPreset();
      render(false);
    }
  });

  root.addEventListener("change", (e) => {
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (role === "preset") {
      applyPreset();
    } else if (role === "value" || role === "zone") {
      syncPreset();
      render(true);
    } else if (role === "latest") {
      refusedLatest = "";
      syncPreset();
      render(false);
    } else if (role === "event" || /^zone-\d$/.test(role)) {
      syncPreset();
      render(false);
    }
  });

  wireCopyButtons(root);

  // The columns are fitted against the lane's measured width, so a width change
  // (rotation, the chat rail opening) fits them again. The window is kept.
  const plotEl = q<HTMLElement>("plot");
  const disposeWidth = plotEl
    ? onWidthChange(plotEl, () => render(false))
    : () => {};

  syncPreset();
  render(true);

  return {
    readState,
    apply,
    render,
    syncPreset,
    release: () => {
      announcer.cancel();
      disposeWidth();
    },
  };
}

export const mountBlDateStamp: MountFn<BlDateStampArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: BlDateLib;
  try {
    lib = await loadBlDateLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib);
  if (isSeeded(args)) {
    widget.apply(readArgs(args));
    widget.syncPreset();
    widget.render(true);
  }

  return onceDestroy(
    () => widget.release(),
    () => permalinkOf(widget.readState()),
  );
};
