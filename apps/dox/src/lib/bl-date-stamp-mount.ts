/**
 * The B/L Date Stamp widget (INT-14), mountable on its tool page and in the
 * chat rail.
 *
 * One moment has a different calendar date in each place, and a bill of lading
 * carries the local one. The reader types a moment, chooses the event and the
 * place, and the widget calls `bolTimestamp` for the place, for UTC (the naive
 * read) and for up to three other calendars. It draws the five dates as lanes of
 * local days on one time axis, with one gate line at the moment, and a native
 * range moves the moment in 15-minute steps across a 72-hour window.
 *
 * The window is set when a preset, a typed value or a zone settles, and never
 * while the slider moves, so the day columns do not slide under the pointer.
 * The slider writes the moment back in the form it was typed.
 *
 * Built on the component kit: `renderBlDateStampTemplate` writes the markup from
 * builders only, with ids from `idScope(idPrefix)`. `mount` finds its parts by
 * those ids, reads and writes element `value` properties, and listens once on
 * the widget with the mount's `signal`, so the host dropping the subtree is a
 * complete teardown apart from the width observer. Every printed call and result
 * is the real one; the drawing only places them.
 */
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
  select,
  setHtml,
  srOnly,
  textInput,
  widget,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import { defineElements } from "~/widgets/define";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { callLines, outputOf } from "~/widgets/families/gnss/call-lines";
import { dateInput } from "~/widgets/families/ledger/date-input";
import { blPlot } from "~/widgets/families/ledger/bl-plot";
import { dayColumns } from "~/widgets/families/ledger/day-columns";
import {
  axisTicks,
  ledgerAxis,
  ledgerFrame,
  ledgerLegend,
} from "~/widgets/families/ledger/ledger-lane";
import { grow } from "~/widgets/primitives/grow/grow";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import { range, type GmtRange } from "~/widgets/primitives/range/range";
import styles from "~/widgets/tools/bl-date-stamp.module.css";
import {
  BL_DATE_PRESETS,
  CUSTOM_PRESET_ID,
  EVENT_OPTIONS,
  LANE_COUNT,
  SLIDER_MAX,
  blNullText,
  blPlates,
  blankPlates,
  isSeeded,
  laneAria,
  laneView,
  matchPreset,
  momentMs,
  momentText,
  permalinkOf,
  presetState,
  readArgs,
  readBlDate,
  sliderMoment,
  sliderPosition,
  sliderReadable,
  summaryText,
  utcClock,
  windowFor,
  type BlDateState,
  type BlDateStampArgs,
} from "./bl-date-stamp";
import { axisLabels, type LedgerCanvas } from "./dwell-ledger";
import { NO_RESULT_TITLE } from "./edi-widgets";
import { onWidthChange, thinTickLabels } from "./label-fit";
import { loadBlDateLib } from "./ledger-lib";
import type { BlDateLib } from "./ledger-lib";
import { zoneWithOffsets } from "./ledger-widgets";
import { settledAnnouncer, writeLike } from "./punctuality-widgets";
import type { PlateSpec } from "./ledger-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { BlDateStampArgs } from "./bl-date-stamp";

const WIDGET_NAME = "bl-date-stamp";

/** The gate's chip sits to the left of the gate past this share of the track. */
const CHIP_FLIP_PERCENT = 55;

/** The most the Moment field takes, as the library reads. */
const MOMENT_MAX = 64;

/** The widest date each plate shows, so it keeps its width from one reading to the next. */
const PLATE_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  "hero-bl": ["Wed 30 Sep 2026"],
  "hero-utc": ["Wed 30 Sep 2026"],
};

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

/**
 * The event select's choices. A selected value the list lacks (a seed the form
 * does not offer) is added as its own choice, so it reaches the library as
 * given and is never silently replaced by one of the three.
 */
function eventChoices(selected: string): { value: string; label: string }[] {
  const known = EVENT_OPTIONS.some((o) => o.value === selected);
  return known
    ? [...EVENT_OPTIONS]
    : [
        ...EVENT_OPTIONS,
        { value: selected, label: selected === "" ? "not chosen" : selected },
      ];
}

