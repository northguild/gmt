/**
 * The EPCIS Event Reader widget (INT-14), mountable on its tool page and in the
 * chat rail.
 *
 * The two required time fields of a GS1 EPCIS 2.0 event, `eventTime` and
 * `eventTimeZoneOffset`. The widget calls `parseEpcisEvent` with both, shows
 * whether the offset is stated and what instant, offset and local time came
 * back, draws the same moment on a UTC day rail and a local day rail with the
 * two dates compared, and shows the result written back by `formatEpcisEvent`.
 * Every printed call and result is the real one. The site-side code only builds
 * the event object, places the rails' marks and words the verdicts.
 *
 * `null` from the library renders as NO SIGNAL with one sentence saying why
 * (`epcisNullText`, decided by the library's validators). A state with no
 * library call behind it renders as empty, never amber.
 *
 * Built on the component kit: `renderEpcisEventReaderTemplate` writes the markup
 * from builders only, with ids from `idScope(idPrefix)`. `mount` finds its parts
 * by those ids, reads and writes element `value` properties, and listens once on
 * the widget with the mount's `signal`, so the host dropping the subtree is a
 * complete teardown. Nothing in the server-rendered template holds a result.
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
  textInput,
  widget,
  type SafeHtml,
} from "~/widgets/builders";
import {
  callFrameContent,
  callFrameHold,
  outputOf,
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
import { memberTable, setMember } from "~/widgets/families/edi/edi-table";
import {
  asideContent,
  asideHold,
  verdictContent,
  verdictHold,
} from "~/widgets/families/edi/edi-view";
import { epcisRail, railContent } from "~/widgets/families/edi/epcis-rail";
import { handoffLink } from "~/widgets/families/ledger/handoff-link";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/epcis-event-reader.module.css";
import { loadEpcisLib } from "./edi-lib";
import type { EpcisLib } from "./edi-lib";
import { lit } from "./edi-picture";
import { callResultsText } from "./edi-render";
import { NO_RESULT_TEXT, readoutOf } from "./edi-widgets";
import {
  CUSTOM_PRESET_ID,
  DATE_ROWS,
  EPCIS_PRESETS,
  EVENT_TIME_MAX,
  HANDOFF_LABEL,
  MEMBER_ROWS,
  OFFSET_MAX,
  WIDEST_EVENT,
  WIDEST_RESULT,
  cutEventTime,
  datesWords,
  detailText,
  DATES_NULL_TEXT,
  epcisFigure,
  epcisNullText,
  epcisTexts,
  handoffArgs,
  isSeeded,
  matchPreset,
  memberText,
  permalinkOf,
  presetState,
  railAria,
  railEmptyText,
  railName,
  railsOf,
  readArgs,
  readEpcis,
  verdictText,
  writeBack,
  type EpcisEventReaderArgs,
  type EpcisRead,
  type EpcisState,
  type RailRole,
  type RailSpec,
} from "./epcis-event-reader";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { encodeWidgetPermalink } from "./widget-permalink";

export type { EpcisEventReaderArgs } from "./epcis-event-reader";

const WIDGET_NAME = "epcis-event-reader";
const EMPTY_FIGURE =
  "Type an eventTime and an eventTimeZoneOffset to take them apart.";
const ROLES: readonly RailRole[] = ["utc", "local"];

/** The tallest picture the figure draws: the widest event time and an offset. */
const RESERVED_FIGURES: readonly FigureValue[] = [
  {
    halves: [
      { label: "eventTime", fields: cutEventTime(WIDEST_EVENT.eventTime) },
      {
        label: "eventTimeZoneOffset",
        fields: [lit(WIDEST_EVENT.eventTimeZoneOffset, "±hh:mm", "offset")],
      },
    ],
    separator: "",
    closing: "",
  },
];

/** What a rail shows with nothing to draw. */
function emptyRail(role: RailRole, emptyText: string): RailSpec {
  return {
    role,
    name: railName(role, null),
    date: NO_RESULT_TEXT,
    layout: null,
    pin: 50,
    emptyText,
    aria: railAria(role, null, "", emptyText),
  };
}

