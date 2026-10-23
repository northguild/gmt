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
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. The
 * template is chrome only: the hero, the four cards, the ladder and the printed
 * calls are drawn by `mount` from real calls in the reader's browser. Every
 * listener is delegated on the root, so the host dropping the subtree is a
 * complete teardown. The widget holds no day number, unit factor or epoch: the
 * library says what each form reads as.
 */
import { codeFrameHtml } from "./code-frame";
import {
  BRIDGE_PRESETS,
  type BridgePreset,
} from "./column-timestamp-bridge-presets";
import {
  BAD_HEX_TEXT,
  BAD_NUMBER_TEXT,
  CARDS,
  CUSTOM_PRESET_ID,
  NOT_INSTANT_TEXT,
  NO_DECODE_TEXT,
  NO_DURATION_TEXT,
  NO_VALUE_TEXT,
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
  type BridgeState,
  type CardRead,
  type ColumnTimestampBridgeArgs,
  type Hero,
  type Reading,
  type ReadBack,
} from "./column-timestamp-bridge";
import { loadColumnBridgeLib, type ColumnBridgeLib } from "./column-bridge-lib";
import {
  callSizer,
  holdHtml,
  outputSizer,
  sizerHtml,
  textSizers,
} from "./edi-picture";
import { renderCallResults, renderCalls } from "./edi-render";
import { callArgs, formatValue, type EdiCall } from "./edi-widgets";
import { descriptionHoldHtml } from "./ledger-widgets";
import { setPresetDescription } from "./punctuality-widgets";
import { withBase } from "./site";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  chipToggleHtml,
  codeSpan,
  escapeAttr,
  escapeHtml,
  instantPiecesHtml,
  labelTextHtml,
  renderWidgetOutput,
  setControlValue,
  setToolLink,
  toolLinksHtml,
  wireCopyButtons,
  wrapInstantsAtT,
} from "./widget-ui";

export type { ColumnTimestampBridgeArgs } from "./column-timestamp-bridge";

/** The signal-lost pill. */
export const NO_SIGNAL_PILL = "⟨ NO SIGNAL ⟩";

const HERO_CAP = "Exact instant";

/** Each converter's reference page. */
const CONVERTERS = [
  "toParquetInt96",
  "fromParquetInt96",
  "toArrowTimestamp",
  "fromArrowTimestamp",
  "toProtoTimestamp",
  "fromProtoTimestamp",
  "toProtoDuration",
  "fromProtoDuration",
] as const;

/** The links under the calls: the sibling tool and each function's page. */
export const BRIDGE_LINKS = [
  {
    role: "link-ids",
    text: "ID Timestamp Decoder",
    href: "/tools/id-timestamp-decoder/",
  },
  {
    role: "link-ref-fromNanoseconds",
    text: "fromNanoseconds reference",
    href: "/reference/precision/convert/fromNanoseconds/",
  },
  ...CONVERTERS.map((fn) => ({
    role: `link-ref-${fn}`,
    text: `${fn} reference`,
    href: `/reference/precision/convert/${fn}/`,
  })),
] as const;

const ENCODE_ONLY_ROLE = "encode-panels";

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
];

/** The validator line a card prints: the call and what it returned. */
function validatorHtml(call: EdiCall): string {
  return `${codeSpan("fn", call.fn)}(${callArgs(call.args)[0]}) → ${String(call.result)}`;
}

const VALIDATOR_SIZER = validatorHtml({
  fn: "isValidDateTime",
  args: [LONGEST_VALUE],
  result: false,
});

/** A read-back as the card prints it: the Arrow record, or the bare string. */
function readBackHtml(back: ReadBack): string {
  const pieces = instantPiecesHtml(back.text);
  if (back.kind === "instant") return `{ instant: "${pieces}" }`;
  if (back.kind === "local") return `{ local: "${pieces}", zoneless: true }`;
  return pieces;
}

function zonelessReadHtml(text: string): string {
  return `{ local: "${instantPiecesHtml(text)}", zoneless: true }`;
}

const READBACK_SIZERS = [
  readBackHtml({ kind: "text", text: WIDEST_READBACK }),
  readBackHtml({ kind: "instant", text: WIDEST_READBACK }),
  readBackHtml({ kind: "local", text: WIDEST_READBACK }),
];

