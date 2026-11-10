/**
 * The FIX Timestamp Reader widget (FIN-95), mountable on its tool page and in the chat rail.
 *
 * Section 1 reads one pasted FIX `UTCTimestamp` with `parseFixUtcTimestamp` and
 * `isValidFixUtcTimestamp`, both called on the text as typed: the instant, the precision the
 * digit count states, whether second 60 is an inserted leap second, and the picosecond digits
 * apart from the instant. Section 2 writes one instant at the five precisions with
 * `formatFixUtcTimestamp`, and can take the instant section 1 read.
 *
 * Built on the component kit and the EDI figure: `renderFixTimestampReaderTemplate` writes the
 * markup from builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by
 * those ids. Every listener is delegated on the widget with the mount's `signal`; no timer runs.
 * The widget holds no grammar, width table or leap-second table: the library says what each
 * stamp reads as, and a refusal is explained by asking it again (`fix-picture.ts`).
 *
 * `null` and `""` from the library render as NO SIGNAL. An empty box makes no call and is a
 * plain empty state, never amber.
 */
import { defineElements } from "~/widgets/define";
import {
  button,
  buttonRow,
  field,
  fieldGrid,
  findWidget,
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
import { holdText } from "~/widgets/families/edi/edi-hold";
import {
  asideContent,
  asideHold,
  verdictHold,
} from "~/widgets/families/edi/edi-view";
import {
  instantHero,
  type InstantHeroOptions,
} from "~/widgets/families/ids/instant-hero";
import { verdict } from "~/widgets/builders";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/fix-timestamp-reader.module.css";
import type { EdiCall } from "./edi-widgets";
import { callResultsText } from "./edi-render";
import { loadFinanceLib } from "./finance-lib";
import type { FinanceLib } from "./finance-widgets";
import { REASON_SAMPLES, probeShape, type FixShape } from "./fix-picture";
import {
  CUSTOM_PRESET_ID,
  CUT_NOTE,
  EMPTY_INSTANT_TEXT,
  EMPTY_STAMP_TEXT,
  FIX_MAX_CHARS,
  NONE_SENT_TEXT,
  NOT_READ_TEXT,
  PAD_NOTE,
  STAMP_PRESETS,
  WIDEST_INSTANT,
  WIDEST_STAMP,
  WRITE_PRESETS,
  WRITE_REFUSED_TEXT,
  isSeeded,
  matchStampPreset,
  matchWritePreset,
  permalinkOf,
  presetState,
  readArgs,
  readStamp,
  writeInstant,
  type FixReaderState,
  type FixTimestampReaderArgs,
  type StampReading,
  type WriteReading,
} from "./fix-timestamp-reader";
import { FIX_PRECISIONS } from "./finance-widgets";
import { withBase } from "./site";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { FixTimestampReaderArgs } from "./fix-timestamp-reader";

const WIDGET_NAME = "fix-timestamp-reader";
const HERO_CAPTION = "Instant";
const USE_READ_LABEL = "Use the instant read above";

/** The links under the calls. */
const FIX_LINKS = [
  {
    text: "Finance message timestamps",
    href: "/guides/industries/finance-message-timestamps/",
  },
  { text: "Leap Second Timeline", href: "/tools/leap-second-timeline/" },
  { text: "ID Timestamp Decoder", href: "/tools/id-timestamp-decoder/" },
] as const;

// ---------------------------------------------------------------------------
// The widest each region holds, which sizes it
// ---------------------------------------------------------------------------

/** The four fraction runs, three digits each, with the digits a full stamp would send. */
const RUN_SAMPLES = [
  ["ms", "123"],
  ["µs", "456"],
  ["ns", "789"],
  ["ps", "012"],
] as const;

/**
 * The picture of a stamp that sends `digits` fraction digits (0, 3, 6, 9 or 12), written out as
 * literals so the box is sized before the library has loaded. A run the stamp did not send is
 * drawn as an empty box under the longer "not sent" label, so fewer digits can make the picture
 * wider, not narrower; a test holds each equal to the picture of the matching stamp.
 */
export function reservedFigure(digits: number): FigureValue {
  const sent = digits / 3;
  return {
    halves: [
      {
        label: "",
        fields: [
          { text: "20240615", mask: "YYYYMMDD", group: "date", word: "date" },
          { text: "-", mask: "", group: "neutral", word: "separator" },
          { text: "14", mask: "HH", group: "time", word: "hour" },
          { text: ":", mask: ":", group: "time", word: "separator" },
          { text: "30", mask: "MM", group: "time", word: "minute" },
          { text: ":", mask: ":", group: "time", word: "separator" },
          { text: "00", mask: "SS", group: "time", word: "second" },
          ...(digits > 0
            ? [
                {
                  text: ".",
                  mask: "",
                  group: "neutral" as const,
                  word: "period",
                },
              ]
            : []),
          ...RUN_SAMPLES.map(([name, text], i) =>
            i < sent
              ? {
                  text,
                  mask: "sss",
                  group: "time" as const,
                  word: name,
                  bracket: name,
                  run: name,
                }
              : {
                  text: "",
                  mask: "sss",
                  group: "none" as const,
                  word: name,
                  bracket: "not sent",
                  run: name,
                },
          ),
        ],
      },
    ],
    separator: "",
    closing: "",
  };
}

/** The digit counts a stamp can send. */
const FRACTION_DIGITS = [0, 3, 6, 9, 12] as const;

/** Every picture the figure can draw, so its box holds the tallest at any width. */
const RESERVED_FIGURES = FRACTION_DIGITS.map(reservedFigure);

const WIDEST_WRITE = "2024-06-15T16:30:00.123456789+02:00";

const PARSED_SAMPLE = {
  instant: WIDEST_INSTANT,
  precision: "picosecond",
  leapSecond: true,
  picoseconds: 12,
};

const readCalls = (stamp: string): EdiCall[] => [
  { fn: "parseFixUtcTimestamp", args: [stamp], result: PARSED_SAMPLE },
  { fn: "isValidFixUtcTimestamp", args: [stamp], result: true },
];
const writeCalls = (text: string): EdiCall[] =>
  FIX_PRECISIONS.map((p) => ({
    fn: "formatFixUtcTimestamp",
    args: [text, p],
    result: WIDEST_STAMP,
  }));

const READ_CALL_SAMPLES = [callLines(readCalls(WIDEST_STAMP)).plain];
const READ_OUTPUT_SAMPLES = [callResultsText(readCalls(WIDEST_STAMP))];
const WRITE_CALL_SAMPLES = [callLines(writeCalls(WIDEST_WRITE)).plain];
const WRITE_OUTPUT_SAMPLES = [callResultsText(writeCalls(WIDEST_WRITE))];

const VERDICT_TITLES = [
  EMPTY_STAMP_TEXT,
  "Refused",
  "A leap second UTC inserted",
  ...FIX_PRECISIONS.map((p) => `Read at ${p}`),
];
const VERDICT_DETAILS = [
  ...REASON_SAMPLES,
  "Read at picosecond: 12 digits sent; nothing finer was measured.",
  "No fraction digits sent; nothing finer was measured.",
];

const DIGIT_SAMPLES = ["12", "0"];
const BELOW_SAMPLES = ["000", NONE_SENT_TEXT];
const LEAP_SAMPLES = ["yes", "no"];

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

function heroOptions(r: StampReading | null): InstantHeroOptions {
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
    value: r?.parsed?.instant ?? "",
    sample: WIDEST_INSTANT,
    lost: kind === "none",
    bar: kind === "one",
    chip: {
      text: r?.parsed?.precision ?? "",
      sample: "microsecond",
    },
    call: null,
    reason: "",
    reasons: [],
  };
}