/** The rail at its widest name, date and day count, then every empty sentence. */
function railReserve(role: RailRole, empties: readonly string[]): RailSpec[] {
  const rails = railsOf(WIDEST_RESULT);
  return [
    {
      role,
      name: railName(role, WIDEST_RESULT),
      date: WIDEST_RESULT.instant.slice(0, 13),
      layout: rails[role],
      pin: rails.pin,
      emptyText: "",
      aria: "",
    },
    ...[...new Set(empties)].map((text) => emptyRail(role, text)),
  ];
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * seed it shows the first preset. Results are drawn by `mount`, because they
 * come from the real library calls.
 */
export function renderEpcisEventReaderTemplate(
  idPrefix: string,
  args: EpcisEventReaderArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: EpcisState = isSeeded(args)
    ? readArgs(args)
    : presetState(EPCIS_PRESETS[0]!);
  const presetId = matchPreset(state);
  const t = epcisTexts();

  const fields = section(
    { id: id("fields"), heading: "1. The event's two fields", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...EPCIS_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`${field({
        id: id("event-time"),
        label: "eventTime",
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: state.eventTime,
            autocomplete: "off",
            spellcheck: false,
            maxLength: EVENT_TIME_MAX,
            describedBy,
          }),
      })}${field({
        id: id("offset"),
        label: "eventTimeZoneOffset",
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: state.eventTimeZoneOffset,
            autocomplete: "off",
            spellcheck: false,
            maxLength: OFFSET_MAX,
            describedBy,
          }),
      })}`,
    )}</div>`,
  );

  const states = section(
    { id: id("states"), heading: "2. What the event states", level: 4 },
    html`<div class="${styles.split}">
      <div class="${styles.pane}">
        <div class="${styles.panel}">${ediFigure({
          id: id("figure"),
          spec: { kind: "empty", text: EMPTY_FIGURE },
          reserve: RESERVED_FIGURES,
        })}<p class="${styles.note}">The tool cuts each field only to draw it. The library reads each field whole.</p>${asideHold(
          {
            id: id("reason"),
            paragraphs: [],
            reasons: t.nulls,
          },
        )}</div>
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
        state: emptyOutput("nothing to read"),
        samples: [t.parseOutput],
      })}</div>
    </div>`,
  );

  const clocks = section(
    { id: id("clocks"), heading: "3. The same moment on two clocks", level: 4 },
    html`<div class="${styles.split}">
      <div class="${styles.pane}">
        <div class="${styles.panel}">${ROLES.map((role) =>
          epcisRail({
            id: id(`rail-${role}`),
            spec: emptyRail(role, "Nothing to place yet."),
            reserve: railReserve(role, t.railEmpty),
          }),
        )}</div>
      </div>
      <div class="${styles.pane}">${memberTable({
        id,
        caption: "The date on each clock, as the library returned it",
        prefix: "date",
        rows: DATE_ROWS.map((r) => ({ key: r.key, label: r.label })),
      })}${holdText({
        id: id("words"),
        role: "status",
        label: "The two dates compared",
        text: "",
        samples: t.words,
      })}${asideHold({
        id: id("dates-aside"),
        paragraphs: [],
        reasons: [t.datesNull],
      })}${callFrameHold({
        id: id("dates-call"),
        spec: { label: "Calls made", calls: [] },
        samples: [t.dateCalls],
      })}${outputHold({
        id: id("dates-output"),
        label: "What the calls returned",
        state: emptyOutput("no dates to compare"),
        samples: [t.dateOutput],
      })}</div>
    </div>`,
  );

  const back = section(
    {
      id: id("back"),
      heading: "4. Written back by formatEpcisEvent",
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
    })}<div class="${styles.handoff}">${handoffLink({
      id: id("handoff"),
      label: HANDOFF_LABEL,
      describedBy: id("format-note"),
    })}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "EPCIS Event Reader", scope: idPrefix },
    html`${fields}${states}${clocks}${back}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): EpcisState;
  apply(s: EpcisState): void;
  render(): void;
  syncPreset(s: EpcisState): void;
}

