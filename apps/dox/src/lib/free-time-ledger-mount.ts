/**
 * The Free Time Ledger widget (INT-12), mountable on its tool page and in the
 * chat rail.
 *
 * A container's clock drawn on a terminal's real local-day grid, each day
 * drawn the way the tariff reads it: glass for a free day, a hatch for a
 * charged one, the closed hatch for a closed one. Each state is a pattern and a
 * chip with a word. The reader drags the clock start and the gate-out, flips
 * the start-day convention and the basis, adds a holiday, and watches the free
 * window and the charged dates move. The printed results are always the real
 * `freeTimeExpiry` and `chargeableDays` calls'; the colouring is a picture of
 * them, and the mount test asserts the two agree for every preset.
 *
 * Built on the component kit: `renderFreeTimeLedgerTemplate` writes the markup
 * from builders only, with ids from `idScope(idPrefix)`, and `mount` finds its
 * parts by those ids and reads and writes element `value` properties. Every
 * listener is delegated on the widget with the mount's `signal`. The two
 * handles are `<gmt-handle>`s; each is tied two ways to its typed field.
 */
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
  widget,
  type Plate,
  type SafeHtml,
} from "~/widgets/builders";
import { defineElements } from "~/widgets/define";
import { callOutput } from "~/widgets/families/gnss/call-output";
import { dayColumns } from "~/widgets/families/ledger/day-columns";
import {
  axisTicks,
  ledgerAxis,
  ledgerBar,
  ledgerFrame,
  ledgerGate,
  ledgerHandles,
  ledgerLane,
  ledgerLegend,
} from "~/widgets/families/ledger/ledger-lane";
import { textArea } from "~/widgets/families/ledger/text-area";
import { chips, type GmtChips } from "~/widgets/primitives/chips/chips";
import { grow } from "~/widgets/primitives/grow/grow";
import { handle, type GmtHandle } from "~/widgets/primitives/handle/handle";
import { preset, type GmtPreset } from "~/widgets/primitives/preset/preset";
import styles from "~/widgets/tools/free-time-ledger.module.css";
import {
  createLedgerCanvas,
  dayCells,
  fitLedgerCanvas,
  formatHandleValue,
  formatLocal,
  resolveWallTime,
  toEpochMs,
  axisLabels,
  type LedgerCanvas,
} from "./dwell-ledger";
import {
  CUSTOM_PRESET_ID,
  FREE_TIME_PRESETS,
  LEDGER_ZONES,
  NULL_REASON_TEXT,
  chargeTermsOf,
  dayMarks,
  explainExpiryNull,
  explainNull,
  formatCharges,
  formatFreeTime,
  freeDaysOf,
  freeTimePlates,
  matchPreset,
  normaliseWeekend,
  readArgs,
  summaryText,
  termsOf,
  tiersOf,
  type ChargeTermsArg,
  type ChargesResult,
  type FreeTimeLedgerArgs,
  type FreeTimeResult,
  type LedgerState,
  type TermsArg,
} from "./free-time-ledger";
import { GMT_MODULES } from "./gmt-modules";
import {
  layoutWidth,
  onWidthChange,
  placeLabel,
  thinTickLabels,
} from "./label-fit";
import type { PlateSpec } from "./ledger-widgets";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { codeSpan } from "./widget-ui";

export type { FreeTimeLedgerArgs } from "./free-time-ledger";

const WIDGET_NAME = "free-time-ledger";
const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The handle's scale: hundredths of a percent of the drawn span. */
const HANDLE_MAX = 10000;
/** PageUp and PageDown move this many snap steps. */
const PAGE_STEP_UNITS = 12;

