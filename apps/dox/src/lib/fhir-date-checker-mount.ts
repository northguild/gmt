/**
 * The FHIR Date Checker widget (HLTH-94), mountable on its tool page and in the chat rail.
 *
 * One value, read as a FHIR R4 `date`, `dateTime` and `instant`. A table says, for each type,
 * whether `isValidFHIR` accepts it, whether FHIR's own published pattern matches, and why not
 * when the answer is no. A pattern that matches a value the library refuses is marked "shape
 * only". The timeline draws what the value names: a year, month or day as a span of calendar
 * dates, with the moment a parser that pads to midnight would invent pinned on it, and a moment
 * as one instant. A grid writes the value back with `formatFHIR` at every precision. Every
 * printed call and result is the real one.
 *
 * A refusal renders as NO SIGNAL with a sentence saying why. A blank form makes no call and
 * reads "nothing to read", never amber. `""` from `formatFHIR` reads "no result" in the grid,
 * because the library refuses for two reasons and the cell does not pretend to tell them apart.
 *
 * Built on the component kit: `renderFhirDateCheckerTemplate` writes the markup from builders
 * only, with ids from `idScope(idPrefix)`. `mount` finds its parts by those ids and listens once
 * on the widget with the mount's `signal`, so the host dropping the subtree is a complete
 * teardown. Nothing in the server-rendered template holds a result.
 */
