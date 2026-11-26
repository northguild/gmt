/**
 * The CCSDS Time Code Decoder widget (SPA-52), mountable on its tool page and in the chat rail.
 *
 * Section 1 reads one pasted CCSDS 301.0-B-4 ASCII time code with `parseCcsdsAsciiA` and
 * `parseCcsdsAsciiB`, both called on the text as typed: which code it is, the instant, whether
 * second 60 is an inserted leap second, how many fraction digits it keeps and whether a `Z` was
 * sent. Section 2 writes one instant as both codes at the chosen number of fraction digits and
 * draws the digits a cut dropped.
 *
 * Built on the component kit and the EDI figure: `renderCcsdsTimeCodeDecoderTemplate` writes the
 * markup from builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by
 * those ids. Every listener is delegated on the widget with the mount's `signal`; no timer runs.
 * The widget holds no grammar, leap-second table, month table or leap-year rule: the library says
 * what each code reads as, and a refusal is explained by asking it again (`ccsds-picture.ts`).
 *
 * `""` from the library renders as NO SIGNAL. An empty box makes no call and is a plain empty
 * state, never amber.
 */
import { defineElements } from "~/widgets/define";
import {
  button,
  buttonRow,
  disclosure,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  plates,
  section,
  setHtml,
  srOnly,
  textInput,
  toolLinks,
  verdict,
  widget,
  wireDisclosure,
  type Plate,
  type SafeHtml,
  type ToolLinkItem,
} from "~/widgets/builders";
import {
  callFrameContent,
  callFrameHold,
  callLines,
  emptyOutput,
  outputContent,
  outputHold,
  outputOf,
  type CallOutputState,
} from "~/widgets/families/edi/edi-call";
import {
  ediFigure,
  figureContent,
  type FigureValue,
} from "~/widgets/families/edi/edi-figure";
import { hold, holdText } from "~/widgets/families/edi/edi-hold";
import { asideContent, verdictHold } from "~/widgets/families/edi/edi-view";
import {
  instantHero,
  type InstantHeroOptions,
} from "~/widgets/families/ids/instant-hero";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { copy, type GmtCopy } from "~/widgets/primitives/copy/copy";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/ccsds-time-code-decoder.module.css";
import { REASON_SAMPLES, pictureOf } from "./ccsds-picture";
import {
  CCSDS_MAX_CHARS,
  CODE_PRESETS,
  CODE_WORDS,
  CUSTOM_PRESET_ID,
  CUT_LABEL,
  DIGIT_VALUES,
  EMPTY_CODE_TEXT,
  EMPTY_INSTANT_TEXT,
  NOT_READ_TEXT,
  NO_RESULT_WORDS,
  WIDEST_CODE_A,
  WIDEST_CODE_B,
  WIDEST_INSTANT,
  WRITE_PRESETS,
  WRITE_REFUSED_TEXT,
  digitChoiceOf,
  droppedWords,
  isSeeded,
  matchCodePreset,
  matchWritePreset,
  permalinkOf,
  precisionWords,
  presetState,
  readArgs,
  readCode,
  writeInstant,
  type CcsdsDecoderArgs,
  type CcsdsState,
  type CodeReading,
  type CutLine,
  type WriteReading,
} from "./ccsds-time-code-decoder";
import { loadCcsdsLib } from "./ccsds-lib";
import type { CcsdsLib } from "./ccsds-widgets";
import { callResultsText } from "./edi-render";
import type { EdiCall } from "./edi-widgets";
import { withBase } from "./site";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { CcsdsDecoderArgs as CcsdsTimeCodeDecoderArgs } from "./ccsds-time-code-decoder";

const WIDGET_NAME = "ccsds-time-code-decoder";
const HERO_CAPTION = "Instant";
const USE_READ_LABEL = "Use the instant read above";
const REASON_DISCLOSURE = "How the reason was found";

/** The links under the calls. */
const CCSDS_LINKS = [
  {
    text: "Leap seconds and TAI",
    href: "/guides/core-date-operations/leap-seconds-and-tai/",
  },
  { text: "Leap Second Timeline", href: "/tools/leap-second-timeline/" },
] as const;

