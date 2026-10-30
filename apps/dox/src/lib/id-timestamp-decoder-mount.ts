/**
 * The ID Timestamp Decoder widget (CORE-56), mountable on its tool page and in
 * the chat rail.
 *
 * The reader pastes one identifier. All five decoders run on it as typed, and
 * the one that reads it gives the instant: the plate names it, and a five-row
 * table shows every call and what it returned. A Snowflake reads only under the
 * layout the reader gives, so its three fields have no default.
 *
 * Built on the component kit: `renderIdTimestampDecoderTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids
 * and reads and writes element `value` properties. Every listener is delegated on the widget
 * with the mount's `signal`. The widget holds no epoch, unit factor or ID grammar: the
 * library says what each format reads as.
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
import { idRows, type IdRowView } from "~/widgets/families/ids/id-rows";
import {
  instantHero,
  NO_SIGNAL_PILL,
  type InstantHeroOptions,
} from "~/widgets/families/ids/instant-hero";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/id-timestamp-decoder.module.css";
import { callArgs } from "./punctuality-widgets";
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
import { withBase } from "./site";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { codeSpan } from "./widget-ui";

export type { IdTimestampDecoderArgs } from "./id-timestamp-decoder";

export { NO_SIGNAL_PILL };

const WIDGET_NAME = "id-timestamp-decoder";
const HERO_CAP_IDLE = "Reading";
const STATUS_READ = "Read";
const STATUS_NOT_READ = "Not read";
const EMPTY_OUTPUT_TEXT = "Not read: there is no identifier.";

/** The links under the calls: the sibling tool, the bench and each function's page. */
const ID_LINKS = [
  {
    text: "Column Timestamp Bridge",
    href: "/tools/column-timestamp-bridge/",
  },
  {
    text: "Converter Bench",
    href: "/tools/converter-bench/",
  },
  ...FORMATS.map((f) => ({
    text: `${f.fn} reference`,
    href: `/reference/precision/identifiers/${f.fn}/`,
  })),
] as const;

// ---------------------------------------------------------------------------
// The longest text each region holds, which sizes it
// ---------------------------------------------------------------------------

const LONGEST_ID = "x".repeat(ID_MAX_CHARS);

/** The call a row prints, as the call frame prints it. */
function callHtml(fn: string, args: readonly unknown[]): SafeHtml {
  return raw(`${codeSpan("fn", fn)}(${callArgs(args)[0]})`);
}

/** The longest call a row prints: the Snowflake call, with all three layout keys. */
const CALL_SAMPLE = callHtml("fromSnowflake", [LONGEST_ID, WIDEST_LAYOUT]);
const CALL_SAMPLES = [CALL_SAMPLE];

/** Every Returned cell can show one of these, so each reserves the tallest. */
const RETURNED_SAMPLES = [
  instant(`"${WIDEST_INSTANT}"`),
  NO_LAYOUT_TEXT,
  BAD_LAYOUT_TEXT,
];

/** Every word the plate's reason slot can show. */
const REASONS = [EMPTY_ID_TEXT, NONE_READ_TEXT, MANY_READ_TEXT];

/** Every format word the plate's caption can show. */
const CAPTIONS = [HERO_CAP_IDLE, ...FORMATS.map((f) => f.format)];

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function returnedOf(result: RowResult): SafeHtml {
  if (result.kind === "not-called") return html`<p>${result.why}</p>`;
  if (result.kind === "sentinel") return html`<code>${result.literal}</code>`;
  return html`<code>"${instant(result.instant)}"</code>`;
}

function rowViews(rows: readonly IdRow[] | null): IdRowView[] {
  return FORMATS.map(({ format, fn }, i): IdRowView => {
    const row = rows?.[i] ?? null;
    if (row === null) {
      return {
        fn,
        format,
        state: "pending",
        status: "",
        call: "",
        returned: "",
      };
    }
    return {
      fn,
      format,
      state: row.result.kind,
      status: row.result.kind === "read" ? STATUS_READ : STATUS_NOT_READ,
      call:
        row.call === null
          ? html`<p>${NOT_CALLED_TEXT}</p>`
          : html`<code>${callHtml(row.call.fn, row.call.args)}</code>`,
      returned: returnedOf(row.result),
    };
  });
}

function tableOf(rows: readonly IdRow[] | null): SafeHtml {
  return idRows({
    caption: "What each decoder reads",
    rows: rowViews(rows),
    callSamples: CALL_SAMPLES,
    returnedSamples: RETURNED_SAMPLES,
  });
}

