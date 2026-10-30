/**
 * The Cron in a Zone widget (CORE-84), mountable on its tool page and in the
 * chat rail.
 *
 * The reader types a cron line and names a zone and a year. Section 2 draws the
 * night of one clock change under both `cronRuns` policies, section 3 lists the
 * next twelve runs under each, and section 4 prints every call made.
 *
 * Built on the component kit: `renderCronInAZoneTemplate` writes the chrome from
 * builders only, with ids from `idScope(idPrefix)`, and `mount` fills each slot
 * from real library calls with `setHtml`. Every slot whose height changes sits in
 * a `<gmt-grow>`, and only the rows that exist are drawn. Every listener is
 * delegated on the widget with the mount's `signal`.
 */
import { defineElements } from "~/widgets/define";
import {
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  instant,
  section,
  select,
  setHtml,
  srOnly,
  table,
  textInput,
  widget,
  type Column,
  type SafeHtml,
} from "~/widgets/builders";
import {
  callOutput,
  type CallOutputLine,
} from "~/widgets/families/gnss/call-output";
import { callLines, outputOf } from "~/widgets/families/gnss/call-lines";
import {
  cronFieldList,
  cronNoSignal,
  cronPlot,
  kindCell,
} from "~/widgets/families/timescale/cron-night";
import { numberInput } from "~/widgets/families/timescale/number-input";
import { grow } from "~/widgets/primitives/grow/grow";
import styles from "~/widgets/tools/cron-in-a-zone.module.css";
import { CURATED_TIMEZONES } from "./curated-timezones";
import { loadCronLib } from "./cron-lib";
import type { CronLib, CronLibPolicy } from "./cron-lib";
import {
  CRON_MAX_TEXT,
  CRON_PRESETS,
  CUSTOM_PRESET_ID,
  CUSTOM_PRESET_LABEL,
  LIST_ROWS,
  NO_RUNS_TEXT,
  NO_SIGNAL_NOTE,
  NO_SIGNAL_TEXT,
  NO_TOUCHED_TEXT,
  PARSE_PAGE,
  POLICIES,
  POLICY_LINE,
  WEEKDAY_NOTE,
  cronView,
  noChangeOptionText,
  permalinkOf,
  presetIdOf,
  readArgs,
  resultText,
  stateOfPreset,
  type CronInAZoneArgs,
  type CronState,
  type CronView,
  type ListRow,
  type TouchedRow,
} from "./cron-in-a-zone";
import { onWidthChange, thinTickLabels } from "./label-fit";
import { formatValue } from "./punctuality-widgets";
import { withBase } from "./site";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { CronInAZoneArgs } from "./cron-in-a-zone";

const NBSP = "\u00a0";
const WIDGET_NAME = "cron-in-a-zone";
const NO_GRAMMAR_NIGHT_TEXT =
  "The line is outside the grammar, so there is nothing to draw.";

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** The zones the page offers, with a seeded zone joined when the list does not hold it. */
function zoneChoices(selected: string): { value: string; label: string }[] {
  const zones: readonly string[] = (
    CURATED_TIMEZONES as readonly string[]
  ).includes(selected)
    ? CURATED_TIMEZONES
    : [...CURATED_TIMEZONES, selected];
  return zones.map((z) => ({ value: z, label: z }));
}

const presetChoices = (): { value: string; label: string }[] => [
  ...CRON_PRESETS.map((p) => ({ value: p.id, label: p.label })),
  { value: CUSTOM_PRESET_ID, label: CUSTOM_PRESET_LABEL },
];

const RUN_COLUMNS: readonly Column<"local" | "instant" | "kind">[] = [
  { key: "local", header: "Local", align: "start", numeric: false },
  { key: "instant", header: "Instant", align: "start", numeric: false },
  { key: "kind", header: "Kind", align: "start", numeric: false },
];

