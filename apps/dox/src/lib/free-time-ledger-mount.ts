/**
 * The Free Time Ledger widget (INT-12), mountable on its tool page and in the
 * chat rail.
 *
 * A container's clock drawn on a terminal's real local-day grid, each day
 * coloured the way the tariff reads it. The reader drags the clock start and
 * the gate-out, flips the start-day convention and the basis, adds a holiday,
 * and watches the free window and the charged dates move. The printed results
 * are always the real `freeTimeExpiry` and `chargeableDays` calls'; the
 * colouring is a picture of them, and the mount test asserts the two agree
 * for every preset.
 *
 * Follows the `renderTemplate` / `mount` split in `widget-mount.ts`, and the
 * Dwell Ledger's wiring: every listener is delegated on the root, so the host
 * dropping the subtree is a complete teardown apart from a live pointer capture.
 */
import { codeFrameHtml } from "./code-frame";
import {
  axisLabels,
  createLedgerCanvas,
  dayCells,
  fitLedgerCanvas,
  formatDayLabel,
  formatHandleValue,
  formatLocal,
  resolveWallTime,
  toEpochMs,
  type DayCell,
  type LedgerCanvas,
} from "./dwell-ledger";
import {
  CUSTOM_PRESET_ID,
  FREE_TIME_PRESETS,
  LEDGER_ZONES,
  NULL_REASON_TEXT,
  cellState,
  explainExpiryNull,
  explainNull,
  formatCharges,
  formatFreeTime,
  freeDaysOf,
  matchPreset,
  normaliseWeekend,
  readArgs,
  summaryText,
  chargeTermsOf,
  termsOf,
  tierEnds,
  tiersOf,
  type ChargesResult,
  type FreeTimeLedgerArgs,
  type FreeTimeResult,
  type LedgerState,
  type ChargeTermsArg,
  type TermsArg,
} from "./free-time-ledger";
import { GMT_MODULES } from "./gmt-modules";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import {
  codeSpan,
  escapeAttr,
  escapeHtml,
  renderAside,
  renderCallLine,
  renderWidgetOutput,
  wireCopyButtons,
} from "./widget-ui";

export type { FreeTimeLedgerArgs } from "./free-time-ledger";

/** Arrow keys move one snap step; with Shift, four. */
const STEP_UNITS = 1;
const BIG_STEP_UNITS = 4;

/** A cell narrower than this shows no date label; its `aria-label` still names it. */
const MIN_LABEL_PERCENT = 9;

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CELL_STATE_TEXT = {
  event: "event day, not counted",
  free: "free",
  closed: "closed, not counted",
  chargeable: "chargeable",
  none: "",
} as const;

function options(
  values: readonly string[],
  labels: readonly string[],
  selected: string,
): string {
  return values
    .map(
      (v, i) =>
        `<option value="${escapeAttr(v)}"${v === selected ? " selected" : ""}>${escapeHtml(labels[i] ?? v)}</option>`,
    )
    .join("");
}

function zoneOptions(selected: string): string {
  const list = LEDGER_ZONES.includes(selected)
    ? LEDGER_ZONES
    : [...LEDGER_ZONES, selected];
  return options(list, list, selected);
}

/**
 * The widget's chrome, seeded with `args` so the first paint shows them.
 * With no args it shows the first preset. Day cells, the bar and the outputs
 * are drawn by `mount`, because they come from Temporal and the real library.
 */