import { defineElements } from "~/widgets/define";
import {
  badge,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  section,
  setHtml,
  table,
  textInput,
  verdict,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import {
  callFrameContent,
  callFrameHold,
  emptyOutput,
  outputContent,
  outputHold,
  outputOf,
} from "~/widgets/families/edi/edi-call";
import { hold, holdText } from "~/widgets/families/edi/edi-hold";
import { setMember } from "~/widgets/families/edi/edi-table";
import {
  ediTimeline,
  timelineContent,
} from "~/widgets/families/edi/edi-timeline";
import { verdictHold } from "~/widgets/families/edi/edi-view";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/fhir-date-checker.module.css";
import { NO_RESULT_TEXT } from "./edi-widgets";
import {
  CUSTOM_PRESET_ID,
  DEFAULT_ROW_LABEL,
  FHIR_PRECISIONS,
  FHIR_PRESETS,
  FHIR_TYPES,
  MEMBER_ROWS,
  WRITER_CELL_WIDTH,
  fhirBlank,
  fhirTexts,
  isSeeded,
  matchPreset,
  memberReadout,
  permalinkOf,
  presetState,
  readArgs,
  readFhir,
  stripNote,
  stripOf,
  verdictOf,
  writerCall,
  writerOf,
  type FhirArgs,
  type FhirState,
} from "./fhir-date-checker";
import type { FhirLib } from "./fhir-lib";
import { loadFhirLib } from "./fhir-lib";
import { onceDestroy, type MountFn } from "./widget-mount";

export type { FhirArgs } from "./fhir-date-checker";

const WIDGET_NAME = "fhir-date-checker";

const NOTHING_TO_READ = "nothing to read";
const WRITER_BLANK = "Type a value to write it back.";
const SHAPE_ONLY = "shape only";

/** Writer rows in order: the default, then each precision. */
const WRITER_KEYS = ["default", ...FHIR_PRECISIONS] as const;

const writerNote = (value: string): string =>
  value === "" ? WRITER_BLANK : `Each cell is ${writerCall(value)}.`;

/** The widest note under the writer grid. */
const longestWriterNote = (): string => writerNote(fhirTexts().writerValue);

const shapeBadge = (): SafeHtml =>
  badge({ text: SHAPE_ONLY, tone: "cyan", dim: true });

/** The per-type table: what each FHIR type says about the value. */
function typeTable(
  id: (local: string) => string,
  reasons: readonly string[],
): SafeHtml {
  return table({
    caption: "Each FHIR type, checked",
    rowHeader: "type",
    layout: "fixed",
    widths: ["18%", "17%", "24%", null],
    labelCells: true,
    roles: true,
    columns: [
      { key: "type", header: "Type", align: "start", numeric: false },
      { key: "valid", header: "Valid", align: "start", numeric: false },
      {
        key: "pattern",
        header: "FHIR pattern",
        align: "start",
        numeric: false,
      },
      { key: "why", header: "Why", align: "start", numeric: false },
    ],
    rows: FHIR_TYPES.map((t) => ({
      type: html`<span class="${styles.mono}">${t}</span>`,
      valid: html`<span id="${id(`valid-${t}`)}" class="${styles.result}" data-state="none">${NO_RESULT_TEXT}</span>`,
      pattern: html`<span class="${styles.patternCell}"><span id="${id(`pattern-${t}`)}" class="${styles.result}" data-state="none">${NO_RESULT_TEXT}</span>${hold(
        { id: id(`shape-${t}`), content: html``, ghosts: [shapeBadge()] },
      )}</span>`,
      why: holdText({
        id: id(`why-${t}`),
        role: "note",
        label: `Why ${t}`,
        text: "",
        samples: reasons,
      }),
    })),
  });
}

/**
 * The members the parser returned, one row each. The columns are laid out once, and each value
 * cell holds its longest answer as a hidden line, so a preset never changes the table's width or
 * height. The cell's id is the live line, which `setMember` writes.
 */
function membersTable(
  id: (local: string) => string,
  samples: Readonly<Record<string, readonly string[]>>,
): SafeHtml {
  return table({
    caption: "What the parser returned, member by member",
    rowHeader: "name",
    layout: "fixed",
    widths: ["32%", null],
    columns: [
      { key: "name", header: "Member", align: "start", numeric: false },
      { key: "value", header: "Value", align: "start", numeric: false },
    ],
    rows: MEMBER_ROWS.map((r) => ({
      name: r.label,
      value: html`<div class="${styles.member}">${hold({
        id: id(`member-${r.key}`),
        content: html`${NO_RESULT_TEXT}`,
        ghosts: [NO_RESULT_TEXT, ...(samples[r.key] ?? [])].map(
          (g) => html`${g}`,
        ),
      })}</div>`,
    })),
  });
}

/** The writer grid: a row per precision, a column per type. Cells are written by `mount`. */
function writerTable(id: (local: string) => string): SafeHtml {
  return table({
    caption: "The value written back, at each precision",
    rowHeader: "precision",
    layout: "fixed",
    widths: ["16%", null, null, null],
    labelCells: true,
    roles: true,
    columns: [
      { key: "precision", header: "Precision", align: "start", numeric: false },
      ...FHIR_TYPES.map((t) => ({
        key: t,
        header: t,
        align: "start" as const,
        numeric: true,
      })),
    ],
    rows: WRITER_KEYS.map((k) => ({
      precision: html`<span class="${styles.mono}">${k === "default" ? DEFAULT_ROW_LABEL : k}</span>`,
      date: writeCell(id, k, "date"),
      dateTime: writeCell(id, k, "dateTime"),
      instant: writeCell(id, k, "instant"),
    })),
  });
}

function writeCell(
  id: (local: string) => string,
  key: string,
  type: string,
): SafeHtml {
  return html`<span class="${styles.writeCell}" id="${id(`write-${key}-${type}`)}" data-state="empty" data-allowed="1" style="--w:${WRITER_CELL_WIDTH}ch">&nbsp;</span>`;
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no value it shows the
 * first preset. Results are drawn by `mount`, because they come from the real library calls.
 */
export function renderFhirDateCheckerTemplate(
  idPrefix: string,
  args: FhirArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: FhirState = isSeeded(args)
    ? readArgs(args)
    : presetState(FHIR_PRESETS[0]!);
  const t = fhirTexts();

  const input = section(
    { id: id("input"), heading: "1. Type a FHIR value", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...FHIR_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`<div class="${styles.main}">${field({
        id: id("value"),
        label: "FHIR value (date, dateTime or instant)",
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: state.value,
            autocomplete: "off",
            spellcheck: false,
            maxLength: 64,
            describedBy,
          }),
      })}</div>`,
    )}</div>`,
  );

  const types = section(
    { id: id("types"), heading: "2. What each type says", level: 4 },
    html`<div class="${styles.split}">
      <div class="${styles.pane} ${styles.stack}">${typeTable(id, t.reasons)}</div>
      <div class="${styles.pane}">${verdictHold({
        id: id("verdict"),
        titles: t.verdicts,
        details: t.details,
      })}${membersTable(id, t.memberSamples)}${callFrameHold({
        id: id("parse-call"),
        spec: { label: "Calls made", calls: [] },
        samples: [t.parseCall],
      })}${outputHold({
        id: id("parse-output"),
        label: "What the calls returned",
        state: emptyOutput(NOTHING_TO_READ),
        samples: [t.parseOutput],
      })}</div>
    </div>`,
  );

  const names = section(
    { id: id("names"), heading: "3. What the value names", level: 4 },
    html`${holdText({
      id: id("strip-note"),
      role: "note",
      label: "What the value names",
      text: "",
      samples: t.stripNotes,
    })}<div class="${styles.panel}">${ediTimeline({
      id: id("timeline"),
      spec: { kind: "empty", text: "" },
    })}</div>`,
  );

  const back = section(
    { id: id("back"), heading: "4. Written back by formatFHIR", level: 4 },
    html`<div class="${styles.written} ${styles.stackWide}"><div id="${id("writer")}">${writerTable(id)}</div>${holdText(
      {
        id: id("writer-note"),
        role: "note",
        label: "About the written values",
        text: "",
        samples: [WRITER_BLANK, longestWriterNote()],
      },
    )}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "FHIR Date Checker", scope: idPrefix },
    html`${input}${types}${names}${back}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): FhirState;
  apply(s: FhirState): void;
  render(): void;
  syncPreset(s: FhirState): void;
}

function setupWidget(
  root: HTMLElement,
  lib: FhirLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const valueEl = el<HTMLInputElement>("value");

  let destroyed = false;
  signal.addEventListener("abort", () => {
    destroyed = true;
  });

  const readState = (): FhirState => ({ value: valueEl.value });

  function syncPreset(s: FhirState): void {
    presetEl.value = matchPreset(s);
  }

  function render(): void {
    if (destroyed) return;
    const s = readState();
    const blank = fhirBlank(s);
    const read = readFhir(lib, s.value);

    // Section 2: the table, the verdict, the members and the calls.
    for (const type of FHIR_TYPES) {
      const row = read.rows.find((r) => r.type === type);
      const validEl = el(`valid-${type}`);
      const patternEl = el(`pattern-${type}`);
      validEl.textContent = row
        ? row.valid
          ? "Valid"
          : "Not valid"
        : NO_RESULT_TEXT;
      validEl.dataset["state"] = row ? (row.valid ? "yes" : "no") : "none";
      patternEl.textContent = row
        ? row.pattern
          ? "Matches"
          : "No match"
        : NO_RESULT_TEXT;
      patternEl.dataset["state"] = row
        ? row.shapeOnly
          ? "shape-only"
          : row.pattern
            ? "yes"
            : "no"
        : "none";
      setHtml(el(`shape-${type}`), row?.shapeOnly ? shapeBadge() : html``);
      el(`why-${type}`).textContent = row ? row.reason : "";
    }

    const v = verdictOf(read);
    setHtml(el("verdict"), verdict(v));

    for (const row of MEMBER_ROWS) {
      const r = memberReadout(read, row.key);
      setMember(el(`member-${row.key}`), r.text, r.state);
    }

    setHtml(
      el("parse-call"),
      callFrameContent({ label: "Calls made", calls: read.calls }),
    );
    setHtml(
      el("parse-output"),
      outputContent(
        "What the calls returned",
        blank
          ? emptyOutput(NOTHING_TO_READ)
          : outputOf(
              read.calls.some((c) => c.result === "" || c.result === null)
                ? "sentinel"
                : "ok",
              read.calls,
            ),
      ),
    );

    // Section 3: what the value names.
    el("strip-note").textContent = stripNote(read);
    setHtml(el("timeline"), timelineContent(stripOf(lib, read)));

    // Section 4: the writer.
    const rows = writerOf(lib, s.value, read.allowed);
    for (const row of rows) {
      const key = row.precision ?? "default";
      for (const type of FHIR_TYPES) {
        const cell = row.cells[type];
        const target = el(`write-${key}-${type}`);
        target.textContent = cell.text === "" ? " " : cell.text;
        target.dataset["state"] = cell.state;
        target.dataset["allowed"] = cell.allowed ? "1" : "0";
      }
    }
    el("writer-note").textContent = writerNote(s.value);
  }

  function apply(s: FhirState): void {
    valueEl.value = s.value;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (destroyed || e.target !== valueEl) return;
      syncPreset(readState());
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (destroyed || e.target !== presetEl) return;
      const chosen = FHIR_PRESETS.find((p) => p.id === presetEl.value);
      if (!chosen) return;
      apply(presetState(chosen));
      syncPreset(readState());
      render();
    },
    { signal },
  );

  syncPreset(readState());
  render();

  return { readState, apply, render, syncPreset };
}

export const mountFhirDateChecker: MountFn<FhirArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  // `loadFhirLib` already throws a `WidgetLoadError`; the host decides what to show.
  const lib = await loadFhirLib();
  if (signal.aborted) return onceDestroy(() => {});

  const checker = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    checker.apply(readArgs(args));
    checker.syncPreset(checker.readState());
    checker.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(checker.readState()),
  );
};
