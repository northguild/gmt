/**
 * The Timetable Reader widget (TRAN-9), mountable on its tool page and in the
 * chat rail.
 *
 * A timetable prints wall times with no offset; `scheduleDelivery`'s
 * `startTimeZone` is what turns each printed departure into an exact instant.
 * Every row is its own single-leg call. The library decides whether a printed
 * time occurs once, twice (and which pass) or never, and this widget draws that
 * decision, never arithmetic of its own.
 *
 * Built on the component kit: `renderTimetableReaderTemplate` writes the markup from
 * builders and primitives, with ids from `idScope(idPrefix)`, and `mount` finds its parts
 * by those ids and reads and writes element `value` properties.
 *
 * Section 1 is the controls, one local-day track with a `<gmt-handle>` per row, and four
 * row frames. Section 2 is the two-clocks chart, which joins each printed wall time to the
 * exact instant it names and draws each run as a bar, above the table. Section 3 is the
 * call and its result.
 *
 * A handle changes a row's printed time and never its offset. The typed departure field is
 * the handle's typed equivalent, and a press on an empty lane adds a time at the pointer.
 * Nothing moves while a handle moves: heights are fixed, and a cell whose content comes and
 * goes holds its size with a hidden sizer.
 */
import { defineElements } from "~/widgets/define";
import {
  aside,
  codeFrame,
  escapeHtml,
  field,
  fieldGrid,
  findWidget,
  hint,
  html,
  idScope,
  raw,
  section,
  select,
  setHtml,
  swatch,
  table,
  textInput,
  widget,
  type SafeHtml,
  type SwatchSeries,
} from "~/widgets/builders";
import {
  setSelectValue,
  zoneChoices,
} from "~/widgets/families/cutoff/zone-choices";
import { paintCalls } from "~/widgets/families/cutoff/paint-calls";
import { paintOutput } from "~/widgets/families/cutoff/paint-output";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { badge } from "~/widgets/builders/badge";
import { grow } from "~/widgets/primitives/grow/grow";
import {
  handle,
  handleTrack,
  type GmtHandle,
} from "~/widgets/primitives/handle/handle";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/timetable-reader.module.css";
import {
  CUSTOM_PRESET_ID,
  LONGEST_REASON,
  MAX_ROWS,
  TIMETABLE_PRESETS,
  arrivalChipPlacement,
  arrivalChipText,
  bandChipText,
  bandsFor,
  chartLayout,
  chartSummary,
  chartWindow,
  classify,
  exactTickLabel,
  handleValueText,
  hhmmOfMinute,
  laneState,
  matchPreset,
  minuteAtPointer,
  newChartMemo,
  offsetChoices,
  offsetReason,
  optionsOf,
  permalinkOf,
  pointerStep,
  readArgs,
  rowBadge,
  rowFacts,
  rowLeg,
  rowMinute,
  rowResult,
  shapeOf,
  stepMinute,
  tagText,
  tickStepHours,
  trackDate,
  windowPct,
  withMinute,
  type ChartLayout,
  type ChartWindow,
  type DayBand,
  type OffsetChoice,
  type RowFacts,
  type TimetableLib,
  type TimetableReaderArgs,
  type TimetableState,
} from "./timetable-reader";
import {
  layoutWidth,
  onWidthChange,
  placeLabel,
  thinTickLabels,
} from "./label-fit";
import { loadTimetableLib } from "./transport-lib";
import { formatSchedule } from "./transport-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { withBase } from "./site";

export type { TimetableReaderArgs } from "./timetable-reader";

const WIDGET_NAME = "timetable-reader";
const NO_SIGNAL = "NO SIGNAL";
const ROWS = [1, 2, 3, 4] as const;

const NO_DAY_CAPTION = "Type a printed departure in a row to draw its day.";
const NO_CHART_CHIP =
  "Type a printed departure in a row to draw the two clocks.";

const LEGEND = [
  ["solid", "printed time to its instant"],
  ["dashed", "a skipped time, read forward"],
  ["bar", "run time to arrival"],
  ["twice", "an hour that repeats"],
  ["skipped", "an hour that is skipped"],
] as const;

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** The Offset field's options: what the library says this row can mean, plus whatever the
 *  row already holds. `current` is always an option, because a permalink may carry an offset
 *  for a row whose printed time has since changed, and a `<select>` drops a value it has no
 *  option for. */
function offsetOptions(choices: OffsetChoice[], current: string): SafeHtml {
  const list = choices.length === 0 ? [{ value: "", label: "None" }] : choices;
  const all = list.some((c) => c.value === current)
    ? list
    : [...list, { value: current, label: current }];
  return html`${all.map(
    (c) =>
      html`<option value="${c.value}" ${c.value === current ? html`selected` : ""}>${c.label}</option>`,
  )}`;
}

/** A hidden sizer: its text is a `data-t` attribute drawn by `::before`, so it is never in
 *  the text of the page, never copied and never read out. */
const sizer = (text: string, extra = ""): SafeHtml =>
  html`<span class="${styles.sizer} ${extra}" aria-hidden="true" data-t="${text}"></span>`;

/** A cell that holds the size of the tallest thing it can contain. */
const hold = (sizerPart: SafeHtml, live: SafeHtml): SafeHtml =>
  html`<span class="${styles.hold}">${sizerPart}<span class="${styles.live}" data-gate="drawn">${live}</span></span>`;

