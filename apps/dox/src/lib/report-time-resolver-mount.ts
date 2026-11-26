/**
 * The Report Time Resolver widget (AV-98), mountable on its tool page and in the chat rail.
 *
 * Section 1 reads a METAR, SPECI or TAF-issue time group (`302350Z`) against a reference the
 * reader states, with `parseMetarTime` and `isValidMetarTime`, and draws the candidate months
 * on a strip of seven fixed slots. A slider moves the reference up to a month either way; the
 * strip is anchored on the answer at the typed reference, so only the reference mark and the
 * chosen mark move while it is dragged. Everything on screen is a library call; the widget
 * computes no date, no day count and no distance (`report-time-resolver.ts` builds the readings).
 *
 * Built on the component kit: `renderReportTimeResolverTemplate` writes the markup from builders
 * only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids and delegates
 * every listener on the widget with the mount's `signal`. Every region is laid out in every state
 * and holds the widest of its texts, so typing or dragging never moves a plate, the reason, the
 * strip, the table or a calls frame.
 *
 * A refusal from the library reads NO SIGNAL (amber). A box nobody typed in makes no call and
 * reads "nothing typed".
 *
 * Section 2 reads NOTAM items B) and C) with `parseNotamValidity` in a window the reader states.
 * The two sections share a widget and nothing else: each redraws only its own regions.
 */
import { defineElements } from "~/widgets/define";
import {
  axis,
  badge,
  codeFrame,
  disclosure,
  field,
  findWidget,
  hint,
  html,
  idScope,
  lane,
  mark,
  section,
  setHtml,
  table,
  textInput,
  tick,
  widget,
  wireDisclosure,
  type SafeHtml,
} from "~/widgets/builders";
import { heldText, type HeldState } from "~/widgets/families/holiday/held-text";
import { holidayFrame } from "~/widgets/families/holiday/holiday-frame";
import { reservedText } from "~/widgets/families/holiday/reserved-text";
import {
  signalPlates,
  type SignalPlate,
} from "~/widgets/families/holiday/signal-plates";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/report-time-resolver.module.css";
import { loadAviationLib, type AviationLib } from "./aviation-lib";
import {
  ANSWER_REASONS,
  CUSTOM_PRESET_ID,
  DASH,
  DEFAULT_NOTAM_PRESET_ID,
  DEFAULT_PRESET_ID,
  INSTANT_SAMPLE,
  METAR_PRESETS,
  NOTAM_INSTANT_SAMPLE,
  NOTAM_PRESETS,
  NOTAM_REASONS,
  NOTHING_TYPED,
  NOT_MOVED,
  OUTSIDE_RANGE,
  OUT_OF_RANGE_MONTH,
  PERMANENT_TEXT,
  SIDE_TEXTS,
  SLIDER_HINTS,
  SLOT_OFFSETS,
  buildModel,
  buildNotamModel,
  callsSizerText,
  isNotamSeeded,
  isSeeded,
  matchNotamPreset,
  matchPreset,
  notamCallsSizerText,
  notamPermalinkOf,
  notamPresetState,
  permalinkOf,
  presetState,
  readArgs,
  readNotamArgs,
  shiftText,
  withGroup,
  withReference,
  type AnswerReasonKey,
  type CallsSection,
  type MetarArgs,
  type MetarModel,
  type MetarState,
  type NotamArgs,
  type NotamModel,
  type NotamReasonKey,
  type NotamState,
  type SliderHintKey,
  type StripModel,
  type StripSlot,
} from "./report-time-resolver";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

/** What a link or the chat can seed: section 1's arguments and section 2's. */
export type ReportTimeResolverArgs = MetarArgs & NotamArgs;

const WIDGET_NAME = "report-time-resolver";

/** What the strip note reads when the answer is not on the seven slots. */
export const BEYOND_TEXT =
  "The answer is beyond the strip: it sits at the edge of the instant range, where a candidate was dropped.";

/** The widest a candidate reads in the table (minutes precision, as the library returns it). */
const CANDIDATE_SAMPLE = "2024-06-30T23:50:00Z";

/** The widest distance: `formatDuration`'s short style at a full day, hour and minute. */
const DISTANCE_SAMPLE = "30 days, 23 hr, & 59 min";

/** The widest month label. */
const MONTH_SAMPLE = "Sept 2024";
/** The row header with no strip drawn: a header must read as text, so a bare dash is not one. */
const NO_MONTH = "no strip";