// ---------------------------------------------------------------------------
// The widest each region holds, which sizes it
// ---------------------------------------------------------------------------

/** The literal picture of a code, cut by the same code `readCode` draws with. */
const literalFigure = (
  kind: "A" | "B",
  written: string,
  dayCaption = "",
): FigureValue => ({
  halves: pictureOf(kind, written, dayCaption).halves,
  separator: "",
  closing: "",
});

/**
 * Every picture the figure can draw, written out as literals so the box is sized before the
 * library has loaded: both codes at nine digits, and at none. The widest Code B caption is the
 * longest month name with the widest day.
 */
export const RESERVED_FIGURES: readonly FigureValue[] = [
  literalFigure("A", "2024-06-15T14:30:00.123456789Z"),
  literalFigure("A", "2024-06-15T14:30:00Z"),
  literalFigure("B", "2024-273T14:30:00.123456789Z", "day 273 = 30 September"),
  literalFigure("B", "2024-273T14:30:00Z", "day 273 = 30 September"),
];

const WIDEST_WRITE = "2024-06-15T16:30:00.123456789+02:00";

const readCalls = (code: string): EdiCall[] => [
  { fn: "parseCcsdsAsciiA", args: [code], result: WIDEST_INSTANT },
  { fn: "parseCcsdsAsciiB", args: [code], result: "" },
];
const writeCalls = (text: string): EdiCall[] => [
  { fn: "formatCcsdsAsciiA", args: [text, 9], result: WIDEST_CODE_A },
  { fn: "formatCcsdsAsciiB", args: [text, 9], result: WIDEST_CODE_B },
];

/**
 * The longest text either box takes. A call frame scrolls sideways when a line is too long, so
 * its hold is sampled with this: the ghost then draws the same scrollbar, and the frame does not
 * grow when a long code or instant is typed.
 */
const LONGEST_TYPED = "0".repeat(CCSDS_MAX_CHARS);

const READ_CALL_SAMPLES = [callLines(readCalls(LONGEST_TYPED)).plain];
const READ_OUTPUT_SAMPLES = [callResultsText(readCalls(WIDEST_INSTANT))];
const WRITE_CALL_SAMPLES = [callLines(writeCalls(LONGEST_TYPED)).plain];
const WRITE_OUTPUT_SAMPLES = [callResultsText(writeCalls(WIDEST_WRITE))];

const VERDICT_TITLES = [
  EMPTY_CODE_TEXT,
  "Refused",
  "A leap second UTC inserted",
  "Read as Code A",
  "Read as Code B",
];
const VERDICT_DETAILS = [
  ...REASON_SAMPLES,
  "Read as Code B with 9 fraction digits; 3 digits after the ninth were dropped.",
];

const CODE_SAMPLES = [CODE_WORDS.A, CODE_WORDS.B, CODE_WORDS.none];
const PRECISION_SAMPLES = [
  precisionWords(9),
  precisionWords(6),
  precisionWords(0),
];
const DROPPED_SAMPLES = ["12 digits after the ninth dropped"];
const LEAP_SAMPLES = ["An inserted leap second", "No"];
const Z_SAMPLES = ["Sent", "Not sent, still UTC"];

/** The widest cut line: a nine-digit code with every digit it could drop. */
const CUT_SAMPLE: CutLine = { kept: WIDEST_CODE_A, dropped: "999999999" };

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const presetOptions = (
  presets: readonly { id: string; label: string; description: string }[],
) => [
  { value: CUSTOM_PRESET_ID, label: "Your values", description: "" },
  ...presets.map((p) => ({
    value: p.id,
    label: p.label,
    description: p.description,
  })),
];