const lost = (): SafeHtml =>
  html`<span class="${styles.lost}">${NO_SIGNAL}</span>`;

/** `HH:MM ±hh:mm` of a zoned instant string, and the whole value beneath it. */
function timeCell(iso: string): SafeHtml {
  const m = /T(\d{2}:\d{2})(?::\d{2})?([+-]\d{2}:\d{2}|Z)/.exec(iso);
  const short = m ? `${m[1]}${m[2] === "Z" ? " Z" : ` ${m[2]}`}` : iso;
  return html`<span class="${styles.time}">${short}</span><span class="${styles.timeFull}">${iso}</span>`;
}

function timeSizer(zone: string): SafeHtml {
  const { short } = shapeOf.time(zone);
  return html`<span class="${styles.sizerBox}" aria-hidden="true"><span class="${styles.time} ${styles.sizer}" data-t="${short}"></span><span class="${styles.timeFull} ${styles.sizer}" data-t="${`0000-00-00T00:00:00+00:00[${zone}]`}"></span></span>`;
}

function startState(args: TimetableReaderArgs): TimetableState {
  const seeded = args.departures !== undefined || args.departure1 !== undefined;
  if (seeded) return readArgs(args);
  const first = TIMETABLE_PRESETS[0]!;
  return {
    startTimeZone: first.startTimeZone,
    duration: first.duration,
    timeZone: first.timeZone,
    rows: [
      first.rows[0] ?? { departure: "", offset: "" },
      first.rows[1] ?? { departure: "", offset: "" },
      first.rows[2] ?? { departure: "", offset: "" },
      first.rows[3] ?? { departure: "", offset: "" },
    ],
  };
}

