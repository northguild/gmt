/**
 * The HL7 Timestamp Reader widget (HLTH-93), mountable on its tool page and in the chat rail.
 *
 * One HL7 v2 date-time, a `DTM` or a `TS` with its degree of precision after `^`, read by
 * `parseHL7`. The widget shows the kind the value is (an instant, a local time, a span or the
 * null value), the same digits taken apart by the standard's own picture, and, for a value with no
 * offset, the instants it names in the zones the reader chooses beside the one a parser that
 * assumes UTC gets. A ladder writes the value back at every precision with `formatHL7`. Every
 * printed call and result is the real one.
 *
 * `null` from the library renders as NO SIGNAL with one sentence saying why. A blank form makes
 * no call and reads "nothing to read", never amber.
 *
 * Built on the component kit: `renderHl7TimestampReaderTemplate` writes the markup from builders
 * only, with ids from `idScope(idPrefix)`. `mount` finds its parts by those ids and listens once
 * on the widget with the mount's `signal`, so the host dropping the subtree is a complete
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
  table,
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
  outputOf,
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
import styles from "~/widgets/tools/hl7-timestamp-reader.module.css";
import { lit } from "./edi-picture";
import { GAP_PROMPT, formatValue } from "./edi-widgets";
import type { Hl7Lib } from "./hl7-lib";
import { loadHl7Lib } from "./hl7-lib";
import {
  CUSTOM_PRESET_ID,
  HL7_PRESETS,
  LADDER_HEAD_OFFSET,
  MEMBER_ROWS,
  READ_AS_UTC,
  detailText,
  hl7Blank,
  hl7Figure,
  hl7Texts,
  isSeeded,
  ladderOf,
  matchPreset,
  memberReadout,
  permalinkOf,
  presetState,
  readArgs,
  readHl7,
  sentinelText,
  stripApplies,
  stripNote,
  stripOf,
  timelineEmptyText,
  verdictText,
  type Hl7Args,
  type Hl7Read,
  type Hl7State,
} from "./hl7-timestamp-reader";
import { onceDestroy, type MountFn } from "./widget-mount";

export type { Hl7Args } from "./hl7-timestamp-reader";

const WIDGET_NAME = "hl7-timestamp-reader";

const PRECISION_ROWS = [
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
  "fraction",
] as const;

/** The characters the widest ladder cell can hold: `20240615103045.1234+0530`. */
const LADDER_CELL_WIDTH = 24;

/** The tallest picture the figure draws: every kind of field in one value. */
const RESERVED_FIGURES: readonly FigureValue[] = [
  {
    halves: [
      {
        label: "",
        fields: [
          lit("2024", "YYYY", "date"),
          lit("06", "MM", "date"),
          lit("15", "DD", "date"),
          lit("10", "HH", "time"),
          lit("30", "MM", "time"),
          lit("45", "SS", "time"),
          lit(".1234", ".SSSS", "time"),
          lit("0", "", "none"),
          lit("+0530", "±HHMM", "offset"),
          lit("^S", "^D", "neutral"),
        ],
      },
    ],
    separator: "",
    closing: "",
  },
];

const EMPTY_FIGURE = "Type a value to take it apart.";
const NO_ZONE = "no zone chosen";
const NOTHING_TO_READ = "nothing to read";