/** One policy's table of runs, with the note that sits under it when there is one. */
function runTable(
  caption: string,
  rows: readonly (TouchedRow | ListRow)[],
  note: string,
): SafeHtml {
  return html`<div class="${styles.cell}">${table({
    caption,
    columns: RUN_COLUMNS,
    rows: rows.map((r) => ({
      local: instant(r.local),
      instant: instant(r.instant),
      kind: kindCell(r.classification, "only" in r ? r.only : null),
    })),
  })}${note === "" ? "" : html`<p class="${styles.tableNote}">${note}</p>`}</div>`;
}

function touchedTables(view: CronView): SafeHtml {
  const night = view.night;
  if (night === null) return html``;
  return html`${night.lanes.map((lane) =>
    runTable(
      `${lane.policy}, skipped or repeated times`,
      lane.touched,
      lane.more > 0
        ? `and ${lane.more} more`
        : lane.touched.length === 0
          ? NO_TOUCHED_TEXT
          : "",
    ),
  )}`;
}

function listTables(view: CronView): SafeHtml {
  const lists = view.lists;
  if (lists === null) return html``;
  return html`${POLICIES.map((policy, i) =>
    runTable(
      `${policy}, the next ${LIST_ROWS} runs`,
      lists[i] ?? [],
      (lists[i] ?? []).length === 0 ? NO_RUNS_TEXT : "",
    ),
  )}`;
}

function fieldsSlot(view: CronView): SafeHtml {
  if (view.fields !== null) return cronFieldList(view.fields);
  if (view.parsed && view.expr === null) {
    return cronNoSignal(
      NO_SIGNAL_TEXT,
      html`${NO_SIGNAL_NOTE} <a href="${withBase(PARSE_PAGE)}">Read the grammar</a>.`,
    );
  }
  return html``;
}

function callFrameOf(view: CronView): SafeHtml {
  const { code, plain } = callLines(view.calls);
  return codeFrame({
    label: "Calls made",
    copyLabel: "Copy calls",
    copyText: plain,
    code,
    gate: "codeframe",
  });
}

/** What the calls returned. Runs print as their instants; a refused line is NO SIGNAL. */
function outputSlot(view: CronView): SafeHtml {
  const failed = view.parsed && view.expr === null;
  const label = "What the calls returned";
  if (view.calls.length === 0) {
    return callOutput({ label, state: "empty", lines: [] });
  }
  if (failed) {
    const out = outputOf("sentinel", view.calls);
    return callOutput({ label, state: out.state, lines: out.lines });
  }
  const lines = view.calls.map((c): CallOutputLine => {
    const text =
      c.fn === "cronRuns" ? resultText(c.fn, c.result, formatValue) : c.result;
    return {
      text: typeof text === "string" ? text : formatValue(text),
      lost: false,
    };
  });
  return callOutput({ label, state: "live", lines });
}