/** The zone select's choices: no zone, the list, and a seed the list lacks. */
function zoneChoices(selected: string): { value: string; label: string }[] {
  const list =
    selected === "" || zoneWithOffsets.includes(selected)
      ? zoneWithOffsets
      : [...zoneWithOffsets, selected];
  return [
    { value: "", label: "No zone" },
    ...list.map((z) => ({ value: z, label: z })),
  ];
}

const CALL_LABEL = "Call to bolTimestamp";
const OUT_LABEL = "What bolTimestamp returned";

const PLACE_HINT =
  "Every bill of lading date is the local one, so the place is required. The other calendars show the same moment's date elsewhere. The latest date is yours: the tool only compares against it.";

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no
 * args it shows the first preset. The lanes, the plates and the outputs are
 * drawn by `mount`, because they come from the real library calls.
 */
export function renderBlDateStampTemplate(
  idPrefix: string,
  args: BlDateStampArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const state: BlDateState = isSeeded(args)
    ? readArgs(args)
    : presetState(BL_DATE_PRESETS[0]!);
  const presetId = matchPreset(state);

  const box = (wide: boolean, children: SafeHtml): SafeHtml =>
    html`<div class="${styles.box}" ${wide ? html`data-wide` : ""}>${children}</div>`;

  const calendarField = (n: 2 | 3 | 4): SafeHtml => {
    const key = `zone${n}` as const;
    return box(
      false,
      field({
        id: id(`zone-${n}`),
        label: `Calendar ${n} (optional)`,
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state[key],
            options: zoneChoices(state[key]),
          }),
      }),
    );
  };

  const controls = fieldGrid(
    html`${box(
      true,
      field({
        id: id("value"),
        label: "Moment",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.value,
            autocomplete: "off",
            spellcheck: false,
            maxLength: MOMENT_MAX,
          }),
      }),
    )}${box(
      false,
      field({
        id: id("event"),
        label: "Event",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.event,
            options: eventChoices(state.event),
          }),
      }),
    )}${box(
      false,
      field({
        id: id("zone"),
        label: "Place of the event",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.timeZone,
            options: zoneChoices(state.timeZone),
          }),
      }),
    )}${calendarField(2)}${calendarField(3)}${calendarField(4)}${box(
      false,
      field({
        id: id("latest"),
        label: "Latest date allowed (optional)",
        control: ({ id: cid }) => dateInput({ id: cid, value: state.latest }),
      }),
    )}`,
  );

  const setting = section(
    { id: id("set"), heading: "1. Set the moment and the place", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...BL_DATE_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${controls}${hint(id("place-hint"), PLACE_HINT).html}</div>`,
  );

  const drawn = section(
    { id: id("drawn"), heading: "2. The date in each place", level: 4 },
    html`${ledgerFrame(
      html`<div class="${styles.drawing}"
        ><div id="${id("plates")}">${plates(plateList(blankPlates(state.event)), { gate: "hero" })}</div
        >${blPlot({ id, lanes: LANE_COUNT })}${ledgerAxis(id("axis"), ["", "", ""])}${ledgerLegend(
          [
            { text: "the day with the date", swatch: "lit" },
            { text: "UTC, read naively", swatch: "plain" },
            { text: "the moment", swatch: "event" },
          ],
        )}</div
      >`,
      { gate: "frame" },
    )}<div class="${styles.slider}">${range({
      id: id("slider"),
      label: "Move the moment",
      min: 0,
      max: SLIDER_MAX,
      step: 1,
      value: Math.floor(SLIDER_MAX / 2),
      valueText: "no moment",
      ends: ["36 h earlier", "36 h later"],
      disabled: true,
    })}</div><p class="${styles.summary}" role="status" aria-label="Reading summary" id="${id("summary")}">${srOnly("")}</p>${grow(
      html`<div id="${id("reason")}"></div>`,
    )}`,
  );

  const returns = section(
    {
      id: id("returns"),
      heading: "3. What bolTimestamp returns",
      level: 4,
    },
    html`${grow(
      html`<div id="${id("call")}">${codeFrame({
        label: CALL_LABEL,
        copyLabel: "Copy bolTimestamp call",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}${grow(
      html`<div id="${id("out")}">${callOutput({
        label: OUT_LABEL,
        state: "empty",
        lines: [],
      })}</div>`,
    )}`,
  );

  return widget(
    { name: WIDGET_NAME, label: "B/L Date Stamp", scope: idPrefix },
    html`${setting}${drawn}${returns}`,
  );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  readState(): BlDateState;
  apply(state: BlDateState): void;
  render(recomputeWindow: boolean, settled?: boolean): void;
  syncPreset(): void;
  release(): void;
}

/** Set a select, adding a value the list lacks as its own choice. */
function setChoice(el: HTMLSelectElement, value: string): void {
  if (value !== "" && ![...el.options].some((o) => o.value === value)) {
    el.append(new Option(value, value));
  }
  el.value = value;
}

function setupWidget(
  root: HTMLElement,
  lib: BlDateLib,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);
  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const valueEl = el<HTMLInputElement>("value");
  const eventEl = el<HTMLSelectElement>("event");
  const zoneEl = el<HTMLSelectElement>("zone");
  const calendarEls = [2, 3, 4].map((n) => el<HTMLSelectElement>(`zone-${n}`));
  const latestEl = el<HTMLInputElement>("latest");
  const sliderEl = el("slider").closest<GmtRange>("gmt-range")!;
  const summaryEl = el("summary");
  /* The announcer's region is the visually hidden span the template wrote. */
  const summarySpan = summaryEl.firstElementChild as HTMLElement | null;
  const announcer = settledAnnouncer(summarySpan);

  /** What the slider's thumb and its aria-valuetext say. */
  let sliderText = "no moment";
  sliderEl.max = SLIDER_MAX;
  sliderEl.formatValue = () => sliderText;

  /** The window the day columns and the slider share. Set by `render(true)`. */
  let win: LedgerCanvas | null = null;
  /** A seeded latest date the native date input refused. The library judges it. */
  let refusedLatest = "";

  const readState = (): BlDateState => ({
    value: valueEl.value,
    event: eventEl.value,
    timeZone: zoneEl.value,
    zone2: calendarEls[0]!.value,
    zone3: calendarEls[1]!.value,
    zone4: calendarEls[2]!.value,
    latest: refusedLatest !== "" ? refusedLatest : latestEl.value,
  });

  function syncPreset(): void {
    presetEl.value = matchPreset(readState());
  }

  function drawLanes(read: ReturnType<typeof readBlDate>, ms: number): void {
    read.lanes.forEach((lane, i) => {
      const view = laneView(lane, win, ms);
      el(`lane-${i}`).setAttribute("aria-label", laneAria(lane));
      el(`lane-label-${i}`).textContent = view.label;
      setHtml(
        el(`cells-${i}`),
        win === null ? html`` : dayColumns(view.cells, win, view.marks),
      );
      const note = el(`note-${i}`);
      note.hidden = view.note === "";
      note.textContent = view.note;
    });
  }

  function drawGate(ms: number): void {
    const gate = el("gate");
    const chip = el("gate-chip");
    if (win === null || Number.isNaN(ms)) {
      gate.hidden = true;
      return;
    }
    const pct = Math.round(win.toPercent(ms) * 100) / 100;
    gate.hidden = false;
    gate.style.setProperty("--gmt-gate-at", String(pct));
    gate.dataset["edge"] = pct > CHIP_FLIP_PERCENT ? "end" : "start";
    chip.textContent = utcClock(ms);
  }

  function drawSlider(
    state: BlDateState,
    ms: number,
    reposition: boolean,
  ): void {
    const usable = win !== null && sliderReadable(state.value);
    sliderEl.disabled = !usable;
    if (!usable || win === null) {
      sliderText = "no moment";
    } else {
      if (reposition) sliderEl.value = sliderPosition(win, ms);
      sliderText = momentText(ms);
    }
    // Write the value back so the thumb and `aria-valuetext` read the new text.
    const keep = sliderEl.value;
    sliderEl.value = keep;
  }

  /**
   * Reads the library and draws everything. The window is set only when
   * `recomputeWindow` is true (a preset, a typed value or a zone has settled);
   * a slider step, a width change and every other control keep it.
   */
  function render(recomputeWindow: boolean, settled = false): void {
    const s = readState();
    const read = readBlDate(s, lib);
    const ms = momentMs(s.value);
    if (recomputeWindow || win === null) {
      win = windowFor(ms, s.timeZone.trim());
    }

    setHtml(
      el("plates"),
      plates(plateList(blPlates(s, read)), { gate: "hero" }),
    );

    drawLanes(read, ms);
    drawGate(ms);
    drawSlider(s, ms, recomputeWindow);

    const axis = el("axis");
    setHtml(
      axis,
      axisTicks(
        win === null
          ? ["", "", ""]
          : axisLabels(win, "UTC").map((t) => (t === "" ? "" : `${t} UTC`)),
      ),
    );
    thinTickLabels(axis, "span");

    // The calls made, and what they returned.
    const lines = callLines(read.calls);
    setHtml(
      el("call"),
      codeFrame({
        label: CALL_LABEL,
        copyLabel: "Copy bolTimestamp call",
        copyText: lines.plain,
        code: lines.code,
        gate: "codeframe",
      }),
    );
    const out = read.bl === "" ? null : outputOf("ok", read.calls);
    setHtml(
      el("out"),
      callOutput({
        label: OUT_LABEL,
        state: out === null ? "sentinel" : out.state,
        lines: out === null ? [{ text: "", lost: true }] : out.lines,
      }),
    );

    // Why the B/L date is missing, in one sentence the probe decided.
    const reason = read.bl === "" ? blNullText(s, lib) : "";
    setHtml(
      el("reason"),
      reason === ""
        ? html``
        : aside(
            { label: NO_RESULT_TITLE, tone: "caution", title: NO_RESULT_TITLE },
            html`<p>${reason}</p>`,
          ),
    );

    // The hidden sentence: right away for a typed change, after the slider has
    // been still for a moment for a drag, because the slider speaks each step.
    const text = summaryText(s, read, reason);
    if (settled) announcer.say(() => text);
    else {
      announcer.cancel();
      /* Written into the same span, so the announcer's region is never detached. */
      if (summarySpan) summarySpan.textContent = text;
    }
  }

  function apply(state: BlDateState): void {
    valueEl.value = state.value;
    setChoice(eventEl, state.event);
    setChoice(zoneEl, state.timeZone);
    setChoice(calendarEls[0]!, state.zone2);
    setChoice(calendarEls[1]!, state.zone3);
    setChoice(calendarEls[2]!, state.zone4);
    latestEl.value = state.latest;
    refusedLatest =
      state.latest !== "" && latestEl.value !== state.latest
        ? state.latest
        : "";
  }

  function applyPreset(): void {
    const chosen = BL_DATE_PRESETS.find((p) => p.id === presetEl.value);
    if (!chosen) return;
    apply(presetState(chosen));
    syncPreset();
    render(true);
  }

  function moveMoment(): void {
    if (win === null) return;
    const ms = sliderMoment(win, sliderEl.value);
    const text = writeLike(valueEl.value.trim(), ms);
    if (text === "") return;
    valueEl.value = text;
    syncPreset();
    render(false, true);
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === sliderEl) {
        moveMoment();
      } else if (target === valueEl) {
        syncPreset();
        render(true);
      } else if (target === latestEl) {
        refusedLatest = "";
        syncPreset();
        render(false);
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "change",
    (e) => {
      const target = e.target;
      if (target === presetEl) {
        applyPreset();
      } else if (target === valueEl || target === zoneEl) {
        syncPreset();
        render(true);
      } else if (target === latestEl) {
        refusedLatest = "";
        syncPreset();
        render(false);
      } else if (target === eventEl || calendarEls.some((c) => c === target)) {
        syncPreset();
        render(false);
      }
    },
    { signal },
  );

  // The tick labels are thinned against the measured width, so a width change
  // (rotation, the chat rail opening) draws them again. The window is kept.
  const disposeWidth = onWidthChange(el("plot"), () => render(false));

  syncPreset();
  render(true);

  return {
    readState,
    apply,
    render,
    syncPreset,
    release: () => {
      announcer.cancel();
      disposeWidth();
    },
  };
}

export const mountBlDateStamp: MountFn<BlDateStampArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let lib: BlDateLib;
  try {
    lib = await loadBlDateLib();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const widget = setupWidget(root, lib, signal);
  if (isSeeded(args)) {
    widget.apply(readArgs(args));
    widget.syncPreset();
    widget.render(true);
  }

  return onceDestroy(
    () => widget.release(),
    () => permalinkOf(widget.readState()),
  );
};
