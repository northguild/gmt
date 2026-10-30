/**
 * The GNSS Rollover Checker, mountable on its tool page and in the chat rail.
 *
 * A week counter wraps, and a receiver whose firmware fixes the era (or counts
 * from a build date) starts reporting a date one counter period early once the
 * real clock passes the end of its window. Out come the date the receiver
 * reports, the date it goes wrong from, the time left, and the next wrap of
 * every counter:
 *
 * 1. the controls (the counter, how the firmware counts, today or a date);
 * 2. the countdown, the verdict and two plates beside a fuse timeline with the
 *    check date, the wraps and the date it goes wrong marked on it;
 * 3. the table of every counter's next wrap, always eight rows;
 * 4. the calls made and what they returned.
 *
 * The mount never computes a time. Every instant and duration comes from
 * `readRollover` (gnss-rollover-checker.ts), which calls the library; the fuse
 * timeline only places what those calls returned. The one clock the mount reads
 * is the reader's own, once a second and only in Today mode, after mount.
 *
 * Built on the component kit: `renderGnssRolloverCheckerTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those
 * ids and reads and writes element `value` properties. Every listener is delegated on the
 * widget with the mount's `signal`. The one drag handle is a native range, and the date
 * field is its typed equivalent.
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
  section,
  select,
  setHtml,
  srOnly,
  textInput,
  toolLinks,
  widget,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { callLines, outputOf } from "~/widgets/families/gnss/call-lines";
import {
  fuseBoard,
  fuseChips,
  fuseKey,
} from "~/widgets/families/gnss/fuse-board";
import {
  countdown,
  verdictBadge,
  type Verdict,
} from "~/widgets/families/gnss/fuse-status";
import {
  gnssLineTable,
  type LineRow,
} from "~/widgets/families/gnss/gnss-line-table";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/gnss-rollover-checker.module.css";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { loadGnssLib, type GnssLib } from "./gnss-lib";
import { GNSS_WEEK_COUNTERS, type GnssWeekCounter } from "./gnss-names";
import {
  CUSTOM_PRESET_ID,
  DEFAULT_PRESET,
  FIRMWARE_MODELS,
  FIRMWARE_MODEL_LABELS,
  MAX_VALUE_LENGTH,
  NOW_MODE_LABELS,
  NO_RESULT_TEXT,
  ROLLOVER_LINKS,
  ROLLOVER_NOW_MODES,
  ROLLOVER_PRESETS,
  dateOfDay,
  dayOfDate,
  fuseYears,
  isSeeded,
  markSentence,
  matchPreset,
  permalinkOf,
  platesOf,
  presetState,
  readArgs,
  readRollover,
  rolloverHandoffs,
  stripAria,
  summaryText,
  verdictBadgeText,
  windowDays,
  type FirmwareModel,
  type GnssRolloverCheckerArgs,
  type RolloverRead,
  type RolloverState,
  type WrapRow,
} from "./gnss-rollover-checker";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { handoffHref } from "./widget-permalink";

export type { GnssRolloverCheckerArgs } from "./gnss-rollover-checker";

const NBSP = "\u00a0";

/**
 * The most calls one reading makes: three for each counter's next wrap, then the true reading,
 * the firmware's reading, three window ends, two judgements, the countdown, and the rolling
 * receiver with its two judgements. The code and its results hold this many lines.
 */
const MAX_CALLS = GNSS_WEEK_COUNTERS.length * 3 + 11;
const WIDGET_NAME = "gnss-rollover-checker";

const TABLE_COLUMNS = ["Counter", "Width", "Next wrap", "Time left"];

/** The widest instants a plate shows, so the plates keep their width from one reading to the next. */
const SAMPLE_INSTANT = "8888-88-88T88:88:88Z";
const PLATE_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  "hero-reports": [SAMPLE_INSTANT],
  "hero-wrong-from": [SAMPLE_INSTANT],
};