export function renderTimetableReaderTemplate(
  idPrefix: string,
  args: TimetableReaderArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const s = startState(args);
  const presetId = matchPreset(s);

  const textField = (local: string, label: string, value: string): SafeHtml =>
    field({
      id: id(local),
      label,
      control: ({ id: cid, describedBy }) =>
        textInput({
          id: cid,
          value,
          autocomplete: "off",
          spellcheck: false,
          ...(describedBy === undefined ? {} : { describedBy }),
        }),
    });

  const zoneField = (local: string, label: string, value: string): SafeHtml =>
    field({
      id: id(local),
      label,
      control: ({ id: cid }) =>
        select({ id: cid, value, options: zoneChoices(value) }),
    });

  const rowFrame = (n: (typeof ROWS)[number]): SafeHtml => {
    const row = s.rows[n - 1]!;
    return html`<fieldset class="${styles.row}" data-series="${n}">
      <legend class="${styles.rowLegend}">${swatch({ series: n })}Row ${n}</legend>
      ${fieldGrid(
        html`${textField(`departure-${n}`, "Printed departure", row.departure)}${field(
          {
            id: id(`offset-${n}`),
            label: "Offset (optional)",
            control: ({ id: cid }) =>
              html`<select class="${styles.offset}" id="${cid}" aria-describedby="${id(`why-${n}`)}"
                >${offsetOptions([], row.offset)}</select
              >`,
          },
        )}`,
      )}
      <span class="${styles.hold} ${styles.whySlot}"
        >${sizer(LONGEST_REASON, styles.why!)}<p class="${styles.why}" id="${id(`why-${n}`)}"></p></span
      >
    </fieldset>`;
  };

  const lane = (n: (typeof ROWS)[number]): SafeHtml =>
    html`<div class="${styles.lane}" data-series="${n}" id="${id(`lane-${n}`)}"
      ><div class="${styles.handleBox}" id="${id(`track-${n}`)}" hidden>${handleTrack(
        handle({
          id: id(`handle-${n}`),
          label: `Row ${n} printed time`,
          min: 0,
          max: 1435,
          step: 5,
          largeStep: 60,
          value: 0,
          valueText: `Row ${n} printed time`,
        }),
      )}</div
      ><span class="${styles.tag}" id="${id(`tag-${n}`)}" aria-hidden="true" hidden></span></div
    >`;

  const timetable = section(
    { id: id("timetable"), heading: "1. The timetable", level: 4 },
    html`<div class="${styles.host}"><div class="${styles.split}">
      <div class="${styles.controls}">${preset({
        id: id("preset"),
        label: "Preset",
        value: presetId,
        options: [
          { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
          ...TIMETABLE_PRESETS.map((p) => ({
            value: p.id,
            label: p.label,
            description: p.description,
          })),
        ],
      })}${fieldGrid(
        html`${zoneField("start-zone", "Printed in", s.startTimeZone)}${textField("duration", "Run time", s.duration)}${zoneField("zone", "Arrives in", s.timeZone)}`,
      )}</div>
      <div class="${styles.pane}">
        <div class="${styles.day}">
          <div class="${styles.dayStatus}"
            ><span class="${styles.dayCaption}" id="${id("day-caption")}"></span
            ><span class="${styles.chip} ${styles.chipDim}" id="${id("band-chip")}" hidden></span
          ></div>
          <div class="${styles.lanes}" id="${id("day-track")}" data-gate="drawn track" role="group" aria-label="Printed times on the local day"
            ><div class="${styles.bands}" id="${id("bands")}" aria-hidden="true"></div>${ROWS.map(lane)}</div
          >
          <div class="${styles.dayTicks}" id="${id("day-ticks")}" aria-hidden="true"></div>
        </div>
        ${hint(id("track-hint"), "Drag a handle, or focus it and use the arrow keys, to move that row's printed time. Page Up and Page Down move an hour. The shaded hour is where the clock repeats or skips. A row with no time takes one when you click its lane.").html}
      </div>
      <div class="${styles.pane}"><div class="${styles.rowset}">${ROWS.map(rowFrame)}</div></div>
    </div></div>`,
  );

  const chart = section(
    { id: id("meaning"), heading: "2. What each printed time means", level: 4 },
    html`<div class="${styles.host}"><div class="${styles.split}">
      <div class="${styles.pane}">
        ${grow(html`<div class="${styles.chart}" data-gate="frame"
          ><div class="${styles.plotFrame}" id="${id("two-clocks")}" role="img" aria-label="${NO_CHART_CHIP}"
            ><div class="${styles.plot}" id="${id("plot")}" data-gate="drawn"></div></div
          ><p class="${styles.chartCaption}" id="${id("chart-caption")}"></p
          ><ul class="${styles.legend}" aria-label="Chart key"
            >${LEGEND.map(
              ([kind, text]) =>
                html`<li class="${styles.legendItem}"><span class="${styles.lswatch}" data-kind="${kind}" aria-hidden="true"></span>${text}</li>`,
            )}</ul
          ></div>`)}
      </div>
      <div class="${styles.pane}">
        ${grow(html`<div id="${id("rows-slot")}">${rowsTable([], s.timeZone, s.startTimeZone)}</div>`)}
        <p class="${styles.note}">For the general rule behind a repeated or skipped hour, see the <a href="${withBase("/tools/dst-inspector/")}">DST Inspector</a>.</p>
      </div>
    </div></div>`,
  );

  const call = section(
    {
      id: id("call"),
      heading: "3. What scheduleDelivery returns",
      level: 4,
    },
    html`${fieldGrid(
      field({
        id: id("row-pick"),
        label: "Show the call for",
        control: ({ id: cid }) =>
          select({ id: cid, options: [{ value: "0", label: "Row 1" }] }),
      }),
    )}${grow(
      html`<div id="${id("call-slot")}">${codeFrame({
        label: "The call made",
        copyLabel: "Copy call",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("out-slot")}">${callOutput({
        label: "What scheduleDelivery returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Timetable Reader", scope: idPrefix },
    html`${timetable}${chart}${call}`,
  );
}

interface TableRow {
  n: number;
  departure: string;
  offset: string;
  leaves: string | null;
  local: string | null;
  note: string | null;
}

/** The rows table: one row per row that has a printed time. */
function rowsTable(
  rows: readonly TableRow[],
  zone: string,
  startZone: string,
): SafeHtml {
  const cell = (iso: string | null, z: string): SafeHtml =>
    hold(timeSizer(z), iso === null ? lost() : timeCell(iso));
  return table({
    caption: "Printed times read as exact instants",
    columns: [
      { key: "printed", header: "Printed", align: "start", numeric: false },
      {
        key: "leaves",
        header: "Leaves (exact)",
        align: "start",
        numeric: false,
      },
      { key: "note", header: "Note", align: "start", numeric: false },
      {
        key: "arrival",
        header: "Local arrival",
        align: "start",
        numeric: false,
      },
    ],
    rowHeader: "printed",
    rows: rows.map((r) => ({
      printed: html`<span class="${styles.printed}" data-series="${r.n}">${swatch({ series: r.n as SwatchSeries })}<span class="${styles.rownum}">${r.n}</span><span class="${styles.printedText}">${r.departure + r.offset}</span></span>`,
      leaves: cell(r.leaves, startZone),
      note: hold(
        sizer(shapeOf.note(), styles.noteSizer!),
        r.note === null
          ? html``
          : badge({
              text: r.note,
              tone: /twice|repeat|earlier|later/i.test(r.note)
                ? "purple"
                : "neutral",
            }),
      ),
      arrival: cell(r.local, zone),
    })),
  });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/** Percent to four places, which is what the eye can tell apart. */
const pct = (n: number): number => Number(n.toFixed(4));

/** `HH:MM` of a zoned instant string. */
const hhmmIn = (iso: string | null): string | null => {
  const m = iso ? /T(\d{2}:\d{2})/.exec(iso) : null;
  return m ? m[1]! : null;
};

interface Controller {
  destroy(): void;
  state(): TimetableState;
}

function setupWidget(
  root: HTMLElement,
  lib: TimetableLib,
  start: TimetableState | null,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const startZoneEl = el<HTMLSelectElement>("start-zone");
  const durationEl = el<HTMLInputElement>("duration");
  const zoneEl = el<HTMLSelectElement>("zone");
  const rowPickEl = el<HTMLSelectElement>("row-pick");
  const lanesEl = el("day-track");
  const bandsEl = el("bands");
  const dayTicksEl = el("day-ticks");
  const plotEl = el("plot");
  const chartEl = el("two-clocks");
  const rowsSlot = el("rows-slot");
  const departureEls = ROWS.map((n) => el<HTMLInputElement>(`departure-${n}`));
  const offsetEls = ROWS.map((n) => el<HTMLSelectElement>(`offset-${n}`));
  const whyEls = ROWS.map((n) => el(`why-${n}`));
  const handleEls = ROWS.map((n) => el<GmtHandle>(`handle-${n}`));
  const boxEls = ROWS.map((n) => el(`track-${n}`));
  const tagEls = ROWS.map((n) => el(`tag-${n}`));
  const laneEls = ROWS.map((n) => el(`lane-${n}`));

  const memo = newChartMemo();
  let destroyed = false;
  let win: ChartWindow | null = null;
  let lastChart: { layout: ChartLayout | null; win: ChartWindow | null } = {
    layout: null,
    win: null,
  };
  const valueTexts: string[] = ROWS.map((n) => `Row ${n} printed time`);
  handleEls.forEach((h, i) => {
    h.formatValue = () => valueTexts[i]!;
  });

  function writeSeed(s: TimetableState): void {
    setSelectValue(startZoneEl, s.startTimeZone);
    durationEl.value = s.duration;
    setSelectValue(zoneEl, s.timeZone);
    for (let i = 0; i < MAX_ROWS; i++) {
      departureEls[i]!.value = s.rows[i]!.departure;
      setSelectValue(offsetEls[i]!, s.rows[i]!.offset);
    }
  }

  function state(): TimetableState {
    return {
      startTimeZone: startZoneEl.value.trim(),
      duration: durationEl.value.trim(),
      timeZone: zoneEl.value.trim(),
      rows: departureEls.map((d, i) => ({
        departure: d.value.trim(),
        offset: offsetEls[i]!.value.trim(),
      })) as TimetableState["rows"],
    };
  }

  const syncPreset = (): void => {
    presetEl.value = matchPreset(state());
  };

  // ---- The day track ----

  let bandsKey = "";
  function drawBands(bands: readonly DayBand[]): void {
    const markup = bands
      .map(
        (b) =>
          `<div class="${styles.band}" data-kind="${b.kind}" style="left:${pct((b.startMinute / 1440) * 100)}%;width:${pct(((b.endMinute - b.startMinute) / 1440) * 100)}%"></div>`,
      )
      .join("");
    if (markup === bandsKey) return;
    bandsKey = markup;
    setHtml(bandsEl, raw(markup));
  }

  let tickKey = "";
  function drawDayTicks(): void {
    const step = tickStepHours(layoutWidth(lanesEl) / 24, 44);
    const key = `${step}`;
    if (key !== tickKey) {
      tickKey = key;
      let markup = "";
      for (let h = 0; h < 24; h += step) {
        markup += `<span class="${styles.tick}" data-tick style="left:${pct((h / 24) * 100)}%">${String(h).padStart(2, "0")}:00</span>`;
      }
      setHtml(dayTicksEl, raw(markup));
    }
    thinTickLabels(dayTicksEl, "[data-tick]");
  }

  function drawDay(
    s: TimetableState,
    date: string | null,
    bands: readonly DayBand[],
    facts: readonly RowFacts[],
  ): void {
    el("day-caption").textContent =
      date === null
        ? NO_DAY_CAPTION
        : `Local day ${date} in ${s.startTimeZone}`;
    const chip = el("band-chip");
    chip.textContent = date === null ? "" : bandChipText(bands);
    chip.dataset["dim"] = String(date === null || bands.length === 0);
    chip.hidden = date === null;
    if (bands.length === 1) chip.dataset["kind"] = bands[0]!.kind;
    else delete chip.dataset["kind"];
    drawBands(bands);

    const trackPx = layoutWidth(lanesEl);
    for (let i = 0; i < MAX_ROWS; i++) {
      const n = i + 1;
      const handleEl = handleEls[i]!;
      const box = boxEls[i]!;
      const tagEl = tagEls[i]!;
      const lane = laneState(s, i, date ?? "", lib);
      const dim = (text: string): void => {
        tagEl.textContent = text;
        tagEl.hidden = false;
        tagEl.dataset["pinned"] = "true";
        delete tagEl.dataset["kind"];
        delete tagEl.dataset["side"];
        tagEl.style.left = "";
      };
      if (lane.state === "on") {
        const hhmm = hhmmOfMinute(lane.minute);
        const position = pct((lane.minute / 1440) * 100);
        valueTexts[i] = handleValueText(
          hhmm,
          lane.kind,
          s.rows[i]!.offset,
          hhmmIn(facts[i]?.leaves ?? null),
        );
        box.hidden = false;
        handleEl.value = Math.min(lane.minute, 1435);
        if (lane.kind === "twice" || lane.kind === "skipped") {
          handleEl.dataset["kind"] = lane.kind;
          tagEl.dataset["kind"] = lane.kind;
        } else {
          delete handleEl.dataset["kind"];
          delete tagEl.dataset["kind"];
        }
        tagEl.textContent = tagText(n, hhmm, lane.kind);
        tagEl.hidden = false;
        delete tagEl.dataset["pinned"];
        tagEl.style.left = `${position}%`;
        tagEl.dataset["side"] = placeLabel({
          atPx: (lane.minute / 1440) * trackPx,
          labelPx: layoutWidth(tagEl),
          trackPx,
          offsetPx: 14,
        });
        continue;
      }
      box.hidden = true;
      delete handleEl.dataset["kind"];
      if (lane.state === "blank") {
        if (date === null) {
          tagEl.hidden = true;
          tagEl.textContent = "";
        } else dim(`${n} · click to add`);
      } else if (lane.state === "off") {
        dim(`${n} · on ${lane.date}`);
      } else {
        dim(`${n} · not a date and time`);
      }
    }
  }

  // ---- The two-clocks chart ----

  function ticksMarkup(
    layout: ChartLayout,
    w: ChartWindow,
    stepHours: number,
    wall: boolean,
  ): string {
    const stepMin = stepHours * 60;
    let markup = "";
    for (
      let m = Math.ceil(w.start / stepMin) * stepMin;
      m <= w.end;
      m += stepMin
    ) {
      if (wall && m > 1440) break;
      const label = wall ? hhmmOfMinute(m % 1440) : exactTickLabel(layout, m);
      markup += `<span class="${styles.tick} ${wall ? styles.tickWall : styles.tickExact}" data-tick style="left:${pct(windowPct(m, w))}%">${escapeHtml(label)}</span>`;
    }
    return markup;
  }

  function chartMarkup(
    layout: ChartLayout,
    w: ChartWindow,
    stepHours: number,
  ): string {
    const c = styles;
    const x = (m: number): number => pct(windowPct(m, w));
    const mille = (m: number): number =>
      Number((((m - w.start) / (w.end - w.start)) * 1000).toFixed(3));
    const bandWords = bandChipText(layout.bands);
    const chipKind =
      layout.bands.length === 1 ? ` data-kind="${layout.bands[0]!.kind}"` : "";
    const dimChip = layout.bands.length === 0 ? ` ${c.chipDim}` : "";

    const wallLeft = Math.max(0, x(0));
    const wallRight = Math.min(100, x(1440));
    let wall = `<span class="${c.axisline}" style="left:${wallLeft}%;width:${Math.max(0, pct(wallRight - wallLeft))}%"></span>`;
    for (const f of layout.fans) {
      wall += `<span class="${c.wband}" data-kind="${f.kind}" style="left:${x(f.wallStart)}%;width:${pct(x(f.wallEnd) - x(f.wallStart))}%"></span>`;
    }
    for (const r of layout.rows) {
      const hollow = r.instantMinute === null ? ` ${c.hollow}` : "";
      wall += `<span class="${c.sq}${hollow}" data-series="${r.n}" style="left:${x(r.printedMinute)}%"></span>`;
    }

    let fan = "";
    for (const f of layout.fans) {
      const w0 = mille(f.wallStart);
      const w1 = mille(f.wallEnd);
      if (f.kind === "twice") {
        const [e0, e1, e2] = f.exact.map(mille) as [number, number, number];
        fan += `<polygon class="${c.wedge}" data-kind="twice" points="${w0},0 ${w1},0 ${e1},100 ${e0},100"/>`;
        fan += `<polygon class="${c.wedge}" data-kind="twice" points="${w0},0 ${w1},0 ${e2},100 ${e1},100"/>`;
      } else {
        const e0 = mille(f.exact[0]!);
        fan += `<polygon class="${c.wedge}" data-kind="skipped" points="${w0},0 ${w1},0 ${e0},100"/>`;
      }
    }
    for (const r of layout.rows) {
      if (r.instantMinute === null || r.leaves === null) continue;
      fan += `<line class="${c.link}${r.dashed ? ` ${c.linkDashed}` : ""}" data-series="${r.n}" x1="${mille(r.printedMinute)}" y1="0" x2="${mille(r.instantMinute)}" y2="100"/>`;
    }

    let exact = `<span class="${c.axisline}" style="left:0;width:100%"></span>`;
    for (const f of layout.fans) {
      if (f.kind === "twice") {
        exact += `<span class="${c.eline}" style="left:${x(f.exact[0]!)}%;width:${pct(x(f.exact[2]!) - x(f.exact[0]!))}%"></span>`;
        exact += `<span class="${c.etick}" data-kind="twice" style="left:${x(f.exact[1]!)}%"></span>`;
      } else {
        exact += `<span class="${c.etick}" data-kind="skipped" style="left:${x(f.exact[0]!)}%"></span>`;
      }
    }
    for (const r of layout.rows) {
      if (r.instantMinute === null) continue;
      exact += `<span class="${c.sq}" data-series="${r.n}" style="left:${x(r.instantMinute)}%"></span>`;
    }

    let strip = "";
    layout.segments.forEach((seg, k) => {
      const from = Math.max(w.start, seg.from);
      const to = Math.min(w.end, seg.to);
      if (to <= from) return;
      strip += `<span class="${c.chip} ${c.chipDim} ${c.offsetChip}" data-seg="${k}" data-from="${x(from)}" data-to="${x(to)}">UTC${escapeHtml(seg.offset.replace("-", "−"))}</span>`;
    });

    let journeys = "";
    for (const r of layout.rows) {
      let inner: string;
      if (r.instantMinute === null || r.leaves === null) {
        inner = `<span class="${c.chip} ${c.chipDim} ${c.noinstant}">no instant</span>`;
      } else {
        const startPct = x(r.instantMinute);
        const endMinute = r.arrivalMinute ?? r.instantMinute;
        const clipped = r.open || endMinute > w.end;
        const endPct = x(Math.min(endMinute, w.end));
        const left = Math.max(0, startPct);
        const width = Math.max(0, pct(endPct - left));
        const arrival =
          r.localArrival !== null
            ? arrivalChipText(r.localArrival, layout.date)
            : "";
        inner =
          `<span class="${c.bar}${clipped ? ` ${c.barOpen}` : ""}" style="left:${startPct}%;width:${width}%"></span>` +
          (arrival
            ? `<span class="${c.chip} ${c.arrival}" data-side="start" data-start="${startPct}" data-end="${endPct}" style="left:${endPct}%">${escapeHtml(arrival)}</span>`
            : "");
      }
      journeys += `<div class="${c.prow} ${c.pjourney}" data-series="${r.n}"><span class="${c.pgutter}"><span class="${c.chip}">${r.n}</span></span><div class="${c.px}">${inner}</div></div>`;
    }

    return (
      `<div class="${c.pcap}"><span>Printed clock · ${escapeHtml(layout.startTimeZone)}</span><span class="${c.chip}${dimChip}"${chipKind}>${escapeHtml(bandWords)}</span></div>` +
      `<div class="${c.prow} ${c.pticks}" data-ticks="wall"><span class="${c.pgutter}"></span><div class="${c.px}">${ticksMarkup(layout, w, stepHours, true)}</div></div>` +
      `<div class="${c.prow} ${c.paxis}"><span class="${c.pgutter}"></span><div class="${c.px} ${c.axisWall}">${wall}</div></div>` +
      `<div class="${c.prow} ${c.pfan}"><span class="${c.pgutter}"></span><div class="${c.px}"><svg class="${c.fan}" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${fan}</svg></div></div>` +
      `<div class="${c.prow} ${c.paxis}"><span class="${c.pgutter}"></span><div class="${c.px} ${c.axisExact}">${exact}</div></div>` +
      `<div class="${c.prow} ${c.pticks}" data-ticks="exact"><span class="${c.pgutter}"></span><div class="${c.px}">${ticksMarkup(layout, w, stepHours, false)}</div></div>` +
      `<div class="${c.prow} ${c.poffsets}"><span class="${c.pcapText}">Exact time · UTC</span><span class="${c.pgutter}"></span><div class="${c.px}" data-strip>${strip}</div></div>` +
      journeys
    );
  }

  /** Measure, then toggle: thin the tick labels, flip an arrival chip that would leave the
   *  plot, and hide an offset chip that does not fit. */
  function fitChart(): void {
    for (const row of plotEl.querySelectorAll<HTMLElement>(
      `[data-ticks] > .${styles.px}`,
    )) {
      thinTickLabels(row, "[data-tick]");
    }
    for (const chip of plotEl.querySelectorAll<HTMLElement>(
      `.${styles.arrival}`,
    )) {
      const px = chip.parentElement!;
      const trackPx = layoutWidth(px);
      const startAt = Number(chip.dataset["start"]);
      const endAt = Number(chip.dataset["end"]);
      const { side, leftPx } = arrivalChipPlacement({
        startPx: (startAt / 100) * trackPx,
        endPx: (endAt / 100) * trackPx,
        labelPx: layoutWidth(chip),
        trackPx,
        offsetPx: 8,
      });
      chip.dataset["side"] = side;
      chip.style.left = trackPx > 0 ? `${(leftPx / trackPx) * 100}%` : "0";
    }
    const strip = plotEl.querySelector<HTMLElement>("[data-strip]");
    const caption = plotEl.querySelector<HTMLElement>(`.${styles.pcapText}`);
    if (strip && caption) {
      const px = layoutWidth(strip);
      const origin = strip.getBoundingClientRect().left;
      const captionRight = caption.getBoundingClientRect().right - origin;
      for (const chip of strip.querySelectorAll<HTMLElement>(
        `.${styles.offsetChip}`,
      )) {
        chip.hidden = false;
        const w = layoutWidth(chip);
        if (px === 0 || w === 0) continue;
        const from = (Number(chip.dataset["from"]) / 100) * px;
        const to = (Number(chip.dataset["to"]) / 100) * px;
        const lowest = Math.max(from + 4, captionRight + 8);
        const highest = to - w - 4;
        if (highest < lowest) {
          chip.hidden = true;
          continue;
        }
        const left = Math.min(
          highest,
          Math.max(lowest, (from + to) / 2 - w / 2),
        );
        chip.style.left = `${pct((left / px) * 100)}%`;
      }
    }
  }

  function drawChart(layout: ChartLayout | null, w: ChartWindow | null): void {
    lastChart = { layout, win: w };
    const caption = el("chart-caption");
    if (layout === null || w === null) {
      setHtml(
        plotEl,
        html`<span class="${styles.chip} ${styles.chipDim} ${styles.plotEmpty}">${NO_CHART_CHIP}</span>`,
      );
      chartEl.setAttribute("aria-label", NO_CHART_CHIP);
      caption.textContent = "";
      return;
    }
    chartEl.setAttribute("aria-label", chartSummary(layout));
    /* Two passes: the tick step depends on the width the first pass lays out. */
    setHtml(plotEl, raw(chartMarkup(layout, w, 1)));
    const px = plotEl.querySelector<HTMLElement>(`.${styles.px}`);
    const step = px
      ? tickStepHours(layoutWidth(px) / ((w.end - w.start) / 60), 52)
      : 12;
    if (step !== 1) setHtml(plotEl, raw(chartMarkup(layout, w, step)));
    fitChart();
    caption.textContent =
      `Arrival times are in ${layout.timeZone}.` +
      (layout.timeZone !== layout.startTimeZone
        ? ` The timetable is printed in ${layout.startTimeZone}.`
        : "");
  }

  // ---- The table ----

  let rowsKey = "";
  function drawTable(s: TimetableState, facts: readonly RowFacts[]): void {
    const rows: TableRow[] = [];
    for (let i = 0; i < MAX_ROWS; i++) {
      const row = s.rows[i]!;
      if (row.departure === "") continue;
      const kind = classify(row.departure, s.startTimeZone, lib);
      const f = facts[i]!;
      rows.push({
        n: i + 1,
        departure: row.departure,
        offset: row.offset,
        leaves: f.leaves,
        local: f.result?.legTimes[0]?.localArrival ?? null,
        note: rowBadge(kind, row.offset !== ""),
      });
    }
    const markup = rowsTable(rows, s.timeZone, s.startTimeZone);
    const key = markup.toString();
    if (key === rowsKey) return;
    rowsKey = key;
    setHtml(rowsSlot, markup);
  }

  // ---- Render ----

  /** `refit` re-fits the chart's window to the rows. A moving handle passes false: the chart
   *  keeps its window until the change settles, so a mark that leaves it is clipped at the
   *  plot's edge rather than the axis sliding under the reader's pointer. */
  function render(refit = true): void {
    if (destroyed) return;
    const s = state();
    /* The choices depend on the printed time and the zone, so they are rebuilt whenever
       either moves. The select is available only where it matters: a row that holds an
       offset keeps it enabled, so the reader can always clear it. */
    for (let i = 0; i < MAX_ROWS; i++) {
      const offsetEl = offsetEls[i]!;
      const row = s.rows[i]!;
      const choices = offsetChoices(row.departure, s.startTimeZone, lib);
      const markup = offsetOptions(choices, row.offset);
      if (offsetEl.dataset["options"] !== markup.toString()) {
        offsetEl.dataset["options"] = markup.toString();
        setHtml(offsetEl, markup);
        offsetEl.value = row.offset;
      }
      offsetEl.disabled = choices.length <= 1 && row.offset === "";
      const text = offsetReason(
        row.departure,
        s.startTimeZone,
        row.offset,
        lib,
      );
      if (whyEls[i]!.textContent !== text) whyEls[i]!.textContent = text;
    }

    const facts: RowFacts[] = [];
    for (let i = 0; i < MAX_ROWS; i++) {
      facts.push(
        s.rows[i]!.departure === ""
          ? { leaves: null, result: null }
          : rowFacts(s, i, lib),
      );
    }
    const date = trackDate(s, lib);
    const layout = chartLayout(s, lib, facts, memo);
    const bands =
      layout?.bands ??
      (date === null ? [] : bandsFor(s.startTimeZone, date, lib, memo));
    drawDay(s, date, bands, facts);
    if (layout === null) win = null;
    else if (refit || win === null) win = chartWindow(layout);
    drawChart(layout, win);
    drawTable(s, facts);

    const filled: number[] = [];
    for (let i = 0; i < MAX_ROWS; i++)
      if (s.rows[i]!.departure !== "") filled.push(i);
    const current = Number.parseInt(rowPickEl.value, 10);
    const pickMarkup = html`${filled.map(
      (i) =>
        html`<option value="${i}">Row ${i + 1} (${s.rows[i]!.departure})</option>`,
    )}`;
    if (rowPickEl.dataset["options"] !== pickMarkup.toString()) {
      rowPickEl.dataset["options"] = pickMarkup.toString();
      setHtml(rowPickEl, pickMarkup);
    }
    const picked = filled.includes(current) ? current : (filled[0] ?? 0);
    rowPickEl.value = String(picked);

    const leg = rowLeg(s, picked);
    const options = optionsOf(s);
    const { result, reason } = rowResult(s, picked, lib);
    const legs = leg ? [leg] : [];
    paintCalls(el("call-slot"), [
      {
        fn: "scheduleDelivery",
        args: options === undefined ? [legs] : [legs, options],
        result,
      },
    ]);
    paintOutput(
      el("out-slot"),
      result === null
        ? {
            label: "What scheduleDelivery returned",
            state: "sentinel",
            lines: [{ text: NO_SIGNAL, lost: true }],
          }
        : {
            label: "What scheduleDelivery returned",
            state: "live",
            lines: [{ text: formatSchedule(result), lost: false }],
          },
    );

    setHtml(
      el("reason"),
      reason
        ? aside(
            { label: "Why null", tone: "caution", title: "Why null" },
            html`<p>${reason}</p>`,
          )
        : html``,
    );
  }

  function applyPreset(): void {
    const chosen = TIMETABLE_PRESETS.find((p) => p.id === presetEl.value);
    if (!chosen) return;
    writeSeed({
      startTimeZone: chosen.startTimeZone,
      duration: chosen.duration,
      timeZone: chosen.timeZone,
      rows: ROWS.map(
        (_, i) => chosen.rows[i] ?? { departure: "", offset: "" },
      ) as TimetableState["rows"],
    });
    syncPreset();
    render();
  }

  // ---- Handles ----

  /** Writes row `i`'s printed time at `minute` on the track's date. Changes nothing else:
   *  the offset is the reader's own choice. */
  function moveRow(i: number, minute: number, date: string): void {
    const next = withMinute(date, minute);
    const input = departureEls[i]!;
    if (input.value === next) return;
    input.value = next;
    syncPreset();
    render(false);
  }

  /** The handle moved: a five-minute step from a time that is not a multiple of five lands on
   *  the next multiple (01:32 to 01:35), as the printed times themselves do. */
  function onHandle(i: number): void {
    const date = trackDate(state(), lib);
    if (date === null) return;
    const before = rowMinute(departureEls[i]!.value);
    let next = handleEls[i]!.value;
    if (before !== null && before % 5 !== 0 && Math.abs(next - before) === 5) {
      next = stepMinute(before, next > before ? 1 : -1);
    }
    moveRow(i, next, date);
    handleEls[i]!.value = next;
  }

  const typed: readonly EventTarget[] = [...departureEls, ...offsetEls];

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (destroyed) return;
      const t = e.target;
      const h = handleEls.findIndex((x) => x === t);
      if (h >= 0) {
        onHandle(h);
        return;
      }
      if (t === durationEl || (t !== null && typed.includes(t))) {
        syncPreset();
        render(false);
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (destroyed) return;
      const t = e.target;
      if (t === presetEl) {
        applyPreset();
      } else if (t === rowPickEl) {
        render(false);
      } else if (t !== null && handleEls.some((h) => h === t)) {
        render();
      } else if (
        t === startZoneEl ||
        t === zoneEl ||
        t === durationEl ||
        (t !== null && typed.includes(t))
      ) {
        syncPreset();
        render();
      }
    },
    { signal },
  );

  /* The empty lane of a row with no time takes one where it is pressed, and the new time then
     follows the pointer until it comes up: a press-and-drag, as a handle already gives a row
     that has a time. The handle box is hidden on an empty lane, so a press never lands on a
     handle there; a lane that has a time ignores a press away from its handle. */
  const emptyLaneAt = (target: EventTarget | null): number => {
    const i = laneEls.findIndex((l) => l.contains(target as Node | null));
    return i >= 0 && departureEls[i]!.value.trim() === "" ? i : -1;
  };
  const minuteAt = (clientX: number): number | null => {
    const rect = lanesEl.getBoundingClientRect();
    if (!(rect.width > 0)) return null;
    return minuteAtPointer(
      clientX,
      rect.left,
      rect.width,
      pointerStep(rect.width),
    );
  };
  let laneDrag: number | null = null;
  const endLaneDrag = (): void => {
    if (laneDrag === null) return;
    laneDrag = null;
    if (!destroyed) render();
  };

  widgetEl.addEventListener(
    "pointerdown",
    (e) => {
      if (destroyed) return;
      const i = emptyLaneAt(e.target);
      if (i < 0) return;
      const date = trackDate(state(), lib);
      const minute = minuteAt((e as PointerEvent).clientX);
      if (date === null || minute === null) return;
      laneDrag = i;
      moveRow(i, minute, date);
      try {
        laneEls[i]!.setPointerCapture((e as PointerEvent).pointerId);
      } catch {
        /* Capture can throw (a pointer that is already gone); the drag still follows the
           events that bubble to the widget. */
      }
    },
    { signal },
  );
  widgetEl.addEventListener(
    "pointermove",
    (e) => {
      if (destroyed || laneDrag === null) return;
      const date = trackDate(state(), lib);
      const minute = minuteAt((e as PointerEvent).clientX);
      if (date === null || minute === null) return;
      moveRow(laneDrag, minute, date);
    },
    { signal },
  );
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    widgetEl.addEventListener(type, endLaneDrag, { signal });
  }

  if (start !== null) writeSeed(start);
  syncPreset();
  render();
  drawDayTicks();

  /* Refit what depends on a width: the day's ticks, the chart's ticks and labels, and the
     tags. Once more when the fonts arrive, because a label measured in a fallback face is the
     wrong width. */
  const refitText = (): void => {
    if (destroyed) return;
    drawDayTicks();
    render(false);
  };
  const stopTrack = onWidthChange(lanesEl, refitText);
  const stopPlot = onWidthChange(plotEl, () => {
    if (!destroyed) drawChart(lastChart.layout, lastChart.win);
  });
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (fonts) {
    void fonts.ready.then(refitText);
    fonts.addEventListener?.("loadingdone", refitText, { signal });
  }
  const stop = (): void => {
    destroyed = true;
    stopTrack();
    stopPlot();
  };
  signal.addEventListener("abort", stop);

  return {
    state,
    destroy() {
      signal.removeEventListener("abort", stop);
      stop();
    },
  };
}

export const mountTimetableReader: MountFn<TimetableReaderArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: TimetableLib;
  try {
    lib = await loadTimetableLib();
  } catch (cause) {
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const seeded = args.departures !== undefined || args.departure1 !== undefined;
  const controller = setupWidget(
    root,
    lib,
    seeded ? readArgs(args) : null,
    signal,
  );
  return onceDestroy(
    () => controller.destroy(),
    () => permalinkOf(controller.state()),
  );
};
