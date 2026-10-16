/**
 * The GNSS Week Decoder, mountable on its tool page and in the chat rail.
 *
 * A broadcast week number, a RINEX week or a UTC instant goes in. Out come the
 * UTC instant, the reading's era and the same moment on every counter:
 *
 * 1. the controls (a mode, a counter or system, the week, time of week and era);
 * 2. three plates (UTC, the system's own clock and its lead, the RINEX week)
 *    over a lane for each era the counter has had, or each RINEX counter;
 * 3. two tables, the moment on every broadcast counter and every RINEX system;
 * 4. the calls made and what they returned.
 *
 * The mount never computes a time. Every instant, week, era and lead comes from
 * `readGnss` (gnss-week-decoder.ts), which calls the library; the lanes only
 * place what those calls returned.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. Every
 * listener is delegated on the root, so the host dropping the subtree is a
 * complete teardown apart from the width observer. There is no drag handle: the
 * controls are typed fields and selects, and the plates, the lanes (four slots)
 * and both tables keep their boxes from one reading to the next.
 */
import { Temporal } from "@js-temporal/polyfill";
import { codeFrameHtml } from "./code-frame";
import { callResultsText, renderCalls } from "./edi-render";
import { NO_RESULT_TITLE } from "./edi-widgets";
import {
  GNSS_DECODER_MODES,
  GNSS_WEEK_COUNTERS,
  RINEX_WEEK_SYSTEMS,
  type GnssDecoderMode,
  type GnssWeekCounter,
  type RinexWeekSystem,
} from "./gnss-names";
import { loadGnssLib, type GnssLib } from "./gnss-lib";
import {
  CUSTOM_PRESET_ID,
  DECODER_LINKS,
  ERA_MODES,
  ERA_MODE_LABELS,
  GNSS_PRESETS,
  MODE_LABELS,
  NO_RESULT_TEXT,
  decoderHandoffs,
  isSeeded,
  lanesAria,
  matchPreset,
  permalinkOf,
  platesOf,
  presetState,
  readArgs,
  readGnss,
  summaryText,
  type EraMode,
  type GnssDecoderState,
  type GnssRead,
  type GnssWeekDecoderArgs,
  type Lane,
} from "./gnss-week-decoder";
import { counterSystem } from "./gnss-widgets";
import { descriptionHoldHtml, plateHtml, platesHtml } from "./ledger-widgets";
import { setPresetDescription } from "./punctuality-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { handoffHref } from "./widget-permalink";
import {
  chipToggleHtml,
  escapeAttr,
  escapeHtml,
  labelTextHtml,
  renderAside,
  renderWidgetOutput,
  setControlValue,
  setToolLink,
  toolLinksHtml,
  wireCopyButtons,
} from "./widget-ui";

export type { GnssWeekDecoderArgs } from "./gnss-week-decoder";

/** Era lanes the frame reserves: the most any counter draws (eras 0 to today's
 *  era plus one, and one more after a gap). */
const LANE_SLOTS = 4;

/** The ordinal a radio group's `name` takes, so two decoders on one page never share it. */
let instances = 0;

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    GNSS_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function optionsHtml(
  values: readonly string[],
  selected: string,
  label: (v: string) => string = (v) => v,
): string {
  return values
    .map(
      (v) =>
        `<option value="${escapeAttr(v)}"${v === selected ? " selected" : ""}>${escapeHtml(label(v))}</option>`,
    )
    .join("");
}

const COUNTER_COLUMNS = ["Counter", "Week", "Time of week (s)", "Era"] as const;
const RINEX_COLUMNS = ["System", "Week", "Time of week (s)"] as const;

function blankCells(columns: readonly string[]): string {
  return columns
    .map((c) => `<td role="cell" data-label="${escapeAttr(c)}">&nbsp;</td>`)
    .join("");
}

