/**
 * The ID Timestamp Decoder widget (CORE-56), mountable on its tool page and in
 * the chat rail.
 *
 * The reader pastes one identifier. All five decoders run on it as typed, and
 * the one that reads it gives the instant: the hero names it, and a five-row
 * table shows every call and what it returned. A Snowflake reads only under the
 * layout the reader gives, so its three fields have no default.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`. The
 * template is chrome only: the hero, the rows and the printed calls are drawn
 * by `mount` from real calls in the reader's browser. Every listener is
 * delegated on the root, so the host dropping the subtree is a complete
 * teardown. The widget holds no epoch, unit factor or ID grammar: the library
 * says what each format reads as.
 */
import { codeFrameHtml } from "./code-frame";
import { renderCallResults, renderCalls } from "./edi-render";
import {
  callSizer,
  holdHtml,
  outputSizer,
  sizerHtml,
  textSizers,
} from "./edi-picture";
import { callArgs, formatValue, type EdiCall } from "./edi-widgets";
import {
  BAD_LAYOUT_TEXT,
  CUSTOM_PRESET_ID,
  EMPTY_ID_TEXT,
  FORMATS,
  ID_MAX_CHARS,
  ID_PRESETS,
  MANY_READ_TEXT,
  NONE_READ_TEXT,
  NOT_CALLED_TEXT,
  NO_LAYOUT_TEXT,
  WIDEST_INSTANT,
  WIDEST_LAYOUT,
  heroOf,
  isSeeded,
  matchPreset,
  permalinkOf,
  presetState,
  readArgs,
  readIds,
  versionChip,
  type Hero,
  type IdDecoderState,
  type IdRow,
  type IdTimestampDecoderArgs,
  type RowResult,
} from "./id-timestamp-decoder";
import { loadIdentifierLib, type IdentifierLib } from "./identifier-lib";
import { descriptionHoldHtml } from "./ledger-widgets";
import { setPresetDescription } from "./punctuality-widgets";
import { withBase } from "./site";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
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

export type { IdTimestampDecoderArgs } from "./id-timestamp-decoder";

/** The signal-lost pill, in the hero. */
export const NO_SIGNAL_PILL = "⟨ NO SIGNAL ⟩";

const HERO_CAP_IDLE = "Reading";
const STATUS_READ = "Read";
const STATUS_NOT_READ = "Not read";

/** The links under the calls: the sibling tool, the bench and each function's page. */
export const ID_LINKS = [
  {
    role: "link-bridge",
    text: "Column Timestamp Bridge",
    href: "/tools/column-timestamp-bridge/",
  },
  {
    role: "link-converter",
    text: "Converter Bench",
    href: "/tools/converter-bench/",
  },
  ...FORMATS.map((f) => ({
    role: `link-ref-${f.fn}`,
    text: `${f.fn} reference`,
    href: `/reference/precision/identifiers/${f.fn}/`,
  })),
] as const;

// ---------------------------------------------------------------------------
// The longest text each region holds, which sizes it
// ---------------------------------------------------------------------------

const LONGEST_ID = "x".repeat(ID_MAX_CHARS);

/** The call a row prints, as the call frame prints it. */
function callHtml(fn: string, args: readonly unknown[]): string {
  return `${codeSpan("fn", fn)}(${callArgs(args)[0]})`;
}

/** The longest call a row prints: the Snowflake call, with all three layout keys. */
const CALL_SIZER = callHtml("fromSnowflake", [LONGEST_ID, WIDEST_LAYOUT]);

const CALL_FRAME_SIZER = FORMATS.map((f) =>
  f.fn === "fromSnowflake"
    ? `${f.fn}(${callArgs([LONGEST_ID, WIDEST_LAYOUT])[1]})`
    : `${f.fn}(${callArgs([LONGEST_ID])[1]})`,
).join("\n");

const OUTPUT_SIZER = [1, 2, 3, 4, 5]
  .map(() => formatValue(WIDEST_INSTANT))
  .join("\n");

/** Every word the hero's reason slot can show. */
const REASON_TEXTS = [EMPTY_ID_TEXT, NONE_READ_TEXT, MANY_READ_TEXT];