/** The word the chosen row carries. */
const CHOSEN_WORD = "chosen";

// ---------------------------------------------------------------------------
// Held texts
// ---------------------------------------------------------------------------

const REASON_TEXTS = Object.values(ANSWER_REASONS);
const HINT_TEXTS = Object.values(SLIDER_HINTS);

type FrameKey = CallsSection | "notam";

const SECTION_LABELS: Record<FrameKey, string> = {
  answer: "the report time",
  strip: "the strip",
  notam: "the NOTAM validity",
};

function reasonState(key: AnswerReasonKey): HeldState {
  return key === "read" || key === "empty" ? "note" : "sentinel";
}

function reasonOf(key: AnswerReasonKey): SafeHtml {
  return heldText({
    label: "Reason for the report time",
    text: ANSWER_REASONS[key],
    state: reasonState(key),
    sizers: REASON_TEXTS,
    gate: "hold",
  });
}

function sliderHintOf(key: SliderHintKey): SafeHtml {
  return heldText({
    label: "About moving the reference",
    text: SLIDER_HINTS[key],
    state: "note",
    sizers: HINT_TEXTS,
    gate: "hold",
  });
}

function stripNoteOf(beyond: boolean): SafeHtml {
  return heldText({
    label: "Note on the strip",
    text: beyond ? BEYOND_TEXT : "",
    state: beyond ? "note" : "ok",
    sizers: [BEYOND_TEXT],
    gate: "hold",
  });
}

// ---------------------------------------------------------------------------
// Plates
// ---------------------------------------------------------------------------

function platesOf(m: MetarModel | null): SafeHtml {
  const blankGroup = m === null || m.answer.blank;
  const blankRef = m === null || m.reference.blank;
  const list: SignalPlate[] = [
    {
      caption: "Report time",
      value: blankGroup ? NOTHING_TYPED : m.answer.answer,
      line: "parseMetarTime",
      lineSamples: ["parseMetarTime"],
      series: 1,
      samples: [INSTANT_SAMPLE, NOTHING_TYPED],
    },
    {
      caption: "Reference in UTC",
      value: blankRef ? NOTHING_TYPED : m.reference.utc,
      line: "toOffsetInstant",
      lineSamples: ["toOffsetInstant"],
      series: 2,
      samples: [INSTANT_SAMPLE, NOTHING_TYPED],
    },
  ];
  return signalPlates(list, { gate: "hero" });
}

// ---------------------------------------------------------------------------
// The strip: timeline and table
// ---------------------------------------------------------------------------

/** The axis when nothing is drawn: five placeholders, so the axis keeps its height. */
const BLANK_TICKS = [0, 0.25, 0.5, 0.75, 1];

function timelineOf(strip: StripModel | null): SafeHtml {
  const drawn = strip !== null && strip.drawn;
  const reference =
    drawn && strip.referenceAt !== null
      ? mark({
          label: `${strip.referenceLabel}, the reference`,
          at: strip.referenceAt,
          series: 3,
        })
      : "";
  const candidates = drawn
    ? strip.slots
        .filter((s) => s.candidate !== null)
        .map((s) =>
          mark({
            label: s.chosen ? `${s.label}, chosen` : s.label,
            at: s.at,
            series: s.chosen ? 2 : 1,
            emphasis: s.chosen,
          }),
        )
    : "";
  const ticks = drawn
    ? strip.ticks.map((t) => tick({ at: t.at, label: t.label }))
    : BLANK_TICKS.map((at) => tick({ at, label: " " }));
  return html`<div class="${styles.seam}"
    >${lane({ label: "Reference", gate: "drawn" }, reference)}${lane(
      { label: "Candidates", gate: "drawn" },
      candidates,
    )}${axis(ticks)}</div
  >`;
}

type ColumnKey = "month" | "candidate" | "side" | "distance" | "chosen";

const COLUMNS = [
  { key: "month", header: "Month", align: "start", numeric: true },
  { key: "candidate", header: "Candidate", align: "start", numeric: true },
  { key: "side", header: "Side", align: "start", numeric: false },
  { key: "distance", header: "Distance", align: "start", numeric: true },
  { key: "chosen", header: "Chosen", align: "start", numeric: false },
] as const;

const GAP_SAMPLES = [OUTSIDE_RANGE, "no 31 in Sept"];

