/**
 * The Demurrage Clock widget (INT-14), mountable on its tool page and in the
 * chat rail.
 *
 * Which two events bound each clock. The reader lists a container's events, and
 * the widget calls `demurrageClock` once for each of the four clocks (demurrage,
 * detention, storage, combined) and draws the four intervals as half-open bars
 * under one rail of events, over the terminal's local days. The chosen clock
 * is lit and the other three are dimmed. The pair each clock runs between is
 * read from the library (`clockPair`), never from a table.
 *
 * The terminal clock is a display zone. It sets the day columns and the local
 * times, and it is not an argument of `demurrageClock`; the widget says so
 * beside the control.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`, and the
 * ledger family's wiring: every listener is delegated on the root, so the host
 * dropping the subtree is a complete teardown apart from the width observer.
 * Every printed call and result is the real one; the drawing only places them.
 */
import { codeFrameHtml } from "./code-frame";
import {
  CLOCK_DIRECTIONS,
  CLOCK_EVENT_TYPES,
  CLOCK_SCOPES,
  CLOCK_START_EVENTS,
  CUSTOM_PRESET_ID,
  DEMURRAGE_PRESETS,
  MAX_EVENTS,
  blankPlates,
  clockPlates,
  eventMarks,
  freeTimeArgs,
  freeTimeHint,
  isSeeded,
  laneAria,
  laneLabel,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readClocks,
  summaryText,
  zoneLabel,
  zoneReadable,
  type ClockRead,
  type DemurrageClockArgs,
  type DemurrageState,
  type EventMark,
  type LaneRead,
} from "./demurrage-clock";
import {
  axisLabels,
  createLedgerCanvas,
  dayCells,
  fitLedgerCanvas,
  toEpochMs,
  type LedgerCanvas,
} from "./dwell-ledger";
import { callResultsText, renderCalls } from "./edi-render";
import { NO_RESULT_TITLE } from "./edi-widgets";
import {
  fitDayColumns,
  layoutWidth,
  onWidthChange,
  thinTickLabels,
} from "./label-fit";
import { loadDemurrageLib } from "./ledger-lib";
import type { DemurrageLib } from "./ledger-lib";
import {
  descriptionHoldHtml,
  dayColumnFit,
  dayColumnsHtml,
  plateHtml,
  platesHtml,
} from "./ledger-widgets";
import {
  placeLabels,
  setPresetDescription,
  type LabelBox,
} from "./punctuality-widgets";
import { TRANSPORT_ZONES, zoneOptionsHtml } from "./transport-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { encodeWidgetPermalink } from "./widget-permalink";
import {
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  renderAside,
  renderWidgetOutput,
  setControlValue,
  wireCopyButtons,
} from "./widget-ui";

export type { DemurrageClockArgs } from "./demurrage-clock";

/** The size of an event's diamond, for the label placer (px). */
const MARK_PX = 14;

interface Option {
  value: string;
  label: string;
}

/**
 * `<option>`s for a select. A selected value the list lacks (a seed the form
 * does not offer, or a blank where a choice is needed) is added as its own
 * option, so it reaches the library as given and is never silently replaced.
 */
export function selectOptionsHtml(
  options: readonly Option[],
  selected: string,
  blankLabel?: string,
): string {
  const known = options.some((o) => o.value === selected);
  const blank =
    blankLabel === undefined
      ? ""
      : `<option value=""${selected === "" ? " selected" : ""}>${escapeHtml(blankLabel)}</option>`;
  // A value the list lacks is its own option. A blank where a choice is needed
  // reads "not chosen"; where a blank is a choice, the blank option above is it.
  const missing: Option[] =
    known || (selected === "" && blankLabel !== undefined)
      ? []
      : [{ value: selected, label: selected === "" ? "not chosen" : selected }];
  const list =
    selected === "" ? [...missing, ...options] : [...options, ...missing];
  return (
    blank +
    list
      .map(
        (o) =>
          `<option value="${escapeAttr(o.value)}"${o.value === selected ? " selected" : ""}>${escapeHtml(o.label)}</option>`,
      )
      .join("")
  );
}

