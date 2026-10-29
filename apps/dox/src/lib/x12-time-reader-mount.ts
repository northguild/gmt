/**
 * The X12 Time Reader widget (INT-15), mountable on its tool page and in the
 * chat rail.
 *
 * The main section takes the three elements a freight segment carries side by
 * side (`AT7`, `G62`, `DTM-02`/`03`/`04`): a date (element 373), a time (element
 * 337) and a time code (element 623), any of which may be empty. It reads them
 * with `parseX12DateAndTime` (or `parseX12Date` or `parseX12Time` when only one is
 * sent), classifies the code with `classifyX12TimeCode`, and then asks
 * `x12TimeCodeOffset` or `x12TimeCodeZone`. A code that states an offset gives the
 * instant with `resolveLocal(local, offset)`; a code that does not leaves the
 * instant to the zones the reader picks. The call line prints every call as made.
 * X12 is a United States standard.
 *
 * A second, smaller section reads an element 1251 value against its 1250
 * qualifier: it classifies the qualifier and calls the parser of its kind. It has
 * no time code and no instant.
 *
 * `null` and `""` from the library render as NO SIGNAL with one sentence saying
 * why. A state with no library call behind it renders as empty, never amber.
 * Nothing derives a zone from a time code or a zone name: a preset states its own
 * example's zones, and every other zone is the reader's. Follows the DTM
 * Decoder's split: every listener is delegated on the root, so the host dropping
 * the subtree is a complete teardown.
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
import styles from "~/widgets/tools/x12-time-reader.module.css";
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
import {
  CUSTOM_PRESET_ID,
  DTP_MEMBER_ROWS,
  DTP_PRESETS,
  MEMBER_ROWS,
  X12_PRESETS,
  dtpBlank,
  dtpFigure,
  dtpMemberText,
  dtpParts,
  dtpPresetState,
  dtpSentinelText,
  dtpWriteBack,
  elementFigure,
  gapRows,
  instantPlan,
  isSeeded,
  mainBlank,
  matchDtpPreset,
  matchPreset,
  memberText,
  ok,
  permalinkOf,
  presetState,
  readArgs,
  readDtp,
  readX12,
  sentinelText,
  stripApplies,
  stripNote,
  timelineEmptyText,
  verdictOf,
  writeDate,
  writeTime,
  x12Texts,
  type DtpState,
  type X12State,
  type X12TimeReaderArgs,
} from "./x12-time-reader";

export type { X12TimeReaderArgs } from "./x12-time-reader";

const WIDGET_NAME = "x12-time-reader";
const STRIP_CAPTION = "The same local time in up to four zones";
const STRIP_WIDTHS = { instant: 23, third: 28 };
const TYPED = ["date", "time", "time-code", "dtp-format", "dtp-value"];

const ELEMENT_FIGURE: FigureValue = {
  halves: [
    {
      label: "373",
      fields: [
        lit("2024", "CCYY", "date"),
        lit("06", "MM", "date"),
        lit("15", "DD", "date"),
      ],
    },
    {
      label: "337",
      fields: [
        lit("14", "HH", "time"),
        lit("30", "MM", "time"),
        lit("00", "SS", "time"),
        lit("12", "DD", "time"),
      ],
    },
    { label: "623", fields: [lit("ABCDEFGH", "623", "offset")] },
  ],
  separator: "",
  closing: "",
};

const DTP_FIGURES: readonly FigureValue[] = [
  {
    parts: [
      { text: "06152024", caption: "1251 value", after: "", kind: "value" },
      { text: "DB", caption: "1250", after: "", kind: "code" },
    ],
    halves: [
      {
        label: "",
        fields: [
          lit("06", "MM", "date"),
          lit("15", "DD", "date"),
          lit("2024", "CCYY", "date"),
        ],
      },
    ],
    separator: "",
    closing: "no offset",
  },
  {
    parts: [
      {
        text: "20240615143000-20240620160000",
        caption: "1251 value",
        after: "",
        kind: "value",
      },
      { text: "DTS", caption: "1250", after: "", kind: "code" },
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
          lit("00", "SS", "time"),
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
          lit("00", "SS", "time"),
        ],
      },
    ],
    separator: "-",
    closing: "no offset",
  },
];

const presetOptions = (
  presets: readonly { id: string; label: string; description: string }[],
) => [
  { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
  ...presets.map((p) => ({
    value: p.id,
    label: p.label,
    description: p.description,
  })),
];

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * date, time, time code or `DTP` pair it shows the first preset of each
 * section. Results are drawn by `mount`, because they come from the real library
 * calls.
 */