export function renderFreeTimeLedgerTemplate(
  args: FreeTimeLedgerArgs = {},
): string {
  const seeded = args.clockStart !== undefined || args.clockEnd !== undefined;
  const state: LedgerState = seeded
    ? readArgs(args)
    : { ...FREE_TIME_PRESETS[0]! };
  const presetId = matchPreset(state);
  const preset = FREE_TIME_PRESETS.find((p) => p.id === presetId);

  const presetOptions =
    `<option value="${CUSTOM_PRESET_ID}"${presetId === CUSTOM_PRESET_ID ? " selected" : ""}>Custom</option>` +
    FREE_TIME_PRESETS.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === presetId ? " selected" : ""}>${escapeHtml(p.label)}</option>`,
    ).join("");

  const handle = (role: string, label: string) =>
    `<div class="gmt-freetime-handle" data-role="${role}" tabindex="0" role="slider" aria-orientation="horizontal" aria-label="${label}"></div>`;

  const weekendBoxes = WEEKDAY_NAMES.map(
    (name, i) =>
      `<label class="gmt-freetime-weekday"><input type="checkbox" data-role="weekend" value="${i + 1}"${state.weekend.includes(i + 1) ? " checked" : ""}><span>${name}</span></label>`,
  ).join("");

  return (
    `<div class="gmt-freetime gmt-widget">` +
    `<div class="gmt-widget-card">` +
    `<div class="gmt-widget-section">` +
    `<h4>1. Set the tariff and place the clock</h4>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Preset</span>` +
    `<select class="gmt-select gmt-select-wide" data-role="preset">${presetOptions}</select>` +
    `</label>` +
    `</div>` +
    `<p class="gmt-widget-hint" data-role="preset-description">${escapeHtml(preset?.description ?? "")}</p>` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label"><span>Terminal zone</span>` +
    `<select class="gmt-select" data-role="zone">${zoneOptions(state.zone)}</select>` +
    `</label>` +
    `<label class="gmt-label"><span>Free days</span>` +
    `<input class="gmt-input" data-role="free-days" type="number" min="0" step="1" value="${escapeAttr(state.freeDays)}"></label>` +
    `<label class="gmt-label"><span>Day one</span>` +
    `<select class="gmt-select" data-role="first-day">${options(["eventDay", "nextDay"], ["eventDay: the event day", "nextDay: the day after"], state.firstDay)}</select>` +
    `</label>` +
    `<label class="gmt-label"><span>Free days count</span>` +
    `<select class="gmt-select" data-role="basis">${options(["calendar", "working"], ["calendar days", "working days"], state.basis)}</select>` +
    `</label>` +
    `<label class="gmt-label"><span>Charged days count</span>` +
    `<select class="gmt-select" data-role="charge-basis">${options(["calendar", "working"], ["calendar days", "working days"], state.chargeBasis)}</select>` +
    `</label>` +
    `<label class="gmt-label"><span>Tiers</span>` +
    `<input class="gmt-input" data-role="tiers" type="text" spellcheck="false" placeholder="5, 10" value="${escapeAttr(state.tiers)}"></label>` +
    `</div>` +
    `<div class="gmt-widget-controls gmt-freetime-working" data-role="working-terms"${state.basis === "working" || state.chargeBasis === "working" ? "" : " hidden"}>` +
    `<fieldset class="gmt-freetime-weekend"><legend>Weekend</legend>${weekendBoxes}</fieldset>` +
    `<label class="gmt-label gmt-label-wide"><span>Holidays, one date per line</span>` +
    `<textarea class="gmt-input gmt-freetime-holidays" data-role="holidays" rows="2" spellcheck="false">${escapeHtml(state.holidays)}</textarea></label>` +
    `</div>` +
    `<div class="gmt-freetime-timeline" data-role="timeline">` +
    `<div class="gmt-freetime-row" data-role="row">` +
    `<span class="gmt-freetime-row-label" data-role="label"></span>` +
    `<div class="gmt-freetime-track" data-role="track">` +
    `<div class="gmt-freetime-cells" data-role="cells" role="list"></div>` +
    `<div class="gmt-freetime-expiry" data-role="expiry-marker" hidden><span>expires</span></div>` +
    `<div class="gmt-freetime-bar" data-role="bar">` +
    handle("handle-start", "Clock start") +
    handle("handle-end", "Clock end") +
    `</div></div></div>` +
    `<div class="gmt-freetime-axis" data-role="axis"><span></span><span></span><span></span></div>` +
    `<ul class="gmt-freetime-legend" aria-label="Legend">` +
    `<li><i class="gmt-freetime-swatch gmt-freetime-cell--free"></i>free</li>` +
    `<li><i class="gmt-freetime-swatch gmt-freetime-cell--chargeable"></i>chargeable</li>` +
    `<li><i class="gmt-freetime-swatch gmt-freetime-cell--closed"></i>closed</li>` +
    `<li><i class="gmt-freetime-swatch gmt-freetime-cell--event"></i>event day, not counted</li>` +
    `</ul>` +
    `</div>` +
    `<!-- Typed-input equivalent to dragging. -->` +
    `<div class="gmt-widget-controls">` +
    `<label class="gmt-label gmt-label-wide"><span>Clock start</span>` +
    `<input class="gmt-input" data-role="clock-start" type="text" spellcheck="false" value="${escapeAttr(state.clockStart)}"></label>` +
    `<label class="gmt-label gmt-label-wide"><span>Clock end</span>` +
    `<input class="gmt-input" data-role="clock-end" type="text" spellcheck="false" value="${escapeAttr(state.clockEnd)}"></label>` +
    `</div>` +
    `<p class="gmt-freetime-summary" data-role="summary" aria-live="polite"></p>` +
    `<div data-role="reason-aside"></div>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>2. What <code>freeTimeExpiry</code> returns</h4>` +
    codeFrameHtml("expiry") +
    `<output class="gmt-widget-output" data-role="expiry-output">&nbsp;</output>` +
    `</div>` +
    `<div class="gmt-widget-section">` +
    `<h4>3. What <code>chargeableDays</code> returns</h4>` +
    codeFrameHtml("charges") +
    `<output class="gmt-widget-output" data-role="charges-output">&nbsp;</output>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
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

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function renderCells(
  el: HTMLElement | null,
  cells: readonly DayCell[],
  canvas: LedgerCanvas,
  state: LedgerState,
  freeTime: FreeTimeResult | null,
  charges: ChargesResult | null,
): void {
  if (!el) return;
  const ends = tierEnds(charges);
  el.innerHTML = cells
    .map((cell) => {
      const left = canvas.toPercent(cell.startMs);
      const right = canvas.toPercent(cell.endMs);
      const width = Math.max(0, right - left);
      if (width <= 0) return "";
      const kind = cellState(cell, state, freeTime, charges);
      const label = formatDayLabel(cell.date);
      const odd = cell.hours !== 24;
      const aria =
        `${label}${odd ? `, ${cell.hours} hours` : ""}` +
        (kind === "none" ? "" : `, ${CELL_STATE_TEXT[kind]}`);
      const classes = [
        "gmt-freetime-cell",
        kind === "none" ? "" : `gmt-freetime-cell--${kind}`,
        ends.has(cell.date) ? "gmt-freetime-cell--tier-end" : "",
        width < MIN_LABEL_PERCENT ? "gmt-freetime-cell--narrow" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return (
        `<div class="${classes}" role="listitem" data-date="${escapeAttr(cell.date)}" data-hours="${cell.hours}" data-state="${kind}"` +
        ` style="left:${left}%;width:${width}%" aria-label="${escapeAttr(aria)}" title="${escapeAttr(aria)}">` +
        `<span class="gmt-freetime-cell-label" aria-hidden="true">${escapeHtml(label)}</span>` +
        (odd
          ? `<span class="gmt-freetime-cell-hours" aria-hidden="true">${cell.hours} h</span>`
          : "") +
        `</div>`
      );
    })
    .join("");
}

function placeBar(
  bar: HTMLElement | null,
  startMs: number,
  endMs: number,
  canvas: LedgerCanvas,
  invalid: boolean,
): void {
  if (!bar) return;
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    bar.hidden = true;
    return;
  }
  const left = canvas.toPercent(Math.min(startMs, endMs));
  const right = canvas.toPercent(Math.max(startMs, endMs));
  bar.hidden = false;
  bar.style.left = `${left}%`;
  bar.style.width = `${Math.max(0, right - left)}%`;
  bar.classList.toggle("gmt-freetime-bar--invalid", invalid);
}

function placeExpiry(
  marker: HTMLElement | null,
  expiresAt: string | null,
  canvas: LedgerCanvas,
): void {
  if (!marker) return;
  const ms = expiresAt === null ? Number.NaN : toEpochMs(expiresAt);
  if (Number.isNaN(ms) || ms < canvas.startMs || ms > canvas.endMs) {
    marker.hidden = true;
    return;
  }
  marker.hidden = false;
  marker.style.left = `${canvas.toPercent(ms)}%`;
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
      ...(terms.chargeBasis === undefined ? [] : [`chargeBasis: ${f(terms.chargeBasis)}`]),
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

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

interface Controller {
  refit(): void;
  /** Release a pointer capture held mid-drag, which outlives the subtree. */
  release(): void;
}

function setupWidget(container: HTMLElement, m: Modules): Controller | null {
  const q = <T extends HTMLElement>(role: string) =>
    container.querySelector(`[data-role="${role}"]`) as T | null;
  const qa = <T extends HTMLElement>(role: string) =>
    [...container.querySelectorAll(`[data-role="${role}"]`)] as T[];

  const presetEl = q<HTMLSelectElement>("preset");
  const startEl = q<HTMLInputElement>("clock-start");
  const endEl = q<HTMLInputElement>("clock-end");
  const zoneEl = q<HTMLSelectElement>("zone");
  const freeDaysEl = q<HTMLInputElement>("free-days");
  const firstDayEl = q<HTMLSelectElement>("first-day");
  const basisEl = q<HTMLSelectElement>("basis");
  const chargeBasisEl = q<HTMLSelectElement>("charge-basis");
  const tiersEl = q<HTMLInputElement>("tiers");
  const holidaysEl = q<HTMLTextAreaElement>("holidays");
  const weekendEls = qa<HTMLInputElement>("weekend");
  if (
    !presetEl ||
    !startEl ||
    !endEl ||
    !zoneEl ||
    !freeDaysEl ||
    !firstDayEl ||
    !basisEl ||
    !chargeBasisEl ||
    !tiersEl ||
    !holidaysEl
  ) {
    return null;
  }

  let canvas: LedgerCanvas = createLedgerCanvas(0, 1);

  const state = (): LedgerState => ({
    clockStart: startEl.value.trim(),
    clockEnd: endEl.value.trim(),
    freeDays: freeDaysEl.value.trim(),
    firstDay: firstDayEl.value === "nextDay" ? "nextDay" : "eventDay",
    basis: basisEl.value === "working" ? "working" : "calendar",
    chargeBasis: chargeBasisEl.value === "working" ? "working" : "calendar",
    zone: zoneEl.value,
    weekend: normaliseWeekend(
      weekendEls.filter((el) => el.checked).map((el) => Number(el.value)),
    ),
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
    presetEl!.value = matchPreset(state());
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        FREE_TIME_PRESETS.find((p) => p.id === presetEl!.value)?.description ??
        "";
    }
    const working = q("working-terms");
    if (working)
      working.hidden =
        basisEl!.value !== "working" && chargeBasisEl!.value !== "working";
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

    const label = q("label");
    if (label) label.textContent = zoneOk ? s.zone : "no zone";
    renderCells(
      q("cells"),
      zoneOk ? dayCells(canvas, s.zone, startMs, endMs) : [],
      canvas,
      s,
      freeTime,
      charges,
    );
    placeBar(q("bar"), startMs, endMs, canvas, reason === "inverted");
    placeExpiry(
      q("expiry-marker"),
      charges?.expiresAt ?? freeTime?.expiresAt ?? null,
      canvas,
    );
    for (const [role, ms] of [
      ["handle-start", startMs],
      ["handle-end", endMs],
    ] as const) {
      const h = q(role);
      if (!h) continue;
      const pct = canvas.toPercent(ms);
      h.setAttribute("aria-valuemin", "0");
      h.setAttribute("aria-valuemax", "100");
      h.setAttribute(
        "aria-valuenow",
        Number.isNaN(pct) ? "0" : String(Math.round(pct)),
      );
      h.setAttribute(
        "aria-valuetext",
        Number.isNaN(ms)
          ? "not a time"
          : formatLocal(ms, zoneOk ? s.zone : "UTC"),
      );
    }

    const spans = q("axis")?.querySelectorAll("span") ?? [];
    const labels = axisLabels(canvas, zoneOk ? s.zone : null);
    spans.forEach((span, i) => {
      span.textContent = labels[i] ?? "";
    });

    // The two calls, exactly as the library was called.
    const [optHtml, optPlain] = optionsSource(terms, undefined);
    const daysHtml = codeSpan("num", String(days));
    renderCallLine(
      q("call-expiry"),
      "freeTimeExpiry",
      `${codeSpan("str", JSON.stringify(s.clockStart))}, ${daysHtml}, ${optHtml}`,
      `${JSON.stringify(s.clockStart)}, ${days}, ${optPlain}`,
    );
    const [chargeOptHtml, chargeOptPlain] = optionsSource(
      chargeTerms,
      tiers ?? undefined,
    );
    renderCallLine(
      q("call-charges"),
      "chargeableDays",
      `${codeSpan("str", JSON.stringify(s.clockStart))}, ${codeSpan("str", JSON.stringify(s.clockEnd))}, ${daysHtml}, ${chargeOptHtml}`,
      `${JSON.stringify(s.clockStart)}, ${JSON.stringify(s.clockEnd)}, ${days}, ${chargeOptPlain}`,
    );
    const expiryOut = q("expiry-output");
    if (expiryOut) {
      if (freeTime === null)
        renderWidgetOutput(expiryOut, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(expiryOut, formatFreeTime(freeTime), "live");
    }
    const chargesOut = q("charges-output");
    if (chargesOut) {
      if (charges === null)
        renderWidgetOutput(chargesOut, "NO SIGNAL", "sentinel");
      else renderWidgetOutput(chargesOut, formatCharges(charges), "live");
    }

    // Summary: the library's numbers, never the drawing's.
    const summary = q("summary");
    if (summary)
      summary.textContent = charges === null ? "" : summaryText(charges);

    // Aside: why null, or the one thing worth saying about a valid answer.
    const aside = q("reason-aside");
    if (aside) {
      const shown = reason ?? expiryReason;
      if (shown) {
        renderAside(
          aside,
          shown === "no-free-days" ? "note" : "caution",
          shown === "no-free-days" ? "Note" : "Why null",
          `<p>${escapeHtml(NULL_REASON_TEXT[shown])}</p>`,
        );
      } else if (
        charges &&
        charges.chargeableDays === 0 &&
        s.clockEnd === charges.expiresAt
      ) {
        renderAside(
          aside,
          "note",
          "Note",
          `<p>${escapeHtml("The gate-out is exactly at expiresAt. The dwell is half-open, so that instant is not a chargeable day; one nanosecond later would be.")}</p>`,
        );
      } else {
        aside.innerHTML = "";
      }
    }
  }

  function applyPreset(): void {
    const preset = FREE_TIME_PRESETS.find((p) => p.id === presetEl!.value);
    if (!preset) return;
    startEl!.value = preset.clockStart;
    endEl!.value = preset.clockEnd;
    zoneEl!.value = preset.zone;
    freeDaysEl!.value = preset.freeDays;
    firstDayEl!.value = preset.firstDay;
    basisEl!.value = preset.basis;
    chargeBasisEl!.value = preset.chargeBasis;
    tiersEl!.value = preset.tiers;
    holidaysEl!.value = preset.holidays;
    for (const el of weekendEls)
      el.checked = preset.weekend.includes(Number(el.value));
    syncPreset();
    refit();
  }

  // ---- Drag ----

  const inputFor: Record<string, HTMLInputElement> = {
    "handle-start": startEl,
    "handle-end": endEl,
  };

  function setHandle(role: string, ms: number): void {
    const input = inputFor[role];
    if (!input || Number.isNaN(ms)) return;
    const s = state();
    const startMs = toEpochMs(s.clockStart);
    const endMs = toEpochMs(s.clockEnd);
    // A handle cannot pass the other one.
    const bounded =
      role === "handle-start"
        ? Number.isNaN(endMs)
          ? ms
          : Math.min(ms, endMs)
        : Number.isNaN(startMs)
          ? ms
          : Math.max(ms, startMs);
    input.value = formatHandleValue(
      bounded,
      m.isValidTimeZone(s.zone) ? s.zone : null,
    );
    syncPreset();
    render();
  }

  let dragging: string | null = null;
  let captured: { el: HTMLElement; id: number } | null = null;

  container.addEventListener("pointerdown", (e) => {
    const target = (e.target as HTMLElement).closest(
      '[data-role^="handle-"]',
    ) as HTMLElement | null;
    if (!target) return;
    dragging = target.dataset.role ?? null;
    const id = (e as PointerEvent).pointerId;
    try {
      target.setPointerCapture(id);
      captured = { el: target, id };
    } catch {
      captured = null;
    }
    e.preventDefault();
  });

  container.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const track = q("track");
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = (((e as PointerEvent).clientX - rect.left) / rect.width) * 100;
    setHandle(dragging, canvas.fromPercent(pct));
  });

  const stopDrag = () => {
    if (!dragging) return;
    dragging = null;
    captured = null;
    refit();
  };
  container.addEventListener("pointerup", stopDrag);
  container.addEventListener("pointercancel", stopDrag);

  // ---- Keyboard ----

  container.addEventListener("keydown", (e) => {
    const target = (e.target as HTMLElement).closest(
      '[data-role^="handle-"]',
    ) as HTMLElement | null;
    const role = target?.dataset.role;
    const input = role ? inputFor[role] : undefined;
    if (!role || !input) return;
    const ev = e as KeyboardEvent;
    const units = ev.shiftKey ? BIG_STEP_UNITS : STEP_UNITS;
    const current = toEpochMs(input.value);
    let next: number | null = null;
    switch (ev.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = canvas.step(current, -units);
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = canvas.step(current, units);
        break;
      case "Home":
        next = canvas.startMs;
        break;
      case "End":
        next = canvas.endMs;
        break;
    }
    if (next === null) return;
    ev.preventDefault();
    setHandle(role, next);
    // Reaching the edge widens the canvas, so the handle can keep going.
    if (next <= canvas.startMs || next >= canvas.endMs) refit();
  });

  // ---- Typed inputs and selects ----

  for (const input of [startEl, endEl]) {
    input.addEventListener("input", () => {
      syncPreset();
      render();
    });
    // Refit on commit, not per keystroke: rescaling under a half-typed date
    // fights the caret.
    input.addEventListener("change", refit);
  }
  for (const input of [freeDaysEl, tiersEl, holidaysEl]) {
    input.addEventListener("input", () => {
      syncPreset();
      render();
    });
  }
  for (const el of [zoneEl, firstDayEl, basisEl, chargeBasisEl, ...weekendEls]) {
    el.addEventListener("change", () => {
      syncPreset();
      refit();
    });
  }
  presetEl.addEventListener("change", applyPreset);

  wireCopyButtons(container);

  return {
    refit,
    release() {
      if (!captured) return;
      try {
        captured.el.releasePointerCapture(captured.id);
      } catch {
        /* Already released. */
      }
      captured = null;
    },
  };
}

/** Write seeded arguments onto the controls; a zone the select lacks is added. */
function applyArgs(root: HTMLElement, args: FreeTimeLedgerArgs): void {
  if (args.clockStart === undefined && args.clockEnd === undefined) return;
  const q = <T extends HTMLElement>(role: string) =>
    root.querySelector(`[data-role="${role}"]`) as T | null;
  const s = readArgs(args);
  const zoneEl = q<HTMLSelectElement>("zone");
  if (zoneEl) {
    if (![...zoneEl.options].some((o) => o.value === s.zone)) {
      const opt = document.createElement("option");
      opt.value = s.zone;
      opt.textContent = s.zone;
      zoneEl.appendChild(opt);
    }
    zoneEl.value = s.zone;
  }
  /* A chat model answering "15:00 in New York" sends a wall time with no
     offset. Read it in the zone the reader named; see `resolveWallTime`. */
  const set = (role: string, value: string) => {
    const el = q<HTMLInputElement>(role);
    if (el) el.value = value;
  };
  set("clock-start", resolveWallTime(s.clockStart, s.zone));
  set("clock-end", resolveWallTime(s.clockEnd, s.zone));
  set("free-days", s.freeDays);
  set("first-day", s.firstDay);
  set("basis", s.basis);
  set("charge-basis", s.chargeBasis);
  set("tiers", s.tiers);
  set("holidays", s.holidays);
  for (const el of root.querySelectorAll<HTMLInputElement>(
    '[data-role="weekend"]',
  )) {
    el.checked = s.weekend.includes(Number(el.value));
  }
  const working = q("working-terms");
  if (working)
    working.hidden = s.basis !== "working" && s.chargeBasis !== "working";
  const presetEl = q<HTMLSelectElement>("preset");
  if (presetEl) {
    presetEl.value = matchPreset({
      ...s,
      clockStart: q<HTMLInputElement>("clock-start")?.value ?? s.clockStart,
      clockEnd: q<HTMLInputElement>("clock-end")?.value ?? s.clockEnd,
    });
    const desc = q("preset-description");
    if (desc) {
      desc.textContent =
        FREE_TIME_PRESETS.find((p) => p.id === presetEl.value)?.description ??
        "";
    }
  }
}

export const mountFreeTimeLedger: MountFn<FreeTimeLedgerArgs> = async (
  root,
  args,
  signal,
) => {
  let modules: Modules;
  try {
    modules = await loadModules();
  } catch (cause) {
    // Loud, not inert: the host decides what to show (see `WidgetLoadError`).
    throw new WidgetLoadError(cause);
  }
  if (signal.aborted) return onceDestroy(() => {});

  applyArgs(root, args);
  const controller = setupWidget(root, modules);
  controller?.refit();

  return onceDestroy(
    () => controller?.release(),
    () => {
      const v = (role: string) =>
        (
          root.querySelector(`[data-role="${role}"]`) as
            | HTMLInputElement
            | HTMLSelectElement
            | HTMLTextAreaElement
            | null
        )?.value ?? "";
      const weekend = [
        ...root.querySelectorAll<HTMLInputElement>('[data-role="weekend"]'),
      ]
        .filter((el) => el.checked)
        .map((el) => el.value)
        .join(",");
      // Strings only: a permalink carries no numbers below 1900 and no lists.
      const out: Record<string, string> = {
        clockStart: v("clock-start"),
        clockEnd: v("clock-end"),
        freeDays: v("free-days"),
        firstDay: v("first-day"),
        basis: v("basis"),
        chargeBasis: v("charge-basis"),
        zone: v("zone"),
      };
      if (v("basis") === "working" || v("charge-basis") === "working") {
        out.weekend = weekend;
        const holidays = v("holidays")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(",");
        if (holidays) out.holidays = holidays;
      }
      if (v("tiers").trim()) out.tiers = v("tiers").trim();
      return out;
    },
  );
};