function readPlates(r: StampReading | null): SafeHtml {
  const read = r !== null && r.kind === "read" && r.parsed !== null;
  const list: Plate[] = [
    {
      caption: "Fraction digits",
      value: read && r.digits !== null ? String(r.digits) : null,
      lines: ["after the period"],
      samples: DIGIT_SAMPLES,
      lineSamples: [["after the period"]],
    },
    {
      caption: "Below the nanosecond",
      value: read ? (r.belowNanosecond ?? NONE_SENT_TEXT) : null,
      lines: ["held apart from the instant"],
      samples: BELOW_SAMPLES,
      lineSamples: [["held apart from the instant"]],
    },
    {
      caption: "Leap second",
      value: read ? (r.parsed!.leapSecond ? "yes" : "no") : null,
      lines: [
        read && r.parsed!.leapSecond
          ? "a second UTC inserted"
          : "an ordinary second",
      ],
      samples: LEAP_SAMPLES,
      lineSamples: [["a second UTC inserted", "an ordinary second"]],
    },
  ];
  return plates(list, { gate: "plates" });
}

function writePlates(w: WriteReading | null): SafeHtml {
  const list: Plate[] = FIX_PRECISIONS.map((precision, i) => {
    const row = w?.rows[i];
    const out = row?.out ?? "";
    return {
      caption: precision,
      value: row === undefined || out === "" ? null : out,
      lines: [row?.note ?? ""],
      samples: [WIDEST_STAMP],
      lineSamples: [[CUT_NOTE, PAD_NOTE]],
    };
  });
  return plates(list, { gate: "write-plates" });
}

