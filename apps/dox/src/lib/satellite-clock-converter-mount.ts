/**
 * The Satellite Clock Converter, mountable on its tool page and in the chat rail.
 *
 * A time on any one clock goes in: a UTC instant, or a reading on TAI or on one
 * of the six satellite systems. Out come the same instant on every clock and
 * each clock's lead over UTC:
 *
 * 1. the controls (the value, a slider through the leap seconds, a preset);
 * 2. the clock ladder: eight clocks as rungs on one vertical scale of seconds
 *    ahead of UTC, TAI as the top rail, beside three plates (UTC, TAI minus
 *    UTC, the next change);
 * 3. the table of every clock, always eight rows;
 * 4. the calls made and what they returned.
 *
 * The mount never computes a time. Every instant and lead comes from
 * `readClocks` (satellite-clock-converter.ts), which calls the library; the
 * ladder only places what those calls returned.
 *
 * Built on the component kit: `renderSatelliteClockConverterTemplate` writes the markup
 * from builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by
 * those ids and reads and writes element `value` properties. Every listener is delegated on
 * the widget with the mount's `signal`. The one drag handle is a native range, and the value
 * field is its typed equivalent. The plates, the ladder's stage, its eight rows and the
 * table's eight rows keep their boxes from one reading to the next.
 */
import { defineElements } from "~/widgets/define";
import {
  aside,
  codeFrame,
  field,
  fieldGrid,
  findWidget,
  hint,
  html,
  idScope,
  plates,
  section,
  setHtml,
  srOnly,
  textInput,
  toolLinks,
  widget,
  type Plate,
  type SafeHtml,
  type ToolLinkItem,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { callLines, outputOf } from "~/widgets/families/gnss/call-lines";
import {
  clockLadder,
  clockLegend,
  type ClockLadderRow,
} from "~/widgets/families/gnss/clock-ladder";
import {
  gnssLineTable,
  type LineRow,
} from "~/widgets/families/gnss/gnss-line-table";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/satellite-clock-converter.module.css";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { loadGnssLib, type GnssLib } from "./gnss-lib";
import { GNSS_SYSTEMS, type GnssSystem } from "./gnss-names";
import {
  CLOCK_LINKS,
  CLOCK_PRESETS,
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  GLO_NOTE,
  IRN_NOTE,
  LADDER_NONE_NOTE,
  MAX_VALUE_LENGTH,
  NO_RESULT_TEXT,
  PLATE_NO_SIGNAL,
  clockHandoffs,
  clockTies,
  emptyRead,
  isSeeded,
  ladderAria,
  ladderChip,
  ladderLayout,
  ladderSpan,
  matchPreset,
  BEFORE_1972_NOTE,
  offReserve,
  permalinkOf,
  platesOf,
  presetState,
  readArgs,
  readClocks,
  rowSentence,
  sliderPositions,
  summaryText,
  tieTag,
  type ClockRead,
  type ClockRow,
  type ClockState,
  type ClockTie,
  type SatelliteClockConverterArgs,
} from "./satellite-clock-converter";
import { INTEGER_UTC_FROM } from "./timescale-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { handoffHref } from "./widget-permalink";

export type { SatelliteClockConverterArgs } from "./satellite-clock-converter";

const NBSP = "\u00a0";

/**
 * The most calls one reading makes: the conversion in, `toTAI`, the UTC spelled back, one for
 * each satellite clock, then the TAI lead and the next leap second.
 */
const MAX_CALLS = GNSS_SYSTEMS.length + 4;
const WIDGET_NAME = "satellite-clock-converter";

const TABLE_COLUMNS = ["Clock", "Reading", "Ahead of UTC"];

/** The widest instants a plate shows, so the plates keep their width from one reading to the next. */
const SAMPLE_INSTANT = "8888-88-88T88:88:88";
const PLATE_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  "hero-utc": [`${SAMPLE_INSTANT}Z`],
  "hero-next": ["none after this instant", `${SAMPLE_INSTANT}Z`],
};

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/** The plates of a reading. Under a sentinel each says NO SIGNAL in words. */
/** Each plate's lines whose words change with the reading: the longest one a line can print (every clock's name is three letters). */
const PLATE_LINE_SAMPLES: Readonly<
  Record<string, readonly (readonly string[] | undefined)[]>
> = {
  "hero-utc": [["read from GAL"]],
};

function plateList(read: ClockRead | null): Plate[] {
  const lost = read?.status === "sentinel";
  return (read?.plates ?? platesOf(null)).map((s) => {
    const samples = PLATE_SAMPLES[s.role];
    const lineSamples = PLATE_LINE_SAMPLES[s.role];
    return {
      caption: s.caption,
      value: lost ? PLATE_NO_SIGNAL : s.value,
      lines: s.lines,
      ...(s.series === undefined ? {} : { series: s.series }),
      ...(s.quiet === true ? { quiet: true } : {}),
      ...(s.captions === undefined ? {} : { captions: s.captions }),
      ...(samples === undefined ? {} : { samples }),
      ...(lineSamples === undefined ? {} : { lineSamples }),
    };
  });
}

