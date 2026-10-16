/**
 * The GNSS Rollover Checker, mountable on its tool page and in the chat rail.
 *
 * A week counter wraps, and a receiver whose firmware fixes the era (or counts
 * from a build date) starts reporting a date one counter period early once the
 * real clock passes the end of its window. Out come the date the receiver
 * reports, the date it goes wrong from, the time left, and the next wrap of
 * every counter:
 *
 * 1. the controls (the counter, how the firmware counts, today or a date);
 * 2. three plates over the firmware's window, drawn as a strip with the check
 *    date, the wraps and the date it goes wrong marked on it;
 * 3. the table of every counter's next wrap, always eight rows;
 * 4. the calls made and what they returned.
 *
 * The mount never computes a time. Every instant and duration comes from
 * `readRollover` (gnss-rollover-checker.ts), which calls the library; the strip
 * only places what those calls returned. The one clock the mount reads is the
 * reader's own, once a second and only in Today mode, after mount.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. Every
 * listener is delegated on the root. The one drag handle is a native range, and
 * the date field is its typed equivalent.
 */
import { Temporal } from "@js-temporal/polyfill";
import { codeFrameHtml } from "./code-frame";
import { callResultsText, renderCalls } from "./edi-render";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { GNSS_WEEK_COUNTERS, type GnssWeekCounter } from "./gnss-names";
import { loadGnssLib, type GnssLib } from "./gnss-lib";
import {
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  FIRMWARE_MODELS,
  FIRMWARE_MODEL_LABELS,
  MAX_VALUE_LENGTH,
  NOW_MODE_LABELS,
  NO_RESULT_TEXT,
  ROLLOVER_LINKS,
  ROLLOVER_NOW_MODES,
  ROLLOVER_PRESETS,
  dateOfDay,
  dayOfDate,
  isSeeded,
  markSentence,
  matchPreset,
  permalinkOf,
  platesOf,
  presetState,
  readArgs,
  readRollover,
  rolloverHandoffs,
  stripAria,
  summaryText,
  windowDays,
  type FirmwareModel,
  type GnssRolloverCheckerArgs,
  type Mark,
  type RolloverRead,
  type RolloverState,
  type WrapRow,
} from "./gnss-rollover-checker";
import { descriptionHoldHtml, plateHtml, platesHtml } from "./ledger-widgets";
import { setPresetDescription } from "./punctuality-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { handoffHref } from "./widget-permalink";
import {
  chipToggleHtml,
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

export type { GnssRolloverCheckerArgs } from "./gnss-rollover-checker";

const NBSP = "&nbsp;";

const TABLE_COLUMNS = ["Counter", "Width", "Next wrap", "Time left"] as const;

/** The chips under the strip: a build date or era start, up to two wraps, the
 *  date it goes wrong, and the check date. The slots are always drawn. */
const CHIP_SLOTS = 5;

/** The ordinal a radio group's `name` takes, so two checkers on one page never share it. */
let instances = 0;

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    ROLLOVER_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function radiosHtml<T extends string>(
  group: string,
  prefix: string,
  values: readonly T[],
  labels: Record<T, string>,
  checked: T,
): string {
  return values
    .map((v) =>
      chipToggleHtml({
        type: "radio",
        name: `${group}-${prefix}`,
        role: `${prefix}-${v}`,
        value: v,
        label: labels[v],
        checked: v === checked,
      }),
    )
    .join("");
}

/** A cell's two lines, text escaped; an empty line keeps its height. */
function linesHtml(first: string, second: string): string {
  const line = (text: string, sub: boolean) =>
    `<span class="gmt-clock-line${sub ? " gmt-clock-sub" : ""}">${text === "" ? NBSP : escapeHtml(text)}</span>`;
  return line(first, false) + line(second, true);
}

/** One table row, empty. Every cell holds two lines so a row never changes height. */
function blankRowHtml(counter: GnssWeekCounter): string {
  return (
    `<tr role="row" data-row="${escapeAttr(counter)}">` +
    `<th role="rowheader" data-label="Counter">${linesHtml(counter, "")}</th>` +
    TABLE_COLUMNS.slice(1)
      .map(
        (c) =>
          `<td role="cell" data-label="${escapeAttr(c)}">${linesHtml("", "")}</td>`,
      )
      .join("") +
    `</tr>`
  );
}

function rowHtml(row: WrapRow): string {
  const tags = [
    ...(row.yours ? ["your receiver"] : []),
    ...(row.soonest ? ["next to wrap"] : []),
  ];
  return (
    `<tr role="row" data-row="${escapeAttr(row.counter)}"${row.yours ? ' data-reading data-series="1"' : ""}>` +
    `<th role="rowheader" data-label="Counter">${linesHtml(row.counter, tags.join(" · "))}</th>` +
    `<td role="cell" data-label="Width">${linesHtml(row.none ? "" : row.width, "")}</td>` +
    `<td role="cell" data-label="Next wrap">${linesHtml(row.none ? NO_RESULT_TEXT : row.nextWrap, "")}</td>` +
    `<td role="cell" data-label="Time left">${linesHtml(row.none ? "" : row.left, "")}</td>` +
    `</tr>`
  );
}

function chipSlotHtml(): string {
  return `<span class="gmt-cutoff-chip gmt-rollover-chip" data-role="strip-chip" data-blank>${NBSP}</span>`;
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The plates, strip, rows and outputs are drawn
 * by `mount`, because they come from the real library calls.
 */
export function renderGnssRolloverCheckerTemplate(
  args: GnssRolloverCheckerArgs = {},
): string {
  const state: RolloverState = isSeeded(args)
    ? readArgs(args)
    : presetState(DEFAULT_PRESET);
  const presetId = matchPreset(state);
  const preset = ROLLOVER_PRESETS.find((p) => p.id === presetId);
  const group = `gnss-rollover-${++instances}`;

  return (
    `<div class="gmt-gnss-rollover-checker gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. The receiver
    `<div class="gmt-widget-section">` +
    `<h4>1. Describe the receiver</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      ROLLOVER_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Counter")}` +
    `<select class="gmt-select" data-role="counter">` +
    GNSS_WEEK_COUNTERS.map(
      (c) =>
        `<option value="${escapeAttr(c)}"${c === state.counter ? " selected" : ""}>${escapeHtml(c)}</option>`,
    ).join("") +
    `</select></label>` +
    `<fieldset class="gmt-chip-group gmt-field-wide" data-role="model-group"><legend class="gmt-label-text">How the firmware counts</legend>` +
    radiosHtml(
      group,
      "model",
      FIRMWARE_MODELS,
      FIRMWARE_MODEL_LABELS,
      state.model,
    ) +
    `</fieldset>` +
    `<label class="gmt-label gmt-field-wide" data-field="pivot">${labelTextHtml("Built on or after (UTC instant)")}` +
    `<input class="gmt-input" type="text" autocomplete="off" spellcheck="false" maxlength="${MAX_VALUE_LENGTH}" data-role="pivot" value="${escapeAttr(state.pivot)}"></label>` +
    `<label class="gmt-label gmt-field-wide" data-field="era">${labelTextHtml("Era the firmware assumes")}` +
    `<input class="gmt-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="${MAX_VALUE_LENGTH}" data-role="era" value="${escapeAttr(state.era)}"></label>` +
    `<fieldset class="gmt-chip-group gmt-field-wide" data-role="now-group"><legend class="gmt-label-text">Check it on</legend>` +
    radiosHtml(
      group,
      "now",
      ROLLOVER_NOW_MODES,
      NOW_MODE_LABELS,
      state.nowMode,
    ) +
    `</fieldset>` +
    `<label class="gmt-label gmt-field-wide" data-field="date">${labelTextHtml("Date to check (UTC instant)")}` +
    `<input class="gmt-input" type="text" autocomplete="off" spellcheck="false" maxlength="${MAX_VALUE_LENGTH}" data-role="date" value="${escapeAttr(state.date)}"></label>` +
    `<label class="gmt-label gmt-field-wide" data-field="date-slider">${labelTextHtml("Slide the date through the firmware's window")}` +
    rangeFieldHtml({
      role: "date-slider",
      chipRole: "date-value",
      min: 0,
      max: 0,
      step: 1,
      value: 0,
      valueText: "2026-10-15T00:00:00Z",
      ends: [" ", " "],
    }) +
    `</label>` +
    `</div>` +
    `</div>` +
    // 2. The receiver's window
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. Where the firmware goes wrong</h4>` +
    `<div class="gmt-gnss-frame" data-role="frame">` +
    platesHtml("heroes", platesOf(null)) +
    `<div class="gmt-gnss-ruler" data-role="strip" role="img" aria-label="No window to draw">` +
    `<div class="gmt-gnss-ruler-row">` +
    `<span class="gmt-gnss-label">Window</span>` +
    `<div class="gmt-gnss-track" data-role="strip-track">` +
    `<i class="gmt-gnss-span" data-role="strip-lit" hidden></i>` +
    `<i class="gmt-gnss-span gmt-gnss-hatch" data-role="strip-hatch" hidden></i>` +
    `<i class="gmt-gnss-rule" data-role="strip-rule" hidden></i>` +
    `<i class="gmt-gnss-rule" data-role="strip-rule" hidden></i>` +
    `<i class="gmt-gnss-rule" data-role="strip-rule" hidden></i>` +
    `<i class="gmt-gnss-today" data-role="strip-today" hidden></i>` +
    `<i class="gmt-cutoff-mark" data-role="strip-pin" hidden></i>` +
    `</div>` +
    `</div>` +
    `<div class="gmt-rollover-key" data-role="strip-key">` +
    `<span data-role="strip-key-lit" hidden>reads the right date</span>` +
    `<span data-role="strip-key-hatch" hidden>reports one counter period early</span>` +
    `</div>` +
    `<div class="gmt-rollover-chips" data-role="strip-chips">${Array.from({ length: CHIP_SLOTS }, chipSlotHtml).join("")}</div>` +
    `<ul class="gmt-gnss-visually-hidden" data-role="strip-list"></ul>` +
    `</div>` +
    `</div>` +
    `<p class="gmt-gnss-visually-hidden" data-role="summary" aria-live="polite"></p>` +
    `<div data-role="reason-aside" data-grow="slot"></div>` +
    `</div>` +
    // 3. Every counter's next wrap
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. When each counter next wraps</h4>` +
    `<div class="gmt-gnss-table-box">` +
    `<table class="gmt-gnss-table" data-role="counters-table" role="table">` +
    `<thead role="rowgroup"><tr role="row">${TABLE_COLUMNS.map((c) => `<th role="columnheader">${escapeHtml(c)}</th>`).join("")}</tr></thead>` +
    `<tbody role="rowgroup" data-role="counters-body">${GNSS_WEEK_COUNTERS.map(blankRowHtml).join("")}</tbody>` +
    `</table></div>` +
    `<p class="gmt-widget-hint" data-role="rolling-row" data-grow="slot">${NBSP}</p>` +
    `<p class="gmt-widget-hint">Time left is counted in whole days from the check date to each counter's next wrap.</p>` +
    `</div>` +
    // 4. The calls
    `<div class="gmt-widget-section">` +
    `<h4>4. What the library returns</h4>` +
    codeFrameHtml("rollover") +
    `<output class="gmt-widget-output" data-role="rollover-output">${NBSP}</output>` +
    toolLinksHtml(ROLLOVER_LINKS) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): RolloverState;
  apply(state: RolloverState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

/** The reader's clock as a UTC instant to the second. */
const nowIso = (): string =>
  Temporal.Now.instant().toString({ smallestUnit: "second" });

function setupWidget(root: HTMLElement, lib: GnssLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const qa = <T extends HTMLElement>(role: string) =>
    [...root.querySelectorAll(`[data-role="${role}"]`)] as T[];
  const field = (name: string) =>
    root.querySelector<HTMLElement>(`[data-field="${name}"]`);
  const presetEl = q<HTMLSelectElement>("preset")!;
  const counterEl = q<HTMLSelectElement>("counter")!;
  const pivotEl = q<HTMLInputElement>("pivot")!;
  const eraEl = q<HTMLInputElement>("era")!;
  const dateEl = q<HTMLInputElement>("date")!;
  const sliderEl = q<HTMLInputElement>("date-slider")!;
  const radios = (prefix: string) => [
    ...root.querySelectorAll<HTMLInputElement>(
      `input[type="radio"][data-role^="${prefix}-"]`,
    ),
  ];

  let last: RolloverRead | null = null;
  let lastNow = "";
  let ticker: ReturnType<typeof setInterval> | null = null;

  const model = (): FirmwareModel =>
    (radios("model").find((e) => e.checked)?.value ?? "pivot") as FirmwareModel;
  const nowMode = (): RolloverState["nowMode"] =>
    (radios("now").find((e) => e.checked)?.value ??
      "today") as RolloverState["nowMode"];

  function readState(): RolloverState {
    return {
      counter: counterEl.value as GnssWeekCounter,
      model: model(),
      pivot: pivotEl.value,
      era: eraEl.value,
      nowMode: nowMode(),
      date: dateEl.value,
    };
  }

  function showFields(): void {
    const m = model();
    const date = nowMode() === "date";
    const shown: Record<string, boolean> = {
      pivot: m === "pivot",
      era: m === "era",
      date,
      "date-slider": date,
    };
    for (const [name, on] of Object.entries(shown)) {
      const el = field(name);
      if (el) el.hidden = !on;
    }
  }

  function syncPreset(): void {
    const id = matchPreset(readState());
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        ROLLOVER_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  function apply(state: RolloverState): void {
    for (const e of radios("model")) e.checked = e.value === state.model;
    for (const e of radios("now")) e.checked = e.value === state.nowMode;
    setControlValue(counterEl, state.counter);
    setControlValue(pivotEl, state.pivot);
    setControlValue(eraEl, state.era);
    setControlValue(dateEl, state.date);
    showFields();
    syncTicker();
  }

  function drawPlates(read: RolloverRead): void {
    const heroes = q("heroes");
    if (heroes) heroes.innerHTML = read.plates.map(plateHtml).join("");
  }

  function drawStrip(read: RolloverRead): void {
    const strip = read.strip;
    const hide = (el: HTMLElement | null | undefined, hidden: boolean) => {
      if (el) el.hidden = hidden;
    };
    const lit = q("strip-lit");
    const hatch = q("strip-hatch");
    const pin = q("strip-pin");
    const today = q("strip-today");
    const rules = qa("strip-rule");
    const chips = qa("strip-chip");
    const list = q("strip-list");

    for (const rule of rules) rule.hidden = true;
    hide(pin, true);
    hide(today, true);
    for (const chip of chips) {
      chip.textContent = " ";
      chip.setAttribute("data-blank", "");
    }
    hide(q("strip-key-lit"), strip === null);
    hide(q("strip-key-hatch"), strip === null);

    if (strip === null) {
      hide(lit, true);
      hide(hatch, true);
      q("strip")?.setAttribute("aria-label", stripAria(read));
      if (list) list.innerHTML = "";
      return;
    }

    if (lit) {
      lit.hidden = false;
      lit.style.setProperty("--from", "0%");
      lit.style.setProperty("--to", `${strip.split}%`);
    }
    if (hatch) {
      hatch.hidden = strip.split >= 100;
      hatch.style.setProperty("--from", `${strip.split}%`);
      hatch.style.setProperty("--to", "100%");
    }

    let ruleAt = 0;
    strip.marks.forEach((m: Mark, i) => {
      if (m.pos !== null) {
        if (m.key === "check") {
          const el = m.label === "today" ? today : pin;
          if (el) {
            el.hidden = false;
            el.style.setProperty("--at", `${m.pos}%`);
          }
        } else if (m.key !== "start") {
          const rule = rules[ruleAt++];
          if (rule) {
            rule.hidden = false;
            rule.style.setProperty("--at", `${m.pos}%`);
          }
        }
      }
      const chip = chips[i];
      if (chip) {
        chip.textContent = `${m.label} ${m.at}${m.pos === null ? " (outside)" : ""}`;
        chip.removeAttribute("data-blank");
      }
    });

    q("strip")?.setAttribute("aria-label", stripAria(read));
    if (list) {
      list.innerHTML = strip.marks
        .map((m) => `<li>${escapeHtml(markSentence(m))}</li>`)
        .join("");
    }
  }

  function drawTable(read: RolloverRead): void {
    const body = q("counters-body");
    if (body) {
      body.innerHTML =
        read.at === null
          ? GNSS_WEEK_COUNTERS.map(blankRowHtml).join("")
          : read.rows.map(rowHtml).join("");
    }
    const rolling = q("rolling-row");
    if (rolling) rolling.textContent = read.rolling === "" ? " " : read.rolling;
  }

  /** The slider spans the firmware's window by day, and is live only when a
   *  date is being checked. It follows the date only when it is a whole-day stop. */
  function drawSlider(read: RolloverRead): void {
    const days = windowDays(lib, read);
    const usable = nowMode() === "date" && days !== null && days > 0;
    sliderEl.disabled = !usable;
    sliderEl.max = String(days ?? 0);
    const ends = root.querySelector<HTMLElement>(".gmt-range-ends");
    if (ends?.firstElementChild && ends.lastElementChild) {
      ends.firstElementChild.textContent =
        read.strip?.start.slice(0, 10) ?? " ";
      ends.lastElementChild.textContent = read.strip?.end.slice(0, 10) ?? " ";
    }
    const day = dayOfDate(lib, read, dateEl.value);
    if (day !== null && days !== null && day <= days) {
      sliderEl.value = String(day);
    }
    syncRange(sliderEl, dateEl.value.trim() || (read.strip?.start ?? ""));
  }

  function render(): void {
    showFields();
    const state = readState();
    lastNow = nowIso();
    const read = readRollover(lib, state, lastNow);
    last = read;

    drawPlates(read);
    drawStrip(read);
    drawTable(read);
    drawSlider(read);

    const calls = [...read.calls.reading, ...read.calls.counters];
    renderCalls(q("call-rollover"), calls);
    const out = q("rollover-output");
    if (out) {
      if (read.status === "sentinel") {
        renderWidgetOutput(out, "NO SIGNAL", "sentinel");
      } else if (read.status === "empty") {
        renderWidgetOutput(out, " ", "empty");
      } else {
        renderWidgetOutput(out, callResultsText(calls), "live");
      }
    }

    const summary = q("summary");
    if (summary) summary.textContent = summaryText(read);
    setToolLink(q("link-eras"), handoffHref(rolloverHandoffs(read).eras));
    const aside = q("reason-aside");
    if (aside) {
      if (read.status === "sentinel") {
        renderAside(
          aside,
          "caution",
          NO_RESULT_TITLE,
          `<p>${escapeHtml(read.failure ?? "")}</p>`,
        );
      } else if (read.status === "empty") {
        aside.innerHTML = `<p class="gmt-widget-hint">${escapeHtml(read.emptyText ?? "")}</p>`;
      } else {
        aside.innerHTML = "";
      }
    }
  }

  /** The clock runs only in Today mode; in a date mode nothing ticks. */
  function syncTicker(): void {
    const today = nowMode() === "today";
    if (today && ticker === null) {
      ticker = setInterval(() => {
        if (nowIso() !== lastNow) render();
      }, 1000);
    } else if (!today && ticker !== null) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  let shownNow = nowMode();

  root.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (target === sliderEl) {
      if (last !== null) {
        const date = dateOfDay(lib, last, Number(sliderEl.value));
        if (date !== "") setControlValue(dateEl, date);
      }
      syncPreset();
      render();
      return;
    }
    if (target === pivotEl || target === eraEl || target === dateEl) {
      syncPreset();
      render();
    }
  });

  root.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    if (target === presetEl) {
      const preset = ROLLOVER_PRESETS.find((p) => p.id === presetEl.value);
      if (!preset) return;
      apply(presetState(preset));
      shownNow = nowMode();
      syncPreset();
      render();
      return;
    }
    if (target instanceof HTMLInputElement && target.type === "radio") {
      // Switching to a date carries the moment being watched into the field.
      if (
        shownNow === "today" &&
        nowMode() === "date" &&
        last?.at != null &&
        last.state.nowMode === "today"
      ) {
        setControlValue(dateEl, last.at);
      }
      shownNow = nowMode();
      showFields();
      syncTicker();
      syncPreset();
      render();
      return;
    }
    if (target === counterEl) {
      syncPreset();
      render();
    }
  });

  wireCopyButtons(root);
  showFields();
  syncTicker();
  syncPreset();
  render();

  return {
    readState,
    apply,
    render,
    syncPreset,
    release: () => {
      if (ticker !== null) clearInterval(ticker);
      ticker = null;
    },
  };
}

export const mountGnssRolloverChecker: MountFn<
  GnssRolloverCheckerArgs
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