/** The widget's chrome, seeded with `args` so the first paint shows them. */
export function renderCronInAZoneTemplate(
  idPrefix: string,
  args: CronInAZoneArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state = readArgs(args);
  const problem = id("problem");

  const wide = (content: SafeHtml): SafeHtml =>
    html`<div class="${styles.wide}">${content}</div>`;

  const controls = fieldGrid(
    html`${wide(
      field({
        id: id("line"),
        label: "Cron line",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.line,
            autocomplete: "off",
            spellcheck: false,
            maxLength: CRON_MAX_TEXT,
            describedBy: problem,
          }),
      }),
    )}${field({
      id: id("preset"),
      label: "Try",
      control: ({ id: cid }) =>
        select({ id: cid, options: presetChoices(), value: presetIdOf(state) }),
    })}${field({
      id: id("zone"),
      label: "Time zone",
      control: ({ id: cid }) =>
        select({
          id: cid,
          options: zoneChoices(state.zone),
          value: state.zone,
          describedBy: problem,
        }),
    })}${field({
      id: id("year"),
      label: "Year",
      control: ({ id: cid }) =>
        numberInput({
          id: cid,
          value: state.year,
          min: 1900,
          max: 2100,
          step: 1,
          describedBy: problem,
        }),
    })}${field({
      id: id("change"),
      label: "Clock change",
      control: ({ id: cid }) =>
        select({
          id: cid,
          options: [{ value: state.change, label: NBSP }],
          value: state.change,
        }),
    })}${wide(
      field({
        id: id("after"),
        label: "Runs after (optional)",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.after,
            placeholder: "2024-03-31T01:00:00Z",
            autocomplete: "off",
            spellcheck: false,
            maxLength: CRON_MAX_TEXT,
          }),
      }),
    )}`,
  );

  const line = section(
    { id: id("line-section"), heading: "1. The line", level: 4 },
    html`${controls}${grow(html`<p class="${styles.problem}" id="${problem}"></p>`)}
      <p role="status" aria-label="Cron reading" id="${id("live")}">${srOnly("")}</p>
      ${grow(html`<div id="${id("fields")}"></div>`)}
      <p class="${styles.hint}">${WEEKDAY_NOTE}</p>`,
  );

  const night = section(
    { id: id("night"), heading: "2. The night of the change", level: 4 },
    html`${grow(html`<p class="${styles.hint}" id="${id("nightnote")}"></p>`)}
      <div class="${styles.frame}" id="${id("frame")}" data-gate="frame">
        ${grow(html`<div id="${id("plot")}"></div>`)}
      </div>
      ${grow(html`<p class="${styles.sentence}" id="${id("sentence")}"></p>`)}
      ${grow(html`<div class="${styles.pair}" id="${id("touched")}"></div>`)}`,
  );

  const next = section(
    { id: id("next"), heading: "3. Next runs", level: 4 },
    html`${grow(html`<p class="${styles.hint}" id="${id("after-used")}"></p>`)}
      ${grow(html`<div class="${styles.pair}" id="${id("lists")}"></div>`)}`,
  );

  const calls = section(
    { id: id("calls"), heading: "4. The calls", level: 4 },
    html`${grow(
      html`<div id="${id("calls-slot")}">${codeFrame({
        label: "Calls made",
        copyLabel: "Copy calls",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("output-slot")}">${callOutput({
        label: "What the calls returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Cron in a Zone", scope: idPrefix },
    html`${line}${night}${next}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/**
 * The words a reader should hear when the answer changes: the problem, the
 * no-signal state or no-change note, and the sentence about the night. The
 * visible hints are plain paragraphs and announce nothing themselves.
 */
function liveText(view: CronView): string {
  const parts = [
    view.zoneError ?? view.yearError ?? view.afterError ?? view.changeNote,
    view.parsed && view.expr === null
      ? `${NO_SIGNAL_TEXT.replace(/[⟨⟩]/g, "").trim()}. ${NO_SIGNAL_NOTE}`
      : null,
    view.noChangeNote,
    view.night?.sentence ?? null,
  ];
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(" ");
}

interface Controller {
  readState(): CronState;
  stop(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: CronLib,
  initial: CronState,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, id, part: el } = findWidget(root, WIDGET_NAME);
  const lineEl = el<HTMLInputElement>("line");
  const presetEl = el<HTMLSelectElement>("preset");
  const zoneEl = el<HTMLSelectElement>("zone");
  const yearEl = el<HTMLInputElement>("year");
  const changeEl = el<HTMLSelectElement>("change");
  const afterEl = el<HTMLInputElement>("after");
  const frameEl = el("frame");
  // Every slot the render writes: a missing one throws now, not on the first keystroke.
  const slots = {
    problem: el("problem"),
    live: el("live"),
    fields: el("fields"),
    nightnote: el("nightnote"),
    plot: el("plot"),
    sentence: el("sentence"),
    touched: el("touched"),
    afterUsed: el("after-used"),
    lists: el("lists"),
    calls: el("calls-slot"),
    output: el("output-slot"),
  };

  let changeAsked = initial.change;
  let liveShown = "";

  const readState = (): CronState => ({
    line: lineEl.value,
    zone: zoneEl.value,
    year: yearEl.value,
    change: changeAsked,
    after: afterEl.value.trim(),
  });

  function apply(state: CronState): void {
    lineEl.value = state.line;
    if (![...zoneEl.options].some((o) => o.value === state.zone)) {
      zoneEl.append(new Option(state.zone, state.zone));
    }
    zoneEl.value = state.zone;
    yearEl.value = state.year;
    afterEl.value = state.after;
    changeAsked = state.change;
  }

  /** Thin the axes' labels to what fits; the marks keep their places. */
  function fit(): void {
    for (const name of ["axis-utc", "axis-wall"]) {
      const row = frameEl.querySelector<HTMLElement>(`[id="${id(name)}"]`);
      if (row !== null) thinTickLabels(row, "[data-tick]");
    }
  }

  function drawChange(view: CronView, state: CronState): void {
    if (view.changes.length > 0) {
      setHtml(
        changeEl,
        html`${view.changes.map(
          (c) => html`<option value="${c.value}">${c.label}</option>`,
        )}`,
      );
      changeEl.disabled = false;
      changeEl.value = String(view.ordinal);
    } else {
      setHtml(
        changeEl,
        html`<option value="">${
          view.noChangeNote !== null
            ? noChangeOptionText(state.year)
            : "Needs a valid zone and year"
        }</option>`,
      );
      changeEl.disabled = true;
    }
  }

  function drawNight(view: CronView): void {
    const night = view.night;
    slots.nightnote.textContent =
      view.noChangeNote ??
      (view.expr === null && view.parsed ? NO_GRAMMAR_NIGHT_TEXT : "");
    setHtml(
      slots.plot,
      night === null
        ? html``
        : cronPlot({
            chip: night.chip,
            utc: {
              id: id("axis-utc"),
              caption: "UTC",
              ticks: night.ticks.map((t) => ({
                at: t.pct / 100,
                label: t.utc,
              })),
            },
            wall: {
              id: id("axis-wall"),
              caption: "Wall",
              ticks: night.ticks.map((t) => ({
                at: t.pct / 100,
                label: t.wall,
              })),
            },
            lanes: night.lanes.map((lane) => ({
              policy: lane.policy as CronLibPolicy,
              line: POLICY_LINE[lane.policy],
              plate: lane.plate,
              marks: lane.marks,
            })),
          }),
    );
    fit();
    slots.sentence.textContent = night === null ? "" : night.sentence;
    setHtml(slots.touched, touchedTables(view));
  }

  function render(): void {
    const state = readState();
    const view = cronView(lib, state);
    presetEl.value = presetIdOf(state);

    slots.problem.textContent =
      view.zoneError ??
      view.yearError ??
      view.afterError ??
      view.changeNote ??
      "";
    const live = liveText(view);
    if (live !== liveShown) {
      liveShown = live;
      setHtml(slots.live, srOnly(live));
    }
    setHtml(slots.fields, fieldsSlot(view));
    drawChange(view, state);
    drawNight(view);

    slots.afterUsed.textContent = view.afterUsed
      ? `Runs strictly after ${view.afterUsed}.`
      : "";
    setHtml(slots.lists, listTables(view));

    setHtml(slots.calls, callFrameOf(view));
    setHtml(slots.output, outputSlot(view));
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const t = e.target;
      if (t === lineEl || t === yearEl || t === afterEl) render();
    },
    { signal },
  );
  widgetEl.addEventListener(
    "change",
    (e) => {
      const t = e.target;
      if (t === presetEl) {
        const hit = CRON_PRESETS.find((p) => p.id === presetEl.value);
        if (!hit) return;
        apply(stateOfPreset(hit));
        render();
      } else if (t === zoneEl || t === yearEl) {
        render();
      } else if (t === changeEl) {
        changeAsked = changeEl.value;
        render();
      }
    },
    { signal },
  );

  apply(initial);
  render();

  const stop = onWidthChange(frameEl, fit);
  return { readState, stop };
}

export const mountCronInAZone: MountFn<CronInAZoneArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: CronLib;
  try {
    lib = await loadCronLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  let controller: Controller;
  try {
    controller = setupWidget(root, lib, readArgs(args), signal);
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }

  return onceDestroy(
    () => controller.stop(),
    () => permalinkOf(controller.readState()),
  );
};