/** `words` lets the cell break at a space: a side or a distance is words, not an instant. */
function cell(
  text: string,
  samples: readonly string[],
  words = false,
): SafeHtml {
  return html`<span class="${styles.cell}${words ? ` ${styles.words}` : ""}"
    >${reservedText({ text, samples: [...samples, DASH] })}</span
  >`;
}

function rowOf(slot: StripSlot | null, k: number): Record<ColumnKey, SafeHtml> {
  const gap = slot?.gap ?? null;
  return {
    month: cell(slot?.month ? slot.month : NO_MONTH, [
      MONTH_SAMPLE,
      OUT_OF_RANGE_MONTH,
      NO_MONTH,
    ]),
    candidate: cell(slot?.candidate ?? gap ?? DASH, [
      CANDIDATE_SAMPLE,
      ...GAP_SAMPLES,
    ]),
    side: cell(
      slot?.side === null || slot?.side === undefined
        ? DASH
        : SIDE_TEXTS[slot.side],
      Object.values(SIDE_TEXTS),
      true,
    ),
    distance: cell(slot?.distance ?? DASH, [DISTANCE_SAMPLE], true),
    chosen: html`<span class="${styles.cell}" data-slot="${String(k)}"
      >${reservedText({
        text: slot?.chosen === true ? CHOSEN_WORD : "",
        state: slot?.chosen === true ? "live" : "off",
        samples: [CHOSEN_WORD],
      })}</span
    >`,
  };
}

function gridOf(strip: StripModel | null): SafeHtml {
  const rows = SLOT_OFFSETS.map((k) =>
    rowOf(strip?.slots.find((s) => s.k === k) ?? null, k),
  );
  return html`<div class="${styles.strip}"
    >${table<ColumnKey>({
      caption:
        "The seven candidate months around the answer, with the library's choice marked",
      columns: COLUMNS,
      rows,
      rowHeader: "month",
      layout: "fixed",
      widths: ["17%", "33%", "17%", "21%"],
      labelCells: true,
      gate: "grid",
    })}</div
  >`;
}

// ---------------------------------------------------------------------------
// Calls frames
// ---------------------------------------------------------------------------

const SIZER_LINES: Record<FrameKey, number> = {
  answer: callsSizerText("answer").split("\n").length,
  strip: callsSizerText("strip").split("\n").length,
  notam: notamCallsSizerText().split("\n").length,
};

function callsOf(which: FrameKey, text: string): SafeHtml {
  return codeFrame({
    label: `Calls made for ${SECTION_LABELS[which]}`,
    copyLabel: `Copy the calls for ${SECTION_LABELS[which]}`,
    copyText: text,
    code: html`${text}`,
    gate: "codeframe",
    // The widest reading prints every call; the frame holds that many lines.
    minLines: SIZER_LINES[which],
  });
}

function callsSlot(id: string, which: FrameKey): SafeHtml {
  return grow(
    html`<div class="${styles.slot}" id="${id}">${callsOf(which, "")}</div>`,
  );
}

// ---------------------------------------------------------------------------
// Section 2: NOTAM validity
// ---------------------------------------------------------------------------

const ESTIMATE_TEXT = "estimate";

const NOTAM_WINDOW_ITEMS = [
  { value: "fixed", label: "Fixed from" },
  { value: "rolling", label: "Rolling" },
] as const;

const NOTAM_REASON_TEXTS = Object.values(NOTAM_REASONS);

/** A refusal is the sentinel; everything the library read is a plain note. */
function notamReasonState(key: NotamReasonKey): HeldState {
  switch (key) {
    case "emptyB":
    case "emptyC":
    case "read":
    case "estimated":
    case "permanent":
    case "markedInB":
      return "note";
    default:
      return "sentinel";
  }
}

function notamReasonOf(which: "b" | "c", key: NotamReasonKey): SafeHtml {
  return heldText({
    label: `Reason for item ${which.toUpperCase()})`,
    text: NOTAM_REASONS[key],
    state: notamReasonState(key),
    sizers: NOTAM_REASON_TEXTS,
    gate: "hold",
  });
}

function notamValueOf(r: NotamModel["b"] | null): string | null {
  if (r === null || r.blank) return NOTHING_TYPED;
  if (r.value === null) return null;
  return r.value.kind === "permanent" ? PERMANENT_TEXT : r.value.instant;
}

