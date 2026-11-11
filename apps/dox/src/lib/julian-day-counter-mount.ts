/**
 * The Julian Day Counter, mountable on its tool page and in the chat rail.
 *
 * An instant, or a count, goes in on a scale the reader picks. Out come the same instant as a
 * two-part JD, a single JD, an MJD and seconds since J2000.0, each read back to UTC:
 *
 * 1. the controls (the value, how to read it, the scale, a preset);
 * 2. the reading: four plates and the NO SIGNAL slot;
 * 3. where each day begins: a two-day ruler with a JD-day lane, an MJD-day lane and, off UTC,
 *    a UTC-day lane;
 * 4. the table of the four forms, always four rows;
 * 5. the calls made and what they returned.
 *
 * The mount never computes a day count. Every number and label comes from `readCounter`
 * (julian-day-counter.ts), which calls the library; the drawing only places what those calls
 * returned.
 *
 * Built on the component kit: `renderJulianDayCounterTemplate` writes the markup from builders
 * only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids. Every
 * listener is delegated on the widget with the mount's `signal`, and the mount starts no
 * timers, observers or animation frames. The widget has no drag handle.
 */
import { defineElements } from "~/widgets/define";
import {
  axis,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  hint,
  hold,
  html,
  idScope,
  instant,
  lane,
  mark,
  NO_RESULT,
  plates,
  section,
  setHtml,
  srOnly,
  table,
  textInput,
  tick,
  widget,
  type Ghost,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { callLines, outputOf } from "~/widgets/families/gnss/call-lines";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/julian-day-counter.module.css";
import { FORMS, LAST_INSTANT, SCALES, type Scale } from "./day-count-widgets";
import {
  COUNTER_PRESETS,
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  EMPTY_TEXT,
  FOOTNOTES,
  FORM_NAMES,
  LEAP_NOTE,
  MAX_CALLS,
  MAX_VALUE_LENGTH,
  NO_RESULT_TEXT,
  READ_MODES,
  SENTENCES,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readCounter,
  summaryText,
  type CounterRead,
  type CounterState,
  type FormRow,
  type JulianDayCounterArgs,
  type ReadMode,
  type Ruler,
} from "./julian-day-counter";
import { INTEGER_UTC_FROM } from "./timescale-widgets";
import { loadDayCountLib, type DayCountLib } from "./timescale-lib";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { JulianDayCounterArgs } from "./julian-day-counter";

const WIDGET_NAME = "julian-day-counter";

const NBSP = " ";
const NO_SIGNAL_PILL = "⟨ NO SIGNAL — invalid input ⟩";

const TABLE_CAPTION = "The same instant in each form";
const TABLE_COLUMNS = [
  "Form",
  "Call",
  "Value",
  "Back to UTC",
  "Shift",
] as const;
type Column = (typeof TABLE_COLUMNS)[number];

const LANE_JD = "JD day";
const LANE_UTC = "UTC calendar day";
const laneMjd = (scale: Scale): string => `MJD and calendar day on ${scale}`;
const lanesFor = (scale: Scale): string[] => [
  LANE_JD,
  laneMjd(scale),
  ...(scale === "UTC" ? [] : [LANE_UTC]),
];

// ---------------------------------------------------------------------------
// What the markup holds still for
// ---------------------------------------------------------------------------

const SAMPLE_UTC = "8888-88-88T88:88:88.888888888Z";
const SAMPLE_VALUE = "8888888 + 0.8888888888888888";
const SAMPLE_CALL = `toJulianDateParts("${SAMPLE_UTC}", "UTC")`;

/** What the mount learns from the library about the widest things a reading prints. */
interface Samples {
  values: Readonly<Record<string, readonly string[]>>;
  /** Per plate role, the widest text of each of its lines. */
  lines: Readonly<Record<string, readonly (readonly string[])[]>>;
  backs: readonly string[];
  shifts: readonly string[];
  cells: readonly string[];
  calls: readonly string[];
  codeLines: readonly string[];
}

const TEMPLATE_SAMPLES: Samples = {
  values: {},
  lines: {},
  backs: [SAMPLE_UTC],
  shifts: ["+88.888 µs"],
  cells: [SAMPLE_VALUE],
  calls: [SAMPLE_CALL],
  codeLines: [SAMPLE_CALL],
};

const PLATE_ROLES = FORMS.map((f) => `hero-${f}`);

function plateSamples(role: string, samples: Samples): string[] {
  const read = samples.values[role] ?? [];
  return [NO_RESULT, ...(read.length > 0 ? read : [SAMPLE_VALUE])];
}

/** Every sentence the tool can say in place of an answer. */
function sentenceGhosts(): string[] {
  return [...Object.values(SENTENCES), EMPTY_TEXT];
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function plateList(read: CounterRead | null, samples: Samples): Plate[] {
  const sources = read?.plates ?? [];
  return FORMS.map((form, i): Plate => {
    const s = sources[i];
    const role = PLATE_ROLES[i]!;
    const lines = s?.lines ?? [];
    const held = samples.lines[role] ?? [];
    return {
      caption: FORM_NAMES[form],
      value: s?.value ?? null,
      lines,
      unbroken: true,
      lineSamples:
        held.length > 0
          ? held
          : [[`back to UTC: ${SAMPLE_UTC}`], ["shift 0 ns"]],
      series: (i + 1) as 1 | 2 | 3 | 4,
      samples: plateSamples(role, samples),
    };
  });
}

/** A cell that keeps the room of its widest text: the live content and its ghosts. */
function heldInstant(text: string, ghosts: readonly string[]): SafeHtml {
  const live = text === "" ? html`${NBSP}` : instant(text);
  const sized: Ghost[] = [...new Set(ghosts)].map((g) => instant(g));
  return hold(html`<span class="${styles.mono}">${live}</span>`, sized, {
    ghostClass: styles.mono!,
  });
}

function callCell(row: FormRow, samples: Samples): SafeHtml {
  const live = row.call === null ? html`${NBSP}` : callLines([row.call]).code;
  const ghosts: Ghost[] = [...new Set(samples.calls)];
  return hold(
    html`<span class="${styles.wrap}" data-gate="codeframe"><code class="${styles.cell}">${live}</code></span>`,
    ghosts,
    { ghostClass: styles.cell! },
  );
}

function tableOf(read: CounterRead | null, samples: Samples): SafeHtml {
  const lost = read === null || read.status !== "ok";
  const rows = (read?.rows ?? []).map((row): Record<Column, SafeHtml> => {
    const shown = (text: string): string =>
      lost || text === "" ? NO_RESULT_TEXT : text;
    return {
      Form: html`<span class="${styles.formName}">${row.name}</span>`,
      Call: callCell(row, samples),
      Value: heldInstant(shown(row.value), samples.cells),
      "Back to UTC": heldInstant(shown(row.back), samples.backs),
      Shift: heldInstant(shown(row.shift), samples.shifts),
    };
  });
  return table({
    caption: TABLE_CAPTION,
    columns: TABLE_COLUMNS.map((header) => ({
      key: header,
      header,
      align: "start" as const,
      numeric: false,
    })),
    rows:
      rows.length > 0
        ? rows
        : FORMS.map((form): Record<Column, SafeHtml> => ({
            Form: html`<span class="${styles.formName}">${FORM_NAMES[form]}</span>`,
            Call: callCell(
              {
                form,
                name: FORM_NAMES[form],
                call: null,
                value: "",
                back: "",
                shift: "",
              },
              samples,
            ),
            Value: heldInstant(NO_RESULT_TEXT, samples.cells),
            "Back to UTC": heldInstant(NO_RESULT_TEXT, samples.backs),
            Shift: heldInstant(NO_RESULT_TEXT, samples.shifts),
          })),
    rowHeader: "Form",
    layout: "fixed",
    widths: ["14%", "29%", "21%", "22%", "14%"],
    labelCells: true,
    roles: true,
  });
}

function signalOf(read: CounterRead | null): SafeHtml {
  const lost = read !== null && read.status === "sentinel";
  const sentence = read?.failure ?? read?.emptyText ?? "";
  return html`<span class="${styles.signal}" data-state="${lost ? "on" : "off"}" ${lost ? "" : html`aria-hidden="true"`}>${NO_SIGNAL_PILL}</span>${hold(
    html`<p class="${styles.sentence}">${sentence === "" ? NBSP : sentence}</p>`,
    sentenceGhosts(),
    { ghostClass: styles.sentence! },
  )}`;
}

function footnoteOf(read: CounterRead | null): SafeHtml {
  const text = read?.footnote ?? "";
  return hold(html`<span>${text === "" ? NBSP : text}</span>`, [...FOOTNOTES], {
    ghostClass: styles.note!,
  });
}

/** The ruler: one lane for each day, and the axis. `null` draws the lanes with nothing on them. */
function rulerOf(ruler: Ruler | null, scale: Scale): SafeHtml {
  const lanes =
    ruler?.lanes ?? lanesFor(scale).map((name) => ({ name, marks: [] }));
  const ticks =
    ruler?.ticks ??
    ["00h", "12h", "00h", "12h", "00h"].map((label, i) => ({
      at: i / 4,
      label,
    }));
  return html`<div class="${styles.seam}" data-gate="ruler">${lanes.map((l) =>
    lane(
      { label: l.name },
      l.marks.map((m) => mark({ label: m.label, at: m.at, series: m.series })),
    ),
  )}${
    // On UTC there is no UTC-day lane. A hidden lane keeps its room, so a scale change moves no height.
    lanes.length < lanesFor("TAI").length
      ? html`<div class="${styles.laneSpare}" aria-hidden="true">${lane({ label: LANE_UTC }, [])}</div>`
      : ""
  }${axis(ticks.map((t) => tick(t)))}</div>`;
}

function leapNoteOf(ruler: Ruler | null): SafeHtml {
  const text = ruler?.leap === true ? LEAP_NOTE : "";
  return hold(html`<span>${text === "" ? NBSP : text}</span>`, [LEAP_NOTE], {
    ghostClass: styles.note!,
  });
}

function codeOf(read: CounterRead | null, samples: Samples): SafeHtml {
  const { code, plain } = callLines(read?.calls ?? []);
  return codeFrame({
    label: "Calls made",
    copyLabel: "Copy calls",
    copyText: plain,
    code,
    gate: "codeframe",
    minLines: MAX_CALLS,
    sizer: samples.codeLines.reduce(
      (a, c) => (c.length > a.length ? c : a),
      "",
    ),
  });
}

function outputPane(read: CounterRead | null): SafeHtml {
  const out = outputOf(read?.status ?? "empty", read?.calls ?? []);
  return html`<div class="${styles.wrap}" data-gate="codeframe"><code class="${styles.contents}">${callOutput(
    {
      label: "What the calls returned",
      state: out.state,
      lines: out.lines,
      minLines: MAX_CALLS,
    },
  )}</code></div>`;
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset. The plates, ruler, rows and outputs are drawn by `mount`, because they come
 * from the real library calls.
 */
export function renderJulianDayCounterTemplate(
  idPrefix: string,
  args: JulianDayCounterArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: CounterState = isSeeded(args)
    ? readArgs(args)
    : presetState(DEFAULT_PRESET);

  const pick = section(
    { id: id("pick"), heading: "1. Give an instant or a count", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Your values", description: "" },
        ...COUNTER_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`<div class="${styles.wide}">${field({
        id: id("value"),
        label: "Value",
        hint: hint(
          id("value-hint"),
          "A UTC instant such as 2026-01-01T12:00:00Z, or a number read as the form chosen below. A JD also takes two parts joined by +.",
        ),
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: state.value,
            autocomplete: "off",
            spellcheck: false,
            maxLength: MAX_VALUE_LENGTH,
            ...(describedBy === undefined ? {} : { describedBy }),
          }),
      })}</div
      ><div class="${styles.wide}">${chips({
        legend: "Read as",
        kind: "radio",
        name: id("read"),
        items: READ_MODES.map((m) => ({
          value: m.value,
          label: m.label,
          checked: m.value === state.read,
        })),
      })}</div
      ><div class="${styles.wide}">${chips({
        legend: "Scale",
        kind: "radio",
        name: id("scale"),
        items: SCALES.map((s) => ({
          value: s,
          label: s,
          checked: s === state.scale,
        })),
      })}</div>`,
    )}</div>`,
  );

  const read = section(
    { id: id("read"), heading: "2. The same instant, four ways", level: 4 },
    html`${grow(
      html`<div class="${styles.stage}">
        <div class="${styles.platesSlot}" id="${id("plates")}">${plates(plateList(null, TEMPLATE_SAMPLES), { gate: "hero" })}</div>
        <div class="${styles.signalSlot}" id="${id("signal")}">${signalOf(null)}</div>
        <div class="${styles.note}" id="${id("footnote")}">${footnoteOf(null)}</div>
      </div>`,
    )}
      <p role="status" aria-label="Reading summary" id="${id("summary")}">${srOnly("")}</p>`,
  );

  const seam = section(
    { id: id("seam"), heading: "3. Where each day begins", level: 4 },
    html`${grow(
      html`<div class="${styles.drawingSlot}" id="${id("drawing")}">${rulerOf(null, state.scale)}</div>`,
    )}
      <p id="${id("seam-text")}">${srOnly("")}</p>
      <div class="${styles.note}" id="${id("leap-note")}">${leapNoteOf(null)}</div>`,
  );

  const every = section(
    { id: id("every"), heading: "4. Each form and its way back", level: 4 },
    grow(
      html`<div class="${styles.forms}" id="${id("table")}">${tableOf(null, TEMPLATE_SAMPLES)}</div>`,
    ),
  );

  const calls = section(
    { id: id("calls"), heading: "5. What the library returns", level: 4 },
    html`${grow(html`<div id="${id("calls-slot")}">${codeOf(null, TEMPLATE_SAMPLES)}</div>`)}${grow(
      html`<div id="${id("output-slot")}">${outputPane(null)}</div>`,
    )}`,
  );

  return widget(
    {
      name: WIDGET_NAME,
      label: "Julian Day Counter",
      scope: idPrefix,
    },
    html`${pick}${read}${seam}${every}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** The widest texts the library writes at the presets and at both ends of the range, on every scale. */
function samplesOf(lib: DayCountLib): Samples {
  const states: CounterState[] = [
    ...COUNTER_PRESETS.map((p) => p.state),
    ...SCALES.flatMap((scale): CounterState[] => [
      { value: INTEGER_UTC_FROM, read: "instant", scale },
      { value: LAST_INSTANT, read: "instant", scale },
    ]),
  ];
  const values: Record<string, Set<string>> = {};
  const lines: Record<string, Set<string>[]> = {};
  const backs = new Set<string>();
  const shifts = new Set<string>();
  const cells = new Set<string>();
  const calls = new Set<string>();
  const codeLines = new Set<string>();
  for (const state of states) {
    const read = readCounter(lib, state);
    if (read.status !== "ok") continue;
    for (const row of read.rows) {
      backs.add(row.back);
      shifts.add(row.shift);
      cells.add(row.value);
      if (row.call !== null) calls.add(callLines([row.call]).plain);
    }
    callLines(read.calls)
      .plain.split("\n")
      .forEach((line) => codeLines.add(line));
    for (const plate of read.plates) {
      if (plate.value !== null)
        (values[plate.role] ??= new Set()).add(plate.value);
      const slots = (lines[plate.role] ??= []);
      plate.lines.forEach((line, i) => (slots[i] ??= new Set()).add(line));
    }
  }
  return {
    values: Object.fromEntries(
      PLATE_ROLES.map((role) => [role, [...(values[role] ?? [])]]),
    ),
    lines: Object.fromEntries(
      PLATE_ROLES.map((role) => [
        role,
        (lines[role] ?? []).map((set) => [...set]),
      ]),
    ),
    backs: [SAMPLE_UTC, ...backs],
    shifts: [...TEMPLATE_SAMPLES.shifts, ...shifts],
    cells: [...cells],
    calls: [SAMPLE_CALL, ...calls],
    codeLines: [SAMPLE_CALL, ...codeLines],
  };
}

interface Controller {
  readState(): CounterState;
  apply(state: CounterState): void;
  render(): void;
  syncPreset(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: DayCountLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const [readEl, scaleEl] = [
    ...widgetEl.querySelectorAll<GmtChips>("gmt-chips"),
  ] as [GmtChips, GmtChips];
  const valueEl = el<HTMLInputElement>("value");
  const samples = samplesOf(lib);

  function readState(): CounterState {
    return {
      value: valueEl.value,
      read: readEl.value as ReadMode,
      scale: scaleEl.value as Scale,
    };
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function apply(state: CounterState): void {
    valueEl.value = state.value;
    readEl.value = state.read;
    scaleEl.value = state.scale;
  }

  function render(): void {
    const state = readState();
    const read = readCounter(lib, state);
    setHtml(el("plates"), plates(plateList(read, samples), { gate: "hero" }));
    setHtml(el("signal"), signalOf(read));
    setHtml(el("footnote"), footnoteOf(read));
    setHtml(el("drawing"), rulerOf(read.ruler, state.scale));
    setHtml(el("seam-text"), srOnly(read.ruler?.aria ?? ""));
    setHtml(el("leap-note"), leapNoteOf(read.ruler));
    setHtml(el("table"), tableOf(read, samples));
    setHtml(el("calls-slot"), codeOf(read, samples));
    setHtml(el("output-slot"), outputPane(read));
    setHtml(el("summary"), srOnly(summaryText(read)));
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target !== valueEl) return;
      syncPreset();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target === readEl || e.target === scaleEl) {
        syncPreset();
        render();
        return;
      }
      if (e.target !== presetEl) return;
      const chosen = COUNTER_PRESETS.find((p) => p.id === presetEl.value);
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

export const mountJulianDayCounter: MountFn<JulianDayCounterArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: DayCountLib;
  try {
    lib = await loadDayCountLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    controller.apply(readArgs(args));
    controller.syncPreset();
    controller.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(controller.readState()),
  );
};