/** Every format word the hero's caption can show. */
const CAP_TEXTS = [HERO_CAP_IDLE, ...FORMATS.map((f) => f.format)];

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

function presetOptionsHtml(presetId: string): string {
  return (
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Your values</option>` +
    ID_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("")
  );
}

function layoutFieldHtml(
  role: string,
  label: string,
  value: string,
  optional = false,
): string {
  return (
    `<label class="gmt-label">${labelTextHtml(label, { optional })}` +
    `<input class="gmt-input gmt-iddecode-num" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="17" data-role="${role}" value="${escapeAttr(value)}"></label>`
  );
}

/** What a row's Returned cell shows, as markup. */
function returnedHtml(result: RowResult): string {
  if (result.kind === "not-called") return escapeHtml(result.why);
  if (result.kind === "sentinel") {
    return `<code class="gmt-iddecode-literal">${escapeHtml(result.literal)}</code>`;
  }
  const instant = instantPiecesHtml(result.instant);
  return `<code class="gmt-iddecode-literal">"${instant}"</code>`;
}

/** Every Returned cell can show one of these, so each reserves the tallest. */
const RETURNED_SIZERS = [
  returnedHtml({ kind: "read", instant: WIDEST_INSTANT }),
  returnedHtml({ kind: "not-called", why: NO_LAYOUT_TEXT }),
  returnedHtml({ kind: "not-called", why: BAD_LAYOUT_TEXT }),
];

function rowHtml(index: number, row: IdRow | null): string {
  const { format, fn } = FORMATS[index]!;
  const state = row === null ? "pending" : row.result.kind;
  const status =
    row === null ? "" : state === "read" ? STATUS_READ : STATUS_NOT_READ;
  const call =
    row === null
      ? ""
      : row.call === null
        ? escapeHtml(NOT_CALLED_TEXT)
        : callHtml(row.call.fn, row.call.args);
  const returned = row === null ? "" : returnedHtml(row.result);
  const callCell = holdHtml(
    `<span class="gmt-iddecode-cell">${call}</span>`,
    [sizerHtml("span", "gmt-iddecode-cell", CALL_SIZER)],
    "gmt-ledger-hold",
  );
  const returnedCell = holdHtml(
    `<span class="gmt-iddecode-cell">${returned}</span>`,
    RETURNED_SIZERS.map((r) => sizerHtml("span", "gmt-iddecode-cell", r)),
    "gmt-ledger-hold",
  );
  return (
    `<tr class="gmt-iddecode-row" data-fn="${escapeAttr(fn)}" data-state="${state}">` +
    `<td data-label="Format"><span class="gmt-iddecode-format">${escapeHtml(format)}</span>` +
    `<span class="gmt-iddecode-status">${status === "" ? "&nbsp;" : status}</span></td>` +
    `<td data-label="Call">${callCell}</td>` +
    `<td data-label="Returned">${returnedCell}</td>` +
    `</tr>`
  );
}

function heroHtml(): string {
  return (
    `<div class="gmt-punct-hero gmt-iddecode-hero" data-role="hero-reading" data-state="empty">` +
    holdHtml(
      `<span class="gmt-punct-hero-cap" data-role="hero-cap">${HERO_CAP_IDLE}</span>`,
      CAP_TEXTS.map((t) =>
        sizerHtml("span", "gmt-punct-hero-cap", escapeHtml(t)),
      ),
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<span class="gmt-punct-hero-value" data-role="hero-value" data-off></span>` +
        `<span class="gmt-iddecode-pill" data-role="hero-pill" data-off>${NO_SIGNAL_PILL}</span>`,
      [
        sizerHtml(
          "span",
          "gmt-punct-hero-value",
          instantPiecesHtml(WIDEST_INSTANT),
        ),
      ],
      "gmt-ledger-hold",
    ) +
    `<span class="gmt-punct-hero-sub"><span class="gmt-iddecode-chip" data-role="hero-version" data-off>${versionChip(7)}</span></span>` +
    holdHtml(
      `<p class="gmt-widget-hint" data-role="hero-reason">${escapeHtml(EMPTY_ID_TEXT)}</p>`,
      textSizers("p", "gmt-widget-hint", REASON_TEXTS),
      "gmt-ledger-hold",
    ) +
    `</div>`
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the default preset. The hero, the rows and the calls are
 * drawn by `mount`, because they come from real library calls.
 */
export function renderIdTimestampDecoderTemplate(
  args: IdTimestampDecoderArgs = {},
): string {
  const state: IdDecoderState = isSeeded(args)
    ? readArgs(args)
    : presetState(ID_PRESETS[0]!);
  const presetId = matchPreset(state);
  const preset = ID_PRESETS.find((p) => p.id === presetId);

  return (
    `<div class="gmt-id-timestamp-decoder gmt-widget not-content">` +
    `<div class="gmt-widget-card">` +
    // 1. Paste an identifier
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>1. Paste an identifier</h4>` +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Preset")}` +
    `<select class="gmt-select" data-role="preset">${presetOptionsHtml(presetId)}</select></label>` +
    `</div>` +
    descriptionHoldHtml(
      `<p class="gmt-widget-hint" data-role="preset-description" data-grow="slot">${escapeHtml(preset?.description ?? "")}</p>`,
      ID_PRESETS.map((p) => p.description),
    ) +
    `<div class="gmt-field-grid">` +
    `<label class="gmt-label gmt-field-wide">${labelTextHtml("Identifier")}` +
    `<input class="gmt-input gmt-iddecode-id" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="${ID_MAX_CHARS}" data-role="id" value="${escapeAttr(state.id)}"></label>` +
    `</div>` +
    `<fieldset class="gmt-iddecode-group"><legend>Snowflake layout</legend>` +
    `<div class="gmt-field-grid">` +
    layoutFieldHtml("epoch", "Epoch (Unix ms)", state.epochMs) +
    layoutFieldHtml("shift", "Bits below the timestamp", state.shift) +
    layoutFieldHtml("bits", "Timestamp bits", state.timestampBits, true) +
    `</div></fieldset>` +
    `<p class="gmt-widget-hint">The identifier goes to every decoder exactly as typed. A Snowflake is read only when you give its epoch and shift.</p>` +
    `</div>` +
    // 2. What each decoder reads
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>2. What each decoder reads</h4>` +
    `<div class="gmt-iddecode-frame" data-role="frame">` +
    heroHtml() +
    `<div class="gmt-iddecode-table-box">` +
    `<table class="gmt-iddecode-table" data-role="table">` +
    `<thead><tr>` +
    `<th scope="col" class="gmt-iddecode-col-format">Format</th>` +
    `<th scope="col" class="gmt-iddecode-col-call">Call</th>` +
    `<th scope="col" class="gmt-iddecode-col-returned">Returned</th>` +
    `</tr></thead>` +
    `<tbody data-role="rows">${FORMATS.map((_, i) => rowHtml(i, null)).join("")}</tbody>` +
    `</table>` +
    `</div>` +
    `</div>` +
    `</div>` +
    // 3. The calls
    `<div class="gmt-widget-section gmt-widget-section--wide">` +
    `<h4>3. The calls</h4>` +
    holdHtml(
      codeFrameHtml("ids"),
      [callSizer(CALL_FRAME_SIZER)],
      "gmt-ledger-hold",
    ) +
    holdHtml(
      `<output class="gmt-widget-output" data-role="ids-output">&nbsp;</output>`,
      [outputSizer("gmt-widget-output", OUTPUT_SIZER)],
      "gmt-ledger-hold",
    ) +
    toolLinksHtml(ID_LINKS) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): IdDecoderState;
  apply(state: IdDecoderState): void;
  render(): void;
  syncPreset(): void;
}

function setupWidget(root: HTMLElement, lib: IdentifierLib): Controller {
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const presetEl = q<HTMLSelectElement>("preset")!;
  const idEl = q<HTMLInputElement>("id")!;
  const epochEl = q<HTMLInputElement>("epoch")!;
  const shiftEl = q<HTMLInputElement>("shift")!;
  const bitsEl = q<HTMLInputElement>("bits")!;

  const readState = (): IdDecoderState => ({
    id: idEl.value,
    epochMs: epochEl.value,
    shift: shiftEl.value,
    timestampBits: bitsEl.value,
  });

  function syncPreset(): void {
    const id = matchPreset(readState());
    presetEl.value = id;
    const slot = q("preset-description");
    if (slot) {
      setPresetDescription(
        slot,
        ID_PRESETS.find((p) => p.id === id)?.description ?? "",
      );
    }
  }

  function drawHero(hero: Hero): void {
    const el = q("hero-reading");
    if (!el) return;
    el.dataset["state"] = hero.kind;
    const cap = q("hero-cap");
    if (cap)
      cap.textContent = hero.kind === "one" ? hero.format : HERO_CAP_IDLE;
    const value = q("hero-value");
    if (value) {
      const text =
        hero.kind === "one"
          ? hero.instant
          : hero.kind === "many"
            ? `${hero.count} of ${FORMATS.length}`
            : "";
      // Clearing the text drops the pieces `wrapInstantsAtT` wrote last time.
      value.textContent = text;
      value.toggleAttribute("data-off", text === "");
    }
    q("hero-pill")?.toggleAttribute("data-off", hero.kind !== "none");
    const chip = q("hero-version");
    if (chip) {
      const version = hero.kind === "one" ? hero.version : undefined;
      chip.textContent = versionChip(version ?? 7);
      chip.toggleAttribute("data-off", version === undefined);
    }
    const reason = q("hero-reason");
    if (reason) {
      reason.textContent = hero.kind === "one" ? "" : hero.reason;
    }
    wrapInstantsAtT(el);
  }

  function drawRows(rows: readonly IdRow[]): void {
    const body = q("rows");
    if (body) body.innerHTML = rows.map((r, i) => rowHtml(i, r)).join("");
  }

  function drawCalls(rows: readonly IdRow[], hero: Hero): void {
    const out = q<HTMLElement>("ids-output");
    if (!out) return;
    if (hero.kind === "empty") {
      renderCalls(q("call-ids"), []);
      renderWidgetOutput(out, "Not read: there is no identifier.", "empty");
      return;
    }
    const calls = rows.flatMap((r) => (r.call === null ? [] : [r.call]));
    renderCalls(q("call-ids"), calls as EdiCall[]);
    // Every call that was made returned its sentinel: the pane says so line by line.
    renderCallResults(
      out,
      calls as EdiCall[],
      hero.kind === "none",
      formatValue,
    );
  }

  function drawLinks(): void {
    for (const link of ID_LINKS) {
      setToolLink(q(link.role), withBase(link.href));
    }
  }

  function render(): void {
    const state = readState();
    const rows = readIds(lib, state);
    const hero = heroOf(rows, state);
    drawHero(hero);
    drawRows(rows);
    drawCalls(rows, hero);
    drawLinks();
  }

  function apply(state: IdDecoderState): void {
    setControlValue(idEl, state.id);
    setControlValue(epochEl, state.epochMs);
    setControlValue(shiftEl, state.shift);
    setControlValue(bitsEl, state.timestampBits);
  }

  root.addEventListener("input", (e) => {
    const role = (e.target as HTMLElement).dataset?.["role"] ?? "";
    if (!["id", "epoch", "shift", "bits"].includes(role)) return;
    syncPreset();
    render();
  });

  root.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement;
    if (target.dataset?.["role"] !== "preset") return;
    const preset = ID_PRESETS.find((p) => p.id === target.value);
    // "Your values" keeps what is typed.
    if (!preset) return;
    apply(presetState(preset));
    syncPreset();
    render();
  });

  wireCopyButtons(root);
  syncPreset();
  render();

  return { readState, apply, render, syncPreset };
}

export const mountIdTimestampDecoder: MountFn<IdTimestampDecoderArgs> = async (
  root,
  args,
  signal,
) => {
  let lib: IdentifierLib;
  try {
    lib = await loadIdentifierLib();
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
    () => {},
    () => permalinkOf(widget.readState()),
  );
};