/** The longest call set: 13 lines, every one with the longest value. */
const CALL_FRAME_SIZER = [
  ["isValidInstant", [LONGEST_VALUE]],
  ["toNanoseconds", [LONGEST_VALUE]],
  ["fromNanoseconds", [-9223372036854775808n]],
  ["toParquetInt96", [LONGEST_VALUE]],
  ["fromParquetInt96", [{ julianDay: -97559412, nanosOfDay: 86399999999999n }]],
  ["isValidDateTime", [LONGEST_VALUE]],
  [
    "toArrowTimestamp",
    [
      LONGEST_VALUE,
      { unit: "nanosecond", timeZone: "America/Argentina/Buenos_Aires" },
    ],
  ],
  [
    "fromArrowTimestamp",
    [
      -9223372036854775808n,
      { unit: "nanosecond", timeZone: "America/Argentina/Buenos_Aires" },
    ],
  ],
  ["fromArrowTimestamp", [-9223372036854775808n, { unit: "nanosecond" }]],
  ["toProtoTimestamp", [LONGEST_VALUE]],
  [
    "fromProtoTimestamp",
    [{ seconds: -9223372036854775808n, nanos: -2147483648 }],
  ],
  ["toProtoDuration", [LONGEST_VALUE]],
  [
    "fromProtoDuration",
    [{ seconds: -9223372036854775808n, nanos: -2147483648 }],
  ],
]
  .map(([fn, args]) => `${fn as string}(${callArgs(args as unknown[])[1]})`)
  .join("\n");

const OUTPUT_SIZER = Array.from(
  { length: 13 },
  () => `{ local: "${WIDEST_READBACK}", zoneless: true }`,
).join("\n");

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Your values</option>` +
    BRIDGE_PRESETS.map(
      (p: BridgePreset) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

/** Radio group names need one number per widget on a page. Local to this module, so no other widget's ids move. */
let instanceSeq = 0;

const hiddenIf = (hide: boolean) => (hide ? " hidden" : "");

function textField(
  role: string,
  label: string,
  value: string,
  opts: {
    optional?: boolean;
    hint?: string;
    wide?: boolean;
    mono?: boolean;
  } = {},
): string {
  return (
    `<label class="gmt-label${opts.wide ? " gmt-field-wide" : ""}">` +
    `${labelTextHtml(label, opts.optional ? { optional: true } : undefined)}` +
    `<input class="gmt-input gmt-colbridge-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="${VALUE_MAX_CHARS}" data-role="${role}" value="${escapeAttr(value)}">` +
    (opts.hint
      ? `<span class="gmt-widget-hint">${escapeHtml(opts.hint)}</span>`
      : "") +
    `</label>`
  );
}

function chipGroup(
  legend: string,
  role: string,
  name: string,
  options: readonly { value: string; label: string }[],
  current: string,
): string {
  return (
    `<fieldset class="gmt-chip-group" data-group="${role}"><legend>${escapeHtml(legend)}</legend>` +
    options
      .map((o) =>
        chipToggleHtml({
          type: "radio",
          name,
          role,
          value: o.value,
          label: o.label,
          checked: o.value === current,
        }),
      )
      .join("") +
    `</fieldset>`
  );
}

/** A value line in a card: a hold whose sizers are the widest values. */
function lineHtml(slot: string): string {
  return holdHtml(
    `<code class="gmt-colbridge-line" data-slot="${slot}">&nbsp;</code>`,
    WIDEST_STORED.map((t) =>
      sizerHtml("code", "gmt-colbridge-line", escapeHtml(t)),
    ),
    "gmt-ledger-hold",
  );
}