export function renderX12TimeReaderTemplate(
  idPrefix: string,
  args: X12TimeReaderArgs = {},
): string {
  const id = idScope(idPrefix);
  const seeded = isSeeded(args);
  const read = readArgs(args);
  const main: X12State = seeded ? read.main : presetState(X12_PRESETS[0]!);
  const dtp: DtpState = seeded ? read.dtp : dtpPresetState(DTP_PRESETS[0]!);
  const t = x12Texts();
  const text = (
    local: string,
    o: { label: string; samples: readonly string[] },
  ) => holdText({ id: id(local), role: "note", text: "", ...o });
  const input = (
    local: string,
    label: string,
    value: string,
    optional = false,
  ) =>
    field({
      id: id(local),
      label: optional ? `${label} (optional)` : label,
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value,
          autocomplete: "off",
          spellcheck: false,
          describedBy,
        }),
    });

  const elements = section(
    {
      id: id("elements"),
      heading: "1. The date, the time and the time code",
      level: 4,
    },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(main),
      options: presetOptions(X12_PRESETS),
    })}${fieldGrid(
      html`${input("date", "Date (373)", main.date, true)}${input("time", "Time (337)", main.time, true)}${input("time-code", "Time code (623)", main.timeCode, true)}`,
    )}<p class="${styles.note}">Element 373 is CCYYMMDD. Element 337 is HHMM, HHMMSS, HHMMSSD or HHMMSSDD. Any of the three may be empty, and an empty element is left out of the call.</p></div>`,
  );

  const returns = section(
    { id: id("returns"), heading: "2. What the calls return", level: 4 },
    html`<div class="${styles.split}">
      <div class="${styles.pane}">
        <div class="${styles.panel}">${ediFigure({
          id: id("figure"),
          spec: {
            kind: "empty",
            text: "Type a date, a time or a time code to take it apart.",
          },
          reserve: [ELEMENT_FIGURE],
        })}${text("figure-note", {
          label: "About the time",
          samples: [t.timeNotes.join(" ")],
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
        caption: "What the calls returned, member by member",
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
      heading: "3. The instant, and where the same digits land",
      level: 4,
    },
    html`${text("strip-note", {
      label: "Where the same digits land",
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
          })}${callFrameHold({
            id: id("resolve-call"),
            spec: { label: "Call made", calls: [] },
            samples: [t.resolveCall],
          })}
        </div>
        <div class="${styles.pane}">
          <div id="${id("strip")}">${zoneStrip({
            id,
            caption: STRIP_CAPTION,
            third: "With offset",
            zones: main.zones,
            disabled: false,
            widths: STRIP_WIDTHS,
          })}</div>
          <p role="status" aria-label="Strip summary" id="${id("strip-summary")}">${srOnly("")}</p>
          ${asideHold({
            id: id("strip-aside"),
            paragraphs: [],
            reasons: t.reasons,
            count: 2,
          })}${outputHold({
            id: id("instant-output"),
            label: "The instant",
            state: emptyOutput("no instant"),
            samples: ['"2024-06-15T18:30:00Z"'],
          })}${text("instant-note", {
            label: "About the instant",
            samples: t.instantNotes,
          })}
        </div>
      </div>`,
  );

  const written = (local: string, heading: string, note: string) =>
    html`<div class="${styles.written}"><div class="${styles.cell}"><p class="${styles.note}">${heading}</p>${outputHold(
      {
        id: id(`${local}-output`),
        label: note,
        state: emptyOutput("nothing to write back"),
        samples: [t.writeCall],
      },
    )}</div>${callFrameHold({
      id: id(`${local}-call`),
      spec: { label: "Call made", calls: [] },
      samples: [t.writeCall],
    })}</div>`;
  const back = section(
    {
      id: id("back"),
      heading: "4. Written back by formatX12Date and formatX12TimeElement",
      level: 4,
    },
    html`<div class="${styles.pairs}">${written("date", "The date as element 373, with D8.", "The date written back")}${written("time", "The time as element 337, in the form it was sent.", "The time written back")}</div>${text(
      "format-note",
      {
        label: "About the written elements",
        samples: t.formatNotes,
      },
    )}`,
  );

  const dtpControls = section(
    { id: id("dtp"), heading: "5. A DTP value", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("dtp-preset"),
      label: "DTP preset",
      value: matchDtpPreset(dtp),
      options: presetOptions(DTP_PRESETS),
    })}${fieldGrid(
      html`${input("dtp-format", "Qualifier (1250)", dtp.format)}${input("dtp-value", "Value (1251)", dtp.value)}`,
    )}<p class="${styles.note}">A DTP segment carries a 1250 qualifier and an element 1251 value. It carries no time code, and no 1250 code states an offset.</p></div>`,
  );

  const dtpReturns = section(
    {
      id: id("dtp-returns"),
      heading: "6. What the DTP calls return",
      level: 4,
    },
    html`<div class="${styles.split}">
      <div class="${styles.pane}"><div class="${styles.panel}">${ediFigure({
        id: id("dtp-figure"),
        spec: {
          kind: "empty",
          text: "Type a qualifier and a value to take it apart.",
        },
        reserve: DTP_FIGURES,
      })}${asideHold({
        id: id("dtp-reason"),
        paragraphs: [],
        reasons: t.dtpReasons,
      })}</div></div>
      <div class="${styles.pane}">${memberTable({
        id,
        caption: "What the DTP call returned, member by member",
        prefix: "dtp-member",
        rows: DTP_MEMBER_ROWS.map((r) => ({ key: r.key, label: r.label })),
      })}${callFrameHold({
        id: id("dtp-parse-call"),
        spec: { label: "Calls made", calls: [] },
        samples: [t.dtpParseCall],
      })}${outputHold({
        id: id("dtp-parse-output"),
        label: "What the DTP calls returned",
        state: emptyOutput("nothing to read"),
        samples: [t.dtpParseOutput],
      })}${callFrameHold({
        id: id("dtp-format-call"),
        spec: { label: "Call made", calls: [] },
        samples: [t.dtpFormatCall],
      })}${outputHold({
        id: id("dtp-format-output"),
        label: "The DTP value written back",
        state: emptyOutput("nothing to write back"),
        samples: [t.dtpFormatCall],
      })}${text("dtp-format-note", {
        label: "About the written DTP value",
        samples: t.dtpFormatNotes,
      })}</div>
    </div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "X12 Time Reader", scope: idPrefix },
    html`${elements}${returns}${lands}${back}${dtpControls}${dtpReturns}`,
  ).toString();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readMain(): X12State;
  readDtp(): DtpState;
  applyMain(s: X12State): void;
  applyDtp(d: DtpState): void;
  render(): void;
  syncPreset(): void;
}

