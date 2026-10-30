/**
 * The DTM Decoder widget (INT-15), mountable on its tool page and in the chat
 * rail.
 *
 * A pasted UN/EDIFACT `DTM` segment, or a value and its data element 2379 format
 * code. The code is data, so the widget classifies it first
 * (`classifyEdifactDtmFormat`) and then calls the parser of the kind that came
 * back. It shows the value the parser returned, whether the offset is stated or
 * not, the instant an offsetless value names in each zone the reader chooses, and
 * the value written back by the kind's formatter. Every printed call and result is
 * the real one; the site-side code only splits the segment (`splitDtm`) and picks
 * the function a kind names.
 *
 * `null` and `""` from the library render as NO SIGNAL with one sentence saying
 * why (`sentinelText`, `resolveReason`). A state with no library call behind it
 * renders as empty, never amber.
 *
 * Built on the component kit: `renderDtmDecoderTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`. `mount` finds its parts by
 * those ids, reads and writes element `value` properties, and listens once on the
 * widget with the mount's `signal`, so the host dropping the subtree is a complete
 * teardown. Nothing in the server-rendered template holds a result.
 */
import { defineElements } from "~/widgets/define";
import {
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  section,
  setHtml,
  srOnly,
  textInput,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import {
  callFrameContent,
  callFrameHold,
  emptyOutput,
  lostOutput,
  outputContent,
  outputHold,
  valueOutput,
} from "~/widgets/families/edi/edi-call";
import {
  ediFigure,
  figureContent,
  type FigureValue,
} from "~/widgets/families/edi/edi-figure";
import { holdText } from "~/widgets/families/edi/edi-hold";
import {
  memberTable,
  setMember,
  zoneStrip,
} from "~/widgets/families/edi/edi-table";
import {
  ediTimeline,
  timelineContent,
} from "~/widgets/families/edi/edi-timeline";
import {
  asideContent,
  asideHold,
  drawStripRows,
  refusalParagraphs,
  setSummary,
  stripSummary,
  verdictContent,
  verdictHold,
  type StripRow,
} from "~/widgets/families/edi/edi-view";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/dtm-decoder.module.css";
import {
  CUSTOM_PRESET_ID,
  DTM_PRESETS,
  MEMBER_ROWS,
  detailText,
  dtmBlank,
  dtmFigure,
  dtmParts,
  dtmTexts,
  effective,
  gapRows,
  matchPreset,
  memberText,
  permalinkOf,
  presetState,
  readArgs,
  readDtm,
  sentinelText,
  splitDtm,
  splitText,
  stripApplies,
  stripNote,
  timelineEmptyText,
  verdictText,
  writeBack,
  type DtmDecoderArgs,
  type DtmRead,
  type DtmState,
} from "./dtm-decoder";
import { loadEdiLib } from "./edi-lib";
import { lit } from "./edi-picture";
import { callResultsText } from "./edi-render";
import {
  GAP_PROMPT,
  REJECT,
  formatValue,
  readoutOf,
  widestGap,
  type EdiCall,
  type EdiLib,
} from "./edi-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { DtmDecoderArgs } from "./dtm-decoder";

const WIDGET_NAME = "dtm-decoder";

/** The strip's third column: the 205 reading of the same digits, or a period's end instant. */
const THIRD_AS_205 = "As 205";
const THIRD_END = "End instant";

/** The tallest pictures the figure draws: a period (two halves) and an offset date-time. */
const RESERVED_FIGURES: readonly FigureValue[] = [
  {
    parts: [
      { text: "DTM", caption: "segment", after: "+", kind: "tag" },
      { text: "137", caption: "qualifier", after: ":", kind: "plain" },
      {
        text: "202406151430202406201600",
        caption: "value",
        after: ":",
        kind: "value",
      },
      { text: "719", caption: "format", after: "'", kind: "code" },
    ],
    halves: [
      {
        label: "start",
        fields: [
          lit("2024", "CCYY", "date"),
          lit("06", "MM", "date"),
          lit("15", "DD", "date"),
          lit("14", "HH", "time"),
          lit("30", "MM", "time"),
        ],
      },
      {
        label: "end",
        fields: [
          lit("2024", "CCYY", "date"),
          lit("06", "MM", "date"),
          lit("20", "DD", "date"),
          lit("16", "HH", "time"),
          lit("00", "MM", "time"),
        ],
      },
    ],
    separator: "",
    closing: "no offset",
  },
  {
    parts: [
      { text: "DTM", caption: "segment", after: "+", kind: "tag" },
      { text: "137", caption: "qualifier", after: ":", kind: "plain" },
      {
        text: "20240615143045+0200",
        caption: "value",
        after: ":",
        kind: "value",
      },
      { text: "208", caption: "format", after: "'", kind: "code" },
    ],
    halves: [
      {
        label: "",
        fields: [
          lit("2024", "CCYY", "date"),
          lit("06", "MM", "date"),
          lit("15", "DD", "date"),
          lit("14", "HH", "time"),
          lit("30", "MM", "time"),
          lit("45", "SS", "time"),
          lit("+0200", "ZHHMM", "offset"),
        ],
      },
    ],
    separator: "",
    closing: "",
  },
];

const EMPTY_FIGURE = "Paste a segment or a value to take it apart.";
const NO_ZONE = "no zone chosen";

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * `input` it shows the first preset. Results are drawn by `mount`, because they
 * come from the real library calls.
 */
export function renderDtmDecoderTemplate(
  idPrefix: string,
  args: DtmDecoderArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const seeded = args.input !== undefined;
  const state: DtmState = seeded
    ? readArgs(args)
    : presetState(DTM_PRESETS[0]!);
  const presetId = matchPreset(state);
  const segment = splitDtm(state.input).kind === "segment";
  const shownFormat = segment ? effective(state).format : state.format;
  const t = dtmTexts();

  const paste = section(
    { id: id("paste"), heading: "1. Paste a segment or a value", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...DTM_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`<div class="${styles.main}">${field({
        id: id("input"),
        label: "Segment or value",
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: state.input,
            autocomplete: "off",
            spellcheck: false,
            maxLength: 64,
            describedBy,
          }),
      })}</div>${field({
        id: id("format"),
        label: "Format code (2379)",
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: shownFormat,
            autocomplete: "off",
            spellcheck: false,
            maxLength: 8,
            describedBy,
          }),
      })}`,
    )}${holdText({
      id: id("split"),
      role: "note",
      label: "How the text was split",
      text: "",
      samples: t.split,
    })}</div>`,
  );

  const states = section(
    { id: id("states"), heading: "2. What the value states", level: 4 },
    html`<div class="${styles.split}">
      <div class="${styles.pane}">
        <div class="${styles.panel}">${ediFigure({
          id: id("figure"),
          spec: { kind: "empty", text: EMPTY_FIGURE },
          reserve: RESERVED_FIGURES,
        })}${asideHold({
          id: id("reason"),
          paragraphs: [],
          reasons: t.reasons,
        })}</div>
        ${callFrameHold({
          id: id("parse-call"),
          spec: { label: "Calls made", calls: [] },
          samples: [t.parseCall],
        })}
      </div>
      <div class="${styles.pane}">${verdictHold({
        id: id("verdict"),
        titles: t.verdicts,
        details: t.details,
      })}${memberTable({
        id,
        caption: "What the parser returned, member by member",
        prefix: "member",
        rows: MEMBER_ROWS.map((r) => ({ key: r.key, label: r.label })),
      })}${outputHold({
        id: id("parse-output"),
        label: "What the calls returned",
        state: emptyOutput("nothing to read"),
        samples: [t.parseOutput],
      })}</div>
    </div>`,
  );

  const lands = section(
    {
      id: id("lands"),
      heading: "3. Where an offsetless value lands",
      level: 4,
    },
    html`${holdText({
      id: id("strip-note"),
      role: "note",
      label: "Where an offsetless value lands",
      text: "",
      samples: t.stripNotes,
    })}
      <div class="${styles.split}">
        <div class="${styles.pane}">
          <div class="${styles.panel}">${ediTimeline({
            id: id("timeline"),
            spec: { kind: "empty", text: "" },
          })}</div>
          ${holdText({
            id: id("gap"),
            role: "status",
            label: "Widest gap",
            text: "",
            samples: [...t.gaps, GAP_PROMPT],
          })}
        </div>
        <div class="${styles.pane}">
          <div id="${id("strip")}">${zoneStrip({
            id,
            caption: "The same local time in up to four zones",
            third: THIRD_AS_205,
            zones: state.zones,
            disabled: false,
            widths: { instant: 20, third: 17 },
          })}</div>
          <p role="status" aria-label="Strip summary" id="${id("strip-summary")}">${srOnly("")}</p>
          ${asideHold({
            id: id("strip-aside"),
            paragraphs: [],
            reasons: t.reasons,
            count: 2,
          })}
          ${callFrameHold({
            id: id("resolve-call"),
            spec: { label: "Call made", calls: [] },
            samples: [t.resolveCall],
          })}${outputHold({
            id: id("resolve-output"),
            label: "What resolveLocal returned",
            state: emptyOutput(NO_ZONE),
            samples: ['"2024-06-15T18:30:00Z"'],
          })}
        </div>
      </div>`,
  );

  const back = section(
    {
      id: id("back"),
      heading: "4. Written back by the matching formatter",
      level: 4,
    },
    html`<div class="${styles.written}">${outputHold({
      id: id("format-output"),
      label: "The value written back",
      state: emptyOutput("no value to write back"),
      samples: [t.formatOutput],
    })}${callFrameHold({
      id: id("format-call"),
      spec: { label: "Call made", calls: [] },
      samples: [t.formatCall],
    })}</div>${holdText({
      id: id("format-note"),
      role: "note",
      label: "About the written value",
      text: "",
      samples: t.writeNotes,
    })}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "DTM Decoder", scope: idPrefix },
    html`${paste}${states}${lands}${back}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** The `resolveLocal` call the strip prints for the first chosen zone. */
function resolveCall(start: string, zone: string, instant: string): EdiCall {
  return {
    fn: "resolveLocal",
    args: [start, zone, REJECT],
    result: instant,
  };
}

interface Controller {
  readState(): DtmState;
  apply(s: DtmState): void;
  render(): void;
  syncPreset(s: DtmState): void;
}

function setupWidget(
  root: HTMLElement,
  lib: EdiLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el, id } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const inputEl = el<HTMLInputElement>("input");
  const formatEl = el<HTMLInputElement>("format");
  const zone = (n: number) => el<HTMLSelectElement>(`zone-${n}`);

  // The format the reader typed for a bare value. A segment shows its own code
  // in the same field, and the typed one comes back when the segment goes.
  let typedFormat = formatEl.disabled ? "" : formatEl.value;
  let derived = false;
  let destroyed = false;
  let thirdHead = THIRD_AS_205;
  signal.addEventListener("abort", () => {
    destroyed = true;
  });

  const readState = (): DtmState => ({
    input: inputEl.value,
    format: splitDtm(inputEl.value).kind === "segment" ? "" : typedFormat,
    zones: [1, 2, 3, 4].map((n) => zone(n).value) as DtmState["zones"],
  });

  function syncPreset(s: DtmState): void {
    presetEl.value = matchPreset(s);
  }

  /** The strip, rebuilt with the chosen zones when its third column changes name. */
  function drawStrip(zones: readonly string[], third: string): void {
    if (third === thirdHead) return;
    thirdHead = third;
    setHtml(
      el("strip"),
      zoneStrip({
        id,
        caption: "The same local time in up to four zones",
        third,
        zones,
        disabled: false,
        widths: { instant: 20, third: 17 },
      }),
    );
  }

  function renderStrip(s: DtmState, read: DtmRead): void {
    const applies = stripApplies(read);
    const house = read.house;
    const period = read.classified?.kind === "dateTimePeriod";
    el("strip-note").textContent = stripNote(read);
    drawStrip(s.zones, period ? THIRD_END : THIRD_AS_205);

    const rows: StripRow[] =
      applies && house !== null
        ? gapRows(house, s.zones, lib)
        : s.zones.map((z) => ({
            zone: z.trim(),
            instant: "",
            offset: "",
            third: "",
            reason: "",
          }));
    drawStripRows(el, rows, applies);

    const gap = applies ? widestGap(rows, lib) : null;
    const gapText = applies ? (gap ? gap.text : GAP_PROMPT) : "";
    el("gap").textContent = gapText;

    // The one shared UTC timeline: the zones' marks, the one instant a value
    // states, or an empty state in words.
    const pair = read.pair?.result as { instant: string } | null | undefined;
    setHtml(
      el("timeline"),
      applies
        ? timelineContent({
            kind: "marks",
            rows: rows
              .map((r, i) => ({ n: i + 1, zone: r.zone, instant: r.instant }))
              .filter((r) => r.zone !== ""),
            gap,
          })
        : pair
          ? timelineContent({ kind: "stated", instant: pair.instant })
          : timelineContent({ kind: "empty", text: timelineEmptyText(read) }),
    );

    setSummary(
      el("strip-summary"),
      applies
        ? stripSummary(rows, gap ? gap.text : "", period ? "end" : "written")
        : stripNote(read),
    );
    setHtml(el("strip-aside"), asideContent(refusalParagraphs(rows)));

    // The first chosen zone's resolveLocal, shown as the real call.
    const first = applies ? rows.find((r) => r.zone !== "") : undefined;
    if (first === undefined || house === null) {
      setHtml(
        el("resolve-call"),
        callFrameContent({ label: "Call made", calls: [] }),
      );
      setHtml(
        el("resolve-output"),
        outputContent("What resolveLocal returned", emptyOutput(NO_ZONE)),
      );
      return;
    }
    const start = typeof house === "string" ? house : house.start;
    setHtml(
      el("resolve-call"),
      callFrameContent({
        label: "Call made",
        calls: [resolveCall(start, first.zone, first.instant)],
      }),
    );
    setHtml(
      el("resolve-output"),
      outputContent(
        "What resolveLocal returned",
        first.instant === ""
          ? lostOutput()
          : valueOutput(formatValue(first.instant)),
      ),
    );
  }

  function render(): void {
    if (destroyed) return;
    const s = readState();
    const { split } = effective(s);

    // Section 1: the format field mirrors a segment's code.
    if (split.kind === "segment") {
      formatEl.value = split.format;
      formatEl.disabled = true;
      derived = true;
    } else {
      if (derived) {
        formatEl.value = typedFormat;
        derived = false;
      }
      formatEl.disabled = false;
    }
    el("split").textContent = splitText(s);

    // Section 2: classify, then the kind's parser. A blank form makes no call:
    // it is the empty state, never the sentinel.
    const blank = dtmBlank(s);
    const read = readDtm(blank ? { ...s, input: "", format: "" } : s, lib);
    setHtml(
      el("parse-call"),
      callFrameContent({
        label: "Calls made",
        calls: blank ? [] : read.calls,
      }),
    );
    setHtml(
      el("parse-output"),
      outputContent(
        "What the calls returned",
        blank
          ? emptyOutput("nothing to read")
          : read.house === null
            ? lostOutput()
            : valueOutput(callResultsText(read.calls)),
      ),
    );
    const refused = !blank && read.house === null;
    setHtml(
      el("verdict"),
      read.house === null
        ? verdictContent("", "")
        : verdictContent(verdictText(read), detailText(read)),
    );
    for (const row of MEMBER_ROWS) {
      const r = readoutOf(memberText(read, row.key), read.house !== null);
      setMember(el(`member-${row.key}`), r.text, r.state);
    }
    // The value taken apart.
    if (blank) {
      setHtml(
        el("figure"),
        figureContent({ kind: "empty", text: EMPTY_FIGURE }),
      );
    } else {
      const fig = dtmFigure(s, read, lib);
      setHtml(
        el("figure"),
        figureContent({
          kind: "value",
          parts: dtmParts(s),
          halves: fig.halves,
          separator: fig.separator,
          closing: fig.closing,
          aria: fig.aria,
        }),
      );
    }
    setHtml(
      el("reason"),
      asideContent(refused ? [sentinelText(s, read, lib)] : []),
    );

    // Section 3: the strip.
    renderStrip(s, read);

    // Section 4: written back.
    const written = writeBack(read, lib);
    setHtml(
      el("format-call"),
      callFrameContent({
        label: "Call made",
        calls: written === null ? [] : [written.call],
      }),
    );
    setHtml(
      el("format-output"),
      outputContent(
        "The value written back",
        written === null
          ? emptyOutput("no value to write back")
          : written.output === ""
            ? lostOutput()
            : valueOutput(formatValue(written.output)),
      ),
    );
    el("format-note").textContent = written === null ? "" : written.note;
  }

  /** Write a whole state onto the controls. */
  function apply(s: DtmState): void {
    inputEl.value = s.input;
    typedFormat = s.format;
    derived = false;
    formatEl.value = s.format;
    [1, 2, 3, 4].forEach((n) => {
      zone(n).value = s.zones[n - 1] ?? "";
    });
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (destroyed) return;
      const target = e.target;
      if (target !== inputEl && target !== formatEl) return;
      if (target === formatEl) typedFormat = formatEl.value;
      syncPreset(readState());
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (destroyed) return;
      const target = e.target;
      if (target === presetEl) {
        const chosen = DTM_PRESETS.find((p) => p.id === presetEl.value);
        if (!chosen) return;
        apply(presetState(chosen));
        syncPreset(readState());
        render();
        return;
      }
      if ([1, 2, 3, 4].some((n) => target === zone(n))) {
        syncPreset(readState());
        render();
      }
    },
    { signal },
  );

  syncPreset(readState());
  render();

  return { readState, apply, render, syncPreset };
}

export const mountDtmDecoder: MountFn<DtmDecoderArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: EdiLib;
  try {
    lib = await loadEdiLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib, signal);
  if (args.input !== undefined) {
    widget.apply(readArgs(args));
    widget.syncPreset(widget.readState());
    widget.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(widget.readState()),
  );
};