function cardHtml(c: { id: string; title: string }): string {
  const arrow = c.id === "arrow";
  return (
    `<section class="gmt-colbridge-card" data-card="${c.id}" data-state="idle" aria-label="${escapeAttr(c.title)}">` +
    `<h5 class="gmt-colbridge-card-head">${escapeHtml(c.title)}</h5>` +
    `<div class="gmt-colbridge-card-body">` +
    `<span class="gmt-colbridge-cap">Stored</span>` +
    lineHtml("stored-1") +
    lineHtml("stored-2") +
    `<span class="gmt-colbridge-cap">Reads back</span>` +
    holdHtml(
      `<code class="gmt-colbridge-line gmt-colbridge-wrap" data-slot="readback">&nbsp;</code>`,
      READBACK_SIZERS.map((r) =>
        sizerHtml("code", "gmt-colbridge-line gmt-colbridge-wrap", r),
      ),
      "gmt-ledger-hold",
    ) +
    (arrow
      ? `<span class="gmt-colbridge-cap" data-slot="zoneless-cap" data-off>The same int64 under a zoneless schema</span>` +
        holdHtml(
          `<code class="gmt-colbridge-line gmt-colbridge-wrap" data-slot="zoneless" data-off>&nbsp;</code>`,
          [
            sizerHtml(
              "code",
              "gmt-colbridge-line gmt-colbridge-wrap",
              zonelessReadHtml(WIDEST_READBACK),
            ),
          ],
          "gmt-ledger-hold",
        )
      : "") +
    `<span class="gmt-colbridge-chip" data-slot="chip" data-off>${escapeHtml(ZONELESS_CHIP)}</span>` +
    `<span class="gmt-colbridge-signal" data-slot="signal" data-off>` +
    `<span class="gmt-colbridge-pill">${NO_SIGNAL_PILL}</span>` +
    `<code class="gmt-colbridge-literal" data-slot="literal">&nbsp;</code></span>` +
    holdHtml(
      `<p class="gmt-colbridge-validator" data-slot="validator" data-off>&nbsp;</p>`,
      [sizerHtml("p", "gmt-colbridge-validator", VALIDATOR_SIZER)],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<p class="gmt-widget-hint" data-slot="message">&nbsp;</p>`,
      textSizers("p", "gmt-widget-hint", MESSAGE_TEXTS),
      "gmt-ledger-hold",
    ) +
    `</div></section>`
  );
}

function ladderRowsHtml(): string {
  return ["exact", "INT96", "Arrow", "Timestamp"]
    .map(
      (label, i) =>
        `<div class="gmt-colbridge-ladder-row"><span class="gmt-colbridge-ladder-label">${label}</span>` +
        `<code class="gmt-colbridge-ladder-text" data-slot="ladder-${i}">&nbsp;</code></div>`,
    )
    .join("");
}

function heroHtml(): string {
  return (
    `<div class="gmt-punct-hero gmt-colbridge-hero" data-role="hero-exact" data-state="empty">` +
    `<span class="gmt-punct-hero-cap">${HERO_CAP}</span>` +
    holdHtml(
      `<span class="gmt-punct-hero-value" data-role="hero-value" data-off></span>` +
        `<span class="gmt-colbridge-pill" data-role="hero-pill" data-off>${NO_SIGNAL_PILL}</span>`,
      [
        sizerHtml(
          "span",
          "gmt-punct-hero-value",
          instantPiecesHtml(WIDEST_READBACK),
        ),
      ],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<p class="gmt-colbridge-validator" data-role="hero-call" data-off>&nbsp;</p>`,
      [sizerHtml("p", "gmt-colbridge-validator", VALIDATOR_SIZER)],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="hero-reason">${escapeHtml(NO_VALUE_TEXT)}</p>`,
      textSizers("p", "gmt-widget-hint", [NO_VALUE_TEXT, NOT_INSTANT_TEXT]),
      "gmt-ledger-hold",
    ) +
    `</div>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the default preset. Server HTML hides exactly the fields the
 * initial mode hides, so mounting hides nothing.
 */
export function renderColumnTimestampBridgeTemplate(
  args: ColumnTimestampBridgeArgs = {},
): string {
  const state: BridgeState = isSeeded(args)
    ? readArgs(args)
    : presetState(BRIDGE_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = BRIDGE_PRESETS.find((p) => p.id === presetId);
  const uid = ++instanceSeq;
  const encode = state.mode === "encode";
  const bytesForm = state.int96Form === "bytes";

  return (
    `<div class="gmt-column-timestamp-bridge gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. What to convert
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. What to convert</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      BRIDGE_PRESETS.map((p) => p.description),
    ) +
    chipGroup(
      "Mode",
      "mode",
      `colbridge-mode-${uid}`,
      [
        { value: "encode", label: "From an instant" },
        { value: "decode", label: "From stored values" },
      ],
      state.mode,
    ) +
    chipGroup(
      "Arrow unit",
      "unit",
      `colbridge-unit-${uid}`,
      UNITS.map((u) => ({ value: u, label: u })),
      state.unit,
    ) +
    `<div class="gmt-field-grid">` +
    textField("zone", "Arrow column timezone", state.zone, {
      optional: true,
      hint: "Blank: a zoneless column",
      wide: true,
    }) +
    `</div>` +
    // The fields one mode uses. One slot, so a switch eases.
    `<div data-role="mode-fields" data-grow="slot">` +
    `<div class="gmt-field-grid" data-role="encode-fields"${hiddenIf(!encode)}>` +
    textField("value", "Instant or wall time", state.value, { wide: true }) +
    textField("duration", "ISO duration", state.duration, {
      optional: true,
      wide: true,
    }) +
    `</div>` +
    `<div class="gmt-colbridge-decode" data-role="decode-fields"${hiddenIf(encode)}>` +
    `<fieldset class="gmt-colbridge-group"><legend>Parquet INT96</legend>` +
    chipGroup(
      "Form",
      "int96Form",
      `colbridge-int96-${uid}`,
      [
        { value: "record", label: "Day and nanoseconds" },
        { value: "bytes", label: "12 bytes" },
      ],
      state.int96Form,
    ) +
    `<div class="gmt-field-grid" data-role="int96-record"${hiddenIf(bytesForm)}>` +
    textField("julianDay", "julianDay", state.julianDay) +
    textField("nanosOfDay", "nanosOfDay", state.nanosOfDay) +
    `</div>` +
    `<div class="gmt-field-grid" data-role="int96-bytes"${hiddenIf(!bytesForm)}>` +
    textField("bytes", "Bytes", state.bytes, {
      hint: "24 hex digits: the 12 stored bytes in file order",
      wide: true,
    }) +
    `</div></fieldset>` +
    `<fieldset class="gmt-colbridge-group"><legend>Arrow Timestamp</legend>` +
    `<div class="gmt-field-grid">${textField("int64", "int64", state.int64, { wide: true })}</div></fieldset>` +
    `<fieldset class="gmt-colbridge-group"><legend>protobuf Timestamp</legend>` +
    `<div class="gmt-field-grid">${textField("seconds", "seconds", state.seconds)}${textField("nanos", "nanos", state.nanos)}</div></fieldset>` +
    `<fieldset class="gmt-colbridge-group"><legend>protobuf Duration</legend>` +
    `<div class="gmt-field-grid">${textField("durSeconds", "seconds", state.durSeconds)}${textField("durNanos", "nanos", state.durNanos)}</div></fieldset>` +
    `</div>` +
    `</div>` +
    `</div>` +
    // 2. How each form stores it
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. How each form stores it</h4>` +
    `<div class="gmt-colbridge-frame" data-role="frame">` +
    `<div data-role="${ENCODE_ONLY_ROLE}-hero"${hiddenIf(!encode)}>${heroHtml()}</div>` +
    `<div class="gmt-colbridge-cards" data-role="cards">${CARDS.map(cardHtml).join("")}</div>` +
    `<div data-role="${ENCODE_ONLY_ROLE}-ladder"${hiddenIf(!encode)}>` +
    `<span class="gmt-colbridge-cap">Precision ladder</span>` +
    `<div class="gmt-colbridge-ladder" role="img" aria-label="Precision ladder: the read-back of each form, left-aligned, so digits a unit dropped show as a shorter row" data-role="ladder">${ladderRowsHtml()}</div>` +
    `<ul class="gmt-ledger-sr" data-role="ladder-list"></ul>` +
    `</div>` +
    `</div>` +
    `</div>` +
    // 3. The calls
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. The calls</h4>` +
    holdHtml(
      codeFrameHtml("bridge"),
      [callSizer(CALL_FRAME_SIZER)],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<output class="gmt-widget-output" data-role="bridge-output">&nbsp;</output>`,
      [outputSizer("gmt-widget-output", OUTPUT_SIZER)],
      "gmt-ledger-hold",
    ) +
    toolLinksHtml(BRIDGE_LINKS) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

const TEXT_ROLES = [
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
const RADIO_ROLES = ["mode", "unit", "int96Form"] as const;

interface Controller {
  readState(): BridgeState;
  apply(state: BridgeState): void;
  render(): void;
  syncPreset(): void;
}

function setupWidget(root: HTMLElement, lib: ColumnBridgeLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const presetEl = q<HTMLSelectElement>("preset")!;
  const radios = (role: string) => [
    ...root.querySelectorAll<HTMLInputElement>(
      `input[type="radio"][data-role="${role}"]`,
    ),
  ];
  const checked = (role: string, fallback: string) =>
    radios(role).find((r) => r.checked)?.value ?? fallback;

  const readState = (): BridgeState => {
    const text = Object.fromEntries(
      TEXT_ROLES.map((r) => [r, q<HTMLInputElement>(r)?.value ?? ""]),
    ) as Record<(typeof TEXT_ROLES)[number], string>;
    return {
      ...text,
      mode: checked("mode", "encode") as BridgeState["mode"],
      unit: checked("unit", "second") as BridgeState["unit"],
      int96Form: checked("int96Form", "record") as BridgeState["int96Form"],
    };
  };

  function syncPreset(): void {
    const id = matchPreset(readState());
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        BRIDGE_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  /** Shows the fields the mode and the INT96 form use, and hides the rest. */
  function syncVisibility(state: BridgeState): void {
    const encode = state.mode === "encode";
    q("encode-fields")!.hidden = !encode;
    q("decode-fields")!.hidden = encode;
    q(`${ENCODE_ONLY_ROLE}-hero`)!.hidden = !encode;
    q(`${ENCODE_ONLY_ROLE}-ladder`)!.hidden = !encode;
    q("int96-record")!.hidden = state.int96Form === "bytes";
    q("int96-bytes")!.hidden = state.int96Form !== "bytes";
  }

  function drawHero(hero: Hero | null): void {
    if (hero === null) return;
    const el = q("hero-exact")!;
    el.dataset["state"] = hero.kind;
    const value = q("hero-value")!;
    const text = hero.kind === "instant" ? hero.exact : "";
    // Clearing the text drops the pieces `wrapInstantsAtT` wrote last time.
    value.textContent = text;
    value.toggleAttribute("data-off", text === "");
    q("hero-pill")!.toggleAttribute(
      "data-off",
      !(hero.kind === "not-instant" && hero.signal),
    );
    const call = q("hero-call")!;
    if (hero.kind === "not-instant") {
      call.innerHTML = validatorHtml(hero.call);
      call.removeAttribute("data-off");
    } else {
      call.textContent = "\u00a0";
      call.setAttribute("data-off", "");
    }
    q("hero-reason")!.textContent =
      hero.kind === "instant" ? "\u00a0" : hero.reason;
    wrapInstantsAtT(el);
  }

  function drawCard(c: CardRead): void {
    const el = root.querySelector<HTMLElement>(`[data-card="${c.id}"]`)!;
    const slot = (name: string) =>
      el.querySelector<HTMLElement>(`[data-slot="${name}"]`);
    el.dataset["state"] = c.status;
    for (const [i, name] of ["stored-1", "stored-2"].entries()) {
      const s = slot(name)!;
      s.textContent = c.stored[i] ?? "\u00a0";
    }
    const back = slot("readback")!;
    if (c.readBack === null) back.textContent = "\u00a0";
    else back.innerHTML = readBackHtml(c.readBack);
    const zl = slot("zoneless");
    if (zl) {
      const has = c.zonelessRead !== null;
      if (has) zl.innerHTML = zonelessReadHtml(c.zonelessRead!);
      else zl.textContent = "\u00a0";
      zl.toggleAttribute("data-off", !has);
      slot("zoneless-cap")!.toggleAttribute("data-off", !has);
    }
    const chipShown = c.readBack?.kind === "local" || c.zonelessRead !== null;
    slot("chip")!.toggleAttribute("data-off", !chipShown);
    slot("signal")!.toggleAttribute("data-off", c.status !== "sentinel");
    slot("literal")!.textContent = c.literal === "" ? "\u00a0" : c.literal;
    const validator = slot("validator")!;
    if (c.validator !== null) {
      validator.innerHTML = validatorHtml(c.validator);
      validator.removeAttribute("data-off");
    } else {
      validator.textContent = "\u00a0";
      validator.setAttribute("data-off", "");
    }
    const message = slot("message")!;
    const words = c.status === "idle" ? c.idle : c.reason;
    message.textContent = words === "" ? "\u00a0" : words;
    message.toggleAttribute("data-off", words === "");
  }

  function drawLadder(reading: Reading): void {
    const rows = reading.ladder;
    if (rows === null) return;
    rows.forEach((r, i) => {
      const cell = q(`ladder`)!.querySelector<HTMLElement>(
        `[data-slot="ladder-${i}"]`,
      )!;
      cell.textContent = r.text === "" ? "\u00a0" : r.text;
    });
    const list = q("ladder-list")!;
    list.innerHTML = rows
      .filter((r) => r.text !== "")
      .map((r) => `<li>${escapeHtml(r.label)}: ${escapeHtml(r.text)}</li>`)
      .join("");
  }

  function drawCalls(reading: Reading): void {
    const out = q<HTMLElement>("bridge-output");
    if (!out) return;
    if (reading.calls.length === 0) {
      renderCalls(q("call-bridge"), []);
      renderWidgetOutput(out, "No call made: give a value.", "empty");
      return;
    }
    renderCalls(q("call-bridge"), reading.calls);
    renderCallResults(out, reading.calls, reading.failed, formatValue);
  }

  function drawLinks(): void {
    for (const link of BRIDGE_LINKS) {
      setToolLink(q(link.role), withBase(link.href));
    }
  }

  function render(): void {
    const state = readState();
    syncVisibility(state);
    const reading = readBridge(lib, state);
    drawHero(reading.hero);
    reading.cards.forEach(drawCard);
    drawLadder(reading);
    drawCalls(reading);
    drawLinks();
  }

  function apply(state: BridgeState): void {
    for (const role of TEXT_ROLES) setControlValue(q(role), state[role]);
    for (const role of RADIO_ROLES) {
      for (const r of radios(role)) r.checked = r.value === state[role];
    }
  }

  root.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    const role = target.dataset?.["role"] ?? "";
    if (!(TEXT_ROLES as readonly string[]).includes(role)) return;
    syncPreset();
    render();
  });

  root.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    const role = target.dataset?.["role"] ?? "";
    if (role === "preset") {
      const preset = BRIDGE_PRESETS.find((p) => p.id === target.value);
      // "Your values" keeps what is typed.
      if (!preset) return;
      apply(presetState(preset));
    } else if (!(RADIO_ROLES as readonly string[]).includes(role)) {
      return;
    }
    syncPreset();
    render();
  });

  wireCopyButtons(root);
  syncPreset();
  render();

  return { readState, apply, render, syncPreset };
}

/**
 * WebKit keeps a hold's row height from the width it had before the widget's
 * own box was resized (a rail dragged narrower), so the hidden sizer stays one
 * line per call while the live calls wrap and the card grows. Any write to the
 * hold's style makes it lay the sizer out again, so write one when the width
 * changes. A viewport resize needs none; this covers the widget box alone.
 */
function refitHoldsOnResize(root: HTMLElement): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  let width = root.getBoundingClientRect().width;
  const observer = new ResizeObserver(() => {
    const next = root.getBoundingClientRect().width;
    if (next === width) return;
    width = next;
    for (const hold of root.querySelectorAll<HTMLElement>(".gmt-ledger-hold")) {
      hold.style.gridTemplateRows = "auto";
      void hold.offsetHeight;
      hold.style.removeProperty("grid-template-rows");
    }
  });
  observer.observe(root);
  return () => observer.disconnect();
}

export const mountColumnTimestampBridge: MountFn<
  ColumnTimestampBridgeArgs
> = async (root, args, signal) => {
  let lib: ColumnBridgeLib;
  try {
    lib = await loadColumnBridgeLib();
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

  const stopRefit = refitHoldsOnResize(root);
  return onceDestroy(stopRefit, () => permalinkOf(widget.readState()));
};