/** The ladder: seven rows, a precision and two writes of the value. Cells are written by `mount`. */
function ladderTable(id: (local: string) => string, third: string): SafeHtml {
  return table({
    caption: "The value written at each precision",
    rowHeader: "precision",
    layout: "fixed",
    widths: ["16%", null, null],
    columns: [
      { key: "precision", header: "Precision", align: "start", numeric: false },
      { key: "sent", header: "As sent", align: "start", numeric: true },
      { key: "third", header: third, align: "start", numeric: true },
    ],
    rows: PRECISION_ROWS.map((p) => ({
      precision: html`<span class="${styles.precision}">${p}</span>`,
      sent: html`<span class="${styles.ladderCell}" id="${id(`ladder-${p}-sent`)}" data-state="empty" style="--w:${LADDER_CELL_WIDTH}ch">&nbsp;</span>`,
      third: html`<span class="${styles.ladderCell}" id="${id(`ladder-${p}-third`)}" data-state="empty" style="--w:${LADDER_CELL_WIDTH}ch">&nbsp;</span>`,
    })),
  });
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no value it shows the
 * first preset. Results are drawn by `mount`, because they come from the real library calls.
 */
export function renderHl7TimestampReaderTemplate(
  idPrefix: string,
  args: Hl7Args = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: Hl7State = isSeeded(args)
    ? readArgs(args)
    : presetState(HL7_PRESETS[0]!);
  const presetId = matchPreset(state);
  const t = hl7Texts();

  const input = section(
    { id: id("input"), heading: "1. Type an HL7 date-time", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...HL7_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`<div class="${styles.main}">${field({
        id: id("value"),
        label: "HL7 value (DTM or TS)",
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: state.value,
            autocomplete: "off",
            spellcheck: false,
            maxLength: 64,
            describedBy,
          }),
      })}</div>`,
    )}</div>`,
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
          spec: { label: "Call made", calls: [] },
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
        label: "What the call returned",
        state: emptyOutput(NOTHING_TO_READ),
        samples: [t.parseOutput],
      })}</div>
    </div>`,
  );

  const lands = section(
    {
      id: id("lands"),
      heading: "3. Where a value with no offset lands",
      level: 4,
    },
    html`${holdText({
      id: id("strip-note"),
      role: "note",
      label: "Where a value with no offset lands",
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
            third: READ_AS_UTC,
            zones: state.zones,
            disabled: false,
            widths: { instant: 20, third: 18 },
          })}</div>
          <p role="status" aria-label="Strip summary" id="${id("strip-summary")}">${srOnly("")}</p>
          ${asideHold({
            id: id("strip-aside"),
            paragraphs: [],
            reasons: t.reasons,
            count: 2,
          })}
          ${callFrameHold({
            id: id("strip-call"),
            spec: { label: "Calls made", calls: [] },
            samples: [t.stripCall],
          })}${outputHold({
            id: id("strip-output"),
            label: "What the calls returned",
            state: emptyOutput(NO_ZONE),
            samples: [t.stripOutput],
          })}
        </div>
      </div>`,
  );

  const back = section(
    {
      id: id("back"),
      heading: "4. Written back by formatHL7",
      level: 4,
    },
    html`<div class="${styles.written}"><div id="${id("ladder")}">${ladderTable(id, LADDER_HEAD_OFFSET)}</div>${holdText(
      {
        id: id("ladder-note"),
        role: "note",
        label: "About the written values",
        text: "",
        samples: t.ladderNotes,
      },
    )}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "HL7 Timestamp Reader", scope: idPrefix },
    html`${input}${states}${lands}${back}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): Hl7State;
  apply(s: Hl7State): void;
  render(): void;
  syncPreset(s: Hl7State): void;
}

