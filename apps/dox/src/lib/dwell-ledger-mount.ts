/**
 * The Dwell Ledger widget (TRAN-8), mountable on its tool page and in the chat rail.
 *
 * A dwell drawn on a zone's real local-day grid. The reader drags an entry and an exit
 * (or types them) and watches two numbers disagree: the elapsed bar, which is hours, and
 * the lit day columns, which are the local calendar days the half-open dwell touched.
 * Both sit in one frame under two result plates. The printed result is always the real
 * `dwellTime` call's; the shading is a picture of it, and the tests assert the two agree
 * for every preset.
 *
 * Built on the component kit: `renderDwellLedgerTemplate` writes the markup from builders
 * only, with ids from `idScope(idPrefix)`, and `mount` finds its parts by those ids and
 * reads and writes element `value` properties. The entry and exit are two `<gmt-handle>`s
 * that bound each other, and each is tied two ways to its typed field: the field is the
 * state. Every listener is delegated on the widget with the mount's `signal`, so the host
 * dropping the subtree is a complete teardown.
 */
import { defineElements } from "~/widgets/define";
import {
  aside,
  card,
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
  widget,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import {
  dwellAxis,
  dwellLane,
  dwellTimeline,
  laneIds,
  type LaneName,
} from "~/widgets/families/dwell/dwell-lane";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { dayColumns } from "~/widgets/families/ledger/day-columns";
import { grow } from "~/widgets/primitives/grow/grow";
import {
  handle,
  handleTrack,
  type GmtHandle,
} from "~/widgets/primitives/handle/handle";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import {
  CUSTOM_PRESET_ID,
  DWELL_PRESETS,
  LEDGER_ZONES,
  NO_ZONE,
  NULL_REASON_TEXT,
  axisLabels,
  createLedgerCanvas,
  dayCells,
  dayCountText,
  dwellMarks,
  dwellPlates,
  explainNull,
  fitLedgerCanvas,
  formatDayLabel,
  formatDwell,
  formatHandleValue,
  formatLocal,
  gridZone,
  matchPreset,
  resolveWallTime,
  toEpochMs,
  type DwellLedgerArgs,
  type DwellResult,
  type LedgerCanvas,
} from "./dwell-ledger";
import { GMT_MODULES } from "./gmt-modules";
import { hourDurationText, type PlateSpec } from "./ledger-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { codeSpan } from "./widget-ui";

export type { DwellLedgerArgs } from "./dwell-ledger";

const WIDGET_NAME = "dwell-ledger";

/** PageUp and PageDown move this many snap steps: three hours on a quarter-hour canvas. */
const PAGE_STEP_UNITS = 12;

/** The widest values the plates show, so they keep their width from one dwell to the next. */
const PLATE_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  "hero-elapsed": ["99 d 23 h 45 min"],
  "hero-days": ["99"],
};

/**
 * The lines of the days plate at their widest: the zone line as it reads, and the comparison
 * line with the most days it can count. Both wrap in a narrow plate, and the day count is the
 * only part that changes while a handle drags, so the lines hold the room of the widest count.
 */
function daysLineSamples(
  lines: readonly string[],
): (readonly string[] | undefined)[] {
  return lines.map((line) =>
    line === "" ? undefined : [line.replace(/^\d+(?= in )/, "99")],
  );
}

function plateList(specs: readonly PlateSpec[]): Plate[] {
  return specs.map((s) => {
    const samples = PLATE_SAMPLES[s.role];
    return {
      caption: s.caption,
      value: s.value,
      lines: s.lines,
      ...(s.series === undefined ? {} : { series: s.series }),
      ...(samples === undefined ? {} : { samples }),
      ...(s.role === "hero-days"
        ? { lineSamples: daysLineSamples(s.lines) }
        : {}),
    };
  });
}

/** The zones a select offers: the choice that means none, the list, and a seeded zone the list lacks. */
function zoneChoices(
  selected: string,
  noneLabel: string,
): { value: string; label: string }[] {
  const list =
    selected === NO_ZONE || LEDGER_ZONES.includes(selected)
      ? LEDGER_ZONES
      : [...LEDGER_ZONES, selected];
  return [
    { value: NO_ZONE, label: noneLabel },
    ...list.map((z) => ({ value: z, label: z })),
  ];
}

