/**
 * The GNSS Week Decoder, mountable on its tool page and in the chat rail.
 *
 * A broadcast week number, a RINEX week or a UTC instant goes in. Out come the
 * UTC instant, the reading's era and the same moment on every counter:
 *
 * 1. the controls (a mode, a counter or system, the week, time of week and era);
 * 2. three plates (UTC, the system's own clock and its lead, the RINEX week)
 *    over an odometer ring: the counter's weeks round a circle, one lap for
 *    each era it has had, a hand at the reading's week and each lap's date in
 *    the legend beside it. A RINEX week does not wrap, so it is drawn as an
 *    unwrapped track of rows instead;
 * 3. two tables, the moment on every broadcast counter and every RINEX system;
 * 4. the calls made and what they returned.
 *
 * The mount never computes a time. Every instant, week, era and lead comes from
 * `readGnss` (gnss-week-decoder.ts), which calls the library; the lanes only
 * place what those calls returned.
 *
 * Built on the component kit: `renderGnssWeekDecoderTemplate` writes the markup
 * from builders only, with ids from `idScope(idPrefix)`, and `mount` finds its
 * parts by those ids and reads and writes element `value` properties. Every
 * listener is delegated on the widget with the mount's `signal`. There is no
 * drag handle: the controls are typed fields, selects and two ranges (the week
 * and the time of week), each tied two ways to its typed field.
 */
import { Temporal } from "@js-temporal/polyfill";
import { defineElements } from "~/widgets/define";
import {
  aside,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  plates,
  raw,
  section,
  select,
  setHtml,
  srOnly,
  textInput,
  toolLinks,
  widget,
  type Plate,
  type SafeHtml,
  type ToolLinkItem,
} from "~/widgets/builders";
import {
  callOutput,
  type CallOutputLine,
} from "~/widgets/families/gnss/call-output";
import { gnssCounterTable } from "~/widgets/families/gnss/gnss-counter-table";
import { blankGnssLane, gnssLane } from "~/widgets/families/gnss/gnss-lane";
import {
  gnssRing,
  type RingLap,
  type RingState,
} from "~/widgets/families/gnss/gnss-ring";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/gnss-week-decoder.module.css";
import { NO_SIGNAL_LINE } from "./edi-render";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { loadGnssLib, type GnssLib } from "./gnss-lib";
import {
  GNSS_DECODER_MODES,
  GNSS_WEEK_COUNTERS,
  RINEX_WEEK_SYSTEMS,
  type GnssDecoderMode,
  type GnssWeekCounter,
  type RinexWeekSystem,
} from "./gnss-names";
import {
  CUSTOM_PRESET_ID,
  DECODER_LINKS,
  ERA_MODES,
  ERA_MODE_LABELS,
  GNSS_PRESETS,
  LANE_WINDOW,
  MODE_LABELS,
  NO_RESULT_TEXT,
  SECONDS_PER_WEEK,
  decoderHandoffs,
  isSeeded,
  lanesAria,
  lastWeekOf,
  matchPreset,
  permalinkOf,
  platesOf,
  presetState,
  readArgs,
  readGnss,
  summaryText,
  type EraMode,
  type GnssDecoderState,
  type GnssRead,
  type GnssWeekDecoderArgs,
  type Lane,
} from "./gnss-week-decoder";
import { counterSystem } from "./gnss-widgets";
import type { PlateSpec } from "./ledger-widgets";
import type { EdiCall } from "./edi-widgets";
import { callArgs, formatValue } from "./punctuality-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { handoffHref } from "./widget-permalink";
import { codeSpan } from "./widget-ui";

export type { GnssWeekDecoderArgs } from "./gnss-week-decoder";

const NBSP = " ";
const WIDGET_NAME = "gnss-week-decoder";

const COUNTER_COLUMNS = ["Counter", "Week", "Time of week (s)", "Era"];
const RINEX_COLUMNS = ["System", "Week", "Time of week (s)"];