function notamPlatesOf(m: NotamModel | null): SafeHtml {
  const samples = [NOTAM_INSTANT_SAMPLE, PERMANENT_TEXT, NOTHING_TYPED];
  const list: SignalPlate[] = [
    {
      caption: "In force from (B)",
      value: notamValueOf(m?.b ?? null),
      line: "parseNotamValidity",
      lineSamples: ["parseNotamValidity"],
      series: 1,
      samples,
    },
    {
      caption: "Ends (C)",
      value: notamValueOf(m?.c ?? null),
      line: "parseNotamValidity",
      lineSamples: ["parseNotamValidity"],
      series: 2,
      samples,
    },
  ];
  return signalPlates(list, { gate: "hero" });
}

/**
 * The estimate badge slot: it always takes its room (a hidden twin), and shows only when the
 * library says the instant is an estimate. Its accent is a bottom edge, never a left one.
 */
function estimateOf(on: boolean): SafeHtml {
  const mark = badge({ text: ESTIMATE_TEXT, tone: "neutral" });
  return html`<div class="${styles.badgeHold}"
    >${on ? html`<span class="${styles.badgeOn}">${mark}</span>` : ""}<span
      class="${styles.badgeGhost}"
      aria-hidden="true"
      >${mark}</span
    ></div
  >`;
}

function isEstimate(r: NotamModel["b"] | null): boolean {
  return r?.value?.kind === "instant" && r.value.estimated;
}

function notamBadgesOf(m: NotamModel | null): SafeHtml {
  return html`<div class="${styles.pair}"
    >${estimateOf(isEstimate(m?.b ?? null))}${estimateOf(isEstimate(m?.c ?? null))}</div
  >`;
}

