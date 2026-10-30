/**
 * The Column Timestamp Bridge widget (CORE-56), mountable on its tool page and
 * in the chat rail.
 *
 * The reader gives one instant, or types stored values. In "encode" mode the
 * library writes the instant as a Parquet INT96, an Arrow `Timestamp` and a
 * protobuf `Timestamp` (and an ISO duration as a protobuf `Duration`) and reads
 * each back, so what a unit dropped shows. In "decode" mode it reads stored
 * values.
 *
 * Built on the component kit: `renderColumnTimestampBridgeTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids
 * and reads and writes element `value` properties. Every listener is delegated on the widget
 * with the mount's `signal`. The plate, the cards, the ladder and the printed calls are drawn
 * by `mount` from real calls in the reader's browser. The widget holds no day number, unit
 * factor or epoch: the library says what each form reads as.
 */
import { defineElements } from "~/widgets/define";
import {
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  hint,
  html,
  idScope,
  raw,
  section,
  setHtml,
  textInput,
  toolLinks,
  widget,
  type SafeHtml,
  type ToolLinkItem,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { callLines, outputOf } from "~/widgets/families/ids/call-lines";
import {
  formatCard,
  precisionLadder,
  type FormatCardOptions,
} from "~/widgets/families/ids/format-card";
import {
  instantHero,
  NO_SIGNAL_PILL,
} from "~/widgets/families/ids/instant-hero";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/column-timestamp-bridge.module.css";
import { BRIDGE_PRESETS } from "./column-timestamp-bridge-presets";
import {
  BAD_HEX_TEXT,
  BAD_NUMBER_TEXT,
  CARDS,
  CUSTOM_PRESET_ID,
  NOT_INSTANT_TEXT,
  NO_DECODE_TEXT,
  NO_DURATION_TEXT,
  NO_VALUE_TEXT,
  REASON_INT64,
  REASON_ZONED,
  REASON_ZONELESS,
  UNITS,
  VALUE_MAX_CHARS,
  WIDEST_READBACK,
  WIDEST_STORED,
  ZONELESS_CHIP,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readBridge,
  unknownZoneText,
  type BridgeState,
  type CardId,
  type CardRead,
  type ColumnTimestampBridgeArgs,
  type Hero,
  type LadderRow,
  type Reading,
} from "./column-timestamp-bridge";
import { loadColumnBridgeLib, type ColumnBridgeLib } from "./column-bridge-lib";
import type { EdiCall } from "./edi-widgets";
import { callArgs } from "./punctuality-widgets";
import { withBase } from "./site";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { codeSpan } from "./widget-ui";

export type { ColumnTimestampBridgeArgs } from "./column-timestamp-bridge";

export { NO_SIGNAL_PILL };

const WIDGET_NAME = "column-timestamp-bridge";
const HERO_CAP = "Exact instant";
const ZONELESS_CAP = "The same int64 under a zoneless schema";
const EMPTY_OUTPUT_TEXT = "No call made: give a value.";
const LADDER_LABELS = ["exact", "INT96", "Arrow", "Timestamp"] as const;

/** Each converter's reference page. */
const CONVERTERS = [
  "toParquetInt96",
  "fromParquetInt96",
  "toArrowTimestamp",
  "fromArrowTimestamp",
  "toArrowLocalTimestamp",
  "fromArrowLocalTimestamp",
  "toProtoTimestamp",
  "fromProtoTimestamp",
  "toProtoDuration",
  "fromProtoDuration",
] as const;

/** Each nanosecond int64 guard's reference page. */
const GUARDS = [
  "isValidInt64NanosecondInstant",
  "isValidInt64NanosecondDateTime",
] as const;

/** The links under the calls: the sibling tool and each function's page. */
const BRIDGE_LINKS = [
  { text: "ID Timestamp Decoder", href: "/tools/id-timestamp-decoder/" },
  {
    text: "fromNanoseconds reference",
    href: "/reference/precision/convert/fromNanoseconds/",
  },
  ...CONVERTERS.map((fn) => ({
    text: `${fn} reference`,
    href: `/reference/precision/convert/${fn}/`,
  })),
  ...GUARDS.map((fn) => ({
    text: `${fn} reference`,
    href: `/reference/precision/validate/${fn}/`,
  })),
] as const;

// ---------------------------------------------------------------------------
// The longest text each region holds, which sizes it
// ---------------------------------------------------------------------------

const LONGEST_VALUE = "x".repeat(VALUE_MAX_CHARS);

/** Every sentence a card's message slot can show. */
const MESSAGE_TEXTS = [
  NO_VALUE_TEXT,
  NO_DURATION_TEXT,
  NO_DECODE_TEXT,
  BAD_NUMBER_TEXT,
  BAD_HEX_TEXT,
  REASON_ZONED,
  REASON_ZONELESS,
  REASON_INT64,
  unknownZoneText(LONGEST_VALUE),
];

/** The validator line a card prints: the call and what it returned. */
function validatorHtml(call: EdiCall): SafeHtml {
  return raw(
    `${codeSpan("fn", call.fn)}(${callArgs(call.args)[0]}) → ${String(call.result)}`,
  );
}

const VALIDATOR_SAMPLE = `isValidDateTime("${LONGEST_VALUE}") → false`;

const CARD_SERIES: Record<CardId, 1 | 2 | 3 | 4> = {
  int96: 1,
  arrow: 2,
  timestamp: 3,
  duration: 4,
};

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function plateOf(hero: Hero | null): SafeHtml {
  const lost = hero?.kind === "not-instant" && hero.signal;
  const callLine =
    hero?.kind === "not-instant" ? validatorHtml(hero.call) : null;
  return instantHero({
    gate: "hero",
    caption: HERO_CAP,
    captions: [HERO_CAP],
    label: "Exact instant value",
    state: hero?.kind ?? "empty",
    value: hero?.kind === "instant" ? hero.exact : "",
    sample: WIDEST_READBACK,
    lost,
    bar: hero?.kind === "instant",
    chip: null,
    call: { line: callLine, sample: VALIDATOR_SAMPLE },
    reason:
      hero === null
        ? NO_VALUE_TEXT
        : hero.kind === "instant"
          ? ""
          : hero.reason,
    reasons: [NO_VALUE_TEXT, NOT_INSTANT_TEXT],
  });
}

function cardOptions(
  card: { id: CardId; title: string },
  headingId: string,
  read: CardRead | null,
): FormatCardOptions {
  const arrow = card.id === "arrow";
  return {
    headingId,
    title: card.title,
    series: CARD_SERIES[card.id],
    card: card.id,
    state: read?.status ?? "idle",
    stored: read?.stored ?? [],
    readBack: read?.readBack?.text ?? null,
    zoneless: arrow
      ? { caption: ZONELESS_CAP, text: read?.zonelessRead ?? null }
      : null,
    chip:
      read !== null &&
      (read.readBack?.kind === "local" || read.zonelessRead !== null),
    literal: read?.literal ?? "",
    validator: read?.validator ? validatorHtml(read.validator) : null,
    message:
      read === null ? "" : read.status === "idle" ? read.idle : read.reason,
    samples: {
      stored: WIDEST_STORED,
      readBack: WIDEST_READBACK,
      chip: ZONELESS_CHIP,
      literal: "null",
      validator: VALIDATOR_SAMPLE,
      messages: MESSAGE_TEXTS,
    },
  };
}

function cardsOf(
  id: (local: string) => string,
  reads: readonly CardRead[] | null,
): SafeHtml {
  return html`${CARDS.map((c) =>
    formatCard(
      cardOptions(
        c,
        id(`card-${c.id}`),
        reads?.find((r) => r.id === c.id) ?? null,
      ),
    ),
  )}`;
}

function ladderOf(rows: readonly LadderRow[] | null): SafeHtml {
  return precisionLadder({
    label:
      "Precision ladder: the read-back of each form, left-aligned, so digits a unit dropped show as a shorter row",
    sample: WIDEST_READBACK,
    rows: LADDER_LABELS.map((label, i) => ({
      label,
      text: rows?.[i]?.text ?? "",
    })),
  });
}

function linkItems(): ToolLinkItem[] {
  return BRIDGE_LINKS.map((l) => ({ text: l.text, href: withBase(l.href) }));
}

function linksOf(): SafeHtml {
  return toolLinks({ label: "Other tools", links: linkItems() });
}

function framesOf(copyText: string, code?: SafeHtml): SafeHtml {
  return codeFrame({
    label: "Calls made",
    copyLabel: "Copy calls",
    copyText,
    ...(code === undefined ? {} : { code }),
    gate: "codeframe",
  });
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

/** The text controls, each named by its state key. */
const TEXT_KEYS = [
  "value",
  "zone",
  "duration",
  "julianDay",
  "nanosOfDay",
  "bytes",
  "int64",
  "seconds",
  "nanos",
  "durSeconds",
  "durNanos",
] as const;

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the default preset. Server HTML hides exactly the fields the initial mode hides, so mounting
 * hides nothing.
 */
export function renderColumnTimestampBridgeTemplate(
  idPrefix: string,
  args: ColumnTimestampBridgeArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: BridgeState = isSeeded(args)
    ? readArgs(args)
    : presetState(BRIDGE_PRESETS[0]!);
  const encode = state.mode === "encode";
  const bytesForm = state.int96Form === "bytes";

  const text = (
    key: (typeof TEXT_KEYS)[number],
    label: string,
    note?: string,
  ): SafeHtml => {
    const h = note === undefined ? undefined : hint(id(`${key}-hint`), note);
    return field({
      id: id(key),
      label,
      ...(h === undefined ? {} : { hint: h }),
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value: state[key],
          autocomplete: "off",
          spellcheck: false,
          maxLength: VALUE_MAX_CHARS,
          describedBy,
        }),
    });
  };

  const chipsOf = (
    key: string,
    legend: string,
    items: readonly { value: string; label: string }[],
    current: string,
  ): SafeHtml =>
    chips({
      legend,
      kind: "radio",
      name: id(key),
      items: items.map((i) => ({ ...i, checked: i.value === current })),
    });

  const modeFields = html`<div id="${id("mode-fields")}">
    <div class="${styles.panel}" id="${id("encode-fields")}" ${!encode ? html`hidden` : ""}>${fieldGrid(
      html`${text("value", "Instant or wall time")}${text("duration", "ISO duration (optional)")}`,
    )}</div>
    <div class="${styles.panel}" id="${id("decode-fields")}" ${encode ? html`hidden` : ""}><div class="${styles.decode}">
      <fieldset class="${styles.group}"><legend class="${styles.legend}">Parquet INT96</legend>${chipsOf(
        "int96Form",
        "Form",
        [
          { value: "record", label: "Day and nanoseconds" },
          { value: "bytes", label: "12 bytes" },
        ],
        state.int96Form,
      )}<div class="${styles.panel}" id="${id("int96-record")}" ${bytesForm ? html`hidden` : ""}>${fieldGrid(
        html`${text("julianDay", "julianDay")}${text("nanosOfDay", "nanosOfDay")}`,
      )}</div><div class="${styles.panel}" id="${id("int96-bytes")}" ${!bytesForm ? html`hidden` : ""}>${fieldGrid(
        text(
          "bytes",
          "Bytes",
          "24 hex digits: the 12 stored bytes in file order",
        ),
      )}</div></fieldset>
      <fieldset class="${styles.group}"><legend class="${styles.legend}">Arrow Timestamp</legend>${fieldGrid(
        text("int64", "int64"),
      )}</fieldset>
      <fieldset class="${styles.group}"><legend class="${styles.legend}">protobuf Timestamp</legend>${fieldGrid(
        html`${text("seconds", "seconds")}${text("nanos", "nanos")}`,
      )}</fieldset>
      <fieldset class="${styles.group}"><legend class="${styles.legend}">protobuf Duration</legend>${fieldGrid(
        html`${text("durSeconds", "seconds")}${text("durNanos", "nanos")}`,
      )}</fieldset>
    </div></div>
  </div>`;

  const pick = section(
    { id: id("pick"), heading: "1. What to convert", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Your values", description: "" },
        ...BRIDGE_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${chipsOf(
      "mode",
      "Mode",
      [
        { value: "encode", label: "From an instant" },
        { value: "decode", label: "From stored values" },
      ],
      state.mode,
    )}${chipsOf(
      "unit",
      "Arrow unit",
      UNITS.map((u) => ({ value: u, label: u })),
      state.unit,
    )}${fieldGrid(
      text(
        "zone",
        "Arrow column timezone (optional)",
        "Blank: a zoneless column",
      ),
    )}${grow(modeFields)}</div>`,
  );

  const read = section(
    { id: id("read"), heading: "2. How each form stores it", level: 4 },
    html`${grow(
      html`<div class="${styles.frame}" data-gate="frame">
      <div class="${styles.panel}" id="${id("hero-panel")}" ${!encode ? html`hidden` : ""}><div id="${id("hero")}">${plateOf(null)}</div></div>
      <div class="${styles.cards}" id="${id("cards")}">${cardsOf(id, null)}</div>
      <div class="${styles.panel}" id="${id("ladder-panel")}" ${!encode ? html`hidden` : ""}><div id="${id("ladder")}">${ladderOf(null)}</div></div>
    </div>`,
    )}`,
  );

  const calls = section(
    { id: id("calls"), heading: "3. The calls", level: 4 },
    html`${grow(
      html`<div id="${id("calls-slot")}">${framesOf("")}</div>`,
    )}${grow(
      html`<div id="${id("output-slot")}">${callOutput({
        label: "What the calls returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}${grow(html`<div id="${id("links")}">${linksOf()}</div>`)}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Column Timestamp Bridge", scope: idPrefix },
    html`${pick}${read}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): BridgeState;
  apply(state: BridgeState): void;
  render(): void;
  syncPreset(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: ColumnBridgeLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, id, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const group = (key: string): GmtChips =>
    widgetEl
      .querySelector(`input[name="${CSS.escape(id(key))}"]`)!
      .closest<GmtChips>("gmt-chips")!;
  const modeEl = group("mode");
  const unitEl = group("unit");
  const formEl = group("int96Form");

  const texts = Object.fromEntries(
    TEXT_KEYS.map((key) => {
      const input = el<HTMLInputElement>(key);
      return [key, input];
    }),
  ) as Record<(typeof TEXT_KEYS)[number], HTMLInputElement>;

  const typed: readonly EventTarget[] = Object.values(texts);
  const picked: readonly EventTarget[] = [modeEl, unitEl, formEl];

  const readState = (): BridgeState => ({
    ...(Object.fromEntries(
      TEXT_KEYS.map((key) => [key, texts[key].value]),
    ) as Record<(typeof TEXT_KEYS)[number], string>),
    mode: modeEl.value as string as BridgeState["mode"],
    unit: unitEl.value as string as BridgeState["unit"],
    int96Form: formEl.value as string as BridgeState["int96Form"],
  });

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  /** Shows the fields the mode and the INT96 form use, and hides the rest. */
  function syncVisibility(state: BridgeState): void {
    const encode = state.mode === "encode";
    el("encode-fields").hidden = !encode;
    el("decode-fields").hidden = encode;
    el("hero-panel").hidden = !encode;
    el("ladder-panel").hidden = !encode;
    el("int96-record").hidden = state.int96Form === "bytes";
    el("int96-bytes").hidden = state.int96Form !== "bytes";
  }

  function drawCalls(reading: Reading): void {
    if (reading.calls.length === 0) {
      setHtml(el("calls-slot"), framesOf(""));
      setHtml(
        el("output-slot"),
        callOutput({
          label: "What the calls returned",
          state: "empty",
          lines: [{ text: EMPTY_OUTPUT_TEXT, lost: false }],
        }),
      );
      return;
    }
    const { code, plain } = callLines(reading.calls);
    setHtml(el("calls-slot"), framesOf(plain, code));
    const out = outputOf(reading.failed ? "sentinel" : "ok", reading.calls);
    setHtml(
      el("output-slot"),
      callOutput({
        label: "What the calls returned",
        state: out.state,
        lines: out.lines,
      }),
    );
  }

  function render(): void {
    const state = readState();
    syncVisibility(state);
    const reading = readBridge(lib, state);
    setHtml(el("hero"), plateOf(reading.hero));
    setHtml(el("cards"), cardsOf(id, reading.cards));
    setHtml(el("ladder"), ladderOf(reading.ladder));
    drawCalls(reading);
    setHtml(el("links"), linksOf());
  }

  function apply(state: BridgeState): void {
    for (const key of TEXT_KEYS) texts[key].value = state[key];
    modeEl.value = state.mode;
    unitEl.value = state.unit;
    formEl.value = state.int96Form;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target === null || !typed.includes(e.target)) return;
      syncPreset();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target === null) return;
      if (e.target === presetEl) {
        const chosen = BRIDGE_PRESETS.find((p) => p.id === presetEl.value);
        // "Your values" keeps what is typed.
        if (!chosen) return;
        apply(presetState(chosen));
      } else if (!picked.includes(e.target)) {
        return;
      }
      syncPreset();
      render();
    },
    { signal },
  );

  syncPreset();
  render();

  return { readState, apply, render, syncPreset };
}

export const mountColumnTimestampBridge: MountFn<
  ColumnTimestampBridgeArgs
> = async (root, args, signal) => {
  defineElements();
  let lib: ColumnBridgeLib;
  try {
    lib = await loadColumnBridgeLib();
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