/** The widest instants a plate shows, so the plates keep their width from one reading to the next. */
const SAMPLE_INSTANT = "8888-88-88T88:88:88";
const LONGEST_SYSTEM = [...RINEX_WEEK_SYSTEMS].sort(
  (a, b) => b.length - a.length,
)[0]!;
const PLATE_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  "hero-utc": [`${SAMPLE_INSTANT}Z`],
  "hero-system": [`${SAMPLE_INSTANT} ${LONGEST_SYSTEM}`],
};

/** Every field box, in the order the form shows them. */
const FIELD_NAMES = [
  "counter",
  "system",
  "week",
  "week-slider",
  "tow",
  "tow-slider",
  "era-mode",
  "era",
  "pivot",
  "utc",
] as const;
type FieldName = (typeof FIELD_NAMES)[number];

/** The fields each mode shows. */
const FIELDS: Record<GnssDecoderMode, readonly FieldName[]> = {
  broadcast: [
    "counter",
    "week",
    "week-slider",
    "tow",
    "tow-slider",
    "era-mode",
    "era",
    "pivot",
  ],
  rinex: ["system", "week", "tow", "tow-slider"],
  utc: ["counter", "utc"],
};

/** The fields a state shows: the mode's, less the era number and the date it
 *  counts from, which follow the era choice. */
function shownFields(mode: GnssDecoderMode, eraMode: EraMode): Set<FieldName> {
  const shown = new Set<FieldName>(FIELDS[mode]);
  if (mode === "broadcast") {
    if (eraMode !== "number") shown.delete("era");
    if (eraMode !== "notBefore") shown.delete("pivot");
  }
  return shown;
}

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function plateList(specs: readonly PlateSpec[]): Plate[] {
  return specs.map((s) => {
    const samples = PLATE_SAMPLES[s.role];
    return {
      caption: s.caption,
      value: s.value,
      lines: s.lines,
      ...(s.series === undefined ? {} : { series: s.series }),
      ...(s.quiet === true ? { quiet: true } : {}),
      ...(s.captions === undefined ? {} : { captions: s.captions }),
      ...(samples === undefined ? {} : { samples }),
    };
  });
}

/** The `<option>`s of a native select, from a list of names. */
function choices(
  values: readonly string[],
  label: (v: string) => string = (v) => v,
): { value: string; label: string }[] {
  return values.map((v) => ({ value: v, label: label(v) }));
}

const weekText = (n: number): string => `week ${n}`;
const towText = (n: number): string => `${n} s`;

function rangeOf(
  id: string,
  label: string,
  max: number,
  endText: string,
  value: number,
  disabled: boolean,
  text: (n: number) => string,
): SafeHtml {
  return range({
    id,
    label,
    min: 0,
    max,
    step: 1,
    value,
    valueText: text(value),
    ends: ["0", endText],
    disabled,
  });
}

function blankRows(
  names: readonly string[],
  width: number,
): { name: string; yours: boolean; cells: string[] }[] {
  return names.map((name) => ({
    name,
    yours: false,
    cells: Array.from({ length: width }, () => ""),
  }));
}

function counterTables(read: GnssRead | null): SafeHtml {
  const counters =
    read === null
      ? blankRows(GNSS_WEEK_COUNTERS, COUNTER_COLUMNS.length - 1)
      : read.counters.map((c) => ({
          name: c.counter as string,
          yours: c.yours,
          cells: c.none
            ? [NO_RESULT_TEXT, "", ""]
            : [c.week, c.timeOfWeek, c.era],
        }));
  const rinex =
    read === null
      ? blankRows(RINEX_WEEK_SYSTEMS, RINEX_COLUMNS.length - 1)
      : read.rinexRows.map((r) => ({
          name: r.system as string,
          yours: r.yours,
          cells: r.none ? [NO_RESULT_TEXT, ""] : [r.week, r.timeOfWeek],
        }));
  return html`${gnssCounterTable({
    caption: "The moment on every broadcast counter",
    columns: COUNTER_COLUMNS,
    rows: counters,
  })}${gnssCounterTable({
    caption: "The moment on every RINEX system",
    columns: RINEX_COLUMNS,
    rows: rinex,
  })}`;
}