const plain = (values: readonly string[]): Option[] =>
  values.map((value) => ({ value, label: value }));

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    DEMURRAGE_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function eventRowHtml(n: number, row: { type: string; at: string }): string {
  return (
    `<div class="gmt-field-grid gmt-dem-row" data-role="row-${n}">` +
    `<label class="gmt-label">${labelTextHtml(`Event ${n}`)}` +
    `<select class="gmt-select" data-role="type-${n}">${selectOptionsHtml(plain(CLOCK_EVENT_TYPES), row.type, "No event")}</select>` +
    `</label>` +
    `<label class="gmt-label">${labelTextHtml(`Instant ${n}`)}` +
    `<input class="gmt-input" data-role="at-${n}" type="text" maxlength="64" spellcheck="false" autocomplete="off" autocapitalize="off" value="${escapeAttr(row.at)}"></label>` +
    `</div>`
  );
}

function laneSkeletonHtml(scope: string, index: number): string {
  const n = index + 1;
  return (
    `<div class="gmt-dem-lane" role="listitem" data-role="lane-${n}" data-scope="${escapeAttr(scope)}" data-series="${n}" data-chosen="false">` +
    `<span class="gmt-cutoff-chip gmt-dem-lane-label" data-role="lane-label-${n}">${escapeHtml(scope)}</span>` +
    `<div class="gmt-ledger-bar gmt-dem-bar" data-role="bar-${n}" hidden></div>` +
    `<span class="gmt-cutoff-chip gmt-dem-lane-why" data-role="why-${n}" hidden></span>` +
    `</div>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The rail, the lanes' bars and the outputs are
 * drawn by `mount`, because they come from the real library calls.
 */
export function renderDemurrageClockTemplate(
  args: DemurrageClockArgs = {},
): string {
  const state: DemurrageState = isSeeded(args)
    ? readArgs(args)
    : presetState(DEMURRAGE_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = DEMURRAGE_PRESETS.find((p) => p.id === presetId);
  const rows = state.rows
    .slice(0, MAX_EVENTS)
    .map((row, i) => eventRowHtml(i + 1, row))
    .join("");

  return (
    `<div class="gmt-demurrage-clock gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. The events and the options
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. Set the events and the options</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select>` +
    `</label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      DEMURRAGE_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label">${labelTextHtml("Clock")}` +
    `<select class="gmt-select" data-role="scope">${selectOptionsHtml(plain(CLOCK_SCOPES), state.scope)}</select>` +
    `</label>` +
    `<label class="gmt-label">${labelTextHtml("Direction")}` +
    `<select class="gmt-select" data-role="direction">${selectOptionsHtml(plain(CLOCK_DIRECTIONS), state.direction)}</select>` +
    `</label>` +
    `<label class="gmt-label">${labelTextHtml("Start event", { optional: true })}` +
    `<select class="gmt-select" data-role="start-event">${selectOptionsHtml(plain(CLOCK_START_EVENTS), state.startEvent, "not given")}</select>` +
    `</label>` +
    `<label class="gmt-label">${labelTextHtml("Terminal clock")}` +
    `<select class="gmt-select" data-role="zone">${zoneOptionsHtml(TRANSPORT_ZONES, state.zone, "UTC (no zone)")}</select>` +
    `</label>` +
    `</div>` +
    `<p class="gmt-widget-hint">The terminal clock is a display zone. It sets the day columns and the local times. It is not an argument of <code>demurrageClock</code>, so it never changes an interval.</p>` +
    `<fieldset class="gmt-dem-events"><legend>Events</legend>${rows}</fieldset>` +
    `</div>` +
    // 2. Which events bound each clock
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. Which events bound each clock</h4>` +
    `<div class="gmt-ledger-frame" data-role="frame">` +
    platesHtml("heroes", blankPlates(state.scope)) +
    `<div class="gmt-ledger-lane gmt-dem-plot" data-role="plot">` +
    `<span class="gmt-ledger-lane-label" data-role="label"></span>` +
    `<div class="gmt-ledger-lane-track gmt-dem-track" data-role="track" role="group" aria-label="Events and the four clocks over the terminal's local days">` +
    `<div class="gmt-ledger-days" data-role="cells" role="list" aria-label="Local days"></div>` +
    `<div class="gmt-dem-rail" data-role="rail" role="list" aria-label="Events"></div>` +
    `<div class="gmt-dem-lanes" data-role="lanes" role="list" aria-label="Clocks">` +
    CLOCK_SCOPES.map(laneSkeletonHtml).join("") +
    `</div>` +
    `<p class="gmt-dem-empty" data-role="plot-empty" hidden></p>` +
    `</div></div>` +
    `<div class="gmt-ledger-axis" data-role="axis"><span></span><span></span><span></span></div>` +
    `<ul class="gmt-ledger-legend" aria-label="Legend">` +
    `<li class="gmt-cutoff-chip"><i class="gmt-cutoff-mark gmt-dem-diamond gmt-dem-diamond--key" aria-hidden="true"></i>event</li>` +
    `<li class="gmt-cutoff-chip"><i class="gmt-ledger-swatch" data-state="lit" data-series="1" aria-hidden="true"></i>chosen clock</li>` +
    `<li class="gmt-cutoff-chip"><i class="gmt-ledger-swatch gmt-dem-swatch--dim" data-state="lit" data-series="1" aria-hidden="true"></i>other clocks, dimmed</li>` +
    `</ul>` +
    `</div>` +
    `<p class="gmt-ledger-sr" data-role="summary" aria-live="polite"></p>` +
    `<div data-role="reason-aside" data-grow="slot"></div>` +
    `<div class="gmt-widget-controls"><a class="gmt-button gmt-button--pad" data-role="handoff" aria-disabled="true">Count the days in the Free Time Ledger</a></div>` +
    `<p class="gmt-widget-hint" data-role="handoff-hint"></p>` +
    `</div>` +
    // 3. What demurrageClock returns
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. What <code>demurrageClock</code> returns</h4>` +
    codeFrameHtml("clock") +
    `<output class="gmt-widget-output" data-role="clock-output">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): DemurrageState;
  apply(state: DemurrageState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

function setupWidget(root: HTMLElement, lib: DemurrageLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const rowNumbers = Array.from({ length: MAX_EVENTS }, (_, i) => i + 1);
  const typeEls = rowNumbers.map((n) => q<HTMLSelectElement>(`type-${n}`)!);
  const atEls = rowNumbers.map((n) => q<HTMLInputElement>(`at-${n}`)!);
  const presetEl = q<HTMLSelectElement>("preset")!;
  const scopeEl = q<HTMLSelectElement>("scope")!;
  const directionEl = q<HTMLSelectElement>("direction")!;
  const startEventEl = q<HTMLSelectElement>("start-event")!;
  const zoneEl = q<HTMLSelectElement>("zone")!;

  const readState = (): DemurrageState => ({
    rows: rowNumbers.map((_, i) => ({
      type: typeEls[i]!.value,
      at: atEls[i]!.value,
    })),
    scope: scopeEl.value,
    direction: directionEl.value,
    startEvent: startEventEl.value,
    zone: zoneEl.value,
  });

  function syncPreset(): void {
    const id = matchPreset(readState());
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        DEMURRAGE_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  /** The canvas: every event the rail can draw, with a margin, out to the terminal's local midnights. */
  function canvasFor(
    marks: readonly EventMark[],
    state: DemurrageState,
  ): LedgerCanvas | null {
    if (marks.length === 0) return null;
    const ms = marks.map((m) => m.ms);
    const zones = zoneReadable(state.zone) ? [zoneLabel(state.zone)] : [];
    return (
      fitLedgerCanvas(Math.min(...ms), Math.max(...ms), zones) ??
      createLedgerCanvas(Math.min(...ms), Math.max(...ms) + 1)
    );
  }

  function drawLane(
    lane: LaneRead,
    index: number,
    chosen: boolean,
    canvas: LedgerCanvas | null,
    zone: string,
  ): void {
    const n = index + 1;
    const el = q(`lane-${n}`);
    if (!el) return;
    el.dataset["chosen"] = chosen ? "true" : "false";
    el.setAttribute("aria-label", laneAria(lane, zone));
    const label = q(`lane-label-${n}`);
    if (label) label.textContent = laneLabel(lane.scope, lane.pair);
    const bar = q(`bar-${n}`);
    if (bar) {
      if (lane.interval === null || canvas === null) {
        bar.hidden = true;
      } else {
        const left = canvas.toPercent(toEpochMs(lane.interval.start));
        const right = canvas.toPercent(toEpochMs(lane.interval.end));
        bar.hidden = false;
        bar.style.left = `${left}%`;
        bar.style.width = `${Math.max(0, right - left)}%`;
      }
    }
    const why = q(`why-${n}`);
    if (why) {
      why.hidden = lane.interval !== null;
      why.textContent =
        lane.interval === null ? (lane.reason?.lane ?? "no result") : "";
    }
  }

  /** Place each event's chip so no chip covers another or a diamond. */
  function placeChips(): void {
    const rail = q("rail");
    if (!rail) return;
    const w = rail.clientWidth;
    const h = rail.clientHeight;
    if (w === 0 || h === 0) return;
    const chips = [
      ...rail.querySelectorAll<HTMLElement>(".gmt-dem-event-chip"),
    ];
    const boxes: LabelBox[] = chips.map((el) => ({
      x: (Number(el.dataset["x"] ?? 0) / 100) * w,
      y: h - MARK_PX,
      w: layoutWidth(el),
      h: el.offsetHeight,
    }));
    placeLabels(boxes, w, h, { markPx: MARK_PX }).forEach((p, i) => {
      const el = chips[i]!;
      const box = boxes[i]!;
      // When nothing is clear the placer falls back to its first choice, which
      // may hang past the rail; a chip always stays inside it.
      el.style.left = `${Math.max(0, Math.min(p.left, w - box.w))}px`;
      el.style.top = `${Math.max(0, Math.min(p.top, h - box.h))}px`;
      el.classList.add("gmt-dem-event-chip--placed");
    });
  }

  function drawRail(
    marks: readonly EventMark[],
    canvas: LedgerCanvas | null,
    zone: string,
  ): void {
    const rail = q("rail");
    if (!rail) return;
    rail.innerHTML =
      canvas === null
        ? ""
        : marks
            .map((m) => {
              const pct = Math.round(canvas.toPercent(m.ms) * 100) / 100;
              const aria = `${m.word}, ${m.local === "" ? m.at : m.local} on the ${zone} clock`;
              return (
                `<div class="gmt-dem-event" role="listitem" data-n="${m.n}" data-type="${escapeAttr(m.type)}" aria-label="${escapeAttr(aria)}">` +
                `<i class="gmt-cutoff-mark gmt-dem-diamond" aria-hidden="true" style="left:${pct}%"></i>` +
                `<span class="gmt-cutoff-chip gmt-dem-event-chip" aria-hidden="true" data-x="${pct}" style="left:calc(${pct}% + 12px)">` +
                `<span class="gmt-dem-word">${escapeHtml(m.word)}</span>` +
                (m.local === ""
                  ? ""
                  : `<span class="gmt-dem-time">${escapeHtml(m.local)}</span>`) +
                `</span></div>`
              );
            })
            .join("");
    placeChips();
  }

  function drawDays(
    canvas: LedgerCanvas | null,
    marks: readonly EventMark[],
    state: DemurrageState,
  ): void {
    const days = q("cells");
    const label = q("label");
    const readable = zoneReadable(state.zone);
    if (label)
      label.textContent = readable ? zoneLabel(state.zone) : "zone not read";
    if (!days) return;
    if (canvas === null || !readable) {
      days.innerHTML = "";
      return;
    }
    const ms = marks.map((m) => m.ms);
    const cells = dayCells(
      canvas,
      zoneLabel(state.zone),
      Math.min(...ms),
      Math.max(...ms),
    );
    days.innerHTML = dayColumnsHtml(cells, canvas, {});
    fitDayColumns(days, q("track")?.clientWidth ?? 0, dayColumnFit);
  }

  function render(): void {
    const s = readState();
    const read: ClockRead = readClocks(s, lib);
    const marks = eventMarks(s, lib);
    const canvas = canvasFor(marks, s);
    const zone = zoneLabel(s.zone);

    // The plates, for the chosen clock.
    const heroes = q("heroes");
    if (heroes)
      heroes.innerHTML = clockPlates(read, s.zone).map(plateHtml).join("");

    // The chart: days, rail, lanes.
    drawDays(canvas, marks, s);
    drawRail(marks, canvas, zone);
    read.lanes.forEach((lane, i) =>
      drawLane(lane, i, lane === read.chosen, canvas, s.zone),
    );
    const empty = q("plot-empty");
    if (empty) {
      empty.hidden = canvas !== null;
      empty.textContent =
        canvas === null
          ? "Add an event with an instant to draw the clocks."
          : "";
    }
    const axisEl = q("axis");
    if (axisEl) {
      const spans = axisEl.querySelectorAll("span");
      const labels =
        canvas !== null && zoneReadable(s.zone)
          ? axisLabels(canvas, zone)
          : ["", "", ""];
      spans.forEach((span, i) => {
        span.textContent = labels[i] ?? "";
      });
      thinTickLabels(axisEl, "span");
    }

    // The calls made, and what they returned.
    renderCalls(q("call-clock"), read.calls);
    const out = q("clock-output");
    if (out) {
      if (read.chosen.interval === null) {
        renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      } else {
        renderWidgetOutput(out, callResultsText(read.calls), "live");
      }
    }

    // The sentence for a screen reader, and why a clock is null.
    const summary = q("summary");
    if (summary) summary.textContent = summaryText(read, s.zone);
    const aside = q("reason-aside");
    if (aside) {
      if (read.chosen.interval === null && read.chosen.reason !== null) {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          `<p>${escapeHtml(read.chosen.reason.sentence)}</p>`,
        );
      } else if (read.chosen.interval === null) {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          `<p>${escapeHtml("The library returned no interval for these events and options.")}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }

    // The hand-off to the Free Time Ledger.
    const link = q<HTMLAnchorElement>("handoff");
    const hint = q("handoff-hint");
    const handoff = freeTimeArgs(read, s);
    if (link) {
      if (handoff) {
        link.setAttribute("href", encodeWidgetPermalink("freetime", handoff));
        link.removeAttribute("aria-disabled");
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
      }
    }
    if (hint) hint.textContent = freeTimeHint(read);
  }

  function apply(state: DemurrageState): void {
    state.rows.slice(0, MAX_EVENTS).forEach((row, i) => {
      setSelect(typeEls[i]!, row.type, "No event");
      setControlValue(atEls[i]!, row.at);
    });
    setSelect(scopeEl, state.scope);
    setSelect(directionEl, state.direction);
    setSelect(startEventEl, state.startEvent, "not given");
    setSelect(zoneEl, state.zone, "UTC (no zone)");
  }

  /** Set a select's value, adding the value as an option when the list lacks it. */
  function setSelect(
    el: HTMLSelectElement,
    value: string,
    blank?: string,
  ): void {
    if (![...el.options].some((o) => o.value === value)) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value === "" ? (blank ?? "not chosen") : value;
      el.appendChild(opt);
    }
    setControlValue(el, value);
  }

  function applyPreset(): void {
    const preset = DEMURRAGE_PRESETS.find((p) => p.id === presetEl.value);
    if (!preset) return;
    apply(presetState(preset));
    syncPreset();
    render();
  }

  root.addEventListener("input", (e) => {
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (!/^at-\d$/.test(role)) return;
    syncPreset();
    render();
  });

  root.addEventListener("change", (e) => {
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (role === "preset") {
      applyPreset();
      return;
    }
    if (
      /^type-\d$/.test(role) ||
      /^at-\d$/.test(role) ||
      role === "scope" ||
      role === "direction" ||
      role === "start-event" ||
      role === "zone"
    ) {
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);

  // The chips are placed against the rail's measured width, so a width change
  // (rotation, the chat rail opening) places them again.
  const trackEl = q<HTMLElement>("track");
  const disposeWidth = trackEl ? onWidthChange(trackEl, render) : () => {};

  syncPreset();
  render();

  return { readState, apply, render, syncPreset, release: disposeWidth };
}

export const mountDemurrageClock: MountFn<DemurrageClockArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: DemurrageLib;
  try {
    lib = await loadDemurrageLib();
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