function laneSlotHtml(index: number): string {
  return (
    `<div class="gmt-gnss-laneset" data-role="laneset" data-slot="${index}" data-blank>` +
    `<div class="gmt-gnss-lane" data-role="lane" data-empty>` +
    `<span class="gmt-gnss-label" data-role="lane-label">&nbsp;</span>` +
    `<div class="gmt-gnss-track" data-role="lane-track">` +
    `<i class="gmt-gnss-today" data-role="lane-today" hidden></i>` +
    `<i class="gmt-cutoff-mark" data-role="lane-pin"></i>` +
    `</div>` +
    `<span class="gmt-cutoff-chip gmt-gnss-value" data-role="lane-value">&nbsp;</span>` +
    `</div>` +
    `<div class="gmt-gnss-flags" data-role="lane-flags"></div>` +
    `</div>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The plates, lanes, tables and outputs are
 * drawn by `mount`, because they come from the real library calls.
 */
export function renderGnssWeekDecoderTemplate(
  args: GnssWeekDecoderArgs = {},
): string {
  const state: GnssDecoderState = isSeeded(args)
    ? readArgs(args)
    : presetState(GNSS_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = GNSS_PRESETS.find((p) => p.id === presetId);
  const group = `gnss-decoder-mode-${++instances}`;

  return (
    `<div class="gmt-gnss-week-decoder gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. The reading
    `<div class="gmt-widget-section">` +
    `<h4>1. Say which week you have</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      GNSS_PRESETS.map((p) => p.description),
    ) +
    `<fieldset class="gmt-chip-group" data-role="mode-group"><legend class="gmt-label-text">What you have</legend>` +
    GNSS_DECODER_MODES.map((m) =>
      chipToggleHtml({
        type: "radio",
        name: group,
        role: `mode-${m}`,
        value: m,
        label: MODE_LABELS[m],
        checked: m === state.mode,
      }),
    ).join("") +
    `</fieldset>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label" data-field="counter">${labelTextHtml("Counter")}` +
    `<select class="gmt-select" data-role="counter">` +
    `<option value=""${state.counter === "" ? " selected" : ""}>(none)</option>` +
    optionsHtml(GNSS_WEEK_COUNTERS, state.counter) +
    `</select></label>` +
    `<label class="gmt-label" data-field="system">${labelTextHtml("RINEX system")}` +
    `<select class="gmt-select" data-role="system">${optionsHtml(RINEX_WEEK_SYSTEMS, state.system)}</select></label>` +
    `<label class="gmt-label" data-field="week">${labelTextHtml("Week")}` +
    `<input class="gmt-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" data-role="week" value="${escapeAttr(state.week)}"></label>` +
    `<label class="gmt-label" data-field="tow">${labelTextHtml("Time of week (seconds)")}` +
    `<input class="gmt-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-role="tow" value="${escapeAttr(state.timeOfWeekSeconds)}"></label>` +
    `<label class="gmt-label" data-field="era-mode">${labelTextHtml("Which era")}` +
    `<select class="gmt-select" data-role="era-mode">${optionsHtml(ERA_MODES, state.eraMode, (v) => ERA_MODE_LABELS[v as EraMode])}</select></label>` +
    `<label class="gmt-label" data-field="era">${labelTextHtml("Era number")}` +
    `<input class="gmt-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" data-role="era" value="${escapeAttr(state.era)}"></label>` +
    `<label class="gmt-label gmt-field-wide" data-field="pivot">${labelTextHtml("On or after (UTC instant)")}` +
    `<input class="gmt-input" type="text" autocomplete="off" spellcheck="false" data-role="pivot" value="${escapeAttr(state.pivot)}"></label>` +
    `<label class="gmt-label gmt-field-wide" data-field="utc">${labelTextHtml("UTC instant")}` +
    `<input class="gmt-input" type="text" autocomplete="off" spellcheck="false" data-role="utc" value="${escapeAttr(state.utc)}"></label>` +
    `</div>` +
    `</div>` +
    // 2. The reading, on a lane for each era
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. Read it</h4>` +
    `<div class="gmt-gnss-frame" data-role="frame">` +
    platesHtml("heroes", platesOf(null)) +
    `<div class="gmt-gnss-lanes" data-role="lanes" role="img" aria-label="No lanes to draw">` +
    Array.from({ length: LANE_SLOTS }, (_, i) => laneSlotHtml(i)).join("") +
    `<p class="gmt-widget-hint gmt-gnss-lanes-empty" data-role="lanes-empty" hidden></p>` +
    `<ul class="gmt-gnss-visually-hidden" data-role="lane-list"></ul>` +
    `</div>` +
    `</div>` +
    `<p class="gmt-gnss-visually-hidden" data-role="summary" aria-live="polite"></p>` +
    `<div data-role="reason-aside" data-grow="slot"></div>` +
    `</div>` +
    // 3. The same moment on every counter
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. The same moment on every counter</h4>` +
    `<div class="gmt-gnss-table-box">` +
    `<table class="gmt-gnss-table" data-role="counter-table" role="table">` +
    `<thead role="rowgroup"><tr role="row">${COUNTER_COLUMNS.map((c) => `<th role="columnheader">${escapeHtml(c)}</th>`).join("")}</tr></thead>` +
    `<tbody role="rowgroup" data-role="counter-body">${GNSS_WEEK_COUNTERS.map(
      (c) =>
        `<tr role="row" data-row="${escapeAttr(c)}"><th role="rowheader" data-label="Counter">${escapeHtml(c)}</th>${blankCells(COUNTER_COLUMNS.slice(1))}</tr>`,
    ).join("")}</tbody>` +
    `</table></div>` +
    `<div class="gmt-gnss-table-box">` +
    `<table class="gmt-gnss-table" data-role="rinex-table" role="table">` +
    `<thead role="rowgroup"><tr role="row">${RINEX_COLUMNS.map((c) => `<th role="columnheader">${escapeHtml(c)}</th>`).join("")}</tr></thead>` +
    `<tbody role="rowgroup" data-role="rinex-body">${RINEX_WEEK_SYSTEMS.map(
      (s) =>
        `<tr role="row" data-row="${escapeAttr(s)}"><th role="rowheader" data-label="System">${escapeHtml(s)}</th>${blankCells(RINEX_COLUMNS.slice(1))}</tr>`,
    ).join("")}</tbody>` +
    `</table></div>` +
    `<p class="gmt-widget-hint" data-role="footnote" data-grow="slot">&nbsp;</p>` +
    `</div>` +
    // 4. The calls
    `<div class="gmt-widget-section">` +
    `<h4>4. What the library returns</h4>` +
    codeFrameHtml("decoder") +
    `<output class="gmt-widget-output" data-role="decoder-output">&nbsp;</output>` +
    toolLinksHtml(DECODER_LINKS) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): GnssDecoderState;
  apply(state: GnssDecoderState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

/** The fields each mode shows. */
const FIELDS: Record<GnssDecoderMode, readonly string[]> = {
  broadcast: ["counter", "week", "tow", "era-mode", "era", "pivot"],
  rinex: ["system", "week", "tow"],
  utc: ["counter", "utc"],
};

function setupWidget(root: HTMLElement, lib: GnssLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const qa = <T extends HTMLElement>(role: string) =>
    [...root.querySelectorAll(`[data-role="${role}"]`)] as T[];
  const field = (name: string) =>
    root.querySelector<HTMLElement>(`[data-field="${name}"]`);
  const presetEl = q<HTMLSelectElement>("preset")!;
  const counterEl = q<HTMLSelectElement>("counter")!;
  const systemEl = q<HTMLSelectElement>("system")!;
  const weekEl = q<HTMLInputElement>("week")!;
  const towEl = q<HTMLInputElement>("tow")!;
  const eraModeEl = q<HTMLSelectElement>("era-mode")!;
  const eraEl = q<HTMLInputElement>("era")!;
  const pivotEl = q<HTMLInputElement>("pivot")!;
  const utcEl = q<HTMLInputElement>("utc")!;
  const modeEls = () => [
    ...root.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
  ];

  let last: GnssRead | null = null;

  function mode(): GnssDecoderMode {
    return (modeEls().find((e) => e.checked)?.value ??
      "broadcast") as GnssDecoderMode;
  }

  function readState(): GnssDecoderState {
    return {
      mode: mode(),
      counter: counterEl.value as GnssWeekCounter | "",
      system: systemEl.value as RinexWeekSystem,
      week: weekEl.value,
      timeOfWeekSeconds: towEl.value,
      eraMode: eraModeEl.value as EraMode,
      era: eraEl.value,
      pivot: pivotEl.value,
      utc: utcEl.value,
    };
  }

  /** Show the fields the mode reads; the era number and date follow the era choice. */
  function showFields(): void {
    const m = mode();
    const eraMode = eraModeEl.value as EraMode;
    const shown = new Set(FIELDS[m]);
    if (m === "broadcast") {
      if (eraMode !== "number") shown.delete("era");
      if (eraMode !== "notBefore") shown.delete("pivot");
    }
    for (const name of [
      "counter",
      "system",
      "week",
      "tow",
      "era-mode",
      "era",
      "pivot",
      "utc",
    ]) {
      const el = field(name);
      if (el) el.hidden = !shown.has(name);
    }
  }

  function syncPreset(): void {
    const id = matchPreset(readState());
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        GNSS_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  function apply(state: GnssDecoderState): void {
    for (const e of modeEls()) e.checked = e.value === state.mode;
    setControlValue(counterEl, state.counter);
    setControlValue(systemEl, state.system);
    setControlValue(weekEl, state.week);
    setControlValue(towEl, state.timeOfWeekSeconds);
    setControlValue(eraModeEl, state.eraMode);
    setControlValue(eraEl, state.era);
    setControlValue(pivotEl, state.pivot);
    setControlValue(utcEl, state.utc);
    showFields();
  }

  function drawPlates(read: GnssRead): void {
    const heroes = q("heroes");
    if (heroes) heroes.innerHTML = read.plates.map(plateHtml).join("");
  }

  function drawLane(slot: HTMLElement, lane: Lane | undefined): void {
    const set = (role: string) =>
      slot.querySelector<HTMLElement>(`[data-role="${role}"]`)!;
    slot.toggleAttribute("data-blank", lane === undefined);
    const row = set("lane");
    row.toggleAttribute("data-empty", lane === undefined || lane.pin === null);
    if (lane?.chosen === true) row.setAttribute("data-series", "1");
    else row.removeAttribute("data-series");
    row.toggleAttribute("data-gap", lane?.gapBefore === true);
    set("lane-label").textContent = lane?.label ?? " ";
    const pin = set("lane-pin");
    pin.style.setProperty("--at", `${lane?.pin ?? 0}%`);
    if (lane?.chosen === true) pin.setAttribute("data-series", "1");
    else pin.removeAttribute("data-series");
    const today = set("lane-today");
    today.hidden = lane?.today == null;
    if (lane?.today != null) today.style.setProperty("--at", `${lane.today}%`);
    set("lane-value").textContent =
      lane === undefined
        ? " "
        : lane.result === ""
          ? NO_RESULT_TEXT
          : lane.result;
    const tags = lane
      ? [
          lane.chosen ? "your reading" : "",
          lane.nearest ? "nearest today" : "",
          lane.differs ? "a different instant" : "",
          lane.today !== null ? "today" : "",
          lane.gapBefore ? "eras between are not drawn" : "",
        ].filter(Boolean)
      : [];
    set("lane-flags").innerHTML = tags
      .map((t) => `<span class="gmt-cutoff-chip">${escapeHtml(t)}</span>`)
      .join("");
  }

  function drawLanes(read: GnssRead): void {
    const slots = qa<HTMLElement>("laneset");
    slots.forEach((slot, i) => drawLane(slot, read.lanes[i]));
    const empty = q("lanes-empty");
    if (empty) {
      empty.hidden = read.lanesEmpty === null;
      empty.textContent = read.lanesEmpty ?? "";
    }
    q("lanes")?.setAttribute("aria-label", lanesAria(read));
    const list = q("lane-list");
    if (list) {
      list.innerHTML = read.lanes
        .map((l) => `<li>${escapeHtml(l.sentence)}</li>`)
        .join("");
    }
  }

  function drawTables(read: GnssRead): void {
    const cell = (text: string, label: string) =>
      `<td role="cell" data-label="${escapeAttr(label)}">${text === "" ? "&nbsp;" : escapeHtml(text)}</td>`;
    const body = q("counter-body");
    if (body) {
      body.innerHTML = read.counters
        .map((c) => {
          const none = c.none ? NO_RESULT_TEXT : "";
          return (
            `<tr role="row" data-row="${escapeAttr(c.counter)}"${c.yours ? ' data-reading data-series="1"' : ""}>` +
            `<th role="rowheader" data-label="Counter">${escapeHtml(c.counter)}${c.yours ? " (your reading)" : ""}</th>` +
            cell(none || c.week, "Week") +
            cell(none ? "" : c.timeOfWeek, "Time of week (s)") +
            cell(none ? "" : c.era, "Era") +
            `</tr>`
          );
        })
        .join("");
    }
    const rinex = q("rinex-body");
    if (rinex) {
      rinex.innerHTML = read.rinexRows
        .map((r) => {
          const none = r.none ? NO_RESULT_TEXT : "";
          return (
            `<tr role="row" data-row="${escapeAttr(r.system)}"${r.yours ? ' data-reading data-series="1"' : ""}>` +
            `<th role="rowheader" data-label="System">${escapeHtml(r.system)}${r.yours ? " (your reading)" : ""}</th>` +
            cell(none || r.week, "Week") +
            cell(none ? "" : r.timeOfWeek, "Time of week (s)") +
            `</tr>`
          );
        })
        .join("");
    }
    const note = q("footnote");
    if (note) note.textContent = read.footnote === "" ? " " : read.footnote;
  }

  function render(): void {
    showFields();
    const state = readState();
    const read = readGnss(lib, state, Temporal.Now.instant().toString());
    last = read;

    drawPlates(read);
    drawLanes(read);
    drawTables(read);

    const calls = [
      ...read.calls.reading,
      ...read.calls.counters,
      ...read.calls.rinex,
    ];
    renderCalls(q("call-decoder"), calls);
    const out = q("decoder-output");
    if (out) {
      if (read.status === "sentinel") {
        renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      } else if (read.status === "empty") {
        renderWidgetOutput(out, " ", "empty");
      } else {
        renderWidgetOutput(out, callResultsText(calls), "live");
      }
    }

    const summary = q("summary");
    if (summary) summary.textContent = summaryText(read);
    const handoffs = decoderHandoffs(read);
    setToolLink(q("link-clocks"), handoffHref(handoffs.clocks));
    setToolLink(q("link-rollover"), handoffHref(handoffs.rollover));
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

  /** A change of mode carries the moment across: the last good reading's own
   *  numbers fill the fields the new mode reads. */
  function carryOver(from: GnssDecoderMode, to: GnssDecoderMode): void {
    const carry = last?.status === "ok" ? last.carry : null;
    if (carry === null || from === to) return;
    if (to === "utc" && carry.utc !== null) setControlValue(utcEl, carry.utc);
    if (to !== "utc" && from === "utc") {
      if (carry.week !== null) setControlValue(weekEl, carry.week);
      if (carry.timeOfWeekSeconds !== null)
        setControlValue(towEl, carry.timeOfWeekSeconds);
    }
    if (to === "rinex" && carry.system !== null)
      setControlValue(systemEl, carry.system);
    if (to === "broadcast" && carry.era !== null) {
      setControlValue(eraModeEl, "number");
      setControlValue(eraEl, carry.era);
    }
  }

  let shownMode: GnssDecoderMode = mode();

  root.addEventListener("input", (e) => {
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (!/^(week|tow|era|pivot|utc)$/.test(role)) return;
    syncPreset();
    render();
  });

  root.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    if (target === presetEl) {
      const preset = GNSS_PRESETS.find((p) => p.id === presetEl.value);
      if (!preset) return;
      apply(presetState(preset));
      shownMode = mode();
      syncPreset();
      render();
      return;
    }
    if (target instanceof HTMLInputElement && target.type === "radio") {
      carryOver(shownMode, mode());
      shownMode = mode();
      syncPreset();
      render();
      return;
    }
    if (target === counterEl) {
      if (counterEl.value !== "") {
        setControlValue(
          systemEl,
          counterSystem(counterEl.value as GnssWeekCounter),
        );
      }
      syncPreset();
      render();
      return;
    }
    if (target === systemEl || target === eraModeEl) {
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);
  showFields();
  syncPreset();
  render();

  return { readState, apply, render, syncPreset, release: () => {} };
}

export const mountGnssWeekDecoder: MountFn<GnssWeekDecoderArgs> = async (
  root,
  args,
  signal,
) => {
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
