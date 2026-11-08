/**
 * The TAI64N Log Reader widget, mountable on its tool page and in the chat rail.
 *
 * The reader pastes log lines that start with a TAI64N label. Each line shows the UTC instant
 * `fromTai64n` reads from its label, the TAI reading `toTAI` gives and TAI minus UTC. The
 * selected line is drawn large, with the calls that were made, and a second box writes a label
 * from an instant.
 *
 * Built on the component kit: the template is builders only, with ids from `idScope(idPrefix)`;
 * the rows, the plates and the printed calls are drawn by `mount` from real calls, so no value
 * on screen is computed here. The mount draws as the reader types and starts no timer or
 * observer; every listener is added once, with the mount's `signal`.
 */
import { defineElements } from "~/widgets/define";
import {
  codeFrame,
  field,
  findWidget,
  hero,
  hint,
  hold,
  html,
  idScope,
  plates,
  section,
  setHtml,
  textInput,
  toolLinks,
  widget,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { callLines, outputOf } from "~/widgets/families/gnss/call-lines";
import { textArea } from "~/widgets/families/ledger/text-area";
import {
  logTable,
  LINE_NO_SIGNAL,
  type LogRow,
} from "~/widgets/families/tai64n/log-table";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/tai64n-log-reader.module.css";
import { loadTai64nLib, type Tai64nLib } from "./tai64n-lib";
import {
  ALL_REFUSED_TEXT,
  CUSTOM_PRESET_ID,
  DROPPED_HINT,
  EMPTY_TEXT,
  INSERTED_BADGE,
  INSTANT_MAX_CHARS,
  LATE_SENTENCE_WIDEST,
  LOG_MAX_LINES,
  NO_LABEL_BADGE,
  NO_LABEL_SENTENCE,
  NO_LINE_SENTENCE,
  NO_SIGNAL,
  OFFSET_WIDEST,
  TAI64N_PRESETS,
  TAI_WIDEST,
  TIMELINE_LINK_TEXT,
  UTC_WIDEST,
  defaultLine,
  isSeeded,
  lateSentence,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readLog,
  secondsText,
  splitLog,
  timelineLink,
  writeLabel,
  type LogState,
  type ReadLine,
  type Tai64nLogReaderArgs,
  type Written,
} from "./tai64n-log-reader";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { Tai64nLogReaderArgs } from "./tai64n-log-reader";
export { LINE_NO_SIGNAL };

const WIDGET_NAME = "tai64n-log-reader";
const TABLE_NAME =
  "Each log line, the instant its label names and TAI minus UTC";
const CALLS_LABEL = "Calls made";
const OUTPUT_LABEL = "What the calls returned";
const LINKS_LABEL = "Open this line in another tool";
const PICK_HINT = "Pick a line to see its details.";
/** The paste box is at least this many rows high, and at most `LOG_MAX_LINES`. */
const MIN_ROWS = 2;
/** The widest label the writer shows, and how many lines the code frame holds. */
const LABEL_SAMPLE = `@${"0".repeat(24)}`;
const CALL_LINES = 4;
/** The widest call line, in characters, so the frame's scroll never comes and goes. */
const CALL_SAMPLE = "x".repeat(60);

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function plateSet(
  captions: readonly [string, string, string],
  values: readonly [string | null, string | null, string | null],
): SafeHtml {
  const list: Plate[] = [
    {
      caption: captions[0],
      value: values[0],
      lines: [],
      samples: [UTC_WIDEST, NO_SIGNAL],
      series: 1,
    },
    {
      caption: captions[1],
      value: values[1],
      lines: [],
      samples: [TAI_WIDEST, NO_SIGNAL],
      series: 2,
    },
    {
      caption: captions[2],
      value: values[2],
      lines: [],
      samples: [OFFSET_WIDEST, NO_SIGNAL],
      series: 3,
    },
  ];
  return plates(list);
}

function sentenceOf(text: string): SafeHtml {
  return html`<p class="${styles.sentence}"
    >${hold(text, [LATE_SENTENCE_WIDEST, NO_LABEL_SENTENCE, NO_LINE_SENTENCE])}</p
  >`;
}

/** The selected line, drawn large. `null` is no line at all; `refused` is no line with a label. */
function stageOf(row: ReadLine | null, refused: boolean): SafeHtml {
  if (refused) {
    return html`<div class="${styles.stage}" data-lost="false"
      >${hero({
        caption: "Selected line",
        value: NO_SIGNAL,
        tone: "sentinel",
      })}<p class="${styles.sentence}">${ALL_REFUSED_TEXT}</p></div
    >`;
  }
  const lost = row !== null && !row.read;
  const values: [string | null, string | null, string | null] =
    row === null
      ? [null, null, null]
      : lost
        ? [NO_SIGNAL, NO_SIGNAL, NO_SIGNAL]
        : [row.utc, row.tai, secondsText(row.seconds)];
  const sentence =
    row === null
      ? NO_LINE_SENTENCE
      : lost
        ? NO_LABEL_SENTENCE
        : lateSentence(row.seconds);
  return html`<div class="${styles.stage}" data-lost="${String(lost)}"
    >${plateSet(["UTC instant", "TAI reading", "TAI − UTC"], values)}${sentenceOf(sentence)}</div
  >`;
}

/** The writer's two plates. `null` is the server render, before any call has been made. */
function writerOf(written: Written | null): SafeHtml {
  const lost = written !== null && written.label === "";
  const values: [string | null, string | null] =
    written === null
      ? [null, null]
      : lost
        ? [NO_SIGNAL, NO_SIGNAL]
        : [written.label, written.back];
  const list: Plate[] = [
    {
      caption: "Label",
      value: values[0],
      lines: [],
      samples: [LABEL_SAMPLE, NO_SIGNAL],
      series: 1,
    },
    {
      caption: "Read back",
      value: values[1],
      lines: [],
      samples: [UTC_WIDEST, NO_SIGNAL],
      series: 2,
    },
  ];
  return html`<div class="${styles.writer}" data-lost="${String(lost)}">${plates(list)}</div>`;
}

function linksOf(row: ReadLine | null): SafeHtml {
  const href = timelineLink(row);
  return toolLinks({
    label: LINKS_LABEL,
    links: [
      href === null
        ? { text: TIMELINE_LINK_TEXT }
        : { text: TIMELINE_LINK_TEXT, href },
    ],
  });
}

function callsOf(row: ReadLine | null): { frame: SafeHtml; output: SafeHtml } {
  const printed = row === null ? null : callLines(row.calls);
  const result =
    row === null
      ? { state: "empty" as const, lines: [] }
      : outputOf(row.read ? "ok" : "sentinel", row.calls);
  return {
    frame: codeFrame({
      label: CALLS_LABEL,
      copyLabel: "Copy calls",
      copyText: printed?.plain ?? "",
      ...(printed === null ? {} : { code: printed.code }),
      minLines: CALL_LINES,
      sizer: CALL_SAMPLE,
      gate: "codeframe",
    }),
    output: callOutput({
      label: OUTPUT_LABEL,
      state: result.state,
      lines: result.lines,
      minLines: CALL_LINES,
    }),
  };
}

function tableOf(rows: readonly LogRow[], group: string): SafeHtml {
  return logTable({
    caption: TABLE_NAME,
    group,
    emptyText: EMPTY_TEXT,
    noLabelText: NO_LABEL_BADGE,
    insertedText: INSERTED_BADGE,
    rows,
  });
}

/** The paste box is as high as its lines, up to the most the tool reads. */
function rowsFor(text: string): number {
  const lines = text.split("\n").length;
  return Math.min(LOG_MAX_LINES, Math.max(MIN_ROWS, lines));
}

function rowOf(r: ReadLine, selected: boolean): LogRow {
  return {
    n: r.n,
    selected,
    token: r.token,
    message: r.message,
    read: r.read,
    utc: r.utc,
    offset: secondsText(r.seconds),
    inserted: r.inserted,
  };
}

/** The hint's paragraph, wrapped so its line is held while it says nothing. */
function droppedHint(id: string): { id: string; html: SafeHtml } {
  const h = hint(id, "");
  return { id, html: html`<span class="${styles.hintSlot}">${h.html}</span>` };
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset. The rows, the plates and the calls are drawn by `mount`, because they come
 * from real library calls.
 */
export function renderTai64nLogReaderTemplate(
  idPrefix: string,
  args: Tai64nLogReaderArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: LogState = isSeeded(args)
    ? readArgs(args)
    : presetState(TAI64N_PRESETS[0]!);
  const presetId = matchPreset(state.values);
  const blank = callsOf(null);

  const log = section(
    { id: id("log"), heading: "1. Paste log lines", level: 4 },
    html`${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Your values", description: "" },
        ...TAI64N_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${field({
      id: id("values"),
      label: "Log lines",
      hint: droppedHint(id("values-hint")),
      control: ({ id: cid, describedBy }) =>
        textArea({
          id: cid,
          value: state.values,
          rows: rowsFor(state.values),
          describedBy,
        }),
    })}`,
  );

  const lines = section(
    { id: id("lines"), heading: "2. What each label says", level: 4 },
    html`${hint(id("pick-hint"), PICK_HINT).html}${grow(
      html`<div id="${id("table")}">${tableOf([], id("group"))}</div>`,
    )}`,
  );

  const selected = section(
    { id: id("selected"), heading: "3. The selected line", level: 4 },
    html`<div class="${styles.frame}"
      ><div id="${id("stage")}">${stageOf(null, false)}</div
      ><div id="${id("calls-slot")}">${blank.frame}</div
      ><div id="${id("output-slot")}">${blank.output}</div
      ><div id="${id("links")}">${linksOf(null)}</div
    ></div>`,
  );

  const writer = section(
    { id: id("write"), heading: "4. Write a label", level: 4 },
    html`${field({
      id: id("instant"),
      label: "Write a label from an instant",
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value: state.instant,
          maxLength: INSTANT_MAX_CHARS,
          spellcheck: false,
          autocomplete: "off",
          describedBy,
        }),
    })}<div id="${id("writer")}">${writerOf(null)}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "TAI64N Log Reader", scope: idPrefix },
    html`${log}<div class="${styles.split}"
      ><div class="${styles.pane}">${lines}</div
      ><div class="${styles.pane} ${styles.details}">${selected}</div
    ></div>${writer}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): LogState;
  apply(state: LogState): void;
  render(): void;
  syncPreset(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: Tai64nLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el, id } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const valuesEl = el<HTMLTextAreaElement>("values");
  const instantEl = el<HTMLInputElement>("instant");
  const group = id("group");

  let selected: number | null = null;
  let rows: ReadLine[] = [];

  const readState = (): LogState => ({
    values: valuesEl.value,
    line: selected,
    instant: instantEl.value,
  });

  function syncPreset(): void {
    presetEl.value = matchPreset(valuesEl.value);
  }

  function drawSelected(): void {
    const row = selected === null ? null : (rows[selected - 1] ?? null);
    const refused = rows.length > 0 && rows.every((r) => !r.read);
    setHtml(el("stage"), stageOf(row, refused));
    const calls = callsOf(row);
    setHtml(el("calls-slot"), calls.frame);
    setHtml(el("output-slot"), calls.output);
    setHtml(el("links"), linksOf(row));
  }

  function drawWriter(): void {
    setHtml(el("writer"), writerOf(writeLabel(instantEl.value, lib)));
  }

  function render(): void {
    const split = splitLog(valuesEl.value);
    rows = readLog(split.lines, lib);
    if (selected === null || selected < 1 || selected > rows.length) {
      selected = defaultLine(rows);
    }
    setHtml(
      el("table"),
      tableOf(
        rows.map((r) => rowOf(r, selected === r.n)),
        group,
      ),
    );
    el("values-hint").textContent = split.dropped > 0 ? DROPPED_HINT : "";
    drawSelected();
    drawWriter();
  }

  function apply(state: LogState): void {
    valuesEl.value = state.values;
    valuesEl.rows = rowsFor(state.values);
    instantEl.value = state.instant;
    selected = state.line;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target === valuesEl) {
        // The picked line stays picked while the list still has it; `render` falls back to
        // the default line when the text no longer reaches that far.
        valuesEl.rows = rowsFor(valuesEl.value);
        syncPreset();
        render();
      } else if (e.target === instantEl) {
        drawWriter();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === presetEl) {
        const chosen = TAI64N_PRESETS.find((p) => p.id === presetEl.value);
        if (!chosen) return;
        valuesEl.value = chosen.lines.join("\n");
        valuesEl.rows = rowsFor(valuesEl.value);
        selected = chosen.selected;
        syncPreset();
        render();
        return;
      }
      if (
        target instanceof HTMLInputElement &&
        target.type === "radio" &&
        target.name === group
      ) {
        selected = Number(target.value);
        // Move the current row in place: redrawing the table would drop the keyboard focus.
        for (const tr of widgetEl.querySelectorAll<HTMLElement>(
          "tr[role='row']",
        )) {
          if (tr.contains(target)) tr.setAttribute("aria-current", "true");
          else tr.removeAttribute("aria-current");
        }
        drawSelected();
      }
    },
    { signal },
  );

  // The whole row picks its line: a click anywhere in it, outside the radio and its label,
  // clicks the radio. The radio stays the keyboard path. Dragging across a row to copy its
  // text is a selection, not a pick.
  widgetEl.addEventListener(
    "click",
    (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("label, input, a, button")) return;
      const tr = target.closest<HTMLElement>("tbody tr[role='row']");
      if (!tr || !widgetEl.contains(tr)) return;
      if (window.getSelection()?.toString()) return;
      tr.querySelector<HTMLInputElement>("input[type='radio']")?.click();
    },
    { signal },
  );

  // The template seeds a preset; opening on it selects the preset's line.
  const initial = TAI64N_PRESETS.find(
    (p) => p.id === matchPreset(valuesEl.value),
  );
  selected = initial ? initial.selected : null;
  syncPreset();
  render();

  return { readState, apply, render, syncPreset };
}

export const mountTai64nLogReader: MountFn<Tai64nLogReaderArgs> = async (
  root,
  args = {},
  signal,
) => {
  defineElements();
  let lib: Tai64nLib;
  try {
    lib = await loadTai64nLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    widget.apply(readArgs(args));
    widget.syncPreset();
    widget.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(widget.readState()),
  );
};