const PRESET_OPTIONS = [
  { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
  ...DWELL_PRESETS.map((p) => ({
    value: p.id,
    label: p.label,
    description: p.description,
  })),
];

// ---------------------------------------------------------------------------
// Markup
// ---------------------------------------------------------------------------

/**
 * The widget's chrome, seeded with `args` so the first paint shows them. With no args it
 * shows the first preset. Day columns, the bar and the outputs are drawn by `mount`,
 * because they come from Temporal and the real library.
 */
export function renderDwellLedgerTemplate(
  idPrefix: string,
  args: DwellLedgerArgs = {},
): SafeHtml {
  const id = idScope(idPrefix);
  const seeded = args.entry !== undefined || args.exit !== undefined;
  const base = DWELL_PRESETS[0]!;
  const entry = seeded ? (args.entry ?? "") : base.entry;
  const exit = seeded ? (args.exit ?? "") : base.exit;
  const zone = seeded ? (args.zone ?? NO_ZONE) : base.zone;
  const compareZone = seeded
    ? (args.compareZone ?? NO_ZONE)
    : (base.compareZone ?? NO_ZONE);

  const handles = handleTrack(
    html`${handle({
      id: id("handle-entry"),
      label: "Entry",
      min: 0,
      max: 100,
      step: 1,
      largeStep: PAGE_STEP_UNITS,
      value: 0,
      valueText: "",
      pair: "start",
    })}${handle({
      id: id("handle-exit"),
      label: "Exit",
      min: 0,
      max: 100,
      step: 1,
      largeStep: PAGE_STEP_UNITS,
      value: 100,
      valueText: "",
      pair: "end",
    })}`,
  );

  const place = section(
    {
      id: id("place"),
      heading: "1. Place a dwell on the local-day grid",
      level: 4,
    },
    html`${preset({
      id: id("preset"),
      label: "Preset",
      value: matchPreset(entry, exit, zone, compareZone),
      options: PRESET_OPTIONS,
    })}${fieldGrid(
      html`${field({
        id: id("zone"),
        label: "Count days in",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: zone,
            options: zoneChoices(zone, "(the entry's zone)"),
          }),
      })}${field({
        id: id("compare"),
        label: "Compare with",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: compareZone,
            options: zoneChoices(compareZone, "(no comparison)"),
          }),
      })}`,
    )}${card(
      html`<div id="${id("plates")}">${plates(plateList(dwellPlates({ result: null, compare: null, zone: "", compareZone: "" }, hourDurationText)))}</div>${dwellTimeline(
        html`${dwellLane({
          id,
          name: "dwell",
          series: 1,
          gate: "drawn track",
          handles,
        })}${dwellLane({
          id,
          name: "compare",
          series: 2,
          hidden: compareZone === NO_ZONE,
          gate: "drawn",
        })}${dwellAxis(id)}`,
      )}`,
      { gate: "frame" },
    )}${fieldGrid(
      html`${field({
        id: id("entry"),
        label: "Entry",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: entry,
            autocomplete: "off",
            spellcheck: false,
          }),
      })}${field({
        id: id("exit"),
        label: "Exit",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: exit,
            autocomplete: "off",
            spellcheck: false,
          }),
      })}`,
    )}<p role="status" aria-label="Dwell summary" id="${id("summary")}">${srOnly("")}</p>${grow(html`<div id="${id("reason")}"></div>`)}`,
  );

  const returns = section(
    {
      id: id("returns"),
      heading: "2. What dwellTime returns",
      level: 4,
    },
    html`${grow(html`<div id="${id("dwell-call")}">${callFrame("Call made", "")}</div>`)}${grow(
      html`<div id="${id("dwell-output")}">${callOutput({
        label: "What dwellTime returned",
        state: "empty",
        lines: [],
      })}</div>`,
    )}<div id="${id("compare-result")}" ${compareZone === NO_ZONE ? html`hidden` : ""}>${grow(
      html`<div id="${id("compare-call")}">${callFrame("Comparison call made", "")}</div>`,
    )}${grow(
      html`<div id="${id("compare-output")}">${callOutput({
        label: "What dwellTime returned for the comparison zone",
        state: "empty",
        lines: [],
      })}</div>`,
    )}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Dwell Ledger", scope: idPrefix },
    html`${place}${returns}`,
  );
}

function callFrame(label: string, plain: string, code?: SafeHtml): SafeHtml {
  return codeFrame({
    label,
    copyLabel: "Copy call",
    copyText: plain,
    ...(code === undefined ? {} : { code }),
    gate: "codeframe",
  });
}

/** `dwellTime("entry", "exit"[, "zone"])`, highlighted and plain. */
function callOf(
  entry: string,
  exit: string,
  zone: string,
): { code: SafeHtml; plain: string } {
  const parts = [entry, exit, ...(zone === NO_ZONE ? [] : [zone])].map((p) =>
    JSON.stringify(p),
  );
  return {
    code: raw(
      `${codeSpan("fn", "dwellTime")}(${parts.map((p) => codeSpan("str", p)).join(", ")})`,
    ),
    plain: `dwellTime(${parts.join(", ")})`,
  };
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

type DwellFn = (
  entry: string,
  exit: string,
  zone?: string,
) => DwellResult | null;

interface Modules {
  dwellTime: DwellFn;
  isValidInstant: (value: string) => boolean;
  isValidTimeZone: (value: string) => boolean;
  isValidZonedDateTime: (value: string) => boolean;
}

async function loadModules(): Promise<Modules> {
  const [transport, precision, zoned] = await Promise.all([
    GMT_MODULES["transport/calculate"](),
    GMT_MODULES["precision/validate"](),
    GMT_MODULES["zoned/validate"](),
  ]);
  return {
    dwellTime: transport["dwellTime"] as DwellFn,
    isValidInstant: precision["isValidInstant"] as (v: string) => boolean,
    isValidTimeZone: zoned["isValidTimeZone"] as (v: string) => boolean,
    isValidZonedDateTime: zoned["isValidZonedDateTime"] as (
      v: string,
    ) => boolean,
  };
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

/**
 * The canvas widened to whole snap steps, so a handle's units are whole steps from the
 * canvas's start and a drag lands on the quarter-hour (or the hour) and not on an offset
 * of it. Widening by less than a step on each side changes nothing a reader can see.
 */
function aligned(canvas: LedgerCanvas): LedgerCanvas {
  const step = canvas.snapMinutes * 60_000;
  const widened = createLedgerCanvas(
    Math.floor(canvas.startMs / step) * step,
    Math.ceil(canvas.endMs / step) * step,
  );
  return widened.snapMinutes === canvas.snapMinutes ? widened : canvas;
}

function setupWidget(root: HTMLElement, m: Modules, signal: AbortSignal) {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);

  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const entryEl = el<HTMLInputElement>("entry");
  const exitEl = el<HTMLInputElement>("exit");
  const zoneEl = el<HTMLSelectElement>("zone");
  const compareEl = el<HTMLSelectElement>("compare");
  const entryHandle = el<GmtHandle>("handle-entry");
  const exitHandle = el<GmtHandle>("handle-exit");

  let canvas: LedgerCanvas = createLedgerCanvas(0, 1);
  /** What the handles read aloud: the typed times in the grid's zone. */
  const view = { grid: null as string | null, entryMs: NaN, exitMs: NaN };
  /** A pointer is down in the widget: a change then is the end of a drag. */
  let pointerActive = false;

  const snapMs = (): number => canvas.snapMinutes * 60_000;
  const unitsOf = (ms: number): number =>
    Number.isNaN(ms) ? 0 : (ms - canvas.startMs) / snapMs();
  const msOf = (units: number): number => canvas.startMs + units * snapMs();
  const maxUnits = (): number =>
    Math.max(1, Math.round((canvas.endMs - canvas.startMs) / snapMs()));

  entryHandle.formatValue = (n) =>
    Number.isNaN(view.entryMs)
      ? "not a time"
      : formatLocal(msOf(n), view.grid ?? "UTC");
  exitHandle.formatValue = (n) =>
    Number.isNaN(view.exitMs)
      ? "not a time"
      : formatLocal(msOf(n), view.grid ?? "UTC");

  const state = () => {
    const entry = entryEl.value.trim();
    const exit = exitEl.value.trim();
    const zone = zoneEl.value;
    const compareZone = compareEl.value;
    return {
      entry,
      exit,
      zone,
      compareZone,
      entryMs: toEpochMs(entry),
      exitMs: toEpochMs(exit),
      grid: gridZone(entry, zone),
    };
  };
  type State = ReturnType<typeof state>;

  function syncPreset(): void {
    const s = state();
    presetEl.value = matchPreset(s.entry, s.exit, s.zone, s.compareZone);
  }

  function refit(): void {
    const s = state();
    const zones = [
      s.grid,
      s.compareZone === NO_ZONE ? null : gridZone("", s.compareZone),
    ].filter((z): z is string => z !== null);
    const fitted = fitLedgerCanvas(s.entryMs, s.exitMs, zones);
    if (fitted) canvas = aligned(fitted);
    render();
  }

  function drawRow(
    name: LaneName,
    grid: string | null,
    label: string,
    s: State,
    series: 1 | 2,
    shade: boolean,
    invalid: boolean,
  ): void {
    const ids = laneIds(name);
    el(ids.label).textContent = label;
    const cells = grid ? dayCells(canvas, grid, s.entryMs, s.exitMs) : [];
    setHtml(
      el(ids.cells),
      dayColumns(cells, canvas, dwellMarks(cells, series, shade)),
    );
    const bar = el(ids.bar);
    if (Number.isNaN(s.entryMs) || Number.isNaN(s.exitMs)) {
      bar.hidden = true;
      return;
    }
    const from = canvas.toPercent(Math.min(s.entryMs, s.exitMs));
    const to = canvas.toPercent(Math.max(s.entryMs, s.exitMs));
    bar.hidden = false;
    bar.style.setProperty("--gmt-from", String(from));
    bar.style.setProperty("--gmt-to", String(to));
    bar.dataset["state"] = invalid ? "invalid" : "valid";
  }

  /** Put both handles on the typed times. Entry goes first to the start and exit
   *  is set before it settles, so neither is held back by the other's old place. */
  function drawHandles(s: State): void {
    view.grid = s.grid;
    view.entryMs = s.entryMs;
    view.exitMs = s.exitMs;
    for (const h of [entryHandle, exitHandle]) {
      h.setAttribute("min", "0");
      h.setAttribute("max", String(maxUnits()));
    }
    entryHandle.value = 0;
    exitHandle.value = unitsOf(s.exitMs);
    entryHandle.value = unitsOf(s.entryMs);
  }

  function render(): void {
    const s = state();
    const result = m.dwellTime(
      s.entry,
      s.exit,
      s.zone === NO_ZONE ? undefined : s.zone,
    );
    const reason =
      result === null ? explainNull(s.entry, s.exit, s.zone, m) : null;
    const invalid = reason === "inverted";

    drawRow(
      "dwell",
      s.grid,
      s.grid ?? "no zone",
      s,
      1,
      result !== null,
      invalid,
    );
    drawHandles(s);

    const labels = axisLabels(canvas, s.grid);
    el("axis-start").textContent = labels[0];
    el("axis-mid").textContent = labels[1];
    el("axis-end").textContent = labels[2];

    const call = callOf(s.entry, s.exit, s.zone);
    setHtml(el("dwell-call"), callFrame("Call made", call.plain, call.code));
    setHtml(
      el("dwell-output"),
      callOutput({
        label: "What dwellTime returned",
        state: result === null ? "sentinel" : "live",
        lines:
          result === null
            ? [{ text: "NO SIGNAL", lost: true }]
            : [{ text: formatDwell(result), lost: false }],
      }),
    );

    const compareOn = s.compareZone !== NO_ZONE;
    el("compare-row").hidden = !compareOn;
    el("compare-result").hidden = !compareOn;
    let compareResult: DwellResult | null = null;
    if (compareOn) {
      compareResult = m.dwellTime(s.entry, s.exit, s.compareZone);
      drawRow(
        "compare",
        gridZone("", s.compareZone),
        s.compareZone,
        s,
        2,
        compareResult !== null,
        invalid,
      );
      const c = callOf(s.entry, s.exit, s.compareZone);
      setHtml(
        el("compare-call"),
        callFrame("Comparison call made", c.plain, c.code),
      );
      setHtml(
        el("compare-output"),
        callOutput({
          label: "What dwellTime returned for the comparison zone",
          state: compareResult === null ? "sentinel" : "live",
          lines:
            compareResult === null
              ? [{ text: "NO SIGNAL", lost: true }]
              : [{ text: formatDwell(compareResult), lost: false }],
        }),
      );
    }

    setHtml(
      el("plates"),
      plates(
        plateList(
          dwellPlates(
            {
              result,
              compare: compareResult,
              zone: s.grid ?? "",
              compareZone: compareOn ? s.compareZone : "",
            },
            hourDurationText,
          ),
        ),
      ),
    );

    // Summary: the library's numbers, never the drawing's.
    const summary: string[] =
      result === null
        ? []
        : [
            `${result.duration} elapsed · ${dayCountText(result.calendarDays)} in ${s.grid ?? s.zone}`,
            ...(compareResult
              ? [
                  `${dayCountText(compareResult.calendarDays)} in ${s.compareZone}`,
                ]
              : []),
          ];
    setHtml(el("summary"), srOnly(summary.join(" · ")));

    // Aside: why null, or what an odd-length day means.
    const odd =
      result !== null && s.grid
        ? dayCells(canvas, s.grid, s.entryMs, s.exitMs).find(
            (c) => c.touched && c.hours !== 24,
          )
        : undefined;
    setHtml(
      el("reason"),
      reason
        ? aside(
            { label: "Why no result", tone: "caution", title: "Why null" },
            html`<p>${NULL_REASON_TEXT[reason]}</p>`,
          )
        : odd
          ? aside(
              { label: "About this day", tone: "note", title: "Note" },
              html`<p>${`${formatDayLabel(odd.date)} had ${odd.hours} hours in ${s.grid}. It still counts as one day: the count is of local dates, not of 24-hour blocks.`}</p>`,
            )
          : html``,
    );
  }

  function applyPreset(): void {
    const chosen = DWELL_PRESETS.find((p) => p.id === presetEl.value);
    if (!chosen) return;
    entryEl.value = chosen.entry;
    exitEl.value = chosen.exit;
    zoneEl.value = chosen.zone;
    compareEl.value = chosen.compareZone ?? NO_ZONE;
    syncPreset();
    refit();
  }

  /** A handle moved: its typed field takes the local time it landed on. */
  function followHandle(h: GmtHandle): void {
    const field = h === entryHandle ? entryEl : exitEl;
    field.value = formatHandleValue(msOf(h.value), state().grid);
    syncPreset();
    render();
  }

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === entryHandle || target === exitHandle) {
        followHandle(target as GmtHandle);
        return;
      }
      if (target === entryEl || target === exitEl) {
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
        applyPreset();
        return;
      }
      // Refit on commit, not per keystroke: rescaling under a half-typed date
      // fights the caret.
      if (target === entryEl || target === exitEl) {
        refit();
        return;
      }
      if (target === zoneEl || target === compareEl) {
        syncPreset();
        refit();
        return;
      }
      if (target === entryHandle || target === exitHandle) {
        // The end of a drag refits; a key press does only at the canvas's edge, which
        // widens the canvas so the handle can keep going.
        const h = target as GmtHandle;
        if (pointerActive || h.value <= 0 || h.value >= maxUnits()) refit();
      }
    },
    { signal },
  );

  widgetEl.addEventListener(
    "pointerdown",
    () => {
      pointerActive = true;
    },
    { signal },
  );
  const released = (): void => {
    pointerActive = false;
  };
  widgetEl.addEventListener("pointerup", released, { signal });
  widgetEl.addEventListener("pointercancel", released, { signal });

  return {
    refit,
    permalink(): Record<string, string> {
      const out: Record<string, string> = {
        entry: entryEl.value,
        exit: exitEl.value,
      };
      if (zoneEl.value !== NO_ZONE) out["zone"] = zoneEl.value;
      if (compareEl.value !== NO_ZONE) out["compareZone"] = compareEl.value;
      return out;
    },
  };
}

/** Write seeded arguments onto the controls; a zone the select lacks is added. */
function applyArgs(root: HTMLElement, args: DwellLedgerArgs): void {
  if (args.entry === undefined && args.exit === undefined) return;
  const { part: el } = findWidget(root, WIDGET_NAME);
  const zone = args.zone ?? NO_ZONE;
  const compareZone = args.compareZone ?? NO_ZONE;
  const setSelect = (select: HTMLSelectElement, value: string): void => {
    if (![...select.options].some((o) => o.value === value)) {
      select.add(new Option(value, value));
    }
    select.value = value;
  };
  setSelect(el<HTMLSelectElement>("zone"), zone);
  setSelect(el<HTMLSelectElement>("compare"), compareZone);
  /* A chat model answering "23:00 in New York" sends a wall time with no
     offset. Read it in the zone the reader named; see `resolveWallTime`. */
  const entry = resolveWallTime(args.entry ?? "", zone);
  const exit = resolveWallTime(args.exit ?? "", zone);
  el<HTMLInputElement>("entry").value = entry;
  el<HTMLInputElement>("exit").value = exit;
  findWidget(root, WIDGET_NAME).el.querySelector<GmtPreset>(
    "gmt-preset",
  )!.value = matchPreset(entry, exit, zone, compareZone);
}

export const mountDwellLedger: MountFn<DwellLedgerArgs> = async (
  root,
  args,
  signal,
) => {
  defineElements();
  let modules: Modules;
  try {
    modules = await loadModules();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  applyArgs(root, args);
  const controller = setupWidget(root, modules, signal);
  controller.refit();

  return onceDestroy(
    () => {},
    () => controller.permalink(),
  );
};