function setupWidget(
  root: HTMLElement,
  lib: EpcisLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const timeEl = el<HTMLInputElement>("event-time");
  const offsetEl = el<HTMLInputElement>("offset");

  let destroyed = false;
  signal.addEventListener("abort", () => {
    destroyed = true;
  });

  const readState = (): EpcisState => ({
    eventTime: timeEl.value,
    eventTimeZoneOffset: offsetEl.value,
  });

  function syncPreset(s: EpcisState): void {
    presetEl.value = matchPreset(s);
  }

  function renderRails(s: EpcisState, read: EpcisRead): void {
    const rails =
      read.result !== null && read.dates !== null ? railsOf(read.result) : null;
    for (const role of ROLES) {
      const date = role === "utc" ? read.dates?.utcDate : read.dates?.localDate;
      const drawn = rails !== null && date !== undefined && date !== "";
      const emptyText = drawn ? "" : railEmptyText(role, read, s);
      setHtml(
        el(`rail-${role}`),
        railContent({
          role,
          name: railName(role, read.result),
          date: drawn ? date : NO_RESULT_TEXT,
          layout: drawn ? rails[role] : null,
          pin: rails?.pin ?? 50,
          emptyText,
          aria: railAria(role, read.result, drawn ? date : "", emptyText),
        }),
      );
    }
  }

  function render(): void {
    if (destroyed) return;
    const s = readState();
    const read = readEpcis(s, lib);

    // Section 2: the parse call.
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
        read.parse === null
          ? emptyOutput("nothing to read")
          : read.result === null
            ? lostOutput()
            : valueOutput(callResultsText([read.parse])),
      ),
    );
    setHtml(
      el("verdict"),
      verdictContent(verdictText(read, s), detailText(read)),
    );
    for (const row of MEMBER_ROWS) {
      const r = readoutOf(memberText(read, row.key), read.result !== null);
      setMember(el(row.role), r.text, r.state);
    }

    // The two fields taken apart.
    if (read.blank) {
      setHtml(
        el("figure"),
        figureContent({ kind: "empty", text: EMPTY_FIGURE }),
      );
    } else {
      const fig = epcisFigure(s, lib);
      setHtml(
        el("figure"),
        figureContent({
          kind: "value",
          halves: fig.halves,
          separator: "",
          closing: "",
          aria: fig.aria,
        }),
      );
    }
    setHtml(
      el("reason"),
      asideContent(
        !read.blank && read.result === null ? [epcisNullText(s, lib)] : [],
      ),
    );

    // Section 3: the two dates on two rails.
    renderRails(s, read);
    for (const row of DATE_ROWS) {
      const text =
        row.key === "utc" ? read.dates?.utcDate : read.dates?.localDate;
      const r = readoutOf(
        text === undefined || text === "" ? null : text,
        read.dates !== null,
      );
      setMember(el(row.role), r.text, r.state);
    }
    el("words").textContent = datesWords(read.dates);
    const dates = read.dates;
    setHtml(
      el("dates-call"),
      callFrameContent({
        label: "Calls made",
        calls: dates === null ? [] : dates.calls,
      }),
    );
    setHtml(
      el("dates-output"),
      outputContent(
        "What the calls returned",
        dates === null
          ? emptyOutput("no dates to compare")
          : outputOf(dates.sameness === null ? "sentinel" : "ok", dates.calls),
      ),
    );
    setHtml(
      el("dates-aside"),
      asideContent(
        dates !== null && dates.sameness === null ? [DATES_NULL_TEXT] : [],
      ),
    );

    // Section 4: written back, and the hand-off.
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
          : written.written === null
            ? lostOutput()
            : valueOutput(callResultsText([written.call])),
      ),
    );
    el("format-note").textContent = written === null ? "" : written.note;
    const link = el<HTMLAnchorElement>("handoff");
    const handoff = handoffArgs(read);
    if (handoff !== null) {
      link.setAttribute("href", encodeWidgetPermalink("bldate", handoff));
      link.removeAttribute("aria-disabled");
    } else {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
    }
  }

  /** Write a whole state onto the controls. */
  function apply(s: EpcisState): void {
    timeEl.value = s.eventTime;
    offsetEl.value = s.eventTimeZoneOffset;
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (destroyed) return;
      if (e.target !== timeEl && e.target !== offsetEl) return;
      syncPreset(readState());
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (destroyed || e.target !== presetEl) return;
      const chosen = EPCIS_PRESETS.find((p) => p.id === presetEl.value);
      if (!chosen) return;
      apply(presetState(chosen));
      syncPreset(readState());
      render();
    },
    { signal },
  );

  syncPreset(readState());
  render();

  return { readState, apply, render, syncPreset };
}

export const mountEpcisEventReader: MountFn<EpcisEventReaderArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: EpcisLib;
  try {
    lib = await loadEpcisLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    widget.apply(readArgs(args));
    widget.syncPreset(widget.readState());
    widget.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(widget.readState()),
  );
};
