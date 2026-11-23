/**
 * The Operating Schedule Checker widget, mountable on its tool page and in the chat rail.
 *
 * The reader pastes an `OperatingSchedule` as JSON and types an interval. The tool answers
 * whether the schedule is refused, closed in the interval or open in it, shows the two calls that
 * look alike for a closed schedule and a refused one (`isValidOperatingSchedule` and
 * `operatingIntervals`), and names the parts the library refuses on their own.
 *
 * Built on the component kit: the template is builders only, with ids from `idScope(idPrefix)`;
 * the verdict, the plates, the refused parts and the printed calls are drawn by `mount` from real
 * calls (`checkSchedule`), so no value on screen is computed here. The mount draws as the reader
 * types and starts no timer or observer; every listener is added once, with the mount's `signal`.
 */
import { defineElements } from "~/widgets/define";
import {
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  hint,
  hold,
  html,
  idScope,
  plates,
  section,
  setHtml,
  textArea,
  textInput,
  verdict,
  widget,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import { callLines } from "~/widgets/families/gnss/call-lines";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/schedule-checker.module.css";
import { loadHoursLib, type HoursLib } from "./hours-lib";
import {
  CUSTOM_PRESET_ID,
  INTERVAL_MAX_CHARS,
  NOT_JSON_TEXT,
  OPERATING_SCHEDULE_PRESETS,
  SCHEDULE_TEXT_MAX,
  VERDICTS,
  checkSchedule,
  intervalsResult,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  refusedLines,
  validResult,
  verdictOf,
  type CheckerFacts,
  type CheckerState,
  type CheckerVerdict,
  type ScheduleCheckerArgs,
} from "./schedule-checker";
import { onceDestroy, type MountFn } from "./widget-mount";

export type { ScheduleCheckerArgs } from "./schedule-checker";

const WIDGET_NAME = "operating-schedule-checker";
const CALLS_LABEL = "Calls made";
const PARTS_LABEL = "Parts the library refuses on their own";
/** The paste box is always this many rows high; a longer schedule scrolls inside it, so no preset or keystroke moves the page. */
const SCHEDULE_ROWS = 10;
/** The most calls a reading makes, and the widest line one prints, so the frame never resizes. */
const CALL_LINES = 4;
const CALL_SAMPLE = "x".repeat(240);

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** The widest each plate's value can be, so a new reading never resizes one. */
const PLATE_SAMPLES = {
  valid: ["false", "true"],
  intervals: ["[]", "99 intervals"],
  time: ["PT9999H59M59S"],
} as const;

function plateSet(facts: CheckerFacts | null): SafeHtml {
  const valid = facts === null ? null : validResult(facts);
  const found = facts === null ? null : intervalsResult(facts);
  const time = facts?.kind === "open" ? facts.openTime : null;
  const list: Plate[] = [
    {
      caption: "isValidOperatingSchedule",
      value: valid === null ? null : String(valid),
      lines: [],
      samples: PLATE_SAMPLES.valid,
      series: 1,
    },
    {
      caption: "operatingIntervals",
      value:
        found === null
          ? null
          : found.length === 0
            ? "[]"
            : `${found.length} ${found.length === 1 ? "interval" : "intervals"}`,
      lines: [],
      samples: PLATE_SAMPLES.intervals,
      series: 2,
    },
    {
      caption: "Open time",
      value: time,
      lines: [],
      samples: PLATE_SAMPLES.time,
      series: 3,
    },
  ];
  return plates(list);
}

/** The refused parts, one bordered row each. Nothing for any reading but a refused one. */
function partsOf(facts: CheckerFacts | null): SafeHtml {
  if (facts?.kind !== "refused") return html``;
  return html`<ul class="${styles.parts}" aria-label="${PARTS_LABEL}"
    >${refusedLines(facts.probe).map((line) => html`<li class="${styles.part}">${line}</li>`)}</ul
  >`;
}

function callsOf(facts: CheckerFacts | null): SafeHtml {
  const printed =
    facts === null || facts.kind === "not-json" ? null : callLines(facts.calls);
  return codeFrame({
    // ui-standards-ok: the same codeFrame call as the other tools; a shared builder is a cross-tool change
    label: CALLS_LABEL,
    copyLabel: "Copy calls",
    copyText: printed?.plain ?? "",
    ...(printed === null ? {} : { code: printed.code }),
    minLines: CALL_LINES,
    sizer: CALL_SAMPLE,
    gate: "codeframe",
  });
}

/** The text area's own error line. It holds its place, so the text appearing moves nothing. */
function errorHint(id: string): { id: string; html: SafeHtml } {
  return { id, html: hold(hint(id, "").html, [NOT_JSON_TEXT]) };
}

const verdictGhosts = (): SafeHtml[] =>
  Object.values(VERDICTS).map((v: CheckerVerdict) => verdict(v));

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset. The verdict, the plates, the parts and the calls are drawn by `mount`,
 * because they come from real library calls.
 */
export function renderScheduleCheckerTemplate(
  idPrefix: string,
  args: ScheduleCheckerArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: CheckerState = isSeeded(args)
    ? readArgs(args)
    : presetState(OPERATING_SCHEDULE_PRESETS[0]!);

  const inputs = section(
    { id: id("input"), heading: "1. The schedule and the interval", level: 4 },
    html`${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state.schedule),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Your schedule", description: "" },
        ...OPERATING_SCHEDULE_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${field({
      id: id("schedule"),
      label: "Schedule (JSON)",
      hint: errorHint(id("schedule-error")),
      control: ({ id: cid, describedBy }) =>
        textArea({
          id: cid,
          value: state.schedule,
          rows: SCHEDULE_ROWS,
          maxLength: SCHEDULE_TEXT_MAX,
          describedBy,
        }),
    })}${fieldGrid(
      html`${field({
        id: id("start"),
        label: "Interval start",
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: state.start,
            maxLength: INTERVAL_MAX_CHARS,
            spellcheck: false,
            autocomplete: "off",
            describedBy,
          }),
      })}${field({
        id: id("end"),
        label: "Interval end",
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: state.end,
            maxLength: INTERVAL_MAX_CHARS,
            spellcheck: false,
            autocomplete: "off",
            describedBy,
          }),
      })}`,
    )}`,
  );

  const answer = section(
    { id: id("answer"), heading: "2. What the library says", level: 4 },
    html`${hold(
      html`<div id="${id("verdict")}" role="status" aria-label="Verdict"></div>`,
      verdictGhosts(),
    )}<div id="${id("plates")}">${plateSet(null)}</div>${grow(
      html`<div id="${id("parts")}">${partsOf(null)}</div>`,
    )}`,
  );

  const calls = section(
    { id: id("calls"), heading: "3. The calls", level: 4 },
    html`<div id="${id("calls-slot")}">${callsOf(null)}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Operating Schedule Checker", scope: idPrefix },
    html`${inputs}${answer}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): CheckerState;
  apply(state: CheckerState): void;
  render(): void;
  syncPreset(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: HoursLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const scheduleEl = el<HTMLTextAreaElement>("schedule");
  const startEl = el<HTMLInputElement>("start");
  const endEl = el<HTMLInputElement>("end");

  const readState = (): CheckerState => ({
    schedule: scheduleEl.value,
    start: startEl.value,
    end: endEl.value,
  });

  const syncPreset = (): void => {
    presetEl.value = matchPreset(scheduleEl.value);
  };

  function render(): void {
    const facts = checkSchedule(lib, readState());
    const bad = facts.kind === "not-json";
    const v = verdictOf(facts);
    if (bad) scheduleEl.setAttribute("aria-invalid", "true");
    else scheduleEl.removeAttribute("aria-invalid");
    el("schedule-error").textContent = bad ? NOT_JSON_TEXT : "";
    setHtml(el("verdict"), verdict(v));
    setHtml(el("plates"), plateSet(facts));
    setHtml(el("parts"), partsOf(facts));
    setHtml(el("calls-slot"), callsOf(facts));
  }

  function apply(state: CheckerState): void {
    scheduleEl.value = state.schedule;
    startEl.value = state.start;
    endEl.value = state.end;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target === scheduleEl) {
        syncPreset();
        render();
      } else if (e.target === startEl || e.target === endEl) {
        render();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target !== presetEl) return;
      const chosen = OPERATING_SCHEDULE_PRESETS.find(
        (p) => p.id === presetEl.value,
      );
      if (!chosen) return;
      apply(presetState(chosen));
      syncPreset();
      render();
    },
    { signal },
  );

  syncPreset();
  render();
  return { readState, apply, render, syncPreset };
}

export const mountScheduleChecker: MountFn<ScheduleCheckerArgs> = async (
  root,
  args = {},
  signal,
) => {
  defineElements();
  // `loadHoursLib` throws `WidgetLoadError`: loud, not inert; the host decides what to show.
  const lib: HoursLib = await loadHoursLib();
  if (signal.aborted) return onceDestroy(() => {});

  const widgetCtl = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    widgetCtl.apply(readArgs(args));
    widgetCtl.syncPreset();
    widgetCtl.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(widgetCtl.readState()),
  );
};
