/**
 * The Cut-off Stack widget (TRAN-10), mountable on its tool page and in the chat rail.
 *
 * A sailing's whole stack of cut-offs, computed by `cutoffSchedule` against one departure,
 * earliest first, with closed days shaded and each rolled cut-off drawn where it landed and
 * where `cutoffAt` with no calendar would have put it.
 *
 * Built on the component kit: `renderCutoffStackTemplate` writes the markup from builders only,
 * with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids. The drawn parts
 * are placed by `--gmt-at` fractions of one axis, so nothing is measured and nothing observes a
 * resize. Every listener is delegated on the root and tied to the mount's signal.
 */
import { Temporal } from "@js-temporal/polyfill";
import { defineElements } from "~/widgets/define";
import {
  aside,
  badge,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  html,
  idScope,
  lane,
  mark,
  section,
  select,
  setHtml,
  swatch,
  textInput,
  widget,
  type SafeHtml,
  type TimelineSeries,
} from "~/widgets/builders";
import {
  cutoffBands,
  cutoffScale,
  type Band,
  type ScaleTick,
} from "~/widgets/families/cutoff/bands";
import { cutoffGate } from "~/widgets/families/cutoff/gate";
import { paintCalls } from "~/widgets/families/cutoff/paint-calls";
import { paintOutput } from "~/widgets/families/cutoff/paint-output";
import { rolledArc, rolledMark } from "~/widgets/families/cutoff/rolled-marks";
import {
  closedDaysFieldset,
  cutoffFieldset,
} from "~/widgets/families/cutoff/stack-fieldsets";
import {
  setSelectValue,
  zoneChoices,
} from "~/widgets/families/cutoff/zone-choices";
import { callOutput } from "~/widgets/families/gnss/call-output";
import {
  handoffEmpty,
  handoffRows,
  handoffTable,
} from "~/widgets/families/transport/handoff-table";
import type { GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/cutoff-stack.module.css";
import {
  CUSTOM_PRESET_ID,
  MAX_CUTOFFS,
  STACK_PRESETS,
  axisDatesOf,
  collectStackFacts,
  entriesOf,
  matchPreset,
  optionsOf,
  permalinkOf,
  presetState,
  readArgs,
  stackNullReason,
  stackNullText,
  type CutoffFields,
  type CutoffStackArgs,
  type StackFacts,
  type StackRow,
  type StackState,
} from "./cutoff-stack";
import { loadCutoffLib } from "./cutoff-lib";
import {
  WEEKDAYS,
  dayTickLabel,
  durationText,
  epochMs,
  formatStack,
  localLabel,
  weekdayTickLabel,
  type CutoffLib,
} from "./cutoff-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { CutoffStackArgs } from "./cutoff-stack";

const WIDGET_NAME = "cutoff-stack";
const NBSP = "\u00a0";
const CUTOFF_NUMBERS = [1, 2, 3, 4] as const;
const TABLE_COLUMNS = [
  "Cut-off",
  "Rule",
  "Closes",
  "Before departure",
  "Moved",
] as const;

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** The word a drawn surface shows when there is nothing to draw. */
function noSignal(): SafeHtml {
  return html`<p class="${styles.lost}">NO SIGNAL</p>`;
}

const seriesOf = (row: StackRow): TimelineSeries =>
  Math.min(4, Math.max(1, row.series)) as TimelineSeries;

/** `renderCutoffStackTemplate(idPrefix, args = {})` (seeded when `args.anchor` or
 *  `args.cutoffs` or `args.name1` is defined, else the first preset). */
export function renderCutoffStackTemplate(
  idPrefix: string,
  args: CutoffStackArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const flat = args as unknown as Record<string, unknown>;
  const seeded =
    args.anchor !== undefined ||
    args.cutoffs !== undefined ||
    flat["name1"] !== undefined;
  const state: StackState = seeded
    ? readArgs(args)
    : presetState(STACK_PRESETS[0]!);
  const presetId = matchPreset(state);

  const pick = section(
    { id: id("pick"), heading: "1. The sailing and its cut-offs", level: 4 },
    html`${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...STACK_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`${field({
        id: id("anchor"),
        label: "Departs",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.anchor,
            autocomplete: "off",
            spellcheck: false,
          }),
      })}${field({
        id: id("zone"),
        label: "Terminal clock",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.timeZone,
            options: zoneChoices(state.timeZone),
          }),
      })}`,
    )}${CUTOFF_NUMBERS.map((n) =>
      cutoffFieldset({ id, n, values: state.cutoffs[n - 1]! }),
    )}${closedDaysFieldset({
      id,
      values: {
        calendar: state.calendar,
        weekend: state.weekend,
        holidays: state.holidays,
        roll: state.roll,
      },
    })}`,
  );

  const read = section(
    { id: id("read"), heading: "2. When each cut-off closes", level: 4 },
    html`${grow(html`<div id="${id("timeline")}"></div>`)}${grow(
      html`<p class="${styles.summary}" id="${id("summary")}">${NBSP}</p>`,
    )}${grow(
      handoffTable({
        caption: "The cut-off stack",
        columns: TABLE_COLUMNS,
        rows: [],
        reserve: 1,
        bodyId: id("table-body"),
        emptyId: id("table-empty"),
      }),
    )}${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  const calls = section(
    { id: id("calls"), heading: "3. What cutoffSchedule returns", level: 4 },
    html`${grow(
      html`<div id="${id("call-stack")}">${codeFrame({
        label: "cutoffSchedule call",
        copyLabel: "Copy cutoffSchedule call",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("out-stack")}">${callOutput({
        label: "cutoffSchedule returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Cut-off Stack", scope: idPrefix },
    html`${pick}${read}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function ruleText(row: StackRow): string {
  return row.atLocalTime ? `${row.offset} at ${row.atLocalTime}` : row.offset;
}

function movedText(row: StackRow): string {
  if (row.unrolled === undefined) return "—";
  return row.moved ? `from ${localLabel(row.unrolled)}` : "no";
}

function beforeDepartureText(row: StackRow): string {
  const words = durationText(row.beforeDeparture);
  return row.afterDeparture
    ? `${words} after the departure: cutoffAt does not check order`
    : `${words} before departure`;
}

interface DayBound {
  date: string;
  startMs: number;
  endMs: number;
}

/**
 * Each axis date's real local-day bounds, from the polyfill's own `startOfDay()` chained day by
 * day, the same boundary `dwellTime`'s own grid uses, so a 23- or 25-hour DST day is one column
 * at its real width, never a day arithmetic of this widget's own. `[]` when `dates` is empty or
 * the zone does not resolve.
 */
function dayBoundsFor(dates: readonly string[], zone: string): DayBound[] {
  if (dates.length === 0) return [];
  try {
    let day = Temporal.PlainDate.from(dates[0]!)
      .toZonedDateTime({ timeZone: zone, plainTime: "12:00" })
      .startOfDay();
    const out: DayBound[] = [];
    for (const date of dates) {
      const next = day.add({ days: 1 }).startOfDay();
      out.push({
        date,
        startMs: day.epochMilliseconds,
        endMs: next.epochMilliseconds,
      });
      day = next;
    }
    return out;
  } catch {
    return [];
  }
}

/** A column narrower than this share of the axis draws no word in it; one narrower than
 *  `MIN_WEEKDAY_PERCENT` drops the weekday from its label. */
const MIN_LABEL_PERCENT = 9;
const MIN_WEEKDAY_PERCENT = 14;

/** The days' own reading: every closed day named, so the shading is not the only carrier. */
function closedDaysText(facts: StackFacts, timeZone: string): string {
  const closed = Object.entries(facts.closedDays)
    .filter(([, shut]) => shut)
    .map(([date]) => {
      const day = Temporal.PlainDate.from(date).toZonedDateTime({
        timeZone,
        plainTime: "12:00",
      });
      return `${weekdayTickLabel(day)} ${dayTickLabel(day)}`;
    });
  return closed.length === 0 ? "" : `Closed days: ${closed.join(", ")}.`;
}

function timelineOf(
  facts: StackFacts,
  timeZone: string,
  hasEntries: boolean,
): SafeHtml {
  if (facts.rows.length === 0) return hasEntries ? noSignal() : html``;
  const dates = axisDatesOf(
    facts.rows.map((r) => ({ at: r.at, unrolled: r.unrolled })),
    facts.departure,
  );
  const bounds = dayBoundsFor(dates, timeZone);
  if (bounds.length === 0) return html``;
  const axisStartMs = bounds[0]!.startMs;
  const axisEndMs = bounds[bounds.length - 1]!.endMs;
  const span = Math.max(1, axisEndMs - axisStartMs);
  const pct = (ms: number) => (ms - axisStartMs) / span;

  const departureMs = facts.departure ? epochMs(facts.departure) : null;

  const closedBands = (withWords: boolean): Band[] =>
    bounds
      .filter((b) => facts.closedDays[b.date] === true)
      .map((b) => {
        const width = (b.endMs - b.startMs) / span;
        return {
          kind: "closed",
          from: pct(b.startMs),
          to: pct(b.endMs),
          ...(withWords && width * 100 >= MIN_LABEL_PERCENT
            ? { word: "closed" }
            : {}),
        };
      });

  const ticks: ScaleTick[] = bounds.map((b, i) => {
    const width = ((b.endMs - b.startMs) / span) * 100;
    const dayStart = Temporal.Instant.fromEpochMilliseconds(
      b.startMs,
    ).toZonedDateTimeISO(timeZone);
    const date = dayTickLabel(dayStart);
    const label =
      width >= MIN_WEEKDAY_PERCENT
        ? `${date} · ${weekdayTickLabel(dayStart)}`
        : date;
    return {
      at: (pct(b.startMs) + pct(b.endMs)) / 2,
      label,
      // Narrow columns thin themselves to every other label; a narrow box drops the rest.
      rank:
        width < MIN_LABEL_PERCENT || (bounds.length > 4 && i % 2 === 1) ? 1 : 0,
      day: true,
    };
  });

  const gate =
    departureMs === null
      ? ""
      : cutoffGate({
          label: `departure ${localLabel(facts.departure)}`,
          at: pct(departureMs),
        });

  const lanes = facts.rows.map((row, i) => {
    const atPct = pct(epochMs(row.at));
    const series = seriesOf(row);
    const movedFrom =
      row.moved && row.unrolled !== undefined ? row.unrolled : undefined;
    const rolled =
      movedFrom === undefined
        ? ""
        : html`${rolledArc({
            from: pct(epochMs(movedFrom)),
            to: atPct,
            series,
          })}${rolledMark({
            label: `${row.name} without the calendar: ${localLabel(movedFrom)}`,
            at: pct(epochMs(movedFrom)),
            series,
          })}`;
    return lane(
      { label: row.name },
      html`${cutoffBands(closedBands(i === 0))}${rolled}${mark({
        label: `${row.name} closes ${localLabel(row.at)}${movedFrom === undefined ? "" : `, moved from ${localLabel(movedFrom)}`}`,
        at: atPct,
        series,
      })}${gate}`,
    );
  });

  return html`<div class="${styles.legend}">${badge({
    text: `Departs ${localLabel(facts.departure)} (${timeZone})`,
    tone: "cyan",
  })}</div>${lanes}<div class="${styles.scaleRow}">${cutoffScale(ticks)}</div>`;
}

function summaryText(facts: StackFacts, timeZone: string): string {
  if (facts.rows.length === 0) return "";
  const rows = facts.rows
    .map((row) => {
      const moved =
        row.unrolled === undefined
          ? ""
          : row.moved
            ? `, moved from ${localLabel(row.unrolled)}`
            : ", not moved";
      return `${row.name} closes ${localLabel(row.at)}, ${beforeDepartureText(row)}${moved}.`;
    })
    .join(" ");
  const closed = closedDaysText(facts, timeZone);
  return closed === "" ? rows : `${rows} ${closed}`;
}

/** The cells of a table row: a name with its series swatch, then the rule, close, lead and move. */
function cellsOf(row: StackRow): SafeHtml[] {
  const text = (value: string, sub?: string): SafeHtml =>
    html`<span class="${styles.text}">${value}${sub === undefined ? "" : html`<span class="${styles.sub}">${sub}</span>`}</span>`;
  return [
    html`<span class="${styles.name}">${swatch({ series: seriesOf(row) })}${text(row.name)}</span>`,
    text(ruleText(row)),
    text(localLabel(row.at), row.at),
    text(beforeDepartureText(row), row.beforeDeparture),
    text(movedText(row)),
  ];
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setupWidget(
  root: HTMLElement,
  lib: CutoffLib,
  signal: AbortSignal,
): {
  readState(): StackState;
  apply(args: CutoffStackArgs): void;
  start(): void;
} {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const anchorEl = el<HTMLInputElement>("anchor");
  const zoneEl = el<HTMLSelectElement>("zone");
  const calendarEl = el<HTMLInputElement>("calendar");
  const weekendEl = widgetEl.querySelector<GmtChips>("gmt-chips")!;
  const holidaysEl = el<HTMLInputElement>("holidays");
  const rollEl = el<HTMLSelectElement>("roll");
  const cutoffEls = CUTOFF_NUMBERS.map((n) => ({
    name: el<HTMLInputElement>(`name-${n}`),
    offset: el<HTMLInputElement>(`offset-${n}`),
    at: el<HTMLInputElement>(`at-${n}`),
  }));

  const weekendValue = (): number[] =>
    WEEKDAYS.filter((w) =>
      (weekendEl.value as string[]).includes(String(w.value)),
    ).map((w) => w.value);

  function readState(): StackState {
    const cutoffs = cutoffEls.map((c) => ({
      name: c.name.value.trim(),
      offset: c.offset.value.trim(),
      atLocalTime: c.at.value.trim(),
    })) as [CutoffFields, CutoffFields, CutoffFields, CutoffFields];
    return {
      anchor: anchorEl.value.trim(),
      timeZone: zoneEl.value.trim(),
      cutoffCount: String(MAX_CUTOFFS),
      cutoffs,
      calendar: calendarEl.checked,
      weekend: weekendValue(),
      holidays: holidaysEl.value.trim(),
      roll: rollEl.value.trim(),
    };
  }

  function writeState(s: StackState): void {
    anchorEl.value = s.anchor;
    setSelectValue(zoneEl, s.timeZone);
    cutoffEls.forEach((c, i) => {
      const f = s.cutoffs[i]!;
      c.name.value = f.name;
      c.offset.value = f.offset;
      c.at.value = f.atLocalTime;
    });
    calendarEl.checked = s.calendar;
    weekendEl.value = s.weekend.map(String);
    holidaysEl.value = s.holidays;
    setSelectValue(rollEl, s.roll);
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function draw(slot: HTMLElement, make: () => SafeHtml): void {
    try {
      setHtml(slot, make());
    } catch {
      // An instant at the edge of the supported range cannot be placed on an axis.
      setHtml(slot, noSignal());
    }
  }

  function render(): void {
    const s = readState();
    const entries = entriesOf(s);
    const options = optionsOf(s);
    const facts = collectStackFacts(s, lib);
    const timeZone = s.timeZone.trim();

    paintCalls(el("call-stack"), [
      {
        fn: "cutoffSchedule",
        args: [s.anchor, entries, options],
        result: facts.result,
      },
    ]);
    paintOutput(
      el("out-stack"),
      entries.length === 0
        ? {
            label: "cutoffSchedule returned",
            state: "empty",
            lines: [{ text: formatStack([]), lost: false }],
          }
        : facts.result.length === 0
          ? {
              label: "cutoffSchedule returned",
              state: "sentinel",
              lines: [{ text: "NO SIGNAL", lost: true }],
            }
          : {
              label: "cutoffSchedule returned",
              state: "live",
              lines: [{ text: formatStack(facts.result), lost: false }],
            },
    );

    draw(el("timeline"), () => timelineOf(facts, timeZone, entries.length > 0));
    el("summary").textContent = summaryText(facts, timeZone) || NBSP;
    setHtml(
      el("table-body"),
      handoffRows(
        TABLE_COLUMNS,
        facts.rows.map(cellsOf),
        Math.max(1, facts.rows.length),
      ),
    );
    setHtml(
      el("table-empty"),
      handoffEmpty(facts.rows.length === 0 ? "No cut-off to list." : ""),
    );

    const reason = el("reason");
    if (entries.length === 0) {
      setHtml(
        reason,
        aside(
          { label: "Note", tone: "note", title: "Note" },
          html`<p>An empty list returns [].</p>`,
        ),
      );
    } else if (facts.result.length === 0) {
      const why = stackNullReason(s, facts, lib);
      setHtml(
        reason,
        aside(
          {
            label: "Why NO SIGNAL",
            tone: "caution",
            title: "Why NO SIGNAL",
          },
          html`<p>${why ? stackNullText(why) : "The stack could not be computed."}</p>`,
        ),
      );
    } else {
      setHtml(reason, html``);
    }
  }

  function applyPreset(): void {
    const chosen = STACK_PRESETS.find((p) => p.id === presetEl.value);
    if (!chosen) return;
    writeState(presetState(chosen));
    syncPreset();
    render();
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      if (e.target === presetEl) return;
      syncPreset();
      render();
    },
    { signal },
  );
  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target === presetEl) {
        applyPreset();
        return;
      }
      syncPreset();
      render();
    },
    { signal },
  );

  return {
    readState,
    apply(args) {
      const flat = args as unknown as Record<string, unknown>;
      if (
        args.anchor === undefined &&
        args.cutoffs === undefined &&
        flat["name1"] === undefined
      ) {
        return;
      }
      writeState(readArgs(args));
      syncPreset();
    },
    start: render,
  };
}

export const mountCutoffStack: MountFn<CutoffStackArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: CutoffLib;
  try {
    lib = await loadCutoffLib();
  } catch (cause) {
    throw cause instanceof WidgetLoadError ? cause : new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const controller = setupWidget(root, lib, signal);
  controller.apply(args);
  controller.start();

  return onceDestroy(
    () => {},
    () => permalinkOf(controller.readState()),
  );
};