function laneSlots(read: GnssRead | null): SafeHtml {
  const form = read?.state.mode === "rinex" ? "track" : "ring";
  return html`${Array.from({ length: LANE_WINDOW }, (_, i) => {
    const lane: Lane | undefined = read?.lanes[i];
    if (lane === undefined) return blankGnssLane(form);
    const flags = [
      lane.chosen ? "your reading" : "",
      lane.nearest ? "nearest today" : "",
      lane.differs ? "a different instant" : "",
      lane.today !== null ? "today" : "",
      lane.gapBefore ? "eras between are not drawn" : "",
    ].filter(Boolean);
    return gnssLane({
      form,
      label: lane.label,
      value: lane.result === "" ? NO_RESULT_TEXT : lane.result,
      sentence: lane.sentence,
      pin: lane.pin,
      today: lane.today,
      chosen: lane.chosen,
      gap: lane.gapBefore,
      flags,
    });
  })}`;
}

function drawnState(read: GnssRead | null): RingState {
  if (read === null || read.state.mode === "rinex") return "idle";
  if (read.status === "sentinel") return "lost";
  return read.lanes.length > 0 ? "live" : "idle";
}

function ringOf(read: GnssRead | null): SafeHtml {
  const state = drawnState(read);
  const modulus = read?.modulus ?? 1024;
  const lit: readonly Lane[] =
    state === "live" && read !== null ? read.lanes : [];
  const laps: (RingLap | null)[] = Array.from(
    { length: LANE_WINDOW },
    (_, i) => {
      const lane = lit[i];
      // A lost or idle ring still shows three faint laps; a live one, one per era.
      if (lane === undefined) {
        return state === "live" || i > 2
          ? null
          : { label: null, pin: null, today: null, chosen: false, gap: false };
      }
      return {
        label: lane.label,
        pin: lane.pin,
        today: lane.today,
        chosen: lane.chosen,
        gap: lane.gapBefore,
      };
    },
  );
  const own = lit.find((l) => l.chosen);
  const cap =
    state === "live"
      ? (own?.label ?? "WEEK")
      : state === "lost"
        ? "⟨ NO SIGNAL ⟩"
        : "WEEK";
  const week =
    state === "live"
      ? String(read?.week ?? "-")
      : state === "lost"
        ? NBSP
        : "-";
  const sub =
    state === "live" ? `of ${modulus}` : state === "lost" ? NBSP : "no reading";
  return gnssRing({
    modulus,
    state,
    laps,
    hand: state === "live" ? (lit.find((l) => l.pin !== null)?.pin ?? 0) : null,
    cap,
    week,
    sub,
  });
}

/** The words that take the lanes' place. */
function lanesEmpty(read: GnssRead | null): SafeHtml {
  if (read === null) return html``;
  const lost = drawnState(read) === "lost";
  // The hub has room for the short form; the whole sentinel sentence goes here.
  const text = lost ? "⟨ NO SIGNAL — invalid input ⟩" : (read.lanesEmpty ?? "");
  return text === ""
    ? html``
    : html`<p class="${styles.lanesEmpty}" data-lost="${String(lost)}">${text}</p>`;
}

function callLines(calls: readonly EdiCall[]): {
  code: SafeHtml;
  plain: string;
} {
  const lines = calls.map((c) => {
    const [argsHtml, plain] = callArgs(c.args);
    return {
      html: `${codeSpan("fn", c.fn)}(${argsHtml})`,
      plain: `${c.fn}(${plain})`,
    };
  });
  return {
    code: raw(lines.map((l) => l.html).join("\n")),
    plain: lines.map((l) => l.plain).join("\n"),
  };
}

const refused = (call: EdiCall): boolean =>
  call.result === null || call.result === "";