/** Every line the countdown's sub line can show, so its box keeps the longest. */
const COUNTDOWN_LINES = [
  "until it reports an early date",
  "since it began reporting an early date",
];

const WINDOW_NOTE =
  "Time left is counted in whole days from the check date to each counter's next wrap.";

const MODEL_ITEMS = FIRMWARE_MODELS.map((value) => ({
  value,
  label: FIRMWARE_MODEL_LABELS[value],
}));
const NOW_ITEMS = ROLLOVER_NOW_MODES.map((value) => ({
  value,
  label: NOW_MODE_LABELS[value],
}));

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

function plateList(read: RolloverRead | null): Plate[] {
  const specs = (read?.plates ?? platesOf(null)).slice(0, 2);
  return specs.map((s) => {
    const samples = PLATE_SAMPLES[s.role];
    return {
      caption: s.caption,
      value: s.value,
      lines: s.lines,
      ...(s.series === undefined ? {} : { series: s.series }),
      ...(s.quiet === true ? { quiet: true } : {}),
      ...(samples === undefined ? {} : { samples }),
    };
  });
}

function badgeOf(read: RolloverRead | null): SafeHtml {
  const words = read === null ? "" : verdictBadgeText(read);
  const verdict: Verdict = words === "" ? "none" : (read?.verdict ?? "none");
  const text =
    words !== "" ? words : read?.status === "sentinel" ? NO_RESULT_TEXT : "";
  return verdictBadge({ verdict, text });
}

function countdownOf(read: RolloverRead | null): SafeHtml {
  const ok = read !== null && read.status === "ok";
  return countdown({
    parts: ok ? read.countdown : null,
    words: ok ? (read.left ?? "") : "",
    line: ok ? (read.plates[2]?.lines[0] ?? "") : "",
    none: NO_RESULT_TEXT,
    lineSamples: COUNTDOWN_LINES,
  });
}

function asideOf(read: RolloverRead | null): SafeHtml {
  return html`${countdownOf(read)}${badgeOf(read)}${plates(plateList(read))}`;
}

function boardOf(read: RolloverRead | null): SafeHtml {
  const strip = read?.strip ?? null;
  return fuseBoard(
    {
      label: read === null ? "No window to draw" : stripAria(read),
      years: fuseYears(),
      fuse: read?.fuse ?? null,
      strip,
      counter: read?.state.counter ?? "",
      gate: "drawn",
    },
    strip === null ? [] : strip.marks.map(markSentence),
  );
}

function tableRow(row: WrapRow): LineRow {
  const tags = [
    ...(row.yours ? ["your receiver"] : []),
    ...(row.soonest ? ["next to wrap"] : []),
  ];
  return {
    name: { text: row.counter, sub: tags.join(" · ") },
    yours: row.yours,
    cells: [
      { text: row.none ? "" : row.width, sub: "" },
      { text: row.none ? NO_RESULT_TEXT : row.nextWrap, sub: "" },
      { text: row.none ? "" : row.left, sub: "" },
    ],
  };
}

function blankRow(counter: GnssWeekCounter): LineRow {
  return {
    name: { text: counter, sub: "" },
    yours: false,
    cells: [
      { text: "", sub: "" },
      { text: "", sub: "" },
      { text: "", sub: "" },
    ],
  };
}

function tableOf(read: RolloverRead | null): SafeHtml {
  return gnssLineTable({
    caption: "When each counter next wraps",
    columns: TABLE_COLUMNS,
    rows:
      read === null || read.at === null
        ? GNSS_WEEK_COUNTERS.map(blankRow)
        : read.rows.map(tableRow),
  });
}

function linksOf(read: RolloverRead | null): SafeHtml {
  const href = read === null ? null : handoffHref(rolloverHandoffs(read).eras);
  const text = ROLLOVER_LINKS[0].text;
  return toolLinks({
    label: "Other tools",
    links: [href === null ? { text } : { text, href }],
  });
}