/** One written-back element: its call, and its output or the reason there is none. */
function drawWritten(
  el: <T extends HTMLElement = HTMLElement>(local: string) => T,
  local: string,
  label: string,
  written: { call: EdiCall; output: string } | null,
  emptyText: string,
): void {
  setHtml(
    el(`${local}-call`),
    callFrameContent({
      label: "Call made",
      calls: written === null ? [] : [written.call],
    }),
  );
  setHtml(
    el(`${local}-output`),
    outputContent(
      label,
      written === null
        ? emptyOutput(emptyText)
        : written.output === ""
          ? lostOutput()
          : valueOutput(formatValue(written.output)),
    ),
  );
}

function setupWidget(
  root: HTMLElement,
  lib: EdiLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const [presetEl, dtpPresetEl] = [
    ...widgetEl.querySelectorAll<GmtPreset>("gmt-preset"),
  ] as [GmtPreset, GmtPreset];
  const dateEl = el<HTMLInputElement>("date");
  const timeEl = el<HTMLInputElement>("time");
  const codeEl = el<HTMLInputElement>("time-code");
  const dtpFormatEl = el<HTMLInputElement>("dtp-format");
  const dtpValueEl = el<HTMLInputElement>("dtp-value");
  const zone = (n: number) => el<HTMLSelectElement>(`zone-${n}`);

  let destroyed = false;
  signal.addEventListener("abort", () => {
    destroyed = true;
  });

  const readMain = (): X12State => ({
    date: dateEl.value,
    time: timeEl.value,
    timeCode: codeEl.value,
    zones: [1, 2, 3, 4].map((n) => zone(n).value) as X12State["zones"],
  });
  const readDtpState = (): DtpState => ({
    format: dtpFormatEl.value,
    value: dtpValueEl.value,
  });

  function syncPreset(): void {
    presetEl.value = matchPreset(readMain());
    dtpPresetEl.value = matchDtpPreset(readDtpState());
  }

  function renderStrip(
    s: X12State,
    read: ReturnType<typeof readX12>,
  ): StripRow[] {
    const applies = stripApplies(read);
    el("strip-note").textContent = stripNote(read);
    const rows: StripRow[] = applies
      ? gapRows(read.house!, s.zones, lib).map((r) => ({
          zone: r.zone,
          instant: r.instant,
          offset: r.offset,
          third: r.withOffset,
          reason: r.reason,
        }))
      : s.zones.map((z) => ({
          zone: z.trim(),
          instant: "",
          offset: "",
          third: "",
          reason: "",
        }));
    drawStripRows(el, rows, applies);

    const gap = applies ? widestGap(rows, lib) : null;
    el("gap").textContent = applies ? (gap ? gap.text : GAP_PROMPT) : "";

    // The one shared UTC timeline: the zones' marks, the one instant the time
    // code states, or an empty state in words.
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
        : read.instant !== ""
          ? timelineContent({ kind: "stated", instant: read.instant })
          : timelineContent({ kind: "empty", text: timelineEmptyText(read) }),
    );
    setSummary(
      el("strip-summary"),
      applies ? stripSummary(rows, gap ? gap.text : "", "") : stripNote(read),
    );
    setHtml(el("strip-aside"), asideContent(refusalParagraphs(rows)));
    return rows;
  }

  function renderMain(): void {
    const s = readMain();
    const blank = mainBlank(s);
    const read = readX12(
      blank ? { ...s, date: "", time: "", timeCode: "" } : s,
      lib,
    );
    const valid = ok(read);

    // Section 2: the element parse, the code's classifier and its offset or zone.
    setHtml(
      el("parse-call"),
      callFrameContent({ label: "Calls made", calls: blank ? [] : read.calls }),
    );
    setHtml(
      el("parse-output"),
      outputContent(
        "What the calls returned",
        blank
          ? emptyOutput("nothing to read")
          : !valid
            ? lostOutput()
            : valueOutput(callResultsText(read.calls)),
      ),
    );
    const v = verdictOf(read);
    setHtml(el("verdict"), verdictContent(v.verdict, v.detail));
    for (const row of MEMBER_ROWS) {
      const r = readoutOf(memberText(read, row.key), valid);
      setMember(el(`member-${row.key}`), r.text, r.state);
    }
    // The three elements taken apart.
    if (blank) {
      setHtml(
        el("figure"),
        figureContent({
          kind: "empty",
          text: "Type a date, a time or a time code to take it apart.",
        }),
      );
      el("figure-note").textContent = "";
    } else {
      const fig = elementFigure(s, read);
      setHtml(
        el("figure"),
        figureContent({
          kind: "value",
          parts: [],
          halves: fig.halves,
          separator: "",
          closing: "",
          aria: fig.aria,
        }),
      );
      el("figure-note").textContent = fig.notes.join(" ");
    }
    setHtml(
      el("reason"),
      asideContent(!blank && !valid ? [sentinelText(read, lib)] : []),
    );

    // Section 3: the instant, and the strip.
    const rows = renderStrip(s, read);
    const plan = instantPlan(blank ? null : read, s.zones);
    if (plan.kind === "stated" && read.resolve !== null) {
      setHtml(
        el("resolve-call"),
        callFrameContent({ label: "Call made", calls: [read.resolve] }),
      );
      setHtml(
        el("instant-output"),
        outputContent("The instant", valueOutput(formatValue(read.instant))),
      );
    } else if (plan.kind === "resolve") {
      const first = rows.find((r) => r.zone !== "")!;
      setHtml(
        el("resolve-call"),
        callFrameContent({
          label: "Call made",
          calls: [
            {
              fn: "resolveLocal",
              args: [read.house, first.zone, REJECT],
              result: first.instant,
            },
          ],
        }),
      );
      setHtml(
        el("instant-output"),
        outputContent(
          "The instant",
          first.instant === ""
            ? lostOutput()
            : valueOutput(formatValue(first.instant)),
        ),
      );
    } else {
      setHtml(
        el("resolve-call"),
        callFrameContent({ label: "Call made", calls: [] }),
      );
      setHtml(
        el("instant-output"),
        outputContent("The instant", emptyOutput("no instant")),
      );
    }
    el("instant-note").textContent = plan.note;

    // Section 4: written back, one element each.
    const dateW = blank ? null : writeDate(read, lib);
    const timeW = blank ? null : writeTime(read, lib);
    const emptyText = !valid ? "nothing to write back" : "not sent";
    drawWritten(el, "date", "The date written back", dateW, emptyText);
    drawWritten(el, "time", "The time written back", timeW, emptyText);
    el("format-note").textContent = [dateW?.note, timeW?.note]
      .filter((n): n is string => n !== undefined && n !== "")
      .join(" ");
  }

  function renderDtp(): void {
    const d = readDtpState();
    const blank = dtpBlank(d);
    const read = readDtp(d, lib);
    setHtml(
      el("dtp-parse-call"),
      callFrameContent({ label: "Calls made", calls: blank ? [] : read.calls }),
    );
    setHtml(
      el("dtp-parse-output"),
      outputContent(
        "What the DTP calls returned",
        blank
          ? emptyOutput("nothing to read")
          : read.house === null
            ? lostOutput()
            : valueOutput(callResultsText(read.calls)),
      ),
    );
    for (const row of DTP_MEMBER_ROWS) {
      const r = readoutOf(dtpMemberText(read, row.key), read.house !== null);
      setMember(el(`dtp-member-${row.key}`), r.text, r.state);
    }
    if (blank) {
      setHtml(
        el("dtp-figure"),
        figureContent({
          kind: "empty",
          text: "Type a qualifier and a value to take it apart.",
        }),
      );
    } else {
      const fig = dtpFigure(read, lib);
      setHtml(
        el("dtp-figure"),
        figureContent({
          kind: "value",
          parts: dtpParts(d),
          halves: fig.halves,
          separator: fig.separator,
          closing: fig.closing,
          aria: fig.aria,
        }),
      );
    }
    setHtml(
      el("dtp-reason"),
      asideContent(
        !blank && read.house === null ? [dtpSentinelText(read)] : [],
      ),
    );
    const written = dtpWriteBack(read, lib);
    drawWritten(
      el,
      "dtp-format",
      "The DTP value written back",
      written,
      "nothing to write back",
    );
    el("dtp-format-note").textContent = written === null ? "" : written.note;
  }

  function render(): void {
    if (destroyed) return;
    renderMain();
    renderDtp();
  }

  function applyMain(s: X12State): void {
    dateEl.value = s.date;
    timeEl.value = s.time;
    codeEl.value = s.timeCode;
    [1, 2, 3, 4].forEach((n) => {
      zone(n).value = s.zones[n - 1] ?? "";
    });
  }

  function applyDtp(d: DtpState): void {
    dtpFormatEl.value = d.format;
    dtpValueEl.value = d.value;
  }

  const typed = TYPED.map((local) => el(local));
  widgetEl.addEventListener(
    "input",
    (e) => {
      if (destroyed) return;
      if (!typed.some((t) => t === e.target)) return;
      syncPreset();
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
        const chosen = X12_PRESETS.find((p) => p.id === presetEl.value);
        if (!chosen) return;
        applyMain(presetState(chosen));
        syncPreset();
        render();
      } else if (target === dtpPresetEl) {
        const chosen = DTP_PRESETS.find((p) => p.id === dtpPresetEl.value);
        if (!chosen) return;
        applyDtp(dtpPresetState(chosen));
        syncPreset();
        render();
      } else if ([1, 2, 3, 4].some((n) => target === zone(n))) {
        syncPreset();
        render();
      }
    },
    { signal },
  );

  syncPreset();
  render();

  return {
    readMain,
    readDtp: readDtpState,
    applyMain,
    applyDtp,
    render,
    syncPreset,
  };
}

export const mountX12TimeReader: MountFn<X12TimeReaderArgs> = async (
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
  if (isSeeded(args)) {
    const seed = readArgs(args);
    widget.applyMain(seed.main);
    widget.applyDtp(seed.dtp);
    widget.syncPreset();
    widget.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(widget.readMain(), widget.readDtp()),
  );
};
