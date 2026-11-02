/**
 * The Expiry Calculator widget (CORE-104), mountable on its tool page and in the chat rail.
 *
 * The reader gives a length (an amount and one unit) and a start: a date they type or drag, or
 * Now. Four plates show that one length as a cookie `Max-Age`, an `Expires` header, a JWT `exp`
 * and a signed-URL time. A table sets twelve monthly starts beside a hand-written number.
 * Everything on screen is a library call except that number (`expiry-calculator.ts` builds the
 * rows).
 *
 * Built on the component kit: `renderExpiryCalculatorTemplate` writes the markup from builders
 * only, with ids from `idScope(idPrefix)`, and never reads the clock. `mount` finds its parts by
 * those ids and delegates every listener on the widget with the mount's `signal`. With Now
 * chosen, one `ttlFromNow` a second fills the plates and the printed calls; the table does not
 * tick. Every result slot holds the widest text it can show, so nothing moves while a reader
 * drags or the clock ticks.
 */
import { defineElements } from "~/widgets/define";
import {
  aside,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  gateAttr,
  hint,
  html,
  idScope,
  plates,
  section,
  select,
  setHtml,
  srOnly,
  table,
  textInput,
  verdict,
  widget,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import { heldText, type HeldState } from "~/widgets/families/holiday/held-text";
import { reservedText } from "~/widgets/families/holiday/reserved-text";
import { chips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/expiry-calculator.module.css";
import {
  AMOUNT_MAX_LENGTH,
  CALL_LINES,
  CUSTOM_PRESET_ID,
  EXPIRY_PRESETS,
  EXPIRY_UNITS,
  NO_RESULT_TEXT,
  ROW_COUNT,
  SLIDER_DAYS,
  START_MAX_LENGTH,
  callsOf,
  callsSizerLine,
  compare,
  dayOf,
  handWritten,
  isSeeded,
  matchPreset,
  permalinkOf,
  platesOf,
  presetState,
  readArgs,
  readTtl,
  sentenceOf,
  sliderEnds,
  startAt,
  stripRows,
  takeSnapshot,
  verdictSamples,
  verdictText,
  type ExpiryArgs,
  type ExpiryState,
  type PlateValues,
  type StripRow,
  type VerdictText,
} from "./expiry-calculator";
import { loadExpiryLib, type ExpiryLib, type ExpiryTtl } from "./expiry-lib";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { ExpiryArgs } from "./expiry-calculator";

const WIDGET_NAME = "expiry-calculator";
const READING_YOUR_CLOCK = "Reading your clock…";
/** The widest start the library places. */
const WIDEST_TIME = "+275760-09-13T00:00:00Z";
/** The widest seconds a plate or a cell can show. */
const WIDEST_SECONDS = "-8640000000000";
const WIDEST_HTTP_DATE = "Thu, 15 Jun 2028 12:00:00 GMT";
const WIDEST_WORD = "Short by 8640000000000 s";
/** Milliseconds after a settled change before the status speaks. */
const SPEAK_DELAY_MS = 500;

const HINT_NOW_RESULT =
  "Now is your clock, live. All four plates come from one ttlFromNow call, so they name one instant.";
const HINT_NOW_NULL =
  "ttlFromNow takes a whole length of zero or more, and its end needs a four-digit year. A past Expires is formatHttpDate(getUtcAgo({ days: 1 })).";
const HINT_DATE =
  "A date is pinned: the four plates come from the start below, and the same start always gives the same answer.";
const HINTS = [HINT_NOW_RESULT, HINT_NOW_NULL, HINT_DATE];

const NOTE_DATE = "The starts count from the start above.";
const NOTE_NOW = "Starts counted from the moment you chose Now.";
const NOTES = [NOTE_DATE, NOTE_NOW];

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function liveGate(state: ExpiryState, ...gates: string[]): string | undefined {
  const list = state.mode === "now" ? [...gates, "live"] : gates;
  return list.length === 0 ? undefined : list.join(" ");
}

function platesBlock(
  values: PlateValues,
  state: ExpiryState,
  reading: boolean,
): SafeHtml {
  const text = (v: string | number | null, shown: string | null = null) =>
    v === null ? (reading ? READING_YOUR_CLOCK : null) : (shown ?? String(v));
  const list: Plate[] = [
    {
      caption: "Cookie Max-Age",
      value: text(values.maxAge),
      lines: ["Set-Cookie: Max-Age, in seconds"],
      lineSamples: [["Set-Cookie: Max-Age, in seconds"]],
      series: 1,
      samples: [WIDEST_SECONDS],
    },
    {
      caption: "Expires",
      value: text(values.expires),
      lines: ["Set-Cookie: Expires, an HTTP date"],
      lineSamples: [["Set-Cookie: Expires, an HTTP date"]],
      series: 2,
      samples: [WIDEST_HTTP_DATE],
    },
    {
      caption: "JWT exp",
      value: text(values.exp),
      lines: ["JWT claim exp, in Unix seconds"],
      lineSamples: [["JWT claim exp, in Unix seconds"]],
      series: 3,
      samples: [WIDEST_SECONDS],
    },
    {
      caption: "Signed-URL time",
      value: text(values.signed),
      lines: ["A signed URL's expiry, in UTC"],
      lineSamples: [["A signed URL's expiry, in UTC"]],
      series: 4,
      samples: [WIDEST_TIME],
    },
  ];
  return plates(list, { gate: liveGate(state) });
}

function verdictBlock(v: VerdictText, state: ExpiryState): SafeHtml {
  return html`<div class="${styles.hold}" data-gate="${liveGate(state, "hold")}"
    ><div class="${styles.liveVerdict}"
      >${verdict({ tone: v.tone, title: v.title, detail: v.detail })}</div
    >${verdictSamples().map(
      (sample) =>
        html`<div class="${styles.ghost}" aria-hidden="true" data-pagefind-ignore
          >${verdict({ tone: sample.tone, title: sample.title, detail: sample.detail })}</div
        >`,
    )}</div
  >`;
}

function callsBlock(text: string, state: ExpiryState): SafeHtml {
  return codeFrame({
    label: "Calls",
    copyLabel: "Copy calls",
    copyText: text,
    code: html`${text}`,
    gate: liveGate(state, "codeframe"),
    minLines: CALL_LINES,
    sizer: callsSizerLine(),
  });
}

function hintBlock(text: string, tone: HeldState): SafeHtml {
  return heldText({
    label: "About the start",
    text,
    state: tone,
    sizers: HINTS,
    gate: "hold",
  });
}

function noteBlock(text: string): SafeHtml {
  return heldText({
    label: "Where the starts count from",
    text,
    state: "note",
    sizers: NOTES,
    gate: "hold",
  });
}

function cell(text: string | null, samples: readonly string[]): SafeHtml {
  return html`<span class="${styles.cell}"
    >${reservedText({
      text: text ?? NO_RESULT_TEXT,
      state: text === null ? "off" : "live",
      samples: [...samples, NO_RESULT_TEXT],
    })}</span
  >`;
}

type ColumnKey = "start" | "ends" | "seconds" | "word";

const COLUMNS = [
  { key: "start", header: "Start", align: "start", numeric: false },
  { key: "ends", header: "Ends", align: "start", numeric: false },
  { key: "seconds", header: "Seconds", align: "start", numeric: false },
  {
    key: "word",
    header: "Against the fixed number",
    align: "start",
    numeric: false,
  },
] as const;

function rowOf(row: StripRow): Record<ColumnKey, SafeHtml> {
  const differs = row.word.startsWith("Short") || row.word.startsWith("Long");
  return {
    start: cell(row.start, [WIDEST_TIME]),
    ends: cell(row.ends, [WIDEST_TIME]),
    seconds: cell(row.seconds === null ? null : String(row.seconds), [
      WIDEST_SECONDS,
    ]),
    word: html`<span class="${differs ? `${styles.verdictCell} ${styles.differs}` : styles.verdictCell}"
      >${cell(row.word === NO_RESULT_TEXT ? null : row.word, [WIDEST_WORD])}</span
    >`,
  };
}

function blankStrip(): StripRow[] {
  return Array.from({ length: ROW_COUNT }, () => ({
    start: null,
    ends: null,
    seconds: null,
    word: NO_RESULT_TEXT,
  }));
}

function stripBlock(rows: readonly StripRow[]): SafeHtml {
  return html`<div class="${styles.strip}"
    >${table<ColumnKey>({
      caption: "Length from each of the next 12 starts",
      columns: COLUMNS,
      rows: rows.map(rowOf),
      rowHeader: "start",
      layout: "fixed",
      widths: ["30%", "30%", "18%"],
      currentRow: 0,
      labelCells: true,
      gate: "grid",
    })}</div
  >`;
}

function hintFor(
  state: ExpiryState,
  ttl: ExpiryTtl | null | undefined,
): {
  text: string;
  tone: HeldState;
} {
  if (state.mode === "date") return { text: HINT_DATE, tone: "ok" };
  return ttl === null
    ? { text: HINT_NOW_NULL, tone: "note" }
    : { text: HINT_NOW_RESULT, tone: "note" };
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset. It never calls the library or reads the clock: `mount` draws every result.
 */
export function renderExpiryCalculatorTemplate(
  idPrefix: string,
  args: ExpiryArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state = isSeeded(args)
    ? readArgs(args)
    : presetState(EXPIRY_PRESETS[0]!);
  const now = state.mode === "now";
  const presetId = matchPreset(state);
  const startHint = hint(
    id("start-hint"),
    "An ISO time in UTC, such as 2027-06-15T12:00:00Z.",
  );
  const first = hintFor(state, undefined);
  const none = verdictText({ kind: "none", gap: 0 }, null, state.unit);

  const inputs = section(
    { id: id("input"), heading: "Length and start", level: 3 },
    html`${fieldGrid(
      html`<div class="${styles.controls}"><div class="${styles.wide}">${preset(
        {
          id: id("preset"),
          label: "Preset",
          value: presetId,
          options: [
            { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
            ...EXPIRY_PRESETS.map((p) => ({
              value: p.id,
              label: p.label,
              description: p.description,
            })),
          ],
        },
      )}</div>${field({
        id: id("amount"),
        label: "Amount",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.amount,
            inputMode: "numeric",
            autocomplete: "off",
            spellcheck: false,
            maxLength: AMOUNT_MAX_LENGTH,
          }),
      })}${field({
        id: id("unit"),
        label: "Unit",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.unit,
            options: EXPIRY_UNITS.map((u) => ({ value: u, label: u })),
          }),
      })}<div class="${styles.wide}">${chips({
        legend: "Start",
        kind: "radio",
        name: id("start-mode"),
        items: [
          { value: "date", label: "A date", checked: !now },
          { value: "now", label: "Now", checked: now },
        ],
      })}<div id="${id("hint")}">${hintBlock(first.text, first.tone)}</div></div>${field(
        {
          id: id("start"),
          label: "Start date",
          hint: startHint,
          control: ({ id: cid, describedBy }) =>
            textInput({
              id: cid,
              value: state.start,
              inputMode: "text",
              autocomplete: "off",
              spellcheck: false,
              maxLength: START_MAX_LENGTH,
              describedBy,
            }),
        },
      )}<div class="${styles.wide}">${range({
        id: id("slider"),
        label: "Move the start",
        min: -SLIDER_DAYS,
        max: SLIDER_DAYS,
        step: 1,
        value: 0,
        valueText: dayOf(state.start),
        ends: [`${-SLIDER_DAYS} days`, `+${SLIDER_DAYS} days`],
        disabled: now,
      })}</div></div>`,
    )}`,
  );

  const results = section(
    { id: id("results"), heading: "The same length, four ways", level: 3 },
    html`<div class="${styles.plates}" ${gateAttr("frame")}>${grow(
      html`<div class="${styles.slot}" id="${id("plates")}">${platesBlock(
        { maxAge: null, expires: null, exp: null, signed: null },
        state,
        now,
      )}</div>`,
    )}</div
      ><div id="${id("verdict")}">${verdictBlock(none, state)}</div
      >${grow(
        html`<div class="${styles.slot}" id="${id("calls")}">${callsBlock("", state)}</div>`,
      )}${aside(
        {
          label: "Browser cap",
          tone: "note",
          title: "Browsers may cap this at 400 days",
        },
        html`<p>A draft revision of RFC 6265 has browsers cap <code>Max-Age</code> and <code>Expires</code> at 400 days. GMT applies no cap, and these results are the full length. A cap is yours to apply.</p>`,
      )}<p role="status" aria-label="Summary" id="${id("status")}">${srOnly("")}</p>`,
  );

  const strip = section(
    { id: id("strip"), heading: "The next 12 starts", level: 3 },
    html`<div id="${id("note")}">${noteBlock(now ? NOTE_NOW : NOTE_DATE)}</div
      ><div id="${id("table")}">${stripBlock(blankStrip())}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Expiry Calculator", scope: idPrefix },
    html`${inputs}${results}${strip}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): ExpiryState;
  apply(state: ExpiryState): void;
  destroy(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: ExpiryLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const amountEl = el<HTMLInputElement>("amount");
  const unitEl = el<HTMLSelectElement>("unit");
  const startEl = el<HTMLInputElement>("start");
  const sliderEl = el("slider").closest<GmtRange>("gmt-range")!;
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const modeInputs = [
    ...widgetEl.querySelectorAll<HTMLInputElement>("[type=radio]"),
  ];

  let state: ExpiryState = presetState(EXPIRY_PRESETS[0]!);
  /** The start the slider moves around, set by a preset or a settled typed value. */
  let anchor = state.start;
  let offset = 0;
  /** `undefined` until the first read; `null` is the library's refusal. */
  let ttl: ExpiryTtl | null | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  let speakTimer: ReturnType<typeof setTimeout> | undefined;
  let stripRefused = false;
  let destroyed = false;

  function stopClock(): void {
    if (interval !== undefined) {
      clearInterval(interval);
      interval = undefined;
    }
  }

  function syncSlider(): void {
    sliderEl.formatValue = (n) => dayOf(startAt(lib, anchor, n));
    const [low, high] = sliderEnds(lib, anchor);
    sliderEl.ends = [dayOf(low), dayOf(high)];
    sliderEl.value = offset;
  }

  function syncControls(): void {
    const now = state.mode === "now";
    amountEl.value = state.amount;
    unitEl.value = state.unit;
    startEl.value = state.start;
    startEl.disabled = now;
    sliderEl.disabled = now;
    for (const input of modeInputs) input.checked = input.value === state.mode;
    syncSlider();
  }

  function drawLive(): void {
    const values = platesOf(lib, state, ttl);
    const hand = handWritten(state);
    const cmp = compare(values.maxAge, hand);
    const reading = state.mode === "now" && ttl === undefined;
    setHtml(el("plates"), platesBlock(values, state, reading));
    setHtml(
      el("verdict"),
      verdictBlock(verdictText(cmp, hand, state.unit), state),
    );
    setHtml(
      el("calls"),
      callsBlock(callsOf(lib, state, ttl).join("\n"), state),
    );
    const h = hintFor(state, ttl);
    setHtml(el("hint"), hintBlock(h.text, h.tone));
  }

  function drawStrip(): void {
    stripRefused = state.mode === "now" && ttl === null;
    setHtml(el("note"), noteBlock(state.mode === "now" ? NOTE_NOW : NOTE_DATE));
    setHtml(el("table"), stripBlock(stripRows(lib, state, stripRefused)));
  }

  function draw(): void {
    presetEl.value = matchPreset(state);
    drawLive();
    drawStrip();
  }

  function speak(): void {
    const values = platesOf(lib, state, ttl);
    const hand = handWritten(state);
    const cmp = compare(values.maxAge, hand);
    setHtml(el("status"), srOnly(sentenceOf(values, cmp, hand, state.unit)));
  }

  /** The status speaks once a change has settled, never on a clock tick. */
  function queueSpeak(): void {
    clearTimeout(speakTimer);
    speakTimer = setTimeout(speak, SPEAK_DELAY_MS);
  }

  function tick(): void {
    ttl = readTtl(lib, state);
    drawLive();
    if (state.mode === "now" && (ttl === null) !== stripRefused) drawStrip();
  }

  function startClock(): void {
    stopClock();
    state.snapshot = takeSnapshot(lib);
    ttl = readTtl(lib, state);
    interval = setInterval(tick, 1000);
  }

  function chooseMode(mode: ExpiryState["mode"]): void {
    if (mode === state.mode) return;
    state.mode = mode;
    if (mode === "now") {
      startClock();
    } else {
      stopClock();
      ttl = undefined;
      state.snapshot = "";
    }
    syncControls();
    draw();
  }

  /** The length changed under Now: a new snapshot and a fresh read. */
  function relength(): void {
    if (state.mode !== "now") return;
    state.snapshot = takeSnapshot(lib);
    ttl = readTtl(lib, state);
  }

  function reanchor(start: string): void {
    if (!lib.isValidUtc(start)) return;
    anchor = start;
    offset = 0;
    syncSlider();
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === amountEl) {
        state.amount = amountEl.value;
        relength();
        draw();
        queueSpeak();
      } else if (target === startEl) {
        state.start = startEl.value;
        draw();
        queueSpeak();
      } else if (target === sliderEl) {
        offset = sliderEl.value;
        state.start = startAt(lib, anchor, offset);
        startEl.value = state.start;
        draw();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === unitEl) {
        state.unit = unitEl.value as ExpiryState["unit"];
        relength();
        draw();
        queueSpeak();
      } else if (target === startEl) {
        // A typed value settles: the slider now moves around it.
        reanchor(state.start);
        draw();
        queueSpeak();
      } else if (target === sliderEl) {
        queueSpeak();
      } else if (target === presetEl) {
        const chosen = EXPIRY_PRESETS.find((p) => p.id === presetEl.value);
        if (chosen) {
          apply(presetState(chosen));
          queueSpeak();
        }
      } else if (
        target instanceof HTMLElement &&
        target.localName === "gmt-chips"
      ) {
        const value = (e as CustomEvent<{ value: string }>).detail?.value;
        if (value === "date" || value === "now") {
          chooseMode(value);
          queueSpeak();
        }
      }
    },
    { signal },
  );

  function apply(next: ExpiryState): void {
    stopClock();
    ttl = undefined;
    state = next;
    anchor = lib.isValidUtc(state.start)
      ? state.start
      : EXPIRY_PRESETS[0]!.start;
    offset = 0;
    if (state.mode === "now") startClock();
    syncControls();
    draw();
  }

  function destroy(): void {
    destroyed = true;
    stopClock();
    clearTimeout(speakTimer);
  }

  signal.addEventListener("abort", destroy, { once: true });
  apply(state);

  return {
    readState: () => state,
    apply: (next) => {
      if (!destroyed) apply(next);
    },
    destroy,
  };
}

export const mountExpiryCalculator: MountFn<ExpiryArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: ExpiryLib;
  try {
    lib = await loadExpiryLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, signal);
  if (isSeeded(args)) controller.apply(readArgs(args));

  return onceDestroy(controller.destroy, () =>
    permalinkOf(controller.readState()),
  );
};