/** The widest values the plates show, so they keep their width from one reading to the next. */
const PLATE_SAMPLES: Readonly<Record<string, readonly string[]>> = {
  "hero-free": ["999"],
  "hero-charged": ["999"],
  "hero-expires": ["88 May 88:88"],
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

function choices(
  values: readonly string[],
  labels: readonly string[] = values,
): { value: string; label: string }[] {
  return values.map((v, i) => ({ value: v, label: labels[i] ?? v }));
}

function zoneChoices(selected: string): { value: string; label: string }[] {
  const list = LEDGER_ZONES.includes(selected)
    ? LEDGER_ZONES
    : [...LEDGER_ZONES, selected];
  return choices(list);
}

const isWorking = (s: LedgerState): boolean =>
  s.basis === "working" || s.chargeBasis === "working";

/** The two ends of a handle pair, for the first paint before any time is known. */
function handles(): SafeHtml {
  return html`${handle({
    label: "Clock start",
    min: 0,
    max: HANDLE_MAX,
    step: 1,
    largeStep: PAGE_STEP_UNITS,
    value: 0,
    valueText: "not drawn yet",
    pair: "start",
  })}${handle({
    label: "Clock end",
    min: 0,
    max: HANDLE_MAX,
    step: 1,
    largeStep: PAGE_STEP_UNITS,
    value: HANDLE_MAX,
    valueText: "not drawn yet",
    pair: "end",
  })}`;
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them.
 * With no args it shows the first preset. Day cells, the bar and the outputs
 * are drawn by `mount`, because they come from Temporal and the real library.
 */
export function renderFreeTimeLedgerTemplate(
  idPrefix: string,
  args: FreeTimeLedgerArgs = {},
): string {
  const id = idScope(idPrefix);
  const seeded = args.clockStart !== undefined || args.clockEnd !== undefined;
  const state: LedgerState = seeded
    ? readArgs(args)
    : { ...FREE_TIME_PRESETS[0]! };

  const box = (wide: boolean, children: SafeHtml, boxId?: string): SafeHtml =>
    html`<div class="${styles.box}" ${boxId === undefined ? "" : html`id="${boxId}"`} ${wide ? html`data-wide` : ""}>${children}</div>`;

  const controls = fieldGrid(
    html`${box(
      false,
      field({
        id: id("zone"),
        label: "Terminal zone",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.zone,
            options: zoneChoices(state.zone),
          }),
      }),
    )}${box(
      false,
      field({
        id: id("free-days"),
        label: "Free days",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.freeDays,
            inputMode: "numeric",
            autocomplete: "off",
            spellcheck: false,
          }),
      }),
    )}${box(
      false,
      field({
        id: id("first-day"),
        label: "Free day one is",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.firstDay,
            options: choices(
              ["eventDay", "nextDay"],
              ["eventDay: the event day", "nextDay: the day after"],
            ),
          }),
      }),
    )}${box(
      false,
      field({
        id: id("basis"),
        label: "Free days count",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.basis,
            options: choices(
              ["calendar", "working"],
              ["calendar days", "working days"],
            ),
          }),
      }),
    )}${box(
      false,
      field({
        id: id("charge-basis"),
        label: "Charged days count",
        control: ({ id: cid }) =>
          select({
            id: cid,
            value: state.chargeBasis,
            options: choices(
              ["calendar", "working"],
              ["calendar days", "working days"],
            ),
          }),
      }),
    )}${box(
      false,
      field({
        id: id("tiers"),
        label: "Tier end days",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.tiers,
            placeholder: "5, 10",
            autocomplete: "off",
            spellcheck: false,
          }),
      }),
    )}`,
  );

  const working = html`<div class="${styles.working}" id="${id("working-terms")}" ${isWorking(state) ? "" : html`hidden`}>${fieldGrid(
    html`${box(
      true,
      chips({
        legend: "Weekend",
        kind: "checkbox",
        name: id("weekend"),
        items: WEEKDAY_NAMES.map((name, i) => ({
          value: String(i + 1),
          label: name,
          checked: state.weekend.includes(i + 1),
        })),
      }),
    )}${box(
      true,
      field({
        id: id("holidays"),
        label: "Holidays, one date per line",
        control: ({ id: cid, describedBy }) =>
          textArea({ id: cid, value: state.holidays, describedBy }),
      }),
    )}`,
  )}</div>`;

  const clock = fieldGrid(
    html`${box(
      true,
      field({
        id: id("clock-start"),
        label: "Clock start",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.clockStart,
            autocomplete: "off",
            spellcheck: false,
          }),
      }),
    )}${box(
      true,
      field({
        id: id("clock-end"),
        label: "Clock end",
        control: ({ id: cid }) =>
          textInput({
            id: cid,
            value: state.clockEnd,
            autocomplete: "off",
            spellcheck: false,
          }),
      }),
    )}`,
  );

  const presetId = matchPreset(state);
  const tariff = section(
    { id: id("tariff"), heading: "1. Set the tariff and the clock", level: 4 },
    html`<div class="${styles.controls}">${preset({
      id: id("preset"),
      label: "Preset",
      value: presetId,
      options: [
        { value: CUSTOM_PRESET_ID, label: "Custom", description: "" },
        ...FREE_TIME_PRESETS.map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
      ],
    })}${controls}${working}${clock}</div>`,
  );

  const emptyPlates = plateList(
    freeTimePlates({
      freeTime: null,
      charges: null,
      freeDays: state.freeDays,
      zone: state.zone,
      zoneOk: false,
    }),
  );

  const drawn = section(
    {
      id: id("drawn-section"),
      heading: "2. Free days and charged days",
      level: 4,
    },
    html`${ledgerFrame(
      html`<div id="${id("plates")}">${plates(emptyPlates, { gate: "hero" })}</div>${ledgerLane(
        {
          id: id("lane"),
          label: "",
          daysLabel: "Local days",
          gateRow: true,
        },
        html`${ledgerGate({ id: id("expiry"), label: "expires" })}${ledgerBar({
          id: id("bar"),
        })}${ledgerHandles(handles())}`,
      )}${ledgerAxis(id("axis"), ["", "", ""])}${ledgerLegend([
        { text: "free", swatch: "lit" },
        { text: "charged", swatch: "hatched" },
        { text: "closed", swatch: "closed" },
        { text: "event day, not counted", swatch: "plain" },
      ])}`,
      { gate: "frame" },
    )}<p role="status" aria-label="Reading summary" id="${id("summary")}">${srOnly("")}</p>${grow(
      html`<div id="${id("reason")}"></div>`,
    )}`,
  );

  const expiry = section(
    {
      id: id("expiry-section"),
      heading: "3. What freeTimeExpiry returns",
      level: 4,
    },
    html`${grow(
      html`<div id="${id("expiry-call")}">${codeFrame({
        label: "Call to freeTimeExpiry",
        copyLabel: "Copy freeTimeExpiry call",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}<div id="${id("expiry-out")}">${callOutput({
      label: "What freeTimeExpiry returned",
      state: "empty",
      lines: [],
    })}</div>`,
  );

  const charges = section(
    {
      id: id("charges-section"),
      heading: "4. What chargeableDays returns",
      level: 4,
    },
    html`${grow(
      html`<div id="${id("charges-call")}">${codeFrame({
        label: "Call to chargeableDays",
        copyLabel: "Copy chargeableDays call",
        copyText: "",
        gate: "codeframe",
      })}</div>`,
    )}<div id="${id("charges-out")}">${callOutput({
      label: "What chargeableDays returned",
      state: "empty",
      lines: [],
    })}</div>`,
  );

  return widget(
    { name: WIDGET_NAME, label: "Free Time Ledger", scope: idPrefix },
    html`${tariff}${drawn}${expiry}${charges}`,
  ).toString();
}

type ExpiryFn = (
  clockStart: string,
  freeDays: number,
  options: TermsArg,
) => FreeTimeResult | null;
type ChargesFn = (
  clockStart: string,
  clockEnd: string,
  freeDays: number,
  options: ChargeTermsArg & { tiers?: number[] },
) => ChargesResult | null;

interface Modules {
  freeTimeExpiry: ExpiryFn;
  chargeableDays: ChargesFn;
  isValidInstant: (value: string) => boolean;
  isValidTimeZone: (value: string) => boolean;
  isValidBusinessCalendar: (value: unknown) => boolean;
}

async function loadModules(): Promise<Modules> {
  const [intermodal, precision, zoned, calendar] = await Promise.all([
    GMT_MODULES["intermodal/calculate"](),
    GMT_MODULES["precision/validate"](),
    GMT_MODULES["zoned/validate"](),
    GMT_MODULES["calendar/validate"](),
  ]);
  return {
    freeTimeExpiry: intermodal["freeTimeExpiry"] as ExpiryFn,
    chargeableDays: intermodal["chargeableDays"] as ChargesFn,
    isValidInstant: precision["isValidInstant"] as (v: string) => boolean,
    isValidTimeZone: zoned["isValidTimeZone"] as (v: string) => boolean,
    isValidBusinessCalendar: calendar["isValidBusinessCalendar"] as (
      v: unknown,
    ) => boolean,
  };
}

/** The options object as source text: highlighted HTML and plain text to copy. */
function optionsSource(
  terms: TermsArg & { chargeBasis?: string },
  tiers: number[] | undefined,
): [string, string] {
  const str = (s: string) => codeSpan("str", JSON.stringify(s));
  const plainStr = (s: string) => JSON.stringify(s);
  const list = (
    items: readonly (string | number)[],
    f: (s: string) => string,
  ) =>
    `[${items.map((i) => (typeof i === "string" ? f(i) : String(i))).join(", ")}]`;
  const parts = (f: (s: string) => string): string[] => {
    const out = [
      `basis: ${f(terms.basis)}`,
      ...(terms.chargeBasis === undefined
        ? []
        : [`chargeBasis: ${f(terms.chargeBasis)}`]),
      `timeZone: ${f(terms.timeZone)}`,
      `firstDay: ${f(terms.firstDay)}`,
    ];
    if (terms.calendar) {
      out.push(
        `calendar: { weekend: ${list(terms.calendar.weekend, f)}, holidays: ${list(terms.calendar.holidays, f)}, timeZone: ${f(terms.calendar.timeZone)} }`,
      );
    }
    if (tiers !== undefined) out.push(`tiers: ${list(tiers, f)}`);
    return out;
  };
  return [`{ ${parts(str).join(", ")} }`, `{ ${parts(plainStr).join(", ")} }`];
}

/** One call, as highlighted source and as the plain text the copy button takes. */
function callFrame(
  label: string,
  copyLabel: string,
  fn: string,
  argsHtml: string,
  argsPlain: string,
): SafeHtml {
  return codeFrame({
    label,
    copyLabel,
    copyText: `${fn}(${argsPlain})`,
    code: raw(`${codeSpan("fn", fn)}(${argsHtml})`),
    gate: "codeframe",
  });
}

function outputOf(label: string, text: string | null): SafeHtml {
  return text === null
    ? callOutput({
        label,
        state: "sentinel",
        lines: [{ text: "", lost: true }],
      })
    : callOutput({ label, state: "live", lines: [{ text, lost: false }] });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  refit(): void;
  /** Release what outlives the subtree: the track's width observer. */
  release(): void;
  /** The permalink's strings, from the controls as they stand. */
  permalink(): Record<string, string>;
  /** Write seeded arguments onto the controls. */
  seed(args: FreeTimeLedgerArgs): void;
}

function setupWidget(
  root: HTMLElement,
  m: Modules,
  signal: AbortSignal,
): Controller {
  const { el: widgetEl, part: el } = findWidget(root, WIDGET_NAME);

  const presetEl = widgetEl.querySelector<GmtPreset>("gmt-preset")!;
  const weekendEl = el("working-terms").querySelector<GmtChips>("gmt-chips")!;
  const startEl = el<HTMLInputElement>("clock-start");
  const endEl = el<HTMLInputElement>("clock-end");
  const zoneEl = el<HTMLSelectElement>("zone");
  const freeDaysEl = el<HTMLInputElement>("free-days");
  const firstDayEl = el<HTMLSelectElement>("first-day");
  const basisEl = el<HTMLSelectElement>("basis");
  const chargeBasisEl = el<HTMLSelectElement>("charge-basis");
  const tiersEl = el<HTMLInputElement>("tiers");
  const holidaysEl = el<HTMLTextAreaElement>("holidays");
  const workingEl = el("working-terms");
  const trackEl = el("lane-track");
  const [startHandle, endHandle] = [
    ...widgetEl.querySelectorAll<GmtHandle>("gmt-handle"),
  ] as [GmtHandle, GmtHandle];

  let canvas: LedgerCanvas = createLedgerCanvas(0, 1);

  const weekend = (): number[] =>
    normaliseWeekend((weekendEl.value as string[]).map(Number));

  const state = (): LedgerState => ({
    clockStart: startEl.value.trim(),
    clockEnd: endEl.value.trim(),
    freeDays: freeDaysEl.value.trim(),
    firstDay: firstDayEl.value === "nextDay" ? "nextDay" : "eventDay",
    basis: basisEl.value === "working" ? "working" : "calendar",
    chargeBasis: chargeBasisEl.value === "working" ? "working" : "calendar",
    zone: zoneEl.value,
    weekend: weekend(),
    holidays: holidaysEl.value,
    tiers: tiersEl.value,
  });

  function refit(): void {
    const s = state();
    const fitted = fitLedgerCanvas(
      toEpochMs(s.clockStart),
      toEpochMs(s.clockEnd),
      m.isValidTimeZone(s.zone) ? [s.zone] : [],
    );
    if (fitted) canvas = fitted;
    render();
  }

  function syncPreset(): void {
    presetEl.value = matchPreset(state());
    workingEl.hidden =
      basisEl.value !== "working" && chargeBasisEl.value !== "working";
  }

  /** Place the handles on the canvas and say each one's time aloud. */
  function drawHandles(startMs: number, endMs: number, zone: string): void {
    const spanMs = Math.max(1, canvas.endMs - canvas.startMs);
    const step = ((canvas.snapMinutes * 60000) / spanMs) * HANDLE_MAX;
    const at = (ms: number): number => {
      const pct = canvas.toPercent(ms);
      return Number.isNaN(pct) ? 0 : pct * (HANDLE_MAX / 100);
    };
    for (const h of [startHandle, endHandle]) {
      h.setAttribute("step", String(step));
      h.setAttribute("large-step", String(step * PAGE_STEP_UNITS));
    }
    // Widen the end first, so the start is never held back by the old end.
    endHandle.value = HANDLE_MAX;
    startHandle.value = at(startMs);
    endHandle.value = at(endMs);
    for (const [h, ms] of [
      [startHandle, startMs],
      [endHandle, endMs],
    ] as const) {
      h.setAttribute(
        "aria-valuetext",
        Number.isNaN(ms) ? "not a time" : formatLocal(ms, zone),
      );
    }
  }

  /** Place the expiry gate and its chip; the chip flips near the right edge. */
  function drawGate(expiresAt: string | null, zone: string | null): void {
    const gate = el("expiry");
    const ms = expiresAt === null ? Number.NaN : toEpochMs(expiresAt);
    if (Number.isNaN(ms) || ms < canvas.startMs || ms > canvas.endMs) {
      gate.hidden = true;
      return;
    }
    gate.hidden = false;
    const pct = canvas.toPercent(ms);
    gate.style.setProperty("--gmt-gate-at", String(pct));
    const chip = el("expiry-chip");
    const local = zone === null ? "" : formatLocal(ms, zone);
    chip.textContent = local === "" ? "expires" : `expires ${local}`;
    gate.dataset["edge"] = "start";
    if (trackEl.clientWidth > 0) {
      const side = placeLabel({
        atPx: (pct / 100) * trackEl.clientWidth,
        labelPx: layoutWidth(chip),
        trackPx: trackEl.clientWidth,
        offsetPx: 10,
      });
      gate.dataset["edge"] = side;
    }
  }

  function drawBar(startMs: number, endMs: number, invalid: boolean): void {
    const bar = el("bar");
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      bar.hidden = true;
      return;
    }
    const left = canvas.toPercent(Math.min(startMs, endMs));
    const right = canvas.toPercent(Math.max(startMs, endMs));
    bar.hidden = false;
    bar.style.setProperty("--gmt-bar-from", String(left));
    bar.style.setProperty("--gmt-bar-to", String(Math.max(left, right)));
    bar.dataset["invalid"] = String(invalid);
  }

  function render(): void {
    const s = state();
    const terms = termsOf(s);
    const chargeTerms = chargeTermsOf(s);
    const days = freeDaysOf(s);
    const tiers = tiersOf(s);
    const startMs = toEpochMs(s.clockStart);
    const endMs = toEpochMs(s.clockEnd);
    const zoneOk = m.isValidTimeZone(s.zone);

    const freeTime = m.freeTimeExpiry(s.clockStart, days, terms);
    const charges = m.chargeableDays(s.clockStart, s.clockEnd, days, {
      ...chargeTerms,
      ...(tiers === undefined ? {} : { tiers: tiers ?? [] }),
    });
    const reason = charges === null ? explainNull(s, m) : null;
    const expiryReason = freeTime === null ? explainExpiryNull(s, m) : null;

    el("lane-label").textContent = zoneOk ? s.zone : "no zone";
    const cells = zoneOk ? dayCells(canvas, s.zone, startMs, endMs) : [];
    setHtml(
      el("lane-cells"),
      dayColumns(cells, canvas, dayMarks(cells, s, freeTime, charges)),
    );
    drawBar(startMs, endMs, reason === "inverted");
    drawGate(
      charges?.expiresAt ?? freeTime?.expiresAt ?? null,
      zoneOk ? s.zone : null,
    );
    drawHandles(startMs, endMs, zoneOk ? s.zone : "UTC");

    setHtml(
      el("plates"),
      plates(
        plateList(
          freeTimePlates({
            freeTime,
            charges,
            freeDays: s.freeDays,
            zone: s.zone,
            zoneOk,
          }),
        ),
        { gate: "hero" },
      ),
    );

    const axis = el("axis");
    setHtml(axis, axisTicks(axisLabels(canvas, zoneOk ? s.zone : null)));
    // On a narrow track the three dates would touch: drop the ones that do.
    thinTickLabels(axis, "span");

    // The two calls, exactly as the library was called.
    const [optHtml, optPlain] = optionsSource(terms, undefined);
    const daysHtml = codeSpan("num", String(days));
    const startHtml = codeSpan("str", JSON.stringify(s.clockStart));
    setHtml(
      el("expiry-call"),
      callFrame(
        "Call to freeTimeExpiry",
        "Copy freeTimeExpiry call",
        "freeTimeExpiry",
        `${startHtml}, ${daysHtml}, ${optHtml}`,
        `${JSON.stringify(s.clockStart)}, ${days}, ${optPlain}`,
      ),
    );
    const [chargeOptHtml, chargeOptPlain] = optionsSource(
      chargeTerms,
      tiers ?? undefined,
    );
    setHtml(
      el("charges-call"),
      callFrame(
        "Call to chargeableDays",
        "Copy chargeableDays call",
        "chargeableDays",
        `${startHtml}, ${codeSpan("str", JSON.stringify(s.clockEnd))}, ${daysHtml}, ${chargeOptHtml}`,
        `${JSON.stringify(s.clockStart)}, ${JSON.stringify(s.clockEnd)}, ${days}, ${chargeOptPlain}`,
      ),
    );
    setHtml(
      el("expiry-out"),
      outputOf(
        "What freeTimeExpiry returned",
        freeTime === null ? null : formatFreeTime(freeTime),
      ),
    );
    setHtml(
      el("charges-out"),
      outputOf(
        "What chargeableDays returned",
        charges === null ? null : formatCharges(charges),
      ),
    );

    // Summary: the library's numbers, never the drawing's.
    setHtml(
      el("summary"),
      srOnly(charges === null ? "" : summaryText(charges)),
    );

    // Aside: why null, or the one thing worth saying about a valid answer.
    const shown = reason ?? expiryReason;
    let note: SafeHtml = html``;
    if (shown) {
      note = aside(
        {
          label: shown === "no-free-days" ? "Note" : "Why null",
          tone: shown === "no-free-days" ? "note" : "caution",
          title: shown === "no-free-days" ? "Note" : "Why null",
        },
        html`<p>${NULL_REASON_TEXT[shown]}</p>`,
      );
    } else if (
      charges &&
      charges.chargeableDays === 0 &&
      s.clockEnd === charges.expiresAt
    ) {
      note = aside(
        { label: "Note", tone: "note", title: "Note" },
        html`<p>The gate-out is exactly at expiresAt. The dwell is half-open, so that instant is not a chargeable day; one nanosecond later would be.</p>`,
      );
    }
    setHtml(el("reason"), note);
  }

  function applyPreset(): void {
    const chosen = FREE_TIME_PRESETS.find((p) => p.id === presetEl.value);
    if (!chosen) return;
    startEl.value = chosen.clockStart;
    endEl.value = chosen.clockEnd;
    zoneEl.value = chosen.zone;
    freeDaysEl.value = chosen.freeDays;
    firstDayEl.value = chosen.firstDay;
    basisEl.value = chosen.basis;
    chargeBasisEl.value = chosen.chargeBasis;
    tiersEl.value = chosen.tiers;
    holidaysEl.value = chosen.holidays;
    weekendEl.value = chosen.weekend.map(String);
    syncPreset();
    refit();
  }

  /** Write a handle's stop into its typed field. */
  function setFromHandle(h: GmtHandle): number {
    const ms = canvas.fromPercent(h.value / (HANDLE_MAX / 100));
    const input = h === startHandle ? startEl : endEl;
    const zone = zoneEl.value;
    input.value = formatHandleValue(ms, m.isValidTimeZone(zone) ? zone : null);
    syncPreset();
    render();
    return ms;
  }

  let dragging = false;

  widgetEl.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target === startHandle || e.target === endHandle) dragging = true;
    },
    { signal },
  );
  const stopDrag = (): void => {
    dragging = false;
  };
  widgetEl.addEventListener("pointerup", stopDrag, { signal });
  widgetEl.addEventListener("pointercancel", stopDrag, { signal });

  widgetEl.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target === startHandle || target === endHandle) {
        setFromHandle(target as GmtHandle);
        return;
      }
      if (
        target === startEl ||
        target === endEl ||
        target === freeDaysEl ||
        target === tiersEl ||
        target === holidaysEl
      ) {
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
      if (target === startHandle || target === endHandle) {
        // Reaching an edge widens the canvas, so the handle can keep going;
        // a finished drag refits too. A key step does not rescale the track.
        const h = target as GmtHandle;
        if (dragging || h.value <= 0 || h.value >= HANDLE_MAX) refit();
        return;
      }
      // Refit on commit, not per keystroke: rescaling under a half-typed date
      // fights the caret.
      if (target === startEl || target === endEl) {
        refit();
        return;
      }
      if (
        target === zoneEl ||
        target === firstDayEl ||
        target === basisEl ||
        target === chargeBasisEl ||
        target === weekendEl
      ) {
        syncPreset();
        refit();
      }
    },
    { signal },
  );

  /* The "expires" chip is placed against the track's measured width, so a
     width change (rotation, the chat rail opening) re-places it. */
  const disposeWidth = onWidthChange(trackEl, render);

  function seed(args: FreeTimeLedgerArgs): void {
    if (args.clockStart === undefined && args.clockEnd === undefined) return;
    const s = readArgs(args);
    if (![...zoneEl.options].some((o) => o.value === s.zone)) {
      zoneEl.append(new Option(s.zone, s.zone));
    }
    zoneEl.value = s.zone;
    /* A chat model answering "15:00 in New York" sends a wall time with no
       offset. Read it in the zone the reader named; see `resolveWallTime`. */
    startEl.value = resolveWallTime(s.clockStart, s.zone);
    endEl.value = resolveWallTime(s.clockEnd, s.zone);
    freeDaysEl.value = s.freeDays;
    firstDayEl.value = s.firstDay;
    basisEl.value = s.basis;
    chargeBasisEl.value = s.chargeBasis;
    tiersEl.value = s.tiers;
    holidaysEl.value = s.holidays;
    weekendEl.value = s.weekend.map(String);
    syncPreset();
  }

  function permalink(): Record<string, string> {
    // Strings only: a permalink carries no numbers below 1900 and no lists.
    const out: Record<string, string> = {
      clockStart: startEl.value,
      clockEnd: endEl.value,
      freeDays: freeDaysEl.value,
      firstDay: firstDayEl.value,
      basis: basisEl.value,
      chargeBasis: chargeBasisEl.value,
      zone: zoneEl.value,
    };
    if (basisEl.value === "working" || chargeBasisEl.value === "working") {
      out["weekend"] = (weekendEl.value as string[]).join(",");
      const holidays = holidaysEl.value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(",");
      if (holidays) out["holidays"] = holidays;
    }
    if (tiersEl.value.trim()) out["tiers"] = tiersEl.value.trim();
    return out;
  }

  return { refit, release: disposeWidth, permalink, seed };
}

export const mountFreeTimeLedger: MountFn<FreeTimeLedgerArgs> = async (
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

  const controller = setupWidget(root, modules, signal);
  controller.seed(args);
  controller.refit();

  return onceDestroy(
    () => controller.release(),
    () => controller.permalink(),
  );
};