function heroOptions(hero: Hero | null): InstantHeroOptions {
  const kind = hero?.kind ?? "empty";
  const value =
    hero === null
      ? ""
      : hero.kind === "one"
        ? hero.instant
        : hero.kind === "many"
          ? `${hero.count} of ${FORMATS.length}`
          : "";
  const version = hero?.kind === "one" ? hero.version : undefined;
  return {
    gate: "hero",
    caption: hero?.kind === "one" ? hero.format : HERO_CAP_IDLE,
    captions: CAPTIONS,
    label: "Decoded instant",
    state: kind,
    value,
    sample: WIDEST_INSTANT,
    lost: kind === "none",
    bar: kind === "one" || kind === "many",
    chip: {
      text: version === undefined ? "" : versionChip(version),
      sample: versionChip(7),
    },
    call: null,
    reason: hero === null || hero.kind === "one" ? "" : hero.reason,
    reasons: REASONS,
  };
}

function plateOf(hero: Hero | null): SafeHtml {
  return instantHero(heroOptions(hero));
}

function linkItems(): ToolLinkItem[] {
  return ID_LINKS.map((l) => ({ text: l.text, href: withBase(l.href) }));
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

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With
 * no args it shows the default preset. The plate, the rows and the calls are
 * drawn by `mount`, because they come from real library calls.
 */
export function renderIdTimestampDecoderTemplate(
  idPrefix: string,
  args: IdTimestampDecoderArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: IdDecoderState = isSeeded(args)
    ? readArgs(args)
    : presetState(ID_PRESETS[0]!);

  const layoutField = (name: string, label: string, value: string): SafeHtml =>
    field({
      id: id(name),
      label,
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value,
          inputMode: "numeric",
          autocomplete: "off",
          spellcheck: false,
          maxLength: 17,
          describedBy,
        }),
    });

  const pick = section(
    { id: id("pick"), heading: "1. Paste an identifier", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Your values", description: "" },
        ...ID_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      field({
        id: id("id"),
        label: "Identifier",
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: state.id,
            autocomplete: "off",
            spellcheck: false,
            maxLength: ID_MAX_CHARS,
            describedBy,
          }),
      }),
    )}<fieldset class="${styles.group}"><legend class="${styles.legend}">Snowflake layout</legend>${fieldGrid(
      html`${layoutField("epoch", "Epoch (Unix ms)", state.epochMs)}${layoutField("shift", "Bits below the timestamp", state.shift)}${layoutField("bits", "Timestamp bits (optional)", state.timestampBits)}`,
    )}</fieldset><p class="${styles.hint}">The identifier goes to every decoder exactly as typed. A Snowflake is read only when you give its epoch and shift.</p></div>`,
  );

  const read = section(
    { id: id("read"), heading: "2. What each decoder reads", level: 4 },
    html`${grow(
      html`<div class="${styles.frame}" data-gate="frame">
      <div id="${id("hero")}">${plateOf(null)}</div>
      <div id="${id("table")}">${tableOf(null)}</div>
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
    { name: WIDGET_NAME, label: "ID Timestamp Decoder", scope: idPrefix },
    html`${pick}${read}${calls}`,
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

function setupWidget(
  root: HTMLElement,
  lib: IdentifierLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const idEl = el<HTMLInputElement>("id");
  const epochEl = el<HTMLInputElement>("epoch");
  const shiftEl = el<HTMLInputElement>("shift");
  const bitsEl = el<HTMLInputElement>("bits");

  const typed: readonly EventTarget[] = [idEl, epochEl, shiftEl, bitsEl];

  const readState = (): IdDecoderState => ({
    id: idEl.value,
    epochMs: epochEl.value,
    shift: shiftEl.value,
    timestampBits: bitsEl.value,
  });

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function render(): void {
    const state = readState();
    const rows = readIds(lib, state);
    const hero = heroOf(rows, state);

    setHtml(el("hero"), plateOf(hero));
    setHtml(el("table"), tableOf(rows));

    const calls = rows.flatMap((r) => (r.call === null ? [] : [r.call]));
    if (hero.kind === "empty") {
      setHtml(el("calls-slot"), framesOf(""));
      setHtml(
        el("output-slot"),
        callOutput({
          label: "What the calls returned",
          state: "empty",
          lines: [{ text: EMPTY_OUTPUT_TEXT, lost: false }],
        }),
      );
    } else {
      const { code, plain } = callLines(calls);
      setHtml(el("calls-slot"), framesOf(plain, code));
      const out = outputOf(hero.kind === "none" ? "sentinel" : "ok", calls);
      setHtml(
        el("output-slot"),
        callOutput({
          label: "What the calls returned",
          state: out.state,
          lines: out.lines,
        }),
      );
    }
    setHtml(el("links"), linksOf());
  }

  function apply(state: IdDecoderState): void {
    idEl.value = state.id;
    epochEl.value = state.epochMs;
    shiftEl.value = state.shift;
    bitsEl.value = state.timestampBits;
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
      if (e.target !== presetEl) return;
      const chosen = ID_PRESETS.find((p) => p.id === presetEl.value);
      // "Your values" keeps what is typed.
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

export const mountIdTimestampDecoder: MountFn<IdTimestampDecoderArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: IdentifierLib;
  try {
    lib = await loadIdentifierLib();
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