function linkItems(): ToolLinkItem[] {
  return FIX_LINKS.map((l) => ({ text: l.text, href: withBase(l.href) }));
}

function linksOf(): SafeHtml {
  return toolLinks({ label: "Related", links: linkItems() });
}

function readOutput(r: StampReading): CallOutputState {
  if (r.kind === "empty") return emptyOutput(NOT_READ_TEXT);
  return outputOf(r.kind === "refused" ? "sentinel" : "ok", r.calls);
}

function writeOutput(w: WriteReading): CallOutputState {
  if (w.kind === "empty") return emptyOutput("nothing to write");
  return outputOf(
    w.kind === "refused" ? "sentinel" : "ok",
    w.rows.map((row) => row.call),
  );
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it shows
 * the first preset of each section. The reading is drawn by `mount`, because it comes from
 * real library calls.
 */
export function renderFixTimestampReaderTemplate(
  idPrefix: string,
  args: FixTimestampReaderArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: FixReaderState = isSeeded(args) ? readArgs(args) : presetState();

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
          maxLength: FIX_MAX_CHARS,
          describedBy,
        }),
    });

  const pick = section(
    { id: id("pick"), heading: "1. Paste a FIX timestamp", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchStampPreset(state.stamp),
      options: presetOptions(STAMP_PRESETS),
    })}${fieldGrid(input("stamp", "UTCTimestamp", state.stamp))}<p class="${styles.note}">The text goes to the library exactly as typed. A SendingTime (52) or TransactTime (60) value is a UTCTimestamp.</p></div>`,
  );

  const read = section(
    { id: id("read"), heading: "2. What the calls read", level: 4 },
    html`<div class="${styles.split}">
      <div class="${styles.pane}"><div class="${styles.panel}">${grow(
        html`<div id="${id("hero")}">${instantHero(heroOptions(null))}</div>`,
      )}${grow(html`<div id="${id("plates")}">${readPlates(null)}</div>`)}${ediFigure(
        {
          id: id("figure"),
          spec: { kind: "empty", text: EMPTY_STAMP_TEXT },
          reserve: RESERVED_FIGURES,
        },
      )}${verdictHold({
        id: id("verdict"),
        titles: VERDICT_TITLES,
        details: VERDICT_DETAILS,
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
      heading: "3. Write an instant at five precisions",
      level: 4,
    },
    html`<div class="${styles.controls}">${preset({
      id: id("write-preset"),
      label: "Instant preset",
      value: matchWritePreset(state.write),
      options: presetOptions(WRITE_PRESETS),
    })}${fieldGrid(input("write", "Instant", state.write))}<div class="${styles.action}">${buttonRow(
      button({
        id: id("use-read"),
        label: USE_READ_LABEL,
        describedBy: id("use-read-note"),
      }),
    )}<p class="${styles.note}" id="${id("use-read-note")}">Copies the instant from section 2, a leap second included, into the box above.</p></div></div>
    <div class="${styles.split}">
      <div class="${styles.pane}">${grow(html`<div id="${id("write-plates")}">${writePlates(null)}</div>`)}${asideHold(
        {
          id: id("write-reason"),
          paragraphs: [],
          reasons: [WRITE_REFUSED_TEXT],
        },
      )}</div>
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
        label: "About the written stamps",
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
    { name: WIDGET_NAME, label: "FIX Timestamp Reader", scope: idPrefix },
    html`${pick}${read}${write}${links}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): FixReaderState;
  apply(state: FixReaderState): void;
  render(): void;
  syncPresets(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: FinanceLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  // The ids sit on the inner selects; the host is the element that carries `value` and
  // re-emits `change` from itself.
  const presetEl = el("preset").closest<GmtPreset>("gmt-preset")!;
  const writePresetEl = el("write-preset").closest<GmtPreset>("gmt-preset")!;
  const stampEl = el<HTMLInputElement>("stamp");
  const writeEl = el<HTMLInputElement>("write");
  const useEl = el<HTMLButtonElement>("use-read");
  const shape: FixShape | null = probeShape(lib);
  let reading: StampReading | null = null;

  const readState = (): FixReaderState => ({
    stamp: stampEl.value,
    write: writeEl.value,
  });

  function syncPresets(): void {
    const s = readState();
    presetEl.value = matchStampPreset(s.stamp);
    writePresetEl.value = matchWritePreset(s.write);
  }

  function renderRead(stamp: string): void {
    const r = readStamp(lib, stamp, shape);
    reading = r;
    setHtml(el("hero"), instantHero(heroOptions(r)));
    setHtml(el("plates"), readPlates(r));
    setHtml(
      el("figure"),
      r.picture === null
        ? figureContent({ kind: "empty", text: EMPTY_STAMP_TEXT })
        : figureContent({
            kind: "value",
            aria: r.picture.aria,
            halves: r.picture.halves,
            separator: "",
            closing: "",
          }),
    );
    setHtml(
      el("verdict"),
      r.kind === "empty"
        ? html``
        : verdict({
            tone: r.verdict.tone,
            title: r.verdict.title,
            detail: r.verdict.detail,
          }),
    );
    setHtml(
      el("read-call"),
      callFrameContent({ label: "Calls made", calls: r.calls }),
    );
    setHtml(
      el("read-output"),
      outputContent("What the calls returned", readOutput(r)),
    );
    // A stamp that was not read has no instant to copy.
    useEl.disabled = r.parsed === null;
  }

  function renderWrite(text: string): void {
    const w = writeInstant(lib, text);
    setHtml(el("write-plates"), writePlates(w));
    setHtml(
      el("write-call"),
      callFrameContent({
        label: "Calls made",
        calls: w.rows.map((row) => row.call),
      }),
    );
    setHtml(
      el("write-output"),
      outputContent("What the calls returned", writeOutput(w)),
    );
    setHtml(
      el("write-reason"),
      asideContent(w.kind === "refused" ? [WRITE_REFUSED_TEXT] : []),
    );
    el("write-note").textContent = w.kind === "empty" ? EMPTY_INSTANT_TEXT : "";
  }

  function render(): void {
    const s = readState();
    renderRead(s.stamp);
    renderWrite(s.write);
    setHtml(el("links-slot"), linksOf());
  }

  function apply(state: FixReaderState): void {
    stampEl.value = state.stamp;
    writeEl.value = state.write;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target !== stampEl && e.target !== writeEl) return;
      syncPresets();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target === presetEl) {
        const chosen = STAMP_PRESETS.find((p) => p.id === presetEl.value);
        // "Your values" keeps what is typed.
        if (!chosen) return;
        stampEl.value = chosen.text;
      } else if (e.target === writePresetEl) {
        const chosen = WRITE_PRESETS.find((p) => p.id === writePresetEl.value);
        if (!chosen) return;
        writeEl.value = chosen.text;
      } else return;
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
      const instant = reading?.parsed?.instant;
      if (instant === undefined) return;
      writeEl.value = instant;
      syncPresets();
      render();
    },
    { signal },
  );

  syncPresets();
  render();

  return { readState, apply, render, syncPresets };
}

export const mountFixTimestampReader: MountFn<FixTimestampReaderArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: FinanceLib;
  try {
    lib = await loadFinanceLib();
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