function heroOptions(r: CodeReading | null): InstantHeroOptions {
  const kind =
    r === null || r.kind === "empty"
      ? "empty"
      : r.kind === "read"
        ? "one"
        : "none";
  return {
    gate: "hero",
    caption: HERO_CAPTION,
    captions: [HERO_CAPTION],
    label: "Instant read",
    state: kind,
    value: r?.instant ?? "",
    sample: WIDEST_INSTANT,
    lost: kind === "none",
    bar: kind === "one",
    chip: {
      text: r?.which === "A" ? "Code A" : r?.which === "B" ? "Code B" : "",
      sample: "Code A",
    },
    call: null,
    reason: "",
    reasons: [],
  };
}

function readPlates(r: CodeReading | null): SafeHtml {
  const read = r !== null && r.kind === "read";
  const list: Plate[] = [
    {
      caption: "Code",
      value: read && r.which !== null ? CODE_WORDS[r.which] : null,
      lines: ["by the date it carries"],
      samples: CODE_SAMPLES,
      words: CODE_SAMPLES,
      lineSamples: [["by the date it carries"]],
    },
    {
      caption: "Second 60",
      value: read
        ? r.secondSixty
          ? LEAP_SAMPLES[0]!
          : LEAP_SAMPLES[1]!
        : null,
      lines: ["read from the instant returned"],
      samples: LEAP_SAMPLES,
      words: LEAP_SAMPLES,
      lineSamples: [["read from the instant returned"]],
    },
    {
      caption: "Precision",
      value: read ? precisionWords(r.digits) : null,
      lines: [read ? droppedWords(r.dropped) : ""],
      samples: PRECISION_SAMPLES,
      words: PRECISION_SAMPLES,
      lineSamples: [DROPPED_SAMPLES],
    },
    {
      caption: "Z",
      value: read ? (r.zSent ? Z_SAMPLES[0]! : Z_SAMPLES[1]!) : null,
      lines: ["a code is UTC either way"],
      samples: Z_SAMPLES,
      words: Z_SAMPLES,
      lineSamples: [["a code is UTC either way"]],
    },
  ];
  return plates(list, { gate: "plates" });
}

/** The cut line: `cut, not rounded: <code><s>dropped digits</s>`. */
function cutContent(cut: CutLine | null): SafeHtml {
  // The same nodes with or without a cut, so the hold's structure never changes: with none the
  // line is hidden and the ghost keeps its place.
  const c = cut ?? { kept: "", dropped: "" };
  return html`<p class="${styles.cut}" ${cut === null ? "hidden" : ""}><span class="${styles.cutLabel}">${CUT_LABEL}</span> <span class="${styles.code}">${c.kept}<s class="${styles.struck}">${srOnly("dropped ")}${c.dropped}</s></span></p>`;
}

/** The refusal aside: always drawn, hidden unless the instant was refused. */
function writeReasonContent(shown: boolean): SafeHtml {
  return html`<div ${shown ? "" : "hidden"}>${asideContent([WRITE_REFUSED_TEXT])}</div>`;
}

/**
 * One span in every state (a code, `no result`, or nothing for an empty box), so the plate holds
 * the same nodes whatever was typed.
 */
function outValue(text: string, refused: boolean): SafeHtml {
  return refused
    ? html`<span class="${styles.lost}">${NO_RESULT_WORDS}</span>`
    : html`<span class="${styles.code}">${text}</span>`;
}

function outPlate(
  id: (local: string) => string,
  kind: "a" | "b",
  caption: string,
  widest: string,
  text: string,
): SafeHtml {
  return html`<div class="${styles.outPlate}" data-gate="hero"><span class="${styles.outCaption}">${caption}</span><div class="${styles.outRow}"><div class="${styles.outValue}">${hold(
    {
      id: id(`out-${kind}`),
      role: "status",
      label: caption,
      content: outValue(text, false),
      ghosts: [outValue(widest, false), outValue("", true)],
    },
  )}</div><span id="${id(`copy-${kind}`)}" class="${styles.copyIdle}" inert>${copy({ label: `Copy ${caption}`, text })}</span></div></div>`;
}

function reasonContent(r: CodeReading | null, id: string): SafeHtml {
  if (r === null || r.kind !== "refused" || r.reasonCalls.length === 0) {
    return html``;
  }
  return disclosure({
    id,
    label: REASON_DISCLOSURE,
    children: callFrameContent({
      label: REASON_DISCLOSURE,
      calls: r.reasonCalls,
    }),
  });
}