interface LadderContext {
  span: number;
  reserve: number;
  ties: Partial<Record<GnssSystem, ClockTie>>;
}

/** The ladder of a reading: the drawing and eight rows, whichever are on the scale. */
function ladderOf(read: ClockRead, ctx: LadderContext): SafeHtml {
  const layout = ladderLayout(read, ctx.span);
  const ok = read.status === "ok";
  const rows = read.rows.map((row): ClockLadderRow => {
    const tie: ClockTie =
      row.key === "UTC" || row.key === "TAI"
        ? null
        : (ctx.ties[row.key as GnssSystem] ?? null);
    return {
      key: row.key,
      top: layout.off.includes(row.key) ? null : layout.tops[row.key],
      tie,
      tieText: tieTag(row.key, tie),
      chip: ok ? ladderChip(row) : "",
      reading: !ok ? "" : row.none ? LADDER_NONE_NOTE : row.reading,
      yours: row.yours,
      title: ok ? rowSentence(row) : "",
    };
  });
  return clockLadder({
    label: ladderAria(read),
    layout,
    rows,
    sentences: ok ? read.rows.map(rowSentence) : [],
    lost: read.status === "sentinel",
    offReserve: Math.max(ctx.reserve, layout.off.length),
    gate: "drawn",
  });
}

function tableRow(row: ClockRow): LineRow {
  return {
    name: { text: row.key, sub: row.tags.join(" · ") },
    yours: row.yours,
    cells: [
      {
        text: row.none ? NO_RESULT_TEXT : row.reading,
        sub: row.writtenAs === null ? "" : `written as ${row.writtenAs}`,
      },
      { text: row.leadText, sub: "" },
    ],
  };
}

function tableOf(read: ClockRead): SafeHtml {
  return gnssLineTable({
    caption: "The same instant on every clock",
    columns: TABLE_COLUMNS,
    rows: (read.status === "ok" ? read.rows : emptyRead().rows).map(tableRow),
  });
}

function linkItem(text: string, href: string | null): ToolLinkItem {
  return href === null ? { text } : { text, href };
}

function linksOf(read: ClockRead): SafeHtml {
  const handoffs = clockHandoffs(read);
  return toolLinks({
    label: "Other tools",
    links: [
      linkItem(CLOCK_LINKS[0].text, handoffHref(handoffs.weeks)),
      linkItem(CLOCK_LINKS[1].text, handoffHref(handoffs.timeline)),
    ],
  });
}