function reasonOf(read: RolloverRead | null): SafeHtml {
  if (read?.status === "sentinel") {
    return aside(
      {
        label: "Why there is no result",
        tone: "caution",
        title: NO_RESULT_TITLE,
      },
      html`<p>${read.failure ?? ""}</p>`,
    );
  }
  if (read?.status === "empty") {
    return html`<p class="${styles.note}">${read.emptyText ?? ""}</p>`;
  }
  return html``;
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The plates, fuse timeline, rows and outputs are drawn
 * by `mount`, because they come from the real library calls.
 */
export function renderGnssRolloverCheckerTemplate(
  idPrefix: string,
  args: GnssRolloverCheckerArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: RolloverState = isSeeded(args)
    ? readArgs(args)
    : presetState(DEFAULT_PRESET);
  const date = state.nowMode === "date";
  // The fields the state shows, as `showFields` will decide: the server-rendered form
  // hides the rest, so mounting hides nothing and the form keeps its height.
  const hid = (shown: boolean): SafeHtml => (shown ? html`` : html`hidden`);

  const pick = section(
    { id: id("pick"), heading: "1. Describe the receiver", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(state),
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...ROLLOVER_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${fieldGrid(
      html`<div class="${styles.wide}">${field({
        id: id("counter"),
        label: "Counter",
        control: ({ id: cid, describedBy }) =>
          select({
            id: cid,
            value: state.counter,
            options: GNSS_WEEK_COUNTERS.map((c) => ({ value: c, label: c })),
            describedBy,
          }),
      })}</div
      ><div class="${styles.wide}" id="${id("model-slot")}">${chips({
        legend: "How the firmware counts",
        kind: "radio",
        name: id("model"),
        items: MODEL_ITEMS.map((i) => ({
          ...i,
          checked: i.value === state.model,
        })),
      })}</div
      ><div class="${styles.wide}" id="${id("pivot-field")}" ${hid(state.model === "pivot")}>${field(
        {
          id: id("pivot"),
          label: "Built on or after (UTC instant)",
          control: ({ id: cid, describedBy }) =>
            textInput({
              id: cid,
              value: state.pivot,
              autocomplete: "off",
              spellcheck: false,
              maxLength: MAX_VALUE_LENGTH,
              ...(describedBy === undefined ? {} : { describedBy }),
            }),
        },
      )}</div
      ><div class="${styles.wide}" id="${id("era-field")}" ${hid(state.model === "era")}>${field(
        {
          id: id("era"),
          label: "Era the firmware assumes",
          control: ({ id: cid, describedBy }) =>
            textInput({
              id: cid,
              value: state.era,
              autocomplete: "off",
              spellcheck: false,
              maxLength: MAX_VALUE_LENGTH,
              inputMode: "numeric",
              ...(describedBy === undefined ? {} : { describedBy }),
            }),
        },
      )}</div
      ><div class="${styles.wide}" id="${id("now-slot")}">${chips({
        legend: "Check it on",
        kind: "radio",
        name: id("now"),
        items: NOW_ITEMS.map((i) => ({
          ...i,
          checked: i.value === state.nowMode,
        })),
      })}</div
      ><div class="${styles.wide}" id="${id("date-field")}" ${hid(date)}>${field(
        {
          id: id("date"),
          label: "Date to check (UTC instant)",
          control: ({ id: cid, describedBy }) =>
            textInput({
              id: cid,
              value: state.date,
              autocomplete: "off",
              spellcheck: false,
              maxLength: MAX_VALUE_LENGTH,
              ...(describedBy === undefined ? {} : { describedBy }),
            }),
        },
      )}</div
      ><div class="${styles.wide}" id="${id("slider-field")}" ${hid(date)}>${range(
        {
          id: id("date-slider"),
          label: "Slide the date through the firmware's window",
          min: 0,
          max: 0,
          step: 1,
          value: 0,
          valueText: "2026-10-15T00:00:00Z",
          ends: [NBSP, NBSP],
        },
      )}</div>`,
    )}</div>`,
  );

  const read = section(
    {
      id: id("read"),
      heading: "2. Where the firmware goes wrong",
      level: 4,
    },
    html`<div class="${styles.frame}" data-gate="frame">
        <div class="${styles.layout}">
          <div class="${styles.aside}" id="${id("aside")}">${asideOf(null)}</div>
          <div class="${styles.drawing}" id="${id("board")}">${boardOf(null)}</div>
          <div class="${styles.keySlot}" id="${id("key")}">${fuseKey({ window: false })}</div>
          <div class="${styles.chipsSlot}" id="${id("chips")}">${fuseChips([])}</div>
        </div>
      </div>
      <p role="status" aria-live="polite" aria-label="Reading summary" id="${id("summary")}">${srOnly("")}</p>
      ${grow(html`<p class="${styles.note}" id="${id("era-zero")}">${NBSP}</p>`)}
      ${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  const every = section(
    {
      id: id("every"),
      heading: "3. When each counter next wraps",
      level: 4,
    },
    html`<div id="${id("table")}">${tableOf(null)}</div>
      ${grow(html`<p class="${styles.note}" id="${id("rolling")}">${NBSP}</p>`)}
      <p class="${styles.note}">${WINDOW_NOTE}</p>`,
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
    )}<div id="${id("links")}">${linksOf(null)}</div>`,
  );

  return widget(
    {
      name: WIDGET_NAME,
      label: "GNSS Rollover Checker",
      scope: idPrefix,
    },
    html`${pick}${read}${every}${calls}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): RolloverState;
  apply(state: RolloverState): void;
  render(): void;
  syncPreset(): void;
  release(): void;
}

/** The reader's clock as a UTC instant to the second. */
const nowIso = (): string =>
  Temporal.Now.instant().toString({ smallestUnit: "second" });

function setupWidget(
  root: HTMLElement,
  lib: GnssLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const modelEl = el("model-slot").querySelector<GmtChips>("gmt-chips")!;
  const nowEl = el("now-slot").querySelector<GmtChips>("gmt-chips")!;
  const sliderEl = widgetEl.querySelector<GmtRange>("gmt-range")!;
  const counterEl = el<HTMLSelectElement>("counter");
  const pivotEl = el<HTMLInputElement>("pivot");
  const eraEl = el<HTMLInputElement>("era");
  const dateEl = el<HTMLInputElement>("date");

  let last: RolloverRead | null = null;
  let lastNow = "";
  let spoken = "";
  let ticker: ReturnType<typeof setInterval> | null = null;

  const model = (): FirmwareModel =>
    (modelEl.value as string) === "era" ? "era" : "pivot";
  const nowMode = (): RolloverState["nowMode"] =>
    (nowEl.value as string) === "date" ? "date" : "today";

  function readState(): RolloverState {
    return {
      counter: counterEl.value as GnssWeekCounter,
      model: model(),
      pivot: pivotEl.value,
      era: eraEl.value,
      nowMode: nowMode(),
      date: dateEl.value,
    };
  }

  function showFields(): void {
    const date = nowMode() === "date";
    el("pivot-field").hidden = model() !== "pivot";
    el("era-field").hidden = model() !== "era";
    el("date-field").hidden = !date;
    el("slider-field").hidden = !date;
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  /** The clock runs only in Today mode; in a date mode nothing ticks. */
  function syncTicker(): void {
    const today = nowMode() === "today";
    if (today && ticker === null && !signal.aborted) {
      ticker = setInterval(() => {
        if (nowIso() !== lastNow) render();
      }, 1000);
    } else if (!today && ticker !== null) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  function apply(state: RolloverState): void {
    modelEl.value = state.model;
    nowEl.value = state.nowMode;
    counterEl.value = state.counter;
    pivotEl.value = state.pivot;
    eraEl.value = state.era;
    dateEl.value = state.date;
    showFields();
    syncTicker();
  }

  /** The slider spans the firmware's window by day, and is live only when a
   *  date is being checked. It follows the date only when it is a whole-day stop. */
  function drawSlider(read: RolloverRead): void {
    const days = windowDays(lib, read);
    const usable = nowMode() === "date" && days !== null && days > 0;
    sliderEl.disabled = !usable;
    sliderEl.max = days ?? 0;
    sliderEl.ends = [
      read.strip?.start.slice(0, 10) ?? NBSP,
      read.strip?.end.slice(0, 10) ?? NBSP,
    ];
    const day = dayOfDate(lib, read, dateEl.value);
    if (day !== null && days !== null && day <= days) sliderEl.value = day;
    sliderEl.formatValue = () =>
      dateEl.value.trim() || (read.strip?.start ?? "");
  }

  function render(): void {
    showFields();
    const state = readState();
    lastNow = nowIso();
    const read = readRollover(lib, state, lastNow);
    last = read;

    setHtml(el("aside"), asideOf(read));
    setHtml(el("board"), boardOf(read));
    setHtml(el("key"), fuseKey({ window: read.strip !== null }));
    setHtml(el("chips"), fuseChips(read.strip?.marks ?? []));
    setHtml(el("table"), tableOf(read));
    el("rolling").textContent = read.rolling === "" ? NBSP : read.rolling;
    el("era-zero").textContent =
      read.eraZeroHint === "" ? NBSP : read.eraZeroHint;
    drawSlider(read);

    const calls = [...read.calls.reading, ...read.calls.counters];
    const { code, plain } = callLines(calls);
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
    const out = outputOf(read.status, calls);
    setHtml(
      el("output-slot"),
      callOutput({
        label: "What the calls returned",
        state: out.state,
        lines: out.lines,
        minLines: MAX_CALLS,
      }),
    );

    // Today mode ticks every second: the live region holds only what stays true between
    // ticks, and is written only when that sentence changes, so a screen reader is not
    // read the clock once a second.
    const sentence =
      read.status === "ok" && read.reported !== null && nowMode() === "today"
        ? `Today, a ${read.state.counter} receiver reports ${read.verdictText}. It goes wrong from ${read.wrongFrom}.`
        : summaryText(read);
    if (sentence !== spoken) {
      spoken = sentence;
      setHtml(el("summary"), srOnly(sentence));
    }
    setHtml(el("links"), linksOf(read));
    setHtml(el("reason"), reasonOf(read));
  }

  let shownNow = nowMode();

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === sliderEl) {
        if (last !== null) {
          const date = dateOfDay(lib, last, sliderEl.value);
          if (date !== "") dateEl.value = date;
        }
        syncPreset();
        render();
        return;
      }
      if (target === pivotEl || target === eraEl || target === dateEl) {
        syncPreset();
        render();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === presetEl) {
        const chosen = ROLLOVER_PRESETS.find((p) => p.id === presetEl.value);
        if (!chosen) return;
        apply(presetState(chosen));
        shownNow = nowMode();
        syncPreset();
        render();
        return;
      }
      if (target === modelEl || target === nowEl) {
        // Switching to a date carries the moment being watched into the field.
        if (
          shownNow === "today" &&
          nowMode() === "date" &&
          last?.at != null &&
          last.state.nowMode === "today"
        ) {
          dateEl.value = last.at;
        }
        shownNow = nowMode();
        showFields();
        syncTicker();
        syncPreset();
        render();
        return;
      }
      if (target === counterEl) {
        syncPreset();
        render();
      }
    },
    { signal },
  );

  const release = (): void => {
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
  };
  signal.addEventListener("abort", release, { once: true });

  // The slider's bounds are set on the live range; the first draw sets them again.
  sliderEl.min = 0;
  showFields();
  syncTicker();
  syncPreset();
  render();

  return { readState, apply, render, syncPreset, release };
}

export const mountGnssRolloverChecker: MountFn<
  GnssRolloverCheckerArgs
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
    () => controller.release(),
    () => permalinkOf(controller.readState()),
  );
};