function linkItems(): ToolLinkItem[] {
  return CCSDS_LINKS.map((l) => ({ text: l.text, href: withBase(l.href) }));
}

function linksOf(): SafeHtml {
  return toolLinks({ label: "Related", links: linkItems() });
}

function readOutput(r: CodeReading): CallOutputState {
  if (r.kind === "empty") return emptyOutput(NOT_READ_TEXT);
  return outputOf(r.kind === "refused" ? "sentinel" : "ok", r.calls);
}

function writeOutput(w: WriteReading): CallOutputState {
  if (w.kind === "empty") return emptyOutput("nothing to write");
  return outputOf(w.kind === "refused" ? "sentinel" : "ok", w.calls);
}

function verdictOf(r: CodeReading): {
  tone: "neutral" | "good" | "bad";
  title: string;
  detail: string;
} {
  if (r.kind === "empty")
    return { tone: "neutral", title: EMPTY_CODE_TEXT, detail: "" };
  if (r.kind === "refused") {
    return { tone: "bad", title: "Refused", detail: r.reason };
  }
  const code = `Read as Code ${r.which}`;
  return {
    tone: "good",
    title: r.secondSixty ? "A leap second UTC inserted" : code,
    detail:
      r.dropped > 0
        ? `${code} with ${r.digits} fraction digits; ${droppedWords(r.dropped)}.`
        : r.secondSixty
          ? `${code}: second 60 is a second UTC inserted on that day.`
          : "",
  };
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset of each section. The reading is drawn by `mount`, because it comes from
 * real library calls.
 */
export function renderCcsdsTimeCodeDecoderTemplate(
  idPrefix: string,
  args: CcsdsDecoderArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: CcsdsState = isSeeded(args) ? readArgs(args) : presetState();

  const input = (local: string, label: string, value: string) =>
    field({
      id: id(local),
      label,
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value,
          autocomplete: "off",
          spellcheck: false,
          maxLength: CCSDS_MAX_CHARS,
          inputMode: "text",
          describedBy,
        }),
    });

  const pick = section(
    { id: id("pick"), heading: "1. Paste a CCSDS time code", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchCodePreset(state.code),
      options: presetOptions(CODE_PRESETS),
    })}${fieldGrid(input("code", "CCSDS ASCII time code", state.code))}<p class="${styles.note}">The text goes to the library exactly as typed. CCSDS 301.0-B-4 defines Code A (a calendar date) and Code B (a day of the year); both are UTC.</p></div>`,
  );

  const read = section(
    { id: id("read"), heading: "2. What the calls read", level: 4 },
    html`<div class="${styles.split}">
      <div class="${styles.pane}"><div class="${styles.panel}">${grow(
        html`<div id="${id("hero")}">${instantHero(heroOptions(null))}</div>`,
      )}${grow(html`<div id="${id("plates")}">${readPlates(null)}</div>`)}${ediFigure(
        {
          id: id("figure"),
          spec: { kind: "empty", text: EMPTY_CODE_TEXT },
          reserve: RESERVED_FIGURES,
        },
      )}${verdictHold({
        id: id("verdict"),
        titles: VERDICT_TITLES,
        details: VERDICT_DETAILS,
      })}${hold({
        id: id("reason"),
        content: html``,
        ghosts: [
          disclosure({
            id: id("reason-ghost"),
            label: REASON_DISCLOSURE,
            children: html``,
          }),
        ],
      })}</div></div>
      <div class="${styles.pane}">${callFrameHold({
        id: id("read-call"),
        spec: { label: "Calls made", calls: [] },
        samples: READ_CALL_SAMPLES,
      })}${outputHold({
        id: id("read-output"),
        label: "What the calls returned",
        state: emptyOutput(NOT_READ_TEXT),
        samples: READ_OUTPUT_SAMPLES,
      })}</div>
    </div>`,
  );

  const write = section(
    {
      id: id("write"),
      heading: "3. Write an instant as both codes",
      level: 4,
    },
    html`<div class="${styles.controls}">${preset({
      id: id("write-preset"),
      label: "Instant preset",
      value: matchWritePreset(state.instant, state.digits),
      options: presetOptions(WRITE_PRESETS),
    })}${fieldGrid(input("instant", "Instant", state.instant))}<div class="${styles.wide}" id="${id("digits-slot")}">${chips(
      {
        legend: "Fraction digits",
        kind: "radio",
        name: id("digits"),
        items: DIGIT_VALUES.map((v) => ({
          value: v,
          label: v,
          checked: v === String(state.digits),
        })),
      },
    )}</div><div class="${styles.action}">${buttonRow(
      button({
        id: id("use-read"),
        label: USE_READ_LABEL,
        describedBy: id("use-read-note"),
      }),
    )}<p class="${styles.note}" id="${id("use-read-note")}">Copies the instant from section 2, a leap second included, into the box above.</p></div></div>
    <div class="${styles.split}">
      <div class="${styles.pane}"><div class="${styles.outPlates}">${outPlate(id, "a", "Code A", WIDEST_CODE_A, "")}${outPlate(id, "b", "Code B", WIDEST_CODE_B, "")}</div>${hold(
        {
          id: id("cut"),
          role: "note",
          label: "The digits a cut dropped",
          content: cutContent(null),
          ghosts: [cutContent(CUT_SAMPLE)],
        },
      )}${hold({
        id: id("write-reason"),
        content: writeReasonContent(false),
        ghosts: [writeReasonContent(true)],
      })}</div>
      <div class="${styles.pane}">${callFrameHold({
        id: id("write-call"),
        spec: { label: "Calls made", calls: [] },
        samples: WRITE_CALL_SAMPLES,
      })}${outputHold({
        id: id("write-output"),
        label: "What the calls returned",
        state: emptyOutput("nothing to write"),
        samples: WRITE_OUTPUT_SAMPLES,
      })}${holdText({
        id: id("write-note"),
        role: "note",
        label: "About the written codes",
        text: "",
        samples: [EMPTY_INSTANT_TEXT],
      })}</div>
    </div>`,
  );

  const links = section(
    { id: id("links"), heading: "4. Related", level: 4 },
    html`${grow(html`<div id="${id("links-slot")}">${linksOf()}</div>`)}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "CCSDS Time Code Decoder", scope: idPrefix },
    html`${pick}${read}${write}${links}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): CcsdsState;
  apply(state: CcsdsState): void;
  render(): void;
  syncPresets(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: CcsdsLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  // The ids sit on the inner selects; the host is the element that carries `value` and
  // re-emits `change` from itself.
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const writePresetEl = el("write-preset").closest<GmtPreset>("gmt-preset")!;
  const codeEl = el<HTMLInputElement>("code");
  const instantEl = el<HTMLInputElement>("instant");
  const useEl = el<HTMLButtonElement>("use-read");
  const digitsEl = el("digits-slot").querySelector<GmtChips>("gmt-chips")!;
  const copyA = el("copy-a");
  const copyB = el("copy-b");
  const reasonId = `${el("reason").id}-how`;
  let reading: CodeReading | null = null;
  // The reasons disclosure is drawn again on each reading: one wire per drawing.
  let reasonWire: AbortController | null = null;
  signal.addEventListener("abort", () => reasonWire?.abort(), { once: true });

  const readState = (): CcsdsState => ({
    code: codeEl.value,
    instant: instantEl.value,
    digits: digitChoiceOf(String(digitsEl.value)),
  });

  function syncPresets(): void {
    const s = readState();
    presetEl.value = matchCodePreset(s.code);
    writePresetEl.value = matchWritePreset(s.instant, s.digits);
  }

  function renderRead(code: string): void {
    const r = readCode(lib, code);
    reading = r;
    setHtml(el("hero"), instantHero(heroOptions(r)));
    setHtml(el("plates"), readPlates(r));
    setHtml(
      el("figure"),
      r.picture === null
        ? figureContent({ kind: "empty", text: EMPTY_CODE_TEXT })
        : figureContent({
            kind: "value",
            aria: r.picture.aria,
            halves: r.picture.halves,
            separator: "",
            closing: "",
          }),
    );
    setHtml(el("verdict"), r.kind === "empty" ? html`` : verdict(verdictOf(r)));
    reasonWire?.abort();
    reasonWire = null;
    setHtml(el("reason"), reasonContent(r, reasonId));
    const disclosureRoot =
      el("reason").querySelector<HTMLElement>("[data-disclosure]");
    if (disclosureRoot !== null) {
      reasonWire = new AbortController();
      const wireSignal = AbortSignal.any([signal, reasonWire.signal]);
      wireDisclosure(disclosureRoot, { signal: wireSignal });
    }
    setHtml(
      el("read-call"),
      callFrameContent({ label: "Calls made", calls: r.calls }),
    );
    setHtml(
      el("read-output"),
      outputContent("What the calls returned", readOutput(r)),
    );
    // A code that was not read has no instant to copy.
    useEl.disabled = r.instant === "";
  }

  function renderWrite(text: string, digits: CcsdsState["digits"]): void {
    const w = writeInstant(lib, text, digits);
    // A plate shows `no result` only when the library returned `""` for text it was given.
    setHtml(el("out-a"), outValue(w.a, w.kind !== "empty" && w.a === ""));
    setHtml(el("out-b"), outValue(w.b, w.kind !== "empty" && w.b === ""));
    for (const [wrap, text] of [
      [copyA, w.a],
      [copyB, w.b],
    ] as const) {
      const host = wrap.querySelector<GmtCopy>("gmt-copy");
      if (host !== null) host.text = text;
      // The button keeps its place so the plate never changes size; it is out of reach too.
      wrap.classList.toggle(styles.copyIdle!, text === "");
      wrap.inert = text === "";
    }
    setHtml(el("cut"), cutContent(w.cut));
    setHtml(
      el("write-call"),
      callFrameContent({ label: "Calls made", calls: w.calls }),
    );
    setHtml(
      el("write-output"),
      outputContent("What the calls returned", writeOutput(w)),
    );
    setHtml(el("write-reason"), writeReasonContent(w.kind === "refused"));
    el("write-note").textContent = w.kind === "empty" ? EMPTY_INSTANT_TEXT : "";
  }

  function render(): void {
    const s = readState();
    renderRead(s.code);
    renderWrite(s.instant, s.digits);
    setHtml(el("links-slot"), linksOf());
  }

  function apply(state: CcsdsState): void {
    codeEl.value = state.code;
    instantEl.value = state.instant;
    digitsEl.value = String(state.digits);
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target !== codeEl && e.target !== instantEl) return;
      syncPresets();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target === presetEl) {
        const chosen = CODE_PRESETS.find((p) => p.id === presetEl.value);
        // "Your values" keeps what is typed.
        if (!chosen) return;
        codeEl.value = chosen.text;
      } else if (e.target === writePresetEl) {
        const chosen = WRITE_PRESETS.find((p) => p.id === writePresetEl.value);
        if (!chosen) return;
        instantEl.value = chosen.text;
        digitsEl.value = String(chosen.digits);
      } else if (e.target !== digitsEl) return;
      syncPresets();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "click",
    (e) => {
      if (
        !(e.target instanceof Element) ||
        e.target.closest("button") !== useEl
      ) {
        return;
      }
      const instant = reading?.instant;
      if (instant === undefined || instant === "") return;
      instantEl.value = instant;
      syncPresets();
      render();
    },
    { signal },
  );

  syncPresets();
  render();

  return { readState, apply, render, syncPresets };
}

export const mountCcsdsTimeCodeDecoder: MountFn<CcsdsDecoderArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: CcsdsLib;
  try {
    lib = await loadCcsdsLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widgetCtl = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    widgetCtl.apply(readArgs(args));
    widgetCtl.syncPresets();
    widgetCtl.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(widgetCtl.readState()),
  );
};