/**
 * What the calls returned, one result for each call in the order they were
 * made. A failed group replaces only the calls that gave `null` or `""` with
 * NO SIGNAL; when none did, or every one did, the pane is the whole-pane NO SIGNAL.
 */
function outputOf(
  read: GnssRead,
  calls: readonly EdiCall[],
): { state: "live" | "sentinel" | "empty"; lines: CallOutputLine[] } {
  if (read.status === "empty") return { state: "empty", lines: [] };
  const live = (c: EdiCall): CallOutputLine => ({
    text: formatValue(c.result),
    lost: false,
  });
  if (read.status !== "sentinel") {
    return { state: "live", lines: calls.map(live) };
  }
  const refusals = calls.filter(refused).length;
  if (refusals === 0) {
    return { state: "sentinel", lines: [{ text: NO_SIGNAL_LINE, lost: true }] };
  }
  const lines = calls.map((c): CallOutputLine =>
    refused(c) ? { text: NO_SIGNAL_LINE, lost: true } : live(c),
  );
  return { state: refusals === calls.length ? "sentinel" : "live", lines };
}

function linkItem(text: string, href: string | null): ToolLinkItem {
  return href === null ? { text } : { text, href };
}

function linksOf(read: GnssRead | null): SafeHtml {
  const handoffs =
    read === null ? { clocks: null, rollover: null } : decoderHandoffs(read);
  return toolLinks({
    label: "Other tools",
    links: [
      linkItem(DECODER_LINKS[0].text, handoffHref(handoffs.clocks)),
      linkItem(DECODER_LINKS[1].text, handoffHref(handoffs.rollover)),
    ],
  });
}