function setupWidget(
  root: HTMLElement,
  lib: Hl7Lib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el, id } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const valueEl = el<HTMLInputElement>("value");
  const zone = (n: number) => el<HTMLSelectElement>(`zone-${n}`);

  let destroyed = false;
  let ladderHead = LADDER_HEAD_OFFSET;
  signal.addEventListener("abort", () => {
    destroyed = true;
  });

  const readState = (): Hl7State => ({
    value: valueEl.value,
    zones: [1, 2, 3, 4].map((n) => zone(n).value) as Hl7State["zones"],
  });

  function syncPreset(s: Hl7State): void {
    presetEl.value = matchPreset(s);
  }

  function renderStrip(s: Hl7State, read: Hl7Read): void {
    const applies = stripApplies(read);
    const parsed = read.parsed;
    el("strip-note").textContent = stripNote(read);

    const strip =
      applies && parsed?.kind === "local"
        ? stripOf(parsed.local, s.zones, lib)
        : null;
    const rows: StripRow[] =
      strip !== null
        ? strip.rows
        : s.zones.map((z) => ({
            zone: z.trim(),
            instant: "",
            offset: "",
            third: "",
            reason: "",
          }));
    drawStripRows(el, rows, applies);

    const gap = strip?.gap ?? null;
    el("gap").textContent = applies ? (gap ? gap.text : GAP_PROMPT) : "";

    // The one shared UTC timeline: the zones' marks and the instant a UTC parser would name, the
    // one instant a value states, or an empty state in words.
    setHtml(
      el("timeline"),
      strip !== null
        ? timelineContent({
            kind: "marks",
            rows: rows
              .map((r, i) => ({ n: i + 1, zone: r.zone, instant: r.instant }))
              .filter((r) => r.zone !== ""),
            gap,
            reference:
              strip.utcReading === ""
                ? null
                : { instant: strip.utcReading, label: READ_AS_UTC },
          })
        : parsed?.kind === "instant"
          ? timelineContent({ kind: "stated", instant: parsed.instant })
          : timelineContent({ kind: "empty", text: timelineEmptyText(read) }),
    );

    setSummary(
      el("strip-summary"),
      strip !== null
        ? `${stripSummary(rows, gap ? gap.text : "", READ_AS_UTC.toLowerCase())}${strip.utcReading === "" ? "" : ` Read as UTC: ${strip.utcReading}.`}`
        : stripNote(read),
    );
    setHtml(el("strip-aside"), asideContent(refusalParagraphs(rows)));

    // The calls the strip made, as the real ones, and what each returned.
    const calls = strip?.calls ?? [];
    setHtml(el("strip-call"), callFrameContent({ label: "Calls made", calls }));
    setHtml(
      el("strip-output"),
      outputContent(
        "What the calls returned",
        calls.length === 0
          ? emptyOutput(applies ? NO_ZONE : NOTHING_TO_READ)
          : outputOf(
              calls.some((c) => c.result === "" || c.result === null)
                ? "sentinel"
                : "ok",
              calls,
            ),
      ),
    );

    drawLadder(read, strip);
  }

  /** The ladder: seven rows of real `formatHL7` calls, or the empty state. */
  function drawLadder(
    read: Hl7Read,
    strip: ReturnType<typeof stripOf> | null,
  ): void {
    const ladder = ladderOf(read, strip, lib);
    if (ladder.third !== ladderHead) {
      ladderHead = ladder.third;
      setHtml(el("ladder"), ladderTable(id, ladder.third));
    }
    for (const row of ladder.rows) {
      for (const [col, cell] of [
        ["sent", row.sent],
        ["third", row.offset],
      ] as const) {
        const target = el(`ladder-${row.precision}-${col}`);
        target.textContent = cell.text === "" ? " " : cell.text;
        target.dataset["state"] = cell.state;
      }
    }
    el("ladder-note").textContent = ladder.note;
  }

  function render(): void {
    if (destroyed) return;
    const s = readState();

    // Section 2: the one call. A blank form makes none: it is the empty state, never the sentinel.
    const blank = hl7Blank(s);
    const read = readHl7(s, lib);
    setHtml(
      el("parse-call"),
      callFrameContent({
        label: "Call made",
        calls: read.parse === null ? [] : [read.parse],
      }),
    );
    setHtml(
      el("parse-output"),
      outputContent(
        "What the call returned",
        blank
          ? emptyOutput(NOTHING_TO_READ)
          : read.parsed === null
            ? lostOutput()
            : valueOutput(formatValue(read.parsed)),
      ),
    );
    const refused = !blank && read.parsed === null;
    setHtml(
      el("verdict"),
      read.parsed === null
        ? verdictContent("", "")
        : verdictContent(verdictText(read), detailText(read)),
    );
    for (const row of MEMBER_ROWS) {
      const r = memberReadout(read, row.key);
      setMember(el(`member-${row.key}`), r.text, r.state);
    }
    if (blank) {
      setHtml(
        el("figure"),
        figureContent({ kind: "empty", text: EMPTY_FIGURE }),
      );
    } else {
      const fig = hl7Figure(read, lib);
      setHtml(
        el("figure"),
        figureContent({
          kind: "value",
          halves: fig.halves,
          separator: fig.separator,
          closing: fig.closing,
          aria: fig.aria,
        }),
      );
    }
    setHtml(
      el("reason"),
      asideContent(refused ? [sentinelText(read, lib)] : []),
    );

    // Sections 3 and 4: the strip and the ladder.
    renderStrip(s, read);
  }

  /** Write a whole state onto the controls. */
  function apply(s: Hl7State): void {
    valueEl.value = s.value;
    [1, 2, 3, 4].forEach((n) => {
      zone(n).value = s.zones[n - 1] ?? "";
    });
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (destroyed) return;
      if (e.target !== valueEl) return;
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
        const chosen = HL7_PRESETS.find((p) => p.id === presetEl.value);
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

export const mountHl7TimestampReader: MountFn<Hl7Args> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  // `loadHl7Lib` already throws a `WidgetLoadError`; the host decides what to show.
  const lib = await loadHl7Lib();
  if (signal.aborted) return onceDestroy(() => {});

  const reader = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    reader.apply(readArgs(args));
    reader.syncPreset(reader.readState());
    reader.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(reader.readState()),
  );
};