function notamReasonsOf(m: NotamModel | null): SafeHtml {
  return html`<div class="${styles.pair}"
    >${notamReasonOf("b", m?.b.reason ?? "emptyB")}${notamReasonOf("c", m?.c.reason ?? "emptyC")}</div
  >`;
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

function sliderOf(id: string, ref: MetarModel["reference"] | null): SafeHtml {
  return range({
    id,
    label: "Move the reference",
    min: ref?.min ?? 0,
    max: ref?.max ?? 0,
    step: 1,
    value: ref?.shift ?? 0,
    valueText: NOT_MOVED,
    ends: [DASH, DASH],
    disabled: ref === null || !ref.movable,
    gate: "track",
  });
}

function initialMetar(args: ReportTimeResolverArgs): MetarState {
  return isSeeded(args)
    ? readArgs(args)
    : presetState(METAR_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!);
}

function initialNotam(args: ReportTimeResolverArgs): NotamState {
  return isNotamSeeded(args)
    ? readNotamArgs(args)
    : notamPresetState(
        NOTAM_PRESETS.find((p) => p.id === DEFAULT_NOTAM_PRESET_ID)!,
      );
}

function notamSection(
  id: (name: string) => string,
  state: NotamState,
): SafeHtml {
  const rolling = state.mode === "rolling";
  return section(
    { id: id("notam"), heading: "2 · NOTAM validity", level: 3, gate: "notam" },
    html`<div class="${styles.controls}"><div class="${styles.wide}">${preset({
      id: id("n-preset"),
      label: "NOTAM preset",
      value: matchNotamPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...NOTAM_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}</div>${field({
      id: id("n-b"),
      label: "Item B)",
      hint: hint(
        id("n-b-hint"),
        "When the NOTAM comes into force: ten digits, YYMMDDhhmm, as typed in the message.",
      ),
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value: state.itemB,
          autocomplete: "off",
          spellcheck: false,
          maxLength: 16,
          describedBy,
        }),
    })}${field({
      id: id("n-c"),
      label: "Item C)",
      hint: hint(
        id("n-c-hint"),
        "When it ends: ten digits, with EST after them for an estimate, or PERM.",
      ),
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value: state.itemC,
          autocomplete: "off",
          spellcheck: false,
          maxLength: 16,
          describedBy,
        }),
    })}<div class="${styles.wide}" id="${id("n-window-slot")}">${chips({
      legend: "Window",
      kind: "radio",
      name: id("n-window"),
      items: NOTAM_WINDOW_ITEMS.map((i) => ({
        ...i,
        checked: i.value === (rolling ? "rolling" : "fixed"),
      })),
    })}</div><div class="${styles.away}" id="${id("n-first-field")}" ${rolling ? html`data-away inert aria-hidden="true"` : ""}>${field(
      {
        id: id("n-first"),
        label: "First year",
        hint: hint(
          id("n-first-hint"),
          "The first of the hundred years a two-digit year can mean.",
        ),
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: state.first,
            inputMode: "numeric",
            autocomplete: "off",
            spellcheck: false,
            maxLength: 6,
            describedBy,
          }),
      },
    )}</div></div>${holidayFrame(
      html`<div class="${styles.slot}" id="${id("n-plates")}">${notamPlatesOf(null)}</div
        ><div class="${styles.slot}" id="${id("n-badges")}">${notamBadgesOf(null)}</div
        ><div id="${id("n-reasons")}">${notamReasonsOf(null)}</div>`,
      { gate: "frame" },
    )}${callsSlot(id("n-calls"), "notam")}`,
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset. The readings are drawn blank here, without the library; `mount` draws every
 * result.
 */
export function renderReportTimeResolverTemplate(
  idPrefix: string,
  args: ReportTimeResolverArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state = initialMetar(args);
  const nstate = initialNotam(args);

  const metar = section(
    { id: id("metar"), heading: "1 · METAR report time", level: 3 },
    html`<div class="${styles.controls}"><div class="${styles.wide}">${preset({
      id: id("preset"),
      label: "METAR preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...METAR_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}</div>${field({
      id: id("group"),
      label: "Group",
      hint: hint(
        id("group-hint"),
        "A METAR, SPECI or TAF-issue time: day, hour and minute, then Z.",
      ),
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value: state.group,
          autocomplete: "off",
          spellcheck: false,
          maxLength: 16,
          describedBy,
        }),
    })}${field({
      id: id("reference"),
      label: "Reference",
      hint: hint(
        id("reference-hint"),
        "When the report was received, with Z or an offset. The tool never uses now.",
      ),
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value: state.reference,
          autocomplete: "off",
          spellcheck: false,
          maxLength: 64,
          describedBy,
        }),
    })}</div>${holidayFrame(
      html`<div class="${styles.slot}" id="${id("plates")}">${platesOf(null)}</div
        ><div id="${id("reason")}">${reasonOf("empty")}</div
        ><div class="${styles.slot}" id="${id("slider-slot")}">${sliderOf(id("shift"), null)}</div
        ><div id="${id("slider-hint")}">${sliderHintOf("needsReference")}</div
        ><div class="${styles.slot}" id="${id("timeline")}">${timelineOf(null)}</div
        ><div id="${id("strip-note")}">${stripNoteOf(false)}</div
        ><div id="${id("grid")}">${gridOf(null)}</div>`,
      { gate: "frame" },
    )}${callsSlot(id("calls"), "answer")}${disclosure({
      id: id("strip-calls-toggle"),
      label: "Strip calls",
      children: html`<div class="${styles.slot}" id="${id("strip-calls")}">${callsOf("strip", "")}</div>`,
    })}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Report Time Resolver", scope: idPrefix },
    html`${metar}${notamSection(id, nstate)}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): MetarState;
  readNotam(): NotamState;
}

/**
 * Take a field out of reach without taking it out of the layout: it keeps its room, so nothing
 * below it moves when a preset or a switch makes it moot, and a reader of a screen or a keyboard
 * cannot reach it.
 */
function setAway(field: HTMLElement, away: boolean): void {
  field.toggleAttribute("data-away", away);
  field.toggleAttribute("inert", away);
  if (away) field.setAttribute("aria-hidden", "true");
  else field.removeAttribute("aria-hidden");
}

function setupWidget(
  root: HTMLElement,
  lib: AviationLib,
  signal: AbortSignal,
  initial: MetarState,
  initialN: NotamState,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const groupEl = el<HTMLInputElement>("group");
  const referenceEl = el<HTMLInputElement>("reference");
  const sliderEl = el("shift").closest<GmtRange>("gmt-range")!;
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const disclosureEl =
    widgetEl.querySelector<HTMLElement>("[data-disclosure]")!;

  wireDisclosure(disclosureEl, { signal });
  sliderEl.step = 1;

  const nPresetEl = el("n-preset").closest<GmtPreset>("gmt-preset")!;
  const nBEl = el<HTMLInputElement>("n-b");
  const nCEl = el<HTMLInputElement>("n-c");
  const nFirstEl = el<HTMLInputElement>("n-first");
  const nWindowEl = el("n-window-slot").querySelector<GmtChips>("gmt-chips")!;

  let state: MetarState = initial;
  let nstate: NotamState = initialN;

  function syncControls(): void {
    groupEl.value = state.group;
    referenceEl.value = state.reference;
  }

  /** Write the slider's bounds, value, text and ends from the model. */
  function drawSlider(m: MetarModel): void {
    const ref = m.reference;
    const base = ref.base;
    sliderEl.formatValue = (n) =>
      base === null ? NOT_MOVED : shiftText(lib, base, n);
    sliderEl.max = ref.max;
    sliderEl.min = ref.min;
    sliderEl.value = ref.shift;
    sliderEl.ends = m.sliderEnds;
    sliderEl.disabled = !ref.movable;
    setHtml(el("slider-hint"), sliderHintOf(ref.hint));
  }

  function draw(): void {
    const m = buildModel(lib, state);
    presetEl.value = matchPreset(state);
    setHtml(el("plates"), platesOf(m));
    setHtml(el("reason"), reasonOf(m.answer.reason));
    drawSlider(m);
    setHtml(el("timeline"), timelineOf(m.strip));
    setHtml(el("strip-note"), stripNoteOf(m.strip.drawn && m.strip.beyond));
    setHtml(el("grid"), gridOf(m.strip));
    setHtml(el("calls"), callsOf("answer", m.calls.join("\n")));
    setHtml(el("strip-calls"), callsOf("strip", m.stripCalls.join("\n")));
  }

  function syncNotamControls(): void {
    nBEl.value = nstate.itemB;
    nCEl.value = nstate.itemC;
    nFirstEl.value = nstate.first;
    nWindowEl.value = nstate.mode;
    setAway(el("n-first-field"), nstate.mode === "rolling");
  }

  /** Redraw section 2 only: section 1's nodes are never touched. */
  function drawNotam(): void {
    const m = buildNotamModel(lib, nstate);
    nPresetEl.value = matchNotamPreset(nstate);
    setHtml(el("n-plates"), notamPlatesOf(m));
    setHtml(el("n-badges"), notamBadgesOf(m));
    setHtml(el("n-reasons"), notamReasonsOf(m));
    setHtml(el("n-calls"), callsOf("notam", m.calls.join("\n")));
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === nBEl) {
        nstate = { ...nstate, itemB: nBEl.value };
        drawNotam();
      } else if (target === nCEl) {
        nstate = { ...nstate, itemC: nCEl.value };
        drawNotam();
      } else if (target === nFirstEl) {
        nstate = { ...nstate, first: nFirstEl.value };
        drawNotam();
      } else if (target === groupEl) {
        state = withGroup(state, groupEl.value);
        draw();
      } else if (target === referenceEl) {
        state = withReference(state, referenceEl.value);
        draw();
      } else if (target === sliderEl) {
        state = { ...state, shift: Math.trunc(sliderEl.value) };
        draw();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === presetEl) {
        const chosen = METAR_PRESETS.find((p) => p.id === presetEl.value);
        // Custom keeps what is typed.
        if (chosen) apply(presetState(chosen));
      } else if (target === nPresetEl) {
        const chosen = NOTAM_PRESETS.find((p) => p.id === nPresetEl.value);
        if (chosen) {
          nstate = notamPresetState(chosen);
          syncNotamControls();
          drawNotam();
        }
      } else if (
        target instanceof Element &&
        target.closest("gmt-chips") === nWindowEl
      ) {
        const mode = nWindowEl.value === "rolling" ? "rolling" : "fixed";
        if (mode === nstate.mode) return;
        nstate = { ...nstate, mode };
        setAway(el("n-first-field"), mode === "rolling");
        drawNotam();
      }
    },
    { signal },
  );

  function apply(next: MetarState): void {
    state = next;
    syncControls();
    draw();
  }

  apply(state);
  syncNotamControls();
  drawNotam();

  return { readState: () => state, readNotam: () => nstate };
}

export const mountReportTimeResolver: MountFn<ReportTimeResolverArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: AviationLib;
  try {
    lib = await loadAviationLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  // One draw, of what the reader asked for: no stray call for a preset that is never shown.
  const controller = setupWidget(
    root,
    lib,
    signal,
    initialMetar(args),
    initialNotam(args),
  );

  return onceDestroy(
    () => {},
    () => ({
      ...permalinkOf(controller.readState()),
      ...notamPermalinkOf(controller.readNotam()),
    }),
  );
};