function reasonOf(read: ClockRead): SafeHtml {
  if (read.status !== "sentinel") return html``;
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
 * args it shows the first preset. The plates, ladder, rows and outputs are drawn
 * by `mount`, because they come from the real library calls.
 */
export function renderSatelliteClockConverterTemplate(
  idPrefix: string,
  args: SatelliteClockConverterArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: ClockState = isSeeded(args)
    ? readArgs(args)
    : presetState(DEFAULT_PRESET);
  const blank = emptyRead();

  const pick = section(
    { id: id("pick"), heading: "1. Say what a clock reads", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...CLOCK_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`<div class="${styles.wide}">${field({
        id: id("value"),
        label: "A time on any clock",
        hint: hint(
          id("value-hint"),
          "A UTC instant such as 2024-01-01T00:00:00Z, or a reading followed by a space and TAI, GPS, GAL, BDT, QZS, GLO or IRN.",
        ),
        control: ({ id: cid, describedBy }) =>
          textInput({
            id: cid,
            value: state.value,
            autocomplete: "off",
            spellcheck: false,
            maxLength: MAX_VALUE_LENGTH,
            ...(describedBy === undefined ? {} : { describedBy }),
          }),
      })}</div
      ><div class="${styles.wide}">${range({
        id: id("moment-slider"),
        label: "Step through the leap seconds",
        min: 0,
        max: 0,
        step: 1,
        value: 0,
        valueText: INTEGER_UTC_FROM,
        ends: [INTEGER_UTC_FROM.slice(0, 10), NBSP],
      })}</div>`,
    )}</div>`,
  );

  const read = section(
    { id: id("read"), heading: "2. How far each clock is from UTC", level: 4 },
    html`${grow(
      html`<div class="${styles.frame}" data-gate="frame">
        <div class="${styles.board}">
          <div class="${styles.platesSlot}" id="${id("plates")}">${plates(plateList(null))}</div>
          <div class="${styles.ladderSlot}" id="${id("ladder")}">${ladderOf(blank, { span: 0, reserve: 0, ties: {} })}</div>
          <div class="${styles.legendSlot}">${clockLegend()}</div>
        </div>
      </div>`,
    )}
      <p role="status" aria-label="Reading summary" id="${id("summary")}">${srOnly("")}</p>
      ${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  const every = section(
    {
      id: id("every"),
      heading: "3. The same instant on every clock",
      level: 4,
    },
    html`${grow(html`<div id="${id("table")}">${tableOf(blank)}</div>`)}
      ${grow(html`<p class="${styles.note} ${styles.held}"
        ><span id="${id("footnote")}">${NBSP}</span
        ><span class="${styles.ghost}" aria-hidden="true">${BEFORE_1972_NOTE}</span></p>`)}
      <p class="${styles.note}">${GLO_NOTE}</p>
      <p class="${styles.note}">${IRN_NOTE}</p>`,
  );

  const calls = section(
    { id: id("calls"), heading: "4. What the library returns", level: 4 },
    html`${grow(
      html`<div id="${id("calls-slot")}">${codeFrame({
        label: "Calls made",
        copyLabel: "Copy calls",
        copyText: "",
        gate: "codeframe",
        minLines: MAX_CALLS,
      })}</div>`,
    )}${grow(
      html`<div id="${id("output-slot")}">${callOutput({
        label: "What the calls returned",
        state: "empty",
        lines: [],
        minLines: MAX_CALLS,
      })}</div>`,
    )}${grow(html`<div id="${id("links")}">${linksOf(blank)}</div>`)}`,
  );

  return widget(
    {
      name: WIDGET_NAME,
      label: "Satellite Clock Converter",
      scope: idPrefix,
    },
    html`${pick}${read}${every}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): ClockState;
  apply(state: ClockState): void;
  render(): void;
  syncPreset(): void;
}

function setupWidget(
  root: HTMLElement,
  lib: GnssLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const sliderEl = widgetEl.querySelector<GmtRange>("gmt-range")!;
  const valueEl = el<HTMLInputElement>("value");

  const positions = sliderPositions(lib);
  // How long the ladder gets, which clocks climb it and how many it leaves off the scale,
  // from the library at every stop of the slider.
  const ctx: LadderContext = {
    span: ladderSpan(lib, positions),
    reserve: offReserve(lib, positions),
    ties: clockTies(lib, positions),
  };
  // The bounds are set on the live range, in this order: max, ends, then the value.
  sliderEl.min = 0;
  sliderEl.max = Math.max(0, positions.length - 1);
  sliderEl.ends = [
    INTEGER_UTC_FROM.slice(0, 10),
    (positions.at(-1) ?? "").slice(0, 10),
  ];
  sliderEl.formatValue = (n) => positions[n] ?? "";

  function readState(): ClockState {
    return { value: valueEl.value };
  }

  /** The slider follows a typed value only when that value is one of its stops. */
  function followValue(): void {
    const index = positions.indexOf(valueEl.value.trim());
    if (index >= 0) sliderEl.value = index;
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function apply(state: ClockState): void {
    valueEl.value = state.value;
    followValue();
  }

  function render(): void {
    const read = readClocks(lib, readState());
    setHtml(el("plates"), plates(plateList(read)));
    setHtml(el("ladder"), ladderOf(read, ctx));
    setHtml(el("table"), tableOf(read));
    el("footnote").textContent = read.footnote === "" ? NBSP : read.footnote;

    const { code, plain } = callLines(read.calls);
    setHtml(
      el("calls-slot"),
      codeFrame({
        label: "Calls made",
        copyLabel: "Copy calls",
        copyText: plain,
        code,
        gate: "codeframe",
        minLines: MAX_CALLS,
      }),
    );
    const out = outputOf(read.status, read.calls);
    setHtml(
      el("output-slot"),
      callOutput({
        label: "What the calls returned",
        state: out.state,
        lines: out.lines,
        minLines: MAX_CALLS,
      }),
    );

    setHtml(el("summary"), srOnly(summaryText(read)));
    setHtml(el("links"), linksOf(read));
    setHtml(el("reason"), reasonOf(read));
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === valueEl) {
        followValue();
        syncPreset();
        render();
        return;
      }
      if (target === sliderEl) {
        valueEl.value = positions[sliderEl.value] ?? "";
        syncPreset();
        render();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      if (e.target !== presetEl) return;
      const chosen = CLOCK_PRESETS.find((p) => p.id === presetEl.value);
      if (!chosen) return;
      apply(presetState(chosen));
      syncPreset();
      render();
    },
    { signal },
  );

  // The slider opens on the latest stop unless the value is one of its stops.
  sliderEl.value = Math.max(0, positions.length - 1);
  followValue();
  syncPreset();
  render();

  return { readState, apply, render, syncPreset };
}

export const mountSatelliteClockConverter: MountFn<
  SatelliteClockConverterArgs
> = async (root, args, signal) => {
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