function reasonOf(read: GnssRead | null): SafeHtml {
  if (read === null || read.status !== "sentinel") return html``;
  return aside(
    {
      label: "Why there is no result",
      tone: "caution",
      title: NO_RESULT_TITLE,
    },
    html`<p>${read.failure ?? ""}</p>`,
  );
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The plates, lanes, tables and outputs are
 * drawn by `mount`, because they come from the real library calls.
 */
export function renderGnssWeekDecoderTemplate(
  idPrefix: string,
  args: GnssWeekDecoderArgs = {},
): string {
  const id = idScope(idPrefix);
  const state: GnssDecoderState = isSeeded(args)
    ? readArgs(args)
    : presetState(GNSS_PRESETS[0]!);
  const shown = shownFields(state.mode, state.eraMode);

  const box = (name: FieldName, wide: boolean, content: SafeHtml): SafeHtml =>
    html`<div class="${styles.box}" id="${id(`box-${name}`)}" ${shown.has(name) ? "" : html`hidden`} ${wide ? html`data-wide` : ""}>${content}</div>`;

  const controls = fieldGrid(
    html`${box(
      "counter",
      false,
      field({
        id: id("counter"),
        label: "Counter",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.counter,
            options: [
              { value: "", label: "(none)" },
              ...choices(GNSS_WEEK_COUNTERS),
            ],
          }),
      }),
    )}${box(
      "system",
      false,
      field({
        id: id("system"),
        label: "RINEX system",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.system,
            options: choices(RINEX_WEEK_SYSTEMS),
          }),
      }),
    )}${box(
      "week",
      false,
      field({
        id: id("week"),
        label: "Week",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.week,
            inputMode: "numeric",
            autocomplete: "off",
            spellcheck: false,
          }),
      }),
    )}${box(
      "week-slider",
      true,
      rangeOf(id("week-slider"), "Slide the week", 0, NBSP, 0, true, weekText),
    )}${box(
      "tow",
      false,
      field({
        id: id("tow"),
        label: "Time of week (seconds)",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.timeOfWeekSeconds,
            inputMode: "decimal",
            autocomplete: "off",
            spellcheck: false,
          }),
      }),
    )}${box(
      "tow-slider",
      true,
      rangeOf(
        id("tow-slider"),
        "Slide the time of week",
        SECONDS_PER_WEEK - 1,
        String(SECONDS_PER_WEEK - 1),
        0,
        state.mode === "utc",
        towText,
      ),
    )}${box(
      "era-mode",
      false,
      field({
        id: id("era-mode"),
        label: "Which era",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.eraMode,
            options: choices(ERA_MODES, (v) => ERA_MODE_LABELS[v as EraMode]),
          }),
      }),
    )}${box(
      "era",
      false,
      field({
        id: id("era"),
        label: "Era number",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.era,
            inputMode: "numeric",
            autocomplete: "off",
            spellcheck: false,
          }),
      }),
    )}${box(
      "pivot",
      true,
      field({
        id: id("pivot"),
        label: "On or after (UTC instant)",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.pivot,
            autocomplete: "off",
            spellcheck: false,
          }),
      }),
    )}${box(
      "utc",
      true,
      field({
        id: id("utc"),
        label: "UTC instant",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.utc,
            autocomplete: "off",
            spellcheck: false,
          }),
      }),
    )}`,
  );

  const pick = section(
    { id: id("pick"), heading: "1. Say which week you have", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...GNSS_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${chips({
      legend: "What you have",
      kind: "radio",
      name: id("mode"),
      items: GNSS_DECODER_MODES.map((m) => ({
        value: m,
        label: MODE_LABELS[m],
        checked: m === state.mode,
      })),
    })}${controls}</div>`,
  );

  const read = section(
    { id: id("read"), heading: "2. Read it", level: 4 },
    html`<div class="${styles.frame}" data-gate="frame">
        <div id="${id("plates")}">${plates(plateList(platesOf(null)))}</div>
        <div
          class="${styles.drawn}"
          data-gate="drawn"
          data-form="ring"
          role="group"
          aria-label="No counter to draw"
          id="${id("drawn")}"
        >
          <div class="${styles.ringSlot}" id="${id("ring")}">${ringOf(null)}</div>
          <div class="${styles.legend}">
            <div class="${styles.legendList}" id="${id("lanes")}">${laneSlots(null)}</div>
            <div id="${id("lanes-empty")}"></div>
          </div>
        </div>
      </div>
      <p role="status" aria-label="Reading summary" id="${id("summary")}">${srOnly("")}</p>
      ${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  const every = section(
    {
      id: id("every"),
      heading: "3. The same moment on every counter",
      level: 4,
    },
    html`<div class="${styles.tables}" id="${id("tables")}">${counterTables(null)}</div>
      ${grow(html`<p class="${styles.note}" id="${id("footnote")}">${NBSP}</p>`)}`,
  );

  const calls = section(
    { id: id("calls"), heading: "4. What the library returns", level: 4 },
    html`${grow(
      html`<div id="${id("calls-slot")}">${codeFrame({
        label: "Calls made",
        copyLabel: "Copy calls",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("output-slot")}">${callOutput({
        label: "What the calls returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}<div id="${id("links")}">${linksOf(null)}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "GNSS Week Decoder", scope: idPrefix },
    html`${pick}${read}${every}${calls}`,
  ).toString();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): GnssDecoderState;
  apply(state: GnssDecoderState): void;
  render(): void;
  syncPreset(): void;
}

/** A whole number from 0 in the typed text, else `null`. */
const whole = (text: string): number | null =>
  /^\d+$/.test(text.trim()) && Number.isSafeInteger(Number(text))
    ? Number(text)
    : null;

function setupWidget(
  root: HTMLElement,
  lib: GnssLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);

  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const modeEl = widgetEl.querySelector<GmtChips>("gmt-chips")!;
  const counterEl = el<HTMLSelectElement>("counter");
  const systemEl = el<HTMLSelectElement>("system");
  const weekEl = el<HTMLInputElement>("week");
  const towEl = el<HTMLInputElement>("tow");
  const eraModeEl = el<HTMLSelectElement>("era-mode");
  const eraEl = el<HTMLInputElement>("era");
  const pivotEl = el<HTMLInputElement>("pivot");
  const utcEl = el<HTMLInputElement>("utc");
  const weekRange = (): GmtRange =>
    el("box-week-slider").querySelector<GmtRange>("gmt-range")!;
  const towRange = (): GmtRange =>
    el("box-tow-slider").querySelector<GmtRange>("gmt-range")!;

  let last: GnssRead | null = null;
  /** The end label the week range was last drawn with: it changes with the counter. */
  let weekEnd = NBSP;

  const mode = (): GnssDecoderMode =>
    (modeEl.value as GnssDecoderMode | "") || "broadcast";

  function readState(): GnssDecoderState {
    return {
      mode: mode(),
      counter: counterEl.value as GnssWeekCounter | "",
      system: systemEl.value as RinexWeekSystem,
      week: weekEl.value,
      timeOfWeekSeconds: towEl.value,
      eraMode: eraModeEl.value as EraMode,
      era: eraEl.value,
      pivot: pivotEl.value,
      utc: utcEl.value,
    };
  }

  /** Show the fields the mode reads; the era number and date follow the era choice. */
  function showFields(): void {
    const shown = shownFields(mode(), eraModeEl.value as EraMode);
    for (const name of FIELD_NAMES) el(`box-${name}`).hidden = !shown.has(name);
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function apply(state: GnssDecoderState): void {
    modeEl.value = state.mode;
    counterEl.value = state.counter;
    systemEl.value = state.system;
    weekEl.value = state.week;
    towEl.value = state.timeOfWeekSeconds;
    eraModeEl.value = state.eraMode;
    eraEl.value = state.era;
    pivotEl.value = state.pivot;
    utcEl.value = state.utc;
    showFields();
  }

  /**
   * The ranges follow the typed fields. The week range ends at the counter's
   * last week (a library probe) and is live only in broadcast mode with a
   * counter; the time-of-week range is live whenever the mode reads one. A
   * typed value that is not a stop (a fraction, a blank, a week past the end)
   * leaves the range where it was.
   */
  function drawSliders(): void {
    const m = mode();
    const counter = counterEl.value as GnssWeekCounter | "";
    const end =
      m === "broadcast" && counter !== "" ? lastWeekOf(lib, counter) : null;
    const endText = end === null ? NBSP : String(end);
    const week = whole(weekEl.value);
    const stop = week !== null && end !== null && week <= end ? week : null;
    const slider = weekRange();
    if (endText !== weekEnd) {
      // The new maximum clamps the value the slider holds; a stop that is not on the new
      // range lands the slider back at the start.
      weekEnd = endText;
      slider.max = end ?? 0;
      slider.ends = ["0", endText];
      if (stop === null) slider.value = 0;
    }
    if (stop !== null) slider.value = stop;
    slider.disabled = end === null;
    slider.formatValue = weekText;

    towRange().disabled = m === "utc";
    const tow = Number(towEl.value);
    if (
      towEl.value.trim() !== "" &&
      Number.isFinite(tow) &&
      tow >= 0 &&
      tow < SECONDS_PER_WEEK
    ) {
      towRange().value = Math.floor(tow);
    }
    towRange().formatValue = towText;
  }

  function render(): void {
    showFields();
    drawSliders();
    const read = readGnss(lib, readState(), Temporal.Now.instant().toString());
    last = read;

    setHtml(el("plates"), plates(plateList(read.plates)));

    const drawn = el("drawn");
    drawn.dataset["form"] = read.state.mode === "rinex" ? "track" : "ring";
    drawn.setAttribute("aria-label", lanesAria(read));
    setHtml(el("ring"), ringOf(read));
    setHtml(el("lanes"), laneSlots(read));
    setHtml(el("lanes-empty"), lanesEmpty(read));

    setHtml(el("tables"), counterTables(read));
    el("footnote").textContent = read.footnote === "" ? NBSP : read.footnote;

    const calls = [
      ...read.calls.reading,
      ...read.calls.counters,
      ...read.calls.rinex,
    ];
    const { code, plain } = callLines(calls);
    setHtml(
      el("calls-slot"),
      codeFrame({
        label: "Calls made",
        copyLabel: "Copy calls",
        copyText: plain,
        code,
        gate: "codeframe",
      }),
    );
    const out = outputOf(read, calls);
    setHtml(
      el("output-slot"),
      callOutput({
        label: "What the calls returned",
        state: out.state,
        lines: out.lines,
      }),
    );

    setHtml(el("summary"), srOnly(summaryText(read)));
    setHtml(el("links"), linksOf(read));
    setHtml(el("reason"), reasonOf(read));
  }

  /** A change of mode carries the moment across: the last good reading's own
   *  numbers fill the fields the new mode reads. */
  function carryOver(from: GnssDecoderMode, to: GnssDecoderMode): void {
    const carry = last?.status === "ok" ? last.carry : null;
    if (carry === null || from === to) return;
    if (to === "utc" && carry.utc !== null) utcEl.value = carry.utc;
    if (to === "rinex" && carry.utc !== null) {
      // RINEX reads one continuous week, not the broadcast counter's: ask the
      // library for the instant's week on the record's system.
      const system = carry.system ?? (systemEl.value as RinexWeekSystem);
      const r = lib.utcToRinexWeek(system, carry.utc);
      systemEl.value = system;
      if (r !== null) {
        weekEl.value = String(r.week);
        towEl.value = String(r.timeOfWeekSeconds);
      }
    }
    if (to === "broadcast" && carry.utc !== null) {
      // Back to the counter's own week, time of week and era for the instant.
      const counter = counterEl.value as GnssWeekCounter | "";
      const own = counter === "" ? null : lib.utcToGnssWeek(counter, carry.utc);
      if (own !== null) {
        weekEl.value = String(own.week);
        towEl.value = String(own.timeOfWeekSeconds);
        eraModeEl.value = "number";
        eraEl.value = String(own.era);
      }
    }
  }

  let shownMode: GnssDecoderMode = mode();
  const typed: readonly EventTarget[] = [weekEl, towEl, eraEl, pivotEl, utcEl];

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      // A range writes its stop into the typed field; the field is the state.
      if (target === weekRange() || target === towRange()) {
        const slider = target as GmtRange;
        (target === weekRange() ? weekEl : towEl).value = String(slider.value);
        syncPreset();
        render();
        return;
      }
      if (target === null || !typed.includes(target)) return;
      syncPreset();
      render();
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === presetEl) {
        const chosen = GNSS_PRESETS.find((p) => p.id === presetEl.value);
        if (!chosen) return;
        apply(presetState(chosen));
        shownMode = mode();
        syncPreset();
        render();
        return;
      }
      if (target === modeEl) {
        carryOver(shownMode, mode());
        shownMode = mode();
        apply(readState());
        syncPreset();
        render();
        return;
      }
      if (target === counterEl) {
        if (counterEl.value !== "") {
          systemEl.value = counterSystem(counterEl.value as GnssWeekCounter);
        }
        syncPreset();
        render();
        return;
      }
      if (target === systemEl) {
        // The reading's counter follows its system, or the table would still
        // mark the old system's counter as "your reading".
        const counter = counterEl.value as GnssWeekCounter | "";
        if (counter === "" || counterSystem(counter) !== systemEl.value) {
          const own = GNSS_WEEK_COUNTERS.find(
            (c) => counterSystem(c) === systemEl.value,
          );
          if (own !== undefined) counterEl.value = own;
        }
        syncPreset();
        render();
        return;
      }
      if (target === eraModeEl) {
        syncPreset();
        render();
      }
    },
    { signal },
  );

  showFields();
  syncPreset();
  render();

  return { readState, apply, render, syncPreset };
}

export const mountGnssWeekDecoder: MountFn<GnssWeekDecoderArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: GnssLib;
  try {
    lib = await loadGnssLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    controller.apply(readArgs(args));
    controller.syncPreset();
    controller.render();
  }

  return onceDestroy(
    () => {},
    () => permalinkOf(controller.readState()),
  );
};
